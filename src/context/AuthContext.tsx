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
import { createUserProfile, loadUserProfile, FirestoreUserProfile } from '../services/userService';

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
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<UserRole>;
  signUpAsConsumer: (name: string, email: string, pass: string, state?: string, currentCarrier?: string) => Promise<UserRole>;
  signUpAsProvider: (name: string, agencyName: string, license: string, state: string, email: string, pass: string) => Promise<UserRole>;
  signInWithEmail: (email: string, pass: string) => Promise<UserRole>;
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
          const profile = await loadUserProfile(user.uid);
          if (!profile?.role) throw new Error('This account has no Open Policy role profile.');
          setUserProfile(profile);
        } catch (e) {
          console.warn('[Open Policy] Failed to sync user profile:', e);
          setUserProfile(null);
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
  ): Promise<UserRole> => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
      const uid = res.user.uid;

      const profile: FirestoreUserProfile = {
        id: uid,
        email,
        displayName: name,
        role: 'CONSUMER',
        state: state || 'NV',
        currentCarrier: currentCarrier?.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      await createUserProfile(profile);

      setUserProfile(profile);
      setIsDemoUser(false);
      setAuthModalOpen(false);
      return 'CONSUMER';
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
  ): Promise<UserRole> => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
      const uid = res.user.uid;

      const profile: FirestoreUserProfile = {
        id: uid,
        email,
        displayName: name,
        role: 'PROVIDER',
        agencyName,
        licenseNumber: license,
        state,
        providerStatus: 'PENDING_VERIFICATION',
        createdAt: new Date().toISOString()
      };

      await createUserProfile(profile);
      setUserProfile(profile);
      setIsDemoUser(false);
      setAuthModalOpen(false);
      return 'PROVIDER';
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<UserRole> => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await loadUserProfile(res.user.uid);
      if (!profile?.role) {
        await signOut(auth);
        throw new Error('This account has no Open Policy role profile. Complete onboarding or contact support.');
      }

      setUserProfile(profile);
      setIsDemoUser(false);
      setAuthModalOpen(false);
      return profile.role;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const profile = await loadUserProfile(res.user.uid);
      if (!profile?.role) {
        await signOut(auth);
        throw new Error('Choose Consumer or Provider onboarding before using Google sign-in.');
      }
      setUserProfile(profile);
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
