import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { Plus, Edit2, Trash2, Calendar, DollarSign, User as UserIcon, X, Save, AlertTriangle, CheckCircle2, FileText, Check, AlertCircle, RefreshCw, Eye } from 'lucide-react';
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
  createdAt?: any;
  updatedAt?: any;
}

interface RentPaymentData {
  id: string;
  landlordId: string;
  landlordName: string;
  agreementId: string;
  paymentDate: string;
  rentMonth: string;
  amount: number;
  receiverPerson: string;
  note: string;
  useAdvance: boolean;
  payMultipleMonths: boolean;
  fromMonth?: string;
  toMonth?: string;
  fromMonthIdx?: number;
  fromYear?: number;
  toMonthIdx?: number;
  toYear?: number;
  singleMonthIdx?: number;
  singleYear?: number;
  createdAt: any;
  updatedAt: any;
}

const MONTHS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' }
];

export const RentPaymentsTable = ({ 
  payments, 
  role, 
  t, 
  onViewDetails,
  onEdit,
  onDelete
}: { 
  payments: RentPaymentData[], 
  role: string, 
  t: any, 
  onViewDetails?: (payment: RentPaymentData) => void,
  onEdit?: (payment: RentPaymentData) => void,
  onDelete?: (id: string) => void
}) => {
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
            <th className={headerClass}>Rent Month / Period</th>
            <th className={headerClass}>Paid Amount</th>
            <th className={headerClass}>Payment Type</th>
            <th className={headerClass}>Receiver</th>
            <th className={headerClass}>{t('action') || 'Action'}</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {payments.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-12 text-center border border-slate-400">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <p className="font-bold">No Rent Payments found</p>
                </div>
              </td>
            </tr>
          ) : (
            payments.map((payment, index) => {
              return (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  {/* SL */}
                  <td className={cn(cellClass, "text-center w-12")}>{index + 1}</td>
                  
                  {/* Landlord Name */}
                  <td className={cellClass}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                        <UserIcon size={12} />
                      </div>
                      <span>{payment.landlordName}</span>
                    </div>
                  </td>

                  {/* Rent Month / Period */}
                  <td className={cn(cellClass, "text-center font-bold")}>
                    {payment.rentMonth}
                  </td>

                  {/* Paid Amount */}
                  <td className={cn(cellClass, "text-right pr-6 font-mono font-black text-slate-800")}>
                    ৳{Number(payment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Payment Type */}
                  <td className={cn(cellClass, "text-center w-40")}>
                    {payment.useAdvance ? (
                      <span className="px-2.5 py-1 text-xs font-black rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        Adjusted from Advance
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-black rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                        Cash/Mother (Expense)
                      </span>
                    )}
                  </td>

                  {/* Receiver */}
                  <td className={cn(cellClass, "text-center font-medium text-xs")}>
                    {payment.receiverPerson || 'N/A'}
                  </td>

                  {/* Actions */}
                  <td className={cn(cellClass, "text-center w-36")}>
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Details View - Accessible to ALL roles */}
                      <button
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-1 border border-emerald-100"
                        onClick={() => onViewDetails?.(payment)}
                        title="Details"
                      >
                        <Eye size={14} />
                        <span className="text-[10px] font-black uppercase">Details</span>
                      </button>

                      {showActions && (
                        <>
                          <button
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-blue-100"
                            onClick={() => onEdit?.(payment)}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => onDelete?.(payment.id)}
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
    </div>
  );
};

export const RentPayments = () => {
  const { t } = useApp();
  const { role, customUserId, appSettings } = useAuth();

  const [payments, setPayments] = useState<RentPaymentData[]>([]);
  const [landlords, setLandlords] = useState<LandlordData[]>([]);
  const [agreements, setAgreements] = useState<AgreementData[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RentPaymentData | null>(null);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState<RentPaymentData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Form Field States
  const [selectedLandlordId, setSelectedLandlordId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiverPerson, setReceiverPerson] = useState('');
  const [note, setNote] = useState('');
  
  // Checkboxes
  const [useAdvance, setUseAdvance] = useState(false);
  const [payMultipleMonths, setPayMultipleMonths] = useState(false);

  // Month-Year Selector States
  const [singleMonth, setSingleMonth] = useState(new Date().getMonth());
  const [singleYear, setSingleYear] = useState(new Date().getFullYear());

  const [fromMonth, setFromMonth] = useState(new Date().getMonth());
  const [fromYear, setFromYear] = useState(new Date().getFullYear());
  const [toMonth, setToMonth] = useState(new Date().getMonth());
  const [toYear, setToYear] = useState(new Date().getFullYear());

  const [manualAmount, setManualAmount] = useState('');

  useEffect(() => {
    // 1. Fetch Rent Payments
    const unsubPayments = onSnapshot(collection(db, 'rent_payments'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RentPaymentData));
      // Sort client-side by paymentDate desc
      data.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      setPayments(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rent_payments');
      setLoading(false);
    });

    // 2. Fetch Landlords
    const unsubLandlords = onSnapshot(collection(db, 'landlords'), (snap) => {
      setLandlords(snap.docs.map(doc => ({ id: doc.id, name: doc.data().name, phone: doc.data().phone, address: doc.data().address } as LandlordData)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'landlords');
    });

    // 3. Fetch Rental Agreements
    const unsubAgreements = onSnapshot(collection(db, 'rental_agreements'), (snap) => {
      setAgreements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgreementData)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rental_agreements');
    });

    return () => {
      unsubPayments();
      unsubLandlords();
      unsubAgreements();
    };
  }, []);

  // Find selected landlord's latest active/registered rental agreement
  const getLatestAgreementForLandlord = (landlordId: string) => {
    const landlordAgreements = agreements.filter(ag => ag.landlordId === landlordId);
    if (landlordAgreements.length === 0) return null;
    
    // Sort agreements by startDate desc, then by createdAt if available, to pick the latest
    return landlordAgreements.reduce((latest, current) => {
      const latestDate = new Date(latest.startDate || 0);
      const currentDate = new Date(current.startDate || 0);
      if (currentDate > latestDate) return current;
      if (currentDate.getTime() === latestDate.getTime()) {
        const latestCreated = latest.createdAt?.seconds || 0;
        const currentCreated = current.createdAt?.seconds || 0;
        return currentCreated > latestCreated ? current : latest;
      }
      return latest;
    }, landlordAgreements[0]);
  };

  const activeAgreement = getLatestAgreementForLandlord(selectedLandlordId);

  // Auto calculate and update amount when options change
  useEffect(() => {
    if (!activeAgreement) {
      setManualAmount('');
      return;
    }

    const rentPerMonth = activeAgreement.monthlyRent || 0;

    if (payMultipleMonths) {
      // Calculate months between From and To
      const mCount = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
      if (mCount > 0) {
        setManualAmount(String(rentPerMonth * mCount));
      } else {
        setManualAmount(String(rentPerMonth));
      }
    } else {
      setManualAmount(String(rentPerMonth));
    }
  }, [selectedLandlordId, payMultipleMonths, fromMonth, fromYear, toMonth, toYear, activeAgreement]);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLandlordId) {
      setErrorModal("Please select a landlord");
      return;
    }

    const selectedLandlord = landlords.find(l => l.id === selectedLandlordId);
    if (!selectedLandlord) {
      setErrorModal("Landlord details not found");
      return;
    }

    const amountValue = Number(manualAmount || 0);
    if (isNaN(amountValue) || amountValue <= 0) {
      setErrorModal("Please enter a valid paid amount");
      return;
    }

    setLoading(true);
    try {
      // Compute Rent Month Text
      let rentMonthText = '';
      if (payMultipleMonths) {
        const fromLabel = `${MONTHS.find(m => m.value === fromMonth)?.label} ${fromYear}`;
        const toLabel = `${MONTHS.find(m => m.value === toMonth)?.label} ${toYear}`;
        rentMonthText = `${fromLabel} - ${toLabel}`;
      } else {
        rentMonthText = `${MONTHS.find(m => m.value === singleMonth)?.label} ${singleYear}`;
      }

      const data = {
        landlordId: selectedLandlordId,
        landlordName: selectedLandlord.name,
        agreementId: activeAgreement?.id || '',
        paymentDate,
        rentMonth: rentMonthText,
        amount: amountValue,
        receiverPerson,
        note,
        useAdvance,
        payMultipleMonths,
        fromMonth: payMultipleMonths ? `${MONTHS.find(m => m.value === fromMonth)?.label} ${fromYear}` : '',
        toMonth: payMultipleMonths ? `${MONTHS.find(m => m.value === toMonth)?.label} ${toYear}` : '',
        fromMonthIdx: payMultipleMonths ? fromMonth : null,
        fromYear: payMultipleMonths ? fromYear : null,
        toMonthIdx: payMultipleMonths ? toMonth : null,
        toYear: payMultipleMonths ? toYear : null,
        singleMonthIdx: !payMultipleMonths ? singleMonth : null,
        singleYear: !payMultipleMonths ? singleYear : null,
        updatedAt: serverTimestamp()
      };

      if (editingPayment) {
        await updateDoc(doc(db, 'rent_payments', editingPayment.id), data);
        setSuccessModal("Rent Payment updated successfully");
      } else {
        // SAVING A NEW PAYMENT
        
        // 1. If "Use Advance Balance" is CHECKED:
        if (useAdvance) {
          if (!activeAgreement) {
            setErrorModal("Active Rental Agreement not found for this landlord to deduct Advance Balance.");
            setLoading(false);
            return;
          }

          // Deduct from Rental Agreement's advanceAmount
          const agreementRef = doc(db, 'rental_agreements', activeAgreement.id);
          const currentAdvance = activeAgreement.advanceAmount || 0;
          
          if (amountValue > currentAdvance) {
            setErrorModal(`Insufficient Advance Balance. Current advance balance is ৳${currentAdvance.toLocaleString('en-US')}`);
            setLoading(false);
            return;
          }

          await updateDoc(agreementRef, {
            advanceAmount: currentAdvance - amountValue
          });
        } 
        // 2. If "Use Advance Balance" is UNCHECKED:
        else {
          // Add as an EXPENSE (general category) in transactions
          await addDoc(collection(db, 'transactions'), {
            amount: amountValue,
            cashAmount: 0,
            motherAmount: 0,
            date: paymentDate,
            type: 'Expense',
            category: 'general',
            description: `Rent Payment: ${selectedLandlord.name} (${rentMonthText})`,
            customUserId: customUserId || 'N/A',
            createdAt: serverTimestamp()
          });
        }

        // 3. Save Rent Payment record
        await addDoc(collection(db, 'rent_payments'), {
          ...data,
          createdAt: serverTimestamp()
        });

        setSuccessModal("Rent Payment successfully registered");
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving rent payment:", error);
      setErrorModal("Failed to save rent payment");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'rent_payments', id));
      setSuccessModal("Rent Payment record deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting rent payment:", error);
      setErrorModal("Failed to delete rent payment record");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingPayment(null);
    setSelectedLandlordId('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReceiverPerson('');
    setNote('');
    setUseAdvance(false);
    setPayMultipleMonths(false);
    setSingleMonth(new Date().getMonth());
    setSingleYear(new Date().getFullYear());
    setFromMonth(new Date().getMonth());
    setFromYear(new Date().getFullYear());
    setToMonth(new Date().getMonth());
    setToYear(new Date().getFullYear());
    setManualAmount('');
  };

  const isSuperAdmin = role === 'super_admin';

  // Function to generate the list of months for multi-month details display
  const getMonthRangeList = (payment: RentPaymentData) => {
    if (!payment.payMultipleMonths || payment.fromMonthIdx === undefined || payment.fromMonthIdx === null || payment.fromYear === undefined || payment.fromYear === null || payment.toMonthIdx === undefined || payment.toMonthIdx === null || payment.toYear === undefined || payment.toYear === null) {
      return [];
    }
    const list = [];
    let currMonth = payment.fromMonthIdx;
    let currYear = payment.fromYear;
    const endMonth = payment.toMonthIdx;
    const endYear = payment.toYear;

    while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
      list.push({
        month: currMonth,
        year: currYear,
        label: `${MONTHS.find(m => m.value === currMonth)?.label} ${currYear}`
      });
      currMonth++;
      if (currMonth > 11) {
        currMonth = 0;
        currYear++;
      }
    }
    return list;
  };

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

      {selectedPaymentDetails ? (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="text-emerald-600 animate-pulse" size={24} />
              <span>Rent Payment Details</span>
            </h3>
            <button
              onClick={() => setSelectedPaymentDetails(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-xl transition-all"
            >
              Back to List
            </button>
          </div>

          <div className="space-y-6 w-full max-w-4xl">
            {(() => {
              const mList = getMonthRangeList(selectedPaymentDetails);
              const associatedAgreement = agreements.find(ag => ag.id === selectedPaymentDetails.agreementId) || getLatestAgreementForLandlord(selectedPaymentDetails.landlordId);
              const baseMonthlyRent = associatedAgreement ? associatedAgreement.monthlyRent : 0;

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Landlord Name</span>
                      <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                        {selectedPaymentDetails.landlordName}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Payment Date</span>
                      <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                        {selectedPaymentDetails.paymentDate}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Rent Period / Month</span>
                      <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                        {selectedPaymentDetails.rentMonth}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Total Amount Paid</span>
                      <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-mono font-black text-sm text-emerald-700">
                        ৳{Number(selectedPaymentDetails.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Receiver Person</span>
                      <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm text-slate-800">
                        {selectedPaymentDetails.receiverPerson}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Payment Type</span>
                      <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-black text-sm flex items-center">
                        <span className={cn("px-2.5 py-1 text-xs font-black rounded-full border", 
                          selectedPaymentDetails.useAdvance ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                          {selectedPaymentDetails.useAdvance ? 'Deducted from Advance' : 'Expense from Cash/Mother'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedPaymentDetails.note && (
                    <div className="space-y-1 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Note</span>
                      <div className="w-full px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl font-bold text-sm text-slate-700">
                        {selectedPaymentDetails.note}
                      </div>
                    </div>
                  )}

                  {/* Multiple Months breakdown table */}
                  {selectedPaymentDetails.payMultipleMonths && mList.length > 0 && (
                    <div className="space-y-2.5 pt-2 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Multi-Month Breakdown Table</h4>
                      <div className="overflow-hidden border border-slate-300 rounded-2xl">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase border-b border-slate-200">
                              <th className="p-4">Month Name</th>
                              <th className="p-4 text-right">Rent / Month</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-700 font-bold text-xs bg-white">
                            {mList.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>{item.label}</span>
                                </td>
                                <td className="p-4 text-right font-mono font-black text-slate-800">
                                  ৳{(baseMonthlyRent || (selectedPaymentDetails.amount / mList.length)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 max-w-md">
                    <button
                      onClick={() => setSelectedPaymentDetails(null)}
                      className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 text-center text-xs"
                    >
                      Close Details
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : showAddModal ? (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest">
              {editingPayment ? 'Edit Rent Payment' : 'New Rent Payment'}
            </h3>
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingPayment(null);
                resetForm();
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-xl transition-all"
            >
              Back to List
            </button>
          </div>

          <form onSubmit={handleSavePayment} className="space-y-6 w-full max-w-4xl">
            {/* 2 Checkbox Fields in elegant high contrast layouts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useAdvance}
                  onChange={e => setUseAdvance(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer rounded-lg border-2 border-slate-300"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800">Use Advance Balance</span>
                  <span className="text-[10px] text-slate-400 font-bold">Deduct from Landlord's Advance</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={payMultipleMonths}
                  onChange={e => setPayMultipleMonths(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer rounded-lg border-2 border-slate-300"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800">Pay Multiple Months</span>
                  <span className="text-[10px] text-slate-400 font-bold">Multi-month consolidated bill</span>
                </div>
              </label>
            </div>

            {/* Landlord Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Select Landlord</label>
              <select
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                value={selectedLandlordId}
                onChange={e => setSelectedLandlordId(e.target.value)}
              >
                <option value="">-- Choose Landlord --</option>
                {landlords.map(l => (
                  <option key={l.id} value={l.id}>{l.name} {l.phone ? `(${l.phone})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Display Agreement Monthly Rent Info */}
            {activeAgreement && (
              <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between animate-pulse">
                <span>Active Agreement Monthly Rent:</span>
                <span className="font-black text-sm">৳{(activeAgreement.monthlyRent || 0).toLocaleString('en-US')}</span>
              </div>
            )}

            {/* Payment Date & Receiver Person */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Payment Date</label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Receiver Person</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={receiverPerson}
                  onChange={e => setReceiverPerson(e.target.value)}
                  placeholder="e.g. Landlord name or nominee"
                />
              </div>
            </div>

            {/* Multi Month / Single Month Picker Logic */}
            {payMultipleMonths ? (
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200 space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Select Month Range</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* From Date/Month */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">From Month</label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-3 py-3 bg-white border-2 border-slate-300 rounded-xl font-bold text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                        value={fromMonth}
                        onChange={e => setFromMonth(Number(e.target.value))}
                      >
                        {MONTHS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        required
                        className="w-24 px-3 py-3 bg-white border-2 border-slate-300 rounded-xl font-bold text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                        value={fromYear}
                        onChange={e => setFromYear(Number(e.target.value))}
                        placeholder="Year"
                      />
                    </div>
                  </div>

                  {/* To Date/Month */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">To Month</label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-3 py-3 bg-white border-2 border-slate-300 rounded-xl font-bold text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                        value={toMonth}
                        onChange={e => setToMonth(Number(e.target.value))}
                      >
                        {MONTHS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        required
                        className="w-24 px-3 py-3 bg-white border-2 border-slate-300 rounded-xl font-bold text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                        value={toYear}
                        onChange={e => setToYear(Number(e.target.value))}
                        placeholder="Year"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Rent Month</label>
                <div className="flex gap-4">
                  <select
                    className="flex-1 px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                    value={singleMonth}
                    onChange={e => setSingleMonth(Number(e.target.value))}
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    required
                    className="w-32 px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                    value={singleYear}
                    onChange={e => setSingleYear(Number(e.target.value))}
                    placeholder="Year"
                  />
                </div>
              </div>
            )}

            {/* Amount & Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Paid Amount (৳)</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono font-black text-sm transition-all"
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value)}
                  placeholder="Paid Amount"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Note (Optional)</label>
                <input
                  type="text"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-sm transition-all"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Additional remarks"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-3 max-w-md">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPayment(null);
                  resetForm();
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
                <span>{editingPayment ? (t('update') || 'Update') : (t('save') || 'Save')}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Controls Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-widest">Rent Payments</h3>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-100/50 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={16} />
                <span>Rent Payment</span>
              </button>
            )}
          </div>

          {/* Main Table View */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <RentPaymentsTable 
              payments={payments} 
              role={role || ''} 
              t={t} 
              onViewDetails={(payment) => {
                setSelectedPaymentDetails(payment);
              }}
              onEdit={(payment) => {
                setEditingPayment(payment);
                setSelectedLandlordId(payment.landlordId);
                setPaymentDate(payment.paymentDate);
                setReceiverPerson(payment.receiverPerson);
                setNote(payment.note);
                setUseAdvance(payment.useAdvance);
                setPayMultipleMonths(payment.payMultipleMonths);
                if (payment.payMultipleMonths) {
                  setFromMonth(payment.fromMonthIdx ?? new Date().getMonth());
                  setFromYear(payment.fromYear ?? new Date().getFullYear());
                  setToMonth(payment.toMonthIdx ?? new Date().getMonth());
                  setToYear(payment.toYear ?? new Date().getFullYear());
                } else {
                  setSingleMonth(payment.singleMonthIdx ?? new Date().getMonth());
                  setSingleYear(payment.singleYear ?? new Date().getFullYear());
                }
                setManualAmount(String(payment.amount));
                setShowAddModal(true);
              }}
              onDelete={(id) => {
                setShowDeleteConfirm(id);
              }}
            />
          )}
        </>
      )}

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
                <p className="text-slate-500 text-sm font-bold">Are you sure you want to delete this payment record?</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200">{t('cancel') || 'Cancel'}</button>
                <button onClick={() => handleDeletePayment(showDeleteConfirm)} disabled={loading} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200">
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
