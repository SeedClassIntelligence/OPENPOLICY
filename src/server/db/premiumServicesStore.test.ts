import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { PostgresStore } from './postgresStore';
import { CommercialStore } from './commercialStore';
import { PremiumServicesStore } from './premiumServicesStore';

const dataDir = path.resolve('.tmp-premium-services-db');
fs.rmSync(dataDir, { recursive: true, force: true });
const postgres = new PostgresStore(dataDir);
const commercial = new CommercialStore(postgres);
const services = new PremiumServicesStore(commercial);

async function bootstrap() {
  await postgres.init();
  await postgres.seedCanonicalProviderData();
  await commercial.seedCanonicalPlans();
  const enrollment = await commercial.enrollCommercialAgreement({ providerOrgId: 'org_apex',
    planId: 'PLAN_OPEN_POLICY_PREMIUM', planVersionId: 'cpv_open_policy_premium_v1', actorRole: 'ADMIN' });
  const client = await commercial.getClient();
  for (const type of ['AUTOMATED_APPETITE_MATCHING','ENTERPRISE_REPORTING','API_ACCESS','MULTI_LOCATION_ADMIN']) {
    await client.query(
      `INSERT INTO provider_entitlements (id, provider_organization_id, commercial_agreement_id,
       entitlement_type, enforcement_policy, scope, effective_from, created_at)
       VALUES ($1,'org_apex',$2,$3,'HARD_BLOCK','{}',$4,$4)`,
      [`ent_test_${type}`, enrollment.agreement.id, type, new Date().toISOString()]
    );
  }
}

