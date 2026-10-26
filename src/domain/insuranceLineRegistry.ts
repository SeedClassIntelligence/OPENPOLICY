import type { InsuranceLine } from '../types/jurisdiction';

export type InsuranceLineFamily = 'PERSONAL' | 'COMMERCIAL' | 'LIFE' | 'HEALTH';
export type InsuranceLineImplementationStatus =
  | 'ACCEPTANCE'
  | 'DEVELOPMENT'
  | 'INTEREST_ONLY'
  | 'LOCKED';

export interface InsuranceLineDefinition {
  code: InsuranceLine;
  displayName: string;
  family: InsuranceLineFamily;
  version: number;
  implementationStatus: InsuranceLineImplementationStatus;
  supportedDocumentClasses: readonly string[];
  policySchemaRef?: string;
  extractionProfileRef?: string;
  comparisonProfileRef?: string;
  disclosureProfileRef?: string;
  providerAuthorityProfileRef?: string;
  offerQualificationProfileRef?: string;
  handoffProfileRef?: string;
  reconciliationProfileRef?: string;
}

/**
 * Single product-wide insurance-line universe.
 *
 * This registry describes product capability only. It does not verify law,
 * authorize a provider, unlock a rollout region, or activate a jurisdiction.
 */
export const INSURANCE_LINE_REGISTRY = Object.freeze({
  PERSONAL_AUTO: Object.freeze({
    code: 'PERSONAL_AUTO',
    displayName: 'Personal Auto',
    family: 'PERSONAL',
    version: 1,
    implementationStatus: 'ACCEPTANCE',
    supportedDocumentClasses: ['DECLARATIONS_PAGE', 'FULL_POLICY', 'ENDORSEMENT', 'PROVIDER_QUOTE', 'ISSUED_POLICY'],
    policySchemaRef: 'policy-schema/personal-auto/v1',
    extractionProfileRef: 'document-intelligence/personal-auto/v1',
    comparisonProfileRef: 'comparison/personal-auto/v1',
    disclosureProfileRef: 'disclosure/personal-auto/v1',
    providerAuthorityProfileRef: 'provider-authority/personal-auto/v1',
    offerQualificationProfileRef: 'qualification/personal-auto/v1',
    handoffProfileRef: 'handoff/personal-auto/v1',
    reconciliationProfileRef: 'reconciliation/personal-auto/v1'
  }),
  HOMEOWNERS: Object.freeze({
    code: 'HOMEOWNERS', displayName: 'Homeowners', family: 'PERSONAL', version: 1,
    implementationStatus: 'DEVELOPMENT', supportedDocumentClasses: ['DECLARATIONS_PAGE', 'FULL_POLICY', 'ENDORSEMENT', 'PROVIDER_QUOTE', 'ISSUED_POLICY'],
    policySchemaRef: 'policy-schema/homeowners/v1', extractionProfileRef: 'document-intelligence/property/v1',
    comparisonProfileRef: 'comparison/homeowners/v1', disclosureProfileRef: 'disclosure/property/v1',
    providerAuthorityProfileRef: 'provider-authority/property/v1', offerQualificationProfileRef: 'qualification/homeowners/v1',
    handoffProfileRef: 'handoff/property/v1', reconciliationProfileRef: 'reconciliation/homeowners/v1'
  }),
  RENTERS: Object.freeze({
    code: 'RENTERS', displayName: 'Renters', family: 'PERSONAL', version: 1,
    implementationStatus: 'DEVELOPMENT', supportedDocumentClasses: ['DECLARATIONS_PAGE', 'FULL_POLICY', 'ENDORSEMENT', 'PROVIDER_QUOTE', 'ISSUED_POLICY'],
    policySchemaRef: 'policy-schema/renters/v1', extractionProfileRef: 'document-intelligence/property/v1',
    comparisonProfileRef: 'comparison/renters/v1', disclosureProfileRef: 'disclosure/property/v1',
    providerAuthorityProfileRef: 'provider-authority/property/v1', offerQualificationProfileRef: 'qualification/renters/v1',
    handoffProfileRef: 'handoff/property/v1', reconciliationProfileRef: 'reconciliation/renters/v1'
  }),
  COMMERCIAL_AUTO: Object.freeze({
    code: 'COMMERCIAL_AUTO', displayName: 'Commercial Auto', family: 'COMMERCIAL', version: 1,
    implementationStatus: 'DEVELOPMENT', supportedDocumentClasses: ['DECLARATIONS_PAGE', 'FULL_POLICY', 'ENDORSEMENT', 'PROVIDER_QUOTE', 'ISSUED_POLICY'],
    policySchemaRef: 'policy-schema/commercial-auto/v1', extractionProfileRef: 'document-intelligence/commercial-auto/v1',
    comparisonProfileRef: 'comparison/commercial-auto/v1', disclosureProfileRef: 'disclosure/commercial/v1',
    providerAuthorityProfileRef: 'provider-authority/commercial/v1', offerQualificationProfileRef: 'qualification/commercial-auto/v1',
    handoffProfileRef: 'handoff/commercial/v1', reconciliationProfileRef: 'reconciliation/commercial-auto/v1'
  }),
  COMMERCIAL_GENERAL_LIABILITY: Object.freeze({
    code: 'COMMERCIAL_GENERAL_LIABILITY', displayName: 'Commercial General Liability', family: 'COMMERCIAL', version: 1,
    implementationStatus: 'DEVELOPMENT', supportedDocumentClasses: ['DECLARATIONS_PAGE', 'FULL_POLICY', 'ENDORSEMENT', 'PROVIDER_QUOTE', 'ISSUED_POLICY'],
    policySchemaRef: 'policy-schema/commercial-general-liability/v1', extractionProfileRef: 'document-intelligence/commercial-property-liability/v1',
    comparisonProfileRef: 'comparison/commercial-general-liability/v1', disclosureProfileRef: 'disclosure/commercial/v1',
    providerAuthorityProfileRef: 'provider-authority/commercial/v1', offerQualificationProfileRef: 'qualification/commercial-general-liability/v1',
    handoffProfileRef: 'handoff/commercial/v1', reconciliationProfileRef: 'reconciliation/commercial-general-liability/v1'
  }),
  BUSINESS_OWNERS_POLICY: Object.freeze({
    code: 'BUSINESS_OWNERS_POLICY', displayName: 'Business Owners Policy', family: 'COMMERCIAL', version: 1,
    implementationStatus: 'DEVELOPMENT', supportedDocumentClasses: ['DECLARATIONS_PAGE', 'FULL_POLICY', 'ENDORSEMENT', 'PROVIDER_QUOTE', 'ISSUED_POLICY'],
    policySchemaRef: 'policy-schema/business-owners-policy/v1', extractionProfileRef: 'document-intelligence/commercial-property-liability/v1',
    comparisonProfileRef: 'comparison/business-owners-policy/v1', disclosureProfileRef: 'disclosure/commercial/v1',
    providerAuthorityProfileRef: 'provider-authority/commercial/v1', offerQualificationProfileRef: 'qualification/business-owners-policy/v1',
    handoffProfileRef: 'handoff/commercial/v1', reconciliationProfileRef: 'reconciliation/business-owners-policy/v1'
  }),
  TERM_LIFE: Object.freeze({
    code: 'TERM_LIFE', displayName: 'Term Life', family: 'LIFE', version: 1,
    implementationStatus: 'LOCKED', supportedDocumentClasses: []
  }),
  INDIVIDUAL_HEALTH: Object.freeze({
    code: 'INDIVIDUAL_HEALTH', displayName: 'Individual Health', family: 'HEALTH', version: 1,
    implementationStatus: 'LOCKED', supportedDocumentClasses: []
  })
} satisfies Record<InsuranceLine, Readonly<InsuranceLineDefinition>>);

export const INSURANCE_LINES: readonly Readonly<InsuranceLineDefinition>[] = Object.freeze(
  Object.values(INSURANCE_LINE_REGISTRY)
);

export function getInsuranceLineDefinition(code: InsuranceLine): Readonly<InsuranceLineDefinition> {
  return INSURANCE_LINE_REGISTRY[code];
}

export function canEnterPolicyPipeline(code: InsuranceLine): boolean {
  return getInsuranceLineDefinition(code).implementationStatus === 'ACCEPTANCE';
}

export function canRegisterInterest(code: InsuranceLine): boolean {
  return getInsuranceLineDefinition(code).implementationStatus !== 'LOCKED';
}

