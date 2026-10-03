/**
 * Open Policy - Provider Eligibility Engine (Section 10)
 * Evaluates marketplace provider eligibility deterministically against verified challenges.
 * No opaque AI decisions - 100% transparent and explainable rules.
 */

import {
  Challenge,
  ProviderOrganization,
  ProviderLicense,
  ProviderAppetite
} from '../types/insurance';

export interface EligibilityEvaluation {
  providerOrganizationId: string;
  isEligible: boolean;
  reasons: string[];
}

export function evaluateProviderEligibility(
  challenge: Challenge,
  org: ProviderOrganization,
  licenses: ProviderLicense[],
  appetite?: ProviderAppetite
): EligibilityEvaluation {
  const reasons: string[] = [];

  // 1. Organization Marketplace Status
  if (org.marketplaceStatus !== 'ACTIVE') {
    reasons.push(`ORGANIZATION_INACTIVE: Marketplace status is ${org.marketplaceStatus}`);
  }

  // 2. Jurisdiction & License Verification
  const challengeJurisdiction = challenge.jurisdiction || 'NV';
  const matchingJurisdictionLicenses = licenses.filter(lic => lic.jurisdiction === challengeJurisdiction);

  if (matchingJurisdictionLicenses.length === 0) {
    reasons.push(`JURISDICTION: No active, verified license found for jurisdiction ${challengeJurisdiction}`);
  } else {
    const activeVerifiedLicenses = matchingJurisdictionLicenses.filter(
      lic => lic.status === 'ACTIVE' && lic.verificationStatus === 'VERIFIED'
    );
    if (activeVerifiedLicenses.length === 0) {
      reasons.push(`LICENSE_STATUS: Provider license for ${challengeJurisdiction} is not active or verified`);
    } else {
      const now = new Date().getTime();
      const unexpiredLicenses = activeVerifiedLicenses.filter(
        lic => !lic.expirationDate || new Date(lic.expirationDate).getTime() > now
      );
      if (unexpiredLicenses.length === 0) {
        reasons.push(`LICENSE_EXPIRED: All provider licenses for ${challengeJurisdiction} are expired`);
      }
    }
  }

  // 3. Line of Business Support
  const lineOfBusiness = 'PERSONAL_AUTO'; // Auto Insurance v1.0
  const orgSupportsLOB = org.linesOfBusiness.includes(lineOfBusiness);
  if (!orgSupportsLOB) {
    reasons.push(`LINE_OF_BUSINESS: Organization does not service ${lineOfBusiness}`);
  }

  // 4. Provider Appetite Evaluation
  if (!appetite || !appetite.active) {
    reasons.push(`APPETITE_INACTIVE: Provider has not configured an active appetite profile`);
  } else {
    // Check jurisdiction in appetite
    if (!appetite.jurisdictions.includes(challengeJurisdiction)) {
      reasons.push(`APPETITE_JURISDICTION: Jurisdiction ${challengeJurisdiction} is outside configured appetite`);
    }

    // Check line of business in appetite
    if (!appetite.linesOfBusiness.includes(lineOfBusiness)) {
      reasons.push(`APPETITE_LOB: ${lineOfBusiness} is outside configured appetite`);
    }

    // Check renewal window if expiration date exists
    if (challenge.baseline?.expirationDate) {
      const expDate = new Date(challenge.baseline.expirationDate);
      const now = new Date();
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && appetite.renewalWindowDays) {
        if (diffDays < appetite.renewalWindowDays.min) {
          reasons.push(`RENEWAL_WINDOW: ${diffDays} days to renewal is below minimum window of ${appetite.renewalWindowDays.min} days`);
        } else if (diffDays > appetite.renewalWindowDays.max) {
          reasons.push(`RENEWAL_WINDOW: ${diffDays} days to renewal exceeds maximum window of ${appetite.renewalWindowDays.max} days`);
        }
      }
    }
  }

  const isEligible = reasons.length === 0;
  if (isEligible) {
    reasons.push('All marketplace eligibility criteria satisfied: active license, matching jurisdiction, verified appetite, and line of business.');
  }

  return {
    providerOrganizationId: org.id,
    isEligible,
    reasons
  };
}

export function filterEligibleProviders(
  challenge: Challenge,
  providers: Array<{
    org: ProviderOrganization;
    licenses: ProviderLicense[];
    appetite?: ProviderAppetite;
  }>
): Array<{
  org: ProviderOrganization;
  evaluation: EligibilityEvaluation;
}> {
  return providers
    .map(p => ({
      org: p.org,
      evaluation: evaluateProviderEligibility(challenge, p.org, p.licenses, p.appetite)
    }))
    .filter(item => item.evaluation.isEligible);
}

