import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '../App';

export const BackButtonHandler: React.FC = () => {
  const location = useLocation();
  const { t } = useApp();
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';
    
    if (isDashboard) {
      // Push an extra state to the history stack
      // This way, when the user clicks back, it pops this state instead of leaving the app
      window.history.pushState({ noExit: true }, '');
      
      const handlePopState = (event: PopStateEvent) => {
        // When back button is pressed on dashboard
        setShowExitModal(true);
        // Push the state again to keep the user on the dashboard for the next back press
        window.history.pushState({ noExit: true }, '');
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [location.pathname]);

  const handleExit = () => {
    // In a real APK/WebView, this might need a bridge call.
    // For now, we'll try to close the window.
    // If it's a Capacitor/Cordova app, this might be handled by the native layer.
    try {
      (window as any).close();
      // If it's a PWA or standard browser, window.close() might not work.
      // But we hide the modal anyway.
      setShowExitModal(false);
    } catch (e) {
      setShowExitModal(false);
    }
  };

  return (
    <AnimatePresence>
      {showExitModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl"
          >
            <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">{t('exitApp')}</h3>
              <p className="text-slate-500 text-sm font-bold">{t('confirmExit')}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleExit}
                className="flex-1 py-4 bg-rose-600 text-white font-black rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors"
              >
                {t('exit')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
