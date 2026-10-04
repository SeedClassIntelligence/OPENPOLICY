import { auth } from '../firebase/config';

/** Attach the current Firebase ID token to Open Policy API requests. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const user = auth.currentUser;
  if (user) {
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  return fetch(input, { ...init, headers });
}
