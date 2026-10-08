/**
 * Automated Domain Test Suite for Policy Challenge Comparison Engine
 * Validates deterministic rules:
 * - same limits, higher limits, lower limits
 * - same deductible, higher deductible, lower deductible
 * - removed coverage, added coverage
 * - Whole-offer classifications: BASELINE_MATCH, BASELINE_PLUS, COVERAGE_CHANGED
 */

import { compareCoverageItem, compareOfferAgainstBaseline } from './comparisonEngine';
import { CoverageItem, CoverageBaseline, LegacyConsumerRequirements, Offer } from '../types/insurance';

export interface TestCaseResult {
  name: string;
  category: string;
  passed: boolean;
  actual: string;
  expected: string;
  details?: string;
}

export function runComparisonEngineTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
} {
  const results: TestCaseResult[] = [];

  // Helper to record
  function test(name: string, category: string, assertion: boolean, actual: string, expected: string, details?: string) {
    results.push({
      name,
      category,
      passed: assertion,
      actual,
      expected,
      details
    });
  }

  // 1. DEDUCTIBLES (COLLISION)
  const baseColl: CoverageItem = {
    id: 'c1',
    code: 'COLLISION',
    name: 'Collision',
    category: 'PHYSICAL_DAMAGE',
    deductible: 500,
    isIncluded: true
  };

  // 1a. Same Deductible ($500 -> $500)
  const offerSameColl: CoverageItem = { ...baseColl, deductible: 500 };
  const rSameColl = compareCoverageItem(baseColl, offerSameColl);
  test(
    'Identical Collision Deductible ($500 -> $500) must be EQUIVALENT',
    'Deductibles',
    rSameColl.result === 'EQUIVALENT' && !rSameColl.isMaterialReduction,
    rSameColl.result,
    'EQUIVALENT'
  );

  // 1b. Higher Deductible ($500 -> $1000) -> WORSE (Consumer pays more out of pocket)
  const offerHigherColl: CoverageItem = { ...baseColl, deductible: 1000 };
  const rHigherColl = compareCoverageItem(baseColl, offerHigherColl);
  test(
    'Higher Collision Deductible ($500 -> $1000) must be WORSE and flag material reduction',
    'Deductibles',
    rHigherColl.result === 'WORSE' && rHigherColl.isMaterialReduction,
    rHigherColl.result,
    'WORSE'
  );

  // 1c. Lower Deductible ($500 -> $250) -> BETTER (Consumer pays less out of pocket)
  const offerLowerColl: CoverageItem = { ...baseColl, deductible: 250 };
  const rLowerColl = compareCoverageItem(baseColl, offerLowerColl);
  test(
    'Lower Collision Deductible ($500 -> $250) must be BETTER and flag material improvement',
    'Deductibles',
    rLowerColl.result === 'BETTER' && rLowerColl.isMaterialImprovement,
    rLowerColl.result,
    'BETTER'
  );

  // 2. LIABILITY LIMITS (BODILY INJURY)
  const baseBI: CoverageItem = {
    id: 'bi1',
    code: 'BODILY_INJURY',
    name: 'Bodily Injury',
    category: 'LIABILITY',
    perPersonLimit: 100000,
    perAccidentLimit: 300000,
    isIncluded: true
  };

  // 2a. Same limits (100k/300k)
  const offerSameBI: CoverageItem = { ...baseBI };
  const rSameBI = compareCoverageItem(baseBI, offerSameBI);
  test(
    'Same Bodily Injury Limits (100k/300k) must be EQUIVALENT',
    'Liability Limits',
    rSameBI.result === 'EQUIVALENT',
    rSameBI.result,
    'EQUIVALENT'
  );

  // 2b. Lower limits (100k/300k -> 25k/50k) -> WORSE
  const offerLowerBI: CoverageItem = { ...baseBI, perPersonLimit: 25000, perAccidentLimit: 50000 };
  const rLowerBI = compareCoverageItem(baseBI, offerLowerBI);
  test(
    'Reduced Bodily Injury Limits (100k/300k -> 25k/50k) must be WORSE',
    'Liability Limits',
    rLowerBI.result === 'WORSE' && rLowerBI.isMaterialReduction,
    rLowerBI.result,
    'WORSE'
  );

  // 2c. Higher limits (100k/300k -> 250k/500k) -> BETTER
  const offerHigherBI: CoverageItem = { ...baseBI, perPersonLimit: 250000, perAccidentLimit: 500000 };
  const rHigherBI = compareCoverageItem(baseBI, offerHigherBI);
  test(
    'Expanded Bodily Injury Limits (100k/300k -> 250k/500k) must be BETTER',
    'Liability Limits',
    rHigherBI.result === 'BETTER' && rHigherBI.isMaterialImprovement,
    rHigherBI.result,
    'BETTER'
  );

  // 3. PROPERTY DAMAGE
  const basePD: CoverageItem = {
    id: 'pd1',
    code: 'PROPERTY_DAMAGE',
    name: 'Property Damage',
    category: 'LIABILITY',
    propertyLimit: 100000,
    isIncluded: true
  };
  const offerHigherPD: CoverageItem = { ...basePD, propertyLimit: 250000 };
  const rHigherPD = compareCoverageItem(basePD, offerHigherPD);
  test(
    'Higher Property Damage ($100k -> $250k) must be BETTER',
    'Property Damage',
    rHigherPD.result === 'BETTER' && rHigherPD.isMaterialImprovement,
    rHigherPD.result,
    'BETTER'
  );

  // 4. COVERAGE REMOVAL & ADDITION
  const baseRental: CoverageItem = {
    id: 'r1',
    code: 'RENTAL_REIMBURSEMENT',
    name: 'Rental Reimbursement',
    category: 'ADDITIONAL',
    isIncluded: true
  };

  // 4a. Removed Coverage (Included in Baseline -> Excluded in Offer)
  const offerNoRental: CoverageItem = { ...baseRental, isIncluded: false };
  const rNoRental = compareCoverageItem(baseRental, offerNoRental);
  test(
    'Eliminating existing Rental Reimbursement must be WORSE and flag material reduction',
    'Coverage Stripping',
    rNoRental.result === 'WORSE' && rNoRental.isMaterialReduction,
    rNoRental.result,
    'WORSE'
  );

  // 4b. Added Coverage (Excluded in Baseline -> Included in Offer)
  const rAddedRental = compareCoverageItem(undefined, baseRental);
  test(
    'Adding brand new coverage must be BETTER',
    'Coverage Addition',
    rAddedRental.result === 'BETTER' && rAddedRental.isMaterialImprovement,
    rAddedRental.result,
    'BETTER'
  );

  // 5. WHOLE OFFER CLASSIFICATION
  const dummyBaseline: CoverageBaseline = {
    id: 'bl-test',
    policyId: 'p-test',
    version: 1,
    carrier: 'GEICO',
    effectiveDate: '2025-11-18',
    expirationDate: '2026-11-18',
    baselineAnnualPremium: 2964,
    baselineMonthlyPremium: 247,
    vehicle: {
      vin: '123456789',
      year: 2024,
      make: 'Toyota',
      model: 'Camry',
      usage: 'COMMUTE',
      annualMileage: 12000,
      garagingZip: '89014',
      ownership: 'FINANCED'
    },
    coverages: [baseBI, basePD, baseColl, baseRental],
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'Tester'
  };

  const dummyRequirements: LegacyConsumerRequirements = {
    id: 'req-1',
    ruleSummary: 'Beat my price without cutting protection',
    minAnnualSavings: 100,
    maxCollisionDeductible: 500,
    maxCompDeductible: 500,
    mustIncludeRental: true,
    mustIncludeRoadside: false
  };

  // 5a. Match Offer
  const matchOffer: Offer = {
    id: 'off-match',
    challengeId: 'c1',
    providerId: 'p1',
    providerName: 'Apex',
    providerLicense: '123',
    carrier: 'Progressive',
    quoteNumber: 'Q1',
    annualPremium: 2712,
    monthlyPremium: 226,
    termMonths: 12,
    effectiveDate: '2026-11-18',
    expirationDate: '2027-11-18',
    supportingQuoteDocName: 'doc.pdf',
    submittedAt: new Date().toISOString(),
    discrepanciesDetected: false,
    status: 'VALIDATED',
    coverages: [baseBI, basePD, baseColl, baseRental]
  };
  const compMatch = compareOfferAgainstBaseline(dummyBaseline, matchOffer);
  test(
    'Offer with identical coverage and lower premium must be BASELINE_MATCH',
    'Whole Offer Classification',
    compMatch.classification === 'BASELINE_MATCH' && compMatch.annualPremiumDifference === 252,
    compMatch.classification,
    'BASELINE_MATCH'
  );

  // 5b. Plus Offer (Property damage upgrade)
  const plusOffer: Offer = {
    ...matchOffer,
    id: 'off-plus',
    annualPremium: 2448,
    coverages: [baseBI, offerHigherPD, baseColl, baseRental]
  };
  const compPlus = compareOfferAgainstBaseline(dummyBaseline, plusOffer);
  test(
    'Offer with upgraded property damage ($250k) must be BASELINE_PLUS',
    'Whole Offer Classification',
    compPlus.classification === 'BASELINE_PLUS' && compPlus.materialImprovements.length > 0,
    compPlus.classification,
    'BASELINE_PLUS'
  );

  // 5c. Changed Offer (Deductible raised to $1,500 + Rental removed)
  const changedOffer: Offer = {
    ...matchOffer,
    id: 'off-changed',
    annualPremium: 2172,
    coverages: [baseBI, basePD, { ...baseColl, deductible: 1500 }, offerNoRental]
  };
  const compChanged = compareOfferAgainstBaseline(dummyBaseline, changedOffer);
  test(
    'Cheaper offer ($2,172 vs $2,964) with $1,500 deductible & stripped rental must be COVERAGE_CHANGED',
    'Whole Offer Classification',
    compChanged.classification === 'COVERAGE_CHANGED' && compChanged.materialReductions.length === 2,
    compChanged.classification,
    'COVERAGE_CHANGED',
    'Ensures cheap price never masks coverage reductions'
  );

  const passedCount = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results
  };
}
