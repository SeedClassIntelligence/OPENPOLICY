/**
 * PR-0A — Jurisdiction shadow evaluation (D4)
 *
 * The only bridge between jurisdiction intelligence and marketplace flows in PR-0A.
 * It resolves the applicable ruleset, evaluates, compares the result with the frozen
 * behavior, and records an append-only JurisdictionRuleEvaluation with any discrepancy.
 *
 * It never changes offer.isQualified, eligibility, challenge creation, participation,
 * selection, binding or reconciliation. Discrepancies are recorded, never forced into
 * agreement. Callers must not let a failure here alter a response.
 *
 * Ordering invariant (§G): market activation is evaluated for challenge opening, and
 * provider authority before CE-2 capacity consumption. In SHADOW mode neither blocks;
 * ENFORCE arrives in PR-0C.
 */
import crypto from 'crypto';
import {
  CarrierRelationship,
  Challenge,
  ChallengeInvitation,
  Offer,
  ProviderLicense,
  ProviderOrganization
} from '../types/insurance';
import {
  EnforcementPoint,
  EvaluationSubjectType,
  JurisdictionDetermination,
  JurisdictionRuleEvaluation,
  MarketEnvironment,
  RuleEvaluationResult,
  RuleOutcome,
  RuleSetBasis
} from '../types/jurisdiction';
import { evaluateRules } from '../domain/jurisdictionRuleEngine';
import { evaluateProviderJurisdictionAuthority } from '../domain/providerAuthorityEngine';
import { decideMarketTransition, replayActivation } from '../domain/marketActivationEngine';
import { sha256Hex } from '../domain/jurisdiction/canonical';
import { jurisdictionStore } from './db/jurisdictionStore';
import { seedLegacyJurisdictionData } from './db/seeds/legacyJurisdictionSeed';

const LINE = 'PERSONAL_AUTO' as const;

/** Deployment market environment. Defaults to SANDBOX; a PRODUCTION deployment must set it explicitly. */
export function marketEnvironment(): MarketEnvironment {
  const value = (process.env.OPENPOLICY_MARKET_ENVIRONMENT || 'SANDBOX').toUpperCase();
  if (value !== 'SANDBOX' && value !== 'PRODUCTION') {
    throw new Error(`OPENPOLICY_MARKET_ENVIRONMENT must be SANDBOX or PRODUCTION (got '${value}')`);
  }
  return value;
}

let frameworkReady: Promise<void> | null = null;

export function ensureJurisdictionFramework(): Promise<void> {
  if (!frameworkReady) {
    frameworkReady = seedLegacyJurisdictionData(jurisdictionStore, marketEnvironment()).catch(err => {
      frameworkReady = null;
      throw err;
    });
  }
  return frameworkReady;
}

/**
 * Transaction calendar date. PR-0A uses the UTC calendar date; conversion to the
 * jurisdiction-local legal date is a PR-0B/PR-0C determination.
 */
export function transactionDateOf(isoTimestamp: string | undefined): string | undefined {
  return isoTimestamp && /^\d{4}-\d{2}-\d{2}/.test(isoTimestamp) ? isoTimestamp.slice(0, 10) : undefined;
}

async function record(params: {
  subjectType: EvaluationSubjectType;
  subjectId: string;
  jurisdictionCode?: string;
  enforcementPoint: EnforcementPoint;
  ruleSetId?: string;
  ruleSetContentSha256?: string;
  ruleSetBasis: RuleSetBasis;
  evaluationDate?: string;
  outcome: RuleOutcome;
  results: RuleEvaluationResult[];
  inputs: unknown;
  legacyOutcome: string;
  discrepancy: boolean;
  discrepancyNotes?: string;
}): Promise<JurisdictionRuleEvaluation> {
  const { inputs, ...rest } = params;
  const evaluation: JurisdictionRuleEvaluation = {
    id: `JRE-${crypto.randomUUID()}`,
    ...rest,
    inputsSha256: sha256Hex(inputs),
    mode: 'SHADOW',
    evaluatedAt: new Date().toISOString()
  };
  await jurisdictionStore.saveEvaluation(evaluation);
  return evaluation;
}

// ---------------------------------------------------------------------------
// Jurisdiction determination (used for the challenge's jurisdiction; no ZIP inference)
// ---------------------------------------------------------------------------

/** The pure determination decides; this persists it (append-only). */
export async function recordDetermination(determination: JurisdictionDetermination): Promise<void> {
  await ensureJurisdictionFramework();
  await jurisdictionStore.saveDetermination(determination);
}

