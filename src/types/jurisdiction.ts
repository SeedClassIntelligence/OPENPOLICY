/**
 * PR-0A — Canonical Jurisdiction Types
 *
 * Governing rulings (docs/PR-0A-RECONCILIATION-REPORT.md §M):
 * - D3: effectiveFrom inclusive, effectiveUntil exclusive or null; calendar dates.
 * - D4: PR-0A evaluates in SHADOW mode only; nothing here changes a marketplace outcome.
 * - D5: SANDBOX activation can never authorize a PRODUCTION transaction.
 * - D7: readiness is derived; operational activation is event-sourced.
 * - D9: every suspension carries an explicit SuspensionAction.
 * - D10: each rule declares the temporal fact it is evaluated against.
 *
 * Nothing in this vocabulary carries a score, rank, order, priority or weight.
 */

/** USPS codes for the 50 states and the District of Columbia. */
export type UsJurisdictionCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY';

export type JurisdictionKind = 'STATE' | 'FEDERAL_DISTRICT' | 'TEST_FIXTURE';

export interface Jurisdiction {
  code: string;
  name: string;
  kind: JurisdictionKind;
}

export type InsuranceLine = 'PERSONAL_AUTO';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export type RegulatoryAuthorityKind =
  | 'LEGISLATURE'
  | 'INSURANCE_REGULATOR'
  | 'MOTOR_VEHICLE_AGENCY'
  | 'PRODUCER_LICENSING_AUTHORITY'
  | 'OPEN_POLICY';

export interface RegulatoryAuthority {
  id: string;
  jurisdictionCode: string;
  name: string;
  kind: RegulatoryAuthorityKind;
  officialUrl?: string;
}

export type RegulatorySourceType =
  | 'STATUTE'
  | 'ADMINISTRATIVE_REGULATION'
  | 'DEPARTMENT_BULLETIN'
  | 'DEPARTMENT_ORDER'
  | 'REQUIRED_FORM'
  | 'REGULATOR_GUIDANCE'
  | 'LICENSING_AUTHORITY_RECORD'
  | 'OPEN_POLICY_INTERNAL_POLICY';

