import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { Trash2, Plus, Calendar as CalendarIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDate, toBengaliNumber } from './lib/utils';

export const AddMother = () => {
  const { t, language } = useApp();
  const { role } = useAuth();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'super_admin') return;

    const q = query(
      collection(db, 'transactions'),
      where('type', '==', 'Mother'),
      where('date', '==', date)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [role, date]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        type: 'Mother',
        amount: parseFloat(amount),
        date,
        createdAt: serverTimestamp(),
      });
      setAmount('');
      setSuccessModal(t('success'));
    } catch (error) {
      console.error("Error saving mother transaction:", error);
      setErrorModal(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setShowDeleteConfirm(null);
      setSuccessModal(t('motherTransactionDeleted'));
    } catch (error) {
      console.error("Error deleting mother transaction:", error);
      setErrorModal(t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'super_admin') {
    return <div className="p-8 text-center font-bold text-slate-500">{t('noPermission')}</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Plus className="text-emerald-600" />
          {t('addMother')}
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('amount')}</label>
              <input
                type="number"
                required
                step="0.01"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('date')}</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold appearance-none"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? t('saving') : t('save')}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-400 uppercase ml-1 tracking-widest">
          {t('transactionList')} ({formatDate(date, language)})
        </h3>
        {transactions.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 font-bold">
            {t('noTransactionsFound')}
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{formatCurrency(tx.amount, language)}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{formatDate(tx.date, language)}</p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(tx.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
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
              <button onClick={() => setSuccessModal(null)} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200">{t('ok')}</button>
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
              <button onClick={() => setErrorModal(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">{t('ok')}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 md:left-64 lg:left-72 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto rotate-12">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('delete')}</h3>
                <p className="text-slate-500 text-sm font-bold">{t('confirmDeleteMother')}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200">{t('cancel')}</button>
                <button onClick={() => handleDelete(showDeleteConfirm)} disabled={loading} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200">
                  {loading ? t('deleting') : t('delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
