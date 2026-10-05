# Open Policy final production acceptance

Date: 2026-10-04  
Starting SHA: `fc1028a`  
Final implementation candidate SHA: `5b096c7`  
Recommendation: **NOT READY — PERSISTENCE AUTHORITY REMAINS**

## Executive result

The local implementation and regression gates are green. Authentication now establishes identity only; route policy and resource/organization/recipient checks independently establish authorization. No BLOCKER or HIGH implementation finding remains in the reviewed branch diff. Merge is not authorized because real Firebase/GCP acceptance, deployed Firestore Rules verification, Firebase API-key restrictions, and real GitHub App acceptance cannot run without the external projects and credentials.

Commits added after the starting SHA:

- `2fbbe3b fix: close production security acceptance boundaries`
- `5b096c7 fix: persist notification recipient ownership`

## Authorization perimeter

The checked matrix contains 116 API route registrations and zero unresolved decisions:

| Classification | Count |
|---|---:|
| PUBLIC | 9 |
| CONSUMER | 21 |
| PROVIDER_USER / PROVIDER_ORGANIZATION | 47 |
| RESOURCE_PARTICIPANT | 14 |
| PLATFORM_OPERATOR | 24 |
| FIXTURE/DEVELOPMENT_ONLY | 1 |
| Unresolved | 0 |

The authoritative route-by-route record is `docs/security/api-authorization-matrix.md`. The marketplace user directory is ADMIN-only. Provider discovery is authenticated and returns only display name, organization type, states, and lines of business for active, approved providers. Synthetic competitor seeding is fixture-only and returns 404 in production.

## Notification ownership

Each notification now declares exactly one recipient authority: consumer, provider user, provider organization, or platform operator. Listing filters by the server-derived canonical recipient; mark-as-read repeats the same ownership assertion. Admin status does not confer read-as-user authority.

Migration `0009_notification_recipient_ownership` creates durable notification storage with database checks for exactly one recipient column and agreement between `recipient_type` and that column. Runtime validation runs before insertion, and read state is synchronized to durable storage. Canonical fixture notifications were deterministically assigned to the fixture consumer; unknown ownership has no fallback.

## Fixed identity and fallback disposition

The repository-wide review is recorded in `docs/security/fixed-identity-disposition.md`. Removed runtime fallbacks include challenge ownership, vault ownership, binding/commercial organization fallback, Firestore demo-data substitution, the PostgreSQL `usr_consumer_default`, and fixed consumer IDs in browser request bodies. Remaining `org_apex` and `user_consumer_1` values are seeds, tests, fixture identity, migrations, or non-authoritative display data. Fixture identity remains forbidden under `NODE_ENV=production`.

## Authentication, authorization, and session tests

- Authorization/security: **31/31 passed**.
- Identity/onboarding: **20/20 passed**.
- Covered malformed, expired, and revoked tokens; unknown Firebase profile; spoofed legacy headers; missing provider mapping; wrong actor type; consumer ownership; same-organization and cross-organization provider access; notification recipient classes; production fixture prohibition; Firestore rule invariants; and durable notification constraints.
- Client lifecycle tests prove normal token use, exactly one forced refresh after 401, successful retry, rejected refreshed token, failed refresh, sign-out failure handling, controlled reauthentication, and no retry loop.
- Production startup with missing `FIREBASE_PROJECT_ID` was executed against the built server and failed before listening, as required.

## Direct HTTP probes

The final candidate passed **19/19** direct probes:

| Probe | Result |
|---|---:|
| anonymous challenges | 401 |
| anonymous competition status | 401 |
| anonymous commercial rating history | 401 |
| challenge owner | 200 |
| wrong consumer | 403 |
| participating provider organization | 200 |
| cross-organization provider | 403 |
| spoofed provider organization | 403 |
| ordinary provider to admin | 403 |
| consumer vault | 200 |
| provider organization surface | 200 |
| commercial organization surface | 200 |
| binding surface, wrong consumer | 403 |
| nonexistent reconciliation resource | 404 concealment |
| consumer notification listing | 200 |
| provider denied consumer notification | 403 |
| correct consumer notification recipient | 200 |
| provider notification listing | 200 |
| production synthetic seeding | 404 |

## Reproducibility and regression

A fresh detached checkout of `5b096c7` completed `npm ci` without `--force` or `--legacy-peer-deps` and installed 356 packages. In that checkout:

