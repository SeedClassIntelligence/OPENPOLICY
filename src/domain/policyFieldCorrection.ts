import type { NormalizedPolicyFieldPath } from '../types/insurance';

const allowed = new Set<NormalizedPolicyFieldPath>([
  'policyNumber', 'carrier', 'namedInsured', 'jurisdiction',
  'effectiveDate', 'expirationDate', 'annualPremium'
  ,'vehicle.vin','vehicle.year','vehicle.make','vehicle.model','vehicle.usage','vehicle.annualMileage',
  'vehicle.garagingZip','vehicle.ownership','coverage.bodilyInjury.perPersonLimit',
  'coverage.bodilyInjury.perAccidentLimit','coverage.propertyDamage.propertyLimit'
]);

export function validatePolicyFieldCorrection(input: unknown): {
  fieldPath: NormalizedPolicyFieldPath;
  afterValue: string | number;
} {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('Correction body is required.'), { statusCode: 400 });
  const value = input as Record<string, unknown>;
  const fieldPath = String(value.fieldPath || '') as NormalizedPolicyFieldPath;
  if (!allowed.has(fieldPath)) throw Object.assign(new Error('Field is not consumer-correctable.'), { statusCode: 400 });
  if (fieldPath === 'annualPremium' || fieldPath === 'vehicle.year' || fieldPath === 'vehicle.annualMileage' || fieldPath.startsWith('coverage.')) {
    if (typeof value.afterValue !== 'number' || !Number.isFinite(value.afterValue) || value.afterValue < 0 || value.afterValue > 1_000_000) {
      throw Object.assign(new Error('Annual premium must be a valid non-negative number.'), { statusCode: 400 });
    }
    return { fieldPath, afterValue: value.afterValue };
  }
  if (typeof value.afterValue !== 'string') throw Object.assign(new Error('Corrected value must be text.'), { statusCode: 400 });
  const afterValue = value.afterValue.trim();
  if (!afterValue || afterValue.length > 200) throw Object.assign(new Error('Corrected value has an invalid length.'), { statusCode: 400 });
  if (fieldPath === 'vehicle.vin' && !/^[A-HJ-NPR-Z0-9]{17}$/.test(afterValue.toUpperCase())) {
    throw Object.assign(new Error('VIN must contain 17 valid characters.'), { statusCode: 400 });
  }
  if (fieldPath === 'vehicle.usage' && !['COMMUTE','PLEASURE','BUSINESS'].includes(afterValue)) {
    throw Object.assign(new Error('Vehicle usage is invalid.'), { statusCode: 400 });
  }
  if (fieldPath === 'vehicle.ownership' && !['OWNED','FINANCED','LEASED'].includes(afterValue)) {
    throw Object.assign(new Error('Vehicle ownership is invalid.'), { statusCode: 400 });
  }
  if (fieldPath === 'jurisdiction' && !/^[A-Z]{2}$/.test(afterValue)) {
    throw Object.assign(new Error('Jurisdiction must be a two-letter uppercase code.'), { statusCode: 400 });
  }
  if ((fieldPath === 'effectiveDate' || fieldPath === 'expirationDate') && !/^\d{4}-\d{2}-\d{2}$/.test(afterValue)) {
    throw Object.assign(new Error('Date corrections must use YYYY-MM-DD.'), { statusCode: 400 });
  }
  return { fieldPath, afterValue };
}
