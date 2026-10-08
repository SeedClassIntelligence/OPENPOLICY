import { pgTable, text, integer, boolean } from 'drizzle-orm/pg-core';

export const providerOrganizations = pgTable('provider_organizations', {
  id: text('id').primaryKey(),
  legalName: text('legal_name').notNull(),
  displayName: text('display_name').notNull(),
  organizationType: text('organization_type').notNull(),
  verificationStatus: text('verification_status').notNull(),
  marketplaceStatus: text('marketplace_status').notNull(),
  states: text('states').notNull(), // JSON string array
  linesOfBusiness: text('lines_of_business').notNull(), // JSON string array
  createdAt: text('created_at').notNull(),
  verifiedAt: text('verified_at')
});

export const providerUsers = pgTable('provider_users', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => providerOrganizations.id),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: text('created_at').notNull()
});

export const providerLicenses = pgTable('provider_licenses', {
  id: text('id').primaryKey(),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  jurisdiction: text('jurisdiction').notNull(),
  licenseNumber: text('license_number').notNull(),
  licenseType: text('license_type').notNull(),
  status: text('status').notNull(),
  expirationDate: text('expiration_date').notNull(),
  verifiedAt: text('verified_at')
});

export const carrierRelationships = pgTable('carrier_relationships', {
  id: text('id').primaryKey(),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  carrierId: text('carrier_id').notNull(),
  carrierName: text('carrier_name').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  lineOfBusiness: text('line_of_business').notNull(),
  relationshipType: text('relationship_type').notNull(),
  status: text('status').notNull()
});

export const providerAppetites = pgTable('provider_appetites', {
  providerOrganizationId: text('provider_organization_id').primaryKey().references(() => providerOrganizations.id),
  jurisdictions: text('jurisdictions').notNull(), // JSON string array
  linesOfBusiness: text('lines_of_business').notNull(), // JSON string array
  minAnnualPremium: integer('min_annual_premium'),
  maxAnnualPremium: integer('max_annual_premium'),
  targetVehicleYearsMin: integer('target_vehicle_years_min'),
  targetVehicleYearsMax: integer('target_vehicle_years_max'),
  preferredRiskTiers: text('preferred_risk_tiers'), // JSON string array
  excludedVehicleTypes: text('excluded_vehicle_types') // JSON string array
});

export const competitions = pgTable('competitions', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  lineOfBusiness: text('line_of_business').notNull(),
  status: text('status').notNull(),
  currentRound: text('current_round').notNull(),
  participantCount: integer('participant_count').notNull().default(0),
  openedAt: text('opened_at').notNull(),
  closesAt: text('closes_at').notNull(),
  rules: text('rules') // JSON string
});

export const challengeInvitations = pgTable('challenge_invitations', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  competitionId: text('competition_id').notNull().references(() => competitions.id),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  status: text('status').notNull(),
  invitedAt: text('invited_at').notNull(),
  viewedAt: text('viewed_at'),
  acceptedAt: text('accepted_at'),
  declinedAt: text('declined_at'),
  declineReason: text('decline_reason'),
  declineNotes: text('decline_notes')
});

export const challengeParticipations = pgTable('challenge_participations', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  competitionId: text('competition_id').notNull().references(() => competitions.id),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  acceptedAt: text('accepted_at').notNull(),
  status: text('status').notNull(),
  lastActivityAt: text('last_activity_at').notNull()
});

export const challenges = pgTable('challenges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  referenceNumber: text('reference_number').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  baselineData: text('baseline_data'), // JSON string
  requirementsData: text('requirements_data'), // immutable historical JSON
  qualificationStandardVersion: text('qualification_standard_version'),
  legacyRequirementsData: text('legacy_requirements_data')
});

export const policies = pgTable('policies', {
  id: text('id').primaryKey(),
  policyNumber: text('policy_number').notNull(),
  carrier: text('carrier').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  namedInsured: text('named_insured').notNull(),
  effectiveDate: text('effective_date').notNull(),
  expirationDate: text('expiration_date').notNull(),
  annualPremium: integer('annual_premium').notNull(),
  status: text('status').notNull(),
  payload: text('payload') // JSON string
});

