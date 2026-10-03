/**
 * PR-0A — Jurisdiction framework domain suite (pure engines)
 *
 * Every behavioral fixture uses the fictional jurisdictions X1 and X2, so these tests
 * prove the machinery without encoding any real law.
 */
import { CarrierRelationship, ProviderLicense, ProviderOrganization } from '../types/insurance';
import { GateAttestation, JurisdictionRule, JurisdictionRuleSet, MarketActivationEvent, MachineRule } from '../types/jurisdiction';
import { US_JURISDICTIONS } from './jurisdiction/usJurisdictions';
import { aggregateOutcome, evaluateRules, isRuleInForce } from './jurisdictionRuleEngine';
import { evaluateProviderJurisdictionAuthority } from './providerAuthorityEngine';
import { determineJurisdiction } from './jurisdictionDetermination';
import {
  REQUIRED_PRODUCTION_GATES,
  activeGates,
  decideMarketTransition,
  deriveReadiness,
  displayStatus,
  productionPilotCompletion,
  replayActivation,
  validateActivationTransition
} from './marketActivationEngine';
import {
  canDiscard,
  computeRuleSetContentHash,
  publishRuleSet,
  validatePublication,
  validateWithdrawal,
  verifyAnchoredContent
} from './rulesetGovernance';

export interface JurisdictionTestResult {
  name: string;
  category: string;
  passed: boolean;
  details?: string;
}

const FORBIDDEN_RESULT_KEYS = ['score', 'rank', 'order', 'priority', 'weight', 'ranking', 'preferred'];

function hasForbiddenKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKeys);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => FORBIDDEN_RESULT_KEYS.some(f => k.toLowerCase().includes(f)) || hasForbiddenKeys(v)
    );
  }
  return false;
}

