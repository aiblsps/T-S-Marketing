import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, query, where, orderBy, limit, getDocs, doc, getDoc, serverTimestamp, deleteDoc, increment, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { formatCurrency, cn, toBengaliNumber, formatDate, formatNumber, formatNumberWithCommas, parseNumberFromCommas } from './lib/utils';
import { Receipt, Wallet, ArrowDownCircle, ArrowUpCircle, History, Landmark, Info, CheckCircle2, AlertCircle, Calculator, TrendingUp, FileText, Calendar, Save, Plus, X, Trash2 } from 'lucide-react';
import { DailyReport } from './DailyReport';
import { motion, AnimatePresence } from 'motion/react';

export const Transactions = () => {
  const navigate = useNavigate();
  const { role, customUserId, appSettings } = useAuth();
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
    if (state?.subType) return state.subType;
    const cat = state?.category || 'cash_closing';
    if (cat === 'cash_closing' || cat === 'profit' || cat === 'without_payment') return 'receive';
    return '';
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
  const [persons, setPersons] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);
  const [editingWithoutPayment, setEditingWithoutPayment] = useState<any>(null);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [personFormData, setPersonFormData] = useState({
    type: 'Employee',
    employeeId: '',
    name: '',
    mobile: ''
  });

  // Form states
  const [formData, setFormData] = useState({
    amount: '',
    cashAmount: '',
    motherAmount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    name: '', // For without payment
    personId: '',
    txType: 'Taken' as 'Taken' | 'Given'
  });

  useEffect(() => {
    // Start fetching persons and employees on mount to ensure data is ready instantly
    const unsubPersons = onSnapshot(query(collection(db, 'without_payment_persons'), orderBy('createdAt', 'desc')), (snap) => {
      setPersons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPersons();
      unsubEmployees();
    };
  }, []);

  useEffect(() => {
    if (category === 'without_payment' && viewHistory && selectedPerson) {
      const q = query(
        collection(db, 'without_payment_transactions'), 
        where('personId', '==', selectedPerson.id)
      );
      const unsub = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by createdAt descending client-side
        docs.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        setWithoutPayments(docs);
      });
      return () => unsub();
    }
  }, [category, viewHistory, selectedPerson]);

  const [isClosed, setIsClosed] = useState(false);
  const [isReceived, setIsReceived] = useState(false);
  const [existingReceive, setExistingReceive] = useState<any>(null);

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
    if (!formData.date) return;
    const q = query(
      collection(db, 'transactions'),
      where('date', '==', formData.date),
      where('type', '==', 'Cash Receive'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setIsReceived(!snap.empty);
      if (!snap.empty) {
        setExistingReceive(snap.docs[0].data());
      } else {
        setExistingReceive(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
    return () => unsub();
  }, [formData.date]);

  useEffect(() => {
    const fetchReceiveData = async () => {
      // Enable by default and set amount to 0
      setIsAmountEditable(true);
      setPreviousPaymentAmount(0);

      if (category !== 'cash_closing' || subType !== 'receive' || !formData.date) {
        setFormData(prev => ({ ...prev, amount: '', cashAmount: '', motherAmount: '' }));
        return;
      }
      
      try {
        // 1. Check for today's existing receive first (handled by onSnapshot, just read state)
        if (existingReceive) {
          const data = existingReceive;
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
          setFormData(prev => ({ ...prev, amount: amount?.toString(), cashAmount: cash?.toString(), motherAmount: mother?.toString() }));
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
  }, [category, subType, formData.date, existingReceive]);

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
        setFormData(prev => ({ ...prev, amount: '' }));
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
      const batch = writeBatch(db);
      const collectionName = tx.collection || 'transactions';
      
      // Delete the main record
      batch.delete(doc(db, collectionName, tx.id));

      // Special cleanup for Without Payment Transactions
      if (collectionName === 'without_payment_transactions') {
        const personRef = doc(db, 'without_payment_persons', tx.personId);
        const amount = tx.amount || 0;
        if (tx.type === 'Given') {
          batch.update(personRef, {
            given: increment(-amount),
            balance: increment(amount)
          });
        } else {
          batch.update(personRef, {
            taken: increment(-amount),
            balance: increment(-amount)
          });
        }
      }

      // Special cleanup for Cash Closing
      if (tx.type === 'Cash Payment' && tx.category === 'cash_closing_report') {
        const qCl = query(
          collection(db, 'cash_closings'),
          where('date', '==', tx.date)
        );
        const snapCl = await getDocs(qCl);
        snapCl.forEach(d => batch.delete(d.ref));
      }

      await batch.commit();
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
    
    if (!subType && category !== 'without_payment') {
      setErrorModal('Please select a transaction type.');
      return;
    }

    setLoading(true);
    try {
      if (category === 'without_payment') {
        if (!formData.personId) {
          setErrorModal('Please select a person.');
          setLoading(false);
          return;
        }

        const person = persons.find(p => p.id === formData.personId);
        const amount = parseFloat(parseNumberFromCommas(formData.amount));
        const newBalance = (person?.balance || 0) + (formData.txType === 'Taken' ? amount : -amount);

        const batch = writeBatch(db);
        
        // Add transaction
        const txRef = doc(collection(db, 'without_payment_transactions'));
        batch.set(txRef, {
          personId: formData.personId,
          personName: person?.name || '',
          amount,
          type: formData.txType,
          date: formData.date,
          description: formData.description,
          balanceAfter: newBalance,
          createdAt: serverTimestamp(),
          createdBy: customUserId
        });

        // Update person totals
        const personRef = doc(db, 'without_payment_persons', formData.personId);
        if (formData.txType === 'Given') {
          batch.update(personRef, {
            given: increment(amount),
            balance: increment(-amount)
          });
        } else {
          batch.update(personRef, {
            taken: increment(amount),
            balance: increment(amount)
          });
        }

        await batch.commit();
        setSuccessModal('Transaction added successfully.');
        setFormData({ ...formData, amount: '', description: '' });
        setShowAddForm(false);
        setLoading(false);
        return;
      }

      let type = '';
      let amount = parseFloat(parseNumberFromCommas(formData.amount));
      let cashAmount = parseFloat(parseNumberFromCommas(formData.cashAmount)) || 0;
      let motherAmount = parseFloat(parseNumberFromCommas(formData.motherAmount)) || 0;

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
      if (category === 'cash_closing' || category === 'profit' || category === 'without_payment') {
        setSubType('receive');
      } else if (category !== 'general') {
        setSubType('');
      }
    } catch (error) {
      console.error("Error saving transaction:", error);
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
      setErrorModal('Error saving transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalName = personFormData.name;
      let finalMobile = personFormData.mobile;

      if (personFormData.type === 'Employee') {
        const emp = employees.find(e => e.id === personFormData.employeeId);
        if (emp) {
          finalName = emp.name;
          finalMobile = emp.mobile;
        }
      }

      await addDoc(collection(db, 'without_payment_persons'), {
        name: finalName,
        mobile: finalMobile,
        type: personFormData.type,
        employeeId: personFormData.employeeId || null,
        given: 0,
        taken: 0,
        balance: 0,
        createdAt: serverTimestamp(),
        createdBy: customUserId
      });

      setSuccessModal('Person added successfully.');
      setShowPersonForm(false);
      setPersonFormData({ type: 'Employee', employeeId: '', name: '', mobile: '' });
    } catch (error) {
      console.error("Error saving person:", error);
      setErrorModal('Error saving person.');
    } finally {
      setLoading(false);
    }
  };

  const isEditable = !isClosed && ( category === 'cash_closing' || isReceived );

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
                setSubType('receive');
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
                if (viewHistory) {
                  setViewHistory(false);
                  setSelectedPerson(null);
                } else {
                  setView('selection');
                  setEditingWithoutPayment(null);
                  setFormData({ ...formData, amount: '', cashAmount: '', motherAmount: '', name: '', description: '', personId: '', txType: 'Taken' });
                  setShowAddForm(false);
                  setShowPersonForm(false);
                }
              }}
              className="px-4 py-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 font-black text-xs uppercase tracking-widest"
            >
              Back
            </button>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {category === 'cash_closing' ? t('cashManagement') : 
               category === 'profit' ? t('addProfit') : 
               category === 'daily_report' ? t('dailyReport') : 
               category === 'without_payment' ? (viewHistory ? `History: ${selectedPerson?.name}` : "Without Payment") : t('generalTransactions')}
            </h2>
          </div>
          {category === 'without_payment' && !viewHistory && (
             <button
              onClick={() => setShowPersonForm(true)}
              className="px-6 py-3 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus size={20} />
              <span>Add Person</span>
            </button>
          )}
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
            {/* Summary Header */}
            {!viewHistory && (
              <div className="bg-[#8B002D] p-8 rounded-[2.5rem] shadow-xl flex items-center justify-between relative overflow-hidden w-full">
                <div className="relative z-10 space-y-1">
                  <p className="text-rose-200 text-xs font-black uppercase tracking-[0.2em]">
                    Total Without Payment Balance
                  </p>
                  <h3 className="text-4xl font-black text-white tracking-tighter">
                    {formatCurrency(
                      persons.reduce((sum, p) => sum + (p.balance || 0), 0), 
                      language
                    )}
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    if (!showAddForm) {
                      setFormData(prev => ({ ...prev, amount: '', description: '', personId: '', txType: 'Taken' }));
                    }
                    setShowAddForm(!showAddForm);
                  }}
                  className="relative z-10 w-16 h-16 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all active:scale-90 flex items-center justify-center"
                >
                  {showAddForm ? <X size={32} strokeWidth={3} /> : <Plus size={32} strokeWidth={3} />}
                </button>
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
              </div>
            )}

            {/* Add Transaction Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6 max-w-4xl mx-auto">
                  <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-xl">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight mb-4">Add New Transaction</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Person</label>
                        <select 
                          required
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm shadow-sm"
                          value={formData.personId}
                          onChange={e => setFormData({...formData, personId: e.target.value})}
                        >
                          <option value="">Select a person...</option>
                          {persons.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.mobile})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Transaction Type</label>
                        <select 
                          required
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm shadow-sm"
                          value={formData.txType}
                          onChange={e => setFormData({...formData, txType: e.target.value as any})}
                        >
                          <option value="Taken">Taken (টাকা নিয়েছে)</option>
                          <option value="Given">Given (টাকা দিয়েছে)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Amount</label>
                        <input 
                          type="text" required 
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm"
                          value={formData.amount}
                          onChange={e => {
                            const raw = parseNumberFromCommas(e.target.value);
                            if (raw === '' || !isNaN(Number(raw))) {
                              setFormData({...formData, amount: formatNumberWithCommas(raw, language)});
                            }
                          }}
                          placeholder={language === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Enter amount'}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date</label>
                        <input 
                          type="date" required 
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm"
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Note</label>
                        <input 
                          type="text" 
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-rose-500 focus:outline-none font-black text-slate-900 text-sm"
                          value={formData.description}
                          onChange={e => setFormData({...formData, description: e.target.value})}
                          placeholder="Optional note"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-2">
                      <button type="submit" disabled={loading} className="flex-1 py-4 bg-rose-600 text-white font-black rounded-xl shadow-xl shadow-rose-100 active:scale-95 transition-all flex items-center justify-center text-base">
                        {loading ? <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" /> : "Save Transaction"}
                      </button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-xl active:scale-95 transition-all">Cancel</button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add Person Modal */}
            <AnimatePresence>
              {showPersonForm && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">Add New Person</h3>
                      <button onClick={() => setShowPersonForm(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                        <X size={24} />
                      </button>
                    </div>

                    <form onSubmit={handleSavePerson} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Category</label>
                        <select 
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                          value={personFormData.type}
                          onChange={e => setPersonFormData({...personFormData, type: e.target.value as any})}
                        >
                          <option value="Employee">Employee</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>

                      {personFormData.type === 'Employee' ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Employee</label>
                          <select 
                            required
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                            value={personFormData.employeeId}
                            onChange={e => setPersonFormData({...personFormData, employeeId: e.target.value})}
                          >
                            <option value="">Select Employee...</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name} ({emp.mobile})</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Name</label>
                            <input 
                              type="text" required
                              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                              value={personFormData.name}
                              onChange={e => setPersonFormData({...personFormData, name: e.target.value})}
                              placeholder="Enter person's name"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mobile Number</label>
                            <input 
                              type="text" required
                              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                              value={personFormData.mobile}
                              onChange={e => setPersonFormData({...personFormData, mobile: e.target.value})}
                              placeholder="01xxxxxxxxx"
                            />
                          </div>
                        </>
                      )}

                      <button 
                        type="submit" disabled={loading}
                        className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 active:scale-95 transition-all text-lg"
                      >
                        {loading ? "Saving..." : "Save Person"}
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* History Table or Persons Table */}
            <div className="space-y-6">
              {!viewHistory && (
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider ml-4">
                  Person List
                </h4>
              )}
              <div className="overflow-x-auto">
                {viewHistory ? (
                  <table className="w-full text-center border-collapse border-2 border-slate-400 bg-white">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Sl</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap text-left px-4">Name</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Date</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Description</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Type</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap text-emerald-600">Given</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap text-rose-600">Taken</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Balance</th>
                        {role === 'super_admin' && (
                          <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-400">
                      {withoutPayments.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2 border-2 border-slate-400 font-bold text-slate-600 text-xs">{idx + 1}</td>
                          <td className="p-2 border-2 border-slate-400 font-black text-slate-900 text-sm whitespace-nowrap text-left px-4">{p.personName}</td>
                          <td className="p-2 border-2 border-slate-400 font-bold text-slate-600 text-xs whitespace-nowrap">{formatDate(p.date, language)}</td>
                          <td className="p-2 border-2 border-slate-400 font-medium text-slate-600 text-xs text-left min-w-[150px]">{p.description || '---'}</td>
                          <td className="p-2 border-2 border-slate-400 font-black text-slate-700 text-xs whitespace-nowrap">{p.type}</td>
                          <td className="p-2 border-2 border-slate-400 font-black text-emerald-600 text-sm whitespace-nowrap">
                            {p.type === 'Given' ? formatCurrency(p.amount, language) : formatCurrency(0, language)}
                          </td>
                          <td className="p-2 border-2 border-slate-400 font-black text-rose-600 text-sm whitespace-nowrap">
                            {p.type === 'Taken' ? formatCurrency(p.amount, language) : formatCurrency(0, language)}
                          </td>
                          <td className="p-2 border-2 border-slate-400 font-black text-slate-900 text-sm whitespace-nowrap font-mono">{formatCurrency(p.balanceAfter, language)}</td>
                          {role === 'super_admin' && (
                            <td className="p-2 border-2 border-slate-400 whitespace-nowrap">
                              <button onClick={() => setShowDeleteConfirm({...p, collection: 'without_payment_transactions'})} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-center border-collapse border-2 border-slate-400 bg-white">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap text-left px-4">Name</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Mobile</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Balance</th>
                        <th className="p-3 border-2 border-slate-400 font-black text-slate-700 text-xs uppercase tracking-widest whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-400">
                      {persons.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-3 border-2 border-slate-400 font-black text-slate-900 text-base whitespace-nowrap text-left px-4">{p.name}</td>
                          <td className="p-3 border-2 border-slate-400 font-bold text-slate-600 text-sm whitespace-nowrap">{p.mobile}</td>
                          <td className="p-3 border-2 border-slate-400 font-black text-slate-900 text-base whitespace-nowrap font-mono">{formatCurrency(p.balance || 0, language)}</td>
                          <td className="p-3 border-2 border-slate-400 whitespace-nowrap">
                            <div className="flex justify-center gap-3">
                              <button 
                                onClick={() => {
                                  setSelectedPerson(p);
                                  setViewHistory(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all border-2 border-blue-100"
                                title="View Transactions"
                              >
                                <History size={20} />
                              </button>
                              {role === 'super_admin' && (
                                <button 
                                  onClick={() => setShowDeleteConfirm({ ...p, collection: 'without_payment_persons' })}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all border-2 border-rose-100"
                                  title="Delete Person"
                                >
                                  <Trash2 size={20} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {persons.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-20 text-center text-slate-400 font-black text-lg uppercase tracking-widest border-2 border-slate-400">No persons added yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
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
                      type="text" 
                      required 
                      className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900 text-xl"
                      value={formData.cashAmount}
                      onChange={e => {
                        const raw = parseNumberFromCommas(e.target.value);
                        if (raw === '' || !isNaN(Number(raw))) {
                          setFormData({...formData, cashAmount: formatNumberWithCommas(raw, language)});
                        }
                      }}
                      placeholder={language === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Enter amount'}
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
                      type="text" 
                      required 
                      className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900 text-xl"
                      value={formData.motherAmount}
                      onChange={e => {
                        const raw = parseNumberFromCommas(e.target.value);
                        if (raw === '' || !isNaN(Number(raw))) {
                          setFormData({...formData, motherAmount: formatNumberWithCommas(raw, language)});
                        }
                      }}
                      placeholder={language === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Enter amount'}
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
                  type="text" 
                  required 
                  className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                  value={formData.amount}
                  onChange={e => {
                    const raw = parseNumberFromCommas(e.target.value);
                    if (raw === '' || !isNaN(Number(raw))) {
                      setFormData({...formData, amount: formatNumberWithCommas(raw, language)});
                    }
                  }}
                  placeholder={language === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Enter amount'}
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

          {/* Restriction Warnings */}
          {isClosed && (
            <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 font-bold">
              <AlertCircle size={24} />
              <span>Cash Closing for today is complete. No new transactions can be made.</span>
            </div>
          )}
          {!isClosed && !isReceived && category !== 'daily_report' && !(category === 'cash_closing' && subType === 'receive') && (
            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 font-bold">
              <AlertCircle size={24} />
              <span>Please complete Cash Management Receive for today before any other transactions.</span>
            </div>
          )}

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

