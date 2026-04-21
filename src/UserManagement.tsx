import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';

// Create a local secondary auth for user creation to avoid logging out current admin
let secondaryAuth: any = null;
try {
  const secondaryApp = getApps().find(app => app.name === 'SecondaryUserCreation') || initializeApp(firebaseConfig, 'SecondaryUserCreation');
  secondaryAuth = getAuth(secondaryApp);
} catch (err) {
  console.error("Secondary Auth initialization failed:", err);
}
import { UserPlus, Shield, User as UserIcon, Trash2, AlertTriangle, Users, Edit2, CheckCircle2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useApp } from './App';

// import { DailyReport } from './DailyReport';

export const UserManagement = () => {
  const { role, user: currentUser } = useAuth();
  const { t } = useApp();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newRole, setNewRole] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'admin',
    customUserId: '',
    directorId: ''
  });

  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<any>(null);

  useEffect(() => {
    if (role !== 'super_admin') return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubOutlets = onSnapshot(collection(db, 'directors'), (snap) => {
      setOutlets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'directors');
    });
    
    return () => { 
      unsubUsers(); 
      unsubOutlets();
    };
  }, [role]);

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '', // Password won't be updated here
      role: user.role || 'admin',
      customUserId: user.customUserId || '',
      directorId: user.directorId || ''
    });
    setShowAddModal(true);
  };

  const handleDeleteUser = async (userToDelete: any) => {
    if (role !== 'super_admin' || userToDelete.id === currentUser?.id) {
      setErrorModal(userToDelete.id === currentUser?.id ? t('cannotDeleteSelf') : t('noPermission'));
      return;
    }
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setSuccessModal(t('userDeleted'));
      setShowDeleteUserConfirm(null);
    } catch (error) {
      setErrorModal(t('userDeleteError'));
    } finally {
      setLoading(false);
      setShowDeleteUserConfirm(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUser) {
        // Update existing user in Firestore
        await setDoc(doc(db, 'users', editingUser.id), {
          ...editingUser,
          role: formData.role,
          customUserId: formData.role !== 'director' ? formData.customUserId : '',
          directorId: formData.role === 'admin' ? formData.directorId : '',
          updatedAt: new Date().toISOString()
        });
        setSuccessModal(t('userUpdated'));
      } else {
        // Create new user
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email.trim(), formData.password);
        const firebaseUser = userCredential.user;

        await setDoc(doc(db, 'users', firebaseUser.uid), {
          id: firebaseUser.uid,
          email: formData.email.trim(),
          role: formData.role,
          customUserId: formData.role !== 'director' ? formData.customUserId : '',
          directorId: formData.role === 'admin' ? formData.directorId : '',
          createdAt: new Date().toISOString()
        });
        setSuccessModal(t('userCreated'));
      }

      setShowAddModal(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', role: 'admin', customUserId: '', directorId: '' });
    } catch (error: any) {
      console.error("User save error:", error);
      let message = t('userSaveError');
      if (error.code === 'auth/email-already-in-use') {
        message = t('emailInUse');
      } else if (error.code === 'auth/weak-password') {
        message = t('weakPassword');
      } else if (error.message) {
        message = `${t('errorPrefix')}${error.message}`;
      }
      setErrorModal(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t('adminPanel')}</h2>
            <button 
              onClick={() => {
                setEditingUser(null);
                setFormData({ email: '', password: '', role: 'admin', customUserId: '', directorId: '' });
                setShowAddModal(true);
              }}
              className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-95"
            >
              <UserPlus size={20} />
            </button>
          </div>

          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    u.role === 'super_admin' ? "bg-purple-50 text-purple-600" :
                    u.role === 'admin' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {u.role === 'super_admin' ? <Shield size={18} /> : <UserIcon size={18} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{u.email}</h4>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                      {u.role === 'super_admin' ? t('superAdmin') : u.role === 'admin' ? t('adminRole') : t('director')}
                      {u.role === 'admin' && u.directorId && (
                        <span className="text-blue-500 ml-2">
                          ({outlets.find(o => o.id === u.directorId)?.name || t('outletNotFound')})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEditUser(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => setShowDeleteUserConfirm(u)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteUserConfirm && (
          <div className="fixed inset-0 md:left-64 lg:left-72 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-sm rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto rotate-12">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">{t('deleteUser')}</h3>
                <p className="text-slate-500 text-sm font-bold">{t('confirmDeleteUser')} <span className="text-slate-800">{showDeleteUserConfirm.email}</span>?</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteUserConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200">{t('cancel')}</button>
                <button onClick={() => handleDeleteUser(showDeleteUserConfirm)} disabled={loading} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200">
                  {loading ? t('deleting') : t('delete')}
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
                <h3 className="text-xl font-black text-slate-800">{t('warning')}</h3>
                <p className="text-slate-500 text-sm font-bold">{errorModal}</p>
              </div>
              <button onClick={() => setErrorModal(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">{t('ok')}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 md:left-64 lg:left-72 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              drag
              dragMomentum={false}
              initial={{ y: 50, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 cursor-move"
            >
              <div onPointerDown={e => e.stopPropagation()} className="cursor-default">
                <h3 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                  {editingUser ? t('updateUser') : t('createNewUser')}
                </h3>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('emailAddress')}</label>
                    <input 
                      type="email" 
                      required 
                      disabled={!!editingUser}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold disabled:opacity-50" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>
                  {!editingUser && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('password')}</label>
                      <input type="text" required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('userRole')}</label>
                    <select className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                      <option value="admin">{t('adminRole')}</option>
                      <option value="super_admin">{t('superAdmin')}</option>
                      <option value="director">{t('director')}</option>
                    </select>
                  </div>
                  {formData.role !== 'director' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('userId')}</label>
                      <input 
                        type="text" 
                        required 
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:outline-none font-bold" 
                        value={formData.customUserId} 
                        onChange={e => setFormData({...formData, customUserId: e.target.value})} 
                        placeholder={t('userIdPlaceholder')}
                      />
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingUser(null);
                      }} 
                      className="flex-1 py-4 text-slate-400 font-bold"
                    >
                      {t('cancel')}
                    </button>
                    <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl">
                      {editingUser ? t('update') : t('create')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