export interface RegulatorySource {
  id: string;
  jurisdictionCode: string;
  authorityId: string;
  sourceType: RegulatorySourceType;
  citation: string;
  title: string;
  officialUrl?: string;
  retrievedAt?: string;
  contentSha256?: string;
  archivedCopyRef?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Rulesets and rules
// ---------------------------------------------------------------------------

/** DISCARDED: unpublished work abandoned; its rules are removed, its history is kept. */
export type RuleSetStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'SUPERSEDED' | 'WITHDRAWN' | 'DISCARDED';

export interface JurisdictionRuleSet {
  id: string;
  jurisdictionCode: string;
  insuranceLine: InsuranceLine;
  version: number;
  status: RuleSetStatus;
  supersedesRuleSetId?: string;
  authoredBy: string;
  publishedBy?: string;
  publishedAt?: string;
  contentSha256?: string;
  createdAt: string;
}

export type RuleCategory =
  | 'MINIMUM_LIABILITY' | 'UM_UIM' | 'PIP_NO_FAULT' | 'MEDPAY' | 'MANDATORY_OFFER'
  | 'CONSUMER_ELECTION' | 'REQUIRED_FORM' | 'PRODUCER_LICENSING' | 'PRODUCER_APPOINTMENT'
  | 'CARRIER_AUTHORITY' | 'BROKER_AGENT_CLASSIFICATION' | 'CONSUMER_FEE_DISCLOSURE'
  | 'REBATING_INDUCEMENT' | 'QUOTE_REQUIREMENT' | 'APPLICATION_REQUIREMENT'
  | 'BINDING_REQUIREMENT' | 'ELECTRONIC_SIGNATURE' | 'ELECTRONIC_RECORDS' | 'PRIVACY'
  | 'RECORD_RETENTION' | 'PROOF_OF_INSURANCE' | 'CANCELLATION_NONRENEWAL' | 'REQUIRED_NOTICE';

export type EnforcementPoint =
  | 'CHALLENGE_OPEN'
  | 'PROVIDER_AUTHORITY'
  | 'OFFER_QUALIFICATION'
  | 'PRE_SELECTION_DISCLOSURE'
  | 'CONSENT'
  | 'BINDING'
  | 'ISSUED_POLICY'
  | 'RETENTION';

export type VerificationStatus = 'UNVERIFIED' | 'SOURCE_LINKED' | 'LEGAL_REVIEWED' | 'VERIFIED' | 'REJECTED';

/** D10: the legally significant date a rule is evaluated against. Extensible. */
export type TemporalBasis =
  | 'policyEffectiveDate'
  | 'transactionDate'
  | 'invitationDate'
  | 'offerSubmittedDate'
  | 'selectionDate'
  | 'disclosureDate'
  | 'bindingDate'
  | 'issuedPolicyDate';

/**
 * Closed set of deterministic predicates. There is no expression language and no
 * scripting: every variant has one evaluator and its own fixtures.
 */
export type MachineRule =
  | { kind: 'MINIMUM_LIMITS'; coverageCode: string; perPerson?: number; perAccident?: number; property?: number; combinedSingleLimit?: number }
  | { kind: 'REQUIRED_COVERAGE'; coverageCode: string }
  | { kind: 'MANDATORY_OFFER'; coverageCode: string; rejectionPermitted: boolean; rejectionEvidence?: 'SIGNED_WRITTEN' | 'PRESCRIBED_FORM'; formSourceId?: string }
  | { kind: 'REQUIRED_NOTICE'; noticeCode: string; formSourceId?: string }
  | { kind: 'PRODUCER_AUTHORITY'; acceptedLicenseClasses: string[]; entityLicenseRequired: boolean; individualLicenseRequired: boolean; appointmentRequired: boolean }
  | { kind: 'CARRIER_AUTHORITY'; certificateOfAuthorityRequired: boolean }
  | { kind: 'ELECTRONIC_CONSENT'; electronicSignaturePermitted: boolean; priorEDeliveryConsentRequired: boolean }
  | { kind: 'RECORD_RETENTION'; recordClass: string; minimumYears: number };

export interface JurisdictionRule {
  id: string;
  ruleSetId: string;
  /** Stable across versions, e.g. 'AUTO.LIABILITY.BI.MINIMUM'. */
  ruleCode: string;
  ruleCategory: RuleCategory;
  enforcementPoint: EnforcementPoint;
  temporalBasis: TemporalBasis;
  requirementText: string;
  sourceIds: string[];
  /** Calendar date, inclusive. */
  effectiveFrom: string;
  /** Calendar date, exclusive; undefined = open-ended. */
  effectiveUntil?: string;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  supersedesRuleId?: string;
  /** null = informational only; never auto-enforced. */
  machineRule: MachineRule | null;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type RuleOutcome = 'PASS' | 'FAIL' | 'BLOCK' | 'NOT_AUTHORIZED' | 'NOT_APPLICABLE' | 'INDETERMINATE';

/** D10: temporal facts plus the domain facts a rule may consume. Unknown stays unknown. */
export interface RuleEvaluationContext {
  dates: Partial<Record<TemporalBasis, string>>;
  coverages?: Array<{
    code: string;
    isIncluded: boolean;
    perPersonLimit?: number;
    perAccidentLimit?: number;
    propertyLimit?: number;
    combinedSingleLimit?: number;
  }>;
  /** Coverage codes the consumer has validly rejected, with the evidence held. */
  coverageRejections?: Array<{ coverageCode: string; evidence?: 'SIGNED_WRITTEN' | 'PRESCRIBED_FORM' }>;
  deliveredNoticeCodes?: string[];
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleCode: string;
  outcome: RuleOutcome;
  reasons: string[];
  verificationStatus: VerificationStatus;
  evaluationDate?: string;
}

/** Which ruleset an evaluation used. Enforcement (PR-0C) will accept only PUBLISHED. */
export type RuleSetBasis = 'PUBLISHED' | 'UNPUBLISHED_CANDIDATE' | 'NONE';

export type EvaluationSubjectType =
  | 'CHALLENGE'
  | 'OFFER'
  | 'OFFER_VERSION'
  | 'PROVIDER'
  | 'INVITATION'
  | 'BINDING_HANDOFF'
  | 'ISSUED_POLICY';

/** Append-only anchoring record. */
export interface JurisdictionRuleEvaluation {
  id: string;
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
  inputsSha256: string;
  mode: 'SHADOW' | 'ENFORCE';
  /** D4: frozen-behavior result this shadow evaluation is compared against. */
  legacyOutcome?: string;
  discrepancy: boolean;
  discrepancyNotes?: string;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Provider authority (derived, never stored as truth)
// ---------------------------------------------------------------------------

export type ProviderAuthorityOutcome = 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'INDETERMINATE';

export interface ProviderAuthorityResult {
  providerOrganizationId: string;
  jurisdictionCode?: string;
  outcome: ProviderAuthorityOutcome;
  reasons: string[];
  ruleIds: string[];
}

// ---------------------------------------------------------------------------
// Jurisdiction determination
// ---------------------------------------------------------------------------

export type JurisdictionSignalType = 'POLICY_STATED_STATE' | 'GARAGING_ADDRESS_STATE' | 'CONSUMER_ATTESTATION';

export interface JurisdictionSignal {
  signal: JurisdictionSignalType;
  value: string;
  evidenceRef?: string;
}

export type JurisdictionDeterminationStatus = 'PROPOSED' | 'CONSUMER_CONFIRMED' | 'CONFLICT' | 'UNRESOLVED';

export interface JurisdictionDetermination {
  id: string;
  policyId?: string;
  challengeId?: string;
  basis: JurisdictionSignal[];
  status: JurisdictionDeterminationStatus;
  proposedJurisdiction?: string;
  confirmedJurisdiction?: string;
  consumerConfirmedAt?: string;
  reasons: string[];
  determinedAt: string;
}

// ---------------------------------------------------------------------------
// Market activation (D5, D7, D9)
// ---------------------------------------------------------------------------

export type MarketEnvironment = 'SANDBOX' | 'PRODUCTION';

/** D7 axis 1: derived from rulesets, never stored. */
export type RegulatoryReadiness = 'NOT_CONFIGURED' | 'RESEARCHING' | 'RULES_IN_REVIEW' | 'RULES_VERIFIED';

/** D7 axis 2: event-sourced. */
export type OperationalActivationState = 'INACTIVE' | 'PILOT' | 'ACTIVE' | 'SUSPENDED';

/** D9: explicit in-flight disposition carried by every suspension. */
export type SuspensionAction =
  | 'FREEZE_ALL_PROGRESS'
  | 'ALLOW_SELECTION_ONLY'
  | 'ALLOW_EXISTING_TO_COMPLETE'
  | 'REQUIRE_MANUAL_REVIEW';

export type ActivationGateCode =
  | 'PROVIDER_AUTHORITY_READY'
  | 'LEGAL_REVIEW_COMPLETE'
  | 'DOCUMENT_REQUIREMENTS_READY'
  | 'SECURITY_READY'
  | 'OPERATIONAL_RUNBOOK_READY'
  | 'MARKET_APPROVED';

export interface MarketActivationEvent {
  id: string;
  jurisdictionCode: string;
  insuranceLine: InsuranceLine;
  environment: MarketEnvironment;
  fromState: OperationalActivationState;
  toState: OperationalActivationState;
  suspensionAction?: SuspensionAction;
  ruleSetId?: string;
  actorId: string;
  reason: string;
  recordedAt: string;
}

export interface GateAttestation {
  id: string;
  jurisdictionCode: string;
  insuranceLine: InsuranceLine;
  environment: MarketEnvironment;
  gateCode: ActivationGateCode;
  evidenceRef: string;
  attestedBy: string;
  attestedAt: string;
  revokedAt?: string;
  revokedBy?: string;
}

/** D9: transitions that may be requested against a market. */
export type MarketTransition =
  | 'VIEW'
  | 'AUDIT_EXPORT'
  | 'NEW_CHALLENGE'
  | 'NEW_INVITATION'
  | 'NEW_PROVIDER_ENTRY'
  | 'NEW_BINDING'
  | 'SELECTION'
  | 'DISCLOSURE';

export type MarketTransitionDisposition = 'ALLOWED' | 'BLOCKED' | 'HOLD';

export interface MarketTransitionDecision {
  transition: MarketTransition;
  disposition: MarketTransitionDisposition;
  reasons: string[];
}

/** Human-facing projection of both axes plus gates. Never stored. */
export type MarketDisplayStatus =
  | 'NOT_CONFIGURED'
  | 'RESEARCHING'
  | 'RULES_IN_REVIEW'
  | 'RULES_VERIFIED'
  | 'PROVIDERS_REQUIRED'
  | 'PILOT'
  | 'ACTIVE'
  | 'SUSPENDED';
