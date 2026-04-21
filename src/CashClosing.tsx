import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, getDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { formatCurrency, cn, toBengaliNumber } from './lib/utils';
import { Calculator, Landmark, Info, AlertCircle, CheckCircle2, History, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export const CashClosing = () => {
  const { role, customUserId } = useAuth();
  const { t, language } = useApp();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [previousDaysCashMother, setPreviousDaysCashMother] = useState(0);
  const [todayCash, setTodayCash] = useState('');
  const [todayMother, setTodayMother] = useState('');
  const [todayTotalReceive, setTodayTotalReceive] = useState(0);
  const [todayTotalProfit, setTodayTotalProfit] = useState(0);
  const [todayTotalPayment, setTodayTotalPayment] = useState(0);
  const [todayTotalExpense, setTodayTotalExpense] = useState(0);
  
  const [denominations, setDenominations] = useState<Record<number, string>>(
    NOTES.reduce((acc, note) => ({ ...acc, [note]: '' }), {})
  );

  const [isClosed, setIsClosed] = useState(false);
  const [closingDocId, setClosingDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    const q = query(
      collection(db, 'cash_closings'),
      where('date', '==', date)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        setIsClosed(true);
        setClosingDocId(snap.docs[0].id);
        setTodayCash(docData.todayCash?.toString() || '');
        setTodayMother(docData.todayMother?.toString() || '');
        if (docData.denominations) {
          setDenominations(docData.denominations);
        }
      } else {
        setIsClosed(false);
        setClosingDocId(null);
        setTodayCash('');
        setTodayMother('');
        setDenominations(NOTES.reduce((acc, note) => ({ ...acc, [note]: '' }), {}));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cash_closings');
    });
    return () => unsub();
  }, [date]);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Previous Day Cash Closing record
      let lastClosingBalance = 0;
      let hasPreviousClosing = false;
      try {
        const qPrev = query(
          collection(db, 'cash_closings')
        );
        const prevSnap = await getDocs(qPrev);
        const prevDocs = prevSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(d => d.date < date)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        if (prevDocs.length > 0) {
          lastClosingBalance = prevDocs[0].todayLastBalance || 0;
          hasPreviousClosing = true;
        }
      } catch (error) {
        console.error("Error fetching previous cash:", error);
      }

      // 2. Fetch Today's Totals
      try {
        const qToday = query(
          collection(db, 'transactions'),
          where('date', '==', date)
        );
        
        const unsub = onSnapshot(qToday, (snap) => {
          let receive = 0;
          let payment = 0;
          let expense = 0;
          let profit = 0;
          let cashManagementReceive = 0;
          
          snap.docs.forEach(doc => {
            const data = doc.data();
            // Exclude "Cash Closing" payments from today's totals to avoid double counting
            if (data.category === 'cash_closing_report') return;

            if (data.type === 'Receive') receive += data.amount || 0;
            else if (data.type === 'Payment') payment += data.amount || 0;
            else if (data.type === 'Expense') expense += data.amount || 0;
            else if (data.type === 'Profit') profit += data.amount || 0;
            else if (data.type === 'Cash Receive') cashManagementReceive += data.amount || 0;
          });
          
          setTodayTotalReceive(receive);
          setTodayTotalProfit(profit);
          setTodayTotalPayment(payment);
          setTodayTotalExpense(expense);

          if (hasPreviousClosing) {
            setPreviousDaysCashMother(lastClosingBalance);
          } else {
            setPreviousDaysCashMother(cashManagementReceive);
          }
        });
        
        return () => unsub();
      } catch (error) {
        console.error("Error fetching today's totals:", error);
      }
    };

    fetchData();
  }, [date]);

  const todayLastBalance = previousDaysCashMother + todayTotalReceive + todayTotalProfit - todayTotalPayment - todayTotalExpense;

  const denominationTotal = useMemo(() => {
    return NOTES.reduce((sum, note) => {
      const count = parseInt(denominations[note] || '0');
      return sum + (note * count);
    }, 0);
  }, [denominations]);

  const totalNotesCount = useMemo(() => {
    return NOTES.reduce((sum, note) => {
      const count = parseInt(denominations[note] || '0');
      return sum + count;
    }, 0);
  }, [denominations]);

  const totalInputAmount = (parseFloat(todayCash) || 0) + (parseFloat(todayMother) || 0);
  
  // Status: Today Last Balance == Today Cash + Mother
  const balanceDiff = totalInputAmount - todayLastBalance;
  const isBalanceMatched = Math.abs(balanceDiff) < 0.01;
  
  // Status: Today Input Cash == Cash Note Calculation
  const cashDiff = denominationTotal - (parseFloat(todayCash) || 0);
  const isCashMatched = Math.abs(cashDiff) < 0.01;

  const canClose = isBalanceMatched && isCashMatched && !isClosed && todayLastBalance > 0;

  const getStatusInfo = (diff: number) => {
    if (Math.abs(diff) < 0.01) return { label: "Matched", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-100" };
    if (diff < 0) return { label: `Less (${formatCurrency(Math.abs(diff), language)})`, color: "text-rose-700", bgColor: "bg-rose-50", borderColor: "border-rose-100" };
    return { label: `Surplus (${formatCurrency(diff, language)})`, color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-100" };
  };

  const balanceStatus = getStatusInfo(balanceDiff);
  const cashStatus = getStatusInfo(cashDiff);

  const handleDenominationChange = (note: number, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setDenominations(prev => ({ ...prev, [note]: value }));
    }
  };

  const handleCashClosing = async () => {
    if (isClosed || !canClose) return;
    const cash = parseFloat(todayCash) || 0;
    const mother = parseFloat(todayMother) || 0;
    
    setLoading(true);
    try {
      // 1. Save to Cash Closing Report
      await addDoc(collection(db, 'cash_closings'), {
        date: date,
        previousDaysCashMother,
        todayTotalReceive,
        todayTotalProfit,
        todayTotalPayment,
        todayTotalExpense,
        todayLastBalance,
        todayCash: cash,
        todayMother: mother,
        denominations: denominations,
        createdAt: serverTimestamp()
      });

      // 2. Save to Cash Management Report (Transactions) as Payment
      await addDoc(collection(db, 'transactions'), {
        amount: todayLastBalance,
        cashAmount: cash,
        motherAmount: mother,
        date: date,
        type: 'Cash Payment',
        category: 'cash_closing_report',
        description: 'Daily Cash Closing',
        customUserId: customUserId || 'N/A',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || 'System'
      });

      setSuccessModal(t('closingSuccess'));
    } catch (error) {
      console.error("Error saving cash closing:", error);
      handleFirestoreError(error, OperationType.CREATE, 'cash_closings');
      setErrorModal('Error saving data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 px-4">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="text-center space-y-1 pb-6 border-b-2 border-slate-100">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">Al-Arafah Islami Bank PLC</h1>
          <h2 className="text-lg font-black text-slate-800">SPS Bazar Outlet</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kayaria Lanch Ghat, Kayaria | Kalkini, Madaripur.</p>
          <div className="inline-block mt-4 px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-black uppercase tracking-widest">
            {t('cashClosingPage')}
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-xs space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('date')}</label>
            <div className="relative">
              <History className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="date" 
                className="w-full pl-12 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900 shadow-sm transition-all"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Denomination Table (Left on Desktop, Bottom on Mobile) */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 lg:order-1 order-2">
          <h3 className="text-xl font-black text-slate-800 border-b pb-4">{t('cashNoteCalculation')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200">
              <thead>
                <tr className="text-left bg-slate-50">
                  <th className="p-4 border border-slate-200 font-black text-slate-500 uppercase text-xs">{t('taka')}</th>
                  <th className="p-4 border border-slate-200 font-black text-slate-500 uppercase text-xs">{t('number')}</th>
                  <th className="p-4 border border-slate-200 font-black text-slate-500 uppercase text-xs text-right">{t('totalTaka')}</th>
                </tr>
              </thead>
              <tbody>
                {NOTES.map(note => (
                  <tr key={note} className="group hover:bg-slate-50 transition-colors">
                    <td className="p-3 border border-slate-200 font-black text-slate-700">{toBengaliNumber(note.toString(), language)}</td>
                    <td className="p-3 border border-slate-200">
                      <input 
                        type="text"
                        inputMode="numeric"
                        disabled={isClosed || !isBalanceMatched}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none font-bold text-center disabled:bg-slate-50 disabled:text-slate-400"
                        value={denominations[note]}
                        onChange={(e) => handleDenominationChange(note, e.target.value)}
                        placeholder={t('zero')}
                      />
                    </td>
                    <td className="p-3 border border-slate-200 text-right font-black text-slate-900">
                      {formatCurrency(note * parseInt(denominations[note] || '0'), language)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/30">
                  <td className="p-4 border border-slate-200 font-black text-slate-800">{t('totalNotes')}</td>
                  <td className="p-4 border border-slate-200 text-center font-black text-emerald-600">{toBengaliNumber(totalNotesCount.toString(), language)}</td>
                  <td className="p-4 border border-slate-200 text-right font-black text-emerald-600 text-lg">{formatCurrency(denominationTotal, language)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Calculation Section (Right on Desktop, Top on Mobile) */}
        <div className="space-y-6 lg:order-2 order-1">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xl font-black text-slate-800 border-b pb-4">{t('cashSummary')}</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-600">Previous Days (Cash + Mother)</span>
                <span className="font-black text-slate-900">{formatCurrency(previousDaysCashMother, language)}</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <span className="font-bold text-emerald-700">{t('todayTotalReceive')}</span>
                <span className="font-black text-emerald-700">{formatCurrency(todayTotalReceive, language)}</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <span className="font-bold text-emerald-700">{t('todayProfitReceive')}</span>
                <span className="font-black text-emerald-700">{formatCurrency(todayTotalProfit, language)}</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                <span className="font-bold text-rose-700">{t('todayTotalPayment')}</span>
                <span className="font-black text-rose-700">{formatCurrency(todayTotalPayment, language)}</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                <span className="font-bold text-amber-700">{t('todayTotalExpense')}</span>
                <span className="font-black text-amber-700">{formatCurrency(todayTotalExpense, language)}</span>
              </div>
              
              <div className="flex items-center justify-between p-5 bg-slate-900 rounded-2xl shadow-lg mt-6">
                <span className="font-black text-white text-lg">{t('todayLastBalance')}</span>
                <span className="font-black text-emerald-400 text-2xl">{formatCurrency(todayLastBalance, language)}</span>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); if(canClose && !loading) handleCashClosing(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Today Cash</label>
                  <input 
                    type="number" 
                    disabled={isClosed}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                    value={todayCash}
                    onChange={e => setTodayCash(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mother</label>
                  <input 
                    type="number" 
                    disabled={isClosed}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                    value={todayMother}
                    onChange={e => setTodayMother(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-600">Total (Cash + Mother)</span>
                <span className="font-black text-slate-900">{formatCurrency(totalInputAmount, language)}</span>
              </div>

              {/* Comparison Result */}
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                {/* Balance Match Status */}
                <div className={cn(
                  "p-6 rounded-[2rem] text-center border-2",
                  balanceStatus.bgColor,
                  balanceStatus.borderColor,
                  balanceStatus.color
                )}>
                  <h4 className="text-2xl font-black">
                    {balanceStatus.label}
                  </h4>
                </div>

                {/* Cash Match Status */}
                <div className={cn(
                  "p-6 rounded-[2rem] text-center border-2",
                  cashStatus.bgColor,
                  cashStatus.borderColor,
                  cashStatus.color
                )}>
                  <h4 className="text-2xl font-black">
                    {cashStatus.label}
                  </h4>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 space-y-3">
                  {isClosed ? (
                    <div className="space-y-3">
                      <div className="p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-amber-800 text-center font-black flex items-center justify-center gap-2">
                        <AlertCircle size={20} />
                        {t('cashAlreadyClosed')}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        type="submit"
                        disabled={loading || !canClose}
                        className={cn(
                          "w-full py-5 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg",
                          !canClose
                            ? "bg-slate-300 shadow-none cursor-not-allowed" 
                            : "bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700"
                        )}
                      >
                        {loading ? (
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={24} />
                            Today Cash Closing
                          </>
                        )}
                      </motion.button>
                      {!canClose && !isClosed && (
                        <p className="text-center text-xs font-bold text-rose-500 animate-pulse">
                          {!isBalanceMatched ? "Balance must match (Today Last Balance = Today Cash + Mother)" : "Cash must match Note Calculation"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {successModal && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl">
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
                  className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 active:scale-95 transition-all text-lg"
                >
                  {t('ok')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <AlertCircle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('warning')}</h3>
                <p className="text-slate-500 text-sm font-bold">{errorModal}</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); setErrorModal(null); }}>
                <button 
                  autoFocus
                  type="submit" 
                  className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl active:scale-95 transition-all text-lg"
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
