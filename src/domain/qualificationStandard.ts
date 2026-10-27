import type { CoverageBaseline, Offer, OfferStandardResult, QualificationStandard } from '../types/insurance';
import { compareOfferAgainstBaseline } from './comparisonEngine';
import { comparePolicyLineFacts } from './policyLineFactualComparison';

export const CURRENT_QUALIFICATION_STANDARD: QualificationStandard = Object.freeze({
  version: 'QS-1'
});

/**
 * Produces factual comparison evidence only. It does not rank, recommend, score,
 * or decide whether a price or coverage change is attractive to the consumer.
 */
export function evaluateOfferAgainstStandard(
  baseline: CoverageBaseline,
  offer: Offer
): OfferStandardResult {
  const insuranceLine = offer.insuranceLine || baseline.insuranceLine || 'PERSONAL_AUTO';
  if (insuranceLine !== 'PERSONAL_AUTO') {
    if ((baseline.insuranceLine || insuranceLine) !== insuranceLine) {
      throw new Error('Offer insurance line does not match the baseline insurance line.');
    }
    const comparison = comparePolicyLineFacts({
      insuranceLine,
      baseline: baseline.verifiedFacts || {},
      offer: offer.verifiedFacts || {}
    });
    return {
      standardVersion: CURRENT_QUALIFICATION_STANDARD.version,
      coverageRelation: comparison.differenceCount === 0 ? 'BASELINE_MATCH' : 'COVERAGE_CHANGED',
      annualPremiumDifference: baseline.baselineAnnualPremium - offer.annualPremium,
      differences: comparison.fields.map(field => ({
        fieldCode: field.fieldPath,
        fieldName: field.label,
        category: 'COVERAGE',
        baselineValueFormatted: field.baselineValueFormatted,
        offerValueFormatted: field.offerValueFormatted,
        result: field.relation === 'MATCH' ? 'EQUIVALENT'
          : field.relation === 'NOT_STATED' ? 'UNKNOWN' : 'DIFFERENT',
        explanation: `${field.label}: baseline ${field.baselineValueFormatted}; offer ${field.offerValueFormatted}.`,
        isMaterialReduction: false,
        isMaterialImprovement: false
      }))
    };
  }
  const comparison = compareOfferAgainstBaseline(baseline, offer);
  return {
    standardVersion: CURRENT_QUALIFICATION_STANDARD.version,
    coverageRelation: comparison.classification,
    annualPremiumDifference: comparison.annualPremiumDifference,
    differences: comparison.fieldComparisons
  };
}
