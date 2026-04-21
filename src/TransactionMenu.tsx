import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs, addDoc, doc, updateDoc, increment, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { Search, Wallet, UserCircle, Landmark, Receipt, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle, ChevronRight, ArrowLeft, History, Printer, X, Download, Calculator } from 'lucide-react';
import { formatCurrency, toBengaliNumber, cn, getDirectDriveUrl } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toJpeg } from 'html-to-image';

type TransactionType = 'installment' | 'settlement' | 'cash_closing' | 'expense';

export const TransactionMenu = () => {
  const { user, role, directorId } = useAuth();
  const { t } = useApp();
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<TransactionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isClosed, setIsClosed] = useState(false);

  // Form States
  const [searchId, setSearchId] = useState('');
  const [foundEntity, setFoundEntity] = useState<any>(null);
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fine, setFine] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);

  // Lists for selection
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);

  useEffect(() => {
    const onBack = (e: Event) => {
      if (activeType) {
        e.preventDefault();
        setActiveType(null);
        resetForm();
      }
    };
    window.addEventListener('app:back', onBack);
    return () => window.removeEventListener('app:back', onBack);
  }, [activeType]);

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'transactions'), (snap) => {
      setAllTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubI = onSnapshot(collection(db, 'investments'), (snap) => {
      setInvestments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubT(); unsubI(); };
  }, []);

  useEffect(() => {
    if (!directorId) return;
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'transactions'),
      where('directorId', '==', directorId),
      where('type', '==', 'Cash Payment'),
      where('date', '==', today)
    );
    const unsub = onSnapshot(q, (snap) => {
      setIsClosed(!snap.empty);
    });
    return () => unsub();
  }, [directorId]);

  const handleSearch = async () => {
    if (!searchId) return;
    setLoading(true);
    setError('');
    setFoundEntity(null);
    setFoundCustomer(null);
    try {
      if (activeType === 'installment' || activeType === 'settlement') {
        // Search by Investment ID first
        let q = query(collection(db, 'investments'), where('investmentId', '==', searchId), where('status', '==', 'চলমান'));
        let snap = await getDocs(q);
        
        // If not found, search by Customer Account Number
        if (snap.empty) {
          q = query(collection(db, 'investments'), where('customerAccountNumber', '==', searchId), where('status', '==', 'চলমান'));
          snap = await getDocs(q);
        }

        if (snap.empty) throw new Error('সক্রিয় বিনিয়োগ পাওয়া যায়নি।');
        
        const invData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        setFoundEntity(invData);

        // Fetch customer details for the profile view
        const custQ = query(collection(db, 'customers'), where('accountNumber', '==', invData.customerAccountNumber));
        const custSnap = await getDocs(custQ);
        if (!custSnap.empty) {
          setFoundCustomer({ id: custSnap.docs[0].id, ...custSnap.docs[0].data() });
        }
        
        if (activeType === 'installment') {
          setAmount(invData.perInstallment?.toString() || '');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;

    const amt = parseFloat(amount);
    const f = parseFloat(fine) || 0;
    const d = parseFloat(discount) || 0;

    // 1. Validation
    try {
      if ((activeType === 'expense') && !foundEntity && activeType !== 'expense') {
        throw new Error('সঠিক তথ্য নির্বাচন করুন।');
      }

      if ((activeType === 'installment' || activeType === 'settlement') && !foundEntity) {
        throw new Error('বিনিয়োগ নির্বাচন করুন।');
      }

      // 2. Capture data for async processing
      const currentActiveType = activeType;
      const currentAmount = amt;
      const currentFine = f;
      const currentDiscount = d;
      const currentNote = note;
      const currentDate = date;
      const currentEntity = foundEntity;

      // 3. Immediate UI Reset to prevent duplicate clicks and prepare for next
      setLoading(true);
      setError('');
      
      // Reset form fields immediately
      setAmount('');
      setNote('');
      setFine('0');
      setDiscount('0');
      setSearchId('');
      setFoundEntity(null);
      // We keep activeType so the user stays in the same menu for next transaction
      // unless it's a type that requires a search/selection which is now reset.

      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      const processedBy = user.name || user.userId;

      if (currentActiveType === 'installment') {
        const newPaidAmount = (currentEntity.paidAmount || 0) + currentAmount;
        const newDueAmount = currentEntity.totalAmount - newPaidAmount;
        const isFullyPaid = newDueAmount <= 0;

        batch.update(doc(db, 'investments', currentEntity.id), {
          paidAmount: newPaidAmount,
          dueAmount: Math.max(0, newDueAmount),
          status: isFullyPaid ? 'পরিশোধিত' : 'চলমান',
          lastPaymentDate: currentDate
        });

        const trData = {
          type: 'payment',
          investmentId: currentEntity.id,
          customerId: currentEntity.customerId,
          customerName: currentEntity.customerName,
          customerAccountNumber: currentEntity.customerAccountNumber,
          amount: currentAmount,
          fine: currentFine,
          totalWithFine: currentAmount + currentFine,
          date: currentDate,
          note: currentNote,
          processedBy,
          createdAt: timestamp,
          code: `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        };
        const trRef = doc(collection(db, 'transactions'));
        batch.set(trRef, trData);
        setLastTransaction(trData);
        setShowVoucherModal(true);
      }

      if (currentActiveType === 'expense') {
        const trRef = doc(collection(db, 'transactions'));
        batch.set(trRef, {
          type: 'expense',
          amount: currentAmount,
          note: currentNote,
          date: currentDate,
          processedBy,
          createdAt: timestamp
        });
      }

      if (currentActiveType === 'settlement') {
        const totalPayable = currentEntity.dueAmount + currentFine - currentDiscount;
        batch.update(doc(db, 'investments', currentEntity.id), {
          status: 'settled',
          settledAt: timestamp,
          settledAmount: totalPayable,
          fine: currentFine,
          discount: currentDiscount,
          dueAmount: 0
        });

        const trData = {
          type: 'settlement',
          investmentId: currentEntity.id,
          customerId: currentEntity.customerId,
          customerName: currentEntity.customerName,
          customerAccountNumber: currentEntity.customerAccountNumber,
          amount: totalPayable,
          fine: currentFine,
          discount: currentDiscount,
          date: currentDate,
          note: currentNote,
          processedBy,
          createdAt: timestamp,
          code: `SET-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        };
        const trRef = doc(collection(db, 'transactions'));
        batch.set(trRef, trData);
        setLastTransaction(trData);
        setShowVoucherModal(true);
      }

      await batch.commit();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      // If it failed, we might want to restore some state, but the user asked for immediate clear.
      // So we just show the error.
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setSearchId('');
    setFoundEntity(null);
    setAmount('');
    setNote('');
    setFine('0');
    setDiscount('0');
    setError('');
  };

  const menuItems = [
    { id: 'installment', label: t('investmentPayment'), icon: Receipt, color: 'bg-emerald-500', roles: ['admin', 'super_admin'] },
    { id: 'settlement', label: t('investmentSettlement'), icon: CheckCircle2, color: 'bg-blue-500', roles: ['admin', 'super_admin'] },
    { id: 'cash_closing', label: t('cashClosingPage'), icon: Calculator, color: 'bg-emerald-600', roles: ['admin', 'super_admin'] },
    { id: 'expense', label: t('expense'), icon: Wallet, color: 'bg-slate-700', roles: ['admin', 'super_admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(role as string));

  const handleMenuClick = (item: any) => {
    if (isClosed && role === 'admin') {
      setError(t('cashAlreadyClosed'));
      return;
    }
    if (item.id === 'cash_closing') {
      navigate('/cash-closing');
    } else {
      setActiveType(item.id as TransactionType);
    }
  };

  if (activeType) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
                <h3 className="text-xl font-black text-slate-800">
                  {activeType === 'installment' ? t('investmentPayment') : 
                   activeType === 'settlement' ? t('investmentSettlement') :
                   t('expense')}
                </h3>

        {/* Search Section - Always visible at top for these types */}
        {(activeType === 'installment' || activeType === 'settlement') && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-6 space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{t('searchAccount')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                   type="text"
                   placeholder={t('searchAccount')}
                   className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold"
                   value={searchId}
                   onChange={e => setSearchId(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button 
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="px-8 bg-[#003366] text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? '...' : t('search')}
              </button>
            </div>
          </div>
        )}

        {foundEntity && (activeType === 'installment' || activeType === 'settlement') && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Customer Profile Section (Matches Image 2) */}
            <div className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-4 space-y-4">
                {/* Primary Info Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-indigo-500 text-white px-4 py-2 text-sm font-bold">প্রাথমিক তথ্য</div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">{t('accountNo')}</td>
                        <td className="px-3 py-2 font-bold text-slate-700">{toBengaliNumber(foundEntity.customerAccountNumber)}</td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">{t('customerName')}</td>
                        <td className="px-3 py-2 font-bold text-slate-700">{foundEntity.customerName}</td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">পাশবই</td>
                        <td className="px-3 py-2 font-bold text-slate-600">{foundCustomer?.passbookNo || 'নাই'}</td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">এরিয়া</td>
                        <td className="px-3 py-2 font-bold text-slate-600">{foundCustomer?.presentAddress?.village || 'কয়ারিয়া'}</td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">{t('fatherName')}/{t('motherName')}</td>
                        <td className="px-3 py-2 font-bold text-slate-600">{foundCustomer?.fatherName} / {foundCustomer?.motherName}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Contact Info Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-emerald-400 text-white px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <History size={14} /> যোগাযোগ ও অন্যান্য তথ্য
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">স্ত্রী</td>
                        <td className="px-3 py-2 font-bold text-slate-600">{foundCustomer?.spouseName || 'অবিবাহিত'}</td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">{t('address')}</td>
                        <td className="px-3 py-2 font-bold text-slate-600">
                          {foundCustomer?.presentAddress?.village}, {foundCustomer?.presentAddress?.union}, {foundCustomer?.presentAddress?.upazila}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">{t('mobile')}</td>
                        <td className="px-3 py-2 font-bold text-blue-600">
                          <a href={`tel:${foundCustomer?.mobile || foundEntity.mobile}`} className="hover:underline">
                            {foundCustomer?.mobile || foundEntity.mobile || '---'}
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">সদস্যের ধরণ</td>
                        <td className="px-3 py-2 font-bold text-slate-600">{foundCustomer?.memberType || 'দৈনিক'}</td>
                      </tr>
                      <tr>
                        <td className="bg-slate-50 px-3 py-2 font-bold w-1/3 border-r border-slate-100">{t('guarantors')}</td>
                        <td className="px-3 py-2 font-bold text-blue-600">{foundEntity.guarantors?.[0]?.name || 'নাই'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Photo Section */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-400 text-white px-4 py-2 text-sm font-bold">ছবি</div>
                  <div className="p-4 flex justify-center bg-slate-50/30">
                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white flex items-center justify-center text-slate-300">
                      {foundCustomer?.photoUrl ? (
                        <img 
                          src={getDirectDriveUrl(foundCustomer.photoUrl)} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                          loading="lazy"
                        />
                      ) : (
                        <UserCircle size={64} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Collection Form Section */}
            <div className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="bg-[#006699] text-white px-6 py-3 font-bold flex items-center gap-2">
                <Receipt size={20} /> {activeType === 'installment' ? t('payInstallment') : t('investmentSettlement')}
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {activeType === 'installment' && (
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-emerald-600">{t('amount')}*</label>
                      <input 
                        type="number"
                        required
                        placeholder="0.00"
                        className="w-full px-6 py-4 bg-white border-2 border-blue-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-black text-2xl text-center text-[#003366]"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-600">{t('fine')}</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-3 bg-white border-2 border-emerald-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-black text-xl text-center"
                        value={fine}
                        onChange={e => setFine(e.target.value)}
                      />
                    </div>
                    {activeType === 'settlement' && (
                      <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-600">{t('discount')}</label>
                        <input 
                          type="number"
                          className="w-full px-4 py-3 bg-white border-2 border-rose-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-bold text-xl text-center"
                          value={discount}
                          onChange={e => setDiscount(e.target.value)}
                        />
                      </div>
                    )}
                    {activeType === 'installment' && (
                      <div className="space-y-1">
                        <label className="text-sm font-bold text-emerald-600">{t('totalWithFine')}</label>
                        <div className="w-full px-4 py-3 bg-emerald-50 border-2 border-emerald-100 rounded-xl font-black text-xl text-center text-emerald-700">
                          {formatCurrency((parseFloat(amount) || 0) + (parseFloat(fine) || 0))}
                        </div>
                      </div>
                    )}
                    <div className={cn("space-y-1", activeType === 'installment' ? "col-span-2" : "col-span-2")}>
                      <label className="text-sm font-bold text-slate-600">{t('date')}</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-center"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Financial Info Summary (Below Inputs) */}
                <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
                  <div className="grid grid-cols-2 gap-y-3">
                    <div className="text-sm font-bold text-slate-500">{t('investmentAmount')}</div>
                    <div className="text-sm font-black text-slate-700 text-right">{formatCurrency(foundEntity.amount)}</div>
                    
                    <div className="text-sm font-bold text-slate-500">{t('totalWithProfit')}</div>
                    <div className="text-sm font-black text-blue-700 text-right">{formatCurrency(foundEntity.totalAmount)}</div>
                    
                    <div className="text-sm font-bold text-slate-500">{t('totalPaid')}</div>
                    <div className="text-sm font-black text-emerald-600 text-right">{formatCurrency(foundEntity.paidAmount)}</div>
                    
                    <div className="text-base font-bold text-rose-600 pt-2 border-t border-slate-200">{t('totalDue')}</div>
                    <div className="text-lg font-black text-rose-600 text-right pt-2 border-t border-slate-200">
                      {formatCurrency(Math.max(0, (foundEntity.dueAmount || 0) + (parseFloat(fine) || 0) - (parseFloat(discount) || 0)))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('note')} ({t('optional')})</label>
                  <textarea 
                    placeholder={t('note')}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold min-h-[60px] text-sm"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading ? t('processing') : activeType === 'installment' ? t('payInstallment') : t('investmentSettlement')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Other Transaction Types (Expense) */}
        {(!foundEntity || (activeType !== 'installment' && activeType !== 'settlement')) && (
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8 space-y-6">

              {/* Common Fields for Non-Investment Types */}
              {activeType !== 'installment' && activeType !== 'settlement' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('date')}</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('amount')}</label>
                      <input 
                        type="number"
                        required
                        placeholder="0.00"
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-black text-xl text-[#003366]"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('note')} ({t('optional')})</label>
                    <textarea 
                      placeholder={t('note')}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold min-h-[100px]"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-xs font-bold flex items-center gap-2">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? t('processing') : t('submit')}
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        <AnimatePresence>
          {success && !showVoucherModal && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 z-[100]"
            >
              <CheckCircle2 size={24} />
              {t('success')}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voucher Modal */}
        <AnimatePresence>
          {showVoucherModal && lastTransaction && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
              >
                {/* Header - Green like in the image */}
                <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="font-black text-xl">{t('paymentVoucher')}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        const node = document.getElementById('voucher-download-area');
                        if (node) {
                          try {
                            const dataUrl = await toJpeg(node, { 
                              quality: 0.95,
                              pixelRatio: 2, // High resolution
                              backgroundColor: '#ffffff'
                            });
                            const link = document.createElement('a');
                            link.download = `voucher-${lastTransaction.code}.jpg`;
                            link.href = dataUrl;
                            link.click();
                          } catch (err) {
                            console.error('Download failed', err);
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors font-bold text-sm"
                    >
                      <Download size={18} />
                      {t('download')}
                    </button>
                    <button 
                      onClick={() => setShowVoucherModal(false)}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-slate-50">
                  {/* The area to be captured as image */}
                  <div 
                    id="voucher-download-area" 
                    className="bg-white p-8 rounded-3xl shadow-sm space-y-8 border border-slate-100"
                  >
                    <div className="text-center space-y-3">
                      <h4 className="text-2xl font-black text-slate-800">{t('paymentVoucher')}</h4>
                      <p className="text-sm font-bold text-emerald-600">
                        {t('transactionCode')}: <span className="font-mono">{lastTransaction.code}</span>
                      </p>
                    </div>

                    <div className="h-px bg-slate-200 w-full" />

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">{t('customerName')}:</span>
                        <span className="text-slate-800 font-black">{lastTransaction.customerName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">{t('accountNo')}:</span>
                        <span className="text-slate-800 font-black">{toBengaliNumber(lastTransaction.customerAccountNumber)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">{t('date')}:</span>
                        <span className="text-slate-800 font-black">
                          {toBengaliNumber(lastTransaction.date?.split('-').reverse().join('-') || '---')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">{t('description')}:</span>
                        <span className="text-slate-800 font-black">
                          {lastTransaction.type === 'payment' ? t('payInstallment') : t('investmentSettlement')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-6 rounded-2xl flex justify-between items-center border border-emerald-100">
                      <span className="text-emerald-700 font-black text-lg">{t('depositAmount')}:</span>
                      <span className="text-3xl font-black text-emerald-700">
                        {toBengaliNumber(lastTransaction.amount + (lastTransaction.fine || 0))}
                      </span>
                    </div>

                    <div className="pt-12 flex justify-between items-center px-4">
                      <div className="text-center space-y-1">
                        <div className="w-24 h-px bg-slate-300 mx-auto" />
                        <p className="text-[10px] font-bold text-slate-400">{t('customerSignature')}</p>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="w-24 h-px bg-slate-300 mx-auto" />
                        <p className="text-[10px] font-bold text-slate-400">{t('cashierSignature')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white border-t border-slate-100">
                  <button 
                    onClick={() => setShowVoucherModal(false)}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                  >
                    {t('close')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-black text-slate-800">{t('transactions')}</h2>
        <p className="text-sm font-bold text-slate-400">{t('manageTransactions')}</p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 font-black"
        >
          <AlertCircle size={24} />
          <p>{error}</p>
          <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-rose-100 rounded-full transition-colors">
            <X size={18} />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMenuItems.map((item, idx) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => handleMenuClick(item)}
            disabled={isClosed && role === 'admin'}
            className={cn(
              "group p-6 rounded-[2rem] border transition-all flex items-center justify-between text-left active:scale-[0.98]",
              isClosed && role === 'admin'
                ? "bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed"
                : "bg-white border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-100"
            )}
          >
            <div className="flex items-center gap-5">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3", item.color)}>
                <item.icon size={28} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg">{item.label}</h3>
                <p className="text-xs font-bold text-slate-400 group-hover:text-slate-500 transition-colors">ক্লিক করে বিস্তারিত দেখুন</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
              <ChevronRight size={20} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
