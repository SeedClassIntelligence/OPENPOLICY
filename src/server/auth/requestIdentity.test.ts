import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { assertProductionAuthConfiguration, configuredAuthMode, createRequestIdentityMiddleware, parseBearerToken } from './requestIdentity';

test('Firebase verification is the default authentication mode', () => {
  assert.equal(configuredAuthMode({} as NodeJS.ProcessEnv), 'firebase');
});

test('fixture identity is explicitly selected and forbidden in production', () => {
  assert.equal(configuredAuthMode({ OPENPOLICY_AUTH_MODE: 'fixture' } as NodeJS.ProcessEnv), 'fixture');
  assert.throws(
    () => configuredAuthMode({ OPENPOLICY_AUTH_MODE: 'fixture', NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    /forbidden/
  );
});

test('production Firebase configuration fails closed without project and credential configuration', () => {
  assert.throws(() => assertProductionAuthConfiguration({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), /FIREBASE_PROJECT_ID/);
  assert.throws(() => assertProductionAuthConfiguration({
    NODE_ENV: 'production', OPENPOLICY_AUTH_MODE: 'firebase', FIREBASE_PROJECT_ID: 'open-policy'
  } as NodeJS.ProcessEnv), /credentials are required/);
  assert.doesNotThrow(() => assertProductionAuthConfiguration({
    NODE_ENV: 'production', OPENPOLICY_AUTH_MODE: 'firebase', FIREBASE_PROJECT_ID: 'open-policy',
    OPENPOLICY_USE_APPLICATION_DEFAULT_CREDENTIALS: 'true'
  } as NodeJS.ProcessEnv));
  assert.throws(() => assertProductionAuthConfiguration({
    NODE_ENV: 'production', OPENPOLICY_AUTH_MODE: 'firebase', FIREBASE_PROJECT_ID: 'open-policy',
    FIREBASE_SERVICE_ACCOUNT_JSON: '{not-json}'
  } as NodeJS.ProcessEnv), /not valid JSON/);
});

test('bearer tokens must use the Authorization Bearer scheme', () => {
  assert.equal(parseBearerToken('Bearer verified-token'), 'verified-token');
  assert.equal(parseBearerToken('bearer verified-token'), 'verified-token');
  assert.equal(parseBearerToken('verified-token'), null);
  assert.equal(parseBearerToken(undefined), null);
});

function responseRecorder() {
  const record: { status?: number; body?: any } = {};
  const response = {
    status(code: number) { record.status = code; return response; },
    json(body: any) { record.body = body; return response; }
  } as unknown as Response;
  return { record, response };
}

test('Firebase mode ignores spoofed legacy identity headers without a bearer token', async () => {
  const request = { headers: { 'x-provider-user-id': 'user_sierra_1' }, body: {}, query: {} } as unknown as Request;
  const { response } = responseRecorder();
  let nextCalled = false;
  await createRequestIdentityMiddleware(async () => { throw new Error('must not run'); }, {} as NodeJS.ProcessEnv)(
    request, response, () => { nextCalled = true; }
  );
  assert.equal(nextCalled, true);
  assert.equal(request.openPolicyIdentity, undefined);
});

test('malformed, expired, and revoked tokens fail closed without leaking verifier details', async () => {
  for (const code of ['auth/argument-error', 'auth/id-token-expired', 'auth/id-token-revoked']) {
    const request = { headers: { authorization: 'Bearer hostile-token' }, body: {}, query: {} } as unknown as Request;
    const { record, response } = responseRecorder();
    let nextCalled = false;
    await createRequestIdentityMiddleware(async () => {
      throw Object.assign(new Error(`sensitive verifier detail: ${code}`), { code });
    }, {} as NodeJS.ProcessEnv)(request, response, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(record.status, 401);
    assert.deepEqual(record.body, { error: 'Unauthorized', message: 'Identity verification failed' });
  }
});

test('unknown Firebase profile fails closed as forbidden', async () => {
  const request = { headers: { authorization: 'Bearer valid-token' }, body: {}, query: {} } as unknown as Request;
  const { record, response } = responseRecorder();
  await createRequestIdentityMiddleware(async () => {
    throw Object.assign(new Error('Authenticated Firebase account has no Open Policy profile.'), { statusCode: 403 });
  }, {} as NodeJS.ProcessEnv)(request, response, () => assert.fail('must not continue'));
  assert.equal(record.status, 403);
  assert.equal(record.body.error, 'Forbidden');
});

test('verified Firebase identity is attached without accepting request-controlled mappings', async () => {
  const request = {
    headers: { authorization: 'Bearer valid-token', 'x-provider-user-id': 'attacker' },
    body: { providerUserId: 'attacker', providerOrganizationId: 'attacker-org' },
    query: {}
  } as unknown as Request;
  const { response } = responseRecorder();
  await createRequestIdentityMiddleware(async token => {
    assert.equal(token, 'valid-token');
    return {
      uid: 'firebase-uid', role: 'PROVIDER', providerUserId: 'server-user',
      providerOrganizationId: 'server-org', providerStatus: 'ACTIVE', source: 'FIREBASE'
    };
  }, {} as NodeJS.ProcessEnv)(request, response, () => undefined);
  assert.equal(request.openPolicyIdentity?.providerUserId, 'server-user');
  assert.equal(request.openPolicyIdentity?.providerOrganizationId, 'server-org');
});
