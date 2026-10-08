/**
 * Isolated Pure Deterministic Coverage Comparison Engine
 * Strict adherence to domain comparison rules:
 * - BETTER, EQUIVALENT, WORSE, DIFFERENT, UNKNOWN
 * - BASELINE MATCH, BASELINE PLUS, COVERAGE CHANGED, REVIEW REQUIRED
 * - Strict separation of price savings and coverage reductions
 */

import {
  CoverageBaseline,
  CoverageItem,
  FieldComparison,
  FieldComparisonResult,
  Offer,
  OfferComparison,
  WholeOfferClassification
} from '../types/insurance';

function formatCurrency(val?: number): string {
  if (val === undefined || val === null) return 'N/A';
  return `$${val.toLocaleString()}`;
}

function formatLimits(perPerson?: number, perAccident?: number, prop?: number): string {
  if (perPerson && perAccident) {
    const p1 = perPerson >= 1000 ? `${perPerson / 1000}k` : `${perPerson}`;
    const p2 = perAccident >= 1000 ? `${perAccident / 1000}k` : `${perAccident}`;
    if (prop) {
      const p3 = prop >= 1000 ? `${prop / 1000}k` : `${prop}`;
      return `$${p1}/$${p2}/$${p3}`;
    }
    return `$${p1}/$${p2}`;
  }
  if (prop) return formatCurrency(prop);
  return 'N/A';
}

/**
 * Compare two coverage items deterministically
 */
