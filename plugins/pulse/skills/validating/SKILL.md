---
name: pulse:validating
description: |
  The critical gate between planning and execution in the Pulse ecosystem. Load this skill after planning completes and before swarming begins. Verifies the phase contract, story map, and bead graph across 8 structural dimensions, executes time-boxed spikes for HIGH-risk items, polishes beads with bv graph analytics, and requires explicit user approval before any code is written. Prevents executing unclear phases, malformed story breakdowns, unknown blockers, and redundant duplicate work.
metadata:
  version: '1.2'
  position: 3
  chain: exploring → planning → validating → swarming
---

# Validating

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

> "Don't jump off the wall without checking."
> — The Pulse principle on verification

## Why This Skill Exists

The most expensive failure in agentic delivery is not a buggy bead. It is launching execution against a phase that was never clear enough to deserve execution.

Pulse now treats a phase as a **small closed loop**:

- clear entry state
- clear exit state
- simple demo story
- stories that explain why the internal order makes sense
- beads that implement those stories

This skill verifies all of that. It is not enough for the bead graph to look tidy. The validator must be able to answer:

- Does this phase close a meaningful loop?
- If all stories finish, will the exit state be true?
- If all beads finish, will the stories actually be complete?
- If the phase fails, will we know whether to debug locally or pivot the larger plan?

Skipping validating is still the fastest path to expensive rework.

## Communication Standard

Validation output must explain risk the way an implementer or user can picture it.

When reporting a failing dimension, spike result, or approval summary:

- state what the current phase is trying to make true
- describe what is wrong in the current plan or bead set
- explain why that would fail in a real scenario
- name the smallest credible repair

Do not stop at labels like "dependency issue", "story order problem", or "risk alignment problem" without translating them into plain language.

## Prerequisites

You need all of these:

- `history/<feature>/CONTEXT.md`
- `history/<feature>/discovery.md`
- `history/<feature>/approach.md`
- `history/<feature>/phase-<n>-contract.md`
- `history/<feature>/phase-<n>-story-map.md`
- `history/<feature>/phase-plan.md`
- `.beads/` for this epic

If any are missing, stop and return to `pulse:planning`.

If the bead files do not follow the canonical contract from `pulse:planning/references/bead-template.md`, fix that first.

---

## Phase 0: Schema Gate

Before running the plan-checker, validate the bead schema itself.

Every bead must have:

- `dependencies`
- `files`
- `verify`
- `verification_evidence`
- `testing_mode`
- `decision_refs`
- `learning_refs`

What to do:

1. scan every bead file for the required fields
2. if a field is missing, fail fast
3. normalize the bead immediately or return it to planning for repair

If `testing_mode` is `tdd-required`, the bead must also include `tdd_steps` with distinct red and green commands.

Do not let the plan-checker guess from prose when the schema is missing.

---

## Phase 1: Structural Verification

**Maximum 3 iterations. Nothing advances until this passes.**

### Step 1.1 — Spawn plan-checker

Load `references/plan-checker-prompt.md`. Spawn an isolated subagent with:

```text
Inputs:
- all .beads/*.md for this epic
- history/<feature>/CONTEXT.md
- history/<feature>/discovery.md
- history/<feature>/approach.md
- history/<feature>/phase-<n>-contract.md
- history/<feature>/phase-<n>-story-map.md
- history/<feature>/phase-plan.md
Role: plan-checker
```

The plan-checker verifies 8 dimensions:

1. **Phase contract clarity** — clear entry state, exit state, demo, unlocks
2. **Story coverage and ordering** — each story has a job and the order makes sense
3. **Decision coverage** — locked decisions from `CONTEXT.md` map to stories and beads
4. **Dependency correctness** — graph is valid and acyclic
5. **File scope isolation** — parallel-ready beads do not silently collide
6. **Context budget** — each bead fits in one worker context
7. **Verification completeness** — stories and beads have explicit done/verify criteria
8. **Exit-state completeness and risk alignment** — if everything finishes, the phase really reaches its exit state and HIGH-risk items are spiked

### Step 1.2 — Triage results

**If all 8 dimensions PASS:** proceed to Phase 2.

**If any dimension FAILS:**

1. Fix the specific issue in the relevant artifact
2. Re-run the checker
3. Count that as the next iteration

### Repair routing

- Phase contract unclear -> revise `phase-<n>-contract.md`
- Story order or story scope unclear -> revise `phase-<n>-story-map.md`
- Decision/gap issue -> revise story map and/or beads
- Dependency/scope/test issue -> revise beads
- Exit state not convincingly reachable -> revise contract, story map, or approach

After 3 iterations with any FAIL still present:

- stop
- escalate to the user
- explain which dimension is still failing and why

Do not attempt iteration 4.

---

## Phase 2: Spike Execution

Run this for every HIGH-risk component from `approach.md`.

If no HIGH-risk items exist, skip to Phase 3.

### Step 2.1 — Create spike beads

For every HIGH-risk row in the risk map:

1. read the `component`
2. read the `spike_question`
3. read the `affected_beads`
4. create one spike bead that answers exactly that question

```bash
br create "Spike: <specific yes/no question>" -t task -p 0
```

Immediately normalize the spike bead to the canonical schema:

- `type: spike`
- `spike_question`
- output file under `.spikes/<feature>/<spike-id>/FINDINGS.md`
- explicit `verify` entry that requires a definitive `YES` or `NO`
- `verification_evidence` pointing at `.spikes/<feature>/<spike-id>/FINDINGS.md`
- `testing_mode: standard`

