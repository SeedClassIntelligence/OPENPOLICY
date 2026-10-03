/**
 * Open Policy Commercial Economics Engine (CE-1 through CE-4)
 * 
 * Formal Invariants:
 * 1. COMMERCIAL_NEUTRALITY: No commercial object may be read by comparison,
 *    competition evaluation, qualification, sorting, selection, disclosure, or PM-5 reconciliation.
 * 2. Immutable Pricing: CommercialPlanVersion pricing and terms are strictly immutable.
 * 3. Idempotent Commercial Events: Event ledger is append-only with deterministic keys.
 * 4. Distinct Identities: ProviderOrganization (marketplace/regulatory) is decoupled
 *    from CommercialAccount (contractual/commercial).
 * 5. Deterministic Rating: Pure functions evaluate agreements without network or database I/O.
 */

import crypto from 'crypto';
import {
  CommercialAccount,
  CommercialPlan,
  CommercialPlanVersion,
  CommercialAgreement,
  ProviderEntitlement,
  EntitlementType,
  CapacityEnforcementPolicy,
  CommercialCapacityResult,
  CommercialAgreementStatus,
  CommercialUsageRecord,
  CommercialEvent,
  CommercialEventType,
  BillableEvent,
  RatingDecision,
  RatingDisposition,
  RatingAdjustment,
  RatingAdjustmentType,
  RatingRun,
  CommercialValueSummary,
  BillingPeriod,
  BillingPeriodStatus,
  Invoice,
  InvoiceStatus,
  InvoiceLineItem,
  InvoiceLineType,
  PaymentRecord,
  PaymentMethod,
  PaymentStatus,
  RefundRecord,
  SettlementAllocation,
  ProviderAccountBalance
} from '../types/insurance';

/**
 * Creates a new CommercialAccount for a ProviderOrganization.
 */
export function createCommercialAccount(params: {
  providerOrganizationId: string;
  externalBillingCustomerRef?: string;
  status?: CommercialAccount['status'];
  now?: string;
}): CommercialAccount {
  const timestamp = params.now || new Date().toISOString();
  return {
    id: `cac_${params.providerOrganizationId}`,
    providerOrganizationId: params.providerOrganizationId,
    status: params.status || 'ACTIVE',
    currency: 'USD',
    externalBillingCustomerRef: params.externalBillingCustomerRef,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * Creates an immutable CommercialPlanVersion.
 */
export function createCommercialPlanVersion(params: {
  planId: string;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  billingInterval: CommercialPlanVersion['billingInterval'];
  recurringFeeCents: number;
  termsSnapshot: CommercialPlanVersion['termsSnapshot'];
  now?: string;
}): CommercialPlanVersion {
  return {
    id: `cpv_${params.planId}_v${params.version}`,
    planId: params.planId,
    version: params.version,
    effectiveFrom: params.effectiveFrom,
    effectiveUntil: params.effectiveUntil,
    billingInterval: params.billingInterval,
    recurringFeeCents: params.recurringFeeCents,
    currency: 'USD',
    termsSnapshot: Object.freeze({ ...params.termsSnapshot }),
    createdAt: params.now || new Date().toISOString()
  };
}

/**
 * Creates a contractual CommercialAgreement binding an account to a plan version.
 */
export function createCommercialAgreement(params: {
  commercialAccountId: string;
  providerOrganizationId: string;
  planVersionId: string;
  startsAt: string;
  endsAt?: string;
  acceptedAt?: string;
  status?: CommercialAgreement['status'];
  now?: string;
}): CommercialAgreement {
  const timestamp = params.now || new Date().toISOString();
  return {
    id: `cag_${params.providerOrganizationId}_${Date.now()}`,
    commercialAccountId: params.commercialAccountId,
    providerOrganizationId: params.providerOrganizationId,
    planVersionId: params.planVersionId,
    status: params.status || 'ACTIVE',
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    acceptedAt: params.acceptedAt || timestamp,
    createdAt: timestamp
  };
}

/**
 * Derives default provider entitlements from an agreement's plan version snapshot.
 */
export function deriveEntitlementsFromPlanVersion(params: {
  agreement: CommercialAgreement;
  planVersion: CommercialPlanVersion;
  now?: string;
}): ProviderEntitlement[] {
  const { agreement, planVersion } = params;
  const timestamp = params.now || new Date().toISOString();
  const snapshot = planVersion.termsSnapshot || {};
  const defaultPolicy: CapacityEnforcementPolicy = (snapshot.capacityEnforcementPolicy as CapacityEnforcementPolicy) || 'HARD_BLOCK';

  const entitlements: ProviderEntitlement[] = [];

  const add = (type: EntitlementType, limit?: number, policy?: CapacityEnforcementPolicy, scope?: Record<string, unknown>) => {
    entitlements.push({
      id: `ent_${agreement.id}_${type.toLowerCase()}`,
      providerOrganizationId: agreement.providerOrganizationId,
      commercialAgreementId: agreement.id,
      entitlementType: type,
      limit,
      enforcementPolicy: policy || defaultPolicy,
      scope,
      effectiveFrom: agreement.startsAt,
      effectiveUntil: agreement.endsAt,
      createdAt: timestamp
    });
  };

  if (snapshot.includedProducerSeats !== undefined) {
    add('PROVIDER_SEATS', snapshot.includedProducerSeats);
  }
  if (snapshot.includedJurisdictions !== undefined) {
    add('JURISDICTION_CAPACITY', snapshot.includedJurisdictions);
  }
  if (snapshot.includedVpoCapacity !== undefined) {
    add('VPO_VIEW_CAPACITY', snapshot.includedVpoCapacity);
  }
  if (snapshot.includedEngagementCapacity !== undefined) {
    add('VPO_ENGAGEMENT_CAPACITY', snapshot.includedEngagementCapacity);
  }

  return entitlements;
}

/**
 * Formally validates and transitions commercial agreement lifecycle states:
 * PENDING -> ACTIVE, TERMINATED
 * ACTIVE -> SUSPENDED, EXPIRED, TERMINATED
 * SUSPENDED -> ACTIVE, EXPIRED, TERMINATED
 * EXPIRED -> terminal
 * TERMINATED -> terminal
 */
export function transitionAgreementLifecycle(params: {
  currentAgreement: CommercialAgreement;
  targetStatus: CommercialAgreementStatus;
  reason?: string;
  now?: string;
}): { success: boolean; agreement: CommercialAgreement; error?: string } {
  const { currentAgreement, targetStatus, now = new Date().toISOString() } = params;
  const current = currentAgreement.status;

  if (current === targetStatus) {
    return { success: true, agreement: currentAgreement };
  }

  const allowedTransitions: Record<CommercialAgreementStatus, CommercialAgreementStatus[]> = {
    PENDING: ['ACTIVE', 'TERMINATED'],
    ACTIVE: ['SUSPENDED', 'EXPIRED', 'TERMINATED'],
    SUSPENDED: ['ACTIVE', 'EXPIRED', 'TERMINATED'],
    EXPIRED: [],
    TERMINATED: []
  };

  const allowed = allowedTransitions[current] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      success: false,
      agreement: currentAgreement,
      error: `Invalid agreement lifecycle transition: cannot move agreement from ${current} to ${targetStatus}`
    };
  }

  const updated: CommercialAgreement = {
    ...currentAgreement,
    status: targetStatus,
    endsAt: (targetStatus === 'TERMINATED' || targetStatus === 'EXPIRED') ? (currentAgreement.endsAt || now) : currentAgreement.endsAt
  };

  return { success: true, agreement: updated };
}

