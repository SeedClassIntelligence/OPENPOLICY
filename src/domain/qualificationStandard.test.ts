import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_QUALIFICATION_STANDARD, evaluateOfferAgainstStandard } from './qualificationStandard';
import type { CoverageBaseline, CoverageItem, Offer } from '../types/insurance';

const liability: CoverageItem = {
  id: 'COV-BI', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY',
  isIncluded: true, perPersonLimit: 100_000, perAccidentLimit: 300_000
};
const rental: CoverageItem = {
  id: 'COV-RENTAL', code: 'RENTAL_REIMBURSEMENT', name: 'Rental Reimbursement', category: 'ADDITIONAL',
  isIncluded: true, notes: '$40/day, 30 days'
};
const baseline: CoverageBaseline = {
  id: 'BL-PR1', policyId: 'POL-PR1', version: 1, carrier: 'Existing Carrier',
  effectiveDate: '2026-01-01', expirationDate: '2027-01-01',
  baselineAnnualPremium: 1_200, baselineMonthlyPremium: 100, jurisdiction: 'NV',
  vehicle: { year: 2024, make: 'Test', model: 'Car', vin: 'TESTVIN', usage: 'PLEASURE', annualMileage: 10_000, garagingZip: '89101', ownership: 'OWNED' },
  coverages: [liability, rental], verifiedAt: '2026-01-01T00:00:00Z', verifiedBy: 'test'
};
function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'OFF-PR1', challengeId: 'CHAL-PR1', providerId: 'ORG-1', providerName: 'Provider',
    providerLicense: 'LIC-1', carrier: 'Carrier', quoteNumber: 'Q-1', annualPremium: 1_350,
    monthlyPremium: 112.5, termMonths: 12, effectiveDate: '2026-02-01', expirationDate: '2027-02-01',
    coverages: [liability, rental], supportingQuoteDocName: 'quote.pdf', submittedAt: '2026-01-02T00:00:00Z',
    discrepanciesDetected: false, status: 'VALIDATED', ...overrides
  };
}

test('QS-1 reports a higher-priced matching offer without an attractiveness gate', () => {
  const result = evaluateOfferAgainstStandard(baseline, offer());
  assert.equal(CURRENT_QUALIFICATION_STANDARD.version, 'QS-1');
  assert.equal(result.coverageRelation, 'BASELINE_MATCH');
  assert.equal(result.annualPremiumDifference, -150);
  assert.equal('meetsMinimumPriceDifference' in result, false);
  assert.equal('sameOrBetterCoverageAtLowerPrice' in result, false);
});

test('QS-1 reports exact coverage reductions without filtering the offer', () => {
  const result = evaluateOfferAgainstStandard(baseline, offer({
    annualPremium: 900,
    coverages: [{ ...liability, perPersonLimit: 50_000 }, { ...rental, isIncluded: false }]
  }));
  assert.equal(result.coverageRelation, 'COVERAGE_CHANGED');
  assert.equal(result.annualPremiumDifference, 300);
  assert.deepEqual(result.differences.filter(item => item.isMaterialReduction).map(item => item.fieldCode).sort(),
    ['BODILY_INJURY', 'RENTAL_REIMBURSEMENT']);
});

test('QS-1 output depends only on the baseline and evaluated offer', () => {
  const candidate = offer({ id: 'OFF-STABLE' });
  assert.deepEqual(evaluateOfferAgainstStandard(baseline, candidate), evaluateOfferAgainstStandard(baseline, candidate));
});
