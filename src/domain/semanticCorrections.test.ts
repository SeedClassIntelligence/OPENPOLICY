/**
 * Baseline Semantic Corrections — Jurisdiction Assumption Removal (D6)
 *
 * Proves three defects are absent:
 * 1. Eligibility must not substitute Nevada for a missing challenge jurisdiction.
 * 2. Vault activation must not manufacture jurisdiction or vehicle facts for the
 *    future CoverageBaseline when upstream provenance is missing.
 * 3. Qualification must not claim statutory limits were verified when it only
 *    checks that mandatory coverage categories are present.
 *
 * None of these corrections changes a qualification outcome; each changes what the
 * system asserts or fabricates.
 */

import { evaluateProviderEligibility } from './eligibilityEngine';
import { activateVerifiedPolicyToVault } from './pm5ReconciliationEngine';
import { evaluateOfferQualification } from './qualificationEngine';
import {
  BindingHandoff,
  Challenge,
  CoverageBaseline,
  IssuedPolicyDocument,
  IssuedPolicySnapshot,
  Offer,
  OfferVersion,
  ProviderAppetite,
  ProviderLicense,
  ProviderOrganization,
  ReconciliationReport,
  Selection
} from '../types/insurance';

export interface SemanticCorrectionTestResult {
  name: string;
  category: string;
  passed: boolean;
  details?: string;
}

const FABRICATED_VIN = '1HGCR2F83HA000000';

