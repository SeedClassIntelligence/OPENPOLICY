# Nevada Personal Auto Regulatory Dossier (PR-0B Wave 0: methodology calibration)

**Status: BLOCKED. Research not started.** The research environment's network policy denies the Nevada primary-source hosts (see "Access required"). No Nevada proposition in this file has been researched. Nothing here is drawn from model memory or secondary sources.

Format: `docs/pr0b/DOSSIER-FORMAT.md` · Baseline: `main` @ `7d5133a` · Author: Claude Code · Verifier: none assigned.

## Access required

Denied by the egress proxy on 2026-10-03 (CONNECT 403):

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
| 1 | Coverage requirements | NOT_RESEARCHED | 0 | Legacy candidate `JR-LEGACY-NV-*` (UNVERIFIED) awaits independent reconciliation |
| 2 | Mandatory offers, elections and rejections | NOT_RESEARCHED | 0 | |
| 3 | Producer and agency licensing | NOT_RESEARCHED | 0 | |
| 4 | Lines of authority | NOT_RESEARCHED | 0 | |
| 5 | Appointments and carrier authority | NOT_RESEARCHED | 0 | |
| 6 | Compensation and broker fees | NOT_RESEARCHED | 0 | |
| 7 | Anti-rebating and inducements | NOT_RESEARCHED | 0 | |
| 8 | Quote and application requirements | NOT_RESEARCHED | 0 | |
| 9 | Consumer disclosures | NOT_RESEARCHED | 0 | |
| 10 | Electronic transactions and signatures | NOT_RESEARCHED | 0 | |
| 11 | Binding | NOT_RESEARCHED | 0 | |
| 12 | Proof of insurance | NOT_RESEARCHED | 0 | |
| 13 | Policy issuance | NOT_RESEARCHED | 0 | |
| 14 | Replacement and switching | NOT_RESEARCHED | 0 | |
| 15 | Cancellation and nonrenewal | NOT_RESEARCHED | 0 | |
| 16 | Privacy | NOT_RESEARCHED | 0 | |
| 17 | Records and retention | NOT_RESEARCHED | 0 | |
| 18 | Required forms | NOT_RESEARCHED | 0 | |
| 19 | Insurer and company authority | NOT_RESEARCHED | 0 | |

`NOT_RESEARCHED` is not `NOT_APPLICABLE`. It means nothing has been examined yet.

## Legacy NV reconciliation (Wave 0 deliverable)

The PR-0A legacy candidate (`JRS-LEGACY-NV-PERSONAL_AUTO-v1`: rules `JR-LEGACY-NV-BI-REQUIRED`, `-PD-REQUIRED`, `-BI-MINIMUM`, `-PD-MINIMUM`; citation as recorded in the old registry) will be **independently** researched. The outcome will be one of **confirmed**, **corrected**, **superseded** or **rejected**. Research will not set out to confirm it.

## Planned deliverables (on completion)

Full dossier · source inventory (`sources/manifest.jsonl` + verbatim captures) · this completeness matrix · candidate machine rules · conflicts and open questions · legacy reconciliation · proposed acceptance fixtures. **Then stop** for architectural and legal-review assessment before Wave 1 (CA, OH).
