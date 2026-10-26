import type { NormalizedPolicyFieldPath } from '../types/insurance';
import type { InsuranceLine } from '../types/jurisdiction';
import { getPolicyLineSchema, type LineFieldDefinition } from './policyLineSchemas';

export type PolicyLineOfferFacts = Partial<Record<NormalizedPolicyFieldPath, string | number>>;

const error = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

function validateValue(definition: LineFieldDefinition, value: unknown): string | number {
  if (['INTEGER', 'MONEY', 'LIMIT', 'DEDUCTIBLE', 'BOOLEAN'].includes(definition.kind)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
      throw error(`${definition.label} must be a finite non-negative number.`);
    }
    if (definition.kind === 'INTEGER' && !Number.isInteger(value)) throw error(`${definition.label} must be a whole number.`);
    if (definition.kind === 'BOOLEAN' && value !== 0 && value !== 1) throw error(`${definition.label} must be 0 or 1.`);
    return value;
  }
  if (definition.kind === 'PERCENT_OR_MONEY') {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === 'string' && /^(?:\$?\d[\d,]*(?:\.\d{1,2})?|\d+(?:\.\d+)?%)$/.test(value.trim())) return value.trim();
    throw error(`${definition.label} must be stated as a money amount or percentage.`);
  }
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    throw error(`${definition.label} must be non-empty text.`);
  }
  return value.trim();
}

/**
 * Validates only provider-stated coverage terms. Risk identity and property or
 * business facts remain consumer-source baseline evidence and are never
 * silently copied into an offer as provider assertions.
 */
export function validatePolicyLineOfferFacts(
  insuranceLine: InsuranceLine,
  input: unknown
): PolicyLineOfferFacts {
  const schema = getPolicyLineSchema(insuranceLine);
  if (!schema) throw error(`Line-aware offers are not implemented for ${insuranceLine}.`);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('Offer coverage facts are required.');

  const coverageDefinitions = schema.fields.filter(field => field.path.startsWith('coverage.'));
  const allowed = new Map(coverageDefinitions.map(field => [field.path, field]));
  const source = input as Record<string, unknown>;
  const unknown = Object.keys(source).filter(path => !allowed.has(path));
  if (unknown.length) throw error(`Offer contains fields outside the ${insuranceLine} coverage schema: ${unknown.join(', ')}.`);

  const result: PolicyLineOfferFacts = {};
  for (const definition of coverageDefinitions) {
    const value = source[definition.path];
    if (value === undefined || value === null || value === '') {
      if (definition.requiredForBaseline) throw error(`Offer must state ${definition.label}.`);
      continue;
    }
    result[definition.path as NormalizedPolicyFieldPath] = validateValue(definition, value);
  }
  if (insuranceLine === 'COMMERCIAL_AUTO') {
    const hasCombinedSingleLimit = result['coverage.commercialAuto.combinedSingleLimit'] !== undefined;
    const hasSplitLimits = result['coverage.commercialAuto.bodilyInjuryPerPersonLimit'] !== undefined
      && result['coverage.commercialAuto.bodilyInjuryPerAccidentLimit'] !== undefined
      && result['coverage.commercialAuto.propertyDamageLimit'] !== undefined;
    if (!hasCombinedSingleLimit && !hasSplitLimits) {
      throw error('Commercial auto offer must state liability as a combined single limit or complete split limits.');
    }
  }
  return Object.freeze(result);
}

