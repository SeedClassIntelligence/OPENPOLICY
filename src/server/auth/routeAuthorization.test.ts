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
const admin: RequestIdentity = { uid: 'admin-a', role: 'ADMIN', adminType:'OWNER', adminPermissions:['PLATFORM_READ','PROVIDER_ADMIN','COMMERCIAL_ADMIN','COMPLIANCE_ADMIN','SECURITY_ADMIN'], source: 'FIREBASE' };

test('public routes do not require identity', () => {
  assert.equal(invoke('GET', '/health').next, true);
  assert.equal(invoke('GET', '/commercial/plans').next, true);
  assert.equal(invoke('GET', '/insurance-lines').next, true);
  assert.equal(invoke('GET', '/rollout/jurisdiction-lines').next, true);
  assert.equal(invoke('POST', '/commercial/stripe/webhook').next, true);
});

test('financial mutations preserve processor and platform authority boundaries', () => {
  assert.equal(invoke('POST', '/commercial/refunds', provider).status, 403);
  assert.equal(invoke('POST', '/commercial/refunds', admin).next, true);
  assert.equal(invoke('POST', '/commercial/invoices/invoice-a/payment-session', consumer).status, 403);
  assert.equal(invoke('POST', '/commercial/invoices/invoice-a/payment-session', provider).next, true);
});

test('staff administrator permissions are enforced independently of the ADMIN identity role',()=>{
  const financialStaff:RequestIdentity={uid:'staff-finance',role:'ADMIN',adminType:'STAFF',adminPermissions:['PLATFORM_READ','COMMERCIAL_ADMIN'],source:'FIREBASE'};
  assert.equal(invoke('GET','/admin/overview',financialStaff).next,true);
  assert.equal(invoke('POST','/admin/commercial/agreements/enroll',financialStaff).next,true);
  assert.equal(invoke('PATCH','/admin/providers/org-a/status',financialStaff).status,403);
  assert.equal(invoke('PUT','/admin/administrators/staff-b',financialStaff).status,403);
  assert.equal(invoke('GET','/admin/review-queue',financialStaff).status,403);
});

test('provider integration APIs require provider identity', () => {
  assert.equal(invoke('GET', '/integrations/v1/opportunities').status, 401);
  assert.equal(invoke('GET', '/integrations/v1/opportunities', consumer).status, 403);
  assert.equal(invoke('GET', '/integrations/v1/opportunities', provider).next, true);
  assert.equal(invoke('GET', '/integrations/v1/reports/summary', admin).status, 403);
});

test('provider application intake and review preserve separate authority boundaries', () => {
  const pendingProvider: RequestIdentity = { uid: 'pending-provider', role: 'PROVIDER', providerStatus: 'PENDING_VERIFICATION', source: 'FIREBASE' };
  assert.equal(invoke('POST', '/provider-applications/current').status, 401);
  assert.equal(invoke('POST', '/provider-applications/current', consumer).status, 403);
  assert.equal(invoke('POST', '/provider-applications/current', pendingProvider).next, true);
  assert.equal(invoke('GET', '/admin/provider-applications', provider).status, 403);
  assert.equal(invoke('POST', '/admin/provider-applications/application-a/review', provider).status, 403);
  assert.equal(invoke('POST', '/admin/provider-applications/application-a/review', admin).next, true);
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
  assert.equal(invoke('POST', '/marketplace/competition/c/begin-review', provider).status, 403);
  assert.equal(invoke('POST', '/marketplace/competition/c/begin-review', consumer).next, true);
  assert.equal(invoke('POST', '/marketplace/competition/c/request-additional-offers', provider).status, 403);
  assert.equal(invoke('POST', '/marketplace/competition/c/request-additional-offers', consumer).next, true);
  assert.equal(invoke('GET', '/marketplace/competition/c/offer-cohorts', provider).status, 403);
  assert.equal(invoke('GET', '/marketplace/competition/c/offer-cohorts', consumer).next, true);
  assert.equal(invoke('GET', '/marketplace/competition/c/offer-status', consumer).status, 403);
  assert.equal(invoke('GET', '/marketplace/competition/c/offer-status', provider).next, true);
  assert.equal(invoke('POST', '/marketplace/binding/h/cannot-honor', consumer).status, 403);
  assert.equal(invoke('POST', '/marketplace/binding/h/cannot-honor', provider).next, true);
  assert.equal(invoke('POST', '/admin/commercial/agreements/enroll', provider).status, 403);
  assert.equal(invoke('POST', '/admin/commercial/agreements/enroll', admin).next, true);
  assert.equal(invoke('POST', '/admin/commercial/agreements/agreement-1/transition', provider).status, 403);
  assert.equal(invoke('POST', '/admin/commercial/agreements/agreement-1/transition', admin).next, true);
  assert.equal(invoke('POST', '/commercial/billing-periods', provider).status, 403);
  assert.equal(invoke('POST', '/commercial/billing-periods', admin).next, true);
  assert.equal(invoke('POST', '/commercial/billing-periods/period-1/close', provider).status, 403);
  assert.equal(invoke('POST', '/commercial/invoices/generate-draft', provider).status, 403);
  assert.equal(invoke('POST', '/commercial/invoices/invoice-1/finalize', provider).status, 403);
  assert.equal(invoke('POST', '/commercial/billable-events/event-1/adjustments', provider).status, 403);
  assert.equal(invoke('POST', '/commercial/payments', provider).status, 403);
});

