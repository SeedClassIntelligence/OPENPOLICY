# Post-change security acceptance review — `bddd47d`

Date: 2026-10-04  
Baseline: `bddd47d feat: verify marketplace identity at server boundary`  
Recommendation: **NOT READY / MERGE BLOCKED**

## Scope and evidence

This is a focused review of the Firebase server identity boundary and its interaction with marketplace, provider, consumer, binding, reconciliation, administrative, and commercial routes. It is not a new architecture pass.

Evidence executed:

- `npm run test:onboarding`: 10/10 pass, including injected malformed, expired, revoked, unknown-profile, spoofed-header, and verified-mapping cases.
- `npm run lint`: pass.
- `npm run build`: pass (Vite browser bundle and esbuild server bundle).
- Live Firebase-mode negative probes on `127.0.0.1:3000`: unauthenticated `GET /api/challenges`, `GET /api/marketplace/competition/CHAL-NV-49281/status`, and `GET /api/commercial/rating/runs` each returned 200. No mutating unauthenticated probe was executed.
- `npm ls ... --all` and `npm audit --json`: 12 production dependency findings (8 moderate, 4 high), all arising from two advisories and their affected dependency parents.
- Tracked-file and production-browser-bundle secret scan: no private key, service-account identity, bearer token, installation token, or test credential found. `.env` is ignored; only `.env.example` is tracked.

## Findings

### SEC-01 — Sensitive routes do not uniformly authenticate or authorize (BLOCKING)

The new middleware verifies a presented Firebase token and derives the UID/profile mapping server-side. Routes that call `getAuthenticatedProviderOrgId`, `getAuthenticatedProviderUserId`, or `getAuthenticatedConsumerId` are directionally correct and many database methods independently enforce resource ownership.

However, identity and authorization are not uniformly required. Confirmed unauthenticated reads include the challenge collection/details, competition status/deadline data, binding handoff details, challenge selection/binding state, reconciliation details, rating-run history, notifications, and all `/api/admin/*` review/audit endpoints. Confirmed unguarded mutations in code include competition open/advance/seed, offer-document verification/qualification, batch rating/reconciliation, commercial event reconciliation, notification mutation, and administrative queue resolution/enqueue/proof generation.

This cannot be safely repaired with one generic “authenticated” check: each route needs an explicit allowed role and resource/organization ownership rule. In particular, operator-only competition progression, rating, reconciliation, and admin actions must not become available merely because a caller has any valid Firebase token.

Required remediation: establish and implement a route authorization matrix (consumer owner, participating provider organization, or explicit admin/operator), then add unauthenticated, wrong-role, and cross-organization HTTP tests for every sensitive route family.

### SEC-02 — Fixed-organization fallback remains in authoritative flows (BLOCKING)

Runtime fallbacks to `org_apex` remain in binding consent recipient selection, reconciliation/commercial event projection, and commercial event backfill. A missing authoritative provider mapping can therefore be silently converted into Apex ownership instead of failing closed.

Required remediation: remove runtime `|| 'org_apex'` fallbacks outside seed/fixture construction and return a controlled conflict/forbidden error when the authoritative relationship is absent.

### SEC-03 — Client reauthentication path was incomplete (FIXED IN REVIEW WORKTREE)

At the baseline, `apiFetch` obtained a Firebase ID token through `currentUser.getIdToken()`, which supports normal Firebase refresh, but a backend 401 had no controlled retry/sign-out path. The focused change now forces one token refresh, retries once, then signs out and opens the sign-in flow if the server still rejects the identity. It never falls back to a request header, fixed identity, or demo identity.

### SEC-04 — Identity middleware adversarial coverage was incomplete (FIXED IN REVIEW WORKTREE)

The middleware now has an injectable resolver for credential-free boundary tests. Tests verify malformed/expired/revoked tokens fail 401 without verifier detail leakage, unknown profiles fail 403, legacy headers cannot create identity in Firebase mode, and server-resolved mappings win over caller fields.

## Requested boundary conclusions

