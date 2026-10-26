import crypto from 'crypto';
import { postgresStore, PostgresStore, type SqlClient } from './postgresStore';
import {
  CommercialAccount,
  CommercialPlan,
  CommercialPlanVersion,
  CommercialAgreement,
  ProviderEntitlement,
  CapacityEnforcementPolicy,
  CommercialUsageRecord,
  CommercialCapacityResult,
  CommercialEvent,
  CommercialEventType,
  BillableEvent,
  BillableEventStatus,
  RatingAdjustment,
  RatingAdjustmentType,
  RatingDecision,
  RatingRun,
  BillingPeriod,
  BillingPeriodStatus,
  Invoice,
  InvoiceStatus,
  InvoiceLineItem,
  InvoiceLineType,
  NegotiatedServiceCharge,
  PaymentRecord,
  PaymentMethod,
  PaymentStatus,
  RefundRecord,
  SettlementAllocation,
  ProviderAccountBalance,
  PaymentProviderAdapter
} from '../../types/insurance';
import {
  deriveEntitlementsFromPlanVersion,
  buildCommercialEvent,
  rateCommercialEvent,
  buildBillableEvent,
  buildRatingAdjustment,
  verifyCommercialEventHash,
  buildBillingPeriod,
  assembleDraftInvoice,
  assembleUsageInvoice,
  finalizeInvoice,
  calculateAuthoritativeAccountBalance,
  buildRefundRecord
} from '../../domain/commercialEconomicsEngine';
import { OPEN_POLICY_PREMIUM_V1_UNAVAILABLE_SERVICE_ADD_ONS } from '../../domain/commercialPriceBook';
import { OPEN_POLICY_PREMIUM_PRICE_BOOK_V1, OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2 } from '../../domain/commercialPriceBook';

/**
 * CommercialStore — Persistence layer for Open Policy Commercial Economics (CE-1 through CE-5).
 * 
 * Operates over the shared PGlite database without mixing commercial models into
 * marketplace transaction entities.
 */
export class CommercialStore {
  private store: PostgresStore;

  constructor(store: PostgresStore = postgresStore) {
    this.store = store;
  }

  public async getClient(): Promise<SqlClient> {
    return this.store.getPgClient();
  }

  // =========================================================================
  // CommercialAccount Methods
  // =========================================================================

  public async saveCommercialAccount(account: CommercialAccount): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO commercial_accounts (
        id, provider_organization_id, status, currency, external_billing_customer_ref, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        external_billing_customer_ref = EXCLUDED.external_billing_customer_ref,
        updated_at = EXCLUDED.updated_at;`,
      [
        account.id,
        account.providerOrganizationId,
        account.status,
        account.currency,
        account.externalBillingCustomerRef || null,
        account.createdAt,
        account.updatedAt
      ]
    );
  }

  public async getCommercialAccountByOrgId(providerOrganizationId: string): Promise<CommercialAccount | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      status: string;
      currency: string;
      external_billing_customer_ref: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT * FROM commercial_accounts WHERE provider_organization_id = $1;`,
      [providerOrganizationId]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      status: r.status as CommercialAccount['status'],
      currency: 'USD',
      externalBillingCustomerRef: r.external_billing_customer_ref || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async getCommercialAccountById(id: string): Promise<CommercialAccount | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      status: string;
      currency: string;
      external_billing_customer_ref: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT * FROM commercial_accounts WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      status: r.status as CommercialAccount['status'],
      currency: 'USD',
      externalBillingCustomerRef: r.external_billing_customer_ref || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // =========================================================================
  // CommercialPlan & PlanVersion Methods
  // =========================================================================

  public async saveCommercialPlan(plan: CommercialPlan): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO commercial_plans (
        id, code, display_name, provider_segment, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        status = EXCLUDED.status;`,
      [
        plan.id,
        plan.code,
        plan.displayName,
        plan.providerSegment,
        plan.status,
        plan.createdAt
      ]
    );
  }

  public async getCommercialPlanByCode(code: string): Promise<CommercialPlan | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      code: string;
      display_name: string;
      provider_segment: string;
      status: string;
      created_at: string;
    }>(
      `SELECT * FROM commercial_plans WHERE code = $1;`,
      [code]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      code: r.code,
      displayName: r.display_name,
      providerSegment: r.provider_segment as CommercialPlan['providerSegment'],
      status: r.status as CommercialPlan['status'],
      createdAt: r.created_at
    };
  }

  public async getCommercialPlanById(id: string): Promise<CommercialPlan | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      code: string;
      display_name: string;
      provider_segment: string;
      status: string;
      created_at: string;
    }>(
      `SELECT * FROM commercial_plans WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      code: r.code,
      displayName: r.display_name,
      providerSegment: r.provider_segment as CommercialPlan['providerSegment'],
      status: r.status as CommercialPlan['status'],
      createdAt: r.created_at
    };
  }

  public async listActivePlans(): Promise<CommercialPlan[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      code: string;
      display_name: string;
      provider_segment: string;
      status: string;
      created_at: string;
    }>(
      `SELECT * FROM commercial_plans WHERE status = 'ACTIVE' ORDER BY created_at ASC;`
    );

