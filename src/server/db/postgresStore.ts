import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import pg from 'pg';
import { SQL_MIGRATION_V1, SQL_MIGRATION_V2, SQL_MIGRATION_V3, SQL_MIGRATION_V4, SQL_MIGRATION_V5, SQL_MIGRATION_V6, SQL_MIGRATION_V7, SQL_MIGRATION_V8, SQL_MIGRATION_V9, SQL_MIGRATION_V10 } from './migrate';
import {
  ProviderOrganization,
  ProviderUser,
  ProviderLicense,
  CarrierRelationship,
  ProviderAppetite,
  Competition,
  ChallengeInvitation,
  ChallengeParticipation,
  Challenge,
  Policy,
  Offer,
  AuditEvent,
  InformationRequest,
  VerifiedSupplementalFact,
  OfferVersion,
  OfferVerification,
  Selection,
  ConsentGrant,
  DisclosureEvent,
  BindingHandoff,
  BindingModification,
  IssuedPolicyDocument,
  IssuedPolicySnapshot,
  ReconciliationReport,
  PolicyVaultItem,
  PlatformNotification,
  CoverageBaseline,
  ConsumerRequirements,
  CompetitionActivityEvent,
  ReviewQueueItem,
  ReviewQueueStatus
} from '../../types/insurance';

