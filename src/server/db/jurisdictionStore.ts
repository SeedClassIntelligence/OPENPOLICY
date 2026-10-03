/**
 * PR-0A — Jurisdiction Store (PGlite)
 *
 * Every write is awaited and a failure propagates: regulatory records do not use the
 * fire-and-forget pattern. Lifecycle rules are enforced twice: by the pure governance and
 * activation engines here, and by triggers in migration 0008.
 *
 * Commercial tables are never read or written here.
 */
import crypto from 'crypto';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore, postgresStore } from './postgresStore';
import {
  ActivationGateCode,
  GateAttestation,
  InsuranceLine,
  JurisdictionDetermination,
  JurisdictionKind,
  JurisdictionRule,
  JurisdictionRuleEvaluation,
  JurisdictionRuleSet,
  MarketActivationEvent,
  MarketDisplayStatus,
  MarketEnvironment,
  OperationalActivationState,
  RegulatoryAuthority,
  RegulatoryReadiness,
  RegulatorySource,
  RuleSetBasis,
  SuspensionAction
} from '../../types/jurisdiction';
import { US_JURISDICTIONS } from '../../domain/jurisdiction/usJurisdictions';
import { canDiscard, canModifyRules, canReturnToDraft, computeRuleSetContentHash, publishRuleSet, validateWithdrawal } from '../../domain/rulesetGovernance';
import {
  activeGates,
  deriveReadiness,
  displayStatus,
  MarketKey,
  productionPilotCompletion,
  replayActivation,
  validateActivationTransition
} from '../../domain/marketActivationEngine';

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toDate(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export class JurisdictionStore {
  constructor(private store: PostgresStore = postgresStore) {}

  private async client(): Promise<PGlite> {
    return this.store.getPgClient();
  }

  // -------------------------------------------------------------------------
  // Reference data
  // -------------------------------------------------------------------------

  public async ensureReferenceData(): Promise<void> {
    const c = await this.client();
    for (const j of US_JURISDICTIONS) {
      await c.query(
        `INSERT INTO jurisdictions (code, name, kind) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
        [j.code, j.name, j.kind]
      );
    }
  }

  /** Test-only fictional jurisdictions. They can never be activated in PRODUCTION. */
  public async registerTestJurisdiction(code: string, name: string): Promise<void> {
    const c = await this.client();
    await c.query(
      `INSERT INTO jurisdictions (code, name, kind) VALUES ($1, $2, 'TEST_FIXTURE') ON CONFLICT (code) DO NOTHING`,
      [code, name]
    );
  }

  public async getJurisdictions(): Promise<Array<{ code: string; name: string; kind: JurisdictionKind }>> {
    const c = await this.client();
    const res = await c.query<{ code: string; name: string; kind: JurisdictionKind }>(`SELECT code, name, kind FROM jurisdictions ORDER BY code`);
    return res.rows;
  }

  public async getJurisdictionKind(code: string): Promise<JurisdictionKind | undefined> {
    const c = await this.client();
    const res = await c.query<{ kind: JurisdictionKind }>(`SELECT kind FROM jurisdictions WHERE code = $1`, [code]);
    return res.rows[0]?.kind;
  }

  // -------------------------------------------------------------------------
  // Provenance
  // -------------------------------------------------------------------------

  public async saveAuthority(a: RegulatoryAuthority): Promise<void> {
    const c = await this.client();
    await c.query(
      `INSERT INTO regulatory_authorities (id, jurisdiction_code, name, kind, official_url) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [a.id, a.jurisdictionCode, a.name, a.kind, a.officialUrl ?? null]
    );
  }

  public async saveSource(s: RegulatorySource): Promise<void> {
    const c = await this.client();
    await c.query(
      `INSERT INTO regulatory_sources (id, jurisdiction_code, authority_id, source_type, citation, title, official_url,
         retrieved_at, content_sha256, archived_copy_ref, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
      [s.id, s.jurisdictionCode, s.authorityId, s.sourceType, s.citation, s.title, s.officialUrl ?? null,
       s.retrievedAt ?? null, s.contentSha256 ?? null, s.archivedCopyRef ?? null, s.notes ?? null]
    );
  }

  public async getSources(jurisdictionCode: string): Promise<RegulatorySource[]> {
    const c = await this.client();
    const res = await c.query<any>(`SELECT * FROM regulatory_sources WHERE jurisdiction_code = $1 ORDER BY id`, [jurisdictionCode]);
    return res.rows.map(r => ({
      id: r.id,
      jurisdictionCode: r.jurisdiction_code,
      authorityId: r.authority_id,
      sourceType: r.source_type,
      citation: r.citation,
      title: r.title,
      officialUrl: r.official_url ?? undefined,
      retrievedAt: r.retrieved_at ?? undefined,
      contentSha256: r.content_sha256 ?? undefined,
      archivedCopyRef: r.archived_copy_ref ?? undefined,
      notes: r.notes ?? undefined
    }));
  }

  // -------------------------------------------------------------------------
  // Rulesets and rules
  // -------------------------------------------------------------------------

  private mapRuleSet(r: any): JurisdictionRuleSet {
    return {
      id: r.id,
      jurisdictionCode: r.jurisdiction_code,
      insuranceLine: r.insurance_line,
      version: r.version,
      status: r.status,
      supersedesRuleSetId: r.supersedes_rule_set_id ?? undefined,
      authoredBy: r.authored_by,
      publishedBy: r.published_by ?? undefined,
      publishedAt: r.published_at ?? undefined,
      contentSha256: r.content_sha256 ?? undefined,
      createdAt: r.created_at
    };
  }

  private mapRule(r: any): JurisdictionRule {
    return {
      id: r.id,
      ruleSetId: r.rule_set_id,
      ruleCode: r.rule_code,
      ruleCategory: r.rule_category,
      enforcementPoint: r.enforcement_point,
      temporalBasis: r.temporal_basis,
      requirementText: r.requirement_text,
      sourceIds: JSON.parse(r.source_ids),
      effectiveFrom: toDate(r.effective_from)!,
      effectiveUntil: toDate(r.effective_until),
      verificationStatus: r.verification_status,
      verifiedAt: r.verified_at ?? undefined,
      verifiedBy: r.verified_by ?? undefined,
      supersedesRuleId: r.supersedes_rule_id ?? undefined,
      machineRule: r.machine_rule ? JSON.parse(r.machine_rule) : null
    };
  }

  public async createRuleSet(params: {
    jurisdictionCode: string;
    insuranceLine: InsuranceLine;
    authoredBy: string;
    id?: string;
    createdAt?: string;
  }): Promise<JurisdictionRuleSet> {
    const c = await this.client();
    const max = await c.query<{ v: number | null }>(
      `SELECT MAX(version) AS v FROM jurisdiction_rule_sets WHERE jurisdiction_code = $1 AND insurance_line = $2`,
      [params.jurisdictionCode, params.insuranceLine]
    );
    const ruleSet: JurisdictionRuleSet = {
      id: params.id || newId('JRS'),
      jurisdictionCode: params.jurisdictionCode,
      insuranceLine: params.insuranceLine,
      version: (max.rows[0]?.v ?? 0) + 1,
      status: 'DRAFT',
      authoredBy: params.authoredBy,
      createdAt: params.createdAt || new Date().toISOString()
    };
    await c.query(
      `INSERT INTO jurisdiction_rule_sets (id, jurisdiction_code, insurance_line, version, status, authored_by, created_at)
       VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6)`,
      [ruleSet.id, ruleSet.jurisdictionCode, ruleSet.insuranceLine, ruleSet.version, ruleSet.authoredBy, ruleSet.createdAt]
    );
    await this.recordReview(ruleSet.id, 'CREATED', params.authoredBy);
    return ruleSet;
  }

  public async getRuleSet(id: string): Promise<JurisdictionRuleSet | undefined> {
    const c = await this.client();
    const res = await c.query<any>(`SELECT * FROM jurisdiction_rule_sets WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapRuleSet(res.rows[0]) : undefined;
  }

  public async getRuleSets(jurisdictionCode?: string, insuranceLine?: InsuranceLine): Promise<JurisdictionRuleSet[]> {
    const c = await this.client();
    const res = await c.query<any>(
      `SELECT * FROM jurisdiction_rule_sets
       WHERE ($1::text IS NULL OR jurisdiction_code = $1) AND ($2::text IS NULL OR insurance_line = $2)
       ORDER BY jurisdiction_code, insurance_line, version`,
      [jurisdictionCode ?? null, insuranceLine ?? null]
    );
    return res.rows.map(r => this.mapRuleSet(r));
  }

  public async getRules(ruleSetId: string): Promise<JurisdictionRule[]> {
    const c = await this.client();
    const res = await c.query<any>(`SELECT * FROM jurisdiction_rules WHERE rule_set_id = $1 ORDER BY id`, [ruleSetId]);
    return res.rows.map(r => this.mapRule(r));
  }

  public async addRule(rule: JurisdictionRule): Promise<JurisdictionRule> {
    const ruleSet = await this.getRuleSet(rule.ruleSetId);
    if (!ruleSet) throw new Error(`Ruleset ${rule.ruleSetId} not found`);
    if (!canModifyRules(ruleSet)) throw new Error(`Rules can only be added to a DRAFT ruleset (ruleset ${ruleSet.id} is ${ruleSet.status})`);
    const c = await this.client();
    await c.query(
      `INSERT INTO jurisdiction_rules (id, rule_set_id, rule_code, rule_category, enforcement_point, temporal_basis,
         requirement_text, source_ids, effective_from, effective_until, verification_status, verified_at, verified_by,
         supersedes_rule_id, machine_rule)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [rule.id, rule.ruleSetId, rule.ruleCode, rule.ruleCategory, rule.enforcementPoint, rule.temporalBasis,
       rule.requirementText, JSON.stringify(rule.sourceIds), rule.effectiveFrom, rule.effectiveUntil ?? null,
       rule.verificationStatus, rule.verifiedAt ?? null, rule.verifiedBy ?? null, rule.supersedesRuleId ?? null,
       rule.machineRule ? JSON.stringify(rule.machineRule) : null]
    );
    return rule;
  }

  /** Legal verification of a rule happens while its ruleset is still DRAFT. */
  public async verifyRule(ruleId: string, verifiedBy: string, verifiedAt: string): Promise<void> {
    const c = await this.client();
    await c.query(
      `UPDATE jurisdiction_rules SET verification_status = 'VERIFIED', verified_by = $2, verified_at = $3 WHERE id = $1`,
      [ruleId, verifiedBy, verifiedAt]
    );
  }

  public async submitForReview(ruleSetId: string, actorId: string): Promise<void> {
    const ruleSet = await this.getRuleSet(ruleSetId);
    if (!ruleSet || ruleSet.status !== 'DRAFT') throw new Error(`Only a DRAFT ruleset can be submitted for review`);
    const c = await this.client();
    await c.query(`UPDATE jurisdiction_rule_sets SET status = 'IN_REVIEW' WHERE id = $1`, [ruleSetId]);
    await this.recordReview(ruleSetId, 'SUBMITTED_FOR_REVIEW', actorId);
  }

  /** Review rejected or correction needed: IN_REVIEW returns to DRAFT, recorded with a reason. */
  public async returnToDraft(ruleSetId: string, actorId: string, reason: string): Promise<void> {
    const ruleSet = await this.getRuleSet(ruleSetId);
    if (!ruleSet || !canReturnToDraft(ruleSet)) throw new Error('Only an IN_REVIEW ruleset can return to DRAFT');
    if (!actorId || !reason) throw new Error('Returning a ruleset to DRAFT requires an actor and a reason');
    const c = await this.client();
    await c.query(`UPDATE jurisdiction_rule_sets SET status = 'DRAFT' WHERE id = $1`, [ruleSetId]);
    await this.recordReview(ruleSetId, 'RETURNED_TO_DRAFT', actorId, reason);
  }

  public async publish(ruleSetId: string, publisherId: string, publishedAt: string): Promise<JurisdictionRuleSet> {
    const ruleSet = await this.getRuleSet(ruleSetId);
    if (!ruleSet) throw new Error(`Ruleset ${ruleSetId} not found`);
    const rules = await this.getRules(ruleSetId);
    const prior = (await this.getRuleSets(ruleSet.jurisdictionCode, ruleSet.insuranceLine)).find(r => r.status === 'PUBLISHED');
    const { published, superseded } = publishRuleSet({ ruleSet, rules, publisherId, publishedAt, priorPublished: prior });

    const c = await this.client();
    await c.transaction(async tx => {
      if (superseded) {
        await tx.query(`UPDATE jurisdiction_rule_sets SET status = 'SUPERSEDED' WHERE id = $1`, [superseded.id]);
      }
      await tx.query(
        `UPDATE jurisdiction_rule_sets SET status = 'PUBLISHED', published_by = $2, published_at = $3, content_sha256 = $4,
           supersedes_rule_set_id = $5 WHERE id = $1`,
        [published.id, published.publishedBy, published.publishedAt, published.contentSha256, published.supersedesRuleSetId ?? null]
      );
    });
    if (superseded) await this.recordReview(superseded.id, 'SUPERSEDED', publisherId, `Superseded by ${published.id}`);
    await this.recordReview(published.id, 'PUBLISHED', publisherId);
    return published;
  }

  public async withdraw(ruleSetId: string, actorId: string, reason: string): Promise<void> {
    const ruleSet = await this.getRuleSet(ruleSetId);
    if (!ruleSet) throw new Error(`Ruleset ${ruleSetId} not found`);
    const errors = validateWithdrawal(ruleSet, actorId, reason);
    if (errors.length > 0) throw new Error(errors.join(' '));
    const c = await this.client();
    await c.query(`UPDATE jurisdiction_rule_sets SET status = 'WITHDRAWN' WHERE id = $1`, [ruleSetId]);
    await this.recordReview(ruleSetId, 'WITHDRAWN', actorId, reason);
  }

  /** Erroneous unpublished work may be discarded; published history never can. */
  public async discard(ruleSetId: string, actorId: string, reason: string): Promise<void> {
    const ruleSet = await this.getRuleSet(ruleSetId);
    if (!ruleSet) throw new Error(`Ruleset ${ruleSetId} not found`);
    if (!canDiscard(ruleSet)) throw new Error(`Ruleset ${ruleSetId} is ${ruleSet.status} and cannot be discarded`);
    const c = await this.client();
    await c.transaction(async tx => {
      await tx.query(`DELETE FROM jurisdiction_rules WHERE rule_set_id = $1`, [ruleSetId]);
      await tx.query(`UPDATE jurisdiction_rule_sets SET status = 'DISCARDED' WHERE id = $1`, [ruleSetId]);
    });
    await this.recordReview(ruleSetId, 'DISCARDED', actorId, reason);
  }

  public async getReviews(ruleSetId: string): Promise<Array<{ action: string; actorId: string; notes?: string; recordedAt: string }>> {
    const c = await this.client();
    const res = await c.query<any>(`SELECT * FROM jurisdiction_rule_set_reviews WHERE rule_set_id = $1 ORDER BY recorded_at, id`, [ruleSetId]);
    return res.rows.map(r => ({ action: r.action, actorId: r.actor_id, notes: r.notes ?? undefined, recordedAt: r.recorded_at }));
  }

  private async recordReview(ruleSetId: string, action: string, actorId: string, notes?: string): Promise<void> {
    const c = await this.client();
    await c.query(
      `INSERT INTO jurisdiction_rule_set_reviews (id, rule_set_id, action, actor_id, notes, recorded_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId('JRR'), ruleSetId, action, actorId, notes ?? null, new Date().toISOString()]
    );
  }

  /**
   * The ruleset a shadow evaluation runs against: the latest PUBLISHED one; otherwise the
   * latest IN_REVIEW candidate, labelled UNPUBLISHED_CANDIDATE. Enforcement (PR-0C) will
   * accept only PUBLISHED.
   */
  public async resolveEvaluationRuleSet(
    jurisdictionCode: string,
    insuranceLine: InsuranceLine
  ): Promise<{ basis: RuleSetBasis; ruleSet?: JurisdictionRuleSet; rules: JurisdictionRule[]; contentSha256?: string }> {
    const sets = await this.getRuleSets(jurisdictionCode, insuranceLine);
    const published = sets.filter(s => s.status === 'PUBLISHED').sort((a, b) => b.version - a.version)[0];
    if (published) {
      return { basis: 'PUBLISHED', ruleSet: published, rules: await this.getRules(published.id), contentSha256: published.contentSha256 };
    }
    const candidate = sets.filter(s => s.status === 'IN_REVIEW').sort((a, b) => b.version - a.version)[0];
    if (candidate) {
      const rules = await this.getRules(candidate.id);
      return { basis: 'UNPUBLISHED_CANDIDATE', ruleSet: candidate, rules, contentSha256: computeRuleSetContentHash(candidate, rules) };
    }
    return { basis: 'NONE', rules: [] };
  }

  // -------------------------------------------------------------------------
  // Market activation
  // -------------------------------------------------------------------------

  public async getActivationEvents(key?: Partial<MarketKey>): Promise<MarketActivationEvent[]> {
    const c = await this.client();
    const res = await c.query<any>(
      `SELECT * FROM market_activation_events
       WHERE ($1::text IS NULL OR jurisdiction_code = $1) AND ($2::text IS NULL OR insurance_line = $2)
         AND ($3::text IS NULL OR environment = $3)
       ORDER BY recorded_at, id`,
      [key?.jurisdictionCode ?? null, key?.insuranceLine ?? null, key?.environment ?? null]
    );
    return res.rows.map(r => ({
      id: r.id,
      jurisdictionCode: r.jurisdiction_code,
      insuranceLine: r.insurance_line,
      environment: r.environment,
      fromState: r.from_state,
      toState: r.to_state,
      suspensionAction: r.suspension_action ?? undefined,
      ruleSetId: r.rule_set_id ?? undefined,
      actorId: r.actor_id,
      reason: r.reason,
      recordedAt: r.recorded_at
    }));
  }

  public async getGateAttestations(key: MarketKey): Promise<GateAttestation[]> {
    const c = await this.client();
    const res = await c.query<any>(
      `SELECT a.*, r.revoked_at, r.revoked_by FROM market_activation_gate_attestations a
       LEFT JOIN market_activation_gate_revocations r ON r.attestation_id = a.id
       WHERE a.jurisdiction_code = $1 AND a.insurance_line = $2 AND a.environment = $3
       ORDER BY a.attested_at, a.id`,
      [key.jurisdictionCode, key.insuranceLine, key.environment]
    );
    return res.rows.map(r => ({
      id: r.id,
      jurisdictionCode: r.jurisdiction_code,
      insuranceLine: r.insurance_line,
      environment: r.environment,
      gateCode: r.gate_code,
      evidenceRef: r.evidence_ref,
      attestedBy: r.attested_by,
      attestedAt: r.attested_at,
      revokedAt: r.revoked_at ?? undefined,
      revokedBy: r.revoked_by ?? undefined
    }));
  }

  public async attestGate(key: MarketKey, gateCode: ActivationGateCode, evidenceRef: string, attestedBy: string): Promise<GateAttestation> {
    if (!evidenceRef || !attestedBy) throw new Error('A gate attestation requires evidence and an attributable actor');
    const att: GateAttestation = { id: newId('GATE'), ...key, gateCode, evidenceRef, attestedBy, attestedAt: new Date().toISOString() };
    const c = await this.client();
    await c.query(
      `INSERT INTO market_activation_gate_attestations (id, jurisdiction_code, insurance_line, environment, gate_code, evidence_ref, attested_by, attested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [att.id, att.jurisdictionCode, att.insuranceLine, att.environment, att.gateCode, att.evidenceRef, att.attestedBy, att.attestedAt]
    );
    return att;
  }

  /**
   * Revoking a gate never suspends a market automatically (D9). The caller raises a
   * CRITICAL operational review instead.
   */
  public async revokeGate(attestationId: string, revokedBy: string, reason: string): Promise<void> {
    const c = await this.client();
    await c.query(
      `INSERT INTO market_activation_gate_revocations (id, attestation_id, revoked_by, reason, revoked_at) VALUES ($1, $2, $3, $4, $5)`,
      [newId('GREV'), attestationId, revokedBy, reason, new Date().toISOString()]
    );
  }

  public async getMarketStatus(key: MarketKey): Promise<{
    key: MarketKey;
    state: OperationalActivationState;
    suspensionAction?: SuspensionAction;
    readiness: RegulatoryReadiness;
    gates: ActivationGateCode[];
    displayStatus: MarketDisplayStatus;
  }> {
    const events = await this.getActivationEvents(key);
    const { state, suspensionAction } = replayActivation(events, key);
    const sets = await this.getRuleSets(key.jurisdictionCode, key.insuranceLine);
    const rulesBySet = new Map<string, JurisdictionRule[]>();
    for (const s of sets) rulesBySet.set(s.id, await this.getRules(s.id));
    const { readiness } = deriveReadiness(sets, rulesBySet, key.jurisdictionCode, key.insuranceLine);
    const gates = activeGates(await this.getGateAttestations(key), key);
    return { key, state, suspensionAction, readiness, gates: [...gates], displayStatus: displayStatus(readiness, state, gates) };
  }

  public async transitionMarket(params: {
    key: MarketKey;
    to: OperationalActivationState;
    actorId: string;
    reason: string;
    suspensionAction?: SuspensionAction;
  }): Promise<MarketActivationEvent> {
    const { key, to, actorId, reason } = params;
    const kind = await this.getJurisdictionKind(key.jurisdictionCode);
    if (!kind) throw new Error(`Unknown jurisdiction ${key.jurisdictionCode}`);
    const status = await this.getMarketStatus(key);
    const pilotCompletion = productionPilotCompletion(await this.getActivationEvents(key), key);
    const check = validateActivationTransition({
      key,
      jurisdictionKind: kind,
      from: status.state,
      to,
      readiness: status.readiness,
      gates: new Set(status.gates),
      actorId,
      reason,
      suspensionAction: params.suspensionAction,
      productionPilotCompletedEventId: pilotCompletion?.id
    });
    if (!check.allowed) throw new Error(`Market transition rejected: ${check.errors.join(' ')}`);

    const published = (await this.getRuleSets(key.jurisdictionCode, key.insuranceLine)).find(r => r.status === 'PUBLISHED');
    const event: MarketActivationEvent = {
      id: newId('MAE'),
      ...key,
      fromState: status.state,
      toState: to,
      suspensionAction: check.suspensionAction,
      ruleSetId: published?.id,
      actorId,
      reason,
      recordedAt: new Date().toISOString()
    };
    const c = await this.client();
    await c.query(
      `INSERT INTO market_activation_events (id, jurisdiction_code, insurance_line, environment, from_state, to_state,
         suspension_action, rule_set_id, actor_id, reason, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [event.id, event.jurisdictionCode, event.insuranceLine, event.environment, event.fromState, event.toState,
       event.suspensionAction ?? null, event.ruleSetId ?? null, event.actorId, event.reason, event.recordedAt]
    );
    return event;
  }

  // -------------------------------------------------------------------------
  // Determinations and evaluations (append-only)
  // -------------------------------------------------------------------------

  public async saveDetermination(d: JurisdictionDetermination): Promise<void> {
    const c = await this.client();
    await c.query(
      `INSERT INTO jurisdiction_determinations (id, policy_id, challenge_id, basis, status, proposed_jurisdiction,
         confirmed_jurisdiction, consumer_confirmed_at, reasons, determined_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [d.id, d.policyId ?? null, d.challengeId ?? null, JSON.stringify(d.basis), d.status, d.proposedJurisdiction ?? null,
       d.confirmedJurisdiction ?? null, d.consumerConfirmedAt ?? null, JSON.stringify(d.reasons), d.determinedAt]
    );
  }

  public async getDetermination(id: string): Promise<JurisdictionDetermination | undefined> {
    const c = await this.client();
    const res = await c.query<any>(`SELECT * FROM jurisdiction_determinations WHERE id = $1`, [id]);
    const r = res.rows[0];
    if (!r) return undefined;
    return {
      id: r.id,
      policyId: r.policy_id ?? undefined,
      challengeId: r.challenge_id ?? undefined,
      basis: JSON.parse(r.basis),
      status: r.status,
      proposedJurisdiction: r.proposed_jurisdiction ?? undefined,
      confirmedJurisdiction: r.confirmed_jurisdiction ?? undefined,
      consumerConfirmedAt: r.consumer_confirmed_at ?? undefined,
      reasons: JSON.parse(r.reasons),
      determinedAt: r.determined_at
    };
  }

  public async saveEvaluation(e: JurisdictionRuleEvaluation): Promise<void> {
    const c = await this.client();
    await c.query(
      `INSERT INTO jurisdiction_rule_evaluations (id, subject_type, subject_id, jurisdiction_code, enforcement_point,
         rule_set_id, rule_set_content_sha256, rule_set_basis, evaluation_date, outcome, results, inputs_sha256, mode,
         legacy_outcome, discrepancy, discrepancy_notes, evaluated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [e.id, e.subjectType, e.subjectId, e.jurisdictionCode ?? null, e.enforcementPoint, e.ruleSetId ?? null,
       e.ruleSetContentSha256 ?? null, e.ruleSetBasis, e.evaluationDate ?? null, e.outcome, JSON.stringify(e.results),
       e.inputsSha256, e.mode, e.legacyOutcome ?? null, e.discrepancy, e.discrepancyNotes ?? null, e.evaluatedAt]
    );
  }

  private mapEvaluation(r: any): JurisdictionRuleEvaluation {
    return {
      id: r.id,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      jurisdictionCode: r.jurisdiction_code ?? undefined,
      enforcementPoint: r.enforcement_point,
      ruleSetId: r.rule_set_id ?? undefined,
      ruleSetContentSha256: r.rule_set_content_sha256 ?? undefined,
      ruleSetBasis: r.rule_set_basis,
      evaluationDate: r.evaluation_date ?? undefined,
      outcome: r.outcome,
      results: JSON.parse(r.results),
      inputsSha256: r.inputs_sha256,
      mode: r.mode,
      legacyOutcome: r.legacy_outcome ?? undefined,
      discrepancy: r.discrepancy,
      discrepancyNotes: r.discrepancy_notes ?? undefined,
      evaluatedAt: r.evaluated_at
    };
  }

  public async getEvaluations(filter: { subjectType?: string; subjectId?: string; discrepancy?: boolean } = {}): Promise<JurisdictionRuleEvaluation[]> {
    const c = await this.client();
    const res = await c.query<any>(
      `SELECT * FROM jurisdiction_rule_evaluations
       WHERE ($1::text IS NULL OR subject_type = $1) AND ($2::text IS NULL OR subject_id = $2)
         AND ($3::boolean IS NULL OR discrepancy = $3)
       ORDER BY evaluated_at, id`,
      [filter.subjectType ?? null, filter.subjectId ?? null, filter.discrepancy ?? null]
    );
    return res.rows.map(r => this.mapEvaluation(r));
  }
}

export const jurisdictionStore = new JurisdictionStore();

export type { MarketEnvironment };
