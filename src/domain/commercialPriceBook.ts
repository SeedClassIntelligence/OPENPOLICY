/** Founder-authorized Open Policy Premium Commercial Price Book, V1. */
export const OPEN_POLICY_PREMIUM_PRICE_BOOK_V1 = Object.freeze({
  id: 'OPEN_POLICY_PREMIUM_V1',
  effectiveFrom: '2026-10-14T00:00:00.000Z',
  currency: 'USD' as const,
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
  unpricedOutcomeEvents: Object.freeze(['BOUND_ACQUISITION', 'VERIFIED_BOUND_OUTCOME'])
});

// These prices remain part of the immutable founder-approved price book, but
// the corresponding product capabilities do not yet have complete enforced
// delivery surfaces. They therefore remain deliberately unavailable for new
// purchase instead of allowing Open Policy to invoice for an undeliverable
// service. Capacity add-ons (seat and jurisdiction) are operational.
export const OPEN_POLICY_PREMIUM_V1_UNAVAILABLE_SERVICE_ADD_ONS = Object.freeze([
  'WORKFLOW_AUTOMATION',
  'ENTERPRISE_REPORTING',
  'API_INTEGRATION',
  'MULTI_LOCATION_ADMINISTRATION'
] as const);

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
