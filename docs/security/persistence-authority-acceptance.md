# Open Policy Persistence Authority Acceptance

## Control record

- Starting SHA: `2ee398a2695d69b17c2eddfa936ea88f7fb709d2`
- Canonical branch: `claude/eager-curie-yqreig`
- Canonical GCP project: `openpolicy-35f82`
- Explicitly excluded project: `openpolicy-510702`
- Starting live revision: `openpolicy-acceptance-00009-yiy`
- Current local candidate: `415f8e2` plus the documented Cloud SQL client timeout hardening
- Current disposition: **NOT READY — IMPLEMENTATION/SECURITY DEFECT**
- Merge status: not authorized

This is a living acceptance record. A row is not complete until its production read
authority, write authority, restart behavior, multi-instance behavior, and tests are
evidenced. Cloud SQL containing a write-through copy is not sufficient.

## Persistence authority invariant

Production business truth must flow from PostgreSQL/Cloud SQL through a repository
and domain operation to the API. A database commit defines mutation success. A
process-local structure may be a cache or projection only when an empty process can
reconstruct it from durable state without changing business truth.

## Initial repository-wide inventory

The initial inspection found one process-wide `PolicyChallengeDatabase` singleton in
`src/server/db.ts`. It owns the maps listed below and is called synchronously by
`server.ts`. Many mutations update those maps first and start an unawaited
`PostgresStore.save*().catch(...)` operation. Consequently, a successful HTTP response
can currently precede the durable commit, a database error can leave a successful
memory-only mutation, and another Cloud Run instance can read stale or absent state.

`PostgresStore`, `CommercialStore`, and `JurisdictionStore` are asynchronous durable
repositories. Commercial and jurisdiction operations already use the durable client
directly; their remaining process-local `Map`/`Set` instances are request-local derived
groupings rather than business authorities.

## Persistence Authority Matrix