// ---------------------------------------------------------------------------
// Market activation at challenge opening
// ---------------------------------------------------------------------------

export async function shadowChallengeOpen(challenge: Challenge): Promise<{
  ruleSetId?: string;
  ruleSetContentSha256?: string;
  evaluationDate?: string;
}> {
  await ensureJurisdictionFramework();
  const environment = marketEnvironment();
  const key = { jurisdictionCode: challenge.jurisdiction, insuranceLine: LINE, environment };
  const { state, suspensionAction } = replayActivation(await jurisdictionStore.getActivationEvents(key), key);
  const decision = decideMarketTransition(state, suspensionAction, 'NEW_CHALLENGE');
  const resolved = await jurisdictionStore.resolveEvaluationRuleSet(challenge.jurisdiction, LINE);
  const evaluationDate = transactionDateOf(challenge.openingTimestamp);
  const outcome: RuleOutcome = decision.disposition === 'ALLOWED' ? 'PASS' : 'BLOCK';

  await record({
    subjectType: 'CHALLENGE',
    subjectId: challenge.id,
    jurisdictionCode: challenge.jurisdiction,
    enforcementPoint: 'CHALLENGE_OPEN',
    ruleSetId: resolved.ruleSet?.id,
    ruleSetContentSha256: resolved.contentSha256,
    ruleSetBasis: resolved.basis,
    evaluationDate,
    outcome,
    results: [{
      ruleId: 'MARKET_ACTIVATION',
      ruleCode: 'MARKET.NEW_CHALLENGE',
      outcome,
      reasons: [`${environment} market ${challenge.jurisdiction}/${LINE} is ${state}: ${decision.reasons.join(' ')}`],
      verificationStatus: 'VERIFIED',
      evaluationDate
    }],
    inputs: { key, state, suspensionAction },
    legacyOutcome: 'CHALLENGE_CREATED',
    discrepancy: outcome !== 'PASS',
    discrepancyNotes: outcome !== 'PASS' ? `Enforcement would have blocked this challenge (${decision.disposition}).` : undefined
  });

  return { ruleSetId: resolved.ruleSet?.id, ruleSetContentSha256: resolved.contentSha256, evaluationDate };
}

// ---------------------------------------------------------------------------
// Offer coverage qualification
// ---------------------------------------------------------------------------

/** The frozen engine's statutory verdict, isolated from its non-jurisdictional checks. */
function legacyStatutoryVerdict(offer: Offer): 'STATUTORY_PASS' | 'STATUTORY_FAIL' {
  const statutoryFailure = (offer.disqualificationReasons || []).some(r => /statutory/i.test(r));
  return statutoryFailure ? 'STATUTORY_FAIL' : 'STATUTORY_PASS';
}

function verdictOf(outcome: RuleOutcome): 'STATUTORY_PASS' | 'STATUTORY_FAIL' | 'INDETERMINATE' {
  if (outcome === 'PASS' || outcome === 'NOT_APPLICABLE') return 'STATUTORY_PASS';
  if (outcome === 'INDETERMINATE') return 'INDETERMINATE';
  return 'STATUTORY_FAIL';
}

