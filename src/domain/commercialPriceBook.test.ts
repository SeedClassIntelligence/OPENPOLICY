import test from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2 } from './commercialPriceBook';
import { assembleDraftInvoice, buildCommercialEvent, rateCommercialEvent } from './commercialEconomicsEngine';
import type { CommercialAgreement, CommercialPlanVersion } from '../types/insurance';

const agreement: CommercialAgreement = {
  id: 'agreement-pricebook-v2', commercialAccountId: 'account-pricebook',
  providerOrganizationId: 'org-pricebook', planVersionId: 'pricebook-v2',
  status: 'ACTIVE', startsAt: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
  acceptedAt: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
  createdAt: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom
};

const planVersion: CommercialPlanVersion = {
  id: 'pricebook-v2', planId: 'plan_open_policy_premium', version: 2,
  effectiveFrom: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
  billingInterval: 'MONTHLY',
  recurringFeeCents: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.memberships.PREMIUM.priceCentsMonthly,
  currency: 'USD', createdAt: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
  termsSnapshot: {
    priceBookId: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id,
    includedProducerSeats: 5, includedJurisdictions: 3,
    authorizedConnectionCentsByInsuranceLine: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine },
    recurringAddOns: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.recurringAddOns },
    compensationDeterminationApproved: true,
    determinationReference: 'TEST-APPROVED-DETERMINATION'
  }
};

test('Commercial V2 trial waives only recurring membership for 30 days', () => {
  assert.deepEqual(OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.membershipTrial, {
    durationDays: 30,
    waives: 'RECURRING_MEMBERSHIP_ONLY',
    authorizedConnectionFeesRemainBillable: true,
    recurringAddOnsRemainBillable: true,
    enterpriseImplementationRemainsBillable: true,
    maximumTrialsPerProviderOrganization: 1
  });
  assert.equal(OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine.PERSONAL_AUTO, 7_500);
});

test('authorized connections use the published insurance-line prices', () => {
  for (const [insuranceLine, expected] of Object.entries(OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine)) {
    const event = buildCommercialEvent({
      providerOrganizationId: agreement.providerOrganizationId, eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DISCLOSURE_EVENT', sourceEntityId: `disclosure-${insuranceLine}`,
      challengeId: `challenge-${insuranceLine}`, commercialAgreementId: agreement.id,
      commercialPlanVersionId: planVersion.id, metadata: { insuranceLine }
    });
    const decision = rateCommercialEvent({ event, agreement, planVersion });
    assert.equal(decision.disposition, 'BILLABLE', insuranceLine);
    assert.equal(decision.amountCents, expected, insuranceLine);
  }
});

test('unpriced acquisition outcomes and telemetry remain zero-rated', () => {
  for (const eventType of [
    'BOUND_ACQUISITION', 'VERIFIED_BOUND_OUTCOME', ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.freeMarketplaceEvents
  ] as const) {
    const event = buildCommercialEvent({
      providerOrganizationId: agreement.providerOrganizationId, eventType,
      sourceEntityType: 'TEST', sourceEntityId: `source-${eventType}`,
      commercialAgreementId: agreement.id, commercialPlanVersionId: planVersion.id
    });
    const decision = rateCommercialEvent({ event, agreement, planVersion });
    assert.equal(decision.billable, false, eventType);
    assert.equal(decision.amountCents, 0, eventType);
  }
});

test('connection pricing fails closed when insurance line is absent', () => {
  const event = buildCommercialEvent({
    providerOrganizationId: agreement.providerOrganizationId, eventType: 'AUTHORIZED_CONNECTION',
    sourceEntityType: 'DISCLOSURE_EVENT', sourceEntityId: 'missing-line',
    commercialAgreementId: agreement.id, commercialPlanVersionId: planVersion.id
  });
  const decision = rateCommercialEvent({ event, agreement, planVersion });
  assert.equal(decision.disposition, 'NOT_RATED');
  assert.equal(decision.error, 'INSURANCE_LINE_REQUIRED');
});

test('contracted recurring add-ons flow into an historically anchored invoice', () => {
  const contractedVersion: CommercialPlanVersion = {
    ...planVersion,
    termsSnapshot: {
      ...planVersion.termsSnapshot,
      recurringAddOns: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.recurringAddOns },
      selectedRecurringAddOns: { ADDITIONAL_PRODUCER_SEAT: 2, WORKFLOW_AUTOMATION: 1,
        ENTERPRISE_REPORTING: 1, API_INTEGRATION: 1, MULTI_LOCATION_ADMINISTRATION: 1 }
    }
  };
  const { invoice, lineItems } = assembleDraftInvoice({
    billingPeriod: {
      id: 'period-pricebook', providerOrganizationId: agreement.providerOrganizationId,
      commercialAgreementId: agreement.id, commercialPlanVersionId: contractedVersion.id,
      periodStart: '2026-11-01T00:00:00.000Z', periodEnd: '2026-12-01T00:00:00.000Z',
      status: 'OPEN', createdAt: '2026-11-01T00:00:00.000Z'
    },
    planVersion: contractedVersion, billableEvents: [], ratingAdjustments: [],
    invoiceId: 'invoice-pricebook', invoiceNumber: 'INV-PRICEBOOK', now: '2026-12-01T00:00:00.000Z'
  });
  assert.equal(lineItems.length, 6);
  assert.equal(invoice.subtotalCents, 49_900 + (2 * 4_900) + 19_900 + 29_900 + 49_900 + 19_900);
});