test('real policy-document ingestion is consumer-only and never public or provider-controlled', () => {
  assert.equal(invoke('POST', '/policy-documents/ingest').status, 401);
  assert.equal(invoke('POST', '/policy-documents/ingest', provider).status, 403);
  assert.equal(invoke('POST', '/policy-documents/ingest', admin).status, 403);
  assert.equal(invoke('POST', '/policy-documents/ingest', consumer).next, true);
  assert.equal(invoke('POST', '/policy-documents/DOC-1/scan').status, 401);
  assert.equal(invoke('POST', '/policy-documents/DOC-1/scan', provider).status, 403);
  assert.equal(invoke('POST', '/policy-documents/DOC-1/scan', consumer).next, true);
  assert.equal(invoke('POST', '/policy-documents/DOC-1/extract', provider).status, 403);
  assert.equal(invoke('POST', '/policy-documents/DOC-1/extract', consumer).next, true);
  assert.equal(invoke('POST', '/policy-documents/DOC-1/verify', provider).status, 403);
  assert.equal(invoke('POST', '/policy-documents/DOC-1/verify', consumer).next, true);
  assert.equal(invoke('GET', '/policy-documents/DOC-1', provider).status, 403);
  assert.equal(invoke('GET', '/policy-documents/DOC-1', consumer).next, true);
  assert.equal(invoke('GET', '/policy-documents/current-baseline', consumer).next, true);
});

test('verified sample policy upload supports the advertised consumer demo without admitting providers', () => {
  assert.equal(invoke('POST', '/documents/upload-sample').status, 401);
  assert.equal(invoke('POST', '/documents/upload-sample', provider).status, 403);
  assert.equal(invoke('POST', '/documents/upload-sample', consumer).next, true);
  assert.equal(invoke('POST', '/documents/upload-sample', admin).next, true);
});

test('coverage baseline confirmation supports the consumer flow without admitting providers', () => {
  assert.equal(invoke('POST', '/baselines/create').status, 401);
  assert.equal(invoke('POST', '/baselines/create', provider).status, 403);
  assert.equal(invoke('POST', '/baselines/create', consumer).next, true);
  assert.equal(invoke('POST', '/baselines/create', admin).next, true);
});

test('founder-approved directory and notification route policies are enforced', () => {
  assert.equal(invoke('GET', '/marketplace/users', provider).status, 403);
  assert.equal(invoke('GET', '/marketplace/users', admin).next, true);
  assert.equal(invoke('GET', '/marketplace/providers', consumer).next, true);
  assert.equal(invoke('GET', '/marketplace/providers', provider).next, true);
  assert.equal(invoke('GET', '/notifications', consumer).next, true);
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
