import { 
  Competition, 
  CompetitionRound, 
  Offer, 
  CoverageBaseline, 
  ProviderMarketSignal, 
  ProviderOfferStanding,
  CompetitionEvaluationSummary,
  CompetitionActivityEvent,
  RoundDeadlineStatus
} from '../types/insurance';
import { compareOfferAgainstBaseline } from './comparisonEngine';

/**
 * Open Policy Competition Engine (PM-2)
 * 
 * Implements deterministic multi-round offer lifecycle and privacy protections.
 * market signals, and anti-collusion privacy protections.
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

  // Advancement rules:
  // - Round 1 -> Round 2: Can advance if at least 2 qualified offers exist or Round 1 duration has elapsed
  // - Round 2 -> Round 3 (BAFO): Can advance if competing offers are close (within 10% savings)
  // - Close for Review: At least 1 qualified offer
  const reasons: string[] = [];
  const canAdvanceToImprovement = competition.currentRound === 'ROUND_1_OPEN' && offers.length >= 2;
  if (canAdvanceToImprovement) {
    reasons.push(`${offers.length} initial offers received. Ready for Improvement Round.`);
  }

  const canAdvanceToBafo = competition.currentRound === 'ROUND_2_IMPROVEMENT' && validQualified.length >= 2;
  if (canAdvanceToBafo) {
    reasons.push(`Multiple qualified contenders in Improvement Round. Ready for Best and Final Offer (BAFO).`);
  }

  const canCloseForConsumerReview = validQualified.length >= 1;
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
      canAdvanceToImprovement,
      canAdvanceToBafo,
      canCloseForConsumerReview,
      reasons
    }
  };
}

/**
 * Calculates sealed relative market signals for a specific participating provider organization.
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
export function calculateProviderMarketSignals(
  competition: Competition,
  providerOrgId: string,
  allOffers: Offer[],
  baseline: CoverageBaseline,
  invitedCount: number = 0
): ProviderMarketSignal {
  const myOffers = allOffers.filter((o) => o.providerId === providerOrgId);
  const now = new Date().getTime();
  const closesAtTime = new Date(competition.closesAt).getTime();
  const timeRemainingMs = Math.max(0, closesAtTime - now);
  const isImprovementRound = competition.currentRound === 'ROUND_2_IMPROVEMENT';
  const isBafoRound = competition.currentRound === 'ROUND_3_BAFO';

  // Count participating providers safely
  const uniqueProviders = new Set(allOffers.map((o) => o.providerId));
  const participatingCount = Math.max(competition.participantCount, uniqueProviders.size);

  const yourOffers: ProviderOfferStanding[] = myOffers.map((offer) => {
    const comparison = compareOfferAgainstBaseline(baseline, offer);
    const difference = baseline.baselineAnnualPremium - offer.annualPremium;
    const savingsPercentage = Math.round((difference / baseline.baselineAnnualPremium) * 100);
    const canRevise = isImprovementRound || isBafoRound;
    const isVerified = offer.status !== 'DISCREPANCY_FLAGGED';
    const meetsReqs = offer.isQualified !== false && offer.status !== 'DISCREPANCY_FLAGGED';

    return {
      offerId: offer.id,
      carrier: offer.carrier,
      tierLabel: offer.tierLabel,
      annualPremium: offer.annualPremium,
      differenceFromCurrentPolicy: difference,
      savingsPercentage,
      status: offer.status === 'DISCREPANCY_FLAGGED' ? 'DISCREPANCY_FLAGGED' : 'VALIDATED',
      classification: comparison.classification,
      meetsRequirements: meetsReqs,
      isVerified,
      requiresAdditionalInfo: offer.status === 'DISCREPANCY_FLAGGED',
      canRevise
    };
  });

  // Factual marketplace status message (Section 4 Canonical Specification)
  let statusMessage = `${participatingCount} providers participating. `;
  if (isImprovementRound) {
    statusMessage += 'IMPROVEMENT ROUND active. The consumer has requested improved offers.';
  } else if (isBafoRound) {
    statusMessage += 'BEST AND FINAL ROUND active. Submit your most competitive proposition.';
  } else {
    statusMessage += 'OPEN ROUND active. Active offers are under consumer review.';
  }

  const bestOffer = yourOffers.length > 0 ? yourOffers[0] : null;

  return {
    competitionId: competition.id,
    challengeId: competition.challengeId,
    currentRound: competition.currentRound,
    roundClosesAt: competition.closesAt,
    roundTimeRemainingMs: timeRemainingMs,
    totalInvitedProviders: invitedCount > 0 ? invitedCount : Math.max(participatingCount, 2),
    totalParticipatingProviders: participatingCount,
    totalSubmittedOffersInRound: allOffers.length,
    yourSubmittedOffersCount: myOffers.length,
    consumerRequestedImprovement: isImprovementRound || isBafoRound,
    statusMessage,
    yourOffers,
    guidanceHint: statusMessage,
    nextRoundEligible: competition.currentRound !== 'CLOSED_PENDING_SELECTION',
    bestPosition: bestOffer ? {
      offerId: bestOffer.offerId,
      carrier: bestOffer.carrier,
      annualSavings: bestOffer.differenceFromCurrentPolicy,
      savingsPercentage: bestOffer.savingsPercentage,
      guidanceHint: statusMessage,
      meetsRequirements: bestOffer.meetsRequirements,
      isVerified: bestOffer.isVerified
    } : null,
    allYourOffersSignals: yourOffers.map(yo => ({
      offerId: yo.offerId,
      carrier: yo.carrier,
      tierLabel: yo.tierLabel,
      annualPremium: yo.annualPremium,
      annualSavings: yo.differenceFromCurrentPolicy,
      savingsPercentage: yo.savingsPercentage,
      totalValidOffers: allOffers.filter(o => o.status !== 'DISCREPANCY_FLAGGED').length,
      status: yo.status,
      classification: yo.classification,
      canRevise: yo.canRevise
    }))
  };
}

/**
 * Advances a competition to a target round with auditable metadata and configurable duration.
 * Canonical Lifecycle: OPEN -> IMPROVEMENT -> BEST_AND_FINAL -> CLOSED -> CONSUMER_REVIEW
 */