1. **Provider derivation:** verified for routes using the provider helpers; not true for every sensitive provider/operator route because some have no guard. **Fail.**
2. **Consumer derivation:** guarded consumer routes derive the Firebase UID; fixture fallback is isolated to explicit fixture mode. Sensitive read routes remain unguarded. **Partial/fail.**
3. **Fixture fail-closed:** fixture mode is selected only by process environment, cannot be selected by a request, and throws in `NODE_ENV=production`. **Pass.** Deployment must still set `NODE_ENV=production`.
4. **Failure cases:** malformed/expired/revoked token, unknown profile, missing provider mapping, inactive provider, profile/marketplace organization mismatch, caller organization mismatch, and spoofed legacy headers fail closed on guarded paths. Unguarded paths bypass these checks. **Partial/fail.**
5. **Authentication vs authorization:** independent organization/resource checks exist in many marketplace and commercial methods, but coverage is incomplete and operator/admin role authorization is absent. **Fail.**
6. **Secret handling:** no committed secret material or Admin SDK code in the browser bundle was found. The tracked Firebase web API key is public client configuration, but it must be API-restricted in Google Cloud and protected by Firebase rules/App Check as appropriate. **Pass with deployment controls.**
7. **Token refresh/revocation:** server uses `verifyIdToken(token, true)`; client now refreshes once and enters controlled reauthentication after a repeated 401. **Pass in review worktree; real acceptance pending credentials.**

## Dependency vulnerability disposition

All 12 findings are production dependency-tree findings, not dev-only findings. They collapse to two underlying advisories.

| Package | Severity | Advisory / dependency path | Reachability and production surface | Remediation / breaking implications | Disposition |
|---|---:|---|---|---|---|
| `@firebase/firestore` 4.17.2 | High | GHSA-m9gg-hp2v-232j via `firebase -> @firebase/firestore -> @grpc/grpc-js@1.9.16` | Browser Firestore is used for profiles, challenges, orders, and vault. Advisory requires server-side `getAuthContext`/mTLS authorization behavior; this app does not call it and the browser SDK is not a gRPC server. | Upstream Firebase currently pins the affected branch; npm's suggested `firebase@9.14.0` is a breaking downgrade, not an acceptable fix. | **NOT_REACHABLE**, track upstream |
| `@firebase/firestore-compat` 0.4.14 | High | Parent finding through the same Firestore/grpc advisory | Compat API is not imported by application source; parent package is present inside `firebase`. | Same upstream constraint; do not downgrade Firebase. | **NOT_REACHABLE**, track upstream |
| `firebase` 12.19.0 | High | Direct parent finding for the same Firestore/grpc advisory | Firebase Auth and Firestore are production browser surfaces, but the vulnerable gRPC server-auth API is not invoked. | No non-breaking npm-audit remediation currently offered; forced fix proposes a major downgrade. | **ACCEPT_WITH_RATIONALE** temporarily; track and upgrade when Firebase releases a patched dependency |
| `@grpc/grpc-js` 1.9.16 | High | GHSA-m9gg-hp2v-232j through browser Firestore | Vulnerability requires `getAuthContext` used for authorization with optional client certificates. Open Policy neither hosts grpc-js server credentials nor uses that method. | Patched in 1.13.6/1.14.5; direct override is unsafe while Firebase pins `~1.9.0`. | **NOT_REACHABLE**, track upstream |
| `@google-cloud/firestore` 7.11.6 | Moderate | Parent finding through `google-gax -> uuid@9.0.1` | Server runtime, used by Firebase Admin for profile mapping. No application or installed parent code invokes UUID v3/v5/v6 with caller-controlled output buffers. | Firebase Admin 14.5 is npm's available parent upgrade and is semver-major; requires full auth/database regression. | **UPGRADE_WITH_TESTING** |
| `@google-cloud/storage` 7.22.0 | Moderate | Parent through `retry-request` / `teeny-request -> uuid@9.0.1` | Server runtime dependency, but Admin Storage is not imported by application source; vulnerable UUID APIs are not called. | Parent upgrade comes with Firebase Admin major. | **NOT_REACHABLE**, remove/upgrade transitively with Admin |
| `firebase-admin` 13.10.0 | Moderate | Direct parent for Google Cloud libraries carrying vulnerable uuid | Production server identity verification is reachable; the specific uuid buffer-write path is not. | Upgrade to 14.5 is semver-major and must preserve Admin initialization, revoked-token verification, Firestore mapping, clean install, and all suites. | **UPGRADE_WITH_TESTING** before production acceptance |
| `gaxios` 6.7.1 | Moderate | `firebase-admin -> @google-cloud/* -> google-auth-library -> gaxios -> uuid@9.0.1` | Runtime HTTP/auth library; installed source does not invoke the affected uuid v3/v5/v6 buffer APIs. | Transitive remediation through Firebase Admin/Google Cloud upgrades. | **NOT_REACHABLE** |
| `google-gax` 4.6.1 | Moderate | `firebase-admin -> @google-cloud/firestore -> google-gax -> uuid@9.0.1` | Runtime RPC library; no affected UUID API call found in installed source. Its grpc-js 1.14.5 is patched for the high advisory. | Upgrade transitively with Firebase Admin. | **NOT_REACHABLE** |
| `retry-request` 7.0.2 | Moderate | `@google-cloud/storage/google-gax -> retry-request -> teeny-request -> uuid@9.0.1` | Runtime transitive; vulnerable UUID path not invoked. | Transitive parent upgrade. | **NOT_REACHABLE** |
| `teeny-request` 9.0.0 | Moderate | `retry-request -> teeny-request -> uuid@9.0.1` | Runtime transitive; package declares uuid but no uuid use was found in installed source. | Transitive parent upgrade. | **NOT_REACHABLE** |
| `uuid` 9.0.1 | Moderate | GHSA-w5hq-g745-h8pq | Advisory affects v3/v5/v6 only when a caller supplies an out-of-bounds output buffer/offset. No such call exists in application or affected installed parent source. | Patched at 11.1.1, but forcing an incompatible transitive major is unsafe. Upgrade through supported parents. | **NOT_REACHABLE** |