export function runSemanticCorrectionsTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: SemanticCorrectionTestResult[];
} {
  const results: SemanticCorrectionTestResult[] = [];

  function test(name: string, category: string, assertion: boolean, details?: string) {
    results.push({ name, category, passed: assertion, details });
  }

  // ------------------------------------------------------------------
  // Shared fixtures
  // ------------------------------------------------------------------
  const vehicle = {
    vin: '4T1B11HK5RU109281',
    year: 2024,
    make: 'Toyota',
    model: 'Camry',
    usage: 'COMMUTE' as const,
    annualMileage: 12000,
    garagingZip: '89014',
    ownership: 'FINANCED' as const
  };

  const coverages = [
    { id: 'C1', code: 'BODILY_INJURY' as const, name: 'Bodily Injury', category: 'LIABILITY' as const, perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
    { id: 'C2', code: 'PROPERTY_DAMAGE' as const, name: 'Property Damage', category: 'LIABILITY' as const, propertyLimit: 100000, isIncluded: true }
  ];

  const baselineWith = (jurisdiction?: string): CoverageBaseline => ({
    id: 'BL-D6',
    policyId: 'POL-D6',
    version: 1,
    carrier: 'Incumbent Mutual',
    effectiveDate: '2025-11-18',
    expirationDate: '2026-11-18',
    baselineAnnualPremium: 2964,
    baselineMonthlyPremium: 247,
    jurisdiction,
    vehicle,
    coverages
  } as CoverageBaseline);

  // ------------------------------------------------------------------
  // 1. Eligibility: no silent Nevada default
  // ------------------------------------------------------------------
  const org: ProviderOrganization = {
    id: 'org_d6',
    legalName: 'D6 Agency LLC',
    displayName: 'D6 Agency',
    organizationType: 'INDEPENDENT_AGENCY',
    verificationStatus: 'MARKETPLACE_APPROVED',
    marketplaceStatus: 'ACTIVE',
    states: ['NV'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    createdAt: '2026-01-01T00:00:00Z'
  };
  const nvLicense: ProviderLicense = {
    id: 'lic_d6',
    providerOrganizationId: 'org_d6',
    jurisdiction: 'NV',
    licenseType: 'PROPERTY_CASUALTY',
    licenseNumber: 'D6-1',
    status: 'ACTIVE',
    effectiveDate: '2025-01-01',
    expirationDate: '2099-01-01',
    verificationStatus: 'VERIFIED'
  };
  const nvAppetite: ProviderAppetite = {
    id: 'app_d6',
    providerOrganizationId: 'org_d6',
    jurisdictions: ['NV'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    riskMarkets: ['STANDARD'],
    renewalWindowDays: { min: 0, max: 100000 },
    active: true
  };
  const challengeWith = (jurisdiction: string | undefined): Challenge => ({
    id: 'CHAL-D6',
    referenceNumber: 'CHALLENGE #D6',
    consumerId: 'user_d6',
    coverageBaselineId: 'BL-D6',
    baseline: baselineWith(jurisdiction),
    qualificationStandardVersion: 'QS-1',
    legacyRequirements: {
      id: 'REQ-D6', ruleSummary: '', minAnnualSavings: 0, maxCollisionDeductible: 1000,
      maxCompDeductible: 1000, mustIncludeRental: false, mustIncludeRoadside: false
    },
    jurisdiction: jurisdiction as string,
    openingTimestamp: '2026-10-01T00:00:00Z',
    closingTimestamp: '2026-10-31T00:00:00Z',
    status: 'OPEN',
    disclosureLevel: 'MARKETPLACE_ANONYMOUS',
    offersCount: 0
  });

  const unknownEval = evaluateProviderEligibility(challengeWith(undefined), org, [nvLicense], nvAppetite);
  test(
    'D6-1a: Missing challenge jurisdiction makes the provider INELIGIBLE with JURISDICTION_UNKNOWN',
    'Eligibility',
    unknownEval.isEligible === false && unknownEval.reasons.some(r => r.startsWith('JURISDICTION_UNKNOWN')),
    unknownEval.reasons.join(' | ')
  );
  test(
    'D6-1b: Missing jurisdiction is not substituted with Nevada in any reason',
    'Eligibility',
    !unknownEval.reasons.some(r => /\bNV\b|Nevada/.test(r)),
    unknownEval.reasons.join(' | ')
  );
  const nvEval = evaluateProviderEligibility(challengeWith('NV'), org, [nvLicense], nvAppetite);
  test(
    'D6-1c (control): Explicit NV challenge with NV license and appetite remains ELIGIBLE',
    'Eligibility',
    nvEval.isEligible === true,
    nvEval.reasons.join(' | ')
  );

  // ------------------------------------------------------------------
  // 2. Vault activation: no manufactured jurisdiction or vehicle
  // ------------------------------------------------------------------
  const handoff = { id: 'HND-D6', bindingReference: 'BIND-D6', challengeId: 'CHAL-D6', carrier: 'Progressive', status: 'BOUND' } as BindingHandoff;
  const selection = { id: 'SEL-D6', consumerId: 'user_d6' } as Selection;
  const offerVersion = { id: 'VER-D6' } as OfferVersion;
  const doc = { id: 'DOC-D6', documentSha256: 'a'.repeat(64) } as IssuedPolicyDocument;
  const snapshot = {
    id: 'SNP-D6',
    carrier: 'Progressive',
    policyNumber: 'POL-PGR-D6',
    annualPremium: 2400,
    monthlyPremium: 200,
    effectiveDate: '2026-11-18',
    expirationDate: '2027-11-18',
    coverages,
    snapshotSha256: 'b'.repeat(64)
  } as IssuedPolicySnapshot;
  const matchReport = { id: 'REC-D6', verdict: 'MATCH', status: 'COMPLETED_MATCH' } as ReconciliationReport;
  const activate = (currentBaseline?: CoverageBaseline) =>
    activateVerifiedPolicyToVault({
      handoff, selection, offerVersion, acceptedModifications: [], report: matchReport,
      snapshot, document: doc, currentBaseline
    });

  const noPrior = activate(undefined);
  const noPriorJson = JSON.stringify(noPrior);
  test(
    'D6-2a: Without a prior baseline the vault item is still filed from the issued policy',
    'Vault',
    noPrior.vaultItem.status === 'ACTIVE' && noPrior.vaultItem.policyNumber === 'POL-PGR-D6'
  );
  test(
    'D6-2b: Without a prior baseline no future CoverageBaseline is fabricated',
    'Vault',
    noPrior.newBaseline === undefined && noPrior.vaultItem.futureCoverageBaselineId === undefined,
    `newBaseline=${JSON.stringify(noPrior.newBaseline)}`
  );
  test(
    'D6-2c: No invented vehicle (VIN, make or model) appears anywhere in the activation output',
    'Vault',
    !noPriorJson.includes(FABRICATED_VIN) && !noPriorJson.includes('Accord')
  );

  const priorNoJurisdiction = activate(baselineWith(undefined));
  test(
    'D6-2d: Prior baseline without jurisdiction yields a future baseline without jurisdiction (not NV)',
    'Vault',
    priorNoJurisdiction.newBaseline !== undefined && priorNoJurisdiction.newBaseline.jurisdiction === undefined,
    `jurisdiction=${priorNoJurisdiction.newBaseline?.jurisdiction}`
  );
  test(
    'D6-2e: Future baseline carries the prior baseline vehicle, not a substitute',
    'Vault',
    priorNoJurisdiction.newBaseline?.vehicle.vin === vehicle.vin
  );
  const priorCa = activate(baselineWith('CA'));
  test(
    'D6-2f (control): Prior CA baseline yields a CA future baseline at version 2',
    'Vault',
    priorCa.newBaseline?.jurisdiction === 'CA' && priorCa.newBaseline?.version === 2
  );

  // ------------------------------------------------------------------
  // 3. Qualification: no false "statutory minimums verified" claim
  // ------------------------------------------------------------------
  const lowLimitOffer: Offer = {
    id: 'OFF-D6',
    challengeId: 'CHAL-D6',
    providerId: 'org_d6',
    providerName: 'D6 Agency',
    providerLicense: 'D6-1',
    carrier: 'Test Carrier',
    quoteNumber: 'Q-D6',
    annualPremium: 1800,
    monthlyPremium: 150,
    termMonths: 12,
    effectiveDate: '2026-11-18',
    expirationDate: '2027-11-18',
    coverages: [
      // Deliberately below the limits recorded in the legacy NV registry entry.
      { id: 'L1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 10000, perAccidentLimit: 20000, isIncluded: true },
      { id: 'L2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 5000, isIncluded: true }
    ],
    supportingQuoteDocName: 'Quote_D6.pdf',
    submittedAt: '2026-10-01T00:00:00Z',
    discrepanciesDetected: false,
    status: 'VALIDATED'
  };
  const qual = evaluateOfferQualification(lowLimitOffer, baselineWith('NV'), org, []);
  const allReasons = [...qual.qualificationReasons, ...qual.disqualificationReasons];
  test(
    'D6-3a: Qualification never claims statutory minimums/limits were verified',
    'Qualification',
    !allReasons.some(r => /minimums verified|limits verified/i.test(r)),
    allReasons.join(' | ')
  );
  test(
    'D6-3b: Qualification states explicitly that statutory limit amounts were not evaluated',
    'Qualification',
    qual.qualificationReasons.some(r => r.includes('limit amounts were not evaluated')),
    qual.qualificationReasons.join(' | ')
  );
  test(
    'D6-3c: The versioned rule citation is still reported (NV-DOI-2025-01, NRS 485.185)',
    'Qualification',
    qual.qualificationReasons.some(r => r.includes('NV-DOI-2025-01') && r.includes('NRS 485.185'))
  );
  test(
    'D6-3d: Wording-only correction: qualification outcome is unchanged pending verified rules (PR-0C)',
    'Qualification',
    qual.isQualified === true && qual.applicableRuleVersion === 'NV-DOI-2025-01'
  );

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
  };
}
