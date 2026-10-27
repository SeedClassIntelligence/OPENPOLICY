import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePropertyPolicyFields } from './propertyPolicyFieldNormalization';
import { buildVerifiedPolicyAndBaseline } from './policyEvidenceVerification';
import { evaluateProviderEligibility } from './eligibilityEngine';
import { evaluateOfferQualification } from './qualificationEngine';
import { comparePolicyLineFacts } from './policyLineFactualComparison';
import { createConsentGrant, createSelection, initiateBindingHandoff, validateAndExecuteDisclosure } from './selectionBindingEngine';
import { buildCommercialEvent, createCommercialAgreement, createCommercialPlanVersion, rateCommercialEvent } from './commercialEconomicsEngine';
import { OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2 } from './commercialPriceBook';
import type { Challenge, Offer, OfferVersion, ProviderAppetite, ProviderLicense, ProviderOrganization } from '../types/insurance';

const ocr = (text: string) => ({
  runId: 'OCR-HOMEOWNERS-ACCEPTANCE', sourceSha256: 'a'.repeat(64), sourceGeneration: '1',
  extractor: 'GOOGLE_DOCUMENT_AI' as const, extractorVersion: 'acceptance', processedAt: '2026-10-26T00:00:00.000Z',
  pages: [{ pageNumber: 1, text, regions: [{ textStart: 0, textEnd: text.length, confidence: .99, normalizedVertices: [] }] }]
});

