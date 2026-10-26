# Provider Access and Commercial Structure Audit

Date: 2026-10-17
Branch reviewed: `claude/eager-curie-yqreig`
Baseline reviewed: `cb75912`

## Purpose

This audit separates three concerns that must not be collapsed:

1. **Access authority** — what a provider organization and its users may do.
2. **Commercial agreement** — the plan version, capacity and optional services an organization purchases.
3. **Event charges** — charges resulting from qualifying marketplace events under the organization's immutable agreement.

This document records implemented repository behavior. It does not create prices, plans, legal authority or marketplace access.

## Verified architecture

### Provider organization and user access

The provider domain recognizes five organization types:

- `INDEPENDENT_AGENCY`
- `BROKERAGE`
- `DIRECT_CARRIER`
- `CAPTIVE_AGENCY`
- `OTHER_AUTHORIZED_PROVIDER`

Provider users have one of five operational roles: `OWNER`, `ADMIN`, `AGENT`, `QUOTER`, or `VIEW_ONLY`.

Provider marketplace access is not established by payment alone. It depends on server-resolved provider identity and organization mapping, active organization/user state, applicable provider authority, jurisdiction and insurance-line activation, commercial capacity, and opportunity/cohort participation.

The jurisdiction authority engine deliberately does not consult commercial entitlements. Commercial jurisdiction capacity is a purchased limit; it is not evidence of legal authority.

### Direct-carrier gap

`DIRECT_CARRIER` has a separate authority path. That path currently fails indeterminate because certificate-of-authority evidence is not modeled. A direct carrier therefore cannot be represented as fully authorized merely by purchasing a plan or entering a producer license.

### Commercial catalog

The durable commercial model supports four plan segments: `SOLO`, `AGENCY`, `NETWORK`, and `ENTERPRISE`, with five founder-approved V2 membership packages.

Production seeding creates structural catalog entries for:

| Plan code | Segment | V2 launch price/version status |
| --- | --- | --- |
| `PLAN_SOLO` | Solo | $99/month; one seat, one jurisdiction, five concurrent competitions and 25 monthly offer submissions |
| `PLAN_AGENCY` | Agency | $249/month; three seats, two jurisdictions, 20 concurrent competitions and 100 monthly offer submissions |
| `PLAN_OPEN_POLICY_PREMIUM` | Agency | $499/month; five seats, three jurisdictions, 60 concurrent competitions and 300 monthly offer submissions |
| `PLAN_NETWORK` | Network | $999/month; 15 seats, five jurisdictions, 200 concurrent competitions, 1,000 monthly offer submissions and multi-location administration included |
| `PLAN_ENTERPRISE` | Enterprise | Starting at $1,999/month; 30 seats, 10 jurisdictions, 500 concurrent competitions, 2,500 monthly offer submissions, multi-location administration and enterprise reporting included |

V1 remains immutable historical data and does not govern new production enrollment. Zero-dollar fixture versions remain test-only and are not production offers.

Enterprise implementation is a negotiated one-time service charge of $2,500–$10,000. It is not an enterprise membership tier and does not itself grant marketplace authority.

### Commercial activation

A provider can read the active plan catalog and its own commercial state. A provider cannot self-activate a paid commercial agreement. The provider enrollment endpoint fails closed with `COMMERCIAL_ACTIVATION_REQUIRES_PLATFORM_ADMIN`; activation is performed by an authorized platform financial administrator.

An active commercial agreement binds exactly one provider organization to an immutable plan version. Entitlements are derived from that version. Agreement status and capacity remain distinct from provider licensing and opportunity authorization.

### Event billing

The V2 price book independently defines event prices. They are not access roles or plan tiers:

- `AUTHORIZED_CONNECTION`: insurance-line price after consumer-authorized disclosure and successful controlled connection, subject to the compensation-determination gate.
- Every other marketplace event, including `VPO_AVAILABLE`, `VPO_VIEWED`, `PROPOSITION_SUBMITTED`, `CONSUMER_SELECTED`, `BASELINE_ACTIVATED`, `BOUND_ACQUISITION`, and `VERIFIED_BOUND_OUTCOME`, is free.

## Current onboarding mismatch

The public provider UI now creates a durable, idempotent provider application and collects organization type, legal name, requested V2 membership, jurisdiction, insurance line, applicable producer evidence and a direct-carrier authority reference. Submission explicitly grants neither marketplace authority nor a commercial agreement. The remaining review and activation workflow does not yet establish:

- whether the applicant is an individual producer joining an existing organization or an organization owner creating a new organization;
- verified direct-carrier certificate-of-authority evidence (the application records a reference for review only);
- captive versus independent carrier relationships;
- the durable provider user and organization mapping required by server identity;
- an activated immutable commercial agreement from the selected plan request;
- payment authorization; or
- marketplace activation.

