import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  Receipt, 
  LogOut, 
  Menu, 
  X, 
  Wallet, 
  Landmark, 
  FileText, 
  UserCog, 
  User,
  PieChart,
  ChevronRight,
  ChevronDown,
  Shield,
  ArrowLeft,
  Calculator,
  Store
} from 'lucide-react';
import { cn, getDirectDriveUrl } from './lib/utils';
import { useAuth } from './AuthContext';
import { useApp } from './App';
import { motion, AnimatePresence } from 'motion/react';
import myLogo from '@/src/assets/logo.png';

export const Layout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountSubMenuOpen, setIsAccountSubMenuOpen] = useState(false);
  const { user, role, logout, appSettings } = useAuth();
  const { t } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // ব্যাক বাটন হ্যান্ডলার যুক্ত করা হয়েছে
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isMenuOpen) {
        // যদি মেনু খোলা থাকে, তবে মেনু বন্ধ করবে এবং পেজ পেছনে যাওয়া আটকাবে
        e.preventDefault();
        setIsMenuOpen(false);
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMenuOpen]);

  // ড্যাশবোর্ডে থাকা অবস্থায় ব্যাক বাটন লজিক
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      window.history.pushState(null, "", window.location.href);
    }
  }, [location.pathname]);

  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard'), path: '/', roles: ['director', 'admin', 'super_admin'] },
    { icon: PieChart, label: t('reports'), path: '/reports', roles: ['director', 'admin', 'super_admin'] },
    { icon: Receipt, label: t('transactions'), path: '/transactions', roles: ['admin', 'super_admin'] },
    { icon: FileText, label: t('dailyReport'), path: '/daily-report', roles: ['director', 'admin', 'super_admin'] },
    { icon: Users, label: t('employee'), path: '/employees', roles: ['director', 'admin', 'super_admin'] },
    { icon: Shield, label: t('userManagement'), path: '/users', roles: ['super_admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(role as any)
  );

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200 z-50">
        <div className="p-6 border-b border-slate-100 bg-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <img src={myLogo} alt="Logo" className="w-10 h-10 rounded-xl object-cover bg-white/20 shadow-sm" />
            <div>
              <h2 className="font-bold text-white leading-tight">{appSettings?.appName || 'T S Marketing'}</h2>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive ? "bg-emerald-50 text-emerald-600 font-semibold" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500")} />
                <span>{item.label}</span>
              </button>
            );
          })}
          
          <button
            onClick={() => navigate('/profile')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              location.pathname === '/profile' ? "bg-emerald-50 text-emerald-600 font-semibold" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <UserCircle className={cn("w-5 h-5 transition-colors", location.pathname === '/profile' ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500")} />
            <span>{t('profile')}</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-colors">
            <LogOut className="w-5 h-5" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 pt-[env(safe-area-inset-top)] z-50">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isDashboard ? (
              <button
                onClick={() => {
                  navigate(-1);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-slate-600" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <img src={myLogo} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
              <h1 className="font-bold text-lg text-emerald-800">
                {appSettings?.appName || 'T S Marketing'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-600"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:flex fixed top-0 right-0 left-64 lg:left-72 bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 items-center px-8 justify-between z-40">
        <div className="flex items-center gap-4">
          {!isDashboard && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          )}
          <h2 className="font-bold text-slate-800 text-xl">
            {filteredMenuItems.find(i => i.path === location.pathname)?.label || t('profile')}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800">{user?.displayName || user?.email}</p>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold border-2 border-white shadow-sm">
            {(user?.displayName || user?.email || '?')[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative pt-[calc(env(safe-area-inset-top)+64px)] pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0 md:pt-16">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)] z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {filteredMenuItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1 transition-colors",
                  isActive ? "text-emerald-600" : "text-slate-500 hover:text-emerald-500"
                )}
              >
                <Icon className={cn("w-5 h-5 mb-1", isActive && "animate-in fade-in zoom-in duration-300")} />
                <span className="text-[10px] font-bold truncate w-full text-center px-1">
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => navigate('/profile')}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1 transition-colors",
              location.pathname === '/profile' ? "text-emerald-600" : "text-slate-500 hover:text-emerald-500"
            )}
          >
            <UserCircle className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold">{t('profile')}</span>
          </button>
        </div>
      </nav>

      {/* Side Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 bg-emerald-600 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={myLogo} alt="Logo" className="w-10 h-10 rounded-xl object-cover bg-white/20 shadow-sm" />
                    <div>
                      <h2 className="font-bold text-white leading-tight">{appSettings?.appName || 'T S Marketing'}</h2>
                    </div>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                <div className="px-4 space-y-1">
                  {filteredMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                          isActive ? "bg-emerald-50 text-emerald-600 font-semibold" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "text-slate-400")} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-colors">
                  <LogOut className="w-5 h-5" />
                  <span>{t('logout')}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};