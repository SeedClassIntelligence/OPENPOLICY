# Imported PR-0B Deep-Research Reconciliation

> **Status:** Research input, not independently verified law. Imported from the completed local deep-research artifact on 2026-10-04 so the work is versioned with the active branch. Embedded `filecite`/research citation markers are provenance clues from the originating research environment; they are not substitutes for repository-held source captures, exact locators, independent verification, publication, or activation.

# PR-0B Deep-Research Reconciliation and Canonical Specification

## Architecture ruling

**Decision: PR-0B is a regulatory evidence-and-rule-corpus workstream built on top of the already-merged PR-0A jurisdiction architecture. It is not a second regulatory architecture, it is not PR-0C, and it must not change marketplace outcomes.**

The authoritative repository baseline for this ruling is **`main @ 7d5133a04331adbc264019caab380943c988d189`**, the merge of PR #3, **“PR-0A: Jurisdiction canonical schema and rule architecture (shadow mode).”** That merge already establishes the jurisdiction vocabulary, provenance objects, effective-dated rules and rulesets, pure jurisdiction and provider-authority engines, governance, market activation, migration `0008_jurisdiction_framework`, persistence, legacy-rule migration, shadow orchestration, read-only HTTP surfaces, and PR-0A acceptance suite. The PR explicitly says that **no PR-0B primary-law research is included and no real legal value is verified or asserted**. fileciteturn10file0

That changes how the deep-research report must be consumed. Its **research methodology is largely correct**, but proposals that assumed the regulatory runtime model still needed to be created have now been overtaken by PR-0A. `JurisdictionRuleSet`, `JurisdictionRule`, `RegulatoryAuthority`, `RegulatorySource`, `VerificationStatus`, `MachineRule`, `RuleEvaluationContext`, `JurisdictionRuleEvaluation`, jurisdiction determination, provider authority, and market activation are already canonical types or concepts at this SHA. fileciteturn8file0

Accordingly, the governing relationship is now:

```text
                    PR-0A — ALREADY CANONICAL
                 Regulatory runtime architecture
                              │
                              │ consumes later
                              ▼
                    PR-0B — BUILD NOW
             Regulatory research + evidence corpus
                              │
                    VERIFIED CANDIDATES
                              │
                              ▼
                    PR-0C — NOT NOW
              Regulatory enforcement migration
```

The key boundary is exact:

> **PR-0B determines what authoritative law and regulatory material says, captures the evidence for that conclusion, maps the result into candidates compatible with the current PR-0A vocabulary, and independently verifies that research. PR-0B does not cause a different marketplace result.**

That boundary follows PR-0A's binding D4 ruling: the new architecture may resolve jurisdiction, select a candidate ruleset, evaluate it and record discrepancies, but it must not change qualification, provider eligibility, competition participation, selection, binding, or reconciliation while in shadow mode. The frozen legacy registry retires only in PR-0C. fileciteturn5file0

A second ruling follows from the repository inspection:

> **There should be no new runtime `JurisdictionRulePack` or `RuleVersion` model in PR-0B.**

The report's “RulePack” remains useful as a **research publication bundle**, but its executable payload must be expressed using the existing `JurisdictionRuleSet` and `JurisdictionRule` structures. The repository already supplies stable `ruleCode`, rule effective intervals, `supersedesRuleId`, ruleset versions and supersession, verification metadata, source references, and content hashes. fileciteturn8file0turn11file0

There is one limitation on this reconciliation that should be recorded in the canonical document: the attachment named `deep-research-report (1)` was not exposed to the retrievable-file interface in this session. I therefore reconciled **all substantive report recommendations reproduced in this thread and the earlier deep-research material in the conversation** against the exact repository commit. Any additional text existing only inside the inaccessible attachment should undergo the same classification procedure before being treated as canonical.

### Formal reconciliation matrix

The following is the architecture ruling that should become the heart of `docs/pr0b/DEEP-RESEARCH-RECONCILIATION.md`.

