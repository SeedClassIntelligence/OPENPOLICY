import type { CoverageBaseline, Offer, OfferStandardResult, QualificationStandard } from '../types/insurance';
import { compareOfferAgainstBaseline } from './comparisonEngine';

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
  const comparison = compareOfferAgainstBaseline(baseline, offer);
  return {
    standardVersion: CURRENT_QUALIFICATION_STANDARD.version,
    coverageRelation: comparison.classification,
    annualPremiumDifference: comparison.annualPremiumDifference,
    differences: comparison.fieldComparisons
  };
}
