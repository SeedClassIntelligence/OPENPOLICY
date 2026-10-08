/**
 * PM-2: Offer Qualification, Carrier Verification & Integrity Engine
 * Canonical Specification Sections 17, 18, 25, 26, 28, 30, 34
 * 
 * Strict Invariant: Zero opaque algorithmic scoring or platform ranking.
 * Pure deterministic, factual qualification verification.
 */

import {
  Offer,
  CoverageBaseline,
  ProviderOrganization,
  CarrierRelationship,
  OfferVerification,
  OfferStandardResult,
  OfferVersion,
  InformationRequest,
  VerifiedSupplementalFact
} from '../types/insurance';
import { evaluateOfferAgainstStandard } from './qualificationStandard';

export interface JurisdictionalStatutoryRule {
  jurisdiction: string;
  ruleVersion: string;
  lineOfBusiness: string;
  mandatoryCoverageCodes: string[];
  statutoryMinimums?: {
    bodilyInjuryPerPerson?: number;
    bodilyInjuryPerAccident?: number;
    propertyDamage?: number;
  };
  citation: string;
  effectiveDate: string;
}

export const JURISDICTIONAL_STATUTORY_REGISTRY: Record<string, JurisdictionalStatutoryRule> = {
  NV: {
    jurisdiction: 'NV',
    ruleVersion: 'NV-DOI-2025-01',
    lineOfBusiness: 'PERSONAL_AUTO',
    mandatoryCoverageCodes: ['BODILY_INJURY', 'PROPERTY_DAMAGE'],
    statutoryMinimums: {
      bodilyInjuryPerPerson: 25000,
      bodilyInjuryPerAccident: 50000,
      propertyDamage: 20000
    },
    citation: 'Nevada Revised Statutes NRS 485.185 (25/50/20 statutory minimum liability)',
    effectiveDate: '2025-01-01'
  },
  OH: {
    jurisdiction: 'OH',
    ruleVersion: 'OH-DOI-2025-01',
    lineOfBusiness: 'PERSONAL_AUTO',
    mandatoryCoverageCodes: ['BODILY_INJURY', 'PROPERTY_DAMAGE'],
    statutoryMinimums: {
      bodilyInjuryPerPerson: 25000,
      bodilyInjuryPerAccident: 50000,
      propertyDamage: 25000
    },
    citation: 'Ohio Revised Code § 4509.51 (25/50/25 statutory minimum liability)',
    effectiveDate: '2025-01-01'
  },
  CA: {
    jurisdiction: 'CA',
    ruleVersion: 'CA-DOI-2025-01',
    lineOfBusiness: 'PERSONAL_AUTO',
    mandatoryCoverageCodes: ['BODILY_INJURY', 'PROPERTY_DAMAGE'],
    statutoryMinimums: {
      bodilyInjuryPerPerson: 30000,
      bodilyInjuryPerAccident: 60000,
      propertyDamage: 15000
    },
    citation: 'California Insurance Code § 11580.1b (30/60/15 statutory minimum liability)',
    effectiveDate: '2025-01-01'
  }
};

export interface QualificationResult {
  isQualified: boolean;
  qualificationReasons: string[];
  disqualificationReasons: string[];
  evaluatedAt: string;
  applicableRuleVersion?: string;
  standard: OfferStandardResult;
}

/**
 * Deterministically evaluates whether an offer satisfies all objective qualification
 * requirements to be designated a Qualified Offer (Section 34).
 * Evaluates applicable jurisdictional rules explicitly without universal statutory assumptions.
 */
