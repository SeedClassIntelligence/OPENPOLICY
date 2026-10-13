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
| Homeowners | `DEVELOPMENT` | Canonical line exists; line-specific document, policy, comparison, offer, handoff, and reconciliation profiles remain to be implemented. |
| Renters | `DEVELOPMENT` | Canonical line exists; line-specific profiles remain to be implemented. |
| Commercial Auto | `INTEREST_ONLY` | Account interest may be recorded; policy processing is not open. |
| Commercial General Liability | `INTEREST_ONLY` | Account interest may be recorded; policy processing is not open. |
| Business Owners Policy | `INTEREST_ONLY` | Account interest may be recorded; policy processing is not open. |
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
