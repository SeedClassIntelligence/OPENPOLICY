import type { NormalizedPolicyFieldPath } from '../types/insurance';
import type { InsuranceLine } from '../types/jurisdiction';
import { getPolicyLineSchema, type LineFieldKind } from './policyLineSchemas';

const personalAutoAllowed = new Set<NormalizedPolicyFieldPath>([
  'policyNumber', 'carrier', 'namedInsured', 'jurisdiction',
  'effectiveDate', 'expirationDate', 'annualPremium'
  ,'vehicle.vin','vehicle.year','vehicle.make','vehicle.model','vehicle.usage','vehicle.annualMileage',
  'vehicle.garagingZip','vehicle.ownership','coverage.bodilyInjury.perPersonLimit',
  'coverage.bodilyInjury.perAccidentLimit','coverage.propertyDamage.propertyLimit',
  'coverage.medicalPayments.included','coverage.rentalReimbursement.included','coverage.umUim.included',
  'coverage.comprehensive.included','coverage.collision.included','coverage.roadsideAssistance.included'
]);

const valueError = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

function fieldKind(line: InsuranceLine, fieldPath: NormalizedPolicyFieldPath): LineFieldKind | undefined {
  if (line === 'PERSONAL_AUTO') return personalAutoAllowed.has(fieldPath)
    ? fieldPath === 'effectiveDate' || fieldPath === 'expirationDate' ? 'DATE'
      : fieldPath === 'jurisdiction' || fieldPath === 'vehicle.usage' || fieldPath === 'vehicle.ownership' ? 'ENUM'
        : fieldPath === 'annualPremium' || fieldPath === 'vehicle.year' || fieldPath === 'vehicle.annualMileage' || fieldPath.startsWith('coverage.') ? 'MONEY'
          : 'TEXT'
    : undefined;
  return getPolicyLineSchema(line)?.fields.find(field => field.path === fieldPath)?.kind;
}

export function validatePolicyFieldCorrection(input: unknown, insuranceLine: InsuranceLine = 'PERSONAL_AUTO'): {
  fieldPath: NormalizedPolicyFieldPath;
  afterValue: string | number;
} {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('Correction body is required.'), { statusCode: 400 });
  const value = input as Record<string, unknown>;
  const fieldPath = String(value.fieldPath || '') as NormalizedPolicyFieldPath;
  const kind = fieldKind(insuranceLine, fieldPath);
  if (!kind) throw valueError(`Field is not consumer-correctable for ${insuranceLine}.`);
  if (kind === 'MONEY' || kind === 'LIMIT' || kind === 'DEDUCTIBLE' || kind === 'INTEGER' || kind === 'BOOLEAN') {
    if (typeof value.afterValue !== 'number' || !Number.isFinite(value.afterValue) || value.afterValue < 0 || value.afterValue > 1_000_000_000) {
      throw valueError('Corrected numeric value must be finite, non-negative, and within the supported range.');
    }
    if (kind === 'INTEGER' && !Number.isInteger(value.afterValue)) throw valueError('Corrected integer value must be a whole number.');
    if (kind === 'BOOLEAN' && value.afterValue !== 0 && value.afterValue !== 1) {
      throw valueError('Coverage inclusion must be 0 (not included) or 1 (included).');
    }
    return { fieldPath, afterValue: value.afterValue };
  }
  if (kind === 'PERCENT_OR_MONEY' && typeof value.afterValue === 'number') {
    if (!Number.isFinite(value.afterValue) || value.afterValue < 0 || value.afterValue > 1_000_000_000) throw valueError('Deductible value is invalid.');
    return { fieldPath, afterValue: value.afterValue };
  }
  if (typeof value.afterValue !== 'string') throw Object.assign(new Error('Corrected value must be text.'), { statusCode: 400 });
  let afterValue = value.afterValue.trim();
  if (!afterValue || afterValue.length > 200) throw Object.assign(new Error('Corrected value has an invalid length.'), { statusCode: 400 });
  // These fields are controlled enums. Accept normal human capitalization at
  // the API boundary, then persist one canonical representation.
  if (fieldPath === 'vehicle.usage' || fieldPath === 'vehicle.ownership' || fieldPath === 'jurisdiction') {
    afterValue = afterValue.toUpperCase();
  }
  if (kind === 'PERCENT_OR_MONEY' && !/^(?:\$?\d[\d,]*(?:\.\d{1,2})?|\d+(?:\.\d+)?%)$/.test(afterValue)) {
    throw valueError('Deductible must be recorded as a money amount or percentage exactly as shown by the source.');
  }
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
  if (kind === 'DATE' && (!/^\d{4}-\d{2}-\d{2}$/.test(afterValue) || Number.isNaN(new Date(`${afterValue}T00:00:00Z`).getTime()))) {
    throw Object.assign(new Error('Date corrections must use YYYY-MM-DD.'), { statusCode: 400 });
  }
  return { fieldPath, afterValue };
}
