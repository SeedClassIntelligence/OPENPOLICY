import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

export const REAUTH_REQUIRED_EVENT = 'openpolicy:reauth-required';

/** Attach the current Firebase ID token to Open Policy API requests. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const user = auth.currentUser;
  if (user) {
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  let response = await fetch(input, { ...init, headers });

  // Firebase refreshes near-expiry tokens automatically. A backend 401 can mean the
  // cached token expired or was revoked, so force one refresh and retry exactly once.
  if (response.status === 401 && user) {
    try {
      headers.set('Authorization', `Bearer ${await user.getIdToken(true)}`);
      response = await fetch(input, { ...init, headers });
    } catch {
      // The common controlled path below signs out and requests reauthentication.
    }

    if (response.status === 401) {
      await signOut(auth);
      window.dispatchEvent(new CustomEvent(REAUTH_REQUIRED_EVENT));
    }
  }

  return response;
}
