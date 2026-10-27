import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePropertyPolicyFields } from './propertyPolicyFieldNormalization';
import { normalizeCommercialPolicyFields } from './commercialPolicyFieldNormalization';
import { normalizeCommercialAutoPolicyFields } from './commercialAutoPolicyFieldNormalization';
import { buildVerifiedPolicyAndBaseline } from './policyEvidenceVerification';
import { evaluateProviderEligibility } from './eligibilityEngine';
import { evaluateOfferQualification } from './qualificationEngine';
import { createConsentGrant, createSelection, initiateBindingHandoff, validateAndExecuteDisclosure } from './selectionBindingEngine';
import { buildCommercialEvent, createCommercialAgreement, createCommercialPlanVersion, rateCommercialEvent } from './commercialEconomicsEngine';
import { OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2 } from './commercialPriceBook';
import type { InsuranceLine } from '../types/jurisdiction';
import type { Challenge, NormalizedPolicyFieldPath, Offer, OfferVersion, PolicyNormalizationResult, ProviderAppetite, ProviderLicense, ProviderOrganization } from '../types/insurance';

type Facts = Partial<Record<NormalizedPolicyFieldPath, string | number>>;
const ocr = (line: string, text: string) => ({
  runId: `OCR-${line}`, sourceSha256: 'b'.repeat(64), sourceGeneration: '1',
  extractor: 'GOOGLE_DOCUMENT_AI' as const, extractorVersion: 'acceptance', processedAt: '2026-10-26T00:00:00.000Z',
  pages: [{ pageNumber: 1, text, regions: [{ textStart: 0, textEnd: text.length, confidence: .99, normalizedVertices: [] }] }]
});

const cases: Array<{ line: InsuranceLine; expectedPrice: number; normalization: () => PolicyNormalizationResult; offerFacts: Facts }> = [
  {
    line: 'RENTERS', expectedPrice: 4000,
    normalization: () => normalizePropertyPolicyFields({ documentId: 'DOC-NV-RENTERS', insuranceLine: 'RENTERS', ocr: ocr('RENTERS', `
Renters Policy Declaration Page
Policy Number: NV-R-1001
Carrier: Nevada Sample Renters Insurance Company
Named Insured: Sample Tenant
Policy State: NV
Effective Date: 11/01/2026
Expiration Date: 11/01/2027
Annual Premium: $240.00
Residence Premises: 200 Sample Avenue, Las Vegas, NV 89101
Coverage C Personal Property: $30,000
Coverage D Loss of Use: $9,000
Coverage E Personal Liability: $100,000
Coverage F Medical Payments to Others: $1,000
Property Deductible: $500
`) }),
    offerFacts: { 'coverage.personalProperty.limit': 30000, 'coverage.personalLiability.limit': 100000, 'coverage.property.deductible': 500 }
  },
  {
    line: 'COMMERCIAL_AUTO', expectedPrice: 22500,
    normalization: () => normalizeCommercialAutoPolicyFields({ documentId: 'DOC-NV-COMM-AUTO', insuranceLine: 'COMMERCIAL_AUTO', ocr: ocr('COMMERCIAL_AUTO', `
Nevada Sample Indemnity Insurance Company
Business Auto Declarations
Policy Number: NV-CA-1001
Named Insured: Sample Delivery LLC
Policy State: NV
Effective Date: 11/01/2026
Expiration Date: 11/01/2027
Annual Premium: $6,000.00
Business Legal Name: Sample Delivery LLC
Business Location: 300 Sample Road, Las Vegas, NV 89101
Covered Auto Symbols: 07, 08, 09
Combined Single Limit: $1,000,000
`) }),
    offerFacts: { 'coverage.commercialAuto.combinedSingleLimit': 1000000 }
  },
  {
    line: 'COMMERCIAL_GENERAL_LIABILITY', expectedPrice: 20000,
    normalization: () => normalizeCommercialPolicyFields({ documentId: 'DOC-NV-CGL', insuranceLine: 'COMMERCIAL_GENERAL_LIABILITY', ocr: ocr('CGL', `
Nevada Sample Liability Insurance Company
Commercial General Liability Coverage Part Declarations
Policy Number: NV-CGL-1001
Named Insured: Sample Services LLC
Policy State: NV
Effective Date: 11/01/2026
Expiration Date: 11/01/2027
Annual Premium: $1,200.00
Business Legal Name: Sample Services LLC
Business Location: 400 Sample Boulevard, Las Vegas, NV 89101
Business Classification: Office
Each Occurrence Limit: $1,000,000
General Aggregate Limit: $2,000,000
`) }),
    offerFacts: { 'coverage.cgl.eachOccurrence': 1000000, 'coverage.cgl.generalAggregate': 2000000 }
  },
  {
    line: 'BUSINESS_OWNERS_POLICY', expectedPrice: 20000,
    normalization: () => normalizeCommercialPolicyFields({ documentId: 'DOC-NV-BOP', insuranceLine: 'BUSINESS_OWNERS_POLICY', ocr: ocr('BOP', `
Nevada Sample Fire and Casualty Company
Businessowners Policy Declarations
Policy Number: NV-BOP-1001
Named Insured: Sample Retail LLC
Policy State: NV
Effective Date: 11/01/2026
Expiration Date: 11/01/2027
Annual Premium: $2,400.00
Business Legal Name: Sample Retail LLC
Business Location: 500 Sample Street, Las Vegas, NV 89101
Business Classification: Retail store
Business Personal Property Limit: $100,000
Business Income Coverage: Included
Each Occurrence Limit: $1,000,000
General Aggregate Limit: $2,000,000
Property Deductible: $1,000
`) }),
    offerFacts: {
      'coverage.businessProperty.limit': 100000, 'coverage.businessIncome.included': 1,
      'coverage.cgl.eachOccurrence': 1000000, 'coverage.cgl.generalAggregate': 2000000,
      'coverage.property.deductible': 1000
    }
  }
];

