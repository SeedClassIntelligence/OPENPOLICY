# Nevada Personal Auto Regulatory Dossier (PR-0B Wave 0: methodology calibration)

**Status: STAGE 1 APPROVED; STAGE 2 AUTHOR EXTRACTION IN PROGRESS.** The founder approved the 44/44 exact-byte capture package on October 20, 2026. The first atomic candidate package is `STAGE-2-CANDIDATE-RULES.json`. Nothing in this dossier is `VERIFIED`, `PUBLISHED`, or active. Independent verification remains reserved to a qualified human who is not the author.

Format: `docs/pr0b/DOSSIER-FORMAT.md` · Baseline: `main` @ `7d5133a` · Author: Claude Code · Verifier: none assigned.

Research schedule: `docs/pr0b/REGIONAL-RESEARCH-MANIFEST.md`. Nevada is the Wave 0 calibration gate; California belongs to the later West Coast cohort and Ohio belongs to the North cohort.

## Stage 1 capture disposition

The bounded Nevada inventory is captured in `sources/manifest.jsonl`: 44/44 targets have exact response bytes, SHA-256, request and resolved URLs, HTTP metadata, timestamps, byte lengths and immutable archive paths. `GAP-REGISTER.md` records the disposition of G-NV-001 through G-NV-010. Carrier-specific forms remain conditionally deferred until a candidate proposition depends on a particular approved form.

| Host | Needed for | Tier |
|---|---|---|
| `www.leg.state.nv.us` | NRS (statutes), NAC (regulations), Nevada Register (adopted, not-yet-codified regulations), legislative history | A |
| `doi.nv.gov` | Division of Insurance bulletins, notices, forms, licensing guidance, regulation notices | B / C |

Expected next, as the research reaches them:

| Host | Needed for | Tier |
|---|---|---|
| `nipr.com`, `pdb.nipr.com` | National producer licensing data | C |
| `sircon.com` | Nevada licensing transactions as directed by the Division | C |
| `filingaccess.serff.com` | Nevada P&C rate, rule and form filings | D |

Nevada DMV pages may also be needed for proof-of-insurance and financial-responsibility operations; the host will be identified from the statutes once researched.

## Category completeness matrix

| # | Category | Status | Rules | Notes |
|---|---|---|---|---|
| 1 | Coverage requirements | READY_FOR_VERIFICATION | 3 | NRS 485.185 produces atomic BI-per-person, BI-per-accident and property-damage minimum candidates. |
| 2 | Mandatory offers, elections and rejections | RESEARCHED | 1 | NRS 690B.020 UM candidate requires effective-date and carrier-form verification. |
| 3 | Producer and agency licensing | REVIEW_REQUIRED | 1 | NRS 683A.201 establishes the license boundary; precise class/entity mapping remains open. |
| 4 | Lines of authority | NOT_RESEARCHED | 0 | |
| 5 | Appointments and carrier authority | NOT_RESEARCHED | 0 | |
| 6 | Compensation and broker fees | REVIEW_REQUIRED | 1 | NRS 683A.361 candidate requires independent legal characterization of actual platform conduct. |
| 7 | Anti-rebating and inducements | RESEARCHED | 1 | NRS 686A.130 candidate; no consumer inducement is implemented by the V2 model. |
| 8 | Quote and application requirements | NOT_RESEARCHED | 0 | |
| 9 | Consumer disclosures | NOT_RESEARCHED | 0 | |
| 10 | Electronic transactions and signatures | RESEARCHED | 0 | NRS 719 and insurance-specific provisions captured; atomic extraction remains pending. |
| 11 | Binding | NOT_RESEARCHED | 0 | |
| 12 | Proof of insurance | RESEARCHED | 1 | NRS 690B.023 candidate includes effective and expiration dates and other mandatory evidence fields. |
| 13 | Policy issuance | NOT_RESEARCHED | 0 | |
| 14 | Replacement and switching | NOT_RESEARCHED | 0 | |
| 15 | Cancellation and nonrenewal | NOT_RESEARCHED | 0 | |
| 16 | Privacy | NOT_RESEARCHED | 0 | |
| 17 | Records and retention | NOT_RESEARCHED | 0 | |
| 18 | Required forms | NOT_RESEARCHED | 0 | |
| 19 | Insurer and company authority | NOT_RESEARCHED | 0 | |

`NOT_RESEARCHED` is not `NOT_APPLICABLE`. It means nothing has been examined yet.

## Legacy NV reconciliation

The three numerical legacy propositions are **supported as author candidates** by current NRS 485.185: $25,000 bodily injury per person, $50,000 bodily injury per crash subject to the per-person limit, and $20,000 property damage per crash, effective July 1, 2018 under 2017 Nevada Statutes chapter 258. The legacy split between generic `BI-REQUIRED`/`PD-REQUIRED` records and minimum-limit records must be superseded by the three atomic candidates rather than copied forward. This is not independent verification.

## Verification boundary

The author may raise a rule only to `READY_FOR_VERIFICATION`. A qualified Nevada insurance-regulatory verifier must review the exact captured source, cross-references, effective period, machine interpretation, exceptions and contradiction search. The author, synthetic provider, automated test runner and founder approval of research work do not substitute for that independent verification.

## Planned deliverables (on completion)

Full dossier · source inventory (`sources/manifest.jsonl` + verbatim captures) · this completeness matrix · candidate machine rules · conflicts and open questions · legacy reconciliation · proposed acceptance fixtures. **Then stop** for architectural and legal-review assessment before Wave 1 (CA, OH).
