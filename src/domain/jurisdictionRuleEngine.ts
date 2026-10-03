/**
 * PR-0A — Jurisdiction Rule Engine (pure)
 *
 * Evaluates a ruleset's machine-executable rules for one enforcement point against an
 * explicit RuleEvaluationContext. It never reads the clock, never performs I/O, and never
 * produces a score, rank or ordering.
 *
 * Invariants:
 * - D3: a rule is in force when effectiveFrom <= date < effectiveUntil (or until is null),
 *   on calendar dates only.
 * - D10: each rule is evaluated against the temporal fact it declares; if that date is
 *   unknown the result is INDETERMINATE, never the server clock.
 * - Unknown facts stay unknown: missing inputs produce INDETERMINATE, never PASS.
 * - D8: a rule referencing a coverage the canonical taxonomy cannot express is INDETERMINATE.
 */
import {
  EnforcementPoint,
  JurisdictionRule,
  MachineRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleOutcome
} from '../types/jurisdiction';
import { isCalendarDate } from './jurisdiction/canonical';

/** Coverage codes the canonical CoverageItem taxonomy can currently express. */
export const CANONICAL_COVERAGE_CODES: ReadonlySet<string> = new Set([
  'BODILY_INJURY',
  'PROPERTY_DAMAGE',
  'COLLISION',
  'COMPREHENSIVE',
  'UM_UIM',
  'MEDICAL_PAYMENTS',
  'RENTAL_REIMBURSEMENT',
  'ROADSIDE_ASSISTANCE'
]);

export function isRuleInForce(rule: Pick<JurisdictionRule, 'effectiveFrom' | 'effectiveUntil'>, date: string): boolean {
  if (!isCalendarDate(date)) return false;
  return rule.effectiveFrom <= date && (rule.effectiveUntil === undefined || date < rule.effectiveUntil);
}

const OUTCOME_PRECEDENCE: RuleOutcome[] = ['FAIL', 'BLOCK', 'NOT_AUTHORIZED', 'INDETERMINATE', 'PASS', 'NOT_APPLICABLE'];

export function aggregateOutcome(results: Array<{ outcome: RuleOutcome }>): RuleOutcome {
  for (const outcome of OUTCOME_PRECEDENCE) {
    if (results.some(r => r.outcome === outcome)) return outcome;
  }
  return 'NOT_APPLICABLE';
}

/**
 * Evaluates every rule at the given enforcement point. Versions of the same ruleCode are
 * resolved by the rule's own temporal basis; exactly one version must be in force.
 */
