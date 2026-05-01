# Validating Runtime Appendix

This is the single runtime appendix for `pulse:validating`. It contains reusable prompts, checklists, and approval templates used by the hot path.

---

## A. Phase 0 Orientation Template

```text
Validating Phase <n> of <total>: <phase name>
Approval status (phase-plan.md): APPROVED | PENDING | REVISE_REQUIRED
Approved phase to prepare next: <value>
Approval source: history/<feature>/phase-plan.md
STATE mirror: in sync | out of sync | missing

Stories:
- Story 1: <name>
- Story 2: <name>
- Story 3: <name>

Goal of this phase:
- <one-line practical outcome>
```

Stop conditions:
- `phase-plan.md` is not `APPROVED`
- approval fields are missing where required
- `phase-plan.md` and `.pulse/STATE.md` disagree on approval/phase

---

## B. Schema Gate Checklist

Every bead must include:
- `dependencies`
- `files`
- `verify`
- `verification_evidence`
- `testing_mode`
- `decision_refs`
- `learning_refs`

Additional checks:
- if `testing_mode: tdd-required`, bead must include explicit red/green `tdd_steps`
- `verify` must be executable proof criteria, not vague prose
- `verification_evidence` must point to explicit artifact path or concrete record
- `files` scope must be tight and justifiable
- for HIGH-risk beads, `learning_refs` must be populated when clearly relevant recall exists

---

## C. Plan-Checker Runtime Contract (8 Dimensions)

Use this when spawning plan-checker. Inputs:
- all `.beads/*.md`
- `history/<feature>/CONTEXT.md`
- `history/<feature>/discovery.md`
- `history/<feature>/approach.md`
- `history/<feature>/phase-plan.md`
- `history/<feature>/phase-<n>-contract.md`
- `history/<feature>/phase-<n>-story-map.md`

Output format:

```text
PLAN VERIFICATION REPORT
Feature: <feature name>
Current phase: Phase <n> - <name>
Stories reviewed: <N>
Beads reviewed: <N>
Date: <today>

DIMENSION 1 — Phase Contract Clarity: [PASS | FAIL]
DIMENSION 2 — Story Coverage And Ordering: [PASS | FAIL]
DIMENSION 3 — Decision Coverage: [PASS | FAIL]
DIMENSION 4 — Dependency Correctness: [PASS | FAIL]
DIMENSION 5 — File Scope Isolation: [PASS | FAIL]
DIMENSION 6 — Context Budget: [PASS | FAIL]
DIMENSION 7 — Verification Completeness: [PASS | FAIL]
DIMENSION 8 — Exit-State Completeness And Risk Alignment: [PASS | FAIL]

OVERALL: [PASS | FAIL]
PRIORITY FIXES (if FAIL):
1. <most important>
2. <next>
```

Dimension criteria (must all pass):
1. phase contract clarity (entry/exit/demo/unlocks observable)
2. story coverage and why-now ordering coherence
3. locked decision coverage into stories and beads
4. dependency correctness (story+bead order, acyclic, no hidden deps)
5. file scope isolation for parallel execution
6. context budget fit per bead
7. verification completeness for stories and beads
8. exit-state completeness plus HIGH-risk spike alignment

Iteration policy:
- maximum 3 iterations
- fail after third unresolved iteration and escalate

---

## D. High-Risk Spike Protocol

For each HIGH-risk row in `approach.md`:
1. Create one spike bead with exact `spike_question`.
2. Timebox isolated execution to 30 minutes.
3. Write findings to `.spikes/<feature>/<spike-id>/FINDINGS.md`.
4. Close with definitive `YES` or `NO` only.

If no definitive answer at 30 minutes:
- present current findings
- offer: +15m extension (explicit approval), replan, or mitigation plan
- never classify inconclusive as YES

Routing:
- YES → propagate constraints into affected beads/story map
- NO → stop, update `approach.md`, return to planning, re-run validating

---

## E. Bead Fresh-Eyes Reviewer Contract

Use this for quality pass after graph polishing.

Review goals:
- detect CRITICAL execution blockers (assumed context, vague done criteria, broken verify, missing schema, missing TDD contract, scope overload, ambiguous implementation path)
- detect MINOR ambiguity/judgment-call risks
- revise only when fix is local, clear, and keeps intended scope

Report skeleton:

```text
BEAD REVIEW REPORT
CRITICAL FLAGS (<N>)
MINOR FLAGS (<N>)
CLEAN BEADS (<N>)
REVISIONS MADE (<N>)
SUMMARY
```

Gate rule:
- all CRITICAL flags must be resolved before approval request

---

## F. Final Approval Prompt (Gate 3)

```text
VALIDATION COMPLETE — APPROVAL REQUIRED BEFORE EXECUTION

Phase Summary:
- Phase: <Phase n — name>
- Phase contract: history/<feature>/phase-<n>-contract.md
- Story map: history/<feature>/phase-<n>-story-map.md
- Stories: <N>
- Beads: <N>
- Demo story: <one line>
- Execution mode: <swarm | single-worker>

Structural Verification:
- All 8 dimensions: PASS (after <N> iterations)

Spike Results:
- HIGH-risk items: <N>
- Result: <all passed / concerns>

Polishing Results:
- Dependencies added: <N>
- Graph issues fixed: <N>
- Priority adjustments: <N>
- Duplicates removed: <N>
- Fresh-eyes CRITICAL flags fixed: <N>

Exit-State Readiness:
- Entry state understood: YES
- Exit state observable: YES
- Story sequence coherent: YES
- Demo credible: YES

Unresolved concerns:
- <none | list>
```

Approval options (prefer structured tool if available):
- Approve execution
- Review beads
- Revise plan

Rejection routing options:
1. phase meaning / exit-state issue
2. story order or story size issue
3. risk or spike concern
4. bead quality concern
5. fundamental approach concern

Hard stop:
- no execution starts until explicit approval is captured