/**
 * Deterministically checks entitlement capacity and evaluates capacity policies:
 * - HARD_BLOCK: The governed action cannot consume capacity beyond contractual limit.
 * - ALLOW_OVERAGE: Permits action, records usage as overage for downstream rating.
 * - NOTIFY_ONLY: Permits action, exposes capacity condition without blocking.
 */
export function checkEntitlementCapacity(params: {
  entitlements: ProviderEntitlement[];
  entitlementType: EntitlementType;
  currentUsage: number;
  agreementStatus?: CommercialAgreementStatus;
}): CommercialCapacityResult {
  const { entitlements, entitlementType, currentUsage, agreementStatus = 'ACTIVE' } = params;

  // Lifecycle invariant: inactive or unconfigured agreements grant ZERO commercial capacity
  if (agreementStatus !== 'ACTIVE') {
    return {
      allowed: false,
      code: 'NO_ACTIVE_AGREEMENT',
      isOverage: false,
      currentUsage,
      enforcementPolicy: 'HARD_BLOCK',
      reason: `Commercial agreement status is ${agreementStatus}: provider cannot consume marketplace capacity`
    };
  }

  const entitlement = entitlements.find(e => e.entitlementType === entitlementType);

  if (!entitlement) {
    return {
      allowed: false,
      code: 'COMMERCIAL_CAPACITY_REACHED',
      isOverage: false,
      currentUsage,
      enforcementPolicy: 'HARD_BLOCK',
      reason: `No active entitlement found for ${entitlementType}`
    };
  }

  const policy = entitlement.enforcementPolicy || 'HARD_BLOCK';

  // Unlimited capacity
  if (entitlement.limit === undefined || entitlement.limit === null || entitlement.limit === -1) {
    return {
      allowed: true,
      code: 'WITHIN_CAPACITY',
      isOverage: false,
      currentUsage,
      limit: undefined,
      enforcementPolicy: policy
    };
  }

  // Within purchased capacity
  if (currentUsage < entitlement.limit) {
    return {
      allowed: true,
      code: 'WITHIN_CAPACITY',
      isOverage: false,
      currentUsage,
      limit: entitlement.limit,
      enforcementPolicy: policy
    };
  }

  // At or over capacity limit
  if (policy === 'HARD_BLOCK') {
    return {
      allowed: false,
      code: 'COMMERCIAL_CAPACITY_REACHED',
      isOverage: false,
      currentUsage,
      limit: entitlement.limit,
      enforcementPolicy: 'HARD_BLOCK',
      reason: `Commercial capacity reached for ${entitlementType}: ${currentUsage}/${entitlement.limit} under HARD_BLOCK policy`
    };
  }

  if (policy === 'ALLOW_OVERAGE') {
    return {
      allowed: true,
      code: 'OVERAGE_PERMITTED',
      isOverage: true,
      currentUsage,
      limit: entitlement.limit,
      enforcementPolicy: 'ALLOW_OVERAGE',
      reason: `Usage exceeds limit (${currentUsage}/${entitlement.limit}); permitted under ALLOW_OVERAGE policy`
    };
  }

  if (policy === 'NOTIFY_ONLY') {
    return {
      allowed: true,
      code: 'NOTIFY_CAPACITY_EXCEEDED',
      isOverage: true,
      currentUsage,
      limit: entitlement.limit,
      enforcementPolicy: 'NOTIFY_ONLY',
      reason: `Usage exceeds limit (${currentUsage}/${entitlement.limit}); notification emitted under NOTIFY_ONLY policy`
    };
  }

  return {
    allowed: false,
    code: 'COMMERCIAL_CAPACITY_REACHED',
    isOverage: false,
    currentUsage,
    limit: entitlement.limit,
    enforcementPolicy: 'HARD_BLOCK'
  };
}