- TypeScript: pass.
- Production client build: pass.
- Production server SSR build: pass.
- Authorization/security: 29/29 pass.
- Identity/onboarding: 18/18 pass.
- Direct HTTP probes: 19/19 pass.
- PM-1: 61/61.
- PM-2: 45/45.
- PM-3: 34/34.
- PM-4: 61/61.
- PM-5: 89/89.
- Commercial Economics: 95 parser assertions; 132 aggregate tests, zero failures.
- CE-3: 135 parser assertions.
- CE-4: 117 parser assertions; 38/38 acceptance tests.
- CE-5: 133 parser assertions; 42/42 acceptance tests.
- Semantic corrections: 13/13.
- PR-0A: 179/179.

No protected suite was removed, skipped, or weakened.

## Dependency advisory disposition

`npm audit --json` currently reports 15 production-tree package findings: 11 moderate and 4 high. This differs from the earlier 12-finding snapshot because npm's current advisory graph expands additional Google authentication packages. No forced audit fix was used.

| Package / installed version | Severity | Dependency path / affected behavior | Production reachability and remediation | Disposition |
|---|---|---|---|---|
| `@grpc/grpc-js@1.9.16` | HIGH | `firebase > @firebase/firestore`; unauthorized certificate reported authorized by server `getAuthContext` below 1.13.6; low error-detail advisory is also attached | Open Policy uses the Firebase browser Firestore client and does not operate a grpc-js server or call `getAuthContext`; Firebase currently offers no audit-resolvable upgrade | NOT_REACHABLE |
| `@firebase/firestore@4.17.2` | HIGH | `firebase`; inherits grpc-js advisory | Browser direct access is limited by owner-only Rules; vulnerable grpc server API is not invoked | ACCEPT_WITH_RATIONALE |
| `@firebase/firestore-compat@0.4.14` | HIGH | `firebase`; inherits Firestore advisory | Compat API is not imported by application code; upgrade follows Firebase upstream | NOT_REACHABLE |
| `firebase@12.19.0` | HIGH | direct; aggregate of Firestore packages | Used for Auth and modular Firestore, but not vulnerable grpc server behavior; no current audit fix | ACCEPT_WITH_RATIONALE |
| `uuid@9.0.1` | MODERATE | Firebase Admin Google Cloud chains | Advisory concerns v3/v5/v6 calls with caller-provided buffers; Open Policy does not call those APIs; patched at 11.1.1 but transitive pins require coordinated Admin upgrade | NOT_REACHABLE |
| `firebase-admin@13.10.0` | MODERATE | direct; Google Cloud Firestore/Storage aggregate | Admin Auth verification and Firestore profile mapping are production paths, but the vulnerable UUID buffer behavior is not called | UPGRADE_WITH_TESTING |
| `@google-cloud/firestore@7.11.6` | MODERATE | Firebase Admin > google-gax | Server profile reads are reachable; UUID buffer API is not | ACCEPT_WITH_RATIONALE |
| `@google-cloud/storage@7.22.0` | MODERATE | Firebase Admin > gaxios/auth/retry/teeny | Storage API is not used by Open Policy server code | NOT_REACHABLE |
| `google-gax@4.6.1` | MODERATE | Admin Firestore | Firestore transport is reachable; advisory operation is not | ACCEPT_WITH_RATIONALE |
| `google-auth-library@9.15.1` | MODERATE | Google Cloud transitive | Credential acquisition is reachable; affected UUID buffer API is not | ACCEPT_WITH_RATIONALE |
| `gaxios@6.7.1` | MODERATE | Google Cloud transitive | HTTP transport may be reached; affected UUID operation is not | ACCEPT_WITH_RATIONALE |
| `gcp-metadata@6.1.1` | MODERATE | Google auth transitive | Reachable only under metadata-based ADC; affected UUID operation is not | ACCEPT_WITH_RATIONALE |
| `gtoken@7.1.0` | MODERATE | Google auth transitive | Service-account token acquisition may be reached; affected UUID operation is not | ACCEPT_WITH_RATIONALE |
| `retry-request@7.0.2` | MODERATE | Cloud Storage transitive | Storage path is unused | NOT_REACHABLE |
| `teeny-request@9.0.0` | MODERATE | Cloud Storage transitive | Storage path is unused | NOT_REACHABLE |

Production-hardening debt: upgrade Firebase Admin and its Google Cloud dependency family in a dedicated change, then repeat identity, mapping, clean-install, canonical, and build acceptance. Do not use `npm audit fix --force`.

## Firebase configuration and Firestore trust boundary

