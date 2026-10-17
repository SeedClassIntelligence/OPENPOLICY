# Open Policy Premium V1 Revenue Contract

> Historical contract only. It remains immutable for audit and historical plan-version
> interpretation, but it is superseded for all initial production enrollment by
> `OPEN-POLICY-COMMERCIAL-PRICING-V2.md` effective October 17, 2026.

Effective: 2026-10-14

Price book: `OPEN_POLICY_PREMIUM_V1`

Open Policy charges insurance providers through membership, optional services, and qualifying commercial events. Consumers pay nothing in V1. Policy upload, baseline creation, opportunity activation, viewing, offer submission, and consumer selection do not themselves generate charges.

## Provider membership

| Item | Price | Included capacity |
| --- | ---: | --- |
| Premium Membership | $499/month | Provider marketplace and commercial platform; two producer seats; one jurisdiction |

## Marketplace events

| Event | V1 price | Billing boundary |
| --- | ---: | --- |
| `VPO_AVAILABLE` | Free | Eligible provider receives an activated opportunity |
| `VPO_VIEWED` | Free | Provider views an opportunity |
| `VPO_ENGAGED` | $35 | Affirmative qualified engagement; once per provider organization per policy opportunity |
| `PROPOSITION_SUBMITTED` | Free | Provider submits or updates an offer during the open window |
| `CONSUMER_SELECTED` | Free | Consumer selects an offer |
| `AUTHORIZED_CONNECTION` | $100–$350 | Consumer-authorized disclosure and successful controlled connection; not a confirmed sale |
| `BOUND_ACQUISITION` | Unpriced | Bound outcome is measured without a separate V1 fee |
| `VERIFIED_BOUND_OUTCOME` | Unpriced | Reconciled issued-policy outcome is measured without a separate V1 fee |
| `BASELINE_ACTIVATED` | Free | Verified consumer baseline is activated |

`VPO_ENGAGED` is not a viewing fee. The canonical idempotency boundary is provider organization plus policy opportunity. `AUTHORIZED_CONNECTION` is distinct from selection and from a later bound-policy outcome.

## Authorized connection prices

| Insurance line | Price | V1 operational status |
| --- | ---: | --- |
| Personal auto | $125 | Compensation determination required |
| Homeowners | $150 | Compensation determination required |
| Renters | $100 | Compensation determination required |
| Term life | $225 | Compensation determination required |
| Individual health / ACA | $150 | Compensation determination required |
| Medicare | $200 | Registered but non-operational |
| Commercial general liability | $350 | Compensation determination required |
| Business owners policy | $350 | Compensation determination required |
| Commercial auto / trucking | $350 | Compensation determination required |

Publishing a price is not compensation approval. Every operational authorized-connection fee fails closed until an approved determination reference is attached to the applicable immutable commercial agreement. Medicare additionally fails closed as an unavailable insurance line.

## Optional monthly services

| Service | Price | V1 operational status |
| --- | ---: | --- |
| Additional producer seat | $49/month | Executable |
| Additional jurisdiction | $75/month | Executable, subject to provider licensing and qualification |
| Workflow automation | $199/month | Executable; entitlement-gated workflow rules |
| Enterprise reporting | $299/month | Executable; tenant-scoped reporting |
| API integration | $499/month | Executable; scoped, revocable credentials |
| Multi-location administration | $199/month | Executable; tenant-scoped offices and assignments |

Every optional service requires an active corresponding entitlement. Commercial purchase never changes marketplace ordering, eligibility, offer presentation, or consumer selection.

## Enterprise implementation

Enterprise implementation is a negotiated one-time charge of $2,500–$10,000. An authorized platform administrator must record the exact executed-agreement amount and supporting reference. No automatic implementation charge is permitted.

## Consumer price

Consumer enrollment, policy upload, baseline verification, opportunity participation, notifications, offer review, selection, and authorized handoff carry no consumer fee in V1.

## Revenue formula

Provider revenue consists of:

`$499 monthly membership + $35 qualified engagements + approved line-specific authorized connections + executable optional add-ons + negotiated enterprise implementation`

For personal auto, one opportunity that reaches both billable events produces an illustrative $160 in event revenue: $35 engagement plus $125 authorized connection, excluding membership. It does not imply a bound-policy charge.
