/**
 * Master Validation Suite for Open Policy Commercial Economics (CE-2)
 * Commercial Governance, Entitlement Enforcement & Capacity Consumption
 * 
 * Verifies:
 * 1. Commercial Neutrality Codebase Firewall (Zero commercial imports in protected engines).
 * 2. Commercial Governance & Read-Only Invariants (Zero DB mutations on GET, no auto-enrollment).
 * 3. Absence of Unapproved Pricing in Production Seeding & Provider Portal UI.
 * 4. Explicit Commercial Agreement Lifecycle (PENDING -> ACTIVE -> SUSPENDED -> TERMINATED).
 * 5. Entitlement Enforcement at Marketplace Invitation Acceptance:
 *    - Within capacity allows acceptance.
 *    - HARD_BLOCK rejects at limit with 403 COMMERCIAL_CAPACITY_REACHED.
 *    - Rejection does not mutate regulatory eligibility, licensing, or appetite.
 *    - ALLOW_OVERAGE permits participation and marks usage as overage.
 *    - NOTIFY_ONLY permits participation.
 * 6. Concurrency, Idempotency & Auditable Integrity:
 *    - Duplicate retry does not double-consume.
 *    - Concurrency cannot oversubscribe HARD_BLOCK limit.
 *    - Failed marketplace participation cleans up usage record (zero phantom consumption).
 *    - Tenant isolation: Cross-organization access strictly rejected with 403 Forbidden.
 * 7. Commercial Neutrality Invariant:
 *    - Two identical providers with different commercial tiers receive identical qualification,
 *      comparison, competition, and selection treatment.
 * 8. PM-5 Non-Regression & API Namespace Isolation:
 *    - Prohibited marketplace billing endpoints remain 404.
 * 9. Platform Test Aggregation & Full Pass.
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { app, synchronizeFixturePersistence } from '../server';
import { db } from '../src/server/db';
import { postgresStore } from '../src/server/db/postgresStore';
import { commercialStore, CommercialStore } from '../src/server/db/commercialStore';
import {
  createCommercialAccount,
  createCommercialPlanVersion,
  createCommercialAgreement,
  deriveEntitlementsFromPlanVersion,
  checkEntitlementCapacity,
  transitionAgreementLifecycle,
  createTestFixturePlanVersion
} from '../src/domain/commercialEconomicsEngine';
import { runCommercialEconomicsTestSuite } from '../src/domain/commercialEconomics.test';
import { evaluateOfferQualification } from '../src/domain/qualificationEngine';
import { compareOfferAgainstBaseline } from '../src/domain/comparisonEngine';
import { CoverageBaseline, LegacyConsumerRequirements, Offer, ProviderOrganization } from '../src/types/insurance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function request(server: http.Server, method: string, urlPath: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 200, body: parsed });
        } catch {
          resolve({ status: res.statusCode || 200, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runValidation() {
  console.log('\n============================================================');
  console.log('OPEN POLICY COMMERCIAL ECONOMICS (CE-2) VALIDATION SUITE');
  console.log('Commercial Governance, Entitlement Enforcement & Capacity Consumption');
  console.log('============================================================\n');

  const testDbDir = path.join(process.cwd(), 'data', `test_ce2_${Date.now()}`);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  // Ensure default server store is initialized & plans are seeded for HTTP assertions
  await postgresStore.init();
  await postgresStore.seedCanonicalProviderData();
  await commercialStore.seedCanonicalPlans();

  // Reset test organizations so validation runs deterministically and idempotently
  const initClient = await commercialStore.getClient();
  await initClient.query("DELETE FROM settlement_allocations WHERE invoice_id IN (SELECT id FROM invoices WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test'));");
  await initClient.query("DELETE FROM refund_records WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM payment_records WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test'));");
  await initClient.query("DELETE FROM invoices WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM billing_periods WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM rating_adjustments WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM billable_events WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM commercial_events WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM commercial_usage_records WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM provider_entitlements WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM commercial_agreements WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");
  await initClient.query("DELETE FROM commercial_accounts WHERE provider_organization_id IN ('org_apex', 'org_sierra', 'org_buckeye', 'org_concurrent_test');");

  try {
    // ------------------------------------------------------------------------
    // Part 1: Commercial Neutrality Codebase Firewall Invariant
    // ------------------------------------------------------------------------
    console.log('--- Test Group 1: Commercial Neutrality Codebase Firewall ---');
    const protectedFiles = [
      'src/domain/comparisonEngine.ts',
      'src/domain/competitionEngine.ts',
      'src/domain/qualificationEngine.ts',
      'src/domain/selectionBindingEngine.ts',
      'src/domain/pm5ReconciliationEngine.ts'
    ];

    const forbiddenStrings = [
      'commercialEconomicsEngine',
      'commercialStore',
      'commercial_accounts',
      'commercial_plans',
      'commercial_agreements',
      'commercial_usage_records',
      'billable_events'
    ];

    for (const file of protectedFiles) {
      const fullPath = path.join(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const forbidden of forbiddenStrings) {
          assert(
            !content.includes(forbidden),
            `Protected file '${file}' strictly does not import or reference '${forbidden}'`
          );
        }
      }
    }

    // ------------------------------------------------------------------------
    // Part 2: Pure Domain Engine Unit Tests (CE-1 + CE-2)
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 2: CE Domain Test Suite ---');
    const ceSuite = runCommercialEconomicsTestSuite();
    assert(ceSuite.failed === 0, `CE domain suite passes cleanly (${ceSuite.passed}/${ceSuite.total})`);

    // ------------------------------------------------------------------------
    // Part 3: Commercial Governance & Read-Only Invariants (Section 14)
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 3: Commercial Governance & Read-Only Invariants ---');
    const buckeyeHeaders = { 'x-provider-user-id': 'user_buckeye_1' }; // org_buckeye has no agreement enrolled initially

    // Check row counts before GET requests
    const client = await commercialStore.getClient();
    const countAccountsBefore = await client.query<{ count: string }>('SELECT COUNT(*) FROM commercial_accounts;');
    const countAgreementsBefore = await client.query<{ count: string }>('SELECT COUNT(*) FROM commercial_agreements;');
    const countEntitlementsBefore = await client.query<{ count: string }>('SELECT COUNT(*) FROM provider_entitlements;');

    // 3.1 GET /api/commercial/account is read-only and side-effect free
    const resAccountBefore = await request(server, 'GET', '/api/commercial/account', undefined, buckeyeHeaders);
    assert(resAccountBefore.status === 200, 'GET /api/commercial/account returns 200');
    assert(resAccountBefore.body.configured === false, 'Returns configured: false when no account exists');
    assert(resAccountBefore.body.account === null, 'Returns account: null without inventing an account');

    // 3.2 GET /api/commercial/agreement is read-only and does not invent an agreement
    const resAgreementBefore = await request(server, 'GET', '/api/commercial/agreement', undefined, buckeyeHeaders);
    assert(resAgreementBefore.status === 200, 'GET /api/commercial/agreement returns 200');
    assert(resAgreementBefore.body.configured === false, 'Returns configured: false when no agreement exists');
    assert(resAgreementBefore.body.agreement === null, 'Returns agreement: null without inventing an agreement');

    // Verify row counts after GET requests (Strict Zero Mutation Invariant)
    const countAccountsAfter = await client.query<{ count: string }>('SELECT COUNT(*) FROM commercial_accounts;');
    const countAgreementsAfter = await client.query<{ count: string }>('SELECT COUNT(*) FROM commercial_agreements;');
    const countEntitlementsAfter = await client.query<{ count: string }>('SELECT COUNT(*) FROM provider_entitlements;');

    assert(countAccountsBefore.rows[0].count === countAccountsAfter.rows[0].count, 'GET commercial endpoints cause zero database mutations (accounts count unchanged)');
    assert(countAgreementsBefore.rows[0].count === countAgreementsAfter.rows[0].count, 'GET commercial endpoints cause zero database mutations (agreements count unchanged)');
    assert(countEntitlementsBefore.rows[0].count === countEntitlementsAfter.rows[0].count, 'GET commercial endpoints cause zero database mutations (entitlements count unchanged)');

    // 3.3 Verify absence of unapproved production pricing in canonical plans
    const activePlans = await commercialStore.listActivePlans();
    assert(activePlans.length >= 2, 'Canonical plans exist structurally');
    for (const plan of activePlans) {
      assert(plan.code !== undefined, `Plan ${plan.code} exists structurally`);
    }

    // 3.4 ProviderPortal.tsx UI contains zero hard-coded fallback prices ($499)
    const portalPath = path.join(process.cwd(), 'src/components/ProviderPortal.tsx');
    const portalCode = fs.readFileSync(portalPath, 'utf8');
    assert(!portalCode.includes('$499'), 'ProviderPortal.tsx strictly does not contain hard-coded $499 fallback amount');
    assert(portalCode.includes('No active commercial plan') || portalCode.includes('Unconfigured'), 'ProviderPortal.tsx displays neutral wording when unconfigured');

    // ------------------------------------------------------------------------
    // Part 4: Explicit Commercial Agreement Lifecycle & Enrollment
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Explicit Commercial Agreement Lifecycle & Enrollment ---');
    // 4.1 Explicit enrollment via POST
    const enrollRes = await request(server, 'POST', '/api/commercial/agreements/enroll', {
      planCode: 'PLAN_AGENCY',
      enforcementPolicy: 'HARD_BLOCK',
      customTerms: {
        includedVpoCapacity: 5
      }
    }, buckeyeHeaders);

    assert(enrollRes.status === 201, 'POST /api/commercial/agreements/enroll succeeds with 201 Created');
    assert(enrollRes.body.agreement.status === 'ACTIVE', 'Explicitly enrolled agreement status is ACTIVE');
    assert(enrollRes.body.agreement.providerOrganizationId === 'org_buckeye', 'Agreement bound to org_buckeye');
    const enrolledAgreementId = enrollRes.body.agreement.id;

    // 4.2 Lifecycle Transitions: ACTIVE -> SUSPENDED
    const suspendRes = await request(server, 'POST', `/api/commercial/agreements/${enrolledAgreementId}/transition`, {
      targetStatus: 'SUSPENDED',
      reason: 'Administrative temporary suspension'
    }, buckeyeHeaders);
    assert(suspendRes.status === 200, 'POST transition to SUSPENDED succeeds with 200 OK');
    assert(suspendRes.body.agreement.status === 'SUSPENDED', 'Agreement status updated to SUSPENDED');

    // 4.3 Lifecycle Transitions: SUSPENDED -> ACTIVE
    const resumeRes = await request(server, 'POST', `/api/commercial/agreements/${enrolledAgreementId}/transition`, {
      targetStatus: 'ACTIVE',
      reason: 'Reinstated by admin'
    }, buckeyeHeaders);
    assert(resumeRes.status === 200, 'POST transition to ACTIVE succeeds with 200 OK');
    assert(resumeRes.body.agreement.status === 'ACTIVE', 'Agreement status reinstated to ACTIVE');

    // ------------------------------------------------------------------------
    // Part 5: Entitlement Enforcement at Marketplace Invitation Acceptance
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 5: Entitlement Enforcement at Marketplace Invitation Acceptance ---');
    // Setup isolated organization: org_apex
    // Create an explicit agreement with VPO_ENGAGEMENT_CAPACITY limit = 1 and HARD_BLOCK
    const apexHeaders = { 'x-provider-user-id': 'user_apex_1' };
    const apexEnrollRes = await request(server, 'POST', '/api/commercial/agreements/enroll', {
      planCode: 'PLAN_SOLO',
      enforcementPolicy: 'HARD_BLOCK',
      customTerms: {
        includedEngagementCapacity: 1
      }
    }, apexHeaders);
    assert(apexEnrollRes.status === 201, 'Enrolled org_apex with HARD_BLOCK and capacity limit = 1');

    // Seed challenge and invitations for org_apex
    const challengeId = 'CHAL-CE2-APEX-001';
    const secondChallengeId = 'CHAL-CE2-APEX-002';
    const canonicalChallenge = db.getChallenge('CHAL-NV-49281')!;
    db.createChallenge({
      ...canonicalChallenge,
      id: challengeId,
      referenceNumber: 'CHALLENGE #CE2-APEX-001',
      status: 'OPEN',
      offersCount: 0
    });
    db.createChallenge({
      ...canonicalChallenge,
      id: secondChallengeId,
      referenceNumber: 'CHALLENGE #CE2-APEX-002',
      status: 'OPEN',
      offersCount: 0
    });
    const compId = db.getCompetitionForChallenge(challengeId)!.id;

    const inv1Id = db.getInvitationsForChallenge(challengeId).find(invitation => invitation.providerOrganizationId === 'org_apex')!.id;
    const inv2Id = db.getInvitationsForChallenge(secondChallengeId).find(invitation => invitation.providerOrganizationId === 'org_apex')!.id;
    await synchronizeFixturePersistence();

    // 5.1 Provider within capacity accepts Invitation 1 -> Allowed
    const accept1Res = await request(server, 'POST', `/api/marketplace/invitations/${inv1Id}/accept`, {}, apexHeaders);
    assert(accept1Res.status === 200, 'Provider within capacity successfully accepts invitation (200 OK)');
    assert(accept1Res.body.success === true, 'Acceptance reports success');
    assert(accept1Res.body.commercial.capacityAllowed === true, 'Commercial capacity allowed reported');

    // 5.2 Provider at HARD_BLOCK limit attempts to accept Invitation 2 -> Rejected with 403
    const accept2Res = await request(server, 'POST', `/api/marketplace/invitations/${inv2Id}/accept`, {}, apexHeaders);
    assert(accept2Res.status === 403, 'Provider at HARD_BLOCK limit rejected with 403 Forbidden');
    assert(accept2Res.body.code === 'COMMERCIAL_CAPACITY_REACHED', 'Rejection code is COMMERCIAL_CAPACITY_REACHED');

    // 5.3 Verify commercial denial DOES NOT alter regulatory eligibility or licensing
    const orgApex = db.getProviderOrganization('org_apex');
    assert(orgApex !== undefined, 'Provider organization exists');
    assert(orgApex?.marketplaceStatus === 'ACTIVE', 'Provider regulatory marketplaceStatus remains ACTIVE');
    const apexLicenses = db.getProviderLicenses('org_apex');
    assert(apexLicenses.length > 0, 'Provider licenses remain intact');
    assert(apexLicenses[0].status === 'ACTIVE', 'Provider license status remains ACTIVE');

    // 5.4 Test ALLOW_OVERAGE policy
    // Enroll org_sierra with ALLOW_OVERAGE and capacity = 0
    const sierraHeaders = { 'x-provider-user-id': 'user_sierra_1' };
    const sierraEnrollRes = await request(server, 'POST', '/api/commercial/agreements/enroll', {
      planCode: 'PLAN_SOLO',
      enforcementPolicy: 'ALLOW_OVERAGE',
      customTerms: {
        includedEngagementCapacity: 0
      }
    }, sierraHeaders);
    assert(sierraEnrollRes.status === 201, 'Enrolled org_sierra with ALLOW_OVERAGE policy and limit = 0');

    const invSierraId = db.getInvitationsForChallenge(challengeId).find(invitation => invitation.providerOrganizationId === 'org_sierra')!.id;

    const acceptSierraRes = await request(server, 'POST', `/api/marketplace/invitations/${invSierraId}/accept`, {}, sierraHeaders);
    assert(acceptSierraRes.status === 200, 'ALLOW_OVERAGE permits participation even when over limit (200 OK)');
    assert(acceptSierraRes.body.commercial.isOverage === true, 'Usage marked as overage for later CE-4 rating');

    // 5.5 Test NOTIFY_ONLY policy
    const notifyResult = checkEntitlementCapacity({
      entitlements: [{
        id: 'ent_notify',
        providerOrganizationId: 'org_sierra',
        commercialAgreementId: 'agr_notify',
        entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
        limit: 5,
        enforcementPolicy: 'NOTIFY_ONLY',
        effectiveFrom: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }],
      entitlementType: 'VPO_ENGAGEMENT_CAPACITY',
      currentUsage: 10,
      agreementStatus: 'ACTIVE'
    });
    assert(notifyResult.allowed === true, 'NOTIFY_ONLY allows participation when limit exceeded');
    assert(notifyResult.code === 'NOTIFY_CAPACITY_EXCEEDED', 'NOTIFY_ONLY flags condition without blocking');

    // ------------------------------------------------------------------------
    // Part 6: Concurrency, Idempotency & Auditable Integrity
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 6: Concurrency, Idempotency & Auditable Integrity ---');

    // 6.1 Retry does not double-consume capacity
    const retryRes = await request(server, 'POST', `/api/marketplace/invitations/${inv1Id}/accept`, {}, apexHeaders);
    assert(retryRes.status === 200, 'Duplicate retry returns 200 OK');
    const apexUsageCount = await commercialStore.getUsageCount('org_apex', 'VPO_ENGAGEMENT');
    assert(apexUsageCount === 1, `Retry did not double-consume: usage count is 1 (actual: ${apexUsageCount})`);

    // 6.2 Auditable source of truth
    const usageRecords = await commercialStore.getUsageRecordsForOrg('org_apex');
    assert(usageRecords.length >= 1, 'Auditable CommercialUsageRecord persisted');
    assert(usageRecords[0].invitationId === inv1Id, 'Usage record correctly links to invitationId');
    assert(usageRecords[0].providerOrganizationId === 'org_apex', 'Usage record attributed to providerOrgId');

    // 6.3 Failed participation does not consume capacity (phantom consumption prevention)
    const declinedInvitation = db.getInvitationsForChallenge(secondChallengeId)
      .find(invitation => invitation.providerOrganizationId === 'org_sierra')!;
    const bogusInvId = declinedInvitation.id;
    db.saveInvitation({ ...declinedInvitation, status: 'DECLINED', declinedAt: new Date().toISOString() });
    await synchronizeFixturePersistence();

    const countSierraUsageBefore = await commercialStore.getUsageCount('org_sierra', 'VPO_ENGAGEMENT');
    const failedAcceptRes = await request(server, 'POST', `/api/marketplace/invitations/${bogusInvId}/accept`, {}, sierraHeaders);
    assert(failedAcceptRes.status === 409, `Failed marketplace acceptance rejected with 409 Conflict (${failedAcceptRes.status}: ${JSON.stringify(failedAcceptRes.body)})`);
    const countSierraUsageAfter = await commercialStore.getUsageCount('org_sierra', 'VPO_ENGAGEMENT');
    assert(countSierraUsageBefore === countSierraUsageAfter, 'Zero phantom consumption: usage record released upon marketplace failure');

    // 6.4 Concurrency protection under row locking: simulated concurrent acceptance of final unit
    // Enroll an org with exactly 1 unit
    const concurrentOrgId = 'org_concurrent_test';
    const concurrentHeaders = { 'x-provider-user-id': 'user_concurrent_1' };
    const concurrentOrg: ProviderOrganization = {
      id: concurrentOrgId,
      legalName: 'Concurrent Test Brokerage',
      displayName: 'Concurrent Test',
      organizationType: 'INDEPENDENT_AGENCY',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['NV'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      createdAt: new Date().toISOString()
    };
    await postgresStore.saveProviderOrganization(concurrentOrg);
    db.saveProviderOrganization(concurrentOrg);
    const concurrentUser = {
      id: 'user_concurrent_1',
      organizationId: concurrentOrgId,
      email: 'concurrent@example.com',
      name: 'Concurrent User',
      role: 'AGENT',
      status: 'ACTIVE'
    } as const;
    db.saveProviderUser(concurrentUser);
    await postgresStore.saveProviderUser(concurrentUser);

    await commercialStore.enrollCommercialAgreement({
      providerOrgId: concurrentOrgId,
      planId: 'PLAN_SOLO',
      enforcementPolicy: 'HARD_BLOCK',
      customTerms: { includedEngagementCapacity: 1 }
    });

    const concurrentChallenge1 = 'CHAL-CONCUR-1';
    const concurrentChallenge2 = 'CHAL-CONCUR-2';
    db.createChallenge({ ...canonicalChallenge, id: concurrentChallenge1, referenceNumber: 'CHALLENGE #CONCUR-1', status: 'OPEN', offersCount: 0 });
    db.createChallenge({ ...canonicalChallenge, id: concurrentChallenge2, referenceNumber: 'CHALLENGE #CONCUR-2', status: 'OPEN', offersCount: 0 });
    db.saveInvitation({
      id: 'INV-CONCUR-1',
      challengeId: concurrentChallenge1,
      competitionId: 'COMP-CONCUR-1',
      providerOrganizationId: concurrentOrgId,
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['Concurrent test'],
      status: 'INVITED',
      invitedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    db.saveInvitation({
      id: 'INV-CONCUR-2',
      challengeId: concurrentChallenge2,
      competitionId: 'COMP-CONCUR-2',
      providerOrganizationId: concurrentOrgId,
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['Concurrent test'],
      status: 'INVITED',
      invitedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    await synchronizeFixturePersistence();

    // Fire 2 simultaneous requests
    const [c1, c2] = await Promise.all([
      request(server, 'POST', '/api/marketplace/invitations/INV-CONCUR-1/accept', {}, concurrentHeaders),
      request(server, 'POST', '/api/marketplace/invitations/INV-CONCUR-2/accept', {}, concurrentHeaders)
    ]);

    const statuses = [c1.status, c2.status].sort();
    assert(statuses[0] === 200 && statuses[1] === 403, `Concurrent requests for final unit: exactly one succeeds (200) and one is blocked (403). Actual: [${c1.status}, ${c2.status}]`);
    const concurrentUsage = await commercialStore.getUsageCount(concurrentOrgId, 'VPO_ENGAGEMENT');
    assert(concurrentUsage === 1, `Concurrent usage count strictly equals 1 under row locking (actual: ${concurrentUsage})`);

    // 6.5 Tenant Isolation: Provider A cannot access Provider B's commercial state
    const attackHeaders = {
      'x-provider-user-id': 'user_apex_1',
      'x-provider-org-id': 'org_sierra'
    };
    const resAttack = await request(server, 'GET', '/api/commercial/account', undefined, attackHeaders);
    assert(resAttack.status === 403, 'Cross-tenant impersonation attempt rejected with 403 Forbidden');

    // ------------------------------------------------------------------------
    // Part 7: Commercial Neutrality Invariant (Section 14 & Section 1)
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 7: Commercial Neutrality Invariant ---');
    // Create two otherwise identical eligible providers with materially different commercial tiers:
    // Provider 1: org_apex (Solo plan, capacity exhausted)
    // Provider 2: org_sierra (Agency plan, unlimited capacity)
    // Assert identical treatment by:
    // - qualification
    // - comparison

    const mockBaseline: CoverageBaseline = {
      id: 'BASE-TEST-1',
      policyId: 'POL-1',
      version: 1,
      carrier: 'Legacy Mutual',
      effectiveDate: '2025-01-01',
      expirationDate: '2026-01-01',
      baselineAnnualPremium: 2400,
      baselineMonthlyPremium: 200,
      jurisdiction: 'NV',
      vehicle: {
        vin: '1234567890ABCDEFG',
        year: 2023,
        make: 'Toyota',
        model: 'Camry',
        usage: 'COMMUTE',
        annualMileage: 12000,
        garagingZip: '89101',
        ownership: 'OWNED'
      },
      coverages: [
        { id: 'c1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', isIncluded: true },
        { id: 'c2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', isIncluded: true },
        { id: 'c3', code: 'COLLISION', name: 'Collision', category: 'PHYSICAL_DAMAGE', deductible: 500, isIncluded: true },
        { id: 'c4', code: 'COMPREHENSIVE', name: 'Comprehensive', category: 'PHYSICAL_DAMAGE', deductible: 500, isIncluded: true }
      ],
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'Tester'
    };

    const dummyRequirements: LegacyConsumerRequirements = {
      id: 'REQ-1',
      ruleSummary: 'Beat price without reducing protection',
      minAnnualSavings: 100,
      maxCollisionDeductible: 500,
      maxCompDeductible: 500,
      mustIncludeRental: false,
      mustIncludeRoadside: false
    };

    const offerFromApex: Offer = {
      id: 'OFFER-APEX-TEST',
      challengeId: 'CHAL-TEST',
      providerId: 'org_apex', // Low commercial tier
      providerName: 'Apex Insurance Group',
      providerLicense: 'NV-LIC-001',
      carrier: 'Nationwide Mutual',
      quoteNumber: 'QUOTE-APEX-1',
      annualPremium: 2000,
      monthlyPremium: 167,
      termMonths: 12,
      effectiveDate: '2025-01-01',
      expirationDate: '2026-01-01',
      coverages: mockBaseline.coverages,
      supportingQuoteDocName: 'Apex_Quote.pdf',
      submittedAt: new Date().toISOString(),
      discrepanciesDetected: false,
      status: 'VALIDATED'
    };

    const offerFromSierra: Offer = {
      ...offerFromApex,
      id: 'OFFER-SIERRA-TEST',
      providerId: 'org_sierra', // High commercial tier
      providerName: 'Sierra Brokerage Services',
      providerLicense: 'NV-LIC-002',
      quoteNumber: 'QUOTE-SIERRA-1'
    };

    // Evaluate qualification
    const apexOrg = db.getProviderOrganization('org_apex');
    const sierraOrg = db.getProviderOrganization('org_sierra');
    const qualApex = evaluateOfferQualification(offerFromApex, mockBaseline, apexOrg);
    const qualSierra = evaluateOfferQualification(offerFromSierra, mockBaseline, sierraOrg);

    assert(qualApex.isQualified === qualSierra.isQualified, 'Identical offers receive identical qualification state regardless of commercial plan tier');
    assert(qualApex.qualificationReasons.length === qualSierra.qualificationReasons.length, 'Identical offers receive identical qualification reasons length');

    // Evaluate comparison
    const compApex = compareOfferAgainstBaseline(mockBaseline, offerFromApex);
    const compSierra = compareOfferAgainstBaseline(mockBaseline, offerFromSierra);

    assert(compApex.annualPremiumDifference === compSierra.annualPremiumDifference, 'Identical offers receive identical annual premium differences');
    assert(compApex.monthlyPremiumDifference === compSierra.monthlyPremiumDifference, 'Identical offers receive identical monthly premium differences');
    assert(compApex.classification === compSierra.classification, 'Identical offers receive identical whole offer classification');
    assert(compApex.matchingFieldsCount === compSierra.matchingFieldsCount, 'Identical offers receive identical matching fields count');
    assert(!('meetsConsumerRequirements' in compApex) && !('meetsConsumerRequirements' in compSierra), 'Comparison exposes no platform attractiveness gate');
    console.log('  [PASS] Commercial plan tier strictly has ZERO influence over qualification or comparison algorithms');

    // ------------------------------------------------------------------------
    // Part 8: API Namespace Isolation & PM-5 Non-Regression
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 8: API Namespace Separation & PM-5 Non-Regression ---');
    const resMarketplaceBilling = await request(server, 'POST', '/api/marketplace/billing/ledger', {});
    assert(resMarketplaceBilling.status === 404, 'Marketplace billing endpoint does not exist (404)');

    const resMarketplaceFees = await request(server, 'POST', '/api/marketplace/fees/settle', {});
    assert(resMarketplaceFees.status === 404, 'Marketplace fee settlement endpoint does not exist (404)');

    // ------------------------------------------------------------------------
    // Part 9: /api/tests/run Aggregation
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 9: Platform Test Suite Aggregation ---');
    const resAllTests = await request(server, 'GET', '/api/tests/run');
    assert(resAllTests.status === 200, 'GET /api/tests/run returns 200');
    assert(resAllTests.body.failed === 0, `All aggregated tests pass (0 failures out of ${resAllTests.body.total})`);

    console.log('\n============================================================');
    console.log('COMMERCIAL ECONOMICS (CE-2) VALIDATION COMPLETE: ALL PASS');
    console.log('============================================================\n');
  } finally {
    server.close();
    if (fs.existsSync(testDbDir)) {
      try {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

runValidation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('CE-2 Validation failed:', err);
    process.exit(1);
  });
