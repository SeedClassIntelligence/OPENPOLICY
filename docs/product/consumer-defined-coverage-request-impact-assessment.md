# Consumer-Defined Coverage Request — Scoped Impact Assessment

**Status:** Architectural impact assessment only  
**Production authorization:** None  
**Governing decision:** One provider marketplace with two baseline origins:

- `VERIFIED_EXISTING_POLICY`
- `CONSUMER_DEFINED_COVERAGE_REQUEST`

The existing-policy pathway remains unchanged. The second pathway records a consumer's own requested insurance terms without Open Polici recommending, interpreting, optimizing, or modifying them.

**Initial release scope:** Nevada only. Ohio, California, and other jurisdictions remain outside this pathway until their regional rollout and governed RulePacks are separately authorized. Nevada support must come from the governed Nevada RulePack and regional rollout controls, not from a new hard-coded state registry.

## 1. Current implementation findings

The current implementation is structurally tied to an uploaded existing policy:

- `CoverageBaseline` requires `policyId`, carrier, policy dates, and current annual/monthly premium.
- `Challenge` requires `coverageBaselineId` and embeds a `CoverageBaseline`.
- `POST /api/challenges/create` rejects a `requirements` payload and derives jurisdiction from policy/baseline evidence.
- `compareOfferAgainstBaseline` assumes a current premium and describes terms as `BETTER`, `WORSE`, reductions, improvements, and current coverage parity.
- `ConsumerPortal` begins with declarations-page upload and uses existing-policy language throughout upload, baseline confirmation, comparison, handoff, and reconciliation.
- Controlled disclosure derives policy, vehicle, and insured data from the uploaded policy and verified baseline.
- The provider marketplace, provider authority, cohorts, offer submission, selection, consent, controlled disclosure, and `AUTHORIZED_CONNECTION` projection are already separable from intake origin and can be reused after the baseline contract is generalized.

The deprecated `LegacyConsumerRequirements` object must not be revived. It contains platform-era savings and deductible gates that conflict with the new consumer-defined request model.

## 2. Required domain model extension

Introduce a discriminated baseline union rather than weakening `CoverageBaseline` with optional fields:

```ts
type BaselineOrigin =
  | 'VERIFIED_EXISTING_POLICY'
  | 'CONSUMER_DEFINED_COVERAGE_REQUEST';

interface ExistingPolicyBaseline extends CoverageBaseline {
  baselineOrigin: 'VERIFIED_EXISTING_POLICY';
}

interface ConsumerDefinedCoverageRequest {
  id: string;
  baselineOrigin: 'CONSUMER_DEFINED_COVERAGE_REQUEST';
  version: number;
  previousVersionId?: string;
  consumerId: string;
  jurisdiction: string;
  insuranceLine: InsuranceLine;
  requestedCoverages: CoverageItem[];
  requestedFacts?: Partial<Record<NormalizedPolicyFieldPath, string | number>>;
  optionalBudget?: {
    amount: number;
    period: 'MONTHLY' | 'ANNUAL';
  };
  relevantRiskFacts: Record<string, unknown>;
  consumerAttestedAt: string;
  createdAt: string;
  contentHash: string;
}

type MarketplaceBaseline =
  | ExistingPolicyBaseline
  | ConsumerDefinedCoverageRequest;
```

`Challenge` should reference a generic durable baseline:

```ts
baselineId: string;
baselineOrigin: BaselineOrigin;
baseline: MarketplaceBaseline;
```

Historical `coverageBaselineId` remains readable for existing records. It must not be repurposed to point at a consumer request.

This union changes only how the baseline is created and described. Once the immutable baseline exists, both origins enter the same challenge, provider-eligibility, cohort, submission-window, offer, selection, consent, disclosure, connection, and Commercial V2 process. No second marketplace, competition type, provider queue, or post-intake workflow is created.

### Baseline integrity rules

1. Submitted versions are immutable.
2. Any change creates a new version with `previousVersionId` and a new content hash.
3. An open marketplace opportunity is anchored to one exact version.
4. Editing the request never silently changes an open opportunity. The product must either keep the anchored version or close and reopen through an explicit consumer action.
5. Budget is optional informational context. It is not a qualification gate, provider instruction, price ceiling, ranking input, or commercial event.
6. Unknown or omitted terms remain unknown; the platform must not infer defaults as consumer intent.

## 3. Persistence and migrations

### Files

