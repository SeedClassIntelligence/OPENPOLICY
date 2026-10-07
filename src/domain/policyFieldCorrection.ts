import type { NormalizedPolicyFieldPath } from '../types/insurance';

const allowed = new Set<NormalizedPolicyFieldPath>([
  'policyNumber', 'carrier', 'namedInsured', 'jurisdiction',
  'effectiveDate', 'expirationDate', 'annualPremium'
]);

export function validatePolicyFieldCorrection(input: unknown): {
  fieldPath: NormalizedPolicyFieldPath;
  afterValue: string | number;
} {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('Correction body is required.'), { statusCode: 400 });
  const value = input as Record<string, unknown>;
  const fieldPath = String(value.fieldPath || '') as NormalizedPolicyFieldPath;
  if (!allowed.has(fieldPath)) throw Object.assign(new Error('Field is not consumer-correctable.'), { statusCode: 400 });
  if (fieldPath === 'annualPremium') {
    if (typeof value.afterValue !== 'number' || !Number.isFinite(value.afterValue) || value.afterValue < 0 || value.afterValue > 1_000_000) {
      throw Object.assign(new Error('Annual premium must be a valid non-negative number.'), { statusCode: 400 });
    }
    return { fieldPath, afterValue: value.afterValue };
  }
  if (typeof value.afterValue !== 'string') throw Object.assign(new Error('Corrected value must be text.'), { statusCode: 400 });
  const afterValue = value.afterValue.trim();
  if (!afterValue || afterValue.length > 200) throw Object.assign(new Error('Corrected value has an invalid length.'), { statusCode: 400 });
  if (fieldPath === 'jurisdiction' && !/^[A-Z]{2}$/.test(afterValue)) {
    throw Object.assign(new Error('Jurisdiction must be a two-letter uppercase code.'), { statusCode: 400 });
  }
  if ((fieldPath === 'effectiveDate' || fieldPath === 'expirationDate') && !/^\d{4}-\d{2}-\d{2}$/.test(afterValue)) {
    throw Object.assign(new Error('Date corrections must use YYYY-MM-DD.'), { statusCode: 400 });
  }
  return { fieldPath, afterValue };
}
