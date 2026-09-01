import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { formatCurrency, toBengaliNumber, cn, formatDate, formatNumberWithCommas, parseNumberFromCommas } from './lib/utils';
import { Calendar, ArrowLeft, Search, TrendingUp, TrendingDown, Wallet, Landmark, UserCircle, Receipt, Printer, Edit, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from './App';
import { useAuth } from './AuthContext';

export const TransactionReport = () => {
  const { t, language } = useApp();
  const { role, customUserId, appSettings } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [data, setData] = useState({
    transactions: [] as any[],
    directorTransactions: [] as any[],
    bankTransactions: [] as any[],
    directors: [] as any[],
    banks: [] as any[],
    customers: [] as any[],
  });

  // State for Editing Transaction
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    subType: 'receive',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const onBack = (e: Event) => {
      e.preventDefault();
      navigate('/reports');
    };
    window.addEventListener('app:back', onBack);
    return () => window.removeEventListener('app:back', onBack);
  }, [navigate]);

  useEffect(() => {
    const unsubD = onSnapshot(collection(db, 'directors'), (snap) => {
      setData(prev => ({ ...prev, directors: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'directors');
    });
    
    const unsubB = onSnapshot(collection(db, 'banks'), (snap) => {
      setData(prev => ({ ...prev, banks: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'banks');
    });
    
    const unsubC = onSnapshot(collection(db, 'customers'), (snap) => {
      setData(prev => ({ ...prev, customers: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    // We'll fetch all transactions for the selected date
    const unsubT = onSnapshot(query(collection(db, 'transactions'), where('date', '==', selectedDate)), (snap) => {
      setData(prev => ({ ...prev, transactions: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const unsubDT = onSnapshot(query(collection(db, 'director_transactions'), where('date', '==', selectedDate)), (snap) => {
      setData(prev => ({ ...prev, directorTransactions: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'director_transactions');
    });

    const unsubBT = onSnapshot(query(collection(db, 'bank_transactions'), where('date', '==', selectedDate)), (snap) => {
      setData(prev => ({ ...prev, bankTransactions: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bank_transactions');
    });

    return () => { unsubD(); unsubB(); unsubC(); unsubT(); unsubDT(); unsubBT(); };
  }, [selectedDate]);

  const getTransactionTypeName = (type: string, subType?: string) => {
    switch (type) {
      case 'payment': return t('investmentInstallment');
      case 'settlement': return t('investmentSettlement');
      case 'expense': return t('officeExpense');
      case 'deposit': return subType === 'bank' ? t('bank_deposit') : t('outletCapitalDeposit');
      case 'withdrawal': return subType === 'bank' ? t('bank_withdrawal') : t('outletCapitalWithdrawal');
      case 'profit_distribution': return t('profitDistribution');
      case 'profit_withdraw': return t('profitWithdraw');
      default: return type;
    }
  };

  const getDirectorName = (item: any) => {
    if (item.relatedName) return item.relatedName;
    if (item.customerName) return item.customerName;
    if (item.processedBy) return item.processedBy;
    return '---';
  };

  // Combine all transactions into a single list
  const combinedTransactions = [
    ...data.transactions.map(t => ({ ...t, source: 'transactions' })),
    ...data.directorTransactions.map(t => ({ ...t, source: 'director_transactions' })),
    ...data.bankTransactions.map(t => ({ ...t, source: 'bank_transactions', subType: 'bank' }))
  ].sort((a, b) => {
    // Sort by createdAt if available, otherwise keep order
    const dateA = a.createdAt?.seconds || 0;
    const dateB = b.createdAt?.seconds || 0;
    return dateB - dateA;
  });

  const handleStartEdit = (item: any) => {
    let subType = 'receive';
    const typeLower = (item.type || '').toLowerCase();
    if (typeLower === 'payment' || typeLower === 'cash payment' || typeLower === 'settlement' || typeLower === 'deposit') {
      subType = 'payment';
    } else if (typeLower === 'expense' || typeLower === 'withdrawal') {
      subType = 'expense';
    } else if (typeLower === 'receive' || typeLower === 'cash receive' || typeLower === 'profit') {
      subType = 'receive';
    }

    setEditingTransaction(item);
    setEditFormData({
      subType,
      amount: formatNumberWithCommas(item.amount || 0, language),
      date: item.date || selectedDate,
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

      const collectionName = editingTransaction.source || 'transactions';
      const txRef = doc(db, collectionName, editingTransaction.id);
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

  // Calculate totals for summary
  const summaryTotals = combinedTransactions.reduce((acc: any, curr) => {
    const typeName = getTransactionTypeName(curr.type, curr.subType);
    const amount = parseFloat(curr.amount) || 0;
    acc[typeName] = (acc[typeName] || 0) + amount;
    return acc;
  }, {});

  if (editingTransaction) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4 sm:px-6 pt-6">
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
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-800">{t('transactionReport')}</h1>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 no-print">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 p-0"
            />
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100 no-print"
          >
            <Printer size={18} />
            {t('print')}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Print Header */}
        <div className="hidden print:block text-center space-y-1 pb-6 border-b border-slate-100">
          <h1 className="text-xl sm:text-2xl font-black leading-tight animate-color-run">
            {appSettings?.companyName || 'Al-Arafah Islami Bank PLC'}
          </h1>
          <h2 className="text-xl font-black animate-color-run">
            {appSettings?.appName || 'SPS Bazar Outlet'}
          </h2>
          <p className="font-bold text-sm animate-color-run whitespace-pre-wrap">
            {appSettings?.companyAddress || `Kayaria Lanch Ghat, Kayaria, \n Kalkini, Madaripur.`}
          </p>
          <h3 className="text-lg font-black text-slate-800 pt-2 uppercase tracking-widest">{t('transactionReport')}</h3>
          <p className="text-sm font-black text-slate-500">
            {t('date')}: {toBengaliNumber(formatDate(selectedDate, language), language)}
          </p>
        </div>
        {/* Table Section */}
        <div className="bg-white border border-black overflow-hidden shadow-sm">
          <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest">{t('transactionList')}</h2>
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded">
              {t('date')}: {toBengaliNumber(formatDate(selectedDate))}
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-200 border-b border-black text-[12px]">
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest border-r border-black text-center w-16">{t('sl')}</th>
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest border-r border-black text-center w-48">{t('transactionType')}</th>
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest border-r border-black text-center whitespace-nowrap">{t('nameDescription')}</th>
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest border-r border-black text-center w-32">{t('date')}</th>
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest text-center w-40">{t('amount')}</th>
                  {role === 'super_admin' && (
                    <th className="px-3 py-2 font-black text-black uppercase tracking-widest border-l border-black text-center w-20 no-print">{t('action')}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {combinedTransactions.length > 0 ? (
                  combinedTransactions.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-[11px]">
                      <td className="px-3 py-1 text-center font-bold text-slate-500 border-r border-black">
                        {toBengaliNumber(idx + 1)}
                      </td>
                      <td className="px-3 py-1 font-bold text-slate-800 border-r border-black">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            item.type === 'payment' || item.type === 'deposit' ? "bg-emerald-500" : 
                            item.type === 'expense' || item.type === 'withdrawal' ? "bg-rose-500" : "bg-blue-500"
                          )} />
                          <span className="truncate">{getTransactionTypeName(item.type, item.subType)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1 font-bold text-slate-700 border-r border-black text-center whitespace-nowrap">
                        {getDirectorName(item)}
                      </td>
                      <td className="px-3 py-1 text-center font-bold text-slate-600 border-r border-black whitespace-nowrap">
                        {toBengaliNumber(formatDate(item.date) || '---')}
                      </td>
                      <td className="px-3 py-1 text-center font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      {role === 'super_admin' && (
                        <td className="px-3 py-1 text-center font-black border-l border-black no-print">
                          <button 
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all"
                            title={t('edit')}
                          >
                            <Edit size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={role === 'super_admin' ? 6 : 5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <Search size={32} />
                        <p className="text-sm font-bold italic">{t('noTransactionsFound')}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-black text-slate-800">{t('summary')}</h2>
          </div>
          
          <div className="bg-white border border-black overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b border-black text-[12px]">
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest border-r border-black text-center w-16">{t('sl')}</th>
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest border-r border-black text-center">{t('transactionType')}</th>
                  <th className="px-3 py-2 font-black text-black uppercase tracking-widest text-center">{t('totalAmount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {(() => {
                  let totalReceive = 0;
                  let totalPayment = 0;
                  let totalExpense = 0;

                  combinedTransactions.forEach((curr: any) => {
                    const typeLower = (curr.type || '').toLowerCase();
                    const amt = parseFloat(curr.amount) || 0;
                    if (typeLower === 'receive' || typeLower === 'cash receive' || typeLower === 'profit') {
                      totalReceive += amt;
                    } else if (typeLower === 'payment' || typeLower === 'cash payment' || typeLower === 'settlement' || typeLower === 'deposit') {
                      totalPayment += amt;
                    } else if (typeLower === 'expense' || typeLower === 'withdrawal') {
                      totalExpense += amt;
                    }
                  });

                  if (combinedTransactions.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm font-bold text-slate-400 italic">
                          {t('noSummaryAvailable')}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <>
                      <tr className="text-[11px]">
                        <td className="px-3 py-1 text-center font-bold text-slate-500 border-r border-black">
                          {toBengaliNumber(1)}
                        </td>
                        <td className="px-3 py-1 font-bold text-slate-800 border-r border-black text-center">
                          {t('totalReceive')}
                        </td>
                        <td className="px-3 py-1 text-center font-black text-emerald-600">
                          {formatCurrency(totalReceive)}
                        </td>
                      </tr>
                      <tr className="text-[11px]">
                        <td className="px-3 py-1 text-center font-bold text-slate-500 border-r border-black">
                          {toBengaliNumber(2)}
                        </td>
                        <td className="px-3 py-1 font-bold text-slate-800 border-r border-black text-center">
                          {t('totalPayment')}
                        </td>
                        <td className="px-3 py-1 text-center font-black text-rose-600">
                          {formatCurrency(totalPayment)}
                        </td>
                      </tr>
                      <tr className="text-[11px]">
                        <td className="px-3 py-1 text-center font-bold text-slate-500 border-r border-black">
                          {toBengaliNumber(3)}
                        </td>
                        <td className="px-3 py-1 font-bold text-slate-800 border-r border-black text-center">
                          {t('totalExpense')}
                        </td>
                        <td className="px-3 py-1 text-center font-black text-amber-600">
                          {formatCurrency(totalExpense)}
                        </td>
                      </tr>
                      <tr className="text-[11px] bg-slate-100 font-black">
                        <td className="px-3 py-1 text-center text-slate-900 border-r border-black">
                          #
                        </td>
                        <td className="px-3 py-1 text-slate-900 border-r border-black text-center whitespace-nowrap">
                          Total Payment+Total Expense
                        </td>
                        <td className="px-3 py-1 text-center text-slate-900">
                          {formatCurrency(totalPayment + totalExpense)}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
