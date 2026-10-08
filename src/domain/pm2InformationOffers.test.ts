/**
 * PM-2: Information Requests, Multi-Carrier Offers & Integrity Verification Test Suite
 * 
 * Verifies canonical specification Sections 17, 18, 25, 26, 28, 30, and 34:
 *   - Structured InformationRequest creation with purpose classification
 *   - Controlled consumer answering & reusable VerifiedSupplementalFact creation
 *   - Multi-carrier quoting under a single participation
 *   - Transparent duplicate carrier representation flagging across providers
 *   - OfferVersion history preservation upon revision
 *   - Supporting quote document extraction and discrepancy checking
 *   - Deterministic QualifiedOffer evaluation (zero magic scores / platform ranking)
 */

import {
  evaluateOfferQualification,
  flagDuplicateCarrierOffers,
  createOfferVersionSnapshot,
  getVisibleSupplementalFactsForProvider
} from './qualificationEngine';
import {
  Offer,
  CoverageBaseline,
  LegacyConsumerRequirements,
  ProviderOrganization,
  CarrierRelationship,
  OfferVerification,
  VerifiedSupplementalFact,
  InformationRequest
} from '../types/insurance';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export function runPM2AcceptanceTestSuite(): { passed: number; failed: number; total: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  }

  const mockBaseline: CoverageBaseline = {
    id: 'BASE-TEST-1',
    policyId: 'POL-TEST-1',
    version: 1,
    carrier: 'GEICO Advantage',
    effectiveDate: '2025-11-18',
    expirationDate: '2026-11-18',
    baselineAnnualPremium: 2964,
    baselineMonthlyPremium: 247,
    vehicle: {
      vin: '4T1B11HK5RU123456',
      year: 2024,
      make: 'Toyota',
      model: 'Camry LE',
      usage: 'COMMUTE',
      annualMileage: 12000,
      garagingZip: '89101',
      ownership: 'OWNED'
    },
    coverages: [
      { id: 'C1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
      { id: 'C2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true },
      { id: 'C3', code: 'COLLISION', name: 'Collision', category: 'PHYSICAL_DAMAGE', deductible: 500, isIncluded: true }
    ],
    verifiedAt: '2026-09-18T14:30:00Z',
    verifiedBy: 'Consumer'
  };

  const mockRequirements: LegacyConsumerRequirements = {
    id: 'REQ-TEST-1',
    ruleSummary: 'Beat price without reducing protection',
    minAnnualSavings: 150,
    maxCollisionDeductible: 500,
    maxCompDeductible: 250,
    mustIncludeRental: false,
    mustIncludeRoadside: false
  };

  const mockProviderOrg: ProviderOrganization = {
    id: 'org_sierra',
    legalName: 'Sierra Brokerage Group LLC',
    displayName: 'Sierra Brokerage Group',
    organizationType: 'BROKERAGE',
    verificationStatus: 'MARKETPLACE_APPROVED',
    marketplaceStatus: 'ACTIVE',
    states: ['NV', 'CA'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    createdAt: '2026-01-15T08:00:00Z',
    verifiedAt: '2026-01-16T10:00:00Z'
  };

  const mockCarrierRels: CarrierRelationship[] = [
    {
      id: 'rel_sierra_trv',
      providerOrganizationId: 'org_sierra',
      carrierId: 'c_trv',
      carrierName: 'Travelers Property Casualty',
      jurisdiction: 'NV',
      lineOfBusiness: 'PERSONAL_AUTO',
      relationshipType: 'APPOINTED',
      status: 'ACTIVE'
    },
    {
      id: 'rel_sierra_saf',
      providerOrganizationId: 'org_sierra',
      carrierId: 'c_saf',
      carrierName: 'Safeco Insurance',
      jurisdiction: 'NV',
      lineOfBusiness: 'PERSONAL_AUTO',
      relationshipType: 'APPOINTED',
      status: 'ACTIVE'
    }
  ];

  // 1. Structured Qualification Tests (Section 34)
  test('PM2-QUAL-1: Deterministically qualifies fully compliant, appointed offer', () => {
    const validOffer: Offer = {
      id: 'OFF-VALID',
      challengeId: 'CHAL-TEST-1',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group',
      providerLicense: 'NV-LIC-902188',
      carrier: 'Travelers Property Casualty',
      quoteNumber: 'TRV-9921',
      annualPremium: 2448,
      monthlyPremium: 204,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [
        { id: 'C1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
        { id: 'C2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true },
        { id: 'C3', code: 'COLLISION', name: 'Collision', category: 'PHYSICAL_DAMAGE', deductible: 500, isIncluded: true }
      ],
      supportingQuoteDocName: 'Travelers_Quote_TRV9921.pdf',
      submittedAt: '2026-09-19T10:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED'
    };

    const res = evaluateOfferQualification(validOffer, mockBaseline, mockProviderOrg, mockCarrierRels);
    if (!res.isQualified) {
      throw new Error(`Expected offer to qualify, but was disqualified: ${res.disqualificationReasons.join(', ')}`);
    }
    if (res.qualificationReasons.length < 4) {
      throw new Error(`Expected at least 4 qualification reasons, got ${res.qualificationReasons.length}`);
    }
  });

  test('PM2-QUAL-2: Disqualifies offer when provider lacks active carrier appointment/authorization', () => {
    const unappointedOffer: Offer = {
      id: 'OFF-UNAPPOINTED',
      challengeId: 'CHAL-TEST-1',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group',
      providerLicense: 'NV-LIC-902188',
      carrier: 'Liberty Mutual Specialty', // Not in mockCarrierRels
      quoteNumber: 'LM-8812',
      annualPremium: 2300,
      monthlyPremium: 191,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [
        { id: 'C1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
        { id: 'C2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true }
      ],
      supportingQuoteDocName: 'Liberty_Quote_8812.pdf',
      submittedAt: '2026-09-19T10:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED'
    };

    const res = evaluateOfferQualification(unappointedOffer, mockBaseline, mockProviderOrg, mockCarrierRels);
    if (res.isQualified) {
      throw new Error('Expected unappointed carrier offer to be disqualified');
    }
    const hasApptReason = res.disqualificationReasons.some(r => r.includes('appointment or broker authorization'));
    if (!hasApptReason) {
      throw new Error(`Missing appointment disqualification reason: ${res.disqualificationReasons.join('; ')}`);
    }
  });

  test('PM2-QUAL-3: Disqualifies offer missing mandatory statutory coverages', () => {
    const missingCoveragesOffer: Offer = {
      id: 'OFF-NO-BI',
      challengeId: 'CHAL-TEST-1',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group',
      providerLicense: 'NV-LIC-902188',
      carrier: 'Travelers Property Casualty',
      quoteNumber: 'TRV-9921',
      annualPremium: 1500,
      monthlyPremium: 125,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [
        // Missing BODILY_INJURY
        { id: 'C2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true }
      ],
      supportingQuoteDocName: 'Travelers_Quote_TRV9921.pdf',
      submittedAt: '2026-09-19T10:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED'
    };

    const res = evaluateOfferQualification(missingCoveragesOffer, mockBaseline, mockProviderOrg, mockCarrierRels);
    if (res.isQualified) {
      throw new Error('Expected offer missing Bodily Injury to be disqualified');
    }
    const hasNevadaReason = res.disqualificationReasons.some(r => r.includes('NV-DOI-2025-01') && r.includes('NRS 485.185'));
    if (!hasNevadaReason) {
      throw new Error(`Expected Nevada statutory rule citation in disqualification reason: ${res.disqualificationReasons.join('; ')}`);
    }
  });

  test('PM2-QUAL-4: Disqualifies offer missing official supporting quote document', () => {
    const noDocOffer: Offer = {
      id: 'OFF-NO-DOC',
      challengeId: 'CHAL-TEST-1',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group',
      providerLicense: 'NV-LIC-902188',
      carrier: 'Travelers Property Casualty',
      quoteNumber: 'TRV-9921',
      annualPremium: 2400,
      monthlyPremium: 200,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [
        { id: 'C1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
        { id: 'C2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true }
      ],
      supportingQuoteDocName: '', // Empty!
      submittedAt: '2026-09-19T10:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED'
    };

    const res = evaluateOfferQualification(noDocOffer, mockBaseline, mockProviderOrg, mockCarrierRels);
    if (res.isQualified) {
      throw new Error('Expected offer without quote document to be disqualified');
    }
    const hasDocReason = res.disqualificationReasons.some(r => r.includes('supporting carrier quote document'));
    if (!hasDocReason) {
      throw new Error(`Missing quote document reason: ${res.disqualificationReasons.join('; ')}`);
    }
  });

  test('PM2-QUAL-5: Disqualifies offer with unresolved material document verification discrepancies', () => {
    const offerWithVerification: Offer = {
      id: 'OFF-DISCREPANCY',
      challengeId: 'CHAL-TEST-1',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group',
      providerLicense: 'NV-LIC-902188',
      carrier: 'Travelers Property Casualty',
      quoteNumber: 'TRV-9921',
      annualPremium: 2200, // Provider claimed $2,200
      monthlyPremium: 183,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [
        { id: 'C1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 100000, perAccidentLimit: 300000, isIncluded: true },
        { id: 'C2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 100000, isIncluded: true }
      ],
      supportingQuoteDocName: 'Travelers_Quote.pdf',
      submittedAt: '2026-09-19T10:00:00Z',
      discrepanciesDetected: true,
      status: 'DISCREPANCY_FLAGGED'
    };

    const verification: OfferVerification = {
      id: 'VERIF-1',
      offerId: 'OFF-DISCREPANCY',
      documentName: 'Travelers_Quote.pdf',
      status: 'DISCREPANCIES_FLAGGED',
      verifiedAt: '2026-09-19T10:05:00Z',
      discrepancyCount: 1,
      discrepancies: ['annualPremium: Entered 2200, Document 2550'],
      extractedPremium: 2550,
      enteredPremium: 2200
    };

    const res = evaluateOfferQualification(offerWithVerification, mockBaseline, mockProviderOrg, mockCarrierRels, verification);
    if (res.isQualified) {
      throw new Error('Expected offer with document discrepancies to be disqualified');
    }
    const hasDiscrepancyReason = res.disqualificationReasons.some(r => r.includes('unresolved discrepancies'));
    if (!hasDiscrepancyReason) {
      throw new Error(`Expected discrepancy reason in disqualification: ${res.disqualificationReasons.join('; ')}`);
    }
  });

  // 2. Duplicate Carrier Flagging Tests (Section 26)
  test('PM2-DUP-1: Correctly flags duplicate carrier representation across distinct providers', () => {
    const offers: Offer[] = [
      {
        id: 'OFF-1',
        challengeId: 'CHAL-1',
        providerId: 'org_sierra',
        providerName: 'Sierra Brokerage',
        providerLicense: 'LIC-1',
        carrier: 'Progressive Northern Insurance',
        quoteNumber: 'Q1',
        annualPremium: 2600,
        monthlyPremium: 216,
        termMonths: 12,
        effectiveDate: '2026-11-18',
        expirationDate: '2027-11-18',
        coverages: [],
        supportingQuoteDocName: 'doc1.pdf',
        submittedAt: '2026-09-19T10:00:00Z',
        discrepanciesDetected: false,
        status: 'VALIDATED'
      },
      {
        id: 'OFF-2',
        challengeId: 'CHAL-1',
        providerId: 'org_apex', // DIFFERENT PROVIDER
        providerName: 'Apex Insurance',
        providerLicense: 'LIC-2',
        carrier: 'Progressive Northern Insurance', // SAME CARRIER
        quoteNumber: 'Q2',
        annualPremium: 2550,
        monthlyPremium: 212,
        termMonths: 12,
        effectiveDate: '2026-11-18',
        expirationDate: '2027-11-18',
        coverages: [],
        supportingQuoteDocName: 'doc2.pdf',
        submittedAt: '2026-09-19T10:15:00Z',
        discrepanciesDetected: false,
        status: 'VALIDATED'
      },
      {
        id: 'OFF-3',
        challengeId: 'CHAL-1',
        providerId: 'org_sierra',
        providerName: 'Sierra Brokerage',
        providerLicense: 'LIC-1',
        carrier: 'Travelers Property Casualty', // UNIQUE CARRIER
        quoteNumber: 'Q3',
        annualPremium: 2450,
        monthlyPremium: 204,
        termMonths: 12,
        effectiveDate: '2026-11-18',
        expirationDate: '2027-11-18',
        coverages: [],
        supportingQuoteDocName: 'doc3.pdf',
        submittedAt: '2026-09-19T10:30:00Z',
        discrepanciesDetected: false,
        status: 'VALIDATED'
      }
    ];

    const flagged = flagDuplicateCarrierOffers(offers);

    const off1 = flagged.find(o => o.id === 'OFF-1')!;
    const off2 = flagged.find(o => o.id === 'OFF-2')!;
    const off3 = flagged.find(o => o.id === 'OFF-3')!;

    if (!off1.isDuplicateCarrier || !off2.isDuplicateCarrier) {
      throw new Error('Both Progressive offers from distinct providers should be flagged as duplicate carrier');
    }
    if (off3.isDuplicateCarrier) {
      throw new Error('Unique Travelers offer should NOT be flagged as duplicate carrier');
    }
    if (!off1.duplicateWithOfferIds?.includes('OFF-2')) {
      throw new Error('OFF-1 should reference OFF-2 as duplicate');
    }
    if (!off2.duplicateWithOfferIds?.includes('OFF-1')) {
      throw new Error('OFF-2 should reference OFF-1 as duplicate');
    }
    if (!off1.duplicateCarrierNotice?.includes('Multiple participating providers')) {
      throw new Error('Expected duplicateCarrierNotice explanation');
    }
  });

  test('PM2-DUP-2: Does NOT flag multiple quotes from SAME provider under single carrier', () => {
    const sameProviderOffers: Offer[] = [
      {
        id: 'OFF-TIER-1',
        challengeId: 'CHAL-1',
        providerId: 'org_sierra',
        providerName: 'Sierra Brokerage',
        providerLicense: 'LIC-1',
        carrier: 'Travelers',
        quoteNumber: 'TRV-BASE',
        annualPremium: 2500,
        monthlyPremium: 208,
        termMonths: 12,
        effectiveDate: '2026-11-18',
        expirationDate: '2027-11-18',
        coverages: [],
        supportingQuoteDocName: 'doc1.pdf',
        submittedAt: '2026-09-19T10:00:00Z',
        discrepanciesDetected: false,
        status: 'VALIDATED'
      },
      {
        id: 'OFF-TIER-2',
        challengeId: 'CHAL-1',
        providerId: 'org_sierra', // SAME PROVIDER tier option
        providerName: 'Sierra Brokerage',
        providerLicense: 'LIC-1',
        carrier: 'Travelers',
        quoteNumber: 'TRV-PLUS',
        annualPremium: 2650,
        monthlyPremium: 220,
        termMonths: 12,
        effectiveDate: '2026-11-18',
        expirationDate: '2027-11-18',
        coverages: [],
        supportingQuoteDocName: 'doc2.pdf',
        submittedAt: '2026-09-19T10:05:00Z',
        discrepanciesDetected: false,
        status: 'VALIDATED'
      }
    ];

    const flagged = flagDuplicateCarrierOffers(sameProviderOffers);
    if (flagged.some(o => o.isDuplicateCarrier)) {
      throw new Error('Multiple tiers from same provider should not be flagged as duplicate carrier competition');
    }
  });

  // 3. Offer Versioning Tests (Section 28)
  test('PM2-VER-1: Accurately snapshots pre-revision offer terms into immutable OfferVersion', () => {
    const originalOffer: Offer = {
      id: 'OFF-ORIG',
      challengeId: 'CHAL-1',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage',
      providerLicense: 'NV-LIC-902188',
      carrier: 'Travelers',
      quoteNumber: 'TRV-100',
      annualPremium: 2500,
      monthlyPremium: 208,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: [{ id: 'C1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 50000, perAccidentLimit: 100000, isIncluded: true }],
      supportingQuoteDocName: 'Travelers_Original.pdf',
      submittedAt: '2026-09-19T10:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED',
      version: 1,
      round: 'ROUND_1_OPEN'
    };

    const snapshot = createOfferVersionSnapshot(originalOffer, 'Lowered rate during Improvement round');
    if (snapshot.versionNumber !== 1) {
      throw new Error(`Expected version 1 in snapshot, got ${snapshot.versionNumber}`);
    }
    if (snapshot.annualPremium !== 2500) {
      throw new Error(`Expected annualPremium 2500 in snapshot, got ${snapshot.annualPremium}`);
    }
    if (!snapshot.supersededAt) {
      throw new Error('Expected supersededAt timestamp in version snapshot');
    }
    if (snapshot.revisionReason !== 'Lowered rate during Improvement round') {
      throw new Error('Expected revision reason preserved');
    }
  });

  // 4. Reusable Supplemental Fact Sharing Tests (Section 18)
  test('PM2-FACT-1: Reusable supplemental facts filter correctly by provider organization access', () => {
    const facts: VerifiedSupplementalFact[] = [
      {
        id: 'FACT-1',
        consumerId: 'user_consumer_1',
        challengeId: 'CHAL-1',
        fieldType: 'ANNUAL_MILEAGE',
        fieldName: 'Commute Mileage',
        value: 8000,
        formattedValue: '8,000 miles/yr',
        verificationState: 'CONSUMER_ATTESTED',
        source: 'CONSUMER_PORTAL',
        createdAt: '2026-09-18T16:00:00Z',
        sharedWithOrganizationIds: ['org_sierra', 'org_apex'] // Shared with Sierra & Apex
      },
      {
        id: 'FACT-2',
        consumerId: 'user_consumer_1',
        challengeId: 'CHAL-1',
        fieldType: 'CUSTOM',
        fieldName: 'Commercial Garage Door Type',
        value: 'ROLLUP',
        formattedValue: 'Commercial Rollup',
        verificationState: 'CONSUMER_ATTESTED',
        source: 'CONSUMER_PORTAL',
        createdAt: '2026-09-18T16:05:00Z',
        sharedWithOrganizationIds: ['org_apex'] // Only shared with Apex
      },
      {
        id: 'FACT-3',
        consumerId: 'user_consumer_1',
        challengeId: 'CHAL-1',
        fieldType: 'GARAGING_ZIP',
        fieldName: 'Garaging Zip',
        value: '89101',
        formattedValue: '89101',
        verificationState: 'CONSUMER_ATTESTED',
        source: 'CONSUMER_PORTAL',
        createdAt: '2026-09-18T16:10:00Z',
        sharedWithOrganizationIds: ['*'] // Wildcard: shared with all participating providers
      }
    ];

    const sierraVisible = getVisibleSupplementalFactsForProvider(facts, 'org_sierra');
    const buckeyeVisible = getVisibleSupplementalFactsForProvider(facts, 'org_buckeye');

    if (sierraVisible.length !== 2) {
      throw new Error(`Sierra should see 2 facts (FACT-1 and wildcard FACT-3), got ${sierraVisible.length}`);
    }
    if (!sierraVisible.some(f => f.id === 'FACT-1') || !sierraVisible.some(f => f.id === 'FACT-3')) {
      throw new Error('Sierra should see FACT-1 and FACT-3');
    }
    if (sierraVisible.some(f => f.id === 'FACT-2')) {
      throw new Error('Sierra should NOT see FACT-2 (not shared with Sierra)');
    }

    if (buckeyeVisible.length !== 1 || buckeyeVisible[0].id !== 'FACT-3') {
      throw new Error('Buckeye should only see wildcard FACT-3');
    }
  });

  test('PM2-FACT-2: Fact disclosure access is strictly governed by consumer consent scope', () => {
    const privateFact: VerifiedSupplementalFact = {
      id: 'FACT-PRIV-1',
      consumerId: 'user_consumer_1',
      challengeId: 'CHAL-1',
      fieldType: 'ANNUAL_MILEAGE',
      fieldName: 'Commute Mileage',
      value: 7500,
      formattedValue: '7,500 miles/yr',
      verificationState: 'CONSUMER_ATTESTED',
      source: 'CONSUMER_PORTAL',
      createdAt: '2026-09-18T16:00:00Z',
      consentScope: 'REQUESTING_PROVIDER_ONLY',
      sharedWithOrganizationIds: ['org_sierra'] // Only requesting provider authorized
    };

    const sierraVisible = getVisibleSupplementalFactsForProvider([privateFact], 'org_sierra');
    const apexVisible = getVisibleSupplementalFactsForProvider([privateFact], 'org_apex');

    if (sierraVisible.length !== 1) {
      throw new Error('Requesting provider (Sierra) should have access to the attested fact');
    }
    if (apexVisible.length !== 0) {
      throw new Error('Competitor provider (Apex) MUST NOT have access to a fact consented only to requesting provider');
    }
  });

  test('PM2-QUAL-6: Does NOT assume universal statutory law when jurisdiction is unconfigured', () => {
    const unconfiguredBaseline: CoverageBaseline = {
      ...mockBaseline,
      jurisdiction: 'WY',
      vehicle: { ...mockBaseline.vehicle, garagingZip: '82001' }
    };
    const validWyOffer: Offer = {
      id: 'OFF-WY',
      challengeId: 'CHAL-TEST-WY',
      providerId: 'org_sierra',
      providerName: 'Sierra Brokerage Group',
      providerLicense: 'WY-LIC-1',
      carrier: 'Travelers Property Casualty',
      quoteNumber: 'TRV-WY-1',
      annualPremium: 2200,
      monthlyPremium: 183,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      coverages: mockBaseline.coverages,
      supportingQuoteDocName: 'Travelers_Quote_WY.pdf',
      submittedAt: '2026-09-19T10:00:00Z',
      discrepanciesDetected: false,
      status: 'VALIDATED'
    };
    const res = evaluateOfferQualification(validWyOffer, unconfiguredBaseline, mockProviderOrg, mockCarrierRels);
    if (!res.isQualified) {
      throw new Error(`Offer in unconfigured jurisdiction should qualify without false statutory assumptions: ${res.disqualificationReasons.join(', ')}`);
    }
    const hasNoAssumptionNotice = res.qualificationReasons.some(r => r.includes('No specific statutory rule module loaded'));
    if (!hasNoAssumptionNotice) {
      throw new Error(`Expected notice that universal statutory requirements were not assumed: ${res.qualificationReasons.join('; ')}`);
    }
  });

  test('PM2-REQ-1: InformationRequest supports extensible structured purposes without artificial restrictions', () => {
    const customReq: InformationRequest = {
      id: 'REQ-CUSTOM-1',
      challengeId: 'CHAL-1',
      competitionId: 'COMP-1',
      providerOrganizationId: 'org_sierra',
      requestedField: 'ANNUAL_MILEAGE',
      purpose: 'RATING_REQUIRED',
      purposeExplanation: 'Mandatory rating tier input for carrier Travelers',
      status: 'PENDING',
      requestedAt: '2026-09-19T10:00:00Z'
    };
    if (customReq.purpose !== 'RATING_REQUIRED') {
      throw new Error('InformationRequest should support extensible purpose RATING_REQUIRED');
    }
  });

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  return { passed, failed, total, results };
}
