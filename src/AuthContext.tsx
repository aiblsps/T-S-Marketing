import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, onAuthStateChanged } from './firebase';
import { signOut } from 'firebase/auth';

interface AuthContextType {
  user: any | null;
  role: 'super_admin' | 'admin' | 'director' | null;
  directorId: string | null;
  outletId: string | null;
  userId: string | null;
  customUserId: string | null;
  loading: boolean;
  logout: () => void;
  appSettings: {
    loadingLogoUrl: string;
    loadingTitle: string;
    loadingSubtitle: string;
    appName?: string;
    logoText?: string;
    logoUrl?: string;
    companyName?: string;
    companyAddress?: string;
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  directorId: null,
  outletId: null,
  userId: null,
  customUserId: null,
  loading: false,
  logout: () => {},
  appSettings: {
    loadingLogoUrl: '',
    loadingTitle: 'T S Marketing',
    loadingSubtitle: 'Halal income, for a better future',
    appName: 'T S Marketing',
    logoText: 'T S Marketing'
  }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<'super_admin' | 'admin' | 'director' | null>(null);
  const [directorId, setDirectorId] = useState<string | null>(null);
  const [outletId, setOutletId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [customUserId, setCustomUserId] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState({
    loadingLogoUrl: '',
    loadingTitle: 'T S Marketing',
    loadingSubtitle: 'Halal income, for a better future'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    // CRITICAL: Force loading to false after 3 seconds no matter what
    // This prevents the infinite "spinning" if Firebase hangs
    const forceLoadTimeout = setTimeout(() => {
      if (loading) {
        console.warn("AuthContext: Forcing loading to false after timeout");
        setLoading(false);
      }
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(forceLoadTimeout);
      console.log("AuthContext: Auth state changed", firebaseUser?.email);
      
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        // Set basic user info immediately to allow entry
        setUser(firebaseUser);
        
        // Set default role for special admins to prevent empty dashboard
        const specialAdmins = ["aspsbazar@gmail.com", "cmrabbicarromking@gmail.com", "shanubegumts@gmail.com", "balkoy72@gmail.com", "mohammadrabbi617@gmail.com"];
        const isSpecialAdmin = firebaseUser.email && specialAdmins.includes(firebaseUser.email.toLowerCase());
        
        if (isSpecialAdmin) {
          setRole('super_admin');
        }

        setLoading(false); // Set loading false immediately when user is found
        
        // Background profile loading
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUser((prev: any) => ({ ...prev, ...userData }));
            
            let userRole: any = userData.role;
            if (isSpecialAdmin) {
              userRole = 'super_admin';
            }
            setRole(userRole);
            setDirectorId(userData.directorId || null);
            setOutletId(userData.directorId || null);
            setUserId(userData.userId || null);
            setCustomUserId(userData.customUserId || null);
          } else {
            // If no profile, still allow entry as basic user or auto-create for admins
            if (isSpecialAdmin) {
              setRole('super_admin');
              // Auto-create profile in background
              setDoc(userRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                role: 'super_admin',
                displayName: firebaseUser.displayName || 'Super Admin',
                createdAt: new Date().toISOString()
              }).catch(console.error);
            }
          }
        }, (error) => {
          console.error("AuthContext: Firestore error:", error);
          // If Firestore fails, we still have the user and potentially the role from the special list
        });
      } else {
        setUser(null);
        setRole(null);
        setDirectorId(null);
        setOutletId(null);
        setUserId(null);
        setCustomUserId(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsubConfig = onSnapshot(doc(db, 'app_settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppSettings(prev => ({
          ...prev,
          companyName: data.companyName,
          companyAddress: data.companyAddress
        }));
      }
    }, (error) => {
      console.error("App settings config error:", error);
    });

    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'loading_screen'), (docSnap) => {
      if (docSnap.exists()) {
        setAppSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
    }, (error) => {
      console.warn("App settings snapshot error (likely permissions):", error);
    });
    return () => { unsubConfig(); unsubSettings(); };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, directorId, outletId, userId, customUserId, loading, logout, appSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);