The dependency findings do not independently block merge on demonstrated reachability, but `firebase-admin` should be upgraded in a bounded compatibility change before production deployment. The route authorization failures remain independently blocking.

## External requirements for real Firebase acceptance

Required, not fabricated:

1. A designated Firebase/GCP project ID matching the intended client project.
2. Server credentials supplied through the deployment secret manager as either Application Default Credentials or `FIREBASE_SERVICE_ACCOUNT_JSON`; the service identity needs only Firebase Auth token verification/revocation lookup and read access to the required `users/{uid}` profile documents.
3. `FIREBASE_PROJECT_ID` on the server and `OPENPOLICY_AUTH_MODE=firebase`; production must set `NODE_ENV=production`.
4. Authorized Firebase Authentication providers and authorized domains for the acceptance origin.
5. Real consumer and provider Firebase accounts.
6. A `users/{uid}` document for each account with a valid `role`. Provider profiles additionally require `providerStatus: ACTIVE`, `providerUserId`, and `providerOrganizationId` values matching an active marketplace ProviderUser and ProviderOrganization.
7. Deployed Firestore Security Rules for browser profile/onboarding/challenge/order/vault access; the web API key should have appropriate Google API restrictions. App Check should be evaluated/enforced for public browser access.
8. HTTPS acceptance origin and an agreed credential rotation/revocation procedure.

Real acceptance evidence must include: successful consumer and provider sign-in; server UID/profile mapping; wrong-role and cross-organization rejection; expired/revoked token reauthentication; unknown/missing mapping rejection; and confirmation that no fixture identity can be enabled in the production deployment.

## Final recommendation

**NOT READY. Do not merge.** The Firebase identity boundary is substantially improved and the focused regression remains green, but unauthenticated sensitive routes and fixed-organization runtime fallbacks violate fail-closed authorization. Real Firebase acceptance also remains pending external credentials, canonical mappings, rules, and deployment configuration.