The form creates a Firebase profile with `PENDING_VERIFICATION` and a PostgreSQL-authoritative application in `SUBMITTED` state. The Provider Desk remains closed until a verified database mapping and active organization status exist. The interface labels this as an application rather than completed provider access.

## What is established and may be presented publicly

- Consumers pay $0.
- All five V2 membership packages and their immutable capacities are established.
- Optional services, capacity add-ons and authorized-connection prices are separately defined.
- Payment never establishes licensing, carrier authority, opportunity access, ordering, or consumer selection.
- Enterprise / Direct Carrier is the approved fifth membership package, while direct carriers must still establish carrier authority independently.

## Provider purchase-flow boundaries

The V2 constitution resolves the membership catalog and prices. The purchase journey must still preserve these independent gates:

1. classify the applicant and provider organization;
2. establish durable provider user and organization mapping;
3. verify applicable producer or direct-carrier authority;
4. select an immutable V2 membership version;
5. collect payment without treating payment as regulatory or marketplace authority; and
6. permit marketplace access only after every identity, authority, jurisdiction, line, commercial and activation gate passes.

The provider flow must not describe the $499 Premium package as universal, double-charge included services, or imply that payment activates an unavailable insurance line.

## Recommended bounded correction

The public flow should be completed as follows:

1. Label consumer enrollment **Create Free Consumer Account** and state that consumer use is $0.
2. Change the provider CTA from **Create Provider Account** to **Apply for Provider Access**.
3. Make the first provider step classify the applicant and organization; do not activate marketplace access or a commercial agreement.
4. Present all five V2 packages with their exact capacities and included services.
5. Route carrier and enterprise applicants through authority verification and commercial activation without implying that payment supplies authority.
6. Keep financial activation in the protected administrator workflow.
7. Model and verify certificate-of-authority evidence before enabling the `DIRECT_CARRIER` authority path.

## Current disposition

**The V2 pricing constitution is the launch authority and the repository commercial model conforms to it. The provider onboarding and purchase journey still requires complete organization classification, durable provider mapping, authority verification and payment-to-activation acceptance. The direct-carrier authority path remains fail-closed until certificate-of-authority evidence is modeled.**

## Verification of the supplied full-revenue audit

Repository verification against `cb75912` produced the following disposition:

| Supplied claim | Disposition | Repository evidence |
| --- | --- | --- |
| Premium V1 defines two seats and one jurisdiction but no included view/engagement/concurrent-opportunity quantity | **Confirmed** | The immutable V1 terms include seats and jurisdictions, but no included opportunity or engagement capacity. |
| Only personal auto may enter the accepted policy pipeline | **Confirmed** | `canEnterPolicyPipeline` requires `implementationStatus === 'ACCEPTANCE'`; only personal auto has that status. |
| Property and selected commercial lines have meaningful schema/normalization preparation but are not accepted end to end | **Confirmed** | Homeowners, renters, CGL and BOP remain `DEVELOPMENT` and are explicitly denied entry by registry tests. |
| Commercial Auto is interest-only; term life and individual health are locked | **Confirmed** | Canonical insurance-line registry. Medicare has a registered commercial price but no operational registry entry and remains non-operational. |
| Event projection sources and idempotency boundaries exist | **Confirmed** | Durable invitation, participation, offer version, selection, disclosure, handoff and outcome records project their corresponding commercial events. |
| Four priced premium services lack accepted delivery surfaces | **Stale / contradicted** | All four now have entitlement-gated backend routes and provider controls; the availability registry is empty, service controls are seeded `ENABLED`, and focused security tests cover entitlements, API credential hashing/scopes/revocation, cross-tenant location isolation and owner disablement. This does not make unpurchased services available to an organization. |
| Stripe real-payment acceptance is not established | **Stale / contradicted** | `COMMERCIAL-ACTIVATION-ACCEPTANCE.md` records controlled test-mode acceptance and a controlled live-mode $35 payment, signed webhook HTTP 200, exactly-once ledger allocation, secret rotation and replay validation on the zero-traffic release candidate. General live collection remains disabled. |
| Master Admin price and activation controls are not complete | **Overbroad** | Protected administrator controls exist for platform financial summaries, Premium agreement activation, provider status, compensation determinations, plan versions, premium-service controls, negotiated implementation charges and payment operations. Remaining provider-onboarding and tier-definition gaps must not be mislabeled as absence of administrator controls. |
| Missing plan version can fall back to a fabricated zero-dollar plan | **Confirmed defect; corrected** | The fallback was removed. Administrator enrollment now returns `409 COMMERCIAL_PLAN_VERSION_REQUIRED` and creates no agreement when the selected structural plan has no approved version. |

The corrected business conclusion is: **commercial accounting, V2 tier definition, premium-service delivery and controlled Stripe acceptance are further advanced than the supplied audit states; non-auto policy processing, direct-carrier authority and the complete public application-to-contract journey remain incomplete.**
