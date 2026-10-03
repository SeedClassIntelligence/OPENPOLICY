import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { syncUserProfile, FirestoreUserProfile } from '../services/userService';

export type UserRole = 'CONSUMER' | 'PROVIDER' | 'ADMIN';

export interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: FirestoreUserProfile | null;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  loading: boolean;
  isDemoUser: boolean;
  authModalOpen: boolean;
  authModalInitialRole: 'CONSUMER' | 'PROVIDER';
  authModalInitialMode: 'SIGN_IN' | 'SIGN_UP' | 'DEMO';
  openAuthModal: (options?: { initialRole?: 'CONSUMER' | 'PROVIDER'; initialMode?: 'SIGN_IN' | 'SIGN_UP' | 'DEMO' } | any) => void;
  closeAuthModal: () => void;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signUpAsConsumer: (name: string, email: string, pass: string, state?: string, currentCarrier?: string) => Promise<void>;
  signUpAsProvider: (name: string, agencyName: string, license: string, state: string, email: string, pass: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  useDemoAccount: (role?: 'CONSUMER' | 'PROVIDER', alias?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Canonical demo profiles
export const DEMO_CONSUMER_PROFILE: FirestoreUserProfile = {
  id: 'user_consumer_1',
  email: 'jane.doe@consumer-policy.org',
  displayName: 'Jane Doe',
  role: 'CONSUMER',
  createdAt: '2025-11-18T00:00:00.000Z'
};

export const DEMO_PROVIDER_PROFILE: FirestoreUserProfile = {
  id: 'user_sierra_1',
  email: 'alex@sierrabrokerage.com',
  displayName: 'Alex Morgan',
  role: 'PROVIDER',
  agencyName: 'Sierra Brokerage Group LLC',
  licenseNumber: 'NV-LIC-984210',
  state: 'NV',
  createdAt: '2026-01-15T08:00:00.000Z'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUserProfile | null>(null);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Modal state & initial config
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalInitialRole, setAuthModalInitialRole] = useState<'CONSUMER' | 'PROVIDER'>('CONSUMER');
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'SIGN_IN' | 'SIGN_UP' | 'DEMO'>('SIGN_UP');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsDemoUser(false);
        try {
          const profile = await syncUserProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          });
          setUserProfile({
            ...profile,
            role: profile.role || 'CONSUMER'
          });
        } catch (e) {
          console.warn('[Open Policy] Failed to sync user profile:', e);
          setUserProfile({
            id: user.uid,
            email: user.email || 'user@example.com',
            displayName: user.displayName || 'Policyholder',
            role: 'CONSUMER',
            createdAt: new Date().toISOString()
          });
        }
      } else {
        // Initial guest/visitor state: Not authenticated
        setCurrentUser(null);
        setIsDemoUser(false);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = (options?: { initialRole?: 'CONSUMER' | 'PROVIDER'; initialMode?: 'SIGN_IN' | 'SIGN_UP' | 'DEMO' } | any) => {
    if (options && typeof options === 'object' && ('initialRole' in options || 'initialMode' in options)) {
      if (options.initialRole) setAuthModalInitialRole(options.initialRole);
      if (options.initialMode) setAuthModalInitialMode(options.initialMode);
    }
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    return signUpAsConsumer(name, email, pass);
  };

  const signUpAsConsumer = async (
    name: string, 
    email: string, 
    pass: string, 
    state?: string, 
    currentCarrier?: string
  ) => {
    setLoading(true);
    try {
      let uid = `user_${Date.now()}`;
      try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        uid = res.user.uid;
      } catch (authErr: any) {
        // Fallback for local development or if offline
        console.warn('[Open Policy Auth] Firebase auth fallback to local session:', authErr?.message);
      }

      const profile: FirestoreUserProfile = {
        id: uid,
        email,
        displayName: name,
        role: 'CONSUMER',
        state: state || 'NV',
        createdAt: new Date().toISOString()
      };

      try {
        await syncUserProfile({ uid, email, displayName: name });
      } catch (e) {
        console.warn('[Open Policy] Firestore profile sync fallback:', e);
      }

      setUserProfile(profile);
      setIsDemoUser(false);
      setAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const signUpAsProvider = async (
    name: string,
    agencyName: string,
    license: string,
    state: string,
    email: string,
    pass: string
  ) => {
    setLoading(true);
    try {
      let uid = `provider_${Date.now()}`;
      try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        uid = res.user.uid;
      } catch (authErr: any) {
        console.warn('[Open Policy Auth] Provider auth fallback to local session:', authErr?.message);
      }

      const profile: FirestoreUserProfile = {
        id: uid,
        email,
        displayName: name,
        role: 'PROVIDER',
        agencyName,
        licenseNumber: license,
        state,
        createdAt: new Date().toISOString()
      };

      setUserProfile(profile);
      setIsDemoUser(false);
      setAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      let uid = `user_${Date.now()}`;
      let name = email.split('@')[0];
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);
        uid = res.user.uid;
        name = res.user.displayName || name;
      } catch (authErr: any) {
        console.warn('[Open Policy Auth] Firebase signIn fallback to local session:', authErr?.message);
      }

      const profile: FirestoreUserProfile = {
        id: uid,
        email,
        displayName: name,
        role: email.includes('broker') || email.includes('agency') || email.includes('provider') ? 'PROVIDER' : 'CONSUMER',
        createdAt: new Date().toISOString()
      };

      setUserProfile(profile);
      setIsDemoUser(false);
      setAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const profile = await syncUserProfile({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName
      });
      setUserProfile({
        ...profile,
        role: profile.role || 'CONSUMER'
      });
      setIsDemoUser(false);
      setAuthModalOpen(false);
    } catch (e: any) {
      console.warn('[Open Policy Auth] Google popup failed or closed:', e?.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('[Open Policy] SignOut error:', e);
    }
    setCurrentUser(null);
    setIsDemoUser(false);
    setUserProfile(null);
  };

  const useDemoAccount = (role: 'CONSUMER' | 'PROVIDER' = 'CONSUMER', alias?: string) => {
    setIsDemoUser(true);
    if (role === 'PROVIDER') {
      setUserProfile({
        ...DEMO_PROVIDER_PROFILE,
        displayName: alias || DEMO_PROVIDER_PROFILE.displayName
      });
    } else {
      setUserProfile({
        ...DEMO_CONSUMER_PROFILE,
        displayName: alias || DEMO_CONSUMER_PROFILE.displayName
      });
    }
    setAuthModalOpen(false);
  };

  const isAuthenticated = Boolean(currentUser || (isDemoUser && userProfile) || userProfile);
  const userRole = userProfile?.role || (isDemoUser ? 'CONSUMER' : null);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAuthenticated,
        userRole,
        loading,
        isDemoUser,
        authModalOpen,
        authModalInitialRole,
        authModalInitialMode,
        openAuthModal,
        closeAuthModal,
        signUpWithEmail,
        signUpAsConsumer,
        signUpAsProvider,
        signInWithEmail,
        signInWithGoogle,
        signOutUser,
        useDemoAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
