import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { Plus, Edit2, Trash2, MapPin, Store, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatNumber } from './lib/utils';

export const Outlets = () => {
  const { role } = useAuth();
  const { t, language } = useApp();
  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<any>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    serial: ''
  });

  useEffect(() => {
    if (role !== 'super_admin') return;

    const q = query(collection(db, 'directors'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setOutlets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'directors');
    });

    return () => unsub();
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingOutlet) {
        await updateDoc(doc(db, 'directors', editingOutlet.id), {
          name: formData.name,
          address: formData.address,
          serial: formData.serial
        });
        setSuccessModal(t('outletUpdated'));
      } else {
        await addDoc(collection(db, 'directors'), {
          name: formData.name,
          address: formData.address,
          serial: formData.serial,
          createdAt: new Date().toISOString()
        });
        setSuccessModal(t('outletAdded'));
      }
      setShowAddModal(false);
      setEditingOutlet(null);
      setFormData({ name: '', address: '', serial: '' });
    } catch (error) {
      console.error("Error saving outlet:", error);
      setErrorModal(t('errorSavingOutlet'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'directors', id));
      setSuccessModal(t('outletDeleted'));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting outlet:", error);
      setErrorModal(t('errorDeletingOutlet'));
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">{t('warning')}</h2>
          <p className="text-slate-500">{t('noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
            <Store size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('outletList')}</h2>
            <p className="text-sm font-bold text-slate-500">{t('totalOutlets')}: {formatNumber(outlets.length, language)}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingOutlet(null);
            setFormData({ name: '', address: '', serial: '' });
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>{t('addOutlet')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {outlets.map((outlet) => (
          <motion.div
            key={outlet.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            
            <div className="relative space-y-4">
              <div className="flex items-start justify-between">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600 border border-emerald-50">
                  <Store size={24} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingOutlet(outlet);
                      setFormData({
                        name: outlet.name || '',
                        address: outlet.address || '',
                        serial: outlet.serial || ''
                      });
                      setShowAddModal(true);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(outlet)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-800">{outlet.name}</h3>
                <div className="flex items-center gap-2 text-slate-500 mt-1">
                  <MapPin size={14} />
                  <p className="text-sm font-bold">{outlet.address || t('No Address')}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('outletSerial')}</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-black">
                  {outlet.serial || 'N/A'}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {outlets.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store size={40} />
          </div>
          <p className="text-slate-500 font-bold">{t('noOutletFound')}</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                  <Store size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-800">
                  {editingOutlet ? t('editOutlet') : t('addOutlet')}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('outletName')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('enterOutletName')}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold text-slate-700"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('address')}</label>
                  <input
                    type="text"
                    placeholder={t('enterOutletAddress')}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold text-slate-700"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('outletSerial')}</label>
                  <input
                    type="text"
                    placeholder="e.g. OUT-001"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold text-slate-700"
                    value={formData.serial}
                    onChange={e => setFormData({ ...formData, serial: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    {loading ? '...' : t('save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <AlertTriangle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('areYouSure')}</h3>
                <p className="text-slate-500 text-sm font-bold">{t('deleteOutletConfirm')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm.id)}
                  disabled={loading}
                  className="flex-1 py-4 bg-rose-600 text-white font-black rounded-2xl shadow-lg shadow-rose-200"
                >
                  {loading ? '...' : t('delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {successModal && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('success')}</h3>
                <p className="text-slate-500 text-sm font-bold">{successModal}</p>
              </div>
              <button
                onClick={() => setSuccessModal(null)}
                className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200"
              >
                {t('ok')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <AlertTriangle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('error')}</h3>
                <p className="text-slate-500 text-sm font-bold">{errorModal}</p>
              </div>
              <button
                onClick={() => setErrorModal(null)}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl"
              >
                {t('ok')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