- `src/server/db/schema.ts`
- `src/server/db/migrate.ts`
- `src/server/db/postgresStore.ts`
- `src/server/db.ts` (fixture/test compatibility only)

### Recommended additive storage

Create a dedicated immutable `marketplace_baselines` table, or a dedicated `coverage_requests` table plus a generic challenge reference. A dedicated table is safer than storing new requests in `coverage_baselines`, because the latter currently requires a policy relationship and carries verified-policy semantics.

Minimum columns:

- `id`
- `consumer_id`
- `baseline_origin`
- `version`
- `previous_version_id`
- `jurisdiction`
- `insurance_line`
- `created_at`
- `attested_at`
- `content_hash`
- `payload`

Add `baseline_id` and `baseline_origin` to `challenges`. Preserve `coverage_baseline_id`, `baseline_data`, `requirements_data`, and `legacy_requirements_data` for historical reconstruction. Backfill existing challenges as `VERIFIED_EXISTING_POLICY` without rewriting their immutable payloads.

Migration requirements:

- additive and idempotent;
- no deletion or reinterpretation of policy evidence;
- deterministic historical backfill;
- uniqueness on `(consumer_id, baseline_origin, version)` or equivalent lineage key;
- foreign-key or transactional validation that the challenge's origin matches the referenced baseline;
- append-only audit events for creation, supersession, attestation, and challenge anchoring.

## 4. Consumer intake and screens

### Primary file

- `src/components/ConsumerPortal.tsx`

### Supporting files

- `src/context/AuthContext.tsx`
- `src/components/AuthModal.tsx`
- `src/components/AccountDashboard.tsx`
- `src/copy/landing.ts`
- `src/copy/copyLint.test.ts`
- `src/services/apiClient.ts`

Add an explicit intake choice before document upload:

1. **I have an existing policy** — current upload, extraction, correction, attestation, and verified-baseline flow remains unchanged.
2. **I need new insurance** — consumer-defined coverage request flow.

The new flow requires:

- insurance line;
- jurisdiction evidence appropriate to the consumer/request rather than a policy;
- consumer-entered requested coverage fields driven by the line schema;
- relevant risk facts needed for providers to evaluate the opportunity;
- optional budget entry with a clear informational-only disclosure;
- review screen showing exactly what the consumer entered;
- attestation and immutable version creation;
- explicit confirmation before opening the submission window.

The interface must not contain recommended defaults, “typical coverage,” adequacy warnings framed as advice, automated optimization, preselected limits that imply endorsement, or coverage suggestions based on budget. Legally required field-completeness or jurisdictional notices must be kept separate from consumer preference and require approved rules.

For the Nevada first release, jurisdiction is fixed to Nevada only after the consumer provides and attests to the required Nevada jurisdiction evidence. Other regional options remain unavailable. The consumer states the insurance line, coverage terms, limits, deductibles, optional budget comfort, and relevant facts; Open Polici does not alter, supplement, recommend, or interpret those selections.

Existing-policy labels such as “current carrier,” “current premium,” “your existing policy,” “reduction,” and “keep current policy” must be origin-aware. For the request pathway, the alternatives are selecting an offer, requesting another cohort while permitted, or closing the request.

## 5. API and validation changes

### Primary file

- `server.ts`

### New endpoints or equivalent origin-aware commands

- create draft consumer-defined request;
- update draft before attestation;
- attest and freeze a request version;
- create a new version from an earlier request;
- retrieve request/version history for its consumer owner;
- open a challenge from an immutable request version.

The existing `POST /api/challenges/create` must either become origin-aware or delegate to two explicit commands. It must continue rejecting consumer-authored `requirements` for the existing-policy origin.

Validation must distinguish:

- structural completeness;
- consumer attestation;
- marketplace-required risk facts;
- statutory or rule-pack requirements;
- consumer preferences.

Only the first three may be enforced by ordinary product validation. Any legally required coverage rule must come from the governed jurisdiction RulePack and fail closed when unavailable. Consumer preference must never be converted into platform judgment.

`src/domain/qualificationEngine.ts` currently contains a hard-coded statutory registry for Nevada, Ohio, and California. The new pathway must not expand or rely on that registry as legal authority. Nevada must resolve through the governed Nevada RulePack and regional rollout controls. Ohio and California are not part of this implementation scope. Removing or quarantining the obsolete hard-coded registry must be handled with focused regression protection so historical records and the existing-policy pathway are not silently reinterpreted.