Production requires `NODE_ENV=production`, `OPENPOLICY_AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, and one explicit Admin credential mechanism: uncommitted service-account JSON, `GOOGLE_APPLICATION_CREDENTIALS`, or intentionally declared platform ADC. Missing configuration fails startup; there is no fixture fallback. The browser uses the tracked Firebase web configuration, whose API key is public client configuration and still requires GCP restriction to the intended Firebase APIs and authorized origins.

Firestore direct browser access is limited to the signed-in user's own `users/{uid}`, `challenges`, `orders`, and `vault` records. User creation cannot assign ADMIN or canonical provider mapping fields, self-update cannot alter role/provider status, collection-wide user listing is denied, record IDs/owners cannot be changed, and all unlisted collections default deny. Server-side provider organizations, offers, competition, commercial data, and notifications receive no browser rule grant. `firebase.json` tracks `firestore.rules` for deployment. The tracked rules were deployed and exercised against the real project as recorded below. Firebase documents that tracked rules must be deployed before client access and that CLI deployment overwrites console rules: <https://firebase.google.com/docs/firestore/security/get-started>.

## App Check decision

**APP CHECK DEFERRED.**

Reason: the real Firebase project exists, but no web-app attestation provider or reCAPTCHA Enterprise key has been approved and configured. Risk: valid Firebase configuration can be exercised by an untrusted client, leaving Security Rules and authenticated server authorization as the primary controls. Production disposition: configure App Check for the web app, observe metrics, then enforce Firestore (and Authentication where selected) before public launch. Firebase recommends early enforcement for unreleased applications: <https://firebase.google.com/docs/app-check/monitor-metrics>.

## Real external acceptance

### Firebase — external acceptance executed

External acceptance ran against Firebase/GCP project `openpolicy-35f82` and the public Cloud Run acceptance service at `https://openpolicy-acceptance-224607016614.us-central1.run.app`. Email/password Authentication, the `(default)` Firestore database in `nam5`, deployed Firestore Rules, platform ADC, the dedicated `openpolicy-runtime` service identity, and the HTTPS authorized domain were exercised. The runtime identity has `roles/datastore.user` plus read-only `roles/firebaseauth.viewer`; no service-account key was created or downloaded.

Six temporary, isolated Firebase accounts covered two consumers, two providers in different canonical organizations, one platform operator, and one deliberately unmapped user. The real-project suite passed **18/18**: public HTTPS; anonymous denial; spoofed consumer/provider header denial; malformed token denial; unknown-profile denial; consumer admission and operator denial; provider mapping; participating-provider admission; cross-organization denial; operator admission; owner-only profile read; cross-user read denial; user-directory denial; role-escalation denial; provider-mapping injection denial; and revoked-token denial. All six Authentication users and profile documents were deleted after the run.

The Firebase browser key is restricted to the two Cloud Run service hostnames and local development origins. Firebase's automatically managed Firebase-only API target allowlist remains in place and does not include the Generative Language API. A post-restriction signup from the deployed HTTPS origin succeeded, the unmapped identity failed closed with 403, and the account was deleted. Final live smoke checks returned 200 for the public root and 401 for anonymous and spoofed-provider protected requests.

Deployment exposed and resolved two environment defects: revoked-token verification required the runtime's read-only Firebase Authentication Viewer role, and the tracked web configuration required an explicit `firestoreDatabaseId: "(default)"` for TypeScript reproducibility. The final Cloud Run revision uses production Firebase mode, one vCPU, a 2 GiB memory ceiling, zero minimum instances, and one maximum instance. A project-scoped USD 5 alert budget is configured at 50%, 90%, and 100%; budget alerts are not hard spending caps.

Firebase acceptance is **PASS for authentication, authorization boundaries, Rules behavior, and deployed HTTPS integration**. App Check remains deferred under the previously recorded decision.

### Cloud SQL — durable server persistence executed

The canonical `openpolicy-35f82` project now contains a PostgreSQL 16 Cloud SQL instance named `openpolicy-db` in `us-central1`. It uses the smallest shared-core `db-f1-micro` tier, 10 GB SSD storage with automatic growth, zonal availability, automated backups, and deletion protection. The application password was generated locally, stored only in Secret Manager as `openpolicy-db-password`, and granted only to the `openpolicy-runtime` service identity. The runtime also has Cloud SQL Client permission. No database password, root password, bearer token, or service-account key was printed or committed.

