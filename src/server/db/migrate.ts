import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

export const SQL_MIGRATION_V1 = `
-- Open Policy Canonical PM-1 Schema Migration 0001
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_organizations (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  marketplace_status TEXT NOT NULL,
  states TEXT NOT NULL,
  lines_of_business TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS provider_users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_licenses (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  license_number TEXT NOT NULL,
  license_type TEXT NOT NULL,
  status TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS carrier_relationships (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  carrier_id TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  line_of_business TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_appetites (
  provider_organization_id TEXT PRIMARY KEY REFERENCES provider_organizations(id) ON DELETE CASCADE,
  jurisdictions TEXT NOT NULL,
  lines_of_business TEXT NOT NULL,
  min_annual_premium INTEGER,
  max_annual_premium INTEGER,
  target_vehicle_years_min INTEGER,
  target_vehicle_years_max INTEGER,
  preferred_risk_tiers TEXT,
  excluded_vehicle_types TEXT
);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  line_of_business TEXT NOT NULL,
  status TEXT NOT NULL,
  current_round TEXT NOT NULL,
  participant_count INTEGER NOT NULL DEFAULT 0,
  opened_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  rules TEXT
);

CREATE TABLE IF NOT EXISTS challenge_invitations (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  invited_at TEXT NOT NULL,
  viewed_at TEXT,
  accepted_at TEXT,
  declined_at TEXT,
  decline_reason TEXT,
  decline_notes TEXT
);

CREATE TABLE IF NOT EXISTS challenge_participations (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  accepted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  last_activity_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  baseline_data TEXT,
  requirements_data TEXT
);

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  policy_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  named_insured TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  annual_premium INTEGER NOT NULL,
  status TEXT NOT NULL,
  payload TEXT
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  carrier TEXT NOT NULL,
  annual_premium INTEGER NOT NULL,
  monthly_premium INTEGER NOT NULL,
  status TEXT NOT NULL,
  round TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  previous_offer_id TEXT,
  is_latest_revision BOOLEAN NOT NULL DEFAULT TRUE,
  payload TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  details TEXT NOT NULL,
  hash TEXT NOT NULL
);
`;

export const SQL_MIGRATION_V2 = `
-- Open Policy Canonical PM-2 Schema Migration 0002
CREATE TABLE IF NOT EXISTS information_requests (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  competition_id TEXT NOT NULL,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  requested_field TEXT NOT NULL,
  custom_field_name TEXT,
  purpose TEXT NOT NULL,
  purpose_explanation TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  answered_at TEXT,
  answer_value TEXT,
  reusable_fact_id TEXT
);

CREATE TABLE IF NOT EXISTS verified_supplemental_facts (
  id TEXT PRIMARY KEY,
  consumer_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  field_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value TEXT NOT NULL,
  formatted_value TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  shared_with_organization_ids TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offer_versions (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  round TEXT NOT NULL,
  carrier TEXT NOT NULL,
  annual_premium INTEGER NOT NULL,
  monthly_premium INTEGER NOT NULL,
  coverages TEXT NOT NULL,
  supporting_quote_doc_name TEXT NOT NULL,
  revision_reason TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  superseded_at TEXT
);

CREATE TABLE IF NOT EXISTS offer_verifications (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  status TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  discrepancy_count INTEGER NOT NULL,
  discrepancies TEXT NOT NULL,
  extracted_premium INTEGER,
  entered_premium INTEGER
);
`;

