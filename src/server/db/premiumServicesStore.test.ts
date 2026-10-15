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
