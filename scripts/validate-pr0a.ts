/**
 * PR-0A — Jurisdiction Canonical Schema & Rule Architecture: acceptance validation
 *
 * 1. Domain suite (pure engines; fictional jurisdictions X1/X2).
 * 2. Migration 0008: tables, naming, idempotency.
 * 3. Legacy registry migrated as UNVERIFIED review candidates; frozen registry untouched.
 * 4. Ruleset lifecycle and database-enforced immutability (triggers).
 * 5. Anchored historical reconstruction across a published supersession.
 * 6. Market activation: D5 no-fallback, PRODUCTION gates, TEST_FIXTURE guard, gate revocation.
 * 7. HTTP: hard-code regressions (CA policy -> CA challenge; undetermined -> 422).
 * 8. Shadow mode (D4): evaluations recorded, discrepancies explicit, outcomes unchanged.
 * 9. Commercial neutrality: static firewall, result shape, commercial-state independence.
 * 10. No Nevada in the national core.
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../server';
import { db } from '../src/server/db';
import { postgresStore } from '../src/server/db/postgresStore';
import { jurisdictionStore } from '../src/server/db/jurisdictionStore';
import {
  SQL_MIGRATION_V1, SQL_MIGRATION_V2, SQL_MIGRATION_V3, SQL_MIGRATION_V4,
  SQL_MIGRATION_V5, SQL_MIGRATION_V6, SQL_MIGRATION_V7, SQL_MIGRATION_V8
} from '../src/server/db/migrate';
import { ensureJurisdictionFramework } from '../src/server/jurisdictionShadow';
import { runJurisdictionTestSuite, rule } from '../src/domain/jurisdiction.test';
import { evaluateRules } from '../src/domain/jurisdictionRuleEngine';
import { evaluateProviderJurisdictionAuthority } from '../src/domain/providerAuthorityEngine';
import { verifyAnchoredContent } from '../src/domain/rulesetGovernance';
import { REQUIRED_PRODUCTION_GATES } from '../src/domain/marketActivationEngine';
import { evaluateOfferQualification, JURISDICTIONAL_STATUTORY_REGISTRY } from '../src/domain/qualificationEngine';
import { commercialStore } from '../src/server/db/commercialStore';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${message}`);
  }
}

async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function request(server: http.Server, method: string, urlPath: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...(headers || {}) };
    let postData = '';
    if (body !== undefined) {
      postData = JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method, headers: reqHeaders }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode || 500, body: parsed });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('\n================================================================');
  console.log('OPEN POLICY — PR-0A JURISDICTION FRAMEWORK VALIDATION');
  console.log('================================================================');

  // ------------------------------------------------------------------
  console.log('\n--- 1. Domain suite (pure engines, fictional X1/X2) ---');
  const domain = runJurisdictionTestSuite();
  for (const r of domain.results) assert(r.passed, `[domain] ${r.name}${r.passed || !r.details ? '' : ` (${r.details})`}`);

  await ensureJurisdictionFramework();
  const client = await postgresStore.getPgClient();

  // ------------------------------------------------------------------
  console.log('\n--- 2. Migration 0008 ---');
  const migrations = (await client.query<{ name: string }>('SELECT name FROM _migrations ORDER BY id')).rows.map(r => r.name);
  assert(migrations.includes('0008_jurisdiction_framework'), 'Migration 0008 recorded');
  const newTables = Array.from(SQL_MIGRATION_V8.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g), m => m[1]);
  assert(newTables.length === 11, `Migration 0008 creates 11 tables (${newTables.join(', ')})`);
  assert(!newTables.some(t => /billing|ledger|fee|commission/.test(t)), 'No new table name contains billing, ledger, fee or commission');
  const allTables = (await client.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)).rows.map(r => r.table_name);
  const countAll = async () => {
    const counts: Record<string, number> = {};
    for (const t of allTables) counts[t] = (await client.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n;
    return counts;
  };
  const beforeCounts = await countAll();
  for (const sql of [SQL_MIGRATION_V1, SQL_MIGRATION_V2, SQL_MIGRATION_V3, SQL_MIGRATION_V4, SQL_MIGRATION_V5, SQL_MIGRATION_V6, SQL_MIGRATION_V7, SQL_MIGRATION_V8]) {
    await client.exec(sql);
  }
  const afterCounts = await countAll();
  assert(allTables.every(t => beforeCounts[t] === afterCounts[t]), 'Re-applying migrations 0001-0008 is idempotent (every table row count unchanged)');
  const jurisdictions = await jurisdictionStore.getJurisdictions();
  assert(jurisdictions.filter(j => j.kind !== 'TEST_FIXTURE').length === 51, 'Reference data: 51 jurisdictions persisted');

  // ------------------------------------------------------------------
  console.log('\n--- 3. Legacy registry migrated as unverified review candidates ---');
  for (const code of Object.keys(JURISDICTIONAL_STATUTORY_REGISTRY)) {
    const sets = await jurisdictionStore.getRuleSets(code, 'PERSONAL_AUTO');
    const rules = sets[0] ? await jurisdictionStore.getRules(sets[0].id) : [];
    assert(sets.length === 1 && sets[0].status === 'IN_REVIEW', `${code}: one legacy ruleset, IN_REVIEW (never auto-published)`);
    assert(rules.length > 0 && rules.every(r => r.verificationStatus === 'UNVERIFIED'), `${code}: all ${rules.length} legacy rules are UNVERIFIED`);
    const sources = await jurisdictionStore.getSources(code);
    assert(
      sources.length === 1 && sources[0].citation === JURISDICTIONAL_STATUTORY_REGISTRY[code].citation && !!sources[0].notes?.includes('Not retrieved'),
      `${code}: legacy citation preserved verbatim and labelled as not verified against the official source`
    );
    const market = await jurisdictionStore.getMarketStatus({ jurisdictionCode: code, insuranceLine: 'PERSONAL_AUTO', environment: 'PRODUCTION' });
    assert(market.readiness === 'RULES_IN_REVIEW' && market.state === 'INACTIVE', `${code}: PRODUCTION readiness RULES_IN_REVIEW, state INACTIVE`);
  }
  assert(JURISDICTIONAL_STATUTORY_REGISTRY.NV?.citation.includes('NRS 485.185') === true, 'Frozen legacy registry in qualificationEngine is untouched (D4)');
  await ensureJurisdictionFramework();
  assert((await jurisdictionStore.getRuleSets('NV', 'PERSONAL_AUTO')).length === 1, 'Legacy seed is idempotent');

  // ------------------------------------------------------------------
  console.log('\n--- 4. Ruleset lifecycle and database-enforced immutability ---');
  await jurisdictionStore.registerTestJurisdiction('X1', 'Test Fixture Jurisdiction One');
  await jurisdictionStore.registerTestJurisdiction('X2', 'Test Fixture Jurisdiction Two');
  await jurisdictionStore.saveAuthority({ id: 'AUTH-X1', jurisdictionCode: 'X1', name: 'X1 Test Legislature', kind: 'LEGISLATURE' });
  await jurisdictionStore.saveSource({ id: 'SRC-X1', jurisdictionCode: 'X1', authorityId: 'AUTH-X1', sourceType: 'STATUTE', citation: 'X1 Test Code 1.1', title: 'Fictional test statute' });

  const v1 = await jurisdictionStore.createRuleSet({ jurisdictionCode: 'X1', insuranceLine: 'PERSONAL_AUTO', authoredBy: 'author_a' });
  await jurisdictionStore.addRule(rule({ id: 'X1-BI-MIN-v1', ruleSetId: v1.id, ruleCode: 'X1.BI.MIN', verificationStatus: 'UNVERIFIED', verifiedBy: undefined, verifiedAt: undefined,
    machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'BODILY_INJURY', perPerson: 25000, perAccident: 50000 } }));
  await jurisdictionStore.addRule(rule({ id: 'X1-PA-v1', ruleSetId: v1.id, ruleCode: 'X1.PRODUCER', ruleCategory: 'PRODUCER_LICENSING', enforcementPoint: 'PROVIDER_AUTHORITY',
    temporalBasis: 'transactionDate', verificationStatus: 'UNVERIFIED', verifiedBy: undefined, verifiedAt: undefined,
    machineRule: { kind: 'PRODUCER_AUTHORITY', acceptedLicenseClasses: ['PROPERTY_CASUALTY'], entityLicenseRequired: true, individualLicenseRequired: false, appointmentRequired: false } }));
  await jurisdictionStore.submitForReview(v1.id, 'author_a');
  assert(await rejects(() => jurisdictionStore.publish(v1.id, 'publisher_c', new Date().toISOString())), 'Publication rejected while rules are UNVERIFIED');
  assert(await rejects(() => client.query(`UPDATE jurisdiction_rules SET verification_status = 'VERIFIED' WHERE id = 'X1-BI-MIN-v1'`)), 'DB trigger: rules of an IN_REVIEW ruleset are immutable');
  // Verification happens in DRAFT. DISCARDED is reachable only from DRAFT (ruling §N.4A).
  assert(await rejects(() => jurisdictionStore.discard(v1.id, 'author_a', 'x')), 'An IN_REVIEW ruleset cannot be discarded directly');
  await jurisdictionStore.returnToDraft(v1.id, 'reviewer_b', 'Rules must be verified before review');
  await jurisdictionStore.discard(v1.id, 'author_a', 'Abandoned: rules must be verified before review');
  const discarded = await jurisdictionStore.getRuleSet(v1.id);
  assert(discarded?.status === 'DISCARDED' && (await jurisdictionStore.getRules(v1.id)).length === 0, 'Unpublished ruleset discarded: status DISCARDED, its rules removed');
  const v1Reviews = (await jurisdictionStore.getReviews(v1.id)).map(r => r.action);
  assert(v1Reviews.includes('RETURNED_TO_DRAFT') && v1Reviews.includes('DISCARDED'), 'Return-to-draft and discard are recorded in the append-only review history');
  assert(await rejects(() => client.query(`UPDATE jurisdiction_rule_sets SET status = 'DRAFT' WHERE id = $1`, [v1.id])), 'DB trigger: DISCARDED is terminal');
  assert(await rejects(() => jurisdictionStore.submitForReview(v1.id, 'author_a')) && await rejects(() => jurisdictionStore.publish(v1.id, 'publisher_c', new Date().toISOString())),
    'A discarded ruleset can never be reviewed or published');

  const setA = await jurisdictionStore.createRuleSet({ jurisdictionCode: 'X1', insuranceLine: 'PERSONAL_AUTO', authoredBy: 'author_a' });
  await jurisdictionStore.addRule(rule({ id: 'X1-BI-MIN-A', ruleSetId: setA.id, ruleCode: 'X1.BI.MIN', verificationStatus: 'UNVERIFIED', verifiedBy: undefined, verifiedAt: undefined,
    machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'BODILY_INJURY', perPerson: 25000, perAccident: 50000 } }));
  await jurisdictionStore.addRule(rule({ id: 'X1-PA-A', ruleSetId: setA.id, ruleCode: 'X1.PRODUCER', ruleCategory: 'PRODUCER_LICENSING', enforcementPoint: 'PROVIDER_AUTHORITY',
    temporalBasis: 'transactionDate', verificationStatus: 'UNVERIFIED', verifiedBy: undefined, verifiedAt: undefined,
    machineRule: { kind: 'PRODUCER_AUTHORITY', acceptedLicenseClasses: ['PROPERTY_CASUALTY'], entityLicenseRequired: true, individualLicenseRequired: false, appointmentRequired: false } }));
  await jurisdictionStore.verifyRule('X1-BI-MIN-A', 'verifier_b', '2026-01-02T00:00:00Z');
  // Ruling §N.4B: a substantive change after verification makes the verification stale.
  await client.query(`UPDATE jurisdiction_rules SET requirement_text = 'Edited after verification' WHERE id = 'X1-BI-MIN-A'`);
  const staled = (await jurisdictionStore.getRules(setA.id)).find(r => r.id === 'X1-BI-MIN-A');
  assert(staled?.verificationStatus === 'UNVERIFIED' && !staled.verifiedBy, 'DB trigger: editing a verified DRAFT rule resets it to UNVERIFIED');
  await jurisdictionStore.verifyRule('X1-BI-MIN-A', 'verifier_b', '2026-01-02T00:00:00Z');
  await jurisdictionStore.verifyRule('X1-PA-A', 'verifier_b', '2026-01-02T00:00:00Z');
  await jurisdictionStore.submitForReview(setA.id, 'author_a');
  assert(await rejects(() => jurisdictionStore.publish(setA.id, 'author_a', new Date().toISOString())), 'Four-eyes: the author cannot publish');
  const publishedA = await jurisdictionStore.publish(setA.id, 'publisher_c', '2026-01-03T00:00:00Z');
  assert(publishedA.status === 'PUBLISHED' && publishedA.contentSha256?.length === 64, 'Ruleset published by a second person with a content hash');

  assert(await rejects(() => client.query(`UPDATE jurisdiction_rules SET requirement_text = 'rewritten' WHERE id = 'X1-BI-MIN-A'`)), 'DB trigger: a published rule cannot be rewritten');
  assert(await rejects(() => client.query(`DELETE FROM jurisdiction_rules WHERE id = 'X1-BI-MIN-A'`)), 'DB trigger: a published rule cannot be deleted');
  assert(await rejects(() => client.query(`UPDATE jurisdiction_rule_sets SET content_sha256 = 'tampered' WHERE id = $1`, [setA.id])), 'DB trigger: published ruleset content cannot change');
  assert(await rejects(() => client.query(`DELETE FROM jurisdiction_rule_sets WHERE id = $1`, [setA.id])), 'DB trigger: a ruleset can never be deleted');
  assert(await rejects(() => jurisdictionStore.addRule(rule({ id: 'X1-LATE', ruleSetId: setA.id, machineRule: null }))), 'Store: no rule can be added to a published ruleset');
  assert(await rejects(() => client.query(
    `INSERT INTO jurisdiction_rules (id, rule_set_id, rule_code, rule_category, enforcement_point, temporal_basis, requirement_text, source_ids, effective_from, verification_status)
     VALUES ('X1-SNEAK', $1, 'S', 'MINIMUM_LIABILITY', 'OFFER_QUALIFICATION', 'policyEffectiveDate', 's', '[]', '2026-01-01', 'VERIFIED')`, [setA.id])),
    'DB trigger: a direct SQL insert into a published ruleset is rejected');

  // ------------------------------------------------------------------
  console.log('\n--- 5. Anchored historical reconstruction across supersession ---');
  const rulesA = await jurisdictionStore.getRules(setA.id);
  const offerCtx = { dates: { policyEffectiveDate: '2026-07-01' }, coverages: [{ code: 'BODILY_INJURY', isIncluded: true, perPersonLimit: 30000, perAccidentLimit: 60000 }] };
  const anchoredOutcome = evaluateRules(rulesA, 'OFFER_QUALIFICATION', offerCtx);

  const setB = await jurisdictionStore.createRuleSet({ jurisdictionCode: 'X1', insuranceLine: 'PERSONAL_AUTO', authoredBy: 'author_a' });
  await jurisdictionStore.addRule(rule({ id: 'X1-BI-MIN-B', ruleSetId: setB.id, ruleCode: 'X1.BI.MIN', verificationStatus: 'UNVERIFIED', verifiedBy: undefined, verifiedAt: undefined,
    supersedesRuleId: 'X1-BI-MIN-A', machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'BODILY_INJURY', perPerson: 50000, perAccident: 100000 } }));
  await jurisdictionStore.addRule(rule({ id: 'X1-PA-B', ruleSetId: setB.id, ruleCode: 'X1.PRODUCER', ruleCategory: 'PRODUCER_LICENSING', enforcementPoint: 'PROVIDER_AUTHORITY',
    temporalBasis: 'transactionDate', verificationStatus: 'UNVERIFIED', verifiedBy: undefined, verifiedAt: undefined,
    machineRule: { kind: 'PRODUCER_AUTHORITY', acceptedLicenseClasses: ['PROPERTY_CASUALTY'], entityLicenseRequired: true, individualLicenseRequired: false, appointmentRequired: false } }));
  await jurisdictionStore.verifyRule('X1-BI-MIN-B', 'verifier_b', '2026-02-02T00:00:00Z');
  await jurisdictionStore.verifyRule('X1-PA-B', 'verifier_b', '2026-02-02T00:00:00Z');
  await jurisdictionStore.submitForReview(setB.id, 'author_a');
  const publishedB = await jurisdictionStore.publish(setB.id, 'publisher_c', '2026-02-03T00:00:00Z');
  const supersededA = await jurisdictionStore.getRuleSet(setA.id);
  assert(supersededA?.status === 'SUPERSEDED' && publishedB.supersedesRuleSetId === setA.id, 'Publishing v2 supersedes v1; v2 records the supersession');

  const reloadedA = await jurisdictionStore.getRules(setA.id);
  const replayed = evaluateRules(reloadedA, 'OFFER_QUALIFICATION', offerCtx);
  assert(JSON.stringify(replayed) === JSON.stringify(anchoredOutcome) && replayed.outcome === 'PASS', 'A transaction anchored to v1 re-evaluates identically after v2 is published (PASS)');
  assert(verifyAnchoredContent(supersededA!, reloadedA, publishedA.contentSha256!), 'v1 content hash still verifies after supersession');
  assert(evaluateRules(await jurisdictionStore.getRules(setB.id), 'OFFER_QUALIFICATION', offerCtx).outcome === 'FAIL', 'The same offer FAILS under v2: new rules never apply retroactively to v1 anchors');
  assert((await jurisdictionStore.resolveEvaluationRuleSet('X1', 'PERSONAL_AUTO')).ruleSet?.id === setB.id, 'New evaluations resolve to the latest PUBLISHED ruleset');

  // ------------------------------------------------------------------
  console.log('\n--- 6. Market activation (D5, D7, D9) ---');
  const x1Prod = { jurisdictionCode: 'X1', insuranceLine: 'PERSONAL_AUTO' as const, environment: 'PRODUCTION' as const };
  const x1Sandbox = { ...x1Prod, environment: 'SANDBOX' as const };
  assert((await jurisdictionStore.getMarketStatus(x1Prod)).readiness === 'RULES_VERIFIED', 'X1 readiness derives to RULES_VERIFIED from a published, fully verified ruleset');
  assert((await jurisdictionStore.getMarketStatus(x1Prod)).displayStatus === 'PROVIDERS_REQUIRED', 'Display status projects PROVIDERS_REQUIRED (no provider gate yet)');
  for (const gate of REQUIRED_PRODUCTION_GATES) await jurisdictionStore.attestGate(x1Prod, gate, `evidence:${gate}`, 'ops_d');
  assert(await rejects(() => jurisdictionStore.transitionMarket({ key: x1Prod, to: 'PILOT', actorId: 'ops_d', reason: 'test' })), 'A TEST_FIXTURE jurisdiction cannot be activated in PRODUCTION even with every gate');
  const sandboxEvent = await jurisdictionStore.transitionMarket({ key: x1Sandbox, to: 'ACTIVE', actorId: 'ops_d', reason: 'fixture' });
  assert(sandboxEvent.toState === 'ACTIVE', 'SANDBOX activation recorded');
  assert((await jurisdictionStore.getMarketStatus(x1Prod)).state === 'INACTIVE', 'D5: SANDBOX ACTIVE never makes PRODUCTION active');
  const suspension = await jurisdictionStore.transitionMarket({ key: x1Sandbox, to: 'SUSPENDED', actorId: 'ops_d', reason: 'incident' });
  assert(suspension.suspensionAction === 'REQUIRE_MANUAL_REVIEW', 'D9: suspension recorded with default REQUIRE_MANUAL_REVIEW');
  const gates = await jurisdictionStore.getGateAttestations(x1Prod);
  await jurisdictionStore.revokeGate(gates[0].id, 'ops_d', 'evidence expired');
  const afterRevoke = await jurisdictionStore.getMarketStatus(x1Prod);
  assert(!afterRevoke.gates.includes(gates[0].gateCode) && afterRevoke.state === 'INACTIVE', 'Gate revocation is recorded and never changes activation state by itself');
  assert(await rejects(() => jurisdictionStore.transitionMarket({ key: { ...x1Prod, jurisdictionCode: 'NV' }, to: 'PILOT', actorId: 'ops_d', reason: 'x' })),
    'NV PRODUCTION activation rejected: rules unverified and gates missing');
  assert(await rejects(() => client.query(`DELETE FROM market_activation_events`)), 'DB trigger: activation history is append-only');
  assert(await rejects(() => client.query(`UPDATE market_activation_gate_attestations SET evidence_ref = 'x'`)), 'DB trigger: gate attestations are append-only');

  // ------------------------------------------------------------------
  console.log('\n--- 7. HTTP: jurisdiction hard-code regressions ---');
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    const caDoc = await request(server, 'POST', '/api/documents/upload-sample', { sampleId: 'DOC-CA-88392' });
    const caBaseline = await request(server, 'POST', '/api/baselines/create', { policyId: caDoc.body.policy.id });
    assert(caBaseline.body.baseline?.jurisdiction === 'CA', 'Baseline keeps the policy jurisdiction (was dropped)');
    const caChallenge = await request(server, 'POST', '/api/challenges/create', { baselineId: caBaseline.body.baseline.id });
    assert(caChallenge.status === 200 && caChallenge.body.challenge.jurisdiction === 'CA', 'A CA policy produces a CA challenge (was hard-coded NV)');
    assert(String(caChallenge.body.challenge.referenceNumber).startsWith('CHALLENGE #CA-'), 'Challenge reference carries the determined jurisdiction');
    assert(!!caChallenge.body.challenge.jurisdictionDeterminationId && !!caChallenge.body.challenge.ruleSetContentSha256, 'Challenge anchors its determination and ruleset content hash');

    const nvDoc = await request(server, 'POST', '/api/documents/upload-sample', { sampleId: 'DOC-NV-49281' });
    const conflictDoc = await request(server, 'POST', '/api/documents/upload-sample', { sampleId: 'DOC-NV-49281' });
    const conflictBaseline = await request(server, 'POST', '/api/baselines/create', { policyId: conflictDoc.body.policy.id });
    await request(server, 'POST', `/api/policies/${conflictDoc.body.policy.id}/verify`, { ...conflictDoc.body.policy, jurisdiction: 'CA' });
    const conflict = await request(server, 'POST', '/api/challenges/create', { baselineId: conflictBaseline.body.baseline.id });
    assert(conflict.status === 422 && conflict.body.code === 'JURISDICTION_CONFLICT', 'Conflicting evidence (policy CA, baseline NV) -> 422 JURISDICTION_CONFLICT');

    const nvBaseline = await request(server, 'POST', '/api/baselines/create', { policyId: nvDoc.body.policy.id });
    const nvChallenge = await request(server, 'POST', '/api/challenges/create', { baselineId: nvBaseline.body.baseline.id });
    assert(nvChallenge.body.challenge?.jurisdiction === 'NV', 'An NV policy still produces an NV challenge');
    const blankDoc = await request(server, 'POST', '/api/documents/upload-sample', { sampleId: 'DOC-NV-49281' });
    assert(blankDoc.body.policy.id !== nvDoc.body.policy.id, 'Separate policy for the undetermined case');
    const blank = { ...blankDoc.body.policy, jurisdiction: '' };
    await request(server, 'POST', `/api/policies/${blank.id}/verify`, blank);
    const blankBaseline = await request(server, 'POST', '/api/baselines/create', { policyId: blank.id });
    const undetermined = await request(server, 'POST', '/api/challenges/create', { baselineId: blankBaseline.body.baseline.id });
    assert(undetermined.status === 422 && undetermined.body.code === 'JURISDICTION_UNDETERMINED', 'No jurisdiction evidence -> 422 JURISDICTION_UNDETERMINED, never a Nevada default');


    const prodMarket = await request(server, 'GET', '/api/jurisdictions/NV/market?environment=PRODUCTION');
    const sandboxMarket = await request(server, 'GET', '/api/jurisdictions/NV/market?environment=SANDBOX');
    assert(prodMarket.body.state === 'INACTIVE' && sandboxMarket.body.state === 'ACTIVE', 'HTTP: NV is ACTIVE in SANDBOX and INACTIVE in PRODUCTION');
    const listing = await request(server, 'GET', '/api/jurisdictions');
    assert(listing.status === 200 && listing.body.environment === 'SANDBOX', 'HTTP: market environment defaults to SANDBOX');

    // ------------------------------------------------------------------
    console.log('\n--- 8. Shadow mode (D4) ---');
    const nvChallengeId = nvChallenge.body.challenge.id;
    const openEval = await request(server, 'GET', `/api/jurisdiction-evaluations?subjectType=CHALLENGE&subjectId=${nvChallengeId}`);
    const open = openEval.body.evaluations[0];
    assert(open?.enforcementPoint === 'CHALLENGE_OPEN' && open.mode === 'SHADOW' && open.outcome === 'PASS', 'Challenge opening evaluated in SHADOW mode (SANDBOX NV active -> PASS)');
    assert(open?.ruleSetBasis === 'UNPUBLISHED_CANDIDATE', 'Evaluation labels its basis: the legacy ruleset is an unpublished candidate');

    const invitations = db.getInvitationsForChallenge(nvChallengeId);
    const authEvals = (await jurisdictionStore.getEvaluations({ subjectType: 'INVITATION' })).filter(e => invitations.some(i => i.id === e.subjectId));
    assert(invitations.length > 0 && authEvals.length === invitations.length, `Provider authority evaluated for each of ${invitations.length} invitations`);
    assert(authEvals.every(e => e.outcome === 'INDETERMINATE' && e.legacyOutcome === 'ELIGIBLE' && e.discrepancy),
      'No producer-authority rule exists for NV: INDETERMINATE vs frozen ELIGIBLE, recorded as discrepancies (not forced to agree)');

    const lowLimitOffer = {
      challengeId: nvChallengeId,
      carrier: 'Travelers',
      quoteNumber: 'Q-PR0A-LOW',
      annualPremium: 1500,
      monthlyPremium: 125,
      termMonths: 12,
      effectiveDate: '2026-11-18',
      expirationDate: '2027-11-18',
      supportingQuoteDocName: 'Travelers_Quote_PR0A.pdf',
      discrepanciesDetected: false,
      coverages: [
        { id: 'L1', code: 'BODILY_INJURY', name: 'Bodily Injury', category: 'LIABILITY', perPersonLimit: 10000, perAccidentLimit: 20000, isIncluded: true },
        { id: 'L2', code: 'PROPERTY_DAMAGE', name: 'Property Damage', category: 'LIABILITY', propertyLimit: 5000, isIncluded: true }
      ]
    };
    const submitted = await request(server, 'POST', '/api/offers/submit', lowLimitOffer, { 'x-provider-user-id': 'user_sierra_1' });
    const offer = submitted.body.offer;
    const challengeNow = db.getChallenge(nvChallengeId)!;
    const independentLegacy = evaluateOfferQualification(offer, challengeNow.baseline, challengeNow.requirements, db.getProviderOrganization(offer.providerId),
      db.getCarrierRelationships(offer.providerId));
    assert(offer.isQualified === independentLegacy.isQualified, `offer.isQualified is exactly the frozen engine's result (${offer.isQualified}); shadow changed nothing`);
    const offerEval = (await jurisdictionStore.getEvaluations({ subjectType: 'OFFER', subjectId: offer.id }))[0];
    assert(offerEval?.outcome === 'FAIL' && offerEval.legacyOutcome === 'STATUTORY_PASS' && offerEval.discrepancy,
      'Shadow records the discrepancy: 10/20/5 limits FAIL the (unverified) minimums the frozen engine never checks');
    assert(offerEval?.results.some((r: any) => r.verificationStatus === 'UNVERIFIED'), 'Each shadow result carries the rule verification status (UNVERIFIED)');
    assert(!(offer.qualificationReasons || []).concat(offer.disqualificationReasons || []).some((r: string) => /shadow|jurisdiction engine/i.test(r)),
      'No shadow output leaks into frozen qualification reasons');

    const apexInvitation = invitations.find(i => i.providerOrganizationId === 'org_apex');
    if (apexInvitation) {
      await request(server, 'POST', `/api/marketplace/invitations/${apexInvitation.id}/accept`, {}, { 'x-provider-user-id': 'user_apex_1' });
      const acceptance = (await jurisdictionStore.getEvaluations({ subjectType: 'INVITATION', subjectId: apexInvitation.id }))
        .find(e => e.results.some((r: any) => r.ruleCode === 'PROVIDER_AUTHORITY.ACCEPTANCE'));
      assert(!!acceptance, 'Ordering invariant: provider authority is evaluated at acceptance (before CE-2 capacity consumption)');
    } else {
      assert(false, 'Expected org_apex to be invited to the NV challenge');
    }
    assert(await rejects(() => client.query(`UPDATE jurisdiction_rule_evaluations SET outcome = 'PASS'`)), 'DB trigger: shadow evaluations are append-only');
  } finally {
    server.close();
  }

  // ------------------------------------------------------------------
  console.log('\n--- 9. Commercial neutrality ---');
  const protectedFiles = [
    'src/domain/comparisonEngine.ts', 'src/domain/qualificationEngine.ts', 'src/domain/competitionEngine.ts',
    'src/domain/selectionBindingEngine.ts', 'src/domain/pm5ReconciliationEngine.ts', 'src/domain/eligibilityEngine.ts',
    'src/domain/jurisdictionRuleEngine.ts', 'src/domain/providerAuthorityEngine.ts', 'src/domain/marketActivationEngine.ts',
    'src/domain/jurisdictionDetermination.ts', 'src/domain/rulesetGovernance.ts', 'src/server/db/jurisdictionStore.ts',
    'src/server/jurisdictionShadow.ts', 'src/server/db/seeds/legacyJurisdictionSeed.ts'
  ];
  const forbidden = [
    'commercialEconomicsEngine', 'commercialStore', 'commercial_accounts', 'commercial_plans', 'commercial_agreements',
    'commercial_usage_records', 'billable_events', 'commercial_events', 'provider_entitlements', 'commercial_plan_versions',
    'billing_periods', 'invoice_line_items', 'payment_records', 'refund_records', 'settlement_allocations',
    'CommercialAgreement', 'ProviderEntitlement', 'BillableEvent', 'rateCommercialEvent', 'checkEntitlementCapacity', 'JURISDICTION_CAPACITY'
  ];
  for (const file of protectedFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    const hits = forbidden.filter(token => content.includes(token));
    assert(hits.length === 0, `Firewall: ${file} references no commercial structure${hits.length ? ` (found: ${hits.join(', ')})` : ''}`);
  }

  const sierra = db.getProviderOrganization('org_sierra')!;
  const authorityInput = {
    org: sierra, licenses: db.getProviderLicenses('org_sierra'), carrierRelationships: db.getCarrierRelationships('org_sierra'),
    rules: await jurisdictionStore.getRules(setB.id), jurisdictionCode: 'NV', insuranceLine: 'PERSONAL_AUTO' as const, evaluationDate: '2026-07-01'
  };
  const beforeCommercial = JSON.stringify(evaluateProviderJurisdictionAuthority(authorityInput));
  await commercialStore.seedCanonicalPlans();
  const plan = await commercialStore.getCommercialPlanByCode('PLAN_AGENCY');
  assert(!!plan, 'Commercial fixture available for the independence check');
  const server2 = http.createServer(app);
  await new Promise<void>(resolve => server2.listen(0, resolve));
  try {
    await request(server2, 'POST', '/api/commercial/agreements/enroll', { planCode: 'PLAN_AGENCY', enforcementPolicy: 'ALLOW_OVERAGE', customTerms: { includedJurisdictions: 50 } },
      { 'x-provider-user-id': 'user_sierra_1' });
  } finally {
    server2.close();
  }
  const afterCommercial = JSON.stringify(evaluateProviderJurisdictionAuthority(authorityInput));
  assert(beforeCommercial === afterCommercial, 'Provider authority is identical before and after the provider buys commercial jurisdiction capacity');

  // ------------------------------------------------------------------
  console.log('\n--- 10. No Nevada in the national core ---');
  const coreFiles = protectedFiles.slice(6).concat(['src/domain/jurisdiction/canonical.ts']);
  for (const file of coreFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert(!/\|\|\s*['"]NV['"]/.test(content) && !/['"]NV['"]/.test(content), `${file} contains no Nevada literal or default`);
  }
  // Reference lists of all 51 codes legitimately contain 'NV'; they must still never default to it.
  for (const file of ['src/types/jurisdiction.ts', 'src/domain/jurisdiction/usJurisdictions.ts']) {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert(!/\|\|\s*['"]NV['"]/.test(content) && !/\?\?\s*['"]NV['"]/.test(content), `${file} (reference codes) never defaults to Nevada`);
  }
  const eligibilitySource = fs.readFileSync(path.join(process.cwd(), 'src/domain/eligibilityEngine.ts'), 'utf8');
  const pm5Source = fs.readFileSync(path.join(process.cwd(), 'src/domain/pm5ReconciliationEngine.ts'), 'utf8');
  assert(!/\|\|\s*['"]NV['"]/.test(eligibilitySource + pm5Source), 'No `|| \'NV\'` default remains in eligibility or PM-5 (D6 holds)');

  console.log('\n============================================================');
  console.log(`PR-0A VALIDATION SUMMARY: ${passed} / ${passed + failed} PASSED`);
  console.log('============================================================\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('[PR-0A Validation FAILED]', err);
  process.exit(1);
});