| Deep-research recommendation | Ruling | Repository-grounded treatment |
|---|---|---|
| State primary authority controls over NAIC summaries/models | **KEEP** | Foundational PR-0B research rule. NAIC itself states its models are proposed frameworks and are not automatically binding; each state determines whether and how to adopt them. citeturn7search0turn7search1 |
| Maintain a national NAIC reference layer | **KEEP** | Build a research manifest of models, state-action references and issue charts. Do not put NAIC propositions directly into executable state rules. NAIC provides more than 100 issue-specific state charts, making it a strong discovery/index layer. citeturn7search2 |
| Treat NAIC adoption classifications as executable law | **REJECT** | State-action/adoption evidence is a research lead, not controlling authority. Follow it to the state's actual statute, regulation, order, form or other authoritative source. citeturn7search0 |
| Store timeless flags such as `adoptsModel668 = true` | **REJECT** | Adoption evidence must be source- and date-specific; never flatten changing reference evidence into a permanent legal truth. |
| Maintain a federal authority/reference layer separately from state law | **KEEP** | PR-0B gets a separate federal source manifest. Do not force federal authority into the current state/DC `JurisdictionRuleSet` model before PR-0C decides composition semantics. |
| Implement a runtime `FederalRulePack` now | **DEFER TO PR-0C** | PR-0A currently models the 50 states and D.C.; runtime composition of federal + state decisions is an enforcement concern, not a PR-0B research prerequisite. fileciteturn21file0turn8file0 |
| Create a new runtime `JurisdictionRulePack` type/table | **REJECT** | PR-0A already has the canonical runtime compilation object: `JurisdictionRuleSet`. A PR-0B “Candidate RulePack” is a dossier/bundle around that object, not another database model. fileciteturn8file0turn9file0 |
| Create a new `RuleVersion` runtime model | **ALREADY IMPLEMENTED / SUPERSEDED** | `JurisdictionRule` already has stable `ruleCode`, effective dating, `supersedesRuleId`, verification and source references; rulesets themselves are versioned and superseded. fileciteturn8file0 |
| Effective-dated immutable legal rules | **ALREADY IMPLEMENTED / SUPERSEDED** | D3 is implemented as `effectiveFrom <= date < effectiveUntil`; published rulesets are not rewritten. fileciteturn11file0turn12file0 |
| Unknown facts/dates must not become implicit permission | **ALREADY IMPLEMENTED / SUPERSEDED** | The rule engine returns `INDETERMINATE` for unknown required dates/facts and does not read the wall clock. fileciteturn12file0 |
| Source provenance must accompany rules | **ALREADY IMPLEMENTED, WITH PR-0B EXTENSION** | `RegulatoryAuthority` and `RegulatorySource` already hold authority, type, citation, URL, retrieval date, content hash and archived-copy reference. PR-0B adds a research capture manifest for HTTP/content metadata rather than duplicating the runtime object. fileciteturn8file0turn9file0 |
| Raw authoritative artifacts should be retained and hashed | **KEEP / ADAPT TO CURRENT PR-0A** | Store exact captured artifacts outside the runtime schema and place SHA-256 plus archival reference into existing `RegulatorySource` when a source enters a candidate ruleset. |
| Every rule should have an explicit legal/machine effect | **ADAPT TO CURRENT PR-0A** | Do not replace PR-0A's closed `MachineRule` union and current outcomes with the report's generic `ALLOW/DENY/REQUIRE/...` interpreter. Research may classify the legal proposition; executable expression must use an existing `MachineRule` or remain informational until a reviewed extension. fileciteturn8file0turn12file0 |
| Introduce an open-ended legal expression language | **REJECT** | PR-0A intentionally uses a closed deterministic `MachineRule` union. There is no scripting/expression language. fileciteturn8file0 |
| Expand `MachineRule` whenever research discovers a new requirement | **DEFER TO PR-0C** | Research records the unsupported proposition and evidence. Runtime vocabulary expansion receives a separate architecture/test review instead of being smuggled through PR-0B. |
| Expand the coverage taxonomy when state law requires concepts currently unexpressible | **DEFER TO PR-0C** | D8 already defines the safe behavior: unsupported coverage taxonomy produces `INDETERMINATE`. The PR-0A decision record explicitly placed taxonomy expansion outside PR-0A and before enforcement. fileciteturn12file0turn5file1 |
| Maintain research, verification and publication state | **ADAPT TO CURRENT PR-0A** | Use current `VerificationStatus` and `RuleSetStatus` for runtime candidate objects. Additional PR-0B workflow labels such as `READY_FOR_VERIFICATION` belong to the research dossier, not a competing governance state machine. fileciteturn8file0 |
| Independent legal verification | **KEEP / ALREADY PARTLY IMPLEMENTED** | Runtime governance already requires separation among author, verifier and publisher for executable material. PR-0B adds source-by-source and category-completeness verification around it. fileciteturn11file0 |
| Reconstruct historical legal basis | **ALREADY IMPLEMENTED / SUPERSEDED** | Rule sets carry hashes; evaluations anchor ruleset identity/hash; publication supersedes instead of rewriting history. fileciteturn10file0turn11file0 |
| Build all 50 states + D.C. reference identity | **ALREADY IMPLEMENTED / SUPERSEDED** | `US_JURISDICTIONS` already contains exactly the 50 states and D.C., with no legal values embedded. fileciteturn21file0 |
| Add a 51-jurisdiction research-order manifest | **KEEP** | New PR-0B research metadata. It determines research sequencing, not legal behavior. |
| Nevada as Wave 0 methodology calibration | **KEEP** | Nevada is the calibration jurisdiction before a complete regional cohort is attempted. |
| Perform a source-inventory pass before rule extraction | **KEEP** | This becomes a hard methodology gate. No Nevada candidate rule is authored merely because the research report, search snippets, NAIC or prior code contains a plausible answer. |
| Nevada 19+ category completeness matrix | **KEEP** | Research artifact. It may be broader than current `RuleCategory`; research completeness must not be constrained by what the runtime engine can presently execute. |
| Force every research category into current `RuleCategory` | **REJECT** | That would let software vocabulary distort legal research. Categories not exactly represented stay in the completeness/dossier layer until reviewed for PR-0C. |
| Atomic legal propositions | **KEEP / ADAPT TO CURRENT PR-0A** | A proposition that can already be represented becomes a candidate `JurisdictionRule`. Unsupported propositions remain independently cited dossier findings rather than fake machine rules. |
| Applicability and exceptions attached to each proposition | **KEEP / ADAPT** | Capture these explicitly in the research dossier. Do not add runtime fields merely because the older report proposed them. PR-0C decides whether any additional runtime representation is required. |
| Jurisdiction-basis research | **KEEP** | PR-0B researches which factual/legal nexus controls each type of requirement. |
| Change jurisdiction determination logic based on that research | **DEFER TO PR-0C** | Current determination logic and the permanent `JURISDICTION_CONFLICT` / `JURISDICTION_UNDETERMINED` behavior remain authoritative. fileciteturn10file0turn5file0 |
| Provider licensing and appointment research | **KEEP** | These are directly needed to populate current `PRODUCER_AUTHORITY` / `CARRIER_AUTHORITY` candidate rules. |
| Replace provider-authority engine during research | **REJECT** | Existing engine already derives authority from evidence and explicitly excludes self-declared states, appetite and commercial capacity. fileciteturn22file0 |
| Research state-specific license expiration semantics | **KEEP** | This is explicitly carried forward to PR-0B because the current engine treats a license expiring on the evaluation date as legally unresolved. fileciteturn22file0turn10file0 |
| Research jurisdiction-local legal date semantics | **KEEP** | Explicitly carried forward from PR-0A to PR-0B. fileciteturn10file0 |
| Verify legacy NV/OH/CA registry values | **KEEP** | PR-0A intentionally imported them as `IN_REVIEW` and `UNVERIFIED`, with an explicit warning that they were not verified against official sources. fileciteturn14file0 |
| Rewrite the seeded legacy rules in place once research finds corrections | **REJECT** | Preserve the legacy candidate as historical evidence of the old behavior. Create a new primary-source candidate ruleset instead. |
| Remove the frozen legacy registry after Nevada research | **DEFER TO PR-0C** | D4 explicitly keeps it in place until enforcement migration. fileciteturn5file0 |
| Candidate `JurisdictionRulePack` | **ADAPT TO CURRENT PR-0A** | Define it as a **research bundle**, not a TypeScript/domain/database entity. Its executable payload references the current candidate `JurisdictionRuleSet` and `JurisdictionRule[]`. |
| Verification dossier | **KEEP** | Required before Nevada methodology approval and before any jurisdiction is considered research-complete. |
| Regulatory change detection | **KEEP, EVIDENCE-NEUTRAL FOUNDATION ONLY** | PR-0B may track retrieval timestamps, hashes and changed-source alerts; it does not automatically amend rules or enforcement behavior. |
| Automatically rewrite rules when a source changes | **REJECT** | A changed artifact reopens research/verification. It never mutates an effective rule automatically. |
| Synthetic regulatory fixtures | **KEEP / ADAPT** | Continue the PR-0A pattern of fictional jurisdictions and deterministic rule fixtures rather than using unverified live state law as a test oracle. PR-0A already uses fictional X1/X2 cases. fileciteturn10file0 |
| Wire verified research directly into marketplace blocks | **DEFER TO PR-0C** | PR-0B produces candidates/evidence. Enforcement remains shadow only. |
| Put regulatory evaluation in front of CE rating/billing now | **DEFER TO PR-0C** | The commercial-regulatory composition is an eventual enforcement boundary, not a PR-0B research side effect. |
| Modify PM-1–PM-5 or CE-1–CE-5 to facilitate research | **REJECT** | The merged PR-0A deliberately preserved protected PM and CE code and extended the commercial-neutrality firewall instead. fileciteturn10file0 |
| Add regulatory mutation HTTP endpoints | **DEFER TO PR-1 / AUTHORIZATION WORK** | PR-0A deliberately exposes read-only jurisdiction endpoints and postpones mutation APIs until proper authorization exists. fileciteturn20file0 |
| Treat `PUBLISHED` or `RULES_VERIFIED` alone as proof that a jurisdiction has been completely researched | **REJECT** | Current governance validates VERIFIED/source status specifically for executable rules, while readiness also derives from executable rules. PR-0B therefore needs an independent category-completeness and verification dossier so a partial corpus cannot masquerade as completed legal research. fileciteturn11file0turn19file0 |
| Broaden immediately into other insurance lines | **DEFER TO LATER REGULATORY RELEASE** | Current canonical `InsuranceLine` is `PERSONAL_AUTO`; PR-0B should finish that governed corpus before generalizing the platform. fileciteturn8file0 |
| Build AI, complaint, fraud and broader market-conduct execution now | **DEFER TO LATER REGULATORY RELEASE** | Those may stay in the source/completeness inventory where relevant, but they should not expand the personal-auto runtime before transaction-critical requirements are complete. |