export const SQL_MIGRATION_V3 = `
-- Open Policy Canonical PM-4 Schema Migration 0003: Selection, Disclosure & Binding
CREATE TABLE IF NOT EXISTS selections (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  offer_version_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  provider_organization_id TEXT NOT NULL,
  carrier TEXT NOT NULL,
  annual_premium INTEGER NOT NULL,
  monthly_premium INTEGER,
  selected_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consent_grants (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  recipient_organization_id TEXT NOT NULL,
  recipient_user_id TEXT,
  purpose TEXT NOT NULL,
  purpose_explanation TEXT NOT NULL,
  authorized_field_names TEXT NOT NULL,
  acknowledged_variations TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  ip_address_hash TEXT NOT NULL,
  terms_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS disclosure_events (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  binding_handoff_id TEXT NOT NULL,
  consent_grant_id TEXT NOT NULL,
  recipient_provider_organization_id TEXT NOT NULL,
  recipient_provider_user_id TEXT,
  disclosed_at TEXT NOT NULL,
  disclosed_field_names TEXT NOT NULL,
  metadata TEXT,
  event_payload_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS binding_handoffs (
  id TEXT PRIMARY KEY,
  binding_reference TEXT NOT NULL UNIQUE,
  challenge_id TEXT NOT NULL,
  selection_id TEXT,
  offer_id TEXT,
  offer_version_id TEXT,
  consumer_id TEXT,
  provider_organization_id TEXT,
  carrier TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  consent_grant_id TEXT,
  disclosure_event_id TEXT,
  active_modification_id TEXT,
  bound_at TEXT,
  declined_at TEXT,
  decline_reason TEXT,
  consumer_name TEXT,
  consumer_email TEXT,
  consumer_phone TEXT,
  provider_name TEXT
);

CREATE TABLE IF NOT EXISTS binding_modifications (
  id TEXT PRIMARY KEY,
  binding_handoff_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  provider_organization_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  carrier TEXT NOT NULL,
  original_annual_premium INTEGER NOT NULL,
  modified_annual_premium INTEGER NOT NULL,
  coverage_changes TEXT NOT NULL,
  underwriting_reason TEXT NOT NULL,
  proposed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_at TEXT,
  rejection_reason TEXT
);
`;

export const SQL_MIGRATION_V4 = `
-- Open Policy Canonical PM-5 Schema Migration 0004: Issued Policy Reconciliation & Vault Baseline
CREATE TABLE IF NOT EXISTS issued_policy_documents (
  id TEXT PRIMARY KEY,
  binding_handoff_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  provider_organization_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  document_sha256 TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issued_policy_snapshots (
  id TEXT PRIMARY KEY,
  issued_policy_document_id TEXT NOT NULL,
  binding_handoff_id TEXT NOT NULL,
  carrier TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  annual_premium INTEGER NOT NULL,
  monthly_premium INTEGER,
  effective_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  coverages TEXT NOT NULL,
  extraction_confidence REAL NOT NULL DEFAULT 1.0,
  is_ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_sha256 TEXT NOT NULL,
  extracted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reconciliation_reports (
  id TEXT PRIMARY KEY,
  binding_handoff_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  issued_policy_document_id TEXT NOT NULL,
  issued_policy_snapshot_id TEXT NOT NULL,
  verdict TEXT NOT NULL,
  status TEXT NOT NULL,
  discrepancies TEXT NOT NULL,
  total_annual_premium_variance INTEGER NOT NULL DEFAULT 0,
  expected_terms_summary TEXT NOT NULL,
  issued_terms_summary TEXT NOT NULL,
  reconciled_at TEXT NOT NULL,
  reconciled_by TEXT NOT NULL,
  consumer_reviewed_at TEXT,
  consumer_decision TEXT,
  consumer_dispute_notes TEXT
);

CREATE TABLE IF NOT EXISTS policy_vault_items (
  id TEXT PRIMARY KEY,
  consumer_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  selection_id TEXT NOT NULL,
  binding_handoff_id TEXT NOT NULL,
  selected_offer_version_id TEXT NOT NULL,
  accepted_binding_modification_ids TEXT NOT NULL,
  issued_policy_document_id TEXT NOT NULL,
  issued_policy_snapshot_id TEXT NOT NULL,
  reconciliation_report_id TEXT NOT NULL,
  future_coverage_baseline_id TEXT,
  carrier TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  annual_premium INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  coverages TEXT NOT NULL,
  provenance_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  filed_at TEXT NOT NULL
);
`;

