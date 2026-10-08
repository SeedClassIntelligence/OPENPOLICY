import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAuthenticatedFetch } from './apiClient';

const response = (status: number) => new Response(null, { status });

test('a normal token is attached without a refresh', async () => {
  const tokenCalls: Array<boolean | undefined> = [];
  const requests: string[] = [];
  const result = await executeAuthenticatedFetch('/api/health', {}, {
    user: { async getIdToken(force) { tokenCalls.push(force); return 'normal-token'; } },
    fetchImpl: async (_input, init) => { requests.push(new Headers(init?.headers).get('Authorization') || ''); return response(200); },
    signOutUser: async () => assert.fail('must not sign out'),
    requireReauthentication: () => assert.fail('must not reauthenticate')
  });
  assert.equal(result.status, 200);
  assert.deepEqual(tokenCalls, [undefined]);
  assert.deepEqual(requests, ['Bearer normal-token']);
});

test('401 forces exactly one refresh and retries successfully', async () => {
  let requestCount = 0;
  const tokenCalls: Array<boolean | undefined> = [];
  const result = await executeAuthenticatedFetch('/api/challenges', {}, {
    user: { async getIdToken(force) { tokenCalls.push(force); return force ? 'refreshed-token' : 'expired-token'; } },
    fetchImpl: async (_input, init) => {
      requestCount += 1;
      const token = new Headers(init?.headers).get('Authorization');
      return response(token === 'Bearer refreshed-token' ? 200 : 401);
    },
    signOutUser: async () => assert.fail('must not sign out'),
    requireReauthentication: () => assert.fail('must not reauthenticate')
  });
  assert.equal(result.status, 200);
  assert.equal(requestCount, 2);
  assert.deepEqual(tokenCalls, [undefined, true]);
});

test('a rejected refreshed token signs out and never retries more than once', async () => {
  let requestCount = 0;
  let signOutCount = 0;
  let reauthCount = 0;
  const result = await executeAuthenticatedFetch('/api/challenges', {}, {
    user: { async getIdToken() { return 'revoked-token'; } },
    fetchImpl: async () => { requestCount += 1; return response(401); },
    signOutUser: async () => { signOutCount += 1; },
    requireReauthentication: () => { reauthCount += 1; }
  });
  assert.equal(result.status, 401);
  assert.equal(requestCount, 2);
  assert.equal(signOutCount, 1);
  assert.equal(reauthCount, 1);
});

test('failed token refresh signs out and requests reauthentication', async () => {
  let tokenCalls = 0;
  let requestCount = 0;
  let signedOut = false;
  let reauth = false;
  const result = await executeAuthenticatedFetch('/api/challenges', {}, {
    user: { async getIdToken(force) { tokenCalls += 1; if (force) throw new Error('refresh rejected'); return 'expired'; } },
    fetchImpl: async () => { requestCount += 1; return response(401); },
    signOutUser: async () => { signedOut = true; },
    requireReauthentication: () => { reauth = true; }
  });
  assert.equal(result.status, 401);
  assert.equal(tokenCalls, 2);
  assert.equal(requestCount, 1);
  assert.equal(signedOut, true);
  assert.equal(reauth, true);
});

test('reauthentication event is still emitted when Firebase sign-out fails', async () => {
  let reauth = false;
  await assert.rejects(() => executeAuthenticatedFetch('/api/challenges', {}, {
    user: { async getIdToken() { return 'revoked'; } },
    fetchImpl: async () => response(401),
    signOutUser: async () => { throw new Error('sign-out transport failed'); },
    requireReauthentication: () => { reauth = true; }
  }), /sign-out transport failed/);
  assert.equal(reauth, true);
});

test('unknown profile forbidden response follows controlled reauthentication after refresh', async () => {
  let requestCount = 0;
  let signedOut = false;
  const result = await executeAuthenticatedFetch('/api/challenges', {}, {
    user: { async getIdToken(force) { return force ? 'fresh-but-unmapped' : 'stale'; } },
    fetchImpl: async () => { requestCount += 1; return response(requestCount === 1 ? 401 : 403); },
    signOutUser: async () => { signedOut = true; },
    requireReauthentication: () => undefined
  });
  assert.equal(result.status, 403);
  assert.equal(requestCount, 2);
  assert.equal(signedOut, true);
});
