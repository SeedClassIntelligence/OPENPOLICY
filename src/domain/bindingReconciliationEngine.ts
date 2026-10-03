/**
 * PM-3: Consumer Selection, Post-Bind Reconciliation & Binding Handoff Dossier
 * Implements Section 26, 27, 28, 29, 30 of System Architecture
 */

import {
  Offer,
  CoverageBaseline,
  Policy,
  BindingHandoff,
  ReconciliationReport,
  CoverageItem,
  WholeOfferClassification
} from '../types/insurance';

export interface BindingHandoffDossier {
  id: string;
  bindingReference: string;
  challengeId: string;
  challengeReference: string;
  status: 'PENDING_TRANSMISSION' | 'DISCLOSED_TO_BROKER' | 'BOUND_BY_CARRIER' | 'RECONCILED' | 'RECONCILIATION_FAILED';
  createdAt: string;
  
  // Selected Quote Particulars
  selectedOffer: {
    id: string;
    carrier: string;
    quoteNumber: string;
    annualPremium: number;
    monthlyPremium: number;
    termMonths: number;
    effectiveDate: string;
    expirationDate: string;
    tierLabel?: string;
    classification: WholeOfferClassification;
    coverages: CoverageItem[];
  };

  // Winning Broker Particulars
  winningBroker: {
    providerOrganizationId: string;
    providerName: string;
    licenseNumber: string;
    jurisdiction: string;
    designatedAgentName: string;
    agentEmail: string;
  };

  // Consumer Verified Risk Vector (Progressive Disclosure Level 1 Authorized)
  authorizedConsumer: {
    namedInsured: string;
    contactEmail: string;
    contactPhone: string;
    garagingAddress: {
      addressLine1: string;
      city: string;
      state: string;
      postalCode: string;
    };
    drivers: Array<{
      name: string;
      licenseState: string;
      licenseNumber: string;
      age: number;
      isPrimary: boolean;
    }>;
    vehicles: Array<{
      year: number;
      make: string;
      model: string;
      vin: string;
      annualMileage: number;
      primaryUse: string;
    }>;
  };

  // Section 40 Informed Consent & Discrepancy Sign-Off
  complianceAcknowledgments: {
    section40ParityAcknowledged: boolean;
    acknowledgedAt: string;
    ipAddressHash: string;
    termsVersion: string;
    discrepanciesExplicitlyApproved: string[];
    priceImprovementAnnual: number;
  };

  // Immutable Provenance Hash
  dossierHash: string;
  sourceBaselinePolicyId: string;
}

export interface PostBindDiscrepancyItem {
  fieldCode: string;
  fieldName: string;
  category: string;
  agreedOfferValue: string;
  actualIssuedValue: string;
  discrepancyType: 'RATE_CREEP' | 'DEDUCTIBLE_INFLATION' | 'LIMIT_REDUCTION' | 'COVERAGE_STRIPPED' | 'ENDORSEMENT_DROPPED';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  financialImpactAnnual?: number;
  explanation: string;
}

export interface DetailedPostBindReconciliation {
  id: string;
  dossierId: string;
  bindingReference: string;
  carrier: string;
  issuedPolicyNumber: string;
  reconciledAt: string;
  isCompliant: boolean;
  stealthCreepDetected: boolean;
  totalAnnualCreepAmount: number;
  discrepancies: PostBindDiscrepancyItem[];
  reconciliationAuditVerdict: 'APPROVED_CANONICAL' | 'FLAGGED_UNAUTHORIZED_VARIANCE' | 'REJECTED_BREACH';
  summary: string;
}

/**
 * Validates consumer consent for Section 40 compliance before binding handoff.
 * If the selected offer has material reductions or modified coverages,
 * the consumer MUST explicitly acknowledge every specific discrepancy.
 */
export function validateConsumerBindingAuthorization(params: {
  selectedOffer: Offer;
  baseline: CoverageBaseline;
  materialReductions: string[];
  consumerConsentGiven: boolean;
  consumerAcknowledgedReductions: string[];
}): { isValid: boolean; error?: string; requiredAcknowledgments: string[] } {
  const {
    selectedOffer,
    baseline,
    materialReductions,
    consumerConsentGiven,
    consumerAcknowledgedReductions
  } = params;

  if (!consumerConsentGiven) {
    return {
      isValid: false,
      error: 'Consumer consent and disclosure authorization is required to transmit binding dossier.',
      requiredAcknowledgments: materialReductions
    };
  }

  // If there are material reductions, ensure every one is explicitly acknowledged
  if (materialReductions.length > 0) {
    const unacknowledged = materialReductions.filter(
      r => !consumerAcknowledgedReductions.includes(r)
    );
    if (unacknowledged.length > 0) {
      return {
        isValid: false,
        error: `Informed consent required: Consumer must acknowledge ${unacknowledged.length} coverage variation(s) before binding handoff.`,
        requiredAcknowledgments: materialReductions
      };
    }
  }

  return {
    isValid: true,
    requiredAcknowledgments: materialReductions
  };
}

/**
 * Performs rigorous post-bind discrepancy reconciliation between the agreed quote and the issued dec page.
 * Detects hidden price creep, altered deductibles, dropped endorsements, and stealth limit changes.
 */