export const SQL_MIGRATION_V5 = `
-- Open Policy Canonical Commercial Economics Migration 0005: Commercial Foundation & Event Ledger
CREATE TABLE IF NOT EXISTS commercial_accounts (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL UNIQUE REFERENCES provider_organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  external_billing_customer_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider_segment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_plan_versions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES commercial_plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_until TEXT,
  billing_interval TEXT NOT NULL,
  recurring_fee_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  terms_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(plan_id, version)
);

CREATE TABLE IF NOT EXISTS commercial_agreements (
  id TEXT PRIMARY KEY,
  commercial_account_id TEXT NOT NULL REFERENCES commercial_accounts(id) ON DELETE CASCADE,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  plan_version_id TEXT NOT NULL REFERENCES commercial_plan_versions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_entitlements (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  commercial_agreement_id TEXT NOT NULL REFERENCES commercial_agreements(id) ON DELETE CASCADE,
  entitlement_type TEXT NOT NULL,
  limit_val INTEGER,
  enforcement_policy TEXT NOT NULL DEFAULT 'HARD_BLOCK',
  scope TEXT,
  effective_from TEXT NOT NULL,
  effective_until TEXT,
  created_at TEXT NOT NULL
);

ALTER TABLE provider_entitlements ADD COLUMN IF NOT EXISTS enforcement_policy TEXT NOT NULL DEFAULT 'HARD_BLOCK';

CREATE TABLE IF NOT EXISTS commercial_usage_records (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  commercial_agreement_id TEXT REFERENCES commercial_agreements(id) ON DELETE SET NULL,
  entitlement_id TEXT REFERENCES provider_entitlements(id) ON DELETE SET NULL,
  usage_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  invitation_id TEXT,
  challenge_id TEXT,
  participation_id TEXT,
  consumed_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  policy_mode TEXT NOT NULL,
  is_overage BOOLEAN NOT NULL DEFAULT FALSE,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_records_org_type ON commercial_usage_records(provider_organization_id, usage_type);

CREATE TABLE IF NOT EXISTS commercial_events (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  challenge_id TEXT,
  competition_id TEXT,
  commercial_agreement_id TEXT,
  commercial_plan_version_id TEXT,
  occurred_at TEXT NOT NULL,
  metadata TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS billable_events (
  id TEXT PRIMARY KEY,
  commercial_event_id TEXT NOT NULL REFERENCES commercial_events(id) ON DELETE CASCADE,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  commercial_agreement_id TEXT NOT NULL REFERENCES commercial_agreements(id) ON DELETE CASCADE,
  charge_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  rated_at TEXT NOT NULL,
  pricing_snapshot TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE
);
`;

export const SQL_MIGRATION_V6 = `
-- CE-4: Commercial Rating Engine Tables & Indexes
ALTER TABLE billable_events ADD COLUMN IF NOT EXISTS commercial_plan_version_id TEXT;

CREATE TABLE IF NOT EXISTS rating_adjustments (
  id TEXT PRIMARY KEY,
  original_billable_event_id TEXT NOT NULL REFERENCES billable_events(id) ON DELETE RESTRICT,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  authorized_by TEXT NOT NULL,
  authorized_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rating_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  events_evaluated INTEGER NOT NULL DEFAULT 0,
  billable_events_created INTEGER NOT NULL DEFAULT 0,
  included_count INTEGER NOT NULL DEFAULT 0,
  not_rated_count INTEGER NOT NULL DEFAULT 0,
  exempt_count INTEGER NOT NULL DEFAULT 0,
  previously_rated_count INTEGER NOT NULL DEFAULT 0,
  gross_rated_cents INTEGER NOT NULL DEFAULT 0,
  adjustment_cents INTEGER NOT NULL DEFAULT 0,
  errors TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_billable_events_org ON billable_events(provider_organization_id);
CREATE INDEX IF NOT EXISTS idx_billable_events_status ON billable_events(status);
CREATE INDEX IF NOT EXISTS idx_billable_events_rated_at ON billable_events(rated_at);
CREATE INDEX IF NOT EXISTS idx_rating_adjustments_orig ON rating_adjustments(original_billable_event_id);
CREATE INDEX IF NOT EXISTS idx_rating_adjustments_org ON rating_adjustments(provider_organization_id);
`;