Production selects Cloud SQL through `CLOUD_SQL_INSTANCE`; local validators retain PGlite through explicit isolated data directories. `OPENPOLICY_REQUIRE_DURABLE_STORAGE=true` makes Cloud Run fail startup rather than silently falling back to an ephemeral database. The storage-selection tests pass in both onboarding and authorization suites.

The zero-traffic candidate completed all nine schema migrations, seeded canonical provider records, and returned HTTP 200. A replacement container then connected to the same database and reported the provider records already present, proving persistence across Cloud Run revision replacement. Real Firebase identity tests against the Cloud SQL revision passed **6/6**: consumer access, canonical provider mapping, participating-provider access, cross-organization denial, operator access, and revoked-token denial. All temporary identities were removed. The final fail-closed revision `openpolicy-acceptance-00009-yiy` serves 100% of the existing public URL's traffic.

Post-change reproducibility completed a clean `npm ci` of 371 packages, TypeScript, 20/20 onboarding tests, 31/31 authorization tests, production client/server builds, 19/19 direct HTTP probes, and all 11 canonical validator runs. The dependency audit remains 8 moderate and 4 high Firebase-family findings under the existing dispositions; the PostgreSQL driver introduced no additional advisory.

This closes ephemeral storage for entities already routed through `PostgresStore` and `CommercialStore`. It does **not** convert every in-memory map into an authoritative database read. The existing PR-0A reconciliation already records that several marketplace routes still treat the in-memory `db` as authoritative and use asynchronous write-through. Full production durability therefore still requires the bounded PR-1 persistence-authority conversion; this report does not mislabel the Cloud SQL connection as completion of that separate data-authority work.

### Custody-Core GitHub Milestone 3 — separate product, not an Open Policy gate

The GitHub App harness belongs to the sibling `Custody-Core` repository. It is not part of Open Policy, was not duplicated here, and does not gate the Open Policy recommendation.

## Secret and bundle scan

Tracked-name scan found only `.env.example`; `.env` is untracked/absent from the repository. Pattern scans found no private-key block, service-account identity, bearer token, GitHub token, OAuth secret, or credential material in tracked source or the production browser bundle. No secret value was printed into this report. The tracked Firebase web API key remains public client configuration, not an Admin secret.

## Independent full-diff review against `main`

The review covered every changed file, not only the final two commits:

`.env.example`; PR-0B reconciliation/dossier/manifest and NV dossier; all four security documents; `firebase.json`; `firestore.rules`; lockfile and package manifest; isolated-data, PR-0B, HTTP-probe, and validator scripts; `server.ts`; application routing/auth/admin/consumer/provider/telemetry components; Firebase configuration; identity, role, route, notification, database, commercial, migration, API-client, user-service, and insurance-type modules and tests.

Findings:

- BLOCKER: none in local implementation.
- HIGH: none in local implementation. The four npm HIGH package findings are unreachable/temporarily accepted as individually described above.
- MEDIUM: App Check remains deferred; Firebase Admin upgrade debt remains; and several marketplace routes still use the in-memory domain store as read authority with asynchronous database write-through. Firebase and Cloud SQL external acceptance are complete, but full PR-1 persistence authority is not.
- LOW: production browser bundle exceeds 500 kB and Vite reports an ineffective dynamic import. This is performance/build debt, not an authorization defect.
- INFORMATIONAL: Milestone 3 GitHub work and its E2E harness belong to the separate `Custody-Core` repository; they were not duplicated into Open Policy. PR-0A remains shadow mode. No marketplace, commercial, offer, consumer-selection, binding, or jurisdiction outcome semantics changed.

## Changed files

The implementation candidate diff against `main` changes 45 tracked paths: `.env.example`; three PR-0B documents plus the NV dossier; security/configuration artifacts; `package.json` and lockfile; scripts; `server.ts`; UI/auth components; Firebase configuration; identity/authorization/service test and implementation files; database/migration files; commercial store; user service; and insurance types. `git diff --check` reports only pre-existing Markdown hard-break/trailing-whitespace formatting in branch documentation, not source-code whitespace errors.

## Final recommendation

**NOT READY — PERSISTENCE AUTHORITY REMAINS**

Firebase/GCP and Cloud SQL external acceptance are green, and the public acceptance service now uses a durable PostgreSQL backend for the existing persistent stores. Merge is not yet recommended because connecting Cloud SQL does not make the remaining in-memory maps authoritative or restart-safe. Complete the bounded PR-1 persistence-authority conversion, rerun the same gates, and only then reconsider `READY FOR MERGE`. Custody-Core GitHub acceptance is a separate product concern and is not part of this decision. Do not merge yet.