export function compareCoverageItem(
  baselineItem?: CoverageItem,
  offerItem?: CoverageItem
): FieldComparison {
  const code = baselineItem?.code || offerItem?.code || 'UNKNOWN';
  const name = baselineItem?.name || offerItem?.name || 'Coverage';
  const category = baselineItem?.category || offerItem?.category || 'ADDITIONAL';

  // If both missing
  if (!baselineItem && !offerItem) {
    return {
      fieldCode: code,
      fieldName: name,
      category,
      baselineValueFormatted: 'Not Included',
      offerValueFormatted: 'Not Included',
      result: 'EQUIVALENT',
      explanation: 'Neither policy includes this coverage.',
      isMaterialReduction: false,
      isMaterialImprovement: false
    };
  }

  // If in baseline but completely removed in offer
  if (baselineItem?.isIncluded && (!offerItem || !offerItem.isIncluded)) {
    return {
      fieldCode: code,
      fieldName: name,
      category,
      baselineValueFormatted: baselineItem.deductible !== undefined ? `Included ($${baselineItem.deductible} ded)` : 'Included',
      offerValueFormatted: 'Removed / Not Covered',
      result: 'WORSE',
      explanation: `Coverage completely eliminated in competing offer.`,
      isMaterialReduction: true,
      isMaterialImprovement: false
    };
  }

  // If NOT in baseline, but ADDED in offer
  if ((!baselineItem || !baselineItem.isIncluded) && offerItem?.isIncluded) {
    return {
      fieldCode: code,
      fieldName: name,
      category,
      baselineValueFormatted: 'Not Included',
      offerValueFormatted: offerItem.deductible !== undefined ? `Included ($${offerItem.deductible} ded)` : 'Included',
      result: 'BETTER',
      explanation: `New additional protection added that consumer did not previously possess.`,
      isMaterialReduction: false,
      isMaterialImprovement: true
    };
  }

  // Both are included - compare specific terms
  const b = baselineItem!;
  const o = offerItem!;

  // 1. Physical damage deductibles (Collision, Comprehensive)
  // Higher deductible means MORE out-of-pocket cost for consumer -> WORSE protection.
  // Lower deductible means LESS out-of-pocket cost -> BETTER protection.
  if (code === 'COLLISION' || code === 'COMPREHENSIVE') {
    const bDed = b.deductible ?? 500;
    const oDed = o.deductible ?? 500;

    const bStr = `$${bDed} Deductible`;
    const oStr = `$${oDed} Deductible`;

    if (oDed > bDed) {
      return {
        fieldCode: code,
        fieldName: name,
        category,
        baselineValueFormatted: bStr,
        offerValueFormatted: oStr,
        result: 'WORSE',
        explanation: `Deductible increased by $${oDed - bDed}. You must pay more out-of-pocket before insurance responds.`,
        isMaterialReduction: true,
        isMaterialImprovement: false
      };
    }
    if (oDed < bDed) {
      return {
        fieldCode: code,
        fieldName: name,
        category,
        baselineValueFormatted: bStr,
        offerValueFormatted: oStr,
        result: 'BETTER',
        explanation: `Deductible reduced by $${bDed - oDed}. You pay less out-of-pocket in an accident claim.`,
        isMaterialReduction: false,
        isMaterialImprovement: true
      };
    }
    return {
      fieldCode: code,
      fieldName: name,
      category,
      baselineValueFormatted: bStr,
      offerValueFormatted: oStr,
      result: 'EQUIVALENT',
      explanation: `Identical deductible of $${bDed}.`,
      isMaterialReduction: false,
      isMaterialImprovement: false
    };
  }

  // 2. Liability Limits (Bodily Injury, UM/UIM)
  if (code === 'BODILY_INJURY' || code === 'UM_UIM') {
    const bPerson = b.perPersonLimit || 0;
    const bAccident = b.perAccidentLimit || 0;
    const oPerson = o.perPersonLimit || 0;
    const oAccident = o.perAccidentLimit || 0;

    const bStr = formatLimits(bPerson, bAccident);
    const oStr = formatLimits(oPerson, oAccident);

    if (oPerson < bPerson || oAccident < bAccident) {
      return {
        fieldCode: code,
        fieldName: name,
        category,
        baselineValueFormatted: bStr,
        offerValueFormatted: oStr,
        result: 'WORSE',
        explanation: `Liability limits decreased. Leaves you exposed to higher legal claims.`,
        isMaterialReduction: true,
        isMaterialImprovement: false
      };
    }
    if (oPerson > bPerson || oAccident > bAccident) {
      return {
        fieldCode: code,
        fieldName: name,
        category,
        baselineValueFormatted: bStr,
        offerValueFormatted: oStr,
        result: 'BETTER',
        explanation: `Higher limits expand your legal liability cushion against lawsuits.`,
        isMaterialReduction: false,
        isMaterialImprovement: true
      };
    }
    return {
      fieldCode: code,
      fieldName: name,
      category,
      baselineValueFormatted: bStr,
      offerValueFormatted: oStr,
      result: 'EQUIVALENT',
      explanation: `Matching liability limit of ${bStr}.`,
      isMaterialReduction: false,
      isMaterialImprovement: false
    };
  }

  // 3. Property Damage
  if (code === 'PROPERTY_DAMAGE') {
    const bProp = b.propertyLimit || 0;
    const oProp = o.propertyLimit || 0;

    const bStr = formatCurrency(bProp);
    const oStr = formatCurrency(oProp);

    if (oProp < bProp) {
      return {
        fieldCode: code,
        fieldName: name,
        category,
        baselineValueFormatted: bStr,
        offerValueFormatted: oStr,
        result: 'WORSE',
        explanation: `Property damage limit decreased by $${(bProp - oProp).toLocaleString()}.`,
        isMaterialReduction: true,
        isMaterialImprovement: false
      };
    }
    if (oProp > bProp) {
      return {
        fieldCode: code,
        fieldName: name,
        category,
        baselineValueFormatted: bStr,
        offerValueFormatted: oStr,
        result: 'BETTER',
        explanation: `Property damage limit increased by $${(oProp - bProp).toLocaleString()}.`,
        isMaterialReduction: false,
        isMaterialImprovement: true
      };
    }
    return {
      fieldCode: code,
      fieldName: name,
      category,
      baselineValueFormatted: bStr,
      offerValueFormatted: oStr,
      result: 'EQUIVALENT',
      explanation: `Matching property damage limit of ${bStr}.`,
      isMaterialReduction: false,
      isMaterialImprovement: false
    };
  }

  // 4. Default for add-ons (Rental, Roadside, MedPay)
  const bStatus = b.isIncluded ? 'Included' : 'Excluded';
  const oStatus = o.isIncluded ? 'Included' : 'Excluded';

  if (b.isIncluded === o.isIncluded) {
    return {
      fieldCode: code,
      fieldName: name,
      category,
      baselineValueFormatted: bStatus,
      offerValueFormatted: oStatus,
      result: 'EQUIVALENT',
      explanation: `Both policies maintain this coverage in the same status.`,
      isMaterialReduction: false,
      isMaterialImprovement: false
    };
  }

  return {
    fieldCode: code,
    fieldName: name,
    category,
    baselineValueFormatted: bStatus,
    offerValueFormatted: oStatus,
    result: 'DIFFERENT',
    explanation: `Terms differ between policies.`,
    isMaterialReduction: false,
    isMaterialImprovement: false
  };
}

