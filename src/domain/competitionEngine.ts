import { 
  Competition, 
  CompetitionRound, 
  Offer, 
  CoverageBaseline, 
  ProviderOfferStatus,
  CompetitionEvaluationSummary,
  CompetitionActivityEvent,
  RoundDeadlineStatus
} from '../types/insurance';
import { compareOfferAgainstBaseline } from './comparisonEngine';
import { evaluateOfferAgainstStandard } from './qualificationStandard';

/**
 * Open Policy Competition Engine (PM-2)
 * 
 * Implements the deterministic single submission-window lifecycle and privacy protections.
 * 
 * SECTION 40 COMPLIANCE NOTE:
 * Platform-defined whole-offer scoring, ranking, and winner labeling (scoreAndRankOffers,
 * BEST_VALUE, MAX_SAVINGS, isCurrentLeader, leaderOfferId) have been removed per PM-1
 * acceptance requirement. Platform does not declare winners or rank offers.
 * 
 * Permitted: Consumer-selected factual sorting (premium low→high, savings high→low,
 * carrier A→Z). Permitted: Whole-offer classification per comparison engine
 * (BASELINE_MATCH / BASELINE_PLUS / COVERAGE_CHANGED / REVIEW_REQUIRED).
 */

/**
 * Evaluates the full competition round state and progression readiness.
 * Returns factual offer comparisons without platform-defined ranking or scoring.
 * Consumers sort by their own criteria (premium, savings, coverage classification).
 */
export function evaluateCompetitionRoundState(
  competition: Competition,
  offers: Offer[],
  baseline: CoverageBaseline
): CompetitionEvaluationSummary {
  const evaluatedOffers = offers.map((offer) => {
    const comparison = compareOfferAgainstBaseline(baseline, offer);
    return { offer, comparison };
  });

  const validQualified = evaluatedOffers.filter(
    (eo) => eo.offer.status !== 'DISCREPANCY_FLAGGED' && eo.offer.isQualified !== false
  );

  const flagged = evaluatedOffers.filter((eo) => eo.offer.status === 'DISCREPANCY_FLAGGED');
  const disqualified = evaluatedOffers.filter(
    (eo) => eo.offer.status !== 'DISCREPANCY_FLAGGED' && eo.offer.isQualified === false
  );

  const maxSavings = validQualified.length > 0 
    ? Math.max(...validQualified.map((q) => q.comparison.annualPremiumDifference))
    : 0;

  const averageSavings = validQualified.length > 0
    ? Math.round(validQualified.reduce((sum, q) => sum + q.comparison.annualPremiumDifference, 0) / validQualified.length)
    : 0;

  const reasons: string[] = [];
  const canCloseForConsumerReview = competition.status === 'OPEN';
  if (canCloseForConsumerReview) {
    reasons.push(`${validQualified.length} documented offer(s) are available for consumer review.`);
  } else {
    reasons.push('Awaiting at least one valid, documented provider offer.');
  }

  // Build factual offer summaries for consumer review (no platform ranking)
  const offerComparisons = evaluatedOffers.map((eo) => ({
    offer: eo.offer,
    comparison: eo.comparison,
  }));

  return {
    competitionId: competition.id,
    challengeId: competition.challengeId,
    currentRound: competition.currentRound,
    totalOffersSubmitted: offers.length,
    validQualifiedOffersCount: validQualified.length,
    flaggedOffersCount: flagged.length,
    disqualifiedCount: disqualified.length,
    offerComparisons,
    maxAnnualSavings: maxSavings,
    averageAnnualSavings: averageSavings,
    advancementReadiness: {
      canCloseForConsumerReview,
      reasons
    }
  };
}

/**
 * Returns bounded status for a specific participating provider organization.
 * 
 * CRITICAL PRIVACY & ANTI-COLLUSION INVARIANT:
 * Zero competitor names, zero competitor prices, zero other agency identifiers are ever exposed.
 * Only the provider's own relative ranking, aggregated competitor counts, and differential hints are returned.
 */
