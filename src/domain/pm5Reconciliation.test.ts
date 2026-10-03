/**
 * PM-5 Domain Unit Test Suite: Issued Policy Reconciliation, Verification & Baseline Activation
 * 
 * Verifies canonical architectural invariants:
 * 1. Evidence-first document ingestion & SHA-256 integrity.
 * 2. ExpectedBoundTerms derived dynamically while preserving OfferVersion strictly immutable.
 * 3. Factual reconciliation classifications (MATCH, AUTHORIZED_VARIANCE, UNAUTHORIZED_VARIANCE, REVIEW_REQUIRED).
 * 4. All 6 discrepancy categories tested deterministically without legalistic breach declarations.
 * 5. Ambiguous extraction handling (REVIEW_REQUIRED).
 * 6. Governed consumer review workflow (ACCEPT_VARIANCE vs DISPUTE_REMEDIATION_REQUESTED).
 * 7. Vault filing with complete cryptographic provenance and future CoverageBaseline activation.
 * 8. Zero platform economics.
 */

import {
  OfferVersion,
  BindingModification,
  BindingHandoff,
  Selection,
  CoverageBaseline,
  CoverageItem,
  ReconciliationReport
} from '../types/insurance';
import {
  deriveExpectedBoundTerms,
  createIssuedPolicyDocument,
  createIssuedPolicySnapshot,
  reconcileIssuedPolicy,
  processConsumerVarianceReview,
  activateVerifiedPolicyToVault
} from './pm5ReconciliationEngine';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export function runPM5DomainTestSuite(): {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  }

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Common Fixtures
  const mockCoverages: CoverageItem[] = [
    {
      id: 'COV-1',
      code: 'BODILY_INJURY',
      name: 'Bodily Injury Liability',
      category: 'LIABILITY',
      isIncluded: true,
      perPersonLimit: 250000,
      perAccidentLimit: 500000
    },
    {
      id: 'COV-2',
      code: 'PROPERTY_DAMAGE',
      name: 'Property Damage Liability',
      category: 'LIABILITY',
      isIncluded: true,
      propertyLimit: 100000
    },
    {
      id: 'COV-3',
      code: 'COLLISION',
      name: 'Collision Coverage',
      category: 'PHYSICAL_DAMAGE',
      isIncluded: true,
      deductible: 500
    },
    {
      id: 'COV-4',
      code: 'COMPREHENSIVE',
      name: 'Comprehensive Coverage',
      category: 'PHYSICAL_DAMAGE',
      isIncluded: true,
      deductible: 250
    },
    {
      id: 'COV-5',
      code: 'RENTAL_REIMBURSEMENT',
      name: 'Rental Car Reimbursement',
      category: 'ADDITIONAL',
      isIncluded: true
    },
    {
      id: 'COV-6',
      code: 'ROADSIDE_ASSISTANCE',
      name: 'Roadside Assistance',
      category: 'ADDITIONAL',
      isIncluded: true
    }
  ];

  const mockOfferVersion: OfferVersion = {
    id: 'VER-APEX-101',
    offerId: 'OFFER-APEX-01',
    versionNumber: 1,
    round: 'ROUND_1_OPEN',
    carrier: 'Progressive Northern Insurance',
    annualPremium: 2400,
    monthlyPremium: 200,
    coverages: mockCoverages,
    supportingQuoteDocName: 'Apex_Quote_PGR.pdf',
    revisionReason: 'Initial Quote',
    submittedAt: '2026-09-29T10:00:00Z'
  };

  const mockSelection: Selection = {
    id: 'SEL-001',
    challengeId: 'CHAL-TEST-001',
    consumerId: 'usr_consumer_alice',
    offerId: 'OFFER-APEX-01',
    offerVersionId: 'VER-APEX-101',
    versionNumber: 1,
    providerOrganizationId: 'org_apex',
    carrier: 'Progressive Northern Insurance',
    annualPremium: 2400,
    monthlyPremium: 200,
    selectedAt: '2026-09-29T10:05:00Z',
    status: 'ACTIVE'
  };

  const mockBindingHandoff: BindingHandoff = {
    id: 'HANDOFF-001',
    bindingReference: 'BIND-NV-1001',
    challengeId: 'CHAL-TEST-001',
    selectionId: 'SEL-001',
    providerOrganizationId: 'org_apex',
    carrier: 'Progressive Northern Insurance',
    status: 'BOUND',
    createdAt: '2026-09-29T10:05:00Z',
    updatedAt: '2026-09-29T11:00:00Z',
    boundAt: '2026-09-29T11:00:00Z',
    policyNumber: 'POL-PGR-778899'
  };

  const mockBaseline: CoverageBaseline = {
    id: 'BASE-001',
    policyId: 'POL-OLD-01',
    version: 1,
    carrier: 'State Farm Mutual',
    effectiveDate: '2025-10-01',
    expirationDate: '2026-10-01',
    baselineAnnualPremium: 2964,
    baselineMonthlyPremium: 247,
    jurisdiction: 'NV',
    vehicle: {
      vin: '4T1B11HK5RU123498',
      year: 2022,
      make: 'Toyota',
      model: 'Camry',
      usage: 'COMMUTE',
      annualMileage: 12000,
      garagingZip: '89012',
      ownership: 'OWNED'
    },
    coverages: mockCoverages,
    verifiedAt: '2025-10-01T00:00:00Z',
    verifiedBy: 'system'
  };

  // ========================================================
  // 1. Evidence-First Ingestion Tests
  // ========================================================
  test('Evidence ingestion: Computes valid SHA-256 for issued declarations document', () => {
    const rawPdf = 'PDF-RAW-DECLARATIONS-PAGE-STREAM-CONTENT-12345';
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'Progressive_DecPage_POL778899.pdf',
      fileSizeBytes: 48920,
      mimeType: 'application/pdf',
      rawContent: rawPdf
    });

    assert(!!doc.id, 'Document ID generated');
    assert(doc.fileName === 'Progressive_DecPage_POL778899.pdf', 'File name preserved');
    assert(doc.documentSha256.length === 64, 'Computed 64-char SHA-256 document hash');
    assert(doc.providerOrganizationId === 'org_apex', 'Provider organization bound');
  });

  test('Snapshot generation: Extracts normalized fields and generates snapshot hash', () => {
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'decpage.pdf',
      fileSizeBytes: 1000,
      mimeType: 'application/pdf',
      rawContent: 'test-content'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: mockCoverages,
      extractionConfidence: 0.98,
      isAmbiguous: false
    });

    assert(snapshot.issuedPolicyDocumentId === doc.id, 'Snapshot points to issued document');
    assert(snapshot.snapshotSha256.length === 64, 'Snapshot SHA-256 generated');
    assert(snapshot.policyNumber === 'POL-PGR-778899', 'Policy number extracted');
    assert(!snapshot.isAmbiguous, 'Snapshot marked unambiguous');
  });

  // ========================================================
  // 2. ExpectedBoundTerms Derivation & OfferVersion Immutability
  // ========================================================
  test('ExpectedBoundTerms: Derives baseline terms without modifying original OfferVersion', () => {
    const originalPremium = mockOfferVersion.annualPremium;
    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    assert(expected.expectedAnnualPremium === 2400, 'Expected premium matches offer version');
    assert(expected.carrier === 'Progressive Northern Insurance', 'Carrier matches offer version');
    assert(expected.acceptedModificationIds.length === 0, 'No accepted modifications');
    assert(mockOfferVersion.annualPremium === originalPremium, 'Original OfferVersion remains untouched');
  });

  test('ExpectedBoundTerms: Integrates accepted BindingModification while preserving OfferVersion immutability', () => {
    const acceptedMod: BindingModification = {
      id: 'MOD-001',
      bindingHandoffId: mockBindingHandoff.id,
      challengeId: 'CHAL-TEST-001',
      providerOrganizationId: 'org_apex',
      providerUserId: 'user_apex_1',
      carrier: 'Progressive Northern Insurance',
      originalAnnualPremium: 2400,
      modifiedAnnualPremium: 2520,
      coverageChanges: [{
        code: 'BODILY_INJURY',
        name: 'Bodily Injury',
        originalValue: '250/500',
        modifiedValue: '250/500',
        isMaterialReduction: false
      }],
      underwritingReason: 'Additional youthful driver endorsement added',
      status: 'ACCEPTED',
      proposedAt: '2026-09-29T10:30:00Z',
      decidedAt: '2026-09-29T10:45:00Z'
    };

    const pendingMod: BindingModification = {
      id: 'MOD-002',
      bindingHandoffId: mockBindingHandoff.id,
      challengeId: 'CHAL-TEST-001',
      providerOrganizationId: 'org_apex',
      providerUserId: 'user_apex_1',
      carrier: 'Progressive Northern Insurance',
      originalAnnualPremium: 2520,
      modifiedAnnualPremium: 2800,
      coverageChanges: [],
      underwritingReason: 'Unapproved surcharge',
      status: 'PENDING_CONSUMER_REVIEW',
      proposedAt: '2026-09-29T10:50:00Z'
    };

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: [acceptedMod, pendingMod]
    });

    assert(expected.expectedAnnualPremium === 2520, 'Expected premium derives from accepted modification');
    assert(expected.acceptedModificationIds.includes('MOD-001'), 'Accepted mod recorded');
    assert(!expected.acceptedModificationIds.includes('MOD-002'), 'Pending mod strictly ignored');
    assert(mockOfferVersion.annualPremium === 2400, 'Underlying OfferVersion is NEVER mutated');
  });

  // ========================================================
  // 3. Factual Deterministic Reconciliation Tests
  // ========================================================
  test('Reconciliation: Detects 100% fidelity exact MATCH', () => {
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'exact-match-doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: mockCoverages
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    assert(report.verdict === 'MATCH', 'Verdict must be MATCH');
    assert(report.status === 'COMPLETED_MATCH', 'Status must be COMPLETED_MATCH');
    assert(report.discrepancies.length === 0, 'Zero discrepancies found');
    assert(report.totalAnnualPremiumVariance === 0, 'Zero premium variance');
  });

  test('Reconciliation Discrepancy 1: PREMIUM_INCREASE detected and classified', () => {
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'premium-increase-doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2650, // $250 higher
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: mockCoverages
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    assert(report.verdict === 'UNAUTHORIZED_VARIANCE', 'Verdict must be UNAUTHORIZED_VARIANCE');
    assert(report.status === 'PENDING_CONSUMER_REVIEW', 'Status must be PENDING_CONSUMER_REVIEW');
    assert(report.totalAnnualPremiumVariance === 250, 'Total premium variance computed as $250');
    const premDiscrepancy = report.discrepancies.find(d => d.category === 'PREMIUM_INCREASE');
    assert(!!premDiscrepancy, 'PREMIUM_INCREASE discrepancy classified');
    assert(premDiscrepancy?.financialImpactAnnual === 250, 'Financial impact recorded');
  });

  test('Reconciliation Discrepancy 2: DEDUCTIBLE_INCREASE detected and classified', () => {
    const modifiedCoverages = mockCoverages.map(c => {
      if (c.code === 'COLLISION') return { ...c, deductible: 1000 }; // Inflated from $500 to $1000
      return c;
    });

    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'deductible-doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: modifiedCoverages
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    assert(report.verdict === 'UNAUTHORIZED_VARIANCE', 'Verdict is UNAUTHORIZED_VARIANCE');
    const dedDiscrepancy = report.discrepancies.find(d => d.category === 'DEDUCTIBLE_INCREASE');
    assert(!!dedDiscrepancy, 'DEDUCTIBLE_INCREASE discrepancy classified');
    assert(dedDiscrepancy?.financialImpactAnnual === 500, 'Financial impact records $500 deductible increase');
  });

  test('Reconciliation Discrepancy 3: LIMIT_REDUCTION detected and classified', () => {
    const modifiedCoverages = mockCoverages.map(c => {
      if (c.code === 'BODILY_INJURY') return { ...c, perPersonLimit: 100000 }; // Cut from $250k to $100k
      return c;
    });

    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'limit-doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: modifiedCoverages
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    const limitDiscrepancy = report.discrepancies.find(d => d.category === 'LIMIT_REDUCTION');
    assert(!!limitDiscrepancy, 'LIMIT_REDUCTION discrepancy classified');
    assert(limitDiscrepancy?.isMaterial === true, 'Limit reduction is classified as material');
  });

  test('Reconciliation Discrepancy 4: COVERAGE_MISSING detected and classified', () => {
    // Drop Comprehensive coverage
    const modifiedCoverages = mockCoverages.filter(c => c.code !== 'COMPREHENSIVE');

    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'cov-missing-doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: modifiedCoverages
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    const covDiscrepancy = report.discrepancies.find(d => d.category === 'COVERAGE_MISSING');
    assert(!!covDiscrepancy, 'COVERAGE_MISSING discrepancy classified');
  });

  test('Reconciliation Discrepancy 5: ENDORSEMENT_MISSING detected and classified', () => {
    // Drop Roadside Assistance endorsement
    const modifiedCoverages = mockCoverages.filter(c => c.code !== 'ROADSIDE_ASSISTANCE');

    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'endorsement-missing-doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: modifiedCoverages
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    const endDiscrepancy = report.discrepancies.find(d => d.category === 'ENDORSEMENT_MISSING');
    assert(!!endDiscrepancy, 'ENDORSEMENT_MISSING discrepancy classified');
  });

  test('Reconciliation Discrepancy 6: OTHER_TERM_VARIANCE detected for carrier mismatch', () => {
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'carrier-mismatch-doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'GEICO Casualty Company', // Mismatch from Progressive
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: mockCoverages
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    const carrierDiscrepancy = report.discrepancies.find(
      d => d.category === 'OTHER_TERM_VARIANCE' && d.fieldCode === 'CARRIER_NAME'
    );
    assert(!!carrierDiscrepancy, 'Carrier mismatch classified as OTHER_TERM_VARIANCE');
  });

  test('Ambiguous extraction yields REVIEW_REQUIRED and blocks automatic activation', () => {
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'blurry_scan.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      rawContent: 'blurry-content'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: mockCoverages,
      extractionConfidence: 0.65, // Low confidence
      isAmbiguous: true
    });

    const expected = deriveExpectedBoundTerms({
      offerVersion: mockOfferVersion,
      acceptedModifications: []
    });

    const report = reconcileIssuedPolicy({
      expectedTerms: expected,
      issuedSnapshot: snapshot,
      issuedDocument: doc,
      challengeId: 'CHAL-TEST-001',
      bindingHandoffId: mockBindingHandoff.id
    });

    assert(report.verdict === 'REVIEW_REQUIRED', 'Ambiguous extraction produces REVIEW_REQUIRED');
    assert(report.status === 'PENDING_CONSUMER_REVIEW', 'Status is PENDING_CONSUMER_REVIEW');
  });

  // ========================================================
  // 4. Consumer Review & Governance Tests
  // ========================================================
  test('Consumer review: Non-owner attempt is rejected', () => {
    const mockReport: ReconciliationReport = {
      id: 'REP-001',
      bindingHandoffId: mockBindingHandoff.id,
      challengeId: 'CHAL-TEST-001',
      issuedPolicyDocumentId: 'DOC-01',
      issuedPolicySnapshotId: 'SNP-01',
      verdict: 'UNAUTHORIZED_VARIANCE',
      status: 'PENDING_CONSUMER_REVIEW',
      discrepancies: [],
      totalAnnualPremiumVariance: 100,
      expectedTermsSummary: { annualPremium: 2400, carrier: 'Progressive', acceptedModificationCount: 0 },
      issuedTermsSummary: { policyNumber: 'POL-01', annualPremium: 2500, carrier: 'Progressive' },
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
    };

    let caught = false;
    try {
      processConsumerVarianceReview({
        report: mockReport,
        consumerId: 'usr_attacker_bob',
        challengeConsumerId: 'usr_consumer_alice',
        decision: 'ACCEPT_VARIANCE'
      });
    } catch (e: any) {
      caught = true;
      assert(e.message.includes('Unauthorized'), 'Rejects non-owner consumer review');
    }
    assert(caught, 'Should throw on unauthorized consumer');
  });

  test('Consumer review: Dispute transitions status to CONSUMER_DISPUTED and preserves notes', () => {
    const mockReport: ReconciliationReport = {
      id: 'REP-001',
      bindingHandoffId: mockBindingHandoff.id,
      challengeId: 'CHAL-TEST-001',
      issuedPolicyDocumentId: 'DOC-01',
      issuedPolicySnapshotId: 'SNP-01',
      verdict: 'UNAUTHORIZED_VARIANCE',
      status: 'PENDING_CONSUMER_REVIEW',
      discrepancies: [],
      totalAnnualPremiumVariance: 150,
      expectedTermsSummary: { annualPremium: 2400, carrier: 'Progressive', acceptedModificationCount: 0 },
      issuedTermsSummary: { policyNumber: 'POL-01', annualPremium: 2550, carrier: 'Progressive' },
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
    };

    const resolved = processConsumerVarianceReview({
      report: mockReport,
      consumerId: 'usr_consumer_alice',
      challengeConsumerId: 'usr_consumer_alice',
      decision: 'DISPUTE_REMEDIATION_REQUESTED',
      disputeNotes: 'Broker quoted $2,400 but issued at $2,550 without notification.'
    });

    assert(resolved.status === 'CONSUMER_DISPUTED', 'Status becomes CONSUMER_DISPUTED');
    assert(resolved.consumerDecision === 'DISPUTE_REMEDIATION_REQUESTED', 'Decision recorded');
    assert(Boolean(resolved.consumerDisputeNotes?.includes('$2,550')), 'Dispute notes preserved');
  });

  test('Consumer review: Acceptance transitions status to CONSUMER_ACCEPTED_VARIANCE', () => {
    const mockReport: ReconciliationReport = {
      id: 'REP-001',
      bindingHandoffId: mockBindingHandoff.id,
      challengeId: 'CHAL-TEST-001',
      issuedPolicyDocumentId: 'DOC-01',
      issuedPolicySnapshotId: 'SNP-01',
      verdict: 'UNAUTHORIZED_VARIANCE',
      status: 'PENDING_CONSUMER_REVIEW',
      discrepancies: [],
      totalAnnualPremiumVariance: 50,
      expectedTermsSummary: { annualPremium: 2400, carrier: 'Progressive', acceptedModificationCount: 0 },
      issuedTermsSummary: { policyNumber: 'POL-01', annualPremium: 2450, carrier: 'Progressive' },
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
    };

    const resolved = processConsumerVarianceReview({
      report: mockReport,
      consumerId: 'usr_consumer_alice',
      challengeConsumerId: 'usr_consumer_alice',
      decision: 'ACCEPT_VARIANCE'
    });

    assert(resolved.status === 'CONSUMER_ACCEPTED_VARIANCE', 'Status becomes CONSUMER_ACCEPTED_VARIANCE');
    assert(resolved.consumerDecision === 'ACCEPT_VARIANCE', 'Decision recorded');
    assert(!!resolved.consumerReviewedAt, 'Review timestamp recorded');
  });

  // ========================================================
  // 5. Vault Filing & Future Baseline Activation Tests
  // ========================================================
  test('Vault activation: Blocks unaccepted UNAUTHORIZED_VARIANCE or DISPUTED reports', () => {
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      rawContent: 'doc'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2550,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: mockCoverages
    });

    const disputedReport: ReconciliationReport = {
      id: 'REP-DISPUTED-01',
      bindingHandoffId: mockBindingHandoff.id,
      challengeId: 'CHAL-TEST-001',
      issuedPolicyDocumentId: doc.id,
      issuedPolicySnapshotId: snapshot.id,
      verdict: 'UNAUTHORIZED_VARIANCE',
      status: 'CONSUMER_DISPUTED',
      discrepancies: [],
      totalAnnualPremiumVariance: 150,
      expectedTermsSummary: { annualPremium: 2400, carrier: 'Progressive', acceptedModificationCount: 0 },
      issuedTermsSummary: { policyNumber: 'POL-01', annualPremium: 2550, carrier: 'Progressive' },
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
    };

    let caught = false;
    try {
      activateVerifiedPolicyToVault({
        handoff: mockBindingHandoff,
        selection: mockSelection,
        offerVersion: mockOfferVersion,
        acceptedModifications: [],
        report: disputedReport,
        snapshot,
        document: doc,
        currentBaseline: mockBaseline
      });
    } catch (e: any) {
      caught = true;
      assert(e.message.includes('Cannot activate policy to vault'), 'Blocks activation on disputed report');
    }
    assert(caught, 'Should throw on disputed report');
  });

  test('Vault activation: Verified MATCH creates PolicyVaultItem with provenance and activates new CoverageBaseline', () => {
    const doc = createIssuedPolicyDocument({
      bindingHandoff: mockBindingHandoff,
      challengeId: 'CHAL-TEST-001',
      providerOrgId: 'org_apex',
      fileName: 'dec.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      rawContent: 'match-doc-content'
    });

    const snapshot = createIssuedPolicySnapshot({
      issuedDocument: doc,
      bindingHandoffId: mockBindingHandoff.id,
      carrier: 'Progressive Northern Insurance',
      policyNumber: 'POL-PGR-778899',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      coverages: mockCoverages
    });

    const matchReport: ReconciliationReport = {
      id: 'REP-MATCH-01',
      bindingHandoffId: mockBindingHandoff.id,
      challengeId: 'CHAL-TEST-001',
      issuedPolicyDocumentId: doc.id,
      issuedPolicySnapshotId: snapshot.id,
      verdict: 'MATCH',
      status: 'COMPLETED_MATCH',
      discrepancies: [],
      totalAnnualPremiumVariance: 0,
      expectedTermsSummary: { annualPremium: 2400, carrier: 'Progressive Northern Insurance', acceptedModificationCount: 0 },
      issuedTermsSummary: { policyNumber: 'POL-PGR-778899', annualPremium: 2400, carrier: 'Progressive Northern Insurance' },
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'SYSTEM_DETERMINISTIC_ENGINE'
    };

    const { vaultItem, newBaseline } = activateVerifiedPolicyToVault({
      handoff: mockBindingHandoff,
      selection: mockSelection,
      offerVersion: mockOfferVersion,
      acceptedModifications: [],
      report: matchReport,
      snapshot,
      document: doc,
      currentBaseline: mockBaseline
    });

    // Verify PolicyVaultItem
    assert(!!vaultItem.id, 'Vault item ID generated');
    assert(vaultItem.consumerId === 'usr_consumer_alice', 'Consumer ID bound');
    assert(vaultItem.challengeId === 'CHAL-TEST-001', 'Lineage to challenge intact');
    assert(vaultItem.selectedOfferVersionId === mockOfferVersion.id, 'Lineage to OfferVersion intact');
    assert(vaultItem.issuedPolicyDocumentId === doc.id, 'Lineage to issued document intact');
    assert(vaultItem.reconciliationReportId === matchReport.id, 'Lineage to reconciliation report intact');
    assert(vaultItem.provenanceHash.length === 64, 'Computed 64-char SHA-256 provenance hash');
    assert(vaultItem.status === 'ACTIVE', 'Vault item status is ACTIVE');

    // Verify Future CoverageBaseline
    assert(!!newBaseline.id, 'New baseline ID generated');
    assert(newBaseline.version === 2, 'New baseline version incremented to 2');
    assert(newBaseline.carrier === 'Progressive Northern Insurance', 'Carrier updated to Progressive');
    assert(newBaseline.baselineAnnualPremium === 2400, 'Baseline premium updated to $2,400');
    assert(newBaseline.policyId === vaultItem.id, 'Points to active vault policy');
    assert(mockBaseline.version === 1, 'Prior historical baseline version preserved at 1');
    assert(mockBaseline.carrier === 'State Farm Mutual', 'Prior baseline carrier preserved');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, total: results.length, results };
}

// Direct CLI Execution
if (process.argv[1] && process.argv[1].endsWith('pm5Reconciliation.test.ts')) {
  const { passed, failed, total, results } = runPM5DomainTestSuite();
  console.log(`\n========================================`);
  console.log(`PM-5 Reconciliation Suite: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log(`========================================`);
  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}${r.error ? ` -> ${r.error}` : ''}`);
  });
}
