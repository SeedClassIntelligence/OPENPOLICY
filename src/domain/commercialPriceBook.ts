/** Founder-authorized Open Policy Premium Commercial Price Book, V1. */
export const OPEN_POLICY_PREMIUM_PRICE_BOOK_V1 = Object.freeze({
  id: 'OPEN_POLICY_PREMIUM_V1',
  effectiveFrom: '2026-10-14T00:00:00.000Z',
  currency: 'USD' as const,
  consumerPriceCents: 0,
  providerMembershipCentsMonthly: 49_900,
  includedProducerSeats: 2,
  includedJurisdictions: 1,
  recurringAddOns: Object.freeze({
    ADDITIONAL_PRODUCER_SEAT: 4_900,
    ADDITIONAL_JURISDICTION: 7_500,
    WORKFLOW_AUTOMATION: 19_900,
    ENTERPRISE_REPORTING: 29_900,
    API_INTEGRATION: 49_900,
    MULTI_LOCATION_ADMINISTRATION: 19_900
  }),
  implementationServices: Object.freeze({
    ENTERPRISE_IMPLEMENTATION_MIN_CENTS: 250_000,
    ENTERPRISE_IMPLEMENTATION_MAX_CENTS: 1_000_000,
    requiresNegotiatedAgreement: true
  }),
  qualifiedEngagementCents: 3_500,
  freeMarketplaceEvents: Object.freeze([
    'VPO_AVAILABLE',
    'VPO_VIEWED',
    'PROPOSITION_SUBMITTED',
    'CONSUMER_SELECTED',
    'BASELINE_ACTIVATED'
  ] as const),
  authorizedConnectionCentsByInsuranceLine: Object.freeze({
    PERSONAL_AUTO: 12_500,
    HOMEOWNERS: 15_000,
    RENTERS: 10_000,
    TERM_LIFE: 22_500,
    INDIVIDUAL_HEALTH: 15_000,
    MEDICARE: 20_000,
    COMMERCIAL_GENERAL_LIABILITY: 35_000,
    BUSINESS_OWNERS_POLICY: 35_000,
    COMMERCIAL_AUTO: 35_000
  }),
  authorizedConnectionMinimumCents: 10_000,
  authorizedConnectionMaximumCents: 35_000,
  unavailableInsuranceLines: Object.freeze(['MEDICARE'] as const),
  unpricedOutcomeEvents: Object.freeze(['BOUND_ACQUISITION', 'VERIFIED_BOUND_OUTCOME'] as const)
});

// Every priced V1 add-on now has an entitlement-enforced delivery surface.
// Keep this fail-closed registry for any future price published before its
// corresponding product capability is accepted.
export const OPEN_POLICY_PREMIUM_V1_UNAVAILABLE_SERVICE_ADD_ONS = Object.freeze([] as const);

export function isOperationalConnectionInsuranceLine(
  terms: Record<string, unknown>,
  insuranceLine: string | undefined
): boolean {
  if (!insuranceLine) return false;
  const unavailable = Array.isArray(terms.unavailableInsuranceLines)
    ? terms.unavailableInsuranceLines
    : OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.unavailableInsuranceLines;
  return !(unavailable as readonly string[]).includes(insuranceLine);
}

export function connectionPriceForInsuranceLine(
  terms: Record<string, unknown>,
  insuranceLine: string | undefined
): number | undefined {
  if (!insuranceLine) return undefined;
  const table = terms.authorizedConnectionCentsByInsuranceLine;
  if (!table || typeof table !== 'object') return undefined;
  const value = (table as Record<string, unknown>)[insuranceLine];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}
