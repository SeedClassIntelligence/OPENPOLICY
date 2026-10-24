import { createHash, randomUUID } from 'node:crypto';
import type { InsuranceLine, UsJurisdictionCode } from '../types/jurisdiction';
import type { CoverageBaseline, CoverageItem } from '../types/insurance';

export const CONSUMER_DEFINED_REQUEST_SCHEMA_VERSION = 'CDCR-1' as const;

export type BaselineOrigin = 'VERIFIED_EXISTING_POLICY' | 'CONSUMER_DEFINED_COVERAGE_REQUEST';
export type CoveragePreference = 'REQUESTED' | 'NO_PREFERENCE_STATED';

export interface RequestedCoverageTerm {
  fieldCode: string;
  label: string;
  preference: CoveragePreference;
  requestedValue?: string | number | boolean;
}

export interface ConsumerDefinedCoverageRequestInput {
  consumerId: string;
  jurisdiction: UsJurisdictionCode;
  insuranceLine: InsuranceLine;
  desiredEffectiveDate: string;
  riskFacts: Readonly<Record<string, string | number | boolean>>;
  requestedCoverage: readonly RequestedCoverageTerm[];
  /** Informational consumer reference only. Never disclosed to providers or used for eligibility. */
  privateBudget?: { amount: number; interval: 'MONTHLY' | 'ANNUAL' };
  attested: boolean;
}

export interface ConsumerDefinedCoverageRequestBaseline extends ConsumerDefinedCoverageRequestInput {
  id: string;
  requestSeriesId: string;
  version: number;
  baselineOrigin: 'CONSUMER_DEFINED_COVERAGE_REQUEST';
  schemaVersion: typeof CONSUMER_DEFINED_REQUEST_SCHEMA_VERSION;
  status: 'CONFIRMED';
  confirmedAt: string;
  supersedesBaselineId?: string;
  contentSha256: string;
}

export type RequestedTermComparison =
  | 'MATCHES_REQUEST'
  | 'EXCEEDS_REQUEST'
  | 'DIFFERS_FROM_REQUEST'
  | 'REQUEST_NOT_ADDRESSED'
  | 'PROVIDER_TERM_NOT_DOCUMENTED';

export interface ConsumerRequestValidationResult {
  valid: boolean;
  errors: string[];
}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
};

