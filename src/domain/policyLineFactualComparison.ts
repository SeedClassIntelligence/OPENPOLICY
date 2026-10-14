import type { NormalizedPolicyFieldPath } from '../types/insurance';
import type { InsuranceLine } from '../types/jurisdiction';
import { getPolicyLineSchema } from './policyLineSchemas';

export type FactualFieldRelation = 'MATCH' | 'DIFFERENT' | 'BASELINE_ONLY' | 'OFFER_ONLY' | 'NOT_STATED';

export interface FactualFieldComparison {
  fieldPath: NormalizedPolicyFieldPath;
  label: string;
  baselineValue?: string | number;
  offerValue?: string | number;
  baselineValueFormatted: string;
  offerValueFormatted: string;
  relation: FactualFieldRelation;
}

export interface PolicyLineFactualComparison {
  insuranceLine: InsuranceLine;
  schemaVersion: number;
  annualPremiumDifference?: number;
  fields: FactualFieldComparison[];
  differenceCount: number;
  unstatedCount: number;
}

type Facts = Partial<Record<NormalizedPolicyFieldPath, string | number>>;

function format(value: string | number | undefined, kind: string): string {
  if (value === undefined) return 'Not stated';
  if (kind === 'MONEY' || kind === 'LIMIT' || kind === 'DEDUCTIBLE') {
    return typeof value === 'number' ? `$${value.toLocaleString()}` : value;
  }
  if (kind === 'BOOLEAN') return value === 1 ? 'Included' : value === 0 ? 'Not included' : String(value);
  return String(value);
}

/**
 * Produces factual, schema-bounded differences only. It does not score,
 * recommend, rank, or label either set of terms as superior.
 */
export function comparePolicyLineFacts(input: {
  insuranceLine: InsuranceLine;
  baseline: Facts;
  offer: Facts;
}): PolicyLineFactualComparison {
  const schema = getPolicyLineSchema(input.insuranceLine);
  if (!schema) throw new Error(`No factual comparison schema exists for ${input.insuranceLine}.`);
  const fields = schema.fields.filter(definition => definition.path.startsWith('coverage.')).map(definition => {
    const fieldPath = definition.path as NormalizedPolicyFieldPath;
    const baselineValue = input.baseline[fieldPath];
    const offerValue = input.offer[fieldPath];
    const relation: FactualFieldRelation = baselineValue === undefined && offerValue === undefined ? 'NOT_STATED'
      : baselineValue === undefined ? 'OFFER_ONLY'
        : offerValue === undefined ? 'BASELINE_ONLY'
          : baselineValue === offerValue ? 'MATCH' : 'DIFFERENT';
    return {
      fieldPath,
      label: definition.label,
      baselineValue,
      offerValue,
      baselineValueFormatted: format(baselineValue, definition.kind),
      offerValueFormatted: format(offerValue, definition.kind),
      relation
    };
  });
  const baselinePremium = input.baseline.annualPremium;
  const offerPremium = input.offer.annualPremium;
  return {
    insuranceLine: input.insuranceLine,
    schemaVersion: schema.version,
    annualPremiumDifference: typeof baselinePremium === 'number' && typeof offerPremium === 'number'
      ? baselinePremium - offerPremium : undefined,
    fields,
    differenceCount: fields.filter(field => ['DIFFERENT', 'BASELINE_ONLY', 'OFFER_ONLY'].includes(field.relation)).length,
    unstatedCount: fields.filter(field => field.relation === 'NOT_STATED').length
  };
}
