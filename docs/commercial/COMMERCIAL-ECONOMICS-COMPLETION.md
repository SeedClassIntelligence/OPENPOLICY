# Open Policy Commercial Economics Completion Record

Date: 2026-10-14

Price book: `OPEN_POLICY_PREMIUM_V1`

Scope: CE-1 through CE-5 completion audit and implementation

## Disposition

`NOT COMPLETE — EXTERNAL PAYMENT ACCEPTANCE AND DELIBERATELY UNAVAILABLE SERVICES REMAIN`

The executable accounting architecture is connected from authoritative commercial agreement through entitlement/event, rating, invoice, processor-facing payment session, settlement allocation, refund and reconstructed balance. No live charge was initiated. Stripe sandbox collection and refund acceptance still require external credentials and webhook configuration. Four priced service add-ons remain preserved but unavailable for purchase until their product delivery surfaces enforce their entitlements.

## Revenue coverage matrix

| Price-book item | Trigger / authority | Rating and invoice | Payment and reconciliation | Current status |
| --- | --- | --- | --- | --- |
| $499 monthly membership | Platform-admin activated immutable agreement | Historical plan version creates recurring subscription line | Finalized invoice uses Stripe checkout; signed webhook allocates confirmed payment | Code complete; Stripe sandbox evidence blocked |
| $49 additional producer seat | Admin-contracted quantity | Recurring add-on line; expands `PROVIDER_SEATS` | Same invoice/payment ledger | Executable |
| $75 additional jurisdiction | Admin-contracted quantity | Recurring add-on line; expands `JURISDICTION_CAPACITY` | Same invoice/payment ledger | Executable |
| $199 workflow automation | Price preserved | Purchase is rejected fail-closed | None | Unavailable until workflow capability enforces entitlement |
| $299 enterprise reporting | Price preserved | Purchase is rejected fail-closed | None | Unavailable until reporting capability enforces entitlement |
| $499 API integration | Price preserved | Purchase is rejected fail-closed | None | Unavailable until API capability enforces entitlement |
| $199 multi-location administration | Price preserved | Purchase is rejected fail-closed | None | Unavailable until multi-location capability enforces entitlement |
| $2,500–$10,000 enterprise implementation | Admin records exact executed-agreement amount and supporting reference | Migration 0016 creates an auditable one-time service charge and exactly-once invoice line | Same payment/refund/allocation ledger | Code complete; Stripe sandbox evidence blocked |
| $35 `VPO_ENGAGED` | Qualified participation, once per provider organization/opportunity | Immutable event → rating → billable event → invoice | Same payment/reconciliation ledger | Executable; external collection evidence blocked |
| Line-priced `AUTHORIZED_CONNECTION` | Consumer authorization plus successful controlled disclosure | Immutable disclosure-derived event → line-specific rating → invoice | Same payment/reconciliation ledger | Compensation determination required; Medicare non-executable |
| `BOUND_ACQUISITION` | Verified downstream acquisition evidence | Recorded, independently configurable, V1 unpriced | No V1 charge | Preserved unpriced |
| `VERIFIED_BOUND_OUTCOME` | Verified reconciliation outcome | Recorded, independently configurable, V1 unpriced | No V1 charge | Preserved unpriced |
| `BASELINE_ACTIVATED` | Durable baseline activation | Recorded; no independent V1 charge | No V1 charge | Preserved unpriced |
| Consumer enrollment and policy upload | Consumer action | No commercial event charge | No consumer invoice | Free in V1 |

## Gaps found and corrected

1. Providers could self-activate paid commercial agreements. Provider enrollment now fails closed; only the protected platform-admin path can grant paid authority.
2. Providers could suspend/reactivate agreements and mutate billing periods, invoice state, adjustments and direct settlement records. Those mutations are now platform-admin-only. Providers retain read access and secure invoice payment initiation.
3. Purchased seat and jurisdiction quantities appeared on invoices but did not expand their durable entitlements. Entitlement derivation now includes purchased quantities.
4. Service add-on prices existed without proven delivery enforcement. Their prices remain immutable, but purchase now fails closed until the corresponding capability is operational.
5. Negotiated enterprise implementation had a published range but no executed-agreement charge path. Migration 0016 adds exact, authorized, idempotent one-time charges with supporting references and invoice provenance.
6. Provider statements did not expose payment/refund history. The provider financial view now includes processor payment status, refunds, invoices, credits and reconstructed balance.
7. The owner/admin console lacked commercial controls. It now supports provider commercial inspection, admin-only premium activation, capacity add-ons and negotiated implementation charges.
8. The Medicare connection price was registered but not technically fail-closed. V1 rating now returns `INSURANCE_LINE_NOT_OPERATIONAL` while preserving the published $200 price.
9. The V1 contract now explicitly records consumer price `$0`, every free marketplace event, the $100–$350 connection range, unpriced outcome events and unavailable insurance lines.

## Premium service delivery checkpoint

The four priced services now have durable, tenant-scoped backend delivery boundaries:

- workflow automation: entitlement-gated deterministic opportunity triage rules that do not change marketplace eligibility, ordering, or consumer presentation;
- enterprise reporting: entitlement-gated marketplace and commercial summaries built only from the authenticated provider organization's records;
- API integration: one-time-revealed, hash-stored, scoped and revocable provider credentials with tenant-scoped read APIs;
- multi-location administration: durable office records and producer assignments with cross-organization assignment rejection.

Purchase remains unavailable pending provider-facing administration UI and full HTTP adversarial acceptance. Backend existence alone is not represented as completed service delivery.

## Verification evidence

- TypeScript: passed.
- Client and server production builds: passed.
- Fresh migrations 0001–0016: passed.
- Dependency audit: 0 vulnerabilities.
- Price book tests: 8/8.
- Payment boundary tests: 2/2.
- Stripe processor tests: 4/4.
- Route authorization tests: 11/11.
- Commercial domain tests: 13/13.
- Canonical validators: all 11 passed.
  - PM-1: 57/57
  - PM-2: 45/45
  - PM-3: 32/32
  - PM-4: 58/58
  - PM-5: 89/89
  - Commercial Economics / CE-2: all pass
  - CE-3: all pass
  - CE-4: 38/38
  - CE-5: 42/42
  - Semantic corrections: 13/13
  - PR-0A: 187/187

The normal `tsx` test launcher on this Windows host failed before loading tests with `uv_os_get_passwd ENOMEM`. The same sources were compiled by Vite and executed with the bundled Node 24 runtime. This is recorded as a host/runtime issue, not represented as an application assertion failure.

## Remaining activation dependencies

1. Stripe test credentials, webhook secret, HTTPS callback URL and sandbox customer/payment methods.
2. Controlled Stripe sandbox evidence for card and eligible ACH payment, failure, retry, signed-webhook replay, processor-first refund, allocation and balance reconciliation.
3. Approved compensation determination durably attached before any `AUTHORIZED_CONNECTION` charge becomes executable.
4. Medicare remains price-preserved and non-executable until added to the governed insurance-line registry by separate authorization.
5. Workflow automation, enterprise reporting, API integration and multi-location administration remain unavailable until their actual product capabilities and entitlement checks are implemented and accepted.
6. Production smoke-test authorization before any live collection. No live collection is authorized by this record.

## Revenue leakage conclusion

No revenue leakage percentage is claimed. The audit identified concrete missing or unauthorized paths and corrected the executable accounting gaps above. External processor acceptance and deliberately unavailable product services remain explicit blockers rather than being counted as captured revenue.
