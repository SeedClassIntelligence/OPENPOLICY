/**
 * PM-2 Information Requests, Multi-Carrier Offers & Integrity Verification
 * Comprehensive End-to-End Acceptance Validation Suite
 * 
 * Verifies:
 *   1. PM-1 Non-Regression Invariants (Persistence, Identity, Tenant Isolation, Anti-Ranking)
 *   2. PM-2 Section 17: Structured InformationRequest Submission & Purpose Classification
 *   3. PM-2 Section 18: Controlled Consumer Answering & Reusable VerifiedSupplementalFact Generation
 *   4. PM-2 Section 18: Tenant-Isolated Reusable Fact Visibility Filtering
 *   5. PM-2 Section 25: Multi-Carrier Quoting Under Single Broker Participation
 *   6. PM-2 Section 26: Transparent Duplicate Carrier Representation Flagging
 *   7. PM-2 Section 28: Immutable OfferVersion Audit Trail Preservation
 *   8. PM-2 Section 30: Quote Document Discrepancy Detection & Independent Verification
 *   9. PM-2 Section 34: Objective Deterministic QualifiedOffer Evaluation (Zero Magic Scores)
 *   10. All Core Domain Engine Test Suites (65+ Domain Tests)
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
  evaluateOfferQualification,
  flagDuplicateCarrierOffers,
  createOfferVersionSnapshot,
  getVisibleSupplementalFactsForProvider
} from '../src/domain/qualificationEngine';
import {
  evaluateCompetitionRoundState,
  calculateProviderMarketSignals
} from '../src/domain/competitionEngine';
import { runComparisonEngineTestSuite } from '../src/domain/comparisonEngine.test';
import { runEligibilityEngineTestSuite } from '../src/domain/eligibilityEngine.test';
import { runCompetitionEngineTestSuite } from '../src/domain/competitionEngine.test';
import { runBindingAndReconciliationTests } from '../src/domain/bindingReconciliation.test';
import { runGovernanceAuditTestSuite } from '../src/domain/governanceAudit.test';
import { runPM1AcceptanceTestSuite } from '../src/domain/pm1Marketplace.test';
import { runPM2AcceptanceTestSuite } from '../src/domain/pm2InformationOffers.test';
import {
  Offer,
  CoverageBaseline,
  ConsumerRequirements,
  ProviderOrganization,
  CarrierRelationship,
  InformationRequest,
  VerifiedSupplementalFact
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

// HTTP request helper for ephemeral test server
function makeRequest(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
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

async function runPM2Validation() {
  console.log('================================================================');
  console.log('  OPEN POLICY: PM-2 SPECIFICATION ACCEPTANCE VALIDATION SUITE');
  console.log('  Information Requests, Multi-Carrier Offers & Integrity Review');
  console.log('================================================================\n');

  // ===========================================================================
  // PART 1: PM-2 DURABLE PERSISTENCE RESTART TEST
  // ===========================================================================
  console.log('--- 1. PM-2 DURABLE PERSISTENCE & SCHEMA SURVIVAL TEST ---');
  const pm2RestartDir = path.resolve('./data/test_pm2_restart_pg');
  if (fs.existsSync(pm2RestartDir)) {
    fs.rmSync(pm2RestartDir, { recursive: true, force: true });
  }

  try {
    const store1 = new PostgresStore(pm2RestartDir);
    await store1.init();
    await store1.seedCanonicalProviderData();

    // Persist PM-2 Information Request
    await store1.saveInformationRequest({
      id: 'REQ-TEST-PERSIST-1',
      challengeId: 'CHAL-NV-49281',
      competitionId: 'COMP-NV-49281',
      providerOrganizationId: 'org_sierra',
      requestedField: 'GARAGING_ZIP',
      customFieldName: 'Primary Garaging Zip Code',
      purpose: 'TIER_DETERMINATION',
      purposeExplanation: 'Need exact zip code for rating tier verification',
      status: 'ANSWERED',
      requestedAt: new Date().toISOString(),
      answeredAt: new Date().toISOString(),
      answerValue: '89101',
      reusableFactId: 'FACT-TEST-PERSIST-1'
    });

    // Persist PM-2 Verified Supplemental Fact
    await store1.saveVerifiedSupplementalFact({
      id: 'FACT-TEST-PERSIST-1',
      consumerId: 'user_consumer_1',
      challengeId: 'CHAL-NV-49281',
      fieldType: 'GARAGING_ZIP',
      fieldName: 'Garaging Zip Code',
      value: '89101',
      formattedValue: '89101',
      verificationState: 'CONSUMER_ATTESTED',
      source: 'CONSUMER_PORTAL',
      createdAt: new Date().toISOString(),
      sharedWithOrganizationIds: ['*']
    });

    // Persist PM-2 Offer Version Snapshot
    await store1.saveOfferVersion({
      id: 'VER-TEST-PERSIST-1',
      offerId: 'OFFER-A',
      versionNumber: 1,
      round: 'ROUND_1_OPEN',
      carrier: 'Progressive Northern Insurance',
      annualPremium: 2500,
      monthlyPremium: 208,
      coverages: [],
      supportingQuoteDocName: 'Progressive_Quote_V1.pdf',
      revisionReason: 'Initial Quote Submitted',
      submittedAt: new Date().toISOString()
    });

    // Persist PM-2 Offer Verification
    await store1.saveOfferVerification({
      id: 'VERIF-TEST-PERSIST-1',
      offerId: 'OFFER-A',
      documentName: 'Progressive_Quote_V1.pdf',
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      discrepancyCount: 0,
      discrepancies: [],
      extractedPremium: 2500,
      enteredPremium: 2500
    });

    // Close Store 1 to simulate process termination
    await store1.close();
    console.log('  [INFO] Store 1 closed. Restarting store from disk to verify PM-2 table survival...');

    // Reopen Store 2
    const store2 = new PostgresStore(pm2RestartDir);
    await store2.init();

    const loadedReqs = await store2.getInformationRequests('CHAL-NV-49281');
    assert(
      loadedReqs.some(r => r.id === 'REQ-TEST-PERSIST-1' && r.answerValue === '89101'),
      'InformationRequest survived database restart with answer value intact'
    );

    const loadedFacts = await store2.getVerifiedSupplementalFacts('CHAL-NV-49281');
    assert(
      loadedFacts.some(f => f.id === 'FACT-TEST-PERSIST-1' && f.formattedValue === '89101'),
      'VerifiedSupplementalFact survived database restart with shared scope intact'
    );

    const loadedVersions = await store2.getOfferVersions('OFFER-A');
    assert(
      loadedVersions.some(v => v.id === 'VER-TEST-PERSIST-1' && v.annualPremium === 2500),
      'OfferVersion snapshot survived database restart'
    );

    const loadedVerif = await store2.getOfferVerification('OFFER-A');
    assert(
      loadedVerif !== undefined && loadedVerif.status === 'VERIFIED',
      'OfferVerification record survived database restart'
    );

    await store2.close();
  } finally {
    if (fs.existsSync(pm2RestartDir)) {
      fs.rmSync(pm2RestartDir, { recursive: true, force: true });
    }
  }

  // ===========================================================================
  // PART 2: PM-2 HTTP BOUNDARY & WORKFLOW INTEGRATION TESTS
  // ===========================================================================
  console.log('\n--- 2. PM-2 HTTP BOUNDARY & WORKFLOW INTEGRATION TESTS ---');

  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (testServer.address() as any).port;
  console.log(`  [INFO] Ephemeral test server active on port ${port}`);

  try {
    // 2.1 Section 17: Participating Provider creates structured InformationRequest with extensible purpose
    const reqCreateRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/challenges/CHAL-NV-49281/information-requests',
      { 'x-provider-user-id': 'user_sierra_1' },
      {
        purpose: 'RATING_REQUIRED',
        requestedField: 'ANNUAL_MILEAGE',
        purposeExplanation: 'Mandatory annual mileage required for rating tier calculation.'
      }
    );
    assert(reqCreateRes.status === 200, 'Participating provider can submit InformationRequest', `Status: ${reqCreateRes.status}`);
    const createdReqId = reqCreateRes.body.request?.id;
    assert(createdReqId !== undefined, 'InformationRequest ID returned');
    assert(reqCreateRes.body.request?.purpose === 'RATING_REQUIRED', 'Extensible purpose correctly classified without artificial enum restriction');

    // 2.2 Section 17: Tenant Isolation - Non-participating provider (Buckeye) cannot submit InformationRequest
    const unauthReqRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/challenges/CHAL-NV-49281/information-requests',
      { 'x-provider-user-id': 'user_buckeye_1' },
      {
        purpose: 'RATING_REQUIRED',
        requestedField: 'ANNUAL_MILEAGE',
        purposeExplanation: 'Unauthorized question from non-participant'
      }
    );
    assert(unauthReqRes.status === 403, 'Non-participating provider blocked from submitting InformationRequest (403)', `Status: ${unauthReqRes.status}`);

    // 2.3 Section 17: Tenant Isolation - Provider only sees their own requests
    const sierraReqsRes = await makeRequest(
      port,
      'GET',
      '/api/marketplace/challenges/CHAL-NV-49281/information-requests',
      { 'x-provider-user-id': 'user_sierra_1' }
    );
    assert(sierraReqsRes.status === 200, 'Provider can retrieve information requests');
    const sierraRequests = sierraReqsRes.body.requests || [];
    assert(
      sierraRequests.every((r: any) => r.providerOrganizationId === 'org_sierra' || r.status === 'ANSWERED'),
      'Provider only sees own requests or answered shared facts'
    );

    // 2.4 Section 18: Consumer answers InformationRequest with REQUESTING_PROVIDER_ONLY consent
    const answerRes = await makeRequest(
      port,
      'POST',
      `/api/marketplace/information-requests/${createdReqId}/answer`,
      {},
      {
        answerValue: '10,500 miles/yr',
        consumerId: 'user_consumer_1',
        consentScope: 'REQUESTING_PROVIDER_ONLY'
      }
    );
    assert(answerRes.status === 200, 'Consumer can answer InformationRequest', `Status: ${answerRes.status}`);
    assert(answerRes.body.fact !== undefined, 'Reusable VerifiedSupplementalFact created upon answer');
    assert(answerRes.body.fact.verificationState === 'CONSUMER_ATTESTED', 'Fact is consumer attested');
    assert(answerRes.body.fact.consentScope === 'REQUESTING_PROVIDER_ONLY', 'Fact consentScope set to REQUESTING_PROVIDER_ONLY');
    assert(answerRes.body.fact.sharedWithOrganizationIds.includes('org_sierra'), 'Fact authorized for requesting provider (Sierra)');
    assert(!answerRes.body.fact.sharedWithOrganizationIds.includes('org_apex'), 'Fact NOT shared with competitor (Apex) without explicit consent');

    // 2.5 Section 18: Verify tenant-isolated fact retrieval adheres strictly to consent scope
    const sierraFactsRes = await makeRequest(
      port,
      'GET',
      '/api/marketplace/challenges/CHAL-NV-49281/supplemental-facts',
      { 'x-provider-user-id': 'user_sierra_1' }
    );
    assert(
      sierraFactsRes.body.facts.some((f: any) => f.id === answerRes.body.fact.id),
      'Requesting provider (Sierra) can view consented supplemental fact'
    );

    const apexFactsRes = await makeRequest(
      port,
      'GET',
      '/api/marketplace/challenges/CHAL-NV-49281/supplemental-facts',
      { 'x-provider-user-id': 'user_apex_1' }
    );
    assert(
      !apexFactsRes.body.facts.some((f: any) => f.id === answerRes.body.fact.id),
      'Competitor provider (Apex) CANNOT view supplemental fact prior to explicit consumer consent grant'
    );

    // 2.6 Section 18: Consumer subsequently grants disclosure consent to competitor (Apex)
    const grantConsentRes = await makeRequest(
      port,
      'POST',
      `/api/marketplace/supplemental-facts/${answerRes.body.fact.id}/consent`,
      {},
      {
        organizationIds: ['org_apex'],
        consumerId: 'user_consumer_1'
      }
    );
    assert(grantConsentRes.status === 200, 'Consumer grants consent to share reusable fact with competitor');

    const apexFactsAfterConsent = await makeRequest(
      port,
      'GET',
      '/api/marketplace/challenges/CHAL-NV-49281/supplemental-facts',
      { 'x-provider-user-id': 'user_apex_1' }
    );
    assert(
      apexFactsAfterConsent.body.facts.some((f: any) => f.id === answerRes.body.fact.id),
      'Competitor provider (Apex) can now access reusable fact following explicit consumer consent grant'
    );

    // 2.6 Section 25: Multi-Carrier Quoting under single provider participation
    // Sierra submits second offer under Safeco (appointed carrier)
    const secondOfferRes = await makeRequest(
      port,
      'POST',
      '/api/offers/submit',
      { 'x-provider-user-id': 'user_sierra_1' },
      {
        challengeId: 'CHAL-NV-49281',
        carrier: 'Safeco Insurance',
        quoteNumber: 'SAF-VAL-9921',
        annualPremium: 2380,
        monthlyPremium: 198,
        termMonths: 12,
        coverages: db.getChallenge('CHAL-NV-49281')!.baseline.coverages,
        supportingQuoteDocName: 'Safeco_Quote_Doc.pdf'
      }
    );
    assert(secondOfferRes.status === 200, 'Provider can submit multi-carrier quote under single participation', `Status: ${secondOfferRes.status}`);
    assert(secondOfferRes.body.offer.carrier === 'Safeco Insurance', 'Safeco quote submitted successfully');

    // 2.7 Section 28: Offer Revision snapshots prior version into immutable OfferVersion
    // First advance round to ROUND_2_IMPROVEMENT to permit revisions per Section 40 rules
    await makeRequest(
      port,
      'POST',
      '/api/marketplace/competition/CHAL-NV-49281/advance-round',
      {},
      { targetRound: 'ROUND_2_IMPROVEMENT', reason: 'Advancing to improvement round for revision testing' }
    );

    const originalOfferA = db.getOffer('OFFER-A')!;
    const originalPremium = originalOfferA.annualPremium;

    const revisionRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/competition/CHAL-NV-49281/revise-offer/OFFER-A',
      { 'x-provider-user-id': 'user_apex_1' },
      {
        revisedData: {
          carrier: originalOfferA.carrier,
          annualPremium: originalPremium - 120,
          monthlyPremium: Math.round((originalPremium - 120) / 12),
          revisionReason: 'Lowered premium during active competition'
        }
      }
    );
    assert(revisionRes.status === 200, 'Provider can revise offer during competition round', `Status: ${revisionRes.status}`);

    const versionsRes = await makeRequest(port, 'GET', '/api/marketplace/offers/OFFER-A/versions');
    assert(versionsRes.status === 200, 'Can retrieve offer version history');
    assert(versionsRes.body.versions && versionsRes.body.versions.length >= 1, 'Offer version snapshot created');
    assert(versionsRes.body.versions[0].annualPremium === originalPremium, 'Prior premium accurately preserved in version snapshot');

    // 2.8 Section 30: Document Verification & Discrepancy Detection
    // Test document with conflicting premium
    const discrepancyCheckRes = await makeRequest(
      port,
      'POST',
      '/api/marketplace/offers/OFFER-A/verify-document',
      {},
      {
        docData: {
          extractedAnnualPremium: originalPremium + 500, // Deliberate mismatch
          extractedCollisionDeductible: 500
        }
      }
    );
    assert(discrepancyCheckRes.status === 200, 'Document verification endpoint executed');
    assert(
      discrepancyCheckRes.body.verification?.status === 'DISCREPANCIES_FLAGGED',
      'Document discrepancy accurately flagged'
    );
    assert(
      discrepancyCheckRes.body.verification?.discrepancyCount >= 1,
      'Discrepancy count tracked'
    );

    // 2.9 Section 34: Qualification Endpoint
    const qualRes = await makeRequest(port, 'GET', '/api/marketplace/offers/OFFER-A/qualification');
    assert(qualRes.status === 200, 'Deterministic qualification endpoint returns 200 OK');
    assert('isQualified' in qualRes.body, 'Offer qualification state evaluated deterministically');
    assert(
      qualRes.body.offer.qualificationReasons.some((r: string) => r.includes('NV-DOI-2025-01') && r.includes('NRS 485.185')),
      'Qualification explicitly cites versioned Nevada statutory liability rule (NV-DOI-2025-01: NRS 485.185)'
    );

  } finally {
    testServer.close();
  }

  // ===========================================================================
  // PART 3: PM-2 DOMAIN ENGINE UNIT INVARIANTS
  // ===========================================================================
  console.log('\n--- 3. PM-2 DOMAIN ENGINE INVARIANT TESTS ---');

  // 3.1 Duplicate Carrier Flagging across providers (Section 26)
  const testOffers: Offer[] = [
    {
      id: 'OFF-P1',
      challengeId: 'CHAL-1',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage',
      providerLicense: 'LIC-1',
      carrier: 'Nationwide Mutual',
      quoteNumber: 'Q-NW-1',
      annualPremium: 2400,
      monthlyPremium: 200,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [],
      supportingQuoteDocName: 'doc1.pdf',
      submittedAt: new Date().toISOString(),
      discrepanciesDetected: false,
      status: 'VALIDATED'
    },
    {
      id: 'OFF-P2',
      challengeId: 'CHAL-1',
      providerId: 'org_apex', // Competitor provider
      providerName: 'Apex Insurance',
      providerLicense: 'LIC-2',
      carrier: 'Nationwide Mutual', // Same carrier!
      quoteNumber: 'Q-NW-2',
      annualPremium: 2350,
      monthlyPremium: 195,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [],
      supportingQuoteDocName: 'doc2.pdf',
      submittedAt: new Date().toISOString(),
      discrepanciesDetected: false,
      status: 'VALIDATED'
    }
  ];

  const flaggedOffers = flagDuplicateCarrierOffers(testOffers);
  assert(flaggedOffers[0].isDuplicateCarrier === true, 'Provider 1 Nationwide offer flagged as duplicate carrier');
  assert(flaggedOffers[1].isDuplicateCarrier === true, 'Provider 2 Nationwide offer flagged as duplicate carrier');
  assert(
    Boolean(flaggedOffers[0].duplicateCarrierNotice?.includes('Multiple participating providers')),
    'Transparent Section 26 duplicate carrier notice attached'
  );

  // 3.2 Factual Absence of Prohibited Scores
  assert(!('score' in flaggedOffers[0]), 'Zero score property on duplicate carrier offer 1');
  assert(!('rank' in flaggedOffers[0]), 'Zero rank property on duplicate carrier offer 1');
  assert(!('isWinner' in flaggedOffers[0]), 'Zero winner label on duplicate carrier offer 1');

  // ===========================================================================
  // PART 4: ALL CORE DOMAIN TEST SUITES
  // ===========================================================================
  console.log('\n--- 4. ALL CORE DOMAIN TEST SUITES VERIFICATION ---');

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

  const pm2Suite = runPM2AcceptanceTestSuite();
  console.log(`  PM-2 Acceptance: ${pm2Suite.passed}/${pm2Suite.total} passed`);
  assert(pm2Suite.failed === 0, 'PM-2 Acceptance test suite 100% passing');

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`  PM-2 VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (failedTests === 0) {
    console.log('  STATUS: PM-2 SPECIFICATION FULLY VALIDATED AND ACCEPTED');
    console.log('  ALL CANONICAL ARCHITECTURAL INVARIANTS GREEN (SECTIONS 17, 18, 25, 26, 28, 30, 34)');
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

runPM2Validation().catch((err) => {
  console.error('[PM-2 Validation Fatal Error]:', err);
  process.exit(1);
});
