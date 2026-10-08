import type { NextFunction, Request, Response } from 'express';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export type AuthMode = 'firebase' | 'fixture';
export type IdentityRole = 'CONSUMER' | 'PROVIDER' | 'ADMIN';

export interface RequestIdentity {
  uid: string;
  role: IdentityRole;
  email?: string;
  providerUserId?: string;
  providerOrganizationId?: string;
  providerStatus?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'REJECTED';
  source: 'FIREBASE' | 'FIXTURE';
}

declare global {
  namespace Express {
    interface Request {
      openPolicyIdentity?: RequestIdentity;
    }
  }
}

export function configuredAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const configured = (env.OPENPOLICY_AUTH_MODE || 'firebase').toLowerCase();
  if (configured !== 'firebase' && configured !== 'fixture') {
    throw new Error(`Invalid OPENPOLICY_AUTH_MODE '${configured}'. Expected firebase or fixture.`);
  }
  if (configured === 'fixture' && env.NODE_ENV === 'production') {
    throw new Error('OPENPOLICY_AUTH_MODE=fixture is forbidden when NODE_ENV=production.');
  }
  return configured;
}

export function assertProductionAuthConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  if (configuredAuthMode(env) !== 'firebase') {
    throw new Error('Production authentication must use OPENPOLICY_AUTH_MODE=firebase.');
  }
  if (!env.FIREBASE_PROJECT_ID?.trim()) {
    throw new Error('FIREBASE_PROJECT_ID is required in production.');
  }

  const hasServiceAccount = Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
  const hasCredentialFile = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
  const hasDeclaredAdc = env.OPENPOLICY_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true';
  if (!hasServiceAccount && !hasCredentialFile && !hasDeclaredAdc) {
    throw new Error(
      'Firebase Admin credentials are required in production via FIREBASE_SERVICE_ACCOUNT_JSON, ' +
      'GOOGLE_APPLICATION_CREDENTIALS, or explicit OPENPOLICY_USE_APPLICATION_DEFAULT_CREDENTIALS=true.'
    );
  }

  if (hasServiceAccount) {
    try {
      JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON!);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }
}

export function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function firebaseAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (encoded) {
    let serviceAccount: Record<string, unknown>;
    try {
      serviceAccount = JSON.parse(encoded);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    return initializeApp({ credential: cert(serviceAccount as any) });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

export async function resolveFirebaseIdentity(token: string): Promise<RequestIdentity> {
  const adminApp = firebaseAdminApp();
  const decoded = await getAuth(adminApp).verifyIdToken(token, true);
  const profileSnapshot = await getFirestore(adminApp).collection('users').doc(decoded.uid).get();
  if (!profileSnapshot.exists) {
    throw Object.assign(new Error('Authenticated Firebase account has no Open Policy profile.'), { statusCode: 403 });
  }

  const profile = profileSnapshot.data() || {};
  const role = profile.role as IdentityRole | undefined;
  if (!role || !['CONSUMER', 'PROVIDER', 'ADMIN'].includes(role)) {
    throw Object.assign(new Error('Open Policy profile has no valid account role.'), { statusCode: 403 });
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    role,
    providerUserId: profile.providerUserId,
    providerOrganizationId: profile.providerOrganizationId,
    providerStatus: profile.providerStatus,
    source: 'FIREBASE'
  };
}

function resolveFixtureIdentity(req: Request): RequestIdentity {
  const fixtureRole = String(req.headers['x-openpolicy-fixture-role'] || '').toUpperCase();
  if (fixtureRole === 'ADMIN') {
    return { uid: 'fixture_admin', role: 'ADMIN', source: 'FIXTURE' };
  }
  const providerUserId = String(req.headers['x-provider-user-id'] || req.body?.providerUserId || '').trim();
  if (providerUserId) {
    return { uid: providerUserId, providerUserId, role: 'PROVIDER', providerStatus: 'ACTIVE', source: 'FIXTURE' };
  }

  const consumerId = String(
    req.headers['x-consumer-id'] || req.body?.consumerId || req.query.consumerId || 'user_consumer_1'
  ).trim();
  return { uid: consumerId, role: 'CONSUMER', source: 'FIXTURE' };
}

export type FirebaseIdentityResolver = (token: string) => Promise<RequestIdentity>;

/** Factory exists so the security boundary can be tested without real credentials. */
export function createRequestIdentityMiddleware(
  resolveIdentity: FirebaseIdentityResolver = resolveFirebaseIdentity,
  env: NodeJS.ProcessEnv = process.env
) {
  return async function requestIdentityMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (configuredAuthMode(env) === 'fixture') {
      req.openPolicyIdentity = resolveFixtureIdentity(req);
      next();
      return;
    }

    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      next();
      return;
    }
    req.openPolicyIdentity = await resolveIdentity(token);
    next();
  } catch (error: any) {
    const status = error?.statusCode || 401;
    res.status(status).json({
      error: status === 401 ? 'Unauthorized' : 'Forbidden',
      message: status === 401 ? 'Identity verification failed' : (error?.message || 'Identity is not authorized')
    });
  }
  };
}

export const attachRequestIdentity = createRequestIdentityMiddleware();
