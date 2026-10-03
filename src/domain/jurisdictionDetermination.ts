/**
 * PR-0A — Jurisdiction Determination (pure)
 *
 * Records which jurisdiction governs a transaction from explicit evidence signals.
 * It never infers a jurisdiction from a ZIP-code prefix and never defaults to any state.
 * Conflicting signals are a CONFLICT; no valid signal is UNRESOLVED. Which signal legally
 * controls is a PR-0B legal-review question, so signals are recorded, not ranked.
 */
import { JurisdictionDetermination, JurisdictionSignal } from '../types/jurisdiction';
import { isUsJurisdictionCode } from './jurisdiction/usJurisdictions';

export function determineJurisdiction(params: {
  id: string;
  signals: JurisdictionSignal[];
  policyId?: string;
  challengeId?: string;
  determinedAt: string;
  /** Additional codes accepted only by test fixtures (fictional jurisdictions). */
  allowedTestCodes?: string[];
}): JurisdictionDetermination {
  const { id, signals, policyId, challengeId, determinedAt, allowedTestCodes = [] } = params;
  const reasons: string[] = [];
  const valid: JurisdictionSignal[] = [];

  for (const s of signals) {
    const value = typeof s.value === 'string' ? s.value.trim().toUpperCase() : s.value;
    if (isUsJurisdictionCode(value) || allowedTestCodes.includes(value)) {
      valid.push({ ...s, value });
    } else {
      reasons.push(`Ignored ${s.signal}: '${s.value}' is not a recognized jurisdiction code.`);
    }
  }

  const base = { id, policyId, challengeId, basis: valid, determinedAt };

  if (valid.length === 0) {
    return { ...base, status: 'UNRESOLVED', reasons: [...reasons, 'No valid jurisdiction signal is available.'] };
  }

  const distinct = [...new Set(valid.map(s => s.value))];
  if (distinct.length > 1) {
    return {
      ...base,
      status: 'CONFLICT',
      reasons: [...reasons, `Signals disagree (${valid.map(s => `${s.signal}=${s.value}`).join(', ')}); the governing jurisdiction must be resolved before a challenge opens.`]
    };
  }

  const code = distinct[0];
  const attested = valid.some(s => s.signal === 'CONSUMER_ATTESTATION');
  return {
    ...base,
    status: attested ? 'CONSUMER_CONFIRMED' : 'PROPOSED',
    proposedJurisdiction: code,
    confirmedJurisdiction: attested ? code : undefined,
    consumerConfirmedAt: attested ? determinedAt : undefined,
    reasons: [...reasons, `All ${valid.length} signal(s) agree on ${code}.${attested ? '' : ' Consumer confirmation is pending.'}`]
  };
}