export const SQL_MIGRATION_V7 = `
-- CE-5: Invoicing, Billing Periods & Settlement
CREATE TABLE IF NOT EXISTS billing_periods (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  commercial_agreement_id TEXT NOT NULL REFERENCES commercial_agreements(id) ON DELETE CASCADE,
  commercial_plan_version_id TEXT NOT NULL REFERENCES commercial_plan_versions(id) ON DELETE RESTRICT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  closed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  commercial_agreement_id TEXT NOT NULL REFERENCES commercial_agreements(id) ON DELETE CASCADE,
  billing_period_id TEXT NOT NULL REFERENCES billing_periods(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_due_cents INTEGER NOT NULL DEFAULT 0,
  balance_due_cents INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT,
  due_at TEXT,
  finalized_at TEXT,
  paid_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  billable_event_id TEXT REFERENCES billable_events(id) ON DELETE RESTRICT,
  rating_adjustment_id TEXT REFERENCES rating_adjustments(id) ON DELETE RESTRICT,
  billing_period_id TEXT REFERENCES billing_periods(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  CONSTRAINT uq_invoice_line_billable_event UNIQUE (billable_event_id),
  CONSTRAINT uq_invoice_line_rating_adjustment UNIQUE (rating_adjustment_id),
  CONSTRAINT chk_invoice_line_source_exclusivity CHECK (
    (line_type = 'SUBSCRIPTION' AND billing_period_id IS NOT NULL AND billable_event_id IS NULL AND rating_adjustment_id IS NULL) OR
    ((line_type = 'USAGE_CHARGE' OR line_type = 'OUTCOME_CHARGE') AND billable_event_id IS NOT NULL AND billing_period_id IS NULL AND rating_adjustment_id IS NULL) OR
    (line_type = 'ADJUSTMENT_CREDIT' AND rating_adjustment_id IS NOT NULL AND billable_event_id IS NULL AND billing_period_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS payment_records (
  id TEXT PRIMARY KEY,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,
  external_reference TEXT,
  failure_reason TEXT,
  settled_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refund_records (
  id TEXT PRIMARY KEY,
  original_payment_record_id TEXT NOT NULL REFERENCES payment_records(id) ON DELETE RESTRICT,
  provider_organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL,
  refunded_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS settlement_allocations (
  id TEXT PRIMARY KEY,
  payment_record_id TEXT NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  refund_record_id TEXT REFERENCES refund_records(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount_allocated_cents INTEGER NOT NULL,
  allocated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_periods_org ON billing_periods(provider_organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(provider_organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_inv ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payment_records(provider_organization_id);
CREATE INDEX IF NOT EXISTS idx_refunds_orig ON refund_records(original_payment_record_id);
CREATE INDEX IF NOT EXISTS idx_settlement_invoice ON settlement_allocations(invoice_id);
`;