| Domain/state holder | Representative operations | Current read authority | Current write authority | Durable table/repository | Restart safe | Multi-instance safe | Classification | Required remediation | Acceptance coverage |
|---|---|---|---|---|---:|---:|---|---|---|
| Policies | upload, verify, lookup | `db.policies` | memory; incomplete durable call paths | `policies` / `PostgresStore` | No | No | MIGRATION_REQUIRED | durable reads and commit-first writes | restart, cross-process, failure injection |
| Baselines and consumer requirements | create baseline, challenge creation, later comparison | `db.baselines`, `db.requirements`, embedded challenge copies | memory only/embedded copies | no canonical baseline or requirements table | No | No | MIGRATION_REQUIRED | forward-only schema plus repositories; preserve embedded historical snapshots | restart and lifecycle continuation |
| Challenges | create/list/get/final round/keep current | `db.challenges` | memory first, unawaited `saveChallenge` | `challenges` | No | No | MIGRATION_REQUIRED | repository reads; transactional commit-first lifecycle updates | consumer ownership, restart, cross-instance |
| Offers and offer versions | submit/revise/qualify/version lookup | `db.offers`, `db.offerVersions` | memory first, unawaited saves | `offers`, `offer_versions` | No | No | MIGRATION_REQUIRED | repository reads and transactionally coupled offer/version changes | provider isolation, version concurrency |
| Offer verification | verify/read | `db.offerVerifications` | memory first, unawaited save | `offer_verifications` | No | No | MIGRATION_REQUIRED | durable read and awaited commit | restart/failure |
| Provider organizations/users/licenses/relationships/appetites | directory, identity mapping, opportunity evaluation | `db` maps; two routes use PostgreSQL then memory fallback | seeded memory plus durable seed | PM-1 provider tables / `PostgresStore` | Partial | No | MIGRATION_REQUIRED | remove production memory fallback; durable canonical reads and writes | unknown mapping and cross-org tests |
| Competitions | open/advance/evaluate/deadlines | `db.competitions` | memory first, unawaited save | `competitions` | No | No | MIGRATION_REQUIRED | transactional conditional updates/version control | concurrent advance, restart, cross-instance |
| Invitations and participation | view/accept/decline/withdraw | `db.challengeInvitations`, `db.challengeParticipations` | memory first, multiple independent unawaited saves | `challenge_invitations`, `challenge_participations` | No | No | MIGRATION_REQUIRED | one transaction for invitation, participation, competition and commercial effects | idempotency, org isolation, cross-instance |
| Competition activity | feed/activity append | `db.competitionActivityEvents` | memory only | no authoritative table identified | No | No | MIGRATION_REQUIRED | append-only durable table and scoped reads | ordering, restart, duplicate retry |
| Information requests and supplemental facts | create/answer/consent/read | `db.informationRequests`, `db.verifiedSupplementalFacts` | memory first, unawaited saves | PM-2 tables | No | No | MIGRATION_REQUIRED | repository reads; transaction request answer plus fact creation | consent/org scoping and failure |
| Selection, consent, disclosure and binding | select/grant/revoke/disclose/status | four `db` maps | memory first, independent unawaited saves | PM-4 tables | No | No | MIGRATION_REQUIRED | transactionally persist coupled lifecycle transitions before success | ownership, participant, restart, cross-instance |
| Issued documents/snapshots/reconciliation/vault | upload/reconcile/review/read | four `db` maps | memory first, independent unawaited saves | PM-5 tables | No | No | MIGRATION_REQUIRED | durable reads and atomic reconciliation/vault transitions | consumer ownership, retry, restart |
| Legacy handoff/dossier/detailed reconciliation | dossier and legacy reconciliation routes | `db.bindingDossiers`, `db.detailedReconciliations`, legacy maps | memory only or partial PM-4/5 overlap | incomplete canonical repository coverage | No | No | MIGRATION_REQUIRED | reconcile model overlap without changing domain semantics; add schema only where necessary | compatibility and lifecycle continuation |
| Notifications | recipient list/read | `db.notifications` | memory first plus unawaited durable synchronization | `platform_notifications` has writes, no canonical read method | No | No | MIGRATION_REQUIRED | recipient-scoped durable reads and awaited read-state mutation | consumer/provider/operator ownership |
| Audit events | operator read/proof/chain | `db.auditEvents` | memory first, unawaited save | `audit_events` | No | No | MIGRATION_REQUIRED | append durably before dependent success; define chain serialization | chain integrity, concurrent append, restart |
| Review queue | list/resolve/enqueue | `db.reviewQueue` | memory only | no authoritative table identified | No | No | MIGRATION_REQUIRED | durable queue with conditional resolution | concurrent resolution and restart |

## Implementation status through `415f8e2`

The table above is the discovery baseline, not the current implementation state. The
following families have since crossed to PostgreSQL authority with commit-first writes,
durable reads, audit coupling, and focused restart/idempotency evidence:

- policies, coverage baselines, consumer requirements, challenges, and provider identity;
- invitations, participation, offers, immutable offer versions, and offer verification;
- information requests, supplemental facts, and fact-consent history;
- notifications, audit-chain state, review queue, and governance reads;
- PM-4 selection, consent/revocation, controlled disclosure, binding modifications,
  binding status, and handoff reads;
- PM-5 issued evidence, normalized snapshots, reconciliation, consumer review,
  Policy Vault filing, canonical issued policy, and future baseline activation;
- competition reads, sealed signals, activity, deadlines, round advancement, offer
  revision, provider withdrawal, and incumbent-policy retention.

The old dossier and detailed-reconciliation route family duplicates the canonical PM-4
and PM-5 model. It is classified as obsolete compatibility authority and now fails with
HTTP 410 instead of creating new process-local business truth. Its in-memory structures
may remain only until callers and tests are confirmed migrated; they are not a production
authority.