Jurisdiction determination needs a new evidence pathway. The current implementation relies on `POLICY_STATED_STATE`. The request pathway must use separately named, auditable signals and must not silently derive governing jurisdiction from a ZIP prefix.

## 6. Comparison engine

### Files

- `src/domain/comparisonEngine.ts`
- `src/domain/qualificationStandard.ts`
- `src/domain/qualificationEngine.ts`
- `src/domain/policyLineFactualComparison.ts`
- `src/domain/policyLineSchemas.ts`
- `src/domain/policyLineReviewFields.ts`
- `src/types/insurance.ts`

Do not run a consumer-defined request through the present “better/worse/current protection” semantics. Add an origin-aware comparison contract.

For `VERIFIED_EXISTING_POLICY`, preserve current factual behavior and historical outputs.

For `CONSUMER_DEFINED_COVERAGE_REQUEST`, permitted field results are:

- `MATCHES_REQUEST`
- `EXCEEDS_REQUEST`
- `DIFFERS_FROM_REQUEST`
- `REQUEST_NOT_ADDRESSED`
- `PROVIDER_TERM_NOT_DOCUMENTED`

These labels describe correspondence, not suitability. “Exceeds” is quantitative only and must not mean recommended, superior, or better for the consumer.

Price behavior:

- no “savings” or current-premium difference when no current policy exists;
- show each provider's documented premium;
- if the consumer supplied a budget, show a neutral factual difference from that optional budget only after confirming that this display does not become a provider qualification or ranking mechanism;
- budget must not affect qualification, cohort order, offer order, or provider access.

`qualificationEngine.ts` should continue qualifying provider authority, documentation, validity, statutory requirements, and factual comparability. It must not disqualify a valid documented offer merely because it differs from the consumer request or budget.

## 7. Provider marketplace reuse

### Reusable without new economics

- provider organization and producer authorization;
- jurisdiction and insurance-line eligibility;
- carrier relationship and role-specific appointment enforcement;
- provider appetite, with origin-safe opportunity facts;
- stable standby ordering and consumer-controlled cohort activation;
- submission window;
- immutable offer versions;
- consumer selection;
- consent and controlled disclosure;
- provider receipt;
- `AUTHORIZED_CONNECTION` idempotency;
- Commercial V2 membership, capacity, invoicing, settlement, and reconciliation.

### Files requiring generic baseline typing or copy review

- `src/domain/eligibilityEngine.ts`
- `src/domain/competitionEngine.ts`
- `src/domain/selectionBindingEngine.ts`
- `src/components/ProviderPortal.tsx`
- `src/server/providerActivation.ts`
- `server.ts`

Current provider opportunity data includes current premium, renewal days, current carrier, and vehicle-policy assumptions. The request pathway needs an origin-safe opportunity projection that exposes only the consumer-authorized request and relevant risk facts. It must not expose budget as a command to providers or any previous/other offer information.

After that origin-safe projection is produced, the provider experience is the established experience: an eligible Nevada provider reviews the baseline, independently decides whether it can offer insurance on those terms, and submits its own documented offer. Open Polici does not control the policy, instruct the provider what to offer, or modify either side's terms.

## 8. Consent and disclosure

### Files

- `src/domain/selectionBindingEngine.ts`
- `src/domain/bindingReconciliationEngine.ts`
- `src/domain/pm5ReconciliationEngine.ts`
- `server.ts`
- `src/server/db/postgresStore.ts`

The existing recipient, consumer ownership, explicit field list, consent grant, and controlled-disclosure enforcement should be reused.

Required extensions:

- consent records identify the baseline origin and exact version;
- authorized field names are derived from the consumer request and consumer profile rather than an absent policy;
- controlled disclosure does not assume `sourcePolicy`, current carrier, policy number, existing VIN, or policy dates exist;
- the disclosed payload hash covers the request version and disclosed fields;
- selected-provider-only disclosure remains unchanged;
- the `AUTHORIZED_CONNECTION` event remains triggered once, only after successful controlled disclosure;
- no new event or price is introduced.

Post-issuance reconciliation may create the consumer's first `VERIFIED_EXISTING_POLICY` baseline. That transition must be explicit: a request baseline is not mutated into a policy baseline.

## 9. Commercial V2 invariants

### Files to regression-test, not redesign

