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

## Production hold

The internal accounting adapter is not a payment processor. It does not contact
a bank, card network, ACH provider, or payment gateway. Production direct HTTP
payment and refund mutation therefore fails closed with
`PAYMENT_PROCESSOR_NOT_CONFIGURED` until a real processor integration is
implemented and accepted.

Production collection requires a separate bounded integration that provides:

- provider customer/payment-method setup without Open Policy handling raw card
  data;
- processor-created payment intents or ACH debits;
- signed webhook verification and replay protection;
- processor event ID idempotency;
- authoritative success/failure/pending status mapping;
- refund execution through the processor before ledger recording;
- reconciliation between processor settlements and Open Policy invoices;
- secret management, key rotation, audit evidence, and restricted financial
  administration;
- end-to-end sandbox acceptance followed by a controlled production smoke test.

No connection fee may be activated until the separate Nevada compensation
determination is approved and its durable determination reference is attached
to the applicable immutable commercial plan version.