    return res.rows.map(r => ({
      id: r.id,
      code: r.code,
      displayName: r.display_name,
      providerSegment: r.provider_segment as CommercialPlan['providerSegment'],
      status: r.status as CommercialPlan['status'],
      createdAt: r.created_at
    }));
  }

  /**
   * Plans available for new enrollment under one governing price book.
   * Historical plan records and versions remain immutable and queryable by
   * administrators, but can never become enrollment choices by being ACTIVE.
   */
  public async listEnrollmentPlans(priceBookId: string): Promise<Array<CommercialPlan & { planVersion: CommercialPlanVersion }>> {
    const plans = await this.listActivePlans();
    const enrollmentPlans: Array<CommercialPlan & { planVersion: CommercialPlanVersion }> = [];
    for (const plan of plans) {
      const version = await this.getLatestPlanVersion(plan.id);
      if (version?.termsSnapshot?.priceBookId === priceBookId) {
        enrollmentPlans.push({ ...plan, planVersion: version });
      }
    }
    return enrollmentPlans;
  }

  public async saveCommercialPlanVersion(version: CommercialPlanVersion): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO commercial_plan_versions (
        id, plan_id, version, effective_from, effective_until, billing_interval,
        recurring_fee_cents, currency, terms_snapshot, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING;`, // Immutable and race-safe across both id and (plan_id, version).
      [
        version.id,
        version.planId,
        version.version,
        version.effectiveFrom,
        version.effectiveUntil || null,
        version.billingInterval,
        version.recurringFeeCents,
        version.currency,
        JSON.stringify(version.termsSnapshot || {}),
        version.createdAt
      ]
    );
  }

  public async getCommercialPlanVersion(id: string): Promise<CommercialPlanVersion | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      plan_id: string;
      version: number;
      effective_from: string;
      effective_until: string | null;
      billing_interval: string;
      recurring_fee_cents: number;
      currency: string;
      terms_snapshot: string;
      created_at: string;
    }>(
      `SELECT * FROM commercial_plan_versions WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      planId: r.plan_id,
      version: r.version,
      effectiveFrom: r.effective_from,
      effectiveUntil: r.effective_until || undefined,
      billingInterval: r.billing_interval as CommercialPlanVersion['billingInterval'],
      recurringFeeCents: r.recurring_fee_cents,
      currency: 'USD',
      termsSnapshot: JSON.parse(r.terms_snapshot || '{}'),
      createdAt: r.created_at
    };
  }

  public async getLatestPlanVersion(planId: string): Promise<CommercialPlanVersion | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      plan_id: string;
      version: number;
      effective_from: string;
      effective_until: string | null;
      billing_interval: string;
      recurring_fee_cents: number;
      currency: string;
      terms_snapshot: string;
      created_at: string;
    }>(
      `SELECT * FROM commercial_plan_versions WHERE plan_id = $1 ORDER BY version DESC LIMIT 1;`,
      [planId]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      planId: r.plan_id,
      version: r.version,
      effectiveFrom: r.effective_from,
      effectiveUntil: r.effective_until || undefined,
      billingInterval: r.billing_interval as CommercialPlanVersion['billingInterval'],
      recurringFeeCents: r.recurring_fee_cents,
      currency: 'USD',
      termsSnapshot: JSON.parse(r.terms_snapshot || '{}'),
      createdAt: r.created_at
    };
  }

  // =========================================================================
  // CommercialAgreement Methods
  // =========================================================================

  public async saveCommercialAgreement(agreement: CommercialAgreement): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO commercial_agreements (
        id, commercial_account_id, provider_organization_id, plan_version_id,
        status, starts_at, ends_at, accepted_at, created_at,
        membership_trial_started_at, membership_trial_ends_at, membership_trial_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        ends_at = EXCLUDED.ends_at,
        accepted_at = EXCLUDED.accepted_at,
        membership_trial_status = EXCLUDED.membership_trial_status;`,
      [
        agreement.id,
        agreement.commercialAccountId,
        agreement.providerOrganizationId,
        agreement.planVersionId,
        agreement.status,
        agreement.startsAt,
        agreement.endsAt || null,
        agreement.acceptedAt || null,
        agreement.createdAt,
        agreement.membershipTrialStartedAt || null,
        agreement.membershipTrialEndsAt || null,
        agreement.membershipTrialStatus || null
      ]
    );
  }

  public async getActiveAgreementForOrg(providerOrganizationId: string): Promise<CommercialAgreement | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      commercial_account_id: string;
      provider_organization_id: string;
      plan_version_id: string;
      status: string;
      starts_at: string;
      ends_at: string | null;
      accepted_at: string | null;
      created_at: string;
    }>(
      `SELECT * FROM commercial_agreements
       WHERE provider_organization_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at DESC LIMIT 1;`,
      [providerOrganizationId]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      commercialAccountId: r.commercial_account_id,
      providerOrganizationId: r.provider_organization_id,
      planVersionId: r.plan_version_id,
      status: r.status as CommercialAgreement['status'],
      startsAt: r.starts_at,
      endsAt: r.ends_at || undefined,
      acceptedAt: r.accepted_at || undefined,
      createdAt: r.created_at
      ,membershipTrialStartedAt: (r as any).membership_trial_started_at || undefined
      ,membershipTrialEndsAt: (r as any).membership_trial_ends_at || undefined
      ,membershipTrialStatus: (r as any).membership_trial_status || undefined
    };
  }

  public async getActiveCommercialAgreement(providerOrganizationId: string): Promise<CommercialAgreement | undefined> {
    return this.getActiveAgreementForOrg(providerOrganizationId);
  }

  public async getCommercialAgreementById(id: string): Promise<CommercialAgreement | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      commercial_account_id: string;
      provider_organization_id: string;
      plan_version_id: string;
      status: string;
      starts_at: string;
      ends_at: string | null;
      accepted_at: string | null;
      created_at: string;
    }>(
      `SELECT * FROM commercial_agreements WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      commercialAccountId: r.commercial_account_id,
      providerOrganizationId: r.provider_organization_id,
      planVersionId: r.plan_version_id,
      status: r.status as CommercialAgreement['status'],
      startsAt: r.starts_at,
      endsAt: r.ends_at || undefined,
      acceptedAt: r.accepted_at || undefined,
      createdAt: r.created_at
      ,membershipTrialStartedAt: (r as any).membership_trial_started_at || undefined
      ,membershipTrialEndsAt: (r as any).membership_trial_ends_at || undefined
      ,membershipTrialStatus: (r as any).membership_trial_status || undefined
    };
  }

  // =========================================================================
  // ProviderEntitlement Methods
  // =========================================================================

  public async saveProviderEntitlement(entitlement: ProviderEntitlement): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO provider_entitlements (
        id, provider_organization_id, commercial_agreement_id, entitlement_type,
        limit_val, enforcement_policy, scope, effective_from, effective_until, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        limit_val = EXCLUDED.limit_val,
        enforcement_policy = EXCLUDED.enforcement_policy,
        scope = EXCLUDED.scope,
        effective_until = EXCLUDED.effective_until;`,
      [
        entitlement.id,
        entitlement.providerOrganizationId,
        entitlement.commercialAgreementId,
        entitlement.entitlementType,
        entitlement.limit ?? null,
        entitlement.enforcementPolicy || 'HARD_BLOCK',
        entitlement.scope ? JSON.stringify(entitlement.scope) : null,
        entitlement.effectiveFrom,
        entitlement.effectiveUntil || null,
        entitlement.createdAt
      ]
    );
  }

  public async getEntitlementsForOrg(providerOrganizationId: string): Promise<ProviderEntitlement[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      commercial_agreement_id: string;
      entitlement_type: string;
      limit_val: number | null;
      enforcement_policy: string | null;
      scope: string | null;
      effective_from: string;
      effective_until: string | null;
      created_at: string;
    }>(
      `SELECT * FROM provider_entitlements WHERE provider_organization_id = $1 ORDER BY created_at ASC;`,
      [providerOrganizationId]
    );

    return res.rows.map(r => ({
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      entitlementType: r.entitlement_type as ProviderEntitlement['entitlementType'],
      limit: r.limit_val ?? undefined,
      enforcementPolicy: (r.enforcement_policy as CapacityEnforcementPolicy) || 'HARD_BLOCK',
      scope: r.scope ? JSON.parse(r.scope) : undefined,
      effectiveFrom: r.effective_from,
      effectiveUntil: r.effective_until || undefined,
      createdAt: r.created_at
    }));
  }

  // =========================================================================
  // CommercialEvent Ledger Methods (Append-Only)
  // =========================================================================

  public async saveCommercialEvent(event: CommercialEvent): Promise<boolean> {
    return this.recordCommercialEvent(event);
  }

  public async recordCommercialEvent(event: CommercialEvent): Promise<boolean> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `INSERT INTO commercial_events (
          id, provider_organization_id, event_type, source_entity_type, source_entity_id,
          challenge_id, competition_id, commercial_agreement_id, commercial_plan_version_id,
          occurred_at, metadata, idempotency_key, event_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (idempotency_key) DO NOTHING;`,
        [
          event.id,
          event.providerOrganizationId,
          event.eventType,
          event.sourceEntityType,
          event.sourceEntityId,
          event.challengeId || null,
          event.competitionId || null,
          event.commercialAgreementId || null,
          event.commercialPlanVersionId || null,
          event.occurredAt,
          event.metadata ? JSON.stringify(event.metadata) : null,
          event.idempotencyKey,
          event.eventHash
        ]
      );
      const rowCount = res.rowCount ?? (res as any).affectedRows ?? 0;
      return rowCount > 0;
    } catch {
      return false;
    }
  }

  public async getCommercialEventsForOrg(
    providerOrganizationId: string,
    limit = 100
  ): Promise<CommercialEvent[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      event_type: string;
      source_entity_type: string;
      source_entity_id: string;
      challenge_id: string | null;
      competition_id: string | null;
      commercial_agreement_id: string | null;
      commercial_plan_version_id: string | null;
      occurred_at: string;
      metadata: string | null;
      idempotency_key: string;
      event_hash: string;
    }>(
      `SELECT * FROM commercial_events
       WHERE provider_organization_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2;`,
      [providerOrganizationId, limit]
    );

    return res.rows.map(r => ({
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      eventType: r.event_type as CommercialEvent['eventType'],
      sourceEntityType: r.source_entity_type,
      sourceEntityId: r.source_entity_id,
      challengeId: r.challenge_id || undefined,
      competitionId: r.competition_id || undefined,
      commercialAgreementId: r.commercial_agreement_id || undefined,
      commercialPlanVersionId: r.commercial_plan_version_id || undefined,
      occurredAt: r.occurred_at,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      idempotencyKey: r.idempotency_key,
      eventHash: r.event_hash
    }));
  }

  public async getCommercialEvents(query: {
    providerOrganizationId?: string;
    eventType?: CommercialEventType;
    limit?: number;
  }): Promise<CommercialEvent[]> {
    const client = await this.getClient();
    const conditions: string[] = [];
    const values: any[] = [];
    if (query.providerOrganizationId) {
      values.push(query.providerOrganizationId);
      conditions.push(`provider_organization_id = $${values.length}`);
    }
    if (query.eventType) {
      values.push(query.eventType);
      conditions.push(`event_type = $${values.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 500;
    values.push(limit);
    const sql = `SELECT * FROM commercial_events ${whereClause} ORDER BY occurred_at DESC LIMIT $${values.length};`;
    const res = await client.query<any>(sql, values);
    return res.rows.map(r => ({
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      eventType: r.event_type as CommercialEvent['eventType'],
      sourceEntityType: r.source_entity_type,
      sourceEntityId: r.source_entity_id,
      challengeId: r.challenge_id || undefined,
      competitionId: r.competition_id || undefined,
      commercialAgreementId: r.commercial_agreement_id || undefined,
      commercialPlanVersionId: r.commercial_plan_version_id || undefined,
      occurredAt: r.occurred_at,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      idempotencyKey: r.idempotency_key,
      eventHash: r.event_hash
    }));
  }

  public async getEventCountsByType(providerOrganizationId: string): Promise<Record<string, number>> {
    const client = await this.getClient();
    const res = await client.query<{
      event_type: string;
      cnt: string;
    }>(
      `SELECT event_type, COUNT(*) as cnt
       FROM commercial_events
       WHERE provider_organization_id = $1
       GROUP BY event_type;`,
      [providerOrganizationId]
    );

    const counts: Record<string, number> = {};
    for (const r of res.rows) {
      counts[r.event_type] = parseInt(r.cnt, 10);
    }
    return counts;
  }

  public async getCommercialEventByIdempotencyKey(key: string): Promise<CommercialEvent | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      event_type: string;
      source_entity_type: string;
      source_entity_id: string;
      challenge_id: string | null;
      competition_id: string | null;
      commercial_agreement_id: string | null;
      commercial_plan_version_id: string | null;
      occurred_at: string;
      metadata: string | null;
      idempotency_key: string;
      event_hash: string;
    }>(
      `SELECT * FROM commercial_events WHERE idempotency_key = $1;`,
      [key]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      eventType: r.event_type as CommercialEvent['eventType'],
      sourceEntityType: r.source_entity_type,
      sourceEntityId: r.source_entity_id,
      challengeId: r.challenge_id || undefined,
      competitionId: r.competition_id || undefined,
      commercialAgreementId: r.commercial_agreement_id || undefined,
      commercialPlanVersionId: r.commercial_plan_version_id || undefined,
      occurredAt: r.occurred_at,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      idempotencyKey: r.idempotency_key,
      eventHash: r.event_hash
    };
  }

  public async getCommercialEventById(id: string): Promise<CommercialEvent | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      event_type: string;
      source_entity_type: string;
      source_entity_id: string;
      challenge_id: string | null;
      competition_id: string | null;
      commercial_agreement_id: string | null;
      commercial_plan_version_id: string | null;
      occurred_at: string;
      metadata: string | null;
      idempotency_key: string;
      event_hash: string;
    }>(
      `SELECT * FROM commercial_events WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      eventType: r.event_type as CommercialEvent['eventType'],
      sourceEntityType: r.source_entity_type,
      sourceEntityId: r.source_entity_id,
      challengeId: r.challenge_id || undefined,
      competitionId: r.competition_id || undefined,
      commercialAgreementId: r.commercial_agreement_id || undefined,
      commercialPlanVersionId: r.commercial_plan_version_id || undefined,
      occurredAt: r.occurred_at,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      idempotencyKey: r.idempotency_key,
      eventHash: r.event_hash
    };
  }

  /**
   * Projects an authoritative marketplace milestone into the immutable CommercialEvent ledger (CE-3).
   * 
   * Invariants:
   * 1. Factual only: Zero rating, zero pricing, zero billable derivation.
   * 2. Non-blocking: Temporary failure of event projection does not fail the core marketplace transaction.
   * 3. Idempotent: Deterministic key prevents duplication across retries.
   * 4. Contextual: Captures active agreement/version reference if present for historical context.
   */
  public async projectMarketplaceEvent(params: {
    eventType: CommercialEventType;
    sourceEntityType: string;
    sourceEntityId: string;
    providerOrganizationId: string;
    challengeId?: string;
    competitionId?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: string;
    idempotencyKey?: string;
  }): Promise<CommercialEvent | null> {
    try {
      const activeAgreement = await this.getActiveAgreementForOrg(params.providerOrganizationId);
      const idempotencyKey = params.idempotencyKey || `evt:${params.eventType}:${params.sourceEntityId}`;

      const event = buildCommercialEvent({
        providerOrganizationId: params.providerOrganizationId,
        eventType: params.eventType,
        sourceEntityType: params.sourceEntityType,
        sourceEntityId: params.sourceEntityId,
        challengeId: params.challengeId,
        competitionId: params.competitionId,
        commercialAgreementId: activeAgreement?.id,
        commercialPlanVersionId: activeAgreement?.planVersionId,
        metadata: params.metadata,
        idempotencyKey,
        occurredAt: params.occurredAt
      });

      const inserted = await this.recordCommercialEvent(event);
      if (!inserted) {
        return null;
      }
      return event;
    } catch (err: any) {
      console.warn(`[CommercialStore] Event projection deferred for ${params.eventType}:${params.sourceEntityId}:`, err?.message || err);
      return null;
    }
  }

  /**
   * Deterministic Reconciliation & Backfill Engine (CE-3 Section 11 & 12).
   * 
   * Scans authoritative PM records in db / postgresStore and projects missing CommercialEvents
   * using the canonical deterministic idempotency keys.
   * Completely safe to rerun repeatedly (idempotent ON CONFLICT DO NOTHING).
   */
  public async reconcileCommercialEvents(_legacyMemorySource?: unknown): Promise<{
    scanned: number;
    projected: number;
    alreadyExisted: number;
    errors: string[];
    countsByStage: Record<string, number>;
  }> {
    let scanned = 0;
    let projected = 0;
    let alreadyExisted = 0;
    const errors: string[] = [];
    const countsByStage: Record<string, number> = {
      VPO_AVAILABLE: 0,
      VPO_VIEWED: 0,
      PROPOSITION_SUBMITTED: 0,
      CONSUMER_SELECTED: 0,
      AUTHORIZED_CONNECTION: 0,
      BOUND_ACQUISITION: 0,
      VERIFIED_BOUND_OUTCOME: 0,
      BASELINE_ACTIVATED: 0
    };

    const projectOne = async (params: {
      eventType: CommercialEventType;
      sourceEntityType: string;
      sourceEntityId: string;
      providerOrganizationId: string;
      challengeId?: string;
      competitionId?: string;
      occurredAt?: string;
      metadata?: Record<string, unknown>;
      idempotencyKey?: string;
    }) => {
      scanned++;
      const key = params.idempotencyKey || `evt:${params.eventType}:${params.sourceEntityId}`;
      const existing = await this.getCommercialEventByIdempotencyKey(key);
      if (existing) {
        alreadyExisted++;
        countsByStage[params.eventType] = (countsByStage[params.eventType] || 0) + 1;
        return;
      }
      try {
        const ev = await this.projectMarketplaceEvent(params);
        if (ev) {
          projected++;
          countsByStage[params.eventType] = (countsByStage[params.eventType] || 0) + 1;
        } else {
          const already = await this.getCommercialEventByIdempotencyKey(key);
          if (already) {
            alreadyExisted++;
            countsByStage[params.eventType] = (countsByStage[params.eventType] || 0) + 1;
          } else {
            errors.push(`Failed to project ${params.eventType} for ${params.sourceEntityId}`);
          }
        }
      } catch (e: any) {
        errors.push(e?.message || `Projection exception for ${params.sourceEntityId}`);
      }
    };

    // 1. Scan Invitations -> VPO_AVAILABLE & VPO_VIEWED
    const invitations = await postgresStore.getAllInvitations();
    for (const inv of invitations) {
      // Standby is an ordering state, not marketplace access. Reconciliation must
      // never manufacture VPO_AVAILABLE for a provider the consumer has not activated.
      if (inv.status === 'STANDBY' || inv.status === 'INELIGIBLE') continue;
      await projectOne({
        eventType: 'VPO_AVAILABLE',
        sourceEntityType: 'CHALLENGE_INVITATION',
        sourceEntityId: inv.id,
        providerOrganizationId: inv.providerOrganizationId,
        challengeId: inv.challengeId,
        competitionId: inv.competitionId,
        occurredAt: inv.invitedAt
      });

      if (inv.status === 'VIEWED' || inv.status === 'ACCEPTED' || inv.viewedAt) {
        await projectOne({
          eventType: 'VPO_VIEWED',
          sourceEntityType: 'CHALLENGE_INVITATION',
          sourceEntityId: inv.id,
          providerOrganizationId: inv.providerOrganizationId,
          challengeId: inv.challengeId,
          competitionId: inv.competitionId,
          occurredAt: inv.viewedAt || inv.invitedAt
        });
      }
    }

    // 2. Scan OfferVersions -> PROPOSITION_SUBMITTED
    const offers = await postgresStore.getOffers();
    const offersById = new Map(offers.map(offer => [offer.id, offer]));
    const offerVersions = (await Promise.all(offers.map(offer => postgresStore.getOfferVersions(offer.id)))).flat();
    for (const ver of offerVersions) {
      const offer = offersById.get(ver.offerId);
      const providerOrgId = offer?.providerId;
      if (!providerOrgId) {
        throw new Error(`Cannot project offer version ${ver.id}: offer has no authoritative provider organization`);
      }
      if (!(await postgresStore.getProviderOrganization(providerOrgId))) continue;
      await projectOne({
        eventType: 'PROPOSITION_SUBMITTED',
        sourceEntityType: 'OFFER_VERSION',
        sourceEntityId: ver.id,
        providerOrganizationId: providerOrgId,
        challengeId: offer?.challengeId,
        occurredAt: ver.submittedAt,
        metadata: {
          offerId: ver.offerId,
          versionNumber: ver.versionNumber,
          round: ver.round
        }
      });
    }

    // 4. Scan Selections -> CONSUMER_SELECTED
    const selections = await postgresStore.getSelections();
    for (const sel of selections) {
      await projectOne({
        eventType: 'CONSUMER_SELECTED',
        sourceEntityType: 'SELECTION',
        sourceEntityId: sel.id,
        providerOrganizationId: sel.providerOrganizationId,
        challengeId: sel.challengeId,
        occurredAt: sel.selectedAt,
        metadata: {
          selectedOfferVersionId: sel.offerVersionId,
          offerId: sel.offerId,
          versionNumber: sel.versionNumber
        }
      });
    }

    // 5. Scan DisclosureEvents -> AUTHORIZED_CONNECTION
    const disclosures = await postgresStore.getDisclosureEvents();
    for (const disc of disclosures) {
      if (disc.recipientProviderOrganizationId) {
        const challenge = await postgresStore.getChallenge(disc.challengeId);
        await projectOne({
          eventType: 'AUTHORIZED_CONNECTION',
          sourceEntityType: 'DISCLOSURE_EVENT',
          sourceEntityId: disc.id,
          providerOrganizationId: disc.recipientProviderOrganizationId,
          challengeId: disc.challengeId,
          occurredAt: disc.disclosedAt,
          idempotencyKey: `evt:AUTHORIZED_CONNECTION:${disc.bindingHandoffId}`,
          metadata: {
            consentGrantId: disc.consentGrantId,
            bindingHandoffId: disc.bindingHandoffId,
            insuranceLine: challenge?.insuranceLine || challenge?.baseline.insuranceLine || 'PERSONAL_AUTO'
          }
        });
      }
    }

    // 6. Scan BindingHandoffs -> BOUND_ACQUISITION (only when status is BOUND)
    const handoffs = await postgresStore.getBindingHandoffs();
    const handoffsById = new Map(handoffs.map(handoff => [handoff.id, handoff]));
    for (const handoff of handoffs) {
      if (handoff.status === 'BOUND' && handoff.providerOrganizationId) {
        await projectOne({
          eventType: 'BOUND_ACQUISITION',
          sourceEntityType: 'BINDING_HANDOFF',
          sourceEntityId: handoff.id,
          providerOrganizationId: handoff.providerOrganizationId,
          challengeId: handoff.challengeId,
          occurredAt: handoff.boundAt || handoff.updatedAt || new Date().toISOString(),
          metadata: {
            policyNumber: handoff.policyNumber,
            finalPremium: handoff.finalPremium
          }
        });
      }
    }

    // 7. Scan ReconciliationReports -> VERIFIED_BOUND_OUTCOME (only verified verdicts)
    const reports = await postgresStore.getReconciliationReports();
    for (const rep of reports) {
      const isVerified = rep.verdict === 'MATCH' || rep.verdict === 'AUTHORIZED_VARIANCE' || rep.status === 'CONSUMER_ACCEPTED_VARIANCE';
      if (isVerified && rep.bindingHandoffId) {
        const handoff = handoffsById.get(rep.bindingHandoffId);
        if (handoff && handoff.providerOrganizationId) {
          await projectOne({
            eventType: 'VERIFIED_BOUND_OUTCOME',
            sourceEntityType: 'RECONCILIATION_REPORT',
            sourceEntityId: rep.id,
            providerOrganizationId: handoff.providerOrganizationId,
            challengeId: rep.challengeId,
            occurredAt: rep.reconciledAt,
            metadata: {
              verdict: rep.verdict,
              status: rep.status,
              bindingHandoffId: rep.bindingHandoffId
            }
          });
        }
      }
    }

    // 8. Scan Policy Vault Items -> BASELINE_ACTIVATED
    const vaultItems = await postgresStore.getPolicyVaultItems();
    for (const item of vaultItems) {
      if (item.futureCoverageBaselineId && item.bindingHandoffId) {
        const baseline = await postgresStore.getCoverageBaseline(item.futureCoverageBaselineId);
        const handoff = handoffsById.get(item.bindingHandoffId);
        if (baseline && handoff && handoff.providerOrganizationId) {
          await projectOne({
            eventType: 'BASELINE_ACTIVATED',
            sourceEntityType: 'COVERAGE_BASELINE',
            sourceEntityId: baseline.id,
            providerOrganizationId: handoff.providerOrganizationId,
            challengeId: handoff.challengeId,
            occurredAt: baseline.effectiveDate || item.filedAt,
            metadata: {
              baselineVersion: baseline.version,
              policyVaultItemId: item.id
            }
          });
        }
      }
    }

    return { scanned, projected, alreadyExisted, errors, countsByStage };
  }

  // =========================================================================
  // BillableEvent Methods (CE-4)
  // =========================================================================

  public async saveBillableEvent(billable: BillableEvent): Promise<boolean> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `INSERT INTO billable_events (
          id, commercial_event_id, provider_organization_id, commercial_agreement_id,
          charge_code, quantity, unit_price_cents, amount_cents, currency, status,
          rated_at, pricing_snapshot, idempotency_key, commercial_plan_version_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (idempotency_key) DO NOTHING;`,
        [
          billable.id,
          billable.commercialEventId,
          billable.providerOrganizationId,
          billable.commercialAgreementId,
          billable.chargeCode,
          billable.quantity,
          billable.unitPriceCents,
          billable.amountCents,
          billable.currency,
          billable.status,
          billable.ratedAt,
          JSON.stringify(billable.pricingSnapshot || {}),
          billable.idempotencyKey,
          billable.commercialPlanVersionId || null
        ]
      );
      const rowCount = res.rowCount ?? (res as any).affectedRows ?? 0;
      return rowCount > 0;
    } catch {
      return false;
    }
  }

  public async getBillableEventById(id: string): Promise<BillableEvent | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      commercial_event_id: string;
      provider_organization_id: string;
      commercial_agreement_id: string;
      commercial_plan_version_id: string | null;
      charge_code: string;
      quantity: number;
      unit_price_cents: number;
      amount_cents: number;
      currency: string;
      status: string;
      rated_at: string;
      pricing_snapshot: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM billable_events WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      commercialEventId: r.commercial_event_id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id || '',
      chargeCode: r.charge_code,
      quantity: r.quantity,
      unitPriceCents: r.unit_price_cents,
      amountCents: r.amount_cents,
      currency: 'USD',
      status: r.status as BillableEvent['status'],
      ratedAt: r.rated_at,
      pricingSnapshot: JSON.parse(r.pricing_snapshot || '{}'),
      idempotencyKey: r.idempotency_key
    };
  }

  public async getBillableEventByIdempotencyKey(key: string): Promise<BillableEvent | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      commercial_event_id: string;
      provider_organization_id: string;
      commercial_agreement_id: string;
      commercial_plan_version_id: string | null;
      charge_code: string;
      quantity: number;
      unit_price_cents: number;
      amount_cents: number;
      currency: string;
      status: string;
      rated_at: string;
      pricing_snapshot: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM billable_events WHERE idempotency_key = $1;`,
      [key]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      commercialEventId: r.commercial_event_id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id || '',
      chargeCode: r.charge_code,
      quantity: r.quantity,
      unitPriceCents: r.unit_price_cents,
      amountCents: r.amount_cents,
      currency: 'USD',
      status: r.status as BillableEvent['status'],
      ratedAt: r.rated_at,
      pricingSnapshot: JSON.parse(r.pricing_snapshot || '{}'),
      idempotencyKey: r.idempotency_key
    };
  }

  public async getBillableEventsForCommercialEvent(commercialEventId: string): Promise<BillableEvent[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      commercial_event_id: string;
      provider_organization_id: string;
      commercial_agreement_id: string;
      commercial_plan_version_id: string | null;
      charge_code: string;
      quantity: number;
      unit_price_cents: number;
      amount_cents: number;
      currency: string;
      status: string;
      rated_at: string;
      pricing_snapshot: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM billable_events WHERE commercial_event_id = $1 ORDER BY rated_at ASC;`,
      [commercialEventId]
    );

    return res.rows.map(r => ({
      id: r.id,
      commercialEventId: r.commercial_event_id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id || '',
      chargeCode: r.charge_code,
      quantity: r.quantity,
      unitPriceCents: r.unit_price_cents,
      amountCents: r.amount_cents,
      currency: 'USD',
      status: r.status as BillableEvent['status'],
      ratedAt: r.rated_at,
      pricingSnapshot: JSON.parse(r.pricing_snapshot || '{}'),
      idempotencyKey: r.idempotency_key
    }));
  }

  public async getBillableEventsForOrg(providerOrganizationId: string): Promise<BillableEvent[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      commercial_event_id: string;
      provider_organization_id: string;
      commercial_agreement_id: string;
      commercial_plan_version_id: string | null;
      charge_code: string;
      quantity: number;
      unit_price_cents: number;
      amount_cents: number;
      currency: string;
      status: string;
      rated_at: string;
      pricing_snapshot: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM billable_events
       WHERE provider_organization_id = $1
       ORDER BY rated_at DESC;`,
      [providerOrganizationId]
    );

    return res.rows.map(r => ({
      id: r.id,
      commercialEventId: r.commercial_event_id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id || '',
      chargeCode: r.charge_code,
      quantity: r.quantity,
      unitPriceCents: r.unit_price_cents,
      amountCents: r.amount_cents,
      currency: 'USD',
      status: r.status as BillableEvent['status'],
      ratedAt: r.rated_at,
      pricingSnapshot: JSON.parse(r.pricing_snapshot || '{}'),
      idempotencyKey: r.idempotency_key
    }));
  }

  public async getBillableEvents(query?: {
    providerOrganizationId?: string;
    status?: BillableEventStatus;
    chargeCode?: string;
    limit?: number;
  }): Promise<BillableEvent[]> {
    const client = await this.getClient();
    const conditions: string[] = [];
    const values: any[] = [];

    if (query?.providerOrganizationId) {
      values.push(query.providerOrganizationId);
      conditions.push(`provider_organization_id = $${values.length}`);
    }
    if (query?.status) {
      values.push(query.status);
      conditions.push(`status = $${values.length}`);
    }
    if (query?.chargeCode) {
      values.push(query.chargeCode);
      conditions.push(`charge_code = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query?.limit || 500;
    values.push(limit);
    const sql = `SELECT * FROM billable_events ${whereClause} ORDER BY rated_at DESC LIMIT $${values.length};`;

    const res = await client.query<any>(sql, values);
    return res.rows.map(r => ({
      id: r.id,
      commercialEventId: r.commercial_event_id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id || '',
      chargeCode: r.charge_code,
      quantity: r.quantity,
      unitPriceCents: r.unit_price_cents,
      amountCents: r.amount_cents,
      currency: 'USD',
      status: r.status as BillableEvent['status'],
      ratedAt: r.rated_at,
      pricingSnapshot: JSON.parse(r.pricing_snapshot || '{}'),
      idempotencyKey: r.idempotency_key
    }));
  }

  // =========================================================================
  // RatingAdjustment Methods (CE-4 Section 9)
  // =========================================================================

  public async saveRatingAdjustment(adj: RatingAdjustment): Promise<boolean> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `INSERT INTO rating_adjustments (
          id, original_billable_event_id, provider_organization_id,
          adjustment_type, amount_cents, reason, authorized_by, authorized_at, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (idempotency_key) DO NOTHING;`,
        [
          adj.id,
          adj.originalBillableEventId,
          adj.providerOrganizationId,
          adj.adjustmentType,
          adj.amountCents,
          adj.reason,
          adj.authorizedBy,
          adj.authorizedAt,
          adj.idempotencyKey
        ]
      );
      const rowCount = res.rowCount ?? (res as any).affectedRows ?? 0;
      return rowCount > 0;
    } catch {
      return false;
    }
  }

  public async getRatingAdjustmentsForBillableEvent(billableEventId: string): Promise<RatingAdjustment[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      original_billable_event_id: string;
      provider_organization_id: string;
      adjustment_type: string;
      amount_cents: number;
      reason: string;
      authorized_by: string;
      authorized_at: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM rating_adjustments WHERE original_billable_event_id = $1 ORDER BY authorized_at ASC;`,
      [billableEventId]
    );

    return res.rows.map(r => ({
      id: r.id,
      originalBillableEventId: r.original_billable_event_id,
      providerOrganizationId: r.provider_organization_id,
      adjustmentType: r.adjustment_type as RatingAdjustmentType,
      amountCents: r.amount_cents,
      reason: r.reason,
      authorizedBy: r.authorized_by,
      authorizedAt: r.authorized_at,
      idempotencyKey: r.idempotency_key
    }));
  }

  public async getRatingAdjustmentsForOrg(providerOrganizationId: string): Promise<RatingAdjustment[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      original_billable_event_id: string;
      provider_organization_id: string;
      adjustment_type: string;
      amount_cents: number;
      reason: string;
      authorized_by: string;
      authorized_at: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM rating_adjustments WHERE provider_organization_id = $1 ORDER BY authorized_at DESC;`,
      [providerOrganizationId]
    );

    return res.rows.map(r => ({
      id: r.id,
      originalBillableEventId: r.original_billable_event_id,
      providerOrganizationId: r.provider_organization_id,
      adjustmentType: r.adjustment_type as RatingAdjustmentType,
      amountCents: r.amount_cents,
      reason: r.reason,
      authorizedBy: r.authorized_by,
      authorizedAt: r.authorized_at,
      idempotencyKey: r.idempotency_key
    }));
  }

  public async getRatingAdjustmentById(id: string): Promise<RatingAdjustment | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      original_billable_event_id: string;
      provider_organization_id: string;
      adjustment_type: string;
      amount_cents: number;
      reason: string;
      authorized_by: string;
      authorized_at: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM rating_adjustments WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      originalBillableEventId: r.original_billable_event_id,
      providerOrganizationId: r.provider_organization_id,
      adjustmentType: r.adjustment_type as RatingAdjustmentType,
      amountCents: r.amount_cents,
      reason: r.reason,
      authorizedBy: r.authorized_by,
      authorizedAt: r.authorized_at,
      idempotencyKey: r.idempotency_key
    };
  }

  public async getRatingAdjustmentByIdempotencyKey(key: string): Promise<RatingAdjustment | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      original_billable_event_id: string;
      provider_organization_id: string;
      adjustment_type: string;
      amount_cents: number;
      reason: string;
      authorized_by: string;
      authorized_at: string;
      idempotency_key: string;
    }>(
      `SELECT * FROM rating_adjustments WHERE idempotency_key = $1;`,
      [key]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      originalBillableEventId: r.original_billable_event_id,
      providerOrganizationId: r.provider_organization_id,
      adjustmentType: r.adjustment_type as RatingAdjustmentType,
      amountCents: r.amount_cents,
      reason: r.reason,
      authorizedBy: r.authorized_by,
      authorizedAt: r.authorized_at,
      idempotencyKey: r.idempotency_key
    };
  }

  public async createRatingAdjustment(params: {
    originalBillableEventId: string;
    adjustmentType: RatingAdjustmentType;
    amountCents?: number;
    reason: string;
    authorizedBy: string;
    idempotencyKey?: string;
  }): Promise<RatingAdjustment> {
    const original = await this.getBillableEventById(params.originalBillableEventId);
    if (!original) {
      throw new Error(`Original BillableEvent not found: ${params.originalBillableEventId}`);
    }

    const priorAdjustments = await this.getRatingAdjustmentsForBillableEvent(params.originalBillableEventId);
    const existingAdjustedCents = priorAdjustments.reduce((sum, a) => sum + a.amountCents, 0); // negative number

    // Requested credit/reversal magnitude:
    const requestedMagnitude = params.amountCents !== undefined ? Math.abs(params.amountCents) : original.amountCents;
    const availableCredit = original.amountCents + existingAdjustedCents; // e.g. 5000 + (-2000) = 3000

    if (requestedMagnitude > availableCredit) {
      throw new Error(`Adjustment amount (${requestedMagnitude} cents) exceeds maximum available refundable amount (${availableCredit} cents)`);
    }

    const amountCents = -requestedMagnitude;
    const adj = buildRatingAdjustment({
      originalBillableEvent: original,
      adjustmentType: params.adjustmentType,
      amountCents,
      reason: params.reason,
      authorizedBy: params.authorizedBy,
      idempotencyKey: params.idempotencyKey
    });

    const inserted = await this.saveRatingAdjustment(adj);
    if (!inserted) {
      const existing = await this.getRatingAdjustmentByIdempotencyKey(adj.idempotencyKey);
      if (existing) return existing;
    }
    return adj;
  }

  // =========================================================================
  // RatingRun & Orchestration Methods (CE-4 Section 11)
  // =========================================================================

  public async saveRatingRun(run: RatingRun): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO rating_runs (
        id, started_at, completed_at, events_evaluated, billable_events_created,
        included_count, not_rated_count, exempt_count, previously_rated_count,
        gross_rated_cents, adjustment_cents, errors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        completed_at = EXCLUDED.completed_at,
        events_evaluated = EXCLUDED.events_evaluated,
        billable_events_created = EXCLUDED.billable_events_created,
        included_count = EXCLUDED.included_count,
        not_rated_count = EXCLUDED.not_rated_count,
        exempt_count = EXCLUDED.exempt_count,
        previously_rated_count = EXCLUDED.previously_rated_count,
        gross_rated_cents = EXCLUDED.gross_rated_cents,
        adjustment_cents = EXCLUDED.adjustment_cents,
        errors = EXCLUDED.errors;`,
      [
        run.id,
        run.startedAt,
        run.completedAt,
        run.eventsEvaluated,
        run.billableEventsCreated,
        run.includedCount,
        run.notRatedCount,
        run.exemptCount,
        run.previouslyRatedCount,
        run.grossRatedCents,
        run.adjustmentCents,
        JSON.stringify(run.errors || [])
      ]
    );
  }

  public async getRatingRuns(limit = 50): Promise<RatingRun[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      started_at: string;
      completed_at: string;
      events_evaluated: number;
      billable_events_created: number;
      included_count: number;
      not_rated_count: number;
      exempt_count: number;
      previously_rated_count: number;
      gross_rated_cents: number;
      adjustment_cents: number;
      errors: string;
    }>(
      `SELECT * FROM rating_runs ORDER BY started_at DESC LIMIT $1;`,
      [limit]
    );

    return res.rows.map(r => ({
      id: r.id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      eventsEvaluated: r.events_evaluated,
      billableEventsCreated: r.billable_events_created,
      includedCount: r.included_count,
      notRatedCount: r.not_rated_count,
      exemptCount: r.exempt_count,
      previouslyRatedCount: r.previously_rated_count,
      grossRatedCents: r.gross_rated_cents,
      adjustmentCents: r.adjustment_cents,
      errors: JSON.parse(r.errors || '[]')
    }));
  }

  public async getRatingRunById(id: string): Promise<RatingRun | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      started_at: string;
      completed_at: string;
      events_evaluated: number;
      billable_events_created: number;
      included_count: number;
      not_rated_count: number;
      exempt_count: number;
      previously_rated_count: number;
      gross_rated_cents: number;
      adjustment_cents: number;
      errors: string;
    }>(
      `SELECT * FROM rating_runs WHERE id = $1;`,
      [id]
    );

    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      eventsEvaluated: r.events_evaluated,
      billableEventsCreated: r.billable_events_created,
      includedCount: r.included_count,
      notRatedCount: r.not_rated_count,
      exemptCount: r.exempt_count,
      previouslyRatedCount: r.previously_rated_count,
      grossRatedCents: r.gross_rated_cents,
      adjustmentCents: r.adjustment_cents,
      errors: JSON.parse(r.errors || '[]')
    };
  }

  /**
   * Deterministic Commercial Rating Engine (CE-4).
   * Rates a single immutable CommercialEvent against historical plan version and agreement.
   * Completely idempotent: if already rated, returns PREVIOUSLY_RATED with existing BillableEvent.
   */
  public async rateCommercialEventById(eventId: string): Promise<RatingDecision> {
    const ratedAt = new Date().toISOString();
    const event = await this.getCommercialEventById(eventId);
    if (!event) {
      return {
        disposition: 'NOT_RATED',
        billable: false,
        commercialEventId: eventId,
        providerOrganizationId: '',
        commercialAgreementId: '',
        commercialPlanVersionId: '',
        quantity: 0,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'CommercialEvent not found',
        ratedAt,
        error: 'EVENT_NOT_FOUND'
      };
    }

    // 1. Idempotency Check: Already rated?
    const existingBillables = await this.getBillableEventsForCommercialEvent(eventId);
    if (existingBillables.length > 0) {
      const existing = existingBillables[0];
      return {
        disposition: 'PREVIOUSLY_RATED',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: existing.commercialAgreementId,
        commercialPlanVersionId: existing.commercialPlanVersionId || '',
        chargeCode: existing.chargeCode,
        quantity: existing.quantity,
        unitPriceCents: existing.unitPriceCents,
        amountCents: existing.amountCents,
        currency: existing.currency,
        reason: 'Event previously rated into BillableEvent',
        ratedAt: existing.ratedAt,
        pricingSnapshot: existing.pricingSnapshot
      };
    }

    // 2. Event Integrity Hash Check
    if (!verifyCommercialEventHash(event)) {
      return {
        disposition: 'NOT_RATED',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: event.commercialAgreementId || '',
        commercialPlanVersionId: event.commercialPlanVersionId || '',
        quantity: 0,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'Event hash verification failed (tamper detected)',
        ratedAt,
        error: 'EVENT_HASH_INVALID'
      };
    }

    // 3. Historical Agreement Resolution
    let agreement: CommercialAgreement | undefined;
    if (event.commercialAgreementId) {
      agreement = await this.getCommercialAgreementById(event.commercialAgreementId);
    }
    if (!agreement) {
      agreement = await this.getActiveAgreementForOrg(event.providerOrganizationId);
    }
    if (!agreement) {
      return {
        disposition: 'NOT_RATED',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: '',
        commercialPlanVersionId: '',
        quantity: 0,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: 'No valid historical or active agreement found for provider',
        ratedAt,
        error: 'AGREEMENT_NOT_FOUND'
      };
    }

    // Check agreement lifecycle at occurredAt
    if (agreement.status === 'TERMINATED' || agreement.status === 'EXPIRED') {
      if (agreement.endsAt && event.occurredAt > agreement.endsAt) {
        return {
          disposition: 'NOT_RATED',
          billable: false,
          commercialEventId: event.id,
          providerOrganizationId: event.providerOrganizationId,
          commercialAgreementId: agreement.id,
          commercialPlanVersionId: agreement.planVersionId,
          quantity: 0,
          unitPriceCents: 0,
          amountCents: 0,
          currency: 'USD',
          reason: `Agreement was ${agreement.status} prior to event occurrence`,
          ratedAt,
          error: 'AGREEMENT_NOT_ACTIVE'
        };
      }
    }

    // 4. Historical Plan Version Resolution
    const planVersionId = event.commercialPlanVersionId || agreement.planVersionId;
    const planVersion = await this.getCommercialPlanVersion(planVersionId);
    if (!planVersion) {
      return {
        disposition: 'NOT_RATED',
        billable: false,
        commercialEventId: event.id,
        providerOrganizationId: event.providerOrganizationId,
        commercialAgreementId: agreement.id,
        commercialPlanVersionId: planVersionId,
        quantity: 0,
        unitPriceCents: 0,
        amountCents: 0,
        currency: 'USD',
        reason: `Historical plan version ${planVersionId} not found`,
        ratedAt,
        error: 'PLAN_VERSION_NOT_FOUND'
      };
    }

    // 5. Prior Usage Calculation (for tiered/included capacity)
    let priorUsageCount = 0;
    if (event.eventType === 'AUTHORIZED_CONNECTION') {
      const prior = await this.getBillableEvents({
        providerOrganizationId: event.providerOrganizationId,
        limit: 1000
      });
      priorUsageCount = prior.filter(b =>
        b.chargeCode === 'AUTHORIZED_CONNECTION_UNIT' || b.chargeCode === 'AUTHORIZED_CONNECTION_INCLUDED'
      ).length;
    }

    // 6. Execute Pure Domain Rating
    const decision = rateCommercialEvent({
      event,
      agreement,
      planVersion,
      priorUsageCount
    });

    // 7. Persist BillableEvent if BILLABLE
    if (decision.disposition === 'BILLABLE') {
      const billable = buildBillableEvent({ decision, event });
      await this.saveBillableEvent(billable);
    }

    return decision;
  }

  /**
   * Scans unrated CommercialEvents and processes them through the Rating Engine.
   * Completely safe to rerun repeatedly (idempotent ON CONFLICT DO NOTHING).
   */
  public async reconcileUnratedCommercialEvents(limit = 1000): Promise<RatingRun> {
    const startedAt = new Date().toISOString();
    const runId = `run_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const client = await this.getClient();
    const res = await client.query<{ id: string }>(
      `SELECT ce.id
       FROM commercial_events ce
       WHERE NOT EXISTS (
         SELECT 1 FROM billable_events be WHERE be.commercial_event_id = ce.id
       )
       ORDER BY ce.occurred_at ASC
       LIMIT $1;`,
      [limit]
    );

    let eventsEvaluated = 0;
    let billableEventsCreated = 0;
    let includedCount = 0;
    let notRatedCount = 0;
    let exemptCount = 0;
    let previouslyRatedCount = 0;
    let grossRatedCents = 0;
    const errors: string[] = [];

    for (const row of res.rows) {
      eventsEvaluated++;
      try {
        const decision = await this.rateCommercialEventById(row.id);
        if (decision.disposition === 'BILLABLE') {
          billableEventsCreated++;
          grossRatedCents += decision.amountCents;
        } else if (decision.disposition === 'INCLUDED_IN_PLAN') {
          includedCount++;
        } else if (decision.disposition === 'EXEMPT') {
          exemptCount++;
        } else if (decision.disposition === 'PREVIOUSLY_RATED') {
          previouslyRatedCount++;
        } else {
          notRatedCount++;
          if (decision.error) {
            errors.push(`Event ${row.id}: ${decision.error} - ${decision.reason}`);
          }
        }
      } catch (err: any) {
        errors.push(`Event ${row.id}: ${err?.message || err}`);
      }
    }

    const run: RatingRun = {
      id: runId,
      startedAt,
      completedAt: new Date().toISOString(),
      eventsEvaluated,
      billableEventsCreated,
      includedCount,
      notRatedCount,
      exemptCount,
      previouslyRatedCount,
      grossRatedCents,
      adjustmentCents: 0,
      errors
    };

    await this.saveRatingRun(run);
    return run;
  }

  /**
   * Retrieves summary of rated commercial activity for a provider organization.
   */
  public async getCommercialActivitySummary(providerOrganizationId: string): Promise<{
    providerOrganizationId: string;
    grossRatedCents: number;
    adjustmentCents: number;
    netRatedCents: number;
    billableEventCount: number;
    adjustmentCount: number;
    byChargeCode: Record<string, { count: number; amountCents: number }>;
  }> {
    const billables = await this.getBillableEventsForOrg(providerOrganizationId);
    const adjustments = await this.getRatingAdjustmentsForOrg(providerOrganizationId);

    let grossRatedCents = 0;
    const byChargeCode: Record<string, { count: number; amountCents: number }> = {};
    for (const b of billables) {
      grossRatedCents += b.amountCents;
      if (!byChargeCode[b.chargeCode]) {
        byChargeCode[b.chargeCode] = { count: 0, amountCents: 0 };
      }
      byChargeCode[b.chargeCode].count++;
      byChargeCode[b.chargeCode].amountCents += b.amountCents;
    }

    const adjustmentCents = adjustments.reduce((sum, a) => sum + a.amountCents, 0); // negative
    const netRatedCents = Math.max(0, grossRatedCents + adjustmentCents);

    return {
      providerOrganizationId,
      grossRatedCents,
      adjustmentCents,
      netRatedCents,
      billableEventCount: billables.length,
      adjustmentCount: adjustments.length,
      byChargeCode
    };
  }

  // =========================================================================
  // Commercial Usage Records & Auditable Capacity Enforcement (CE-2)
  // =========================================================================

  public async saveUsageRecord(record: CommercialUsageRecord): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO commercial_usage_records (
        id, provider_organization_id, commercial_agreement_id, entitlement_id,
        usage_type, quantity, invitation_id, challenge_id, participation_id,
        consumed_at, idempotency_key, policy_mode, is_overage, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (idempotency_key) DO NOTHING;`,
      [
        record.id,
        record.providerOrganizationId,
        record.commercialAgreementId || null,
        record.entitlementId || null,
        record.usageType,
        record.quantity || 1,
        record.invitationId || null,
        record.challengeId || null,
        record.participationId || null,
        record.consumedAt,
        record.idempotencyKey,
        record.policyMode,
        record.isOverage,
        record.metadata ? JSON.stringify(record.metadata) : null
      ]
    );
  }

  public async getUsageRecordByIdempotencyKey(key: string): Promise<CommercialUsageRecord | undefined> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      commercial_agreement_id: string | null;
      entitlement_id: string | null;
      usage_type: string;
      quantity: number;
      invitation_id: string | null;
      challenge_id: string | null;
      participation_id: string | null;
      consumed_at: string;
      idempotency_key: string;
      policy_mode: string;
      is_overage: boolean;
      metadata: string | null;
    }>(
      `SELECT * FROM commercial_usage_records WHERE idempotency_key = $1;`,
      [key]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id || undefined,
      entitlementId: r.entitlement_id || undefined,
      usageType: r.usage_type as CommercialUsageRecord['usageType'],
      quantity: r.quantity,
      invitationId: r.invitation_id || undefined,
      challengeId: r.challenge_id || undefined,
      participationId: r.participation_id || undefined,
      consumedAt: r.consumed_at,
      idempotencyKey: r.idempotency_key,
      policyMode: r.policy_mode as CapacityEnforcementPolicy,
      isOverage: r.is_overage,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined
    };
  }

  public async getUsageCount(providerOrgId: string, usageType: string, agreementId?: string): Promise<number> {
    const client = await this.getClient();
    const query = agreementId
      ? `SELECT COALESCE(SUM(quantity), 0) AS count FROM commercial_usage_records WHERE provider_organization_id = $1 AND usage_type = $2 AND commercial_agreement_id = $3;`
      : `SELECT COALESCE(SUM(quantity), 0) AS count FROM commercial_usage_records WHERE provider_organization_id = $1 AND usage_type = $2;`;
    const params = agreementId ? [providerOrgId, usageType, agreementId] : [providerOrgId, usageType];
    const res = await client.query<{ count: string }>(query, params);
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  public async getUsageCountForEntitlement(entitlementId: string, providerOrgId: string): Promise<number> {
    const client = await this.getClient();
    const res = await client.query<{ count: string }>(
      `SELECT COALESCE(SUM(quantity), 0) AS count FROM commercial_usage_records WHERE entitlement_id = $1 AND provider_organization_id = $2;`,
      [entitlementId, providerOrgId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  public async getUsageRecordsForOrg(providerOrgId: string, limit = 100): Promise<CommercialUsageRecord[]> {
    const client = await this.getClient();
    const res = await client.query<{
      id: string;
      provider_organization_id: string;
      commercial_agreement_id: string | null;
      entitlement_id: string | null;
      usage_type: string;
      quantity: number;
      invitation_id: string | null;
      challenge_id: string | null;
      participation_id: string | null;
      consumed_at: string;
      idempotency_key: string;
      policy_mode: string;
      is_overage: boolean;
      metadata: string | null;
    }>(
      `SELECT * FROM commercial_usage_records WHERE provider_organization_id = $1 ORDER BY consumed_at DESC LIMIT $2;`,
      [providerOrgId, limit]
    );

    return res.rows.map(r => ({
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id || undefined,
      entitlementId: r.entitlement_id || undefined,
      usageType: r.usage_type as CommercialUsageRecord['usageType'],
      quantity: r.quantity,
      invitationId: r.invitation_id || undefined,
      challengeId: r.challenge_id || undefined,
      participationId: r.participation_id || undefined,
      consumedAt: r.consumed_at,
      idempotencyKey: r.idempotency_key,
      policyMode: r.policy_mode as CapacityEnforcementPolicy,
      isOverage: r.is_overage,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined
    }));
  }

  public async getUsageForInvitation(invitationId: string): Promise<CommercialUsageRecord | undefined> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM commercial_usage_records WHERE invitation_id = $1 LIMIT 1;`,
      [invitationId]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id || undefined,
      entitlementId: r.entitlement_id || undefined,
      usageType: r.usage_type as CommercialUsageRecord['usageType'],
      quantity: r.quantity,
      invitationId: r.invitation_id || undefined,
      challengeId: r.challenge_id || undefined,
      participationId: r.participation_id || undefined,
      consumedAt: r.consumed_at,
      idempotencyKey: r.idempotency_key,
      policyMode: r.policy_mode as CapacityEnforcementPolicy,
      isOverage: r.is_overage,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined
    };
  }

  public async releaseUsageRecord(id: string): Promise<void> {
    const client = await this.getClient();
    await client.query(`DELETE FROM commercial_usage_records WHERE id = $1;`, [id]);
  }

  public async linkParticipationToUsage(recordId: string, participationId: string): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `UPDATE commercial_usage_records SET participation_id = $1 WHERE id = $2;`,
      [participationId, recordId]
    );
  }

  private async getActiveCompetitionCount(providerOrgId: string): Promise<number> {
    const client = await this.getClient();
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (
         SELECT 'competition:' || p.competition_id AS capacity_key
         FROM challenge_participations p
         JOIN competitions c ON c.id = p.competition_id
         WHERE p.provider_organization_id = $1
           AND p.status <> 'WITHDRAWN'
           AND c.status IN ('PREPARING','MATCHING','INVITING','OPEN','CONSUMER_REVIEW')
         GROUP BY p.competition_id
         UNION ALL
         SELECT 'reservation:' || u.id AS capacity_key
         FROM commercial_usage_records u
         WHERE u.provider_organization_id = $1
           AND u.usage_type = 'ACTIVE_COMPETITION'
           AND u.participation_id IS NULL
       ) active_capacity;`,
      [providerOrgId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Atomically evaluates and consumes a concurrent-competition slot under PostgreSQL row locking.
   * Guarantees that concurrent requests cannot oversubscribe capacity, duplicate retries
   * are idempotent, and failed marketplace steps can be cleanly released without phantom usage.
   */
  public async consumeEngagementCapacity(params: {
    providerOrgId: string;
    invitationId: string;
    challengeId?: string;
    participationId?: string;
    idempotencyKey?: string;
  }): Promise<CommercialCapacityResult> {
    const { providerOrgId, invitationId, challengeId, participationId } = params;
    const idempotencyKey = params.idempotencyKey || `usage:active_competition:${providerOrgId}:${invitationId}`;
    const client = await this.getClient();

    // 1. Idempotency Check: if already recorded for this key, return idempotent success
    const existingUsage = await this.getUsageRecordByIdempotencyKey(idempotencyKey);
    if (existingUsage) {
      return {
        allowed: true,
        alreadyConsumed: true,
        isOverage: existingUsage.isOverage,
        currentUsage: await this.getActiveCompetitionCount(providerOrgId),
        enforcementPolicy: existingUsage.policyMode,
        usageRecord: existingUsage,
        code: 'WITHIN_CAPACITY'
      };
    }

    // 2. Begin atomic transaction with row lock on the commercial agreement
    await client.query('BEGIN;');
    try {
      // Lock active commercial agreement for this provider organization
      const agRes = await client.query<{
        id: string;
        commercial_account_id: string;
        provider_organization_id: string;
        plan_version_id: string;
        status: string;
        starts_at: string;
        ends_at: string | null;
      }>(
        `SELECT * FROM commercial_agreements 
         WHERE provider_organization_id = $1 AND status = 'ACTIVE' 
         FOR UPDATE;`,
        [providerOrgId]
      );

      if (agRes.rows.length === 0) {
        await client.query('COMMIT;');
        return {
          allowed: false,
          code: 'NO_ACTIVE_AGREEMENT',
          isOverage: false,
          currentUsage: 0,
          enforcementPolicy: 'HARD_BLOCK',
          reason: 'No active commercial agreement found for provider organization'
        };
      }

      const agreement = agRes.rows[0];

      // Retrieve the V2 concurrent-competition entitlement.
      const entRes = await client.query<{
        id: string;
        entitlement_type: string;
        limit_val: number | null;
        enforcement_policy: string;
      }>(
        `SELECT * FROM provider_entitlements 
         WHERE commercial_agreement_id = $1 AND entitlement_type = 'ACTIVE_COMPETITION_CAPACITY';`,
        [agreement.id]
      );

      const entitlement = entRes.rows[0];
      if (!entitlement || entitlement.limit_val === null) {
        await client.query('COMMIT;');
        return {
          allowed: false, code: 'COMMERCIAL_CAPACITY_REACHED', isOverage: false,
          currentUsage: 0, enforcementPolicy: 'HARD_BLOCK',
          reason: 'Concurrent competition entitlement is not configured'
        };
      }
      const limit = entitlement?.limit_val ?? undefined;
      const policy = (entitlement?.enforcement_policy as CapacityEnforcementPolicy) || 'HARD_BLOCK';

      // Reconstruct current active participation. Historical participation never
      // consumes a current slot after its competition reaches a terminal state.
      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM (
           SELECT 'competition:' || p.competition_id AS capacity_key
           FROM challenge_participations p
           JOIN competitions c ON c.id = p.competition_id
           WHERE p.provider_organization_id = $1
             AND p.status <> 'WITHDRAWN'
             AND c.status IN ('PREPARING','MATCHING','INVITING','OPEN','CONSUMER_REVIEW')
           GROUP BY p.competition_id
           UNION ALL
           SELECT 'reservation:' || u.id AS capacity_key
           FROM commercial_usage_records u
           WHERE u.provider_organization_id = $1
             AND u.usage_type = 'ACTIVE_COMPETITION'
             AND u.participation_id IS NULL
         ) active_capacity;`,
        [providerOrgId]
      );
      const currentUsage = parseInt(countRes.rows[0]?.count || '0', 10);

      // Evaluate capacity
      const isUnlimited = limit === undefined || limit === null || limit === -1;
      const withinLimit = isUnlimited || currentUsage < limit;

      if (!withinLimit && policy === 'HARD_BLOCK') {
        // HARD_BLOCK: refuse to consume capacity
        await client.query('COMMIT;');
        return {
          allowed: false,
          code: 'COMMERCIAL_CAPACITY_REACHED',
          isOverage: false,
          currentUsage,
          limit,
          enforcementPolicy: 'HARD_BLOCK',
          reason: `Concurrent competition capacity reached (${currentUsage}/${limit}) under HARD_BLOCK policy`
        };
      }

      // Allowed (within limit, or ALLOW_OVERAGE, or NOTIFY_ONLY)
      const isOverage = !withinLimit;
      const recordId = `cur_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO commercial_usage_records (
          id, provider_organization_id, commercial_agreement_id, entitlement_id,
          usage_type, quantity, invitation_id, challenge_id, participation_id,
          consumed_at, idempotency_key, policy_mode, is_overage, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
        [
          recordId,
          providerOrgId,
          agreement.id,
          entitlement?.id || null,
          'ACTIVE_COMPETITION',
          1,
          invitationId,
          challengeId || null,
          participationId || null,
          now,
          idempotencyKey,
          policy,
          isOverage,
          JSON.stringify({ invitationId, challengeId })
        ]
      );

      await client.query('COMMIT;');

      const usageRecord: CommercialUsageRecord = {
        id: recordId,
        providerOrganizationId: providerOrgId,
        commercialAgreementId: agreement.id,
        entitlementId: entitlement?.id,
        usageType: 'ACTIVE_COMPETITION',
        quantity: 1,
        invitationId,
        challengeId,
        participationId,
        consumedAt: now,
        idempotencyKey,
        policyMode: policy,
        isOverage,
        metadata: { invitationId, challengeId }
      };

      return {
        allowed: true,
        code: isOverage ? (policy === 'ALLOW_OVERAGE' ? 'OVERAGE_PERMITTED' : 'NOTIFY_CAPACITY_EXCEEDED') : 'WITHIN_CAPACITY',
        isOverage,
        currentUsage: currentUsage + 1,
        limit,
        enforcementPolicy: policy,
        usageRecord
      };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Atomically consumes one immutable offer-version submission from the current
   * contractual month. Each version counts once; retries are idempotent.
   */
  public async consumeOfferSubmissionCapacity(params: {
    providerOrgId: string;
    challengeId: string;
    offerVersionId: string;
    idempotencyKey?: string;
  }): Promise<CommercialCapacityResult> {
    const { providerOrgId, challengeId, offerVersionId } = params;
    const idempotencyKey = params.idempotencyKey ||
      `usage:offer_submission:${providerOrgId}:${offerVersionId}`;
    const client = await this.getClient();

    await client.query('BEGIN;');
    try {
      const existing = await client.query(
        `SELECT * FROM commercial_usage_records WHERE idempotency_key = $1 FOR UPDATE;`,
        [idempotencyKey]
      );
      if (existing.rows.length) {
        await client.query('COMMIT;');
        const usageRecord = await this.getUsageRecordByIdempotencyKey(idempotencyKey);
        return {
          allowed: true, alreadyConsumed: true, isOverage: Boolean(usageRecord?.isOverage),
          currentUsage: 0, enforcementPolicy: usageRecord?.policyMode || 'HARD_BLOCK',
          usageRecord, code: 'WITHIN_CAPACITY'
        };
      }

      const agreementResult = await client.query<{
        id: string; starts_at: string;
      }>(
        `SELECT id, starts_at FROM commercial_agreements
         WHERE provider_organization_id = $1 AND status = 'ACTIVE' FOR UPDATE;`,
        [providerOrgId]
      );
      if (!agreementResult.rows.length) {
        await client.query('COMMIT;');
        return { allowed: false, code: 'NO_ACTIVE_AGREEMENT', isOverage: false,
          currentUsage: 0, enforcementPolicy: 'HARD_BLOCK',
          reason: 'No active commercial agreement found for provider organization' };
      }
      const agreement = agreementResult.rows[0];
      const entitlementResult = await client.query<{
        id: string; limit_val: number | null; enforcement_policy: string;
      }>(
        `SELECT id, limit_val, enforcement_policy FROM provider_entitlements
         WHERE commercial_agreement_id = $1
           AND entitlement_type = 'MONTHLY_OFFER_SUBMISSION_CAPACITY';`,
        [agreement.id]
      );
      const entitlement = entitlementResult.rows[0];
      if (!entitlement || entitlement.limit_val === null) {
        await client.query('COMMIT;');
        return { allowed: false, code: 'COMMERCIAL_CAPACITY_REACHED', isOverage: false,
          currentUsage: 0, enforcementPolicy: 'HARD_BLOCK',
          reason: 'Monthly offer-submission entitlement is not configured' };
      }

      const start = new Date(agreement.starts_at);
      const now = new Date();
      const anniversary = (year: number, month: number): Date => {
        const normalized = new Date(Date.UTC(year, month, 1));
        const daysInMonth = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 0)).getUTCDate();
        return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(),
          Math.min(start.getUTCDate(), daysInMonth), start.getUTCHours(), start.getUTCMinutes(),
          start.getUTCSeconds(), start.getUTCMilliseconds()));
      };
      let periodStart = anniversary(now.getUTCFullYear(), now.getUTCMonth());
      if (periodStart > now) periodStart = anniversary(now.getUTCFullYear(), now.getUTCMonth() - 1);
      const periodEnd = anniversary(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1);

      const countResult = await client.query<{ count: string }>(
        `SELECT COALESCE(SUM(quantity), 0)::text AS count FROM commercial_usage_records
         WHERE commercial_agreement_id = $1 AND usage_type = 'OFFER_SUBMISSION'
           AND consumed_at >= $2 AND consumed_at < $3;`,
        [agreement.id, periodStart.toISOString(), periodEnd.toISOString()]
      );
      const currentUsage = parseInt(countResult.rows[0]?.count || '0', 10);
      const limit = entitlement.limit_val;
      const policy = (entitlement.enforcement_policy as CapacityEnforcementPolicy) || 'HARD_BLOCK';
      const withinLimit = currentUsage < limit;
      if (!withinLimit && policy === 'HARD_BLOCK') {
        await client.query('COMMIT;');
        return { allowed: false, code: 'COMMERCIAL_CAPACITY_REACHED', isOverage: false,
          currentUsage, limit, enforcementPolicy: policy,
          reason: `Monthly offer-submission capacity reached (${currentUsage}/${limit})` };
      }

      const isOverage = !withinLimit;
      const recordId = `cur_${crypto.randomBytes(8).toString('hex')}`;
      const consumedAt = now.toISOString();
      await client.query(
        `INSERT INTO commercial_usage_records (
          id, provider_organization_id, commercial_agreement_id, entitlement_id,
          usage_type, quantity, challenge_id, consumed_at, idempotency_key,
          policy_mode, is_overage, metadata
        ) VALUES ($1,$2,$3,$4,'OFFER_SUBMISSION',1,$5,$6,$7,$8,$9,$10);`,
        [recordId, providerOrgId, agreement.id, entitlement.id, challengeId, consumedAt,
          idempotencyKey, policy, isOverage, JSON.stringify({ offerVersionId,
            billingPeriodStart: periodStart.toISOString(), billingPeriodEnd: periodEnd.toISOString() })]
      );
      await client.query('COMMIT;');
      return {
        allowed: true,
        code: isOverage ? (policy === 'ALLOW_OVERAGE' ? 'OVERAGE_PERMITTED' : 'NOTIFY_CAPACITY_EXCEEDED') : 'WITHIN_CAPACITY',
        isOverage, currentUsage: currentUsage + 1, limit, enforcementPolicy: policy,
        usageRecord: { id: recordId, providerOrganizationId: providerOrgId,
          commercialAgreementId: agreement.id, entitlementId: entitlement.id,
          usageType: 'OFFER_SUBMISSION', quantity: 1, challengeId, consumedAt,
          idempotencyKey, policyMode: policy, isOverage, metadata: { offerVersionId,
            billingPeriodStart: periodStart.toISOString(), billingPeriodEnd: periodEnd.toISOString() } }
      };
    } catch (error) {
      await client.query('ROLLBACK;');
      throw error;
    }
  }

  /**
   * Explicitly enrolls a provider organization in a commercial agreement.
   * Side-effect: transitions prior agreement to TERMINATED and persists derived entitlements.
   */
  public async enrollCommercialAgreement(params: {
    providerOrgId: string;
    planId: string;
    planVersionId?: string;
    customTerms?: Record<string, any>;
    enforcementPolicy?: CapacityEnforcementPolicy;
    now?: string;
    actorRole?: 'ADMIN' | 'PROVIDER';
    membershipTrialDays?: number;
  }): Promise<{ agreement: CommercialAgreement; entitlements: ProviderEntitlement[]; planVersion: CommercialPlanVersion }> {
    const { providerOrgId, customTerms, enforcementPolicy, now = new Date().toISOString(), actorRole = 'PROVIDER' } = params;
    if (actorRole !== 'ADMIN') {
      throw Object.assign(new Error('COMMERCIAL_ACTIVATION_REQUIRES_PLATFORM_ADMIN'), { statusCode: 403 });
    }
    const rates = (customTerms?.rates || {}) as Record<string, unknown>;
    const lineConnectionPrices = (customTerms?.authorizedConnectionCentsByInsuranceLine || {}) as Record<string, unknown>;
    const pricedOutcomeTerms = [rates.BOUND_ACQUISITION_CENTS, rates.VERIFIED_BOUND_OUTCOME_CENTS,
      rates.AUTHORIZED_CONNECTION_CENTS, customTerms?.boundAcquisitionUnitPriceCents,
      customTerms?.authorizedConnectionUnitPriceCents, ...Object.values(lineConnectionPrices)]
      .some(value => typeof value === 'number' && value > 0);
    const financialTerms = customTerms && [
      'rates', 'recurringFeeCents',
      'authorizedConnectionCentsByInsuranceLine', 'recurringAddOns', 'selectedRecurringAddOns', 'implementationServices'
    ].some(key => key in customTerms);
    if (customTerms && actorRole !== 'ADMIN' && (pricedOutcomeTerms || financialTerms)) {
      throw Object.assign(new Error('Only an administrator may attach priced commercial terms.'), { statusCode: 403 });
    }
    if (pricedOutcomeTerms && !(customTerms?.compensationDeterminationApproved === true &&
      typeof customTerms?.determinationReference === 'string' && customTerms.determinationReference.trim())) {
      throw new Error('COMPENSATION_DETERMINATION_PENDING');
    }
    let planId = params.planId;
    const plan = (await this.getCommercialPlanById(planId)) || (await this.getCommercialPlanByCode(planId));
    if (plan) {
      planId = plan.id;
    }

    let account = await this.getCommercialAccountByOrgId(providerOrgId);
    if (!account) {
      account = {
        id: `cac_${providerOrgId}`,
        providerOrganizationId: providerOrgId,
        status: 'ACTIVE',
        currency: 'USD',
        createdAt: now,
        updatedAt: now
      };
      await this.saveCommercialAccount(account);
    }

    let planVersion: CommercialPlanVersion | undefined;
    if (params.planVersionId) {
      planVersion = await this.getCommercialPlanVersion(params.planVersionId);
    } else if (customTerms) {
      const latest = await this.getLatestPlanVersion(planId);
      const nextVersion = (latest?.version ?? 0) + 1;
      const versionId = `cpv_${planId}_v${nextVersion}_${Date.now()}`;
      const mergedTerms = {
        includedProducerSeats: 1,
        includedJurisdictions: 1,
        includedVpoCapacity: 10,
        includedConcurrentCompetitions: 10,
        includedMonthlyOfferSubmissions: 50,
        ...(latest?.termsSnapshot || {}),
        ...customTerms,
        capacityEnforcementPolicy: enforcementPolicy || customTerms.capacityEnforcementPolicy ||
          latest?.termsSnapshot.capacityEnforcementPolicy || 'HARD_BLOCK'
      };
      const selectedAddOns = (mergedTerms.selectedRecurringAddOns || {}) as Record<string, unknown>;
      const addOnCatalog = (mergedTerms.recurringAddOns || {}) as Record<string, unknown>;
      const includedServicesValue = (mergedTerms as Record<string, unknown>).includedServices;
      const includedServices = new Set(Array.isArray(includedServicesValue)
        ? includedServicesValue.map(String) : []);
      for (const [code, quantity] of Object.entries(selectedAddOns)) {
        if (!(code in addOnCatalog) || !Number.isInteger(quantity) || Number(quantity) <= 0) {
          throw new Error(`Invalid contracted recurring add-on selection: ${code}`);
        }
        if ((OPEN_POLICY_PREMIUM_V1_UNAVAILABLE_SERVICE_ADD_ONS as readonly string[]).includes(code)) {
          throw Object.assign(new Error(`PREMIUM_SERVICE_NOT_OPERATIONAL: ${code}`), { statusCode: 409 });
        }
        if (includedServices.has(code)) {
          throw Object.assign(new Error(`ADD_ON_ALREADY_INCLUDED_IN_PLAN: ${code}`), { statusCode: 409 });
        }
      }
      const governedServices = Object.keys(selectedAddOns).filter(code =>
        ['WORKFLOW_AUTOMATION','ENTERPRISE_REPORTING','API_INTEGRATION','MULTI_LOCATION_ADMINISTRATION'].includes(code));
      if (governedServices.length) {
        const client = await this.getClient();
        const controls = await client.query<{service_code:string;status:string}>(
          `SELECT service_code,status FROM premium_service_controls WHERE service_code = ANY($1);`, [governedServices]
        );
        const enabled = new Set(controls.rows.filter(row => row.status === 'ENABLED').map(row => row.service_code));
        const blocked = governedServices.find(code => !enabled.has(code));
        if (blocked) throw Object.assign(new Error(`PREMIUM_SERVICE_DISABLED: ${blocked}`), { statusCode: 409 });
      }
      planVersion = {
        id: versionId,
        planId,
        version: nextVersion,
        effectiveFrom: now,
        billingInterval: 'MONTHLY',
        recurringFeeCents: customTerms.recurringFeeCents ?? latest?.recurringFeeCents ?? 0,
        currency: 'USD',
        termsSnapshot: mergedTerms,
        createdAt: now
      };
      await this.saveCommercialPlanVersion(planVersion);
    } else {
      planVersion = await this.getLatestPlanVersion(planId);
    }

    if (!planVersion) {
      throw Object.assign(
        new Error('COMMERCIAL_PLAN_VERSION_REQUIRED: the selected plan has no approved executable version.'),
        { statusCode: 409 }
      );
    }

    const existingActive = await this.getActiveAgreementForOrg(providerOrgId);
    if (existingActive) {
      await this.saveCommercialAgreement({
        ...existingActive,
        status: 'TERMINATED',
        endsAt: now
      });
    }

    const trialDays = params.membershipTrialDays || 0;
    if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 30) {
      throw Object.assign(new Error('Membership trial must be an integer from 0 through 30 days.'), { statusCode: 400 });
    }
    const trialEnd = trialDays > 0
      ? new Date(Date.parse(now) + trialDays * 86_400_000).toISOString()
      : undefined;
    if (trialDays > 0) {
      const client = await this.getClient();
      const priorTrial = await client.query<{ id: string }>(
        `SELECT id FROM commercial_agreements
         WHERE provider_organization_id=$1 AND membership_trial_started_at IS NOT NULL
         LIMIT 1;`, [providerOrgId]
      );
      if (priorTrial.rows.length > 0) {
        throw Object.assign(new Error('MEMBERSHIP_TRIAL_ALREADY_USED'), { statusCode: 409 });
      }
    }
    const agreement: CommercialAgreement = {
      id: `cag_${providerOrgId}_${Date.now()}`,
      commercialAccountId: account.id,
      providerOrganizationId: providerOrgId,
      planVersionId: planVersion.id,
      status: 'ACTIVE',
      startsAt: now,
      acceptedAt: now,
      createdAt: now,
      membershipTrialStartedAt: trialDays > 0 ? now : undefined,
      membershipTrialEndsAt: trialEnd,
      membershipTrialStatus: trialDays > 0 ? 'ACTIVE' : undefined
    };
    await this.saveCommercialAgreement(agreement);

    const entitlements = deriveEntitlementsFromPlanVersion({ agreement, planVersion, now });
    if (enforcementPolicy) {
      entitlements.forEach(e => { e.enforcementPolicy = enforcementPolicy; });
    }
    for (const ent of entitlements) {
      await this.saveProviderEntitlement(ent);
    }

    return { agreement, entitlements, planVersion };
  }

  /**
   * Transitions agreement lifecycle state adhering to formal state transition rules.
   */
  public async transitionCommercialAgreement(
    agreementId: string,
    targetStatus: CommercialAgreement['status'],
    now = new Date().toISOString()
  ): Promise<CommercialAgreement | undefined> {
    const agreement = await this.getCommercialAgreementById(agreementId);
    if (!agreement) return undefined;

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['ACTIVE', 'TERMINATED'],
      ACTIVE: ['SUSPENDED', 'EXPIRED', 'TERMINATED'],
      SUSPENDED: ['ACTIVE', 'EXPIRED', 'TERMINATED'],
      EXPIRED: [],
      TERMINATED: []
    };

    const allowed = allowedTransitions[agreement.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(`Invalid lifecycle transition: cannot move from ${agreement.status} to ${targetStatus}`);
    }

    const updated: CommercialAgreement = {
      ...agreement,
      status: targetStatus,
      endsAt: (targetStatus === 'TERMINATED' || targetStatus === 'EXPIRED') ? (agreement.endsAt || now) : agreement.endsAt
    };
    await this.saveCommercialAgreement(updated);
    return updated;
  }

  /**
   * CANONICAL SEEDING (PRODUCTION):
   * Registers structural plan catalog definitions ONLY.
   * Zero unapproved prices, zero invented capacities, zero automatic agreement creations.
   */
  public async seedCanonicalPlans(): Promise<void> {
    const existingSolo = await this.getCommercialPlanByCode('PLAN_SOLO');
    if (!existingSolo) {
      await this.saveCommercialPlan({
        id: 'plan_solo_producer',
        code: 'PLAN_SOLO',
        displayName: 'Solo Producer',
        providerSegment: 'SOLO',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z'
      });
    }

    const existingAgency = await this.getCommercialPlanByCode('PLAN_AGENCY');
    if (!existingAgency) {
      await this.saveCommercialPlan({
        id: 'plan_agency_growth',
        code: 'PLAN_AGENCY',
        displayName: 'Agency Growth',
        providerSegment: 'AGENCY',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z'
      });
    }

    const existingEnterprise = await this.getCommercialPlanByCode('PLAN_ENTERPRISE');
    if (!existingEnterprise) {
      await this.saveCommercialPlan({
        id: 'plan_enterprise_network',
        code: 'PLAN_ENTERPRISE',
        displayName: 'Enterprise Carrier / Network',
        providerSegment: 'ENTERPRISE',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z'
      });
    }

    const existingNetwork = await this.getCommercialPlanByCode('PLAN_NETWORK');
    if (!existingNetwork) {
      await this.saveCommercialPlan({
        id: 'plan_network', code: 'PLAN_NETWORK', displayName: 'Network',
        providerSegment: 'NETWORK', status: 'ACTIVE',
        createdAt: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom
      });
    }

    let premiumPlan = await this.getCommercialPlanByCode('PLAN_OPEN_POLICY_PREMIUM');
    if (!premiumPlan) {
      premiumPlan = {
        id: 'plan_open_policy_premium',
        code: 'PLAN_OPEN_POLICY_PREMIUM',
        displayName: 'Open Policy Premium',
        providerSegment: 'AGENCY',
        status: 'ACTIVE',
        createdAt: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom
      };
      await this.saveCommercialPlan(premiumPlan);
    }
    // Historical V1 agreement anchor only. New enrollment catalogs expose V2.
    const premiumVersionId = 'cpv_open_policy_premium_v1';
    if (!(await this.getCommercialPlanVersion(premiumVersionId))) {
      await this.saveCommercialPlanVersion({
        id: premiumVersionId,
        planId: premiumPlan.id,
        version: 1,
        effectiveFrom: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom,
        billingInterval: 'MONTHLY',
        recurringFeeCents: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.providerMembershipCentsMonthly,
        currency: 'USD',
        termsSnapshot: {
          priceBookId: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.id,
          includedProducerSeats: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.includedProducerSeats,
          includedJurisdictions: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.includedJurisdictions,
          recurringAddOns: { ...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.recurringAddOns },
          selectedRecurringAddOns: {},
          implementationServices: { ...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.implementationServices },
          qualifiedEngagementUnitPriceCents: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.qualifiedEngagementCents,
          freeMarketplaceEvents: [...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.freeMarketplaceEvents],
          authorizedConnectionCentsByInsuranceLine: { ...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.authorizedConnectionCentsByInsuranceLine },
          authorizedConnectionMinimumCents: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.authorizedConnectionMinimumCents,
          authorizedConnectionMaximumCents: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.authorizedConnectionMaximumCents,
          unavailableInsuranceLines: [...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.unavailableInsuranceLines],
          rates: { VPO_ENGAGED_CENTS: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.qualifiedEngagementCents },
          compensationDeterminationApproved: false,
          unpricedOutcomeEvents: [...OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.unpricedOutcomeEvents],
          capacityEnforcementPolicy: 'ALLOW_OVERAGE'
        },
        createdAt: OPEN_POLICY_PREMIUM_PRICE_BOOK_V1.effectiveFrom
      });
    }
    // V2 is the founder-approved initial-launch catalog. V1 remains immutable
    // development history and is not rewritten or deleted.
    for (const [tier, definition] of Object.entries(OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.memberships)) {
      const plan = await this.getCommercialPlanByCode(definition.planCode);
      if (!plan) throw new Error(`Canonical commercial plan missing: ${definition.planCode}`);
      const versionId = `cpv_${definition.planCode.toLowerCase()}_v2`;
      if (await this.getCommercialPlanVersion(versionId)) continue;
      const includedServices = [...definition.includedServices];
      await this.saveCommercialPlanVersion({
        id: versionId, planId: plan.id,
        version: definition.planCode === 'PLAN_OPEN_POLICY_PREMIUM' ? 2 : 1,
        effectiveFrom: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom,
        billingInterval: 'MONTHLY', recurringFeeCents: definition.priceCentsMonthly,
        currency: 'USD',
        termsSnapshot: {
          priceBookId: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.id,
          membershipTier: tier,
          includedProducerSeats: definition.producerSeats,
          includedJurisdictions: definition.jurisdictions,
          includedConcurrentCompetitions: definition.concurrentCompetitions,
          includedMonthlyOfferSubmissions: definition.monthlyOfferSubmissions,
          includedServices,
          recurringAddOns: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.recurringAddOns },
          selectedRecurringAddOns: {},
          implementationServices: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.implementationServices },
          freeMarketplaceEvents: [...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.freeMarketplaceEvents],
          authorizedConnectionCentsByInsuranceLine: { ...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.authorizedConnectionCentsByInsuranceLine },
          unavailableInsuranceLines: [...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.unavailableInsuranceLines],
          compensationDeterminationApproved: false,
          unpricedOutcomeEvents: [...OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.unpricedOutcomeEvents],
          capacityEnforcementPolicy: 'HARD_BLOCK'
        },
        createdAt: OPEN_POLICY_COMMERCIAL_PRICE_BOOK_V2.effectiveFrom
      });
    }
  }

  /**
   * TEST FIXTURE SEEDER:
   * Explicitly populates mock plans and versioned terms strictly for automated test suites.
   * MUST NEVER be invoked in production startup.
   */
  public async seedTestCommercialFixtures(): Promise<void> {
    await this.seedCanonicalPlans();

    const soloPlan = await this.getCommercialPlanByCode('PLAN_SOLO');
    if (soloPlan) {
      await this.saveCommercialPlanVersion({
        id: 'fixture_cpv_solo_v1',
        planId: soloPlan.id,
        version: 99,
        effectiveFrom: '2026-01-01T00:00:00Z',
        billingInterval: 'MONTHLY',
        recurringFeeCents: 0,
        currency: 'USD',
        termsSnapshot: {
          includedProducerSeats: 1,
          includedJurisdictions: 1,
          includedVpoCapacity: 50,
          includedConcurrentCompetitions: 10,
          includedMonthlyOfferSubmissions: 50,
          capacityEnforcementPolicy: 'HARD_BLOCK'
        },
        createdAt: '2026-01-01T00:00:00Z'
      });
    }

    const agencyPlan = await this.getCommercialPlanByCode('PLAN_AGENCY');
    if (agencyPlan) {
      await this.saveCommercialPlanVersion({
        id: 'fixture_cpv_agency_v1',
        planId: agencyPlan.id,
        version: 99,
        effectiveFrom: '2026-01-01T00:00:00Z',
        billingInterval: 'MONTHLY',
        recurringFeeCents: 0,
        currency: 'USD',
        termsSnapshot: {
          includedProducerSeats: 5,
          includedJurisdictions: 3,
          includedVpoCapacity: 200,
          includedConcurrentCompetitions: 100,
          includedMonthlyOfferSubmissions: 200,
          capacityEnforcementPolicy: 'HARD_BLOCK'
        },
        createdAt: '2026-01-01T00:00:00Z'
      });
    }
  }

  /** Explicit non-production commercial bootstrap used only with fixture auth. */
  public async seedTestCommercialAgreements(): Promise<void> {
    await this.seedTestCommercialFixtures();
    const fixtures = [
      { providerOrgId: 'org_sierra', planId: 'PLAN_SOLO', planVersionId: 'fixture_cpv_solo_v1' },
      { providerOrgId: 'org_buckeye', planId: 'PLAN_AGENCY', planVersionId: 'fixture_cpv_agency_v1' },
      { providerOrgId: 'org_apex', planId: 'PLAN_AGENCY', planVersionId: 'fixture_cpv_agency_v1' }
    ];
    for (const fixture of fixtures) {
      if (await this.getActiveAgreementForOrg(fixture.providerOrgId)) continue;
      await this.enrollCommercialAgreement({ ...fixture, actorRole: 'ADMIN' });
    }
  }

  // =========================================================================
  // CE-5: Billing Periods, Invoicing & Settlement Methods
  // =========================================================================

  public async saveBillingPeriod(period: BillingPeriod): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO billing_periods (
        id, provider_organization_id, commercial_agreement_id, commercial_plan_version_id,
        period_start, period_end, status, closed_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        closed_at = EXCLUDED.closed_at;`,
      [
        period.id,
        period.providerOrganizationId,
        period.commercialAgreementId,
        period.commercialPlanVersionId,
        period.periodStart,
        period.periodEnd,
        period.status,
        period.closedAt || null,
        period.createdAt
      ]
    );
  }

  public async getBillingPeriodById(id: string): Promise<BillingPeriod | undefined> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM billing_periods WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      status: r.status as BillingPeriodStatus,
      closedAt: r.closed_at || undefined,
      createdAt: r.created_at
    };
  }

  public async getBillingPeriodsForOrg(providerOrganizationId: string): Promise<BillingPeriod[]> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM billing_periods WHERE provider_organization_id = $1 ORDER BY period_start DESC;`,
      [providerOrganizationId]
    );
    return res.rows.map(r => ({
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      status: r.status as BillingPeriodStatus,
      closedAt: r.closed_at || undefined,
      createdAt: r.created_at
    }));
  }

  public async closeBillingPeriod(id: string): Promise<BillingPeriod> {
    const period = await this.getBillingPeriodById(id);
    if (!period) throw new Error(`BillingPeriod not found: ${id}`);
    const closed: BillingPeriod = {
      ...period,
      status: 'CLOSED',
      closedAt: new Date().toISOString()
    };
    await this.saveBillingPeriod(closed);
    return closed;
  }

  public async saveInvoice(invoice: Invoice, transactionClient?: SqlClient): Promise<void> {
    const client = transactionClient || await this.getClient();
    await client.query(
      `INSERT INTO invoices (
        id, invoice_number, provider_organization_id, commercial_agreement_id,
        billing_period_id, status, currency, subtotal_cents, tax_cents,
        total_due_cents, balance_due_cents, issued_at, due_at, finalized_at,
        paid_at, idempotency_key, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        subtotal_cents = EXCLUDED.subtotal_cents,
        tax_cents = EXCLUDED.tax_cents,
        total_due_cents = EXCLUDED.total_due_cents,
        balance_due_cents = EXCLUDED.balance_due_cents,
        issued_at = EXCLUDED.issued_at,
        due_at = EXCLUDED.due_at,
        finalized_at = EXCLUDED.finalized_at,
        paid_at = EXCLUDED.paid_at;`,
      [
        invoice.id,
        invoice.invoiceNumber,
        invoice.providerOrganizationId,
        invoice.commercialAgreementId,
        invoice.billingPeriodId,
        invoice.status,
        invoice.currency,
        invoice.subtotalCents,
        invoice.taxCents,
        invoice.totalDueCents,
        invoice.balanceDueCents,
        invoice.issuedAt || null,
        invoice.dueAt || null,
        invoice.finalizedAt || null,
        invoice.paidAt || null,
        invoice.idempotencyKey,
        invoice.createdAt
      ]
    );
  }

  public async saveInvoiceLineItem(line: InvoiceLineItem, transactionClient?: SqlClient): Promise<void> {
    const client = transactionClient || await this.getClient();
    await client.query(
      `INSERT INTO invoice_line_items (
        id, invoice_id, line_type, description, quantity, unit_price_cents,
        amount_cents, billable_event_id, rating_adjustment_id, negotiated_service_charge_id, billing_period_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO NOTHING;`,
      [
        line.id,
        line.invoiceId,
        line.lineType,
        line.description,
        line.quantity,
        line.unitPriceCents,
        line.amountCents,
        line.billableEventId || null,
        line.ratingAdjustmentId || null,
        line.negotiatedServiceChargeId || null,
        line.billingPeriodId || null,
        line.createdAt
      ]
    );
  }

  public async getInvoiceById(id: string, transactionClient?: SqlClient): Promise<Invoice | undefined> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM invoices WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    const lineItems = await this.getInvoiceLineItems(id, client);
    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      billingPeriodId: r.billing_period_id,
      status: r.status as InvoiceStatus,
      currency: r.currency as 'USD',
      subtotalCents: r.subtotal_cents,
      taxCents: r.tax_cents,
      totalDueCents: r.total_due_cents,
      balanceDueCents: r.balance_due_cents,
      issuedAt: r.issued_at || undefined,
      dueAt: r.due_at || undefined,
      finalizedAt: r.finalized_at || undefined,
      paidAt: r.paid_at || undefined,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at,
      lineItems
    };
  }

  public async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM invoices WHERE invoice_number = $1;`,
      [invoiceNumber]
    );
    if (res.rows.length === 0) return undefined;
    return this.getInvoiceById(res.rows[0].id);
  }

  public async getInvoiceByIdempotencyKey(key: string, transactionClient?: SqlClient): Promise<Invoice | undefined> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM invoices WHERE idempotency_key = $1;`,
      [key]
    );
    if (res.rows.length === 0) return undefined;
    return this.getInvoiceById(res.rows[0].id, client);
  }

  public async getInvoicesForOrg(providerOrganizationId: string): Promise<Invoice[]> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM invoices WHERE provider_organization_id = $1 ORDER BY created_at DESC;`,
      [providerOrganizationId]
    );
    const invoices: Invoice[] = [];
    for (const r of res.rows) {
      const lineItems = await this.getInvoiceLineItems(r.id);
      invoices.push({
        id: r.id,
        invoiceNumber: r.invoice_number,
        providerOrganizationId: r.provider_organization_id,
        commercialAgreementId: r.commercial_agreement_id,
        billingPeriodId: r.billing_period_id,
        status: r.status as InvoiceStatus,
        currency: r.currency as 'USD',
        subtotalCents: r.subtotal_cents,
        taxCents: r.tax_cents,
        totalDueCents: r.total_due_cents,
        balanceDueCents: r.balance_due_cents,
        issuedAt: r.issued_at || undefined,
        dueAt: r.due_at || undefined,
        finalizedAt: r.finalized_at || undefined,
        paidAt: r.paid_at || undefined,
        idempotencyKey: r.idempotency_key,
        createdAt: r.created_at,
        lineItems
      });
    }
    return invoices;
  }

  /** Launch activation requires a fully settled recurring membership invoice. */
  public async hasPaidSubscriptionInvoice(providerOrganizationId: string, commercialAgreementId: string): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.query<{ count: number }>(
      `SELECT COUNT(DISTINCT i.id)::int AS count
       FROM invoices i
       JOIN invoice_line_items l ON l.invoice_id=i.id
       WHERE i.provider_organization_id=$1
         AND i.commercial_agreement_id=$2
         AND i.status='PAID'
         AND i.balance_due_cents=0
         AND i.paid_at IS NOT NULL
         AND l.line_type='SUBSCRIPTION'
         AND l.amount_cents>0;`,
      [providerOrganizationId, commercialAgreementId]
    );
    return Number(result.rows[0]?.count || 0) > 0;
  }

  public async getPlatformFinancialOverview(): Promise<Record<string, unknown>> {
    const client=await this.getClient();
    const [invoiceTotals,paymentTotals,refundTotals,eventTotals,recentInvoices,recentPayments,recentRefunds]=await Promise.all([
      client.query<any>(`SELECT COUNT(*)::int AS count,COALESCE(SUM(total_due_cents),0)::bigint AS invoiced_cents,COALESCE(SUM(balance_due_cents),0)::bigint AS outstanding_cents,COUNT(*) FILTER (WHERE status='PAST_DUE')::int AS past_due_count FROM invoices;`),
      client.query<any>(`SELECT COUNT(*)::int AS count,COALESCE(SUM(amount_cents) FILTER (WHERE status='SUCCEEDED'),0)::bigint AS collected_cents,COUNT(*) FILTER (WHERE status='FAILED')::int AS failed_count,COUNT(*) FILTER (WHERE status='PENDING')::int AS pending_count FROM payment_records;`),
      client.query<any>(`SELECT COUNT(*)::int AS count,COALESCE(SUM(amount_cents),0)::bigint AS refunded_cents FROM refund_records;`),
      client.query<any>(`SELECT e.event_type,COUNT(*)::int AS event_count,COALESCE(SUM(b.amount_cents),0)::bigint AS rated_cents
        FROM commercial_events e
        LEFT JOIN billable_events b ON b.commercial_event_id=e.id
        WHERE e.event_type IN ('VPO_AVAILABLE','VPO_VIEWED','PROPOSITION_SUBMITTED','CONSUMER_SELECTED','AUTHORIZED_CONNECTION','BOUND_ACQUISITION','VERIFIED_BOUND_OUTCOME','BASELINE_ACTIVATED')
        GROUP BY e.event_type ORDER BY e.event_type;`),
      client.query<any>(`SELECT i.id,i.invoice_number,i.provider_organization_id,o.display_name,i.status,i.total_due_cents,i.balance_due_cents,i.created_at FROM invoices i LEFT JOIN provider_organizations o ON o.id=i.provider_organization_id ORDER BY i.created_at DESC LIMIT 25;`),
      client.query<any>(`SELECT p.id,p.provider_organization_id,o.display_name,p.invoice_id,p.amount_cents,p.status,p.payment_method,p.created_at,p.settled_at FROM payment_records p LEFT JOIN provider_organizations o ON o.id=p.provider_organization_id ORDER BY p.created_at DESC LIMIT 25;`),
      client.query<any>(`SELECT r.id,r.provider_organization_id,o.display_name,r.original_payment_record_id,r.amount_cents,r.reason,r.refunded_at FROM refund_records r LEFT JOIN provider_organizations o ON o.id=r.provider_organization_id ORDER BY r.refunded_at DESC LIMIT 25;`)
    ]);
    const invoices=invoiceTotals.rows[0]||{};const payments=paymentTotals.rows[0]||{};const refunds=refundTotals.rows[0]||{};
    return {generatedAt:new Date().toISOString(),totals:{invoiceCount:Number(invoices.count||0),invoicedCents:Number(invoices.invoiced_cents||0),
      outstandingCents:Number(invoices.outstanding_cents||0),pastDueCount:Number(invoices.past_due_count||0),paymentCount:Number(payments.count||0),
      collectedCents:Number(payments.collected_cents||0),failedPaymentCount:Number(payments.failed_count||0),pendingPaymentCount:Number(payments.pending_count||0),
      refundCount:Number(refunds.count||0),refundedCents:Number(refunds.refunded_cents||0)},
      revenueEvents:eventTotals.rows.map(row=>({eventType:row.event_type,eventCount:Number(row.event_count),ratedCents:Number(row.rated_cents)})),
      recentInvoices:recentInvoices.rows.map(row=>({id:row.id,invoiceNumber:row.invoice_number,providerOrganizationId:row.provider_organization_id,providerName:row.display_name||row.provider_organization_id,status:row.status,totalDueCents:row.total_due_cents,balanceDueCents:row.balance_due_cents,createdAt:row.created_at})),
      recentPayments:recentPayments.rows.map(row=>({id:row.id,providerOrganizationId:row.provider_organization_id,providerName:row.display_name||row.provider_organization_id,invoiceId:row.invoice_id,amountCents:row.amount_cents,status:row.status,paymentMethod:row.payment_method,createdAt:row.created_at,settledAt:row.settled_at||undefined})),
      recentRefunds:recentRefunds.rows.map(row=>({id:row.id,providerOrganizationId:row.provider_organization_id,providerName:row.display_name||row.provider_organization_id,paymentId:row.original_payment_record_id,amountCents:row.amount_cents,reason:row.reason,refundedAt:row.refunded_at}))};
  }

  public async getInvoiceLineItems(invoiceId: string, transactionClient?: SqlClient): Promise<InvoiceLineItem[]> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY created_at ASC;`,
      [invoiceId]
    );
    return res.rows.map(r => ({
      id: r.id,
      invoiceId: r.invoice_id,
      lineType: r.line_type as InvoiceLineType,
      description: r.description,
      quantity: r.quantity,
      unitPriceCents: r.unit_price_cents,
      amountCents: r.amount_cents,
      billableEventId: r.billable_event_id || undefined,
      ratingAdjustmentId: r.rating_adjustment_id || undefined,
      negotiatedServiceChargeId: r.negotiated_service_charge_id || undefined,
      billingPeriodId: r.billing_period_id || undefined,
      createdAt: r.created_at
    }));
  }

  public async generateDraftInvoice(params: {
    providerOrganizationId: string;
    billingPeriodId: string;
    idempotencyKey?: string;
  }): Promise<{ invoice: Invoice; lineItems: InvoiceLineItem[] }> {
    const client = await this.getClient();
    const { providerOrganizationId, billingPeriodId } = params;

    const period = await this.getBillingPeriodById(billingPeriodId);
    if (!period) throw new Error(`BillingPeriod not found: ${billingPeriodId}`);
    if (period.providerOrganizationId !== providerOrganizationId) {
      throw new Error(`BillingPeriod ${billingPeriodId} does not belong to ${providerOrganizationId}`);
    }

    const planVersion = await this.getCommercialPlanVersion(period.commercialPlanVersionId);
    if (!planVersion) throw new Error(`CommercialPlanVersion not found: ${period.commercialPlanVersionId}`);

    // Check if an invoice already exists for this billing period
    const existing = await client.query<any>(
      `SELECT id FROM invoices WHERE billing_period_id = $1;`,
      [billingPeriodId]
    );
    if (existing.rows.length > 0) {
      const inv = await this.getInvoiceById(existing.rows[0].id);
      if (inv) return { invoice: inv, lineItems: inv.lineItems || [] };
    }

    // 1. Gather unbilled BillableEvents (status = 'RATED' and NOT in invoice_line_items)
    const billableEventsRes = await client.query<any>(
      `SELECT b.* FROM billable_events b
       WHERE b.provider_organization_id = $1
         AND b.status = 'RATED'
         AND b.id NOT IN (SELECT billable_event_id FROM invoice_line_items WHERE billable_event_id IS NOT NULL)
       ORDER BY b.rated_at ASC;`,
      [providerOrganizationId]
    );

    const billableEvents: BillableEvent[] = billableEventsRes.rows.map(r => ({
      id: r.id,
      commercialEventId: r.commercial_event_id,
      providerOrganizationId: r.provider_organization_id,
      commercialAgreementId: r.commercial_agreement_id,
      commercialPlanVersionId: r.commercial_plan_version_id,
      chargeCode: r.charge_code,
      quantity: r.quantity,
      unitPriceCents: r.unit_price_cents,
      amountCents: r.amount_cents,
      currency: r.currency as 'USD',
      status: r.status as BillableEventStatus,
      ratedAt: r.rated_at,
      pricingSnapshot: r.pricing_snapshot ? JSON.parse(r.pricing_snapshot) : {},
      idempotencyKey: r.idempotency_key
    }));

    // 2. Gather unapplied RatingAdjustments
    const adjustmentsRes = await client.query<any>(
      `SELECT a.* FROM rating_adjustments a
       WHERE a.provider_organization_id = $1
         AND a.id NOT IN (SELECT rating_adjustment_id FROM invoice_line_items WHERE rating_adjustment_id IS NOT NULL)
       ORDER BY a.authorized_at ASC;`,
      [providerOrganizationId]
    );

    const ratingAdjustments: RatingAdjustment[] = adjustmentsRes.rows.map(r => ({
      id: r.id,
      originalBillableEventId: r.original_billable_event_id,
      providerOrganizationId: r.provider_organization_id,
      adjustmentType: r.adjustment_type as RatingAdjustmentType,
      amountCents: r.amount_cents,
      reason: r.reason,
      authorizedBy: r.authorized_by,
      authorizedAt: r.authorized_at,
      idempotencyKey: r.idempotency_key
    }));

    const negotiatedServiceCharges = await this.getApprovedNegotiatedServiceCharges(
      providerOrganizationId, period.commercialAgreementId, period.periodEnd
    );

    const draft = assembleDraftInvoice({
      billingPeriod: period,
      planVersion,
      billableEvents,
      ratingAdjustments,
      negotiatedServiceCharges,
      idempotencyKey: params.idempotencyKey
    });

    // Save draft invoice and line items
    await this.saveInvoice(draft.invoice);
    for (const item of draft.lineItems) {
      await this.saveInvoiceLineItem(item);
      if (item.negotiatedServiceChargeId) {
        await client.query(
          `UPDATE negotiated_service_charges SET status = 'INVOICED', invoice_id = $1
           WHERE id = $2 AND status = 'APPROVED';`,
          [draft.invoice.id, item.negotiatedServiceChargeId]
        );
      }
    }

    return draft;
  }

  public async generateUsageInvoice(params: {
    providerOrganizationId: string;
    billingPeriodId: string;
    billableEventIds: string[];
    idempotencyKey: string;
  }): Promise<{ invoice: Invoice; lineItems: InvoiceLineItem[] }> {
    const existing = await this.getInvoiceByIdempotencyKey(params.idempotencyKey);
    if (existing) return { invoice: existing, lineItems: existing.lineItems || [] };
    const period = await this.getBillingPeriodById(params.billingPeriodId);
    if (!period || period.providerOrganizationId !== params.providerOrganizationId) {
      throw Object.assign(new Error('Billing period does not belong to provider organization.'), { statusCode: 409 });
    }
    const ids = [...new Set(params.billableEventIds.filter(Boolean))];
    if (!ids.length) throw Object.assign(new Error('billableEventIds is required.'), { statusCode: 400 });
    const billableEvents: BillableEvent[] = [];
    for (const id of ids) {
      const event = await this.getBillableEventById(id);
      if (!event) throw Object.assign(new Error(`Billable event not found: ${id}`), { statusCode: 404 });
      billableEvents.push(event);
    }
    const client = await this.getClient();
    const alreadyInvoiced = await client.query<{ billable_event_id:string }>(
      `SELECT billable_event_id FROM invoice_line_items WHERE billable_event_id = ANY($1::text[])`, [ids]
    );
    if (alreadyInvoiced.rows.length) {
      throw Object.assign(new Error('One or more billable events have already been invoiced.'), { statusCode: 409 });
    }
    const draft = assembleUsageInvoice({ billingPeriod: period, billableEvents, idempotencyKey: params.idempotencyKey });
    await client.transaction(async transactionClient => {
      const raced = await this.getInvoiceByIdempotencyKey(params.idempotencyKey, transactionClient);
      if (raced) return;
      await this.saveInvoice(draft.invoice, transactionClient);
      for (const item of draft.lineItems) await this.saveInvoiceLineItem(item, transactionClient);
    });
    const persisted = await this.getInvoiceByIdempotencyKey(params.idempotencyKey);
    if (!persisted) throw new Error('Usage invoice transaction did not persist an invoice.');
    return { invoice: persisted, lineItems: persisted.lineItems || [] };
  }

  public async createNegotiatedServiceCharge(params: {
    providerOrganizationId: string;
    commercialAgreementId: string;
    amountCents: number;
    executedAgreementReference: string;
    supportingReference: string;
    effectiveAt: string;
    authorizedBy: string;
    idempotencyKey: string;
  }): Promise<NegotiatedServiceCharge> {
    if (!Number.isInteger(params.amountCents) || params.amountCents < 250_000 || params.amountCents > 1_000_000) {
      throw Object.assign(new Error('Enterprise implementation amount must be an exact agreed value between $2,500 and $10,000.'), { statusCode: 400 });
    }
    if (!params.executedAgreementReference.trim() || !params.supportingReference.trim() || !params.idempotencyKey.trim()) {
      throw Object.assign(new Error('Executed agreement reference, supporting reference and idempotency key are required.'), { statusCode: 400 });
    }
    const agreement = await this.getCommercialAgreementById(params.commercialAgreementId);
    if (!agreement || agreement.providerOrganizationId !== params.providerOrganizationId) {
      throw Object.assign(new Error('Commercial agreement and provider organization do not match.'), { statusCode: 409 });
    }
    const now = new Date().toISOString();
    const charge: NegotiatedServiceCharge = {
      id: `nsc_${crypto.randomUUID()}`, providerOrganizationId: params.providerOrganizationId,
      commercialAgreementId: params.commercialAgreementId, serviceCode: 'ENTERPRISE_IMPLEMENTATION',
      amountCents: params.amountCents, currency: 'USD',
      executedAgreementReference: params.executedAgreementReference.trim(),
      supportingReference: params.supportingReference.trim(), effectiveAt: params.effectiveAt,
      status: 'APPROVED', authorizedBy: params.authorizedBy, authorizedAt: now,
      idempotencyKey: params.idempotencyKey
    };
    const client = await this.getClient();
    await client.query(
      `INSERT INTO negotiated_service_charges (
        id, provider_organization_id, commercial_agreement_id, service_code, amount_cents, currency,
        executed_agreement_reference, supporting_reference, effective_at, status, authorized_by,
        authorized_at, idempotency_key
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (idempotency_key) DO NOTHING;`,
      [charge.id, charge.providerOrganizationId, charge.commercialAgreementId, charge.serviceCode,
        charge.amountCents, charge.currency, charge.executedAgreementReference, charge.supportingReference,
        charge.effectiveAt, charge.status, charge.authorizedBy, charge.authorizedAt, charge.idempotencyKey]
    );
    const saved = await client.query<any>(`SELECT * FROM negotiated_service_charges WHERE idempotency_key = $1;`, [params.idempotencyKey]);
    return this.mapNegotiatedServiceCharge(saved.rows[0]);
  }

  public async getApprovedNegotiatedServiceCharges(providerOrganizationId: string, agreementId: string, through: string): Promise<NegotiatedServiceCharge[]> {
    const client = await this.getClient();
    const result = await client.query<any>(
      `SELECT * FROM negotiated_service_charges
       WHERE provider_organization_id = $1 AND commercial_agreement_id = $2
         AND status = 'APPROVED' AND effective_at <= $3 ORDER BY effective_at ASC;`,
      [providerOrganizationId, agreementId, through]
    );
    return result.rows.map(row => this.mapNegotiatedServiceCharge(row));
  }

  public async getNegotiatedServiceChargesForOrg(providerOrganizationId: string): Promise<NegotiatedServiceCharge[]> {
    const client = await this.getClient();
    const result = await client.query<any>(
      `SELECT * FROM negotiated_service_charges WHERE provider_organization_id = $1 ORDER BY authorized_at DESC;`,
      [providerOrganizationId]
    );
    return result.rows.map(row => this.mapNegotiatedServiceCharge(row));
  }

  private mapNegotiatedServiceCharge(row: any): NegotiatedServiceCharge {
    return {
      id: row.id, providerOrganizationId: row.provider_organization_id,
      commercialAgreementId: row.commercial_agreement_id, serviceCode: row.service_code,
      amountCents: row.amount_cents, currency: row.currency,
      executedAgreementReference: row.executed_agreement_reference,
      supportingReference: row.supporting_reference, effectiveAt: row.effective_at,
      status: row.status, authorizedBy: row.authorized_by, authorizedAt: row.authorized_at,
      idempotencyKey: row.idempotency_key, invoiceId: row.invoice_id || undefined
    };
  }

  public async finalizeInvoiceById(invoiceId: string): Promise<Invoice> {
    const client = await this.getClient();
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);
    if (invoice.status !== 'DRAFT') {
      return invoice; // Already finalized
    }

    const lineItems = await this.getInvoiceLineItems(invoiceId);
    const finalized = finalizeInvoice(invoice);

    await client.query('BEGIN');
    try {
      // 1. Atomically transition claimed BillableEvents from RATED to INVOICED
      for (const line of lineItems) {
        if (line.billableEventId) {
          await client.query(
            `UPDATE billable_events SET status = 'INVOICED' WHERE id = $1;`,
            [line.billableEventId]
          );
        }
      }

      // 2. Update invoice to FINALIZED
      await client.query(
        `UPDATE invoices SET
          status = $1,
          finalized_at = $2,
          issued_at = $3,
          due_at = $4
        WHERE id = $5;`,
        [
          finalized.status,
          finalized.finalizedAt,
          finalized.issuedAt,
          finalized.dueAt,
          finalized.id
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    return {
      ...finalized,
      lineItems
    };
  }

  // =========================================================================
  // Settlement Ledger Methods
  // =========================================================================

  public async savePaymentRecord(payment: PaymentRecord, transactionClient?: SqlClient): Promise<void> {
    const client = transactionClient || await this.getClient();
    await client.query(
      `INSERT INTO payment_records (
        id, provider_organization_id, invoice_id, amount_cents, currency,
        payment_method, status, external_reference, failure_reason, settled_at,
        idempotency_key, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        failure_reason = EXCLUDED.failure_reason,
        settled_at = EXCLUDED.settled_at;`,
      [
        payment.id,
        payment.providerOrganizationId,
        payment.invoiceId || null,
        payment.amountCents,
        payment.currency,
        payment.paymentMethod,
        payment.status,
        payment.externalReference || null,
        payment.failureReason || null,
        payment.settledAt || null,
        payment.idempotencyKey,
        payment.createdAt
      ]
    );
  }

  public async getPaymentRecordById(id: string, transactionClient?: SqlClient): Promise<PaymentRecord | undefined> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM payment_records WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      invoiceId: r.invoice_id || undefined,
      amountCents: r.amount_cents,
      currency: r.currency as 'USD',
      paymentMethod: r.payment_method as PaymentMethod,
      status: r.status as PaymentStatus,
      externalReference: r.external_reference || undefined,
      failureReason: r.failure_reason || undefined,
      settledAt: r.settled_at || undefined,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at
    };
  }

  public async getPaymentRecordByIdempotencyKey(idempotencyKey: string, transactionClient?: SqlClient): Promise<PaymentRecord | undefined> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<{ id: string }>(
      `SELECT id FROM payment_records WHERE idempotency_key = $1;`, [idempotencyKey]
    );
    return res.rows[0] ? this.getPaymentRecordById(res.rows[0].id, client) : undefined;
  }

  public async getPaymentsForOrg(providerOrganizationId: string): Promise<PaymentRecord[]> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM payment_records WHERE provider_organization_id = $1 ORDER BY created_at DESC;`,
      [providerOrganizationId]
    );
    return res.rows.map(r => ({
      id: r.id,
      providerOrganizationId: r.provider_organization_id,
      invoiceId: r.invoice_id || undefined,
      amountCents: r.amount_cents,
      currency: r.currency as 'USD',
      paymentMethod: r.payment_method as PaymentMethod,
      status: r.status as PaymentStatus,
      externalReference: r.external_reference || undefined,
      failureReason: r.failure_reason || undefined,
      settledAt: r.settled_at || undefined,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at
    }));
  }

  public async saveRefundRecord(refund: RefundRecord, transactionClient?: SqlClient): Promise<void> {
    const client = transactionClient || await this.getClient();
    await client.query(
      `INSERT INTO refund_records (
        id, original_payment_record_id, provider_organization_id, amount_cents,
        currency, reason, refunded_at, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING;`,
      [
        refund.id,
        refund.originalPaymentRecordId,
        refund.providerOrganizationId,
        refund.amountCents,
        refund.currency,
        refund.reason,
        refund.refundedAt,
        refund.idempotencyKey
      ]
    );
  }

  public async getRefundsForPayment(paymentId: string, transactionClient?: SqlClient): Promise<RefundRecord[]> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM refund_records WHERE original_payment_record_id = $1 ORDER BY refunded_at ASC;`,
      [paymentId]
    );
    return res.rows.map(r => ({
      id: r.id,
      originalPaymentRecordId: r.original_payment_record_id,
      providerOrganizationId: r.provider_organization_id,
      amountCents: r.amount_cents,
      currency: r.currency as 'USD',
      reason: r.reason,
      refundedAt: r.refunded_at,
      idempotencyKey: r.idempotency_key
    }));
  }

  public async getRefundByIdempotencyKey(idempotencyKey: string, transactionClient?: SqlClient): Promise<RefundRecord | undefined> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<any>(`SELECT * FROM refund_records WHERE idempotency_key = $1;`, [idempotencyKey]);
    if (!res.rows[0]) return undefined;
    const r = res.rows[0];
    return {
      id: r.id, originalPaymentRecordId: r.original_payment_record_id,
      providerOrganizationId: r.provider_organization_id, amountCents: r.amount_cents,
      currency: r.currency as 'USD', reason: r.reason, refundedAt: r.refunded_at,
      idempotencyKey: r.idempotency_key
    };
  }

  public async getRefundsForOrg(providerOrganizationId: string): Promise<RefundRecord[]> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM refund_records WHERE provider_organization_id = $1 ORDER BY refunded_at DESC;`,
      [providerOrganizationId]
    );
    return res.rows.map(r => ({
      id: r.id,
      originalPaymentRecordId: r.original_payment_record_id,
      providerOrganizationId: r.provider_organization_id,
      amountCents: r.amount_cents,
      currency: r.currency as 'USD',
      reason: r.reason,
      refundedAt: r.refunded_at,
      idempotencyKey: r.idempotency_key
    }));
  }

  public async saveSettlementAllocation(allocation: SettlementAllocation, transactionClient?: SqlClient): Promise<void> {
    const client = transactionClient || await this.getClient();
    await client.query(
      `INSERT INTO settlement_allocations (
        id, payment_record_id, refund_record_id, invoice_id, amount_allocated_cents, allocated_at
      ) VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        allocation.id,
        allocation.paymentRecordId,
        allocation.refundRecordId || null,
        allocation.invoiceId,
        allocation.amountAllocatedCents,
        allocation.allocatedAt
      ]
    );
  }

  public async getAllocationsForInvoice(invoiceId: string, transactionClient?: SqlClient): Promise<SettlementAllocation[]> {
    const client = transactionClient || await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM settlement_allocations WHERE invoice_id = $1 ORDER BY allocated_at ASC;`,
      [invoiceId]
    );
    return res.rows.map(r => ({
      id: r.id,
      paymentRecordId: r.payment_record_id,
      refundRecordId: r.refund_record_id || undefined,
      invoiceId: r.invoice_id,
      amountAllocatedCents: r.amount_allocated_cents,
      allocatedAt: r.allocated_at
    }));
  }

  public async recordPayment(params: {
    providerOrganizationId: string;
    amountCents: number;
    paymentMethod: PaymentMethod;
    invoiceId?: string;
    externalReference?: string;
    idempotencyKey?: string;
  }): Promise<{ payment: PaymentRecord; allocation?: SettlementAllocation; updatedInvoice?: Invoice }> {
    const client = await this.getClient();
    return client.transaction(transactionClient => this.recordPaymentTransaction(params, transactionClient));
  }

  private async recordPaymentTransaction(params: {
    providerOrganizationId: string;
    amountCents: number;
    paymentMethod: PaymentMethod;
    invoiceId?: string;
    externalReference?: string;
    idempotencyKey?: string;
  }, client: SqlClient): Promise<{ payment: PaymentRecord; allocation?: SettlementAllocation; updatedInvoice?: Invoice }> {
    const now = new Date().toISOString();
    let paymentId = `pay_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const idempotencyKey = params.idempotencyKey || `pay:${params.providerOrganizationId}:${Date.now()}`;

    const existing = await this.getPaymentRecordByIdempotencyKey(idempotencyKey, client);
    if (existing) {
      if (existing.providerOrganizationId !== params.providerOrganizationId ||
          existing.amountCents !== params.amountCents || existing.invoiceId !== params.invoiceId) {
        throw Object.assign(new Error('Payment idempotency key was already used with different settlement facts.'), { statusCode: 409 });
      }
      if (existing.status === 'SUCCEEDED') {
        const allocations = params.invoiceId ? await this.getAllocationsForInvoice(params.invoiceId, client) : [];
        return {
          payment: existing,
          allocation: allocations.find(item => item.paymentRecordId === existing.id),
          updatedInvoice: params.invoiceId ? await this.getInvoiceById(params.invoiceId, client) : undefined
        };
      }
      paymentId = existing.id;
    }

    const payment: PaymentRecord = {
      id: paymentId,
      providerOrganizationId: params.providerOrganizationId,
      invoiceId: params.invoiceId,
      amountCents: params.amountCents,
      currency: 'USD',
      paymentMethod: params.paymentMethod,
      status: 'SUCCEEDED',
      externalReference: params.externalReference,
      settledAt: now,
      idempotencyKey,
      createdAt: now
    };

    await this.savePaymentRecord(payment, client);

    let allocation: SettlementAllocation | undefined;
    let updatedInvoice: Invoice | undefined;

    if (params.invoiceId) {
      const invoice = await this.getInvoiceById(params.invoiceId, client);
      if (invoice) {
        if (params.amountCents > invoice.balanceDueCents) {
          throw Object.assign(new Error('Processor payment exceeds the authoritative invoice balance.'), { statusCode: 409 });
        }
        const allocId = `alc_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        allocation = {
          id: allocId,
          paymentRecordId: paymentId,
          invoiceId: invoice.id,
          amountAllocatedCents: params.amountCents,
          allocatedAt: now
        };
        await this.saveSettlementAllocation(allocation, client);

        // Recompute invoice balance
        const allAllocations = await this.getAllocationsForInvoice(invoice.id, client);
        const netAllocated = allAllocations.reduce((acc, a) => acc + (a.refundRecordId ? -a.amountAllocatedCents : a.amountAllocatedCents), 0);
        const newBalance = Math.max(0, invoice.totalDueCents - netAllocated);
        const newStatus: InvoiceStatus = newBalance === 0 ? 'PAID' : (netAllocated > 0 ? 'PARTIALLY_PAID' : invoice.status);

        await client.query(
          `UPDATE invoices SET
            balance_due_cents = $1,
            status = $2,
            paid_at = $3
          WHERE id = $4;`,
          [
            newBalance,
            newStatus,
            newStatus === 'PAID' ? now : null,
            invoice.id
          ]
        );

        updatedInvoice = {
          ...invoice,
          balanceDueCents: newBalance,
          status: newStatus,
          paidAt: newStatus === 'PAID' ? now : undefined
        };
      }
    }

    return { payment, allocation, updatedInvoice };
  }

  public async recordRefund(params: {
    paymentId: string;
    amountCents: number;
    reason: string;
    idempotencyKey?: string;
  }): Promise<{ refund: RefundRecord; allocation?: SettlementAllocation; updatedInvoice?: Invoice }> {
    const client = await this.getClient();
    return client.transaction(transactionClient => this.recordRefundTransaction(params, transactionClient));
  }

  private async recordRefundTransaction(params: {
    paymentId: string;
    amountCents: number;
    reason: string;
    idempotencyKey?: string;
  }, client: SqlClient): Promise<{ refund: RefundRecord; allocation?: SettlementAllocation; updatedInvoice?: Invoice }> {
    if (params.idempotencyKey) {
      const existing = await this.getRefundByIdempotencyKey(params.idempotencyKey, client);
      if (existing) {
        if (existing.originalPaymentRecordId !== params.paymentId || existing.amountCents !== params.amountCents) {
          throw Object.assign(new Error('Refund idempotency key was already used with different refund facts.'), { statusCode: 409 });
        }
        const original = await this.getPaymentRecordById(params.paymentId, client);
        const allocations = original?.invoiceId ? await this.getAllocationsForInvoice(original.invoiceId, client) : [];
        return {
          refund: existing,
          allocation: allocations.find(item => item.refundRecordId === existing.id),
          updatedInvoice: original?.invoiceId ? await this.getInvoiceById(original.invoiceId, client) : undefined
        };
      }
    }
    const payment = await this.getPaymentRecordById(params.paymentId, client);
    if (!payment) throw new Error(`PaymentRecord not found: ${params.paymentId}`);

    const existingRefunds = await this.getRefundsForPayment(payment.id, client);
    const priorTotal = existingRefunds.reduce((acc, r) => acc + r.amountCents, 0);

    const refund = buildRefundRecord({
      originalPayment: payment,
      amountCents: params.amountCents,
      reason: params.reason,
      priorRefundsTotalCents: priorTotal,
      idempotencyKey: params.idempotencyKey
    });

    await this.saveRefundRecord(refund, client);

    let allocation: SettlementAllocation | undefined;
    let updatedInvoice: Invoice | undefined;

    if (payment.invoiceId) {
      const invoice = await this.getInvoiceById(payment.invoiceId, client);
      if (invoice) {
        const allocId = `alc_ref_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        allocation = {
          id: allocId,
          paymentRecordId: payment.id,
          refundRecordId: refund.id,
          invoiceId: invoice.id,
          amountAllocatedCents: refund.amountCents,
          allocatedAt: refund.refundedAt
        };
        await this.saveSettlementAllocation(allocation, client);

        // Recompute invoice balance
        const allAllocations = await this.getAllocationsForInvoice(invoice.id, client);
        const netAllocated = allAllocations.reduce((acc, a) => acc + (a.refundRecordId ? -a.amountAllocatedCents : a.amountAllocatedCents), 0);
        const newBalance = Math.max(0, invoice.totalDueCents - netAllocated);
        const newStatus: InvoiceStatus = newBalance === 0 ? 'PAID' : (netAllocated > 0 ? 'PARTIALLY_PAID' : 'ISSUED');

        await client.query(
          `UPDATE invoices SET
            balance_due_cents = $1,
            status = $2,
            paid_at = $3
          WHERE id = $4;`,
          [
            newBalance,
            newStatus,
            newStatus === 'PAID' ? (invoice.paidAt || refund.refundedAt) : null,
            invoice.id
          ]
        );

        updatedInvoice = {
          ...invoice,
          balanceDueCents: newBalance,
          status: newStatus,
          paidAt: newStatus === 'PAID' ? invoice.paidAt : undefined
        };
      }
    }

    return { refund, allocation, updatedInvoice };
  }

  public async getAuthoritativeAccountBalance(providerOrganizationId: string): Promise<ProviderAccountBalance> {
    const client = await this.getClient();
    const invoices = await this.getInvoicesForOrg(providerOrganizationId);
    const payments = await this.getPaymentsForOrg(providerOrganizationId);
    const refunds = await this.getRefundsForOrg(providerOrganizationId);

    const allocationsRes = await client.query<any>(
      `SELECT sa.* FROM settlement_allocations sa
       JOIN invoices inv ON sa.invoice_id = inv.id
       WHERE inv.provider_organization_id = $1;`,
      [providerOrganizationId]
    );

    const allocations: SettlementAllocation[] = allocationsRes.rows.map(r => ({
      id: r.id,
      paymentRecordId: r.payment_record_id,
      refundRecordId: r.refund_record_id || undefined,
      invoiceId: r.invoice_id,
      amountAllocatedCents: r.amount_allocated_cents,
      allocatedAt: r.allocated_at
    }));

    return calculateAuthoritativeAccountBalance({
      providerOrganizationId,
      invoices,
      payments,
      refunds,
      allocations
    });
  }
}

export class InternalAccountingPaymentAdapter implements PaymentProviderAdapter {
  constructor(private commercialStore: CommercialStore) {}

  public async createPaymentIntent(params: {
    invoiceId: string;
    amountCents: number;
    currency: 'USD';
    metadata?: Record<string, unknown>;
  }): Promise<{ intentId: string; status: PaymentStatus; clientSecret?: string }> {
    const intentId = `pi_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      intentId,
      status: 'SUCCEEDED',
      clientSecret: `secret_${intentId}`
    };
  }

  public async retrievePaymentStatus(intentId: string): Promise<{
    intentId: string;
    status: PaymentStatus;
    amountCents: number;
  }> {
    return {
      intentId,
      status: 'SUCCEEDED',
      amountCents: 0
    };
  }

  public async refundPayment(params: {
    paymentId: string;
    amountCents: number;
    reason: string;
  }): Promise<{ refundId: string; status: 'SUCCEEDED' | 'FAILED' }> {
    const res = await this.commercialStore.recordRefund(params);
    return {
      refundId: res.refund.id,
      status: 'SUCCEEDED'
    };
  }
}

export const commercialStore = new CommercialStore();
export const paymentAdapter = new InternalAccountingPaymentAdapter(commercialStore);
