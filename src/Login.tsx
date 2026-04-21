import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { LogIn, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './App';
import { formatNumber } from './lib/utils';
import myLogo from '@/src/assets/logo.png'; 

export const Login = () => {
  const navigate = useNavigate();
  const { t, language } = useApp();
  const { user, loading: authLoading, appSettings } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      // AuthContext will handle the state change and navigation
    } catch (err: any) {
      console.error("Login error:", err);
      let errorMessage = t('invalidEmailPassword');
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = t('invalidEmailPassword');
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = t('checkInternetConnection');
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = t('tooManyRequests');
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5377C8] to-[#405D9A] flex items-center justify-center p-6 antialiased pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#2B3F6E] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/5 flex flex-col items-center"
      >
        <div className="flex flex-col items-center mb-6">
          <img 
            src={myLogo} 
            alt="Logo" 
            className="w-44 h-44 object-contain" 
          />
          <h2 className="text-4xl font-semibold text-[#FFFFFF] tracking-tight mt-[-15px]">
            {appSettings?.companyName || 'T S Marketing'}
          </h2>
          <p className="text-[#FFFFFF]/80 font-medium text-sm mt-1">
            {t('loginSubtitle')}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 w-full">
          <div className="relative group">
            <input 
              type="text"
              id="email"
              placeholder=" "
              required
              className="peer w-full px-5 py-3 bg-white/5 border-2 border-white/10 rounded-xl focus:border-white/40 focus:outline-none transition-all text-[#FFFFFF] font-normal"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <label 
              htmlFor="email"
              className="absolute left-4 top-3 text-[#FFFFFF]/60 font-medium pointer-events-none transition-all duration-200 
              peer-focus:-top-3 peer-focus:left-3 peer-focus:text-xs peer-focus:text-[#FFFFFF] peer-focus:bg-[#2B3F6E] peer-focus:px-2
              peer-[:not(:placeholder-shown)]:-top-3 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-[#FFFFFF] peer-[:not(:placeholder-shown)]:bg-[#2B3F6E] peer-[:not(:placeholder-shown)]:px-2"
            >
              {t('emailAddress')}
            </label>
          </div>

          <div className="relative group">
            <input 
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder=" "
              required
              className="peer w-full px-5 py-3 bg-white/5 border-2 border-white/10 rounded-xl focus:border-white/40 focus:outline-none transition-all text-[#FFFFFF] font-normal pr-12"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <label 
              htmlFor="password"
              className="absolute left-4 top-3 text-[#FFFFFF]/60 font-medium pointer-events-none transition-all duration-200 
              peer-focus:-top-3 peer-focus:left-3 peer-focus:text-xs peer-focus:text-[#FFFFFF] peer-focus:bg-[#2B3F6E] peer-focus:px-2
              peer-[:not(:placeholder-shown)]:-top-3 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-[#FFFFFF] peer-[:not(:placeholder-shown)]:bg-[#2B3F6E] peer-[:not(:placeholder-shown)]:px-2"
            >
              {t('password')}
            </label>
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-red-300 text-xs font-medium text-center">{error}</p>
          )}

          <div className="pt-2">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="relative w-full bg-[#8EABE8] text-[#0F172A] py-3.5 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-[#0F172A]/30 border-t-[#0F172A] rounded-full animate-spin"></div>
              ) : (
                <>{t('login')} <LogIn size={20} /></>
              )}
            </motion.button>

            <button 
              type="button"
              onClick={() => setShowForgot(true)}
              className="w-full text-center text-sm font-medium text-[#FFFFFF]/70 hover:text-white mt-5 transition-colors"
            >
              {t('forgotPassword')}
            </button>
          </div>
        </form>

        <div className="mt-12 text-center">
          <p className="text-[#FFFFFF]/40 text-[11px] font-medium tracking-wider">
            © {formatNumber(2026, language)} {appSettings?.companyName || 'T S Marketing'}. {t('allRightsReserved')}
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showForgot && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-3xl max-w-xs w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle size={32} />
              </div>
              <h3 className="font-bold text-slate-900 text-xl mb-2">{t('help')}</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium">{t('forgotPasswordMessage')}</p>
              <button 
                onClick={() => setShowForgot(false)}
                className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-transform"
              >
                {t('ok')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};