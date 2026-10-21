# Open Polici — Nevada Provider Marketplace End-to-End Acceptance

Date: October 20, 2026  
Commercial authority: `OPEN_POLICY_COMMERCIAL_V2`  
Assessment after completion work: **PARTIALLY — the platform path passes with isolated simulated organizations; actual-agency credential acceptance remains unperformed**

## Evidence limits

The original no-change audit identified implementation and evidence gaps. Completion work then corrected the bounded gaps, recorded the founder's two-rule disposition, locally published the resulting RulePack in an isolated sandbox, and reran the full acceptance stack. The Windows `uv_os_get_passwd` host defect was isolated with a test-only shim; validator databases were moved into per-suite temporary roots. No production code was weakened to make the host pass.

Final executed evidence: all 11 canonical suites pass; onboarding/activation 43/43; authorization/security 51/51; TypeScript passes; client and server production builds pass. The scope-aware local RulePack publication produced SHA-256 `ac732067ac1aa6c753732a5b39c084d6bcafc82830548b3b1aa74ad5239c1078`, was explicitly labeled `SANDBOX_ONLY`, and was removed after the run.

## Stage results

| # | Stage | Result | Evidence | Wave 0 dependency and failure behavior |
|---|---|---|---|---|
| 1 | Agency registration, organization, producers | **PARTIAL** | Application, review and activation routes exist. Activation requires approval, matching V2 agreement and settled subscription. Application captures one producer; portal still defines demo provider users; no provider-owned producer creation was demonstrated. | Research rules are not needed to apply, but real authority evidence is needed to participate. Activation fails closed on agreement/payment and direct-carrier certificate gaps. |
| 2 | Separate license, line, carrier and appointment evaluation | **PARTIAL** | Authority engine evaluates licenses, line classes, relationships and carrier certificates. Runtime machine contract still uses universal `appointmentRequired`; corrected agent/broker model remains in unpublished candidate `NV-APPOINTMENT-001`. | **Yes.** No published in-force Nevada producer rule returns `INDETERMINATE`, not authority. Correctly fail closed. |
| 3 | Appetite and eligible opportunities | **PARTIAL** | Appetite PATCH, opportunities, invitations and capacity checks exist. Only fixture organizations were demonstrated. | **Yes for eligibility.** Appetite is preference, not authority; absent rules fail closed. |
| 4 | Consumer upload and structured baseline | **PARTIAL** | Upload, extraction, correction, malware, verification and baseline routes exist. Protected deployed endpoint returned 401 without identity. No fresh deployed upload was completed. | Not needed for factual extraction; needed before legal qualification/enforcement. Missing facts fail baseline creation. |
| 5 | Multiple providers and offers | **MOCKED** | PM validators and cohort seeding cover multiple fixture providers. Portal defaults include `org_sierra`, `org_apex`, `org_buckeye` and a fixture challenge. No real agencies participated. | **Yes for “eligible.”** Synthetic participation cannot prove authority. |
| 6 | Review, selection, consent | **PARTIAL** | Selection, consent and disclosure routes exist. CE-3 asserts selection/consent alone create no connection. No fresh browser completion occurred. | Provider eligibility depends on Wave 0; consent mechanics are separate and fail closed without required state. |
| 7 | Actionable provider connection | **PARTIAL** | Binding handoff, controlled disclosure and provider-scoped routes exist. CE-3 places the connection event at disclosure. No real provider received one. | **Yes.** Provider authority and compensation controls must pass. Live charging stayed disabled. |
| 8 | Correct V2 event, no duplicate billing | **PARTIAL** | V2 makes `VPO_ENGAGED` free and `AUTHORIZED_CONNECTION` the sole billable marketplace event. CE-3/store code contains event and idempotency assertions. No fresh authenticated V2 connection invoice ran. | **Yes.** Missing applicability determination must block rating/charging. |
| 9 | Provider dashboard operations | **PARTIAL** | Portal has Opportunities, Competitions, Workspace, Profile and Account views plus capacity, invoice, payment, refund and handoff calls. Hard-coded demo identities/default challenge remain; no real account completed every view. | Wave 0 is required for Nevada opportunities, not account display. Anonymous protected endpoints returned 401. |

## Commercial V2 finding

The repository correctly defines five V2 memberships, zero $35 engagement fee, a $75 Nevada personal-auto authorized connection, selection/consent as non-billable, controlled disclosure as the intended boundary, and bound outcomes as unpriced. No economics redesign was found.

One acceptance concern remains: deployed `/api/commercial/plans` returned all five V2 plans **and historical V1 plan metadata**. Activation rejects a non-V2 agreement, but new enrollment must exclude V1 before selection rather than relying only on final activation rejection.

## Updated answer

**PARTIALLY.** The application now supports the required organization-isolated lifecycle and proves it using safe simulated provider identities and the founder-approved local Nevada authority pack. It is not truthful to say that ten real agencies operated today because no ten real agency credentials were supplied. The remaining step is to onboard actual organizations and their evidence through the already tested controls; it is not another architecture, pricing, or legal-research project.

## Prioritized production blockers

1. Independently verify and publish the Nevada RulePack; all 26 candidates remain `UNVERIFIED`/`UNPUBLISHED`.
2. Implement the independently approved agent-versus-broker appointment model in the runtime machine contract.
3. Demonstrate authoritative organization, individual, line, carrier and appointment/broker-placement evidence with expiration handling.
4. Demonstrate provider-controlled producer onboarding; remove or production-isolate demo identities and fixture defaults.
5. Run two or more independently authenticated, authority-cleared Nevada agencies through one real safe-data competition.
6. Complete deployed selection → consent → disclosure → provider receipt with tenant-isolation evidence.
7. In Stripe test mode, prove exactly one $75 event at disclosure, zero earlier charges, replay dedupe, invoice allocation, refund and reconciliation.
8. Exclude historical V1 from new-enrollment choices while retaining immutable history.
9. Re-run all PM/CE, onboarding, authorization, document, security and build suites on a functioning Node host.
10. Complete and retain a browser-visible consumer/provider dashboard walkthrough.

## Control state

No merge, deployment, production-data mutation or live charge activation occurred. Commercial V2 economics were unchanged. Nevada rules remain unavailable for production enforcement.
