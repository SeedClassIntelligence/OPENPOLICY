# PR-0B Regional Research Manifest

**Status:** Founder-authorized research schedule  
**Scope:** Research scheduling only; this document does not create, verify, publish, or activate law.

Research input: `docs/pr0b/DEEP-RESEARCH-RECONCILIATION.md`.

PR-0B proceeds by complete regional cohorts rather than by selecting scattered states. Nevada remains Wave 0 solely to calibrate the research, evidence-capture, reconciliation, and independent-verification method. After that approval gate, rollout proceeds through the West remainder, Midwest, South, then Northeast.

The operational cohort names below map to the four-region membership used by the completed PR-0B research reconciliation. The names control scheduling, not legal applicability.

| Order | Open Policy cohort | Membership basis | Jurisdictions | Count |
|---:|---|---|---|---:|
| 0 | Nevada calibration | Nevada separated from its normal Western cohort | NV | 1 |
| 1 | West remainder | Remaining West | AK, AZ, CA, CO, HI, ID, MT, NM, OR, UT, WA, WY | 12 |
| 2 | Midwest | Midwest | IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI | 12 |
| 3 | South | South, including the District of Columbia | AL, AR, DE, DC, FL, GA, KY, LA, MD, MS, NC, OK, SC, TN, TX, VA, WV | 17 |
| 4 | Northeast | Northeast | CT, ME, MA, NH, NJ, NY, PA, RI, VT | 9 |
|  | **Total** | Every state and D.C. exactly once |  | **51** |

## Required manifest invariants

- Exactly 51 jurisdiction entries exist.
- Every entry is unique and belongs to the canonical `US_JURISDICTIONS` set.
- No canonical U.S. jurisdiction is missing.
- Nevada occurs exactly once and is excluded from the post-calibration West Coast cohort.
- California is part of the West remainder cohort.
- Ohio is part of the Midwest cohort; it is not a standalone follow-up to Nevada.

## Rollout availability is not production authorization

The canonical application configuration keeps every jurisdiction present at all times. Wave 0 Nevada is enabled, Wave 1 West remainder is unlocked for rollout and onboarding work, and Waves 2 through 4 are locked until an explicit configuration/governance action changes their rollout state.

These rollout states do not verify law and do not authorize insurance transactions. Production authority remains jurisdiction-specific and fail-closed through the existing PR-0A regulatory readiness, provider/licensing, operational-gate, and market-activation records. An unlocked jurisdiction with no qualifying PRODUCTION activation history remains `INACTIVE`.

## Per-jurisdiction lifecycle

Each jurisdiction must traverse the existing PR-0B evidence process:

1. source inventory;
2. authoritative source capture with retrieval metadata and content hash;
3. category-completeness review;
4. atomic proposition extraction;
5. PR-0A representability review;
6. legacy-rule reconciliation where applicable;
7. `READY_FOR_VERIFICATION` research status;
8. independent qualified verification;
9. authorized publication decision.

Research completion is not verification. Verification is not publication. Publication is not market activation. PR-0B must not change marketplace outcomes; enforcement remains a later authorized phase.

## Nevada gate

The Nevada calibration dossier must be completed and independently reviewed before the West Coast cohort begins. Findings that the current PR-0A model cannot represent remain cited dossier findings and explicit future enforcement gaps; they must not create a competing runtime model inside PR-0B.