test('executed enterprise implementation agreement creates one exact one-time invoice line', () => {
  const { invoice, lineItems } = assembleDraftInvoice({
    billingPeriod: {
      id: 'period-implementation', providerOrganizationId: agreement.providerOrganizationId,
      commercialAgreementId: agreement.id, commercialPlanVersionId: planVersion.id,
      periodStart: '2026-11-01T00:00:00.000Z', periodEnd: '2026-12-01T00:00:00.000Z',
      status: 'OPEN', createdAt: '2026-11-01T00:00:00.000Z'
    },
    planVersion, billableEvents: [], ratingAdjustments: [],
    negotiatedServiceCharges: [{
      id: 'service-implementation-1', providerOrganizationId: agreement.providerOrganizationId,
      commercialAgreementId: agreement.id, serviceCode: 'ENTERPRISE_IMPLEMENTATION',
      amountCents: 725_000, currency: 'USD', executedAgreementReference: 'MSA-2026-1014',
      supportingReference: 'gs://contracts/msa-2026-1014.pdf', effectiveAt: '2026-11-15T00:00:00.000Z',
      status: 'APPROVED', authorizedBy: 'admin-1', authorizedAt: '2026-10-14T00:00:00.000Z',
      idempotencyKey: 'implementation:agreement-pricebook-v1:MSA-2026-1014'
    }],
    invoiceId: 'invoice-implementation', invoiceNumber: 'INV-IMPLEMENTATION', now: '2026-12-01T00:00:00.000Z'
  });
  const serviceLine = lineItems.find(line => line.lineType === 'ONE_TIME_SERVICE');
  assert.equal(serviceLine?.amountCents, 725_000);
  assert.equal(serviceLine?.negotiatedServiceChargeId, 'service-implementation-1');
  assert.equal(invoice.totalDueCents, 49_900 + 725_000);
});

test('V2 publishes the complete founder-authorized tier and capacity network', () => {
  const book = OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2;
  assert.equal(book.consumerPriceCents, 0);
  assert.deepEqual(Object.fromEntries(Object.entries(book.memberships).map(([tier, value]) =>
    [tier, [value.priceCentsMonthly, value.producerSeats, value.jurisdictions,
      value.concurrentCompetitions, value.monthlyOfferSubmissions]])), {
    SOLO: [9_900, 1, 1, 5, 25], AGENCY: [24_900, 3, 2, 20, 100],
    PREMIUM: [49_900, 5, 3, 60, 300], NETWORK: [99_900, 15, 5, 200, 1_000],
    ENTERPRISE: [199_900, 30, 10, 500, 2_500]
  });
  assert.deepEqual(book.memberships.NETWORK.includedServices, ['MULTI_LOCATION_ADMINISTRATION']);
  assert.deepEqual(book.memberships.ENTERPRISE.includedServices,
    ['MULTI_LOCATION_ADMINISTRATION', 'ENTERPRISE_REPORTING']);
  assert.deepEqual(book.recurringAddOns, {
    ADDITIONAL_PRODUCER_SEAT: 3_500, ADDITIONAL_JURISDICTION: 5_000,
    ADDITIONAL_10_CONCURRENT_COMPETITIONS: 5_000,
    ADDITIONAL_100_MONTHLY_OFFER_SUBMISSIONS: 5_000,
    WORKFLOW_AUTOMATION: 14_900, ENTERPRISE_REPORTING: 19_900,
    API_INTEGRATION: 39_900, MULTI_LOCATION_ADMINISTRATION: 14_900
  });
});

test('V2 rates approved line-specific authorized connections as the marketplace transaction', () => {
  const tier = OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.memberships.SOLO;
  const v2Version: CommercialPlanVersion = {
    ...planVersion, id: 'pricebook-v2', version: 2,
    effectiveFrom: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
    recurringFeeCents: tier.priceCentsMonthly,
    termsSnapshot: {
      priceBookId: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id,
      includedProducerSeats: tier.producerSeats, includedJurisdictions: tier.jurisdictions,
      includedConcurrentCompetitions: tier.concurrentCompetitions,
      includedMonthlyOfferSubmissions: tier.monthlyOfferSubmissions,
      freeMarketplaceEvents: [...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.freeMarketplaceEvents],
      authorizedConnectionCentsByInsuranceLine: {
        ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine
      },
      unavailableInsuranceLines: [...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.unavailableInsuranceLines],
      compensationDeterminationApproved: true, determinationReference: 'V2-TEST'
    }
  };
  for (const [insuranceLine, expected] of Object.entries(
    OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine)) {
    const decision = rateCommercialEvent({ event: buildCommercialEvent({
      providerOrganizationId: agreement.providerOrganizationId, eventType: 'AUTHORIZED_CONNECTION',
      sourceEntityType: 'DISCLOSURE_EVENT', sourceEntityId: `v2-${insuranceLine}`,
      commercialAgreementId: agreement.id, commercialPlanVersionId: v2Version.id,
      metadata: { insuranceLine }
    }), agreement: { ...agreement, planVersionId: v2Version.id }, planVersion: v2Version });
    assert.equal(decision.disposition, 'BILLABLE', insuranceLine);
    assert.equal(decision.amountCents, expected, insuranceLine);
  }
  assert.equal('MEDICARE' in OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine, false);
  assert.deepEqual(OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.unavailableInsuranceLines, ['MEDICARE']);
});