That matrix resolves the major conflict between the older research design and present repository state: **the report remains the research-methodology input; PR-0A remains the software architecture authority.**

## Canonical PR-0B boundary

PR-0B should now be frozen as **Jurisdictional Insurance Rule Mapping and Evidence Production**.

Its deliverables are not another set of product engines. They are controlled regulatory artifacts that eventually supply the engines already present.

### What PR-0B owns

| Artifact | Canonical purpose | Runtime consequence during PR-0B |
|---|---|---|
| `DEEP-RESEARCH-RECONCILIATION.md` | Records the architecture rulings above against `7d5133a...` | None |
| National NAIC reference manifest | Models, charts, state-action references, retrieval metadata | None |
| Federal authority/source manifest | Separately inventories applicable federal primary authority | None |
| 51-jurisdiction regional research manifest | Exact jurisdiction membership and research order | None |
| Source-capture protocol | Defines authoritative capture, hashing, locators and archival evidence | None |
| Nevada authoritative-source inventory | Establishes which primary/regulator surfaces require examination before extraction | None |
| Nevada completeness matrix | Demonstrates every required research category has been investigated | None |
| Jurisdiction-basis findings | Records legal basis for determining which jurisdiction governs which activity | None |
| Atomic candidate-rule corpus | Maps verified propositions into existing PR-0A vocabulary where possible | Shadow candidate only |
| Legacy-rule reconciliation | Compares legacy NV data with actual primary authority | No legacy behavior modification |
| Candidate RulePack research bundle | Packages the Nevada corpus, current candidate ruleset and research evidence | No new runtime object |
| Verification dossier | Independent evidentiary review and unresolved/conflict register | None |
| Change-detection manifest | Enables source recapture/hash comparison | None |
| Synthetic PR-0C fixtures | Future deterministic enforcement cases | No live state behavior |

