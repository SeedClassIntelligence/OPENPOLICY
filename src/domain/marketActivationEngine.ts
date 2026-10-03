/**
 * PR-0A — Market Activation Engine (pure)
 *
 * D7: two axes.
 *   - Regulatory readiness is DERIVED from rulesets and rules; it is never stored, so no
 *     field can claim RULES_VERIFIED while the underlying rules are unverified.
 *   - Operational activation is EVENT-SOURCED; the current state is a replay of events.
 * D5: activation is keyed by (jurisdiction, line, environment). A SANDBOX activation can
 *     never authorize a PRODUCTION transaction; there is no fallback between environments.
 * D9: every suspension carries a SuspensionAction (default REQUIRE_MANUAL_REVIEW), which
 *     decides in-flight selection and disclosure. NEW_* transitions are always blocked.
 */
import {
  ActivationGateCode,
  GateAttestation,
  InsuranceLine,
  JurisdictionKind,
  JurisdictionRule,
  JurisdictionRuleSet,
  MarketActivationEvent,
  MarketDisplayStatus,
  MarketEnvironment,
  MarketTransition,
  MarketTransitionDecision,
  OperationalActivationState,
  RegulatoryReadiness,
  SuspensionAction
} from '../types/jurisdiction';

export const REQUIRED_PRODUCTION_GATES: ReadonlyArray<ActivationGateCode> = [
  'PROVIDER_AUTHORITY_READY',
  'LEGAL_REVIEW_COMPLETE',
  'DOCUMENT_REQUIREMENTS_READY',
  'SECURITY_READY',
  'OPERATIONAL_RUNBOOK_READY',
  'MARKET_APPROVED'
];

export const DEFAULT_SUSPENSION_ACTION: SuspensionAction = 'REQUIRE_MANUAL_REVIEW';

const ALLOWED_TRANSITIONS: Record<OperationalActivationState, OperationalActivationState[]> = {
  INACTIVE: ['PILOT', 'ACTIVE'],
  PILOT: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
  ACTIVE: ['SUSPENDED', 'INACTIVE'],
  SUSPENDED: ['PILOT', 'ACTIVE', 'INACTIVE']
};

export interface MarketKey {
  jurisdictionCode: string;
  insuranceLine: InsuranceLine;
  environment: MarketEnvironment;
}

function matchesKey(e: MarketKey, key: MarketKey): boolean {
  return e.jurisdictionCode === key.jurisdictionCode && e.insuranceLine === key.insuranceLine && e.environment === key.environment;
}

/** Replays only the events for this exact key. Other environments are never consulted (D5). */
export function replayActivation(
  events: MarketActivationEvent[],
  key: MarketKey
): { state: OperationalActivationState; suspensionAction?: SuspensionAction; lastEvent?: MarketActivationEvent } {
  const own = events
    .filter(e => matchesKey(e, key))
    .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : a.id.localeCompare(b.id)));
  const last = own[own.length - 1];
  if (!last) return { state: 'INACTIVE' };
  return { state: last.toState, suspensionAction: last.toState === 'SUSPENDED' ? last.suspensionAction : undefined, lastEvent: last };
}

/**
 * Ruling §N.3: the first PRODUCTION activation must pass through PILOT. Completion is derived
 * from immutable history (a PRODUCTION PILOT -> ACTIVE event), never stored as a mutable flag.
 * Returns the completing event, whose id serves as the pilot approval reference.
 */
export function productionPilotCompletion(events: MarketActivationEvent[], key: MarketKey): MarketActivationEvent | undefined {
  if (key.environment !== 'PRODUCTION') return undefined;
  return events
    .filter(e => matchesKey(e, key) && e.fromState === 'PILOT' && e.toState === 'ACTIVE')
    .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0))[0];
}

/** Axis 1: derived readiness. A PUBLISHED ruleset counts as verified only if every executable rule is VERIFIED. */
export function deriveReadiness(
  ruleSets: JurisdictionRuleSet[],
  rulesByRuleSet: Map<string, JurisdictionRule[]>,
  jurisdictionCode: string,
  insuranceLine: InsuranceLine
): { readiness: RegulatoryReadiness; publishedRuleSet?: JurisdictionRuleSet } {
  const own = ruleSets.filter(r => r.jurisdictionCode === jurisdictionCode && r.insuranceLine === insuranceLine);
  if (own.length === 0) return { readiness: 'NOT_CONFIGURED' };

  const published = own.filter(r => r.status === 'PUBLISHED').sort((a, b) => b.version - a.version)[0];
  if (published) {
    const rules = rulesByRuleSet.get(published.id) || [];
    const executable = rules.filter(r => r.machineRule !== null);
    const allVerified = executable.length > 0 && executable.every(r => r.verificationStatus === 'VERIFIED');
    return { readiness: allVerified ? 'RULES_VERIFIED' : 'RULES_IN_REVIEW', publishedRuleSet: published };
  }
  if (own.some(r => r.status === 'IN_REVIEW')) return { readiness: 'RULES_IN_REVIEW' };
  return { readiness: 'RESEARCHING' };
}

