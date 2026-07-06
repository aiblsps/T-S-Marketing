import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useApp } from './App';
import { useAuth } from './AuthContext';
import { Calendar as CalendarIcon, FileText, AlertCircle, Printer, ArrowLeft } from 'lucide-react';
import { DailyReport } from './DailyReport';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, toBengaliNumber, formatDate } from './lib/utils';
import { useNavigate } from 'react-router-dom';

export const ViewDailyReport = () => {
  const { t, language } = useApp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // শুধুমাত্র অ্যাডমিন বা ডিরেক্টররা রিপোর্ট দেখতে পারবে
    if (role !== 'super_admin' && role !== 'admin' && role !== 'director') return;

    const q = query(
      collection(db, 'daily_summaries'),
      where('date', '==', selectedDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // যদি ডাটাবেজে ওই তারিখের রিপোর্ট থাকে
        setReport(snapshot.docs[0].data());
      } else {
        // যদি ওই তারিখে কোনো রিপোর্ট সেভ করা না থাকে
        setReport(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching daily report:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate, role]);

  if (role !== 'super_admin' && role !== 'admin' && role !== 'director') {
    return <div className="p-8 text-center font-bold text-slate-500">{t('noPermission')}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">
      {/* Header & Date Filter */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/reports')}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft size={24} className="text-slate-600" />
            </button>
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <FileText size={24} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
              {t('dailyReport')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full md:w-auto pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100 no-print"
            >
              <Printer size={20} />
              {t('print')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Report Section */}
      <div className="space-y-8">
        <DailyReport date={selectedDate} viewOnly={true} />
      </div>
    </div>
  );
};