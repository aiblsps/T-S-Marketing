import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, query, where, orderBy, limit, getDocs, doc, getDoc, serverTimestamp, deleteDoc, increment, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { formatCurrency, cn, toBengaliNumber, formatDate, formatNumber } from './lib/utils';
import { Receipt, Wallet, ArrowDownCircle, ArrowUpCircle, History, Landmark, Info, CheckCircle2, AlertCircle, Calculator, TrendingUp, FileText, Calendar, Save, Plus, X } from 'lucide-react';
import { DailyReport } from './DailyReport';
import { motion, AnimatePresence } from 'motion/react';

export const Transactions = () => {
  const navigate = useNavigate();
  const { role, customUserId } = useAuth();
  const { t, language } = useApp();
  const location = useLocation();
  const [view, setView] = useState<'selection' | 'form'>(() => {
    const state = location.state as any;
    return (state?.category) ? 'form' : 'selection';
  });
  const [category, setCategory] = useState<'cash_closing' | 'general' | 'profit' | 'daily_report' | 'without_payment'>(() => {
    const state = location.state as any;
    return state?.category || 'cash_closing';
  });
  const [subType, setSubType] = useState<string>(() => {
    const state = location.state as any;
    return state?.subType || '';
  });
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  
  // Data states
  const [previousCashAmount, setPreviousCashAmount] = useState<number>(0);
  const [previousMotherAmount, setPreviousMotherAmount] = useState<number>(0);
  const [previousPaymentAmount, setPreviousPaymentAmount] = useState<number>(0);
  const [todayLastBalance, setTodayLastBalance] = useState<number>(0);
  const [isAmountEditable, setIsAmountEditable] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withoutPayments, setWithoutPayments] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);
  const [editingWithoutPayment, setEditingWithoutPayment] = useState<any>(null);

  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    amount: '',
    cashAmount: '',
    motherAmount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    name: '' // For without payment
  });

  const [isClosed, setIsClosed] = useState(false);
  const [existingReceive, setExistingReceive] = useState<any>(null);

  useEffect(() => {
    if (category === 'without_payment') {
      const q = query(collection(db, 'without_payments'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setWithoutPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    }
  }, [category]);

  useEffect(() => {
    if (!formData.date) return;
    const q = query(
      collection(db, 'cash_closings'),
      where('date', '==', formData.date)
    );
    const unsub = onSnapshot(q, (snap) => {
      setIsClosed(!snap.empty);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cash_closings');
    });
    return () => unsub();
  }, [formData.date]);

  useEffect(() => {
    const fetchReceiveData = async () => {
      // Enable by default and set amount to 0
      setIsAmountEditable(true);
      setPreviousPaymentAmount(0);
      setExistingReceive(null);

      if (category !== 'cash_closing' || subType !== 'receive' || !formData.date) {
        return;
      }
      
      try {
        // 1. Check for today's existing receive first
        const qToday = query(
          collection(db, 'transactions'),
          where('date', '==', formData.date),
          where('type', '==', 'Cash Receive'),
          limit(1)
        );
        const todaySnap = await getDocs(qToday);
        
        if (!todaySnap.empty) {
          const data = todaySnap.docs[0].data();
          setExistingReceive(data);
          const cash = data.cashAmount || 0;
          const mother = data.motherAmount || 0;
          setPreviousCashAmount(cash);
          setPreviousMotherAmount(mother);
          setFormData(prev => ({ 
            ...prev, 
            amount: data.amount.toString(), 
            cashAmount: cash.toString(), 
            motherAmount: mother.toString(),
            description: data.description || ''
          }));
          setIsAmountEditable(false);
          return;
        }

        // 2. If no today's receive, fetch previous day's closing
        const q = query(
          collection(db, 'cash_closings')
        );
        const querySnapshot = await getDocs(q);
        const prevDocs = querySnapshot.docs
          .map(d => d.data())
          .filter(d => d.date < formData.date)
          .sort((a, b) => b.date.localeCompare(a.date));

        if (prevDocs.length > 0) {
          const cash = prevDocs[0].todayCash || 0;
          const mother = prevDocs[0].todayMother || 0;
          const amount = cash + mother;
          setPreviousCashAmount(cash);
          setPreviousMotherAmount(mother);
          setPreviousPaymentAmount(amount);
          setFormData(prev => ({ ...prev, amount: amount.toString(), cashAmount: cash.toString(), motherAmount: mother.toString() }));
          setIsAmountEditable(false); // Lock if data found
        } else {
          setFormData(prev => ({ ...prev, amount: '', cashAmount: '', motherAmount: '' }));
          setIsAmountEditable(true); // Keep enabled if no data
        }
      } catch (error) {
        console.error("Error fetching receive data:", error);
        setIsAmountEditable(true); // Enable on error so user can type
      }
    };
    fetchReceiveData();
  }, [category, subType, formData.date]);

  useEffect(() => {
    const fetchTodayLastBalance = async () => {
      if (category !== 'cash_closing' || subType !== 'payment') {
        return;
      }

      try {
        // 1. Get Previous Day Cash from cash_closings
        let prevCash = 0;
        const qPrev = query(
          collection(db, 'cash_closings')
        );
        const prevSnap = await getDocs(qPrev);
        const prevDocs = prevSnap.docs
          .map(d => d.data())
          .filter(d => d.date < formData.date)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        if (prevDocs.length > 0) {
          prevCash = prevDocs[0].closingBalance || 0;
        }

        // 2. Get Today's Totals
        const qToday = query(
          collection(db, 'transactions'),
          where('date', '==', formData.date)
        );
        const todaySnap = await getDocs(qToday);
        let receive = 0;
        let payment = 0;
        let expense = 0;
        
        todaySnap.docs.forEach(doc => {
          const data = doc.data();
          // Exclude "Cash Closing" payments
          if (data.note === 'Cash Closing' || data.description === 'Cash Closing') return;

          if (data.type === 'Receive') receive += data.amount || 0;
          else if (data.type === 'Payment') payment += data.amount || 0;
          else if (data.type === 'Expense') expense += data.amount || 0;
        });

        const lastBalance = prevCash + receive - payment - expense;
        setTodayLastBalance(lastBalance);
        setFormData(prev => ({ ...prev, amount: lastBalance > 0 ? lastBalance.toString() : '' }));
      } catch (error) {
        console.error("Error fetching today last balance:", error);
      }
    };

    fetchTodayLastBalance();
  }, [category, subType, formData.date]);

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'transactions'),
        orderBy('date', 'desc'),
        limit(20)
      );
      const unsub = onSnapshot(q, (snap) => {
        setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      });
      return () => unsub();
    } catch (err) {
      console.error("Query setup error:", err);
    }
  }, []);

  const handleDelete = async (tx: any) => {
    try {
      const collectionName = tx.collection || 'transactions';
      await deleteDoc(doc(db, collectionName, tx.id));
      setShowDeleteConfirm(null);
      setSuccessModal('Entry deleted successfully.');
    } catch (error) {
      console.error("Error deleting entry:", error);
      handleFirestoreError(error, OperationType.DELETE, `${tx.collection || 'transactions'}/${tx.id}`);
      setErrorModal('Error deleting entry.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subType) {
      setErrorModal('Please select a transaction type.');
      return;
    }

    setLoading(true);
    try {
      if (category === 'without_payment') {
        const data = {
          name: formData.name,
          amount: parseFloat(formData.amount),
          date: formData.date,
          description: formData.description,
          createdAt: serverTimestamp()
        };

        if (editingWithoutPayment) {
          await updateDoc(doc(db, 'without_payments', editingWithoutPayment.id), data);
          setSuccessModal('Entry updated successfully.');
        } else {
          await addDoc(collection(db, 'without_payments'), data);
          setSuccessModal('Entry added successfully.');
        }
        setFormData({ ...formData, amount: '', name: '', description: '' });
        setEditingWithoutPayment(null);
        setLoading(false);
        return;
      }

      let type = '';
      let amount = parseFloat(formData.amount);
      let cashAmount = parseFloat(formData.cashAmount) || 0;
      let motherAmount = parseFloat(formData.motherAmount) || 0;

      if (category === 'cash_closing') {
        if (subType === 'receive') {
          if (existingReceive) {
            setErrorModal('Cash receive already completed for this date.');
            setLoading(false);
            return;
          }
          type = 'Cash Receive';
          if (!isAmountEditable) {
            amount = previousPaymentAmount;
            cashAmount = previousCashAmount;
            motherAmount = previousMotherAmount;
          } else {
            amount = cashAmount + motherAmount;
          }
        } else {
          type = 'Cash Payment';
        }
      } else if (category === 'profit') {
        type = 'Profit';
      } else {
        if (subType === 'receive') type = 'Receive';
        else if (subType === 'payment') type = 'Payment';
        else type = 'Expense';
      }

      if (isNaN(amount) || amount < 0) {
        setErrorModal('Please enter a valid amount.');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'transactions'), {
        amount,
        cashAmount: cashAmount,
        motherAmount: motherAmount,
        date: formData.date,
        type,
        category,
        description: formData.description,
        customUserId: customUserId || 'N/A',
        createdAt: serverTimestamp()
      });

      setSuccessModal('Transaction completed successfully.');
      setFormData({ ...formData, amount: '', cashAmount: '', motherAmount: '', description: '' });
      if (category !== 'general') setSubType('');
    } catch (error) {
      console.error("Error saving transaction:", error);
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
      setErrorModal('Error saving transaction.');
    } finally {
      setLoading(false);
    }
  };

  const isEditable = true; // Always editable now, fallback handled in background

  if (view === 'selection') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('transactions')}</h2>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Receipt size={28} />
            </div>
          </div>

          {/* Outlet selection removed for consolidation */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCategory('cash_closing');
                setSubType('');
                setView('form');
              }}
              className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-emerald-500 hover:bg-emerald-50/30 transition-all group"
            >
              <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <Wallet size={32} />
              </div>
              <span className="text-lg font-bold text-slate-800">{formatNumber(1, language)}. {t('cashManagement')}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCategory('general');
                setSubType('');
                setView('form');
              }}
              className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-blue-500 hover:bg-blue-50/30 transition-all group"
            >
              <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <Landmark size={32} />
              </div>
              <span className="text-lg font-bold text-slate-800">{formatNumber(2, language)}. {t('generalTransactions')}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCategory('profit');
                setSubType('receive');
                setView('form');
              }}
              className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-amber-500 hover:bg-amber-50/30 transition-all group"
            >
              <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp size={32} />
              </div>
              <span className="text-lg font-bold text-slate-800">{formatNumber(3, language)}. {t('addProfit')}</span>
            </motion.button>

            {(role === 'super_admin' || role === 'admin') && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/cash-closing')}
                className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-purple-500 hover:bg-purple-50/30 transition-all group"
              >
                <div className="p-4 bg-purple-100 text-purple-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <Calculator size={32} />
                </div>
                <span className="text-lg font-bold text-slate-800">{formatNumber(4, language)}. {t('cashClosingPage')}</span>
              </motion.button>
            )}

            {role === 'super_admin' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setCategory('daily_report');
                  setSubType('');
                  setView('form');
                }}
                className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group"
              >
                <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <FileText size={32} />
                </div>
                <span className="text-lg font-bold text-slate-800">{formatNumber(5, language)}. {t('dailyReport')}</span>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCategory('without_payment');
                setSubType('receive');
                setView('form');
              }}
              className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-rose-500 hover:bg-rose-50/30 transition-all group"
            >
              <div className="p-4 bg-rose-100 text-rose-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <AlertCircle size={32} />
              </div>
              <span className="text-lg font-bold text-slate-800">{formatNumber(6, language)}. Without Payment</span>
            </motion.button>
          </div>
        </div>

        {/* Recent Transactions in Selection View - Removed as requested */}
      </div>
    );
  }

  return (
    <div className={cn(
      "mx-auto pb-20 px-4 sm:px-6 space-y-8",
      category === 'without_payment' ? "max-w-none w-full" : "max-w-4xl"
    )}>
      {/* Header Section */}
      <div className={cn(
        "space-y-6",
        category !== 'without_payment' && "bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setView('selection');
                setEditingWithoutPayment(null);
                setFormData({ ...formData, amount: '', name: '', description: '' });
              }}
              className="px-4 py-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 font-black text-xs uppercase tracking-widest"
            >
              Back
            </button>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {category === 'cash_closing' ? t('cashManagement') : 
               category === 'profit' ? t('addProfit') : 
               category === 'daily_report' ? t('dailyReport') : 
               category === 'without_payment' ? "Without Payment" : t('generalTransactions')}
            </h2>
          </div>
          {category !== 'without_payment' && (
            <div className={cn(
              "p-3 rounded-2xl",
              category === 'cash_closing' ? "bg-emerald-50 text-emerald-600" : 
              category === 'profit' ? "bg-amber-50 text-amber-600" : 
              category === 'daily_report' ? "bg-indigo-50 text-indigo-600" : "bg-blue-50 text-blue-600"
            )}>
              {category === 'cash_closing' ? <Wallet size={28} /> : 
               category === 'profit' ? <TrendingUp size={28} /> : 
               category === 'daily_report' ? <FileText size={28} /> : <Landmark size={28} />}
            </div>
          )}
        </div>

        {category === 'daily_report' ? (
          <DailyReport />
        ) : category === 'without_payment' ? (
          <div className="space-y-10 w-full">
            {/* Running Total - Smaller and Full Width */}
            <div className="bg-[#8B002D] p-8 rounded-[2.5rem] shadow-xl flex items-center justify-between relative overflow-hidden w-full">
              <div className="relative z-10 space-y-1">
                <p className="text-rose-200 text-xs font-black uppercase tracking-[0.2em]">Total Without Payment</p>
                <h3 className="text-4xl font-black text-white tracking-tighter">
                  {formatCurrency(withoutPayments.reduce((sum, p) => sum + (p.amount || 0), 0), language)}
                </h3>
              </div>
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="relative z-10 w-16 h-16 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all active:scale-90 flex items-center justify-center"
              >
                {showAddForm ? <X size={32} strokeWidth={3} /> : <Plus size={32} strokeWidth={3} />}
              </button>
              {/* Decorative background element */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
            </div>

            {/* Form */}
            <AnimatePresence>
              {(showAddForm || editingWithoutPayment) && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6 max-w-4xl mx-auto"
                >
                  <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Name</label>
                        <input 
                          type="text" 
                          required 
                          className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm shadow-sm transition-all"
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          placeholder="Enter name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Amount</label>
                        <input 
                          type="number" 
                          required 
                          className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm shadow-sm transition-all"
                          value={formData.amount}
                          onChange={e => setFormData({...formData, amount: e.target.value})}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date</label>
                        <input 
                          type="date" 
                          required 
                          className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm shadow-sm transition-all"
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Note</label>
                        <input 
                          type="text" 
                          className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm shadow-sm transition-all"
                          value={formData.description}
                          onChange={e => setFormData({...formData, description: e.target.value})}
                          placeholder="Optional note"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-2">
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-4 bg-rose-600 text-white font-black rounded-xl shadow-xl shadow-rose-100 active:scale-95 transition-all flex items-center justify-center text-base"
                      >
                        {loading ? <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" /> : (editingWithoutPayment ? "Update Entry" : "Save Entry")}
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingWithoutPayment(null);
                          setShowAddForm(false);
                          setFormData({ ...formData, amount: '', name: '', description: '' });
                        }}
                        className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-xl active:scale-95 transition-all text-base"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Table */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] ml-4">Recent Entries</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse border-2 border-slate-400 bg-white">
                  <thead>
                    <tr className="bg-slate-200">
                      <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Date</th>
                      <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Name</th>
                      <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Amount</th>
                      <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-400">
                    {withoutPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-2 border-2 border-slate-400 font-bold text-slate-600 text-sm whitespace-nowrap">{formatDate(p.date, language)}</td>
                        <td className="p-2 border-2 border-slate-400 font-black text-slate-900 text-base whitespace-nowrap">{p.name}</td>
                        <td className="p-2 border-2 border-slate-400 font-black text-rose-700 text-lg whitespace-nowrap">{formatCurrency(p.amount, language)}</td>
                        <td className="p-2 border-2 border-slate-400 whitespace-nowrap">
                          <div className="flex justify-center gap-2">
                            {(role === 'admin' || role === 'super_admin') && (
                              <button 
                                onClick={() => setShowDeleteConfirm({ ...p, collection: 'without_payments' })}
                                className="px-3 py-1.5 text-rose-700 hover:bg-rose-50 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest border-2 border-rose-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {withoutPayments.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-20 text-center text-slate-400 font-black text-lg uppercase tracking-widest border-2 border-slate-400">No entries found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Outlet selection removed for consolidation */}
        </div>
      )}
    </div>

      {/* Main Transaction Form */}
      {category !== 'daily_report' && category !== 'without_payment' && (
        <div className={cn(
          "bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8",
          !isEditable && "opacity-50 pointer-events-none"
        )}>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sub-type Selection */}
            <div className="space-y-2">
              <label className="text-lg font-black text-black uppercase ml-1">{t('transactionTypeLabel')}</label>
              <select 
                className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
              >
                <option value="">{t('selectMethod')}</option>
                {category === 'cash_closing' ? (
                  <>
                    <option value="receive">{t('receive')}</option>
                  </>
                ) : category === 'profit' ? (
                  <option value="receive">{t('addProfit')}</option>
                ) : (
                  <>
                    <option value="receive">{t('receive')}</option>
                    <option value="payment">{t('payment')}</option>
                    <option value="expense">{t('expense')}</option>
                  </>
                )}
              </select>
            </div>

            {/* Date Field */}
            <div className="space-y-1">
              <label className="text-lg font-black text-black uppercase ml-1">{t('date')}</label>
              <input 
                type="date" 
                required 
                className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amount Field */}
            {category === 'cash_closing' && subType === 'receive' ? (
              <>
                <div className="space-y-1">
                  <label className="text-lg font-black text-black uppercase ml-1">Cash Amount</label>
                  {isAmountEditable ? (
                    <input 
                      type="number" 
                      required 
                      className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900 text-xl"
                      value={formData.cashAmount}
                      onChange={e => setFormData({...formData, cashAmount: e.target.value})}
                      placeholder={language === 'bn' ? '০.০০' : '0.00'}
                    />
                  ) : (
                    <div className="w-full px-5 py-4 bg-slate-100 border-2 border-slate-500 rounded-2xl font-black text-slate-900 text-xl flex items-center justify-between">
                      <span>{formatCurrency(previousCashAmount, language)}</span>
                      <Info size={16} className="text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-lg font-black text-black uppercase ml-1">Mother Amount</label>
                  {isAmountEditable ? (
                    <input 
                      type="number" 
                      required 
                      className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900 text-xl"
                      value={formData.motherAmount}
                      onChange={e => setFormData({...formData, motherAmount: e.target.value})}
                      placeholder={language === 'bn' ? '০.০০' : '0.00'}
                    />
                  ) : (
                    <div className="w-full px-5 py-4 bg-slate-100 border-2 border-slate-500 rounded-2xl font-black text-slate-900 text-xl flex items-center justify-between">
                      <span>{formatCurrency(previousMotherAmount, language)}</span>
                      <Info size={16} className="text-slate-400" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <label className="text-lg font-black text-black uppercase ml-1">{t('amount')}</label>
                <input 
                  type="number" 
                  required 
                  className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  placeholder={language === 'bn' ? '০.০০' : '0.00'}
                />
              </div>
            )}
          </div>

          {/* Description Field */}
          {category !== 'cash_closing' && (
            <div className="space-y-1">
              <label className="text-lg font-black text-black uppercase ml-1">{t('note')}</label>
              <textarea 
                className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold text-slate-900 min-h-[100px]"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder={t('enterDescription')}
              />
            </div>
          )}

          {/* Hidden/Auto Fields */}
          <div className="hidden p-4 bg-slate-50 rounded-2xl border border-slate-100 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase">{t('userId')}:</span>
            </div>
            <span className="font-black text-slate-600 text-sm">{customUserId || 'N/A'}</span>
          </div>

          <button 
            type="submit" 
            disabled={loading || !isEditable || !subType}
            className={cn(
              "w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg",
              (subType === 'receive' || category === 'profit') ? "bg-emerald-600 shadow-emerald-200" : 
              subType === 'payment' ? "bg-rose-600 shadow-rose-200" : 
              subType === 'expense' ? "bg-amber-600 shadow-amber-200" : "bg-slate-400"
            )}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {(subType === 'receive' || category === 'profit') ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                {category === 'profit' ? t('addProfit') : subType === 'receive' ? t('receive') : subType === 'payment' ? t('payment') : subType === 'expense' ? t('expense') : t('submit')}
              </>
            )}
          </button>
        </form>
      </div>
      )}

      {/* Header Section */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <AlertCircle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('areYouSure')}</h3>
                <p className="text-slate-500 text-sm font-bold">{t('deleteConfirmMessage')}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">{t('cancel')}</button>
                <button 
                  onClick={() => handleDelete(showDeleteConfirm)} 
                  className="flex-1 py-4 bg-rose-600 text-white font-black rounded-2xl shadow-lg shadow-rose-200"
                >
                  {t('delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successModal && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{successModal === 'Entry added successfully.' || successModal === 'Entry updated successfully.' || successModal === 'Entry deleted successfully.' ? 'Success' : t('success')}</h3>
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

