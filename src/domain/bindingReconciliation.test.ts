import {
  validateConsumerBindingAuthorization,
  reconcileIssuedPolicyWithQuote,
  BindingHandoffDossier
} from './bindingReconciliationEngine';
import { Offer, CoverageBaseline, CoverageItem } from '../types/insurance';

export function runBindingAndReconciliationTests() {
  const tests: Array<{
    name: string;
    category: string;
    passed: boolean;
    actual: any;
    expected: any;
    details?: string;
  }> = [];

  const standardCoverages: CoverageItem[] = [
    {
      id: 'COV-1',
      code: 'BODILY_INJURY',
      name: 'Bodily Injury Liability',
      category: 'LIABILITY',
      perPersonLimit: 100000,
      perAccidentLimit: 300000,
      isIncluded: true
    },
    {
      id: 'COV-2',
      code: 'PROPERTY_DAMAGE',
      name: 'Property Damage Liability',
      category: 'LIABILITY',
      propertyLimit: 100000,
      isIncluded: true
    },
    {
      id: 'COV-3',
      code: 'COLLISION',
      name: 'Collision Coverage',
      category: 'PHYSICAL_DAMAGE',
      deductible: 500,
      isIncluded: true
    },
    {
      id: 'COV-4',
      code: 'COMPREHENSIVE',
      name: 'Comprehensive Coverage',
      category: 'PHYSICAL_DAMAGE',
      deductible: 250,
      isIncluded: true
    },
    {
      id: 'COV-5',
      code: 'RENTAL_REIMBURSEMENT',
      name: 'Rental Reimbursement',
      category: 'ADDITIONAL',
      isIncluded: true
    }
  ];

  const dummyBaseline: CoverageBaseline = {
    id: 'BASE-1',
    policyId: 'POL-1',
    version: 1,
    carrier: 'Current Carrier Co',
    baselineAnnualPremium: 2900,
    baselineMonthlyPremium: 242,
    effectiveDate: '2026-10-01',
    expirationDate: '2027-10-01',
    coverages: standardCoverages,
    vehicle: {
      vin: '4T1B11HK5RU123498',
      year: 2024,
      make: 'Toyota',
      model: 'Camry',
      usage: 'COMMUTE',
      annualMileage: 11000,
      garagingZip: '89012',
      ownership: 'FINANCED'
    },
    verifiedAt: '2026-09-01T10:00:00Z',
    verifiedBy: 'CONSUMER_ATTESTED'
  };

  const dummyOffer: Offer = {
    id: 'OFFER-101',
    challengeId: 'CHAL-1',
    providerId: 'PROV-1',
    providerName: 'Sierra Pacific Insurance Services',
    providerLicense: 'NV-LIC-992014',
    carrier: 'Travelers Property Casualty',
    quoteNumber: 'TRV-49281-Q',
    annualPremium: 2400,
    monthlyPremium: 200,
    termMonths: 12,
    effectiveDate: '2026-10-01',
    expirationDate: '2027-10-01',
    coverages: standardCoverages,
    supportingQuoteDocName: 'Travelers_Quote.pdf',
    submittedAt: '2026-09-20T10:00:00Z',
    discrepanciesDetected: false,
    status: 'VALIDATED'
  };

  const dummyDossier: BindingHandoffDossier = {
    id: 'DOSSIER-101',
    bindingReference: 'BIND-NV-882910',
    challengeId: 'CHAL-1',
    challengeReference: 'CHAL-NV-49281',
    status: 'DISCLOSED_TO_BROKER',
    createdAt: '2026-09-21T10:00:00Z',
    selectedOffer: {
      id: dummyOffer.id,
      carrier: dummyOffer.carrier,
      quoteNumber: dummyOffer.quoteNumber,
      annualPremium: dummyOffer.annualPremium,
      monthlyPremium: dummyOffer.monthlyPremium,
      termMonths: dummyOffer.termMonths,
      effectiveDate: dummyOffer.effectiveDate,
      expirationDate: dummyOffer.expirationDate,
      classification: 'BASELINE_MATCH',
      coverages: dummyOffer.coverages
    },
    winningBroker: {
      providerOrganizationId: 'org_sierra',
      providerName: 'Sierra Pacific Insurance Services',
      licenseNumber: 'NV-LIC-992014',
      jurisdiction: 'NV',
      designatedAgentName: 'Marcus Vance, CIC',
      agentEmail: 'marcus@sierrapacificins.com'
    },
    authorizedConsumer: {
      namedInsured: 'Jane Doe',
      contactEmail: 'jane.doe@example.com',
      contactPhone: '(702) 555-0192',
      garagingAddress: {
        addressLine1: '812 Horizon Ridge Pkwy',
        city: 'Henderson',
        state: 'NV',
        postalCode: '89012'
      },
      drivers: [{
        name: 'Jane Doe',
        licenseState: 'NV',
        licenseNumber: 'NV-DL-8912781',
        age: 38,
        isPrimary: true
      }],
      vehicles: [{
        year: 2024,
        make: 'Toyota',
        model: 'Camry LE',
        vin: '4T1B11HK5RU123498',
        annualMileage: 11000,
        primaryUse: 'Commute'
      }]
    },
    complianceAcknowledgments: {
      section40ParityAcknowledged: true,
      acknowledgedAt: '2026-09-21T09:59:00Z',
      ipAddressHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      termsVersion: 'v2026.3',
      discrepanciesExplicitlyApproved: [],
      priceImprovementAnnual: 500
    },
    dossierHash: 'sha256:dossier_canon_hash_123',
    sourceBaselinePolicyId: 'POL-1'
  };

  // Test 1: Binding requires consumer consent
  const test1Auth = validateConsumerBindingAuthorization({
    selectedOffer: dummyOffer,
    baseline: dummyBaseline,
    materialReductions: [],
    consumerConsentGiven: false,
    consumerAcknowledgedReductions: []
  });
  tests.push({
    name: 'Rejects binding transmission if consumer consent is not provided',
    category: 'Binding Handoff Authorization',
    passed: !test1Auth.isValid,
    actual: test1Auth.isValid,
    expected: false,
    details: test1Auth.error
  });

  // Test 2: Section 40 Informed Consent on Coverage Reduction
  const test2Auth = validateConsumerBindingAuthorization({
    selectedOffer: dummyOffer,
    baseline: dummyBaseline,
    materialReductions: ['COLLISION_DEDUCTIBLE_HIGHER', 'RENTAL_REIMBURSEMENT_ELIMINATED'],
    consumerConsentGiven: true,
    consumerAcknowledgedReductions: ['COLLISION_DEDUCTIBLE_HIGHER'] // Missing rental acknowledgment!
  });
  tests.push({
    name: 'Blocks handoff when consumer has not explicitly acknowledged all coverage reductions',
    category: 'Section 40 Informed Consent',
    passed: !test2Auth.isValid,
    actual: test2Auth.isValid,
    expected: false,
    details: test2Auth.error
  });

  // Test 3: Approved when all reductions explicitly acknowledged
  const test3Auth = validateConsumerBindingAuthorization({
    selectedOffer: dummyOffer,
    baseline: dummyBaseline,
    materialReductions: ['COLLISION_DEDUCTIBLE_HIGHER', 'RENTAL_REIMBURSEMENT_ELIMINATED'],
    consumerConsentGiven: true,
    consumerAcknowledgedReductions: ['COLLISION_DEDUCTIBLE_HIGHER', 'RENTAL_REIMBURSEMENT_ELIMINATED']
  });
  tests.push({
    name: 'Authorizes handoff when consumer gives informed consent on all variations',
    category: 'Section 40 Informed Consent',
    passed: test3Auth.isValid,
    actual: test3Auth.isValid,
    expected: true,
    details: 'All required informed consent disclosures satisfied.'
  });

  // Test 4: Reconciles identical issued policy with 100% fidelity
  const test4Rec = reconcileIssuedPolicyWithQuote({
    dossier: dummyDossier,
    issuedData: {
      policyNumber: 'TRV-ISSUE-10928',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      coverages: standardCoverages
    }
  });
  tests.push({
    name: 'Approves canonical issued policy matching agreed quote with 100% fidelity',
    category: 'Post-Bind Reconciliation',
    passed: test4Rec.isCompliant && test4Rec.reconciliationAuditVerdict === 'APPROVED_CANONICAL',
    actual: `${test4Rec.isCompliant}, ${test4Rec.reconciliationAuditVerdict}`,
    expected: 'true, APPROVED_CANONICAL',
    details: test4Rec.summary
  });

  // Test 5: Detects stealth premium creep
  const test5Rec = reconcileIssuedPolicyWithQuote({
    dossier: dummyDossier,
    issuedData: {
      policyNumber: 'TRV-ISSUE-10928',
      annualPremium: 2580, // $180 stealth markup!
      effectiveDate: '2026-10-01',
      coverages: standardCoverages
    }
  });
  tests.push({
    name: 'Detects stealth price creep on issued policy over agreed quote',
    category: 'Post-Bind Discrepancy Detection',
    passed: test5Rec.stealthCreepDetected && test5Rec.totalAnnualCreepAmount === 180,
    actual: `creepDetected=${test5Rec.stealthCreepDetected}, amount=${test5Rec.totalAnnualCreepAmount}`,
    expected: 'creepDetected=true, amount=180',
    details: test5Rec.discrepancies[0]?.explanation
  });

  // Test 6: Detects stealth deductible alteration & dropped endorsement
  const alteredCoverages: CoverageItem[] = [
    {
      id: 'COV-1',
      code: 'BODILY_INJURY',
      name: 'Bodily Injury Liability',
      category: 'LIABILITY',
      perPersonLimit: 100000,
      perAccidentLimit: 300000,
      isIncluded: true
    },
    {
      id: 'COV-2',
      code: 'PROPERTY_DAMAGE',
      name: 'Property Damage Liability',
      category: 'LIABILITY',
      propertyLimit: 100000,
      isIncluded: true
    },
    {
      id: 'COV-3',
      code: 'COLLISION',
      name: 'Collision Coverage',
      category: 'PHYSICAL_DAMAGE',
      deductible: 1000, // Silently doubled from $500!
      isIncluded: true
    },
    {
      id: 'COV-4',
      code: 'COMPREHENSIVE',
      name: 'Comprehensive Coverage',
      category: 'PHYSICAL_DAMAGE',
      deductible: 250,
      isIncluded: true
    },
    {
      id: 'COV-5',
      code: 'RENTAL_REIMBURSEMENT',
      name: 'Rental Reimbursement',
      category: 'ADDITIONAL',
      isIncluded: false // Endorsement dropped!
    }
  ];

  const test6Rec = reconcileIssuedPolicyWithQuote({
    dossier: dummyDossier,
    issuedData: {
      policyNumber: 'TRV-ISSUE-10928',
      annualPremium: 2400,
      effectiveDate: '2026-10-01',
      coverages: alteredCoverages
    }
  });
  tests.push({
    name: 'Catches silent deductible increase and dropped endorsements as REJECTED_BREACH',
    category: 'Post-Bind Discrepancy Detection',
    passed: !test6Rec.isCompliant && test6Rec.reconciliationAuditVerdict === 'REJECTED_BREACH' && test6Rec.discrepancies.length === 2,
    actual: `discrepancies=${test6Rec.discrepancies.length}, verdict=${test6Rec.reconciliationAuditVerdict}`,
    expected: 'discrepancies=2, verdict=REJECTED_BREACH',
    details: test6Rec.discrepancies.map(d => d.fieldName).join(', ')
  });

  return tests;
}
