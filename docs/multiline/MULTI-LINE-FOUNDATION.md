# Open Policy Multi-Line Foundation

## Status

This document records the first multi-line implementation checkpoint. It does
not claim that every listed insurance line is transaction-ready, legally
approved, or active in any jurisdiction.

## Canonical model

Open Policy now separates four questions that were previously easy to
conflate:

1. **Does the insurance line exist in the product model?**
   `src/domain/insuranceLineRegistry.ts` owns this answer.
2. **Is the jurisdiction's regional rollout cohort unlocked?**
   `src/domain/jurisdiction/jurisdictionRollout.ts` owns this answer.
3. **Is this line implemented deeply enough to enter its policy pipeline?**
   The line registry's `implementationStatus` owns this answer.
4. **Is this exact jurisdiction and line authorized for production?**
   Durable regulatory rules, provider authority, market-activation gates, and
   the market-activation engine own this answer. Static configuration cannot
   grant production authority.

The cross-product projection in
`src/domain/jurisdictionLineAvailability.ts` combines the first three answers
for rollout and UI purposes. Its `productionAuthorized` field is deliberately
and permanently `false`; it is not a second regulatory path.

## Regional rollout

The existing regional sequence remains canonical:

- Wave 0: Nevada
- Wave 1: West remainder
- Wave 2: Midwest
- Wave 3: South
- Wave 4: Northeast

All 50 states and the District of Columbia occur exactly once. Nevada occurs
exactly once. Regional unlocking controls availability for rollout work; it
does not imply that a state has verified rules or can conduct production
transactions.

## Line statuses

| Insurance line | Current status | Meaning |
| --- | --- | --- |
| Personal Auto | `ACCEPTANCE` | Existing end-to-end pipeline remains available for acceptance testing. |
| Homeowners | `DEVELOPMENT` | Canonical line, document classification, versioned policy schema, and source-backed field normalization exist. Comparison, offer, handoff, reconciliation, and full acceptance remain to be implemented. |
| Renters | `DEVELOPMENT` | Canonical line, document classification, versioned policy schema, and source-backed field normalization exist. Dwelling coverage is never fabricated. Remaining lifecycle profiles and full acceptance remain to be implemented. |
| Commercial Auto | `INTEREST_ONLY` | Account interest may be recorded; policy processing is not open. |
| Commercial General Liability | `DEVELOPMENT` | Shares commercial document infrastructure with BOP and now has source-backed field normalization, while retaining its own policy and comparison contract. |
| Business Owners Policy | `DEVELOPMENT` | Property/liability package normalization is distinct from Homeowners; remaining lifecycle profiles and full acceptance are not complete. |
| Term Life | `LOCKED` | Represented in the canonical universe but not exposed for registration or processing. |
| Individual Health | `LOCKED` | Represented in the canonical universe but not exposed for registration or processing. |

## Enforced boundaries

- New document-ingestion HTTP requests must identify a canonical insurance
  line. The existing extraction pipeline rejects lines that are not in
  `ACCEPTANCE` instead of processing their documents as auto policies.
- Historical records without a line are interpreted as Personal Auto for
  backward compatibility; new flow records propagate the chosen line.
- Consumer onboarding derives its choices from the line registry. Choosing a
  development or interest-only line records the requested line but does not
  route the consumer into the Personal Auto portal.
- Provider eligibility derives the required line from the challenge. A valid
  state license is insufficient when the organization or its appetite omits
  the challenge's insurance line.
- Jurisdiction rollout, provider eligibility, regulatory verification, and
  production activation remain independent fail-closed gates.

## Acceptance evidence for this checkpoint

- Registry tests prove the line universe is unique and only Personal Auto can
  enter the current policy pipeline.
- Matrix tests prove all 51 jurisdictions are crossed with every registered
  line exactly once, locked regions stay locked, and static rollout data can
  never confer production authority.
- Eligibility tests prove both organization-line and appetite-line mismatch
  deny provider participation even when the provider has a valid license for
  the jurisdiction.
- The canonical PM, commercial, semantic, and PR-0A suites remain regression
  gates.

## Remaining work by line

Each line must receive its own versioned document classification, extraction
and normalization schema, consumer correction model, policy schema,
comparison profile, provider authority mapping, offer validation,
qualification, controlled disclosure, handoff, issued-policy reconciliation,
tests, and regulatory corpus before its status can advance to `ACCEPTANCE`.
Moving a line to `ACCEPTANCE` still does not activate any jurisdiction for
production.

The normalization dispatcher is line-aware. Personal Auto retains its existing
normalizer; Homeowners and Renters use the property-policy normalizer; CGL and
BOP use a distinct commercial normalizer. Every other unfinished line returns
`REVIEW_REQUIRED` with no extracted business facts. This is an implementation
safety boundary, not market authorization.

Consumer corrections for the development cohort are bounded by the same
versioned line schema. A Homeowners correction cannot introduce an Auto field,
a Renters correction cannot introduce dwelling coverage, and a CGL correction
cannot introduce BOP property coverage. The line-level comparison contract is
factual only, limits its matrix to coverage terms, and keeps premium differences
separate from those field differences. Policy identifiers, carrier names, dates,
and risk-address metadata are not misclassified as coverage-term differences.

## Owner operations requirement

The existing audit console is the starting surface for an owner backend, not a
complete master administration system. Owner operations must remain available
only to server-authorized `ADMIN` identities; public signup can never create an
administrator. The owner surface must ultimately govern and evidence:

- insurance-line implementation status and rollout visibility;
- regional rollout configuration and state-by-line activation status;
- provider organizations, users, licenses, appointments, appetites, and access;
- document-processing health and review queues;
- regulatory source, ruleset, verification, publication, and activation state;
- commercial agreements, capacity, billing, and settlement oversight without
  influencing provider eligibility or offer presentation;
- identity/access review, audit-chain verification, incident controls, and
  controlled rollback or suspension operations.

This checkpoint restricts owner/audit, telemetry, architecture, and reset UI
controls to authenticated administrators and adds rollout visibility to the
owner console. Administrative mutation workflows require their own explicit,
audited commands and are not implied by a dashboard button.

## Property and small-commercial document contracts

The next development cohort now has versioned, line-specific evidence schemas:

- Homeowners records residence, dwelling, other-structures, personal-property,
  loss-of-use, liability, medical-payments, and deductible evidence.
- Renters records residence, personal-property, loss-of-use, liability,
  medical-payments, and deductible evidence without inventing dwelling coverage.
- Commercial General Liability records the insured business, locations and
  classifications plus occurrence, aggregate, products-completed-operations,
  advertising-injury, and medical-expense evidence.
- Business Owners Policy records commercial property, business income, extra
  expense, liability limits, business identity and locations, and deductible
  evidence.

The classifier can identify evidence supporting these line families and marks
a declared-line/document-line conflict for review. Ambiguous evidence stays
`INDETERMINATE`; filenames, signup selections, and account preferences cannot
convert a document into policy truth. The lines remain in `DEVELOPMENT` and
cannot enter the live Personal Auto pipeline.
