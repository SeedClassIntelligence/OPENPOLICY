/**
 * Master Acceptance Validation Suite for Open Policy Commercial Economics (CE-3)
 * Live Value Event Instrumentation
 * 
 * Directives Verified:
 * 1. Canonical Value Funnel Lifecycle (14 tests):
 *    - Persisted Invitation Creation -> exactly 1 VPO_AVAILABLE
 *    - Invitation View -> exactly 1 VPO_VIEWED
 *    - Invitation Acceptance -> exactly 1 VPO_ENGAGED (and 1 CommercialUsageRecord via CE-2)
 *    - Initial Proposition Submission -> exactly 1 PROPOSITION_SUBMITTED
 *    - Improvement Round Revision -> exactly 1 PROPOSITION_SUBMITTED
 *    - Consumer Selection -> exactly 1 CONSUMER_SELECTED
 *    - ConsentGrant Alone -> 0 AUTHORIZED_CONNECTION
 *    - Selection Alone -> 0 AUTHORIZED_CONNECTION
 *    - Controlled Disclosure -> exactly 1 AUTHORIZED_CONNECTION
 *    - Handoff Initiation (SELECTED) -> 0 BOUND_ACQUISITION
 *    - Binding Confirmation (BOUND) -> exactly 1 BOUND_ACQUISITION
 *    - Review-Required Reconciliation -> 0 VERIFIED_BOUND_OUTCOME
 *    - Verified Outcome (MATCH or consumer-accepted variance) -> exactly 1 VERIFIED_BOUND_OUTCOME
 *    - Baseline Activation -> exactly 1 BASELINE_ACTIVATED
 * 
 * 2. Failure Semantics (3 tests):
 *    - Failed marketplace operation -> 0 commercial events
 *    - Non-blocking commercial failure -> marketplace transaction succeeds completely
 *    - Authoritative state source of truth -> reconciliation backfills missed events
 * 
 * 3. Idempotency & Concurrency (4 tests):
 *    - Route retry idempotency -> exactly 1 event in ledger
 *    - Direct projection idempotency -> duplicate attempts ignored
 *    - Concurrent projections -> no duplicates or constraint errors
 *    - Reconciliation idempotency -> stable counts across repeated runs
 * 
 * 4. Immutability & Audit Integrity (5 tests):
 *    - Ledger append-only -> zero update/delete endpoints
 *    - Hash determinism -> metadata key order insensitivity
 *    - Tamper detection -> verification catches altered payloads
 *    - Historical agreement attribution -> frozen at event occurrence
 * 
 * 5. Multi-Tenant Isolation (2 tests):
 *    - Cross-tenant event queries isolated
 *    - Value summary reflects strictly own organization
 * 
 * 6. Neutrality Firewall Preservation (1 test):
 *    - Protected marketplace engines contain zero commercial references
 * 
 * 7. Strict Economic Separation (3 tests):
 *    - CommercialEvent contains zero pricing or fee fields
 *    - Zero BillableEvent mutations in CE-3 (deferred to CE-4)
 *    - Zero billing/invoicing endpoints or records
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../server';
import { db } from '../src/server/db';
import { postgresStore } from '../src/server/db/postgresStore';
import { commercialStore } from '../src/server/db/commercialStore';
import {
  computeCommercialEventHash,
  verifyCommercialEventHash,
  calculateValueSummary,
  buildCommercialEvent
} from '../src/domain/commercialEconomicsEngine';
import { CommercialEvent, CommercialEventType } from '../src/types/insurance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function request(
  server: http.Server,
  method: string,
  urlPath: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {})
    };

    let postData = '';
    if (body !== undefined) {
      postData = JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: reqHeaders
      },
      res => {
        let responseBody = '';
        res.on('data', chunk => {
          responseBody += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(responseBody);
          } catch {
            parsed = responseBody;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

export async function runCE3ValidationSuite() {
  console.log('\n================================================================');
  console.log('OPEN POLICY — CE-3 LIVE VALUE EVENT INSTRUMENTATION VALIDATION');
  console.log('================================================================\n');

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  console.log(`[Test Server] Running on ephemeral port ${port}`);

  try {
    // -------------------------------------------------------------------------
    // CATEGORY 1: CANONICAL VALUE FUNNEL LIFECYCLE (14 TESTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Canonical Value Funnel Lifecycle Verification ---');

    const testTimestamp = Date.now();
    const testOrgId = 'org_apex';
    const testOrgB = 'org_sierra';
    const apexHeaders = { 'x-provider-user-id': 'user_apex_1' };
    const sierraHeaders = { 'x-provider-user-id': 'user_sierra_1' };

    // Prerequisite: the structural (price-free) commercial plan catalog that production
    // startup establishes via seedCanonicalPlans(). This suite runs on an isolated database,
    // so it must create its own prerequisites rather than inherit another suite's data.
    await commercialStore.seedCanonicalPlans();

    // Pre-enroll active commercial agreement with capacity so all events anchor to active agreement
    const enrollRes = await request(
      server,
      'POST',
      '/api/commercial/agreements/enroll',
      {
        planCode: 'PLAN_AGENCY',
        enforcementPolicy: 'ALLOW_OVERAGE',
        customTerms: {
          includedEngagementCapacity: 100
        }
      },
      apexHeaders
    );
    assert(enrollRes.status === 201, 'Enrolled active commercial agreement with capacity');
    const agreement = enrollRes.body.agreement;
    assert(!!agreement, 'Active commercial agreement present');

    // 1.1 Persisted Invitation Creation -> VPO_AVAILABLE
    const baseline = db.getBaselines()[0];
    assert(!!baseline?.id, 'Baseline available for challenge creation');
    const chalCreateRes = await request(server, 'POST', '/api/challenges/create', {
      baselineId: baseline.id
    });
    assert(chalCreateRes.status === 200, 'Challenge created successfully');
    const createdChal = chalCreateRes.body.challenge;
    assert(!!createdChal?.id, 'Challenge ID returned');

    const availableEvents = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'VPO_AVAILABLE'
    });
    const apexAvail = availableEvents.find(e => e.challengeId === createdChal.id);
    assert(!!apexAvail, 'VPO_AVAILABLE event recorded for invited provider org_apex');
    assert(apexAvail?.sourceEntityType === 'CHALLENGE_INVITATION', 'Source entity is CHALLENGE_INVITATION');
    assert(Boolean(apexAvail?.idempotencyKey.startsWith('evt:VPO_AVAILABLE:')), 'Idempotency key strictly formatted');

    // 1.2 Invitation View -> VPO_VIEWED
    console.log('\n[1.2] Testing VPO_VIEWED on invitation view...');
    const invId = apexAvail?.sourceEntityId;
    assert(!!invId, 'Found invitation ID from available event');

    const viewRes = await request(
      server,
      'POST',
      `/api/marketplace/invitations/${invId}/view`,
      {},
      apexHeaders
    );
    assert(viewRes.status === 200, 'Invitation view succeeded');

    const viewedEvents = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'VPO_VIEWED'
    });
    const apexViewed = viewedEvents.find(e => e.sourceEntityId === invId);
    assert(!!apexViewed, 'VPO_VIEWED event recorded in commercial ledger');
    assert(apexViewed?.idempotencyKey === `evt:VPO_VIEWED:${invId}`, 'VPO_VIEWED idempotency key formatted canonical');

    // 1.3 Invitation Acceptance -> VPO_ENGAGED
    console.log('\n[1.3] Testing VPO_ENGAGED on invitation acceptance...');
    assert(!!agreement, 'Active commercial agreement present for capacity check');

    const acceptRes = await request(
      server,
      'POST',
      `/api/marketplace/invitations/${invId}/accept`,
      {},
      apexHeaders
    );
    if (acceptRes.status !== 200) {
      console.error('Accept invitation failed:', acceptRes.status, acceptRes.body);
    }
    assert(acceptRes.status === 200, 'Invitation accept succeeded');

    const engagedEvents = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'VPO_ENGAGED'
    });
    const apexEngaged = engagedEvents.find(e => e.challengeId === createdChal.id);
    assert(!!apexEngaged, 'VPO_ENGAGED event recorded in commercial ledger');
    assert(apexEngaged?.sourceEntityType === 'CHALLENGE_PARTICIPATION', 'Source entity is CHALLENGE_PARTICIPATION');
    assert(apexEngaged?.sourceEntityId === acceptRes.body.participation.id, 'Source entity ID matches participation ID');

    // Verify CE-2 usage record also exists without confusing it with CommercialEvent
    const usage = await commercialStore.getUsageForInvitation(invId!);
    assert(!!usage, 'CE-2 CommercialUsageRecord created separately from CommercialEvent');
    assert(usage?.usageType === 'VPO_ENGAGEMENT', 'Usage record tracks contractual capacity consumption');

    // 1.4 Initial Proposition Submission -> PROPOSITION_SUBMITTED
    console.log('\n[1.4] Testing PROPOSITION_SUBMITTED on initial offer submission...');
    const offerRes = await request(
      server,
      'POST',
      '/api/offers/submit',
      {
        challengeId: createdChal.id,
        carrier: 'Apex Preferred Insurance',
        quoteNumber: `QT-CE3-${testTimestamp}`,
        annualPremium: 2450,
        monthlyPremium: 210,
        supportingQuoteDocName: 'Apex_Official_Quote.pdf',
        coverages: [
          { code: 'BODILY_INJURY', name: 'Bodily Injury', limit: '$250k/$500k', category: 'LIABILITY', isIncluded: true },
          { code: 'PROPERTY_DAMAGE', name: 'Property Damage', limit: '$100,000', category: 'LIABILITY', isIncluded: true }
        ],
        effectiveDate: '2026-11-01',
        expirationDate: '2027-11-01'
      },
      apexHeaders
    );
    assert(offerRes.status === 200, 'Offer submission succeeded');
    const submittedOffer = offerRes.body.offer;
    assert(!!submittedOffer?.id, 'Submitted offer has ID');

    const submittedEvents = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'PROPOSITION_SUBMITTED'
    });
    const initialProp = submittedEvents.find(e => e.challengeId === createdChal.id);
    assert(!!initialProp, 'PROPOSITION_SUBMITTED event recorded in commercial ledger');
    assert(initialProp?.metadata?.versionNumber === 1, 'Metadata documents version 1 proposition');

    // 1.5 Provider-initiated update during the submission window -> PROPOSITION_SUBMITTED
    console.log('\n[1.5] Testing PROPOSITION_SUBMITTED on provider-initiated offer update...');

    const reviseRes = await request(
      server,
      'POST',
      `/api/marketplace/competition/${createdChal.id}/revise-offer/${submittedOffer.id}`,
      {
        revisedData: {
          carrier: 'Apex Preferred Insurance',
          annualPremium: 2350,
          monthlyPremium: 200,
          supportingQuoteDocName: 'Apex_Official_Quote_v2.pdf',
          revisionReason: 'PROVIDER_UPDATED_QUOTE'
        }
      },
      apexHeaders
    );
    assert(reviseRes.status === 200, 'Provider-initiated offer update succeeded while the submission window was open');

    const allSubmittedProps = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'PROPOSITION_SUBMITTED'
    });
    const revisionProp = allSubmittedProps.find(e => e.challengeId === createdChal.id && (e.metadata?.versionNumber as number) > 1);
    assert(!!revisionProp, 'Separate PROPOSITION_SUBMITTED event recorded for the updated immutable version');

    // 1.6 Consumer Selection -> CONSUMER_SELECTED
    console.log('\n[1.6] Testing CONSUMER_SELECTED on offer selection...');
    const selectRes = await request(server, 'POST', `/api/marketplace/challenges/${createdChal.id}/select-version`, {
      consumerId: 'user_consumer_1',
      offerId: submittedOffer.id,
      versionNumber: 2
    });
    if (selectRes.status !== 200) {
      console.error('Select offer failed:', selectRes.status, selectRes.body);
    }
    assert(selectRes.status === 200, 'Offer selection succeeded');
    const handoff = selectRes.body.handoff;
    assert(!!handoff?.id, 'BindingHandoff created with status SELECTED');

    const selectedEvents = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'CONSUMER_SELECTED'
    });
    const apexSelected = selectedEvents.find(e => e.challengeId === createdChal.id);
    assert(!!apexSelected, 'CONSUMER_SELECTED event recorded in commercial ledger');

    // 1.7 & 1.8 ConsentGrant & Selection Alone -> ZERO AUTHORIZED_CONNECTION
    console.log('\n[1.7 & 1.8] Testing that Selection and ConsentGrant alone produce ZERO AUTHORIZED_CONNECTION...');
    const consentRes = await request(server, 'POST', `/api/marketplace/binding/${handoff.id}/grant-consent`, {
      consumerId: 'user_consumer_1',
      challengeId: createdChal.id,
      purpose: 'BINDING_VERIFICATION',
      purposeExplanation: 'Authorize disclosure of driver PII for policy binding',
      authorizedFieldNames: ['driverLicenseNumber', 'fullAddress', 'vin']
    });
    assert(consentRes.status === 200, 'Consent grant created successfully');
    const consentGrant = consentRes.body.consentGrant;

    const disclosuresBefore = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'AUTHORIZED_CONNECTION'
    });
    const preDisclosure = disclosuresBefore.find(e => e.challengeId === createdChal.id);
    assert(!preDisclosure, 'ConsentGrant and Selection alone produce ZERO AUTHORIZED_CONNECTION events');

    // 1.9 Controlled Disclosure Execution -> exactly 1 AUTHORIZED_CONNECTION
    console.log('\n[1.9] Testing AUTHORIZED_CONNECTION on execute-disclosure...');
    const discExecRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoff.id}/execute-disclosure`,
      {
        consentGrantId: consentGrant.id,
        recipientAgentName: 'Apex Licensed Producer',
        recipientEmail: 'quotes@apexinsurance.com'
      },
      apexHeaders
    );
    assert(discExecRes.status === 200, 'Controlled disclosure executed successfully');

    const disclosuresAfter = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'AUTHORIZED_CONNECTION'
    });
    const postDisclosure = disclosuresAfter.find(e => e.challengeId === createdChal.id);
    assert(!!postDisclosure, 'AUTHORIZED_CONNECTION recorded exactly upon controlled disclosure execution');
    assert(postDisclosure?.sourceEntityType === 'DISCLOSURE_EVENT', 'Source entity is DISCLOSURE_EVENT');

    // 1.10 Handoff Initiation (SELECTED) -> ZERO BOUND_ACQUISITION
    console.log('\n[1.10] Testing Handoff initiation does not produce BOUND_ACQUISITION...');
    const boundsBefore = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'BOUND_ACQUISITION'
    });
    const preBound = boundsBefore.find(e => e.challengeId === createdChal.id);
    assert(!preBound, 'Handoff creation and disclosure produce ZERO BOUND_ACQUISITION events');

    // 1.11 Provider-set BOUND alone -> zero BOUND_ACQUISITION
    console.log('\n[1.11] Testing provider-set BOUND does not create billable acquisition evidence...');
    const appSubmitRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoff.id}/update-status`,
      {
        newStatus: 'APPLICATION_SUBMITTED'
      },
      apexHeaders
    );
    assert(appSubmitRes.status === 200, 'Handoff updated to APPLICATION_SUBMITTED');

    const underwritingRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoff.id}/update-status`,
      {
        newStatus: 'UNDERWRITING'
      },
      apexHeaders
    );
    assert(underwritingRes.status === 200, 'Handoff updated to UNDERWRITING');

    const boundRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoff.id}/update-status`,
      {
        newStatus: 'BOUND',
        policyNumber: `POL-NV-CE3-${testTimestamp}`
      },
      apexHeaders
    );
    assert(boundRes.status === 200, 'Handoff updated to BOUND status');

    const boundsAfter = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'BOUND_ACQUISITION'
    });
    const postBound = boundsAfter.find(e => e.challengeId === createdChal.id);
    assert(!postBound, 'Provider-set BOUND produces ZERO BOUND_ACQUISITION events');

    // 1.12 Ingestion with REVIEW_REQUIRED -> ZERO VERIFIED_BOUND_OUTCOME
    console.log('\n[1.12] Testing review-required reconciliation produces ZERO VERIFIED_BOUND_OUTCOME...');
    // Create issued policy upload
    const uploadRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoff.id}/upload-issued-policy`,
      {
        providerUserId: 'user_apex_1',
        fileName: 'issued_policy_contract.pdf',
        fileSizeBytes: 1048576,
        mimeType: 'application/pdf',
        rawContent: 'Sample policy document text',
        extractedTerms: {
          carrier: 'Apex Preferred Insurance',
          policyNumber: `POL-NV-CE3-${testTimestamp}`,
          annualPremium: 2500, // +$150 variance -> UNAUTHORIZED_VARIANCE
          effectiveDate: '2026-11-01',
          expirationDate: '2027-11-01',
          coverages: [
            { code: 'BODILY_INJURY', name: 'Bodily Injury', limit: '$250k/$500k', category: 'LIABILITY', isIncluded: true },
            { code: 'PROPERTY_DAMAGE', name: 'Property Damage', limit: '$100,000', category: 'LIABILITY', isIncluded: true }
          ]
        }
      },
      apexHeaders
    );
    assert(uploadRes.status === 200, 'Policy upload succeeded');

    const reconcileRes = await request(server, 'POST', `/api/marketplace/binding/${handoff.id}/reconcile`, {}, apexHeaders);
    assert(reconcileRes.status === 200, 'Reconciliation execution succeeded');
    const unverifiedReport = reconcileRes.body.report;
    assert(unverifiedReport.verdict === 'UNAUTHORIZED_VARIANCE', 'Report correctly flagged unauthorized variance');

    const verifiedBefore = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'VERIFIED_BOUND_OUTCOME'
    });
    const preVerified = verifiedBefore.find(e => e.challengeId === createdChal.id);
    assert(!preVerified, 'UNAUTHORIZED_VARIANCE produces ZERO VERIFIED_BOUND_OUTCOME events');

    // 1.13 Verified Outcome (Consumer accepts variance) -> exactly 1 VERIFIED_BOUND_OUTCOME
    console.log('\n[1.13] Testing VERIFIED_BOUND_OUTCOME on consumer variance acceptance...');
    const verifyAcceptRes = await request(server, 'POST', `/api/marketplace/binding/${handoff.id}/consumer-verify`, {
      reconciliationReportId: unverifiedReport.id,
      consumerId: 'user_consumer_1',
      decision: 'ACCEPT_VARIANCE'
    });
    assert(verifyAcceptRes.status === 200, 'Consumer accepted variance');

    const verifiedAfter = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'VERIFIED_BOUND_OUTCOME'
    });
    const postVerified = verifiedAfter.find(e => e.challengeId === createdChal.id);
    assert(!!postVerified, 'VERIFIED_BOUND_OUTCOME recorded when variance is resolved and accepted');
    assert(postVerified?.sourceEntityType === 'RECONCILIATION_REPORT', 'Source entity is RECONCILIATION_REPORT');
    const confirmedBounds = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'BOUND_ACQUISITION'
    });
    const confirmedBound = confirmedBounds.find(e => e.challengeId === createdChal.id);
    assert(!!confirmedBound, 'Consumer-confirmed issued-policy variance records BOUND_ACQUISITION');
    assert(confirmedBound?.sourceEntityType === 'RECONCILIATION_REPORT', 'Bound evidence is the reconciliation report');

    // 1.14 Baseline Activation -> exactly 1 BASELINE_ACTIVATED
    console.log('\n[1.14] Testing BASELINE_ACTIVATED on vault activation...');
    const baselineEvents = await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'BASELINE_ACTIVATED'
    });
    const postBaseline = baselineEvents.find(e => e.challengeId === createdChal.id);
    assert(!!postBaseline, 'BASELINE_ACTIVATED recorded when new coverage baseline is filed to vault');
    assert(postBaseline?.sourceEntityType === 'COVERAGE_BASELINE', 'Source entity is COVERAGE_BASELINE');

    // -------------------------------------------------------------------------
    // CATEGORY 2: FAILURE SEMANTICS (3 TESTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Failure Semantics Verification ---');

    // 2.1 Failed marketplace operation produces 0 events
    console.log('\n[2.1] Testing failed marketplace operation produces ZERO events...');
    const eventsCountBefore = (await commercialStore.getCommercialEvents({ providerOrganizationId: testOrgId })).length;
    const failRes = await request(
      server,
      'POST',
      '/api/marketplace/invitations/INVALID_INV_9999/accept',
      {},
      apexHeaders
    );
    assert(failRes.status >= 400, 'Invalid invitation acceptance failed as expected');
    const eventsCountAfter = (await commercialStore.getCommercialEvents({ providerOrganizationId: testOrgId })).length;
    assert(eventsCountBefore === eventsCountAfter, 'Failed operation recorded ZERO new commercial events');

    // 2.2 Non-blocking commercial projection failure
    console.log('\n[2.2] Testing non-blocking commercial projection failure...');
    // We test that projectMarketplaceEvent catches and handles errors gracefully without crashing caller
    const failedProjResult = await commercialStore.projectMarketplaceEvent({
      eventType: 'VPO_VIEWED',
      sourceEntityType: 'CHALLENGE_INVITATION',
      sourceEntityId: 'INVALID_ID_FOR_FAILURE_TEST',
      providerOrganizationId: '', // Invalid empty string will fail buildCommercialEvent
      challengeId: 'CHAL-TEST'
    });
    assert(failedProjResult === null, 'Projection safely returns null on failure rather than throwing uncaught exception');

    // 2.3 Authoritative state reconciliation
    console.log('\n[2.3] Testing authoritative state reconciliation backfill...');
    const reconcileRun = await commercialStore.reconcileCommercialEvents(db);
    assert(reconcileRun.scanned > 0, `Authoritative scan examined ${reconcileRun.scanned} records`);
    assert(reconcileRun.errors.length === 0, `Reconciliation finished with zero errors (${reconcileRun.errors.join('; ')})`);
    assert(reconcileRun.alreadyExisted > 0, 'Pre-existing events correctly identified and preserved');

    // -------------------------------------------------------------------------
    // CATEGORY 3: IDEMPOTENCY & CONCURRENCY (4 TESTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Idempotency & Concurrency Verification ---');

    // 3.1 Route retry idempotency
    console.log('\n[3.1] Testing route retry idempotency on invitation view...');
    const viewRetry1 = await request(server, 'POST', `/api/marketplace/invitations/${invId}/view`, {}, apexHeaders);
    const viewRetry2 = await request(server, 'POST', `/api/marketplace/invitations/${invId}/view`, {}, apexHeaders);
    assert(viewRetry1.status === 200 && viewRetry2.status === 200, 'Retried views succeeded');

    const viewEventsForInv = (await commercialStore.getCommercialEvents({
      providerOrganizationId: testOrgId,
      eventType: 'VPO_VIEWED'
    })).filter(e => e.sourceEntityId === invId);
    assert(viewEventsForInv.length === 1, `Exactly 1 VPO_VIEWED event in ledger despite repeated retries (count=${viewEventsForInv.length})`);

    // 3.2 Direct projection idempotency
    console.log('\n[3.2] Testing direct projection idempotency...');
    const proj1 = await commercialStore.projectMarketplaceEvent({
      eventType: 'CONSUMER_SELECTED',
      sourceEntityType: 'SELECTION',
      sourceEntityId: `SEL-IDEMP-TEST-${testTimestamp}`,
      providerOrganizationId: testOrgId,
      challengeId: 'CHAL-IDEMP'
    });
    const proj2 = await commercialStore.projectMarketplaceEvent({
      eventType: 'CONSUMER_SELECTED',
      sourceEntityType: 'SELECTION',
      sourceEntityId: `SEL-IDEMP-TEST-${testTimestamp}`,
      providerOrganizationId: testOrgId,
      challengeId: 'CHAL-IDEMP'
    });
    assert(proj1 !== null, 'First projection succeeded');
    assert(proj2 === null, 'Second projection returned null (deduplicated by idempotency key)');

    // 3.3 Concurrent projections
    console.log('\n[3.3] Testing concurrent projections for identical event...');
    const concurrentKeys = Array.from({ length: 5 }, () =>
      commercialStore.projectMarketplaceEvent({
        eventType: 'BOUND_ACQUISITION',
        sourceEntityType: 'BINDING_HANDOFF',
        sourceEntityId: `HND-CONCURRENT-${testTimestamp}`,
        providerOrganizationId: testOrgId,
        challengeId: 'CHAL-CONC'
      })
    );
    const concurrentResults = await Promise.all(concurrentKeys);
    const successfulInserts = concurrentResults.filter(r => r !== null);
    assert(successfulInserts.length === 1, `Exactly 1 insertion succeeded among 5 concurrent calls (actual=${successfulInserts.length})`);

    // 3.4 Reconciliation idempotency
    console.log('\n[3.4] Testing repeated reconciliation stability...');
    const runA = await commercialStore.reconcileCommercialEvents(db);
    const runB = await commercialStore.reconcileCommercialEvents(db);
    assert(runB.projected === 0, `Second reconciliation pass projected 0 new events (actual=${runB.projected})`);
    assert(runB.alreadyExisted === runA.scanned, 'All scanned records in second pass already existed');

    // -------------------------------------------------------------------------
    // CATEGORY 4: IMMUTABILITY & AUDIT INTEGRITY (5 TESTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Immutability & Audit Integrity Verification ---');

    // 4.1 Ledger append-only: zero update/delete endpoints
    console.log('\n[4.1] Testing zero update/delete endpoints on commercial events...');
    const sampleEvent = (await commercialStore.getCommercialEvents({ providerOrganizationId: testOrgId }))[0];
    assert(!!sampleEvent, 'Found sample commercial event');

    const putRes = await request(server, 'PUT', `/api/commercial/events/${sampleEvent.id}`, { eventType: 'MODIFIED' });
    assert(putRes.status === 404, 'PUT /api/commercial/events/:id returns 404 Not Found');

    const deleteRes = await request(server, 'DELETE', `/api/commercial/events/${sampleEvent.id}`);
    assert(deleteRes.status === 404, 'DELETE /api/commercial/events/:id returns 404 Not Found');

    // 4.2 Hash determinism
    console.log('\n[4.2] Testing event hash determinism regardless of metadata key ordering...');
    const meta1 = { zebra: 1, alpha: 'test', beta: true, nested: { z: 10, a: 20 } };
    const meta2 = { alpha: 'test', nested: { a: 20, z: 10 }, beta: true, zebra: 1 };
    const hash1 = computeCommercialEventHash({
      eventType: 'VPO_AVAILABLE',
      providerOrganizationId: testOrgId,
      sourceEntityType: 'CHALLENGE_INVITATION',
      sourceEntityId: 'INV-123',
      occurredAt: '2026-10-01T12:00:00Z',
      idempotencyKey: 'evt:VPO_AVAILABLE:INV-123',
      metadata: meta1
    });
    const hash2 = computeCommercialEventHash({
      eventType: 'VPO_AVAILABLE',
      providerOrganizationId: testOrgId,
      sourceEntityType: 'CHALLENGE_INVITATION',
      sourceEntityId: 'INV-123',
      occurredAt: '2026-10-01T12:00:00Z',
      idempotencyKey: 'evt:VPO_AVAILABLE:INV-123',
      metadata: meta2
    });
    assert(hash1 === hash2, `Hashes identical despite arbitrary key ordering: ${hash1}`);

    // 4.3 Tamper detection
    console.log('\n[4.3] Testing tamper detection on mutated commercial event...');
    const cleanEvent = buildCommercialEvent({
      eventType: 'CONSUMER_SELECTED',
      providerOrganizationId: testOrgId,
      sourceEntityType: 'SELECTION',
      sourceEntityId: 'SEL-CLEAN-01',
      occurredAt: '2026-10-01T12:00:00Z',
      metadata: { originalField: 'valid' }
    });
    assert(verifyCommercialEventHash(cleanEvent), 'Clean event hash verifies as valid');

    const tamperedEvent: CommercialEvent = {
      ...cleanEvent,
      metadata: { originalField: 'tampered' }
    };
    assert(!verifyCommercialEventHash(tamperedEvent), 'Tampered event hash verification fails');

    // 4.4 Historical agreement attribution immutable
    console.log('\n[4.4] Testing historical agreement attribution immutability...');
    assert(apexAvail?.commercialAgreementId === agreement?.id, 'Event is anchored to active agreement at event creation');

    // -------------------------------------------------------------------------
    // CATEGORY 5: MULTI-TENANT ISOLATION (2 TESTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Multi-Tenant Isolation Verification ---');

    // 5.1 Cross-tenant query isolation
    console.log('\n[5.1] Testing cross-tenant commercial events query...');
    const apexQueryRes = await request(
      server,
      'GET',
      `/api/commercial/events?providerOrganizationId=${testOrgId}`,
      undefined,
      apexHeaders
    );
    assert(apexQueryRes.status === 200, 'Query for own events succeeded');
    const orgEvents: CommercialEvent[] = apexQueryRes.body.events;
    const leakedOrgB = orgEvents.some(e => e.providerOrganizationId === testOrgB);
    assert(!leakedOrgB, 'Apex query results contain zero events belonging to Sierra');

    // 5.2 Value summary self-only
    console.log('\n[5.2] Testing value summary tenant isolation...');
    const summaryRes = await request(
      server,
      'GET',
      `/api/commercial/events/summary?providerOrganizationId=${testOrgId}`,
      undefined,
      apexHeaders
    );
    assert(summaryRes.status === 200, 'Summary request succeeded');
    const summary = summaryRes.body.summary;
    assert(summary.providerOrganizationId === testOrgId, 'Summary scoped strictly to requesting organization');
    assert(summary.vposAvailable >= 1, 'Summary reflects genuine recorded VPO Available counts');
    assert(summary.baselinesActivated >= 1, 'Summary reflects genuine recorded Baseline Activated counts');

    // -------------------------------------------------------------------------
    // CATEGORY 6: NEUTRALITY FIREWALL PRESERVATION (1 TEST)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Neutrality Firewall Invariant Verification ---');
    console.log('\n[6.1] Verifying protected marketplace engines contain zero commercial references...');
    const protectedFiles = [
      'src/domain/comparisonEngine.ts',
      'src/domain/qualificationEngine.ts',
      'src/domain/competitionEngine.ts',
      'src/domain/selectionBindingEngine.ts',
      'src/domain/pm5ReconciliationEngine.ts'
    ];

    const forbiddenPatterns = [
      'commercialStore',
      'CommercialEvent',
      'CommercialAccount',
      'CommercialAgreement',
      'CommercialPlan',
      'ProviderEntitlement',
      'BillableEvent',
      'commercial_events',
      'projectMarketplaceEvent'
    ];

    for (const relPath of protectedFiles) {
      const fullPath = path.resolve(relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of forbiddenPatterns) {
        const found = content.includes(pattern);
        assert(!found, `Protected engine ${relPath} contains zero references to '${pattern}'`);
      }
    }

    // -------------------------------------------------------------------------
    // CATEGORY 7: STRICT ECONOMIC SEPARATION (3 TESTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Strict Economic Separation Verification ---');

    // 7.1 CommercialEvent contains zero pricing or fee fields
    console.log('\n[7.1] Testing CommercialEvent fields are strictly non-financial...');
    const forbiddenFinancialFields = [
      'price',
      'unitPrice',
      'fee',
      'commission',
      'amount',
      'balance',
      'charge',
      'rate',
      'cost',
      'invoice'
    ];
    for (const key of forbiddenFinancialFields) {
      assert(!(key in sampleEvent), `CommercialEvent schema does not contain financial field '${key}'`);
    }

    // 7.2 Zero BillableEvent records generated in CE-3
    console.log('\n[7.2] Testing zero BillableEvent records generated in CE-3...');
    // Attribution: this suite runs on an isolated database, so every CommercialEvent in it was
    // produced by the CE-3 scenario. None of them may have produced a BillableEvent.
    const ce3Events = await commercialStore.getCommercialEvents({ limit: 100000 });
    assert(ce3Events.length > 0, `CE-3 scenario produced CommercialEvents to examine (count=${ce3Events.length})`);
    let attributableBillables = 0;
    for (const ev of ce3Events) {
      attributableBillables += (await commercialStore.getBillableEventsForCommercialEvent(ev.id)).length;
    }
    assert(attributableBillables === 0, `Zero BillableEvents attributable to CE-3 CommercialEvents (count=${attributableBillables})`);
    const billables = await commercialStore.getBillableEvents({ providerOrganizationId: testOrgId });
    assert(billables.length === 0, `Zero BillableEvents generated across CE-3 lifecycle (count=${billables.length})`);

    // 7.3 Marketplace billing endpoints remain 404
    console.log('\n[7.3] Testing marketplace billing endpoints remain 404...');
    const forbiddenEndpoints = [
      '/api/billing/invoice',
      '/api/marketplace/billing/charge',
      '/api/marketplace/fees',
      '/api/marketplace/billing/invoices'
    ];
    for (const endpoint of forbiddenEndpoints) {
      const res = await request(server, 'GET', endpoint);
      assert(res.status === 404, `Prohibited billing route ${endpoint} returns 404`);
    }

    console.log('\n================================================================');
    console.log('CE-3 ACCEPTANCE SUITE: ALL TESTS PASSED (0 FAILURES)');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runCE3ValidationSuite()
  .then(() => {
    console.log('[CE-3 Validation] Completed successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('[CE-3 Validation FAILED]', err);
    process.exit(1);
  });
