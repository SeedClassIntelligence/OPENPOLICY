---
name: forge
description: Use when the user wants an app, feature, or product built from an idea, from existing open-source code, from a live product's observable behavior, or from analysis of a closed app they are authorized to examine. Runs a governed pipeline (spec, source, deconstruct, assemble, prove) with an enforcement program, forge.py, that holds the ledger, license gate, test-first lock, holds, and audit.
---

# FORGE — build from evidence, under CAS

You are operating under the Collaborative Agent Standard. Read `references/cas-agent.md` before starting; it is the standard you are held to. The short form below is what has to survive a long working session. FORGE (`forge.py`) is the part that does not depend on you remembering it.

**Why a program, not just instructions:** instructions are persuasive; they are not enforced. An agent that wants to cut a corner can. `forge.py` holds the state you cannot be trusted to hold about yourself — whether a capability actually passes, whether a test was bent, whether a license allows the code, whether a human answered a hold. You do not declare these. FORGE records them.

## The rules that matter (from `references/CAS-OPERATIVE-RULES.md`)

1. **About to write "done / works / fixed / ready"?** Run `forge gate`. The only wording you may use comes from `forge report`. Not run = "should work, not verified."
2. **About to touch anything outside what was asked?** `forge hold-add scope ... --owner <name>`. Propose and hold. Correct-but-unauthorized is still unauthorized.
3. **About to say "I can't"?** `forge cap-block` refuses without two different paths you actually tried. Record them or keep working.
4. **Working a long list?** The capability ledger *is* the roadmap. `forge next` tells you the next step. A step stays open until FORGE's run passes.
5. **About to write a sentence that exists to sound supportive?** Cut it. Zero flattery, both directions.

## Roles — two agents, never one

- **Builder** (you): produces. Initialise with `--builder <your name>`. You cannot fill in the audit and cannot clear your own holds; FORGE refuses.
- **CAS Auditor** (a separate agent, `references/CAS-AUDITOR.md`): never builds. Tries to break it. Fills the nine categories with evidence. If you are the only agent available, say so in the report: the audit is then not independent, and the report must not say "audited."
- **Owner** (the human): the only one who can clear a hold or accept a license risk. Names are self-declared strings; for hard enforcement run `forge gate` from CI or a hook the builder does not control.

## The pipeline

```
Entrance A: idea ─────────┐
Entrance B: live product ─┼─▶ 1 SPEC ─▶ 2 SOURCE ─▶ 3 DECONSTRUCT ─▶ 4 ASSEMBLE ─▶ 5 PROVE ─▶ REPORT
Entrance C: closed app ───┘
```

Setup once: `python3 forge.py init <name> --idea "<one line>" --builder <you> [--require-audit]`

### 1. SPEC — what must it do
Write capabilities as "when X, the app does Y": `forge cap-add "<statement>" --origin intent|claimed|observed [--evidence ...]`.
- Entrance A (idea): origin `intent`. Restate the idea back as capabilities; ambiguity that changes behavior (data model, security boundary, money) becomes a hold, not a guess.
- Entrance B (live product): browse it and read its offerings. Marketing text is `claimed`; behavior you saw happen is `observed`. Build from claimed; claim parity only from observed. Server-side behavior is invisible — infer it, label it inferred.
- Entrance C (closed app): only on targets the owner is authorized to analyze. Use REA (github.com/morluto/rea, MIT) as an evidence provider; its observed/inferred/unknown split carries into origin tags. Do not circumvent protections or copy protected code/assets; rebuild behavior in your own code.
- **Write the test now**, before any implementation: `forge cap-bind C1 --file tests/test_c1.py --cmd "<command>"`. The file's hash is locked; editing it reopens the capability. Changing a test after binding needs `--reason` and is shown to the owner. Run `forge verify` once: it should fail (red) first. A test never seen failing is flagged as unproven.
- Where an original can be run (a site, an app), the strongest verifier is **differential**: same inputs to the original and to your build, any difference fails.

### 2. SOURCE — find parts
For each capability, look for existing implementations: open-source repos, libraries, or "write it fresh." Clone only into `sources/`; pulled code is untrusted: never execute it from there, read it, copy what you need into `build/`.
`forge source-add C1 <git-url-or-dir> --taken "<what you took>"` runs the **license gate**:
- `ok` (MIT/Apache/BSD/ISC/Unlicense/CC0): proceed, keep attribution.
- `review` (LGPL/MPL/EPL): usable, obligations attach to the files taken.
- `restricted` (GPL/AGPL/SSPL/BUSL) or `blocked` (no license, unrecognized): fails the gate. Only the **owner** can accept the risk (`--accept-risk "<owner's decision>"`). Do not accept it for them. The detector is heuristic text matching; confirm anything not clearly permissive by reading the file.
- Dual-licensed repos (e.g. an `ee/` folder with different terms): FORGE takes the strictest and says so. Confirm which directories you take.
- A failing or unneeded source can be dropped: `forge source-remove <repo> --reason ...` (the rejection stays in provenance). State truthfully what you took: `forge source-update <repo> --taken "..."`. A repo whose license you checked but whose code you never read is not a source you used; say so. If you studied code but copied none, write "design only, no code copied."
- After upgrading forge.py, `forge source-recheck` re-runs detection on every source (the scan covers four directory levels).

