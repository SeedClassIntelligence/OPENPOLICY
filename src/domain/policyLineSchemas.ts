import type { InsuranceLine } from '../types/jurisdiction';

export type LineFieldKind = 'TEXT' | 'DATE' | 'MONEY' | 'LIMIT' | 'DEDUCTIBLE' | 'BOOLEAN' | 'ENUM';

export interface LineFieldDefinition {
  path: string;
  label: string;
  kind: LineFieldKind;
  requiredForBaseline: boolean;
}

export interface PolicyLineSchema {
  insuranceLine: InsuranceLine;
  version: number;
  fields: readonly LineFieldDefinition[];
}

const field = (path: string, label: string, kind: LineFieldKind, requiredForBaseline = true): LineFieldDefinition =>
  Object.freeze({ path, label, kind, requiredForBaseline });

const COMMON = Object.freeze([
  field('policyNumber', 'Policy number', 'TEXT'),
  field('carrier', 'Insurance company', 'TEXT'),
  field('namedInsured', 'Named insured', 'TEXT'),
  field('jurisdiction', 'Policy jurisdiction', 'ENUM'),
  field('effectiveDate', 'Effective date', 'DATE'),
  field('expirationDate', 'Expiration date', 'DATE'),
  field('annualPremium', 'Annual premium', 'MONEY')
]);

/**
 * Versioned evidence schemas for the property/liability development cohort.
 * These are source-fact fields, not consumer requirements or coverage advice.
 */
export const POLICY_LINE_SCHEMAS = Object.freeze({
  HOMEOWNERS: Object.freeze({
    insuranceLine: 'HOMEOWNERS', version: 1, fields: Object.freeze([...COMMON,
      field('property.address', 'Insured residence address', 'TEXT'),
      field('property.occupancy', 'Occupancy', 'ENUM'),
      field('coverage.dwelling.limit', 'Dwelling limit', 'LIMIT'),
      field('coverage.otherStructures.limit', 'Other structures limit', 'LIMIT', false),
      field('coverage.personalProperty.limit', 'Personal property limit', 'LIMIT'),
      field('coverage.lossOfUse.limit', 'Loss of use limit', 'LIMIT', false),
      field('coverage.personalLiability.limit', 'Personal liability limit', 'LIMIT'),
      field('coverage.medicalPayments.limit', 'Medical payments limit', 'LIMIT', false),
      field('coverage.property.deductible', 'Property deductible', 'DEDUCTIBLE')
    ])
  }),
  RENTERS: Object.freeze({
    insuranceLine: 'RENTERS', version: 1, fields: Object.freeze([...COMMON,
      field('property.address', 'Insured residence address', 'TEXT'),
      field('coverage.personalProperty.limit', 'Personal property limit', 'LIMIT'),
      field('coverage.lossOfUse.limit', 'Loss of use limit', 'LIMIT', false),
      field('coverage.personalLiability.limit', 'Personal liability limit', 'LIMIT'),
      field('coverage.medicalPayments.limit', 'Medical payments limit', 'LIMIT', false),
      field('coverage.property.deductible', 'Property deductible', 'DEDUCTIBLE')
    ])
  }),
  COMMERCIAL_GENERAL_LIABILITY: Object.freeze({
    insuranceLine: 'COMMERCIAL_GENERAL_LIABILITY', version: 1, fields: Object.freeze([...COMMON,
      field('business.legalName', 'Insured business', 'TEXT'),
      field('business.location', 'Business location', 'TEXT'),
      field('business.classification', 'Business classification', 'TEXT'),
      field('coverage.cgl.eachOccurrence', 'Each occurrence limit', 'LIMIT'),
      field('coverage.cgl.generalAggregate', 'General aggregate limit', 'LIMIT'),
      field('coverage.cgl.productsCompletedOperationsAggregate', 'Products-completed operations aggregate', 'LIMIT', false),
      field('coverage.cgl.personalAdvertisingInjury', 'Personal and advertising injury limit', 'LIMIT', false),
      field('coverage.cgl.medicalExpense', 'Medical expense limit', 'LIMIT', false)
    ])
  }),
  BUSINESS_OWNERS_POLICY: Object.freeze({
    insuranceLine: 'BUSINESS_OWNERS_POLICY', version: 1, fields: Object.freeze([...COMMON,
      field('business.legalName', 'Insured business', 'TEXT'),
      field('business.location', 'Business location', 'TEXT'),
      field('business.classification', 'Business classification', 'TEXT'),
      field('coverage.businessProperty.limit', 'Business property limit', 'LIMIT'),
      field('coverage.businessIncome.included', 'Business income coverage', 'BOOLEAN'),
      field('coverage.extraExpense.included', 'Extra expense coverage', 'BOOLEAN', false),
      field('coverage.cgl.eachOccurrence', 'Each occurrence limit', 'LIMIT'),
      field('coverage.cgl.generalAggregate', 'General aggregate limit', 'LIMIT'),
      field('coverage.property.deductible', 'Property deductible', 'DEDUCTIBLE')
    ])
  })
} satisfies Partial<Record<InsuranceLine, Readonly<PolicyLineSchema>>>);

export function getPolicyLineSchema(line: InsuranceLine): Readonly<PolicyLineSchema> | undefined {
  return POLICY_LINE_SCHEMAS[line as keyof typeof POLICY_LINE_SCHEMAS];
}