test('Nevada homeowners completes the marketplace lifecycle and produces one V2 connection event', () => {
  const normalization = normalizePropertyPolicyFields({ documentId: 'DOC-HOME-NV-1', insuranceLine: 'HOMEOWNERS', ocr: ocr(`
Homeowners Policy Declarations
Policy Number: NV-HO-10001
Insurance Company: Nevada Sample Property Insurance Company
Named Insured: Sample Consumer
Policy State: NV
Effective Date: 11/01/2026
Expiration Date: 11/01/2027
Annual Premium: $1,800.00
Residence Premises: 100 Sample Street, Las Vegas, NV 89101
Occupancy: Owner occupied
Coverage A Dwelling: $450,000
Coverage B Other Structures: $45,000
Coverage C Personal Property: $225,000
Coverage D Loss of Use: $90,000
Coverage E Personal Liability: $300,000
Coverage F Medical Payments to Others: $5,000
All Other Perils Deductible: $2,500
`) });
  assert.equal(normalization.status, 'READY_FOR_CONSUMER');
  const { baseline } = buildVerifiedPolicyAndBaseline({
    ownerId: 'consumer-home-1', documentName: 'sample-nevada-homeowners.pdf', normalization,
    corrections: [], insuranceLine: 'HOMEOWNERS', verifiedAt: '2026-10-26T00:05:00.000Z'
  });
  const challenge: Challenge = {
    id: 'CHAL-HOME-NV-1', referenceNumber: 'CHAL-NV-HOME-1', consumerId: 'consumer-home-1',
    coverageBaselineId: baseline.id, baseline, jurisdiction: 'NV', insuranceLine: 'HOMEOWNERS',
    openingTimestamp: '2026-10-26T00:10:00.000Z', closingTimestamp: '2026-10-28T00:10:00.000Z',
    status: 'OPEN', disclosureLevel: 'MARKETPLACE_ANONYMOUS', offersCount: 0
  };
  const org: ProviderOrganization = {
    id: 'org-home-nv', legalName: 'Nevada Home Provider LLC', displayName: 'Nevada Home Provider',
    organizationType: 'INDEPENDENT_AGENCY', verificationStatus: 'MARKETPLACE_APPROVED', marketplaceStatus: 'ACTIVE',
    states: ['NV'], linesOfBusiness: ['HOMEOWNERS'], createdAt: '2026-10-01T00:00:00.000Z'
  };
  const license: ProviderLicense = {
    id: 'lic-home-nv', providerOrganizationId: org.id, jurisdiction: 'NV', licenseType: 'PROPERTY',
    licenseNumber: 'NV-SAMPLE-100', status: 'ACTIVE', effectiveDate: '2026-01-01', expirationDate: '2028-01-01',
    verificationStatus: 'VERIFIED'
  };
  const appetite: ProviderAppetite = {
    id: 'app-home-nv', providerOrganizationId: org.id, jurisdictions: ['NV'], linesOfBusiness: ['HOMEOWNERS'],
    riskMarkets: ['STANDARD'], renewalWindowDays: { min: 0, max: 500 }, active: true
  };
  assert.equal(evaluateProviderEligibility(challenge, org, [license], appetite).isEligible, true);

  const verifiedFacts = {
    'coverage.dwelling.limit': 450000, 'coverage.personalProperty.limit': 225000,
    'coverage.personalLiability.limit': 300000, 'coverage.property.deductible': 2000
  } as const;
  const offer: Offer = {
    id: 'OFFER-HOME-NV-1', challengeId: challenge.id, providerId: org.id, providerName: org.displayName,
    providerLicense: license.licenseNumber, carrier: 'Nevada Home Carrier', quoteNumber: 'QUOTE-HOME-1',
    annualPremium: 1650, monthlyPremium: 137.5, termMonths: 12, effectiveDate: '2026-11-01', expirationDate: '2027-11-01',
    coverages: [], verifiedFacts: { ...verifiedFacts }, insuranceLine: 'HOMEOWNERS', supportingQuoteDocName: 'home-quote.pdf',
    submittedAt: '2026-10-26T01:00:00.000Z', discrepanciesDetected: false, status: 'VALIDATED', round: 'OPEN', version: 1
  };
  const qualification = evaluateOfferQualification(offer, baseline, org, [{
    id: 'rel-home-nv', providerOrganizationId: org.id, carrierId: 'carrier-home', carrierName: offer.carrier,
    jurisdiction: 'NV', lineOfBusiness: 'HOMEOWNERS', relationshipType: 'APPOINTED', status: 'ACTIVE'
  }]);
  assert.equal(qualification.isQualified, true, qualification.disqualificationReasons.join('; '));
  const comparison = comparePolicyLineFacts({ insuranceLine: 'HOMEOWNERS', baseline: baseline.verifiedFacts || {}, offer: offer.verifiedFacts || {} });
  assert.equal(comparison.fields.find(field => field.fieldPath === 'coverage.property.deductible')?.relation, 'DIFFERENT');

  const version: OfferVersion = {
    id: 'VER-HOME-NV-1', offerId: offer.id, versionNumber: 1, round: 'OPEN', carrier: offer.carrier,
    annualPremium: offer.annualPremium, monthlyPremium: offer.monthlyPremium, coverages: [], verifiedFacts: { ...verifiedFacts },
    insuranceLine: 'HOMEOWNERS', supportingQuoteDocName: offer.supportingQuoteDocName, revisionReason: 'Initial offer', submittedAt: offer.submittedAt
  };
  const selection = createSelection({ challenge, offer, offerVersion: version, consumerId: challenge.consumerId });
  const handoff = initiateBindingHandoff({ selection, challenge });
  assert.equal(handoff.disclosureEventId, undefined);
  const consent = createConsentGrant({
    challengeId: challenge.id, consumerId: challenge.consumerId, recipientOrganizationId: org.id,
    purpose: 'AUTHORIZED_CONNECTION', purposeExplanation: 'Consumer-authorized homeowners connection',
    authorizedFieldNames: ['namedInsured', 'email', 'phone', 'propertyAddress'], now: new Date('2026-10-26T02:00:00.000Z')
  });
  const disclosure = validateAndExecuteDisclosure({
    consentGrant: consent, handoff, requestingProviderOrgId: org.id,
    fullConsumerData: { namedInsured: 'Sample Consumer', email: 'sample@example.test', phone: '702-555-0100', propertyAddress: '100 Sample Street', creditScore: 800 },
    now: new Date('2026-10-26T02:01:00.000Z')
  });
  assert.deepEqual(Object.keys(disclosure.disclosedData).sort(), ['email', 'namedInsured', 'phone', 'propertyAddress']);
  assert.equal(disclosure.disclosedData.creditScore, undefined);

  const tier = OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.memberships.SOLO;
  const planVersion = createCommercialPlanVersion({
    planId: tier.planCode, version: 2, effectiveFrom: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
    billingInterval: 'MONTHLY', recurringFeeCents: tier.priceCentsMonthly,
    termsSnapshot: {
      priceBookId: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id,
      authorizedConnectionCentsByInsuranceLine: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine },
      unavailableInsuranceLines: [...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.unavailableInsuranceLines],
      compensationDeterminationApproved: true, determinationReference: 'HOMEOWNERS-ACCEPTANCE-ONLY'
    }
  });
  const agreement = createCommercialAgreement({
    commercialAccountId: 'cac-home-nv', providerOrganizationId: org.id, planVersionId: planVersion.id,
    startsAt: '2026-10-17T00:00:00.000Z'
  });
  const event = buildCommercialEvent({
    providerOrganizationId: org.id, eventType: 'AUTHORIZED_CONNECTION', sourceEntityType: 'DISCLOSURE_EVENT',
    sourceEntityId: disclosure.disclosureEvent.id, challengeId: challenge.id,
    commercialAgreementId: agreement.id, commercialPlanVersionId: planVersion.id, metadata: { insuranceLine: 'HOMEOWNERS' }
  });
  const duplicate = buildCommercialEvent({
    providerOrganizationId: org.id, eventType: 'AUTHORIZED_CONNECTION', sourceEntityType: 'DISCLOSURE_EVENT',
    sourceEntityId: disclosure.disclosureEvent.id, challengeId: challenge.id,
    commercialAgreementId: agreement.id, commercialPlanVersionId: planVersion.id, metadata: { insuranceLine: 'HOMEOWNERS' }
  });
  assert.equal(event.idempotencyKey, duplicate.idempotencyKey);
  const rating = rateCommercialEvent({ event, agreement, planVersion });
  assert.equal(rating.disposition, 'BILLABLE');
  assert.equal(rating.amountCents, 9000);
});
