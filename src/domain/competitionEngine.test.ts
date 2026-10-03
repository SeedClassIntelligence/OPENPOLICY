import { 
  evaluateCompetitionRoundState, 
  calculateProviderMarketSignals, 
  advanceCompetitionRound, 
  validateOfferRevision 
} from './competitionEngine';
import { 
  Competition, 
  Offer, 
  CoverageBaseline, 
  ConsumerRequirements, 
  CoverageItem 
} from '../types/insurance';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  actual: string;
  expected: string;
  details?: string;
}

export function runCompetitionEngineTestSuite(): { passed: number; failed: number; total: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function test(name: string, category: string, condition: boolean, actual: string, expected: string, details?: string) {
    results.push({
      name,
      category,
      passed: condition,
      actual,
      expected,
      details
    });
  }

  // --- Fixtures ---
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
    },
    {
      id: 'COV-6',
      code: 'ROADSIDE_ASSISTANCE',
      name: 'Roadside Assistance',
      category: 'ADDITIONAL',
      isIncluded: true
    }
  ];

  const baseline: CoverageBaseline = {
    id: 'base_1',
    policyId: 'pol_1',
    version: 1,
    carrier: 'Nevada Mutual Fire & Casualty',
    effectiveDate: '2026-05-18',
    expirationDate: '2027-05-18',
    baselineAnnualPremium: 2964,
    baselineMonthlyPremium: 247,
    vehicle: {
      vin: '4S4BSANC8N3281902',
      year: 2022,
      make: 'Subaru',
      model: 'Outback',
      annualMileage: 12000,
      garagingZip: '89101',
      usage: 'COMMUTE',
      ownership: 'OWNED'
    },
    coverages: standardCoverages,
    verifiedAt: '2026-09-20T10:00:00Z',
    verifiedBy: 'Consumer'
  };

  const requirements: ConsumerRequirements = {
    id: 'req_1',
    ruleSummary: 'Must meet or beat current coverage terms with at least $150 annual savings',
    minAnnualSavings: 150,
    maxCollisionDeductible: 500,
    maxCompDeductible: 250,
    mustIncludeRental: true,
    mustIncludeRoadside: true
  };

  const baseCompetition: Competition = {
    id: 'comp_1',
    challengeId: 'chal_1',
    status: 'OPEN',
    currentRound: 'ROUND_1_OPEN',
    openedAt: '2026-09-20T12:00:00Z',
    closesAt: '2026-09-22T12:00:00Z',
    participantCount: 2,
    improvementRoundEnabled: true,
    finalRoundEnabled: true
  };

  // Offer 1: Sierra Agency - Travelers (Annual: $2,624, Savings: $340)
  const offerTravelers: Offer = {
    id: 'off_travelers',
    challengeId: 'chal_1',
    providerId: 'org_sierra',
    providerName: 'Sierra Brokerage Group',
    providerLicense: 'NV-LIC-902188',
    carrier: 'Travelers Insurance',
    quoteNumber: 'TRV-NV-882190',
    annualPremium: 2624,
    monthlyPremium: 218,
    termMonths: 12,
    effectiveDate: '2026-05-18',
    expirationDate: '2027-05-18',
    coverages: standardCoverages,
    supportingQuoteDocName: 'travelers_quote_882190.pdf',
    submittedAt: '2026-09-20T14:30:00Z',
    discrepanciesDetected: false,
    status: 'VALIDATED',
    round: 'ROUND_1_OPEN',
    version: 1,
    tierLabel: 'Primary Baseline Match'
  };

  // Offer 2: Sierra Agency - Safeco (Annual: $2,490, Savings: $474, Multi-Carrier from same agency!)
  const offerSafeco: Offer = {
    id: 'off_safeco',
    challengeId: 'chal_1',
    providerId: 'org_sierra',
    providerName: 'Sierra Brokerage Group',
    providerLicense: 'NV-LIC-902188',
    carrier: 'Safeco Insurance (Liberty Mutual)',
    quoteNumber: 'SAF-NV-441092',
    annualPremium: 2490,
    monthlyPremium: 207,
    termMonths: 12,
    effectiveDate: '2026-05-18',
    expirationDate: '2027-05-18',
    coverages: standardCoverages,
    supportingQuoteDocName: 'safeco_quote_441092.pdf',
    submittedAt: '2026-09-20T15:15:00Z',
    discrepanciesDetected: false,
    status: 'VALIDATED',
    round: 'ROUND_1_OPEN',
    version: 1,
    tierLabel: 'Maximum Savings'
  };

  // Offer 3: Apex Insurance - Progressive (Annual: $2,780, Savings: $184)
  const offerProgressive: Offer = {
    id: 'off_progressive',
    challengeId: 'chal_1',
    providerId: 'org_apex',
    providerName: 'Apex Insurance Services',
    providerLicense: 'NV-LIC-841920',
    carrier: 'Progressive Northern',
    quoteNumber: 'PGR-NV-910244',
    annualPremium: 2780,
    monthlyPremium: 231,
    termMonths: 12,
    effectiveDate: '2026-05-18',
    expirationDate: '2027-05-18',
    coverages: standardCoverages,
    supportingQuoteDocName: 'progressive_910244.pdf',
    submittedAt: '2026-09-20T16:00:00Z',
    discrepanciesDetected: false,
    status: 'VALIDATED',
    round: 'ROUND_1_OPEN',
    version: 1
  };

  // Offer 4: Flawed Offer with Discrepancy (Flagged)
  const offerFlagged: Offer = {
    id: 'off_flagged',
    challengeId: 'chal_1',
    providerId: 'org_other',
    providerName: 'Other Brokerage',
    providerLicense: 'NV-LIC-111111',
    carrier: 'Acme General',
    quoteNumber: 'ACM-999',
    annualPremium: 2200,
    monthlyPremium: 183,
    termMonths: 12,
    effectiveDate: '2026-05-18',
    expirationDate: '2027-05-18',
    coverages: standardCoverages,
    supportingQuoteDocName: 'acme_999.pdf',
    submittedAt: '2026-09-20T16:30:00Z',
    discrepanciesDetected: true,
    discrepancyDetails: ['Collision deductible mismatch on declaration page'],
    status: 'DISCREPANCY_FLAGGED',
    round: 'ROUND_1_OPEN',
    version: 1
  };

  // --- Test 1: Deterministic Multi-Offer Factual Comparison (Zero Prohibited Ranking) ---
  const roundState = evaluateCompetitionRoundState(
    baseCompetition,
    [offerTravelers, offerSafeco, offerProgressive, offerFlagged],
    baseline,
    requirements
  );
  
  test(
    'Evaluates all submitted offers factually without platform-assigned scores or ranks',
    'Factual Comparison Architecture',
    roundState.offerComparisons.length === 4 &&
    roundState.validQualifiedOffersCount === 3 &&
    roundState.flaggedOffersCount === 1,
    `total=${roundState.offerComparisons.length}, qualified=${roundState.validQualifiedOffersCount}, flagged=${roundState.flaggedOffersCount}`,
    'total=4, qualified=3, flagged=1',
    'Platform computes factual savings and field comparisons without declaring a winner or rank'
  );

  // --- Test 2: Invariant: Discrepancy Flagged Offers Are Isolated Factually ---
  const flaggedComparison = roundState.offerComparisons.find(oc => oc.offer.id === 'off_flagged');
  test(
    'Isolates offers with unverified discrepancies factually without platform winner label',
    'Section 40 Parity Invariant',
    roundState.flaggedOffersCount === 1 &&
    flaggedComparison !== undefined &&
    flaggedComparison.offer.status === 'DISCREPANCY_FLAGGED',
    `flaggedCount=${roundState.flaggedOffersCount}, flaggedStatus=${flaggedComparison?.offer.status}`,
    'flaggedCount=1, flaggedStatus=DISCREPANCY_FLAGGED',
    'Acme General has lower premium ($2,200) but is flagged for discrepancies, so it is counted under flaggedOffersCount'
  );

  // --- Test 3: Multi-Carrier Quoting from Single Provider Agency ---
  const sierraComparisons = roundState.offerComparisons.filter(oc => oc.offer.providerId === 'org_sierra');
  test(
    'Supports multi-carrier quotes submitted by a single agency with independent factual comparisons',
    'Multi-Carrier Architecture',
    sierraComparisons.length === 2 && 
    sierraComparisons.some(o => o.offer.carrier.includes('Travelers')) && 
    sierraComparisons.some(o => o.offer.carrier.includes('Safeco')),
    sierraComparisons.map(o => o.offer.carrier).join(', '),
    'Travelers Insurance, Safeco Insurance (Liberty Mutual)',
    'Independent broker can submit multiple distinct carrier appointments for the same challenge'
  );

  // --- Test 4: Sealed Provider Market Signals (Zero Competitor Leakage) ---
  const apexSignals = calculateProviderMarketSignals(
    baseCompetition,
    'org_apex',
    [offerTravelers, offerSafeco, offerProgressive],
    baseline,
    requirements
  );

  const apexJson = JSON.stringify(apexSignals);
  const leaksSierra = apexJson.includes('Sierra') || apexJson.includes('Travelers') || apexJson.includes('Safeco');
  const leaksExactDollar = apexJson.includes('2490') || apexJson.includes('2624');
  const hasProhibitedRankWords = apexJson.includes('CURRENT_LEADER') || apexJson.includes('TOP_CONTENDER') || apexJson.includes('Rank #');

  test(
    'Ensures zero competitor identity or price leakage in provider market signals',
    'Anti-Collusion & Privacy Telemetry',
    !leaksSierra && !leaksExactDollar && !hasProhibitedRankWords && apexSignals.totalParticipatingProviders >= 2,
    `leaksCompetitor=${leaksSierra}, leaksPrice=${leaksExactDollar}, hasProhibitedRank=${hasProhibitedRankWords}`,
    'leaksCompetitor=false, leaksPrice=false, hasProhibitedRank=false',
    'Market signal gives Apex accurate sealed round telemetry without disclosing competitor carriers, quotes, or ranks'
  );

  // --- Test 5: Competition Round State & Advancement Readiness ---
  const stateRound1 = evaluateCompetitionRoundState(
    baseCompetition,
    [offerTravelers, offerSafeco, offerProgressive],
    baseline,
    requirements
  );

  test(
    'Calculates advancement readiness for Improvement Round when multiple quotes exist',
    'Lifecycle State Machine',
    stateRound1.advancementReadiness.canAdvanceToImprovement === true && stateRound1.validQualifiedOffersCount === 3,
    `canAdvance=${stateRound1.advancementReadiness.canAdvanceToImprovement}, validCount=${stateRound1.advancementReadiness.canAdvanceToImprovement}`,
    'canAdvance=true, validCount=true',
    'Round 1 has 3 valid quotes, ready to open Improvement Round'
  );

  // --- Test 6: Round Advancement Execution ---
  const advancedComp = advanceCompetitionRound(baseCompetition, 'ROUND_2_IMPROVEMENT', '3 qualified offers received');
  test(
    'Advances competition round to ROUND_2_IMPROVEMENT with auditable history',
    'Lifecycle State Machine',
    advancedComp.currentRound === 'ROUND_2_IMPROVEMENT' && 
    advancedComp.status === 'IMPROVEMENT' && 
    (advancedComp.roundHistory?.length || 0) >= 2,
    `currentRound=${advancedComp.currentRound}, status=${advancedComp.status}`,
    'currentRound=ROUND_2_IMPROVEMENT, status=IMPROVEMENT',
    'Records state transition, sets 24h deadline, and appends to roundHistory'
  );

  // --- Test 7: Offer Revision Validation (Section 7 Improvement Semantics) ---
  // Attempt to submit revision outside allowed rounds (should fail)
  const invalidRoundRevision = validateOfferRevision(
    offerProgressive,
    { annualPremium: 2850, carrier: 'Progressive Northern' },
    'ROUND_1_OPEN'
  );

  // Valid improvement round revision (supports multi-dimensional improvement or price sharpening)
  const validRevision = validateOfferRevision(
    offerProgressive,
    { annualPremium: 2450, carrier: 'Progressive Northern' },
    'ROUND_2_IMPROVEMENT'
  );

  test(
    'Enforces improvement round revision authorization per Section 7 semantics',
    'Revision Integrity Rules',
    invalidRoundRevision.valid === false && validRevision.valid === true,
    `invalidValid=${invalidRoundRevision.valid}, validValid=${validRevision.valid}`,
    'invalidValid=false, validValid=true',
    'Revisions are restricted to Improvement or BAFO rounds and validate required carrier proposition data'
  );

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    passed,
    failed,
    total: results.length,
    results
  };
}
