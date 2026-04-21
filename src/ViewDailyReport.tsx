import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useApp } from './App';
import { useAuth } from './AuthContext';
import { Calendar as CalendarIcon, FileText, AlertCircle } from 'lucide-react';
import { DailyReport } from './DailyReport';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, toBengaliNumber, formatDate } from './lib/utils';

export const ViewDailyReport = () => {
  const { t, language } = useApp();
  const { role } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // শুধুমাত্র অ্যাডমিন বা ডিরেক্টররা রিপোর্ট দেখতে পারবে
    if (role !== 'super_admin' && role !== 'admin' && role !== 'director') return;

    setLoading(true);
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
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <FileText size={24} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
              {t('dailyReport')}
            </h2>
          </div>

          <div className="relative group">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-auto pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Report Section */}
      <div className="space-y-8">
        <AnimatePresence mode="wait">
          {loading ? (
            // লোডিং স্টেট
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="flex justify-center py-20"
            >
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            </motion.div>
          ) : report ? (
            // যদি রিপোর্ট পাওয়া যায়
            <motion.div 
              key="report"
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <DailyReport date={selectedDate} viewOnly={true} />
            </motion.div>
          ) : (
            // যদি ওই তারিখে কোনো ডাটা না থাকে
            <motion.div 
              key="no-data"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200"
            >
              <div className="p-4 bg-white rounded-2xl w-fit mx-auto mb-4 shadow-sm">
                <AlertCircle size={32} className="text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold tracking-tight">
                {t('noDataFound') || "এই তারিখে কোনো রিপোর্ট সেভ করা হয়নি"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};