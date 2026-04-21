import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { auth, db, loginWithEmail, logout } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Language, AppSettings } from './types';
import { translations } from './translations';
import { Toaster } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { Transactions } from './Transactions';
import { CashClosing } from './CashClosing';
import { Reports } from './Reports';
import { UserManagement as Admin } from './UserManagement';
import { Profile } from './Profile';
import { TransactionReport } from './TransactionReport';
import { Outlets } from './Outlets';
import { Employee } from './Employee';
import { ViewDailyReport } from './ViewDailyReport';
import { Login } from './Login';
import { useAuth } from './AuthContext';

// ব্যাক বাটন হ্যান্ডলার কম্পোনেন্ট
const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // যদি ইউজার হোম পেজে ('/') না থাকে, তবে ব্যাক করলে আগের পেজে যাবে
      if (location.pathname !== '/') {
        e.preventDefault();
        navigate(-1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location, navigate]);

  return null;
};

interface AppContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  settings: AppSettings | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export default function App() {
  const { user, loading, appSettings, t } = useAuth();
  const [language] = useState<Language>('en');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const translate = (key: string) => {
    return translations['en'][key as keyof typeof translations['en']] || key;
  };

  if (globalError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Configuration Error</h1>
          <p className="text-gray-600">{globalError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, profile: user as any, loading, language, setLanguage: () => {}, t: translate, settings: appSettings as any }}>
      <Router>
        {/* ব্যাক বাটন লজিক এখানে যুক্ত করা হয়েছে */}
        <BackButtonHandler />
        
        <Toaster position="top-center" />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="cash-closing" element={<CashClosing />} />
              <Route path="reports" element={<Reports />} />
              <Route path="employees" element={<Employee />} />
              <Route path="users" element={<Admin />} />
              <Route path="daily-report" element={<ViewDailyReport />} />
              <Route path="profile" element={<Profile />} />
              <Route path="transaction-report" element={<TransactionReport />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </Router>
    </AppContext.Provider>
  );
}