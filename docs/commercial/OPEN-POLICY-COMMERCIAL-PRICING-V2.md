# Open Policy Commercial Pricing Constitution V2.0

Date: October 17, 2026
Status: Founder-approved initial-production commercial authority
Price book: `OPEN_POLICY_COMMERCIAL_V2`
Currency: USD

This specification supersedes the earlier V1 pricing direction for every new launch
enrollment. V1 remains immutable history and must not be rewritten or deleted.

## Constitutional boundaries

- Consumers pay $0.
- Providers purchase organizational capacity; payment never confers licensing,
  appointment, jurisdictional authority, ranking, selection priority, or underwriting authority.
- Marketplace availability, viewing, engagement, offer submission, consumer selection,
  binding, and verified outcomes are free marketplace events.
- `AUTHORIZED_CONNECTION` is the sole billable marketplace transaction event.
- New verified provider organizations receive one 30-calendar-day trial of the
  recurring membership selected in their approved application. The trial begins
  after authority approval, applies once per provider organization, and waives
  only the recurring membership charge. Authorized-connection fees, recurring
  add-ons, and negotiated implementation services remain billable under their
  existing controls. Trial expiration fails closed until the first membership
  invoice is settled.
- Commercial activation is platform-admin controlled and references an immutable plan version.
- Insurance-line availability and compensation authority remain independent fail-closed gates.

## Membership network

| Plan | Monthly | Seats | Jurisdictions | Concurrent competitions | Monthly offer submissions | Included services |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Solo | $99 | 1 | 1 | 5 | 25 | — |
| Agency | $249 | 3 | 2 | 20 | 100 | — |
| Premium | $499 | 5 | 3 | 60 | 300 | — |
| Network | $999 | 15 | 5 | 200 | 1,000 | Multi-location administration |
| Enterprise / Direct Carrier | Starting at $1,999 | 30 | 10 | 500 | 2,500 | Multi-location administration; enterprise reporting |

Enterprise API integration, custom integrations, capacity beyond the base package,
and specialized service commitments require explicit contractual inclusion. Direct
carriers must separately establish carrier authority before marketplace access.

Concurrent competition capacity counts accepted, non-terminal organizational
participations. Monthly offer capacity is shared by all authorized users in the
organization, counts immutable submitted offer versions within the contractual month,
and does not carry forward.

## Marketplace event prices

| Event | Price |
| --- | ---: |
| `VPO_AVAILABLE` | $0 |
| `VPO_VIEWED` | $0 |
| `PROPOSITION_SUBMITTED` | $0 |
| `CONSUMER_SELECTED` | $0 |
| `BASELINE_ACTIVATED` | $0 |
| `BOUND_ACQUISITION` | $0 |
| `VERIFIED_BOUND_OUTCOME` | $0 |

The former $35 qualified-engagement charge is eliminated.

## Authorized connection prices

| Insurance line | Fee |
| --- | ---: |
| Personal Auto | $75 |
| Homeowners | $90 |
| Renters | $40 |
| Term Life | $150 |
| Individual Health / ACA | $90 |
| Commercial General Liability | $200 |
| Business Owners Policy | $200 |
| Commercial Auto / Trucking | $225 |
| Medicare | Disabled |

A connection becomes charge-eligible only when the consumer selected the provider's
offer, granted the required authorization, controlled disclosure completed, the
connection succeeded, an applicable active agreement exists, the line is operational,
and the governing compensation determination permits the charge. Selection alone is
not billable. Retries, duplicate disclosure, and replay cannot create another charge.

## Monthly capacity add-ons

| Add-on | Monthly fee |
| --- | ---: |
| Additional producer seat | $35 |
| Additional jurisdiction | $50 |
| Additional 10 concurrent competition slots | $50 |
| Additional 100 monthly offer submissions | $50 |

Capacity is commercial scope only. It never substitutes for identity, role,
organization, licensing, appointment, line, or jurisdiction authorization.

## Optional monthly services

| Service | Monthly fee |
| --- | ---: |
| Workflow Automation | $149 |
| Enterprise Reporting | $199 |
| API Integration | $399 |
| Multi-Location Administration | $149 |

An optional service must be operational, explicitly contracted, and entitlement-gated
before use or billing. A service included in a membership cannot be billed again as a
standalone add-on for the same entitlement.

## Enterprise implementation

Enterprise implementation is a separately executed, one-time agreement between
$2,500 and $10,000. The exact charge and supporting agreement reference must be
recorded. Payment does not establish marketplace authority.

## Governance and financial evidence

Every agreement records its tier, price, included capacities, purchased capacities,
included and purchased services, connection rates, billing terms, and effective dates.
Catalog changes require a new immutable version. Every charge must trace from the
marketplace event through organization, agreement, plan version, insurance line,
rating decision, billable event, invoice, payment or settlement, and any adjustment,
refund, or reconciliation.

The commercial model tracks recurring membership revenue, capacity and service
revenue, and authorized-connection revenue separately. The initial contribution-margin
planning target is 55% or greater after attributable variable costs and before fixed
corporate overhead; it is a management target, not achieved-performance marketing.

This document is the authoritative implementation specification for Open Policy's
initial production commercial configuration.
