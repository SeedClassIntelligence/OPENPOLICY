# Nevada Wave 0 — Stage 2 Founder Verification Evidence Package

Date: October 20, 2026  
Scope: Existing 26 Nevada personal-auto candidates only  
Status: **author-prepared, unpublished, unverified**

## Boundary

This package separates Codex's authoring work from the human decision. It does not require an outside consultant or a second company. The Open Polici founder may act as verifier and publisher, or may designate another human reviewer. Exact source bytes are stored under `research/pr0b/NV/sources/`; each evidence reference below identifies its SHA-256.

## Newly resolved source-history evidence

| Subject | Author-proposed resolution | Official evidence |
|---|---|---|
| Default Nevada effective date | A law without a specific date becomes effective October 1 following passage. | NRS 218D.330(1), `26a4b05e…076` |
| UM/UIM current text | AB 18 amended NRS 690B.020 in 2021 and has no special clause; proposed current-text boundary is 2021-10-01. | 2021 ch. 29, `65c5821f…4ec`; NRS 218D.330 |
| Evidence of insurance | SB 67 § 263 amended NRS 690B.023; § 320 made the act effective 2015-07-01. | 2015 ch. 522, `55465660…32d0` |
| Rebate/inducement | AB 244 is the last amendment shown in the consolidated history and became effective 2017-07-01. The former 2023 date was unsupported. | 2017 ch. 287, `8a2f1ddd…57f4` |
| Cancellation notice and protected midterm cancellation | Current text traces to 2003 ch. 495; proposed current-text boundary is 2003-10-01 under the default rule. | `068e321f…1e6`; NRS 218D.330 |
| Nonrenewal | Current text traces to 1987 ch. 427; proposed current-text boundary is 1987-10-01 under the default rule. | `2257cf46…3fed`; NRS 218D.330 |
| Renewal changes | AB 18 supplies the current exception text; proposed current-text boundary is 2021-10-01. | `65c5821f…4ec`; NRS 218D.330 |
| Binder replacement | Provision added in 1983; proposed boundary is 1983-10-01 under the default rule. | `dfac8dd4…35d`; NRS 218D.330 |

These are proposed author resolutions for the captured current text. Historical transactions before a boundary require the predecessor version; a verifier must approve each boundary before it controls a rule.

## Provider-authority decision matrix

| Founder verification question | Candidate | Required proof | Prohibited shortcut |
|---|---|---|---|
| Organization licensing | `NV-BUSINESS-ENTITY-LICENSE-001` | Entity identity, active Nevada business-entity license, designated responsible producer, date | An individual's license does not prove organization authority. |
| Individual licensing | `NV-PRODUCER-001`, `NV-LINE-AUTHORITY-001` | Natural-person identity, active producer license, applicable line authority, date | Entity licensing or payment does not prove individual authority. |
| Carrier authority/relationship | `NV-INSURER-AUTHORITY-001` | Insurer identity, active certificate of authority, authorized kind, actual carrier relationship, date | Appointment or platform membership does not prove insurer authority. |
| Agent appointment | `NV-APPOINTMENT-001` | Transaction role = agent and active insurer appointment on transaction date | Appointment must not be required universally for brokers. |
| Broker placement | `NV-APPOINTMENT-001` | Transaction role = broker; licensed-agent/authorized-insurer placement evidence or an independently approved subsection 5 exception | “No appointment required” does not remove the separate broker placement restriction. |

## Rule-by-rule founder-verifier items

