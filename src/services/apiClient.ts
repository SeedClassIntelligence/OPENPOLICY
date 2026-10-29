import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { isCandidatePreview } from '../demo/candidatePreview';
import { candidatePreviewFetch } from '../demo/candidatePreviewApi';

export const REAUTH_REQUIRED_EVENT = 'openpolicy:reauth-required';

export interface AuthenticatedFetchUser {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export interface AuthenticatedFetchDependencies {
  user: AuthenticatedFetchUser | null;
  fetchImpl: typeof fetch;
  signOutUser: () => Promise<void>;
  requireReauthentication: () => void;
}

async function endRejectedSession(dependencies: AuthenticatedFetchDependencies): Promise<void> {
  try {
    await dependencies.signOutUser();
  } finally {
    dependencies.requireReauthentication();
  }
}

/** The injectable session boundary used by apiFetch and its acceptance tests. */
export async function executeAuthenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  dependencies: AuthenticatedFetchDependencies
): Promise<Response> {
  const headers = new Headers(init.headers);
  const { user } = dependencies;
  if (user) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  if (runtimeEnv?.DEV === true && runtimeEnv.VITE_ENABLE_DEMO_IDENTITIES === 'true' && typeof window !== 'undefined') {
    const fixtureRole = window.sessionStorage.getItem('openpolici-fixture-role');
    if (fixtureRole) headers.set('x-openpolicy-fixture-role', fixtureRole);
  }

  let response = await dependencies.fetchImpl(input, { ...init, headers });
  if (response.status !== 401 || !user) return response;

  try {
    headers.set('Authorization', `Bearer ${await user.getIdToken(true)}`);
    response = await dependencies.fetchImpl(input, { ...init, headers });
  } catch {
    await endRejectedSession(dependencies);
    return response;
  }

  if (response.status === 401 || response.status === 403) {
    await endRejectedSession(dependencies);
  }
  return response;
}

/** Attach the current Firebase ID token to Open Policy API requests. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (isCandidatePreview()) return candidatePreviewFetch(input, init);
  return executeAuthenticatedFetch(input, init, {
    user: auth.currentUser,
    // Window.fetch requires its Window receiver in Chromium. Passing the bare method
    // through the injectable boundary causes an Illegal invocation in production.
    fetchImpl: window.fetch.bind(window),
    signOutUser: () => signOut(auth),
    requireReauthentication: () => window.dispatchEvent(new CustomEvent(REAUTH_REQUIRED_EVENT))
  });
}
