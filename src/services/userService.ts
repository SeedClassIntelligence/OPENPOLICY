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

/**
 * Creates or retrieves a user profile in Firestore
 */
export async function syncUserProfile(user: { uid: string; email: string | null; displayName: string | null }): Promise<FirestoreUserProfile> {
  const userRef = doc(firestore, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as FirestoreUserProfile;
  }

  const newProfile: FirestoreUserProfile = {
    id: user.uid,
    email: user.email || 'consumer@example.com',
    displayName: user.displayName || user.email?.split('@')[0] || 'Policyholder',
    createdAt: new Date().toISOString()
  };

  await setDoc(userRef, newProfile);

  // Auto-seed initial canonical challenge for this user's personal account
  await seedInitialUserChallenge(user.uid, newProfile.displayName);

  return newProfile;
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

// Canonical Demo Records for unauthenticated / demo state
const DEMO_CHALLENGES: UserChallengeRecord[] = [
  {
    id: 'CHAL-NV-49281',
    userId: 'user_consumer_1',
    referenceNumber: 'CHALLENGE #NV-49281',
    jurisdiction: 'NV',
    insuranceType: 'AUTO',
    status: 'OFFERS_RECEIVED',
    baselineMonthlyPremium: 247,
    baselineAnnualPremium: 2964,
    carrier: 'GEICO Advantage',
    vehicleOrProperty: '2024 Toyota Camry XLE',
    createdAt: '2025-11-18T10:00:00Z',
    offersCount: 3,
    bestSavings: 474
  }
];

const DEMO_ORDERS: UserOrderRecord[] = [
  {
    id: 'ORD-BINDER-NV-001',
    userId: 'user_consumer_1',
    challengeId: 'CHAL-NV-49281',
    challengeRef: 'CHALLENGE #NV-49281',
    carrier: 'Safeco Insurance (Liberty Mutual)',
    policyTier: 'Baseline Plus (Identical Limits, Lower Deductibles)',
    monthlyPremium: 207,
    annualSavings: 474,
    boundAt: '2026-01-20T14:22:00Z',
    binderStatus: 'ACTIVE',
    section32DossierRef: 'DOSSIER-NV-49281-SAFECO',
    policyNumber: 'NV-AUTO-SAF-994821'
  }
];

const DEMO_VAULT: UserVaultRecord[] = [
  {
    id: 'VLT-DOC-1',
    userId: 'user_consumer_1',
    challengeId: 'CHAL-NV-49281',
    name: '2025_Geico_Policy_Declarations.pdf',
    documentType: 'DECLARATIONS_PAGE',
    uploadedAt: '2025-11-18T09:45:00Z',
    size: '1.2 MB',
    notes: 'Extracted baseline document for NV-49281'
  },
  {
    id: 'VLT-DOC-2',
    userId: 'user_consumer_1',
    challengeId: 'CHAL-NV-49281',
    name: 'Safeco_Binding_Confirmation_Binder.pdf',
    documentType: 'BINDER',
    uploadedAt: '2026-01-20T14:25:00Z',
    size: '840 KB',
    notes: 'Official 30-day binder issued by Sierra Brokerage Group'
  }
];

/**
 * Fetch all challenges belonging to a specific authenticated user
 */
export async function fetchUserChallenges(userId: string): Promise<UserChallengeRecord[]> {
  // If not authenticated or in demo profile, return demo records to avoid Firestore permission rejection
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return DEMO_CHALLENGES;
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
    console.error('Error fetching user challenges:', e);
    return DEMO_CHALLENGES;
  }
}

/**
 * Fetch all bound insurance orders/binders belonging to a user
 */
export async function fetchUserOrders(userId: string): Promise<UserOrderRecord[]> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return DEMO_ORDERS;
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
    console.error('Error fetching user orders:', e);
    return DEMO_ORDERS;
  }
}

/**
 * Fetch vault documents for a user
 */
export async function fetchUserVault(userId: string): Promise<UserVaultRecord[]> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return DEMO_VAULT;
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
    console.error('Error fetching user vault:', e);
    return DEMO_VAULT;
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