for (const scenario of cases) {
  test(`${scenario.line} completes Nevada application acceptance and exact V2 connection rating`, () => {
    const normalization = scenario.normalization();
    assert.equal(normalization.status, 'READY_FOR_CONSUMER', normalization.criticalIssues.join('; '));
    const consumerId = `consumer-${scenario.line.toLowerCase()}`;
    const { baseline } = buildVerifiedPolicyAndBaseline({
      ownerId: consumerId, documentName: `sample-${scenario.line.toLowerCase()}.pdf`, normalization,
      corrections: [], insuranceLine: scenario.line, verifiedAt: '2026-10-26T00:05:00.000Z'
    });
    const challenge: Challenge = {
      id: `CHAL-${scenario.line}`, referenceNumber: `CHAL-NV-${scenario.line}`, consumerId,
      coverageBaselineId: baseline.id, baseline, jurisdiction: 'NV', insuranceLine: scenario.line,
      openingTimestamp: '2026-10-26T00:10:00.000Z', closingTimestamp: '2026-10-28T00:10:00.000Z',
      status: 'OPEN', disclosureLevel: 'MARKETPLACE_ANONYMOUS', offersCount: 0
    };
    const org: ProviderOrganization = {
      id: `org-${scenario.line.toLowerCase()}`, legalName: 'Nevada Sample Provider LLC', displayName: 'Nevada Sample Provider',
      organizationType: 'INDEPENDENT_AGENCY', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'ACTIVE',
      states: ['NV'], linesOfBusiness: [scenario.line], createdAt: '2026-10-01T00:00:00.000Z'
    };
    const license: ProviderLicense = {
      id: `lic-${scenario.line}`, providerOrganizationId: org.id, jurisdiction: 'NV', licenseType: 'PROPERTY_CASUALTY',
      licenseNumber: `NV-SAMPLE-${scenario.line}`, status: 'ACTIVE', effectiveDate: '2026-01-01', expirationDate: '2028-01-01',
      verificationStatus: 'VERIFIED'
    };
    const appetite: ProviderAppetite = {
      id: `app-${scenario.line}`, providerOrganizationId: org.id, jurisdictions: ['NV'], linesOfBusiness: [scenario.line],
      riskMarkets: ['STANDARD'], renewalWindowDays: { min: 0, max: 500 }, active: true
    };
    assert.equal(evaluateProviderEligibility(challenge, org, [license], appetite).isEligible, true);
    const carrier = `Nevada Sample ${scenario.line} Carrier`;
    const offer: Offer = {
      id: `OFFER-${scenario.line}`, challengeId: challenge.id, providerId: org.id, providerName: org.displayName,
      providerLicense: license.licenseNumber, carrier, quoteNumber: `QUOTE-${scenario.line}`, annualPremium: 1000,
      monthlyPremium: 83.33, termMonths: 12, effectiveDate: '2026-11-01', expirationDate: '2027-11-01',
      coverages: [], verifiedFacts: scenario.offerFacts, insuranceLine: scenario.line,
      supportingQuoteDocName: `${scenario.line.toLowerCase()}-quote.pdf`, submittedAt: '2026-10-26T01:00:00.000Z',
      discrepanciesDetected: false, status: 'VALIDATED', round: 'OPEN', version: 1
    };
    const qualification = evaluateOfferQualification(offer, baseline, org, [{
      id: `rel-${scenario.line}`, providerOrganizationId: org.id, carrierId: `carrier-${scenario.line}`,
      carrierName: carrier, jurisdiction: 'NV', lineOfBusiness: scenario.line, relationshipType: 'APPOINTED', status: 'ACTIVE'
    }]);
    assert.equal(qualification.isQualified, true, qualification.disqualificationReasons.join('; '));
    const version: OfferVersion = {
      id: `VER-${scenario.line}`, offerId: offer.id, versionNumber: 1, round: 'OPEN', carrier,
      annualPremium: offer.annualPremium, monthlyPremium: offer.monthlyPremium, coverages: [],
      verifiedFacts: scenario.offerFacts, insuranceLine: scenario.line, supportingQuoteDocName: offer.supportingQuoteDocName,
      revisionReason: 'Initial offer', submittedAt: offer.submittedAt
    };
    const selection = createSelection({ challenge, offer, offerVersion: version, consumerId });
    const handoff = initiateBindingHandoff({ selection, challenge });
    const consent = createConsentGrant({
      challengeId: challenge.id, consumerId, recipientOrganizationId: org.id, purpose: 'AUTHORIZED_CONNECTION',
      purposeExplanation: `${scenario.line} consumer-authorized connection`, authorizedFieldNames: ['namedInsured', 'email', 'phone'],
      now: new Date('2026-10-26T02:00:00.000Z')
    });
    const disclosure = validateAndExecuteDisclosure({
      consentGrant: consent, handoff, requestingProviderOrgId: org.id,
      fullConsumerData: { namedInsured: 'Sample Consumer', email: 'sample@example.test', phone: '702-555-0100', privateBudget: 999 },
      now: new Date('2026-10-26T02:01:00.000Z')
    });
    assert.equal(disclosure.disclosedData.privateBudget, undefined);
    const tier = OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.memberships.SOLO;
    const planVersion = createCommercialPlanVersion({
      planId: tier.planCode, version: 2, effectiveFrom: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
      billingInterval: 'MONTHLY', recurringFeeCents: tier.priceCentsMonthly,
      termsSnapshot: {
        priceBookId: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id,
        authorizedConnectionCentsByInsuranceLine: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine },
        unavailableInsuranceLines: [...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.unavailableInsuranceLines],
        compensationDeterminationApproved: true, determinationReference: `${scenario.line}-ACCEPTANCE-ONLY`
      }
    });
    const agreement = createCommercialAgreement({ commercialAccountId: `cac-${scenario.line}`, providerOrganizationId: org.id, planVersionId: planVersion.id, startsAt: '2026-10-17T00:00:00.000Z' });
    const eventInput = {
      providerOrganizationId: org.id, eventType: 'AUTHORIZED_CONNECTION' as const, sourceEntityType: 'DISCLOSURE_EVENT',
      sourceEntityId: disclosure.disclosureEvent.id, challengeId: challenge.id,
      commercialAgreementId: agreement.id, commercialPlanVersionId: planVersion.id, metadata: { insuranceLine: scenario.line }
    };
    const event = buildCommercialEvent(eventInput);
    assert.equal(event.idempotencyKey, buildCommercialEvent(eventInput).idempotencyKey);
    const rating = rateCommercialEvent({ event, agreement, planVersion });
    assert.equal(rating.disposition, 'BILLABLE');
    assert.equal(rating.amountCents, scenario.expectedPrice);
  });
}
