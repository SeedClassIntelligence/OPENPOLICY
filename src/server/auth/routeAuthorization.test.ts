import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { assertBindingRelationship, assertChallengeRelationship, enforceApiAuthorization } from './routeAuthorization';
import type { RequestIdentity } from './requestIdentity';

function invoke(method: string, path: string, identity?: RequestIdentity, env: Record<string, string | undefined> = {}) {
  const previous = {
    OPENPOLICY_AUTH_MODE: process.env.OPENPOLICY_AUTH_MODE,
    OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS: process.env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS,
    NODE_ENV: process.env.NODE_ENV
  };
  process.env.OPENPOLICY_AUTH_MODE = env.OPENPOLICY_AUTH_MODE || 'firebase';
  if (env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS) process.env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS = env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS;
  else delete process.env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS;
  if (env.NODE_ENV) process.env.NODE_ENV = env.NODE_ENV; else delete process.env.NODE_ENV;

  const record: { status?: number; body?: any; next: boolean } = { next: false };
  const req = { method, path, openPolicyIdentity: identity } as Request;
  const res = {
    status(code: number) { record.status = code; return res; },
    json(body: any) { record.body = body; return res; }
  } as unknown as Response;
  try {
    enforceApiAuthorization(req, res, () => { record.next = true; });
    return record;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

const consumer: RequestIdentity = { uid: 'consumer-a', role: 'CONSUMER', source: 'FIREBASE' };
const provider: RequestIdentity = {
  uid: 'provider-a', role: 'PROVIDER', source: 'FIREBASE', providerStatus: 'ACTIVE',
  providerUserId: 'provider-user-a', providerOrganizationId: 'provider-org-a'
};
const admin: RequestIdentity = { uid: 'admin-a', role: 'ADMIN', source: 'FIREBASE' };

test('public routes do not require identity', () => {
  assert.equal(invoke('GET', '/health').next, true);
  assert.equal(invoke('GET', '/commercial/plans').next, true);
});

test('sensitive routes reject anonymous callers', () => {
  for (const [method, path] of [
    ['GET', '/challenges'],
    ['GET', '/marketplace/competition/challenge-a/status'],
    ['GET', '/marketplace/binding/handoff-a'],
    ['GET', '/commercial/rating/runs'],
    ['GET', '/admin/review-queue']
  ]) assert.equal(invoke(method, path).status, 401, `${method} ${path}`);
});

test('wrong actor type is forbidden while intended actor is admitted to domain checks', () => {
  assert.equal(invoke('GET', '/challenges', provider).status, 403);
  assert.equal(invoke('GET', '/challenges', consumer).next, true);
  assert.equal(invoke('GET', '/marketplace/opportunities', consumer).status, 403);
  assert.equal(invoke('GET', '/marketplace/opportunities', provider).next, true);
  assert.equal(invoke('POST', '/marketplace/competition/c/advance-round', provider).status, 403);
  assert.equal(invoke('POST', '/marketplace/competition/c/advance-round', admin).next, true);
});

test('unresolved directory and notification policies fail closed', () => {
  assert.equal(invoke('GET', '/marketplace/users', admin).status, 403);
  assert.equal(invoke('GET', '/notifications', consumer).status, 403);
});

test('fixture bypass requires an explicit process-only switch and is forbidden by production auth mode', () => {
  assert.equal(invoke('GET', '/admin/review-queue', undefined, {
    OPENPOLICY_AUTH_MODE: 'fixture', OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS: '1'
  }).next, true);
  assert.throws(() => invoke('GET', '/health', undefined, {
    OPENPOLICY_AUTH_MODE: 'fixture', OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS: '1', NODE_ENV: 'production'
  }), /forbidden/);
});

test('challenge relationship permits owner and same-org participant but denies cross-tenant actors', () => {
  assert.doesNotThrow(() => assertChallengeRelationship({
    identity: consumer, challengeConsumerId: 'consumer-a', participatingOrganizationIds: []
  }));
  assert.throws(() => assertChallengeRelationship({
    identity: consumer, challengeConsumerId: 'consumer-b', participatingOrganizationIds: []
  }), /does not own/);
  assert.doesNotThrow(() => assertChallengeRelationship({
    identity: provider, challengeConsumerId: 'consumer-a', providerOrganizationId: 'provider-org-a',
    participatingOrganizationIds: ['provider-org-a']
  }));
  assert.throws(() => assertChallengeRelationship({
    identity: provider, challengeConsumerId: 'consumer-a', providerOrganizationId: 'provider-org-a',
    participatingOrganizationIds: ['provider-org-b']
  }), /does not participate/);
});

test('binding relationship permits exact consumer/provider ownership and fails missing mapping closed', () => {
  assert.doesNotThrow(() => assertBindingRelationship({
    identity: consumer, handoffConsumerId: 'consumer-a', handoffProviderOrganizationId: 'provider-org-a'
  }));
  assert.doesNotThrow(() => assertBindingRelationship({
    identity: provider, handoffConsumerId: 'consumer-a', handoffProviderOrganizationId: 'provider-org-a',
    providerOrganizationId: 'provider-org-a'
  }));
  assert.throws(() => assertBindingRelationship({
    identity: provider, handoffConsumerId: 'consumer-a', handoffProviderOrganizationId: 'provider-org-b',
    providerOrganizationId: 'provider-org-a'
  }), /does not own/);
  assert.throws(() => assertBindingRelationship({
    identity: provider, handoffConsumerId: 'consumer-a', handoffProviderOrganizationId: undefined,
    providerOrganizationId: 'provider-org-a'
  }), /does not own/);
});
