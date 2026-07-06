import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { Plus, Edit2, Trash2, Calendar, DollarSign, User as UserIcon, X, Save, AlertTriangle, CheckCircle2, FileSignature, FileText, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

interface LandlordData {
  id: string;
  name: string;
  phone: string;
  address: string;
}

interface AgreementData {
  id: string;
  landlordId: string;
  landlordName: string;
  startDate: string;
  endDate: string;
  advanceAmount: number;
  monthlyRent: number;
  advancePaidDate: string;
  createdAt: any;
  updatedAt: any;
}

interface AdvanceTransactionData {
  id: string;
  landlordId: string;
  landlordName: string;
  agreementId: string;
  date: string;
  amount: number;
  type: 'payment' | 'refund';
  customUserId: string;
  createdAt: any;
}

export const AgreementTable = ({ 
  agreements, 
  role, 
  t, 
  onEdit,
  onCustomAction,
  onTopUpAdvance
}: { 
  agreements: AgreementData[], 
  role: string, 
  t: any, 
  onEdit?: (agreement: AgreementData) => void,
  onCustomAction?: (agreement: AgreementData) => void,
  onTopUpAdvance?: (agreement: AgreementData) => void
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const handleDeleteAgreement = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'rental_agreements', id));
      setSuccessModal("Rental Agreement successfully deleted");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting agreement:", error);
      setErrorModal("Failed to delete rental agreement");
    } finally {
      setLoading(false);
    }
  };

  const showActions = role === 'super_admin';

  const getStatus = (endDateStr: string) => {
    if (!endDateStr) return { label: 'Unknown', className: 'bg-slate-50 text-slate-600 border-slate-200' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(0, 0, 0, 0);

    if (today <= endDate) {
      return { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    } else {
      return { label: 'Expired', className: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
  };

  const headerClass = "p-2 font-black uppercase text-[11px] tracking-wider text-slate-800 border border-slate-400 text-center bg-[#e8edfb]";
  const cellClass = "p-2 font-bold text-sm whitespace-nowrap text-slate-700 border border-slate-400";

  return (
    <div className="overflow-x-auto border border-slate-400">
      <table className="w-full border-collapse table-auto">
        <thead>
          <tr>
            <th className={headerClass}>{t('sl') || 'SL'}</th>
            <th className={headerClass}>Landlord Name</th>
            <th className={headerClass}>Advance Amount</th>
            <th className={headerClass}>Status</th>
            <th className={headerClass}>{t('action') || 'Action'}</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {agreements.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-12 text-center border border-slate-400">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <p className="font-bold">No Rental Agreements found</p>
                </div>
              </td>
            </tr>
          ) : (
            agreements.map((agreement, index) => {
              const status = getStatus(agreement.endDate);
              return (
                <tr key={agreement.id} className="hover:bg-slate-50 transition-colors">
                  {/* SL - Centered */}
                  <td className={cn(cellClass, "text-center w-12")}>{index + 1}</td>
                  
                  {/* Landlord Name */}
                  <td className={cellClass}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                        <UserIcon size={12} />
                      </div>
                      <span>{agreement.landlordName}</span>
                    </div>
                  </td>

                  {/* Advance Amount - Right Aligned / Centered */}
                  <td className={cn(cellClass, "text-right pr-6 font-mono font-black text-slate-800")}>
                    ৳{Number(agreement.advanceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Status - Centered with Badge */}
                  <td className={cn(cellClass, "text-center w-28")}>
                    <span className={cn("px-3 py-1 text-xs font-black rounded-full border", status.className)}>
                      {status.label}
                    </span>
                  </td>

                  {/* Action Column */}
                  <td className={cn(cellClass, "text-center w-52")}>
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Beautiful Custom Feature/Details Action Icon */}
                      <button
                        onClick={() => onCustomAction?.(agreement)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-1 border border-emerald-100"
                        title="Agreement Details"
                      >
                        <FileText size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Details</span>
                      </button>

                      {showActions && (
                        <>
                          {/* Receive / Top Up Advance Balance Action */}
                          <button
                            onClick={() => onTopUpAdvance?.(agreement)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all flex items-center gap-1 border border-amber-100"
                            title="Receive / Add Advance Balance"
                          >
                            <DollarSign size={14} />
                            <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Add Advance</span>
                          </button>

                          <button
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-blue-100"
                            onClick={() => onEdit?.(agreement)}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          
                          <button
                            onClick={() => setShowDeleteConfirm(agreement.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-rose-100"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
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
                <p className="text-slate-500 text-sm font-bold">Are you sure you want to delete this agreement?</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200">{t('cancel') || 'Cancel'}</button>
                <button onClick={() => handleDeleteAgreement(showDeleteConfirm)} disabled={loading} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200">
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

export const RentalAgreements = () => {
  const { t } = useApp();
  const { role, customUserId, appSettings } = useAuth();
  
  const [agreements, setAgreements] = useState<AgreementData[]>([]);
  const [landlords, setLandlords] = useState<LandlordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<AgreementData | null>(null);
  const [selectedAgreementDetails, setSelectedAgreementDetails] = useState<AgreementData | null>(null);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // States for Top Up Advance Balance
  const [topUpAgreement, setTopUpAgreement] = useState<AgreementData | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpDate, setTopUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceTxType, setAdvanceTxType] = useState<'payment' | 'refund'>('payment');

  const [formData, setFormData] = useState({
    landlordId: '',
    startDate: '',
    endDate: '',
    advanceAmount: '',
    monthlyRent: '',
    advancePaidDate: ''
  });

  useEffect(() => {
    // 1. Fetch Agreements
    const unsubAgreements = onSnapshot(collection(db, 'rental_agreements'), (snap) => {
      setAgreements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgreementData)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rental_agreements');
      setLoading(false);
    });

    // 2. Fetch Landlords for Dropdown
    const unsubLandlords = onSnapshot(collection(db, 'landlords'), (snap) => {
      setLandlords(snap.docs.map(doc => ({ id: doc.id, name: doc.data().name, phone: doc.data().phone, address: doc.data().address } as LandlordData)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'landlords');
    });

    return () => {
      unsubAgreements();
      unsubLandlords();
    };
  }, []);

  const handleSaveAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.landlordId) {
      setErrorModal("Please select a landlord");
      return;
    }

    setLoading(true);
    try {
      const selectedLandlord = landlords.find(l => l.id === formData.landlordId);
      const landlordName = selectedLandlord ? selectedLandlord.name : 'Unknown';

      const data = {
        landlordId: formData.landlordId,
        landlordName,
        startDate: formData.startDate,
        endDate: formData.endDate,
        advanceAmount: Number(formData.advanceAmount || 0),
        monthlyRent: Number(formData.monthlyRent || 0),
        advancePaidDate: formData.advancePaidDate,
        updatedAt: serverTimestamp()
      };

      if (editingAgreement) {
        await updateDoc(doc(db, 'rental_agreements', editingAgreement.id), data);
        setSuccessModal("Rental Agreement updated successfully");
      } else {
        await addDoc(collection(db, 'rental_agreements'), {
          ...data,
          createdAt: serverTimestamp()
        });
        setSuccessModal("New Rental Agreement registered successfully");
      }
      setShowAddModal(false);
      setEditingAgreement(null);
      setFormData({
        landlordId: '',
        startDate: '',
        endDate: '',
        advanceAmount: '',
        monthlyRent: '',
        advancePaidDate: ''
      });
    } catch (error) {
      console.error("Error saving agreement:", error);
      setErrorModal("Failed to save rental agreement");
    } finally {
      setLoading(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpAgreement) return;

    const amountValue = Number(topUpAmount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setErrorModal("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const agreementRef = doc(db, 'rental_agreements', topUpAgreement.id);
      const currentAdvance = topUpAgreement.advanceAmount || 0;
      
      let newAdvance = currentAdvance;
      if (advanceTxType === 'payment') {
        newAdvance = currentAdvance + amountValue;
      } else {
        if (amountValue > currentAdvance) {
          setErrorModal(`Insufficient Advance Balance. Current advance balance is ৳${currentAdvance.toLocaleString('en-US')}`);
          setLoading(false);
          return;
        }
        newAdvance = currentAdvance - amountValue;
      }

      // Update Firestore: update advanceAmount in rental_agreements
      await updateDoc(agreementRef, {
        advanceAmount: newAdvance,
        updatedAt: serverTimestamp()
      });

      // Save to separate advance_transactions collection (no main transactions)
      await addDoc(collection(db, 'advance_transactions'), {
        landlordId: topUpAgreement.landlordId,
        landlordName: topUpAgreement.landlordName,
        agreementId: topUpAgreement.id,
        date: topUpDate,
        amount: amountValue,
        type: advanceTxType, // 'payment' or 'refund'
        customUserId: customUserId || 'N/A',
        createdAt: serverTimestamp()
      });

      setSuccessModal(`Successfully registered ${advanceTxType === 'payment' ? 'Advance Payment' : 'Refund Advance'} of ৳${amountValue.toLocaleString('en-US')} for landlord ${topUpAgreement.landlordName}`);
      setTopUpAgreement(null);
      setTopUpAmount('');
      setAdvanceTxType('payment'); // Reset to default
    } catch (err) {
      console.error("Error updating advance balance:", err);
      setErrorModal("Failed to update advance balance");
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = role === 'super_admin';

  return (
    <div className="space-y-6 pb-20">
      {/* Outlet Header */}
      <div className="space-y-1 text-center md:text-left py-4">
        <h1 className="text-2xl font-black tracking-tight leading-none animate-color-run">
          {appSettings?.companyName || 'Al-Arafah Islami Bank PLC'}
        </h1>
        <h2 className="text-lg font-black animate-color-run">SPS Bazar Outlet</h2>
        <p className="text-xs font-bold animate-color-run">
          Kayaria Lanch Ghat, Kayaria, <br /> Kalkini, Madaripur.
        </p>
      </div>

      {selectedAgreementDetails ? (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <FileSignature className="text-emerald-600" size={24} />
              <span>Agreement Details</span>
            </h3>
            <button
              onClick={() => setSelectedAgreementDetails(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-xl transition-all"
            >
              Back to List
            </button>
          </div>

          <div className="space-y-6 w-full max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Landlord Name</span>
                <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                  {selectedAgreementDetails.landlordName}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Advance Paid Date</span>
                <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                  {selectedAgreementDetails.advancePaidDate}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Start Date</span>
                <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                  {selectedAgreementDetails.startDate}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</span>
                <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                  {selectedAgreementDetails.endDate}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Advance Amount</span>
                <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-mono font-black text-sm text-emerald-700">
                  ৳{Number(selectedAgreementDetails.advanceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Monthly Rent</span>
                <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-mono font-black text-sm text-slate-800">
                  ৳{Number(selectedAgreementDetails.monthlyRent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="pt-4 max-w-md">
              <button
                onClick={() => setSelectedAgreementDetails(null)}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 text-center text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      ) : showAddModal ? (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest">
              {editingAgreement ? 'Edit Agreement' : 'Add Agreement'}
            </h3>
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingAgreement(null);
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-xl transition-all"
            >
              Back to List
            </button>
          </div>

          <form onSubmit={handleSaveAgreement} className="space-y-6 w-full max-w-4xl">
            {/* Landlord Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Select Landlord</label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                value={formData.landlordId}
                onChange={e => setFormData({ ...formData, landlordId: e.target.value })}
              >
                <option value="">-- Choose Landlord --</option>
                {landlords.map(l => (
                  <option key={l.id} value={l.id}>{l.name} {l.phone ? `(${l.phone})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Start Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Start Date</label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Advance Amount */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Advance Amount (৳)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={formData.advanceAmount}
                  onChange={e => setFormData({ ...formData, advanceAmount: e.target.value })}
                  placeholder="e.g. 50000"
                />
              </div>

              {/* Monthly Rent */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Monthly Rent (৳)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={formData.monthlyRent}
                  onChange={e => setFormData({ ...formData, monthlyRent: e.target.value })}
                  placeholder="e.g. 10000"
                />
              </div>
            </div>

            {/* Advance Paid Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Advance Paid Date</label>
              <input
                type="date"
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                value={formData.advancePaidDate}
                onChange={e => setFormData({ ...formData, advancePaidDate: e.target.value })}
              />
            </div>

            <div className="pt-4 flex gap-3 max-w-md">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAgreement(null);
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
                <span>{editingAgreement ? (t('update') || 'Update') : (t('save') || 'Save')}</span>
              </button>
            </div>
          </form>
        </div>
      ) : topUpAgreement ? (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="text-emerald-600 animate-pulse" size={24} />
              <span>{advanceTxType === 'payment' ? 'Add Advance Balance' : 'Refund Advance Balance'}</span>
            </h3>
            <button
              onClick={() => {
                setTopUpAgreement(null);
                setAdvanceTxType('payment');
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-xl transition-all"
            >
              Back to List
            </button>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1 w-full max-w-4xl">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">Selected Landlord</span>
            <span className="font-black text-slate-800 text-sm block">{topUpAgreement.landlordName}</span>
            <span className="text-xs font-bold text-slate-600 block">Current Advance Balance: ৳{Number(topUpAgreement.advanceAmount || 0).toLocaleString('en-US')}</span>
          </div>

          <form onSubmit={handleTopUpSubmit} className="space-y-6 w-full max-w-4xl">
            {/* Transaction Type Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Adjustment Type</label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                value={advanceTxType}
                onChange={e => setAdvanceTxType(e.target.value as 'payment' | 'refund')}
              >
                <option value="payment">Advance Payment</option>
                <option value="refund">Refund Advance</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Date</label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={topUpDate}
                  onChange={e => setTopUpDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  {advanceTxType === 'payment' ? 'Top-Up Amount (৳)' : 'Refund Amount (৳)'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono font-black text-sm transition-all"
                  value={topUpAmount}
                  onChange={e => setTopUpAmount(e.target.value)}
                  placeholder={advanceTxType === 'payment' ? "Enter amount to add" : "Enter amount to refund"}
                />
              </div>
            </div>

            <div className="pt-4 flex gap-3 max-w-md">
              <button
                type="button"
                onClick={() => {
                  setTopUpAgreement(null);
                  setAdvanceTxType('payment');
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
                <span>{advanceTxType === 'payment' ? 'Save Balance' : 'Save Refund'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Controls Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-widest">Rental Agreements</h3>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setEditingAgreement(null);
                  setFormData({
                    landlordId: '',
                    startDate: '',
                    endDate: '',
                    advanceAmount: '',
                    monthlyRent: '',
                    advancePaidDate: ''
                  });
                  setShowAddModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-100/50 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={16} />
                <span>Add Agreement</span>
              </button>
            )}
          </div>

          {/* Main Table View */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <AgreementTable 
              agreements={agreements} 
              role={role || ''} 
              t={t} 
              onEdit={(agreement) => {
                setEditingAgreement(agreement);
                setFormData({
                  landlordId: agreement.landlordId,
                  startDate: agreement.startDate,
                  endDate: agreement.endDate,
                  advanceAmount: String(agreement.advanceAmount),
                  monthlyRent: String(agreement.monthlyRent),
                  advancePaidDate: agreement.advancePaidDate
                });
                setShowAddModal(true);
              }}
              onCustomAction={(agreement) => {
                setSelectedAgreementDetails(agreement);
              }}
              onTopUpAdvance={(agreement) => {
                setTopUpAgreement(agreement);
                setTopUpDate(new Date().toISOString().split('T')[0]);
                setTopUpAmount('');
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