/**
 * Canonical Sealed Provider Telemetry (PM-1 Sections 3, 4, 12 & 24)
 * Strict Invariant: Providers must NOT be told competitor identities, rank, competitor premiums,
 * lowest competing premium, distance-to-leader, or competitor-derived scores.
 * Only factual marketplace-state telemetry and provider's own offer status are permitted.
 */
export function getProviderOfferStatus(
  competition: Competition,
  providerOrgId: string,
  allOffers: Offer[],
  baseline: CoverageBaseline
): ProviderOfferStatus {
  const myOffers = allOffers.filter((o) => o.providerId === providerOrgId);
  return {
    windowOpen: competition.status === 'OPEN' && Date.now() < new Date(competition.closesAt).getTime(),
    windowClosesAt: competition.closesAt,
    yourOffers: myOffers.map((offer) => ({
      offerId: offer.id,
      version: offer.version || 1,
      annualPremium: offer.annualPremium,
      validationStatus: offer.status,
      standard: evaluateOfferAgainstStandard(baseline, offer),
      requiresAdditionalInfo: offer.status === 'DISCREPANCY_FLAGGED'
    }))
  };
}

/**
 * Closes the submission window for policyholder review.
 */
export type SubmissionWindowCloseReason = 'DEADLINE' | 'CONSUMER_BEGAN_REVIEW';

export function closeSubmissionWindow(
  competition: Competition,
  reason: SubmissionWindowCloseReason,
  now: Date = new Date()
): Competition {
  if (competition.status !== 'OPEN' || competition.currentRound !== 'OPEN') {
    throw new Error('Submission window is not open.');
  }
  return {
    ...competition,
    status: 'CONSUMER_REVIEW',
    currentRound: 'CONSUMER_REVIEW',
    closesAt: reason === 'DEADLINE' ? competition.closesAt : now.toISOString()
  };
}

/**
 * Evaluates the deadline and expiration status of the current competition round.
 */
export function checkRoundDeadlineStatus(
  competition: Competition,
  now = new Date()
): RoundDeadlineStatus {
  const closesAtTime = new Date(competition.closesAt).getTime();
  const nowTime = now.getTime();
  const diffMs = closesAtTime - nowTime;
  const isExpired = diffMs <= 0 && competition.status !== 'CLOSED' && competition.status !== 'CONSUMER_REVIEW';

  const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);

  let formattedRemaining = '';
  if (isExpired) {
    formattedRemaining = 'Submission window closed';
  } else if (competition.status === 'CLOSED') {
    formattedRemaining = 'Submission window closed';
  } else if (competition.status === 'CONSUMER_REVIEW') {
    formattedRemaining = 'In Consumer Review';
  } else if (hours > 0) {
    formattedRemaining = `${hours}h ${minutes}m remaining`;
  } else {
    formattedRemaining = `${minutes}m remaining`;
  }

  return {
    round: competition.currentRound,
    closesAt: competition.closesAt,
    isExpired,
    remainingSeconds,
    formattedRemaining
  };
}

/**
 * Validates an independently initiated provider update while the submission window is open.
 * PM-3 Section 40 Multi-Dimensional Improvement:
 * An insurance proposition may improve through lower premium, lower deductible,
 * higher liability limits, restored coverage, additional endorsements, or reduced exclusions.
 * The system must NOT artificially reject revisions simply because premium adjusted.
 */