export function rule(overrides: Partial<JurisdictionRule> & { id: string; machineRule: MachineRule | null }): JurisdictionRule {
  return {
    ruleSetId: 'RS-X1-1',
    ruleCode: overrides.id,
    ruleCategory: 'MINIMUM_LIABILITY',
    enforcementPoint: 'OFFER_QUALIFICATION',
    temporalBasis: 'policyEffectiveDate',
    requirementText: 'Test fixture requirement (fictional jurisdiction).',
    sourceIds: ['SRC-X1'],
    effectiveFrom: '2026-01-01',
    verificationStatus: 'VERIFIED',
    verifiedBy: 'verifier_b',
    verifiedAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

export function runJurisdictionTestSuite(): { total: number; passed: number; failed: number; results: JurisdictionTestResult[] } {
  const results: JurisdictionTestResult[] = [];
  const test = (name: string, category: string, assertion: boolean, details?: string) =>
    results.push({ name, category, passed: assertion, details });

  // ------------------------------------------------------------------
  // Reference data
  // ------------------------------------------------------------------
  const codes = US_JURISDICTIONS.map(j => j.code);
  test('REF-1: exactly 51 jurisdictions (50 states + DC)', 'Reference', codes.length === 51 && new Set(codes).size === 51);
  test('REF-2: DC is present as FEDERAL_DISTRICT', 'Reference', US_JURISDICTIONS.some(j => j.code === 'DC' && j.kind === 'FEDERAL_DISTRICT'));
  test('REF-3: no territories (PR, GU, VI, AS, MP)', 'Reference', !['PR', 'GU', 'VI', 'AS', 'MP'].some(c => (codes as string[]).includes(c)));

  // ------------------------------------------------------------------
  // Effective dating (D3, D10)
  // ------------------------------------------------------------------
  const windowed = rule({ id: 'W', machineRule: null, effectiveFrom: '2026-01-01', effectiveUntil: '2027-01-01' });
  test('DATE-1: effectiveFrom is inclusive', 'Effective dating', isRuleInForce(windowed, '2026-01-01'));
  test('DATE-2: effectiveUntil is exclusive', 'Effective dating', !isRuleInForce(windowed, '2027-01-01') && isRuleInForce(windowed, '2026-12-31'));
  test('DATE-3: open-ended rule applies indefinitely', 'Effective dating', isRuleInForce(rule({ id: 'O', machineRule: null }), '2099-06-01'));
  test('DATE-4: a timestamp is not a calendar date (no intraday inference)', 'Effective dating', !isRuleInForce(windowed, '2026-06-01T12:00:00Z'));

  const v1 = rule({ id: 'MIN-v1', ruleCode: 'X1.BI.MIN', effectiveUntil: '2027-01-01', machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'BODILY_INJURY', perPerson: 25000, perAccident: 50000 } });
  const v2 = rule({ id: 'MIN-v2', ruleCode: 'X1.BI.MIN', effectiveFrom: '2027-01-01', supersedesRuleId: 'MIN-v1', machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'BODILY_INJURY', perPerson: 50000, perAccident: 100000 } });
  const offerCoverages = [{ code: 'BODILY_INJURY', isIncluded: true, perPersonLimit: 30000, perAccidentLimit: 60000 }];
  const before = evaluateRules([v1, v2], 'OFFER_QUALIFICATION', { dates: { policyEffectiveDate: '2026-12-31' }, coverages: offerCoverages });
  const after = evaluateRules([v1, v2], 'OFFER_QUALIFICATION', { dates: { policyEffectiveDate: '2027-01-01' }, coverages: offerCoverages });
  test('DATE-5: the version in force on the policy effective date governs (PASS under v1)', 'Effective dating', before.outcome === 'PASS' && before.results[0].ruleId === 'MIN-v1');
  test('DATE-6: the same offer fails once v2 is in force', 'Effective dating', after.outcome === 'FAIL' && after.results[0].ruleId === 'MIN-v2');
  const noDate = evaluateRules([v1, v2], 'OFFER_QUALIFICATION', { dates: {}, coverages: offerCoverages });
  test('DATE-7: unknown required date is INDETERMINATE, never the server clock', 'Effective dating', noDate.outcome === 'INDETERMINATE');
  const overlapping = evaluateRules([v1, rule({ ...v2, effectiveFrom: '2026-06-01' })], 'OFFER_QUALIFICATION', { dates: { policyEffectiveDate: '2026-07-01' }, coverages: offerCoverages });
  test('DATE-8: overlapping in-force versions are INDETERMINATE', 'Effective dating', overlapping.outcome === 'INDETERMINATE');
  const transactionBased = rule({ id: 'T', temporalBasis: 'transactionDate', machineRule: { kind: 'REQUIRED_COVERAGE', coverageCode: 'BODILY_INJURY' } });
  test(
    'DATE-9: each rule reads its own temporal basis (transactionDate unknown -> INDETERMINATE)',
    'Effective dating',
    evaluateRules([transactionBased], 'OFFER_QUALIFICATION', { dates: { policyEffectiveDate: '2026-07-01' }, coverages: offerCoverages }).outcome === 'INDETERMINATE'
  );

  // ------------------------------------------------------------------
  // Rule execution (fictional X1)
  // ------------------------------------------------------------------
  const ctx = (coverages: any, extra: object = {}) => ({ dates: { policyEffectiveDate: '2026-07-01' }, coverages, ...extra });
  const minBI = rule({ id: 'BI', machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'BODILY_INJURY', perPerson: 25000, perAccident: 50000 } });
  test('EXEC-1: policy below mandatory liability -> FAIL', 'Rule execution',
    evaluateRules([minBI], 'OFFER_QUALIFICATION', ctx([{ code: 'BODILY_INJURY', isIncluded: true, perPersonLimit: 10000, perAccidentLimit: 20000 }])).outcome === 'FAIL');
  test('EXEC-2: policy meeting minimums -> PASS', 'Rule execution',
    evaluateRules([minBI], 'OFFER_QUALIFICATION', ctx([{ code: 'BODILY_INJURY', isIncluded: true, perPersonLimit: 25000, perAccidentLimit: 50000 }])).outcome === 'PASS');
  test('EXEC-3: unknown limit -> INDETERMINATE (never PASS)', 'Rule execution',
    evaluateRules([minBI], 'OFFER_QUALIFICATION', ctx([{ code: 'BODILY_INJURY', isIncluded: true, perPersonLimit: 25000 }])).outcome === 'INDETERMINATE');
  test('EXEC-4: unknown coverage facts -> INDETERMINATE', 'Rule execution',
    evaluateRules([minBI], 'OFFER_QUALIFICATION', { dates: { policyEffectiveDate: '2026-07-01' } }).outcome === 'INDETERMINATE');

  const offerUM = (rejectionEvidence?: 'SIGNED_WRITTEN' | 'PRESCRIBED_FORM', rejectionPermitted = true) =>
    rule({ id: 'UM', ruleCategory: 'MANDATORY_OFFER', machineRule: { kind: 'MANDATORY_OFFER', coverageCode: 'UM_UIM', rejectionPermitted, rejectionEvidence } });
  const noUM = [{ code: 'BODILY_INJURY', isIncluded: true }];
  test('EXEC-5: mandatory coverage offer absent, no rejection -> BLOCK', 'Rule execution',
    evaluateRules([offerUM('PRESCRIBED_FORM')], 'OFFER_QUALIFICATION', ctx(noUM, { coverageRejections: [] })).outcome === 'BLOCK');
  test('EXEC-6: rejection requires evidence but none exists -> BLOCK', 'Rule execution',
    evaluateRules([offerUM('PRESCRIBED_FORM')], 'OFFER_QUALIFICATION', ctx(noUM, { coverageRejections: [{ coverageCode: 'UM_UIM' }] })).outcome === 'BLOCK');
  test('EXEC-7: wrong kind of evidence -> BLOCK (no evidence equivalence assumed)', 'Rule execution',
    evaluateRules([offerUM('PRESCRIBED_FORM')], 'OFFER_QUALIFICATION', ctx(noUM, { coverageRejections: [{ coverageCode: 'UM_UIM', evidence: 'SIGNED_WRITTEN' }] })).outcome === 'BLOCK');
  test('EXEC-8: evidenced rejection -> PASS', 'Rule execution',
    evaluateRules([offerUM('PRESCRIBED_FORM')], 'OFFER_QUALIFICATION', ctx(noUM, { coverageRejections: [{ coverageCode: 'UM_UIM', evidence: 'PRESCRIBED_FORM' }] })).outcome === 'PASS');
  test('EXEC-9: non-rejectable mandatory coverage absent -> FAIL', 'Rule execution',
    evaluateRules([offerUM(undefined, false)], 'OFFER_QUALIFICATION', ctx(noUM, { coverageRejections: [] })).outcome === 'FAIL');
  test('EXEC-10: rejection status unknown -> INDETERMINATE', 'Rule execution',
    evaluateRules([offerUM('PRESCRIBED_FORM')], 'OFFER_QUALIFICATION', ctx(noUM)).outcome === 'INDETERMINATE');
  const pip = rule({ id: 'PIP', ruleCategory: 'PIP_NO_FAULT', machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'PIP', perPerson: 10000 } });
  test('EXEC-11: a coverage the taxonomy cannot express (PIP) -> INDETERMINATE (D8)', 'Rule execution',
    evaluateRules([pip], 'OFFER_QUALIFICATION', ctx(noUM)).outcome === 'INDETERMINATE');
  const info = rule({ id: 'INFO', machineRule: null });
  const infoEval = evaluateRules([info], 'OFFER_QUALIFICATION', ctx(noUM));
  test('EXEC-12: an informational rule is never auto-enforced', 'Rule execution', infoEval.outcome === 'NOT_APPLICABLE');
  const notice = rule({ id: 'N', enforcementPoint: 'CONSENT', temporalBasis: 'transactionDate', machineRule: { kind: 'REQUIRED_NOTICE', noticeCode: 'X1-NOTICE-A' } });
  test('EXEC-13: required notice not delivered -> BLOCK; delivered -> PASS', 'Rule execution',
    evaluateRules([notice], 'CONSENT', { dates: { transactionDate: '2026-07-01' }, deliveredNoticeCodes: [] }).outcome === 'BLOCK' &&
    evaluateRules([notice], 'CONSENT', { dates: { transactionDate: '2026-07-01' }, deliveredNoticeCodes: ['X1-NOTICE-A'] }).outcome === 'PASS');
  test('EXEC-14: rules at other enforcement points are not evaluated', 'Rule execution',
    evaluateRules([notice], 'OFFER_QUALIFICATION', ctx(noUM)).results.length === 0);
  test('EXEC-15: outcome precedence FAIL > BLOCK > NOT_AUTHORIZED > INDETERMINATE > PASS', 'Rule execution',
    aggregateOutcome([{ outcome: 'PASS' }, { outcome: 'INDETERMINATE' }]) === 'INDETERMINATE' &&
    aggregateOutcome([{ outcome: 'BLOCK' }, { outcome: 'FAIL' }]) === 'FAIL' &&
    aggregateOutcome([{ outcome: 'PASS' }, { outcome: 'NOT_AUTHORIZED' }, { outcome: 'INDETERMINATE' }]) === 'NOT_AUTHORIZED');

  // ------------------------------------------------------------------
  // Provider authority
  // ------------------------------------------------------------------
  const org: ProviderOrganization = {
    id: 'org_x', legalName: 'X Agency', displayName: 'X Agency', organizationType: 'INDEPENDENT_AGENCY',
    verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'ACTIVE', states: ['X1'], linesOfBusiness: ['PERSONAL_AUTO'],
    createdAt: '2026-01-01T00:00:00Z'
  };
  const lic = (overrides: Partial<ProviderLicense>): ProviderLicense => ({
    id: 'lic', providerOrganizationId: 'org_x', jurisdiction: 'X1', licenseType: 'PROPERTY_CASUALTY', licenseNumber: 'X1-001',
    status: 'ACTIVE', effectiveDate: '2025-01-01', expirationDate: '2028-01-01', verificationStatus: 'VERIFIED', ...overrides
  });
  const rel = (overrides: Partial<CarrierRelationship>): CarrierRelationship => ({
    id: 'rel', providerOrganizationId: 'org_x', carrierId: 'c1', carrierName: 'Test Mutual', jurisdiction: 'X1',
    lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE', ...overrides
  });
  const producerRule = (appointmentRequired = false) => rule({
    id: 'PA', ruleCategory: 'PRODUCER_LICENSING', enforcementPoint: 'PROVIDER_AUTHORITY', temporalBasis: 'transactionDate',
    machineRule: { kind: 'PRODUCER_AUTHORITY', acceptedLicenseClasses: ['PROPERTY_CASUALTY'], entityLicenseRequired: true, individualLicenseRequired: false, appointmentRequired }
  });
  const authority = (licenses: ProviderLicense[], opts: { rules?: JurisdictionRule[]; rels?: CarrierRelationship[]; carrier?: string; date?: string; jurisdiction?: string } = {}) =>
    evaluateProviderJurisdictionAuthority({
      org, licenses, carrierRelationships: opts.rels || [], rules: opts.rules || [producerRule()],
      jurisdictionCode: 'jurisdiction' in opts ? opts.jurisdiction : 'X1', insuranceLine: 'PERSONAL_AUTO',
      carrier: opts.carrier, evaluationDate: 'date' in opts ? opts.date : '2026-07-01'
    });

  test('AUTH-1: valid entity license of an accepted class -> AUTHORIZED', 'Provider authority', authority([lic({})]).outcome === 'AUTHORIZED');
  test('AUTH-2: license only in another jurisdiction (X2) -> NOT_AUTHORIZED', 'Provider authority', authority([lic({ jurisdiction: 'X2' })]).outcome === 'NOT_AUTHORIZED');
  test('AUTH-3: wrong license class -> NOT_AUTHORIZED', 'Provider authority', authority([lic({ licenseType: 'LIFE_HEALTH' })]).outcome === 'NOT_AUTHORIZED');
  test('AUTH-4: license expired on the evaluation date (not the wall clock) -> NOT_AUTHORIZED', 'Provider authority',
    authority([lic({ expirationDate: '2026-06-30' })]).outcome === 'NOT_AUTHORIZED' && authority([lic({ expirationDate: '2026-06-30' })], { date: '2026-06-29' }).outcome === 'AUTHORIZED');
  test('AUTH-5: license expiring on the evaluation date -> INDETERMINATE (semantics unverified)', 'Provider authority',
    authority([lic({ expirationDate: '2026-07-01' })]).outcome === 'INDETERMINATE');
  test('AUTH-6: self-declared org.states grants nothing without a license', 'Provider authority', authority([]).outcome === 'NOT_AUTHORIZED');
  test('AUTH-7: no producer-authority rule in force -> INDETERMINATE even with a valid license', 'Provider authority',
    authority([lic({})], { rules: [] }).outcome === 'INDETERMINATE');
  test('AUTH-8: unknown jurisdiction or date -> INDETERMINATE', 'Provider authority',
    authority([lic({})], { jurisdiction: undefined }).outcome === 'INDETERMINATE' && authority([lic({})], { date: undefined }).outcome === 'INDETERMINATE');
  test('AUTH-9: appointment held only in X2 -> NOT_AUTHORIZED for that carrier in X1', 'Provider authority',
    authority([lic({})], { rules: [producerRule(true)], rels: [rel({ jurisdiction: 'X2' })], carrier: 'Test Mutual' }).outcome === 'NOT_AUTHORIZED');
  test('AUTH-10: active X1 appointment with the carrier -> AUTHORIZED', 'Provider authority',
    authority([lic({})], { rules: [producerRule(true)], rels: [rel({})], carrier: 'Test Mutual' }).outcome === 'AUTHORIZED');
  test('AUTH-11: carrier names match exactly, not by substring', 'Provider authority',
    authority([lic({})], { rules: [producerRule(true)], rels: [rel({ carrierName: 'Test Mutual Fire' })], carrier: 'Test Mutual' }).outcome === 'NOT_AUTHORIZED');
  test('AUTH-12: authority results carry no score/rank/order/priority/weight', 'Provider authority',
    !hasForbiddenKeys(authority([lic({})])) && !hasForbiddenKeys(evaluateRules([minBI], 'OFFER_QUALIFICATION', ctx(noUM))));

  // ------------------------------------------------------------------
  // Jurisdiction determination
  // ------------------------------------------------------------------
  const det = (signals: any[]) => determineJurisdiction({ id: 'D', signals, determinedAt: '2026-07-01T00:00:00Z', allowedTestCodes: ['X1', 'X2'] });
  test('DET-1: no signal -> UNRESOLVED', 'Determination', det([]).status === 'UNRESOLVED');
  test('DET-2: policy-stated X1 and garaging X2 -> CONFLICT', 'Determination',
    det([{ signal: 'POLICY_STATED_STATE', value: 'X1' }, { signal: 'GARAGING_ADDRESS_STATE', value: 'X2' }]).status === 'CONFLICT');
  test('DET-3: agreeing signals -> PROPOSED pending consumer confirmation', 'Determination',
    det([{ signal: 'POLICY_STATED_STATE', value: 'X1' }]).status === 'PROPOSED');
  test('DET-4: consumer attestation -> CONSUMER_CONFIRMED', 'Determination',
    det([{ signal: 'POLICY_STATED_STATE', value: 'X1' }, { signal: 'CONSUMER_ATTESTATION', value: 'X1' }]).status === 'CONSUMER_CONFIRMED');
  test('DET-5: a ZIP code is never interpreted as a jurisdiction', 'Determination',
    det([{ signal: 'POLICY_STATED_STATE', value: '98101' }]).status === 'UNRESOLVED');
  test('DET-6: a real code is normalized (lowercase "ca" -> CA)', 'Determination',
    determineJurisdiction({ id: 'D', signals: [{ signal: 'POLICY_STATED_STATE', value: 'ca' }], determinedAt: '2026-07-01T00:00:00Z' }).proposedJurisdiction === 'CA');

  // ------------------------------------------------------------------
  // Market activation (D5, D7, D9)
  // ------------------------------------------------------------------
  const sandboxKey = { jurisdictionCode: 'X1', insuranceLine: 'PERSONAL_AUTO' as const, environment: 'SANDBOX' as const };
  const prodKey = { ...sandboxKey, environment: 'PRODUCTION' as const };
  const sandboxActive: MarketActivationEvent = {
    id: 'E1', ...sandboxKey, fromState: 'INACTIVE', toState: 'ACTIVE', actorId: 'a', reason: 'fixture', recordedAt: '2026-01-01T00:00:00Z'
  };
  test('MKT-1: no events -> INACTIVE', 'Market activation', replayActivation([], prodKey).state === 'INACTIVE');
  test('MKT-2: a SANDBOX activation never makes PRODUCTION active (no fallback)', 'Market activation',
    replayActivation([sandboxActive], sandboxKey).state === 'ACTIVE' && replayActivation([sandboxActive], prodKey).state === 'INACTIVE');
  const allGates = new Set(REQUIRED_PRODUCTION_GATES);
  const prodCheck = (overrides: Partial<Parameters<typeof validateActivationTransition>[0]>) => validateActivationTransition({
    key: prodKey, jurisdictionKind: 'STATE', from: 'INACTIVE', to: 'PILOT', readiness: 'RULES_VERIFIED', gates: allGates,
    actorId: 'ops', reason: 'launch', ...overrides
  });
  test('MKT-3: PRODUCTION pilot with verified rules and all gates is allowed', 'Market activation', prodCheck({}).allowed);
  test('MKT-4: PRODUCTION activation with a missing gate is rejected', 'Market activation',
    !prodCheck({ gates: new Set(REQUIRED_PRODUCTION_GATES.filter(g => g !== 'SECURITY_READY')) }).allowed);
  test('MKT-5: PRODUCTION activation without RULES_VERIFIED is rejected', 'Market activation', !prodCheck({ readiness: 'RULES_IN_REVIEW' }).allowed);
  test('MKT-6: a TEST_FIXTURE jurisdiction can never be activated in PRODUCTION', 'Market activation', !prodCheck({ jurisdictionKind: 'TEST_FIXTURE' }).allowed);
  test('MKT-7: SANDBOX activation needs no gates or verified rules', 'Market activation',
    validateActivationTransition({ key: sandboxKey, jurisdictionKind: 'TEST_FIXTURE', from: 'INACTIVE', to: 'ACTIVE', readiness: 'NOT_CONFIGURED', gates: new Set(), actorId: 'a', reason: 'fixture' }).allowed);
  const suspend = prodCheck({ from: 'ACTIVE', to: 'SUSPENDED' });
  test('MKT-8: suspension defaults to REQUIRE_MANUAL_REVIEW (D9)', 'Market activation', suspend.allowed && suspend.suspensionAction === 'REQUIRE_MANUAL_REVIEW');
  test('MKT-9: a SuspensionAction on a non-suspension transition is rejected', 'Market activation', !prodCheck({ suspensionAction: 'FREEZE_ALL_PROGRESS' }).allowed);
  test('MKT-10: an actor and a reason are required', 'Market activation', !prodCheck({ actorId: '', reason: '' }).allowed);

  const allActions = ['FREEZE_ALL_PROGRESS', 'ALLOW_SELECTION_ONLY', 'ALLOW_EXISTING_TO_COMPLETE', 'REQUIRE_MANUAL_REVIEW'] as const;
  test('MKT-11: SUSPENDED blocks NEW_CHALLENGE/INVITATION/PROVIDER_ENTRY/BINDING under every action', 'Market activation',
    allActions.every(a => (['NEW_CHALLENGE', 'NEW_INVITATION', 'NEW_PROVIDER_ENTRY', 'NEW_BINDING'] as const).every(t => decideMarketTransition('SUSPENDED', a, t).disposition === 'BLOCKED')));
  test('MKT-12: SUSPENDED always allows VIEW and AUDIT_EXPORT', 'Market activation',
    allActions.every(a => decideMarketTransition('SUSPENDED', a, 'VIEW').disposition === 'ALLOWED' && decideMarketTransition('SUSPENDED', a, 'AUDIT_EXPORT').disposition === 'ALLOWED'));
  test('MKT-13: default REQUIRE_MANUAL_REVIEW holds SELECTION and DISCLOSURE', 'Market activation',
    decideMarketTransition('SUSPENDED', undefined, 'SELECTION').disposition === 'HOLD' && decideMarketTransition('SUSPENDED', undefined, 'DISCLOSURE').disposition === 'HOLD');
  test('MKT-14: ALLOW_SELECTION_ONLY allows SELECTION but holds DISCLOSURE', 'Market activation',
    decideMarketTransition('SUSPENDED', 'ALLOW_SELECTION_ONLY', 'SELECTION').disposition === 'ALLOWED' && decideMarketTransition('SUSPENDED', 'ALLOW_SELECTION_ONLY', 'DISCLOSURE').disposition === 'HOLD');
  test('MKT-15: FREEZE_ALL_PROGRESS holds SELECTION', 'Market activation', decideMarketTransition('SUSPENDED', 'FREEZE_ALL_PROGRESS', 'SELECTION').disposition === 'HOLD');
  test('MKT-16: an INACTIVE market blocks NEW_CHALLENGE', 'Market activation', decideMarketTransition('INACTIVE', undefined, 'NEW_CHALLENGE').disposition === 'BLOCKED');

  const rs = (status: JurisdictionRuleSet['status'], version = 1): JurisdictionRuleSet => ({
    id: `RS-${status}-${version}`, jurisdictionCode: 'X1', insuranceLine: 'PERSONAL_AUTO', version, status, authoredBy: 'author_a', createdAt: '2026-01-01T00:00:00Z'
  });
  const rulesFor = (set: JurisdictionRuleSet, verified: boolean) => new Map([[set.id, [rule({ id: 'r', ruleSetId: set.id, verificationStatus: verified ? 'VERIFIED' : 'UNVERIFIED', machineRule: { kind: 'REQUIRED_COVERAGE', coverageCode: 'BODILY_INJURY' } })]]]);
  test('MKT-17: readiness is derived: none -> NOT_CONFIGURED, DRAFT -> RESEARCHING, IN_REVIEW -> RULES_IN_REVIEW', 'Market activation',
    deriveReadiness([], new Map(), 'X1', 'PERSONAL_AUTO').readiness === 'NOT_CONFIGURED' &&
    deriveReadiness([rs('DRAFT')], new Map(), 'X1', 'PERSONAL_AUTO').readiness === 'RESEARCHING' &&
    deriveReadiness([rs('IN_REVIEW')], new Map(), 'X1', 'PERSONAL_AUTO').readiness === 'RULES_IN_REVIEW');
  test('MKT-18: a PUBLISHED ruleset with an unverified executable rule is not RULES_VERIFIED', 'Market activation',
    deriveReadiness([rs('PUBLISHED')], rulesFor(rs('PUBLISHED'), false), 'X1', 'PERSONAL_AUTO').readiness === 'RULES_IN_REVIEW' &&
    deriveReadiness([rs('PUBLISHED')], rulesFor(rs('PUBLISHED'), true), 'X1', 'PERSONAL_AUTO').readiness === 'RULES_VERIFIED');
  test('MKT-19: PROVIDERS_REQUIRED is a projection of verified rules without the provider gate', 'Market activation',
    displayStatus('RULES_VERIFIED', 'INACTIVE', new Set()) === 'PROVIDERS_REQUIRED' &&
    displayStatus('RULES_VERIFIED', 'INACTIVE', new Set(['PROVIDER_AUTHORITY_READY'])) === 'RULES_VERIFIED');
  const revoked: GateAttestation = { id: 'G', ...prodKey, gateCode: 'SECURITY_READY', evidenceRef: 'e', attestedBy: 'a', attestedAt: 't', revokedAt: 't2' };
  test('MKT-20: a revoked gate is not active', 'Market activation', !activeGates([revoked], prodKey).has('SECURITY_READY'));

  // Ruling §N.3: first PRODUCTION activation passes through PILOT.
  test('MKT-21: first PRODUCTION activation cannot go INACTIVE -> ACTIVE directly', 'Market activation',
    !prodCheck({ from: 'INACTIVE', to: 'ACTIVE' }).allowed);
  test('MKT-22: PRODUCTION PILOT -> ACTIVE completes the pilot', 'Market activation', prodCheck({ from: 'PILOT', to: 'ACTIVE' }).allowed);
  test('MKT-23: after a completed PRODUCTION pilot, SUSPENDED -> ACTIVE is allowed; without one it is not', 'Market activation',
    prodCheck({ from: 'SUSPENDED', to: 'ACTIVE', productionPilotCompletedEventId: 'E-PILOT-DONE' }).allowed &&
    !prodCheck({ from: 'SUSPENDED', to: 'ACTIVE' }).allowed);
  const pilotDone: MarketActivationEvent = { ...sandboxActive, id: 'E-P', fromState: 'PILOT', toState: 'ACTIVE' };
  test('MKT-24: pilot completion is derived from PRODUCTION history only; a SANDBOX pilot never counts', 'Market activation',
    productionPilotCompletion([pilotDone], prodKey) === undefined &&
    productionPilotCompletion([{ ...pilotDone, environment: 'PRODUCTION' }], prodKey)?.id === 'E-P');

  // ------------------------------------------------------------------
  // Ruleset governance
  // ------------------------------------------------------------------
  const inReview = rs('IN_REVIEW');
  const goodRule = rule({ id: 'g1', ruleSetId: inReview.id, machineRule: { kind: 'REQUIRED_COVERAGE', coverageCode: 'BODILY_INJURY' } });
  test('GOV-1: a valid IN_REVIEW ruleset can be published by a second person', 'Governance',
    validatePublication({ ruleSet: inReview, rules: [goodRule], publisherId: 'publisher_c' }).length === 0);
  test('GOV-2: four-eyes: the author cannot publish', 'Governance',
    validatePublication({ ruleSet: inReview, rules: [goodRule], publisherId: 'author_a' }).some(e => e.includes('Four-eyes')));
  test('GOV-3: four-eyes: the author cannot be the verifier', 'Governance',
    validatePublication({ ruleSet: inReview, rules: [{ ...goodRule, verifiedBy: 'author_a' }], publisherId: 'publisher_c' }).length > 0);
  test('GOV-4: an UNVERIFIED executable rule blocks publication', 'Governance',
    validatePublication({ ruleSet: inReview, rules: [{ ...goodRule, verificationStatus: 'UNVERIFIED' }], publisherId: 'publisher_c' }).length > 0);
  test('GOV-5: an executable rule without a source blocks publication', 'Governance',
    validatePublication({ ruleSet: inReview, rules: [{ ...goodRule, sourceIds: [] }], publisherId: 'publisher_c' }).length > 0);
  test('GOV-6: only IN_REVIEW can be published', 'Governance',
    validatePublication({ ruleSet: rs('DRAFT'), rules: [goodRule], publisherId: 'publisher_c' }).length > 0);
  test('GOV-7: overlapping versions of one ruleCode block publication', 'Governance',
    validatePublication({ ruleSet: inReview, rules: [{ ...goodRule, ruleCode: 'C' }, { ...goodRule, id: 'g2', ruleCode: 'C', effectiveFrom: '2026-06-01' }], publisherId: 'publisher_c' }).length > 0);
  const prior = rs('PUBLISHED', 1);
  const published = publishRuleSet({ ruleSet: { ...inReview, version: 2 }, rules: [goodRule], publisherId: 'publisher_c', publishedAt: '2026-02-01T00:00:00Z', priorPublished: prior });
  test('GOV-8: publishing supersedes the prior PUBLISHED ruleset and records its hash', 'Governance',
    published.published.status === 'PUBLISHED' && published.superseded?.status === 'SUPERSEDED' && published.published.supersedesRuleSetId === prior.id && !!published.published.contentSha256);
  test('GOV-9: the content hash is independent of rule order', 'Governance',
    computeRuleSetContentHash(inReview, [goodRule, { ...goodRule, id: 'g0' }]) === computeRuleSetContentHash(inReview, [{ ...goodRule, id: 'g0' }, goodRule]));
  const anchored = computeRuleSetContentHash(inReview, [goodRule]);
  test('GOV-10: anchored content verifies; any change is detected', 'Governance',
    verifyAnchoredContent(inReview, [goodRule], anchored) &&
    !verifyAnchoredContent(inReview, [{ ...goodRule, machineRule: { kind: 'REQUIRED_COVERAGE', coverageCode: 'PROPERTY_DAMAGE' } }], anchored));
  test('GOV-11: only a PUBLISHED ruleset can be withdrawn, with an actor and a reason', 'Governance',
    validateWithdrawal(rs('PUBLISHED'), 'ops', 'erroneous').length === 0 && validateWithdrawal(rs('DRAFT'), 'ops', 'x').length > 0 &&
    validateWithdrawal(rs('PUBLISHED'), '', '').length > 0);

  test('GOV-12: only DRAFT can be discarded; DISCARDED is terminal', 'Governance',
    canDiscard(rs('DRAFT')) && !canDiscard(rs('IN_REVIEW')) && !canDiscard(rs('DISCARDED')) && !canDiscard(rs('PUBLISHED')) &&
    validatePublication({ ruleSet: rs('DISCARDED'), rules: [goodRule], publisherId: 'publisher_c' }).length > 0);

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
  };
}
