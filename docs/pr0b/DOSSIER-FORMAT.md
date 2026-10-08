# PR-0B Canonical Jurisdiction Dossier Format

Adopted from the PR-0B Governing Research Directive (2026-10-03). Every jurisdiction dossier uses this structure. This document defines the format; it contains no law.

## Roles

| Role | Who | May |
|---|---|---|
| **AUTHOR** | Claude Code / research process | Discover and capture sources, normalize propositions, review cross-references, construct candidate machine rules, prepare fixtures. Raise a rule at most to `READY_FOR_VERIFICATION`. |
| **VERIFIER** | An independent, qualified human (insurance regulatory counsel or a compliance professional competent in the jurisdiction and subject) | Mark a rule `VERIFIED` |
| **PUBLISHER** | An authorized Open Policy governance actor | Publish a ruleset of verified rules |

Constraints: author ≠ verifier, author ≠ publisher. For production rulesets, verifier ≠ publisher as well (preferred; stricter than PR-0A's schema minimum).

## Authority hierarchy

| Tier | Class | Examples | Can found a VERIFIED rule? |
|---|---|---|---|
| **A** | Controlling primary legal authority | Enacted statutes and the current official code; effective regulations and the official administrative code; adopted but not-yet-codified regulations (e.g. a state register); binding orders | Yes |
| **B** | Official regulatory implementation | DOI bulletins, notices, commissioner orders, official interpretations, official FAQs and guidance, prescribed forms, election/rejection forms, filing instructions | Yes, **classified accurately**: a bulletin or FAQ is never recorded as having the force of a statute or regulation |
| **C** | Official operational systems | State license lookup, NIPR/PDB, Sircon where officially used, appointment records, company-authorization lookup | Yes, for *current status* facts only; never for *what the law requires* |
| **D** | Official filed insurance materials | SERFF and public filing access, approved forms, carrier rating rules and elections | Yes, for carrier-specific facts only; kept separate from generally applicable law |
| **DISCOVERY** | Everything else | Law firms, insurance sites, blogs, aggregators, treatises, NAIC model laws, search summaries, AI output | **No.** Discovery only. A model law is not state law until the jurisdiction enacted or adopted it. |

## Evidence standard for `VERIFIED`

An executable rule may be marked `VERIFIED` only when its package establishes all of the following:

1. **Authority:** the authoritative source is identified.
2. **Exact citation:** precise enough to retrieve the source again.
3. **Source capture:** official URL, retrieval date, and the content hash of the verbatim capture (`npm run pr0b:capture`).
4. **Atomic proposition:** the rule says one discrete thing.
5. **Applicability:** who and what it governs, and when.
6. **Effective period:** `effectiveFrom` and `effectiveUntil` where ascertainable.
7. **Legal character:** statute, regulation, bulletin, form or operational requirement, classified correctly.
8. **Machine interpretation:** the executable behavior follows from the text, with no unstated legal conclusion added.
9. **Cross-reference review:** incorporated definitions, exceptions and cross-references have been checked.
10. **Contradiction search:** later amendments, superseding regulations and relevant bulletins and forms have been checked.
11. **Independent verification:** the verifier is not the author.
12. **No material unresolved ambiguity.**

Research status (set by the AUTHOR):

- 1–10 satisfied, no independent review yet: `READY_FOR_VERIFICATION`.
- Research done but not all of 1–10 established: `RESEARCHED`.
- Sources conflict, or the interpretation exceeds the text: `REVIEW_REQUIRED`. The machine result is `INDETERMINATE`.

**Never convert uncertainty into a rule to make a dossier look complete.**

## Rule record

```
RULE ID                 <J>-<CATEGORY>-<nnn>
Jurisdiction / Line / Category

NORMALIZED PROPOSITION  one discrete statement

LEGAL CHARACTER         Statute | Regulation | Adopted-uncodified regulation | Order |
                        Bulletin | Official guidance | Prescribed form | Operational authority | Carrier filing
AUTHORITY TIER          A | B | C | D

PRIMARY AUTHORITY       citation · official URL · effective date · retrieved at · sha256
SUPPORTING AUTHORITIES  same fields, each

APPLICABILITY           who / what / when
EXCEPTIONS
REQUIRED EVIDENCE       what Open Policy must hold to evaluate the rule
MACHINE INTERPRETATION  MachineRule kind + parameters, or "informational (machineRule = null)"
EVALUATION DATE BASIS   TemporalBasis (D10), with justification from the text
PASS / FAIL / BLOCK / INDETERMINATE CONDITIONS

CROSS-REFERENCES REVIEWED
SUPERSESSION / AMENDMENT CHECK   what was searched, where, when
CONFLICTS FOUND
OPEN QUESTIONS

AUTHOR                  
RESEARCH STATUS         RESEARCHED | READY_FOR_VERIFICATION | REVIEW_REQUIRED
VERIFIER                null until independent human review
VERIFICATION STATUS     UNVERIFIED until the verifier acts
PUBLICATION STATUS      UNPUBLISHED
```

## Category completeness

A jurisdiction is **research-complete** when every category below holds either candidate rules, a documented `NOT_APPLICABLE` (with the authority showing why), or explicit unresolved questions. **"No rule entered" never means "none exists."**

A jurisdiction is **verified** only when every rule required for production has been independently verified, and every material open issue is resolved or represented as an enforcement-blocking uncertainty.

**Researched ≠ verified ≠ activated.** Activation stays a separate governance decision (PR-0A §M D5/D7).

Lifecycle categories: coverage requirements · mandatory offers, elections and rejections · producer and agency licensing · lines of authority · appointments and carrier authority · compensation and broker fees · anti-rebating and inducements · quote and application requirements · consumer disclosures · electronic transactions and signatures · binding · proof of insurance · policy issuance · replacement and switching · cancellation and nonrenewal · privacy · records and retention · required forms · insurer and company authority.

## Boundary

PR-0B produces regulatory intelligence and evidence packages. **Nothing becomes enforced in PR-0B.** Shadow mode stays shadow mode, and enforcement is PR-0C.