export function validateConsumerDefinedCoverageRequest(
  input: ConsumerDefinedCoverageRequestInput
): ConsumerRequestValidationResult {
  const errors: string[] = [];
  if (!input.consumerId.trim()) errors.push('Authenticated consumer identity is required.');
  if (input.jurisdiction !== 'NV') errors.push('Consumer-defined coverage requests are currently available only in Nevada.');
  if (!input.desiredEffectiveDate || Number.isNaN(Date.parse(input.desiredEffectiveDate))) {
    errors.push('A valid desired effective date is required.');
  }
  if (!input.attested) errors.push('Consumer attestation is required.');
  if (Object.keys(input.riskFacts).length === 0) errors.push('At least one risk fact is required.');
  if (input.requestedCoverage.length === 0) errors.push('At least one coverage field is required.');
  for (const term of input.requestedCoverage) {
    if (!term.fieldCode.trim() || !term.label.trim()) errors.push('Every coverage field requires a code and label.');
    if (term.preference === 'REQUESTED' && (term.requestedValue === undefined || term.requestedValue === '')) {
      errors.push(`${term.label || term.fieldCode} requires a value or No preference stated.`);
    }
  }
  if (input.privateBudget && (!Number.isFinite(input.privateBudget.amount) || input.privateBudget.amount <= 0)) {
    errors.push('Budget must be a positive amount when provided.');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function hashRequest(payload: Omit<ConsumerDefinedCoverageRequestBaseline, 'contentSha256'>): string {
  return createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

export function confirmConsumerDefinedCoverageRequest(
  input: ConsumerDefinedCoverageRequestInput,
  options: { now?: string; requestSeriesId?: string; id?: string } = {}
): ConsumerDefinedCoverageRequestBaseline {
  const validation = validateConsumerDefinedCoverageRequest(input);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const confirmedAt = options.now || new Date().toISOString();
  const requestSeriesId = options.requestSeriesId || `CDR-${randomUUID()}`;
  const payload: Omit<ConsumerDefinedCoverageRequestBaseline, 'contentSha256'> = {
    ...input,
    riskFacts: Object.freeze({ ...input.riskFacts }),
    requestedCoverage: Object.freeze(input.requestedCoverage.map(term => Object.freeze({ ...term }))),
    privateBudget: input.privateBudget ? Object.freeze({ ...input.privateBudget }) : undefined,
    id: options.id || `${requestSeriesId}-V1`,
    requestSeriesId,
    version: 1,
    baselineOrigin: 'CONSUMER_DEFINED_COVERAGE_REQUEST',
    schemaVersion: CONSUMER_DEFINED_REQUEST_SCHEMA_VERSION,
    status: 'CONFIRMED',
    confirmedAt
  };
  return Object.freeze({ ...payload, contentSha256: hashRequest(payload) });
}

export function reviseConsumerDefinedCoverageRequest(
  prior: ConsumerDefinedCoverageRequestBaseline,
  changes: Omit<ConsumerDefinedCoverageRequestInput, 'consumerId' | 'jurisdiction'> &
    Partial<Pick<ConsumerDefinedCoverageRequestInput, 'consumerId' | 'jurisdiction'>>,
  options: { now?: string; id?: string } = {}
): ConsumerDefinedCoverageRequestBaseline {
  const input: ConsumerDefinedCoverageRequestInput = {
    consumerId: changes.consumerId || prior.consumerId,
    jurisdiction: changes.jurisdiction || prior.jurisdiction,
    insuranceLine: changes.insuranceLine,
    desiredEffectiveDate: changes.desiredEffectiveDate,
    riskFacts: changes.riskFacts,
    requestedCoverage: changes.requestedCoverage,
    privateBudget: changes.privateBudget,
    attested: changes.attested
  };
  const validation = validateConsumerDefinedCoverageRequest(input);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const confirmedAt = options.now || new Date().toISOString();
  const payload: Omit<ConsumerDefinedCoverageRequestBaseline, 'contentSha256'> = {
    ...input,
    riskFacts: Object.freeze({ ...input.riskFacts }),
    requestedCoverage: Object.freeze(input.requestedCoverage.map(term => Object.freeze({ ...term }))),
    privateBudget: input.privateBudget ? Object.freeze({ ...input.privateBudget }) : undefined,
    id: options.id || `${prior.requestSeriesId}-V${prior.version + 1}`,
    requestSeriesId: prior.requestSeriesId,
    version: prior.version + 1,
    baselineOrigin: 'CONSUMER_DEFINED_COVERAGE_REQUEST',
    schemaVersion: CONSUMER_DEFINED_REQUEST_SCHEMA_VERSION,
    status: 'CONFIRMED',
    confirmedAt,
    supersedesBaselineId: prior.id
  };
  return Object.freeze({ ...payload, contentSha256: hashRequest(payload) });
}

/** Provider-visible projection. Deliberately excludes consumer identity and private budget. */
export function projectConsumerRequestForMarketplace(baseline: ConsumerDefinedCoverageRequestBaseline) {
  return Object.freeze({
    baselineId: baseline.id,
    baselineOrigin: baseline.baselineOrigin,
    version: baseline.version,
    jurisdiction: baseline.jurisdiction,
    insuranceLine: baseline.insuranceLine,
    desiredEffectiveDate: baseline.desiredEffectiveDate,
    riskFacts: baseline.riskFacts,
    requestedCoverage: baseline.requestedCoverage,
    contentSha256: baseline.contentSha256
  });
}

function numericParts(value: unknown): number[] {
  return String(value ?? '').match(/[\d,]+/g)?.map(part => Number(part.replaceAll(',', ''))).filter(Number.isFinite) || [];
}

/**
 * Compatibility baseline for the existing marketplace and offer-validation engines.
 * It contains only consumer-requested terms. "No preference stated" never becomes
 * a fabricated exclusion, limit, deductible, or coverage recommendation.
 */
export function consumerRequestToMarketplaceBaseline(
  request: ConsumerDefinedCoverageRequestBaseline
): CoverageBaseline {
  const coverages: CoverageItem[] = [];
  for (const term of request.requestedCoverage) {
    if (term.preference !== 'REQUESTED') continue;
    const values = numericParts(term.requestedValue);
    const code = term.fieldCode as CoverageItem['code'];
    const base = {
      id: `${request.id}-${term.fieldCode}`,
      code,
      name: term.label,
      isIncluded: true,
      notes: 'Consumer-requested term; not an existing-policy term.'
    };
    if (code === 'BODILY_INJURY' || code === 'UM_UIM') {
      coverages.push({ ...base, category: 'LIABILITY', perPersonLimit: values[0], perAccidentLimit: values[1] });
      continue;
    }
    if (code === 'PROPERTY_DAMAGE') {
      coverages.push({ ...base, category: 'LIABILITY', propertyLimit: values[0] });
      continue;
    }
    if (code === 'COLLISION' || code === 'COMPREHENSIVE') {
      coverages.push({ ...base, category: 'PHYSICAL_DAMAGE', deductible: values[0] });
      continue;
    }
    coverages.push({ ...base, category: 'ADDITIONAL' });
  }
  const effective = new Date(request.desiredEffectiveDate);
  const expiration = new Date(effective);
  expiration.setUTCFullYear(expiration.getUTCFullYear() + 1);
  return Object.freeze({
    id: `MBL-${request.id}`,
    policyId: request.id,
    version: request.version,
    carrier: 'Consumer-defined coverage request',
    effectiveDate: request.desiredEffectiveDate,
    expirationDate: expiration.toISOString().slice(0, 10),
    baselineAnnualPremium: 0,
    baselineMonthlyPremium: 0,
    jurisdiction: request.jurisdiction,
    coverages: Object.freeze(coverages) as unknown as CoverageItem[],
    verifiedAt: request.confirmedAt,
    verifiedBy: 'Consumer attestation',
    insuranceLine: request.insuranceLine,
    baselineOrigin: 'CONSUMER_DEFINED_COVERAGE_REQUEST',
    consumerDefinedRequestId: request.id
  });
}