### Step 2.2 — Execute spikes in isolation

For each spike:

1. Spawn an isolated subagent
2. Hard time-box: 30 minutes
3. Write findings to `.spikes/<feature>/<spike-id>/FINDINGS.md`
4. Close with a definitive YES or NO

```bash
br close <id> --reason "YES: <validated approach and constraints>"
# or
br close <id> --reason "NO: <blocker and why it breaks the approach>"
```

### Spike Escalation

If the 30-minute time-box expires without a definitive YES or NO:

1. Present findings so far to the user — what was learned and what remains unknown
2. Offer three options:
   - Extend by 15 minutes (requires explicit user approval)
   - Return to `pulse:planning` with an updated risk assessment incorporating what was learned
   - Proceed with a documented mitigation plan added to the affected beads
3. Never silently exceed the time-box or treat inconclusive results as YES

### Step 2.3 — Act on spike results

**If YES:**

- add the finding summary to the affected beads
- update `phase-<n>-story-map.md` if the story now has tighter constraints
- treat the validated constraint as locked for execution

**If NO:**

- full stop
- write blocker summary into `approach.md`
- return to `pulse:planning`
- re-run validating from Phase 1 after replanning

---

## Phase 3: Bead Polishing

Multiple rounds. Quality compounds here.

### Round 1: Dependency completeness

```bash
bv --robot-suggest
```

If real structural dependencies are missing, add them and re-run.

### Round 2: Graph health

```bash
bv --robot-insights
```

Fix cycles, bottlenecks, disconnected work, and orphaned beads. Re-run if critical findings remain.

### Round 3: Priority sanity

```bash
bv --robot-priority
```

Adjust priorities if the graph says foundational work is buried.

### Deduplication

Read all bead titles and descriptions:

- same story + same file scope + same goal -> likely duplicate
- same outcome expressed as two different beads -> merge or close redundant work

### Fresh-eyes review

Load `references/bead-reviewer-prompt.md` and spawn a subagent with the full bead set.

Use it to catch:

- missing verification evidence
- `testing_mode: tdd-required` without `tdd_steps`
- beads that still require outside context to understand

Fix all CRITICAL flags before moving on. MINOR flags are judgment calls but should be considered carefully.

When asking a model to perform the bead-refinement pass, use this prompt:

```text
Check over each bead super carefully-- are you sure it makes sense? Is it optimal? Could we change anything to make the system work better for users? If so, revise the beads. It's a lot easier and faster to operate in "plan space" before we start implementing these things! Use /effort max.
```

### Story-to-bead coherence check

Before leaving Phase 3, inspect `history/<feature>/phase-<n>-story-map.md`:

- every story should map to at least one bead
- every bead should belong to a story
- if a story has many beads, confirm the decomposition is still coherent and each bead has a clear reason to exist
- if a bead spans multiple unrelated stories, the decomposition is muddy

---

## Phase 4: Exit-State Readiness Review

This is the human-readable readiness check before approval.

Ask these questions explicitly:

1. If all stories reach "Done Looks Like", does the phase exit state hold?
2. If all beads close successfully, will all stories actually be done?
3. Is the phase demo story now credible?
4. Does this phase still make sense in the larger whole plan?

If any answer is "no" or "not sure", do not approve execution. Route back:

- phase meaning problem -> `phase-<n>-contract.md`
- story decomposition problem -> `phase-<n>-story-map.md`
- implementation granularity problem -> `.beads/`
- architecture/risk problem -> `approach.md` and maybe replanning

---

## Phase 5: Final Approval Gate

**This gate is non-negotiable.**

Present a structured summary:

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
- Result: <all passed / concerns listed>

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

Approve execution for this phase? (yes/no)
```

### If user approves

Update `.pulse/STATE.md`:

```text
PHASE: validated
FEATURE: <feature-name>
VALIDATED_AT: <timestamp>
STORIES: <N>
BEADS: <N>
```

Handoff:

- `recommended_mode=swarm` -> `Validation complete. Phase contract, story map, and beads all pass. Invoke pulse:swarming skill.`
- `recommended_mode=single-worker` -> `Validation complete. Phase contract, story map, and beads all pass. Invoke pulse:executing skill.`

### If user rejects

Ask what concerns them specifically and route back:

1. phase meaning / exit state problem
2. story order or story size problem
3. risk/spike concern
4. bead quality problem
5. fundamental approach problem

Do not guess.

---

## Lightweight Mode

For confirmed LOW-risk single-story, single-bead work:

1. abbreviated structural verification on the single story/bead
2. skip spikes
3. run `bv --robot-suggest`
4. still require the final approval gate

If uncertain, use full mode.

---

## Context Budget

If context exceeds 65%, write a validating-owned handoff using the shared envelope and register it in `.pulse/handoffs/manifest.json`.

---

## Red Flags

- executing any bead before approval
- running plan-checker on beads that failed the schema gate
- validating a bead set that has no phase contract
- validating a story map that cannot explain "why now" for Story 1
- a phase exit state that is not observable
- HIGH-risk items have no concrete `spike_question`
- a spike returned NO and execution is still being considered
- a spike answer is not definitive
- spike findings are not fed back into the affected beads
- iteration 4 of structural verification
- a bead's "done" does not clearly connect to any story
- a story that cannot answer "what does this unlock?"
- execution starts without explicit approval

---

## Reference Files

| File | When to Load |
|------|-------------|
| `references/plan-checker-prompt.md` | Phase 1 |
| `references/bead-reviewer-prompt.md` | Phase 3 fresh-eyes review |
