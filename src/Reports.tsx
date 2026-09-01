import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, onSnapshot, deleteDoc, doc, writeBatch, getDoc, increment, deleteField, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { formatCurrency, cn, toBengaliNumber, formatDate, formatNumberWithCommas, parseNumberFromCommas } from './lib/utils';
import { FileText, Calendar, Landmark, Search, Trash2, ArrowLeft, Printer, Eye, ChevronDown, Filter, TrendingUp, Check, AlertCircle, AlertTriangle, Edit, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

type ReportType = 'receive_payment' | 'cash_management' | 'cash_closing' | 'profit_report' | 'profit_loss_report' | 'expense_report' | 'advance_ledger_report' | null;

export const Reports = () => {
  const { role, customUserId, appSettings } = useAuth();
  const { t, language } = useApp();
  const location = useLocation();
  const [activeReport, setActiveReport] = useState<ReportType>(() => {
    const state = location.state as any;
    return state?.activeReport || null;
  });
  const [viewMode, setViewMode] = useState<'selection' | 'filters' | 'report'>(() => {
    const state = location.state as any;
    return state?.activeReport ? 'report' : 'selection';
  });
  
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [profitFilterType, setProfitFilterType] = useState<'all' | 'monthly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);
  const [showDenominations, setShowDenominations] = useState<any>(null);
  const [txFilter, setTxFilter] = useState<'All' | 'Receive' | 'Payment' | 'Expense'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // States for Editing Transactions
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    subType: 'receive',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [editLoading, setEditLoading] = useState(false);

  // States for Advance Ledger Report
  const [landlords, setLandlords] = useState<any[]>([]);
  const [selectedLandlordId, setSelectedLandlordId] = useState<string>('all');
  const [showDeleteTxConfirm, setShowDeleteTxConfirm] = useState<string | null>(null);

  // Fetch Landlords list
  useEffect(() => {
    const unsubscribeLandlords = onSnapshot(collection(db, 'landlords'), (snap) => {
      setLandlords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any })));
    }, (error) => {
      console.error("Error fetching landlords:", error);
    });
    return () => unsubscribeLandlords();
  }, []);

  useEffect(() => {
    if (!activeReport || viewMode !== 'report') {
      setReportData([]);
      return;
    }

    setLoading(true);
    let q;
    if (activeReport === 'cash_closing') {
      q = query(
        collection(db, 'cash_closings')
      );
    } else if (activeReport === 'profit_report') {
      q = query(
        collection(db, 'transactions'),
        where('type', '==', 'Profit')
      );
    } else if (activeReport === 'expense_report') {
      q = query(
        collection(db, 'transactions'),
        where('type', 'in', ['Expense', 'expense'])
      );
    } else if (activeReport === 'advance_ledger_report') {
      q = query(
        collection(db, 'advance_transactions')
      );
    } else {
      q = query(
        collection(db, 'transactions')
      );
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Filter by date in memory
      if (activeReport === 'profit_report') {
        if (profitFilterType === 'monthly') {
          docs = docs.filter(d => {
            if (!d.date) return false;
            const [year, month] = d.date.split('-').map(Number);
            return (month - 1) === selectedMonth && year === selectedYear;
          });
        }
        // If 'all', no filtering needed
      } else if (activeReport === 'advance_ledger_report') {
        if (selectedLandlordId && selectedLandlordId !== 'all') {
          docs = docs.filter(d => d.landlordId === selectedLandlordId);
        }
        docs = docs.filter(d => d.date >= fromDate && d.date <= toDate);
      } else {
        docs = docs.filter(d => d.date >= fromDate && d.date <= toDate);
      }
      
      // Sort by date desc in memory
      docs.sort((a, b) => b.date.localeCompare(a.date));

      if (activeReport === 'receive_payment') {
        const filtered = docs.filter((d: any) => 
          ['Receive', 'Payment', 'Expense', 'payment', 'expense', 'settlement'].includes(d.type)
        );
        const typePriority: Record<string, number> = {
          'Payment': 1,
          'payment': 1,
          'settlement': 1,
          'Receive': 2,
          'expense': 3,
          'Expense': 3
        };
        filtered.sort((a, b) => {
          const pA = typePriority[a.type] || 99;
          const pB = typePriority[b.type] || 99;
          if (pA !== pB) return pA - pB;
          return b.date.localeCompare(a.date);
        });
        setReportData(filtered);
      } else if (activeReport === 'cash_management') {
        setReportData(docs.filter((d: any) => ['Cash Receive', 'Cash Payment'].includes(d.type)));
      } else {
        setReportData(docs);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching report:", error);
      handleFirestoreError(error, OperationType.LIST, activeReport === 'advance_ledger_report' ? 'advance_transactions' : 'transactions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeReport, viewMode, fromDate, toDate, profitFilterType, selectedMonth, selectedYear, selectedLandlordId]);

  const fetchReportData = () => {
    setViewMode('report');
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm || role !== 'super_admin') return;
    
    try {
      const batch = writeBatch(db);
      
      if (activeReport === 'advance_ledger_report') {
        const tx = showDeleteConfirm;
        const agreementRef = doc(db, 'rental_agreements', tx.agreementId);
        const agreementSnap = await getDoc(agreementRef);
        
        if (agreementSnap.exists()) {
          const currentAdvance = agreementSnap.data().advanceAmount || 0;
          let reversedAdvance = currentAdvance;
          if (tx.type === 'payment') {
            reversedAdvance = currentAdvance - tx.amount;
          } else {
            reversedAdvance = currentAdvance + tx.amount;
          }
          batch.update(agreementRef, {
            advanceAmount: reversedAdvance,
            updatedAt: new Date().toISOString()
          });
        }
        batch.delete(doc(db, 'advance_transactions', tx.id));
      } else {
        const isClosingDraft = activeReport === 'cash_closing';
        
        if (isClosingDraft) {
          // Delete the cash closing record
          batch.delete(doc(db, 'cash_closings', showDeleteConfirm.id));
          
          // Also find and delete associated Cash Payment transaction
          const qTr = query(
            collection(db, 'transactions'),
            where('date', '==', showDeleteConfirm.date),
            where('category', '==', 'cash_closing_report')
          );
          const snapTr = await getDocs(qTr);
          snapTr.forEach(d => batch.delete(d.ref));
        } else {
          // Delete the transaction record
          batch.delete(doc(db, 'transactions', showDeleteConfirm.id));
          
          // If it was a cash closing payment, also delete the closing report
          if (showDeleteConfirm.category === 'cash_closing_report' || showDeleteConfirm.type === 'Cash Payment') {
            const qCl = query(
              collection(db, 'cash_closings'),
              where('date', '==', showDeleteConfirm.date)
            );
            const snapCl = await getDocs(qCl);
            snapCl.forEach(d => batch.delete(d.ref));
          }
        }
      }
      
      await batch.commit();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting:", error);
      handleFirestoreError(error, OperationType.DELETE, activeReport === 'advance_ledger_report' ? 'advance_transactions' : 'transactions');
    }
  };

  const handleStartEdit = (item: any) => {
    let subType = 'receive';
    const typeLower = (item.type || '').toLowerCase();
    if (typeLower === 'payment' || typeLower === 'cash payment' || typeLower === 'settlement') {
      subType = 'payment';
    } else if (typeLower === 'expense') {
      subType = 'expense';
    } else if (typeLower === 'receive' || typeLower === 'cash receive' || typeLower === 'profit') {
      subType = 'receive';
    }

    setEditingTransaction(item);
    setEditFormData({
      subType,
      amount: formatNumberWithCommas(item.amount || 0, language),
      date: item.date || new Date().toISOString().split('T')[0],
      description: item.description || item.note || ''
    });
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const rawAmount = parseNumberFromCommas(editFormData.amount);
    const amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(language === 'bn' ? 'অনুগ্রহ করে সঠিক পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    setEditLoading(true);
    try {
      let type = 'Receive';
      if (editFormData.subType === 'receive') type = 'Receive';
      else if (editFormData.subType === 'payment') type = 'Payment';
      else if (editFormData.subType === 'expense') type = 'Expense';

      const txRef = doc(db, 'transactions', editingTransaction.id);
      await updateDoc(txRef, {
        amount: amount,
        type: type,
        date: editFormData.date,
        description: editFormData.description || '',
        updatedAt: serverTimestamp(),
        updatedBy: customUserId || 'super_admin'
      });

      toast.success(language === 'bn' ? 'লেনদেন সফলভাবে আপডেট করা হয়েছে' : 'Transaction updated successfully');
      setEditingTransaction(null);
    } catch (error) {
      console.error("Error updating transaction:", error);
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${editingTransaction.id}`);
      toast.error(language === 'bn' ? 'আপডেট করতে সমস্যা হয়েছে' : 'Error updating transaction');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let data = reportData;
    if (activeReport === 'receive_payment') {
      if (txFilter !== 'All') {
        data = data.filter(d => {
          if (txFilter === 'Receive') return d.type === 'Receive' || d.type === 'Cash Receive';
          if (txFilter === 'Payment') return d.type === 'Payment' || d.type === 'Cash Payment' || d.type === 'payment' || d.type === 'settlement';
          if (txFilter === 'Expense') return d.type === 'Expense' || d.type === 'expense';
          return d.type === txFilter;
        });
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        data = data.filter(d => 
          (d.description?.toLowerCase().includes(q)) || 
          (d.amount?.toString().includes(q)) ||
          (d.accountNumber?.toLowerCase().includes(q)) ||
          (d.customerName?.toLowerCase().includes(q))
        );
      }
    }
    return data;
  }, [reportData, activeReport, txFilter, searchQuery]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => {
      const typeLower = (curr.type || '').toLowerCase();
      if (curr.type === 'Receive' || typeLower === 'receive' || typeLower === 'cash receive') {
        acc.receive += (Number(curr.amount) || 0);
      } else if (curr.type === 'Payment' || typeLower === 'payment' || typeLower === 'cash payment' || typeLower === 'settlement') {
        acc.payment += (Number(curr.amount) || 0);
      } else if (curr.type === 'Expense' || typeLower === 'expense') {
        acc.expense += (Number(curr.amount) || 0);
      } else if (curr.type === 'Profit' || typeLower === 'profit') {
        acc.profit += (Number(curr.amount) || 0);
      }
      return acc;
    }, { receive: 0, payment: 0, expense: 0, profit: 0 });
  }, [filteredData]);

  if (editingTransaction) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4 sm:px-6">
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setEditingTransaction(null)}
                className="px-4 py-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 font-black text-xs uppercase tracking-widest"
              >
                {t('back')}
              </button>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {t('edit')} {t('generalTransactions')}
              </h2>
            </div>
            <div className={cn(
              "p-3 rounded-2xl",
              editFormData.subType === 'receive' ? "bg-emerald-50 text-emerald-600" : 
              editFormData.subType === 'payment' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
            )}>
              <Landmark size={28} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
          <form onSubmit={handleUpdateTransaction} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sub-type Selection */}
              <div className="space-y-2">
                <label className="text-lg font-black text-black uppercase ml-1">{t('transactionTypeLabel')}</label>
                <select 
                  className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                  value={editFormData.subType}
                  onChange={(e) => setEditFormData({ ...editFormData, subType: e.target.value })}
                >
                  <option value="receive">{t('receive')}</option>
                  <option value="payment">{t('payment')}</option>
                  <option value="expense">{t('expense')}</option>
                </select>
              </div>

              {/* Date Field */}
              <div className="space-y-1">
                <label className="text-lg font-black text-black uppercase ml-1">{t('date')}</label>
                <input 
                  type="date" 
                  required 
                  className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900"
                  value={editFormData.date}
                  onChange={e => setEditFormData({...editFormData, date: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Amount Field */}
              <div className="space-y-1">
                <label className="text-lg font-black text-black uppercase ml-1">{t('amount')}</label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-black text-slate-900 text-lg"
                  value={editFormData.amount}
                  onChange={e => {
                    const raw = parseNumberFromCommas(e.target.value);
                    if (raw === '' || !isNaN(Number(raw))) {
                      setEditFormData({...editFormData, amount: formatNumberWithCommas(raw, language)});
                    }
                  }}
                  placeholder={language === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Enter amount'}
                />
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-1">
              <label className="text-lg font-black text-black uppercase ml-1">{t('note')}</label>
              <textarea 
                className="w-full px-5 py-4 bg-white border-2 border-slate-500 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold text-slate-900 min-h-[100px]"
                value={editFormData.description}
                onChange={e => setEditFormData({...editFormData, description: e.target.value})}
                placeholder={t('enterDescription')}
              />
            </div>

            <div className="flex gap-4 pt-2">
              <button 
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="flex-1 py-5 rounded-2xl font-black text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 text-lg"
              >
                {t('cancel')}
              </button>
              <button 
                type="submit" 
                disabled={editLoading || !editFormData.subType}
                className={cn(
                  "flex-1 py-5 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg",
                  editFormData.subType === 'receive' ? "bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700" : 
                  editFormData.subType === 'payment' ? "bg-rose-600 shadow-rose-200 hover:bg-rose-700" : 
                  editFormData.subType === 'expense' ? "bg-amber-600 shadow-amber-200 hover:bg-amber-700" : "bg-slate-400"
                )}
              >
                {editLoading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {editFormData.subType === 'receive' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                    {editFormData.subType === 'receive' ? t('receive') : editFormData.subType === 'payment' ? t('payment') : t('expense')} {t('update')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 px-4">
      {/* Header Section */}
      <div className="flex items-center justify-between no-print">
        {viewMode !== 'selection' ? (
          <button 
            onClick={() => setViewMode(viewMode === 'report' ? 'filters' : 'selection')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-all"
          >
            <ArrowLeft size={20} />
            {t('back')}
          </button>
        ) : (
          <div className="w-10" /> // Spacer
        )}
        
        {viewMode === 'report' && (
          <button 
            onClick={() => { window.focus(); window.print(); }}
            className="relative z-50 flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-[1rem] font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100"
          >
            <Printer size={20} />
            {t('print')}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'selection' && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('reports')}</h2>
              <p className="text-slate-500 font-bold">{t('View Outlet Reports')}</p>
            </div>

            <div className="bg-white overflow-hidden border border-slate-300 rounded-lg shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#E1EBF7] text-center">
                      <th className="p-3 border border-slate-300 font-black text-slate-800 text-sm w-16">{t('sl')}</th>
                      <th className="p-3 border border-slate-300 font-black text-slate-800 text-sm text-centre">{t('Title')}</th>
                      <th className="p-3 border border-slate-300 font-black text-slate-800 text-sm w-32">{t('report')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {/* Receive/Payment Report */}
                    <tr className="hover:bg-slate-50 transition-colors text-center">
                      <td className="p-3 border border-slate-300 text-sm font-bold text-slate-600">{toBengaliNumber('1', language)}</td>
                      <td className="p-3 border border-slate-300 text-left px-4">
                        <h3 className="text-base font-bold text-slate-800">{t('receivePaymentReport')}</h3>
                      </td>
                      <td className="p-3 border border-slate-300">
                        <button 
                          onClick={() => { setActiveReport('receive_payment'); setViewMode('filters'); }}
                          className="px-4 py-1.5 bg-[#1D61F2] text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
                        >
                          {t('report')} <span className="text-[10px]"> {'>'} </span>
                        </button>
                      </td>
                    </tr>

                    {/* Cash Management Report */}
                    <tr className="hover:bg-slate-50 transition-colors text-center">
                      <td className="p-3 border border-slate-300 text-sm font-bold text-slate-600">{toBengaliNumber('2', language)}</td>
                      <td className="p-3 border border-slate-300 text-left px-4">
                        <h3 className="text-base font-bold text-slate-800">{t('cashManagementReport')}</h3>
                      </td>
                      <td className="p-3 border border-slate-300">
                        <button 
                          onClick={() => { setActiveReport('cash_management'); setViewMode('filters'); }}
                          className="px-4 py-1.5 bg-[#1D61F2] text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
                        >
                          {t('report')} <span className="text-[10px]"> {'>'} </span>
                        </button>
                      </td>
                    </tr>

                    {/* Cash Closing Report */}
                    <tr className="hover:bg-slate-50 transition-colors text-center">
                      <td className="p-3 border border-slate-300 text-sm font-bold text-slate-600">{toBengaliNumber('3', language)}</td>
                      <td className="p-3 border border-slate-300 text-left px-4">
                        <h3 className="text-base font-bold text-slate-800">{t('cashClosingReport')}</h3>
                      </td>
                      <td className="p-3 border border-slate-300">
                        <button 
                          onClick={() => { setActiveReport('cash_closing'); setViewMode('filters'); }}
                          className="px-4 py-1.5 bg-[#1D61F2] text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
                        >
                          {t('report')} <span className="text-[10px]"> {'>'} </span>
                        </button>
                      </td>
                    </tr>

                    {/* Profit Report */}
                    <tr className="hover:bg-slate-50 transition-colors text-center">
                      <td className="p-3 border border-slate-300 text-sm font-bold text-slate-600">{toBengaliNumber('4', language)}</td>
                      <td className="p-3 border border-slate-300 text-left px-4">
                        <h3 className="text-base font-bold text-slate-800">{t('profitReport')}</h3>
                      </td>
                      <td className="p-3 border border-slate-300">
                        <button 
                          onClick={() => { setActiveReport('profit_report'); setViewMode('filters'); }}
                          className="px-4 py-1.5 bg-[#1D61F2] text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
                        >
                          {t('report')} <span className="text-[10px]"> {'>'} </span>
                        </button>
                      </td>
                    </tr>

                    {/* Profit/Loss Report */}
                    <tr className="hover:bg-slate-50 transition-colors text-center">
                      <td className="p-3 border border-slate-300 text-sm font-bold text-slate-600">{toBengaliNumber('5', language)}</td>
                      <td className="p-3 border border-slate-300 text-left px-4">
                        <h3 className="text-base font-bold text-slate-800">{t('profitLossReport')}</h3>
                      </td>
                      <td className="p-3 border border-slate-300">
                        <button 
                          onClick={() => { setActiveReport('profit_loss_report'); setViewMode('filters'); }}
                          className="px-4 py-1.5 bg-[#1D61F2] text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
                        >
                          {t('report')} <span className="text-[10px]"> {'>'} </span>
                        </button>
                      </td>
                    </tr>

                    {/* Expense Report */}
                    <tr className="hover:bg-slate-50 transition-colors text-center">
                      <td className="p-3 border border-slate-300 text-sm font-bold text-slate-600">{toBengaliNumber('6', language)}</td>
                      <td className="p-3 border border-slate-300 text-left px-4">
                        <h3 className="text-base font-bold text-slate-800">{t('expense')}</h3>
                      </td>
                      <td className="p-3 border border-slate-300">
                        <button 
                          onClick={() => { setActiveReport('expense_report'); setViewMode('filters'); }}
                          className="px-4 py-1.5 bg-[#1D61F2] text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
                        >
                          {t('report')} <span className="text-[10px]"> {'>'} </span>
                        </button>
                      </td>
                    </tr>

                    {/* Advance Ledger Report */}
                    <tr className="hover:bg-slate-50 transition-colors text-center">
                      <td className="p-3 border border-slate-300 text-sm font-bold text-slate-600">{toBengaliNumber('7', language)}</td>
                      <td className="p-3 border border-slate-300 text-left px-4">
                        <h3 className="text-base font-bold text-slate-800">Advance Ledger Report</h3>
                      </td>
                      <td className="p-3 border border-slate-300">
                        <button 
                          onClick={() => { setActiveReport('advance_ledger_report'); setViewMode('filters'); }}
                          className="px-4 py-1.5 bg-[#1D61F2] text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
                        >
                          {t('report')} <span className="text-[10px]"> {'>'} </span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'filters' && activeReport && (
          <motion.div
            key="filters"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl mx-auto bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-8"
          >
            <div className="flex items-center gap-4 border-b pb-6">
              <div className="p-3 bg-slate-100 rounded-2xl text-slate-600">
                <Calendar size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  {activeReport === 'receive_payment' ? t('receivePaymentReport') : 
                   activeReport === 'cash_management' ? t('cashManagementReport') : 
                   activeReport === 'cash_closing' ? t('cashClosingReport') :
                   activeReport === 'profit_report' ? t('profitReport') :
                   activeReport === 'expense_report' ? t('expense') :
                   activeReport === 'advance_ledger_report' ? 'Advance Ledger Report' :
                   t('profitLossReport')}
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('filterReport')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeReport === 'profit_report' ? (
                <>
                    <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('filterType')}</label>
                    <select 
                      value={profitFilterType}
                      onChange={(e) => setProfitFilterType(e.target.value as 'all' | 'monthly')}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all mb-4"
                    >
                      <option className="py-2" value="monthly">{t('filterMonths')}</option>
                      <option className="py-2" value="all">{t('allTimeProfit')}</option>
                    </select>
                  </div>
                  {profitFilterType === 'monthly' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('selectMonth')}</label>
                        <select 
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                        >
                          {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i} value={i}>
                              {new Date(0, i).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'long' })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('enterYear')}</label>
                        <input 
                          type="number"
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                          placeholder={t('yearPlaceholder')}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : activeReport === 'advance_ledger_report' ? (
                <>
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Landlord Name</label>
                    <select 
                      value={selectedLandlordId}
                      onChange={(e) => setSelectedLandlordId(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                    >
                      <option value="all">All Landlords</option>
                      {landlords.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('fromDate')}</label>
                    <input 
                      type="date" 
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('toDate')}</label>
                    <input 
                      type="date" 
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('fromDate')}</label>
                    <input 
                      type="date" 
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('toDate')}</label>
                    <input 
                      type="date" 
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={fetchReportData}
              disabled={loading}
              className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search size={24} />
                  {t('view')}
                </>
              )}
            </button>
          </motion.div>
        )}

        {viewMode === 'report' && activeReport && (
          <motion.div
            key="report"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8 print:p-0"
          >
            {/* Report Header */}
          <div className="text-center space-y-1 pb-4 border-b border-slate-100">
            <h1 className="text-xl sm:text-2xl font-black leading-tight tracking-tight animate-color-run whitespace-pre-wrap">
              {appSettings?.companyName || 'Al-Arafah Islami Bank PLC'}
            </h1>
            <h2 className="text-lg font-black animate-color-run">
              {appSettings?.appName || 'SPS Bazar Outlet'}
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest animate-color-run whitespace-pre-wrap">
              {appSettings?.companyAddress || 'Kayaria Lanch Ghat, Kayaria, \n Kalkini, Madaripur.'}
            </p>
            <h3 className="text-lg font-black text-slate-800 pt-2 uppercase tracking-widest">
              {activeReport === 'receive_payment' ? t('receivePaymentReport') : 
               activeReport === 'cash_management' ? t('cashManagementReport') : 
               activeReport === 'cash_closing' ? t('cashClosingReport') :
               activeReport === 'profit_report' ? t('profitReport') :
               activeReport === 'expense_report' ? t('expense') :
               activeReport === 'advance_ledger_report' ? 'Advance Ledger Report' :
               t('profitLossReport')}
            </h3>
            <p className="text-slate-500 font-bold">
              {activeReport === 'profit_report' ? (
                profitFilterType === 'all' ? t('allTimeProfit') : 
                `${new Date(0, selectedMonth).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'long' })}, ${toBengaliNumber(selectedYear.toString(), language)}`
              ) : (
                <>{toBengaliNumber(formatDate(fromDate, language), language)} {t('toLabel')} {toBengaliNumber(formatDate(toDate, language), language)}</>
              )}
            </p>
    </div>

    {/* Search and Filters for Receive/Payment Report */}
    {activeReport === 'receive_payment' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print w-full pt-4">
        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-0 bg-emerald-500/5 rounded-3xl animate-pulse group-focus-within:animate-none pointer-events-none" />
          <div className="relative flex items-center bg-slate-50 shadow-inner border-2 border-slate-400 rounded-[2rem] transition-all hover:border-emerald-500 focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-500/10">
            <div className="pl-6 text-slate-500">
              <Search size={22} className="animate-pulse" />
            </div>
            <input 
              type="text"
              placeholder={t('Search Description Amount')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-5 bg-transparent focus:outline-none font-black text-slate-900 text-base placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Dropdown Filter */}
        <div className="relative group">
          <div className="relative flex items-center bg-slate-50 shadow-inner border-2 border-slate-400 rounded-[2rem] transition-all hover:border-emerald-500 focus-within:border-emerald-600">
            <div className="pl-6 text-slate-500">
              <Filter size={20} />
            </div>
            <select 
              value={txFilter}
              onChange={(e) => setTxFilter(e.target.value as any)}
              className="w-full pl-4 pr-12 py-5 bg-transparent focus:outline-none font-black text-slate-900 text-base appearance-none cursor-pointer"
            >
              <option value="All">{t('All Transactions')}</option>
              <option value="Receive">{t('Receive Only')}</option>
              <option value="Payment">{t('Payment Only')}</option>
              <option value="Expense">{t('Expense Only')}</option>
            </select>
            <div className="absolute right-6 pointer-events-none text-slate-500">
              <ChevronDown size={20} />
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Report Table */}
            {activeReport === 'profit_loss_report' ? (
              <div className="overflow-x-auto pb-4">
                <div className="space-y-4 print:space-y-2 min-w-max">
                  <div className="grid grid-cols-[50px_minmax(150px,_auto)_120px_minmax(150px,_auto)_120px] border-t border-l border-black bg-white">
                    {/* Main Headers */}
                    <div className="col-span-3 bg-[#E1EBF7] p-2 border-r border-b border-black text-center font-black text-slate-800 text-lg">
                      {t('income')}
                    </div>
                    <div className="col-span-2 bg-[#E1EBF7] p-2 border-r border-b border-black text-center font-black text-slate-800 text-lg">
                      {t('expense')}
                    </div>

                    {/* Column Headers */}
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">{t('sl')}</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">{t('accountNameLabel')}</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">{t('amount')}</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">{t('accountNameLabel')}</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">{t('amount')}</div>

                    {/* Data Rows */}
                    {(() => {
                      const incomeRows = [{ id: 'profit', name: t('profitFromInstallment'), amount: reportData.filter(d => d.type === 'Profit').reduce((sum, d) => sum + (d.amount || 0), 0) }];
                      const expenseRows = [{ id: 'expense', name: t('expense'), amount: reportData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + (d.amount || 0), 0) }];
                      const maxRows = Math.max(incomeRows.length, expenseRows.length);

                      return Array.from({ length: maxRows }).map((_, idx) => (
                        <React.Fragment key={idx}>
                          {/* Income Side Cells */}
                          <div className="p-1 border-r border-b border-black text-center text-xs font-bold min-h-[35px] flex items-center justify-center">
                            {idx < incomeRows.length ? toBengaliNumber((idx + 1).toString(), language) : ''}
                          </div>
                          <div className="p-1 border-r border-b border-black text-center text-xs font-bold px-3 whitespace-nowrap flex items-center justify-center">
                            {idx < incomeRows.length ? incomeRows[idx].name : ''}
                          </div>
                          <div className="p-1 border-r border-b border-black text-center text-xs font-bold px-3 flex items-center justify-center">
                            {idx < incomeRows.length ? formatCurrency(incomeRows[idx].amount, language) : ''}
                          </div>

                          {/* Expense Side Cells */}
                          <div className="p-1 border-r border-b border-black text-center text-xs font-bold px-3 whitespace-nowrap flex items-center justify-center">
                            {idx < expenseRows.length ? expenseRows[idx].name : ''}
                          </div>
                          <div className="p-1 border-r border-b border-black text-center text-xs font-bold px-3 flex items-center justify-center">
                            {idx < expenseRows.length ? formatCurrency(expenseRows[idx].amount || 0, language) : ''}
                          </div>
                        </React.Fragment>
                      ));
                    })()}

                    {/* Totals Row */}
                    <div className="col-span-2 p-2 border-r border-b border-black text-center font-black text-sm flex items-center justify-center">
                      {t('totalIncome')} :
                    </div>
                    <div className="p-2 border-r border-b border-black text-center font-black text-sm px-3 flex items-center justify-center">
                      {formatCurrency(reportData.filter(d => d.type === 'Profit').reduce((sum, d) => sum + (d.amount || 0), 0), language)}
                    </div>
                    <div className="p-2 border-r border-b border-black text-center font-black text-sm flex items-center justify-center">
                      {t('totalExpense')} :
                    </div>
                    <div className="p-2 border-r border-b border-black text-center font-black text-sm px-3 flex items-center justify-center">
                      {formatCurrency(reportData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + (d.amount || 0), 0), language)}
                    </div>
                  </div>

                  {/* Net Result Footer */}
                  <div className="grid grid-cols-[1.5fr_1fr] border-2 border-black bg-white">
                    <div className="p-3 border-r border-black text-center font-black text-lg uppercase tracking-wider flex items-center justify-center">
                      {t('periodProfitLoss')} :
                    </div>
                    <div className={cn(
                      "p-3 text-center font-black text-2xl flex items-center justify-center",
                      (reportData.filter(d => d.type === 'Profit').reduce((sum, d) => sum + (d.amount || 0), 0) - 
                       reportData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + (d.amount || 0), 0)) >= 0 
                      ? "text-emerald-700" : "text-rose-700"
                    )}>
                      {formatCurrency(
                        reportData.filter(d => d.type === 'Profit').reduce((sum, d) => sum + (d.amount || 0), 0) - 
                        reportData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + (d.amount || 0), 0),
                        language
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse border border-slate-400">
                <thead>
                  {activeReport === 'cash_closing' ? (
                    <tr className="bg-slate-100 text-center">
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-10 text-center">{t('sl')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-24 text-center">{t('date')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('previousDaysCashMother')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('totalReceive')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('profit')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('totalPayment')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('totalExpense')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center w-24">{t('closingBalanceCashMother')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center no-print w-16">{t('action')}</th>
                    </tr>
                  ) : activeReport === 'expense_report' ? (
                    <tr className="bg-slate-100 text-center">
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-12 text-center">{t('sl')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-32 text-center">{t('date')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-center text-xs">{t('description')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-40 text-center">{t('amount')}</th>
                      {role === 'super_admin' && (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-20 no-print text-center">{t('action')}</th>
                      )}
                    </tr>
                  ) : activeReport === 'advance_ledger_report' ? (
                    <tr className="bg-slate-100 text-center">
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-12 text-center">{t('sl')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-32 text-center">Adjustment Date</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-center text-xs">Landlord Name</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">Adjustment Type</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-40 text-center">Amount (৳)</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">Recorded By</th>
                      {role === 'super_admin' && (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs w-20 no-print text-center">Action</th>
                      )}
                    </tr>
                  ) : (
                    <tr className="bg-slate-100 text-center">
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('sl')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('date')}</th>
                      {(activeReport === 'receive_payment' || activeReport === 'profit_report') && (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('description')}</th>
                      )}
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('transactionType')}</th>
                      {activeReport === 'cash_management' ? (
                        <>
                          <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('cash')}</th>
                          <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('todayDaysMother')}</th>
                        </>
                      ) : (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center">{t('amount')}</th>
                      )}
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('userId')}</th>
                      { role === 'super_admin' && (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs no-print">{t('action')}</th>
                      )}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {(() => {
                    if (filteredData.length === 0) {
                      return (
                        <tr>
                          <td colSpan={activeReport === 'cash_closing' ? 9 : (activeReport === 'expense_report' ? (role === 'super_admin' ? 5 : 4) : (activeReport === 'advance_ledger_report' ? (role === 'super_admin' ? 7 : 6) : (activeReport === 'receive_payment' || activeReport === 'profit_report' ? 7 : 6)))} className="p-32 border border-slate-400 text-center">
                            <p className="text-slate-400 font-black text-lg">
                              {t('noDataFound')}
                            </p>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <>
                        {filteredData.map((item, idx) => (
                          activeReport === 'cash_closing' ? (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-center">
                              <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600">{toBengaliNumber((idx + 1).toString(), language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600 whitespace-nowrap">{toBengaliNumber(formatDate(item.date, language), language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-center">{formatCurrency(item.previousDaysCashMother || item.previousDaysCash || 0, language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-black text-emerald-600 text-center">{formatCurrency(item.todayTotalReceive || 0, language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-black text-blue-600 text-center">{formatCurrency(item.todayTotalProfit || 0, language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-black text-rose-600 text-center">{formatCurrency(item.todayTotalPayment || 0, language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-black text-amber-600 text-center">{formatCurrency(item.todayTotalExpense || 0, language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-center">{formatCurrency(item.todayLastBalance || item.closingBalance || 0, language)}</td>
                              <td className="p-2 border border-slate-400 text-center no-print">
                                <div className="flex items-center justify-center gap-1">
                                  <button 
                                    onClick={() => setShowDenominations(item)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    title={t('viewDenominations')}
                                  >
                                    <Eye size={16} />
                                  </button>
                                  {role === 'super_admin' && (
                                    <button 
                                      onClick={() => setShowDeleteConfirm(item)}
                                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : activeReport === 'expense_report' ? (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-center font-bold text-slate-700 text-xs">
                              <td className="p-2 border border-slate-400">{toBengaliNumber((idx + 1).toString(), language)}</td>
                              <td className="p-2 border border-slate-400">{toBengaliNumber(formatDate(item.date, language), language)}</td>
                              <td className="p-2 border border-slate-400 text-left px-4">{item.description || item.note || '---'}</td>
                              <td className="p-2 border border-slate-400">{formatCurrency(item.amount, language)}</td>
                              {role === 'super_admin' && (
                                <td className="p-2 border border-slate-400 text-center no-print">
                                  <button 
                                    onClick={() => setShowDeleteConfirm(item)}
                                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ) : activeReport === 'advance_ledger_report' ? (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-center font-bold text-slate-700 text-xs">
                              <td className="p-2 border border-slate-400">{toBengaliNumber((idx + 1).toString(), language)}</td>
                              <td className="p-2 border border-slate-400 whitespace-nowrap">{toBengaliNumber(formatDate(item.date, language), language)}</td>
                              <td className="p-2 border border-slate-400 text-left px-4">{item.landlordName}</td>
                              <td className="p-2 border border-slate-400">
                                {item.type === 'payment' ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black border border-emerald-200">
                                    <Check size={12} />
                                    <span>Advance Payment</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-black border border-amber-200">
                                    <AlertCircle size={12} />
                                    <span>Refund Advance</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-2 border border-slate-400 font-mono font-black text-right pr-4 text-slate-800">
                                ৳{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 border border-slate-400 text-slate-500">{item.customUserId || 'N/A'}</td>
                              {role === 'super_admin' && (
                                <td className="p-2 border border-slate-400 text-center no-print">
                                  <button 
                                    onClick={() => setShowDeleteConfirm(item)}
                                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Delete & Reverse Balance"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ) : (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-center">
                              <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600">{toBengaliNumber((idx + 1).toString(), language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600 whitespace-nowrap">{toBengaliNumber(formatDate(item.date, language), language)}</td>
                              {(activeReport === 'receive_payment' || activeReport === 'profit_report') && (
                                <td className="p-2 border border-slate-400 text-xs font-bold text-slate-800 text-center">{item.description || '---'}</td>
                              )}
                              <td className="p-2 border border-slate-400 text-xs font-bold text-slate-700 whitespace-nowrap">
                                {language === 'bn' ? (
                                  item.type === 'Receive' ? 'রিসিভ' : 
                                  item.type === 'Payment' ? 'পেমেন্ট' : 
                                  item.type === 'Profit' ? 'প্রফিট' :
                                  (item.type === 'expense' || item.type === 'Expense') ? 'খরচ' : item.type
                                ) : item.type}
                              </td>
                              {activeReport === 'cash_management' ? (
                                <>
                                  <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-center whitespace-nowrap">{formatCurrency(item.cashAmount ?? item.amount, language)}</td>
                                  <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-center whitespace-nowrap">{formatCurrency(item.motherAmount ?? 0, language)}</td>
                                </>
                              ) : (
                                <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-center whitespace-nowrap">{formatCurrency(item.amount, language)}</td>
                              )}
                              <td className="p-2 border border-slate-400 text-xs font-bold text-slate-500">{item.customUserId || 'N/A'}</td>
                              { role === 'super_admin' && (
                                <td className="p-2 border border-slate-400 text-center no-print">
                                  <div className="flex items-center justify-center gap-1">
                                    {activeReport === 'receive_payment' && (
                                      <button 
                                        onClick={() => handleStartEdit(item)}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all"
                                        title={t('edit')}
                                      >
                                        <Edit size={14} />
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => setShowDeleteConfirm(item)}
                                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                      title={t('delete')}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        ))}
                        {activeReport === 'expense_report' && filteredData.length > 0 && (
                          <tr className="bg-slate-100 font-black text-slate-800 text-sm">
                            <td colSpan={3} className="p-3 border border-slate-400 text-right pr-4 uppercase tracking-widest">{t('totalExpense')}</td>
                            <td className="p-3 border border-slate-400 text-center">{formatCurrency(filteredData.reduce((sum, d) => sum + (d.amount || 0), 0), language)}</td>
                            {role === 'super_admin' && (
                              <td className="p-3 border border-slate-400 no-print"></td>
                            )}
                          </tr>
                        )}
                        {activeReport === 'advance_ledger_report' && filteredData.length > 0 && (
                          <tr className="bg-slate-100 font-black text-slate-800 text-sm">
                            <td colSpan={4} className="p-3 border border-slate-400 text-right pr-4 uppercase tracking-widest">Total Amount</td>
                            <td className="p-3 border border-slate-400 text-right pr-4 font-mono">
                              ৳{filteredData.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 border border-slate-400"></td>
                            {role === 'super_admin' && (
                              <td className="p-3 border border-slate-400 no-print"></td>
                            )}
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary Table */}
            {filteredData.length > 0 && 
             activeReport !== 'profit_loss_report' && 
             activeReport !== 'cash_closing' && 
             activeReport !== 'expense_report' && 
             activeReport !== 'cash_management' && 
             activeReport !== 'advance_ledger_report' && (
              <div className="max-w-sm ml-auto space-y-2 no-print-break">
                <h3 className="text-sm font-black text-slate-800 pb-1 uppercase tracking-widest border-b border-slate-100 flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600" />
                  {t('summary')}
                </h3>
                <table className="w-full border-collapse border border-slate-400">
                  <tbody>
                    {activeReport === 'receive_payment' ? (
                      <>
                        <tr className="text-xs">
                          <td className="p-2 border border-slate-400 font-bold text-slate-600 text-center">{t('totalReceive')}</td>
                          <td className="p-2 border border-slate-400 font-black text-emerald-600 text-center">{formatCurrency(totals.receive, language)}</td>
                        </tr>
                        <tr className="text-xs">
                          <td className="p-2 border border-slate-400 font-bold text-slate-600 text-center">{t('totalPayment')}</td>
                          <td className="p-2 border border-slate-400 font-black text-rose-600 text-center">{formatCurrency(totals.payment, language)}</td>
                        </tr>
                        <tr className="text-xs">
                          <td className="p-2 border border-slate-400 font-bold text-slate-600 text-center">{t('totalExpense')}</td>
                          <td className="p-2 border border-slate-400 font-black text-amber-600 text-center">{formatCurrency(totals.expense, language)}</td>
                        </tr>
                        <tr className="text-xs bg-slate-100 font-black">
                          <td className="p-2 border border-slate-400 font-black text-slate-800 text-center whitespace-nowrap">Total Payment+Total Expense</td>
                          <td className="p-2 border border-slate-400 font-black text-slate-900 text-center whitespace-nowrap">
                            {formatCurrency(totals.payment + totals.expense, language)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <>
                        {totals.receive > 0 && (
                          <tr className="text-xs">
                            <td className="p-2 border border-slate-400 font-bold text-slate-600 text-center">{t('totalReceive')}</td>
                            <td className="p-2 border border-slate-400 font-black text-emerald-600 text-center">{formatCurrency(totals.receive, language)}</td>
                          </tr>
                        )}
                        {totals.payment > 0 && (
                          <tr className="text-xs">
                            <td className="p-2 border border-slate-400 font-bold text-slate-600 text-center">{t('totalPayment')}</td>
                            <td className="p-2 border border-slate-400 font-black text-rose-600 text-center">{formatCurrency(totals.payment, language)}</td>
                          </tr>
                        )}
                        {totals.expense > 0 && (
                          <tr className="text-xs">
                            <td className="p-2 border border-slate-400 font-bold text-slate-600 text-center">{t('totalExpense')}</td>
                            <td className="p-2 border border-slate-400 font-black text-amber-600 text-center">{formatCurrency(totals.expense, language)}</td>
                          </tr>
                        )}
                        {totals.profit > 0 && (
                          <tr className="text-xs">
                            <td className="p-2 border border-slate-400 font-bold text-slate-600 text-center">{t('totalProfit')}</td>
                            <td className="p-2 border border-slate-400 font-black text-blue-600 text-center">{formatCurrency(totals.profit, language)}</td>
                          </tr>
                        )}
                        <tr className="text-xs bg-slate-100 font-black">
                          <td className="p-2 border border-slate-400 font-black text-slate-800 text-center">Total</td>
                          <td className="p-2 border border-slate-400 font-black text-slate-900 text-center">
                            {formatCurrency(Math.abs(totals.receive + totals.profit - totals.payment - totals.expense), language)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4 text-rose-600">
                <div className="p-3 bg-rose-50 rounded-2xl">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-black">{t('areYouSure')}</h3>
              </div>
              <p className="text-slate-600 font-bold leading-relaxed">
                {t('deleteConfirmMessage')}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  {t('yesDelete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Denominations Modal */}
      <AnimatePresence>
        {showDenominations && (
          <div className="fixed inset-0 md:left-64 lg:left-72 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-black text-slate-800">
                  {t('cashDenominations')}
                </h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                  {toBengaliNumber(formatDate(showDenominations.date, language), language)}
                </span>
              </div>

              <div className="overflow-hidden border border-black">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#d1d5db]">
                      <th className="p-2 border border-black font-bold text-center text-black text-base">Note</th>
                      <th className="p-2 border border-black font-bold text-center text-black text-base">Number</th>
                      <th className="p-2 border border-black font-bold text-center text-black text-base">Taka</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOTES.map(note => {
                      const count = parseInt(showDenominations.denominations?.[note] || '0');
                      return (
                        <tr key={note} className="bg-white">
                          <td className="p-2 border border-black text-center font-bold text-black text-base">{toBengaliNumber(note, language)}</td>
                          <td className="p-2 border border-black text-center font-bold text-black text-base">{toBengaliNumber(count, language)}</td>
                          <td className="p-2 border border-black text-center font-bold text-black text-base">{toBengaliNumber(note * count, language)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#d1d5db]">
                      <td colSpan={2} className="p-2 border border-black font-bold text-center text-black text-lg">{t('totalCash')}</td>
                      <td className="p-2 border border-black font-bold text-center text-black text-lg">
                        {formatCurrency(showDenominations.closingBalance || 0, language)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <button 
                onClick={() => setShowDenominations(null)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
              >
                {t('close')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