| Candidate | Evidence prepared | Remaining human decision | Proposed resolution |
|---|---|---|---|
| NV-MINIMUM-LIABILITY-001 | NRS 485.185 and 2017 date chain | Confirm $25k mapping, moped exception and 2018-07-01 boundary | Verify if evidence and fixtures reproduce the statute. |
| NV-MINIMUM-LIABILITY-002 | Same source chain | Confirm $50k per-crash aggregation | Verify with the same date/exception controls. |
| NV-MINIMUM-LIABILITY-003 | Same source chain | Confirm $20k property mapping | Verify with the same date/exception controls. |
| NV-UM-UIM-001 | NRS 690B.020; 2021 ch. 29; default-date statute | Confirm boundary, rejection-form sufficiency and renewal treatment | Require insurer-furnished signed rejection evidence when coverage is absent. |
| NV-PROOF-001 | NRS 690B.023; 2015 ch. 522 §§263,320 | Confirm approved form/format and required fields | Treat 2015-07-01 as current-text boundary if approved. |
| NV-PRODUCER-001 | NRS 683A.201 | Confirm individual license evidence and line mapping | Evaluate separately from entity, carrier and appointment records. |
| NV-COMPENSATION-001 | NRS 683A.361 and conduct inventory | Classify each actual function under sell/solicit/negotiate | Keep compensation blocked for any function not independently cleared. |
| NV-REBATE-001 | NRS 686A.130; 2017 ch. 287 | Confirm benefit-specific exception analysis | Correct boundary to 2017-07-01; require recorded exception evidence. |
| NV-APPOINTMENT-001 | NRS 683A.321 role split | Confirm role evidence, lookup source and subsection 5 handling | Agent requires appointment; broker does not, but broker placement restriction remains. |
| NV-INSURER-AUTHORITY-001 | NRS 680A.060 | Identify operational lookup and kind mapping | Fail closed on absent/stale carrier authority. |
| NV-BINDER-001 | NRS 687B.182-.183 | Confirm reconciliation-only scope and approved-form evidence | Do not let Open Polici issue a binder. |
| NV-CANCELLATION-NOTICE-001 | NRS 687B.310; 2003 ch. 495 | Confirm interaction with .320-.350 and notice method | Keep common content separate from grounds/timing. |
| NV-LINE-AUTHORITY-001 | NRS 683A.261 | Normalize personal-lines vs property/casualty codes | Require an applicable active authority, not a label match. |
| NV-BUSINESS-ENTITY-LICENSE-001 | NRS 683A.251 | Confirm entity license and responsible-producer proof | Evaluate separately from every individual producer. |
| NV-MIDTERM-CANCELLATION-001 | NRS 687B.320; 2003 ch. 495 | Confirm boundary and normalize each ground | Do not automate ground validity until ground propositions are approved. |
| NV-NONRENEWAL-001 | NRS 687B.340; 1987 ch. 427 | Confirm counting, exceptions and remedy | Use 1987-10-01 boundary if approved. |
| NV-RENEWAL-CHANGE-NOTICE-001 | NRS 687B.350; 2021 ch. 29 | Confirm counting and mixed-change classification | Use 2021-10-01 boundary if approved. |
| NV-INFORMATION-PRACTICES-NOTICE-001 | NAC 679B.685 | Classify each actor and assign notice duty | Apply only after function-specific classification. |
| NV-DISCLOSURE-AUTHORIZATION-001 | NAC 679B.695 | Confirm scope, form and electronic signature | Fail closed without compliant authorization when applicable. |
| NV-BINDER-REPLACEMENT-001 | NRS 687B.184; 1983 source | Confirm filed-rate proof and later specific provisions | Use 1983-10-01 boundary if approved; reconciliation only. |
| NV-PERSONAL-INFORMATION-ACCESS-001 | NAC 679B.705 | Confirm actor, business-day calculation and response scope | Apply to the responsible classified actor only. |
| NV-PERSONAL-INFORMATION-CORRECTION-001 | NAC 679B.710 | Confirm propagation and timing | Preserve request, response and downstream evidence. |
| NV-ADVERSE-UNDERWRITING-NOTICE-001 | NAC 679B.715 | Map provider decisions without making platform underwriter | Provider remains decision maker; platform transmits only authorized factual notice. |
| NV-ELECTRONIC-TRANSACTION-CONSENT-001 | NRS 719.220 | Confirm agreement evidence and document-specific limits | No global inference of electronic consent. |
| NV-ELECTRONIC-RECORD-REPRODUCTION-001 | NRS 719.250 | Confirm retainability/reproducibility fixtures | Human confirmation remains required. |
| NV-ELECTRONIC-RETENTION-001 | NRS 719.290 | Confirm integrity, accessibility and reproduction fixtures | Human confirmation remains required. |

## Evidence-integrity and publication controls

The verification handoff includes the candidate JSON, this package, the queue, the source manifest, and every referenced archive object. Hash equality proves byte integrity only; it does not prove legal interpretation.

The founder or a founder-designated human verifier must enter an attributable disposition for each executable rule. Codex may prepare evidence, implement the recorded decision and run tests, but may not invent the founder's decision. This is a separation-of-duties control, not a requirement to hire or locate an outside person.
