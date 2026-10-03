/**
 * PR-0A — Ruleset Governance (pure)
 *
 * - Only a DRAFT ruleset's rules may change.
 * - Publication requires IN_REVIEW status, four-eyes (publisher != author, verifier != author),
 *   every executable rule VERIFIED with at least one source, valid intervals and no overlapping
 *   versions of the same ruleCode.
 * - Publishing supersedes the prior PUBLISHED ruleset for the same jurisdiction and line.
 * - A published ruleset is never rewritten or deleted; an erroneous one is WITHDRAWN.
 * - Only a DRAFT ruleset may be discarded; DISCARDED is terminal and can never be published.
 *   An IN_REVIEW ruleset returns to DRAFT first. Resurrecting content means a new draft.
 */
import { JurisdictionRule, JurisdictionRuleSet } from '../types/jurisdiction';
import { isCalendarDate, sha256Hex } from './jurisdiction/canonical';

/** Content hash over the full rule content, independent of input order. */
export function computeRuleSetContentHash(ruleSet: JurisdictionRuleSet, rules: JurisdictionRule[]): string {
  return sha256Hex({
    jurisdictionCode: ruleSet.jurisdictionCode,
    insuranceLine: ruleSet.insuranceLine,
    version: ruleSet.version,
    rules: [...rules].sort((a, b) => a.id.localeCompare(b.id))
  });
}

export function canModifyRules(ruleSet: JurisdictionRuleSet): boolean {
  return ruleSet.status === 'DRAFT';
}

export function canDiscard(ruleSet: JurisdictionRuleSet): boolean {
  return ruleSet.status === 'DRAFT';
}

export function canReturnToDraft(ruleSet: JurisdictionRuleSet): boolean {
  return ruleSet.status === 'IN_REVIEW';
}

export function validateRuleIntegrity(rules: JurisdictionRule[]): string[] {
  const errors: string[] = [];
  for (const r of rules) {
    if (!isCalendarDate(r.effectiveFrom)) errors.push(`${r.id}: effectiveFrom must be a calendar date.`);
    if (r.effectiveUntil !== undefined) {
      if (!isCalendarDate(r.effectiveUntil)) errors.push(`${r.id}: effectiveUntil must be a calendar date.`);
      else if (r.effectiveUntil <= r.effectiveFrom) errors.push(`${r.id}: effectiveUntil must be after effectiveFrom.`);
    }
  }
  const byCode = new Map<string, JurisdictionRule[]>();
  for (const r of rules) byCode.set(r.ruleCode, [...(byCode.get(r.ruleCode) || []), r]);
  for (const [code, versions] of byCode) {
    for (let i = 0; i < versions.length; i++) {
      for (let j = i + 1; j < versions.length; j++) {
        const a = versions[i];
        const b = versions[j];
        const aEnd = a.effectiveUntil ?? '9999-12-31';
        const bEnd = b.effectiveUntil ?? '9999-12-31';
        if (a.effectiveFrom < bEnd && b.effectiveFrom < aEnd) {
          errors.push(`${code}: versions ${a.id} and ${b.id} have overlapping effective intervals.`);
        }
      }
    }
  }
  return errors;
}

export function validatePublication(params: {
  ruleSet: JurisdictionRuleSet;
  rules: JurisdictionRule[];
  publisherId: string;
}): string[] {
  const { ruleSet, rules, publisherId } = params;
  const errors: string[] = [];
  if (ruleSet.status !== 'IN_REVIEW') errors.push(`Only an IN_REVIEW ruleset can be published (status: ${ruleSet.status}).`);
  if (!publisherId) errors.push('An attributable publisher is required.');
  if (publisherId && publisherId === ruleSet.authoredBy) errors.push('Four-eyes: the publisher must not be the author.');
  if (rules.length === 0) errors.push('A ruleset must contain at least one rule.');
  for (const r of rules) {
    if (r.ruleSetId !== ruleSet.id) errors.push(`${r.id}: belongs to a different ruleset.`);
    if (r.machineRule !== null) {
      if (r.verificationStatus !== 'VERIFIED') errors.push(`${r.id}: executable rules must be VERIFIED (status: ${r.verificationStatus}).`);
      if (!r.verifiedBy) errors.push(`${r.id}: verifier is not recorded.`);
      else if (r.verifiedBy === ruleSet.authoredBy) errors.push(`${r.id}: four-eyes: the verifier must not be the ruleset author.`);
      if (r.sourceIds.length === 0) errors.push(`${r.id}: an executable rule must cite at least one source.`);
    }
  }
  errors.push(...validateRuleIntegrity(rules));
  return errors;
}

export function publishRuleSet(params: {
  ruleSet: JurisdictionRuleSet;
  rules: JurisdictionRule[];
  publisherId: string;
  publishedAt: string;
  priorPublished?: JurisdictionRuleSet;
}): { published: JurisdictionRuleSet; superseded?: JurisdictionRuleSet } {
  const errors = validatePublication(params);
  if (errors.length > 0) throw new Error(`Ruleset ${params.ruleSet.id} cannot be published: ${errors.join(' ')}`);
  const published: JurisdictionRuleSet = {
    ...params.ruleSet,
    status: 'PUBLISHED',
    publishedBy: params.publisherId,
    publishedAt: params.publishedAt,
    supersedesRuleSetId: params.priorPublished?.id ?? params.ruleSet.supersedesRuleSetId,
    contentSha256: computeRuleSetContentHash(params.ruleSet, params.rules)
  };
  const superseded = params.priorPublished ? { ...params.priorPublished, status: 'SUPERSEDED' as const } : undefined;
  return { published, superseded };
}

export function validateWithdrawal(ruleSet: JurisdictionRuleSet, actorId: string, reason: string): string[] {
  const errors: string[] = [];
  if (ruleSet.status !== 'PUBLISHED') errors.push(`Only a PUBLISHED ruleset can be withdrawn (status: ${ruleSet.status}).`);
  if (!actorId) errors.push('An attributable actor is required.');
  if (!reason || !reason.trim()) errors.push('A withdrawal reason is required.');
  return errors;
}

/** Verifies that an anchored ruleset is byte-for-byte the content it was evaluated against. */
export function verifyAnchoredContent(ruleSet: JurisdictionRuleSet, rules: JurisdictionRule[], anchoredSha256: string): boolean {
  return computeRuleSetContentHash(ruleSet, rules) === anchoredSha256;
}
