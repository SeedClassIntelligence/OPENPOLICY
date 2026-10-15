# Open Policy Commercial Activation Acceptance

Date: 2026-10-14  
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

Before live activation, the remaining external gate is end-to-end Stripe test
mode acceptance using Secret Manager configuration: card success/failure,
eligible ACH pending-to-success, signed-webhook replay, processor-first refund,
settlement reconciliation, and key-rotation procedure. A controlled production
smoke test follows sandbox acceptance; live collection remains disabled until
both are documented.

No connection fee may be activated until the separate Nevada compensation
determination is approved and its durable determination reference is attached
to the applicable immutable commercial plan version.

