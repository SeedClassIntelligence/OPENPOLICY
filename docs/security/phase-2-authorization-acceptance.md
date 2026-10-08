# Security Acceptance Phase 2 — Route Authorization & Ownership

Date: 2026-10-04  
Starting commit: `70b7868`  
Implementation commit: `2a03650`  
Recommendation: **NOT READY FOR REAL FIREBASE ACCEPTANCE**

## Independent post-implementation review

The Phase 2 changes close the demonstrated anonymous and cross-tenant access paths without changing competition results, selection semantics, jurisdiction rules, coverage comparison, rating economics, or commercial neutrality. Authentication establishes a canonical actor; route policy constrains actor class; challenge, binding, provider, and commercial methods independently enforce ownership or organization relationships.

The gate remains NOT READY because five routes are intentionally fail-closed as `ARCHITECTURE_DECISION_REQUIRED`. Their records do not carry enough ownership/capability information to authorize them without inventing semantics:

1. `GET /api/marketplace/users`
2. `GET /api/marketplace/providers`
3. `POST /api/marketplace/competition/:challengeId/seed-competitors`
4. `GET /api/notifications`
5. `POST /api/notifications/:id/read`

This is a product/authority completion blocker, not an open data exposure: all five return 403 outside the explicit canonical-validator fixture bypass.

## Inventory totals

| Classification | Route registrations |
|---|---:|
| Total `/api/*` routes | 116 |
| Public | 9 |
| Consumer | 21 |
| Provider / provider-organization member | 47 |
| Authenticated resource participant | 11 |
| Platform operator/admin | 23 |
| Architecture decision required | 5 |
| Organization/resource scoped (provider + participant) | 58 |

The full per-route matrix is in `docs/security/api-authorization-matrix.md`.

## Authorization controls added

- Central method/path actor-class policy with explicit public routes.
- Default authentication requirement for every non-public API route.
- Explicit ADMIN gates for system telemetry, reset, competition control, verification/qualification, commercial rating/reconciliation, and `/api/admin/*`.
- Consumer and provider route-family gates.
- Challenge relationship primitive: exact consumer owner, participating provider organization, or platform admin.
- Binding relationship primitive: exact consumer owner, exact provider organization, or platform admin.
- Challenge listing filtered to verified consumer UID.
- Legacy vault listing/upload bound to verified consumer UID.
- Dossier, reconciliation, offer-version, competition status/activity/deadline, information-request, supplemental-fact, binding, and selection-state reads receive resource checks or domain visibility filtering.
- Fixture authorization bypass is an explicit process environment switch used only by isolated canonical validators; fixture auth remains forbidden under `NODE_ENV=production` and cannot be enabled by a request.

## Adversarial tests

Focused suites: **17/17 passed** (role/onboarding plus identity and authorization). The new authorization file contributes 7 tests covering:

- anonymous access to representative sensitive route families;
- wrong actor type;
- consumer owner versus consumer cross-resource access;
- same-organization provider versus cross-organization provider;
- missing provider organization mapping;
- ordinary provider attempting an operator/admin action;
- architecture-decision routes failing closed;
- explicit fixture bypass and production fixture prohibition.

The existing PM-1, PM-2, PM-4, PM-5, CE-4, and CE-5 suites continue to exercise caller-supplied organization spoofing, inactive/unknown provider users, cross-organization invitations/offers/binding/vault/commercial records, and positive same-organization paths.

## Direct probes

Firebase mode, no bearer token:

| Probe | Result |
|---|---:|
| `GET /api/challenges` | 401 |
| `GET /api/marketplace/competition/CHAL-NV-49281/status` | 401 |
| `GET /api/commercial/rating/runs` | 401 |

Explicit fixture mode without authorization bypass:

| Probe | Result |
|---|---:|
| challenge owner | 200 |
| different consumer | 403 |
| participating provider organization | 200 |
| non-participating provider organization | 403 |
| caller-supplied organization spoof | 403 |
| ordinary provider to `/api/admin/*` | 403 |
| notification route without established ownership policy | 403 |

## Fixed identity/organization review

All runtime uses were classified in `docs/security/fixed-identity-disposition.md`.

Removed runtime authority substitutions:

- challenge creation fixed consumer;
- vault default/fixed consumer owner;
- binding consent Apex recipient fallback;
- reconciliation and commercial event Apex fallbacks;
- commercial backfill Apex fallback.

Remaining `org_apex` and `user_consumer_1` occurrences are canonical seeds, migrations, fixtures, or tests. Synthetic Apex competitor seeding is fixture-only at the HTTP boundary. Missing runtime ownership now fails closed.

## Regression and reproducibility evidence

- TypeScript: pass.
- Production browser build: pass.
- Production server build: pass.
- Canonical validation: all 11 runs pass.
  - PM-1 61/61
  - PM-2 45/45
  - PM-3 34/34
  - PM-4 61/61
  - PM-5 89/89
  - Commercial Economics, CE-3, CE-4, CE-5, semantic corrections, and PR-0A all pass.
- Fresh detached checkout of exact commit `2a03650`: `npm ci` succeeds, 356 packages installed; focused authorization tests, TypeScript, and production client/server builds all pass.

## Dependency advisories

Status is unchanged: 12 production-tree findings (8 moderate, 4 high) representing the previously documented grpc-js and uuid advisories. No forced audit fix was run.

- Firebase/Firestore grpc-js finding: currently not reachable through this application's server-auth behavior; track the upstream patched grpc-js versions 1.13.6/1.14.5 and remove the temporary acceptance when Firebase updates its pin.
- Firebase Admin/Google Cloud uuid finding: vulnerable buffer API not reached; Firebase Admin major upgrade remains production-hardening debt requiring identity, Firestore mapping, clean-install, canonical-suite, and build regression testing.

`ACCEPT_WITH_RATIONALE` is temporary tracked debt, not permanent closure.

## Unresolved items and founder decisions

The five decision-required routes need explicit answers about intended audience and ownership representation. Notifications particularly require recipient identity/organization fields before consumer-facing authorization can be implemented. Marketplace directories require an explicit visibility policy. Synthetic competitor seeding requires a decision to remain fixture-only or become an operator capability with production semantics.

Until those decisions are made and tested, the correct gate result is:

**NOT READY FOR REAL FIREBASE ACCEPTANCE. DO NOT MERGE.**