export const SQL_MIGRATION_V8 = `
-- Open Policy PR-0A Migration 0008: Jurisdiction framework
-- Additive only. Regulatory records are append-only or immutable once published,
-- enforced by triggers. No table name contains billing, ledger, fee or commission.

CREATE TABLE IF NOT EXISTS jurisdictions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('STATE', 'FEDERAL_DISTRICT', 'TEST_FIXTURE'))
);

CREATE TABLE IF NOT EXISTS regulatory_authorities (
  id TEXT PRIMARY KEY,
  jurisdiction_code TEXT NOT NULL REFERENCES jurisdictions(code),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  official_url TEXT
);

CREATE TABLE IF NOT EXISTS regulatory_sources (
  id TEXT PRIMARY KEY,
  jurisdiction_code TEXT NOT NULL REFERENCES jurisdictions(code),
  authority_id TEXT NOT NULL REFERENCES regulatory_authorities(id),
  source_type TEXT NOT NULL,
  citation TEXT NOT NULL,
  title TEXT NOT NULL,
  official_url TEXT,
  retrieved_at TEXT,
  content_sha256 TEXT,
  archived_copy_ref TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS jurisdiction_rule_sets (
  id TEXT PRIMARY KEY,
  jurisdiction_code TEXT NOT NULL REFERENCES jurisdictions(code),
  insurance_line TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SUPERSEDED', 'WITHDRAWN', 'DISCARDED')),
  supersedes_rule_set_id TEXT,
  authored_by TEXT NOT NULL,
  published_by TEXT,
  published_at TEXT,
  content_sha256 TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (jurisdiction_code, insurance_line, version)
);

CREATE TABLE IF NOT EXISTS jurisdiction_rules (
  id TEXT PRIMARY KEY,
  rule_set_id TEXT NOT NULL REFERENCES jurisdiction_rule_sets(id),
  rule_code TEXT NOT NULL,
  rule_category TEXT NOT NULL,
  enforcement_point TEXT NOT NULL,
  temporal_basis TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  source_ids TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_until DATE,
  verification_status TEXT NOT NULL,
  verified_at TEXT,
  verified_by TEXT,
  supersedes_rule_id TEXT,
  machine_rule TEXT,
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE IF NOT EXISTS jurisdiction_rule_set_reviews (
  id TEXT PRIMARY KEY,
  rule_set_id TEXT NOT NULL REFERENCES jurisdiction_rule_sets(id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  notes TEXT,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_activation_events (
  id TEXT PRIMARY KEY,
  jurisdiction_code TEXT NOT NULL REFERENCES jurisdictions(code),
  insurance_line TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL CHECK (to_state IN ('INACTIVE', 'PILOT', 'ACTIVE', 'SUSPENDED')),
  suspension_action TEXT,
  rule_set_id TEXT,
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  CHECK ((to_state = 'SUSPENDED') = (suspension_action IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS market_activation_gate_attestations (
  id TEXT PRIMARY KEY,
  jurisdiction_code TEXT NOT NULL REFERENCES jurisdictions(code),
  insurance_line TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  gate_code TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  attested_by TEXT NOT NULL,
  attested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_activation_gate_revocations (
  id TEXT PRIMARY KEY,
  attestation_id TEXT NOT NULL UNIQUE REFERENCES market_activation_gate_attestations(id),
  revoked_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  revoked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jurisdiction_determinations (
  id TEXT PRIMARY KEY,
  policy_id TEXT,
  challenge_id TEXT,
  basis TEXT NOT NULL,
  status TEXT NOT NULL,
  proposed_jurisdiction TEXT,
  confirmed_jurisdiction TEXT,
  consumer_confirmed_at TEXT,
  reasons TEXT NOT NULL,
  determined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jurisdiction_rule_evaluations (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  jurisdiction_code TEXT,
  enforcement_point TEXT NOT NULL,
  rule_set_id TEXT,
  rule_set_content_sha256 TEXT,
  rule_set_basis TEXT NOT NULL,
  evaluation_date TEXT,
  outcome TEXT NOT NULL,
  results TEXT NOT NULL,
  inputs_sha256 TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('SHADOW', 'ENFORCE')),
  legacy_outcome TEXT,
  discrepancy BOOLEAN NOT NULL,
  discrepancy_notes TEXT,
  evaluated_at TEXT NOT NULL
);

ALTER TABLE provider_licenses ADD COLUMN IF NOT EXISTS provider_user_id TEXT;
ALTER TABLE provider_licenses ADD COLUMN IF NOT EXISTS npn TEXT;
ALTER TABLE provider_licenses ADD COLUMN IF NOT EXISTS verification_source TEXT;
ALTER TABLE provider_licenses ADD COLUMN IF NOT EXISTS verified_at TEXT;
ALTER TABLE provider_licenses ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE carrier_relationships ADD COLUMN IF NOT EXISTS effective_from DATE;
ALTER TABLE carrier_relationships ADD COLUMN IF NOT EXISTS effective_until DATE;
ALTER TABLE carrier_relationships ADD COLUMN IF NOT EXISTS verification_source TEXT;
ALTER TABLE carrier_relationships ADD COLUMN IF NOT EXISTS verified_at TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS jurisdiction_determination_id TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS rule_set_id TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS rule_set_content_sha256 TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS regulatory_evaluation_date TEXT;

CREATE INDEX IF NOT EXISTS idx_jrs_jurisdiction_line_status ON jurisdiction_rule_sets (jurisdiction_code, insurance_line, status);
CREATE INDEX IF NOT EXISTS idx_jr_ruleset_point ON jurisdiction_rules (rule_set_id, enforcement_point);
CREATE INDEX IF NOT EXISTS idx_jr_code_from ON jurisdiction_rules (rule_code, effective_from);
CREATE INDEX IF NOT EXISTS idx_jre_subject ON jurisdiction_rule_evaluations (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_jre_discrepancy ON jurisdiction_rule_evaluations (discrepancy, enforcement_point);
CREATE INDEX IF NOT EXISTS idx_mae_market ON market_activation_events (jurisdiction_code, insurance_line, environment, recorded_at);
CREATE INDEX IF NOT EXISTS idx_maga_market ON market_activation_gate_attestations (jurisdiction_code, insurance_line, environment);
CREATE INDEX IF NOT EXISTS idx_pl_org_jurisdiction ON provider_licenses (provider_organization_id, jurisdiction);
CREATE INDEX IF NOT EXISTS idx_cr_org_jurisdiction_line ON carrier_relationships (provider_organization_id, jurisdiction, line_of_business);

-- Append-only enforcement.
CREATE OR REPLACE FUNCTION op_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Append-only regulatory record: % on % is not permitted', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_append_only_reviews ON jurisdiction_rule_set_reviews;
CREATE TRIGGER trg_append_only_reviews BEFORE UPDATE OR DELETE ON jurisdiction_rule_set_reviews
  FOR EACH ROW EXECUTE FUNCTION op_reject_mutation();
DROP TRIGGER IF EXISTS trg_append_only_activation ON market_activation_events;
CREATE TRIGGER trg_append_only_activation BEFORE UPDATE OR DELETE ON market_activation_events
  FOR EACH ROW EXECUTE FUNCTION op_reject_mutation();
DROP TRIGGER IF EXISTS trg_append_only_attestations ON market_activation_gate_attestations;
CREATE TRIGGER trg_append_only_attestations BEFORE UPDATE OR DELETE ON market_activation_gate_attestations
  FOR EACH ROW EXECUTE FUNCTION op_reject_mutation();
DROP TRIGGER IF EXISTS trg_append_only_revocations ON market_activation_gate_revocations;
CREATE TRIGGER trg_append_only_revocations BEFORE UPDATE OR DELETE ON market_activation_gate_revocations
  FOR EACH ROW EXECUTE FUNCTION op_reject_mutation();
DROP TRIGGER IF EXISTS trg_append_only_determinations ON jurisdiction_determinations;
CREATE TRIGGER trg_append_only_determinations BEFORE UPDATE OR DELETE ON jurisdiction_determinations
  FOR EACH ROW EXECUTE FUNCTION op_reject_mutation();
DROP TRIGGER IF EXISTS trg_append_only_evaluations ON jurisdiction_rule_evaluations;
CREATE TRIGGER trg_append_only_evaluations BEFORE UPDATE OR DELETE ON jurisdiction_rule_evaluations
  FOR EACH ROW EXECUTE FUNCTION op_reject_mutation();
DROP TRIGGER IF EXISTS trg_append_only_sources ON regulatory_sources;
CREATE TRIGGER trg_append_only_sources BEFORE UPDATE OR DELETE ON regulatory_sources
  FOR EACH ROW EXECUTE FUNCTION op_reject_mutation();

-- Rulesets are never deleted. Content is frozen once published; only
-- PUBLISHED -> SUPERSEDED | WITHDRAWN may follow. Unpublished work may become DISCARDED.
CREATE OR REPLACE FUNCTION op_guard_rule_set() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Ruleset % (%) can never be deleted', OLD.id, OLD.status;
  END IF;
  IF OLD.status IN ('SUPERSEDED', 'WITHDRAWN', 'DISCARDED') THEN
    RAISE EXCEPTION 'Ruleset % is % and immutable', OLD.id, OLD.status;
  END IF;
  IF OLD.status = 'PUBLISHED' THEN
    IF NEW.status NOT IN ('SUPERSEDED', 'WITHDRAWN')
       OR NEW.jurisdiction_code IS DISTINCT FROM OLD.jurisdiction_code
       OR NEW.insurance_line IS DISTINCT FROM OLD.insurance_line
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.supersedes_rule_set_id IS DISTINCT FROM OLD.supersedes_rule_set_id
       OR NEW.authored_by IS DISTINCT FROM OLD.authored_by
       OR NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Published ruleset % may only move to SUPERSEDED or WITHDRAWN', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_rule_set ON jurisdiction_rule_sets;
CREATE TRIGGER trg_guard_rule_set BEFORE UPDATE OR DELETE ON jurisdiction_rule_sets
  FOR EACH ROW EXECUTE FUNCTION op_guard_rule_set();

-- Rules: editable only while their ruleset is DRAFT; deletable while DRAFT or IN_REVIEW.
-- A substantive change to a DRAFT rule makes its verification stale (ruling §N.4B).
CREATE OR REPLACE FUNCTION op_guard_rule() RETURNS trigger AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT status INTO parent_status FROM jurisdiction_rule_sets WHERE id = OLD.rule_set_id;
  IF TG_OP = 'DELETE' THEN
    IF parent_status IS NOT NULL AND parent_status NOT IN ('DRAFT', 'IN_REVIEW') THEN
      RAISE EXCEPTION 'Rule % belongs to a % ruleset and can never be deleted', OLD.id, parent_status;
    END IF;
    RETURN OLD;
  END IF;
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Rule % belongs to a % ruleset and is immutable', OLD.id, parent_status;
  END IF;
  IF NEW.rule_code IS DISTINCT FROM OLD.rule_code
     OR NEW.rule_category IS DISTINCT FROM OLD.rule_category
     OR NEW.enforcement_point IS DISTINCT FROM OLD.enforcement_point
     OR NEW.temporal_basis IS DISTINCT FROM OLD.temporal_basis
     OR NEW.requirement_text IS DISTINCT FROM OLD.requirement_text
     OR NEW.source_ids IS DISTINCT FROM OLD.source_ids
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.effective_until IS DISTINCT FROM OLD.effective_until
     OR NEW.supersedes_rule_id IS DISTINCT FROM OLD.supersedes_rule_id
     OR NEW.machine_rule IS DISTINCT FROM OLD.machine_rule THEN
    NEW.verification_status := 'UNVERIFIED';
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_rule ON jurisdiction_rules;
CREATE TRIGGER trg_guard_rule BEFORE UPDATE OR DELETE ON jurisdiction_rules
  FOR EACH ROW EXECUTE FUNCTION op_guard_rule();

-- New rules may be added only to a DRAFT ruleset.
CREATE OR REPLACE FUNCTION op_guard_rule_insert() RETURNS trigger AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT status INTO parent_status FROM jurisdiction_rule_sets WHERE id = NEW.rule_set_id;
  IF parent_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Rules can only be added to a DRAFT ruleset (ruleset % is %)', NEW.rule_set_id, parent_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_rule_insert ON jurisdiction_rules;
CREATE TRIGGER trg_guard_rule_insert BEFORE INSERT ON jurisdiction_rules
  FOR EACH ROW EXECUTE FUNCTION op_guard_rule_insert();
`;

