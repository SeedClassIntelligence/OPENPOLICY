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
earlier broad test key. The earlier key remains available only for rollback
until explicit key-retirement authorization is executed.

The remaining external payment gates before live activation are retirement of
the superseded broad test key and a controlled production smoke test. Live
collection remains disabled until these remaining gates are documented.

No connection fee may be activated until the separate Nevada compensation
determination is approved and its durable determination reference is attached
to the applicable immutable commercial plan version.

