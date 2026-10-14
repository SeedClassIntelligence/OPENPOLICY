/**
 * PM-4 Selection, Controlled Disclosure & Binding Acceptance Validation Suite
 * 
 * Verifies canonical specifications:
 *   1. PM-1, PM-2, and PM-3 Non-Regression Invariants
 *   2. Selection and Consent Separation (Exact OfferVersion locking, SELECTED handoff, zero PII release)
 *   3. Purpose/recipient/field-extensible ConsentGrant (Section 40 informed consent, recipient restriction)
 *   4. Controlled DisclosureEvent Execution (Field filtering, factual SHA-256 eventPayloadHash, revocation non-erasure)
 *   5. Underwriting Modification & OfferVersion Immutability (Preserves original version, separate BindingModification, rejection halts continuation)
 *   6. Unresolved Modifications Strictly Block BOUND Status
 *   7. Terminal Statuses (BOUND, DECLINED, CANCELLED, EXPIRED - no RECONCILED in PM-4)
 *   8. Relational Persistence & Durability (PGlite tables: selections, consent_grants, disclosure_events, binding_handoffs, binding_modifications)
 *   9. Live HTTP API Endpoints Verification
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore, postgresStore } from '../src/server/db/postgresStore';
import { db } from '../src/server/db';
import { addTestOffer } from './lib/testOfferFixture';
import { app, synchronizeFixturePersistence } from '../server';
import { runComparisonEngineTestSuite } from '../src/domain/comparisonEngine.test';
import { runEligibilityEngineTestSuite } from '../src/domain/eligibilityEngine.test';
import { runCompetitionEngineTestSuite } from '../src/domain/competitionEngine.test';
import { runGovernanceAuditTestSuite } from '../src/domain/governanceAudit.test';
import { runPM1AcceptanceTestSuite } from '../src/domain/pm1Marketplace.test';
import { runPM2AcceptanceTestSuite } from '../src/domain/pm2InformationOffers.test';
import { runPM3AcceptanceTestSuite } from '../src/domain/pm3CompetitionRounds.test';
import { runPM4AcceptanceTestSuite } from '../src/domain/pm4SelectionBinding.test';

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

async function request(
  server: http.Server,
  method: string,
  pathName: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };
    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: pathName,
        method,
        headers: reqHeaders
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runPM4AcceptanceValidation() {
  console.log('\n============================================================');
  console.log('OPEN POLICY PM-4 ACCEPTANCE & REGRESSION VALIDATION SUITE');
  console.log('============================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Prior PM Suites Non-Regression Gates
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: Non-Regression Gates (PM-1, PM-2, PM-3) ---');
  
  const pm1 = runPM1AcceptanceTestSuite();
  assert(pm1.failed === 0, `PM-1 Marketplace Foundation Domain Suite (${pm1.passed}/${pm1.total} passed)`);

  const pm2 = runPM2AcceptanceTestSuite();
  assert(pm2.failed === 0, `PM-2 Information & Multi-Carrier Offers Domain Suite (${pm2.passed}/${pm2.total} passed)`);

  const pm3 = runPM3AcceptanceTestSuite();
  assert(pm3.failed === 0, `PM-3 Competition Rounds Domain Suite (${pm3.passed}/${pm3.total} passed)`);

  const pm4Domain = runPM4AcceptanceTestSuite();
  assert(pm4Domain.failed === 0, `PM-4 Selection & Binding Domain Suite (${pm4Domain.passed}/${pm4Domain.total} passed)`);

  const compSuite = runComparisonEngineTestSuite();
  assert(compSuite.failed === 0, `Comparison Engine Core Suite (${compSuite.passed}/${compSuite.total})`);

  const eligSuite = runEligibilityEngineTestSuite();
  assert(eligSuite.failed === 0, `Eligibility Engine Core Suite (${eligSuite.passed}/${eligSuite.total})`);

  const roundSuite = runCompetitionEngineTestSuite();
  assert(roundSuite.failed === 0, `Competition Engine Core Suite (${roundSuite.passed}/${roundSuite.total})`);

  const govSuite = runGovernanceAuditTestSuite();
  assert(govSuite.failed === 0, `Governance & Cryptographic Audit Core Suite (${govSuite.passed}/${govSuite.total})`);

  // --------------------------------------------------------------------------
  // SECTION 2: Database Schema & Relational Integrity (PGlite)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: PM-4 Relational Schema & Persistence Verification ---');
  
  const testDbDir = path.join(process.cwd(), 'data', 'test_pm4_pg');
  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  }

  const store = new PostgresStore(testDbDir);
  await store.init();

  const counts = await store.getTableCounts();
  assert(counts['selections'] === 0, 'Relational table `selections` initialized');
  assert(counts['consent_grants'] === 0, 'Relational table `consent_grants` initialized');
  assert(counts['disclosure_events'] === 0, 'Relational table `disclosure_events` initialized');
  assert(counts['binding_handoffs'] === 0, 'Relational table `binding_handoffs` initialized');
  assert(counts['binding_modifications'] === 0, 'Relational table `binding_modifications` initialized');

  // Verify persistence methods
  const mockSel = {
    id: 'SEL-TEST-001',
    challengeId: 'CHAL-TEST-01',
    consumerId: 'user_consumer_1',
    offerId: 'OFFER-TEST-01',
    offerVersionId: 'VER-01',
    versionNumber: 1,
    providerOrganizationId: 'org_apex',
    carrier: 'Progressive Northern',
    annualPremium: 2540,
    monthlyPremium: Math.round(2540 / 12),
    selectedAt: new Date().toISOString(),
    status: 'ACTIVE' as const
  };
  await store.saveSelection(mockSel);
  const savedSels = await store.getSelections('CHAL-TEST-01');
  assert(savedSels.length === 1 && savedSels[0].id === 'SEL-TEST-001', 'PostgresStore saves and queries Selection records');

  const mockGrant = {
    id: 'CSNT-TEST-001',
    challengeId: 'CHAL-TEST-01',
    consumerId: 'user_consumer_1',
    recipientOrganizationId: 'org_apex',
    purpose: 'STAGE_C_BINDING_DISCLOSURE',
    purposeExplanation: 'Binding handoff disclosure',
    authorizedFieldNames: ['namedInsured', 'vin', 'garagingAddress'],
    acknowledgedVariations: [],
    grantedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    ipAddressHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    termsVersion: 'NV-DOI-2025-01'
  };
  await store.saveConsentGrant(mockGrant);
  const savedGrants = await store.getConsentGrants('CHAL-TEST-01');
  assert(savedGrants.length === 1 && savedGrants[0].id === 'CSNT-TEST-001', 'PostgresStore saves and queries ConsentGrant records');

  const mockDisc = {
    id: 'DISC-TEST-001',
    challengeId: 'CHAL-TEST-01',
    bindingHandoffId: 'HND-TEST-001',
    consentGrantId: 'CSNT-TEST-001',
    recipientProviderOrganizationId: 'org_apex',
    disclosedAt: new Date().toISOString(),
    disclosedFieldNames: ['namedInsured', 'vin'],
    eventPayloadHash: 'f4b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1'
  };
  await store.saveDisclosureEvent(mockDisc);
  const savedDiscs = await store.getDisclosureEvents('HND-TEST-001');
  assert(savedDiscs.length === 1 && savedDiscs[0].id === 'DISC-TEST-001', 'PostgresStore saves and queries DisclosureEvent records');

  const mockHnd = {
    id: 'HND-TEST-001',
    bindingReference: 'BIND-NV-123456',
    challengeId: 'CHAL-TEST-01',
    selectionId: 'SEL-TEST-001',
    consumerId: 'user_consumer_1',
    providerOrganizationId: 'org_apex',
    carrier: 'Progressive Northern',
    status: 'SELECTED' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await store.saveBindingHandoff(mockHnd);
  const savedHnds = await store.getBindingHandoffs('CHAL-TEST-01');
  assert(savedHnds.length === 1 && savedHnds[0].bindingReference === 'BIND-NV-123456', 'PostgresStore saves and queries BindingHandoff records');

  const mockMod = {
    id: 'MOD-TEST-001',
    bindingHandoffId: 'HND-TEST-001',
    challengeId: 'CHAL-TEST-01',
    providerOrganizationId: 'org_apex',
    providerUserId: 'usr_marcus',
    carrier: 'Progressive Northern',
    originalAnnualPremium: 2540,
    modifiedAnnualPremium: 2680,
    coverageChanges: [],
    underwritingReason: 'Underwriting tier adjustment',
    proposedAt: new Date().toISOString(),
    status: 'PENDING_CONSUMER_REVIEW' as const
  };
  await store.saveBindingModification(mockMod);
  const savedMods = await store.getBindingModifications('HND-TEST-001');
  assert(savedMods.length === 1 && savedMods[0].modifiedAnnualPremium === 2680, 'PostgresStore saves and queries BindingModification records');

  await store.close();
  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  }

  // --------------------------------------------------------------------------
  // SECTION 3: HTTP API & End-to-End PM-4 Lifecycle Verification
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: HTTP API & End-to-End PM-4 Lifecycle Verification ---');

  const server = http.createServer(app);
  await new Promise<void>(res => server.listen(0, '127.0.0.1', () => res()));

  try {
    // Setup fresh challenge & competitor offer
    const testChalId = `CHAL-PM4-E2E-${Date.now()}`;
    const testChal = {
      id: testChalId,
      consumerId: 'user_consumer_1',
      referenceNumber: `CHAL-NV-${Math.floor(10000 + Math.random() * 90000)}`,
      jurisdiction: 'NV',
      coverageBaselineId: `BASE-${Date.now()}`,
      openingTimestamp: new Date().toISOString(),
      closingTimestamp: new Date(Date.now() + 86400000).toISOString(),
      disclosureLevel: 'MARKETPLACE_ANONYMOUS' as const,
      offersCount: 0,
      status: 'OPEN' as const,
      baseline: {
        id: `BASE-${Date.now()}`,
        policyId: `POL-${Date.now()}`,
        version: 1,
        carrier: 'State Farm Mutual',
        effectiveDate: '2026-10-01',
        expirationDate: '2027-10-01',
        baselineAnnualPremium: 2964,
        baselineMonthlyPremium: 247,
        jurisdiction: 'NV',
        vehicle: {
          vin: '4T1B11HK5RU123498',
          year: 2022,
          make: 'Toyota',
          model: 'Camry',
          usage: 'COMMUTE' as const,
          annualMileage: 12000,
          garagingZip: '89012',
          ownership: 'OWNED' as const
        },
        coverages: [],
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'system'
      },
      requirements: {
        id: `REQ-${Date.now()}`,
        ruleSummary: 'Beat price without reducing protection',
        minAnnualSavings: 100,
        maxCollisionDeductible: 500,
        maxCompDeductible: 250,
        mustIncludeRental: true,
        mustIncludeRoadside: true
      },
      createdAt: new Date().toISOString()
    };
    db.createChallenge(testChal);
    addTestOffer(db, testChalId);
    await synchronizeFixturePersistence();

    const offers = db.getOffers(testChalId);
    assert(offers.length > 0, 'Offers seeded for challenge');
    const winningOffer = offers[0];

    // 1. POST /api/marketplace/challenges/:id/select-version
    // Invariant: Locks version, creates Selection & BindingHandoff, NO PII released
    const selRes = await request(
      server,
      'POST',
      `/api/marketplace/challenges/${testChalId}/select-version`,
      {
        offerId: winningOffer.id,
        versionNumber: winningOffer.version || 1,
        consumerId: 'user_consumer_1'
      }
    );
    assert(selRes.status === 200 && selRes.body.success, 'select-version endpoint returns 200', JSON.stringify(selRes.body));
    assert(selRes.body.selection && selRes.body.selection.offerId === winningOffer.id, 'Selection created with exact offer');
    assert(selRes.body.handoff && selRes.body.handoff.status === 'SELECTED', 'BindingHandoff initiated in SELECTED status');
    assert(!selRes.body.handoff.consentGrantId, 'Selection does NOT auto-grant consent');

    const handoffId = selRes.body.handoff.id;

    // 2. Non-owner selection attempt fails
    const unauthorizedSelRes = await request(
      server,
      'POST',
      `/api/marketplace/challenges/${testChalId}/select-version`,
      {
        offerId: winningOffer.id,
        versionNumber: winningOffer.version || 1,
        consumerId: 'user_intruder'
      }
    );
    assert(unauthorizedSelRes.status === 400 || unauthorizedSelRes.status === 401 || unauthorizedSelRes.status === 403, 'Unauthorized consumer selection rejected', `${unauthorizedSelRes.status} ${JSON.stringify(unauthorizedSelRes.body)}`);

    // 3. Provider attempt to execute disclosure WITHOUT consent fails
    const prematureDiscRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoffId}/execute-disclosure`,
      {
        consentGrantId: 'NON_EXISTENT_CONSENT'
      },
      { 'x-provider-user-id': 'user_apex_1' }
    );
    assert(prematureDiscRes.status === 400 || prematureDiscRes.status === 404, 'Disclosure without valid consent strictly rejected', `${prematureDiscRes.status} ${JSON.stringify(prematureDiscRes.body)}`);

    // 4. POST /api/marketplace/binding/:handoffId/grant-consent
    const grantRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoffId}/grant-consent`,
      {
        challengeId: testChalId,
        consumerId: 'user_consumer_1',
        authorizedFieldNames: ['namedInsured', 'vin', 'garagingAddress', 'driverLicenseNumber'],
        purpose: 'STAGE_C_BINDING_DISCLOSURE',
        purposeExplanation: 'Authorization to disclose Stage C PII for binding handoff'
      }
    );
    assert(grantRes.status === 200 && grantRes.body.success, 'grant-consent endpoint returns 200');
    assert(grantRes.body.consentGrant && grantRes.body.consentGrant.authorizedFieldNames.length === 4, 'ConsentGrant records authorized fields');
    assert(grantRes.body.consentGrant.recipientOrganizationId === winningOffer.providerId, 'Consent restricted to winning provider org');

    const consentGrantId = grantRes.body.consentGrant.id;

    // 5. POST /api/marketplace/binding/:handoffId/execute-disclosure
    // With valid consent from authenticated provider
    const discRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoffId}/execute-disclosure`,
      {
        consentGrantId,
        recipientAgentName: 'Sarah Jenkins'
      },
      { 'x-provider-user-id': 'user_apex_1' }
    );
    assert(discRes.status === 200 && discRes.body.success, 'execute-disclosure endpoint returns 200');
    assert(discRes.body.disclosureEvent && discRes.body.disclosureEvent.eventPayloadHash.length === 64, 'DisclosureEvent computes factual SHA-256 hash');
    assert(discRes.body.handoff && discRes.body.handoff.status === 'DISCLOSURE_AUTHORIZED', 'Handoff transitions to DISCLOSURE_AUTHORIZED');
    assert(discRes.body.disclosedData && discRes.body.disclosedData.vin === '4T1B11HK5RU123498', 'Authorized VIN disclosed');
    assert(discRes.body.disclosedData.salary === undefined, 'Non-authorized data strictly filtered');

    // 6. POST /api/marketplace/binding/:handoffId/revoke-consent
    // Consumer revokes consent
    const revokeRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoffId}/revoke-consent`,
      {
        consentGrantId,
        consumerId: 'user_consumer_1'
      }
    );
    assert(revokeRes.status === 200 && revokeRes.body.success, 'revoke-consent endpoint returns 200');
    assert(revokeRes.body.consentGrant && !!revokeRes.body.consentGrant.revokedAt, 'ConsentGrant is marked revoked');

    // Future disclosure attempt with revoked consent fails
    const postRevokeDiscRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoffId}/execute-disclosure`,
      {
        consentGrantId
      },
      { 'x-provider-user-id': 'user_apex_1' }
    );
    assert(postRevokeDiscRes.status === 400, 'Future disclosure with revoked consent strictly rejected');

    // Historical DisclosureEvents remain intact in GET /api/marketplace/binding/:handoffId
    const getHandoffRes = await request(server, 'GET', `/api/marketplace/binding/${handoffId}`);
    assert(getHandoffRes.status === 200 && getHandoffRes.body.disclosureEvents.length === 1, 'Historical DisclosureEvents preserved after revocation');

    // 7. Provider updates status to APPLICATION_SUBMITTED then UNDERWRITING
    const appSubmitRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoffId}/update-status`,
      { newStatus: 'APPLICATION_SUBMITTED' },
      { 'x-provider-user-id': 'user_apex_1' }
    );
    assert(appSubmitRes.status === 200 && appSubmitRes.body.handoff.status === 'APPLICATION_SUBMITTED', 'Transitioned to APPLICATION_SUBMITTED');

    const underRes = await request(
      server,
      'POST',
      `/api/marketplace/binding/${handoffId}/update-status`,
      { newStatus: 'UNDERWRITING' },
      { 'x-provider-user-id': 'user_apex_1' }
    );
    assert(underRes.status === 200 && underRes.body.handoff.status === 'UNDERWRITING', 'Transitioned to UNDERWRITING');

    // 8. PR-3 retires all platform-facilitated modification negotiation
    const originalOfferVersionSnapshot = db.getOfferVersions(winningOffer.id)[0];
    const originalPremium = originalOfferVersionSnapshot ? originalOfferVersionSnapshot.annualPremium : winningOffer.annualPremium;
    for (const endpoint of ['propose-modification', 'resolve-modification', 'accept-modification', 'reject-modification']) {
      const retired = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/${endpoint}`, {},
        endpoint === 'propose-modification' ? { 'x-provider-user-id': 'user_apex_1' } : undefined);
      assert(retired.status === 410, `${endpoint} returns HTTP 410`);
    }

    const termsInjection = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/cannot-honor`, {
      reasonCode: 'CARRIER_DECLINED', modifiedAnnualPremium: 2680
    }, { 'x-provider-user-id': 'user_apex_1' });
    assert(termsInjection.status === 400, 'cannot-honor rejects revised price or terms fields');

    const statusTermsInjection = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/update-status`, {
      newStatus: 'UNDERWRITING', finalPremium: 2680
    }, { 'x-provider-user-id': 'user_apex_1' });
    assert(statusTermsInjection.status === 400, 'binding status endpoint rejects revised premium fields');

    const cannotHonor = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/cannot-honor`, {
      reasonCode: 'CARRIER_DECLINED'
    }, { 'x-provider-user-id': 'user_apex_1' });
    assert(cannotHonor.status === 200 && cannotHonor.body.success, 'Selected provider can report cannot-honor factually');
    assert(cannotHonor.body.failure.reasonCode === 'CARRIER_DECLINED', 'Controlled reason code is persisted');
    assert(cannotHonor.body.handoff.status === 'DECLINED', 'Handoff ends in DECLINED without a counterproposal');

    const retry = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/cannot-honor`, {
      reasonCode: 'CARRIER_DECLINED'
    }, { 'x-provider-user-id': 'user_apex_1' });
    assert(retry.status === 200 && retry.body.failure.id === cannotHonor.body.failure.id, 'Cannot-honor retry is idempotent');

    const versionsAfterReport = db.getOfferVersions(winningOffer.id);
    if (versionsAfterReport.length > 0) {
      assert(versionsAfterReport[0].annualPremium === originalPremium, 'Selected OfferVersion remains strictly immutable after cannot-honor report');
    }
    const durableConsent = await postgresStore.getConsentGrant(grantRes.body.consentGrant.id);
    assert(durableConsent?.revokedAt === revokeRes.body.consentGrant.revokedAt, 'Cannot-honor report does not alter consent revocation history');
    const notices = await postgresStore.getNotificationsForRecipient({ recipientType: 'CONSUMER', recipientId: 'user_consumer_1' });
    assert(notices.some(n => n.type === 'SELECTED_OFFER_UNAVAILABLE'), 'Consumer receives a factual selected-offer-unavailable notice');

    // 9. Audit Trail includes PM-4 and PR-3 governed events
    const auditEvents = await postgresStore.getAuditEvents();
    const pm4Types = new Set(auditEvents.map(e => e.eventType));
    assert(pm4Types.has('OFFER_VERSION_SELECTED'), 'Audit log contains OFFER_VERSION_SELECTED');
    assert(pm4Types.has('CONSENT_GRANTED'), 'Audit log contains CONSENT_GRANTED');
    assert(pm4Types.has('CONSENT_REVOKED'), 'Audit log contains CONSENT_REVOKED');
    assert(pm4Types.has('PII_DISCLOSED'), 'Audit log contains PII_DISCLOSED');
    assert(pm4Types.has('SELECTED_OFFER_CANNOT_BE_HONORED'), 'Audit log contains SELECTED_OFFER_CANNOT_BE_HONORED');
    assert(pm4Types.has('BINDING_STATUS_CHANGED'), 'Audit log contains BINDING_STATUS_CHANGED');

  } finally {
    server.close();
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`PM-4 VALIDATION SUMMARY: ${passedTests} / ${totalTests} CHECKS PASSED (${failedTests} FAILED)`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPM4AcceptanceValidation().catch(err => {
  console.error('[Fatal Validation Error]:', err);
  process.exit(1);
});