export function formatClassification(c: WholeOfferClassification): string {
  switch (c) {
    case 'BASELINE_MATCH': return 'BASELINE MATCH';
    case 'BASELINE_PLUS': return 'BASELINE PLUS';
    case 'COVERAGE_CHANGED': return 'COVERAGE CHANGED';
    case 'REVIEW_REQUIRED': return 'REVIEW REQUIRED';
  }
}

/**
 * Compare entire offer against verified CoverageBaseline
 */
export function compareOfferAgainstBaseline(
  baseline: CoverageBaseline,
  offer: Offer
): OfferComparison {
  const currentAnnual = baseline.baselineAnnualPremium;
  const offerAnnual = offer.annualPremium;
  const annualPremiumDifference = currentAnnual - offerAnnual;
  const monthlyPremiumDifference = Math.round(annualPremiumDifference / 12);

  // Compare every coverage in baseline
  const fieldComparisons: FieldComparison[] = [];
  const processedCodes = new Set<string>();
  const baselineCoverages = baseline.coverages || [];
  const offerCoverages = offer.coverages || [];

  for (const bItem of baselineCoverages) {
    processedCodes.add(bItem.code);
    const oItem = offerCoverages.find(c => c.code === bItem.code);
    const comp = compareCoverageItem(bItem, oItem);
    fieldComparisons.push(comp);
  }

  // Check any additional coverages in offer not in baseline
  for (const oItem of offerCoverages) {
    if (!processedCodes.has(oItem.code)) {
      const comp = compareCoverageItem(undefined, oItem);
      fieldComparisons.push(comp);
    }
  }

  const materialReductions = fieldComparisons.filter(f => f.isMaterialReduction);
  const materialImprovements = fieldComparisons.filter(f => f.isMaterialImprovement);

  const matchingCount = fieldComparisons.filter(f => f.result === 'EQUIVALENT').length;
  const betterCount = fieldComparisons.filter(f => f.result === 'BETTER').length;
  const worseCount = fieldComparisons.filter(f => f.result === 'WORSE').length;
  const differentCount = fieldComparisons.filter(f => f.result === 'DIFFERENT').length;
  const unknownCount = fieldComparisons.filter(f => f.result === 'UNKNOWN').length;

  // Determine Whole-Offer Classification
  let classification: WholeOfferClassification;
  let summaryHeadline = '';

  if (offer.status === 'DISCREPANCY_FLAGGED' || unknownCount > 2) {
    classification = 'REVIEW_REQUIRED';
    summaryHeadline = 'Unverified details or quote document discrepancies require human review.';
  } else if (materialReductions.length > 0) {
    classification = 'COVERAGE_CHANGED';
    summaryHeadline = `${materialReductions.length} protection element${materialReductions.length > 1 ? 's were' : ' was'} reduced or eliminated.`;
  } else if (materialImprovements.length > 0) {
    classification = 'BASELINE_PLUS';
    summaryHeadline = `Equal or superior coverage on all terms, plus ${materialImprovements.length} material upgrade${materialImprovements.length > 1 ? 's' : ''}.`;
  } else {
    classification = 'BASELINE_MATCH';
    summaryHeadline = `Exact coverage parity across all verified protection categories.`;
  }

  return {
    offerId: offer.id,
    challengeId: offer.challengeId,
    carrier: offer.carrier,
    providerName: offer.providerName,
    currentAnnualPremium: currentAnnual,
    offerAnnualPremium: offerAnnual,
    annualPremiumDifference,
    monthlyPremiumDifference,
    classification,
    summaryHeadline,
    materialReductions,
    materialImprovements,
    fieldComparisons,
    matchingFieldsCount: matchingCount,
    betterFieldsCount: betterCount,
    worseFieldsCount: worseCount,
    differentFieldsCount: differentCount,
    unknownFieldsCount: unknownCount,
    totalFieldsCount: fieldComparisons.length
  };
}