This stays consistent with current persistence. Migration `0008_jurisdiction_framework` already introduced the jurisdiction reference, regulatory-authority/source, ruleset/rule, ruleset-review, activation, gate, determination and evaluation structures; PR-0B should use that foundation instead of producing migration `0009` simply to duplicate research concepts. fileciteturn13file0turn5file0

The current `RegulatorySource` is already more capable than the older report assumed. It supports `citation`, `title`, `officialUrl`, `retrievedAt`, `contentSha256`, `archivedCopyRef` and notes, tied to a `RegulatoryAuthority`. fileciteturn8file0 The missing research details—HTTP response metadata, byte count, resolved URL, redirect chain, exact locator, acquisition result and source-role classification—can live first in the **source-capture manifest**. There is no architectural reason to mutate the core type merely to perform research.

### The Candidate RulePack is a bundle, not a domain class

The term can be retained because it is useful operationally, but it should mean:

```text
Candidate Jurisdiction RulePack
│
├── Jurisdiction + PERSONAL_AUTO
├── methodology version
├── source manifest + manifest hash
├── NAIC reference set
├── federal-reference pointers
├── completeness matrix + hash
├── jurisdiction-basis findings
├── legacy reconciliation
│
├── canonical PR-0A candidate payload
│    ├── JurisdictionRuleSet
│    └── JurisdictionRule[]
│
├── unresolved questions
├── known source conflicts
├── explicit NOT_APPLICABLE findings
│
└── verification dossier + hash
```

The center of that bundle is the **existing PR-0A object model**, not a new `RulePack` table.

There is an especially important preservation rule for Nevada. PR-0A already generated a legacy Nevada ruleset from `JURISDICTIONAL_STATUTORY_REGISTRY`, labeled it `IN_REVIEW`, set every migrated rule to `UNVERIFIED`, and explicitly recorded that the source had not been retrieved or checked against official law. fileciteturn14file0

PR-0B should **not rewrite that legacy ruleset**. Instead:

```text
JRS-LEGACY-NV-... v1
     │
     │ preserve exactly as historical comparison evidence
     │
     ▼
Primary-source Nevada research
     │
     ▼
new DRAFT Nevada PERSONAL_AUTO ruleset v2
     │
     ├── authoritative sources
     ├── corrected candidate propositions
     └── independent verification
```

That provides an auditable answer to a future question such as:

> What did frozen Open Policy believe before primary-law research, and what did PR-0B establish afterward?

Changing the legacy candidate itself would destroy that evidence.

### The completeness gate must be stricter than the runtime publication gate

Repository inspection uncovered one point the PR-0B specification must expressly address.

`validatePublication()` requires VERIFIED status, an identified verifier and at least one source for rules where `machineRule !== null`; an informational rule with `machineRule === null` does not receive all of those same publication checks. `deriveReadiness()` likewise determines `RULES_VERIFIED` from executable rules. fileciteturn11file0turn19file0

That is reasonable for PR-0A's runtime governance, but **it is not sufficient as a legal-research completeness test**.

Therefore:

```text
PR-0A RULES_VERIFIED
        ≠
PR-0B JURISDICTION RESEARCH COMPLETE
```

PR-0B's independent completeness matrix must be authoritative for research completion. A Nevada dossier cannot pass simply because all machine-executable rules happen to be verified. Every required category must instead resolve to one of:

```text
AUTHORITATIVE_RULE_IDENTIFIED
AUTHORITATIVE_REQUIREMENT_NOT_APPLICABLE
INFORMATIONAL_REQUIREMENT_IDENTIFIED
UNRESOLVED
CONFLICTING_AUTHORITY
DEFERRED_WITH_JUSTIFICATION
```

`UNRESOLVED` and `CONFLICTING_AUTHORITY` prevent final methodology approval unless specifically dispositioned by legal review.

This does **not** require changing PR-0A now. It makes PR-0B's research gate appropriately stronger than the generic runtime publication mechanism.

## Evidence protocol and Nevada calibration

The source hierarchy should be frozen before Nevada rule extraction.

NAIC belongs near the top of the **discovery** process but not at the top of the **authority** hierarchy. NAIC says directly that a model law is proposed language, is not automatically binding, and does not replace state law; states decide whether and how to adopt it. NAIC's State Insurance Charts provide more than 100 issue-specific cross-state comparisons, which makes them ideal for identifying potential authorities and detecting omissions. citeturn7search0turn7search2

The PR-0B evidence ladder therefore becomes:

```text
NAIC / national reference discovery
              │
              ▼
Potential state authority identified
              │
              ▼
Official legislature / regulator / agency source
              │
              ▼
Exact artifact captured
              │
              ▼
Raw bytes retained
              │
              ▼
SHA-256 + retrieval metadata
              │
              ▼
Exact citation + locator
              │
              ▼
Legal proposition extracted
              │
              ▼
Applicability + exceptions analyzed
              │
              ▼
Atomic candidate
              │
              ▼
READY_FOR_VERIFICATION
              │
              ▼
Independent source verification
```

A search-engine excerpt may help discover a source. It is **not source evidence for a rule**.

The same is true of the legacy Open Policy code, the deep-research report, NIPR summaries, carrier guidance, commercial compliance services, legal blogs, or an LLM's memory: they can identify questions, but they cannot by themselves establish a Nevada candidate legal proposition.