export function activeGates(attestations: GateAttestation[], key: MarketKey): Set<ActivationGateCode> {
  return new Set(attestations.filter(a => matchesKey(a, key) && !a.revokedAt).map(a => a.gateCode));
}

export function validateActivationTransition(params: {
  key: MarketKey;
  jurisdictionKind: JurisdictionKind;
  from: OperationalActivationState;
  to: OperationalActivationState;
  readiness: RegulatoryReadiness;
  gates: Set<ActivationGateCode>;
  actorId: string;
  reason: string;
  suspensionAction?: SuspensionAction;
  /** Id of the event that completed this market's PRODUCTION pilot, if any. */
  productionPilotCompletedEventId?: string;
}): { allowed: boolean; errors: string[]; suspensionAction?: SuspensionAction } {
  const { key, jurisdictionKind, from, to, readiness, gates, actorId, reason } = params;
  const errors: string[] = [];

  if (!ALLOWED_TRANSITIONS[from].includes(to)) errors.push(`Transition ${from} -> ${to} is not permitted.`);
  if (!actorId) errors.push('An attributable actor is required.');
  if (!reason || !reason.trim()) errors.push('A reason is required.');

  if (key.environment === 'PRODUCTION' && (to === 'PILOT' || to === 'ACTIVE')) {
    if (jurisdictionKind === 'TEST_FIXTURE') errors.push('A test-fixture jurisdiction can never be activated in PRODUCTION.');
    if (readiness !== 'RULES_VERIFIED') errors.push(`PRODUCTION activation requires readiness RULES_VERIFIED (current: ${readiness}).`);
    const missing = REQUIRED_PRODUCTION_GATES.filter(g => !gates.has(g));
    if (missing.length > 0) errors.push(`PRODUCTION activation requires attested gates; missing: ${missing.join(', ')}.`);
    // A SANDBOX pilot never satisfies this: only PRODUCTION history is consulted.
    if (to === 'ACTIVE' && from !== 'PILOT' && !params.productionPilotCompletedEventId) {
      errors.push('The first PRODUCTION activation must pass through PILOT; no completed PRODUCTION pilot is on record.');
    }
  }

  let suspensionAction: SuspensionAction | undefined;
  if (to === 'SUSPENDED') suspensionAction = params.suspensionAction || DEFAULT_SUSPENSION_ACTION;
  else if (params.suspensionAction) errors.push('A SuspensionAction applies only to a transition into SUSPENDED.');

  return { allowed: errors.length === 0, errors, suspensionAction };
}

/** D9 disposition table. PILOT cohort restrictions arrive with PR-4. */
export function decideMarketTransition(
  state: OperationalActivationState,
  suspensionAction: SuspensionAction | undefined,
  transition: MarketTransition
): MarketTransitionDecision {
  if (transition === 'VIEW' || transition === 'AUDIT_EXPORT') {
    return { transition, disposition: 'ALLOWED', reasons: ['Viewing and audit export are always allowed.'] };
  }
  if (state === 'PILOT' || state === 'ACTIVE') {
    return { transition, disposition: 'ALLOWED', reasons: [`Market is ${state}.`] };
  }
  if (state === 'INACTIVE') {
    return { transition, disposition: 'BLOCKED', reasons: ['Market is not activated.'] };
  }

  // SUSPENDED
  if (transition === 'NEW_CHALLENGE' || transition === 'NEW_INVITATION' || transition === 'NEW_PROVIDER_ENTRY' || transition === 'NEW_BINDING') {
    return { transition, disposition: 'BLOCKED', reasons: [`${transition} is blocked while the market is SUSPENDED.`] };
  }
  const action = suspensionAction || DEFAULT_SUSPENSION_ACTION;
  const allowed =
    (action === 'ALLOW_SELECTION_ONLY' && transition === 'SELECTION') ||
    (action === 'ALLOW_EXISTING_TO_COMPLETE' && (transition === 'SELECTION' || transition === 'DISCLOSURE'));
  return allowed
    ? { transition, disposition: 'ALLOWED', reasons: [`Suspension action ${action} permits ${transition} for in-flight transactions.`] }
    : { transition, disposition: 'HOLD', reasons: [`Suspension action ${action} holds ${transition} pending review.`] };
}

/** Human-facing projection of both axes plus gates. Never stored. */
export function displayStatus(
  readiness: RegulatoryReadiness,
  state: OperationalActivationState,
  gates: Set<ActivationGateCode>
): MarketDisplayStatus {
  if (state === 'SUSPENDED') return 'SUSPENDED';
  if (state === 'ACTIVE') return 'ACTIVE';
  if (state === 'PILOT') return 'PILOT';
  if (readiness === 'RULES_VERIFIED' && !gates.has('PROVIDER_AUTHORITY_READY')) return 'PROVIDERS_REQUIRED';
  return readiness;
}
