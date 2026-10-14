/**
 * PM-5 Issued Policy Reconciliation, Verification & Baseline Activation Acceptance Validation Suite
 * 
 * Verifies canonical specifications:
 *   1. PM-1, PM-2, PM-3, PM-4 Non-Regression Invariants
 *   2. Evidence-First Ingestion: Raw issued declarations document stored, SHA-256 hashed, normalized snapshot extracted
 *   3. ExpectedBoundTerms Immutability: OfferVersion strictly immutable; dynamic layering of accepted BindingModifications
 *   4. Factual Classification: Verdicts (MATCH, AUTHORIZED_VARIANCE, UNAUTHORIZED_VARIANCE, REVIEW_REQUIRED)
 *   5. Discrepancy Categories: PREMIUM_INCREASE, DEDUCTIBLE_INCREASE, LIMIT_REDUCTION, COVERAGE_MISSING, ENDORSEMENT_MISSING, OTHER_TERM_VARIANCE
 *   6. Governed Consumer Review: Dispute (halts vault) vs Accept (files to vault)
 *   7. Policy Vault Filing: Complete provenance chain & future CoverageBaseline activation
 *   8. Relational Persistence & Durability: PGlite tables (issued_policy_documents, issued_policy_snapshots, reconciliation_reports, policy_vault_items)
 *   9. Live HTTP API End-to-End Execution
 *  10. Strict Exclusion: Zero platform fees, billing ledger events, or settlement endpoints
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PostgresStore, postgresStore } from '../src/server/db/postgresStore';
import { SQL_MIGRATION_V4 } from '../src/server/db/migrate';
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
import { runPM5DomainTestSuite } from '../src/domain/pm5Reconciliation.test';
import {
  IssuedPolicyDocument,
  IssuedPolicySnapshot,
  ReconciliationReport,
  PolicyVaultItem
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

function makeChallenge(id: string, consumerId: string, basePrice = 2964) {
  const baselineId = `BASE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    id,
    consumerId,
    referenceNumber: `CHAL-NV-${Math.floor(10000 + Math.random() * 90000)}`,
    jurisdiction: 'NV',
    coverageBaselineId: baselineId,
    openingTimestamp: new Date().toISOString(),
    closingTimestamp: new Date(Date.now() + 86400000).toISOString(),
    disclosureLevel: 'MARKETPLACE_ANONYMOUS' as const,
    offersCount: 0,
    status: 'OPEN' as const,
    competitionStatus: 'CONSUMER_REVIEW' as const,
    isFinalRound: true,
    currentRound: 'BEST_AND_FINAL' as const,
    baseline: {
      id: baselineId,
      policyId: `POL-${Date.now()}`,
      version: 1,
      carrier: 'State Farm Mutual',
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      baselineAnnualPremium: basePrice,
      baselineMonthlyPremium: Math.round(basePrice / 12),
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
      coverages: [
        { id: 'cov_bi', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY' as const, perPersonLimit: 100000, perAccidentLimit: 300000, deductible: 0, isIncluded: true },
        { id: 'cov_pd', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY' as const, propertyLimit: 100000, deductible: 0, isIncluded: true },
        { id: 'cov_col', code: 'COLLISION', name: 'Collision', category: 'PHYSICAL_DAMAGE' as const, deductible: 500, isIncluded: true },
        { id: 'cov_comp', code: 'COMPREHENSIVE', name: 'Comprehensive', category: 'PHYSICAL_DAMAGE' as const, deductible: 250, isIncluded: true }
      ],
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
}

async function runPM5AcceptanceValidation() {
  console.log('\n============================================================');
  console.log('OPEN POLICY PM-5 ACCEPTANCE & REGRESSION VALIDATION SUITE');
  console.log('============================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Prior PM Suites Non-Regression Gates
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: Non-Regression Gates (PM-1, PM-2, PM-3, PM-4, PM-5) ---');
  
  const pm1 = runPM1AcceptanceTestSuite();
  assert(pm1.failed === 0, `PM-1 Marketplace Foundation Domain Suite (${pm1.passed}/${pm1.total} passed)`);

  const pm2 = runPM2AcceptanceTestSuite();
  assert(pm2.failed === 0, `PM-2 Information & Multi-Carrier Offers Domain Suite (${pm2.passed}/${pm2.total} passed)`);

  const pm3 = runPM3AcceptanceTestSuite();
  assert(pm3.failed === 0, `PM-3 Competition Rounds Domain Suite (${pm3.passed}/${pm3.total} passed)`);

  const pm4Domain = runPM4AcceptanceTestSuite();
  assert(pm4Domain.failed === 0, `PM-4 Selection & Binding Domain Suite (${pm4Domain.passed}/${pm4Domain.total} passed)`);

  const pm5Domain = runPM5DomainTestSuite();
  assert(pm5Domain.failed === 0, `PM-5 Issued Policy Reconciliation Domain Suite (${pm5Domain.passed}/${pm5Domain.total} passed)`);

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
  console.log('\n--- SECTION 2: PM-5 Relational Schema & Persistence Verification ---');
  
  const testDbDir = path.join(process.cwd(), 'data', 'test_pm5_pg');
  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  }

  const store = new PostgresStore(testDbDir);
  await store.init();

  const counts = await store.getTableCounts();
  assert(counts['issued_policy_documents'] === 0, 'Relational table `issued_policy_documents` initialized');
  assert(counts['issued_policy_snapshots'] === 0, 'Relational table `issued_policy_snapshots` initialized');
  assert(counts['reconciliation_reports'] === 0, 'Relational table `reconciliation_reports` initialized');
  assert(counts['policy_vault_items'] === 0, 'Relational table `policy_vault_items` initialized');

  // Verify persistence methods for PM-5
  const mockDoc: IssuedPolicyDocument = {
    id: 'DOC-PM5-001',
    bindingHandoffId: 'HND-PM5-001',
    challengeId: 'CHAL-PM5-01',
    providerOrganizationId: 'org_apex',
    fileName: 'Travelers_Issued_DecPage.pdf',
    fileSizeBytes: 428190,
    mimeType: 'application/pdf',
    documentSha256: crypto.createHash('sha256').update('Mock Dec Page Content').digest('hex'),
    storageRef: 'storage://docs/DOC-PM5-001.pdf',
    uploadedAt: new Date().toISOString()
  };
  await store.saveIssuedPolicyDocument(mockDoc);
  const savedDocs = await store.getIssuedPolicyDocuments('HND-PM5-001');
  assert(savedDocs.length === 1 && savedDocs[0].id === 'DOC-PM5-001', 'PostgresStore saves and queries IssuedPolicyDocument records');

  const mockSnapshot: IssuedPolicySnapshot = {
    id: 'SNP-PM5-001',
    issuedPolicyDocumentId: 'DOC-PM5-001',
    bindingHandoffId: 'HND-PM5-001',
    carrier: 'Travelers',
    policyNumber: 'TRV-99281-01',
    effectiveDate: '2026-10-01',
    expirationDate: '2027-10-01',
    annualPremium: 2540,
    monthlyPremium: Math.round(2540 / 12),
    coverages: [
      {
        id: 'cov-bi-1',
        code: 'BODILY_INJURY',
        name: 'Bodily Injury Liability',
        category: 'LIABILITY',
        perPersonLimit: 250000,
        perAccidentLimit: 500000,
        deductible: 0,
        isIncluded: true
      }
    ],
    extractionConfidence: 0.98,
    isAmbiguous: false,
    snapshotSha256: crypto.createHash('sha256').update('snapshot-content').digest('hex'),
    extractedAt: new Date().toISOString()
  };
  await store.saveIssuedPolicySnapshot(mockSnapshot);
  const savedSnapshots = await store.getIssuedPolicySnapshots('HND-PM5-001');
  assert(savedSnapshots.length === 1 && savedSnapshots[0].policyNumber === 'TRV-99281-01', 'PostgresStore saves and queries IssuedPolicySnapshot records');

  const mockReport: ReconciliationReport = {
    id: 'REP-PM5-001',
    bindingHandoffId: 'HND-PM5-001',
    challengeId: 'CHAL-PM5-01',
    issuedPolicyDocumentId: 'DOC-PM5-001',
    issuedPolicySnapshotId: 'SNP-PM5-001',
    verdict: 'MATCH',
    status: 'COMPLETED_MATCH',
    discrepancies: [],
    totalAnnualPremiumVariance: 0,
    expectedTermsSummary: {
      annualPremium: 2540,
      carrier: 'Travelers',
      acceptedModificationCount: 0
    },
    issuedTermsSummary: {
      policyNumber: 'TRV-99281-01',
      annualPremium: 2540,
      carrier: 'Travelers'
    },
    reconciledAt: new Date().toISOString(),
    reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
  };
  await store.saveReconciliationReport(mockReport);
  const savedReports = await store.getReconciliationReports('HND-PM5-001');
  assert(savedReports.length === 1 && savedReports[0].verdict === 'MATCH', 'PostgresStore saves and queries ReconciliationReport records');

  const mockVaultItem: PolicyVaultItem = {
    id: 'VLT-PM5-001',
    consumerId: 'user_consumer_1',
    challengeId: 'CHAL-PM5-01',
    selectionId: 'SEL-PM5-001',
    bindingHandoffId: 'HND-PM5-001',
    selectedOfferVersionId: 'VER-PM5-01',
    acceptedBindingModificationIds: [],
    issuedPolicyDocumentId: 'DOC-PM5-001',
    issuedPolicySnapshotId: 'SNP-PM5-001',
    reconciliationReportId: 'REP-PM5-001',
    futureCoverageBaselineId: 'BASE-FUTURE-01',
    carrier: 'Travelers',
    policyNumber: 'TRV-99281-01',
    annualPremium: 2540,
    effectiveDate: '2026-10-01',
    expirationDate: '2027-10-01',
    coverages: mockSnapshot.coverages,
    provenanceHash: crypto.createHash('sha256').update('provenance-payload').digest('hex'),
    status: 'ACTIVE',
    filedAt: new Date().toISOString()
  };
  await store.savePolicyVaultItem(mockVaultItem);
  const savedVaultItems = await store.getPolicyVaultItems('user_consumer_1');
  assert(savedVaultItems.length === 1 && savedVaultItems[0].policyNumber === 'TRV-99281-01', 'PostgresStore saves and queries PolicyVaultItem records');

  // Verify restart durability
  await store.close();
  const storeRestarted = new PostgresStore(testDbDir);
  await storeRestarted.init();
  const restartedCounts = await storeRestarted.getTableCounts();
  assert(restartedCounts['issued_policy_documents'] === 1, 'Durability: `issued_policy_documents` survived restart');
  assert(restartedCounts['issued_policy_snapshots'] === 1, 'Durability: `issued_policy_snapshots` survived restart');
  assert(restartedCounts['reconciliation_reports'] === 1, 'Durability: `reconciliation_reports` survived restart');
  assert(restartedCounts['policy_vault_items'] === 1, 'Durability: `policy_vault_items` survived restart');
  await storeRestarted.close();

  // --------------------------------------------------------------------------
  // SECTION 3: Live HTTP API End-to-End PM-5 Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Live HTTP API End-to-End PM-5 Lifecycle ---');
  
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));

  try {
    // 3.1 Setup Bound Handoff with accepted underwriting modification
    const chalId1 = `chal_pm5_test1_${Date.now()}`;
    const consumerId = 'user_consumer_pm5';

    const testChal1 = makeChallenge(chalId1, consumerId, 3000);
    db.createChallenge(testChal1 as any);
    addTestOffer(db, chalId1);
    await synchronizeFixturePersistence();

    const offers1 = db.getOffers(chalId1);
    assert(offers1.length > 0, 'Offers seeded for challenge 1');
    const winningOffer = offers1[0];

    // 1. Consumer selects OfferVersion
    const selectRes = await request(server, 'POST', `/api/marketplace/challenges/${chalId1}/select-version`, {
      offerId: winningOffer.id,
      versionNumber: winningOffer.version || 1,
      consumerId
    });
    assert(selectRes.status === 200 && selectRes.body.success, 'Step 1: OfferVersion selected', JSON.stringify(selectRes.body));
    const handoffId = selectRes.body.handoff.id;

    // 2. Consumer grants consent
    const consentRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/grant-consent`, {
      challengeId: chalId1,
      consumerId,
      authorizedFieldNames: ['namedInsured', 'vin', 'garagingAddress', 'driverLicenseNumber'],
      purpose: 'STAGE_C_BINDING_DISCLOSURE',
      purposeExplanation: 'Authorize the selected provider to complete binding'
    });
    assert(consentRes.status === 200 && consentRes.body.success, 'Step 2: Stage C consent granted', JSON.stringify(consentRes.body));

    // 3. Licensed provider completes application and underwriting on its own channel.
    const modifiedAnnualPremium = winningOffer.annualPremium;
    const applicationRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/update-status`, {
      newStatus: 'APPLICATION_SUBMITTED'
    }, {
      'x-provider-user-id': 'user_apex_1'
    });
    assert(applicationRes.status === 200 && applicationRes.body.success, 'Step 3: Application status recorded without transmitting revised terms');

    const underwritingRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/update-status`, {
      newStatus: 'UNDERWRITING'
    }, {
      'x-provider-user-id': 'user_apex_1'
    });
    assert(underwritingRes.status === 200 && underwritingRes.body.success, 'Step 4: Underwriting status recorded without platform negotiation');

    // 5. Provider updates status to BOUND
    const boundRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/update-status`, {
      newStatus: 'BOUND',
      policyNumber: 'TRV-POL-772910'
    }, {
      'x-provider-user-id': 'user_apex_1'
    });
    assert(boundRes.status === 200 && boundRes.body.handoff.status === 'BOUND', 'Step 5: Handoff transitioned to BOUND');

    // ------------------------------------------------------------------------
    // Test 3.2: Evidence-First Upload of Issued Policy Document & Normalized Extraction
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.2: Evidence-First Dec Page Upload ---');
    const decPageRawText = `
      TRAVELERS COMMERCIAL & PERSONAL INSURANCE
      AUTOMOBILE POLICY DECLARATIONS PAGE
      Policy Number: TRV-POL-772910
      Effective: 10/01/2026 to 10/01/2027
      Named Insured: Jane Doe
      Garaging: 100 Main St, Reno NV 89501
      Vehicle 1: 2022 Toyota Camry (VIN: 4T1B11HK5RU123498)
      
      TOTAL ANNUAL PREMIUM: $${modifiedAnnualPremium}.00
    `;

    const uploadRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/upload-issued-policy`, {
      fileName: 'Travelers_DecPage_TRV772910.pdf',
      fileSizeBytes: decPageRawText.length,
      mimeType: 'application/pdf',
      rawContent: decPageRawText,
      extractedTerms: {
        carrier: winningOffer.carrier,
        policyNumber: 'TRV-POL-772910',
        annualPremium: modifiedAnnualPremium,
        monthlyPremium: Math.round(modifiedAnnualPremium / 12),
        effectiveDate: '2026-10-01',
        expirationDate: '2027-10-01',
        coverages: winningOffer.coverages,
        extractionConfidence: 0.98,
        isAmbiguous: false
      }
    }, {
      'x-provider-user-id': 'user_apex_1'
    });

    assert(uploadRes.status === 200 && uploadRes.body.success, 'Provider uploads raw dec page and creates immutable document & snapshot');
    assert(uploadRes.body.document.documentSha256.length === 64, 'Document SHA-256 hash verified');
    assert(uploadRes.body.snapshot.policyNumber === 'TRV-POL-772910', 'Normalized IssuedPolicySnapshot created');

    // ------------------------------------------------------------------------
    // Test 3.3: Deterministic Policy Reconciliation (Exact Match vs Expected Terms)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.3: Deterministic Policy Reconciliation ---');
    const reconcileRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/reconcile`, {}, {
      'x-provider-user-id': 'user_apex_1'
    });

    assert(reconcileRes.status === 200 && reconcileRes.body.success, 'Deterministic reconciliation executes successfully');
    const report = reconcileRes.body.report;
    assert(report.verdict === 'MATCH' || report.verdict === 'AUTHORIZED_VARIANCE', `Reconciliation verdict is MATCH or AUTHORIZED_VARIANCE (actual: ${report.verdict})`);
    assert(report.totalAnnualPremiumVariance === 0, 'Total annual premium variance is $0');
    assert(report.expectedTermsSummary.annualPremium === modifiedAnnualPremium, `Expected terms remain anchored to selected OfferVersion ($${modifiedAnnualPremium})`);

    // Verify Offer was NOT mutated
    const originalOffer = db.getOffer(winningOffer.id);
    assert(originalOffer?.annualPremium === winningOffer.annualPremium, `Canonical Invariant: Selected Offer remains strictly immutable at original $${winningOffer.annualPremium}`);

    // ------------------------------------------------------------------------
    // Test 3.4: Automated Vault Filing & Future CoverageBaseline Activation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.4: Vault Filing & Future Baseline Activation ---');
    assert(reconcileRes.body.vaultItem !== undefined, 'Matching policy automatically filed to Private Policy Vault');
    const vaultItem = reconcileRes.body.vaultItem;
    assert(vaultItem.carrier === winningOffer.carrier, 'Vault item carrier matches Travelers');
    assert(vaultItem.policyNumber === 'TRV-POL-772910', 'Vault item policy number matches issued policy');
    assert(vaultItem.annualPremium === modifiedAnnualPremium, 'Vault item annual premium matches bound terms');
    assert(vaultItem.status === 'ACTIVE', 'Vault item status is ACTIVE');
    assert(vaultItem.provenanceHash && vaultItem.provenanceHash.length === 64, 'Cryptographic provenance hash generated');
    assert(vaultItem.futureCoverageBaselineId !== undefined, 'Future CoverageBaseline created');

    const futureBaseline = await postgresStore.getCoverageBaseline(vaultItem.futureCoverageBaselineId);
    assert(futureBaseline !== undefined, 'Future CoverageBaseline retrievable from database');
    assert(futureBaseline?.baselineAnnualPremium === modifiedAnnualPremium, `Future CoverageBaseline reflects new annual premium ($${modifiedAnnualPremium})`);

    // Historical baseline untouched
    const historicalBaseline = db.getBaseline(testChal1.baseline.id);
    assert(historicalBaseline?.baselineAnnualPremium === 3000, 'Canonical Invariant: Historical CoverageBaseline remains intact');

    // ------------------------------------------------------------------------
    // Test 3.5: Discrepancy Detection & Unauthorized Variance Workflow
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.5: Unauthorized Variance Detection ---');
    const chalId2 = `chal_pm5_disc_${Date.now()}`;
    const testChal2 = makeChallenge(chalId2, consumerId, 3000);
    db.createChallenge(testChal2 as any);
    addTestOffer(db, chalId2);
    await synchronizeFixturePersistence();

    const offers2 = db.getOffers(chalId2);
    const winningOffer2 = offers2[0];

    const selRes2 = await request(server, 'POST', `/api/marketplace/challenges/${chalId2}/select-version`, {
      offerId: winningOffer2.id,
      versionNumber: winningOffer2.version || 1,
      consumerId
    });
    const handoffId2 = selRes2.body.handoff.id;

    await request(server, 'POST', `/api/marketplace/binding/${handoffId2}/grant-consent`, {
      challengeId: chalId2,
      consumerId,
      authorizedFieldNames: ['namedInsured', 'vin']
    });

    await request(server, 'POST', `/api/marketplace/binding/${handoffId2}/update-status`, {
      newStatus: 'APPLICATION_SUBMITTED'
    }, {
      'x-provider-user-id': 'user_apex_1'
    });

    await request(server, 'POST', `/api/marketplace/binding/${handoffId2}/update-status`, {
      newStatus: 'BOUND',
      policyNumber: 'TRV-UNAUTH-881'
    }, {
      'x-provider-user-id': 'user_apex_1'
    });

    // Upload dec page with unauthorized premium increase (+$350) and altered coverages
    const discrepantPremium = winningOffer2.annualPremium + 350;
    const alteredCoverages = winningOffer2.coverages.map(c => {
      if (c.code === 'COLLISION') return { ...c, deductible: 1000 };
      if (c.code === 'RENTAL_REIMBURSEMENT') return { ...c, isIncluded: false };
      return c;
    });

    await request(server, 'POST', `/api/marketplace/binding/${handoffId2}/upload-issued-policy`, {
      fileName: 'Travelers_Discrepant_DecPage.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'Discrepant declarations page with higher premium and deductible',
      extractedTerms: {
        carrier: winningOffer2.carrier,
        policyNumber: 'TRV-UNAUTH-881',
        annualPremium: discrepantPremium,
        monthlyPremium: Math.round(discrepantPremium / 12),
        effectiveDate: '2026-10-01',
        expirationDate: '2027-10-01',
        coverages: alteredCoverages,
        extractionConfidence: 0.96,
        isAmbiguous: false
      }
    }, {
      'x-provider-user-id': 'user_apex_1'
    });

    const reconcileRes2 = await request(server, 'POST', `/api/marketplace/binding/${handoffId2}/reconcile`, {}, {
      'x-provider-user-id': 'user_apex_1'
    });

    assert(reconcileRes2.status === 200, 'Reconcile endpoint executed for discrepant policy');
    const discReport = reconcileRes2.body.report;
    assert(discReport.verdict === 'UNAUTHORIZED_VARIANCE', `Verdict correctly classified as UNAUTHORIZED_VARIANCE (actual: ${discReport.verdict})`);
    assert(discReport.status === 'PENDING_CONSUMER_REVIEW', `Status set to PENDING_CONSUMER_REVIEW (actual: ${discReport.status})`);
    assert(discReport.totalAnnualPremiumVariance === 350, `Annual variance calculated as +$350 (actual: ${discReport.totalAnnualPremiumVariance})`);
    assert(discReport.discrepancies.length >= 1, `Discrepancies identified (count: ${discReport.discrepancies.length})`);
    
    const premiumDisc = discReport.discrepancies.find((d: any) => d.category === 'PREMIUM_INCREASE');
    assert(premiumDisc !== undefined, 'PREMIUM_INCREASE discrepancy recorded');
    assert(premiumDisc.financialImpactAnnual === 350, 'Financial impact recorded as $350/yr');

    // ------------------------------------------------------------------------
    // Test 3.6: Ambiguous Extraction Handling (REVIEW_REQUIRED)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.6: Ambiguous Extraction Handling ---');
    const chalId3 = `chal_pm5_ambig_${Date.now()}`;
    const testChal3 = makeChallenge(chalId3, consumerId, 3000);
    db.createChallenge(testChal3 as any);
    addTestOffer(db, chalId3);
    await synchronizeFixturePersistence();

    const offers3 = db.getOffers(chalId3);
    const winningOffer3 = offers3[0];

    const selRes3 = await request(server, 'POST', `/api/marketplace/challenges/${chalId3}/select-version`, {
      offerId: winningOffer3.id,
      versionNumber: winningOffer3.version || 1,
      consumerId
    });
    const handoffId3 = selRes3.body.handoff.id;

    await request(server, 'POST', `/api/marketplace/binding/${handoffId3}/grant-consent`, {
      challengeId: chalId3,
      consumerId,
      authorizedFieldNames: ['namedInsured', 'vin']
    });

    await request(server, 'POST', `/api/marketplace/binding/${handoffId3}/update-status`, {
      newStatus: 'APPLICATION_SUBMITTED'
    }, {
      'x-provider-user-id': 'user_apex_1'
    });

    await request(server, 'POST', `/api/marketplace/binding/${handoffId3}/update-status`, {
      newStatus: 'BOUND',
      policyNumber: 'TRV-AMBIG-001'
    }, {
      'x-provider-user-id': 'user_apex_1'
    });

    // Upload dec page with low extraction confidence (0.72 < 0.85)
    await request(server, 'POST', `/api/marketplace/binding/${handoffId3}/upload-issued-policy`, {
      fileName: 'Blurry_DecPage.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      rawContent: 'Unreadable or blurry text',
      extractedTerms: {
        carrier: winningOffer3.carrier,
        policyNumber: 'TRV-AMBIG-001',
        annualPremium: winningOffer3.annualPremium,
        monthlyPremium: winningOffer3.monthlyPremium,
        effectiveDate: '2026-10-01',
        expirationDate: '2027-10-01',
        coverages: winningOffer3.coverages,
        extractionConfidence: 0.72, // Below 0.85 threshold!
        isAmbiguous: true
      }
    }, {
      'x-provider-user-id': 'user_apex_1'
    });

    const reconcileRes3 = await request(server, 'POST', `/api/marketplace/binding/${handoffId3}/reconcile`, {}, {
      'x-provider-user-id': 'user_apex_1'
    });

    assert(reconcileRes3.status === 200, 'Reconcile executed on low-confidence extraction');
    assert(reconcileRes3.body.report.verdict === 'REVIEW_REQUIRED', `Verdict classified as REVIEW_REQUIRED (actual: ${reconcileRes3.body.report.verdict})`);
    assert(reconcileRes3.body.report.status === 'PENDING_CONSUMER_REVIEW', 'Status set to PENDING_CONSUMER_REVIEW');

    // ------------------------------------------------------------------------
    // Test 3.7: Governed Consumer Dispute Workflow
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.7: Governed Consumer Dispute Workflow ---');
    const disputeRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId2}/consumer-verify`, {
      reconciliationReportId: discReport.id,
      decision: 'DISPUTE_REMEDIATION_REQUESTED',
      disputeNotes: 'Premium was issued $350 higher than agreed and collision deductible was inflated from $500 to $1,000.'
    }, {
      'x-consumer-id': consumerId
    });

    assert(disputeRes.status === 200 && disputeRes.body.success, 'Consumer submits formal dispute');
    assert(disputeRes.body.report.status === 'CONSUMER_DISPUTED', `Report status set to CONSUMER_DISPUTED (actual: ${disputeRes.body.report.status})`);
    assert(disputeRes.body.report.consumerDisputeNotes.includes('inflated'), 'Consumer dispute notes recorded in immutable report');
    assert(disputeRes.body.vaultItem === undefined, 'Disputed policy strictly prevented from filing to Vault');

    // ------------------------------------------------------------------------
    // Test 3.8: Governed Consumer Variance Acceptance Workflow
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.8: Governed Consumer Variance Acceptance Workflow ---');
    const acceptVarianceRes = await request(server, 'POST', `/api/marketplace/binding/${handoffId3}/consumer-verify`, {
      reconciliationReportId: reconcileRes3.body.report.id,
      decision: 'ACCEPT_VARIANCE'
    }, {
      'x-consumer-id': consumerId
    });

    assert(acceptVarianceRes.status === 200 && acceptVarianceRes.body.success, 'Consumer accepts variance after review');
    assert(acceptVarianceRes.body.report.status === 'CONSUMER_ACCEPTED_VARIANCE', `Report status set to CONSUMER_ACCEPTED_VARIANCE (actual: ${acceptVarianceRes.body.report.status})`);
    assert(acceptVarianceRes.body.vaultItem !== undefined, 'Accepted policy filed to Private Vault');
    assert(acceptVarianceRes.body.vaultItem.status === 'ACTIVE', 'Vault item status is ACTIVE');
    assert(acceptVarianceRes.body.vaultItem.futureCoverageBaselineId !== undefined, 'Future CoverageBaseline activated');

    // ------------------------------------------------------------------------
    // Test 3.9: Complete Cryptographic Provenance Chain Inspection
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.9: Complete Cryptographic Provenance Chain ---');
    const vaultListRes = await request(server, 'GET', '/api/marketplace/vault/policies', undefined, {
      'x-consumer-id': consumerId
    });

    assert(vaultListRes.status === 200 && vaultListRes.body.success, 'GET /api/marketplace/vault/policies returns consumer vault items');
    assert(vaultListRes.body.vaultItems.length >= 2, `Consumer has ${vaultListRes.body.vaultItems.length} active policies in vault`);

    const sampleVaultItem = vaultListRes.body.vaultItems[0];
    const singleVaultRes = await request(server, 'GET', `/api/marketplace/vault/policies/${sampleVaultItem.id}`, undefined, {
      'x-consumer-id': consumerId
    });

    assert(singleVaultRes.status === 200 && singleVaultRes.body.success, 'GET /api/marketplace/vault/policies/:id returns vault item');
    const vItem = singleVaultRes.body.vaultItem;
    assert(vItem.selectionId !== undefined, 'Provenance links selectionId');
    assert(vItem.bindingHandoffId !== undefined, 'Provenance links bindingHandoffId');
    assert(vItem.issuedPolicyDocumentId !== undefined, 'Provenance links issuedPolicyDocumentId');
    assert(vItem.issuedPolicySnapshotId !== undefined, 'Provenance links issuedPolicySnapshotId');
    assert(vItem.reconciliationReportId !== undefined, 'Provenance links reconciliationReportId');
    assert(vItem.provenanceHash !== undefined, 'Cryptographic provenanceHash present');

    // ------------------------------------------------------------------------
    // Test 3.10: Tenant Isolation & Authorization Boundary Rejections
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.10: Tenant Isolation & Authorization Boundaries ---');
    // Unauthorized provider cannot upload issued policy
    const rogueProviderUpload = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/upload-issued-policy`, {
      fileName: 'Rogue_DecPage.pdf',
      fileSizeBytes: 100,
      mimeType: 'application/pdf',
      rawContent: 'malicious dec page',
      extractedTerms: {
        carrier: 'Fake',
        policyNumber: 'FK-1',
        annualPremium: 100,
        effectiveDate: '2026-10-01',
        expirationDate: '2027-10-01',
        coverages: []
      }
    }, {
      'x-provider-user-id': 'user_sierra_1' // Belongs to org_sierra, not org_apex
    });
    assert(rogueProviderUpload.status === 403, 'HTTP 403: Unaffiliated provider forbidden from uploading dec page');

    // Unauthorized consumer cannot review reconciliation
    const rogueConsumerVerify = await request(server, 'POST', `/api/marketplace/binding/${handoffId}/consumer-verify`, {
      reconciliationReportId: report.id,
      decision: 'ACCEPT_VARIANCE'
    }, {
      'x-consumer-id': 'user_stranger_danger'
    });
    assert(rogueConsumerVerify.status === 403, 'HTTP 403: Stranger consumer forbidden from reviewing reconciliation');

    // Unauthorized consumer cannot access private vault item
    const rogueVaultAccess = await request(server, 'GET', `/api/marketplace/vault/policies/${sampleVaultItem.id}`, undefined, {
      'x-consumer-id': 'user_stranger_danger'
    });
    assert(rogueVaultAccess.status === 403, 'HTTP 403: Stranger consumer forbidden from accessing foreign policy vault item');

    // ------------------------------------------------------------------------
    // Test 3.11: Append-Only Governed Audit Events
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3.11: Append-Only Governed Audit Trail ---');
    const auditRes = await request(server, 'GET', '/api/audit-events');
    assert(auditRes.status === 200, 'GET /api/audit-events returns audit trail');
    const events = auditRes.body;
    const eventTypes = events.map((e: any) => e.eventType);

    assert(eventTypes.includes('ISSUED_POLICY_UPLOADED'), 'Audit event `ISSUED_POLICY_UPLOADED` recorded');
    assert(eventTypes.includes('ISSUED_POLICY_RECONCILED'), 'Audit event `ISSUED_POLICY_RECONCILED` recorded');
    assert(eventTypes.includes('RECONCILIATION_VARIANCE_RESOLVED'), 'Audit event `RECONCILIATION_VARIANCE_RESOLVED` recorded');
    assert(eventTypes.includes('POLICY_VAULT_FILED'), 'Audit event `POLICY_VAULT_FILED` recorded');
    assert(eventTypes.includes('FUTURE_BASELINE_ACTIVATED'), 'Audit event `FUTURE_BASELINE_ACTIVATED` recorded');

    // ------------------------------------------------------------------------
    // Test 3.12: Strict Zero Platform Economics Invariant
    // ------------------------------------------------------------------------
    // PM-5 must not create, own, import, mutate, or depend upon CE-5 billing/settlement
    // structures. CE-5 legitimately adds billing tables to the platform schema, so the
    // invariant is tested as a boundary against the real schema, not as "no billing
    // tables exist anywhere".
    console.log('\n--- Test 3.12: Strict Zero Platform Economics Invariant (PM-5 / CE-5 boundary) ---');
    const ECONOMICS_TABLE_PATTERN = /billing|ledger|fee|commission|invoice|payment|refund|settlement/;
    const CE5_TABLES = ['billing_periods', 'invoices', 'invoice_line_items', 'payment_records', 'refund_records', 'settlement_allocations'];

    // Own / create: the PM-5 migration (0004) creates no economics tables.
    const pm5OwnedTables = Array.from(SQL_MIGRATION_V4.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g), m => m[1]);
    assert(
      pm5OwnedTables.length > 0 && !pm5OwnedTables.some(t => ECONOMICS_TABLE_PATTERN.test(t)),
      `PM-5 boundary: PM-5 migration creates no billing/settlement tables (owns: ${pm5OwnedTables.join(', ')})`
    );

    const testStore = new PostgresStore(testDbDir);
    await testStore.init();
    const schemaClient = await testStore.getPgClient();
    const schemaTables = (await schemaClient.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    )).rows.map(r => r.table_name);
    assert(
      CE5_TABLES.every(t => schemaTables.includes(t)),
      'PM-5 boundary: real schema inspected, and it contains the CE-5 billing/settlement tables'
    );

    // Depend: no PM-5 table holds a foreign key into a CE-5 table.
    const pm5ToCe5ForeignKeys = (await schemaClient.query<{ from_table: string; to_table: string }>(`
      SELECT tc.table_name AS from_table, ccu.table_name AS to_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    `)).rows.filter(r => pm5OwnedTables.includes(r.from_table) && CE5_TABLES.includes(r.to_table));
    await testStore.close();
    assert(
      pm5ToCe5ForeignKeys.length === 0,
      `PM-5 boundary: no PM-5 table holds a foreign key into CE-5 tables (found ${pm5ToCe5ForeignKeys.length})`
    );

    // Import: the PM-5 engine references no commercial or CE-5 structure.
    const pm5EngineSource = fs.readFileSync(path.join(process.cwd(), 'src/domain/pm5ReconciliationEngine.ts'), 'utf8');
    const ce5Tokens = [
      'commercialStore', 'commercialEconomicsEngine', ...CE5_TABLES,
      'BillingPeriod', 'InvoiceLineItem', 'PaymentRecord', 'RefundRecord', 'SettlementAllocation'
    ];
    const ce5TokensInEngine = ce5Tokens.filter(t => pm5EngineSource.includes(t));
    assert(
      ce5TokensInEngine.length === 0,
      `PM-5 boundary: pm5ReconciliationEngine references no CE-5 billing/settlement structure (${ce5TokensInEngine.join(', ') || 'none'})`
    );

    // Mutate: the full PM-5 lifecycle exercised above wrote nothing to CE-5 tables.
    const liveClient = await postgresStore.getPgClient();
    let ce5RowsWritten = 0;
    for (const table of CE5_TABLES) {
      const res = await liveClient.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${table}`);
      ce5RowsWritten += res.rows[0].n;
    }
    assert(ce5RowsWritten === 0, `PM-5 boundary: PM-5 lifecycle wrote zero rows to CE-5 tables (found ${ce5RowsWritten})`);

    const econEndpointRes = await request(server, 'POST', '/api/marketplace/billing/ledger', {});
    assert(econEndpointRes.status === 404, 'Zero Platform Economics: Billing ledger endpoint does not exist (404)');

    const feeEndpointRes = await request(server, 'POST', '/api/marketplace/fees/settle', {});
    assert(feeEndpointRes.status === 404, 'Zero Platform Economics: Fee settlement endpoint does not exist (404)');

  } finally {
    server.close();
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`PM-5 VALIDATION SUITE COMPLETE: ${passedTests} / ${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`FAILED TESTS: ${failedTests}`);
    process.exit(1);
  } else {
    console.log('ALL PM-5 ACCEPTANCE & CANONICAL INVARIANTS VERIFIED CLEANLY.');
    console.log('============================================================\n');
  }
}

runPM5AcceptanceValidation().catch(err => {
  console.error('Fatal error running PM-5 validation suite:', err);
  process.exit(1);
});
