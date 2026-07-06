import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { Plus, Edit2, Trash2, Phone, MapPin, User as UserIcon, X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

interface LandlordData {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: any;
  updatedAt: any;
}

export const LandlordTable = ({ 
  landlords, 
  role, 
  t, 
  onEdit 
}: { 
  landlords: LandlordData[], 
  role: string, 
  t: any, 
  onEdit?: (landlord: LandlordData) => void 
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const handleDeleteLandlord = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'landlords', id));
      setSuccessModal("Landlord successfully deleted");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting landlord:", error);
      setErrorModal("Failed to delete landlord");
    } finally {
      setLoading(false);
    }
  };

  const showActions = role === 'super_admin';

  const headerClass = "p-2 font-black uppercase text-[11px] tracking-wider text-slate-800 border border-slate-400 text-center bg-[#e8edfb]";
  const cellClass = "p-2 font-bold text-sm whitespace-nowrap text-slate-700 border border-slate-400";

  return (
    <div className="overflow-x-auto border border-slate-400">
      <table className="w-full border-collapse table-auto">
        <thead>
          <tr>
            <th className={headerClass}>{t('sl') || 'SL'}</th>
            <th className={headerClass}>Landlord Name</th>
            <th className={headerClass}>Phone Number</th>
            <th className={headerClass}>Property Address</th>
            {showActions && <th className={headerClass}>{t('action') || 'Action'}</th>}
          </tr>
        </thead>
        <tbody className="bg-white">
          {landlords.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 5 : 4} className="p-12 text-center border border-slate-400">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <p className="font-bold">No Landlords found</p>
                </div>
              </td>
            </tr>
          ) : (
            landlords.map((landlord, index) => (
              <tr key={landlord.id} className="hover:bg-slate-50 transition-colors">
                {/* SL - Centered */}
                <td className={cn(cellClass, "text-center w-12")}>{index + 1}</td>
                {/* Landlord Name */}
                <td className={cellClass}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                      <UserIcon size={12} />
                    </div>
                    <span>{landlord.name}</span>
                  </div>
                </td>
                {/* Phone Number - Centered */}
                <td className={cn(cellClass, "text-center")}>
                  {landlord.phone ? (
                    <a href={`tel:${landlord.phone}`} className="flex items-center justify-center gap-2 text-emerald-600 font-bold hover:underline">
                      <Phone size={14} />
                      <span>{landlord.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 font-normal">N/A</span>
                  )}
                </td>
                {/* Property Address */}
                <td className={cn(cellClass, "max-w-xs truncate")}>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span>{landlord.address || "N/A"}</span>
                  </div>
                </td>
                {showActions && (
                  <td className={cn(cellClass, "text-center w-24")}>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        onClick={() => onEdit?.(landlord)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(landlord.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto rotate-12">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('delete') || 'Delete'}</h3>
                <p className="text-slate-500 text-sm font-bold">Are you sure you want to delete this landlord?</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200">{t('cancel') || 'Cancel'}</button>
                <button onClick={() => handleDeleteLandlord(showDeleteConfirm)} disabled={loading} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200">
                  {loading ? (t('deleting') || 'Deleting...') : (t('delete') || 'Delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {successModal && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('success') || 'Success'}</h3>
                <p className="text-slate-500 text-sm font-bold">{successModal}</p>
              </div>
              <button onClick={() => setSuccessModal(null)} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200">{t('ok') || 'OK'}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <AlertTriangle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('error') || 'Error'}</h3>
                <p className="text-slate-500 text-sm font-bold">{errorModal}</p>
              </div>
              <button onClick={() => setErrorModal(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">{t('ok') || 'OK'}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Landlords = () => {
  const { t } = useApp();
  const { role, appSettings } = useAuth();
  const [landlords, setLandlords] = useState<LandlordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLandlord, setEditingLandlord] = useState<LandlordData | null>(null);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    const unsubLandlords = onSnapshot(collection(db, 'landlords'), (snap) => {
      setLandlords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LandlordData)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'landlords');
      setLoading(false);
    });

    return () => unsubLandlords();
  }, []);

  const handleSaveLandlord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        updatedAt: serverTimestamp()
      };

      if (editingLandlord) {
        await updateDoc(doc(db, 'landlords', editingLandlord.id), data);
        setSuccessModal("Landlord information updated successfully");
      } else {
        await addDoc(collection(db, 'landlords'), {
          ...data,
          createdAt: serverTimestamp()
        });
        setSuccessModal("New landlord registered successfully");
      }
      setShowAddModal(false);
      setEditingLandlord(null);
      setFormData({ name: '', phone: '', address: '' });
    } catch (error) {
      console.error("Error saving landlord:", error);
      setErrorModal("Failed to save landlord information");
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = role === 'super_admin';

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-1 text-center md:text-left py-4">
        <h1 className="text-2xl font-black tracking-tight leading-none animate-color-run">
          {appSettings?.companyName || 'Al-Arafah Islami Bank PLC'}
        </h1>
        <h2 className="text-lg font-black animate-color-run">SPS Bazar Outlet</h2>
        <p className="text-xs font-bold animate-color-run">
          Kayaria Lanch Ghat, Kayaria, <br /> Kalkini, Madaripur.
        </p>
      </div>

      {showAddModal ? (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest">
              {editingLandlord ? 'Edit Landlord' : 'Add Landlord'}
            </h3>
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingLandlord(null);
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-xl transition-all"
            >
              Back to List
            </button>
          </div>

          <form onSubmit={handleSaveLandlord} className="space-y-6 w-full max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Landlord Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter landlord name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Phone Number</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Property Address</label>
              <textarea
                required
                rows={3}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold resize-none text-sm transition-all"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter property address"
              />
            </div>

            <div className="pt-4 flex gap-3 max-w-md">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLandlord(null);
                }}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                <span>{editingLandlord ? (t('update') || 'Update') : (t('save') || 'Save')}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-widest">Landlord List</h3>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setEditingLandlord(null);
                  setFormData({ name: '', phone: '', address: '' });
                  setShowAddModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-100/50 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={16} />
                <span>Add Landlord</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <LandlordTable 
              landlords={landlords} 
              role={role || ''} 
              t={t} 
              onEdit={(landlord) => {
                setEditingLandlord(landlord);
                setFormData({
                  name: landlord.name,
                  phone: landlord.phone || '',
                  address: landlord.address || ''
                });
                setShowAddModal(true);
              }}
            />
          )}
        </>
      )}

      {/* Success Modal */}
      <AnimatePresence>
        {successModal && (
          <div className="fixed inset-0 md:left-64 lg:left-72 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('success') || 'Success'}</h3>
                <p className="text-slate-500 text-sm font-bold">{successModal}</p>
              </div>
              <button onClick={() => setSuccessModal(null)} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200">{t('ok') || 'OK'}</button>
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
                <h3 className="text-xl font-black text-slate-800">{t('error') || 'Error'}</h3>
                <p className="text-slate-500 text-sm font-bold">{errorModal}</p>
              </div>
              <button onClick={() => setErrorModal(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">{t('ok') || 'OK'}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
