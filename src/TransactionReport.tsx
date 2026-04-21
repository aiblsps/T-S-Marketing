import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { formatCurrency, toBengaliNumber, cn, formatDate } from './lib/utils';
import { Calendar, ArrowLeft, Search, TrendingUp, TrendingDown, Wallet, Landmark, UserCircle, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

import { useApp } from './App';

export const TransactionReport = () => {
  const { t, language } = useApp();
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

  // Calculate totals for summary
  const summaryTotals = combinedTransactions.reduce((acc: any, curr) => {
    const typeName = getTransactionTypeName(curr.type, curr.subType);
    const amount = parseFloat(curr.amount) || 0;
    acc[typeName] = (acc[typeName] || 0) + amount;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-800">{t('transactionReport')}</h1>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 p-0"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Print Header */}
        <div className="hidden print:block text-center space-y-1 pb-6 border-b border-slate-100">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Al-Arafah Islami Bank PLC</h1>
          <h2 className="text-xl font-black text-slate-800">SPS Bazar Outlet</h2>
          <p className="text-slate-600 font-bold text-sm">Kayaria Lanch Ghat, Kayaria</p>
          <p className="text-slate-600 font-bold text-sm">Kalkini, Madaripur.</p>
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
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
                {Object.entries(summaryTotals).length > 0 ? (
                  Object.entries(summaryTotals).map(([type, total]: [string, any], idx) => (
                    <tr key={type} className="text-[11px]">
                      <td className="px-3 py-1 text-center font-bold text-slate-500 border-r border-black">
                        {toBengaliNumber(idx + 1)}
                      </td>
                      <td className="px-3 py-1 font-bold text-slate-800 border-r border-black text-center">
                        {type}
                      </td>
                      <td className="px-3 py-1 text-center font-black text-slate-900">
                        {formatCurrency(total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm font-bold text-slate-400 italic">
                      {t('noSummaryAvailable')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