export const offers = pgTable('offers', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  providerId: text('provider_id').notNull(),
  providerName: text('provider_name').notNull(),
  carrier: text('carrier').notNull(),
  annualPremium: integer('annual_premium').notNull(),
  monthlyPremium: integer('monthly_premium').notNull(),
  status: text('status').notNull(),
  round: text('round').notNull(),
  version: integer('version').notNull().default(1),
  previousOfferId: text('previous_offer_id'),
  isLatestRevision: boolean('is_latest_revision').notNull().default(true),
  payload: text('payload') // JSON string
});

export const auditEvents = pgTable('audit_events', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  eventType: text('event_type').notNull(),
  actorRole: text('actor_role').notNull(),
  actorId: text('actor_id').notNull(),
  details: text('details').notNull(),
  hash: text('hash').notNull()
});

export const commercialAccounts = pgTable('commercial_accounts', {
  id: text('id').primaryKey(),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  status: text('status').notNull(),
  currency: text('currency').notNull().default('USD'),
  externalBillingCustomerRef: text('external_billing_customer_ref'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const commercialPlans = pgTable('commercial_plans', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  displayName: text('display_name').notNull(),
  providerSegment: text('provider_segment').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: text('created_at').notNull()
});

export const commercialPlanVersions = pgTable('commercial_plan_versions', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => commercialPlans.id),
  version: integer('version').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  effectiveUntil: text('effective_until'),
  billingInterval: text('billing_interval').notNull(),
  recurringFeeCents: integer('recurring_fee_cents').notNull(),
  currency: text('currency').notNull().default('USD'),
  termsSnapshot: text('terms_snapshot').notNull(),
  createdAt: text('created_at').notNull()
});

export const commercialAgreements = pgTable('commercial_agreements', {
  id: text('id').primaryKey(),
  commercialAccountId: text('commercial_account_id').notNull().references(() => commercialAccounts.id),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  planVersionId: text('plan_version_id').notNull().references(() => commercialPlanVersions.id),
  status: text('status').notNull(),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at'),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at').notNull()
});

export const providerEntitlements = pgTable('provider_entitlements', {
  id: text('id').primaryKey(),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  commercialAgreementId: text('commercial_agreement_id').notNull().references(() => commercialAgreements.id),
  entitlementType: text('entitlement_type').notNull(),
  limitVal: integer('limit_val'),
  enforcementPolicy: text('enforcement_policy').notNull().default('HARD_BLOCK'),
  scope: text('scope'),
  effectiveFrom: text('effective_from').notNull(),
  effectiveUntil: text('effective_until'),
  createdAt: text('created_at').notNull()
});

export const commercialUsageRecords = pgTable('commercial_usage_records', {
  id: text('id').primaryKey(),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  commercialAgreementId: text('commercial_agreement_id').references(() => commercialAgreements.id),
  entitlementId: text('entitlement_id').references(() => providerEntitlements.id),
  usageType: text('usage_type').notNull(),
  quantity: integer('quantity').notNull().default(1),
  invitationId: text('invitation_id'),
  challengeId: text('challenge_id'),
  participationId: text('participation_id'),
  consumedAt: text('consumed_at').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  policyMode: text('policy_mode').notNull(),
  isOverage: boolean('is_overage').notNull().default(false),
  metadata: text('metadata')
});

export const commercialEvents = pgTable('commercial_events', {
  id: text('id').primaryKey(),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  eventType: text('event_type').notNull(),
  sourceEntityType: text('source_entity_type').notNull(),
  sourceEntityId: text('source_entity_id').notNull(),
  challengeId: text('challenge_id'),
  competitionId: text('competition_id'),
  commercialAgreementId: text('commercial_agreement_id'),
  commercialPlanVersionId: text('commercial_plan_version_id'),
  occurredAt: text('occurred_at').notNull(),
  metadata: text('metadata'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  eventHash: text('event_hash').notNull()
});

export const billableEvents = pgTable('billable_events', {
  id: text('id').primaryKey(),
  commercialEventId: text('commercial_event_id').notNull().references(() => commercialEvents.id),
  providerOrganizationId: text('provider_organization_id').notNull().references(() => providerOrganizations.id),
  commercialAgreementId: text('commercial_agreement_id').notNull().references(() => commercialAgreements.id),
  chargeCode: text('charge_code').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull(),
  ratedAt: text('rated_at').notNull(),
  pricingSnapshot: text('pricing_snapshot').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique()
});
