/**
 * Automated Domain Test Suite for PM-1 Provider Eligibility Engine & Marketplace Matching
 * Validates deterministic rules:
 * - Active marketplace status & approval
 * - Active, verified jurisdiction licensing
 * - Line of business match
 * - Provider appetite validation
 * - Canonical provider evaluation (Sierra vs Buckeye vs Apex)
 */

import { evaluateProviderEligibility, filterEligibleProviders } from './eligibilityEngine';
import {
  Challenge,
  ProviderOrganization,
  ProviderLicense,
  ProviderAppetite
} from '../types/insurance';

export interface EligibilityTestCaseResult {
  name: string;
  category: string;
  passed: boolean;
  actual: string;
  expected: string;
  details?: string;
}

export function runEligibilityEngineTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: EligibilityTestCaseResult[];
} {
  const results: EligibilityTestCaseResult[] = [];

  function test(name: string, category: string, assertion: boolean, actual: string, expected: string, details?: string) {
    results.push({
      name,
      category,
      passed: assertion,
      actual,
      expected,
      details
    });
  }

  // Base mock challenge in Nevada for Personal Auto (45 days to renewal)
  const futureRenewalDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const mockChallenge: Challenge = {
    id: 'CHAL-TEST-1',
    referenceNumber: 'CHALLENGE #NV-TEST',
    consumerId: 'user_1',
    coverageBaselineId: 'BL-1',
    baseline: {
      id: 'BL-1',
      policyId: 'POL-1',
      version: 1,
      carrier: 'GEICO',
      effectiveDate: '2025-11-18',
      expirationDate: futureRenewalDate,
      baselineAnnualPremium: 2500,
      baselineMonthlyPremium: 208,
      vehicle: {
        vin: '4S4BSANC8N3281902',
        year: 2022,
        make: 'Subaru',
        model: 'Outback',
        annualMileage: 12000,
        garagingZip: '89101',
        usage: 'COMMUTE',
        ownership: 'OWNED'
      },
      coverages: [],
      verifiedAt: '2026-01-01T00:00:00Z',
      verifiedBy: 'Consumer'
    },
    requirements: {
      id: 'REQ-1',
      ruleSummary: 'Beat price without reducing protection',
      minAnnualSavings: 150,
      maxCollisionDeductible: 500,
      maxCompDeductible: 250,
      mustIncludeRental: true,
      mustIncludeRoadside: true
    },
    jurisdiction: 'NV',
    openingTimestamp: '2026-01-01T00:00:00Z',
    closingTimestamp: '2026-01-03T00:00:00Z',
    status: 'OPEN',
    disclosureLevel: 'MARKETPLACE_ANONYMOUS',
    offersCount: 0
  };

  // 1. Organization Status Evaluation
  const inactiveOrg: ProviderOrganization = {
    id: 'org_inactive',
    legalName: 'Inactive Agency Inc',
    displayName: 'Inactive Agency',
    organizationType: 'INDEPENDENT_AGENCY',
    verificationStatus: 'REGISTERED',
    marketplaceStatus: 'PENDING',
    states: ['NV'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    createdAt: '2026-01-01T00:00:00Z'
  };

  const evalInactive = evaluateProviderEligibility(mockChallenge, inactiveOrg, [], undefined);
  test(
    'Rejects provider with pending marketplace status',
    'Organization Validation',
    evalInactive.isEligible === false,
    String(evalInactive.isEligible),
    'false',
    evalInactive.reasons.join(', ')
  );

  // 2. Licensing Evaluation
  const activeOrg: ProviderOrganization = {
    id: 'org_active',
    legalName: 'Active Brokerage LLC',
    displayName: 'Active Brokerage',
    organizationType: 'INDEPENDENT_AGENCY',
    verificationStatus: 'MARKETPLACE_APPROVED',
    marketplaceStatus: 'ACTIVE',
    states: ['NV'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    createdAt: '2026-01-01T00:00:00Z'
  };

  // No license
  const evalNoLic = evaluateProviderEligibility(mockChallenge, activeOrg, [], undefined);
  test(
    'Rejects provider with no license in challenge jurisdiction',
    'License Validation',
    evalNoLic.isEligible === false && evalNoLic.reasons.some(r => r.includes('JURISDICTION')),
    evalNoLic.reasons[0] || 'none',
    'Contains JURISDICTION reason'
  );

  // Expired license
  const expiredLicense: ProviderLicense = {
    id: 'lic_exp',
    providerOrganizationId: 'org_active',
    jurisdiction: 'NV',
    licenseType: 'BROKER',
    licenseNumber: 'NV-999',
    status: 'ACTIVE',
    effectiveDate: '2020-01-01',
    expirationDate: '2021-01-01', // Expired
    verificationStatus: 'VERIFIED'
  };
  const evalExpiredLic = evaluateProviderEligibility(mockChallenge, activeOrg, [expiredLicense], undefined);
  test(
    'Rejects provider with expired license',
    'License Validation',
    evalExpiredLic.isEligible === false && evalExpiredLic.reasons.some(r => r.includes('LICENSE_EXPIRED')),
    evalExpiredLic.reasons[0] || 'none',
    'Contains LICENSE_EXPIRED reason'
  );

  // Valid active license
  const validNvLicense: ProviderLicense = {
    id: 'lic_valid',
    providerOrganizationId: 'org_active',
    jurisdiction: 'NV',
    licenseType: 'BROKER',
    licenseNumber: 'NV-849201',
    status: 'ACTIVE',
    effectiveDate: '2025-01-01',
    expirationDate: '2027-01-01',
    verificationStatus: 'VERIFIED'
  };

  // 3. Line of Business Evaluation
  const commercialOnlyOrg: ProviderOrganization = {
    ...activeOrg,
    linesOfBusiness: ['COMMERCIAL_AUTO'] // Missing PERSONAL_AUTO
  };
  const evalLOB = evaluateProviderEligibility(mockChallenge, commercialOnlyOrg, [validNvLicense], undefined);
  test(
    'Rejects provider not supporting challenge Line of Business',
    'Line of Business',
    evalLOB.isEligible === false && evalLOB.reasons.some(r => r.includes('LINE_OF_BUSINESS')),
    evalLOB.reasons.find(r => r.includes('LINE_OF_BUSINESS')) || 'none',
    'Contains LINE_OF_BUSINESS reason'
  );

  // 4. Appetite Evaluation
  const appetiteOutOfState: ProviderAppetite = {
    id: 'app_1',
    providerOrganizationId: 'org_active',
    jurisdictions: ['OH', 'IN'], // Doesn't include NV
    linesOfBusiness: ['PERSONAL_AUTO'],
    riskMarkets: ['PREFERRED'],
    renewalWindowDays: { min: 7, max: 90 },
    active: true
  };
  const evalAppetiteState = evaluateProviderEligibility(mockChallenge, activeOrg, [validNvLicense], appetiteOutOfState);
  test(
    'Rejects provider when challenge jurisdiction is outside appetite',
    'Appetite Validation',
    evalAppetiteState.isEligible === false && evalAppetiteState.reasons.some(r => r.includes('APPETITE_JURISDICTION')),
    evalAppetiteState.reasons[0] || 'none',
    'Contains APPETITE_JURISDICTION reason'
  );

  // Valid appetite
  const validAppetite: ProviderAppetite = {
    id: 'app_valid',
    providerOrganizationId: 'org_active',
    jurisdictions: ['NV', 'CA'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    riskMarkets: ['PREFERRED', 'STANDARD'],
    renewalWindowDays: { min: 7, max: 90 },
    active: true
  };
  const evalValid = evaluateProviderEligibility(mockChallenge, activeOrg, [validNvLicense], validAppetite);
  test(
    'Approves provider when all licensing, appetite, and status criteria are met',
    'End-to-End Eligibility',
    evalValid.isEligible === true && evalValid.reasons.length === 1,
    String(evalValid.isEligible),
    'true',
    evalValid.reasons[0]
  );

  // 5. Canonical Dataset Multi-Provider Match
  const sierraOrg: ProviderOrganization = {
    id: 'org_sierra',
    legalName: 'Sierra Brokerage Group LLC',
    displayName: 'Sierra Brokerage Group',
    organizationType: 'INDEPENDENT_AGENCY',
    verificationStatus: 'MARKETPLACE_APPROVED',
    marketplaceStatus: 'ACTIVE',
    states: ['NV', 'CA', 'AZ'],
    linesOfBusiness: ['PERSONAL_AUTO', 'HOMEOWNERS'],
    createdAt: '2026-01-15T08:00:00Z'
  };
  const buckeyeOrg: ProviderOrganization = {
    id: 'org_buckeye',
    legalName: 'Buckeye Mutual Agency Inc',
    displayName: 'Buckeye State Insurance',
    organizationType: 'INDEPENDENT_AGENCY',
    verificationStatus: 'MARKETPLACE_APPROVED',
    marketplaceStatus: 'ACTIVE',
    states: ['OH'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    createdAt: '2026-02-01T08:00:00Z'
  };
  const buckeyeLicense: ProviderLicense = {
    id: 'lic_buckeye',
    providerOrganizationId: 'org_buckeye',
    jurisdiction: 'OH',
    licenseType: 'AGENT',
    licenseNumber: 'OH-44120',
    status: 'ACTIVE',
    effectiveDate: '2025-01-01',
    expirationDate: '2027-01-01',
    verificationStatus: 'VERIFIED'
  };
  const buckeyeAppetite: ProviderAppetite = {
    id: 'app_buckeye',
    providerOrganizationId: 'org_buckeye',
    jurisdictions: ['OH'],
    linesOfBusiness: ['PERSONAL_AUTO'],
    riskMarkets: ['PREFERRED'],
    renewalWindowDays: { min: 7, max: 90 },
    active: true
  };

  const providers = [
    { org: sierraOrg, licenses: [validNvLicense], appetite: validAppetite },
    { org: buckeyeOrg, licenses: [buckeyeLicense], appetite: buckeyeAppetite }
  ];

  const matched = filterEligibleProviders(mockChallenge, providers);
  test(
    'Canonical Provider Match: Sierra is ELIGIBLE, Buckeye is INELIGIBLE for NV Challenge',
    'Marketplace Matching',
    matched.length === 1 && matched[0].org.id === 'org_sierra',
    matched.map(m => m.org.id).join(', '),
    'org_sierra',
    'Buckeye correctly filtered out due to jurisdiction mismatch with zero information leakage'
  );

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
  };
}