### Source capture record

PR-0B should use a research-level capture record containing at least:

| Field | Meaning |
|---|---|
| `captureId` | Stable acquisition identifier |
| `jurisdictionCode` | Nevada for Wave 0, where applicable |
| `sourceLayer` | `STATE_PRIMARY`, `FEDERAL_PRIMARY`, `NAIC_REFERENCE`, or `OPERATIONAL_REFERENCE` |
| `authorityName` | Issuing governmental/regulatory authority |
| `authorityType` | Legislature, DOI, DMV, licensing authority, etc. |
| `sourceType` | Statute, regulation, bulletin, order, required form, official guidance, licensing record, etc. |
| `citation` | Legal/administrative citation |
| `canonicalUrl` | Requested authoritative location |
| `resolvedUrl` | Final URL after redirects |
| `retrievedAt` | Timestamp of capture |
| `httpStatus` | Retrieval result |
| `contentType` | HTML, PDF, JSON, etc. |
| `etag` / `lastModified` | When supplied |
| `byteLength` | Exact captured byte count |
| `sha256` | SHA-256 of exact raw artifact |
| `archivedCopyRef` | Immutable local/object-storage reference |
| `locator` | Section/subsection/page/form field used by proposition |
| `sourceRole` | `CONTROLLING`, `INTERPRETIVE`, `REFERENCE`, or `OPERATIONAL_EVIDENCE` |
| `supersedesCaptureId` | Prior capture when the source changes |
| `notes` | Retrieval or authority qualification |

Where a capture becomes a canonical PR-0A source, the overlapping values map into the existing `RegulatorySource` fields rather than creating a parallel source object. fileciteturn8file0turn9file0

### Nevada source-inventory pass

No Nevada legal propositions should be written in this phase. The immediate Nevada artifact is only an **inventory of authority surfaces**.

The starting seeds supplied by the earlier report are valid, but current primary-source discovery shows that the inventory should be broader than the short original list. Nevada's official Legislature currently publishes Chapter 683A, which governs persons involved in insurance sale/administration and contains the producer licensing rule, business-organization requirements, lines of authority and related licensing provisions. citeturn7search5

Official Nevada materials also establish that the source inventory should, at minimum, inspect these families:

| Authority surface | Why it belongs in the inventory |
|---|---|
| NRS Chapter 683A + applicable NAC 683A | Producer/business-entity licensing, lines of authority, appointments and related producer authority. The DOI separately states insurer appointments are required for individual and business-entity producers and provides the operating appointment system. citeturn7search5turn9search3 |
| NRS/NAC Chapter 686A | Insurance trade practices, inducement/rebate and related unfair-practice questions. citeturn8search1turn8search10 |
| NRS/NAC Chapter 485 | Motor-vehicle financial responsibility and insurance-verification requirements. citeturn8search0turn8search9 |
| NRS/NAC Chapter 690B | Casualty/motor-vehicle insurance requirements that may not be discoverable from Chapter 485 alone. Its presence is an example of why the source-inventory pass must precede rule writing. citeturn8search15turn8search37 |
| NRS/NAC Chapter 687B | Insurance-contract requirements, including cancellation/nonrenewal and policy/application-related subjects relevant to the Open Policy lifecycle. citeturn8search2turn8search27 |
| NAC 679B and related NRS authority | Insurance privacy/information-practice requirements, including privacy notices and permitted disclosures. citeturn8search6turn8search8 |
| Nevada electronic-transactions authority | Electronic records/signature/consent analysis; exact applicable insurance exceptions or overlays must be determined from primary text before candidates are written. |
| Nevada security/breach authority | Information-security and breach-notification analysis, with insurance-specific and general-state layers kept distinct until applicability is resolved. |
| DOI bulletins | Current interpretive/administrative materials. The DOI maintains a live bulletin repository, including 2026 material. citeturn9search0 |
| DOI Property & Casualty filing/review material | The DOI states its Review Standards Checklist identifies statutory and regulatory rate/form requirements, including state-specific cancellation/nonrenewal requirements and citations. citeturn9search2 |
| DOI licensing/appointment operational records | Evidence for how licensing/appointments are operationally established; useful alongside, not instead of, controlling statutes/regulations. citeturn9search3turn9search4 |
| DOI/SERFF public filings where legally relevant | Official filing evidence for approved forms/rules when a rule requires examination of filed product material. The DOI publicly directs users to SERFF filing access for property/casualty rates, rules and forms. citeturn9search6 |

This is explicitly a **seed inventory, not a declaration that the listed chapters exhaust Nevada law**.

### Nevada completeness matrix

The matrix should be broader than the old 19-item concept because research must discover requirements that software does not yet know how to execute.

For personal auto/Open Policy, the calibration matrix should at least investigate:

