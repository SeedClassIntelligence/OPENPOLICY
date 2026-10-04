import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { firestore, auth } from '../firebase/config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreUserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  role?: 'CONSUMER' | 'PROVIDER' | 'ADMIN';
  agencyName?: string;
  licenseNumber?: string;
  state?: string;
  currentCarrier?: string;
  providerStatus?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'REJECTED';
}

export interface UserChallengeRecord {
  id: string;
  userId: string;
  referenceNumber: string;
  jurisdiction: string;
  insuranceType: 'AUTO' | 'HOME' | 'COMMERCIAL';
  status: 'OPEN' | 'EVALUATING' | 'OFFERS_RECEIVED' | 'BOUND' | 'ARCHIVED';
  baselineMonthlyPremium: number;
  baselineAnnualPremium: number;
  carrier: string;
  vehicleOrProperty: string;
  createdAt: string;
  offersCount: number;
  bestSavings: number;
}

export interface UserOrderRecord {
  id: string;
  userId: string;
  challengeId: string;
  challengeRef: string;
  carrier: string;
  policyTier: string;
  monthlyPremium: number;
  annualSavings: number;
  boundAt: string;
  binderStatus: 'ACTIVE' | 'PENDING_CARRIER_ISSUE' | 'RENEWAL_WINDOW';
  section32DossierRef: string;
  policyNumber: string;
}

export interface UserVaultRecord {
  id: string;
  userId: string;
  challengeId?: string;
  name: string;
  documentType: 'DECLARATIONS_PAGE' | 'ENDORSEMENT' | 'BINDER' | 'ID_CARD' | 'RENEWAL_NOTICE';
  uploadedAt: string;
  size: string;
  notes?: string;
}

export async function loadUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
  const snap = await getDoc(doc(firestore, 'users', userId));
  return snap.exists() ? (snap.data() as FirestoreUserProfile) : null;
}

export async function createUserProfile(profile: FirestoreUserProfile): Promise<FirestoreUserProfile> {
  const userRef = doc(firestore, 'users', profile.id);
  const existing = await getDoc(userRef);
  if (existing.exists()) return existing.data() as FirestoreUserProfile;
  await setDoc(userRef, profile);
  return profile;
}

export async function syncUserProfile(user: { uid: string; email: string | null; displayName: string | null }): Promise<FirestoreUserProfile> {
  const userRef = doc(firestore, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as FirestoreUserProfile;
  }

  throw new Error('This account has no Open Policy role profile. Complete the correct consumer or provider onboarding process.');
}

/**
 * Seeds a realistic initial challenge and bound policy so a newly registered consumer
 * has real interactive data immediately available in their account dashboard
 */
export async function seedInitialUserChallenge(userId: string, userName: string) {
  try {
    const challengeId = `CHAL-${Date.now()}`;
    const initialChallenge: UserChallengeRecord = {
      id: challengeId,
      userId,
      referenceNumber: `CHALLENGE #NV-${Math.floor(10000 + Math.random() * 90000)}`,
      jurisdiction: 'NV',
      insuranceType: 'AUTO',
      status: 'OFFERS_RECEIVED',
      baselineMonthlyPremium: 247,
      baselineAnnualPremium: 2964,
      carrier: 'Liberty Mutual Preferred',
      vehicleOrProperty: '2023 Tesla Model Y Long Range',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      offersCount: 3,
      bestSavings: 624
    };

    await setDoc(doc(firestore, 'challenges', challengeId), initialChallenge);

    // Initial bound policy / order example
    const orderId = `ORDER-${Date.now()}`;
    const initialOrder: UserOrderRecord = {
      id: orderId,
      userId,
      challengeId,
      challengeRef: initialChallenge.referenceNumber,
      carrier: 'Nevada Mutual Exchange',
      policyTier: 'PARITY_MATCH',
      monthlyPremium: 195,
      annualSavings: 624,
      boundAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      binderStatus: 'ACTIVE',
      section32DossierRef: 'sha256-8f3a9e...canonical-consent',
      policyNumber: 'NV-POL-882914-A'
    };

    await setDoc(doc(firestore, 'orders', orderId), initialOrder);

    // Initial vault document
    const docId = `DOC-${Date.now()}`;
    const initialDoc: UserVaultRecord = {
      id: docId,
      userId,
      challengeId,
      name: 'Tesla_Declarations_Page_2025.pdf',
      documentType: 'DECLARATIONS_PAGE',
      uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      size: '1.4 MB',
      notes: 'Active policy declarations uploaded for challenge baseline.'
    };

    await setDoc(doc(firestore, 'vault', docId), initialDoc);
  } catch (err) {
    console.warn('[Open Policy] Failed to auto-seed initial challenge for user:', err);
  }
}

/**
 * Fetch all challenges belonging to a specific authenticated user
 */
export async function fetchUserChallenges(userId: string): Promise<UserChallengeRecord[]> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Authenticated consumer identity does not match the requested challenge owner.');
  }

  try {
    const q = query(
      collection(firestore, 'challenges'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserChallengeRecord);
  } catch (e: any) {
    if (e?.code === 'permission-denied') {
      handleFirestoreError(e, OperationType.LIST, 'challenges');
    }
    throw e;
  }
}

/**
 * Fetch all bound insurance orders/binders belonging to a user
 */
export async function fetchUserOrders(userId: string): Promise<UserOrderRecord[]> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Authenticated consumer identity does not match the requested order owner.');
  }

  try {
    const q = query(
      collection(firestore, 'orders'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserOrderRecord);
  } catch (e: any) {
    if (e?.code === 'permission-denied') {
      handleFirestoreError(e, OperationType.LIST, 'orders');
    }
    throw e;
  }
}

/**
 * Fetch vault documents for a user
 */
export async function fetchUserVault(userId: string): Promise<UserVaultRecord[]> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Authenticated consumer identity does not match the requested vault owner.');
  }

  try {
    const q = query(
      collection(firestore, 'vault'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserVaultRecord);
  } catch (e: any) {
    if (e?.code === 'permission-denied') {
      handleFirestoreError(e, OperationType.LIST, 'vault');
    }
    throw e;
  }
}

/**
 * Create a new user challenge
 */
export async function createUserChallenge(
  userId: string, 
  data: Omit<UserChallengeRecord, 'id' | 'userId' | 'createdAt'>
): Promise<UserChallengeRecord> {
  const challengeId = `CHAL-${Date.now()}`;
  const record: UserChallengeRecord = {
    ...data,
    id: challengeId,
    userId,
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(firestore, 'challenges', challengeId), record);
  return record;
}

/**
 * Record a bound policy order when consumer accepts an offer
 */
export async function createUserOrder(
  userId: string,
  orderData: Omit<UserOrderRecord, 'id' | 'userId' | 'boundAt'>
): Promise<UserOrderRecord> {
  const orderId = `ORDER-${Date.now()}`;
  const record: UserOrderRecord = {
    ...orderData,
    id: orderId,
    userId,
    boundAt: new Date().toISOString()
  };

  await setDoc(doc(firestore, 'orders', orderId), record);
  return record;
}
