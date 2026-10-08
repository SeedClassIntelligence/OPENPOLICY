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
  finalizeInvoice,
  calculateAuthoritativeAccountBalance,
  buildRefundRecord
} from '../../domain/commercialEconomicsEngine';

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

  public async saveCommercialPlanVersion(version: CommercialPlanVersion): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO commercial_plan_versions (
        id, plan_id, version, effective_from, effective_until, billing_interval,
        recurring_fee_cents, currency, terms_snapshot, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING;`, // Immutable: never mutate historical versions
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
        status, starts_at, ends_at, accepted_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        ends_at = EXCLUDED.ends_at,
        accepted_at = EXCLUDED.accepted_at;`,
      [
        agreement.id,
        agreement.commercialAccountId,
        agreement.providerOrganizationId,
        agreement.planVersionId,
        agreement.status,
        agreement.startsAt,
        agreement.endsAt || null,
        agreement.acceptedAt || null,
        agreement.createdAt
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
      VPO_ENGAGED: 0,
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
    }) => {
      scanned++;
      const key = `evt:${params.eventType}:${params.sourceEntityId}`;
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

    // 2. Scan Participations -> VPO_ENGAGED
    const participations = await postgresStore.getAllParticipations();
    for (const part of participations) {
      await projectOne({
        eventType: 'VPO_ENGAGED',
        sourceEntityType: 'CHALLENGE_PARTICIPATION',
        sourceEntityId: part.id,
        providerOrganizationId: part.providerOrganizationId,
        challengeId: part.challengeId,
        competitionId: part.competitionId,
        occurredAt: part.acceptedAt
      });
    }

    // 3. Scan OfferVersions -> PROPOSITION_SUBMITTED
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
        await projectOne({
          eventType: 'AUTHORIZED_CONNECTION',
          sourceEntityType: 'DISCLOSURE_EVENT',
          sourceEntityId: disc.id,
          providerOrganizationId: disc.recipientProviderOrganizationId,
          challengeId: disc.challengeId,
          occurredAt: disc.disclosedAt,
          metadata: {
            consentGrantId: disc.consentGrantId,
            bindingHandoffId: disc.bindingHandoffId
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
    } else if (event.eventType === 'VPO_ENGAGED') {
      priorUsageCount = await this.getUsageCount(event.providerOrganizationId, 'ENGAGEMENT_CAPACITY', agreement.id);
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

  /**
   * Atomically evaluates and consumes VPO engagement capacity under PostgreSQL row locking.
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
    const idempotencyKey = params.idempotencyKey || `usage:vpo_engagement:${providerOrgId}:${invitationId}`;
    const client = await this.getClient();

    // 1. Idempotency Check: if already recorded for this key, return idempotent success
    const existingUsage = await this.getUsageRecordByIdempotencyKey(idempotencyKey);
    if (existingUsage) {
      return {
        allowed: true,
        alreadyConsumed: true,
        isOverage: existingUsage.isOverage,
        currentUsage: await this.getUsageCount(providerOrgId, 'VPO_ENGAGEMENT'),
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

      // Retrieve VPO_ENGAGEMENT_CAPACITY entitlement
      const entRes = await client.query<{
        id: string;
        entitlement_type: string;
        limit_val: number | null;
        enforcement_policy: string;
      }>(
        `SELECT * FROM provider_entitlements 
         WHERE commercial_agreement_id = $1 AND entitlement_type = 'VPO_ENGAGEMENT_CAPACITY';`,
        [agreement.id]
      );

      const entitlement = entRes.rows[0];
      const limit = entitlement?.limit_val ?? undefined;
      const policy = (entitlement?.enforcement_policy as CapacityEnforcementPolicy) || 'HARD_BLOCK';

      // Reconstruct actual usage from durable usage records inside the transaction
      const countRes = await client.query<{ count: string }>(
        `SELECT COALESCE(SUM(quantity), 0) AS count 
         FROM commercial_usage_records 
         WHERE provider_organization_id = $1 AND usage_type = 'VPO_ENGAGEMENT';`,
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
          reason: `VPO engagement capacity reached (${currentUsage}/${limit}) under HARD_BLOCK policy`
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
          'VPO_ENGAGEMENT',
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
        usageType: 'VPO_ENGAGEMENT',
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
  }): Promise<{ agreement: CommercialAgreement; entitlements: ProviderEntitlement[]; planVersion: CommercialPlanVersion }> {
    const { providerOrgId, customTerms, enforcementPolicy, now = new Date().toISOString(), actorRole = 'PROVIDER' } = params;
    const rates = (customTerms?.rates || {}) as Record<string, unknown>;
    const pricedOutcomeTerms = [rates.BOUND_ACQUISITION_CENTS, rates.VERIFIED_BOUND_OUTCOME_CENTS,
      rates.AUTHORIZED_CONNECTION_CENTS, customTerms?.boundAcquisitionUnitPriceCents,
      customTerms?.authorizedConnectionUnitPriceCents].some(value => typeof value === 'number' && value > 0);
    if (customTerms && actorRole !== 'ADMIN' && (pricedOutcomeTerms || 'rates' in customTerms)) {
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
      planVersion = {
        id: versionId,
        planId,
        version: nextVersion,
        effectiveFrom: now,
        billingInterval: 'MONTHLY',
        recurringFeeCents: customTerms.recurringFeeCents ?? 0,
        currency: 'USD',
        termsSnapshot: {
          includedProducerSeats: 1,
          includedJurisdictions: 1,
          includedVpoCapacity: 10,
          includedEngagementCapacity: 10,
          ...customTerms,
          capacityEnforcementPolicy: enforcementPolicy || customTerms.capacityEnforcementPolicy || 'HARD_BLOCK'
        },
        createdAt: now
      };
      await this.saveCommercialPlanVersion(planVersion);
    } else {
      planVersion = await this.getLatestPlanVersion(planId);
    }

    if (!planVersion) {
      const versionId = `cpv_${planId}_${Date.now()}`;
      planVersion = {
        id: versionId,
        planId,
        version: 1,
        effectiveFrom: now,
        billingInterval: 'MONTHLY',
        recurringFeeCents: 0,
        currency: 'USD',
        termsSnapshot: {
          includedProducerSeats: 5,
          includedJurisdictions: 3,
          includedVpoCapacity: 50,
          includedEngagementCapacity: 25,
          capacityEnforcementPolicy: enforcementPolicy || 'HARD_BLOCK'
        },
        createdAt: now
      };
      await this.saveCommercialPlanVersion(planVersion);
    }

    const existingActive = await this.getActiveAgreementForOrg(providerOrgId);
    if (existingActive) {
      await this.saveCommercialAgreement({
        ...existingActive,
        status: 'TERMINATED',
        endsAt: now
      });
    }

    const agreement: CommercialAgreement = {
      id: `cag_${providerOrgId}_${Date.now()}`,
      commercialAccountId: account.id,
      providerOrganizationId: providerOrgId,
      planVersionId: planVersion.id,
      status: 'ACTIVE',
      startsAt: now,
      acceptedAt: now,
      createdAt: now
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
        version: 1,
        effectiveFrom: '2026-01-01T00:00:00Z',
        billingInterval: 'MONTHLY',
        recurringFeeCents: 0,
        currency: 'USD',
        termsSnapshot: {
          includedProducerSeats: 1,
          includedJurisdictions: 1,
          includedVpoCapacity: 50,
          includedEngagementCapacity: 10,
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
        version: 1,
        effectiveFrom: '2026-01-01T00:00:00Z',
        billingInterval: 'MONTHLY',
        recurringFeeCents: 0,
        currency: 'USD',
        termsSnapshot: {
          includedProducerSeats: 5,
          includedJurisdictions: 3,
          includedVpoCapacity: 200,
          includedEngagementCapacity: 100,
          capacityEnforcementPolicy: 'HARD_BLOCK'
        },
        createdAt: '2026-01-01T00:00:00Z'
      });
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

  public async saveInvoice(invoice: Invoice): Promise<void> {
    const client = await this.getClient();
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

  public async saveInvoiceLineItem(line: InvoiceLineItem): Promise<void> {
    const client = await this.getClient();
    await client.query(
      `INSERT INTO invoice_line_items (
        id, invoice_id, line_type, description, quantity, unit_price_cents,
        amount_cents, billable_event_id, rating_adjustment_id, billing_period_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        line.billingPeriodId || null,
        line.createdAt
      ]
    );
  }

  public async getInvoiceById(id: string): Promise<Invoice | undefined> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM invoices WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    const lineItems = await this.getInvoiceLineItems(id);
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

  public async getInvoiceByIdempotencyKey(key: string): Promise<Invoice | undefined> {
    const client = await this.getClient();
    const res = await client.query<any>(
      `SELECT * FROM invoices WHERE idempotency_key = $1;`,
      [key]
    );
    if (res.rows.length === 0) return undefined;
    return this.getInvoiceById(res.rows[0].id);
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

  public async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    const client = await this.getClient();
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

    const draft = assembleDraftInvoice({
      billingPeriod: period,
      planVersion,
      billableEvents,
      ratingAdjustments,
      idempotencyKey: params.idempotencyKey
    });

    // Save draft invoice and line items
    await this.saveInvoice(draft.invoice);
    for (const item of draft.lineItems) {
      await this.saveInvoiceLineItem(item);
    }

    return draft;
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

  public async savePaymentRecord(payment: PaymentRecord): Promise<void> {
    const client = await this.getClient();
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

  public async getPaymentRecordById(id: string): Promise<PaymentRecord | undefined> {
    const client = await this.getClient();
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

  public async saveRefundRecord(refund: RefundRecord): Promise<void> {
    const client = await this.getClient();
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

  public async getRefundsForPayment(paymentId: string): Promise<RefundRecord[]> {
    const client = await this.getClient();
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

  public async saveSettlementAllocation(allocation: SettlementAllocation): Promise<void> {
    const client = await this.getClient();
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

  public async getAllocationsForInvoice(invoiceId: string): Promise<SettlementAllocation[]> {
    const client = await this.getClient();
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
    const now = new Date().toISOString();
    const paymentId = `pay_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const idempotencyKey = params.idempotencyKey || `pay:${params.providerOrganizationId}:${Date.now()}`;

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

    await this.savePaymentRecord(payment);

    let allocation: SettlementAllocation | undefined;
    let updatedInvoice: Invoice | undefined;

    if (params.invoiceId) {
      const invoice = await this.getInvoiceById(params.invoiceId);
      if (invoice) {
        const allocId = `alc_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        allocation = {
          id: allocId,
          paymentRecordId: paymentId,
          invoiceId: invoice.id,
          amountAllocatedCents: params.amountCents,
          allocatedAt: now
        };
        await this.saveSettlementAllocation(allocation);

        // Recompute invoice balance
        const allAllocations = await this.getAllocationsForInvoice(invoice.id);
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
    const payment = await this.getPaymentRecordById(params.paymentId);
    if (!payment) throw new Error(`PaymentRecord not found: ${params.paymentId}`);

    const existingRefunds = await this.getRefundsForPayment(payment.id);
    const priorTotal = existingRefunds.reduce((acc, r) => acc + r.amountCents, 0);

    const refund = buildRefundRecord({
      originalPayment: payment,
      amountCents: params.amountCents,
      reason: params.reason,
      priorRefundsTotalCents: priorTotal,
      idempotencyKey: params.idempotencyKey
    });

    await this.saveRefundRecord(refund);

    let allocation: SettlementAllocation | undefined;
    let updatedInvoice: Invoice | undefined;

    if (payment.invoiceId) {
      const invoice = await this.getInvoiceById(payment.invoiceId);
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
        await this.saveSettlementAllocation(allocation);

        // Recompute invoice balance
        const allAllocations = await this.getAllocationsForInvoice(invoice.id);
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