| Research domain | Closest current PR-0A mapping |
|---|---|
| Individual producer licensing and line of authority | `PRODUCER_LICENSING` / `PRODUCER_AUTHORITY` |
| Business-entity licensing | `PRODUCER_LICENSING` / `PRODUCER_AUTHORITY` |
| Producer appointments | `PRODUCER_APPOINTMENT` |
| Broker/agent classification and authority | `BROKER_AGENT_CLASSIFICATION` |
| Carrier/company authority | `CARRIER_AUTHORITY` |
| Producer commissions/compensation | Current mapping incomplete; dossier required |
| Provider/consumer fees and disclosures | `CONSUMER_FEE_DISCLOSURE` |
| Referral arrangements | Current mapping incomplete; dossier required |
| Rebates and inducements | `REBATING_INDUCEMENT` |
| Advertising/misrepresentation/comparison | Current mapping incomplete; dossier required |
| Quote requirements | `QUOTE_REQUIREMENT` |
| Application requirements | `APPLICATION_REQUIREMENT` |
| Binding/issuance requirements | `BINDING_REQUIREMENT` |
| Minimum motor-vehicle liability | `MINIMUM_LIABILITY` |
| UM/UIM | `UM_UIM` |
| PIP/no-fault | `PIP_NO_FAULT` |
| MedPay | `MEDPAY` |
| Mandatory offers/elections/rejections | `MANDATORY_OFFER`, `CONSUMER_ELECTION` |
| Prescribed/required forms | `REQUIRED_FORM` |
| Proof of insurance | `PROOF_OF_INSURANCE` |
| Cancellation/nonrenewal/replacement/switching | `CANCELLATION_NONRENEWAL`, `REQUIRED_NOTICE` |
| Electronic signatures | `ELECTRONIC_SIGNATURE` |
| Electronic records/delivery | `ELECTRONIC_RECORDS` |
| Insurance privacy and disclosure | `PRIVACY` |
| Cybersecurity/security obligations | Current mapping incomplete; dossier required |
| Breach notification | Current mapping incomplete; dossier required |
| Record retention | `RECORD_RETENTION` |
| State communications/telemarketing overlay | Current mapping incomplete; federal kept separate |
| Jurisdiction/basis-of-law findings | Research dossier, not `RuleCategory` |
| Required regulator/carrier operational evidence | Source/verification dossier |

This matrix deliberately reveals gaps instead of immediately “fixing” the TypeScript enum. That is the correct behavior. PR-0A already says unsupported canonical coverage concepts become `INDETERMINATE`; the same philosophy should govern regulatory research generally: **absence of an executable representation is a software limitation to surface, not a reason to simplify the law until it fits the code.** fileciteturn12file0

### Network-access ruling

The Nevada public sources themselves are not generally unavailable. As of **October 3, 2026**, this research environment can retrieve the Nevada Legislature's NRS 683A material and the Nevada Division of Insurance's live bulletin, licensing, appointment, and P&C filing-information pages. citeturn7search5turn9search0turn9search2turn9search3

Therefore, if Claude Code still cannot reach them, the problem should be treated as an **agent-environment network/allowlist problem**, not evidence that the authoritative sites are offline.

The minimum source allowlist for the Nevada pass should cover the actual Nevada government hosts used by the authoritative corpus, particularly:

```text
leg.state.nv.us
www.leg.state.nv.us
doi.nv.gov
www.doi.nv.gov
```

The capture mechanism also needs to permit redirects plus HTML and PDF retrieval. NIPR, Sircon and SERFF may later be needed as operational/reference systems, but they must not replace Nevada primary legal authority.

If that environment cannot retrieve an authoritative artifact, the appropriate PR-0B state is:

```text
SOURCE_CAPTURE_BLOCKED
```

not:

```text
INFER_RULE_FROM_SEARCH_SNIPPET
```

No architectural workaround should weaken that requirement.

## Regional research manifest

The repository already provides the canonical 51 jurisdiction identities. fileciteturn21file0 What PR-0B needs is a second artifact that controls **research scheduling**, not law.

For membership, the cleanest evidence-neutral baseline is the Census Bureau's four-region classification. Census identifies Northeast, Midwest, South and West and explicitly lists the member states and District of Columbia. citeturn7search4

Nevada is separated from its normal Western cohort solely because it is the Wave 0 methodology-calibration jurisdiction. It therefore must not appear again in the post-approval Western cohort.

### Canonical membership manifest

| Research cohort | Jurisdictions | Count |
|---|---|---:|
| **Wave 0 — Nevada calibration** | NV | 1 |
| **Western Region — post-calibration remainder** | AK, AZ, CA, CO, HI, ID, MT, NM, OR, UT, WA, WY | 12 |
| **Midwest Region** | IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI | 12 |
| **South Region** | AL, AR, DE, DC, FL, GA, KY, LA, MD, MS, NC, OK, SC, TN, TX, VA, WV | 17 |
| **Northeast Region** | CT, ME, MA, NH, NJ, NY, PA, RI, VT | 9 |
| **Total** | Every state + D.C. exactly once | **51** |

The underlying regional membership matches the Census definitions: the full West has 13 jurisdictions including Nevada, Midwest 12, South 17 including D.C., and Northeast 9. citeturn7search4 Removing Nevada from the post-calibration West leaves 12, giving `1 + 12 + 12 + 17 + 9 = 51`.

I would freeze **membership** now.

I would **not invent a new sequence among Midwest, South and Northeast** if a previously approved Open Policy regional-order decision exists outside the accessible repository. The evidence currently accessible establishes only what your directive itself fixes: **Nevada first, then the complete Western cohort, then successive complete regions rather than scattered states.** Region membership and region execution order are different concerns.

Accordingly, the manifest should carry an explicit order field:

```text
wave0:
  - NV

wave1:
  name: WEST
  members:
    - AK
    - AZ
    - CA
    - CO
    - HI
    - ID
    - MT
    - NM
    - OR
    - UT
    - WA
    - WY

remainingRegionalSequence:
  status: USE_PREVIOUSLY_APPROVED_SEQUENCE
  unsequencedCohorts:
    MIDWEST:
      [IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI]

    SOUTH:
      [AL, AR, DE, DC, FL, GA, KY, LA, MD, MS, NC, OK, SC, TN, TX, VA, WV]

    NORTHEAST:
      [CT, ME, MA, NH, NJ, NY, PA, RI, VT]
```

