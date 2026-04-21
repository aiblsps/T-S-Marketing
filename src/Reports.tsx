import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, onSnapshot, deleteDoc, doc, writeBatch, getDoc, increment, deleteField, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { formatCurrency, cn, toBengaliNumber, formatDate } from './lib/utils';
import { FileText, Calendar, Landmark, Search, Trash2, ArrowLeft, Printer, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

type ReportType = 'receive_payment' | 'cash_management' | 'cash_closing' | 'profit_report' | 'profit_loss_report' | null;

export const Reports = () => {
  const { role } = useAuth();
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
      } else {
        docs = docs.filter(d => d.date >= fromDate && d.date <= toDate);
      }
      
      // Sort by date desc in memory
      docs.sort((a, b) => b.date.localeCompare(a.date));

      if (activeReport === 'receive_payment') {
        const filtered = docs.filter((d: any) => ['Receive', 'Payment', 'Expense'].includes(d.type));
        const typePriority: Record<string, number> = {
          'Payment': 1,
          'Receive': 2,
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
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeReport, viewMode, fromDate, toDate, profitFilterType, selectedMonth, selectedYear]);

  const fetchReportData = () => {
    setViewMode('report');
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm || role !== 'super_admin') return;
    
    try {
      await deleteDoc(doc(db, 'transactions', showDeleteConfirm.id));
      // No need to manually update reportData as onSnapshot will handle it
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting:", error);
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    }
  };

  const totals = reportData.reduce((acc, curr) => {
    if (curr.type === 'Receive' || curr.type === 'Cash Receive') acc.receive += (curr.amount || 0);
    else if (curr.type === 'Payment' || curr.type === 'Cash Payment') acc.payment += (curr.amount || 0);
    else if (curr.type === 'Expense') acc.expense += (curr.amount || 0);
    else if (curr.type === 'Profit') acc.profit += (curr.amount || 0);
    return acc;
  }, { receive: 0, payment: 0, expense: 0, profit: 0 });

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
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
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
                   t('profitLossReport')}
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('Filter Report')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeReport === 'profit_report' ? (
                <>
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{language === 'bn' ? 'ফিল্টার টাইপ' : 'Filter Type'}</label>
                    <select 
                      value={profitFilterType}
                      onChange={(e) => setProfitFilterType(e.target.value as 'all' | 'monthly')}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                    >
                      <option value="monthly">{language === 'bn' ? 'মাস অনুযায়ী ফিল্টার' : 'Filter Months'}</option>
                      <option value="all">{language === 'bn' ? 'সব সময়ের প্রফিট' : 'All Time Profit'}</option>
                    </select>
                  </div>
                  {profitFilterType === 'monthly' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{language === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Month'}</label>
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
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{language === 'bn' ? 'বছর লিখুন' : 'Enter Year'}</label>
                        <input 
                          type="number"
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:outline-none font-black text-slate-900 transition-all"
                          placeholder={language === 'bn' ? 'বছর (যেমন: ২০২৪)' : 'Year (e.g. 2024)'}
                        />
                      </div>
                    </>
                  )}
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
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">Al-Arafah Islami Bank PLC</h1>
            <h2 className="text-lg font-black text-slate-800">SPS Bazar Outlet</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kayaria Lanch Ghat, Kayaria | Kalkini, Madaripur.</p>
            <h3 className="text-lg font-black text-slate-800 pt-2 uppercase tracking-widest">
              {activeReport === 'receive_payment' ? t('receivePaymentReport') : 
               activeReport === 'cash_management' ? t('cashManagementReport') : 
               activeReport === 'cash_closing' ? t('cashClosingReport') :
               activeReport === 'profit_report' ? t('profitReport') :
               t('profitLossReport')}
            </h3>
            <p className="text-slate-500 font-bold">
              {activeReport === 'profit_report' ? (
                profitFilterType === 'all' ? (language === 'bn' ? "সব সময়ের প্রফিট" : "All Time Profit") : 
                `${new Date(0, selectedMonth).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'long' })}, ${toBengaliNumber(selectedYear.toString(), language)}`
              ) : (
                <>{toBengaliNumber(formatDate(fromDate, language), language)} {t('to')} {toBengaliNumber(formatDate(toDate, language), language)}</>
              )}
            </p>
          </div>

            {/* Report Table */}
            {activeReport === 'profit_loss_report' ? (
              <div className="overflow-x-auto pb-4">
                <div className="space-y-4 print:space-y-2 min-w-max">
                  <div className="grid grid-cols-[50px_minmax(150px,_auto)_120px_minmax(150px,_auto)_120px] border-t border-l border-black bg-white">
                    {/* Main Headers */}
                    <div className="col-span-3 bg-[#E1EBF7] p-2 border-r border-b border-black text-center font-black text-slate-800 text-lg">
                      Income
                    </div>
                    <div className="col-span-2 bg-[#E1EBF7] p-2 border-r border-b border-black text-center font-black text-slate-800 text-lg">
                      Expense
                    </div>

                    {/* Column Headers */}
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">SL</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">Account Name</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">Amount</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">Account Name</div>
                    <div className="bg-[#FFF2CC] p-1 border-r border-b border-black text-center font-bold text-xs uppercase">Amount</div>

                    {/* Data Rows */}
                    {(() => {
                      const incomeRows = [{ id: 'profit', name: 'Profit', amount: reportData.filter(d => d.type === 'Profit').reduce((sum, d) => sum + (d.amount || 0), 0) }];
                      const expenseRows = reportData.filter(d => d.type === 'Expense');
                      const maxRows = Math.max(incomeRows.length, expenseRows.length > 0 ? expenseRows.length : 1);

                      return Array.from({ length: maxRows }).map((_, idx) => (
                        <React.Fragment key={idx}>
                          {/* Income Side Cells */}
                          <div className="p-1 border-r border-b border-black text-center text-xs font-bold min-h-[35px] flex items-center justify-center">
                            {idx < incomeRows.length ? toBengaliNumber((idx + 1).toString(), language) : ''}
                          </div>
                          <div className="p-1 border-r border-b border-black text-left text-xs font-bold px-3 whitespace-nowrap flex items-center">
                            {idx < incomeRows.length ? incomeRows[idx].name : ''}
                          </div>
                          <div className="p-1 border-r border-b border-black text-right text-xs font-bold px-3 flex items-center justify-end">
                            {idx < incomeRows.length ? formatCurrency(incomeRows[idx].amount, language) : ''}
                          </div>

                          {/* Expense Side Cells */}
                          <div className="p-1 border-r border-b border-black text-left text-xs font-bold px-3 whitespace-nowrap flex items-center">
                            {idx < expenseRows.length ? (expenseRows[idx].description || 'Expense') : ''}
                          </div>
                          <div className="p-1 border-r border-b border-black text-right text-xs font-bold px-3 flex items-center justify-end">
                            {idx < expenseRows.length ? formatCurrency(expenseRows[idx].amount || 0, language) : ''}
                          </div>
                        </React.Fragment>
                      ));
                    })()}

                    {/* Totals Row */}
                    <div className="col-span-2 p-2 border-r border-b border-black text-center font-black text-sm flex items-center justify-center">
                      Total Income :
                    </div>
                    <div className="p-2 border-r border-b border-black text-right font-black text-sm px-3 flex items-center justify-end">
                      {formatCurrency(reportData.filter(d => d.type === 'Profit').reduce((sum, d) => sum + (d.amount || 0), 0), language)}
                    </div>
                    <div className="p-2 border-r border-b border-black text-center font-black text-sm flex items-center justify-center">
                      Total Expense :
                    </div>
                    <div className="p-2 border-r border-b border-black text-right font-black text-sm px-3 flex items-center justify-end">
                      {formatCurrency(reportData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + (d.amount || 0), 0), language)}
                    </div>
                  </div>

                  {/* Net Result Footer */}
                  <div className="grid grid-cols-[1.5fr_1fr] border-2 border-black bg-white">
                    <div className="p-3 border-r border-black text-center font-black text-lg uppercase tracking-wider flex items-center justify-center">
                      Loss/Profit of this period :
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
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('sl')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('date')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-centre">Previous Cash Mother</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-centre">{t('totalReceive')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-centre">{t('Profit')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-centre">{t('totalPayment')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-centre">{t('totalExpense')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-centre">Closing Balance (Cash + Mother)</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-center no-print">{t('action')}</th>
                    </tr>
                  ) : (
                    <tr className="bg-slate-100 text-center">
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('sl')}</th>
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('date')}</th>
                      {(activeReport === 'receive_payment' || activeReport === 'profit_report') && (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-left">{t('description')}</th>
                      )}
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('transactionType')}</th>
                      {activeReport === 'cash_management' ? (
                        <>
                          <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-right">Cash</th>
                          <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-right">Mother</th>
                        </>
                      ) : (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs text-right">{t('amount')}</th>
                      )}
                      <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs">{t('userId')}</th>
                      {role === 'super_admin' && (
                        <th className="p-2 border border-slate-400 font-black text-slate-800 text-xs no-print">{t('action')}</th>
                      )}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {reportData.length > 0 ? (
                    reportData.map((item, idx) => (
                      activeReport === 'cash_closing' ? (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-center">
                          <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600">{toBengaliNumber((idx + 1).toString(), language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600 whitespace-nowrap">{toBengaliNumber(formatDate(item.date, language), language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-right">{formatCurrency(item.previousDaysCashMother || item.previousDaysCash || 0, language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-black text-emerald-600 text-right">{formatCurrency(item.todayTotalReceive || 0, language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-black text-blue-600 text-right">{formatCurrency(item.todayTotalProfit || 0, language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-black text-rose-600 text-right">{formatCurrency(item.todayTotalPayment || 0, language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-black text-amber-600 text-right">{formatCurrency(item.todayTotalExpense || 0, language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-right">{formatCurrency(item.todayLastBalance || item.closingBalance || 0, language)}</td>
                          <td className="p-2 border border-slate-400 text-center no-print">
                            <button 
                              onClick={() => setShowDenominations(item)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title={t('viewDenominations')}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-center">
                          <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600">{toBengaliNumber((idx + 1).toString(), language)}</td>
                          <td className="p-2 border border-slate-400 text-xs font-bold text-slate-600 whitespace-nowrap">{toBengaliNumber(formatDate(item.date, language), language)}</td>
                          {(activeReport === 'receive_payment' || activeReport === 'profit_report') && (
                            <td className="p-2 border border-slate-400 text-xs font-bold text-slate-800 text-left">{item.description || '---'}</td>
                          )}
                          <td className="p-2 border border-slate-400 text-xs font-bold text-slate-700 whitespace-nowrap">
                            {language === 'bn' ? (
                              (item.type === 'Receive' || item.type === 'Cash Receive') ? 'Receive' : 
                              (item.type === 'Payment' || item.type === 'Cash Payment') ? 'Payment' : 
                              item.type === 'Profit' ? 'Profit' :
                              'Expense'
                            ) : item.type}
                          </td>
                          {activeReport === 'cash_management' ? (
                            <>
                              <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-right whitespace-nowrap">{formatCurrency(item.cashAmount ?? item.amount, language)}</td>
                              <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-right whitespace-nowrap">{formatCurrency(item.motherAmount ?? 0, language)}</td>
                            </>
                          ) : (
                            <td className="p-2 border border-slate-400 text-xs font-black text-slate-900 text-right whitespace-nowrap">{formatCurrency(item.amount, language)}</td>
                          )}
                          <td className="p-2 border border-slate-400 text-xs font-bold text-slate-500">{item.customUserId || 'N/A'}</td>
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
                      )
                    ))
                  ) : (
                    <tr>
                      <td colSpan={activeReport === 'cash_closing' ? 9 : (activeReport === 'receive_payment' || activeReport === 'profit_report' ? 7 : 6)} className="p-32 border border-slate-400 text-center">
                        <p className="text-slate-400 font-black text-lg">
                          {t('noDataFound')}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary Table */}
            {reportData.length > 0 && activeReport !== 'profit_loss_report' && (
              <div className="max-w-xs ml-auto space-y-2">
                <h3 className="text-sm font-black text-slate-800  pb-1">
                  
                </h3>
                <table className="w-full border-collapse border border-slate-400">
                  <tbody>
                    {totals.receive > 0 && (
                      <tr className="text-xs">
                        <td className="p-2 border border-slate-400 font-bold text-slate-600">{t('totalReceive')}</td>
                        <td className="p-2 border border-slate-400 font-black text-emerald-600 text-right">{formatCurrency(totals.receive, language)}</td>
                      </tr>
                    )}
                    {totals.payment > 0 && (
                      <tr className="text-xs">
                        <td className="p-2 border border-slate-400 font-bold text-slate-600">{t('totalPayment')}</td>
                        <td className="p-2 border border-slate-400 font-black text-rose-600 text-right">{formatCurrency(totals.payment, language)}</td>
                      </tr>
                    )}
                    {totals.expense > 0 && (
                      <tr className="text-xs">
                        <td className="p-2 border border-slate-400 font-bold text-slate-600">{t('totalExpense')}</td>
                        <td className="p-2 border border-slate-400 font-black text-amber-600 text-right">{formatCurrency(totals.expense, language)}</td>
                      </tr>
                    )}
                    {totals.profit > 0 && (
                      <tr className="text-xs">
                        <td className="p-2 border border-slate-400 font-bold text-slate-600">{t('totalProfit')}</td>
                        <td className="p-2 border border-slate-400 font-black text-blue-600 text-right">{formatCurrency(totals.profit, language)}</td>
                      </tr>
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