test.before(bootstrap);
test.after(async () => { await postgres.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('structural commercial plans cannot fabricate zero-dollar production agreements', async () => {
  await commercial.saveCommercialPlan({
    id: 'plan_unpriced_test', code: 'PLAN_UNPRICED_TEST', displayName: 'Unpriced Test Plan',
    providerSegment: 'AGENCY', status: 'ACTIVE', createdAt: new Date().toISOString()
  });
  await assert.rejects(
    () => commercial.enrollCommercialAgreement({
      providerOrgId: 'org_sierra',
      planId: 'PLAN_UNPRICED_TEST',
      actorRole: 'ADMIN'
    }),
    /COMMERCIAL_PLAN_VERSION_REQUIRED/
  );
  assert.equal(await commercial.getActiveAgreementForOrg('org_sierra'), undefined);
});

test('canonical V2 plan seeding is idempotent under concurrent startup', async () => {
  await Promise.all([commercial.seedCanonicalPlans(), commercial.seedCanonicalPlans()]);
  const plans = await commercial.listActivePlans();
  const canonical = plans.filter(plan => ['PLAN_SOLO','PLAN_AGENCY','PLAN_OPEN_POLICY_PREMIUM','PLAN_NETWORK','PLAN_ENTERPRISE'].includes(plan.code));
  assert.equal(canonical.length, 5);
  for (const plan of canonical) {
    const latest = await commercial.getLatestPlanVersion(plan.id);
    assert.ok(latest, `${plan.code} has a durable canonical version`);
  }
});

test('provider activation evidence requires a fully paid positive subscription invoice', async () => {
  const agreement = await commercial.getActiveAgreementForOrg('org_apex');
  assert.ok(agreement);
  const now = new Date().toISOString();
  const period = {
    id: 'bp_activation_evidence', providerOrganizationId: 'org_apex', commercialAgreementId: agreement.id,
    commercialPlanVersionId: agreement.planVersionId, periodStart: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-11-01T00:00:00.000Z', status: 'OPEN' as const, createdAt: now
  };
  await commercial.saveBillingPeriod(period);
  const draft = await commercial.generateDraftInvoice({
    providerOrganizationId: 'org_apex', billingPeriodId: period.id, idempotencyKey: 'activation-evidence-invoice'
  });
  const finalized = await commercial.finalizeInvoiceById(draft.invoice.id);
  assert.equal(await commercial.hasPaidSubscriptionInvoice('org_apex', agreement.id), false);
  assert.ok(finalized.totalDueCents > 0);
  await commercial.recordPayment({
    providerOrganizationId: 'org_apex', invoiceId: finalized.id, amountCents: finalized.totalDueCents,
    paymentMethod: 'CREDIT_CARD', externalReference: 'pi_activation_evidence',
    idempotencyKey: 'activation-evidence-payment'
  });
  assert.equal(await commercial.hasPaidSubscriptionInvoice('org_apex', agreement.id), true);
});

test('V2 agreement derives organization capacities and enforces monthly offer submissions', async () => {
  const enrollment = await commercial.enrollCommercialAgreement({
    providerOrgId: 'org_buckeye', planId: 'PLAN_AGENCY', actorRole: 'ADMIN',
    customTerms: { includedMonthlyOfferSubmissions: 1,
      selectedRecurringAddOns: { ADDITIONAL_10_CONCURRENT_COMPETITIONS: 1 } }
  });
  const activeCapacity = enrollment.entitlements.find(item => item.entitlementType === 'ACTIVE_COMPETITION_CAPACITY');
  const monthlyCapacity = enrollment.entitlements.find(item => item.entitlementType === 'MONTHLY_OFFER_SUBMISSION_CAPACITY');
  assert.equal(activeCapacity?.limit, 30);
  assert.equal(monthlyCapacity?.limit, 1);

  const first = await commercial.consumeOfferSubmissionCapacity({
    providerOrgId: 'org_buckeye', challengeId: 'challenge-v2-capacity', offerVersionId: 'version-v2-1'
  });
  assert.equal(first.allowed, true);
  const retry = await commercial.consumeOfferSubmissionCapacity({
    providerOrgId: 'org_buckeye', challengeId: 'challenge-v2-capacity', offerVersionId: 'version-v2-1'
  });
  assert.equal(retry.allowed, true);
  assert.equal(retry.alreadyConsumed, true);
  const second = await commercial.consumeOfferSubmissionCapacity({
    providerOrgId: 'org_buckeye', challengeId: 'challenge-v2-capacity', offerVersionId: 'version-v2-2'
  });
  assert.equal(second.allowed, false);
  assert.equal(second.code, 'COMMERCIAL_CAPACITY_REACHED');
});

test('included membership services cannot be selected and billed again', async () => {
  await assert.rejects(() => commercial.enrollCommercialAgreement({
    providerOrgId: 'org_sierra', planId: 'PLAN_NETWORK', actorRole: 'ADMIN',
    customTerms: { selectedRecurringAddOns: { MULTI_LOCATION_ADMINISTRATION: 1 } }
  }), /ADD_ON_ALREADY_INCLUDED_IN_PLAN/);
  const enrollment = await commercial.enrollCommercialAgreement({
    providerOrgId: 'org_sierra', planId: 'PLAN_NETWORK', actorRole: 'ADMIN'
  });
  assert.ok(enrollment.entitlements.some(item => item.entitlementType === 'MULTI_LOCATION_ADMIN'));
});

test('an unlinked competition reservation prevents capacity oversubscription', async () => {
  await commercial.enrollCommercialAgreement({
    providerOrgId: 'org_sierra', planId: 'PLAN_NETWORK', actorRole: 'ADMIN',
    // Canonical fixture data already has one active Sierra participation.
    customTerms: { includedConcurrentCompetitions: 2 }
  });
  const reserved = await commercial.consumeEngagementCapacity({
    providerOrgId: 'org_sierra', invitationId: 'inv-capacity-reservation-1',
    challengeId: 'challenge-capacity-reservation-1'
  });
  assert.equal(reserved.allowed, true);
  const blocked = await commercial.consumeEngagementCapacity({
    providerOrgId: 'org_sierra', invitationId: 'inv-capacity-reservation-2',
    challengeId: 'challenge-capacity-reservation-2'
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.currentUsage, 2);
});

test('workflow automation is entitlement-enforced and deterministically evaluates rules', async () => {
  const rule = await services.createWorkflowRule({ providerOrganizationId: 'org_apex', name: 'Nevada Auto Priority',
    jurisdictions: ['NV'], insuranceLines: ['PERSONAL_AUTO'], riskMarkets: ['STANDARD'],
    action: 'PRIORITIZE', actorId: 'user_apex_1' });
  const result = await services.evaluateWorkflow('org_apex', { jurisdiction: 'NV', insuranceLine: 'PERSONAL_AUTO', riskMarket: 'STANDARD' });
  assert.equal(result.action, 'PRIORITIZE');
  assert.equal(result.matchedRuleId, rule.id);
  await assert.rejects(() => services.listWorkflowRules('org_sierra'), /PREMIUM_ENTITLEMENT_REQUIRED/);
});

test('API credentials are returned once, stored hashed, scoped and revocable', async () => {
  const created = await services.createApiCredential({ providerOrganizationId: 'org_apex', label: 'Agency integration',
    scopes: ['opportunities:read'], actorId: 'user_apex_1' });
  assert.match(created.token, /^op_live_/);
  const client = await commercial.getClient();
  const stored = await client.query<any>(`SELECT token_hash FROM provider_api_credentials WHERE id=$1`, [created.id]);
  assert.notEqual(stored.rows[0].token_hash, created.token);
  const identity = await services.authenticateApiToken(created.token, 'opportunities:read');
  assert.equal(identity.providerOrganizationId, 'org_apex');
  await assert.rejects(() => services.authenticateApiToken(created.token, 'reports:read'), /API scope required/);
  await services.revokeApiCredential('org_apex', created.id);
  await assert.rejects(() => services.authenticateApiToken(created.token, 'opportunities:read'), /Invalid provider API credential/);
});

test('multi-location administration prevents cross-organization assignments', async () => {
  const location = await services.createLocation({ providerOrganizationId: 'org_apex', name: 'Reno Office',
    jurisdiction: 'nv', addressLine1: '100 Market Street', city: 'Reno', postalCode: '89501', actorId: 'user_apex_1' });
  const assignment = await services.assignLocation({ providerOrganizationId: 'org_apex', locationId: location.id,
    providerUserId: 'user_apex_1', actorId: 'user_apex_1' });
  assert.equal(assignment.providerUserId, 'user_apex_1');
  await assert.rejects(() => services.assignLocation({ providerOrganizationId: 'org_apex', locationId: location.id,
    providerUserId: 'user_sierra_1', actorId: 'user_apex_1' }), /same organization/);
  const locations = await services.listLocations('org_apex');
  assert.equal(locations[0].assignedUsers, 1);
});

test('global owner service disable blocks use even when a provider still holds an entitlement', async()=>{
  await postgres.changePremiumServiceControl({serviceCode:'ENTERPRISE_REPORTING',status:'DISABLED',actorId:'owner',reason:'Controlled acceptance suspension'});
  await assert.rejects(()=>services.requireEntitlement('org_apex','ENTERPRISE_REPORTING'),/PREMIUM_SERVICE_DISABLED/);
  await postgres.changePremiumServiceControl({serviceCode:'ENTERPRISE_REPORTING',status:'ENABLED',actorId:'owner',reason:'Acceptance restored'});
  assert.equal((await services.requireEntitlement('org_apex','ENTERPRISE_REPORTING')).entitlementType,'ENTERPRISE_REPORTING');
});