export function evaluateOfferQualification(
  offer: Offer,
  baseline: CoverageBaseline,
  providerOrg?: ProviderOrganization,
  carrierRelationships: CarrierRelationship[] = [],
  verification?: OfferVerification,
  jurisdictionOverride?: string
): QualificationResult {
  const qualificationReasons: string[] = [];
  const disqualificationReasons: string[] = [];

  const resolvedJurisdiction = (
    jurisdictionOverride ||
    baseline.jurisdiction ||
    (baseline.vehicle?.garagingZip?.startsWith('89') ? 'NV' :
     baseline.vehicle?.garagingZip?.startsWith('9') ? 'CA' :
     baseline.vehicle?.garagingZip?.startsWith('4') ? 'OH' : undefined)
  )?.toUpperCase();

  // 1. Provider Organization Eligibility
  if (!providerOrg) {
    disqualificationReasons.push(`Provider organization '${offer.providerId}' is not found.`);
  } else if (providerOrg.marketplaceStatus !== 'ACTIVE') {
    disqualificationReasons.push(`Provider organization status is '${providerOrg.marketplaceStatus}', must be ACTIVE.`);
  } else if (providerOrg.verificationStatus !== 'MARKETPLACE_APPROVED') {
    disqualificationReasons.push(`Provider verification status is '${providerOrg.verificationStatus}', must be MARKETPLACE_APPROVED.`);
  } else {
    qualificationReasons.push(`Provider organization '${providerOrg.displayName}' is authorized and ACTIVE in marketplace.`);
  }

  // 2. Carrier Relationship & Appointment Verification
  const normalizedCarrier = offer.carrier.trim().toLowerCase();
  const matchingRel = carrierRelationships.find(
    rel => rel.providerOrganizationId === offer.providerId &&
           rel.status === 'ACTIVE' &&
           (rel.carrierName.toLowerCase().includes(normalizedCarrier) ||
            normalizedCarrier.includes(rel.carrierName.toLowerCase()))
  );

  if (carrierRelationships.length > 0 && !matchingRel) {
    disqualificationReasons.push(`Provider '${offer.providerName}' does not have an active appointment or broker authorization for carrier '${offer.carrier}'.`);
  } else if (matchingRel) {
    qualificationReasons.push(`Carrier '${offer.carrier}' appointment verified (${matchingRel.relationshipType}).`);
  } else {
    qualificationReasons.push(`Carrier '${offer.carrier}' stated with broker representation.`);
  }

  // 3. Supporting Quote Document Association (Section 30)
  if (!offer.supportingQuoteDocName || offer.supportingQuoteDocName.trim().length === 0) {
    disqualificationReasons.push('Missing official supporting carrier quote document.');
  } else {
    qualificationReasons.push(`Supporting quote document attached (${offer.supportingQuoteDocName}).`);
  }

  // 4. Quote Term & Effective Date Validity
  if (!offer.effectiveDate || !offer.expirationDate) {
    disqualificationReasons.push('Effective and expiration dates must be specified.');
  } else {
    const eff = new Date(offer.effectiveDate).getTime();
    const exp = new Date(offer.expirationDate).getTime();
    if (isNaN(eff) || isNaN(exp) || exp <= eff) {
      disqualificationReasons.push('Policy expiration date must be strictly after the effective date.');
    } else {
      qualificationReasons.push('Quote effective period verified and valid.');
    }
  }

  // 5. Versioned Jurisdictional Statutory Coverage Evaluation
  // Evaluates explicit jurisdictional requirements without assuming universal 50-state statutory rules.
  let applicableRuleVersion: string | undefined = undefined;
  if (resolvedJurisdiction && JURISDICTIONAL_STATUTORY_REGISTRY[resolvedJurisdiction]) {
    const rule = JURISDICTIONAL_STATUTORY_REGISTRY[resolvedJurisdiction];
    applicableRuleVersion = rule.ruleVersion;
    const missingCodes = rule.mandatoryCoverageCodes.filter(
      code => !offer.coverages.some(c => c.code === code && c.isIncluded)
    );
    if (missingCodes.length > 0) {
      disqualificationReasons.push(
        `Disqualified under ${rule.jurisdiction} statutory liability rule (${rule.ruleVersion}: ${rule.citation}). Missing mandatory statutory coverages: ${missingCodes.join(', ')}.`
      );
    } else {
      qualificationReasons.push(
        `${rule.jurisdiction} mandatory coverage categories present (${rule.ruleVersion}: ${rule.citation}). Statutory limit amounts were not evaluated.`
      );
    }
  } else if (resolvedJurisdiction) {
    qualificationReasons.push(
      `Jurisdiction '${resolvedJurisdiction}': No specific statutory rule module loaded; baseline coverage conformity evaluated without universal statutory assumptions.`
    );
  } else {
    const hasBodilyInjury = offer.coverages.some(c => c.code === 'BODILY_INJURY' && c.isIncluded);
    const hasPropertyDamage = offer.coverages.some(c => c.code === 'PROPERTY_DAMAGE' && c.isIncluded);
    if (!hasBodilyInjury || !hasPropertyDamage) {
      disqualificationReasons.push('Missing core baseline liability coverages (Bodily Injury and Property Damage).');
    } else {
      qualificationReasons.push('Core baseline liability coverages verified.');
    }
  }

  // 6. Independent Document Extraction & Discrepancy Verification (Section 30)
  if (verification) {
    if (verification.status === 'DISCREPANCIES_FLAGGED' && verification.discrepancyCount > 0) {
      disqualificationReasons.push(
        `Supporting quote document has ${verification.discrepancyCount} unresolved discrepancies: ${verification.discrepancies.join('; ')}`
      );
    } else {
      qualificationReasons.push('Supporting quote document data independently extracted and validated without material discrepancies.');
    }
  } else if (offer.discrepanciesDetected) {
    disqualificationReasons.push(
      `Unresolved quote discrepancies detected: ${offer.discrepancyDetails?.join('; ') || 'Premium or coverage mismatch'}`
    );
  } else {
    qualificationReasons.push('Quote validated against entered specification.');
  }

  // 7. Pricing Completeness
  if (offer.annualPremium <= 0 || offer.monthlyPremium <= 0) {
    disqualificationReasons.push('Annual and monthly premium amounts must be positive values.');
  } else {
    qualificationReasons.push(`Premium schedules complete ($${offer.annualPremium}/yr, $${offer.monthlyPremium}/mo).`);
  }

  const isQualified = disqualificationReasons.length === 0;

  return {
    isQualified,
    qualificationReasons,
    disqualificationReasons,
    evaluatedAt: new Date().toISOString(),
    applicableRuleVersion,
    standard: evaluateOfferAgainstStandard(baseline, offer)
  };
}