/**
 * TEST FIXTURE HELPER: Creates an isolated commercial plan version strictly for test suites.
 * Explicitly identified as TEST FIXTURES to ensure zero production pricing assumptions are seeded.
 */
export function createTestFixturePlanVersion(params: {
  planId: string;
  version?: number;
  recurringFeeCents?: number;
  billingInterval?: CommercialPlanVersion['billingInterval'];
  termsSnapshot?: Record<string, any>;
}): CommercialPlanVersion {
  return {
    id: `fixture_cpv_${params.planId}_v${params.version || 1}`,
    planId: params.planId,
    version: params.version || 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    billingInterval: params.billingInterval || 'MONTHLY',
    recurringFeeCents: params.recurringFeeCents ?? 0,
    currency: 'USD',
    termsSnapshot: params.termsSnapshot || {
      includedProducerSeats: 5,
      includedJurisdictions: 3,
      includedVpoCapacity: 50,
      includedEngagementCapacity: 10,
      capacityEnforcementPolicy: 'HARD_BLOCK'
    },
    createdAt: '2026-01-01T00:00:00Z'
  };
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  return Object.keys(obj)
    .sort()
    .reduce((result: Record<string, any>, key: string) => {
      result[key] = sortObjectKeys(obj[key]);
      return result;
    }, {});
}

/**
 * Canonical SHA-256 event-hashing function (Section 10).
 * Produces deterministic hash over canonical fields with stable metadata ordering.
 * Provides tamper-evident integrity and provenance for stored commercial events.
 */
