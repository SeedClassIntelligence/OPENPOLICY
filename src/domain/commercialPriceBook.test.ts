import test from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_POLICY_PREMIUM_PRICE_BOOK_V1, OPEN_POLICY_PREMIUM_V1_UNAVAILABLE_SERVICE_ADD_ONS } from './commercialPriceBook';
import { assembleDraftInvoice, buildCommercialEvent, rateCommercialEvent } from './commercialEconomicsEngine';
import type { CommercialAgreement, CommercialPlanVersion } from '../types/insurance';

const agreement: CommercialAgreement = {
  id: 'agreement-pricebook-v1', commercialAccountId: 'account-pricebook',
  providerOrganizationId: 'org-pricebook', planVersionId: 'pricebook-v1',
  status: 'ACTIVE', startsAt: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom,
  acceptedAt: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom,
  createdAt: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom
};

const planVersion: CommercialPlanVersion = {
  id: 'pricebook-v1', planId: 'plan_open_policy_premium', version: 1,
  effectiveFrom: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom,
  billingInterval: 'MONTHLY',
  recurringFeeCents: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.providerMembershipCentsMonthly,
  currency: 'USD', createdAt: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom,
  termsSnapshot: {
    priceBookId: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.id,
    includedProducerSeats: 2, includedJurisdictions: 1,
    qualifiedEngagementUnitPriceCents: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.qualifiedEngagementCents,
    authorizedConnectionCentsByInsuranceLine: { ...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.authorizedConnectionCentsByInsuranceLine },
    recurringAddOns: { ...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.recurringAddOns },
    compensationDeterminationApproved: true,
    determinationReference: 'TEST-APPROVED-DETERMINATION'
  }
};

test('premium price book publishes the founder-authorized subscription and service prices', () => {
  const book = OPEN_POLICY_PREMIUM_PRICE_BOOK_V1;
  assert.equal(book.providerMembershipCentsMonthly, 49_900);
  assert.equal(book.consumerPriceCents, 0);
  assert.equal(book.includedProducerSeats, 2);
  assert.equal(book.includedJurisdictions, 1);
  assert.deepEqual(book.recurringAddOns, {
    ADDITIONAL_PRODUCER_SEAT: 4_900, ADDITIONAL_JURISDICTION: 7_500,
    WORKFLOW_AUTOMATION: 19_900, ENTERPRISE_REPORTING: 29_900,
    API_INTEGRATION: 49_900, MULTI_LOCATION_ADMINISTRATION: 19_900
  });
  assert.equal(book.implementationServices.ENTERPRISE_IMPLEMENTATION_MIN_CENTS, 250_000);
  assert.equal(book.implementationServices.ENTERPRISE_IMPLEMENTATION_MAX_CENTS, 1_000_000);
  assert.equal(book.authorizedConnectionMinimumCents, 10_000);
  assert.equal(book.authorizedConnectionMaximumCents, 35_000);
  assert.deepEqual(book.unavailableInsuranceLines, ['MEDICARE']);
});

test('all priced V1 premium services have accepted entitlement-enforced delivery surfaces', () => {
  assert.deepEqual(OPEN_POLICY_PREMIUM_V1_UNAVAILABLE_SERVICE_ADD_ONS, []);
  for (const code of ['WORKFLOW_AUTOMATION','ENTERPRISE_REPORTING','API_INTEGRATION','MULTI_LOCATION_ADMINISTRATION'] as const) {
    assert.ok(OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.recurringAddOns[code] > 0, `${code} price is published`);
  }
});

test('qualified engagement is billed exactly once at $35 by its canonical commercial event', () => {
  const event = buildCommercialEvent({
    providerOrganizationId: agreement.providerOrganizationId, eventType: 'VPO_ENGAGED',
    sourceEntityType: 'CHALLENGE_PARTICIPATION', sourceEntityId: 'participation-1',
    challengeId: 'challenge-1', commercialAgreementId: agreement.id,
    commercialPlanVersionId: planVersion.id,
    idempotencyKey: 'evt:VPO_ENGAGED:org-pricebook:challenge-1'
  });
  const decision = rateCommercialEvent({ event, agreement, planVersion });
  assert.equal(decision.disposition, 'BILLABLE');
  assert.equal(decision.chargeCode, 'QUALIFIED_ENGAGEMENT_FEE');
  assert.equal(decision.amountCents, 3_500);
});

test('authorized connections use the published insurance-line prices', () => {
  for (const [insuranceLine, expected] of Object.entries(OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.authorizedConnectionCentsByInsuranceLine)) {
    if (OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.unavailableInsuranceLines.includes(insuranceLine as 'MEDICARE')) continue;
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
    'BOUND_ACQUISITION', 'VERIFIED_BOUND_OUTCOME', ...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.freeMarketplaceEvents
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

test('Medicare connection price remains registered but cannot be rated in V1', () => {
  assert.equal(OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.authorizedConnectionCentsByInsuranceLine.MEDICARE, 20_000);
  const event = buildCommercialEvent({
    providerOrganizationId: agreement.providerOrganizationId, eventType: 'AUTHORIZED_CONNECTION',
    sourceEntityType: 'DISCLOSURE_EVENT', sourceEntityId: 'disclosure-medicare',
    challengeId: 'challenge-medicare', commercialAgreementId: agreement.id,
    commercialPlanVersionId: planVersion.id, metadata: { insuranceLine: 'MEDICARE' }
  });
  const decision = rateCommercialEvent({ event, agreement, planVersion });
  assert.equal(decision.disposition, 'NOT_RATED');
  assert.equal(decision.billable, false);
  assert.equal(decision.amountCents, 0);
  assert.equal(decision.error, 'INSURANCE_LINE_NOT_OPERATIONAL');
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
      recurringAddOns: { ...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.recurringAddOns },
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