The repository-wide rescan now finds no production HTTP business operation that uses
`PolicyChallengeDatabase` as its read or mutation authority. Remaining `db` references
in `server.ts` are limited to metrics, the explicitly fixture-only reset and synthetic
competitor routes, and the ordered fixture-to-PGlite synchronizer used by validators.
The singleton maps remain test/fixture compatibility state and are not reachable as
production marketplace authority. Commercial-event reconciliation now scans durable
PostgreSQL state rather than the singleton.
| Redis-named cache | internal TTL values | `db.redisCache` | process-local | none required if never business truth | Yes* | Yes* | CACHE_ONLY | prove all misses rebuild from durable source; rename/document if retained | empty-cache tests |
| Commercial economics | enrollment, usage, rating, invoicing, payment and settlement | `CommercialStore` SQL queries | transaction-backed SQL | commercial tables | Yes | Yes | DURABLE_AUTHORITATIVE | regression and connection/failure verification only | CE suites plus cross-process representative case |
| Jurisdiction/PR-0A | registry, rules, activation and evaluations | `JurisdictionStore` SQL queries | awaited SQL/transactions | jurisdiction tables | Yes | Yes | DURABLE_AUTHORITATIVE | preserve shadow behavior; no PR-0B promotion | PR-0A and semantic corrections |
| Engine-local maps/sets | qualification, comparison, rule evaluation | request-local grouping | none | derived from input | Yes | Yes | DERIVED_REBUILDABLE | no change | protected engine suites |
| Canonical fixtures | validators and explicit fixture auth | explicitly configured test process | isolated PGlite/test data | isolated test storage | n/a | n/a | FIXTURE_TEST_ONLY | retain production prohibition | production fixture rejection |

`Yes*` for the cache means correctness is restart/multi-instance safe only after every
cache miss is proven to resolve from PostgreSQL. It is not yet accepted.

## Required implementation sequence

1. Add missing forward-only schema and repository methods.
2. Introduce an asynchronous durable domain boundary; remove HTTP-layer synchronous
   reliance on `PolicyChallengeDatabase` maps.
3. Convert reads before mutations for each lifecycle slice.
4. Convert coupled mutations to database transactions with concurrency controls.
5. Remove every production database-to-memory fallback and every unawaited write.
6. Add empty-memory, restart, cross-process, transaction-failure, retry, and security
   acceptance tests.
7. Run the full protected regression from a clean install.
8. Deploy only after local acceptance, prove live durability, then complete this record.

## Evidence status

### Local acceptance evidence — 2026-10-06

- canonical validators: **11/11 suites pass**;
- authorization regression: **32/32 pass**;
- adversarial HTTP security probes: **19/19 pass**;
- clean detached checkout at `415f8e2`: clean `npm ci`, TypeScript, production client
  and server builds, and all 11 canonical validators pass;
- restart evidence covers provider/competition/invitation/participation/audit, PM-2,
  PM-4 foundation state, PM-5 issued evidence/reconciliation/vault, and the foundation
  lifecycle continuation from an empty process;
- commercial concurrent-capacity acceptance proves one final unit cannot be consumed
  twice; retry and phantom-consumption tests pass;
- no deployment or merge was performed by this acceptance pass.

### Cloud SQL hardening review — stop condition

The authorized project was verified as `openpolicy-35f82`; `openpolicy-510702` was not
accessed. `openpolicy-db` is PostgreSQL 16, zonal `db-f1-micro`, 10 GB SSD with automatic
growth, seven retained automated backups, and deletion protection. Cloud Run uses the
dedicated `openpolicy-runtime` service account, Secret Manager password injection,
durable-storage fail-closed configuration, and a five-connection application pool.

The instance still reports a public IPv4 address, `connectorEnforcement=NOT_REQUIRED`,
and `sslMode=ALLOW_UNENCRYPTED_AND_ENCRYPTED`. Cloud Run currently connects through the
Cloud SQL Unix socket, but the instance-level policy still permits connection paths
outside the connector and does not require encryption. Tightening connector enforcement
and SSL is a production access-control change and may interrupt non-connector clients;
it requires founder authorization and an inventory of legitimate database clients
before mutation. The client candidate adds bounded connection, idle, statement, and
query timeouts, but no new revision has been deployed.

Accordingly, local persistence authority is closed, but deployment/live durability and
the independent final review must wait on the Cloud SQL hardening decision. Current
phase result: **NOT READY — IMPLEMENTATION/SECURITY DEFECT**.