export function evaluateRules(
  rules: JurisdictionRule[],
  enforcementPoint: EnforcementPoint,
  context: RuleEvaluationContext
): { outcome: RuleOutcome; results: RuleEvaluationResult[] } {
  const byCode = new Map<string, JurisdictionRule[]>();
  for (const rule of rules.filter(r => r.enforcementPoint === enforcementPoint)) {
    const group = byCode.get(rule.ruleCode) || [];
    group.push(rule);
    byCode.set(rule.ruleCode, group);
  }

  const results: RuleEvaluationResult[] = [];
  for (const [ruleCode, versions] of [...byCode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const basis = versions[0].temporalBasis;
    const date = context.dates[basis];
    if (!isCalendarDate(date)) {
      results.push({
        ruleId: versions[0].id,
        ruleCode,
        outcome: 'INDETERMINATE',
        reasons: [`Required date '${basis}' is unknown or not a calendar date; the applicable rule version cannot be determined.`],
        verificationStatus: versions[0].verificationStatus
      });
      continue;
    }
    const inForce = versions.filter(v => isRuleInForce(v, date));
    if (inForce.length === 0) continue;
    if (inForce.length > 1) {
      results.push({
        ruleId: inForce[0].id,
        ruleCode,
        outcome: 'INDETERMINATE',
        reasons: [`${inForce.length} versions of ${ruleCode} are in force on ${date}; the ruleset is internally inconsistent.`],
        verificationStatus: inForce[0].verificationStatus,
        evaluationDate: date
      });
      continue;
    }
    const rule = inForce[0];
    const { outcome, reasons } = evaluateMachineRule(rule.machineRule, context);
    results.push({
      ruleId: rule.id,
      ruleCode,
      outcome,
      reasons,
      verificationStatus: rule.verificationStatus,
      evaluationDate: date
    });
  }

  return { outcome: aggregateOutcome(results), results };
}

function evaluateMachineRule(rule: MachineRule | null, ctx: RuleEvaluationContext): { outcome: RuleOutcome; reasons: string[] } {
  if (rule === null) {
    return { outcome: 'NOT_APPLICABLE', reasons: ['Informational rule: not machine-executable and never auto-enforced.'] };
  }

  switch (rule.kind) {
    case 'REQUIRED_COVERAGE': {
      const gap = coverageGap(rule.coverageCode, ctx);
      if (gap) return gap;
      const included = ctx.coverages!.some(c => c.code === rule.coverageCode && c.isIncluded);
      return included
        ? { outcome: 'PASS', reasons: [`${rule.coverageCode} is included.`] }
        : { outcome: 'FAIL', reasons: [`Required coverage ${rule.coverageCode} is absent.`] };
    }

    case 'MINIMUM_LIMITS': {
      const gap = coverageGap(rule.coverageCode, ctx);
      if (gap) return gap;
      const cov = ctx.coverages!.find(c => c.code === rule.coverageCode && c.isIncluded);
      if (!cov) return { outcome: 'FAIL', reasons: [`Required coverage ${rule.coverageCode} is absent.`] };

      const checks: Array<[string, number | undefined, number | undefined]> = [
        ['per-person limit', rule.perPerson, cov.perPersonLimit],
        ['per-accident limit', rule.perAccident, cov.perAccidentLimit],
        ['property limit', rule.property, cov.propertyLimit],
        ['combined single limit', rule.combinedSingleLimit, cov.combinedSingleLimit]
      ];
      const reasons: string[] = [];
      let unknown = false;
      let below = false;
      for (const [label, required, actual] of checks) {
        if (required === undefined) continue;
        if (actual === undefined) {
          unknown = true;
          reasons.push(`${rule.coverageCode} ${label} is unknown (required minimum ${required}).`);
        } else if (actual < required) {
          below = true;
          reasons.push(`${rule.coverageCode} ${label} ${actual} is below the required minimum ${required}.`);
        } else {
          reasons.push(`${rule.coverageCode} ${label} ${actual} meets the required minimum ${required}.`);
        }
      }
      if (below) return { outcome: 'FAIL', reasons };
      if (unknown) return { outcome: 'INDETERMINATE', reasons };
      return { outcome: 'PASS', reasons };
    }

    case 'MANDATORY_OFFER': {
      const gap = coverageGap(rule.coverageCode, ctx);
      if (gap) return gap;
      if (ctx.coverages!.some(c => c.code === rule.coverageCode && c.isIncluded)) {
        return { outcome: 'PASS', reasons: [`Mandatory offer ${rule.coverageCode} is included.`] };
      }
      if (!rule.rejectionPermitted) {
        return { outcome: 'FAIL', reasons: [`${rule.coverageCode} must be provided and cannot be rejected.`] };
      }
      if (ctx.coverageRejections === undefined) {
        return { outcome: 'INDETERMINATE', reasons: [`Consumer rejection status for ${rule.coverageCode} is unknown.`] };
      }
      const rejection = ctx.coverageRejections.find(r => r.coverageCode === rule.coverageCode);
      if (!rejection) {
        return { outcome: 'BLOCK', reasons: [`${rule.coverageCode} was neither included nor rejected by the consumer.`] };
      }
      if (rule.rejectionEvidence && rejection.evidence !== rule.rejectionEvidence) {
        return {
          outcome: 'BLOCK',
          reasons: [`Rejection of ${rule.coverageCode} requires ${rule.rejectionEvidence} evidence; held: ${rejection.evidence || 'none'}.`]
        };
      }
      return { outcome: 'PASS', reasons: [`Consumer rejection of ${rule.coverageCode} is evidenced.`] };
    }

    case 'REQUIRED_NOTICE': {
      if (ctx.deliveredNoticeCodes === undefined) {
        return { outcome: 'INDETERMINATE', reasons: [`Delivery status of notice ${rule.noticeCode} is unknown.`] };
      }
      return ctx.deliveredNoticeCodes.includes(rule.noticeCode)
        ? { outcome: 'PASS', reasons: [`Notice ${rule.noticeCode} was delivered.`] }
        : { outcome: 'BLOCK', reasons: [`Required notice ${rule.noticeCode} has not been delivered.`] };
    }

    case 'PRODUCER_AUTHORITY':
    case 'CARRIER_AUTHORITY':
      return {
        outcome: 'INDETERMINATE',
        reasons: [`${rule.kind} is evaluated by the provider authority engine, not against transaction facts.`]
      };

    case 'ELECTRONIC_CONSENT':
    case 'RECORD_RETENTION':
      return { outcome: 'INDETERMINATE', reasons: [`No facts for ${rule.kind} are available in this context.`] };
  }
}

function coverageGap(code: string, ctx: RuleEvaluationContext): { outcome: RuleOutcome; reasons: string[] } | null {
  if (!CANONICAL_COVERAGE_CODES.has(code)) {
    return {
      outcome: 'INDETERMINATE',
      reasons: [`The canonical coverage taxonomy cannot express '${code}'; this requirement cannot be evaluated (D8).`]
    };
  }
  if (ctx.coverages === undefined) {
    return { outcome: 'INDETERMINATE', reasons: ['Coverage facts are unknown.'] };
  }
  return null;
}