export async function shadowOfferQualification(offer: Offer, challenge: Challenge | undefined): Promise<JurisdictionRuleEvaluation> {
  await ensureJurisdictionFramework();
  const jurisdictionCode = challenge?.jurisdiction;
  const legacyOutcome = legacyStatutoryVerdict(offer);
  const context = {
    dates: {
      policyEffectiveDate: transactionDateOf(offer.effectiveDate),
      offerSubmittedDate: transactionDateOf(offer.submittedAt)
    },
    coverages: (offer.coverages || []).map(c => ({
      code: c.code,
      isIncluded: c.isIncluded,
      perPersonLimit: c.perPersonLimit,
      perAccidentLimit: c.perAccidentLimit,
      propertyLimit: c.propertyLimit
    }))
  };

  if (!jurisdictionCode) {
    return record({
      subjectType: 'OFFER', subjectId: offer.id, enforcementPoint: 'OFFER_QUALIFICATION', ruleSetBasis: 'NONE',
      outcome: 'INDETERMINATE',
      results: [{ ruleId: 'NONE', ruleCode: 'JURISDICTION', outcome: 'INDETERMINATE', reasons: ['Governing jurisdiction is unknown.'], verificationStatus: 'UNVERIFIED' }],
      inputs: context, legacyOutcome, discrepancy: true, discrepancyNotes: 'No jurisdiction; the new engine cannot evaluate.'
    });
  }

  const resolved = await jurisdictionStore.resolveEvaluationRuleSet(jurisdictionCode, LINE);
  let outcome: RuleOutcome;
  let results: RuleEvaluationResult[];
  if (resolved.basis === 'NONE') {
    outcome = 'INDETERMINATE';
    results = [{
      ruleId: 'NONE', ruleCode: 'RULESET', outcome,
      reasons: [`No ruleset exists for ${jurisdictionCode}/${LINE}; coverage requirements are unknown.`],
      verificationStatus: 'UNVERIFIED'
    }];
  } else {
    ({ outcome, results } = evaluateRules(resolved.rules, 'OFFER_QUALIFICATION', context));
  }

  const newVerdict = verdictOf(outcome);
  const discrepancy = newVerdict !== legacyOutcome;
  return record({
    subjectType: 'OFFER',
    subjectId: offer.id,
    jurisdictionCode,
    enforcementPoint: 'OFFER_QUALIFICATION',
    ruleSetId: resolved.ruleSet?.id,
    ruleSetContentSha256: resolved.contentSha256,
    ruleSetBasis: resolved.basis,
    evaluationDate: context.dates.policyEffectiveDate,
    outcome,
    results,
    inputs: context,
    legacyOutcome,
    discrepancy,
    discrepancyNotes: discrepancy ? `Frozen engine: ${legacyOutcome}; jurisdiction engine: ${newVerdict} (${outcome}).` : undefined
  });
}

// ---------------------------------------------------------------------------
// Provider authority (at invitation and before capacity consumption at acceptance)
// ---------------------------------------------------------------------------

export async function shadowProviderAuthority(params: {
  invitation: ChallengeInvitation;
  challenge: Challenge | undefined;
  org: ProviderOrganization;
  licenses: ProviderLicense[];
  carrierRelationships: CarrierRelationship[];
  /** The frozen behavior at this point. */
  legacyEligible: boolean;
  evaluationDate: string | undefined;
  stage: 'INVITATION' | 'ACCEPTANCE';
}): Promise<JurisdictionRuleEvaluation> {
  await ensureJurisdictionFramework();
  const jurisdictionCode = params.challenge?.jurisdiction;
  const resolved = jurisdictionCode
    ? await jurisdictionStore.resolveEvaluationRuleSet(jurisdictionCode, LINE)
    : { basis: 'NONE' as const, rules: [], ruleSet: undefined, contentSha256: undefined };

  const authority = evaluateProviderJurisdictionAuthority({
    org: params.org,
    licenses: params.licenses,
    carrierRelationships: params.carrierRelationships,
    rules: resolved.rules,
    jurisdictionCode,
    insuranceLine: LINE,
    evaluationDate: params.evaluationDate
  });
  const outcome: RuleOutcome =
    authority.outcome === 'AUTHORIZED' ? 'PASS' : authority.outcome === 'NOT_AUTHORIZED' ? 'NOT_AUTHORIZED' : 'INDETERMINATE';
  const legacyOutcome = params.legacyEligible ? 'ELIGIBLE' : 'INELIGIBLE';
  const discrepancy = (outcome === 'PASS') !== params.legacyEligible;

  return record({
    subjectType: 'INVITATION',
    subjectId: params.invitation.id,
    jurisdictionCode,
    enforcementPoint: 'PROVIDER_AUTHORITY',
    ruleSetId: resolved.ruleSet?.id,
    ruleSetContentSha256: resolved.contentSha256,
    ruleSetBasis: resolved.basis,
    evaluationDate: params.evaluationDate,
    outcome,
    results: [{
      ruleId: authority.ruleIds.join(',') || 'NONE',
      ruleCode: `PROVIDER_AUTHORITY.${params.stage}`,
      outcome,
      reasons: authority.reasons,
      verificationStatus: 'UNVERIFIED',
      evaluationDate: params.evaluationDate
    }],
    inputs: {
      stage: params.stage,
      providerOrganizationId: params.org.id,
      licenses: params.licenses.map(l => l.id).sort(),
      carrierRelationships: params.carrierRelationships.map(r => r.id).sort()
    },
    legacyOutcome,
    discrepancy,
    discrepancyNotes: discrepancy ? `Frozen eligibility: ${legacyOutcome}; jurisdiction authority: ${authority.outcome}.` : undefined
  });
}

/** Runs a shadow evaluation without ever letting it affect the caller's response. */
export async function inShadow<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err: any) {
    console.warn(`[JurisdictionShadow ${label}]`, err?.message || err);
    return undefined;
  }
}