This avoids silently manufacturing an architectural decision that is not contained in `7d5133a...`.

The manifest validator should assert mechanically:

```text
jurisdictionCount === 51
uniqueJurisdictionCount === 51
duplicateJurisdictions.length === 0
missingFromUSJurisdictions.length === 0
unknownJurisdictions.length === 0
NV occurs exactly once
```

That is worthwhile even though this is research metadata: it prevents a future 50-state project from quietly becoming 49 or 52.

## Verification, legacy reconciliation, and acceptance gate

The Nevada Wave 0 methodology should have a much harder definition of “done” than “we found the answer.”

### Candidate production sequence

```text
SOURCE INVENTORY
      │
      ▼
SOURCE CAPTURE
      │
      ▼
COMPLETENESS REVIEW
      │
      ▼
ATOMIC EXTRACTION
      │
      ▼
PR-0A REPRESENTABILITY REVIEW
      │
      ├── representable
      │       ↓
      │   candidate JurisdictionRule
      │
      └── not representable
              ↓
          dossier finding
          + PR-0C gap marker
      │
      ▼
LEGACY RECONCILIATION
      │
      ▼
READY_FOR_VERIFICATION
      │
      ▼
INDEPENDENT VERIFICATION
      │
      ▼
NEVADA METHODOLOGY DOSSIER
      │
      ▼
HUMAN APPROVAL GATE
      │
      ▼
WESTERN REGION
```

No candidate should move to `READY_FOR_VERIFICATION` unless its controlling proposition is linked to the captured authoritative artifact and exact locator.

### Legacy reconciliation

For every legacy Nevada proposition imported by PR-0A, the dossier should show:

| Field | Requirement |
|---|---|
| Legacy rule ID/code | Exact PR-0A seed reference |
| Legacy proposition | What frozen code asserted |
| Legacy citation | Existing citation, exactly preserved |
| Legacy qualification effect | What frozen marketplace currently does |
| Primary source found | Yes / No |
| Primary citation | Exact official authority |
| Captured source hash | SHA-256 |
| Research disposition | `CONFIRMED`, `CORRECTED_CANDIDATE`, `SUPERSEDED_BY_LAW`, `NOT_APPLICABLE`, `UNRESOLVED` |
| Candidate rule ID | New rule if representable |
| Difference explanation | Precise semantic difference |
| PR-0C consequence | Future migration note only |

The legacy data must remain **behaviorally frozen** during this process. PR-0A deliberately seeded it as unverified historical material while leaving `qualificationEngine.ts` untouched. fileciteturn14file0turn10file0

### Provider-authority questions Wave 0 must resolve

The repository itself identifies concrete Nevada questions, rather than forcing PR-0B to invent them.

The provider-authority engine currently refuses to infer authority merely from the presence of a license. It needs a legal requirement defining what license and appointment evidence is actually required. fileciteturn22file0 Nevada's official producer statute says a person may not sell, solicit or negotiate insurance in the state for a class without the corresponding license, and Nevada's DOI states that appointments are required for individual and business-entity producers acting in the state. citeturn7search5turn9search3 The exact candidate rules still require full source extraction and verification rather than converting those summaries directly into executable values.

The current engine also deliberately returns uncertainty when a license's expiration date equals the evaluation date because **expiration-day semantics remain unverified**. fileciteturn22file0 That is a perfect example of PR-0B work: research the primary legal/operational authority, capture it, verify the proposition, and only then supply a candidate rule or evidence interpretation.

Similarly, direct-carrier authority is presently `INDETERMINATE` because certificate-of-authority evidence is not yet modeled in the engine. fileciteturn22file0 PR-0B should research and document the applicable Nevada authority/evidence; it should **not modify the engine during Wave 0**.

### Nevada Wave 0 acceptance criteria

Nevada should reach its approval gate only when all of the following are true:

| Gate | Required result |
|---|---|
| Repository reconciliation | Every report recommendation classified |
| Architecture integrity | No second jurisdiction/rule runtime model |
| National reference baseline | NAIC manifest established, reference-only semantics documented |
| Federal separation | Federal authority manifest separate from Nevada state candidates |
| Source inventory | All known Nevada authority surfaces catalogued |
| Source capture | Primary artifacts captured with hashes and archival references |
| Completeness | Every required matrix domain dispositioned |
| Candidate extraction | Atomic propositions, no compound “mega-rules” |
| Authority hierarchy | Primary Nevada source controls over summaries/references |
| PR-0A compatibility | Representable candidates use current canonical types |
| Unsupported law | Explicit dossier gap; never forced into a fake `MachineRule` |
| Legacy reconciliation | Every relevant legacy NV rule compared |
| Independent verification | Researcher and verifier attributable and distinct |
| Unresolved questions | Zero un-dispositioned blockers at approval |
| Marketplace behavior | No outcome changed |
| Commercial behavior | No CE charge/rating behavior changed |
| Regression | Existing PR-0A/PM/CE gates remain green for any evidence-neutral code changes |
| Regional manifest | 51 unique jurisdictions, Nevada exactly once |
| Human methodology approval | Required before Western cohort begins |

The distinction between **research verification** and **runtime publication** should remain explicit. A Wave 0 dossier may be legally/research-verified without immediately promoting Nevada to enforced marketplace law. Enforcement is PR-0C.

## Canonical PR-0B specification

The resulting final scope can now be frozen.

### Purpose

**PR-0B — Jurisdictional Insurance Rule Mapping** constructs the authoritative, auditable personal-auto regulatory corpus that PR-0A's jurisdiction architecture will eventually consume.