export const SQL_MIGRATION_V9 = `
-- Open Policy notification recipient ownership Migration 0009
CREATE TABLE IF NOT EXISTS platform_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TEXT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('CONSUMER', 'PROVIDER_USER', 'PROVIDER_ORGANIZATION', 'PLATFORM_OPERATOR')),
  recipient_consumer_id TEXT,
  recipient_provider_user_id TEXT,
  recipient_provider_organization_id TEXT,
  recipient_operator_id TEXT,
  created_from_event TEXT NOT NULL,
  action_target TEXT,
  CONSTRAINT platform_notifications_exactly_one_recipient CHECK (
    ((recipient_consumer_id IS NOT NULL)::int +
     (recipient_provider_user_id IS NOT NULL)::int +
     (recipient_provider_organization_id IS NOT NULL)::int +
     (recipient_operator_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT platform_notifications_recipient_type_matches CHECK (
    (recipient_type = 'CONSUMER' AND recipient_consumer_id IS NOT NULL) OR
    (recipient_type = 'PROVIDER_USER' AND recipient_provider_user_id IS NOT NULL) OR
    (recipient_type = 'PROVIDER_ORGANIZATION' AND recipient_provider_organization_id IS NOT NULL) OR
    (recipient_type = 'PLATFORM_OPERATOR' AND recipient_operator_id IS NOT NULL)
  )
);
`;