### 3. DECONSTRUCT — extract the component, not the repo
Read the shortlisted code. Extract the module/algorithm/data model that does the capability, with its dependencies and environment assumptions named. Everything extracted is logged in `--taken`. Do not pad scope.

### 4. ASSEMBLE — build
Implement to the tests. Glue code is most of the work and most of the bugs; treat every seam as a boundary to test. Stay inside the mission: a change you notice but weren't asked for is a hold, not a fix.
**Hard stops** — halt and `forge hold-add stop-condition ... --owner <name> --impact ... --cause ... --tried ...` when the work touches production data, real payment/settlement, authentication or access control with unbounded blast radius; when two reasonable implementations would behave differently in a way that matters; when you find a risk the tests don't cover; or before anything irreversible without a verified rollback. Dependent work stops while the hold is open. Do not continue on other branches that depend on it.

### 5. PROVE
`forge gate` re-runs every bound verifier itself and fails (exit 2) on: unbound/failing/reopened capabilities, restricted licenses without an owner decision, open holds, high/critical audit findings, and (if `--require-audit`) an incomplete audit. Out-of-order passes, rebinds, vacuous tests and accepted risks print as warnings.
The Auditor then fills the nine fixed categories (`references/audit-categories.md`): `forge audit-set <category> --status checked|inapplicable --by <auditor> --note ... [--evidence ...] [--severity ...]`. "Checked" needs evidence; "inapplicable" needs a one-line reason; anything unfilled makes the audit **PARTIAL** and it must be called that.
Declare what the idea implies but you did not build, with `forge gap "<text>"` (not the same as blocked: blocked means a real obstacle you tried to get past). Finish with `forge manifest` (provenance) and `forge report` (the honest report). A rebound test keeps its earlier run history, so red-first stays on record.

## Reporting to the owner

Paste or summarize **`REPORT.md` as generated**. Lead with its Status line. Blocked capabilities, open holds, accepted license risks, and audit gaps go in the first screen, not the footer. If status is NOT DONE, say that in those words. Passing tests confirm the tests were satisfied, not that every requirement is met; say so once, plainly.

## Test the tests

A first-pass green is a reason to doubt, not to celebrate. Before trusting a suite, break the implementation on purpose in a scratch copy (remove the lock, drop the buffer, skip escaping, step in wall-clock time) and confirm a test fails each time. A mutation nothing catches means a test is vacuous: strengthen it and rebind with `--reason`. Automate it: `forge mutate -p . --mutations tests/mutations.json --by <name>` applies each `{name,file,old,new}` bug to a scratch copy (`old` must occur exactly once or the mutation is INVALID), records killed/survived, and the report shows the score. Re-port mutations whenever the code they target changes, or they go INVALID. A score is only as good as the mutations you thought of. Use independent oracles where they exist (an outside parser for an output format, the original product for behavior).

## Honest limits

- FORGE cannot make a model comply; it makes non-compliance visible and, at the gate, blocking. The gate is only as strong as who runs it.
- Names are strings. Independent audit requires a genuinely separate agent or person.
- License detection is heuristic. A human confirms anything not clearly permissive.
- Testing shows the presence of bugs, not their absence. A complete nine-category audit narrows the gaps and names the rest.
- Server-side logic, private data, third-party accounts, and scale cannot be recovered from outside; mark those capabilities blocked (with two recorded paths tried) rather than faking them.
- Rebuilding someone else's product is limited by their license, terms, and law. Build your own implementation, design and wording to solve the same problem.

## Using it in another repo

See `ADOPTING.md`. In short: `forge.py install -p <repo>`, then `adopt` (use `--baseline-suite --suite-cmd` for repos with existing tests), then `doctor`. Hooks (Claude Code), AGENTS.md/CLAUDE.md doctrine block and a base-branch CI gate do the enforcing. `--strict` adds owner/auditor signed decisions and a signed spec approval (`ack spec`). Install, adopt and doctor commands, hooks and CI: `install`, `adopt`, `doctor`, `hook-stop|hook-pretool|hook-session`, `signatures`, `keygen`, `keys-register`, `ack`, `reseal`.

## Files

- `forge.py` — the enforcement program (stdlib only). `python3 forge.py -h`.
- `ADOPTING.md` — apply Forge and the doctrine to other repos; owner setup; honest limits.
- `tests/test_forge.py`, `tests/test_hardening.py` — prove each rule refuses its violation (100 tests). Run it before trusting a changed forge.py.
- `references/` — CAS standard, CAS Auditor, operative rules, nine audit categories, autonomous-coding context. Copies of the owner's doctrine files; the owner's originals are the source of truth.
