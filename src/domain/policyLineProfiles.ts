import type { InsuranceLine } from '../types/jurisdiction';

export type RiskSubjectKind =
  | 'PERSON'
  | 'VEHICLE'
  | 'RESIDENCE'
  | 'PERSONAL_PROPERTY'
  | 'BUSINESS_ENTITY'
  | 'BUSINESS_LOCATION'
  | 'COMMERCIAL_PROPERTY'
  | 'BUSINESS_OPERATION'
  | 'COMMERCIAL_VEHICLE'
  | 'VEHICLE_FLEET';

export type CoverageDimension =
  | 'PROPERTY'
  | 'LIABILITY'
  | 'MEDICAL_PAYMENTS'
  | 'LOSS_OF_USE'
  | 'BUSINESS_INCOME'
  | 'EXTRA_EXPENSE'
  | 'DEDUCTIBLE'
  | 'PHYSICAL_DAMAGE'
  | 'CARGO'
  | 'ENDORSEMENT';

export interface PolicyLineProfile {
  insuranceLine: InsuranceLine;
  profileVersion: number;
  riskSubjects: readonly RiskSubjectKind[];
  coverageDimensions: readonly CoverageDimension[];
  sharesExtractionFamilyWith: readonly InsuranceLine[];
  distinctContract: true;
}

/**
 * Structural profiles for the next property/liability development cohort.
 *
 * These identify data families only. They deliberately contain no assumed
 * coverage, form, limit, deductible, classification, or legal requirement.
 * Those values must come from policy evidence and verified jurisdiction rules.
 */
export const POLICY_LINE_PROFILES = Object.freeze({
  COMMERCIAL_AUTO: Object.freeze({
    insuranceLine: 'COMMERCIAL_AUTO', profileVersion: 1,
    riskSubjects: ['BUSINESS_ENTITY', 'BUSINESS_LOCATION', 'COMMERCIAL_VEHICLE', 'VEHICLE_FLEET', 'BUSINESS_OPERATION'] as const,
    coverageDimensions: ['LIABILITY', 'MEDICAL_PAYMENTS', 'PHYSICAL_DAMAGE', 'DEDUCTIBLE', 'CARGO', 'ENDORSEMENT'] as const,
    sharesExtractionFamilyWith: [] as const, distinctContract: true
  }),
  HOMEOWNERS: Object.freeze({
    insuranceLine: 'HOMEOWNERS', profileVersion: 1,
    riskSubjects: ['PERSON', 'RESIDENCE', 'PERSONAL_PROPERTY'] as const,
    coverageDimensions: ['PROPERTY', 'LIABILITY', 'MEDICAL_PAYMENTS', 'LOSS_OF_USE', 'DEDUCTIBLE', 'ENDORSEMENT'] as const,
    sharesExtractionFamilyWith: ['RENTERS'] as const, distinctContract: true
  }),
  RENTERS: Object.freeze({
    insuranceLine: 'RENTERS', profileVersion: 1,
    riskSubjects: ['PERSON', 'RESIDENCE', 'PERSONAL_PROPERTY'] as const,
    coverageDimensions: ['PROPERTY', 'LIABILITY', 'MEDICAL_PAYMENTS', 'LOSS_OF_USE', 'DEDUCTIBLE', 'ENDORSEMENT'] as const,
    sharesExtractionFamilyWith: ['HOMEOWNERS'] as const, distinctContract: true
  }),
  COMMERCIAL_GENERAL_LIABILITY: Object.freeze({
    insuranceLine: 'COMMERCIAL_GENERAL_LIABILITY', profileVersion: 1,
    riskSubjects: ['BUSINESS_ENTITY', 'BUSINESS_LOCATION', 'BUSINESS_OPERATION'] as const,
    coverageDimensions: ['LIABILITY', 'MEDICAL_PAYMENTS', 'ENDORSEMENT'] as const,
    sharesExtractionFamilyWith: ['BUSINESS_OWNERS_POLICY'] as const, distinctContract: true
  }),
  BUSINESS_OWNERS_POLICY: Object.freeze({
    insuranceLine: 'BUSINESS_OWNERS_POLICY', profileVersion: 1,
    riskSubjects: ['BUSINESS_ENTITY', 'BUSINESS_LOCATION', 'COMMERCIAL_PROPERTY', 'BUSINESS_OPERATION'] as const,
    coverageDimensions: ['PROPERTY', 'LIABILITY', 'MEDICAL_PAYMENTS', 'BUSINESS_INCOME', 'EXTRA_EXPENSE', 'DEDUCTIBLE', 'ENDORSEMENT'] as const,
    sharesExtractionFamilyWith: ['COMMERCIAL_GENERAL_LIABILITY'] as const, distinctContract: true
  })
} satisfies Partial<Record<InsuranceLine, Readonly<PolicyLineProfile>>>);