export async function runMigrations(dataDir = process.env.OPENPOLICY_DATA_DIR || './data/openpolicy_pg') {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = new PGlite(dataDir);
  try {
    console.log(`[Open Policy DB] Applying PostgreSQL migrations to ${dataDir}...`);
    await pglite.exec(SQL_MIGRATION_V1);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0001_pm1_canonical_marketplace') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V2);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0002_pm2_information_and_offers') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V3);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0003_pm4_selection_disclosure_binding') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V4);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0004_pm5_issued_policy_reconciliation_vault') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V5);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0005_commercial_economics_foundation') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V6);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0006_commercial_rating_engine') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V7);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0007_commercial_billing_settlement') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V8);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0008_jurisdiction_framework') ON CONFLICT (name) DO NOTHING;`
    );
    await pglite.exec(SQL_MIGRATION_V9);
    await pglite.query(
      `INSERT INTO _migrations (name) VALUES ('0009_notification_recipient_ownership') ON CONFLICT (name) DO NOTHING;`
    );
    console.log(`[Open Policy DB] Migrations 0001 through 0009 applied successfully.`);
    return pglite;
  } catch (error) {
    console.error(`[Open Policy DB] Migration error:`, error);
    throw error;
  }
}

// Allow direct execution from CLI (e.g. tsx src/server/db/migrate.ts)
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(async (pglite) => {
      console.log('[Open Policy DB] All database migrations verified and applied.');
      await pglite.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Open Policy DB] Migration failed:', err);
      process.exit(1);
    });
}
