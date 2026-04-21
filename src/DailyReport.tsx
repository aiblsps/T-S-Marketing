import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { Calendar as CalendarIcon, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDate, toBengaliNumber } from './lib/utils';

export const DailyReport = ({ date: propDate, viewOnly = false }: { date?: string, viewOnly?: boolean }) => {
  const { t, language } = useApp();
  const { role } = useAuth();
  const [date, setDate] = useState(propDate || new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [cashReceiveTransactions, setCashReceiveTransactions] = useState<any[]>([]);
  const [todayClosing, setTodayClosing] = useState<any>(null);
  const [todayTransactions, setTodayTransactions] = useState<any[]>([]);
  const [previousClosing, setPreviousClosing] = useState<number>(0);
  const [previousReport, setPreviousReport] = useState<any>(null);
  const [isAlreadySaved, setIsAlreadySaved] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  useEffect(() => {
    if (propDate) setDate(propDate);
  }, [propDate]);

  useEffect(() => {
    if (role !== 'super_admin' && role !== 'admin' && role !== 'director') return;

    // Check if already saved for today
    const qSaved = query(collection(db, 'daily_summaries'), where('date', '==', date));
    const unsubSaved = onSnapshot(qSaved, (snap) => {
      setIsAlreadySaved(!snap.empty);
    });

    // Fetch Cash Receive transactions for selected date
    const qCashReceive = query(
      collection(db, 'transactions'),
      where('type', '==', 'Cash Receive'),
      where('date', '==', date)
    );
    const unsubCashReceive = onSnapshot(qCashReceive, (snap) => {
      setCashReceiveTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any })));
    });

    // Fetch closing for selected date
    const qClosings = query(
      collection(db, 'cash_closings'),
      where('date', '==', date)
    );
    const unsubClosings = onSnapshot(qClosings, (snap) => {
      if (!snap.empty) {
        setTodayClosing(snap.docs[0].data());
      } else {
        setTodayClosing(null);
      }
    });

    // Fetch latest closing before selected date
    const qPrevClosings = query(
      collection(db, 'cash_closings'),
      where('date', '<', date)
    );
    const unsubPrevClosings = onSnapshot(qPrevClosings, (snap) => {
      const sorted = snap.docs
        .map(d => d.data())
        .sort((a, b) => b.date.localeCompare(a.date));
      
      if (sorted.length > 0) {
        setPreviousClosing(sorted[0].todayLastBalance || sorted[0].closingBalance || 0);
      } else {
        setPreviousClosing(0);
      }
    });

    // Fetch all transactions for selected date
    const qTodayTrans = query(
      collection(db, 'transactions'),
      where('date', '==', date)
    );
    const unsubTodayTrans = onSnapshot(qTodayTrans, (snap) => {
      setTodayTransactions(snap.docs.map(doc => doc.data()));
    });

    // Fetch previous day's report
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    const qPrevReport = query(
      collection(db, 'daily_summaries'),
      where('date', '==', prevDateStr)
    );
    const unsubPrevReport = onSnapshot(qPrevReport, (snap) => {
      if (!snap.empty) {
        setPreviousReport(snap.docs[0].data());
      } else {
        setPreviousReport(null);
      }
    });

    return () => {
      unsubSaved();
      unsubCashReceive();
      unsubClosings();
      unsubPrevClosings();
      unsubTodayTrans();
      unsubPrevReport();
    };
  }, [role, date]);

  const calculateTotals = () => {
    // If we have a closing record for today, use its values
    if (todayClosing) {
      return {
        receive: todayClosing.todayTotalReceive || 0,
        payment: todayClosing.todayTotalPayment || 0,
        expense: todayClosing.todayTotalExpense || 0,
        profit: todayClosing.todayTotalProfit || 0,
        lastBalance: todayClosing.todayLastBalance || 0,
        previousTotal: todayClosing.previousDaysCashMother || 0
      };
    }

    // Fallback to manual calculation from transactions
    let receive = 0;
    let payment = 0;
    let expense = 0;
    let profit = 0;

    todayTransactions.forEach(tx => {
      if (tx.category === 'cash_closing_report') return;
      if (tx.type === 'Receive') receive += tx.amount || 0;
      else if (tx.type === 'Payment') payment += tx.amount || 0;
      else if (tx.type === 'Expense') expense += tx.amount || 0;
      else if (tx.type === 'Profit') profit += tx.amount || 0;
    });

    const lastBalance = previousClosing + receive + profit - payment - expense;
    return { receive, payment, expense, profit, lastBalance, previousTotal: previousClosing };
  };

  const totals = calculateTotals();
  const previousTotal = totals.previousTotal;

  const statusResult = () => {
    const todayTotal = totals.lastBalance;
    if (Math.abs(todayTotal - previousTotal) < 0.01) return { label: "Matched", value: 0, color: 'text-slate-800' };
    if (todayTotal < previousTotal) return { label: "Less", value: previousTotal - todayTotal, color: 'text-rose-600' };
    return { label: "Surplus", value: todayTotal - previousTotal, color: 'text-emerald-600' };
  };

  const handleSave = async () => {
    if (isAlreadySaved) {
      setErrorModal("Report already saved for this date.");
      return;
    }

    setLoading(true);
    try {
      const reportData = {
        date,
        previous_days_cash_mother: previousTotal,
        today_receive: totals.receive,
        today_profit: totals.profit,
        today_payment: totals.payment,
        today_expense: totals.expense,
        today_last_balance: totals.lastBalance,
        status: statusResult(),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'daily_summaries'), reportData);
      setSuccessModal(t('reportSaved'));
    } catch (error) {
      console.error("Error saving daily report:", error);
      setErrorModal(t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'super_admin' && role !== 'admin' && role !== 'director') {
    return <div className="p-8 text-center font-bold text-slate-500">{t('noPermission')}</div>;
  }

  const status = statusResult();

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-8">
        {!propDate && !viewOnly && (
          <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <CalendarIcon className="text-emerald-600" />
              {t('dailyReport')}
            </h2>
            <div className="relative">
              <input
                type="date"
                className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:border-emerald-500"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
        )}

          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center space-y-1 pb-4 border-b border-slate-100">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">Al-Arafah Islami Bank PLC</h1>
            <h2 className="text-lg font-black text-slate-800">SPS Bazar Outlet</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kayaria Lanch Ghat, Kayaria | Kalkini, Madaripur.</p>
            <h3 className="text-lg font-black text-slate-800 pt-2 uppercase tracking-widest">{t('dailyReport')}</h3>
            <p className="text-slate-500 font-bold">{toBengaliNumber(formatDate(date, language), language)}</p>
          </div>

          <div className="space-y-2">
            {/* Previous Days */}
            <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-700">Previous Days (Cash + Mother)</span>
              <span className="font-bold text-slate-900">{formatCurrency(previousTotal, language)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
              <span className="font-bold text-emerald-700">{t('todayTotalReceive')}</span>
              <span className="font-bold text-emerald-700">{formatCurrency(totals.receive, language)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
              <span className="font-bold text-emerald-700">{t('todayProfitReceive')}</span>
              <span className="font-bold text-emerald-700">{formatCurrency(totals.profit, language)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-rose-50/50 border border-rose-100 rounded-lg">
              <span className="font-bold text-rose-700">{t('todayTotalPayment')}</span>
              <span className="font-bold text-rose-700">{formatCurrency(totals.payment, language)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
              <span className="font-bold text-amber-700">{t('todayTotalExpense')}</span>
              <span className="font-bold text-amber-700">{formatCurrency(totals.expense, language)}</span>
            </div>

            {/* Today Total */}
            <div className="flex justify-between items-center p-4 bg-slate-900 rounded-xl shadow-lg mt-4">
              <span className="font-black text-white">{t('todayLastBalance')}</span>
              <span className="font-black text-emerald-400 text-lg">{formatCurrency(totals.lastBalance, language)}</span>
            </div>
          </div>

          {!propDate && !viewOnly && (
            <button
              onClick={handleSave}
              disabled={loading || isAlreadySaved}
              className={cn(
                "w-full py-4 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2",
                isAlreadySaved ? "bg-slate-300 cursor-not-allowed" : "bg-slate-900"
              )}
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
              {isAlreadySaved ? "Report Saved" : t('save')}
            </button>
          )}
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {successModal && (
          <div className="fixed inset-0 md:left-64 lg:left-72 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('success')}</h3>
                <p className="text-slate-500 text-sm font-bold">{successModal}</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); setSuccessModal(null); }}>
                <button 
                  autoFocus
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200"
                >
                  {t('ok')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 md:left-64 lg:left-72 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <AlertTriangle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('error')}</h3>
                <p className="text-slate-500 text-sm font-bold">{errorModal}</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); setErrorModal(null); }}>
                <button 
                  autoFocus
                  type="submit"
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl"
                >
                  {t('ok')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