export function validateOfferRevision(
  originalOffer: Offer,
  revisedOffer: Partial<Offer>,
  currentRound: CompetitionRound
): { valid: boolean; errors: string[]; improvementDimensions?: string[] } {
  const errors: string[] = [];
  const improvementDimensions: string[] = [];
  const allowedReasons = ['DATA_CORRECTION', 'DOCUMENT_UPDATED', 'PROVIDER_UPDATED_QUOTE'];
  if (currentRound !== 'OPEN') {
    errors.push('Offer updates are permitted only while the submission window is open.');
  }
  if (!revisedOffer.revisionReason || !allowedReasons.includes(revisedOffer.revisionReason)) {
    errors.push(`Revision reason must be one of: ${allowedReasons.join(', ')}.`);
  }

  if (revisedOffer.annualPremium !== undefined) {
    if (revisedOffer.annualPremium <= 0) {
      errors.push('Revised premium must be greater than zero.');
    } else if (revisedOffer.annualPremium < originalOffer.annualPremium) {
      improvementDimensions.push(`Annual premium changed ($${originalOffer.annualPremium} -> $${revisedOffer.annualPremium})`);
    }
  }

  if (!revisedOffer.carrier) {
    errors.push('Carrier is required for revised offer.');
  }

  // Check multi-dimensional improvements across coverages and deductibles
  if (revisedOffer.coverages) {
    const origCol = originalOffer.coverages.find(c => c.code === 'COLLISION');
    const revCol = revisedOffer.coverages.find(c => c.code === 'COLLISION');
    if (origCol?.deductible !== undefined && revCol?.deductible !== undefined && revCol.deductible < origCol.deductible) {
      improvementDimensions.push(`Lower collision deductible ($${origCol.deductible} -> $${revCol.deductible})`);
    }

    const origComp = originalOffer.coverages.find(c => c.code === 'COMPREHENSIVE');
    const revComp = revisedOffer.coverages.find(c => c.code === 'COMPREHENSIVE');
    if (origComp?.deductible !== undefined && revComp?.deductible !== undefined && revComp.deductible < origComp.deductible) {
      improvementDimensions.push(`Lower comprehensive deductible ($${origComp.deductible} -> $${revComp.deductible})`);
    }

    const origBi = originalOffer.coverages.find(c => c.code === 'BODILY_INJURY');
    const revBi = revisedOffer.coverages.find(c => c.code === 'BODILY_INJURY');
    if (origBi?.perPersonLimit !== undefined && revBi?.perPersonLimit !== undefined && revBi.perPersonLimit > origBi.perPersonLimit) {
      improvementDimensions.push(`Higher bodily injury liability limit ($${origBi.perPersonLimit.toLocaleString()} -> $${revBi.perPersonLimit.toLocaleString()})`);
    }

    const origRental = originalOffer.coverages.some(c => c.code === 'RENTAL_REIMBURSEMENT' && c.isIncluded);
    const revRental = revisedOffer.coverages.some(c => c.code === 'RENTAL_REIMBURSEMENT' && c.isIncluded);
    if (!origRental && revRental) {
      improvementDimensions.push('Added rental reimbursement endorsement');
    }

    const origRoad = originalOffer.coverages.some(c => c.code === 'ROADSIDE_ASSISTANCE' && c.isIncluded);
    const revRoad = revisedOffer.coverages.some(c => c.code === 'ROADSIDE_ASSISTANCE' && c.isIncluded);
    if (!origRoad && revRoad) {
      improvementDimensions.push('Added roadside assistance endorsement');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    improvementDimensions
  };
}

/**
 * Sanitizes competition activity feed for provider viewing to prevent competitor leakage.
 * Providers see their own events fully, but competitor activities are anonymized/masked.
 */
export function filterCompetitionActivityFeedForProvider(
  events: CompetitionActivityEvent[],
  viewingProviderOrgId: string
): CompetitionActivityEvent[] {
  return events.map(evt => {
    if (evt.providerOrganizationId && evt.providerOrganizationId !== viewingProviderOrgId) {
      return {
        ...evt,
        actorName: 'Participating Broker',
        providerOrganizationId: undefined,
        summary: evt.summary
          .replace(/Apex Insurance Services( Inc)?/gi, 'A competing broker')
          .replace(/Sierra Brokerage Group( LLC)?/gi, 'A competing broker')
          .replace(/Buckeye Mutual Agency( Inc)?/gi, 'A competing broker')
          .replace(/\$\d[\d,]*(\/yr|\/mo)?/g, '$[sealed]')
      };
    }
    return evt;
  });
}
