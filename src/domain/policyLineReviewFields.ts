import type { NormalizedPolicyFieldPath } from '../types/insurance';
import type { InsuranceLine } from '../types/jurisdiction';
import { getPolicyLineSchema, type LineFieldDefinition, type LineFieldKind } from './policyLineSchemas';

export interface PolicyReviewField extends LineFieldDefinition {
  path: NormalizedPolicyFieldPath;
}

const autoField = (
  path: NormalizedPolicyFieldPath,
  label: string,
  kind: LineFieldKind,
  requiredForBaseline = true
): PolicyReviewField => Object.freeze({ path, label, kind, requiredForBaseline });

const PERSONAL_AUTO_REVIEW_FIELDS: readonly PolicyReviewField[] = Object.freeze([
  autoField('policyNumber', 'Policy number', 'TEXT'),
  autoField('carrier', 'Insurance company', 'TEXT'),
  autoField('namedInsured', 'Named insured', 'TEXT'),
  autoField('jurisdiction', 'Policy jurisdiction', 'ENUM'),
  autoField('effectiveDate', 'Effective date', 'DATE'),
  autoField('expirationDate', 'Expiration date', 'DATE'),
  autoField('annualPremium', 'Annual premium', 'MONEY'),
  autoField('vehicle.vin', 'Vehicle identification number (VIN)', 'TEXT'),
  autoField('vehicle.year', 'Vehicle year', 'INTEGER'),
  autoField('vehicle.make', 'Vehicle make', 'TEXT'),
  autoField('vehicle.model', 'Vehicle model', 'TEXT'),
  autoField('vehicle.usage', 'Vehicle use', 'ENUM'),
  autoField('vehicle.annualMileage', 'Annual mileage', 'INTEGER'),
  autoField('vehicle.garagingZip', 'Garaging ZIP code', 'TEXT'),
  autoField('vehicle.ownership', 'Vehicle ownership', 'ENUM'),
  autoField('coverage.bodilyInjury.perPersonLimit', 'Bodily injury limit per person', 'LIMIT'),
  autoField('coverage.bodilyInjury.perAccidentLimit', 'Bodily injury limit per accident', 'LIMIT'),
  autoField('coverage.propertyDamage.propertyLimit', 'Property damage limit', 'LIMIT'),
  autoField('coverage.medicalPayments.included', 'Medical payments coverage', 'BOOLEAN'),
  autoField('coverage.rentalReimbursement.included', 'Rental reimbursement coverage', 'BOOLEAN'),
  autoField('coverage.umUim.included', 'Uninsured/underinsured motorist coverage', 'BOOLEAN'),
  autoField('coverage.comprehensive.included', 'Comprehensive coverage', 'BOOLEAN'),
  autoField('coverage.collision.included', 'Collision coverage', 'BOOLEAN'),
  autoField('coverage.roadsideAssistance.included', 'Roadside assistance coverage', 'BOOLEAN')
]);

export function getPolicyReviewFields(line: InsuranceLine): readonly PolicyReviewField[] {
  if (line === 'PERSONAL_AUTO') return PERSONAL_AUTO_REVIEW_FIELDS;
  const schema = getPolicyLineSchema(line);
  if (!schema) return Object.freeze([]);
  return schema.fields as readonly PolicyReviewField[];
}