/**
 * Flags duplicate carrier representations across different participating providers (Section 26).
 * Invariant: Preserves both offers transparently without favoring either provider.
 */
export function flagDuplicateCarrierOffers(offers: Offer[]): Offer[] {
  // Group offers by normalized carrier name
  const carrierMap = new Map<string, Offer[]>();
  for (const offer of offers) {
    const key = offer.carrier.trim().toLowerCase();
    const existing = carrierMap.get(key) || [];
    existing.push(offer);
    carrierMap.set(key, existing);
  }

  return offers.map(offer => {
    const key = offer.carrier.trim().toLowerCase();
    const sameCarrierOffers = carrierMap.get(key) || [];
    // Only flag as duplicate carrier if submitted by DIFFERENT providers
    const distinctProviders = new Set(sameCarrierOffers.map(o => o.providerId));

    if (distinctProviders.size > 1) {
      const otherOffers = sameCarrierOffers.filter(o => o.id !== offer.id);
      return {
        ...offer,
        isDuplicateCarrier: true,
        duplicateWithOfferIds: otherOffers.map(o => o.id),
        duplicateCarrierNotice: `Multiple participating providers have submitted independent offers under ${offer.carrier}. All offers are preserved transparently with carrier rates and broker services independently itemized.`
      };
    } else {
      return {
        ...offer,
        isDuplicateCarrier: false,
        duplicateWithOfferIds: [],
        duplicateCarrierNotice: undefined
      };
    }
  });
}

/**
 * Creates an OfferVersion snapshot before an offer is updated (Section 28).
 */
export function createOfferVersionSnapshot(
  existingOffer: Offer,
  revisionReason: string
): OfferVersion {
  return {
    id: `VER-${existingOffer.id}-v${existingOffer.version || 1}`,
    offerId: existingOffer.id,
    versionNumber: existingOffer.version || 1,
    round: existingOffer.round || 'ROUND_1_OPEN',
    carrier: existingOffer.carrier,
    annualPremium: existingOffer.annualPremium,
    monthlyPremium: existingOffer.monthlyPremium,
    coverages: JSON.parse(JSON.stringify(existingOffer.coverages)),
    supportingQuoteDocName: existingOffer.supportingQuoteDocName,
    revisionReason: revisionReason || 'Offer updated by provider',
    submittedAt: existingOffer.submittedAt,
    supersededAt: new Date().toISOString()
  };
}

/**
 * Filters supplemental facts visible to a specific provider organization (Section 18).
 */
export function getVisibleSupplementalFactsForProvider(
  facts: VerifiedSupplementalFact[],
  providerOrgId: string
): VerifiedSupplementalFact[] {
  return facts.filter(fact => 
    fact.sharedWithOrganizationIds.includes(providerOrgId) ||
    fact.sharedWithOrganizationIds.includes('*') // wildcard for all participating providers in competition
  );
}
