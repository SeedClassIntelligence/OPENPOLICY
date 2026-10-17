# Open Policy Commercial Activation Acceptance

Date: 2026-10-15
Pricing baseline: `OPEN_POLICY_PREMIUM_V1`

## Verified event boundary

`AUTHORIZED_CONNECTION` is created only after successful consumer-authorized
controlled disclosure. Its authoritative source is `DISCLOSURE_EVENT`, and its
idempotency identity is the binding handoff ID. It is not a binding-completion
event.

`BOUND_ACQUISITION` is a later, separate event created when the binding handoff
reaches `BOUND`. `VERIFIED_BOUND_OUTCOME` is separately created after issued
policy evidence and reconciliation establish a verified outcome. Both remain
unpriced in the current price book.

The intended sequence is therefore:

1. consumer authorizes disclosure and connection;
2. controlled disclosure succeeds;
3. `AUTHORIZED_CONNECTION` is recorded and may be rated at the insurance-line
   connection price, subject to the compensation-determination gate;
4. licensed-provider activity continues outside Open Policy;
5. a later reported binding creates `BOUND_ACQUISITION`;
6. accepted issued-policy reconciliation creates `VERIFIED_BOUND_OUTCOME`.

## Current capability

- immutable commercial price book and historical plan snapshots;
- event provenance and idempotent commercial-event projection;
- rating, billing periods, invoice generation, adjustments, credits, internal
  settlement records, refunds, allocations, and reconstructed balances;
- compensation-determination gate for connection and outcome events;
- internal accounting adapter for deterministic non-production validation.

## Stripe production integration

The initial processor implementation uses Stripe Checkout for hosted card and
eligible US bank-account collection. Open Policy never receives raw card or
bank-account details. A payment session is created only for the exact remaining
balance of a valid finalized invoice and carries immutable invoice and provider
organization metadata.

Stripe webhook bodies remain raw until signature verification. PaymentIntent
states map conservatively: `succeeded` settles the ledger;
`processing`/action-required states remain pending; cancelled or payment-method
failures are recorded as failed. Only a succeeded processor event creates a
settlement allocation and changes the invoice balance. Processor retries reuse
the same payment idempotency identity. Out-of-order delivery cannot downgrade a
terminal success, and a delayed pending event cannot reopen a failed payment.

Refunds are platform-admin operations. Stripe executes the refund first; Open
Policy records the append-only refund and reverses the invoice allocation only
after Stripe reports success. Stripe refund IDs—not caller-selected request
keys—form the refund idempotency boundary.

Migration `0018_processor_settlement_idempotency` makes successful payment and
refund allocations unique at the database boundary. Payment/refund recording,
allocation, and invoice-balance changes execute in one transaction; processor
replay returns the original result, and an overpayment rolls back without
creating a successful ledger record.

Required secret/runtime configuration:

- `STRIPE_SECRET_KEY` (Secret Manager only; never browser-exposed);
- `STRIPE_WEBHOOK_SECRET` (Secret Manager only);
- `APP_URL` (HTTPS in production);
- Stripe-hosted card and US bank-account payment methods enabled;
- PaymentIntent and Refund lifecycle webhooks delivered to
  `/api/commercial/stripe/webhook`.

## Production hold

The internal accounting adapter remains limited to deterministic validation.
Production direct HTTP payment mutation remains disabled. Production collection
must use the Stripe hosted-session and signed-webhook path. Missing Stripe
configuration fails closed with `PAYMENT_PROCESSOR_NOT_CONFIGURED`.

The code boundary now includes hosted customer/payment collection, signed raw
webhooks, replay-safe processor identities, conservative status mapping,
processor-first refunds, invoice allocation/reconciliation, fail-closed secret
configuration, audit evidence, and platform-admin-only refund authority.

## Stripe sandbox acceptance evidence

The zero-traffic Cloud Run revision
`openpolicy-acceptance-stripe-rk-68f574a` was exercised against Stripe test
mode using a dedicated restricted key from Secret Manager. Production traffic
was not changed and live collection remains disabled.

Verified evidence:

- hosted card checkout settled invoice `INV-202611-2251` for $499.00;
- the signed Stripe success webhook created exactly one `CREDIT_CARD` payment,
  one settlement allocation, a zero invoice balance, and immutable audit
  evidence;
- replaying the exact signed card-success event returned HTTP 200 without
  creating another payment or allocation;
- a platform-authorized full refund executed in Stripe before Open Policy
  recorded it, created exactly one refund allocation, and reopened the invoice
  to its original $499.00 balance;
- replaying the signed refund event created no duplicate refund or allocation;
- hosted US-bank-account checkout settled invoice `INV-202701-6298` for
  $499.00 and preserved the processor's `PENDING` to `SUCCEEDED` transition;
- the successful bank payment was recorded as `ACH_TRANSFER`, with exactly one
  payment, one allocation, a zero invoice balance, and immutable audit evidence;
- replaying the exact signed ACH-success event returned HTTP 200 without
  changing those counts;
- hosted card checkout for invoice `INV-202702-5136` used Stripe's declined-card
  test path and was rejected with `card_declined`;
- the signed failure webhook created exactly one `CREDIT_CARD` payment record in
  `FAILED` status, preserved the invoice's full $499.00 balance, created no
  settlement allocation, and appended immutable processor-status audit evidence;