- `src/domain/commercialPriceBook.ts`
- `src/domain/commercialEconomicsEngine.ts`
- `src/server/db/commercialStore.ts`
- `src/server/paymentCollectionBoundary.ts`
- `src/server/stripePaymentProcessor.ts`

Required invariants:

- no new billable event;
- `VPO_AVAILABLE`, `VPO_VIEWED`, `PROPOSITION_SUBMITTED`, and `CONSUMER_SELECTED` remain non-billable under V2;
- only a qualifying `AUTHORIZED_CONNECTION` can carry the line-specific connection charge;
- one charge per completed authorized handoff under the existing idempotency key;
- unselected providers receive no connection charge;
- baseline origin does not affect provider ordering or marketplace neutrality;
- optional budget never enters rating metadata as a price instruction.

## 10. Required tests

### New focused suites

1. Request creation, attestation, hashing, immutability, and version lineage.
2. Ownership and cross-consumer isolation.
3. Existing-policy challenge still rejects injected consumer requirements.
4. Request-origin challenge accepts only an attested immutable request version.
5. Origin mismatch and missing baseline fail closed.
6. Jurisdiction conflict/undetermined behavior for request evidence.
7. Each allowed request comparison result.
8. No `BETTER`, `WORSE`, savings, superiority, or recommendation language in the request pathway.
9. Omitted requested terms remain unknown and are not defaulted.
10. Optional budget never affects qualification, ordering, invitation, cohort activation, offer visibility, or billing.
11. Provider sees only authorized request/risk facts.
12. Consumer changes create a new version and do not silently alter an open challenge.
13. Selection, consent, disclosure, and provider receipt for a request-origin challenge.
14. Exactly one V2 `AUTHORIZED_CONNECTION`; no charge to unselected providers.
15. First issued policy reconciliation produces a new verified-policy baseline without mutating the request baseline.

### Mandatory non-regression

- all 11 canonical PM/CE validators;
- provider onboarding and authorization/security suites;
- policy upload, document intelligence, correction, and baseline restoration;
- existing-policy comparison snapshots and copy lint;
- consumer-controlled cohorts;
- tenant isolation;
- Stripe test-mode invoice, refund, replay, and reconciliation tests;
- TypeScript and production client/server builds.

## 11. Regulatory questions for separate review

These questions must not be answered by implementation convenience:

1. Which Nevada request fields may be presented without the UI implying a coverage recommendation?
2. Can completeness prompts distinguish missing information from substantive coverage advice?
3. How may factual “matches/exceeds/differs” language be displayed without becoming a suitability recommendation?
4. Can an optional budget difference be displayed, and under what disclosures, without functioning as steering or negotiation?
5. What Nevada jurisdiction evidence governs a consumer seeking a new policy when no policy document exists?
6. Which risk facts may be disclosed during anonymous provider review for each insurance line?
7. Does the existing authorized-connection compensation determination cover this intake origin, or must the determination expressly include it?
8. What Nevada line-specific disclosures are required before the consumer attests to requested coverage?

These issues do not require reopening Commercial V2 pricing. They govern whether and how this pathway may be enabled in a jurisdiction and line.

## 12. Recommended implementation sequence

1. Freeze this assessment as the approved Nevada-only scope.
2. Reconcile Nevada qualification with the governed Nevada RulePack and prevent the hard-coded Ohio/California registry from governing the new pathway.
3. Add the baseline-origin union and origin-safe comparison vocabulary with pure unit tests.
4. Add immutable persistence and migration/backfill tests.
5. Add request draft/version APIs and authorization tests.
6. Add the Nevada consumer intake and attestation screens.
7. Generalize challenge opening and provider opportunity projections while preserving the single marketplace.
8. Extend consent/disclosure and first-policy reconciliation.
9. Run existing-policy non-regression before enabling any new-path UI.
10. Run a two-provider Nevada sandbox acceptance with Stripe test mode.
11. Keep the feature disabled in production until Nevada review and separate deployment authorization.

## 13. Assessment conclusion

The architecture can support the second intake pathway without creating a second marketplace or changing Commercial V2. The safest implementation is an additive, immutable baseline union with origin-aware validation, comparison, copy, and disclosure. The largest technical risks are reusing existing-policy semantics where no policy exists, accidentally reviving consumer qualification gates, and leaking optional budget into provider qualification or offer ordering.

The deployed existing-policy pathway should remain untouched until the additive path passes its own tests and the full existing-policy regression suite.
