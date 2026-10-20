# Nevada Wave 0 — Stage 2 Author Effective-Date and Contradiction Review

Date: October 20, 2026  
Scope: 26 author-generated Nevada personal-auto candidates in `STAGE-2-CANDIDATE-RULES.json`  
Production effect: **none**

## Disposition

This review is an author-side quality check, not independent verification. It checks internal consistency, source identity, effective-date completeness, obvious cross-rule conflicts, and whether each status complies with `docs/pr0b/DOSSIER-FORMAT.md`.

The candidate package remains `UNPUBLISHED`; every rule remains `UNVERIFIED`.

## Corrections made

1. `NV-PRODUCER-001` previously encoded `appointmentRequired: true` for every producer transaction. That conflicted with `NV-APPOINTMENT-001` and NRS 683A.321, which require appointment when the producer acts as the insurer's agent but not when the producer acts as a broker. The premature machine interpretation was removed. Role-sensitive appointment evaluation remains a blocking verifier issue.
2. Candidates lacking an established effective date cannot satisfy the canonical READY standard. The affected cancellation/nonrenewal and binder-replacement candidates were returned to `RESEARCHED`. No effective date was inferred merely from the current consolidated text.

## Effective-date review

| Candidate group | Author disposition |
|---|---|
| NRS 485.185 minimum limits | `2018-07-01` supported by the captured current statute and official 2017 session-law effective-date clause; remains ready for independent verification. |
| NRS 690B.020 UM/UIM | Current text captured, but the effective period applicable to the normalized proposition and form history remain unresolved. |
| NRS 690B.023 proof fields | Current text captured; the consolidated source history does not by itself establish the complete effective period used by the candidate. |
| NRS 683A licensing, compensation, lines, appointments | Current text captured; historical effective dates and current operational status evidence remain verifier work. |
| NRS 680A insurer authority | Current text captured; current certificate status is an operational fact requiring a Tier C lookup at transaction time. |
| NRS 687B binder, cancellation, nonrenewal and renewal provisions | Current text and amendment notes captured. Rules without an established current-text effective date remain `RESEARCHED` or `REVIEW_REQUIRED`, not ready. |
| NAC 679B information/privacy rules | The captured regulation gives adoption/effective notes, but actor classification and later-rule interaction remain unresolved. |
| NRS 719 electronic transactions | The captured statute and enactment notes support the recorded 2001 effective date; document-specific and federal restrictions still require review. |

## Contradiction and overlap review

| Area | Finding | Required resolution |
|---|---|---|
| Producer appointment | General license authority does not make appointment universal. Agent transactions require appointment; broker transactions follow separate placement limits. | Verify role model and operational appointment evidence before machine enforcement. |
| Business entity vs. individual | NRS 683A.251 governs business organizations; NRS 683A.201 governs persons conducting licensed activity. Neither record alone proves the complete provider-organization decision. | Verify entity and individual evidence together. |
| Electronic delivery vs. specific notice method | NRS 719 recognizes electronic records only within its consent and presentation rules; other insurance statutes may prescribe delivery methods. | Apply the more specific document rule and never infer electronic delivery permission globally. |
| Privacy actor classification | NAC obligations differ among insurance institutions, agents and insurance-support organizations. Open Polici's status cannot be assumed from its product label. | Independent legal classification by function. |
| Underwriting decision | Providers underwrite; Open Polici presents offers and factual comparisons. | Map provider-originated adverse decisions without making the platform the decision maker. |
| Binder controls | Licensed providers may issue binders; Open Polici does not. | Treat binder candidates as provider evidence/reconciliation controls only unless architecture changes under separate authority. |
| Compensation | NRS 683A.361 turns on actual conduct, not event naming or price-book labels. | Independently assess each production function against sell/solicit/negotiate definitions. |

## Source-integrity result

All cited archive paths are present and their bytes reproduce the SHA-256 values recorded in the candidate package. This proves evidence integrity, not legal correctness.

## Remaining independent-verifier work

- Confirm every effective period and amendment/supersession chain.
- Review incorporated definitions, exceptions, cross-references, official bulletins, orders, prescribed forms, and current operational authority records.
- Resolve every item in `STAGE-2-VERIFICATION-QUEUE.md`.
- Mark each candidate `VERIFIED`, `REJECTED`, or return it for correction with an attributable human attestation.

No author, automated validator, synthetic provider, founder research approval, or passing software test substitutes for that independent verification.
