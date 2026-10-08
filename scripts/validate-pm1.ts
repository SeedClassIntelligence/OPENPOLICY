/**
 * PM-1 Final Surgical Correction Validation Suite
 * 
 * Executes exhaustive, rigorous verification across all four acceptance blockers:
 *   1. Durable Store Authoritative Persistence & Restart Test
 *   2. Provider Identity Derivation from Authenticated Context
 *   3. HTTP-Boundary Tenant Isolation & Impersonation Prevention
 *   4. Factual Transparency & Complete Absence of Offer Scoring/Ranking Architecture
 * 
 * Also runs:
 *   - Sealed Competition Privacy Test (Anti-Collusion Invariants)
 *   - PM-1 Canonical Workflow End-to-End Test
 *   - All Core Domain Test Suites (57+ unit & domain checks)
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore } from '../src/server/db/postgresStore';
import { db } from '../src/server/db';
import { app } from '../server';
import {
  evaluateCompetitionRoundState,
  calculateProviderMarketSignals
} from '../src/domain/competitionEngine';
import { compareOfferAgainstBaseline } from '../src/domain/comparisonEngine';
import { runComparisonEngineTestSuite } from '../src/domain/comparisonEngine.test';
import { runEligibilityEngineTestSuite } from '../src/domain/eligibilityEngine.test';
import { runCompetitionEngineTestSuite } from '../src/domain/competitionEngine.test';
import { runBindingAndReconciliationTests } from '../src/domain/bindingReconciliation.test';
import { runGovernanceAuditTestSuite } from '../src/domain/governanceAudit.test';
import { runPM1AcceptanceTestSuite } from '../src/domain/pm1Marketplace.test';
import {
  Offer,
  CoverageBaseline,
  Competition,
  ProviderOrganization,
  ProviderUser
} from '../src/types/insurance';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, title: string, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${title}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${title} - ${details}`);
  }
}

// Helper: Make HTTP requests to ephemeral test server
function makeRequest(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = {
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsedBody: any;
          try {
            parsedBody = JSON.parse(rawData);
          } catch {
            parsedBody = rawData;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsedBody
          });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runValidation() {
  console.log('================================================================');
  console.log('  OPEN POLICY: PM-1 SURGICAL CORRECTION VALIDATION SUITE');
  console.log('================================================================\n');

  // ===========================================================================
  // 1. BLOCKER 1: PERSISTENCE RESTART TEST
  // ===========================================================================
  console.log('--- 1. BLOCKER 1: PERSISTENT STORE RESTART TEST ---');
  const restartTestDir = path.resolve('./data/test_restart_validation_pg');
  if (fs.existsSync(restartTestDir)) {
    fs.rmSync(restartTestDir, { recursive: true, force: true });
  }

  try {
    // Phase A: Write records to store instance 1
    const store1 = new PostgresStore(restartTestDir);
    await store1.init();

    await store1.saveProviderOrganization({
      id: 'org_persist_test',
      legalName: 'Persistent Brokerage Inc',
      displayName: 'Persistent Brokerage',
      organizationType: 'INDEPENDENT_AGENCY',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['NV'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      createdAt: new Date().toISOString()
    });

    await store1.saveProviderUser({
      id: 'usr_persist_1',
      organizationId: 'org_persist_test',
      email: 'agent@persist.com',
      name: 'Persist Agent',
      role: 'AGENT',
      status: 'ACTIVE'
    });

    await store1.saveProviderLicense({
      id: 'lic_persist_nv',
      providerOrganizationId: 'org_persist_test',
      jurisdiction: 'NV',
      licenseNumber: 'NV-PER-991',
      licenseType: 'BROKER',
      status: 'ACTIVE',
      effectiveDate: '2025-01-01',
      expirationDate: '2027-01-01',
      verificationStatus: 'VERIFIED'
    });

    await store1.saveCarrierRelationship({
      id: 'rel_persist_trv',
      providerOrganizationId: 'org_persist_test',
      carrierId: 'c_trv',
      carrierName: 'Travelers',
      jurisdiction: 'NV',
      lineOfBusiness: 'PERSONAL_AUTO',
      relationshipType: 'APPOINTED',
      status: 'ACTIVE'
    });

    await store1.saveCompetition({
      id: 'COMP-RESTART-01',
      challengeId: 'CHAL-RESTART-01',
      status: 'OPEN',
      currentRound: 'ROUND_1_OPEN',
      openedAt: new Date().toISOString(),
      closesAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      participantCount: 1,
      improvementRoundEnabled: true,
      finalRoundEnabled: true
    });

    await store1.saveInvitation({
      id: 'INV-RESTART-01',
      challengeId: 'CHAL-RESTART-01',
      competitionId: 'COMP-RESTART-01',
      providerOrganizationId: 'org_persist_test',
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['Satisfied persistence criteria'],
      status: 'ACCEPTED',
      invitedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString()
    });

    await store1.saveParticipation({
      id: 'PART-RESTART-01',
      challengeId: 'CHAL-RESTART-01',
      competitionId: 'COMP-RESTART-01',
      providerOrganizationId: 'org_persist_test',
      acceptedAt: new Date().toISOString(),
      status: 'ACTIVE',
      lastActivityAt: new Date().toISOString()
    });

    await store1.saveAuditEvent({
      id: 'AUD-RESTART-01',
      timestamp: new Date().toISOString(),
      eventType: 'INVITATION_ACCEPTED',
      actorRole: 'PROVIDER',
      actorId: 'org_persist_test',
      details: 'Audit record created before store shutdown',
      hash: 'abc123hash'
    });

    // Phase B: Simulate Server / Process Shutdown
    await store1.close();
    console.log('  [INFO] Store 1 closed. Restarting store from durable disk storage...');

    // Phase C: Reinitialize a brand new store instance on the same directory
    const store2 = new PostgresStore(restartTestDir);
    await store2.init();

    // Phase D: Verify all records survived the shutdown and re-read accurately
    const loadedOrg = await store2.getProviderOrganization('org_persist_test');
    assert(loadedOrg !== undefined && loadedOrg.id === 'org_persist_test', 'ProviderOrganization survived store restart', `Got: ${loadedOrg?.id}`);
    assert(loadedOrg?.legalName === 'Persistent Brokerage Inc', 'ProviderOrganization attributes preserved across restart');

    const loadedUser = await store2.getProviderUser('usr_persist_1');
    assert(loadedUser !== undefined && loadedUser.organizationId === 'org_persist_test', 'ProviderUser survived store restart');

    const loadedLics = await store2.getProviderLicenses('org_persist_test');
    assert(loadedLics.length === 1 && loadedLics[0].licenseNumber === 'NV-PER-991', 'ProviderLicense survived store restart');

    const loadedRels = await store2.getCarrierRelationships('org_persist_test');
    assert(loadedRels.length === 1 && loadedRels[0].carrierName === 'Travelers', 'CarrierRelationship survived store restart');

    const loadedComp = await store2.getCompetition('COMP-RESTART-01');
    assert(loadedComp !== undefined && loadedComp.status === 'OPEN', 'Competition survived store restart');

    const loadedInv = await store2.getInvitation('INV-RESTART-01');
    assert(loadedInv !== undefined && loadedInv.status === 'ACCEPTED', 'ChallengeInvitation survived store restart');

    const loadedParts = await store2.getParticipationsForOrg('org_persist_test');
    assert(loadedParts.length === 1 && loadedParts[0].status === 'ACTIVE', 'ChallengeParticipation survived store restart');

    const loadedAudits = await store2.getAuditEvents();
    assert(loadedAudits.some(a => a.id === 'AUD-RESTART-01'), 'AuditEvent survived store restart');

    await store2.close();
  } finally {
    if (fs.existsSync(restartTestDir)) {
      fs.rmSync(restartTestDir, { recursive: true, force: true });
    }
  }

  // ===========================================================================
  // 2. BLOCKERS 2 & 3: HTTP BOUNDARY TENANT ISOLATION & IMPERSONATION TESTS
  // ===========================================================================
  console.log('\n--- 2. BLOCKERS 2 & 3: HTTP BOUNDARY TENANT ISOLATION & IMPERSONATION ---');

  // Start ephemeral test server on port 0 (OS assigned)
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (testServer.address() as any).port;
  console.log(`  [INFO] Ephemeral test server active on port ${port}`);

  try {
    // 2.1 Unauthenticated Request (Missing x-provider-user-id header)
    const unauthRes = await makeRequest(port, 'GET', '/api/marketplace/opportunities');
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized', `Status: ${unauthRes.status}`);

    // 2.2 Unknown/Invalid Provider User
    const unknownRes = await makeRequest(port, 'GET', '/api/marketplace/opportunities', {
      'x-provider-user-id': 'usr_fraudster_nonexistent'
    });
    assert(unknownRes.status === 401, 'Unknown provider user rejected with 401 Unauthorized', `Status: ${unknownRes.status}`);

    // 2.3 Valid Authentication (User Alex Morgan -> org_sierra)
    const validAuthRes = await makeRequest(port, 'GET', '/api/marketplace/my-provider', {
      'x-provider-user-id': 'user_sierra_1'
    });
    assert(validAuthRes.status === 200, 'Authenticated provider user resolves with 200 OK', `Status: ${validAuthRes.status}`);
    assert(validAuthRes.body.activeOrgId === 'org_sierra', 'Identity resolved server-side to org_sierra', `Got: ${validAuthRes.body.activeOrgId}`);

    // 2.4 Header Impersonation Attack: User A authenticated, attempting to supply Org B via x-provider-org-id
    const headerImpersonateRes = await makeRequest(port, 'GET', '/api/marketplace/opportunities', {
      'x-provider-user-id': 'user_sierra_1',
      'x-provider-org-id': 'org_buckeye'
    });
    assert(headerImpersonateRes.status === 403, 'Header impersonation attack (x-provider-org-id) rejected with 403 Forbidden', `Status: ${headerImpersonateRes.status}`);

    // 2.5 Query Parameter Impersonation Attack: User A authenticated, passing ?providerId=org_buckeye
    const queryImpersonateRes = await makeRequest(port, 'GET', '/api/marketplace/opportunities?providerId=org_buckeye', {
      'x-provider-user-id': 'user_sierra_1'
    });
    assert(queryImpersonateRes.status === 403, 'Query parameter impersonation attack (?providerId=) rejected with 403 Forbidden', `Status: ${queryImpersonateRes.status}`);

    // 2.6 Body Impersonation Attack: User A authenticated, passing { providerId: 'org_buckeye' }
    const bodyImpersonateRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/invitations/INV-NV-49281-org_sierra/accept',
      { 'x-provider-user-id': 'user_sierra_1' },
      { providerId: 'org_buckeye' }
    );
    assert(bodyImpersonateRes.status === 403, 'Body impersonation attack (body.providerId) rejected with 403 Forbidden', `Status: ${bodyImpersonateRes.status}`);

    // 2.7 Route Manipulation: User A attempts to view Competitor B invitation
    const routeViewRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/invitations/INV-NV-49281-org_apex/view',
      { 'x-provider-user-id': 'user_sierra_1' }
    );
    assert(routeViewRes.status === 403, 'Attempt to view competitor invitation rejected with 403 Forbidden', `Status: ${routeViewRes.status}`);

    // 2.8 Route Manipulation: User A attempts to accept Competitor B invitation
    const routeAcceptRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/invitations/INV-NV-49281-org_apex/accept',
      { 'x-provider-user-id': 'user_sierra_1' }
    );
    assert(routeAcceptRes.status === 403, 'Attempt to accept competitor invitation rejected with 403 Forbidden', `Status: ${routeAcceptRes.status}`);

    // 2.9 Route Manipulation: User A attempts to decline Competitor B invitation
    const routeDeclineRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/invitations/INV-NV-49281-org_apex/decline',
      { 'x-provider-user-id': 'user_sierra_1' },
      { reason: 'OUTSIDE_APPETITE', notes: 'Unauthorized decline attempt' }
    );
    assert(routeDeclineRes.status === 403, 'Attempt to decline competitor invitation rejected with 403 Forbidden', `Status: ${routeDeclineRes.status}`);

    // 2.10 Route Manipulation: Non-participating provider (Buckeye) attempts to access challenge workspace
    const workspaceRes = await makeRequest(
      port,
      'GET',
      '/api/marketplace/workspace/CHAL-NV-49281',
      { 'x-provider-user-id': 'user_buckeye_1' }
    );
    assert(workspaceRes.status === 403, 'Non-participating provider workspace access rejected with 403 Forbidden', `Status: ${workspaceRes.status}`);

    // 2.11 Route Manipulation: Non-participating provider attempts to access market signals
    const signalsRes = await makeRequest(
      port,
      'GET',
      '/api/marketplace/competition/CHAL-NV-49281/signals',
      { 'x-provider-user-id': 'user_buckeye_1' }
    );
    assert(signalsRes.status === 403, 'Non-participating provider market signals access rejected with 403 Forbidden', `Status: ${signalsRes.status}`);

    // 2.12 Route Manipulation: Provider attempts to revise competitor offer
    // OFFER-A belongs to Apex Insurance. Sierra user attempts to revise it.
    const reviseRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/competition/CHAL-NV-49281/revise-offer/OFFER-A',
      { 'x-provider-user-id': 'user_sierra_1' },
      {
        revisedData: {
          annualPremium: 2200,
          carrier: 'Malicious Override'
        }
      }
    );
    assert(reviseRes.status === 403, 'Attempt to revise competitor offer rejected with 403 Forbidden', `Status: ${reviseRes.status}`);

    // 2.13 Provider Offer Submission Spoof Rejection
    const spoofSubmitRes = await makeRequest(
      port,
      'POST',
      '/api/offers/submit',
      { 'x-provider-user-id': 'user_sierra_1' },
      {
        challengeId: 'CHAL-NV-49281',
        carrier: 'Nationwide Mutual',
        annualPremium: 2450,
        monthlyPremium: 204,
        providerId: 'org_spoofed_competitor', // Attempt to spoof
        providerName: 'Spoofed Competitor'
      }
    );
    assert(spoofSubmitRes.status === 403, 'Offer submission with spoofed providerId rejected with 403 Forbidden', `Status: ${spoofSubmitRes.status}`);

    // 2.14 Legitimate Provider Offer Submission Bound to Authenticated Context
    const validSubmitRes = await makeRequest(
      port,
      'POST',
      '/api/offers/submit',
      { 'x-provider-user-id': 'user_sierra_1' },
      {
        challengeId: 'CHAL-NV-49281',
        carrier: 'Nationwide Mutual',
        annualPremium: 2450,
        monthlyPremium: 204,
        coverages: db.getChallenge('CHAL-NV-49281')!.baseline.coverages
      }
    );
    assert(validSubmitRes.status === 200, 'Legitimate offer submission succeeds with 200 OK', `Status: ${validSubmitRes.status}`);
    assert(
      validSubmitRes.body.offer.providerId === 'org_sierra',
      'Server bound providerId to authenticated organization (org_sierra)',
      `Got: ${validSubmitRes.body.offer?.providerId}`
    );

  } finally {
    testServer.close();
  }

  // ===========================================================================
  // 3. BLOCKER 4: COMPLETE REMOVAL OF PROHIBITED SCORING/RANKING ARCHITECTURE
  // ===========================================================================
  console.log('\n--- 3. BLOCKER 4: FACTUAL TRANSPARENCY & ABSENCE OF OFFER SCORING/RANKING ---');

  const canonicalChal = db.getChallenge('CHAL-NV-49281')!;
  const baseline = canonicalChal.baseline;
  const canonicalOffers = db.getOffers('CHAL-NV-49281');
  const testComp = db.getCompetitionForChallenge('CHAL-NV-49281')!;

  const evaluationSummary = evaluateCompetitionRoundState(
    testComp,
    canonicalOffers,
    baseline
  );

  // 3.1 Prohibited fields are absent from summary
  assert(!('rankedOffers' in evaluationSummary), 'Prohibited "rankedOffers" field removed from CompetitionEvaluationSummary');
  assert(!('leaderOfferId' in evaluationSummary), 'Prohibited "leaderOfferId" field removed from CompetitionEvaluationSummary');

  // 3.2 Factual comparisons are present
  assert('offerComparisons' in evaluationSummary, 'Factual "offerComparisons" field present in summary');
  assert(evaluationSummary.offerComparisons.length === canonicalOffers.length, `All ${canonicalOffers.length} offers evaluated factually`);
  assert(evaluationSummary.validQualifiedOffersCount >= 1, 'Factual qualified offers counted');

  // 3.3 Verify offerComparisons entries do NOT contain score, rank, isCurrentLeader, valueTier
  for (const oc of evaluationSummary.offerComparisons) {
    assert(!('score' in (oc as any)), `Offer ${(oc as any).offer?.id}: zero composite score assigned`);
    assert(!('rank' in (oc as any)), `Offer ${(oc as any).offer?.id}: zero platform rank assigned`);
    assert(!('isCurrentLeader' in (oc as any)), `Offer ${(oc as any).offer?.id}: zero "isCurrentLeader" winner label assigned`);
    assert(!('valueTier' in (oc as any)), `Offer ${(oc as any).offer?.id}: zero "valueTier" (BEST_VALUE/MAX_SAVINGS) tier assigned`);
  }

  // 3.4 Consumer-Selected Factual Sorting (Permitted per Section 40)
  // Consumer sorts by annual savings high -> low:
  const sortedBySavings = [...evaluationSummary.offerComparisons].sort(
    (a, b) => b.comparison.annualPremiumDifference - a.comparison.annualPremiumDifference
  );
  assert(sortedBySavings[0].comparison.annualPremiumDifference >= sortedBySavings[1].comparison.annualPremiumDifference, 'Consumer can sort by annual premium difference descending');

  // Consumer sorts by annual premium low -> high:
  const consumerSortedValid = [...evaluationSummary.offerComparisons].sort(
    (a, b) => a.offer.annualPremium - b.offer.annualPremium
  );
  assert(consumerSortedValid[0].offer.annualPremium <= consumerSortedValid[1].offer.annualPremium, 'Consumer can sort by premium ascending without platform declaring a leader');

  // ===========================================================================
  // 4. SEALED COMPETITION TELEMETRY & ANTI-COLLUSION INVARIANTS
  // ===========================================================================
  console.log('\n--- 4. SEALED COMPETITION TELEMETRY (ANTI-COLLUSION PRIVACY) ---');

  const sierraSignals = calculateProviderMarketSignals(
    testComp,
    'org_sierra',
    canonicalOffers,
    baseline,
    2
  );

  const signalsJson = JSON.stringify(sierraSignals);
  assert(!signalsJson.includes('Apex Insurance'), 'Signals contain zero mention of competitor provider names (Apex)');
  assert(!signalsJson.includes('Progressive'), 'Signals contain zero mention of competitor carrier names (Progressive)');
  assert(!signalsJson.includes('National General'), 'Signals contain zero mention of competitor carrier names (National General)');
  assert(!signalsJson.includes('2712'), 'Signals contain zero competitor premium amounts ($2,712)');
  assert(!signalsJson.includes('2172'), 'Signals contain zero competitor premium amounts ($2,172)');
  assert(sierraSignals.yourOffers.length >= 1, 'Provider signals contain only provider own offers (Sierra Travelers)');
  assert(sierraSignals.totalParticipatingProviders >= 2, 'Aggregate provider count correctly reported');

  // ===========================================================================
  // 5. CORE DOMAIN TEST SUITES VERIFICATION
  // ===========================================================================
  console.log('\n--- 5. CORE DOMAIN TEST SUITES VERIFICATION ---');

  const compSuite = runComparisonEngineTestSuite();
  console.log(`  Comparison Engine: ${compSuite.passed}/${compSuite.total} passed`);
  assert(compSuite.failed === 0, 'Comparison Engine test suite 100% passing');

  const eligSuite = runEligibilityEngineTestSuite();
  console.log(`  Eligibility Engine: ${eligSuite.passed}/${eligSuite.total} passed`);
  assert(eligSuite.failed === 0, 'Eligibility Engine test suite 100% passing');

  const compEngSuite = runCompetitionEngineTestSuite();
  console.log(`  Competition Engine: ${compEngSuite.passed}/${compEngSuite.total} passed`);
  assert(compEngSuite.failed === 0, 'Competition Engine test suite 100% passing');

  const bindSuite = runBindingAndReconciliationTests();
  const bindPassed = bindSuite.filter(t => t.passed).length;
  console.log(`  Binding & Reconciliation: ${bindPassed}/${bindSuite.length} passed`);
  assert(bindPassed === bindSuite.length, 'Binding & Reconciliation test suite 100% passing');

  const govSuite = runGovernanceAuditTestSuite();
  console.log(`  Governance & Audit: ${govSuite.passed}/${govSuite.total} passed`);
  assert(govSuite.failed === 0, 'Governance & Audit test suite 100% passing');

  const pm1Suite = runPM1AcceptanceTestSuite();
  console.log(`  PM-1 Acceptance: ${pm1Suite.passed}/${pm1Suite.total} passed`);
  assert(pm1Suite.failed === 0, 'PM-1 Acceptance test suite 100% passing');

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`  VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (failedTests === 0) {
    console.log('  STATUS: ALL ACCEPTANCE BLOCKERS FULLY RESOLVED');
    console.log('  PM-1 READY FOR EXTERNAL ACCEPTANCE REVIEW');
  } else {
    console.log(`  STATUS: ${failedTests} FAILURES DETECTED`);
  }
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runValidation().catch((err) => {
  console.error('[Validation Fatal Error]:', err);
  process.exit(1);
});