It answers:

> What authoritative law, regulation, regulator material, prescribed form and operational authority applies to the relevant Open Policy activity in this jurisdiction, on this legal date, and what precisely does that authority require?

It does **not** answer:

> Should today's production marketplace now block or alter this transaction?

That second question belongs to PR-0C.

### Repository authority

The repository precedence is:

```text
main @ 7d5133a04331adbc264019caab380943c988d189
        │
        ├── PR-0A canonical types
        ├── migration 0008
        ├── JurisdictionStore
        ├── jurisdictionRuleEngine
        ├── providerAuthorityEngine
        ├── jurisdictionDetermination
        ├── rulesetGovernance
        ├── marketActivationEngine
        └── shadow orchestration
```

PR-0B research artifacts **adapt to these**, not the reverse. fileciteturn10file0turn8file0

### Required document tree

The canonical research structure should be conceptually:

```text
docs/pr0b/
├── DEEP-RESEARCH-RECONCILIATION.md
├── METHODOLOGY.md
├── SOURCE-CAPTURE-PROTOCOL.md
├── REGIONAL-RESEARCH-MANIFEST.*
│
├── national/
│   ├── NAIC-REFERENCE-MANIFEST.*
│   └── FEDERAL-AUTHORITY-MANIFEST.*
│
└── jurisdictions/
    └── NV/
        ├── SOURCE-INVENTORY.*
        ├── SOURCE-MANIFEST.*
        ├── COMPLETENESS-MATRIX.*
        ├── JURISDICTION-BASIS.*
        ├── LEGACY-RULE-RECONCILIATION.*
        ├── CANDIDATE-RULESET.*
        ├── UNRESOLVED-QUESTIONS.*
        └── VERIFICATION-DOSSIER.*
```

The file extension can be Markdown, JSON, YAML, or an intentionally mixed human/machine pair; that is implementation detail. The architecture requirement is that **human-readable reasoning and deterministic machine-checkable evidence both exist**.

### Explicit exclusions

PR-0B shall not:

```text
change marketplace qualification outcomes
change provider eligibility outcomes
block or admit marketplace participation
replace qualificationEngine.ts
retire the legacy NV/OH/CA registry
change consumer comparison behavior
change consumer selection behavior
change disclosure/binding behavior
change PM-5 reconciliation
change Commercial Economics rating
make Authorized Connection legality affect billing yet
add production enforcement mode
add regulatory write APIs
invent missing jurisdiction facts
expand regulatory machine semantics without separate review
treat NAIC as controlling state law
create legal propositions from search snippets
create legal propositions from LLM/model memory
create legal propositions from the old Open Policy registry
create legal propositions solely from secondary summaries
```

Those boundaries are consistent with the merged PR-0A shadow contract and its explicit carried-forward PR-0B/PR-0C responsibilities. fileciteturn10file0turn5file0

### Final architecture directive

The coding/research directive can now be shortened to this canonical version:

> **PR-0B shall be implemented against `main @ 7d5133a04331adbc264019caab380943c988d189`. PR-0A's canonical jurisdiction types, migration `0008`, stores, governance, pure engines, market architecture and binding decisions remain authoritative. Do not introduce a second runtime `JurisdictionRulePack`, `RuleVersion`, effect language, jurisdiction system, or regulatory persistence model.**
>
> **PR-0B is an evidence-production workstream. Establish the national NAIC reference manifest, separate federal authority manifest, 51-jurisdiction regional research manifest, deterministic source-capture protocol, jurisdiction completeness methodology, candidate-rule mapping, legacy reconciliation, independent verification dossier and source-change foundations. NAIC material is reference/discovery evidence and never independently establishes executable state law.**
>
> **Nevada is Wave 0. Before any Nevada rule proposition is authored, perform and approve a Nevada Source Inventory Pass. Capture the exact primary/regulator artifact, retain its bytes, compute SHA-256, retain retrieval metadata and archival reference, and identify the exact legal locator. Only then extract an atomic proposition. Search snippets, model memory, secondary sources, legacy code and the prior research report may generate research leads but may not independently substantiate a candidate rule.**
>
> **Map representable Nevada propositions into the existing `JurisdictionRuleSet` / `JurisdictionRule` vocabulary. Preserve the existing legacy Nevada ruleset as historical `UNVERIFIED` evidence and construct a new primary-source candidate rather than rewriting the legacy candidate. Where Nevada law cannot be expressed using current PR-0A types or `MachineRule`, record the proposition and evidence in the PR-0B dossier and mark the representational gap for PR-0C review; do not distort the legal proposition to fit current code.**
>
> **PR-0B research completion is governed by the independent completeness matrix and verification dossier, not merely by runtime `PUBLISHED` or `RULES_VERIFIED` status. Every mandatory research category must be supported, explicitly not applicable, deliberately deferred with rationale, or surfaced as an unresolved/conflicting-authority blocker.**
>
> **After Nevada is independently verified, stop for methodology approval. Only after that approval does research proceed through the complete Western cohort. Continue thereafter only by complete approved regional cohorts until all 50 states and the District of Columbia are covered exactly once. PR-0B shall not activate new regulatory enforcement or modify frozen PM-1–PM-5 or CE behavior. PR-0C remains a separate future decision.**

That is the appropriate stopping point. **The architecture phase for PR-0B is now sufficiently constrained. The next substantive regulatory operation is Nevada source inventory and artifact capture—not more architecture, not generalized 50-state rule writing, and not PR-0C enforcement.**