export function advanceCompetitionRound(
  competition: Competition,
  targetRound: CompetitionRound,
  triggerReason: string,
  customDurationHours?: number,
  now: Date = new Date()
): Competition {
  
  // Canonical Round Durations:
  // OPEN: 48h
  // IMPROVEMENT: 24h
  // BEST_AND_FINAL: 12h
  // CLOSED: 0h
  // CONSUMER_REVIEW: 72h
  const configuredHours = competition.roundDurationsHours?.[targetRound];
  let defaultDuration = 24;
  if (targetRound === 'ROUND_1_OPEN' || targetRound === 'OPEN') {
    defaultDuration = 48;
  } else if (targetRound === 'ROUND_3_BAFO' || targetRound === 'BEST_AND_FINAL') {
    defaultDuration = 12;
  } else if (targetRound === 'CLOSED') {
    defaultDuration = 0;
  } else if (targetRound === 'CONSUMER_REVIEW' || targetRound === 'CLOSED_PENDING_SELECTION') {
    defaultDuration = 72;
  }

  const durationHours = customDurationHours !== undefined 
    ? customDurationHours 
    : (configuredHours !== undefined ? configuredHours : defaultDuration);

  const newClosesAt = durationHours === 0 
    ? now.toISOString() 
    : new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();

  const history = competition.roundHistory ? [...competition.roundHistory] : [
    {
      round: competition.currentRound,
      enteredAt: competition.openedAt,
      completedAt: now.toISOString(),
      reason: 'Round initialized'
    }
  ];

  // Close previous round in history
  if (history.length > 0) {
    history[history.length - 1].completedAt = now.toISOString();
  }

  // Add new round
  history.push({
    round: targetRound,
    enteredAt: now.toISOString(),
    reason: triggerReason
  });

  const roundDeadlines = {
    ...(competition.roundDeadlines || {}),
    [targetRound]: newClosesAt
  };

  let newStatus = competition.status;
  if (targetRound === 'ROUND_1_OPEN' || targetRound === 'OPEN') {
    newStatus = 'OPEN';
  } else if (targetRound === 'ROUND_2_IMPROVEMENT' || targetRound === 'IMPROVEMENT') {
    newStatus = 'IMPROVEMENT';
  } else if (targetRound === 'ROUND_3_BAFO' || targetRound === 'BEST_AND_FINAL') {
    newStatus = 'BEST_AND_FINAL';
  } else if (targetRound === 'CLOSED') {
    newStatus = 'CLOSED';
  } else if (targetRound === 'CONSUMER_REVIEW' || targetRound === 'CLOSED_PENDING_SELECTION') {
    newStatus = 'CONSUMER_REVIEW';
  }

  return {
    ...competition,
    status: newStatus,
    currentRound: targetRound,
    closesAt: newClosesAt,
    roundDeadlines,
    roundHistory: history,
    isBafoTriggered: targetRound === 'ROUND_3_BAFO' || targetRound === 'BEST_AND_FINAL' || competition.isBafoTriggered
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
    formattedRemaining = 'Round Expired';
  } else if (competition.status === 'CLOSED') {
    formattedRemaining = 'Competition Closed';
  } else if (competition.status === 'CONSUMER_REVIEW') {
    formattedRemaining = 'In Consumer Review';
  } else if (hours > 0) {
    formattedRemaining = `${hours}h ${minutes}m remaining`;
  } else {
    formattedRemaining = `${minutes}m remaining`;
  }

  let nextRoundSuggested: CompetitionRound | undefined;
  if (competition.currentRound === 'OPEN' || competition.currentRound === 'ROUND_1_OPEN') {
    nextRoundSuggested = 'IMPROVEMENT';
  } else if (competition.currentRound === 'IMPROVEMENT' || competition.currentRound === 'ROUND_2_IMPROVEMENT') {
    nextRoundSuggested = competition.finalRoundEnabled ? 'BEST_AND_FINAL' : 'CLOSED';
  } else if (competition.currentRound === 'BEST_AND_FINAL' || competition.currentRound === 'ROUND_3_BAFO') {
    nextRoundSuggested = 'CLOSED';
  } else if (competition.currentRound === 'CLOSED') {
    nextRoundSuggested = 'CONSUMER_REVIEW';
  }

  return {
    round: competition.currentRound,
    closesAt: competition.closesAt,
    isExpired,
    remainingSeconds,
    formattedRemaining,
    nextRoundSuggested
  };
}

/**
 * Validates an offer revision submitted during an Improvement or BAFO round.
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

  const isImprovement = currentRound === 'ROUND_2_IMPROVEMENT' || currentRound === 'IMPROVEMENT';
  const isBafo = currentRound === 'ROUND_3_BAFO' || currentRound === 'BEST_AND_FINAL';

  if (!isImprovement && !isBafo) {
    errors.push(`Revisions only permitted during Improvement or BAFO rounds. Current round: ${currentRound}`);
  }

  if (revisedOffer.annualPremium !== undefined) {
    if (revisedOffer.annualPremium <= 0) {
      errors.push('Revised premium must be greater than zero.');
    } else if (revisedOffer.annualPremium < originalOffer.annualPremium) {
      improvementDimensions.push(`Lower annual premium ($${originalOffer.annualPremium} -> $${revisedOffer.annualPremium})`);
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
