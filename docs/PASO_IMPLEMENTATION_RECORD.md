# PASO — Provider Acquisition & Sales Operations

## Cumulative implementation record

**Status:** PASO-1 and PASO-2 backend implemented and locally validated; PASO-3 not started
**Feature branch:** `feature/paso-provider-acquisition`  
**Governing specification:** PASO Master Build Instructions  
**Integration posture:** Additive internal bounded context

## 1. Authority and ownership map

PASO owns internal provider prospecting, outreach, sales assignments, acquisition attribution, compensation policy, compensation accruals, payout reconciliation evidence, and sales analytics.

PASO does not own consumer records, provider authority decisions, marketplace eligibility, provider offers, consumer selection, controlled disclosure, Commercial V2 invoices, payment collection, or insurance transactions.

The existing systems remain authoritative:

| State or event | Authoritative source | PASO treatment |
|---|---|---|
| Provider application | `provider_applications` / provider-application service | Read and link by durable reference |
| Provider verification | Provider authority evidence and approved application | Project `VERIFIED`; never set from pipeline UI |
| Provider activation | Provider activation service | Observe activation; never bypass authority or payment gates |
| Membership plan and price | `OPEN_POLICY_COMMERCIAL_V2` | Read immutable plan/version evidence |
| First paid membership | Commercial invoice, payment, allocation, and agreement state | Source acquisition commission eligibility |
| Paid membership periods | Commercial billing and settlement ledger | Source retention eligibility |
| Authorized connection | Existing marketplace/commercial event ledger | Analytics only; never a sales-compensation base |
| Marketplace participation | Existing provider marketplace evidence | Project aggregate `ACTIVE_PARTICIPANT` without consumer identity |
| Authentication | Existing Firebase request identity | Reuse; do not create a second authentication stack |
| Internal authorization | Existing platform administrator assignment model | Extend with PASO-scoped permissions and object-level checks |
| Audit evidence | Existing append-only audit architecture | Add PASO audit records and correlation identifiers |

## 2. Existing components to reuse

- `src/server/auth/requestIdentity.ts`: verified Firebase identity and fail-closed request identity.
- `src/server/auth/routeAuthorization.ts`: server-side route authorization conventions.
- `src/server/db/postgresStore.ts`: repository database access and transaction patterns.
- `src/server/db/migrate.ts`: ordered, additive PostgreSQL/PGlite migrations. PASO begins at migration `0030`.
- Provider application routes and `providerActivation.ts`: application linkage, verification and activation authority.
- `providerMembership.ts`: current membership preparation and access checks.
- `commercialStore`: Commercial V2 agreements, plans, invoices, payments, refunds, allocations, balances and event idempotency.
- Stripe webhook processing: authoritative processor status and idempotent payment/refund evidence.
- `AdminConsole.tsx`: host surface for the Provider Acquisition Command Center.

## 3. New bounded-context components

### Domain

- PASO identities, role/permission evaluation and assignment scope.
- Prospect normalization, duplicate candidates, assignment and attribution conflicts.
- Audited pipeline state machine with authoritative external-stage projections.
- Versioned compensation plans and deterministic eligibility calculations.
- Immutable compensation events, compensating adjustments and payout reconciliation.
- CAC, MRR, connection-revenue, contribution and cohort calculations with actual/scenario separation.

### Persistence

- Migration `0030_paso_foundation`: teams, territories, rep profiles and PASO permissions.
- Later additive migrations for CRM, pipeline, compensation, finance and analytics as each stage is accepted.
- A dedicated PASO store using existing transaction and audit conventions.

### API

- Authenticated routes under `/api/internal/sales/*`.
- Every route checks internal permission plus object assignment/team scope.
- External application, verification, activation and payment states are resolved through validated adapters.

### Interface

- Add a Sales Operations area to the existing owner console.
- Role-specific views are rendered from the same internal application and identity system.
- No consumer policy document, offer intelligence, or personal marketplace record is exposed.

## 4. Trial-policy disposition

Migration `0028_provider_membership_trial` and historical trial evidence remain intact.

The existing public provider flow currently grants a 30-day membership-only trial. PASO will not infer or grant a trial. A PASO acquisition reaches `PAID_ACTIVE` only from an authoritative paid membership state. Removing the trial from all future provider enrollment would change existing Commercial V2 behavior and requires an explicit founder decision outside this PASO-only bounded-context implementation.

## 5. Implementation sequence

