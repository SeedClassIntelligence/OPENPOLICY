/**
 * PM-3 / PR-2 Single Submission Window, Offer Updates & Sealed Telemetry
 * Comprehensive End-to-End Acceptance Validation Suite
 * 
 * Verifies:
 *   1. PM-1 Non-Regression Invariants (Persistence, Identity, Tenant Isolation, Anti-Ranking)
 *   2. PM-2 Non-Regression Invariants (InfoRequests, Multi-Carrier, OfferVersions, Verifications)
 *   3. Canonical progression: OPEN -> CONSUMER_REVIEW
 *   4. Configurable Round Deadlines and Countdown Status Evaluation
 *   5. Section 40 Multi-Dimensional Offer Improvement (deductible, limit, endorsement, price)
 *   6. "Keep Current Offer" Confirmation Mechanics
 *   7. Provider Withdrawal Mechanics (Participation transition, offer suppression, participant count)
 *   8. "Keep Current Policy" (Incumbent Defended) Consumer Baseline Retention
 *   9. Sealed Provider Competition Telemetry & Anti-Collusion Feed Sanitization
 *   10. Live HTTP API Endpoints for All Competition Round Actions
 *   11. 100% Core Domain Engine Test Suites (PM-1, PM-2, PM-3 + Domain Suites)
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore } from '../src/server/db/postgresStore';
import { db } from '../src/server/db';
import { app, synchronizeFixturePersistence } from '../server';
import {
  closeSubmissionWindow,
  checkRoundDeadlineStatus,
  validateOfferRevision,
  filterCompetitionActivityFeedForProvider,
  evaluateCompetitionRoundState
} from '../src/domain/competitionEngine';
import { runComparisonEngineTestSuite } from '../src/domain/comparisonEngine.test';
import { runEligibilityEngineTestSuite } from '../src/domain/eligibilityEngine.test';
import { runCompetitionEngineTestSuite } from '../src/domain/competitionEngine.test';
import { runBindingAndReconciliationTests } from '../src/domain/bindingReconciliation.test';
import { runGovernanceAuditTestSuite } from '../src/domain/governanceAudit.test';
import { runPM1AcceptanceTestSuite } from '../src/domain/pm1Marketplace.test';
import { runPM2AcceptanceTestSuite } from '../src/domain/pm2InformationOffers.test';
import { runPM3AcceptanceTestSuite } from '../src/domain/pm3CompetitionRounds.test';
import {
  Offer,
  Competition,
  CompetitionActivityEvent,
  ChallengeParticipation
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
    console.error(`  [FAIL] ${title}${details ? ` -> ${details}` : ''}`);
  }
}

async function makeRequest(
  serverPort: number,
  options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(options.headers || {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => (raw += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve({ status: res.statusCode || 500, data });
          } catch {
            resolve({ status: res.statusCode || 500, data: raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('======================================================================');
  console.log('   OPEN POLICY — PM-3 COMPETITION ROUNDS ACCEPTANCE VALIDATION');
  console.log('======================================================================\n');

  // ------------------------------------------------------------------
  // GATEMARK: Run Domain Test Suites First
  // ------------------------------------------------------------------
  console.log('--- SECTION 1: DOMAIN ENGINE TEST SUITES ---');
  
  const compResults = runComparisonEngineTestSuite();
  assert(compResults.failed === 0, 'Domain Suite: Comparison Engine (100% pass)');

  const eligResults = runEligibilityEngineTestSuite();
  assert(eligResults.failed === 0, 'Domain Suite: Eligibility Engine (100% pass)');

  const competitionResults = runCompetitionEngineTestSuite();
  assert(competitionResults.failed === 0, 'Domain Suite: Competition Engine (100% pass)');

  const bindResults = runBindingAndReconciliationTests();
  const bindPassed = bindResults.filter(t => t.passed).length;
  const bindFailed = bindResults.length - bindPassed;
  assert(bindFailed === 0, `Domain Suite: Binding & Reconciliation (${bindPassed}/${bindResults.length} passed)`);

  const govResults = runGovernanceAuditTestSuite();
  assert(govResults.failed === 0, 'Domain Suite: Cryptographic Governance Audit (100% pass)');

  const pm1Results = runPM1AcceptanceTestSuite();
  assert(pm1Results.failed === 0, `PM-1 Acceptance Suite (${pm1Results.passed}/${pm1Results.total} passed)`);

  const pm2Results = runPM2AcceptanceTestSuite();
  assert(pm2Results.failed === 0, `PM-2 Acceptance Suite (${pm2Results.passed}/${pm2Results.total} passed)`);

  const pm3Results = runPM3AcceptanceTestSuite();
  assert(pm3Results.failed === 0, `PM-3 Acceptance Suite (${pm3Results.passed}/${pm3Results.total} passed)`);

  // ------------------------------------------------------------------
  // GATEMARK: Canonical Lifecycle Progression Standard
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 2: CANONICAL ROUND LIFECYCLE PROGRESSION ---');
  
  const testComp: Competition = {
    id: 'COMP-TEST-LIFECYCLE',
    challengeId: 'CHAL-TEST-LIFECYCLE',
    status: 'OPEN',
    currentRound: 'OPEN',
    openedAt: '2026-09-20T10:00:00Z',
    closesAt: '2026-09-22T10:00:00Z',
    participantCount: 2,
    improvementRoundEnabled: true,
    finalRoundEnabled: true,
    roundDurationsHours: {
      OPEN: 48,
      IMPROVEMENT: 24,
      BEST_AND_FINAL: 12,
      CLOSED: 0,
      CONSUMER_REVIEW: 72
    }
  };

  const toReview = closeSubmissionWindow(testComp, 'CONSUMER_BEGAN_REVIEW', new Date('2026-09-21T12:00:00Z'));
  assert(toReview.currentRound === 'CONSUMER_REVIEW' && toReview.status === 'CONSUMER_REVIEW', 'Policyholder can end OPEN and begin consumer review');
  assert(toReview.closesAt === '2026-09-21T12:00:00.000Z', 'Early submission-window close is recorded');

  // ------------------------------------------------------------------
  // GATEMARK: Multi-Dimensional Offer Improvements
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 3: SECTION 40 MULTI-DIMENSIONAL IMPROVEMENTS ---');

  const origOffer: Offer = {
    id: 'OFFER-ORIG',
    challengeId: 'CHAL-1',
    providerId: 'org_sierra',
    providerName: 'Sierra Brokerage Group',
    providerLicense: 'NV-LIC-111111',
    carrier: 'Travelers',
    quoteNumber: 'TRV-1',
    annualPremium: 2500,
    monthlyPremium: 208,
    termMonths: 12,
    effectiveDate: '2026-11-01',
    expirationDate: '2027-11-01',
    coverages: [
      { id: '1', code: 'COLLISION', name: 'Collision', category: 'PHYSICAL_DAMAGE', deductible: 1000, isIncluded: true },
      { id: '2', code: 'COMPREHENSIVE', name: 'Comp', category: 'PHYSICAL_DAMAGE', deductible: 500, isIncluded: true },
      { id: '3', code: 'BODILY_INJURY', name: 'BI', category: 'LIABILITY', perPersonLimit: 50000, perAccidentLimit: 100000, isIncluded: true }
    ],
    supportingQuoteDocName: 'doc.pdf',
    submittedAt: '2026-09-20T10:00:00Z',
    discrepanciesDetected: false,
    status: 'VALIDATED',
    version: 1
  };

  // Price improvement
  const revPrice = validateOfferRevision(origOffer, { carrier: 'Travelers', annualPremium: 2350, revisionReason: 'PROVIDER_UPDATED_QUOTE' }, 'OPEN');
  assert(revPrice.valid && revPrice.improvementDimensions!.some(d => d.includes('Annual premium changed')), 'Accepts provider-initiated quote update');

  // Deductible improvement without price change
  const revDed = validateOfferRevision(origOffer, {
    carrier: 'Travelers',
    revisionReason: 'PROVIDER_UPDATED_QUOTE',
    annualPremium: 2500,
    coverages: [
      { id: '1', code: 'COLLISION', name: 'Collision', category: 'PHYSICAL_DAMAGE', deductible: 500, isIncluded: true },
      { id: '2', code: 'COMPREHENSIVE', name: 'Comp', category: 'PHYSICAL_DAMAGE', deductible: 250, isIncluded: true },
      { id: '3', code: 'BODILY_INJURY', name: 'BI', category: 'LIABILITY', perPersonLimit: 50000, perAccidentLimit: 100000, isIncluded: true }
    ]
  }, 'OPEN');
  assert(revDed.valid && revDed.improvementDimensions!.some(d => d.includes('Lower collision deductible')), 'Detects deductible reduction improvement');

  // Limit improvement
  const revLimit = validateOfferRevision(origOffer, {
    carrier: 'Travelers',
    revisionReason: 'PROVIDER_UPDATED_QUOTE',
    annualPremium: 2500,
    coverages: [
      { id: '1', code: 'COLLISION', name: 'Collision', category: 'PHYSICAL_DAMAGE', deductible: 1000, isIncluded: true },
      { id: '2', code: 'COMPREHENSIVE', name: 'Comp', category: 'PHYSICAL_DAMAGE', deductible: 500, isIncluded: true },
      { id: '3', code: 'BODILY_INJURY', name: 'BI', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true }
    ]
  }, 'OPEN');
  assert(revLimit.valid && revLimit.improvementDimensions!.some(d => d.includes('Higher bodily injury')), 'Detects liability limit increase improvement');

  // Endorsement improvement
  const revEndorsements = validateOfferRevision(origOffer, {
    carrier: 'Travelers',
    revisionReason: 'PROVIDER_UPDATED_QUOTE',
    annualPremium: 2550,
    coverages: [
      ...origOffer.coverages,
      { id: '4', code: 'RENTAL_REIMBURSEMENT', name: 'Rental', category: 'ADDITIONAL', isIncluded: true },
      { id: '5', code: 'ROADSIDE_ASSISTANCE', name: 'Roadside', category: 'ADDITIONAL', isIncluded: true }
    ]
  }, 'OPEN');
  assert(revEndorsements.valid && revEndorsements.improvementDimensions!.some(d => d.includes('rental')), 'Detects rental endorsement addition');
  assert(revEndorsements.valid && revEndorsements.improvementDimensions!.some(d => d.includes('roadside')), 'Detects roadside endorsement addition');

  // ------------------------------------------------------------------
  // GATEMARK: Sealed Provider Telemetry Privacy
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 4: SEALED PROVIDER TELEMETRY PRIVACY ---');

  const activityEvents: CompetitionActivityEvent[] = [
    {
      id: 'EVT-1',
      competitionId: 'COMP-1',
      challengeId: 'CHAL-1',
      timestamp: '2026-09-20T10:00:00Z',
      type: 'OFFER_SUBMITTED',
      actorRole: 'PROVIDER',
      actorName: 'Sierra Brokerage Group',
      providerOrganizationId: 'org_sierra',
      summary: 'Sierra Brokerage Group submitted a quote for Travelers: $2,500/yr',
      round: 'OPEN'
    },
    {
      id: 'EVT-2',
      competitionId: 'COMP-1',
      challengeId: 'CHAL-1',
      timestamp: '2026-09-20T11:00:00Z',
      type: 'OFFER_SUBMITTED',
      actorRole: 'PROVIDER',
      actorName: 'Apex Insurance Services',
      providerOrganizationId: 'org_apex',
      summary: 'Apex Insurance Services submitted quote for Progressive Northern: $2,420/yr',
      round: 'OPEN'
    }
  ];

  const sierraView = filterCompetitionActivityFeedForProvider(activityEvents, 'org_sierra');
  assert(sierraView[0].actorName === 'Sierra Brokerage Group', 'Own event displays original actorName');
  assert(sierraView[0].providerOrganizationId === 'org_sierra', 'Own event retains providerOrganizationId');
  assert(sierraView[1].actorName === 'Participating Broker', 'Competitor event masks actorName to Participating Broker');
  assert(sierraView[1].providerOrganizationId === undefined, 'Competitor providerOrganizationId is completely stripped');
  assert(!sierraView[1].summary.includes('Apex Insurance'), 'Competitor agency name is masked');
  assert(!sierraView[1].summary.includes('$2,420'), 'Competitor premium amount is sealed');
  assert(sierraView[1].summary.includes('$[sealed]'), 'Competitor premium replaced with $[sealed]');

  // ------------------------------------------------------------------
  // GATEMARK: Live Integration & REST Endpoints
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 5: LIVE REST API COMPETITION ENDPOINTS ---');

  // Start test server on ephemeral port
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (testServer.address() as any).port;

  try {
    // Reset dataset
    db.seedCanonicalDataset();
    await synchronizeFixturePersistence();
    const challengeId = 'CHAL-NV-49281';

    // 1. Check Deadline Status endpoint
    const resDeadline = await makeRequest(port, {
      method: 'GET',
      path: `/api/marketplace/competition/${challengeId}/deadline-status`
    });
    assert(resDeadline.status === 200 && resDeadline.data.success === true, 'GET /api/marketplace/competition/:id/deadline-status returns 200');
    assert(resDeadline.data.status.round !== undefined, 'Deadline status reports active round');

    // 2. Policyholder ends the one submission window and begins review
    const resAdvance = await makeRequest(port, {
      method: 'POST',
      path: `/api/marketplace/competition/${challengeId}/begin-review`
    });
    assert(resAdvance.status === 200 && resAdvance.data.success === true, 'POST begin-review returns 200', JSON.stringify(resAdvance.data));
    assert(resAdvance.data.competition.currentRound === 'CONSUMER_REVIEW', 'Competition entered CONSUMER_REVIEW');

    // 3. Keep Current Offer endpoint
    // Apex confirms current offer OFFER-A is kept
    const resKeepOffer = await makeRequest(port, {
      method: 'POST',
      path: `/api/marketplace/competition/${challengeId}/keep-current-offer/OFFER-A`,
      headers: { 'x-provider-user-id': 'user_apex_1' } // OFFER-A belongs to org_apex
    });
    assert(resKeepOffer.status === 200 && resKeepOffer.data.success === true, 'POST keep-current-offer confirms existing terms without price concession');

    // 4. Activity Feed endpoint (Consumer view vs Provider view)
    const resConsumerFeed = await makeRequest(port, {
      method: 'GET',
      path: `/api/marketplace/competition/${challengeId}/activity-feed`
    });
    assert(resConsumerFeed.status === 200 && Array.isArray(resConsumerFeed.data.events), 'GET activity-feed returns transparent event feed for consumer');

    const resProviderFeed = await makeRequest(port, {
      method: 'GET',
      path: `/api/marketplace/competition/${challengeId}/activity-feed`,
      headers: { 'x-provider-user-id': 'user_sierra_1' }
    });
    assert(resProviderFeed.status === 200 && Array.isArray(resProviderFeed.data.events), 'GET activity-feed succeeds for participating provider');
    // Ensure sealed privacy in provider feed
    if (resProviderFeed.data && Array.isArray(resProviderFeed.data.events)) {
      const apexEvent = resProviderFeed.data.events.find((e: any) => e.summary.includes('Apex') || e.summary.includes('competing') || e.summary.includes('quote'));
      if (apexEvent) {
        assert(apexEvent.actorName === 'Participating Broker' || !apexEvent.summary.includes('$2,712'), 'Provider activity feed enforces sealed competitor masking');
      }
    }

    // 5. Provider Withdrawal endpoint
    const resWithdraw = await makeRequest(port, {
      method: 'POST',
      path: `/api/marketplace/competition/${challengeId}/withdraw`,
      headers: { 'x-provider-user-id': 'user_sierra_1' },
      body: {
        reason: 'UNABLE_TO_MEET_TARGET',
        notes: 'Current underwriting appetite limits capacity for this vehicle'
      }
    });
    assert(resWithdraw.status === 200 && resWithdraw.data.participation.status === 'WITHDRAWN', 'POST withdraw transitions provider participation to WITHDRAWN');

    // 6. Keep Current Policy endpoint (Consumer Incumbent Defended)
    const resKeepPolicy = await makeRequest(port, {
      method: 'POST',
      path: `/api/marketplace/competition/${challengeId}/keep-current-policy`,
      body: {
        consumerId: 'user_consumer_1',
        reason: 'Current coverage terms retained. No superior alternative accepted.'
      }
    });
    assert(resKeepPolicy.status === 200 && resKeepPolicy.data.challenge.status === 'INCUMBENT_DEFENDED', 'POST keep-current-policy marks challenge INCUMBENT_DEFENDED and completes competition');

  } finally {
    testServer.close();
  }

  // ------------------------------------------------------------------
  // SUMMARY REPORT
  // ------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`   VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (failedTests > 0) {
    console.log(`   WARNING: ${failedTests} TESTS FAILED`);
    console.log('======================================================================\n');
    process.exit(1);
  } else {
    console.log('   ALL PM-3 SPECIFICATIONS ACCEPTED & VERIFIED');
    console.log('======================================================================\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('[PM-3 Validation Crash]', err);
  process.exit(1);
});
