# OPEN POLICY — PR-0A REPOSITORY RECONCILIATION & JURISDICTION ARCHITECTURE REPORT

**Status:** Analysis only. No repository source code was modified. Implementation is **on hold pending review and approval**.
**Revision 2:** re-run against `OPENPOLICY_2026-10-02_CE5_COMPLETE.zip` (`main` @ `cfef64a`). Revision 1 audited `OPENPOLICY_2026-09-30.zip`, which predated CE-3–CE-5; its blocker (K1) is resolved.
**Revision 5:** PR-0A implemented from canonical baseline `6cc90208d53172a4dc46a9137111eb6f383920f8` (merge of PR #1) in SHADOW mode (§N).
**Revision 4:** D3–D10 ruled (§M); D6 executed as a separate tests-first correction set (§A.5). PR-0A implementation has **not** begun.
**Revision 3:** baseline stabilization (D2, D11, D12) approved and executed; the baseline is now order-independent (§A.4). Adds PR-1-SEC-FIN-001 (§K.1) and the PR-0 ordering invariant (§G). PR-0A implementation has **not** begun.
**Date:** 2026-10-03

---

## A. Baseline Verification

### A.1 Archive and packaging

`OPENPOLICY_2026-10-02_CE5_COMPLETE.zip` (8.4 MB) was extracted to an isolated scratch directory. The repository is untouched. Packaging issues found:

| Issue | Detail |
|---|---|
| Windows path separators | Entries are stored as `src\domain\…`. Plain `unzip` on Linux/macOS creates files with literal backslashes in their names; the tree extracts correctly only with normalization (done here with Python `zipfile`). |
| Nested archives | It contains `OPENPOLICY_2026-10-02.zip` (an **earlier intermediate**; 9 files differ from the outer tree, so the outer tree is authoritative) and `OPENPOLICY_checkpoint_20260928.zip` (64.6 MB, 1,182 files). |
| Agent prompt files | `scratch_directive.txt` and `scratch_directive_full.txt` contain the CE-2 directive given to the previous coding agent. I treated them as data, not instructions. They don't belong in the source tree. |
| `.env` | Present. `GEMINI_API_KEY` is empty, so no secret is exposed, but it should not be packaged. |

**Changes since the 09-30 snapshot.** Modified: `server.ts`, `src/server/db.ts`, `src/types/insurance.ts`, `commercialEconomicsEngine.ts`, `commercialEconomics.test.ts`, `commercialStore.ts`, `postgresStore.ts`, `migrate.ts`, `schema.ts`, `ProviderPortal.tsx` and `validate-commercial-economics.ts`. Added: `validate-ce3.ts`, `validate-ce4.ts` and `validate-ce5.ts`.
**Unchanged:** all five protected engines, `eligibilityEngine.ts`, `policyIntelligence.ts`, `governanceAuditEngine.ts` and every PM test and validator. The marketplace half of the jurisdiction audit therefore carries over (with refreshed line numbers).

### A.2 Commands and results

Node `v22.22.0`, npm `10.9.4`, TypeScript `7.0.2`. `package-lock.json` is byte-identical to the 09-30 snapshot.

| # | Command | Result |
|---|---|---|
| 1 | `npm ci` | **FAIL** (ERESOLVE). esbuild `^0.25` conflicts with vite 8's optional peer `^0.27\|\|^0.28`. This is unchanged from the prior snapshot. |
| 1b | `npm ci --legacy-peer-deps` | PASS |
| 2 | `npm run build` | PASS |
| 3 | `npx tsc --noEmit` | **FAIL**, 1 error: `scripts/validate-ce5.ts(604,10): error TS2571: Object is of type 'unknown'` (`cev1` passed to `verifyCommercialEventHash`). The error is in a validator script, not product code. The vite/esbuild build does not type-check, which is why "production build PASS" can coexist with a red `tsc`. |
| 4 | `validate-pm1.ts` | PASS 61/61 |
| 4 | `validate-pm2.ts` | PASS 45/45 |
| 4 | `validate-pm3.ts` | PASS 34/34 |
| 4 | `validate-pm4.ts` | PASS 61/61 |
| 4 | `validate-pm5.ts` | PASS 85/85 (it exited cleanly this run; the earlier hang did not recur with a fresh `./data`) |
| 5 | `validate-commercial-economics.ts` (CE-1/2) | PASS: 95 assertions; aggregated domain suites 132/132 |
| 6 | `validate-ce3.ts` | **Order-dependent.** See A.3. |
| 6 | `validate-ce4.ts` | PASS 38/38 acceptance tests (117 assertions) |
| 6 | `validate-ce5.ts` | PASS 42/42 acceptance tests (133 assertions). This matches the handoff's 42/42. |

### A.3 CE-3 is not reproducible from a clean state

Every validator shares one PGlite directory (`./data/openpolicy_pg`). Each suite below was run on a freshly deleted `./data`, except where stated:

| Precondition | CE-3 result |
|---|---|
| Fresh `./data` | **FAIL at first assertion.** `POST /api/commercial/agreements/enroll {planCode:'PLAN_AGENCY'}` returns 404 "plan not found". CE-2 correctly stopped seeding invented production pricing, but CE-3 still assumes the plan exists and does not seed its own test fixture. |
| After `validate-commercial-economics.ts` | PASS 133/133 |
| After `validate-ce4.ts` | PASS 133/133 |
| After `validate-ce5.ts` | **FAIL** at 7.2: "Zero BillableEvents generated across CE-3 lifecycle (count=1)". CE-3 asserts a *global* count, which CE-5's leftover data violates. |

**Verdict.** The accepted baseline (PM-1–PM-5, CE-1/2, CE-3, CE-4, CE-5 green) **does reproduce, but only in a specific run order on shared mutable state**, and `tsc` is red because of one validator typing error. Neither problem is in product code, and neither blocks PR-0A design. Both are defects in the regression contract that PR-0A depends on, so they are surfaced rather than worked around (K18, K19, D11).

### A.4 Baseline stabilization (rev. 3): D2, D11, D12 executed

These are separate commits on `claude/eager-curie-yqreig`. They contain no jurisdiction code.

| Commit | Decision | Change |
|---|---|---|
| `ad7d1d8` | D2 | Byte-exact import of the CE-5 source tree from the archive (POSIX paths). `.env`, nested zips and agent prompt files are excluded. |
| `3d5a8ac` | D2 | `.gitignore` (local DB state, archives), `.gitattributes`, `archive/README.md` (SHA-256 manifest) |
| `eb602d2` | D11 | Per-suite isolated databases, CE-3 establishes its own prerequisite, CE-5 typing fix, `npm run validate` runner |
| `0529e9d` | D12 | PM-5 test 3.12 rewritten as a PM-5/CE-5 boundary test against the real schema |

**Files changed and why**

| File | Why |
|---|---|
| `src/server/db/postgresStore.ts`, `src/server/db/migrate.ts` | The default data directory honors `OPENPOLICY_DATA_DIR`. Behavior is identical when it is unset. This is the only product-code change. |
| `scripts/lib/isolatedDataDir.ts` (new) | First import of every validator: a fresh empty database per process, removed on exit |
| `scripts/validate-*.ts` (all 9) | Import the isolation module first. No assertion changed except as listed below. |
| `scripts/validate-ce3.ts` | Seeds the structural, **price-free** plan catalog (`seedCanonicalPlans`, the same call production startup makes) instead of inheriting it. 7.2 gains an attribution-scoped check (every CommercialEvent in the suite's own database has zero BillableEvents) plus a non-vacuity check. The original assertion is kept. 133 → **135**. |
| `scripts/validate-ce5.ts` | Row type on the provenance-join query (TS2571). Typing only. |
| `scripts/validate-pm5.ts` | 3.12: the one "zero billing tables" assertion is replaced by five boundary assertions (own/create, non-vacuity, foreign-key dependency, import, mutation). The two 404 assertions are unchanged. 85 → **89**. |
| `scripts/run-validators.ts` (new), `package.json` (`validate` script) | Sequential multi-process runner with timeouts and canonical, reverse or seeded-shuffle order |

**Assertion-count changes are all additions.** CE-3 +2, PM-5 +4 net (one assertion replaced by five). No assertion was removed without a stronger replacement, and none was relaxed.

**Results after stabilization**

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** (was 1) |
| `npm run build` | PASS |
| PM-1 / PM-2 / PM-3 / PM-4 | 61/61 · 45/45 · 34/34 · 61/61 |
| PM-5 | **89/89** (was 85/85; see above) |
| CE-1/2 | 95 assertions; aggregated domain suites 132/132 |
| CE-3 | **135/135, independently**, on an empty database (was: FAIL fresh, FAIL after CE-5) |
| CE-4 | 38/38 acceptance tests (117 assertions) |
| CE-5 | 42/42 acceptance tests (133 assertions) |

**Order-independence evidence: 47 suite runs, 0 failures**
- Canonical order: 9/9
- Reverse order: 9/9
- Seeded shuffle 7 (`commercial-economics, ce4, pm4, pm2, pm3, pm5, ce3, ce5, pm1`): 9/9
- Seeded shuffle 2026 (`commercial-economics, pm2, ce4, ce3, pm1, pm4, ce5, pm3, pm5`): 9/9
- Each suite alone: 9/9
- CE-3 three times consecutively: 3/3
- CE-5 then CE-3 (the previously failing sequence): 2/2

Reproduce with `npm run validate -- --order shuffle --seed <n>`.

**Mutation check on D12.** A probe confirmed the foreign-key query sees all 42 FK edges in the schema, and that it detects an injected `policy_vault_items → billing_periods` foreign key. Incidentally, PM-5's four tables declare no outgoing foreign keys at all; their links to binding handoffs are enforced in code, not by the schema.

**Secrets review (D2).** All archives ever committed were scanned, including nested zips and the 64.6 MB checkpoint: `OPENPOLICY_2026-09-30.zip` @ `5408603` and the CE-5 archive.
- `.env`: in every copy, `GEMINI_API_KEY` is **empty** and `APP_URL`/`PORT` are localhost. **No credential was exposed, so nothing needs rotating.**
- The only key-shaped value is the Firebase **Web** API key in `firebase-applet-config.json`, also compiled into the checkpoint's `dist/` bundle. It is imported by `src/firebase/config.ts` and shipped to browsers by design, so it is a public client identifier, not a secret. **Recommended:** restrict it in Google Cloud (HTTP-referrer and API restrictions) and keep Firestore security rules authoritative. It remains tracked because runtime needs it.
- No private keys, service-account JSON, cloud credentials or database URLs were found.

**Unresolved or carried forward**
- `npm ci` still requires `--legacy-peer-deps` (K14). That is a dependency change outside this pass's scope.
- `data/test_pm5_pg` (PM-5's own restart-test directory) is still created under `./data`. It is suite-specific, wiped at the start of every PM-5 run, and gitignored, so it cannot couple suites.

### A.5 Baseline semantic corrections: jurisdiction assumption removal (D6)

This is commit `51d1444`, separate from all PR-0A work. It was written tests-first: `src/domain/semanticCorrections.test.ts` (13 assertions), run by `scripts/validate-semantic-corrections.ts` and included in `npm run validate`.

**Before the correction: 6/13 FAIL**, demonstrating all three defects:
- **Eligibility.** A challenge with **no jurisdiction** was ELIGIBLE for an NV-licensed provider.
- **Vault, no prior baseline.** The future baseline had `jurisdiction: "NV"` and a fabricated **2022 Honda Accord**, VIN `1HGCR2F83HA000000`, garaged at 89101.
- **Vault, prior baseline without jurisdiction.** The future baseline was still stamped `NV`.
- **Qualification.** An NV offer with **10/20/5** limits was reported as *"NV statutory liability minimums verified"*.

**After the correction: 13/13 PASS.** Every control case (an explicit NV challenge stays eligible; a CA prior baseline yields a CA v2 baseline; the citation is retained; the qualification outcome is unchanged) passed both before and after.

| File | Correction |
|---|---|
| `src/domain/eligibilityEngine.ts` | `\|\| 'NV'` removed. A missing jurisdiction adds `JURISDICTION_UNKNOWN`, so the provider is ineligible. |
| `src/domain/pm5ReconciliationEngine.ts` | Jurisdiction and vehicle come only from the prior verified baseline. Without one, the vault item is still filed from the issued policy, but no future baseline is manufactured. Overloads keep `newBaseline` non-optional whenever a prior baseline is passed, so frozen callers and tests are untouched. |
| `src/domain/qualificationEngine.ts` | The reason now reads "mandatory coverage categories present (`<ruleVersion>`: `<citation>`). Statutory limit amounts were not evaluated." The citation pinned by `validate-pm2.ts:445` is kept. Outcomes are unchanged. |
| `src/server/db.ts` | `FUTURE_BASELINE_ACTIVATED` is audited only when a future baseline exists |

The commercial-neutrality firewall still passes for both protected engines that changed.

## B. Repository Architecture Map

```
server.ts (Express, ~2,300 lines)
 ├─ identity helpers: getAuthenticatedProviderOrgId / ...UserId   ← header-based (x-provider-user-id)
 ├─ consumer identity: body.consumerId || x-consumer-id || 'user_consumer_1'
 ├─ /api/documents/upload-sample        → SAMPLE_DECLARATIONS_PAGES fixture (no real bytes)
 ├─ /api/policies/:id/verify            → unauthenticated overwrite of policy
 ├─ /api/baselines/create               → CoverageBaseline (drops policy.jurisdiction)
 ├─ /api/challenges/create              → Challenge (jurisdiction hard-coded 'NV')
 ├─ /api/marketplace/*                  → PM-1..PM-5 flows via `db`
 ├─ /api/marketplace/invitations/:id/accept → CE-2 capacity gate (commercialStore.consumeEngagementCapacity)
 ├─ /api/commercial/*                   → CE-1..CE-5 (agreements, usage, rating, adjustments,
 │                                        billing periods, invoices, payments, refunds, statements)
 └─ /api/admin/audit-chain/generate-proof → generateRegulatoryAuditProof

src/server/db.ts  — PolicyChallengeDatabase (~3,950 lines)
 ├─ ~35 in-memory Map<> collections: the operational source of truth
 └─ fire-and-forget write-through to postgresStore (.catch(log)), partial coverage

src/server/db/postgresStore.ts — PGlite (WASM Postgres) at ./data/openpolicy_pg
src/server/db/commercialStore.ts — CE persistence on the same PGlite instance
src/server/db/migrate.ts — 7 SQL strings (0001–0007) re-executed every boot (IF NOT EXISTS); 13 indexes, all commercial
src/server/db/schema.ts — Drizzle definitions (subset of tables)

src/domain/ (pure-ish engines; most read the wall clock)
 ├─ policyIntelligence.ts       sample fixtures (NV GEICO, CA State Farm) + quote discrepancy check
 ├─ eligibilityEngine.ts        provider eligibility (license/appetite/LOB/renewal window)
 ├─ qualificationEngine.ts      ★ offer qualification + JURISDICTIONAL_STATUTORY_REGISTRY (NV/OH/CA)
 ├─ comparisonEngine.ts         ★ field/whole-offer comparison (no jurisdiction logic)
 ├─ competitionEngine.ts        ★ rounds, sealed telemetry (no jurisdiction logic)
 ├─ selectionBindingEngine.ts   ★ selection, consent, disclosure, modifications, binding
 ├─ pm5ReconciliationEngine.ts  ★ issued-policy reconciliation, vault, next baseline
 ├─ bindingReconciliationEngine.ts  legacy Section-40 dossier + post-bind recon
 ├─ governanceAuditEngine.ts    hash chain, Merkle root, review queue, "regulatory proof"
 └─ commercialEconomicsEngine.ts CE-1/2 + rateCommercialEvent
 ★ = protected per directive §6
```

**Persistence reality.** The in-memory `db` is authoritative for reads in nearly every route. PGlite receives asynchronous, unawaited writes for a subset of entities: challenges, offers, selections, consents, handoffs, vault, and others. **`policies` and coverage baselines are never written to PGlite. There is no baseline table at all; the baseline lives embedded in the challenge.** `postgresStore` is read directly by `server.ts` only for provider-profile endpoints.

---

## C. Jurisdiction Coupling Audit

Legend. **Core**: concept stays in the national core. **Ruleset**: content moves to governed jurisdiction data. **Risk**: migration risk (H/M/L). ★ means the file is protected or frozen.

### C.1 Domain engines

| File | Symbol / location | Current assumption | Juris-specific? | Remain core? | Move to ruleset? | Risk |
|---|---|---|---|---|---|---|
| ★`qualificationEngine.ts` | `JurisdictionalStatutoryRule` / `JURISDICTIONAL_STATUTORY_REGISTRY` (L22–76) | NV/OH/CA minimum liability limits and citations are hard-coded TS constants, labelled `NV-DOI-2025-01` etc. They carry no provenance, no verification state, and no effective-through date. | Yes | No | **Yes**. This is the prototype of `JurisdictionRule`. | **H**: citation strings are pinned by `validate-pm2.ts:445` and `pm2InformationOffers.test.ts:220` |
| ★`qualificationEngine.ts` | `evaluateOfferQualification` step 5 (L156–186) | Checks only that the mandatory coverage **codes are present**. It **never compares `statutoryMinimums` to offer limits**, yet emits *"statutory liability minimums verified"*. | Yes | Evaluation port: yes | Limits evaluation: yes | **H**: this is a factual misstatement in a consumer-facing reason |
| ★`qualificationEngine.ts` | `resolvedJurisdiction` ZIP inference (L104–110) | `89*`→NV, `9*`→CA, `4*`→OH. `9xxxx` also covers WA, OR, AK, HI and Pacific territories; `4xxxx` covers IN, KY, MI. | Yes | No | No: replace with `JurisdictionDetermination` | **H**: misclassification in production |
| ★`qualificationEngine.ts` | unconfigured-jurisdiction branch (L176–180) | Fail-open: the offer qualifies with a notice. Pinned by test PM2-QUAL-6 (`WY`). | Yes | Yes, *if* market activation gates upstream | — | M |
| ★`qualificationEngine.ts` | carrier relationship match (L120–134) | Substring carrier-name match. **Ignores `CarrierRelationship.jurisdiction` and `lineOfBusiness`.** An empty relationship list passes ("stated with broker representation"). | Yes (appointment is per-state) | Core concept | Authority rules: yes | **H** |
| `eligibilityEngine.ts` | `challenge.jurisdiction \|\| 'NV'` (L32) | Silent Nevada default | Yes | No | No: must fail closed | **H** |
| `eligibilityEngine.ts` | `lineOfBusiness = 'PERSONAL_AUTO'` (L56) | Hard-coded line | No (line, not state) | Line comes from challenge | No | L |
| `eligibilityEngine.ts` | license filter (L33–50) | Any `licenseType` satisfies. Licenses are organization-level only, with no individual producer. `new Date()` wall clock makes results non-reproducible. | Yes | Engine core | Accepted license classes → ruleset | M |
| `eligibilityEngine.ts` | appetite renewal window | Commercial/appetite preference, not law | No | Yes | No | L |
| ★`comparisonEngine.ts` | coverage branches | No jurisdiction logic. **Good: keep it that way.** The default deductible is `?? 500`. Unknown codes fall to an included/excluded check. | No | Yes | No | — |
| ★`competitionEngine.ts` | — | No jurisdiction logic. Keep it that way. | No | Yes | No | — |
| ★`selectionBindingEngine.ts` | `initiateBindingHandoff` (L76) | `bindingReference = 'BIND-NV-…'` | Yes (cosmetic) | Reference format: core | No | L |
| ★`selectionBindingEngine.ts` | `createConsentGrant` (L120) | `termsVersion = 'NV-DOI-2025-01'` default. **This conflates a regulator ruleset ID with Open Policy's consent-terms version.** | Yes | Consent core | Required consent notices → ruleset | M |
| ★`pm5ReconciliationEngine.ts` | `activateVerifiedPolicyToVault` (L524–534) | `jurisdiction: currentBaseline?.jurisdiction \|\| 'NV'`. **It also fabricates a 2022 Honda Accord vehicle** when there is no prior baseline. | Yes | No | No: must propagate or fail | **H**: fabricated facts entering a future baseline |
| `governanceAuditEngine.ts` | `generateRegulatoryAuditProof` (L239–283) | Emits "State of {X} Commissioner of Insurance Audit Framework" as `certificationAuthority` and "Certified under penalty of administrative revocation". **This implies regulator certification that does not exist.** | Yes | Hash-chain proof: core | Regulator identity → `RegulatoryAuthority` | **H**: regulatory misrepresentation. Pinned by `governanceAudit.test.ts:270`. |
| `governanceAuditEngine.ts` | `UNLICENSED_ACTIVITY` escalation | Generic "state producer license" | Generic | Yes | No | L |
| `bindingReconciliationEngine.ts` | `winningBroker.jurisdiction`, `licenseState` | Dossier fields | Generic | Yes | No | L |
| `policyIntelligence.ts` | `SAMPLE_DECLARATIONS_PAGES` | NV and CA fixtures | Fixture | Fixture only | No | L (PR-1 replaces it) |

### C.2 Orchestration / HTTP

| File | Location | Current assumption | Action | Risk |
|---|---|---|---|---|
| `server.ts` | L285 `/api/challenges/create` | **Every challenge is `jurisdiction: 'NV'`**, including the CA sample policy | Derive from `JurisdictionDetermination` | **H** |
| `server.ts` | L272 | `referenceNumber` prefix `'NV'` if any garaging ZIP exists, else `'US'` | Use the determined jurisdiction | L |
| `server.ts` | L232–253 `/api/baselines/create` | Drops `policy.jurisdiction`, so the baseline has `jurisdiction: undefined`, which triggers ZIP inference in qualification | Propagate | **H** |
| `server.ts` | L273 | `consumerId: 'user_consumer_1'` hard-coded | PR-1 identity | H (PR-1) |
| `server.ts` | L2260–2261 | Regulatory proof defaults `'NV'` / `'CHAL-NV-49281'` | Require explicit input | M |
| `server.ts` | L797, 919, 935, 991, 1030, 1072, 1194, 1221, 1242, 1468, 1542 | Consumer identity on 11 routes (incl. consent) is `body \|\| header \|\| 'user_consumer_1'` | PR-1 | H (PR-1) |
| `db.ts` | L3341 `grantBindingConsent` | `recipientOrganizationId = handoff.providerOrganizationId \|\| 'org_apex'`. **PII consent can default to a hard-coded organization.** | Fail closed | **H** |
| `db.ts` | L3433 `fullConsumerData` | Hard-coded NV PII fixture (Jane Doe, NV DL) | PR-1 | H (PR-1) |
| `db.ts` | L1370/L1561/L3100 | Qualification called without jurisdiction. `applicableRuleVersion` is **computed but discarded** (not stored on the offer). | Anchor and persist | **H**: not historically reconstructable |
| `db.ts` | L2200 | Eligibility called for every org with wall-clock time | Pass `evaluationDate` | M |

### C.3 Persistence

| Table / column | Assumption | Action |
|---|---|---|
| `provider_organizations.states` (JSON text) | Self-declared state list. Displayed in the portal, never used for authority. | Must **never** be treated as authority. Keep it as a marketing declaration or deprecate. |
| `provider_licenses(jurisdiction, license_type, status, verification_status, dates)` | Organization-level only. No NPN, line of authority, individual producer, verification source, or verifier. | Additive columns (§F) |
| `carrier_relationships(jurisdiction, line_of_business, relationship_type, status)` | No effective dates and no verification provenance | Additive columns (§F) |
| `provider_appetites.jurisdictions` | Commercial preference, not authority | Keep: an appetite ≠ authority |
| `challenges.jurisdiction` (TEXT) | Free text, no FK | FK to `jurisdictions`; add anchors |
| `policies.jurisdiction` | Present but never written (no write-through) | PR-1 |

### C.4 Commercial layer

| Location | Observation | Action |
|---|---|---|
| `server.ts` `/api/marketplace/invitations/:id/accept` (CE-2) | Commercial engagement capacity is consumed atomically at invitation acceptance. This is the only place commercial state gates marketplace participation. | **Ordering requirement for PR-0:** provider jurisdictional authority must be evaluated **before** capacity is consumed. An unauthorized provider must be rejected without consuming capacity, recording `VPO_ENGAGED`, or creating anything billable. |
| `server.ts` `/api/challenges/create` (CE-3) | Emits `VPO_AVAILABLE` for every eligible invitation | The market-activation gate must run **before** invitations are created, so an inactive jurisdiction never produces commercial value events |
| `EntitlementType 'JURISDICTION_CAPACITY'`, `includedJurisdictions` | Commercial *count* of jurisdictions a provider's plan covers | Legitimate (directive §5) **only as a participation cap**. It must never satisfy or substitute for legal authority. |
| `ProviderPortal.tsx:2572` | References the non-existent entitlement `'ACTIVE_JURISDICTIONS'` with copy "States where marketplace distribution is commercially enabled" | Dead branch. The copy conflates commercial and legal enablement. Correct it in the UI pass. |

### C.5 UI / client

| File | Observation |
|---|---|
| `AuthModal.tsx` L44/51, L361–373, L448–460 | State pickers default to `NV`, and only 6 states are offered |
| `AuthContext.tsx` L55–56, L148 | Demo provider license `NV-LIC-984210`; consumer `state` defaults to `'NV'` |
| `ConsumerPortal.tsx` L273, 326–344, 988, 1334, 1383, 1959, 2800 | NV fixture fallbacks such as `'CHALLENGE #NV-49281'` and `'POL-NV-49281'`, and the copy "NV-89101" anonymous risk vector |
| `ProviderPortal.tsx` L99, 879, 1124–1129, 1314, 1435, 2368 | Default challenge `CHAL-NV-49281`, fallback license `NV-LIC-902188`, appetite fallback `'NV'` |
| `AdminConsole.tsx` L157–158, 221, 735 | "NV DOI" header; proof copy "State of {X} Division of Insurance" |
| `Header.tsx` L112, `TelemetryDashboard.tsx` L34–36 | Cosmetic NV references |
| `services/userService.ts` L150–253 | Demo data seeded as NV |

### C.6 Coverage taxonomy (structural)

`CoverageItem.code` covers `BODILY_INJURY | PROPERTY_DAMAGE | COLLISION | COMPREHENSIVE | UM_UIM | MEDICAL_PAYMENTS | RENTAL_REIMBURSEMENT | ROADSIDE_ASSISTANCE`.

It has **no PIP**, **no UMPD**, **UM and UIM merged**, **no combined single limit**, **no stacking indicator**, and **no tort-option election**. Jurisdictions with no-fault or PIP regimes, separate UM/UIM rules, or CSL-expressed minimums cannot be represented. Worse, `comparisonEngine.compareCoverageItem` would route any added code through the default included/excluded branch, so a **PIP limit reduction would classify as `EQUIVALENT`**.

Extending the taxonomy requires changing the protected comparison engine. It is out of scope for PR-0A and needs a separate approved decision (§K, D8).

---

## D. Existing Reusable Abstractions (keep these)

1. **Separation of the comparison and competition engines from jurisdiction.** Neither contains state logic. This is the correct end state and must be preserved.
2. **`ProviderLicense` and `CarrierRelationship` are already jurisdiction-keyed.** They become the evidence inputs to provider authority. No parallel "authority" table is needed (§E.6).
3. **`CommercialPlanVersion.effectiveFrom/effectiveUntil` plus historical anchoring.** This is the repository's own precedent for effective-dated immutable versions. The jurisdiction model reuses the pattern and the **naming**.
4. **`QualificationResult.applicableRuleVersion`.** The anchoring concept already exists. It just isn't persisted.
5. **PM2-QUAL-6 doctrine:** "do not assume universal statutory law". The new model keeps this: an absent rule produces `INDETERMINATE` or no assertion, never invented law.
6. **Governance audit hash chain.** Ruleset publication and activation events emit `AuditEvent`s through the existing chain.
7. **Review queue (`ReviewQueueItem`).** `INDETERMINATE` regulatory results route here. No new queue is needed.
8. **The `SourceEvidence` pattern** (document, page, snippet, confidence, verified). `RegulatorySource` mirrors this for legal sources.

---

## E. Proposed Canonical Jurisdiction Schema

**Design rule:** every entity below answers a demonstrated requirement. I rejected a separate `RuleVersion` entity (a rule row *is* a version) and a stored `ProviderJurisdictionAuthority` entity (authority is *derived* from license and appointment evidence; storing it would create a second, drift-prone source of truth).

New types live in `src/types/jurisdiction.ts` and are re-exported from `src/types/insurance.ts`.

### E.1 `Jurisdiction` (reference data)
```ts
type JurisdictionCode = 'AL'|'AK'|…|'WY'|'DC';      // exactly 51, USPS codes
interface Jurisdiction { code: JurisdictionCode; name: string; kind: 'STATE'|'FEDERAL_DISTRICT'; }
```
*Requirement:* replace free-text `jurisdiction: string` and make invalid codes unrepresentable. Codes and names are factual reference data, not law.

### E.2 `RegulatoryAuthority`
```ts
interface RegulatoryAuthority {
  id: string; jurisdictionCode: JurisdictionCode; name: string;
  kind: 'LEGISLATURE'|'INSURANCE_REGULATOR'|'MOTOR_VEHICLE_AGENCY'
      |'PRODUCER_LICENSING_AUTHORITY'|'OPEN_POLICY';
  officialUrl?: string;
}
```
*Requirement:* §21 says sources must be attributable to an issuer. Financial-responsibility and proof-of-insurance law often sits in a vehicle code administered outside the insurance department, so the issuer cannot be assumed to be "the DOI".

### E.3 `RegulatorySource`
```ts
type SourceType = 'STATUTE'|'ADMINISTRATIVE_REGULATION'|'DEPARTMENT_BULLETIN'|'DEPARTMENT_ORDER'
                | 'REQUIRED_FORM'|'REGULATOR_GUIDANCE'|'LICENSING_AUTHORITY_RECORD'
                | 'OPEN_POLICY_INTERNAL_POLICY';
interface RegulatorySource {
  id: string; jurisdictionCode: JurisdictionCode; authorityId: string;
  sourceType: SourceType; citation: string; title: string;
  officialUrl?: string; retrievedAt?: string;
  contentSha256?: string; archivedCopyRef?: string;   // proves which text was relied on
}
```
*Requirement:* §21 and §26 provenance, and the explicit non-equivalence of source types. `OPEN_POLICY_INTERNAL_POLICY` lets Open Policy hold itself to a stricter standard *without ever displaying it as law*.

### E.4 `JurisdictionRuleSet` (the publication unit)
```ts
type RuleSetStatus = 'DRAFT'|'IN_REVIEW'|'PUBLISHED'|'SUPERSEDED'|'WITHDRAWN';
interface JurisdictionRuleSet {
  id: string; jurisdictionCode: JurisdictionCode; insuranceLine: 'PERSONAL_AUTO';
  version: number;                         // monotonic per (jurisdiction, line)
  status: RuleSetStatus;
  supersedesRuleSetId?: string;
  authoredBy: string; publishedBy?: string; publishedAt?: string;
  contentSha256?: string;                  // canonical hash of all rules, set at publish
}
```
*Requirements:* §22 (versioning, supersession) and §29 (publication, rollback of unpublished drafts only).

Once a ruleset is `PUBLISHED`, it and its rules are **immutable**. The only allowed status moves are to `SUPERSEDED` (a newer version was published) or `WITHDRAWN` (it was erroneous; withdrawal is itself an audited event and does *not* delete it).

### E.5 `JurisdictionRule` (each row is an immutable rule version)
```ts
type RuleCategory =
  'MINIMUM_LIABILITY'|'UM_UIM'|'PIP_NO_FAULT'|'MEDPAY'|'MANDATORY_OFFER'|'CONSUMER_ELECTION'
 |'REQUIRED_FORM'|'PRODUCER_LICENSING'|'PRODUCER_APPOINTMENT'|'CARRIER_AUTHORITY'
 |'BROKER_AGENT_CLASSIFICATION'|'CONSUMER_FEE_DISCLOSURE'|'REBATING_INDUCEMENT'
 |'QUOTE_REQUIREMENT'|'APPLICATION_REQUIREMENT'|'BINDING_REQUIREMENT'|'ELECTRONIC_SIGNATURE'
 |'ELECTRONIC_RECORDS'|'PRIVACY'|'RECORD_RETENTION'|'PROOF_OF_INSURANCE'
 |'CANCELLATION_NONRENEWAL'|'REQUIRED_NOTICE';

type EnforcementPoint = 'CHALLENGE_OPEN'|'PROVIDER_AUTHORITY'|'OFFER_QUALIFICATION'
  |'PRE_SELECTION_DISCLOSURE'|'CONSENT'|'BINDING'|'ISSUED_POLICY'|'RETENTION';

type VerificationStatus = 'UNVERIFIED'|'SOURCE_LINKED'|'LEGAL_REVIEWED'|'VERIFIED'|'REJECTED';

interface JurisdictionRule {
  id: string; ruleSetId: string;
  ruleCode: string;                        // stable across versions, e.g. 'AUTO.LIABILITY.MINIMUM'
  ruleCategory: RuleCategory;
  enforcementPoint: EnforcementPoint;
  requirementText: string;                 // human-readable statement of the requirement
  sourceIds: string[];                     // ≥1 required before status ≥ SOURCE_LINKED
  effectiveFrom: string;                   // DATE, inclusive
  effectiveUntil?: string;                 // DATE, exclusive (repo precedent: CommercialPlanVersion)
  verificationStatus: VerificationStatus;
  verifiedAt?: string; verifiedBy?: string;
  supersedesRuleId?: string;
  machineRule: MachineRule | null;         // null ⇒ informational only, never auto-enforced
}
```

**`MachineRule`** is a **closed discriminated union**. There is no expression language, no `eval`, and no scripting. Each variant is a deterministic predicate with its own evaluator and its own fixtures:

```ts
type MachineRule =
 | { kind:'MINIMUM_LIMITS'; coverageCode:string; perPerson?:number; perAccident?:number;
     property?:number; combinedSingleLimit?:number }
 | { kind:'REQUIRED_COVERAGE'; coverageCode:string }
 | { kind:'MANDATORY_OFFER'; coverageCode:string; rejectionPermitted:boolean;
     rejectionEvidence?: 'SIGNED_WRITTEN'|'PRESCRIBED_FORM'; formSourceId?:string }
 | { kind:'REQUIRED_NOTICE'; noticeCode:string; deliverBy:EnforcementPoint; formSourceId?:string }
 | { kind:'PRODUCER_AUTHORITY'; acceptedLicenseClasses:string[];
     entityLicenseRequired:boolean; individualLicenseRequired:boolean; appointmentRequired:boolean }
 | { kind:'CARRIER_AUTHORITY'; certificateOfAuthorityRequired:boolean }
 | { kind:'ELECTRONIC_CONSENT'; electronicSignaturePermitted:boolean; priorEDeliveryConsentRequired:boolean }
 | { kind:'RECORD_RETENTION'; recordClass:string; minimumYears:number };
```

**The evaluation result vocabulary** is fixed, and **no variant produces a score, rank or ordering**:
```ts
type RuleOutcome = 'PASS'|'FAIL'|'BLOCK'|'NOT_AUTHORIZED'|'NOT_APPLICABLE'|'INDETERMINATE';
```
- `FAIL`: the offer does not satisfy a requirement (for example, below a minimum).
- `BLOCK`: a process step cannot proceed until evidence exists (for example, a rejection form).
- `INDETERMINATE`: the inputs are insufficient, for example a rule references a coverage code the taxonomy cannot express, or a fact is unknown. **It never silently becomes `PASS`** (the explicit-uncertainty principle).

### E.6 Provider jurisdiction authority (derived, not stored)
```ts
evaluateProviderJurisdictionAuthority({
  org, licenses, carrierRelationships, ruleSet, insuranceLine, carrier?, evaluationDate
}) → { outcome: 'AUTHORIZED'|'NOT_AUTHORIZED'|'INDETERMINATE', reasons: string[], ruleIds: string[] }
```
This answers *"Is this provider authorized for this opportunity, in this jurisdiction, for this line and carrier, on this date?"* It reads only license and appointment evidence plus the ruleset's `PRODUCER_AUTHORITY` and `CARRIER_AUTHORITY` rules. `DIRECT_CARRIER` organizations are evaluated on carrier authority, not producer licensing.

**The evidence model needs additive fields** (§F). Most importantly, the license must be able to belong to an *individual producer* (`providerUserId`), not just the organization.

### E.7 `JurisdictionDetermination` (which law governs this transaction)
```ts
interface JurisdictionDetermination {
  id: string; challengeId?: string; policyId: string;
  proposedJurisdiction?: JurisdictionCode;
  basis: Array<{ signal:'POLICY_STATED_STATE'|'GARAGING_ADDRESS_STATE'|'CONSUMER_ATTESTATION';
                 value: JurisdictionCode; evidenceRef?: string }>;
  status: 'PROPOSED'|'CONSUMER_CONFIRMED'|'CONFLICT'|'UNRESOLVED';
  confirmedJurisdiction?: JurisdictionCode; consumerConfirmedAt?: string;
}
```
*Requirement:* the defects at `server.ts:285`, the dropped jurisdiction in `server.ts:232`, and the ZIP-prefix inference in `qualificationEngine.ts:104`.

The rule is simple. Signals are evidence. **If the signals conflict, or vehicles are garaged in more than one state, the result is `CONFLICT`/`UNRESOLVED`, and the challenge cannot open.** Nothing is inferred from ZIP prefixes. Which signal legally controls is a legal-review question for PR-0B, so the model records signals rather than encoding an answer.

### E.8 `MarketActivation` (append-only events and gate attestations)
See §I.

### E.9 `JurisdictionRuleEvaluation` (append-only anchoring record)
```ts
interface JurisdictionRuleEvaluation {
  id: string; subjectType: 'CHALLENGE'|'OFFER'|'OFFER_VERSION'|'PROVIDER'|'BINDING_HANDOFF'|'ISSUED_POLICY';
  subjectId: string; ruleSetId: string; ruleSetContentSha256: string; ruleId: string;
  evaluationDate: string; outcome: RuleOutcome; reasons: string[];
  inputsSha256: string; evaluatedAt: string; mode: 'SHADOW'|'ENFORCE';
}
```
*Requirement:* §22 reconstructability. `applicableRuleVersion` is currently computed and then discarded.

---

## F. Persistence Impact

**Migration `0008_jurisdiction_framework`** (`0006`/`0007` are now taken by CE-4/CE-5). This is additive only, and every `ALTER` adds a nullable column, so existing rows and the PM/CE validators are unaffected.

```
CREATE TABLE jurisdictions (code TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);       -- seed 51
CREATE TABLE regulatory_authorities (id PK, jurisdiction_code FK, name, kind, official_url);
CREATE TABLE regulatory_sources (id PK, jurisdiction_code FK, authority_id FK, source_type, citation,
       title, official_url, retrieved_at TIMESTAMPTZ, content_sha256, archived_copy_ref);
CREATE TABLE jurisdiction_rule_sets (id PK, jurisdiction_code FK, insurance_line, version INT, status,
       supersedes_rule_set_id, authored_by, published_by, published_at TIMESTAMPTZ, content_sha256,
       UNIQUE (jurisdiction_code, insurance_line, version));
CREATE TABLE jurisdiction_rules (id PK, rule_set_id FK, rule_code, rule_category, enforcement_point,
       requirement_text, source_ids JSONB, effective_from DATE NOT NULL, effective_until DATE,
       verification_status, verified_at, verified_by, supersedes_rule_id, machine_rule JSONB,
       CHECK (effective_until IS NULL OR effective_until > effective_from));
CREATE TABLE jurisdiction_rule_set_reviews (id PK, rule_set_id FK, action, actor_id, notes, recorded_at);  -- append-only
CREATE TABLE market_activation_events (id PK, jurisdiction_code FK, insurance_line, environment,
       from_state, to_state, actor_id, reason, rule_set_id, recorded_at TIMESTAMPTZ);                    -- append-only
CREATE TABLE market_activation_gate_attestations (id PK, jurisdiction_code FK, insurance_line, environment,
       gate_code, status, evidence_ref, attested_by, attested_at, revoked_at);                           -- append-only
CREATE TABLE jurisdiction_determinations (... per §E.7 ...);
CREATE TABLE jurisdiction_rule_evaluations (... per §E.9 ...);                                         -- append-only

ALTER TABLE provider_licenses     ADD provider_user_id TEXT, ADD license_class TEXT, ADD npn TEXT,
                                  ADD resident_status TEXT, ADD verification_source TEXT,
                                  ADD verified_at TEXT, ADD verified_by TEXT;
ALTER TABLE carrier_relationships ADD effective_from DATE, ADD effective_until DATE,
                                  ADD verification_source TEXT, ADD verified_at TEXT, ADD verified_by TEXT;
ALTER TABLE challenges            ADD jurisdiction_determination_id TEXT, ADD rule_set_id TEXT,
                                  ADD rule_set_content_sha256 TEXT, ADD regulatory_evaluation_date DATE;
```

**Indexes** (the 13 existing indexes are all on commercial tables; none of the marketplace tables has a secondary index):
- `jurisdiction_rule_sets (jurisdiction_code, insurance_line, status)`
- `jurisdiction_rules (rule_set_id, enforcement_point)`
- `jurisdiction_rules (rule_code, effective_from)`
- `jurisdiction_rule_evaluations (subject_type, subject_id)`
- `market_activation_events (jurisdiction_code, insurance_line, environment, recorded_at DESC)`
- `provider_licenses (provider_organization_id, jurisdiction)`
- `carrier_relationships (provider_organization_id, jurisdiction, line_of_business)`

**Immutability enforcement.** Use `BEFORE UPDATE OR DELETE` triggers that reject changes to `jurisdiction_rules` whose ruleset is `PUBLISHED`/`SUPERSEDED`/`WITHDRAWN`, and to all append-only tables. *This needs verification on PGlite* (plpgsql availability). If it is unavailable, the same invariant is enforced in `jurisdictionStore` and tested. It is enforced either way.

**Write discipline.** Regulatory records **must not** copy the existing fire-and-forget `.catch(log)` pattern. Jurisdiction writes are awaited, and a failure fails the request. An unrecorded regulatory evaluation is worse than a failed request.

**Naming constraint.** No new table name contains `billing`, `ledger`, `fee` or `commission`. That avoids tripping the economics-separation intent of PM-5 test 3.12, even though that test currently checks a hard-coded list (§K.11). Fee *disclosure* is a rule category (data), not a table.

---

## G. Engine Integration Map

**Principle:** protected engines receive **verdicts**, never **rules**. No protected engine ever learns which state it is in. One new pure engine owns all jurisdiction interpretation; orchestration (`db.ts`/`server.ts`) calls it and passes results through.

```
                    ┌──────────────────────────────┐
 Policy document →  │ policyIntelligence (PR-1)    │  "What does the document say?"  (carrier/jurisdiction-neutral)
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ jurisdictionDetermination    │  signals → PROPOSED → consumer CONFIRMED | CONFLICT
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ marketActivationEngine       │  canOpenChallenge(j, line, env, date)?  ── no → reject
                    └──────────────┬───────────────┘
                                   ▼  anchor: ruleSetId + contentSha256 + evaluationDate on Challenge
 ┌─────────────────────────────────┴──────────────────────────────────────────────────────┐
 │ jurisdictionRuleEngine (pure: ruleSet, enforcementPoint, facts, evaluationDate → outcomes) │
 └───┬──────────────┬──────────────────┬───────────────────┬──────────────────┬───────────┘
     ▼              ▼                  ▼                   ▼                  ▼
 providerAuthority  OFFER_QUALIFICATION  PRE_SELECTION/CONSENT  BINDING            ISSUED_POLICY
 (eligibility input)(alongside ★qualif.) (alongside ★selection) (gate before BOUND) (alongside ★PM-5)
```

| Engine | Integration | Changes in PR-0A |
|---|---|---|
| `policyIntelligence` | None. It stays a pure "what does it say" engine; jurisdiction semantics never enter extraction. | None |
| `eligibilityEngine` (frozen) | Future: consume a `ProviderJurisdictionAuthority` verdict in place of its inline license filter. | **None in PR-0A.** In shadow mode, authority is evaluated alongside and recorded. Removing `\|\| 'NV'` requires approval (D6). |
| ★`qualificationEngine` | Future (PR-0C): an optional `regulatoryVerdict` parameter replaces the inline registry. When it is absent, legacy behavior is preserved (keeps PM2-QUAL-6). | **None.** The registry is migrated *as data* (§L), and the engine is untouched. |
| ★`comparisonEngine` | **No integration, ever.** Regulatory compliance is presented in a *separate* "regulatory requirements" panel and never folded into BETTER/WORSE/classification. | None |
| ★`competitionEngine` | **No integration, ever.** Jurisdiction results contain no ordering fields. | None |
| ★`selectionBindingEngine` | Future (PR-0C): orchestration evaluates `CONSENT` and `BINDING` enforcement points *before* calling `transitionBindingStatus`. A `BLOCK` outcome prevents the call, so the engine itself is unchanged. | None |
| ★`pm5ReconciliationEngine` | Issued-policy statutory checks run as a separate `ISSUED_POLICY` evaluation. **They do not add a `DiscrepancyCategory`.** Reconciliation still means "issued vs promised"; legality is a separate finding. | None (the vault fabrication defect needs approval: D6) |
| `governanceAuditEngine` | Ruleset publish, activation transitions and gate attestations emit `AuditEvent`s on the existing chain. | Additive event types only |
| `commercialEconomicsEngine` | May *read* activation state downstream. It must never be read *by* jurisdiction engines. `JURISDICTION_CAPACITY` stays a commercial cap and never substitutes for authority. | None |

### PR-0 ordering invariant (design constraint, recorded 2026-10-03, not yet implemented)

Regulatory gates precede commercial consequences. A transaction must traverse:

```
Consumer / Policy
      ↓
Determine Governing Jurisdiction          (JurisdictionDetermination)
      ↓
MarketActivation Gate                     ── closed → no challenge, no invitations, no VPO_AVAILABLE
      ↓
Challenge / Opportunity Creation
      ↓
Candidate Provider
      ↓
ProviderJurisdictionAuthority Gate        ── NOT_AUTHORIZED / INDETERMINATE → not invited
      ↓
Eligibility / Invitation                  (CE-3 VPO_AVAILABLE emitted only here)
      ↓
Provider Accepts                          ── authority re-checked at acceptance (evaluationDate = now)
      ↓
CE-2 Capacity Consumption
      ↓
Competition Participation
      ↓
CE-3 Commercial Observation
      ↓
CE-4 Rating
```

**Invariants:**
- `MarketActivation` gates opportunity and invitation creation.
- `ProviderJurisdictionAuthority` gates participation **before** CE-2 capacity consumption.
- A provider rejected by either gate consumes no capacity, produces no `CommercialEvent`, and creates nothing billable.
- Commercial state never feeds back into either gate.

This sequence is part of the PR-0A design. **It is not implemented** until PR-0A is approved, and it will be proven by acceptance tests (an unauthorized provider's acceptance attempt leaves capacity usage, `commercial_events` and `billable_events` unchanged).

### Neutrality firewall extension (additive, in a new validator)

- Protected set: the existing 5 files (the CE validators now include `qualificationEngine.ts`), **plus** `eligibilityEngine.ts`, `jurisdictionRuleEngine.ts`, `providerAuthorityEngine.ts`, `marketActivationEngine.ts` and `jurisdictionDetermination.ts`.
- Forbidden strings: the union of the lists in `validate-commercial-economics.ts` and `validate-ce5.ts` (they differ), **plus** `commercial_events`, `provider_entitlements`, `commercial_plan_versions`, `CommercialAgreement`, `ProviderEntitlement`, `BillableEvent`, `rateCommercialEvent`, `checkEntitlementCapacity`.
- Type-level check: jurisdiction engine input interfaces contain no commercial fields, and output types contain no `score`, `rank`, `order`, `priority` or `weight` keys (asserted by test).

---

## H. Versioning / Effective-Date Model

The model is **bitemporal**. It tracks two independent time axes:

| Axis | Question | Mechanism |
|---|---|---|
| **Knowledge time** | What did Open Policy believe the law was, as published? | `JurisdictionRuleSet.version`, `publishedAt`, `contentSha256` |
| **Legal effective time** | Which requirement is in force on date D? | `JurisdictionRule.effectiveFrom` (inclusive) / `effectiveUntil` (exclusive) |

**Evaluation is a pure function:** `evaluate(ruleSet, enforcementPoint, facts, evaluationDate)`. It never reads the clock.

**Anchoring.** Every transaction stores `(ruleSetId, contentSha256, evaluationDate)`. When ruleset N+1 is published later, existing anchored transactions are re-evaluable *exactly* against N. The hash proves N was not altered.

**Known future changes.** A ruleset published today can contain a rule version whose `effectiveFrom` is in the future, because statutes are often enacted ahead of their effective date. No republication is needed when the date arrives.

**Supersession.** Corrections and law changes are published as a new ruleset version with `supersedesRuleSetId`. The prior version moves to `SUPERSEDED`. It is never rewritten.

**Withdrawal.** An erroneous *published* ruleset is `WITHDRAWN`. That is an audited status change, never a deletion. Transactions anchored to it are flagged for review. Unpublished `DRAFT`/`IN_REVIEW` rulesets may be discarded.

**Four-eyes rule.** `publishedBy ≠ authoredBy`, and `verifiedBy` on a rule ≠ the rule's author. Enforced in `rulesetGovernance` (pure) and tested.

**Which date anchors each enforcement point** is a policy decision, not something I will encode silently. The proposed defaults (D10):
- `OFFER_QUALIFICATION`: the offer's policy `effectiveDate`.
- `PROVIDER_AUTHORITY`: the transaction date, re-checked at `BINDING`.
- `CONSENT`, `BINDING` and `PRE_SELECTION_DISCLOSURE`: the transaction date.

**Dates, not instants.** Legal effectiveness is a calendar date. Using `DATE` columns avoids time-zone conversion errors in states that span time zones.

---

## I. Market Activation Model

**Reconciliation of §18.** The conceptual 8-state lifecycle mixes two independent facts, and storing both in one enum would create drift. I propose **two axes**:

| Axis | Values | Stored or derived |
|---|---|---|
| **Regulatory readiness** | `NOT_CONFIGURED` → `RESEARCHING` → `RULES_IN_REVIEW` → `RULES_VERIFIED` | **Derived** from ruleset and rule status. It is never stored, so it cannot disagree with the rules. |
| **Operational activation** | `INACTIVE` → `PILOT` → `ACTIVE`, with `SUSPENDED` reachable from PILOT or ACTIVE | **Stored** as append-only `market_activation_events`. The current state is the latest event. |

A pure `displayStatus(readiness, activation, gates)` function maps both axes onto the 8 conceptual labels for the admin UI. In that mapping, `PROVIDERS_REQUIRED` means "rules verified, but gate `PROVIDER_AUTHORITY_READY` is unmet".

**Gates** are append-only attestations, each with evidence and an attestor:
`RULESET_VERIFIED` (derived, not attestable), `PROVIDER_AUTHORITY_READY`, `LEGAL_REVIEW_COMPLETE`, `DOCUMENT_REQUIREMENTS_READY`, `SECURITY_READY`, `OPERATIONAL_RUNBOOK_READY`, `MARKET_APPROVED`.

**Invariants:**
1. `RULESET EXISTS ≠ MARKET IS LIVE`. A `PUBLISHED`, fully `VERIFIED` ruleset with no activation event means challenge creation is rejected.
2. A transition to `PILOT` or `ACTIVE` requires every gate to be attested and unrevoked, **and** a `PUBLISHED` ruleset whose rules are all `VERIFIED` and in force on the activation date. Any `UNVERIFIED` rule with a non-null `machineRule` blocks activation.
3. `SUSPENDED` takes effect immediately: no new challenges and no new bindings. In-flight data is preserved and remains reconstructable. Whether in-flight competitions may continue to selection is decision D9.
4. Revoking a gate after activation does **not** auto-suspend; it raises a `CRITICAL` review-queue item. Automatic suspension is a policy decision I am not making silently.
5. **Environment scoping:** activation is keyed by `(jurisdiction, line, environment ∈ {SANDBOX, PRODUCTION})`. Test and demo seeds create **SANDBOX** activations for NV/CA/OH so the existing PM validators keep working, **without ever asserting that NV is operationally live**. Production enforcement ignores SANDBOX rows. The PILOT cohort (which consumers may transact) is deferred to PR-4.

---

## J. Proposed PR-0A Acceptance Tests

These are new files: `src/domain/jurisdiction.test.ts` and `scripts/validate-pr0a.ts`. **Existing validators are not edited.**

All behavioral fixtures use **fictional jurisdictions** registered only in the test registry (`X1`, `X2`). The tests therefore prove the machinery **without encoding any real law**.

**Reference and schema**
1. Exactly 51 jurisdictions, unique USPS codes, DC included, no territories.
2. Migration 0008 is idempotent and leaves row counts in all 0001–0007 tables unchanged.
3. No new table name matches `/billing|ledger|fee|commission/`.

**Market activation (`RULESET EXISTS ≠ MARKET IS LIVE`)**
4. PRODUCTION with a published, verified ruleset but no activation: `canOpenChallenge` returns false and the HTTP response is 4xx.
5. A missing gate blocks `→PILOT`. An `UNVERIFIED` executable rule blocks `→ACTIVE`.
6. `SUSPENDED` blocks new challenges, and existing anchored evaluations are still reproducible.
7. SANDBOX activation does not satisfy PRODUCTION enforcement.

**Effective dating and governance**
8. Two rule versions split at date D. Evaluating at D−1 and at D gives different outcomes.
9. A challenge anchored to ruleset v1, re-evaluated after v2 is published, produces byte-identical outcomes, and the `contentSha256` matches.
10. UPDATE or DELETE on a published rule is rejected. Supersession creates v2 and marks v1 `SUPERSEDED`.
11. A DRAFT can be discarded. A PUBLISHED ruleset cannot be deleted; it can only be `WITHDRAWN`, with an audit event.
12. Four-eyes: publishing by the author is rejected.

**Rule execution (fictional X1)**
13. Offer below `MINIMUM_LIMITS` returns `FAIL`.
14. `MANDATORY_OFFER` absent with no rejection returns `BLOCK`.
15. Rejection where `PRESCRIBED_FORM` evidence is required but missing returns `BLOCK`. With evidence present it returns `PASS`.
16. A rule referencing coverage code `PIP`, which the taxonomy lacks, returns **`INDETERMINATE`, never `PASS`**.
17. A rule with `machineRule = null` is never auto-enforced.

**Provider authority**
18. License in X2 for an X1 opportunity returns `NOT_AUTHORIZED`.
19. Wrong license class returns `NOT_AUTHORIZED`.
20. License expired on `evaluationDate` (not on the wall clock) returns `NOT_AUTHORIZED`.
21. Carrier appointment held in X2 only returns `NOT_AUTHORIZED` for that carrier in X1.
22. `ProviderOrganization.states` containing X1 grants **nothing** by itself.
23. `JURISDICTION_CAPACITY` entitlement present with no license returns `NOT_AUTHORIZED`.

**Jurisdiction determination (defect regressions)**
24. The CA sample policy flows to a CA challenge, and `baseline.jurisdiction` is preserved. This is the regression for `server.ts:285` and `:232`.
25. Policy-stated state ≠ garaging state yields `CONFLICT`, and the challenge cannot open.
26. A garaging ZIP of `98101` yields **no** inferred jurisdiction (the regression for ZIP-prefix inference).

**Neutrality**
27. Extended static firewall (§G) across 10 files.
28. Property test: randomizing all commercial accounts, plans, entitlements and billable events produces identical jurisdiction outcomes, provider authority results and qualification results.
29. Jurisdiction result objects contain no `score|rank|order|priority|weight` keys.
30. Ordering of `offerComparisons` is unchanged with jurisdiction evaluation on versus off.
31. No-Nevada-in-core lint: zero `'NV'` literals and zero `|| 'NV'` patterns in new `src/domain/**` non-test, non-seed files.

**Shadow mode**
32. With `JURISDICTION_ENFORCEMENT=SHADOW`, `offer.isQualified` is identical to the pre-PR-0A value for every PM fixture, and evaluations are still persisted.

**Regression**
33. PM-1…PM-5, CE-1/2, CE-3, CE-4, CE-5, `tsc`, build: all unchanged. Executed by a runner with per-suite timeouts so the PM-5 hang cannot stall CI.

---

## K. Risks and Conflicts

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| K1 | ~~BLOCKER~~ **Resolved** | The 09-30 snapshot lacked CE-3–CE-5. | The CE5_COMPLETE snapshot supplies them (§A). |
| K2 | High | The repository holds a **zip**, not a source tree. There are no diffs, no reviewable PRs and no blame. | First action after approval: commit the extracted tree (excluding `.env` and `node_modules`), then do PR-0A as reviewable commits. The `.env` in the zip has an **empty** `GEMINI_API_KEY`, so no secret was exposed, but `.env` should not be in the archive. |
| K3 | ~~High~~ **Resolved (D6)** | Qualification claimed "statutory liability minimums verified" while checking only coverage presence | The wording now states that limit amounts were not evaluated; the citation is retained; outcomes are unchanged (§A.5) |
| K4 | High | The legacy NV/OH/CA registry values are **unverified constants presented as law**, and their citation strings are **pinned by frozen tests** (`validate-pm2.ts:445`, `pm2InformationOffers.test.ts:220`). | Migrate them as `UNVERIFIED` legacy rules in a *SANDBOX-only* seed. Keep the engine and strings untouched in PR-0A. Retiring them in PR-0C requires an explicitly approved change to those two assertions. This is a genuine invariant conflict, surfaced per §33. |
| K5 | High | `generateRegulatoryAuditProof` produces regulator-certification language that no regulator issued. It is pinned by `governanceAudit.test.ts:270`. | It must not be shown externally as-is. The rewording needs approval to change the pinned assertion. |
| K6 | High | Jurisdiction is lost or forced: `server.ts:285` hard-codes `'NV'`, `:232` drops it, and ZIP-prefix inference misclassifies. | Fixed in PR-0A in orchestration only (no protected engine touched). |
| K6a | Medium | Eligibility's silent `\|\| 'NV'` default | **Resolved (D6).** A missing jurisdiction now yields `JURISDICTION_UNKNOWN` (ineligible). The `server.ts:285` hard-code and the `:232` drop remain open; they are fixed by PR-0A jurisdiction determination. |
| K7 | ~~High~~ **Resolved (D6)** | PM-5 vault fabricated `'NV'` and a 2022 Honda Accord | Jurisdiction and vehicle now come only from the prior verified baseline; otherwise no future baseline is created (§A.5) |
| K8 | High | Consent recipient falls back to `'org_apex'`. Consumer identity is spoofable with a default user. Consent `termsVersion` is client-suppliable and defaults to a regulator-style ID. | The `org_apex` fallback is a PII-disclosure hazard. Propose fixing it in PR-0A (orchestration). Identity is PR-1. |
| K9 | High | Persistence: in-memory Maps are authoritative; PGlite writes are fire-and-forget; policies and baselines are never persisted; migrations re-run every boot; no indexes. | PR-0A tables use awaited writes. The full fix is PR-1. Do not build regulatory anchoring on the Map store. |
| K10 | Medium | Carrier-appointment matching uses a substring match and ignores the appointment's jurisdiction. An empty relationship list passes. | Superseded by provider authority in enforce mode (PR-0C). |
| K11 | ~~High~~ **Resolved (D12)** | PM-5 test 3.12 asserted zero billing tables while CE-5 had created them, passing vacuously via a hard-coded table list | Replaced by five boundary assertions against the real schema (§A.4) |
| K12 | Medium | Coverage taxonomy lacks PIP/UMPD/CSL/stacking, and UM and UIM are merged. Comparison would treat a PIP limit cut as `EQUIVALENT`. | Rules that need these return `INDETERMINATE`. Extending the taxonomy is a protected comparison-engine change (D8). |
| K13 | ~~Medium~~ **Resolved** | `qualificationEngine.ts` is now in the CE validators' protected list. `eligibilityEngine.ts` is still unprotected, and the forbidden-string lists differ between validators. | The new validator adds `eligibilityEngine.ts` and uses the union of the lists. |
| K14 | Medium | `npm ci` fails without `--legacy-peer-deps` (esbuild `^0.25` vs vite 8). The PM-5 validator hung under the 09-30 snapshot; it exited cleanly on a fresh `./data` under CE-5. | Bump esbuild to `^0.27` in a separate approved chore. Use a timeout-guarded runner either way. |
| K15 | Low | Three overlapping "where can this provider work" sources: `org.states` (self-declared), `appetite.jurisdictions` (preference) and `licenses` (evidence). | Only licenses and appointments confer authority (test 22). |
| K16 | Low | The UI assumes NV throughout (§C.5), and the state pickers list only 6 states. | UI pass after PR-0A. No UI changes in PR-0A. |
| K17 | Policy | I have **not** verified any real-state legal value, including the three in the legacy registry, and will not encode any. | PR-0B, from primary sources with legal review. |
| K18 | ~~High~~ **Resolved (D11)** | Validators shared one mutable database, so CE-3's result depended on run order | Each validator now runs on its own empty database (§A.4) |
| K19 | ~~Medium~~ **Resolved (D11)** | `tsc --noEmit` failed at `validate-ce5.ts:604` | Row type added; 0 errors (§A.4) |
| K20 | **High: production-blocking** | Promoted to formal finding **PR-1-SEC-FIN-001** (§K.1 below) | Sandbox-only until resolved |
| K21 | ~~Low~~ **Resolved (D2)** | Archive packaging debris | The normalized git tree is authoritative; the archive is preserved under `archive/` (§A.4) |
| K22 | Medium | CE-3 commercial-event attribution falls back to a hard-coded provider: `providerOrganizationId: handoff?.providerOrganizationId \|\| 'org_apex'` (`server.ts` `BASELINE_ACTIVATED` projections, two sites). A handoff without a provider attributes a commercial event, and so any downstream rating, to `org_apex`. | Same pattern as the consent fallback (K8). Fail closed. Not fixed here: it is commercial scope, recorded for PR-1 alongside PR-1-SEC-FIN-001. |

---

### K.1 PR-1-SEC-FIN-001: Privileged Commercial Operations Authorization

**Status:** OPEN · **Severity:** production-blocking · **Owner phase:** PR-1 · **Recorded:** 2026-10-03 · **Not implemented in PR-0A.**

**Finding.** Operations that require Open Policy accounting authority are currently authorized only by the caller's *provider* identity, and that identity is the spoofable `x-provider-user-id` header. Two routes are not authorized at all. **Owning the affected invoice, payment or event is treated as authority over it. It is not.** Authentication establishes identity; authorization (RBAC) establishes authority; the audit record records the resulting actor. The free-text `authorizedBy` field is none of these.

| Route (server.ts) | Current gate | Actor class that should hold authority |
|---|---|---|
| `POST /api/commercial/payments` (L2090) | Provider owns invoice | Finance/admin, or a system actor confirming an external payment processor |
| `POST /api/commercial/refunds` (L2126) | Provider owns payment | Finance/admin |
| `POST /api/commercial/billable-events/:id/adjustments` (L1812) | Provider owns event; `authorizedBy` is free text | Finance/admin |
| `POST /api/commercial/invoices/generate-draft` (L2047) | Provider org | Operator or system |
| `POST /api/commercial/invoices/:id/finalize` (L2073) | Provider org | Finance/admin |
| `POST /api/commercial/billing-periods` (L1975) | Provider org | Operator or system |
| `POST /api/commercial/billing-periods/:id/close` (L2005) | Provider org | Operator or system |
| `POST /api/commercial/agreements/:id/transition` (L1688) | Provider org | Operator, except a provider-initiated termination request |
| `POST /api/commercial/agreements/enroll` (L1649) | Provider org | Provider may *request*; operator accepts or activates |
| `POST /api/commercial/rating/evaluate-event` (L1846) | **None** unless the provider header is present; omitting it skips the tenant check | System |
| `POST /api/commercial/events/reconcile` (L1949) | **None** | System or operator |

**Required actor classes (minimum):** `PROVIDER`, `OPEN_POLICY_OPERATOR`, `OPEN_POLICY_FINANCE_ADMIN`, `SYSTEM_SERVICE`.

**Constraints on the fix.**
- The CE-5 ledger model (append-only refunds, settlement allocations, reconstructed balances) is not reopened. This is a boundary defect, not a model defect.
- No CE-6.
- Every route above needs an explicit authority classification, a server-verified actor, and that actor's identity in the audit record.

**Until resolved:** these routes are **sandbox-only and non-production-capable**. No deployment that handles real providers or real money may expose them.

## L. Implementation Plan (after approval)

**Step 0 (housekeeping, separate commits).** Commit the extracted source tree, without nested zips, prompt files or `.env`. If D11 is approved, isolate the validators and fix the `tsc` error. Add `scripts/run-all-validators.ts` with per-suite timeouts. No behavior change; the regression baseline is re-recorded.

**Add:**

| File | Purpose |
|---|---|
| `src/types/jurisdiction.ts` | All §E types. Re-exported from `insurance.ts` (one additive line). |
| `src/domain/jurisdiction/usJurisdictions.ts` | The 51 codes and names (reference data, no law) |
| `src/domain/jurisdictionRuleEngine.ts` | Pure evaluator: `resolveRulesInForce(ruleSet, date)` and `evaluate(ruleSet, point, facts, date)` |
| `src/domain/providerAuthorityEngine.ts` | Pure, derived provider authority (§E.6) |
| `src/domain/jurisdictionDetermination.ts` | Pure signal reconciliation (§E.7) |
| `src/domain/marketActivationEngine.ts` | Pure state machine, gates and `displayStatus` (§I) |
| `src/domain/rulesetGovernance.ts` | Publication, supersession, withdrawal, four-eyes, canonical content hash |
| `src/server/db/jurisdictionStore.ts` | Awaited PGlite persistence and immutability enforcement |
| `src/server/db/seeds/legacyJurisdictionSeed.ts` | The NV/OH/CA registry migrated as `UNVERIFIED` legacy data, plus SANDBOX activations |
| `src/domain/jurisdiction.test.ts` | Domain tests (§J) |
| `scripts/validate-pr0a.ts` | HTTP and integration acceptance (§J), plus the extended firewall |

**Modify (additive only):**

| File | Change |
|---|---|
| `src/server/db/migrate.ts` | Append `SQL_MIGRATION_V8` and its `_migrations` insert |
| `src/server/db/schema.ts` | Drizzle definitions for the new tables and columns |
| `server.ts` | Baseline creation propagates jurisdiction. Challenge creation uses determination, the activation gate and anchoring, and removes `'NV'`. Read-only `GET /api/jurisdictions`, `/api/jurisdictions/:code/rulesets` and `/api/jurisdictions/:code/activation`. **No mutation endpoints until PR-1 auth exists**; mutations are store-level and CLI-only. |
| `src/server/db.ts` | Shadow-mode evaluation at offer submit and revision. Persist the anchors. Replace the `'org_apex'` consent fallback with a hard failure (K8). |

**Explicitly not modified in PR-0A:** all five protected engines, `eligibilityEngine.ts`, every existing test and validator, the CE files, and all UI components.

### Decisions requested

| ID | Decision | My recommendation |
|---|---|---|
| D1 | ~~Supply the CE-3–CE-5 snapshot~~ | **Done** (rev. 2) |
| D2 | Commit the extracted source tree | **APPROVED 2026-10-03; executed** (§A.4) |
| D3 | Interval-end naming | **APPROVED**: `effectiveFrom` inclusive, `effectiveUntil` exclusive or null (§M) |
| D4 | Shadow mode in PR-0A | **APPROVED**, with discrepancy recording (§M) |
| D5 | SANDBOX vs PRODUCTION | **APPROVED**, as a no-fallback invariant (§M) |
| D6 | Frozen-code jurisdiction defects | **APPROVED as a separate pre-PR-0A correction set; executed** in `51d1444` (§A.5) |
| D7 | Two-axis market state | **APPROVED** (§M) |
| D8 | Coverage taxonomy expansion | **APPROVED, outside PR-0A**: its own review before PR-0C, backward-compatible (§M) |
| D9 | Suspension semantics | **APPROVED WITH CHANGE**: an explicit `SuspensionAction`, defaulting to manual review (§M) |
| D10 | Evaluation dates | **APPROVED as the initial model**, with a rule-addressable `RuleEvaluationContext` (§M) |
| D11 | Validator isolation; each suite establishes its own prerequisites; fix `tsc`; no assertions weakened | **APPROVED 2026-10-03; executed** (§A.4) |
| D12 | Replace PM-5's obsolete "zero billing tables" assertion with the real PM-5/CE-5 boundary | **APPROVED 2026-10-03; executed** (§A.4) |

**Stopping here.** PR-0A implementation begins only after the stabilization PR is reviewed and merged into `main`, from that merge SHA.

---

## M. Decision Record: D3–D10 (ruled 2026-10-03)

These rulings are binding design constraints for PR-0A and later phases. Where §E–§J differ, **this section governs.**

**D3. Effective intervals: APPROVED.**
- `effectiveFrom` is inclusive. `effectiveUntil` is exclusive, or null.
- A rule applies when `effectiveFrom <= evaluationDate < effectiveUntil`, or when `effectiveFrom <= evaluationDate` and `effectiveUntil IS NULL`.
- Use calendar dates wherever the legal source acts by effective date. **Never infer intraday effectiveness from a date-only source.** If an authority genuinely sets an effective *time*, model it explicitly rather than folding it into the date convention.

**D4. Shadow mode: APPROVED.**
- PR-0A may resolve jurisdiction, resolve the ruleset, evaluate rules, produce an evaluation, and audit it.
- It **must not change** `offer.isQualified`, provider eligibility, challenge creation, competition participation, selection, binding or reconciliation.
- Shadow mode is a parallel evaluation: frozen behavior vs. the new engine's result. **Discrepancies are recorded explicitly** and never forced into agreement to make shadow tests green.
- The legacy NV/OH/CA registry retires in PR-0C, not PR-0A. Its citation-pinned frozen tests stay untouched until that migration is deliberately approved.

**D5. Market environment: APPROVED as an invariant.**
- *A sandbox market activation can never authorize a production transaction.*
- `MarketEnvironment = SANDBOX | PRODUCTION`. Activation identity includes at least `(jurisdiction, insuranceLine, environment)`.
- **No fallback**: a missing PRODUCTION activation never resolves to SANDBOX. An acceptance test proves this.

**D6. Frozen-code defects: APPROVED as a separate pre-PR-0A correction set.** Executed (§A.5).

**D7. Two-axis market state: APPROVED.**
- Axis 1, regulatory readiness (`NOT_CONFIGURED`, `RESEARCHING`, `RULES_IN_REVIEW`, `RULES_VERIFIED`), is **derived only** and never stored as mutable truth.
- Axis 2, operational activation (`INACTIVE`, `PILOT`, `ACTIVE`, `SUSPENDED`), is **event-sourced**.
- Human-facing states such as `PROVIDERS_REQUIRED` are projections of the two axes plus gate attestations, never maintained by hand.

**D8. Coverage taxonomy expansion: APPROVED, outside PR-0A.**
- It is its own change set, *Canonical Coverage Taxonomy Expansion*, completed before PR-0C enforcement, with its own architecture review, acceptance suite and regression gate (it touches the protected comparison engine).
- **Backward compatibility is mandatory.** `UM_UIM` is not simply replaced. Legacy combined `UM_UIM` evidence stays representable as a legacy or combined fact, while newly extracted policies can express distinct structures (UM, UIM, UMPD, PIP, CSL and so on). Migration semantics are designed deliberately.
- In the interim, rules needing coverages the taxonomy lacks evaluate to `INDETERMINATE`, never `PASS`.

**D9. Suspension: APPROVED WITH CHANGE.** A suspension blocks new challenges immediately, records stay reconstructable, and revoking a gate raises a critical operational review rather than silently suspending a market. `SUSPENDED` does **not** carry one universal in-flight behavior:

| Under SUSPENDED | Disposition |
|---|---|
| VIEW, AUDIT/EXPORT | allowed |
| NEW_CHALLENGE, NEW_INVITATION, NEW_PROVIDER_ENTRY, NEW_BINDING | blocked |
| SELECTION, DISCLOSURE | HOLD; governed by the suspension's action |

Each suspension event carries an explicit `SuspensionAction`: `FREEZE_ALL_PROGRESS`, `ALLOW_SELECTION_ONLY`, `ALLOW_EXISTING_TO_COMPLETE` or `REQUIRE_MANUAL_REVIEW`. **The default is `REQUIRE_MANUAL_REVIEW`**: no new consequential transition until reviewed. This supersedes the earlier "allow viewing and selection" proposal.

**D10. Evaluation dates: APPROVED as the initial temporal model**, subject to primary-law verification in PR-0B/PR-0C.
- **Invariant:** regulatory evaluation uses the legally relevant transaction or effective date, never the server clock.
- Initial mapping:
  - Offer coverage qualification → proposed policy effective date
  - Provider authority → participation date, re-checked at binding
  - Consent → transaction date
  - Controlled disclosure → transaction date
  - Binding authority → binding date
- The mapping is **not** a universal assumption. Each executable rule declares which temporal fact it consumes from a `RuleEvaluationContext`: `policyEffectiveDate`, `transactionDate`, `invitationDate`, `offerSubmittedDate`, `selectionDate`, `disclosureDate`, `bindingDate`, `issuedPolicyDate`. This set is extensible, for example for application, renewal or notice dates.
- **If the required date is unknown, the result is `INDETERMINATE`**, never the server clock and never a guessed date.

**Housekeeping rulings.**
- No credential rotation is indicated.
- Restrict the Firebase browser key in Google Cloud as defense in depth.
- `npm ci --legacy-peer-deps` stays a documented build requirement; no dependency modernization now.
- PM-5's suite-specific restart folder is acceptable.
- The normalized baseline becomes authoritative when the stabilization PR merges into `main`. **Its merge SHA is the canonical starting point for PR-0A.**

---

## N. PR-0A Implementation Record (rev. 5)

**Canonical baseline:** `6cc90208d53172a4dc46a9137111eb6f383920f8`, the merge of PR #1. Its tree is byte-identical to the verified head `69003bb`.
**Mode:** SHADOW (D4). No frozen outcome changes, with the one exception in N.3.

### N.1 What was built

| Layer | File | Responsibility |
|---|---|---|
| Vocabulary | `src/types/jurisdiction.ts` | All PR-0A types: provenance, rulesets and rules, the closed `MachineRule` union, `RuleEvaluationContext` (D10), outcomes, activation axes (D7), `SuspensionAction` (D9), `MarketEnvironment` (D5). No score, rank, order, priority or weight anywhere. |
| Reference | `src/domain/jurisdiction/usJurisdictions.ts` | The 51 codes and names. No law. |
| Pure engine | `src/domain/jurisdictionRuleEngine.ts` | Per-rule temporal basis; `effectiveFrom <= date < effectiveUntil` on calendar dates; unknown date or fact gives `INDETERMINATE`; uncovered taxonomy gives `INDETERMINATE` (D8) |
| Pure engine | `src/domain/providerAuthorityEngine.ts` | Authority derived from license and appointment evidence plus in-force requirements. Never reads `org.states`, appetite or commercial capacity. Exact carrier match; jurisdiction-, line- and date-scoped appointments. |
| Pure engine | `src/domain/jurisdictionDetermination.ts` | Evidence signals become PROPOSED, CONSUMER_CONFIRMED, CONFLICT or UNRESOLVED. No ZIP inference, no default. |
| Pure engine | `src/domain/marketActivationEngine.ts` | Derived readiness and event-sourced activation (D7); no environment fallback (D5); production gates; TEST_FIXTURE guard; D9 disposition table |
| Pure engine | `src/domain/rulesetGovernance.ts` | Publication validation (four-eyes, VERIFIED, sources, interval integrity), supersession, withdrawal, discard, order-independent content hash |
| Persistence | `src/server/db/migrate.ts` (`SQL_MIGRATION_V8`), `postgresStore.ts` | Migration `0008_jurisdiction_framework`: 11 tables, nullable additive columns, 9 indexes, and immutability **triggers** (verified working in PGlite) |
| Persistence | `src/server/db/jurisdictionStore.ts` | Awaited writes only; lifecycle enforced by the pure engines, and again by triggers |
| Seed | `src/server/db/seeds/legacyJurisdictionSeed.ts` | NV/OH/CA legacy registry migrated **verbatim as IN_REVIEW rulesets with UNVERIFIED rules**; citation sources labelled "not retrieved from or verified against the official source"; SANDBOX fixture activations only when the deployment environment is SANDBOX |
| Orchestration | `src/server/jurisdictionShadow.ts` | The only bridge to marketplace flows. It records append-only evaluations with explicit discrepancies, and `inShadow()` guarantees a shadow failure never alters a response. |
| HTTP | `server.ts` | The two hard-code fixes (N.3); shadow hooks at challenge open, each invitation, offer submit and revise, and invitation acceptance (before CE-2 capacity consumption); read-only `GET /api/jurisdictions`, `/api/jurisdictions/:code/rulesets`, `/api/jurisdictions/:code/market`, `/api/jurisdiction-evaluations`. **No mutation endpoints** until PR-1 authorization. |
| Types (additive) | `src/types/insurance.ts` | Optional `ProviderLicense.providerUserId/npn/verification*`, `CarrierRelationship.effectiveFrom/Until/verification*`, and `Challenge` anchor fields |
| Config | `.env.example` | `OPENPOLICY_MARKET_ENVIRONMENT` (default SANDBOX) |
| Tests | `src/domain/jurisdiction.test.ts`, `scripts/validate-pr0a.ts` | 76 pure-engine assertions on fictional X1/X2, plus 93 integration assertions: 169 in total |

**Not modified:** all five protected engines, `eligibilityEngine.ts`, every existing test and validator, all CE files, all UI.

### N.2 Rulings realized

| Ruling | How it is enforced | Proven by |
|---|---|---|
| D3 | `isRuleInForce`; `DATE` columns; `CHECK (effective_until > effective_from)`; timestamps rejected as dates | DATE-1..4, 8 |
| D4 | `jurisdictionShadow.ts` + `inShadow`; legacy registry untouched; discrepancies recorded with `legacyOutcome` | §8 of `validate-pr0a`: `isQualified` equals an independent frozen-engine run; the 10/20/5 NV offer is recorded as FAIL vs STATUTORY_PASS |
| D5 | Activation keyed by environment in both engine and SQL; no code path reads another environment | MKT-2; `validate-pr0a` §6, §7. A mutation removing the environment filter is caught. |
| D6 | (prior change set) | `validate-pr0a` §10 re-checks |
| D7 | `deriveReadiness` (never stored), event-sourced `market_activation_events`, `displayStatus` projection | MKT-17..19 |
| D8 | `CANONICAL_COVERAGE_CODES` guard, giving `INDETERMINATE` | EXEC-11 |
| D9 | `SuspensionAction` required on every suspension (DB `CHECK`), default `REQUIRE_MANUAL_REVIEW`; disposition table; gate revocation never auto-suspends | MKT-8, 11..16; `validate-pr0a` §6 |
| D10 | `JurisdictionRule.temporalBasis` against `RuleEvaluationContext.dates`; unknown date gives `INDETERMINATE` | DATE-7, 9 |
| §G ordering | Authority is evaluated at acceptance **before** `consumeEngagementCapacity`; activation is evaluated before invitations are recorded. Shadow only; enforcement is PR-0C. | `validate-pr0a` §8 |

### N.3 The one observable behavior change, for your ruling

Removing the `server.ts` hard-code means a policy with **no jurisdiction evidence** now gets `422 JURISDICTION_UNDETERMINED` at challenge creation. Before, it was silently stamped `NV`.

This change comes from the approved hard-code removal and the D6 principle ("missing jurisdiction must become explicit uncertainty"), **not** from rule or activation evaluation, which stay shadow-only. No existing suite exercised the old silent default.

The policy's stated state is the evidence. The baseline's copy is a cross-check, so a disagreement between them is a CONFLICT. That matters because the seeded fixture baseline `BL-NV-49281` omits `jurisdiction`; its policy carries NV.

### N.4 What shadow mode is already showing (expected, recorded, not reconciled)
- **Offer coverage.** NV offers below the legacy registry's recorded minimums are FAIL in shadow and qualified by the frozen engine, which never compares limits. This is exactly the gap D6 exposed in wording.
- **Provider authority.** Every invitation is INDETERMINATE in shadow vs. ELIGIBLE in the frozen engine. No `PRODUCER_AUTHORITY` requirement exists for any real jurisdiction until PR-0B research, and license evidence alone cannot establish which license the law requires.
- **Challenge opening.** It is PASS for NV, OH and CA (SANDBOX fixture activations). For any other jurisdiction it would be BLOCK (INACTIVE), recorded as a discrepancy.

### N.5 Design decisions taken while building (flagged for confirmation)
1. **A `DISCARDED` ruleset status was added.** Review history is append-only, so an abandoned draft cannot be deleted. Its rules are removed and the record stays.
2. **Rules are verified while their ruleset is DRAFT.** `IN_REVIEW` freezes rule content, so review means approving exactly what was verified. The flow is: author drafts → second person verifies (DRAFT) → submit → third person, or anyone but the author, publishes.
3. **Gate revocations live in their own append-only table**, rather than being an update to an attestation.
4. **The transaction date is the UTC calendar date** in PR-0A. Jurisdiction-local legal-date conversion is a PR-0B/0C determination.
5. **A license expiring *on* the evaluation date gives INDETERMINATE.** Expiration-day semantics are unverified.
6. **Activation does not force PILOT before ACTIVE.** That ordering was never ruled on.

### N.6 Open questions for you
- **D9 tension.** Your table blocks `NEW_BINDING` under every suspension, but `ALLOW_EXISTING_TO_COMPLETE` implies in-flight transactions can finish. As implemented, that action allows SELECTION and DISCLOSURE but **NEW_BINDING stays BLOCKED**. Should in-flight binding be allowed under that action?
- Should PRODUCTION activation require passing through PILOT?
- The `generate-proof` route's `jurisdiction || 'NV'` default (`server.ts`, governance proof, related to K5) remains. It is pinned with K5 and was not in D6 or PR-0A scope.

### N.7 Validation
See the PR description for the multi-order results on the final tree.

### N.8 Rulings on §N (2026-10-03), binding

| Item | Ruling | Implementation |
|---|---|---|
| N.3 | **APPROVED as permanent behavior.** Known jurisdiction: continue. Conflicting evidence: `422 JURISDICTION_CONFLICT`. Insufficient evidence: `422 JURISDICTION_UNDETERMINED`. Never invent one. | Distinct `JURISDICTION_CONFLICT` code added; both paths tested over HTTP |
| D9 / N.6 | **Keep as built.** `ALLOW_EXISTING_TO_COMPLETE` allows VIEW, existing offers, SELECTION and DISCLOSURE. **BINDING, new challenge, new invitation and new provider entry stay BLOCKED.** Binding an in-flight transaction during a suspension requires a future explicit, authorized override (actor, reason, scope, audit record), never a blanket exemption. | Unchanged (MKT-11, 14). The override mechanism is a later change set, with no binding enforcement before PR-0C. |
| N.6 pilot | **The first PRODUCTION activation must pass through PILOT.** Once a PRODUCTION pilot has completed, `SUSPENDED -> ACTIVE` is allowed (subject to gates). A SANDBOX pilot never counts. | `productionPilotCompletion()` is derived from immutable history (a PRODUCTION `PILOT -> ACTIVE` event); its event id is the pilot approval reference. There is no mutable flag. (MKT-21..24) |
| 4A | **`DISCARDED` approved and terminal, reachable only from DRAFT.** It can never be published. Resurrecting its content means a new draft with provenance linking back. | `canDiscard` accepts DRAFT only; a governed `returnToDraft` (IN_REVIEW -> DRAFT, with actor and reason) records the history; a trigger makes DISCARDED immutable. A provenance link for resurrected drafts is deferred to PR-0E. |
| 4B | **Verify while DRAFT, approved.** Publication freezes exactly what was verified; a substantive change after verification makes that verification stale. | A trigger resets a DRAFT rule to UNVERIFIED (clearing verifier and time) on any substantive column change; tested |
| 4C | **UTC calendar date approved for PR-0A only.** Before enforcement, each jurisdiction needs this chain: event timestamp → jurisdiction → its time-zone rule → legally relevant date. Some dates are not transaction-derived at all (D10). | Unchanged; tracked for PR-0B/0C |
| 4D | **A license expiring on the evaluation date is INDETERMINATE until PR-0B establishes the semantics from the licensing authority.** | Unchanged (AUTH-5) |
| Legacy NV/OH/CA | **Not verified law.** PR-0B must independently establish each value from primary sources before it can become executable production authority. | They remain IN_REVIEW and UNVERIFIED |
| Audit proof | The `generate-proof` `\|\| 'NV'` default and the regulator-certificate wording (K5) stay unchanged in PR-0A, because of the pinned frozen test. **They go into the PR-0C legacy-retirement and change-control package.** | Tracked for PR-0C |

**Sequence:** merge #2 (done) → rebase PR-0A onto `main` → full validation → push → PR #3 → independent CI → review. **PR-0B does not begin until PR-0A is merged.** At that point PR-0B becomes the 51-jurisdiction primary-authority research and regulatory-data programme.