export function reconcileIssuedPolicyWithQuote(params: {
  dossier: BindingHandoffDossier;
  issuedData: {
    policyNumber: string;
    annualPremium: number;
    monthlyPremium?: number;
    effectiveDate: string;
    coverages: Array<{
      code: string;
      name?: string;
      limit?: string;
      perPersonLimit?: number;
      perAccidentLimit?: number;
      propertyLimit?: number;
      deductible?: number;
      isIncluded: boolean;
    }>;
  };
}): DetailedPostBindReconciliation {
  const { dossier, issuedData } = params;
  const agreed = dossier.selectedOffer;
  const discrepancies: PostBindDiscrepancyItem[] = [];
  let totalAnnualCreep = 0;

  // 1. Premium & Rate Creep Verification
  if (issuedData.annualPremium > agreed.annualPremium) {
    const delta = issuedData.annualPremium - agreed.annualPremium;
    totalAnnualCreep += delta;
    discrepancies.push({
      fieldCode: 'ANNUAL_PREMIUM',
      fieldName: 'Annual Premium',
      category: 'PRICING',
      agreedOfferValue: `$${agreed.annualPremium.toLocaleString()}/yr`,
      actualIssuedValue: `$${issuedData.annualPremium.toLocaleString()}/yr`,
      discrepancyType: 'RATE_CREEP',
      severity: delta >= 50 ? 'HIGH' : 'MEDIUM',
      financialImpactAnnual: delta,
      explanation: `Carrier increased annual premium by $${delta} over agreed quote #${agreed.quoteNumber}.`
    });
  }

  // 2. Coverages Reconciliation
  agreed.coverages.forEach(agreedCov => {
    const issuedCov = issuedData.coverages.find(c => c.code === agreedCov.code);

    // Dropped coverage / endorsement
    if (agreedCov.isIncluded && (!issuedCov || !issuedCov.isIncluded)) {
      discrepancies.push({
        fieldCode: agreedCov.code,
        fieldName: agreedCov.name,
        category: agreedCov.category,
        agreedOfferValue: 'Included in Quote',
        actualIssuedValue: 'Excluded / Dropped from Issued Policy',
        discrepancyType: 'COVERAGE_STRIPPED',
        severity: 'HIGH',
        explanation: `Agreed coverage ${agreedCov.name} was omitted from the issued policy declarations.`
      });
      return;
    }

    if (!issuedCov) return;

    // Deductible Inflation
    if (
      agreedCov.deductible !== undefined &&
      issuedCov.deductible !== undefined &&
      issuedCov.deductible > agreedCov.deductible
    ) {
      discrepancies.push({
        fieldCode: agreedCov.code,
        fieldName: `${agreedCov.name} Deductible`,
        category: agreedCov.category,
        agreedOfferValue: `$${agreedCov.deductible} Deductible`,
        actualIssuedValue: `$${issuedCov.deductible} Deductible`,
        discrepancyType: 'DEDUCTIBLE_INFLATION',
        severity: 'HIGH',
        explanation: `Deductible was silently increased by $${issuedCov.deductible - agreedCov.deductible}, shifting out-of-pocket costs to consumer.`
      });
    }

    // Liability Limit Reduction
    if (
      agreedCov.perPersonLimit !== undefined &&
      issuedCov.perPersonLimit !== undefined &&
      issuedCov.perPersonLimit < agreedCov.perPersonLimit
    ) {
      discrepancies.push({
        fieldCode: agreedCov.code,
        fieldName: `${agreedCov.name} Limit`,
        category: agreedCov.category,
        agreedOfferValue: `$${agreedCov.perPersonLimit.toLocaleString()} Per Person`,
        actualIssuedValue: `$${issuedCov.perPersonLimit.toLocaleString()} Per Person`,
        discrepancyType: 'LIMIT_REDUCTION',
        severity: 'HIGH',
        explanation: `Per-person bodily injury limit was reduced below agreed terms.`
      });
    }

    if (
      agreedCov.propertyLimit !== undefined &&
      issuedCov.propertyLimit !== undefined &&
      issuedCov.propertyLimit < agreedCov.propertyLimit
    ) {
      discrepancies.push({
        fieldCode: agreedCov.code,
        fieldName: `${agreedCov.name} Property Damage Limit`,
        category: agreedCov.category,
        agreedOfferValue: `$${agreedCov.propertyLimit.toLocaleString()} Property Limit`,
        actualIssuedValue: `$${issuedCov.propertyLimit.toLocaleString()} Property Limit`,
        discrepancyType: 'LIMIT_REDUCTION',
        severity: 'HIGH',
        explanation: `Property damage liability limit was reduced below agreed terms.`
      });
    }
  });

  const isCompliant = discrepancies.length === 0;
  const stealthCreepDetected = totalAnnualCreep > 0;
  const hasHighSeverity = discrepancies.some(d => d.severity === 'HIGH');

  const verdict: DetailedPostBindReconciliation['reconciliationAuditVerdict'] = isCompliant
    ? 'APPROVED_CANONICAL'
    : hasHighSeverity
    ? 'REJECTED_BREACH'
    : 'FLAGGED_UNAUTHORIZED_VARIANCE';

  const summary = isCompliant
    ? `Issued policy #${issuedData.policyNumber} from ${agreed.carrier} matches agreed quote #${agreed.quoteNumber} with 100% fidelity. Safe to file in Private Policy Vault.`
    : `Discrepancy alert: Detected ${discrepancies.length} variance(s) including $${totalAnnualCreep}/yr price difference and ${discrepancies.filter(d => d.discrepancyType !== 'RATE_CREEP').length} coverage variation(s). Broker remediation required.`;

  return {
    id: `REC-${Date.now()}`,
    dossierId: dossier.id,
    bindingReference: dossier.bindingReference,
    carrier: agreed.carrier,
    issuedPolicyNumber: issuedData.policyNumber,
    reconciledAt: new Date().toISOString(),
    isCompliant,
    stealthCreepDetected,
    totalAnnualCreepAmount: totalAnnualCreep,
    discrepancies,
    reconciliationAuditVerdict: verdict,
    summary
  };
}