- replaying that exact failure event with a fresh valid Stripe signature returned
  HTTP 200 without duplicating the payment, allocation, or audit evidence;
- the authorization/payment regression suite passed 50/50;
- the candidate revision produced no Cloud Run error-level log entries during
  the acceptance interval.

The restricted key permits only the Stripe resources required by this
integration. The candidate uses the restricted-key secret rather than the
earlier broad test key. On October 15, 2026, the superseded broad Stripe test
key was rotated with immediate expiration and its obsolete Secret Manager
version was disabled. The restricted-key candidate remained Ready and its
health endpoint continued to return HTTP 200 after retirement.

## Controlled live-mode payment acceptance evidence

On October 17, 2026, commit
`f408bcce452854a99a764ed2303eee720bd39564` was deployed as the zero-traffic
revision `openpolicy-acceptance-stripe-webhook-v5-f408bcc`. The incumbent
revision retained 100% of production traffic. Live collection remained
disabled throughout the acceptance exercise.

Verified evidence:

- Stripe live-mode PaymentIntent `pi_3URMpxRoz1NoMP9p1pwCP4JV` collected a
  controlled $35.00 payment for Open Policy invoice
  `inv_usage_1792181291323_5695` (`INV-USAGE-20261016-1202`);
- signed Stripe event `evt_3URMpxRoz1NoMP9p1ZvftlxQ` was delivered to the
  zero-traffic candidate's webhook endpoint and returned HTTP 200;
- Stripe recorded that delivery as `Delivered` and `Recovered`;
- after delivery, the invoice remained `PAID` with a zero balance;
- the durable ledger contained exactly one `SUCCEEDED` $35.00 payment and
  exactly one $35.00 settlement allocation;
- signed-event retry created no duplicate payment or allocation;
- the initial webhook failure was traced to a truncated Secret Manager value,
  not application settlement logic; the full signing secret was installed as
  secret version 5, verified without logging its value, and the corrected
  candidate accepted the real Stripe delivery;
- no traffic was promoted, no merge was performed, and
  `OPENPOLICY_LIVE_COLLECTIONS_ENABLED` remained `false`.

This closes the controlled live-mode payment-path acceptance test. It does not
authorize general live collection, traffic promotion, or marketplace release.
Those actions remain subject to final release validation, production
configuration review, rollback readiness, and explicit founder authorization.

No connection fee may be activated until the separate Nevada compensation
determination is approved and its durable determination reference is attached
to the applicable immutable commercial plan version.

## Zero-traffic release-candidate validation

On October 17, 2026, commit
`03445517dc1b91537d2f6aeb89038fd641402ef1` completed a fresh detached-checkout
release gate:

- clean `npm ci`;
- TypeScript passed;
- all 11 canonical validator runs passed;
- authorization/payment regression passed 50/50;
- onboarding regression passed 33/33;
- document-intelligence regression passed 48/48;
- adversarial HTTP security probes passed 19/19;
- copy regression passed 16/16 and copy lint reported zero findings;
- production client and server builds passed; and
- `npm audit --omit=dev` reported zero vulnerabilities.

The exact commit was then deployed as zero-traffic revision
`openpolicy-acceptance-release-0344551`, available through the
`release-candidate` tag. The incumbent revision retained 100% of traffic and
live collection remained disabled. The candidate returned HTTP 200 for both
the application and health endpoint, returned HTTP 401 for anonymous protected
marketplace access, and emitted no error-level Cloud Run logs during the smoke
interval.

The candidate uses the canonical service URL for `APP_URL`. The Firebase
browser key retained all existing API and referrer restrictions and added only
the release-candidate referrer. Firebase Authentication retained every existing
authorized domain and added the canonical service and release-candidate
domains.

Before traffic promotion, replace the Stripe webhook signing secret because
its prior value entered the controlled execution transcript. The Stripe runtime
key intentionally lacks webhook-administration permission, so this rotation
must be performed through an authorized Stripe administration session. Store
the replacement in Secret Manager, deploy a new zero-traffic revision pinned
to that version, and prove one signed delivery returns HTTP 200 without a
duplicate ledger mutation.

### Webhook-secret rotation closure

The Stripe signing secret was rolled with an overlap period and stored as
Secret Manager version 6 without printing or committing its value. Commit
`9730e27` was deployed as zero-traffic revision
`openpolicy-acceptance-release-9730e27-v6`, explicitly pinned to version 6.
The Stripe destination was updated to the `release-candidate` endpoint.

Stripe then resent live event `evt_3URMpxRoz1NoMP9p1ZvftlxQ` to that exact
revision. Cloud Run recorded a Stripe-originated POST returning HTTP 200. A
subsequent read-only ledger query confirmed invoice
`inv_usage_1792181291323_5695` remained `PAID` with a zero balance, exactly one
successful payment totaling $35.00, and exactly one settlement allocation
totaling $35.00. No duplicate ledger mutation occurred and the revision emitted
no error-level logs.

The revision remained at zero traffic, the incumbent persistence revision
retained 100% of traffic, and live collection remained disabled. The rotated
secret is therefore accepted for the zero-traffic release candidate. General
collection, traffic promotion, Nevada connection fees, and merge remain
separately unauthorized.