export function computeCommercialEventHash(params: {
  providerOrganizationId: string;
  eventType: CommercialEventType;
  sourceEntityType: string;
  sourceEntityId: string;
  idempotencyKey: string;
  occurredAt: string;
  challengeId?: string;
  competitionId?: string;
  commercialAgreementId?: string;
  commercialPlanVersionId?: string;
  metadata?: Record<string, unknown>;
}): string {
  const canonicalPayload = {
    challengeId: params.challengeId || null,
    commercialAgreementId: params.commercialAgreementId || null,
    commercialPlanVersionId: params.commercialPlanVersionId || null,
    competitionId: params.competitionId || null,
    eventType: params.eventType,
    idempotencyKey: params.idempotencyKey,
    metadata: params.metadata ? sortObjectKeys(params.metadata) : null,
    occurredAt: params.occurredAt,
    providerOrganizationId: params.providerOrganizationId,
    sourceEntityId: params.sourceEntityId,
    sourceEntityType: params.sourceEntityType
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
}

/**
 * Validates whether an event's hash matches its canonical payload (tamper-detection).
 */
export function verifyCommercialEventHash(event: CommercialEvent): boolean {
  const expected = computeCommercialEventHash({
    providerOrganizationId: event.providerOrganizationId,
    eventType: event.eventType,
    sourceEntityType: event.sourceEntityType,
    sourceEntityId: event.sourceEntityId,
    idempotencyKey: event.idempotencyKey,
    occurredAt: event.occurredAt,
    challengeId: event.challengeId,
    competitionId: event.competitionId,
    commercialAgreementId: event.commercialAgreementId,
    commercialPlanVersionId: event.commercialPlanVersionId,
    metadata: event.metadata
  });
  return event.eventHash === expected;
}

/**
 * Builds an immutable CommercialEvent with verifiable SHA-256 hash.
 * Canonical idempotency key format: evt:{eventType}:{sourceEntityId} (Section 8)
 */
export function buildCommercialEvent(params: {
  providerOrganizationId: string;
  eventType: CommercialEventType;
  sourceEntityType: string;
  sourceEntityId: string;
  challengeId?: string;
  competitionId?: string;
  commercialAgreementId?: string;
  commercialPlanVersionId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  occurredAt?: string;
}): CommercialEvent {
  if (!params.providerOrganizationId || params.providerOrganizationId.trim().length === 0) {
    throw new Error('CommercialEvent requires a non-empty providerOrganizationId');
  }
  if (!params.sourceEntityId || params.sourceEntityId.trim().length === 0) {
    throw new Error('CommercialEvent requires a non-empty sourceEntityId');
  }
  if (!params.sourceEntityType || params.sourceEntityType.trim().length === 0) {
    throw new Error('CommercialEvent requires a non-empty sourceEntityType');
  }
  if (!params.eventType) {
    throw new Error('CommercialEvent requires a valid eventType');
  }

  const occurredAt = params.occurredAt || new Date().toISOString();
  const idempotencyKey = params.idempotencyKey || `evt:${params.eventType}:${params.sourceEntityId}`;

  const eventHash = computeCommercialEventHash({
    providerOrganizationId: params.providerOrganizationId,
    eventType: params.eventType,
    sourceEntityType: params.sourceEntityType,
    sourceEntityId: params.sourceEntityId,
    challengeId: params.challengeId,
    competitionId: params.competitionId,
    commercialAgreementId: params.commercialAgreementId,
    commercialPlanVersionId: params.commercialPlanVersionId,
    occurredAt,
    idempotencyKey,
    metadata: params.metadata
  });

  return {
    id: `cev_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
    providerOrganizationId: params.providerOrganizationId,
    eventType: params.eventType,
    sourceEntityType: params.sourceEntityType,
    sourceEntityId: params.sourceEntityId,
    challengeId: params.challengeId,
    competitionId: params.competitionId,
    commercialAgreementId: params.commercialAgreementId,
    commercialPlanVersionId: params.commercialPlanVersionId,
    occurredAt,
    metadata: params.metadata,
    idempotencyKey,
    eventHash
  };
}

/**
 * Pure deterministic rating function (CE-4).
 * Evaluates whether an immutable CommercialEvent generates a billable obligation under an agreement.
 * Strictly adheres to Flat-Fee Neutrality Invariant: zero percentage of premium, zero commissions.
 */
export function rateCommercialEvent(params: {
  event: CommercialEvent;
  agreement: CommercialAgreement;
  planVersion: CommercialPlanVersion;
  priorUsageCount?: number;
}): RatingDecision {
  const { event, agreement, planVersion, priorUsageCount = 0 } = params;
  const ratedAt = new Date().toISOString();

  // 1. Verify Event Integrity
  if (!verifyCommercialEventHash(event)) {
    return {
      disposition: 'NOT_RATED',
      billable: false,
      commercialEventId: event.id,
      providerOrganizationId: event.providerOrganizationId,
      commercialAgreementId: agreement.id,
      commercialPlanVersionId: planVersion.id,
      quantity: 0,
      unitPriceCents: 0,
      amountCents: 0,
      currency: 'USD',
      reason: 'Event hash verification failed (tamper detected)',
      ratedAt,
      error: 'EVENT_HASH_INVALID'
    };
  }

  // 2. Currency check
  if (planVersion.currency !== 'USD') {
    return {
      disposition: 'NOT_RATED',
      billable: false,
      commercialEventId: event.id,
      providerOrganizationId: event.providerOrganizationId,
      commercialAgreementId: agreement.id,
      commercialPlanVersionId: planVersion.id,
      quantity: 0,
      unitPriceCents: 0,
      amountCents: 0,
      currency: 'USD',
      reason: `Unsupported plan currency: ${planVersion.currency}`,
      ratedAt,
      error: 'CURRENCY_UNSUPPORTED'
    };
  }

  // 3. Exemption check (Directive 6: EXEMPT)
  if (event.metadata?.isExempt === true || (agreement as any).customTerms?.exempt === true) {
    return {
      disposition: 'EXEMPT',
      billable: false,
      commercialEventId: event.id,
      providerOrganizationId: event.providerOrganizationId,
      commercialAgreementId: agreement.id,
      commercialPlanVersionId: planVersion.id,
      chargeCode: `${event.eventType}_EXEMPT`,
      quantity: 1,
      unitPriceCents: 0,
      amountCents: 0,
      currency: 'USD',
      reason: 'Transaction is contractually or operationally exempt from commercial fees',
      ratedAt
    };
  }

  const snapshot = planVersion.termsSnapshot || {};
  const rates = (snapshot.rates as Record<string, number | undefined>) || {};

  switch (event.eventType) {
    case 'AUTHORIZED_CONNECTION': {
      const included = snapshot.includedAuthorizedConnections ?? ((snapshot.rates as any)?.AUTHORIZED_CONNECTION_INCLUDED as number) ?? 0;
      const unitPrice = rates.AUTHORIZED_CONNECTION_CENTS ?? snapshot.authorizedConnectionUnitPriceCents ?? 0;

      if (priorUsageCount < included) {
        return {
          disposition: 'INCLUDED_IN_PLAN',
          billable: false,
          commercialEventId: event.id,
          providerOrganizationId: event.providerOrganizationId,
          commercialAgreementId: agreement.id,
          commercialPlanVersionId: planVersion.id,
          chargeCode: 'AUTHORIZED_CONNECTION_INCLUDED',
          quantity: 1,
          unitPriceCents: 0,
          amountCents: 0,
          currency: 'USD',
          reason: `Included in plan capacity (${priorUsageCount + 1}/${included})`,
          ratedAt
        };
      }

      if (unitPrice > 0) {
        return {
          disposition: 'BILLABLE',
          billable: true,
          commercialEventId: event.id,
          providerOrganizationId: event.providerOrganizationId,
          commercialAgreementId: agreement.id,
          commercialPlanVersionId: planVersion.id,
          chargeCode: 'AUTHORIZED_CONNECTION_UNIT',
          quantity: 1,
          unitPriceCents: unitPrice,
          amountCents: unitPrice,
          currency: 'USD',
          reason: `Billed as Authorized Connection overage above included threshold of ${included}`,
          ratedAt,
          pricingSnapshot: {
            chargeCode: 'AUTHORIZED_CONNECTION_UNIT',
            unitPriceCents: unitPrice,
            includedCapacity: included,
            priorUsageCount
          }
        };
      }

      return {
        disposition: 'INCLUDED_IN_PLAN',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: agreement.id,
        commercialPlanVersionId: planVersion.id,
        chargeCode: 'AUTHORIZED_CONNECTION_NO_FEE',
        quantity: 1,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'Authorized Connections are zero-rated under this agreement',
        ratedAt
      };
    }

    case 'BOUND_ACQUISITION': {
      const boundPrice = rates.BOUND_ACQUISITION_CENTS ?? snapshot.boundAcquisitionUnitPriceCents ?? 0;
      if (boundPrice > 0) {
        return {
          disposition: 'BILLABLE',
          billable: true,
          commercialEventId: event.id,
          providerOrganizationId: event.providerOrganizationId,
          commercialAgreementId: agreement.id,
          commercialPlanVersionId: planVersion.id,
          chargeCode: 'BOUND_ACQUISITION_FEE',
          quantity: 1,
          unitPriceCents: boundPrice,
          amountCents: boundPrice,
          currency: 'USD',
          reason: 'Billed upon successful Bound Acquisition under commercial agreement',
          ratedAt,
          pricingSnapshot: {
            chargeCode: 'BOUND_ACQUISITION_FEE',
            unitPriceCents: boundPrice
          }
        };
      }
      return {
        disposition: 'INCLUDED_IN_PLAN',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: agreement.id,
        commercialPlanVersionId: planVersion.id,
        chargeCode: 'BOUND_ACQUISITION_UNBILLED',
        quantity: 1,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'Bound acquisitions are non-billable under subscription-only plan',
        ratedAt
      };
    }

    case 'VERIFIED_BOUND_OUTCOME': {
      const outcomePrice = rates.VERIFIED_BOUND_OUTCOME_CENTS ?? 0;
      if (outcomePrice > 0) {
        return {
          disposition: 'BILLABLE',
          billable: true,
          commercialEventId: event.id,
          providerOrganizationId: event.providerOrganizationId,
          commercialAgreementId: agreement.id,
          commercialPlanVersionId: planVersion.id,
          chargeCode: 'VERIFIED_BOUND_OUTCOME_FEE',
          quantity: 1,
          unitPriceCents: outcomePrice,
          amountCents: outcomePrice,
          currency: 'USD',
          reason: 'Billed upon successful verified policy outcome reconciliation',
          ratedAt,
          pricingSnapshot: {
            chargeCode: 'VERIFIED_BOUND_OUTCOME_FEE',
            unitPriceCents: outcomePrice
          }
        };
      }
      return {
        disposition: 'INCLUDED_IN_PLAN',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: agreement.id,
        commercialPlanVersionId: planVersion.id,
        chargeCode: 'VERIFIED_BOUND_OUTCOME_UNBILLED',
        quantity: 1,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'Verified bound outcomes are zero-rated under this agreement',
        ratedAt
      };
    }

    case 'VPO_ENGAGED': {
      const overagePrice = rates.VPO_ENGAGEMENT_OVERAGE_CENTS ?? rates.ENGAGEMENT_OVERAGE_CENTS ?? 0;
      const isOverage = event.metadata?.isOverage === true || priorUsageCount >= (snapshot.includedEngagementCapacity ?? Infinity);
      if (isOverage && overagePrice > 0) {
        return {
          disposition: 'BILLABLE',
          billable: true,
          commercialEventId: event.id,
          providerOrganizationId: event.providerOrganizationId,
          commercialAgreementId: agreement.id,
          commercialPlanVersionId: planVersion.id,
          chargeCode: 'ENGAGEMENT_OVERAGE_FEE',
          quantity: 1,
          unitPriceCents: overagePrice,
          amountCents: overagePrice,
          currency: 'USD',
          reason: 'Billed as opportunity engagement overage above plan capacity',
          ratedAt,
          pricingSnapshot: {
            chargeCode: 'ENGAGEMENT_OVERAGE_FEE',
            unitPriceCents: overagePrice
          }
        };
      }
      return {
        disposition: 'INCLUDED_IN_PLAN',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: agreement.id,
        commercialPlanVersionId: planVersion.id,
        chargeCode: 'ENGAGEMENT_INCLUDED',
        quantity: 1,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'Opportunity engagement included in plan capacity',
        ratedAt
      };
    }

    default:
      return {
        disposition: 'NOT_RATED',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: agreement.id,
        commercialPlanVersionId: planVersion.id,
        chargeCode: `${event.eventType}_TELEMETRY_ONLY`,
        quantity: 1,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'Event recorded for value instrumentation only',
        ratedAt
      };
  }
}

/**
 * Constructs an immutable BillableEvent from a BILLABLE RatingDecision.
 * Enforces canonical idempotency key: bill:evt:{commercialEventId}:{chargeCode}
 */
export function buildBillableEvent(params: {
  decision: RatingDecision;
  event: CommercialEvent;
  id?: string;
  ratedAt?: string;
}): BillableEvent {
  const { decision, event } = params;
  if (!decision.billable || !decision.chargeCode || decision.amountCents <= 0) {
    throw new Error(`Cannot build BillableEvent from non-billable decision (disposition: ${decision.disposition})`);
  }

  const ratedAt = params.ratedAt || decision.ratedAt || new Date().toISOString();
  const id = params.id || `bil_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const idempotencyKey = `bill:evt:${event.id}:${decision.chargeCode}`;

  return {
    id,
    commercialEventId: event.id,
    providerOrganizationId: event.providerOrganizationId,
    commercialAgreementId: decision.commercialAgreementId || event.commercialAgreementId || '',
    commercialPlanVersionId: decision.commercialPlanVersionId || event.commercialPlanVersionId || '',
    chargeCode: decision.chargeCode,
    quantity: decision.quantity,
    unitPriceCents: decision.unitPriceCents,
    amountCents: decision.amountCents,
    currency: 'USD',
    status: 'RATED',
    ratedAt,
    pricingSnapshot: decision.pricingSnapshot || { chargeCode: decision.chargeCode, amountCents: decision.amountCents },
    idempotencyKey
  };
}

/**
 * Constructs an immutable, additive RatingAdjustment (Credit Memo, Reversal, Overage Forgiveness).
 * Never mutates or deletes the historical BillableEvent row.
 */
export function buildRatingAdjustment(params: {
  originalBillableEvent: BillableEvent;
  adjustmentType: RatingAdjustmentType;
  amountCents?: number;
  reason: string;
  authorizedBy: string;
  authorizedAt?: string;
  id?: string;
  idempotencyKey?: string;
}): RatingAdjustment {
  const { originalBillableEvent, adjustmentType, reason, authorizedBy } = params;
  if (!authorizedBy || authorizedBy.trim().length === 0) {
    throw new Error('RatingAdjustment requires an authorized actor identifier');
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('RatingAdjustment requires an explicit reason');
  }

  const authorizedAt = params.authorizedAt || new Date().toISOString();
  const id = params.id || `adj_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  // Default: full reversal of the original amount (as a negative amount)
  const amountCents = params.amountCents !== undefined ? params.amountCents : -Math.abs(originalBillableEvent.amountCents);
  const idempotencyKey = params.idempotencyKey || `adj:${adjustmentType}:${originalBillableEvent.id}`;

  return {
    id,
    originalBillableEventId: originalBillableEvent.id,
    providerOrganizationId: originalBillableEvent.providerOrganizationId,
    adjustmentType,
    amountCents,
    reason,
    authorizedBy,
    authorizedAt,
    idempotencyKey
  };
}

/**
 * Calculates factual conversion summary from raw event counts.
 */
export function calculateValueSummary(params: {
  providerOrganizationId: string;
  from: string;
  to: string;
  counts: Record<string, number>;
}): CommercialValueSummary {
  const { providerOrganizationId, from, to, counts } = params;

  const vposAvailable = counts['VPO_AVAILABLE'] || 0;
  const vposViewed = counts['VPO_VIEWED'] || 0;
  const vposEngaged = counts['VPO_ENGAGED'] || 0;
  const propositionsSubmitted = counts['PROPOSITION_SUBMITTED'] || 0;
  const consumerSelections = counts['CONSUMER_SELECTED'] || 0;
  const authorizedConnections = counts['AUTHORIZED_CONNECTION'] || 0;
  const boundAcquisitions = counts['BOUND_ACQUISITION'] || 0;
  const verifiedBoundOutcomes = counts['VERIFIED_BOUND_OUTCOME'] || 0;
  const baselinesActivated = counts['BASELINE_ACTIVATED'] || 0;

  return {
    providerOrganizationId,
    period: { from, to },
    vposAvailable,
    vposViewed,
    vposEngaged,
    propositionsSubmitted,
    consumerSelections,
    authorizedConnections,
    boundAcquisitions,
    verifiedBoundOutcomes,
    baselinesActivated,
    conversionRatios: {
      engagementRate: vposAvailable > 0 ? Math.round((vposEngaged / vposAvailable) * 1000) / 1000 : 0,
      selectionRate: vposEngaged > 0 ? Math.round((consumerSelections / vposEngaged) * 1000) / 1000 : 0,
      authorizationRate: consumerSelections > 0 ? Math.round((authorizedConnections / consumerSelections) * 1000) / 1000 : 0,
      bindRate: authorizedConnections > 0 ? Math.round((boundAcquisitions / authorizedConnections) * 1000) / 1000 : 0,
      verificationRate: boundAcquisitions > 0 ? Math.round((verifiedBoundOutcomes / boundAcquisitions) * 1000) / 1000 : 0,
      activationRate: verifiedBoundOutcomes > 0 ? Math.round((baselinesActivated / verifiedBoundOutcomes) * 1000) / 1000 : 0
    }
  };
}

// ==========================================
// CE-5: Invoicing, Billing Periods & Settlement Functions
// ==========================================

/**
 * Builds a deterministic BillingPeriod representing a contractual billing window.
 * The period is anchored to the CommercialPlanVersion effective at periodStart.
 */
export function buildBillingPeriod(params: {
  id?: string;
  providerOrganizationId: string;
  commercialAgreementId: string;
  commercialPlanVersionId: string;
  periodStart: string;
  periodEnd: string;
  status?: BillingPeriodStatus;
  createdAt?: string;
}): BillingPeriod {
  if (!params.providerOrganizationId || params.providerOrganizationId.trim().length === 0) {
    throw new Error('BillingPeriod requires a non-empty providerOrganizationId');
  }
  if (!params.commercialAgreementId || params.commercialAgreementId.trim().length === 0) {
    throw new Error('BillingPeriod requires a non-empty commercialAgreementId');
  }
  if (!params.commercialPlanVersionId || params.commercialPlanVersionId.trim().length === 0) {
    throw new Error('BillingPeriod requires a non-empty commercialPlanVersionId');
  }
  if (!params.periodStart || !params.periodEnd) {
    throw new Error('BillingPeriod requires periodStart and periodEnd');
  }
  if (new Date(params.periodStart).getTime() >= new Date(params.periodEnd).getTime()) {
    throw new Error('BillingPeriod periodStart must be strictly earlier than periodEnd');
  }

  return {
    id: params.id || `bp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
    providerOrganizationId: params.providerOrganizationId,
    commercialAgreementId: params.commercialAgreementId,
    commercialPlanVersionId: params.commercialPlanVersionId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    status: params.status || 'OPEN',
    createdAt: params.createdAt || new Date().toISOString()
  };
}

/**
 * Assembles an unfinalized Draft Invoice aggregating:
 * 1. Base platform subscription from historical plan version for the billing period
 * 2. Unbilled BillableEvents in status RATED
 * 3. Unapplied RatingAdjustments
 * 
 * Enforces:
 * - Exactly one source reference per line item (source exclusivity)
 * - Flat-fee integer arithmetic (integer cents)
 * - USD currency
 */
export function assembleDraftInvoice(params: {
  billingPeriod: BillingPeriod;
  planVersion: CommercialPlanVersion;
  billableEvents: BillableEvent[];
  ratingAdjustments: RatingAdjustment[];
  invoiceId?: string;
  invoiceNumber?: string;
  idempotencyKey?: string;
  now?: string;
}): { invoice: Invoice; lineItems: InvoiceLineItem[] } {
  const { billingPeriod, planVersion, billableEvents, ratingAdjustments } = params;

  if (planVersion.currency !== 'USD') {
    throw new Error(`Unsupported currency: ${planVersion.currency}. Open Policy billing is denominated strictly in USD.`);
  }

  const invoiceId = params.invoiceId || `inv_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const now = params.now || new Date().toISOString();
  const invoiceNumber = params.invoiceNumber || `INV-${new Date(billingPeriod.periodStart).toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const idempotencyKey = params.idempotencyKey || `inv:${billingPeriod.id}:${billingPeriod.providerOrganizationId}`;

  const lineItems: InvoiceLineItem[] = [];

  // 1. Subscription Line Item (Derived from historical PlanVersion for the billing period)
  const subLineId = `lin_sub_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  lineItems.push({
    id: subLineId,
    invoiceId,
    lineType: 'SUBSCRIPTION',
    description: `Platform Subscription: ${planVersion.planId} (Period ${billingPeriod.periodStart.slice(0, 10)} to ${billingPeriod.periodEnd.slice(0, 10)})`,
    quantity: 1,
    unitPriceCents: planVersion.recurringFeeCents,
    amountCents: planVersion.recurringFeeCents,
    billingPeriodId: billingPeriod.id,
    createdAt: now
  });

  // 2. Transactional Usage & Outcome Charges (From CE-4 BillableEvents)
  for (const be of billableEvents) {
    if (be.providerOrganizationId !== billingPeriod.providerOrganizationId) {
      throw new Error(`BillableEvent ${be.id} belongs to different organization ${be.providerOrganizationId}`);
    }
    const lineType: InvoiceLineType = (be.chargeCode.includes('BOUND') || be.chargeCode.includes('OUTCOME')) 
      ? 'OUTCOME_CHARGE' 
      : 'USAGE_CHARGE';
    const lineId = `lin_be_${be.id}_${Math.floor(1000 + Math.random() * 9000)}`;
    lineItems.push({
      id: lineId,
      invoiceId,
      lineType,
      description: `${be.chargeCode} [Event: ${be.commercialEventId}]`,
      quantity: be.quantity,
      unitPriceCents: be.unitPriceCents,
      amountCents: be.amountCents,
      billableEventId: be.id,
      createdAt: now
    });
  }

  // 3. Authorized Credit Adjustments (From CE-4 RatingAdjustments)
  for (const ra of ratingAdjustments) {
    if (ra.providerOrganizationId !== billingPeriod.providerOrganizationId) {
      throw new Error(`RatingAdjustment ${ra.id} belongs to different organization ${ra.providerOrganizationId}`);
    }
    const lineId = `lin_ra_${ra.id}_${Math.floor(1000 + Math.random() * 9000)}`;
    lineItems.push({
      id: lineId,
      invoiceId,
      lineType: 'ADJUSTMENT_CREDIT',
      description: `${ra.adjustmentType}: ${ra.reason} [Orig: ${ra.originalBillableEventId}]`,
      quantity: 1,
      unitPriceCents: ra.amountCents,
      amountCents: ra.amountCents,
      ratingAdjustmentId: ra.id,
      createdAt: now
    });
  }

  // Calculate deterministic totals (pure integer cents)
  const subtotalCents = lineItems.reduce((acc, l) => acc + l.amountCents, 0);
  const taxCents = 0; // Tax is non-modeled/zero for standard platform fees in this phase
  const totalDueCents = Math.max(0, subtotalCents + taxCents);
  const balanceDueCents = totalDueCents;

  const invoice: Invoice = {
    id: invoiceId,
    invoiceNumber,
    providerOrganizationId: billingPeriod.providerOrganizationId,
    commercialAgreementId: billingPeriod.commercialAgreementId,
    billingPeriodId: billingPeriod.id,
    status: 'DRAFT',
    currency: 'USD',
    subtotalCents,
    taxCents,
    totalDueCents,
    balanceDueCents,
    idempotencyKey,
    createdAt: now,
    lineItems
  };

  return { invoice, lineItems };
}

/**
 * Finalizes an invoice, freezing its line items, mathematics, and issuance timestamp.
 * A finalized invoice's economic figures are permanently immutable.
 */
export function finalizeInvoice(
  draftInvoice: Invoice,
  options?: {
    finalizedAt?: string;
    dueDays?: number;
  }
): Invoice {
  if (draftInvoice.status !== 'DRAFT') {
    throw new Error(`Cannot finalize invoice ${draftInvoice.id}: current status is ${draftInvoice.status}`);
  }

  const finalizedAt = options?.finalizedAt || new Date().toISOString();
  const dueDays = options?.dueDays !== undefined ? options.dueDays : 30;
  const dueDate = new Date(new Date(finalizedAt).getTime() + dueDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...draftInvoice,
    status: 'FINALIZED',
    finalizedAt,
    issuedAt: finalizedAt,
    dueAt: dueDate
  };
}

/**
 * Reconstructs the authoritative ProviderAccountBalance projection from underlying ledgers:
 * - Finalized invoices (billing ledger)
 * - Settlement allocations & payment records (settlement ledger)
 * - Append-only refund records (settlement ledger)
 */
export function calculateAuthoritativeAccountBalance(params: {
  providerOrganizationId: string;
  invoices: Invoice[];
  payments: PaymentRecord[];
  refunds: RefundRecord[];
  allocations: SettlementAllocation[];
  now?: string;
}): ProviderAccountBalance {
  const { providerOrganizationId, invoices, payments, refunds, allocations } = params;

  // Filter for this organization
  const orgInvoices = invoices.filter(i => i.providerOrganizationId === providerOrganizationId && i.status !== 'DRAFT');
  const orgPayments = payments.filter(p => p.providerOrganizationId === providerOrganizationId && p.status === 'SUCCEEDED');
  const orgRefunds = refunds.filter(r => r.providerOrganizationId === providerOrganizationId);

  const totalInvoicedCents = orgInvoices.reduce((acc, inv) => acc + inv.totalDueCents, 0);
  const totalPaidCents = orgPayments.reduce((acc, pay) => acc + pay.amountCents, 0);
  const totalRefundedCents = orgRefunds.reduce((acc, ref) => acc + ref.amountCents, 0);

  // Sum all adjustments contained in finalized invoices
  let totalAdjustmentsCents = 0;
  for (const inv of orgInvoices) {
    if (inv.lineItems) {
      for (const line of inv.lineItems) {
        if (line.lineType === 'ADJUSTMENT_CREDIT') {
          totalAdjustmentsCents += line.amountCents;
        }
      }
    }
  }

  // Reconcile outstanding balance per invoice
  let outstandingBalanceCents = 0;
  for (const inv of orgInvoices) {
    const invAllocations = allocations.filter(a => a.invoiceId === inv.id);
    const paidToInv = invAllocations.reduce((acc, a) => acc + (a.refundRecordId ? -a.amountAllocatedCents : a.amountAllocatedCents), 0);
    const invOutstanding = Math.max(0, inv.totalDueCents - paidToInv);
    outstandingBalanceCents += invOutstanding;
  }

  const netPaidCents = totalPaidCents - totalRefundedCents;
  const creditBalanceCents = Math.max(0, netPaidCents - totalInvoicedCents);

  return {
    providerOrganizationId,
    totalInvoicedCents,
    totalPaidCents,
    totalRefundedCents,
    totalAdjustmentsCents,
    outstandingBalanceCents,
    creditBalanceCents,
    asOf: params.now || new Date().toISOString()
  };
}

/**
 * Creates an immutable RefundRecord linked to a successful PaymentRecord.
 * Preserves the append-only settlement invariant: original payment is NOT mutated.
 */
export function buildRefundRecord(params: {
  originalPayment: PaymentRecord;
  amountCents: number;
  reason: string;
  priorRefundsTotalCents?: number;
  id?: string;
  idempotencyKey?: string;
  refundedAt?: string;
}): RefundRecord {
  const { originalPayment, amountCents, reason } = params;

  if (originalPayment.status !== 'SUCCEEDED') {
    throw new Error(`Cannot refund payment ${originalPayment.id}: payment status is ${originalPayment.status}, not SUCCEEDED`);
  }
  if (amountCents <= 0) {
    throw new Error('Refund amount must be a positive integer in cents');
  }

  const priorRefunds = params.priorRefundsTotalCents || 0;
  if (priorRefunds + amountCents > originalPayment.amountCents) {
    throw new Error(`Refund of ${amountCents} cents exceeds refundable payment balance of ${originalPayment.amountCents - priorRefunds} cents`);
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('RefundRecord requires an explicit reason');
  }

  return {
    id: params.id || `ref_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
    originalPaymentRecordId: originalPayment.id,
    providerOrganizationId: originalPayment.providerOrganizationId,
    amountCents,
    currency: 'USD',
    reason,
    refundedAt: params.refundedAt || new Date().toISOString(),
    idempotencyKey: params.idempotencyKey || `ref:${originalPayment.id}:${Date.now()}`
  };
}