1. **PASO-1 Foundation:** migration 0030, internal permissions, teams, territories, rep profiles, fail-closed API skeleton and tests.
2. **PASO-2 CRM:** prospects, contacts, normalization, controlled imports, duplicate candidates, assignment history.
3. **PASO-3 Pipeline:** audited stages, activities, application linking, authoritative projections.
4. **PASO-4 Compensation:** versioned draft plan, attribution, deterministic commission engine and immutable ledger.
5. **PASO-5 Finance:** approvals, adjustments, export preparation and reconciliation.
6. **PASO-6 Intelligence:** actual financial metrics, scenarios, cohorts and aggregate demand milestone.
7. **PASO-7 UX:** command center and role-specific dashboards in the owner console.
8. **PASO-8 Acceptance:** end-to-end sandbox demonstration, authorization, financial reconciliation and full regression.

## 6. Prohibited implementation shortcuts

- No UI-controlled `VERIFIED`, `PAID_ACTIVE`, or `ACTIVE_PARTICIPANT` truth.
- No parallel Commercial V2 invoice or payment ledger.
- No commission from authorized connections, insurance premiums, policy issuance, consumer selection or provider wins.
- No automatic duplicate merges or attribution decisions.
- No payroll disbursement or banking-detail storage.
- No consumer identity, policy documents or competitor proposal data in sales views.
- No production migration, deployment, traffic promotion, external outreach or live payment changes.

## 7. Acceptance evidence required per stage

Each stage must add focused domain, persistence, API-authorization and integration tests. A stage is not complete until the relevant new tests and existing provider onboarding, security, Commercial V2 and marketplace suites pass. Failures and unresolved decisions remain recorded in this document rather than being replaced by disconnected status files.

## 8. PASO-1 implementation evidence

Implemented on `feature/paso-provider-acquisition` without production deployment or migration:

- Migration `0030_paso_foundation` creates sales teams, territories, rep profiles and immutable PASO audit events.
- PASO roles and actions are evaluated fail closed, including representative ownership and manager team boundaries.
- Internal routes under `/api/internal/sales/*` reuse authenticated administrator identity, require `PLATFORM_READ`, then apply PASO role permissions.
- Platform owners retain bounded bootstrap authority to create the first teams, territories and PASO profiles.
- Team, territory and profile creation writes correlated immutable audit evidence.

Validation on October 28, 2026:

- PASO authorization, existing route authorization and persistence tests: **21/21 passed**.
- TypeScript check: **passed**.
- Client and server production build: **passed**.
- Migration `0030_paso_foundation`: applied to an isolated temporary PGlite database and recorded exactly once.
- Durable PASO evidence: team, territory and profile persisted; three creation audit events recorded.

Environment note: the Windows runner returned `uv_os_get_passwd ... ENOMEM` before the TypeScript loader could initialize. `scripts/node-userinfo-shim.cjs` preserves native account lookup when available and supplies deterministic process-account metadata only for that runner failure. Tests then loaded and passed; no application runtime behavior uses the shim.

PASO-1 does not alter provider activation, provider authority, Commercial V2 economics, Stripe behavior, consumer records, marketplace billing events or production data.

## 9. PASO-2 implementation evidence

Implemented on the same isolated feature branch without outreach execution or production mutation:

- Migration `0031_paso_acquisition_crm` adds provider prospects, business contacts, duplicate candidates, assignment history and outreach activity records.
- Organization names, website domains and license identifiers normalize deterministically before duplicate comparison.
- Duplicate signals include organization identity, business address, website domain and license identifiers. Candidate records remain separate and require an audited human resolution; no record is automatically merged.
- Representative prospect visibility is owner-bound. Manager visibility is team-bound. Sales administration and audit roles retain their authorized aggregate scope.
- Manual creation and controlled imports share the same validation and duplicate-detection path. Imports are limited to 100 parsed rows and return a row-level accepted/rejected result.
- Contact creation requires a business contact method plus a recorded consent or lawful outreach basis.
- Reassignment preserves prior and resulting ownership, the actor, reason and time.
- Outreach records are internal evidence only; the implementation does not send email, place calls or contact external parties.

Validation on October 28, 2026:

- PASO focused authorization, persistence and CRM tests: **23/23 passed**.
- Duplicate review, representative and manager scope, contact validation, outreach history, human resolution and reassignment history are directly asserted.
- Migration `0031_paso_acquisition_crm`: applied to an isolated database and recorded exactly once.
- TypeScript check and client/server production build: **passed**.

PASO-2 does not create provider applications, determine provider authority, activate memberships, generate invoices, alter provider ranking, expose consumer information or issue acquisition compensation.