export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(callback: (client: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class CloudSqlClient implements SqlClient {
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (connectionString) {
      this.pool = new pg.Pool({ connectionString, max: 5 });
      return;
    }

    const instance = process.env.CLOUD_SQL_INSTANCE?.trim();
    const user = process.env.DB_USER?.trim();
    const database = process.env.DB_NAME?.trim();
    const password = process.env.DB_PASSWORD;
    if (!instance || !user || !database || !password) {
      throw new Error(
        'Cloud SQL requires DATABASE_URL or CLOUD_SQL_INSTANCE, DB_USER, DB_NAME, and DB_PASSWORD.'
      );
    }
    this.pool = new pg.Pool({
      host: `/cloudsql/${instance}`,
      user,
      password,
      database,
      max: 5
    });
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount?: number }> {
    const result = await this.pool.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? undefined };
  }

  async exec(sql: string): Promise<unknown> {
    return this.pool.query(sql);
  }

  async transaction<T>(callback: (client: SqlClient) => Promise<T>): Promise<T> {
    const connection = await this.pool.connect();
    const transactionClient: SqlClient = {
      query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
        const result = await connection.query(sql, params);
        return { rows: result.rows as R[], rowCount: result.rowCount ?? undefined };
      },
      exec: sql => connection.query(sql),
      transaction: async nested => nested(transactionClient),
      close: async () => undefined
    };
    try {
      await connection.query('BEGIN');
      const result = await callback(transactionClient);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * PostgresStore — Durable PGlite persistence layer for Open Policy marketplace and transaction entities.
 *
 * This store is the authoritative persistence path for:
 *   - PM-1 Marketplace entities (ProviderOrganization, ProviderUser, ProviderLicense, CarrierRelationship, ProviderAppetite, Competition, ChallengeInvitation, ChallengeParticipation, AuditEvent)
 *   - PM-2 Information requests, verified supplemental facts, offer versions, offer verifications
 *   - PM-4 Selections, consent grants, disclosure events, binding handoffs, binding modifications
 *   - PM-5 Issued policy documents, issued policy snapshots, reconciliation reports, policy vault items
 *
 * Commercial Economics (CE) entities are persisted in commercialStore.ts operating over the same underlying database.
 */
export class PostgresStore {
  private sql: SqlClient | null = null;
  private isReady = false;
  private dataDir: string;
  private useCloudSql: boolean;
  private initPromise: Promise<void> | null = null;

  // OPENPOLICY_DATA_DIR lets validators run against an isolated database; unset keeps the default.
  constructor(dataDir?: string) {
    this.dataDir = dataDir || process.env.OPENPOLICY_DATA_DIR || './data/openpolicy_pg';
    this.useCloudSql = !dataDir && !process.env.OPENPOLICY_DATA_DIR && Boolean(
      process.env.DATABASE_URL?.trim() || process.env.CLOUD_SQL_INSTANCE?.trim()
    );
    if (process.env.OPENPOLICY_REQUIRE_DURABLE_STORAGE === 'true' && !this.useCloudSql) {
      throw new Error(
        'Durable storage is required, but neither DATABASE_URL nor CLOUD_SQL_INSTANCE is configured.'
      );
    }
  }

  public async ensureReady(): Promise<void> {
    await this.init();
  }

  public async init(): Promise<void> {
    if (this.isReady && this.sql) return;
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      try {
        if (this.useCloudSql) {
          this.sql = new CloudSqlClient();
          await this.sql.query('SELECT 1');
        } else {
          if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
          }
          const pglite = new PGlite(this.dataDir);
          await pglite.waitReady;
          this.sql = pglite as unknown as SqlClient;
        }
        await this.sql.exec(SQL_MIGRATION_V1);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0001_pm1_canonical_marketplace') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V2);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0002_pm2_information_and_offers') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V3);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0003_pm4_selection_disclosure_binding') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V4);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0004_pm5_issued_policy_reconciliation_vault') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V5);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0005_commercial_economics_foundation') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V6);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0006_commercial_rating_engine') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V7);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0007_commercial_billing_settlement') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V8);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0008_jurisdiction_framework') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V9);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0009_notification_recipient_ownership') ON CONFLICT (name) DO NOTHING;`
        );
        await this.sql.exec(SQL_MIGRATION_V10);
        await this.sql.query(
          `INSERT INTO _migrations (name) VALUES ('0010_persistence_authority_foundation') ON CONFLICT (name) DO NOTHING;`
        );
        this.isReady = true;
        console.log(
          this.useCloudSql
            ? '[Open Policy Postgres] Cloud SQL durable engine initialized'
            : `[Open Policy Postgres] PostgreSQL 16 durable engine initialized at ${this.dataDir}`
        );
      } catch (err: any) {
        this.initPromise = null;
        this.isReady = false;
        throw err;
      }
    })();
    return this.initPromise;
  }

  public async getPgClient(): Promise<SqlClient> {
    await this.ensureReady();
    return this.sql!;
  }


  public async close(): Promise<void> {
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch {}
      this.initPromise = null;
    }
    if (this.sql) {
      await this.sql.close();
      this.sql = null;
      this.isReady = false;
    }
  }

  private generateAuditHash(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(12, '0');
  }

  private async appendAuditInTransaction(
    client: SqlClient,
    input: Pick<AuditEvent, 'eventType' | 'actorRole' | 'actorId' | 'details'>
  ): Promise<AuditEvent> {
    const head = await client.query<{ latest_hash: string; version: string }>(
      `SELECT latest_hash, version FROM audit_chain_head WHERE singleton = TRUE FOR UPDATE;`
    );
    const previousHash = head.rows[0]?.latest_hash || 'GENESIS_BLOCK_000000';
    const timestamp = new Date().toISOString();
    const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const event: AuditEvent = {
      id, timestamp, ...input,
      hash: this.generateAuditHash(`${timestamp}|${input.eventType}|${input.actorId}|${input.details}|${previousHash}`)
    };
    await client.query(
      `INSERT INTO audit_events (id, timestamp, event_type, actor_role, actor_id, details, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [event.id, event.timestamp, event.eventType, event.actorRole, event.actorId, event.details, event.hash]
    );
    await client.query(
      `UPDATE audit_chain_head SET latest_hash = $1, latest_event_id = $2, version = version + 1
       WHERE singleton = TRUE;`, [event.hash, event.id]
    );
    return event;
  }

  // ===========================================================================
  // READ METHODS — PM-1 Authoritative Reads from PGlite
  // ===========================================================================

  public async getProviderOrganizations(): Promise<ProviderOrganization[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; legal_name: string; display_name: string; organization_type: string;
      verification_status: string; marketplace_status: string; states: string;
      lines_of_business: string; created_at: string; verified_at: string | null;
    }>(`SELECT * FROM provider_organizations ORDER BY created_at ASC;`);
    return res.rows.map(row => ({
      id: row.id,
      legalName: row.legal_name,
      displayName: row.display_name,
      organizationType: row.organization_type as ProviderOrganization['organizationType'],
      verificationStatus: row.verification_status as ProviderOrganization['verificationStatus'],
      marketplaceStatus: row.marketplace_status as ProviderOrganization['marketplaceStatus'],
      states: JSON.parse(row.states),
      linesOfBusiness: JSON.parse(row.lines_of_business),
      createdAt: row.created_at,
      verifiedAt: row.verified_at || undefined
    }));
  }

  public async getProviderOrganization(id: string): Promise<ProviderOrganization | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; legal_name: string; display_name: string; organization_type: string;
      verification_status: string; marketplace_status: string; states: string;
      lines_of_business: string; created_at: string; verified_at: string | null;
    }>(`SELECT * FROM provider_organizations WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: row.id,
      legalName: row.legal_name,
      displayName: row.display_name,
      organizationType: row.organization_type as ProviderOrganization['organizationType'],
      verificationStatus: row.verification_status as ProviderOrganization['verificationStatus'],
      marketplaceStatus: row.marketplace_status as ProviderOrganization['marketplaceStatus'],
      states: JSON.parse(row.states),
      linesOfBusiness: JSON.parse(row.lines_of_business),
      createdAt: row.created_at,
      verifiedAt: row.verified_at || undefined
    };
  }

  public async getProviderUsers(orgId?: string): Promise<ProviderUser[]> {
    await this.ensureReady();
    const res = orgId
      ? await this.sql!.query<{
          id: string; organization_id: string; email: string; full_name: string;
          role: string; is_active: boolean; created_at: string;
        }>(`SELECT * FROM provider_users WHERE organization_id = $1;`, [orgId])
      : await this.sql!.query<{
          id: string; organization_id: string; email: string; full_name: string;
          role: string; is_active: boolean; created_at: string;
        }>(`SELECT * FROM provider_users;`);
    return res.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      name: row.full_name,
      role: row.role as ProviderUser['role'],
      status: row.is_active ? 'ACTIVE' : 'SUSPENDED'
    }));
  }

  public async getProviderUser(userId: string): Promise<ProviderUser | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; organization_id: string; email: string; full_name: string;
      role: string; is_active: boolean; created_at: string;
    }>(`SELECT * FROM provider_users WHERE id = $1;`, [userId]);
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      name: row.full_name,
      role: row.role as ProviderUser['role'],
      status: row.is_active ? 'ACTIVE' : 'SUSPENDED'
    };
  }

  public async getProviderLicenses(orgId: string): Promise<ProviderLicense[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; provider_organization_id: string; jurisdiction: string;
      license_number: string; license_type: string; status: string;
      expiration_date: string; verified_at: string | null;
    }>(`SELECT * FROM provider_licenses WHERE provider_organization_id = $1;`, [orgId]);
    return res.rows.map(row => ({
      id: row.id,
      providerOrganizationId: row.provider_organization_id,
      jurisdiction: row.jurisdiction,
      licenseNumber: row.license_number,
      licenseType: row.license_type,
      status: row.status as ProviderLicense['status'],
      effectiveDate: row.verified_at || '2025-01-01',
      expirationDate: row.expiration_date,
      verificationStatus: row.verified_at ? 'VERIFIED' : 'PENDING'
    }));
  }

  public async getCarrierRelationships(orgId: string): Promise<CarrierRelationship[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; provider_organization_id: string; carrier_id: string;
      carrier_name: string; jurisdiction: string; line_of_business: string;
      relationship_type: string; status: string;
    }>(`SELECT * FROM carrier_relationships WHERE provider_organization_id = $1;`, [orgId]);
    return res.rows.map(row => ({
      id: row.id,
      providerOrganizationId: row.provider_organization_id,
      carrierId: row.carrier_id,
      carrierName: row.carrier_name,
      jurisdiction: row.jurisdiction,
      lineOfBusiness: row.line_of_business,
      relationshipType: row.relationship_type as CarrierRelationship['relationshipType'],
      status: row.status as CarrierRelationship['status']
    }));
  }

  public async getProviderAppetite(orgId: string): Promise<ProviderAppetite | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      provider_organization_id: string; jurisdictions: string; lines_of_business: string;
      min_annual_premium: number | null; max_annual_premium: number | null;
      target_vehicle_years_min: number | null; target_vehicle_years_max: number | null;
      preferred_risk_tiers: string; excluded_vehicle_types: string;
    }>(`SELECT * FROM provider_appetites WHERE provider_organization_id = $1;`, [orgId]);
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: `app_${orgId}`,
      providerOrganizationId: row.provider_organization_id,
      jurisdictions: JSON.parse(row.jurisdictions),
      linesOfBusiness: JSON.parse(row.lines_of_business),
      riskMarkets: JSON.parse(row.preferred_risk_tiers || '[]'),
      renewalWindowDays: {
        min: row.target_vehicle_years_min || 7,
        max: row.target_vehicle_years_max || 90
      },
      active: true
    };
  }

  public async getCompetition(id: string): Promise<Competition | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; status: string; current_round: string;
      participant_count: number; opened_at: string; closes_at: string; payload: string | null;
    }>(`SELECT * FROM competitions WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return undefined;
    return this._mapCompetition(res.rows[0]);
  }

  public async getCompetitionForChallenge(challengeId: string): Promise<Competition | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; status: string; current_round: string;
      participant_count: number; opened_at: string; closes_at: string; payload: string | null;
    }>(`SELECT * FROM competitions WHERE challenge_id = $1 LIMIT 1;`, [challengeId]);
    if (res.rows.length === 0) return undefined;
    return this._mapCompetition(res.rows[0]);
  }

  public async getAllCompetitions(): Promise<Competition[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; status: string; current_round: string;
      participant_count: number; opened_at: string; closes_at: string; payload: string | null;
    }>(`SELECT * FROM competitions;`);
    return res.rows.map(r => this._mapCompetition(r));
  }

  private _mapCompetition(row: {
    id: string; challenge_id: string; status: string; current_round: string;
    participant_count: number; opened_at: string; closes_at: string; payload: string | null;
  }): Competition {
    if (row.payload) return JSON.parse(row.payload) as Competition;
    return {
      id: row.id,
      challengeId: row.challenge_id,
      status: row.status as Competition['status'],
      currentRound: row.current_round as Competition['currentRound'],
      openedAt: row.opened_at,
      closesAt: row.closes_at,
      participantCount: row.participant_count,
      improvementRoundEnabled: true,
      finalRoundEnabled: true
    };
  }

  public async getInvitation(id: string): Promise<ChallengeInvitation | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      status: string; invited_at: string; viewed_at: string | null; accepted_at: string | null;
      declined_at: string | null; decline_reason: string | null; decline_notes: string | null; payload: string | null;
    }>(`SELECT * FROM challenge_invitations WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return undefined;
    return this._mapInvitation(res.rows[0]);
  }

  public async getInvitationsForChallenge(challengeId: string): Promise<ChallengeInvitation[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      status: string; invited_at: string; viewed_at: string | null; accepted_at: string | null;
      declined_at: string | null; decline_reason: string | null; decline_notes: string | null; payload: string | null;
    }>(`SELECT * FROM challenge_invitations WHERE challenge_id = $1;`, [challengeId]);
    return res.rows.map(r => this._mapInvitation(r));
  }

  public async getInvitationsForOrg(orgId: string): Promise<ChallengeInvitation[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      status: string; invited_at: string; viewed_at: string | null; accepted_at: string | null;
      declined_at: string | null; decline_reason: string | null; decline_notes: string | null; payload: string | null;
    }>(`SELECT * FROM challenge_invitations WHERE provider_organization_id = $1;`, [orgId]);
    return res.rows.map(r => this._mapInvitation(r));
  }

  public async getAllInvitations(): Promise<ChallengeInvitation[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      status: string; invited_at: string; viewed_at: string | null; accepted_at: string | null;
      declined_at: string | null; decline_reason: string | null; decline_notes: string | null; payload: string | null;
    }>(`SELECT * FROM challenge_invitations;`);
    return res.rows.map(r => this._mapInvitation(r));
  }

  private _mapInvitation(row: {
    id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
    status: string; invited_at: string; viewed_at: string | null; accepted_at: string | null;
    declined_at: string | null; decline_reason: string | null; decline_notes: string | null; payload: string | null;
  }): ChallengeInvitation {
    if (row.payload) return JSON.parse(row.payload) as ChallengeInvitation;
    return {
      id: row.id,
      challengeId: row.challenge_id,
      competitionId: row.competition_id,
      providerOrganizationId: row.provider_organization_id,
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['Verified from durable store'],
      status: row.status as ChallengeInvitation['status'],
      invitedAt: row.invited_at,
      viewedAt: row.viewed_at || undefined,
      acceptedAt: row.accepted_at || undefined,
      declinedAt: row.declined_at || undefined,
      declineReason: (row.decline_reason as ChallengeInvitation['declineReason']) || undefined,
      declineNotes: row.decline_notes || undefined,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString()
    };
  }

  public async getParticipationsForOrg(orgId: string): Promise<ChallengeParticipation[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      accepted_at: string; status: string; last_activity_at: string;
    }>(`SELECT * FROM challenge_participations WHERE provider_organization_id = $1;`, [orgId]);
    return res.rows.map(r => this._mapParticipation(r));
  }

  public async getParticipationsForChallenge(challengeId: string): Promise<ChallengeParticipation[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      accepted_at: string; status: string; last_activity_at: string;
    }>(`SELECT * FROM challenge_participations WHERE challenge_id = $1;`, [challengeId]);
    return res.rows.map(r => this._mapParticipation(r));
  }

  public async getAllParticipations(): Promise<ChallengeParticipation[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      accepted_at: string; status: string; last_activity_at: string;
    }>(`SELECT * FROM challenge_participations;`);
    return res.rows.map(r => this._mapParticipation(r));
  }

  private _mapParticipation(row: {
    id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
    accepted_at: string; status: string; last_activity_at: string; payload?: string | null;
  }): ChallengeParticipation {
    if (row.payload) return JSON.parse(row.payload) as ChallengeParticipation;
    return {
      id: row.id,
      challengeId: row.challenge_id,
      competitionId: row.competition_id,
      providerOrganizationId: row.provider_organization_id,
      acceptedAt: row.accepted_at,
      status: row.status as ChallengeParticipation['status'],
      lastActivityAt: row.last_activity_at
    };
  }

  public async getAuditEvents(): Promise<AuditEvent[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; timestamp: string; event_type: string;
      actor_role: string; actor_id: string; details: string; hash: string;
    }>(`SELECT * FROM audit_events ORDER BY timestamp ASC;`);
    return res.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type as AuditEvent['eventType'],
      actorRole: row.actor_role as AuditEvent['actorRole'],
      actorId: row.actor_id,
      details: row.details,
      hash: row.hash
    }));
  }

  public async getChallenges(): Promise<Challenge[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; user_id: string; reference_number: string; jurisdiction: string;
      status: string; created_at: string; baseline_data: string | null; requirements_data: string | null;
    }>(`SELECT * FROM challenges ORDER BY created_at ASC;`);
    return res.rows.map(row => this._mapChallenge(row));
  }

  public async getChallenge(id: string): Promise<Challenge | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; user_id: string; reference_number: string; jurisdiction: string;
      status: string; created_at: string; baseline_data: string | null; requirements_data: string | null;
    }>(`SELECT * FROM challenges WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return undefined;
    return this._mapChallenge(res.rows[0]);
  }

  public async getOffers(challengeId?: string): Promise<Offer[]> {
    await this.ensureReady();
    const res = challengeId
      ? await this.sql!.query<{ payload: string }>(
          `SELECT payload FROM offers WHERE challenge_id = $1 ORDER BY id;`, [challengeId])
      : await this.sql!.query<{ payload: string }>(`SELECT payload FROM offers ORDER BY id;`);
    return res.rows.map(row => JSON.parse(row.payload) as Offer);
  }

  public async getOffer(id: string): Promise<Offer | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{ payload: string }>(
      `SELECT payload FROM offers WHERE id = $1;`, [id]
    );
    return res.rows[0] ? JSON.parse(res.rows[0].payload) as Offer : undefined;
  }

  private _mapChallenge(row: {
    id: string; user_id: string; reference_number: string; jurisdiction: string;
    status: string; created_at: string; baseline_data: string | null; requirements_data: string | null; payload?: string | null;
  }): Challenge {
    if (row.payload) return JSON.parse(row.payload) as Challenge;
    return {
      id: row.id,
      referenceNumber: row.reference_number,
      consumerId: row.user_id,
      coverageBaselineId: 'base_1',
      baseline: row.baseline_data ? JSON.parse(row.baseline_data) : ({} as any),
      requirements: row.requirements_data ? JSON.parse(row.requirements_data) : ({} as any),
      jurisdiction: row.jurisdiction,
      openingTimestamp: row.created_at,
      closingTimestamp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: row.status as Challenge['status'],
      disclosureLevel: 'MARKETPLACE_ANONYMOUS',
      offersCount: 0
    };
  }

  // ==========================================
  // PM-2 READ METHODS: Information Requests & Reusable Supplemental Facts
  // ==========================================

  public async getInformationRequests(challengeId: string): Promise<InformationRequest[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      requested_field: string; custom_field_name: string | null; purpose: string;
      purpose_explanation: string; status: string; requested_at: string;
      answered_at: string | null; answer_value: string | null; reusable_fact_id: string | null;
    }>(`SELECT * FROM information_requests WHERE challenge_id = $1 ORDER BY requested_at ASC;`, [challengeId]);
    return res.rows.map(row => ({
      id: row.id,
      challengeId: row.challenge_id,
      competitionId: row.competition_id,
      providerOrganizationId: row.provider_organization_id,
      requestedField: row.requested_field as InformationRequest['requestedField'],
      customFieldName: row.custom_field_name || undefined,
      purpose: row.purpose as InformationRequest['purpose'],
      purposeExplanation: row.purpose_explanation,
      status: row.status as InformationRequest['status'],
      requestedAt: row.requested_at,
      answeredAt: row.answered_at || undefined,
      answerValue: row.answer_value ? JSON.parse(row.answer_value) : undefined,
      reusableFactId: row.reusable_fact_id || undefined
    }));
  }

  public async getInformationRequest(id: string): Promise<InformationRequest | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; challenge_id: string; competition_id: string; provider_organization_id: string;
      requested_field: string; custom_field_name: string | null; purpose: string;
      purpose_explanation: string; status: string; requested_at: string;
      answered_at: string | null; answer_value: string | null; reusable_fact_id: string | null;
    }>(`SELECT * FROM information_requests WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: row.id,
      challengeId: row.challenge_id,
      competitionId: row.competition_id,
      providerOrganizationId: row.provider_organization_id,
      requestedField: row.requested_field as InformationRequest['requestedField'],
      customFieldName: row.custom_field_name || undefined,
      purpose: row.purpose as InformationRequest['purpose'],
      purposeExplanation: row.purpose_explanation,
      status: row.status as InformationRequest['status'],
      requestedAt: row.requested_at,
      answeredAt: row.answered_at || undefined,
      answerValue: row.answer_value ? JSON.parse(row.answer_value) : undefined,
      reusableFactId: row.reusable_fact_id || undefined
    };
  }

  public async getVerifiedSupplementalFacts(challengeId: string): Promise<VerifiedSupplementalFact[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; consumer_id: string; challenge_id: string; field_type: string;
      field_name: string; value: string; formatted_value: string;
      verification_state: string; source: string; created_at: string;
      shared_with_organization_ids: string;
    }>(`SELECT * FROM verified_supplemental_facts WHERE challenge_id = $1 ORDER BY created_at ASC;`, [challengeId]);
    return res.rows.map(row => ({
      id: row.id,
      consumerId: row.consumer_id,
      challengeId: row.challenge_id,
      fieldType: row.field_type as VerifiedSupplementalFact['fieldType'],
      fieldName: row.field_name,
      value: JSON.parse(row.value),
      formattedValue: row.formatted_value,
      verificationState: row.verification_state as VerifiedSupplementalFact['verificationState'],
      source: row.source,
      createdAt: row.created_at,
      sharedWithOrganizationIds: JSON.parse(row.shared_with_organization_ids || '[]')
    }));
  }

  public async getVerifiedSupplementalFact(id: string): Promise<VerifiedSupplementalFact | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; consumer_id: string; challenge_id: string; field_type: string;
      field_name: string; value: string; formatted_value: string;
      verification_state: string; source: string; created_at: string;
      shared_with_organization_ids: string;
    }>(`SELECT * FROM verified_supplemental_facts WHERE id = $1;`, [id]);
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: row.id,
      consumerId: row.consumer_id,
      challengeId: row.challenge_id,
      fieldType: row.field_type as VerifiedSupplementalFact['fieldType'],
      fieldName: row.field_name,
      value: JSON.parse(row.value),
      formattedValue: row.formatted_value,
      verificationState: row.verification_state as VerifiedSupplementalFact['verificationState'],
      source: row.source,
      createdAt: row.created_at,
      sharedWithOrganizationIds: JSON.parse(row.shared_with_organization_ids || '[]')
    };
  }

  public async getOfferVersions(offerId: string): Promise<OfferVersion[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; offer_id: string; version_number: number; round: string;
      carrier: string; annual_premium: number; monthly_premium: number;
      coverages: string; supporting_quote_doc_name: string; revision_reason: string;
      submitted_at: string; superseded_at: string | null;
    }>(`SELECT * FROM offer_versions WHERE offer_id = $1 ORDER BY version_number ASC;`, [offerId]);
    return res.rows.map(row => ({
      id: row.id,
      offerId: row.offer_id,
      versionNumber: row.version_number,
      round: row.round as OfferVersion['round'],
      carrier: row.carrier,
      annualPremium: row.annual_premium,
      monthlyPremium: row.monthly_premium,
      coverages: JSON.parse(row.coverages || '[]'),
      supportingQuoteDocName: row.supporting_quote_doc_name,
      revisionReason: row.revision_reason,
      submittedAt: row.submitted_at,
      supersededAt: row.superseded_at || undefined
    }));
  }

  public async getOfferVerification(offerId: string): Promise<OfferVerification | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{
      id: string; offer_id: string; document_name: string; status: string;
      verified_at: string; discrepancy_count: number; discrepancies: string;
      extracted_premium: number | null; entered_premium: number | null;
    }>(`SELECT * FROM offer_verifications WHERE offer_id = $1;`, [offerId]);
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: row.id,
      offerId: row.offer_id,
      documentName: row.document_name,
      status: row.status as OfferVerification['status'],
      verifiedAt: row.verified_at,
      discrepancyCount: row.discrepancy_count,
      discrepancies: JSON.parse(row.discrepancies || '[]'),
      extractedPremium: row.extracted_premium ?? undefined,
      enteredPremium: row.entered_premium ?? undefined
    };
  }

  public async saveProviderOrganization(org: ProviderOrganization) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO provider_organizations (id, legal_name, display_name, organization_type, verification_status, marketplace_status, states, lines_of_business, created_at, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         legal_name = EXCLUDED.legal_name,
         display_name = EXCLUDED.display_name,
         verification_status = EXCLUDED.verification_status,
         marketplace_status = EXCLUDED.marketplace_status;`,
      [
        org.id,
        org.legalName,
        org.displayName,
        org.organizationType,
        org.verificationStatus,
        org.marketplaceStatus,
        JSON.stringify(org.states),
        JSON.stringify(org.linesOfBusiness),
        org.createdAt,
        org.verifiedAt || null
      ]
    );
  }

  public async saveProviderUser(user: ProviderUser) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO provider_users (id, organization_id, email, full_name, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;`,
      [
        user.id,
        user.organizationId,
        user.email,
        user.name,
        user.role,
        user.status === 'ACTIVE',
        (user as any).createdAt || new Date().toISOString()
      ]
    );
  }

  public async saveProviderLicense(lic: ProviderLicense) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO provider_licenses (id, provider_organization_id, jurisdiction, license_number, license_type, status, expiration_date, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, expiration_date = EXCLUDED.expiration_date;`,
      [
        lic.id,
        lic.providerOrganizationId,
        lic.jurisdiction,
        lic.licenseNumber,
        lic.licenseType,
        lic.status,
        lic.expirationDate,
        lic.verificationStatus === 'VERIFIED' ? lic.effectiveDate : null
      ]
    );
  }

  public async saveCarrierRelationship(rel: CarrierRelationship) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO carrier_relationships (id, provider_organization_id, carrier_id, carrier_name, jurisdiction, line_of_business, relationship_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;`,
      [rel.id, rel.providerOrganizationId, rel.carrierId, rel.carrierName, rel.jurisdiction, rel.lineOfBusiness, rel.relationshipType, rel.status]
    );
  }

  public async saveProviderAppetite(appetite: ProviderAppetite) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO provider_appetites (provider_organization_id, jurisdictions, lines_of_business, min_annual_premium, max_annual_premium, target_vehicle_years_min, target_vehicle_years_max, preferred_risk_tiers, excluded_vehicle_types)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (provider_organization_id) DO UPDATE SET
         jurisdictions = EXCLUDED.jurisdictions,
         lines_of_business = EXCLUDED.lines_of_business;`,
      [
        appetite.providerOrganizationId,
        JSON.stringify(appetite.jurisdictions),
        JSON.stringify(appetite.linesOfBusiness),
        null,
        null,
        appetite.renewalWindowDays?.min || null,
        appetite.renewalWindowDays?.max || null,
        JSON.stringify(appetite.riskMarkets || []),
        JSON.stringify(appetite.supportedVehicleCharacteristics || [])
      ]
    );
  }

  public async saveCompetition(comp: Competition) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO competitions (id, challenge_id, jurisdiction, line_of_business, status, current_round, participant_count, opened_at, closes_at, rules, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         current_round = EXCLUDED.current_round,
         participant_count = EXCLUDED.participant_count,
         closes_at = EXCLUDED.closes_at,
         payload = EXCLUDED.payload,
         version = competitions.version + 1;`,
      [
        comp.id,
        comp.challengeId,
        (comp as any).jurisdiction || 'NV',
        (comp as any).lineOfBusiness || 'PERSONAL_AUTO',
        comp.status,
        comp.currentRound,
        comp.participantCount,
        comp.openedAt,
        comp.closesAt,
        JSON.stringify((comp as any).rules || {}),
        JSON.stringify(comp)
      ]
    );
  }

  public async saveInvitation(inv: ChallengeInvitation) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO challenge_invitations (id, challenge_id, competition_id, provider_organization_id, status, invited_at, viewed_at, accepted_at, declined_at, decline_reason, decline_notes, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         viewed_at = EXCLUDED.viewed_at,
         accepted_at = EXCLUDED.accepted_at,
         declined_at = EXCLUDED.declined_at,
         decline_reason = EXCLUDED.decline_reason,
         decline_notes = EXCLUDED.decline_notes,
         payload = EXCLUDED.payload,
         version = challenge_invitations.version + 1;`,
      [
        inv.id,
        inv.challengeId,
        inv.competitionId,
        inv.providerOrganizationId,
        inv.status,
        inv.invitedAt,
        inv.viewedAt || null,
        inv.acceptedAt || null,
        inv.declinedAt || null,
        inv.declineReason || null,
        inv.declineNotes || null,
        JSON.stringify(inv)
      ]
    );
  }

  public async viewInvitation(id: string, organizationId: string): Promise<ChallengeInvitation> {
    await this.ensureReady();
    return this.sql!.transaction(async client => {
      const result = await client.query<any>(
        `SELECT * FROM challenge_invitations WHERE id = $1 FOR UPDATE;`, [id]
      );
      if (!result.rows[0]) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
      const invitation = this._mapInvitation(result.rows[0]);
      if (invitation.providerOrganizationId !== organizationId) {
        throw Object.assign(new Error('Invitation does not belong to this organization'), { statusCode: 403 });
      }
      if (invitation.status === 'INVITED') {
        invitation.status = 'VIEWED';
        invitation.viewedAt = new Date().toISOString();
        await client.query(
          `UPDATE challenge_invitations SET status = 'VIEWED', viewed_at = $2,
             payload = $3, version = version + 1 WHERE id = $1 AND status = 'INVITED';`,
          [id, invitation.viewedAt, JSON.stringify(invitation)]
        );
        await this.appendAuditInTransaction(client, {
          eventType: 'INVITATION_VIEWED', actorRole: 'PROVIDER', actorId: organizationId,
          details: `Provider organization ${organizationId} viewed invitation ${id}`
        });
      }
      return invitation;
    });
  }

  public async acceptInvitation(id: string, organizationId: string): Promise<{
    invitation: ChallengeInvitation; participation: ChallengeParticipation;
  }> {
    await this.ensureReady();
    return this.sql!.transaction(async client => {
      const result = await client.query<any>(
        `SELECT * FROM challenge_invitations WHERE id = $1 FOR UPDATE;`, [id]
      );
      if (!result.rows[0]) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
      const invitation = this._mapInvitation(result.rows[0]);
      if (invitation.providerOrganizationId !== organizationId) {
        throw Object.assign(new Error('Invitation does not belong to this organization'), { statusCode: 403 });
      }
      const existing = await client.query<any>(
        `SELECT * FROM challenge_participations
         WHERE challenge_id = $1 AND provider_organization_id = $2;`,
        [invitation.challengeId, organizationId]
      );
      if (invitation.status === 'ACCEPTED' && existing.rows[0]) {
        return { invitation, participation: this._mapParticipation(existing.rows[0]) };
      }
      if (!['INVITED', 'VIEWED'].includes(invitation.status)) {
        throw Object.assign(new Error(`Invitation cannot be accepted from ${invitation.status}`), { statusCode: 409 });
      }
      const now = new Date().toISOString();
      invitation.status = 'ACCEPTED';
      invitation.acceptedAt = now;
      const participation: ChallengeParticipation = {
        id: `PART-${invitation.challengeId.replace('CHAL-', '')}-${organizationId}`,
        challengeId: invitation.challengeId, competitionId: invitation.competitionId,
        providerOrganizationId: organizationId, acceptedAt: now,
        status: 'ACTIVE', lastActivityAt: now
      };
      await client.query(
        `UPDATE challenge_invitations SET status = 'ACCEPTED', accepted_at = $2,
           payload = $3, version = version + 1
         WHERE id = $1 AND status IN ('INVITED','VIEWED');`,
        [id, now, JSON.stringify(invitation)]
      );
      await client.query(
        `INSERT INTO challenge_participations
         (id, challenge_id, competition_id, provider_organization_id, accepted_at, status, last_activity_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (challenge_id, provider_organization_id) DO NOTHING;`,
        [participation.id, participation.challengeId, participation.competitionId,
         participation.providerOrganizationId, participation.acceptedAt,
         participation.status, participation.lastActivityAt, JSON.stringify(participation)]
      );
      const count = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM challenge_participations
         WHERE competition_id = $1 AND status <> 'WITHDRAWN';`, [invitation.competitionId]
      );
      await client.query(
        `UPDATE competitions SET participant_count = $2, version = version + 1
         WHERE id = $1;`, [invitation.competitionId, Number(count.rows[0]?.count || 0)]
      );
      const activity: CompetitionActivityEvent = {
        id: `ACT-${participation.id}-JOINED`, competitionId: invitation.competitionId,
        challengeId: invitation.challengeId, timestamp: now, type: 'PROVIDER_JOINED',
        actorRole: 'PROVIDER', providerOrganizationId: organizationId,
        summary: `Provider organization ${organizationId} joined competition`, round: 'ROUND_1_OPEN'
      };
      await client.query(
        `INSERT INTO competition_activity_events
         (id, competition_id, challenge_id, occurred_at, event_type, provider_organization_id, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING;`,
        [activity.id, activity.competitionId, activity.challengeId, activity.timestamp,
         activity.type, organizationId, JSON.stringify(activity)]
      );
      await this.appendAuditInTransaction(client, {
        eventType: 'INVITATION_ACCEPTED', actorRole: 'PROVIDER', actorId: organizationId,
        details: `Provider organization ${organizationId} accepted invitation ${id}`
      });
      await this.appendAuditInTransaction(client, {
        eventType: 'PARTICIPATION_CREATED', actorRole: 'SYSTEM', actorId: 'competition_engine',
        details: `Participation ${participation.id} created for invitation ${id}`
      });
      return { invitation, participation };
    });
  }

  public async declineInvitation(
    id: string, organizationId: string, reason: ChallengeInvitation['declineReason'], notes?: string
  ): Promise<ChallengeInvitation> {
    await this.ensureReady();
    return this.sql!.transaction(async client => {
      const result = await client.query<any>(
        `SELECT * FROM challenge_invitations WHERE id = $1 FOR UPDATE;`, [id]
      );
      if (!result.rows[0]) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
      const invitation = this._mapInvitation(result.rows[0]);
      if (invitation.providerOrganizationId !== organizationId) {
        throw Object.assign(new Error('Invitation does not belong to this organization'), { statusCode: 403 });
      }
      if (!['INVITED', 'VIEWED'].includes(invitation.status)) {
        throw Object.assign(new Error(`Invitation cannot be declined from ${invitation.status}`), { statusCode: 409 });
      }
      invitation.status = 'DECLINED';
      invitation.declinedAt = new Date().toISOString();
      invitation.declineReason = reason;
      invitation.declineNotes = notes;
      await client.query(
        `UPDATE challenge_invitations SET status = 'DECLINED', declined_at = $2,
           decline_reason = $3, decline_notes = $4, payload = $5, version = version + 1
         WHERE id = $1 AND status IN ('INVITED','VIEWED');`,
        [id, invitation.declinedAt, reason || null, notes || null, JSON.stringify(invitation)]
      );
      await this.appendAuditInTransaction(client, {
        eventType: 'INVITATION_DECLINED', actorRole: 'PROVIDER', actorId: organizationId,
        details: `Provider organization ${organizationId} declined invitation ${id}`
      });
      return invitation;
    });
  }

  public async saveParticipation(part: ChallengeParticipation) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO challenge_participations (id, challenge_id, competition_id, provider_organization_id, accepted_at, status, last_activity_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         last_activity_at = EXCLUDED.last_activity_at,
         payload = EXCLUDED.payload,
         version = challenge_participations.version + 1;`,
      [
        part.id,
        part.challengeId,
        part.competitionId,
        part.providerOrganizationId,
        part.acceptedAt,
        part.status,
        part.lastActivityAt,
        JSON.stringify(part)
      ]
    );
  }

  public async saveChallenge(chal: Challenge) {
    await this.ensureReady();
    const consumerId = chal.consumerId || (chal as any).userId;
    if (!consumerId) {
      throw new Error(`Challenge '${chal.id}' has no authoritative consumer owner.`);
    }
    await this.sql!.query(
      `INSERT INTO challenges (id, user_id, reference_number, jurisdiction, status, created_at, baseline_data, requirements_data,
         jurisdiction_determination_id, rule_set_id, rule_set_content_sha256, regulatory_evaluation_date, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload,
         version = challenges.version + 1;`,
      [
        chal.id,
        consumerId,
        chal.referenceNumber,
        chal.jurisdiction,
        chal.status,
        chal.openingTimestamp || (chal as any).createdAt || new Date().toISOString(),
        JSON.stringify(chal.baseline || {}),
        JSON.stringify(chal.requirements || {}),
        chal.jurisdictionDeterminationId ?? null,
        chal.ruleSetId ?? null,
        chal.ruleSetContentSha256 ?? null,
        chal.regulatoryEvaluationDate ?? null,
        JSON.stringify(chal)
      ]
    );
  }

  public async commitChallengeOpening(input: {
    challenge: Challenge;
    competition: Competition;
    invitations: ChallengeInvitation[];
    notifications: PlatformNotification[];
    activity: CompetitionActivityEvent;
    audits: Array<Pick<AuditEvent, 'eventType' | 'actorRole' | 'actorId' | 'details'>>;
  }): Promise<void> {
    await this.ensureReady();
    const { challenge, competition, invitations, notifications, activity, audits } = input;
    await this.sql!.transaction(async client => {
      await client.query(
        `INSERT INTO consumer_requirements (id, payload) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload;`,
        [challenge.requirements.id, JSON.stringify(challenge.requirements)]
      );
      await client.query(
        `INSERT INTO challenges (id, user_id, reference_number, jurisdiction, status, created_at,
           baseline_data, requirements_data, jurisdiction_determination_id, rule_set_id,
           rule_set_content_sha256, regulatory_evaluation_date, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING;`,
        [challenge.id, challenge.consumerId, challenge.referenceNumber, challenge.jurisdiction,
         challenge.status, challenge.openingTimestamp, JSON.stringify(challenge.baseline),
         JSON.stringify(challenge.requirements), challenge.jurisdictionDeterminationId || null,
         challenge.ruleSetId || null, challenge.ruleSetContentSha256 || null,
         challenge.regulatoryEvaluationDate || null, JSON.stringify(challenge)]
      );
      await client.query(
        `INSERT INTO competitions (id, challenge_id, jurisdiction, line_of_business, status,
           current_round, participant_count, opened_at, closes_at, rules, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING;`,
        [competition.id, competition.challengeId, challenge.jurisdiction, 'PERSONAL_AUTO',
         competition.status, competition.currentRound, competition.participantCount,
         competition.openedAt, competition.closesAt, '{}', JSON.stringify(competition)]
      );
      for (const invitation of invitations) {
        await client.query(
          `INSERT INTO challenge_invitations (id, challenge_id, competition_id,
             provider_organization_id, status, invited_at, viewed_at, accepted_at,
             declined_at, decline_reason, decline_notes, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO NOTHING;`,
          [invitation.id, invitation.challengeId, invitation.competitionId,
           invitation.providerOrganizationId, invitation.status, invitation.invitedAt,
           invitation.viewedAt || null, invitation.acceptedAt || null,
           invitation.declinedAt || null, invitation.declineReason || null,
           invitation.declineNotes || null, JSON.stringify(invitation)]
        );
      }
      await client.query(
        `INSERT INTO competition_activity_events
         (id, competition_id, challenge_id, occurred_at, event_type, provider_organization_id, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING;`,
        [activity.id, activity.competitionId, activity.challengeId, activity.timestamp,
         activity.type, activity.providerOrganizationId || null, JSON.stringify(activity)]
      );
      for (const notification of notifications) {
        await client.query(
          `INSERT INTO platform_notifications (id, type, title, message, timestamp, is_read,
             read_at, recipient_type, recipient_consumer_id, recipient_provider_user_id,
             recipient_provider_organization_id, recipient_operator_id, created_from_event, action_target)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (id) DO NOTHING;`,
          [notification.id, notification.type, notification.title, notification.message,
           notification.timestamp, notification.read, notification.readAt || null,
           notification.recipientType, notification.recipientConsumerId || null,
           notification.recipientProviderUserId || null,
           notification.recipientProviderOrganizationId || null,
           notification.recipientOperatorId || null, notification.createdFromEvent,
           notification.actionTarget || null]
        );
      }
      for (const audit of audits) await this.appendAuditInTransaction(client, audit);
    });
  }

  public async savePolicy(policy: Policy) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO policies (id, policy_number, carrier, jurisdiction, named_insured, effective_date, expiration_date, annual_premium, status, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;`,
      [
        policy.id,
        policy.policyNumber,
        policy.carrier,
        policy.jurisdiction,
        policy.namedInsured,
        policy.effectiveDate,
        policy.expirationDate,
        policy.annualPremium,
        policy.status,
        JSON.stringify(policy)
      ]
    );
  }

  public async commitPolicyWithAudit(
    policy: Policy,
    audits: Array<Pick<AuditEvent, 'eventType' | 'actorRole' | 'actorId' | 'details'>>
  ): Promise<AuditEvent[]> {
    await this.ensureReady();
    return this.sql!.transaction(async client => {
      await client.query(
        `INSERT INTO policies (id, policy_number, carrier, jurisdiction, named_insured, effective_date, expiration_date, annual_premium, status, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           policy_number = EXCLUDED.policy_number,
           carrier = EXCLUDED.carrier,
           jurisdiction = EXCLUDED.jurisdiction,
           named_insured = EXCLUDED.named_insured,
           effective_date = EXCLUDED.effective_date,
           expiration_date = EXCLUDED.expiration_date,
           annual_premium = EXCLUDED.annual_premium,
           status = EXCLUDED.status,
           payload = EXCLUDED.payload;`,
        [policy.id, policy.policyNumber, policy.carrier, policy.jurisdiction, policy.namedInsured,
         policy.effectiveDate, policy.expirationDate, policy.annualPremium, policy.status,
         JSON.stringify(policy)]
      );
      const events: AuditEvent[] = [];
      for (const audit of audits) events.push(await this.appendAuditInTransaction(client, audit));
      return events;
    });
  }

  public async getPolicies(): Promise<Policy[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{ payload: string }>(
      `SELECT payload FROM policies ORDER BY id;`
    );
    return res.rows.map(row => JSON.parse(row.payload) as Policy);
  }

  public async getPolicy(id: string): Promise<Policy | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{ payload: string }>(
      `SELECT payload FROM policies WHERE id = $1;`, [id]
    );
    return res.rows[0] ? JSON.parse(res.rows[0].payload) as Policy : undefined;
  }

  public async saveCoverageBaseline(baseline: CoverageBaseline): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO coverage_baselines (id, policy_id, version, jurisdiction, verified_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         policy_id = EXCLUDED.policy_id,
         version = EXCLUDED.version,
         jurisdiction = EXCLUDED.jurisdiction,
         verified_at = EXCLUDED.verified_at,
         payload = EXCLUDED.payload;`,
      [baseline.id, baseline.policyId, baseline.version, baseline.jurisdiction || null,
       baseline.verifiedAt, JSON.stringify(baseline)]
    );
  }

  public async commitCoverageBaselineWithAudit(
    baseline: CoverageBaseline,
    audit: Pick<AuditEvent, 'eventType' | 'actorRole' | 'actorId' | 'details'>
  ): Promise<AuditEvent> {
    await this.ensureReady();
    return this.sql!.transaction(async client => {
      await client.query(
        `INSERT INTO coverage_baselines (id, policy_id, version, jurisdiction, verified_at, payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           policy_id = EXCLUDED.policy_id,
           version = EXCLUDED.version,
           jurisdiction = EXCLUDED.jurisdiction,
           verified_at = EXCLUDED.verified_at,
           payload = EXCLUDED.payload;`,
        [baseline.id, baseline.policyId, baseline.version, baseline.jurisdiction || null,
         baseline.verifiedAt, JSON.stringify(baseline)]
      );
      return this.appendAuditInTransaction(client, audit);
    });
  }

  public async getCoverageBaselines(policyId?: string): Promise<CoverageBaseline[]> {
    await this.ensureReady();
    const res = policyId
      ? await this.sql!.query<{ payload: string }>(
          `SELECT payload FROM coverage_baselines WHERE policy_id = $1 ORDER BY version;`, [policyId])
      : await this.sql!.query<{ payload: string }>(
          `SELECT payload FROM coverage_baselines ORDER BY policy_id, version;`);
    return res.rows.map(row => JSON.parse(row.payload) as CoverageBaseline);
  }

  public async getCoverageBaseline(id: string): Promise<CoverageBaseline | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{ payload: string }>(
      `SELECT payload FROM coverage_baselines WHERE id = $1;`, [id]
    );
    return res.rows[0] ? JSON.parse(res.rows[0].payload) as CoverageBaseline : undefined;
  }

  public async saveConsumerRequirements(requirements: ConsumerRequirements): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO consumer_requirements (id, payload) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload;`,
      [requirements.id, JSON.stringify(requirements)]
    );
  }

  public async getConsumerRequirements(id: string): Promise<ConsumerRequirements | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<{ payload: string }>(
      `SELECT payload FROM consumer_requirements WHERE id = $1;`, [id]
    );
    return res.rows[0] ? JSON.parse(res.rows[0].payload) as ConsumerRequirements : undefined;
  }

  public async saveCompetitionActivity(event: CompetitionActivityEvent): Promise<boolean> {
    await this.ensureReady();
    const result = await this.sql!.query(
      `INSERT INTO competition_activity_events
       (id, competition_id, challenge_id, occurred_at, event_type, provider_organization_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING;`,
      [event.id, event.competitionId, event.challengeId, event.timestamp, event.type,
       event.providerOrganizationId || null, JSON.stringify(event)]
    );
    return result.rowCount === 1;
  }

  public async getCompetitionActivity(challengeId: string): Promise<CompetitionActivityEvent[]> {
    await this.ensureReady();
    const res = await this.sql!.query<{ payload: string }>(
      `SELECT payload FROM competition_activity_events
       WHERE challenge_id = $1 ORDER BY occurred_at, id;`, [challengeId]
    );
    return res.rows.map(row => JSON.parse(row.payload) as CompetitionActivityEvent);
  }

  public async saveReviewQueueItem(item: ReviewQueueItem): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO review_queue_items (id, status, severity, created_at, resolved_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         severity = EXCLUDED.severity,
         resolved_at = EXCLUDED.resolved_at,
         version = review_queue_items.version + 1,
         payload = EXCLUDED.payload;`,
      [item.id, item.status, item.severity, item.createdAt, item.resolvedAt || null,
       JSON.stringify(item)]
    );
  }

  public async getReviewQueue(status?: ReviewQueueStatus): Promise<ReviewQueueItem[]> {
    await this.ensureReady();
    const res = status
      ? await this.sql!.query<{ payload: string }>(
          `SELECT payload FROM review_queue_items WHERE status = $1 ORDER BY created_at DESC;`, [status])
      : await this.sql!.query<{ payload: string }>(
          `SELECT payload FROM review_queue_items ORDER BY created_at DESC;`);
    return res.rows.map(row => JSON.parse(row.payload) as ReviewQueueItem);
  }

  public async resolveReviewQueueItem(
    expected: ReviewQueueItem,
    updated: ReviewQueueItem
  ): Promise<boolean> {
    await this.ensureReady();
    const result = await this.sql!.query(
      `UPDATE review_queue_items
       SET status = $2, resolved_at = $3, version = version + 1, payload = $4
       WHERE id = $1 AND status = $5;`,
      [updated.id, updated.status, updated.resolvedAt || null, JSON.stringify(updated), expected.status]
    );
    return result.rowCount === 1;
  }

  public async saveOffer(offer: Offer) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO offers (id, challenge_id, provider_id, provider_name, carrier, annual_premium, monthly_premium, status, round, version, previous_offer_id, is_latest_revision, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         annual_premium = EXCLUDED.annual_premium,
         status = EXCLUDED.status,
         is_latest_revision = EXCLUDED.is_latest_revision;`,
      [
        offer.id,
        offer.challengeId,
        offer.providerId,
        offer.providerName,
        offer.carrier,
        offer.annualPremium,
        offer.monthlyPremium,
        offer.status,
        offer.round || 'ROUND_1_OPEN',
        offer.version || 1,
        offer.previousOfferId || null,
        offer.isLatestRevision ?? true,
        JSON.stringify(offer)
      ]
    );
  }

  public async commitOfferSubmission(input: {
    offer: Offer;
    version: OfferVersion;
    activity: CompetitionActivityEvent;
    audits: Array<Pick<AuditEvent, 'eventType' | 'actorRole' | 'actorId' | 'details'>>;
  }): Promise<void> {
    await this.ensureReady();
    const { offer, version, activity, audits } = input;
    await this.sql!.transaction(async client => {
      const participation = await client.query<{ id: string }>(
        `SELECT id FROM challenge_participations
         WHERE challenge_id = $1 AND provider_organization_id = $2 AND status <> 'WITHDRAWN';`,
        [offer.challengeId, offer.providerId]
      );
      if (!participation.rows[0]) {
        throw Object.assign(new Error('Provider is not an active participant in this challenge'), { statusCode: 403 });
      }
      const challengeResult = await client.query<{ payload: string }>(
        `SELECT payload FROM challenges WHERE id = $1 FOR UPDATE;`, [offer.challengeId]
      );
      if (!challengeResult.rows[0]) {
        throw Object.assign(new Error('Challenge not found'), { statusCode: 404 });
      }
      const challenge = JSON.parse(challengeResult.rows[0].payload) as Challenge;
      const existingOffer = await client.query<{ provider_id: string; payload: string }>(
        `SELECT provider_id, payload FROM offers WHERE id = $1;`, [offer.id]
      );
      if (existingOffer.rows[0]) {
        if (existingOffer.rows[0].provider_id !== offer.providerId) {
          throw Object.assign(new Error('Offer identifier belongs to another provider'), { statusCode: 403 });
        }
        return;
      }
      await client.query(
        `INSERT INTO offers (id, challenge_id, provider_id, provider_name, carrier,
           annual_premium, monthly_premium, status, round, version, previous_offer_id,
           is_latest_revision, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);`,
        [offer.id, offer.challengeId, offer.providerId, offer.providerName, offer.carrier,
         offer.annualPremium, offer.monthlyPremium, offer.status, offer.round || 'ROUND_1_OPEN',
         offer.version || 1, offer.previousOfferId || null, offer.isLatestRevision ?? true,
         JSON.stringify(offer)]
      );
      await client.query(
        `INSERT INTO offer_versions (id, offer_id, version_number, round, carrier,
           annual_premium, monthly_premium, coverages, supporting_quote_doc_name,
           revision_reason, submitted_at, superseded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12);`,
        [version.id, version.offerId, version.versionNumber, version.round, version.carrier,
         version.annualPremium, version.monthlyPremium, JSON.stringify(version.coverages || []),
         version.supportingQuoteDocName || '', version.revisionReason, version.submittedAt,
         version.supersededAt || null]
      );
      challenge.offersCount = Number(challenge.offersCount || 0) + 1;
      challenge.status = 'OFFERS_RECEIVED';
      await client.query(
        `UPDATE challenges SET status = $2, payload = $3, version = version + 1 WHERE id = $1;`,
        [challenge.id, challenge.status, JSON.stringify(challenge)]
      );
      await client.query(
        `INSERT INTO competition_activity_events
         (id, competition_id, challenge_id, occurred_at, event_type, provider_organization_id, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING;`,
        [activity.id, activity.competitionId, activity.challengeId, activity.timestamp,
         activity.type, activity.providerOrganizationId || null, JSON.stringify(activity)]
      );
      for (const audit of audits) await this.appendAuditInTransaction(client, audit);
    });
  }

  public async saveAuditEvent(event: AuditEvent) {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO audit_events (id, timestamp, event_type, actor_role, actor_id, details, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING;`,
      [event.id, event.timestamp, event.eventType, event.actorRole, event.actorId, event.details, event.hash]
    );
  }

  // ==========================================
  // PM-2 WRITE METHODS: Information Requests & Reusable Supplemental Facts
  // ==========================================

  public async saveInformationRequest(req: InformationRequest): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO information_requests (
        id, challenge_id, competition_id, provider_organization_id, requested_field,
        custom_field_name, purpose, purpose_explanation, status, requested_at,
        answered_at, answer_value, reusable_fact_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        answered_at = EXCLUDED.answered_at,
        answer_value = EXCLUDED.answer_value,
        reusable_fact_id = EXCLUDED.reusable_fact_id;`,
      [
        req.id,
        req.challengeId,
        req.competitionId,
        req.providerOrganizationId,
        req.requestedField,
        req.customFieldName || null,
        req.purpose,
        req.purposeExplanation,
        req.status,
        req.requestedAt,
        req.answeredAt || null,
        req.answerValue !== undefined ? JSON.stringify(req.answerValue) : null,
        req.reusableFactId || null
      ]
    );
  }

  public async saveVerifiedSupplementalFact(fact: VerifiedSupplementalFact): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO verified_supplemental_facts (
        id, consumer_id, challenge_id, field_type, field_name, value, formatted_value,
        verification_state, source, created_at, shared_with_organization_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        value = EXCLUDED.value,
        formatted_value = EXCLUDED.formatted_value,
        verification_state = EXCLUDED.verification_state,
        shared_with_organization_ids = EXCLUDED.shared_with_organization_ids;`,
      [
        fact.id,
        fact.consumerId,
        fact.challengeId,
        fact.fieldType,
        fact.fieldName,
        JSON.stringify(fact.value),
        fact.formattedValue,
        fact.verificationState,
        fact.source,
        fact.createdAt,
        JSON.stringify(fact.sharedWithOrganizationIds)
      ]
    );
  }

  public async saveOfferVersion(ver: OfferVersion): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO offer_versions (
        id, offer_id, version_number, round, carrier, annual_premium, monthly_premium,
        coverages, supporting_quote_doc_name, revision_reason, submitted_at, superseded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        superseded_at = EXCLUDED.superseded_at;`,
      [
        ver.id,
        ver.offerId,
        ver.versionNumber,
        ver.round,
        ver.carrier,
        ver.annualPremium,
        ver.monthlyPremium,
        JSON.stringify(ver.coverages),
        ver.supportingQuoteDocName,
        ver.revisionReason,
        ver.submittedAt,
        ver.supersededAt || null
      ]
    );
  }

  public async saveOfferVerification(ver: OfferVerification): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO offer_verifications (
        id, offer_id, document_name, status, verified_at, discrepancy_count,
        discrepancies, extracted_premium, entered_premium
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        verified_at = EXCLUDED.verified_at,
        discrepancy_count = EXCLUDED.discrepancy_count,
        discrepancies = EXCLUDED.discrepancies,
        extracted_premium = EXCLUDED.extracted_premium,
        entered_premium = EXCLUDED.entered_premium;`,
      [
        ver.id,
        ver.offerId,
        ver.documentName,
        ver.status,
        ver.verifiedAt,
        ver.discrepancyCount,
        JSON.stringify(ver.discrepancies),
        ver.extractedPremium ?? null,
        ver.enteredPremium ?? null
      ]
    );
  }

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  // ===========================================================================
  // PM-4: Selection, Consent, Disclosure & Binding Persistence
  // ===========================================================================

  public async saveSelection(sel: Selection): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO selections (
        id, challenge_id, consumer_id, offer_id, offer_version_id, version_number,
        provider_organization_id, carrier, annual_premium, monthly_premium, selected_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status;`,
      [
        sel.id, sel.challengeId, sel.consumerId, sel.offerId, sel.offerVersionId, sel.versionNumber,
        sel.providerOrganizationId, sel.carrier, sel.annualPremium, sel.monthlyPremium ?? null, sel.selectedAt, sel.status
      ]
    );
  }

  public async getSelections(challengeId?: string): Promise<Selection[]> {
    await this.ensureReady();
    const query = challengeId
      ? `SELECT * FROM selections WHERE challenge_id = $1 ORDER BY selected_at DESC;`
      : `SELECT * FROM selections ORDER BY selected_at DESC;`;
    const params = challengeId ? [challengeId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      challengeId: r.challenge_id,
      consumerId: r.consumer_id,
      offerId: r.offer_id,
      offerVersionId: r.offer_version_id,
      versionNumber: r.version_number,
      providerOrganizationId: r.provider_organization_id,
      carrier: r.carrier,
      annualPremium: r.annual_premium,
      monthlyPremium: r.monthly_premium,
      selectedAt: r.selected_at,
      status: r.status
    }));
  }

  public async saveConsentGrant(grant: ConsentGrant): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO consent_grants (
        id, challenge_id, consumer_id, recipient_organization_id, recipient_user_id,
        purpose, purpose_explanation, authorized_field_names, acknowledged_variations,
        granted_at, expires_at, revoked_at, ip_address_hash, terms_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        revoked_at = EXCLUDED.revoked_at;`,
      [
        grant.id, grant.challengeId, grant.consumerId, grant.recipientOrganizationId, grant.recipientUserId || null,
        grant.purpose, grant.purposeExplanation, JSON.stringify(grant.authorizedFieldNames),
        JSON.stringify(grant.acknowledgedVariations), grant.grantedAt, grant.expiresAt || null,
        grant.revokedAt || null, grant.ipAddressHash, grant.termsVersion
      ]
    );
  }

  public async getConsentGrants(challengeId?: string): Promise<ConsentGrant[]> {
    await this.ensureReady();
    const query = challengeId
      ? `SELECT * FROM consent_grants WHERE challenge_id = $1 ORDER BY granted_at DESC;`
      : `SELECT * FROM consent_grants ORDER BY granted_at DESC;`;
    const params = challengeId ? [challengeId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      challengeId: r.challenge_id,
      consumerId: r.consumer_id,
      recipientOrganizationId: r.recipient_organization_id,
      recipientUserId: r.recipient_user_id || undefined,
      purpose: r.purpose,
      purposeExplanation: r.purpose_explanation,
      authorizedFieldNames: JSON.parse(r.authorized_field_names),
      acknowledgedVariations: JSON.parse(r.acknowledged_variations),
      grantedAt: r.granted_at,
      expiresAt: r.expires_at || undefined,
      revokedAt: r.revoked_at || undefined,
      ipAddressHash: r.ip_address_hash,
      termsVersion: r.terms_version
    }));
  }

  public async saveDisclosureEvent(evt: DisclosureEvent): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO disclosure_events (
        id, challenge_id, binding_handoff_id, consent_grant_id,
        recipient_provider_organization_id, recipient_provider_user_id,
        disclosed_at, disclosed_field_names, metadata, event_payload_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING;`,
      [
        evt.id, evt.challengeId, evt.bindingHandoffId, evt.consentGrantId,
        evt.recipientProviderOrganizationId, evt.recipientProviderUserId || null,
        evt.disclosedAt, JSON.stringify(evt.disclosedFieldNames),
        evt.metadata ? JSON.stringify(evt.metadata) : null, evt.eventPayloadHash
      ]
    );
  }

  public async getDisclosureEvents(id?: string): Promise<DisclosureEvent[]> {
    await this.ensureReady();
    const query = id
      ? `SELECT * FROM disclosure_events WHERE challenge_id = $1 OR binding_handoff_id = $1 ORDER BY disclosed_at DESC;`
      : `SELECT * FROM disclosure_events ORDER BY disclosed_at DESC;`;
    const params = id ? [id] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      challengeId: r.challenge_id,
      bindingHandoffId: r.binding_handoff_id,
      consentGrantId: r.consent_grant_id,
      recipientProviderOrganizationId: r.recipient_provider_organization_id,
      recipientProviderUserId: r.recipient_provider_user_id || undefined,
      disclosedAt: r.disclosed_at,
      disclosedFieldNames: JSON.parse(r.disclosed_field_names),
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      eventPayloadHash: r.event_payload_hash
    }));
  }

  public async saveBindingHandoff(h: BindingHandoff): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO binding_handoffs (
        id, binding_reference, challenge_id, selection_id, offer_id, offer_version_id,
        consumer_id, provider_organization_id, carrier, status, created_at, updated_at,
        consent_grant_id, disclosure_event_id, active_modification_id, bound_at,
        declined_at, decline_reason, consumer_name, consumer_email, consumer_phone, provider_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        consent_grant_id = EXCLUDED.consent_grant_id,
        disclosure_event_id = EXCLUDED.disclosure_event_id,
        active_modification_id = EXCLUDED.active_modification_id,
        bound_at = EXCLUDED.bound_at,
        declined_at = EXCLUDED.declined_at,
        decline_reason = EXCLUDED.decline_reason;`,
      [
        h.id, h.bindingReference, h.challengeId, h.selectionId || null, h.offerId || null,
        h.offerVersionId || null, h.consumerId || null, h.providerOrganizationId || null,
        h.carrier, h.status, h.createdAt || new Date().toISOString(), h.updatedAt || new Date().toISOString(),
        h.consentGrantId || null, h.disclosureEventId || null, h.activeModificationId || null,
        h.boundAt || null, h.declinedAt || null, h.declineReason || null,
        h.consumerName || null, h.consumerEmail || null, h.consumerPhone || null, h.providerName || null
      ]
    );
  }

  public async getBindingHandoffs(challengeId?: string): Promise<BindingHandoff[]> {
    await this.ensureReady();
    const query = challengeId
      ? `SELECT * FROM binding_handoffs WHERE challenge_id = $1 ORDER BY created_at DESC;`
      : `SELECT * FROM binding_handoffs ORDER BY created_at DESC;`;
    const params = challengeId ? [challengeId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      bindingReference: r.binding_reference,
      challengeId: r.challenge_id,
      selectionId: r.selection_id || undefined,
      offerId: r.offer_id || undefined,
      offerVersionId: r.offer_version_id || undefined,
      consumerId: r.consumer_id || undefined,
      providerOrganizationId: r.provider_organization_id || undefined,
      carrier: r.carrier,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      consentGrantId: r.consent_grant_id || undefined,
      disclosureEventId: r.disclosure_event_id || undefined,
      activeModificationId: r.active_modification_id || undefined,
      boundAt: r.bound_at || undefined,
      declinedAt: r.declined_at || undefined,
      declineReason: r.decline_reason || undefined,
      consumerName: r.consumer_name || undefined,
      consumerEmail: r.consumer_email || undefined,
      consumerPhone: r.consumer_phone || undefined,
      providerName: r.provider_name || undefined
    }));
  }

  public async saveBindingModification(mod: BindingModification): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO binding_modifications (
        id, binding_handoff_id, challenge_id, provider_organization_id, provider_user_id,
        carrier, original_annual_premium, modified_annual_premium, coverage_changes,
        underwriting_reason, proposed_at, status, decided_at, rejection_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        decided_at = EXCLUDED.decided_at,
        rejection_reason = EXCLUDED.rejection_reason;`,
      [
        mod.id, mod.bindingHandoffId, mod.challengeId, mod.providerOrganizationId,
        mod.providerUserId, mod.carrier, mod.originalAnnualPremium, mod.modifiedAnnualPremium,
        JSON.stringify(mod.coverageChanges), mod.underwritingReason, mod.proposedAt,
        mod.status, mod.decidedAt || null, mod.rejectionReason || null
      ]
    );
  }

  public async getBindingModifications(handoffId?: string): Promise<BindingModification[]> {
    await this.ensureReady();
    const query = handoffId
      ? `SELECT * FROM binding_modifications WHERE binding_handoff_id = $1 ORDER BY proposed_at DESC;`
      : `SELECT * FROM binding_modifications ORDER BY proposed_at DESC;`;
    const params = handoffId ? [handoffId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      bindingHandoffId: r.binding_handoff_id,
      challengeId: r.challenge_id,
      providerOrganizationId: r.provider_organization_id,
      providerUserId: r.provider_user_id,
      carrier: r.carrier,
      originalAnnualPremium: r.original_annual_premium,
      modifiedAnnualPremium: r.modified_annual_premium,
      coverageChanges: JSON.parse(r.coverage_changes),
      underwritingReason: r.underwriting_reason,
      proposedAt: r.proposed_at,
      status: r.status,
      decidedAt: r.decided_at || undefined,
      rejectionReason: r.rejection_reason || undefined
    }));
  }

  // ========================================================
  // PM-5: Issued Policy Documents, Snapshots, Reconciliation & Vault
  // ========================================================

  public async saveIssuedPolicyDocument(doc: IssuedPolicyDocument): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO issued_policy_documents (
        id, binding_handoff_id, challenge_id, provider_organization_id,
        file_name, file_size_bytes, mime_type, document_sha256, storage_ref, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING;`,
      [
        doc.id, doc.bindingHandoffId, doc.challengeId, doc.providerOrganizationId,
        doc.fileName, doc.fileSizeBytes, doc.mimeType, doc.documentSha256,
        doc.storageRef, doc.uploadedAt
      ]
    );
  }

  public async getIssuedPolicyDocuments(bindingHandoffId?: string): Promise<IssuedPolicyDocument[]> {
    await this.ensureReady();
    const query = bindingHandoffId
      ? `SELECT * FROM issued_policy_documents WHERE binding_handoff_id = $1 ORDER BY uploaded_at DESC;`
      : `SELECT * FROM issued_policy_documents ORDER BY uploaded_at DESC;`;
    const params = bindingHandoffId ? [bindingHandoffId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      bindingHandoffId: r.binding_handoff_id,
      challengeId: r.challenge_id,
      providerOrganizationId: r.provider_organization_id,
      fileName: r.file_name,
      fileSizeBytes: r.file_size_bytes,
      mimeType: r.mime_type,
      documentSha256: r.document_sha256,
      storageRef: r.storage_ref,
      uploadedAt: r.uploaded_at
    }));
  }

  public async getIssuedPolicyDocument(id: string): Promise<IssuedPolicyDocument | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<any>(
      `SELECT * FROM issued_policy_documents WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      bindingHandoffId: r.binding_handoff_id,
      challengeId: r.challenge_id,
      providerOrganizationId: r.provider_organization_id,
      fileName: r.file_name,
      fileSizeBytes: r.file_size_bytes,
      mimeType: r.mime_type,
      documentSha256: r.document_sha256,
      storageRef: r.storage_ref,
      uploadedAt: r.uploaded_at
    };
  }

  public async saveIssuedPolicySnapshot(snapshot: IssuedPolicySnapshot): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO issued_policy_snapshots (
        id, issued_policy_document_id, binding_handoff_id, carrier, policy_number,
        annual_premium, monthly_premium, effective_date, expiration_date, coverages,
        extraction_confidence, is_ambiguous, snapshot_sha256, extracted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO NOTHING;`,
      [
        snapshot.id, snapshot.issuedPolicyDocumentId, snapshot.bindingHandoffId,
        snapshot.carrier, snapshot.policyNumber, snapshot.annualPremium,
        snapshot.monthlyPremium ?? null, snapshot.effectiveDate, snapshot.expirationDate,
        JSON.stringify(snapshot.coverages || []), snapshot.extractionConfidence,
        snapshot.isAmbiguous, snapshot.snapshotSha256, snapshot.extractedAt
      ]
    );
  }

  public async getIssuedPolicySnapshots(bindingHandoffId?: string): Promise<IssuedPolicySnapshot[]> {
    await this.ensureReady();
    const query = bindingHandoffId
      ? `SELECT * FROM issued_policy_snapshots WHERE binding_handoff_id = $1 ORDER BY extracted_at DESC;`
      : `SELECT * FROM issued_policy_snapshots ORDER BY extracted_at DESC;`;
    const params = bindingHandoffId ? [bindingHandoffId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      issuedPolicyDocumentId: r.issued_policy_document_id,
      bindingHandoffId: r.binding_handoff_id,
      carrier: r.carrier,
      policyNumber: r.policy_number,
      annualPremium: r.annual_premium,
      monthlyPremium: r.monthly_premium ?? undefined,
      effectiveDate: r.effective_date,
      expirationDate: r.expiration_date,
      coverages: JSON.parse(r.coverages || '[]'),
      extractionConfidence: Number(r.extraction_confidence),
      isAmbiguous: Boolean(r.is_ambiguous),
      snapshotSha256: r.snapshot_sha256,
      extractedAt: r.extracted_at
    }));
  }

  public async getIssuedPolicySnapshot(id: string): Promise<IssuedPolicySnapshot | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<any>(
      `SELECT * FROM issued_policy_snapshots WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      issuedPolicyDocumentId: r.issued_policy_document_id,
      bindingHandoffId: r.binding_handoff_id,
      carrier: r.carrier,
      policyNumber: r.policy_number,
      annualPremium: r.annual_premium,
      monthlyPremium: r.monthly_premium ?? undefined,
      effectiveDate: r.effective_date,
      expirationDate: r.expiration_date,
      coverages: JSON.parse(r.coverages || '[]'),
      extractionConfidence: Number(r.extraction_confidence),
      isAmbiguous: Boolean(r.is_ambiguous),
      snapshotSha256: r.snapshot_sha256,
      extractedAt: r.extracted_at
    };
  }

  public async saveReconciliationReport(report: ReconciliationReport): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO reconciliation_reports (
        id, binding_handoff_id, challenge_id, issued_policy_document_id,
        issued_policy_snapshot_id, verdict, status, discrepancies,
        total_annual_premium_variance, expected_terms_summary, issued_terms_summary,
        reconciled_at, reconciled_by, consumer_reviewed_at, consumer_decision,
        consumer_dispute_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        verdict = EXCLUDED.verdict,
        status = EXCLUDED.status,
        consumer_reviewed_at = EXCLUDED.consumer_reviewed_at,
        consumer_decision = EXCLUDED.consumer_decision,
        consumer_dispute_notes = EXCLUDED.consumer_dispute_notes;`,
      [
        report.id, report.bindingHandoffId, report.challengeId,
        report.issuedPolicyDocumentId, report.issuedPolicySnapshotId,
        report.verdict, report.status, JSON.stringify(report.discrepancies || []),
        report.totalAnnualPremiumVariance, JSON.stringify(report.expectedTermsSummary),
        JSON.stringify(report.issuedTermsSummary), report.reconciledAt,
        report.reconciledBy, report.consumerReviewedAt || null,
        report.consumerDecision || null, report.consumerDisputeNotes || null
      ]
    );
  }

  public async getReconciliationReports(refId?: string): Promise<ReconciliationReport[]> {
    await this.ensureReady();
    const query = refId
      ? `SELECT * FROM reconciliation_reports WHERE challenge_id = $1 OR binding_handoff_id = $1 ORDER BY reconciled_at DESC;`
      : `SELECT * FROM reconciliation_reports ORDER BY reconciled_at DESC;`;
    const params = refId ? [refId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      bindingHandoffId: r.binding_handoff_id,
      challengeId: r.challenge_id,
      issuedPolicyDocumentId: r.issued_policy_document_id,
      issuedPolicySnapshotId: r.issued_policy_snapshot_id,
      verdict: r.verdict,
      status: r.status,
      discrepancies: JSON.parse(r.discrepancies || '[]'),
      totalAnnualPremiumVariance: r.total_annual_premium_variance,
      expectedTermsSummary: JSON.parse(r.expected_terms_summary),
      issuedTermsSummary: JSON.parse(r.issued_terms_summary),
      reconciledAt: r.reconciled_at,
      reconciledBy: r.reconciled_by,
      consumerReviewedAt: r.consumer_reviewed_at || undefined,
      consumerDecision: r.consumer_decision || undefined,
      consumerDisputeNotes: r.consumer_dispute_notes || undefined
    }));
  }

  public async getReconciliationReport(id: string): Promise<ReconciliationReport | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<any>(
      `SELECT * FROM reconciliation_reports WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      bindingHandoffId: r.binding_handoff_id,
      challengeId: r.challenge_id,
      issuedPolicyDocumentId: r.issued_policy_document_id,
      issuedPolicySnapshotId: r.issued_policy_snapshot_id,
      verdict: r.verdict,
      status: r.status,
      discrepancies: JSON.parse(r.discrepancies || '[]'),
      totalAnnualPremiumVariance: r.total_annual_premium_variance,
      expectedTermsSummary: JSON.parse(r.expected_terms_summary),
      issuedTermsSummary: JSON.parse(r.issued_terms_summary),
      reconciledAt: r.reconciled_at,
      reconciledBy: r.reconciled_by,
      consumerReviewedAt: r.consumer_reviewed_at || undefined,
      consumerDecision: r.consumer_decision || undefined,
      consumerDisputeNotes: r.consumer_dispute_notes || undefined
    };
  }

  public async savePolicyVaultItem(item: PolicyVaultItem): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO policy_vault_items (
        id, consumer_id, challenge_id, selection_id, binding_handoff_id,
        selected_offer_version_id, accepted_binding_modification_ids,
        issued_policy_document_id, issued_policy_snapshot_id, reconciliation_report_id,
        future_coverage_baseline_id, carrier, policy_number, annual_premium,
        effective_date, expiration_date, coverages, provenance_hash, status, filed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (id) DO NOTHING;`,
      [
        item.id, item.consumerId, item.challengeId, item.selectionId, item.bindingHandoffId,
        item.selectedOfferVersionId, JSON.stringify(item.acceptedBindingModificationIds || []),
        item.issuedPolicyDocumentId, item.issuedPolicySnapshotId, item.reconciliationReportId,
        item.futureCoverageBaselineId || null, item.carrier, item.policyNumber, item.annualPremium,
        item.effectiveDate, item.expirationDate, JSON.stringify(item.coverages || []),
        item.provenanceHash, item.status, item.filedAt
      ]
    );
  }

  public async saveNotification(notification: PlatformNotification): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `INSERT INTO platform_notifications (
        id, type, title, message, timestamp, is_read, read_at, recipient_type,
        recipient_consumer_id, recipient_provider_user_id, recipient_provider_organization_id,
        recipient_operator_id, created_from_event, action_target
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET is_read = EXCLUDED.is_read, read_at = EXCLUDED.read_at;`,
      [
        notification.id, notification.type, notification.title, notification.message,
        notification.timestamp, notification.read, notification.readAt || null,
        notification.recipientType, notification.recipientConsumerId || null,
        notification.recipientProviderUserId || null,
        notification.recipientProviderOrganizationId || null,
        notification.recipientOperatorId || null, notification.createdFromEvent,
        notification.actionTarget || null
      ]
    );
  }

  public async markNotificationRead(id: string, readAt: string): Promise<void> {
    await this.ensureReady();
    await this.sql!.query(
      `UPDATE platform_notifications SET is_read = TRUE, read_at = $2 WHERE id = $1;`,
      [id, readAt]
    );
  }

  public async getNotificationsForRecipient(selector: {
    recipientType: PlatformNotification['recipientType'];
    recipientId: string;
  }): Promise<PlatformNotification[]> {
    await this.ensureReady();
    const column = {
      CONSUMER: 'recipient_consumer_id',
      PROVIDER_USER: 'recipient_provider_user_id',
      PROVIDER_ORGANIZATION: 'recipient_provider_organization_id',
      PLATFORM_OPERATOR: 'recipient_operator_id'
    }[selector.recipientType];
    const res = await this.sql!.query<any>(
      `SELECT * FROM platform_notifications
       WHERE recipient_type = $1 AND ${column} = $2
       ORDER BY timestamp DESC, id;`,
      [selector.recipientType, selector.recipientId]
    );
    return res.rows.map(r => ({
      id: r.id, type: r.type, title: r.title, message: r.message,
      timestamp: r.timestamp, read: r.is_read, readAt: r.read_at || undefined,
      recipientType: r.recipient_type,
      recipientConsumerId: r.recipient_consumer_id || undefined,
      recipientProviderUserId: r.recipient_provider_user_id || undefined,
      recipientProviderOrganizationId: r.recipient_provider_organization_id || undefined,
      recipientOperatorId: r.recipient_operator_id || undefined,
      createdFromEvent: r.created_from_event, actionTarget: r.action_target || undefined
    })) as PlatformNotification[];
  }

  public async markNotificationReadForRecipient(
    id: string,
    selector: { recipientType: PlatformNotification['recipientType']; recipientId: string },
    readAt: string
  ): Promise<boolean> {
    await this.ensureReady();
    const column = {
      CONSUMER: 'recipient_consumer_id',
      PROVIDER_USER: 'recipient_provider_user_id',
      PROVIDER_ORGANIZATION: 'recipient_provider_organization_id',
      PLATFORM_OPERATOR: 'recipient_operator_id'
    }[selector.recipientType];
    const result = await this.sql!.query(
      `UPDATE platform_notifications SET is_read = TRUE, read_at = $3
       WHERE id = $1 AND recipient_type = $2 AND ${column} = $4;`,
      [id, selector.recipientType, readAt, selector.recipientId]
    );
    return result.rowCount === 1;
  }

  public async getPolicyVaultItems(consumerId?: string): Promise<PolicyVaultItem[]> {
    await this.ensureReady();
    const query = consumerId
      ? `SELECT * FROM policy_vault_items WHERE consumer_id = $1 ORDER BY filed_at DESC;`
      : `SELECT * FROM policy_vault_items ORDER BY filed_at DESC;`;
    const params = consumerId ? [consumerId] : [];
    const res = await this.sql!.query<any>(query, params);
    return res.rows.map(r => ({
      id: r.id,
      consumerId: r.consumer_id,
      challengeId: r.challenge_id,
      selectionId: r.selection_id,
      bindingHandoffId: r.binding_handoff_id,
      selectedOfferVersionId: r.selected_offer_version_id,
      acceptedBindingModificationIds: JSON.parse(r.accepted_binding_modification_ids || '[]'),
      issuedPolicyDocumentId: r.issued_policy_document_id,
      issuedPolicySnapshotId: r.issued_policy_snapshot_id,
      reconciliationReportId: r.reconciliation_report_id,
      futureCoverageBaselineId: r.future_coverage_baseline_id || undefined,
      carrier: r.carrier,
      policyNumber: r.policy_number,
      annualPremium: r.annual_premium,
      effectiveDate: r.effective_date,
      expirationDate: r.expiration_date,
      coverages: JSON.parse(r.coverages || '[]'),
      provenanceHash: r.provenance_hash,
      status: r.status,
      filedAt: r.filed_at
    }));
  }

  public async getPolicyVaultItem(id: string): Promise<PolicyVaultItem | undefined> {
    await this.ensureReady();
    const res = await this.sql!.query<any>(
      `SELECT * FROM policy_vault_items WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      consumerId: r.consumer_id,
      challengeId: r.challenge_id,
      selectionId: r.selection_id,
      bindingHandoffId: r.binding_handoff_id,
      selectedOfferVersionId: r.selected_offer_version_id,
      acceptedBindingModificationIds: JSON.parse(r.accepted_binding_modification_ids || '[]'),
      issuedPolicyDocumentId: r.issued_policy_document_id,
      issuedPolicySnapshotId: r.issued_policy_snapshot_id,
      reconciliationReportId: r.reconciliation_report_id,
      futureCoverageBaselineId: r.future_coverage_baseline_id || undefined,
      carrier: r.carrier,
      policyNumber: r.policy_number,
      annualPremium: r.annual_premium,
      effectiveDate: r.effective_date,
      expirationDate: r.expiration_date,
      coverages: JSON.parse(r.coverages || '[]'),
      provenanceHash: r.provenance_hash,
      status: r.status,
      filedAt: r.filed_at
    };
  }

  public async getTableCounts(): Promise<Record<string, number>> {
    await this.ensureReady();
    const tables = [
      'provider_organizations',
      'provider_users',
      'provider_licenses',
      'carrier_relationships',
      'provider_appetites',
      'competitions',
      'challenge_invitations',
      'challenge_participations',
      'challenges',
      'policies',
      'offers',
      'audit_events',
      'information_requests',
      'verified_supplemental_facts',
      'offer_versions',
      'offer_verifications',
      'selections',
      'consent_grants',
      'disclosure_events',
      'binding_handoffs',
      'binding_modifications',
      'issued_policy_documents',
      'issued_policy_snapshots',
      'reconciliation_reports',
      'policy_vault_items'
    ];
    const counts: Record<string, number> = {};
    for (const tbl of tables) {
      try {
        const res = await this.sql!.query<{ cnt: string }>(`SELECT COUNT(*) as cnt FROM ${tbl};`);
        counts[tbl] = parseInt(res.rows[0]?.cnt || '0', 10);
      } catch {
        counts[tbl] = 0;
      }
    }
    return counts;
  }

  /**
   * Seeds canonical PM-1 provider marketplace data into the durable store.
   * This is idempotent — uses ON CONFLICT DO UPDATE/NOTHING so re-seeding is safe.
   * Called once at server startup if provider_organizations table is empty.
   * Seed data is documented — these are fixture identifiers, not production authentication values.
   */
  public async seedCanonicalProviderData(): Promise<void> {
    await this.ensureReady();

    // Check if already seeded
    const counts = await this.getTableCounts();
    if (counts['provider_organizations'] > 0) {
      console.log('[Open Policy Postgres] PM-1 provider data already seeded, skipping.');
      return;
    }

    console.log('[Open Policy Postgres] Seeding canonical PM-1 provider marketplace data...');

    // Provider A: Sierra Brokerage Group (NV Personal Auto Eligible)
    await this.saveProviderOrganization({
      id: 'org_sierra',
      legalName: 'Sierra Brokerage Group LLC',
      displayName: 'Sierra Brokerage Group',
      organizationType: 'INDEPENDENT_AGENCY',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['NV', 'CA', 'AZ'],
      linesOfBusiness: ['PERSONAL_AUTO', 'HOMEOWNERS'],
      createdAt: '2026-01-15T08:00:00Z',
      verifiedAt: '2026-01-16T10:30:00Z'
    });
    await this.saveProviderUser({
      id: 'user_sierra_1',
      organizationId: 'org_sierra',
      name: 'Alex Morgan',
      email: 'alex@sierrabrokerage.com',
      role: 'AGENT',
      status: 'ACTIVE'
    });
    await this.saveProviderLicense({
      id: 'lic_sierra_nv',
      providerOrganizationId: 'org_sierra',
      jurisdiction: 'NV',
      licenseType: 'PROPERTY_CASUALTY_BROKER',
      licenseNumber: 'NV-LIC-902188',
      status: 'ACTIVE',
      effectiveDate: '2025-01-01',
      expirationDate: '2027-01-01',
      verificationStatus: 'VERIFIED'
    });
    await this.saveProviderAppetite({
      id: 'app_sierra',
      providerOrganizationId: 'org_sierra',
      jurisdictions: ['NV', 'CA', 'AZ'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      riskMarkets: ['PREFERRED', 'STANDARD'],
      renewalWindowDays: { min: 14, max: 90 },
      supportedVehicleCharacteristics: ['SEDAN', 'SUV', 'TRUCK'],
      active: true
    });
    await this.saveCarrierRelationship({ id: 'rel_sierra_trv', providerOrganizationId: 'org_sierra', carrierId: 'c_trv', carrierName: 'Travelers', jurisdiction: 'NV', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' });
    await this.saveCarrierRelationship({ id: 'rel_sierra_saf', providerOrganizationId: 'org_sierra', carrierId: 'c_saf', carrierName: 'Safeco', jurisdiction: 'NV', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' });
    await this.saveCarrierRelationship({ id: 'rel_sierra_nat', providerOrganizationId: 'org_sierra', carrierId: 'c_nat', carrierName: 'Nationwide', jurisdiction: 'NV', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' });

    // Provider B: Buckeye State Insurance (OH Only - INELIGIBLE for NV Auto)
    await this.saveProviderOrganization({
      id: 'org_buckeye',
      legalName: 'Buckeye Mutual Agency Inc',
      displayName: 'Buckeye State Insurance',
      organizationType: 'INDEPENDENT_AGENCY',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['OH'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      createdAt: '2026-02-01T08:00:00Z',
      verifiedAt: '2026-02-02T10:00:00Z'
    });
    await this.saveProviderUser({
      id: 'user_buckeye_1',
      organizationId: 'org_buckeye',
      name: 'Dave Miller',
      email: 'dave@buckeyestate.com',
      role: 'AGENT',
      status: 'ACTIVE'
    });
    await this.saveProviderLicense({
      id: 'lic_buckeye_oh',
      providerOrganizationId: 'org_buckeye',
      jurisdiction: 'OH',
      licenseType: 'AGENT',
      licenseNumber: 'OH-LIC-44120',
      status: 'ACTIVE',
      effectiveDate: '2025-01-01',
      expirationDate: '2027-01-01',
      verificationStatus: 'VERIFIED'
    });
    await this.saveProviderAppetite({
      id: 'app_buckeye',
      providerOrganizationId: 'org_buckeye',
      jurisdictions: ['OH'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      riskMarkets: ['PREFERRED', 'STANDARD'],
      renewalWindowDays: { min: 10, max: 60 },
      active: true
    });
    await this.saveCarrierRelationship({ id: 'rel_buckeye_erie', providerOrganizationId: 'org_buckeye', carrierId: 'c_erie', carrierName: 'Erie Insurance', jurisdiction: 'OH', lineOfBusiness: 'PERSONAL_AUTO', relationshipType: 'APPOINTED', status: 'ACTIVE' });

    // Provider C: Apex Insurance Services (NV Personal Auto Brokerage - ELIGIBLE)
    await this.saveProviderOrganization({
      id: 'org_apex',
      legalName: 'Apex Insurance Services Inc',
      displayName: 'Apex Insurance Services',
      organizationType: 'BROKERAGE',
      verificationStatus: 'MARKETPLACE_APPROVED',
      marketplaceStatus: 'ACTIVE',
      states: ['NV'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      createdAt: '2026-01-20T08:00:00Z',
      verifiedAt: '2026-01-21T09:00:00Z'
    });
    await this.saveProviderUser({
      id: 'user_apex_1',
      organizationId: 'org_apex',
      name: 'Sarah Jenkins',
      email: 'sarah@apexinsurance.com',
      role: 'AGENT',
      status: 'ACTIVE'
    });
    await this.saveProviderLicense({
      id: 'lic_apex_nv',
      providerOrganizationId: 'org_apex',
      jurisdiction: 'NV',
      licenseType: 'BROKER',
      licenseNumber: 'NV-LIC-849201',
      status: 'ACTIVE',
      effectiveDate: '2025-01-01',
      expirationDate: '2027-01-01',
      verificationStatus: 'VERIFIED'
    });
    await this.saveProviderAppetite({
      id: 'app_apex',
      providerOrganizationId: 'org_apex',
      jurisdictions: ['NV'],
      linesOfBusiness: ['PERSONAL_AUTO'],
      riskMarkets: ['PREFERRED', 'STANDARD'],
      renewalWindowDays: { min: 7, max: 120 },
      active: true
    });

    // Canonical competition & invitations for challenge CHAL-NV-49281
    await this.saveCompetition({
      id: 'COMP-NV-49281',
      challengeId: 'CHAL-NV-49281',
      status: 'OPEN',
      currentRound: 'ROUND_1_OPEN',
      openedAt: '2026-09-18T14:35:00Z',
      closesAt: '2026-09-20T14:35:00Z',
      participantCount: 1,
      improvementRoundEnabled: true,
      finalRoundEnabled: true
    });

    await this.saveInvitation({
      id: 'INV-NV-49281-org_sierra',
      challengeId: 'CHAL-NV-49281',
      competitionId: 'COMP-NV-49281',
      providerOrganizationId: 'org_sierra',
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['All marketplace eligibility criteria satisfied'],
      status: 'ACCEPTED',
      invitedAt: '2026-09-18T14:35:00Z',
      viewedAt: '2026-09-18T14:50:00Z',
      acceptedAt: '2026-09-18T15:10:00Z',
      expiresAt: '2026-09-20T14:35:00Z'
    });

    await this.saveParticipation({
      id: 'PART-NV-49281-org_sierra',
      challengeId: 'CHAL-NV-49281',
      competitionId: 'COMP-NV-49281',
      providerOrganizationId: 'org_sierra',
      acceptedAt: '2026-09-18T15:10:00Z',
      status: 'ACTIVE',
      lastActivityAt: '2026-09-19T11:42:00Z'
    });

    await this.saveInvitation({
      id: 'INV-NV-49281-org_apex',
      challengeId: 'CHAL-NV-49281',
      competitionId: 'COMP-NV-49281',
      providerOrganizationId: 'org_apex',
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['All marketplace eligibility criteria satisfied'],
      status: 'INVITED',
      invitedAt: '2026-09-18T14:35:00Z',
      expiresAt: '2026-09-20T14:35:00Z'
    });

    console.log('[Open Policy Postgres] PM-1 canonical provider marketplace data seeded successfully.');
  }
}

export const postgresStore = new PostgresStore();
