# Go Mode Pipeline

Load this file when running Pulse end-to-end.

> Source patterns: CE `/lfg` + `/slfg`, GSD phase loop with plan-checker and verifier, Pulse architecture v2.

## Overview

Go mode is the full Pulse pipeline from raw feature request to merged, compounded learnings. It always starts with preflight and always has exactly 4 human gates. The pipeline is designed so that each gate protects the next irreversible commitment.

```text
User: "/go <feature>"
       |
       v
[BOOTSTRAP] preflight -> using-pulse -> check state, read critical-patterns.md
       |
       v
[STEP 1] exploring
       | Output: history/<feature>/CONTEXT.md
       |
       v
[GATE 1] <- HARD STOP: "Approve CONTEXT.md?"
       |
       v
[STEP 2] planning (whole feature)
       | Output: discovery.md, approach.md, phase-plan.md
       |
       v
[GATE 2] <- HARD STOP: "Approve phase-plan.md?"
       |
       v
[STEP 3] planning (current phase prep)
       | Output: phase-<n>-contract.md, phase-<n>-story-map.md, current-phase beads
       |
       v
[STEP 4] validating (current phase)
       | Plan-checker (<=3x) + spikes + bead polish
       |
       v
[GATE 3] <- HARD STOP: "Current phase verified. Approve execution?"
       |
       v
[STEP 5] swarming -> executing (xN workers)
       | Current phase only
       |
       |-- if later phases remain -> return to STEP 3 for the next phase
       |
       v
[STEP 6] reviewing (after final phase only)
       | 5 parallel review agents -> P1/P2/P3 findings
       | Artifact verification + human UAT
       |
       v
[GATE 4] <- HARD STOP: "Approve merge?"
       |
       v
[STEP 7] compounding
       | Capture learnings -> history/learnings/
       |
       v
DONE
```

## Runtime Branch

Read `.pulse/tooling-status.json` after preflight:

- `recommended_mode=swarm` -> use `pulse:swarming`, then worker `pulse:executing`
- `recommended_mode=single-worker` -> skip `pulse:swarming`, invoke `pulse:executing` directly
- `recommended_mode=planning-only` -> stop before execution
- `recommended_mode=blocked` -> stop entirely

---

## Step 0: Preflight

Run `pulse:preflight`.

Outputs:

- `.pulse/tooling-status.json`
- `.pulse/STATE.md`
- optional resume notice via `.pulse/handoffs/manifest.json`

Do not enter the rest of Go mode until preflight returns `PASS` or `DEGRADED`.

---

## Step 1: Exploring

Invoke `pulse:exploring`.

Output:

- `history/<feature>/CONTEXT.md`

Update state:

```text
phase: go-mode/gate-1
```

---

## Gate 1: Approve CONTEXT.md

Hard stop. Do not proceed until the user approves the locked decisions.

Present:

- feature name
- number of locked decisions
- up to 5 key decisions
- any unresolved questions

If approved -> continue to planning.
If not -> loop back to exploring.

---

## Step 2: Planning (Whole Feature)

Invoke `pulse:planning`.

Inputs:

- `history/<feature>/CONTEXT.md`
- `history/learnings/critical-patterns.md` if present

**The first planning pass will:**

- retrieve learnings
- run discovery
- synthesize an approach
- write `history/<feature>/phase-plan.md`
- show the full phase breakdown in plain English

**Important:** this step does **not** create beads yet.

Update state:

```text
phase: go-mode/gate-2
```

---

## Gate 2: Approve phase-plan.md

Hard stop. Do not proceed until the user approves the phase/story shape.

Present:

- feature name
- proposed phases with real-world outcomes
- stories inside each phase
- which phase will be prepared first

If approved -> continue to current-phase preparation.
If not -> return to the planning pass that owns `phase-plan.md`.

---

## Step 3: Planning (Current Phase Prep)

Invoke `pulse:planning` again in current-phase preparation mode.

Inputs:

- approved `phase-plan.md`
- `approach.md`
- `CONTEXT.md`

**The second planning pass will:**

- select the current phase from `phase-plan.md`
- write `history/<feature>/phase-<n>-contract.md`
- write `history/<feature>/phase-<n>-story-map.md`
- create beads only for that phase

**Rules:**

- default to the first unprepared phase
- never create later-phase beads early
- every bead must include `Phase <n>` and `Story <m>` context

Important planning contract:

- every HIGH-risk item must define a concrete `spike_question`
- planners do not create spike beads
- planners embed relevant learnings into bead descriptions

Update state:

```text
phase: go-mode/validating
```

---

## Step 4: Validating (Current Phase)

Invoke `pulse:validating`.

Inputs:

- current phase beads
- `phase-plan.md`
- current phase contract/story map
- `approach.md`
- `CONTEXT.md`

Validating responsibilities:

- run the plan-checker loop (<=3 iterations, 8 dimensions)
- confirm bead schema and graph health
- materialize spike beads from `spike_question`
- execute spikes
- embed spike findings back into the affected beads

If a spike returns `NO`, stop and go back to planning.

If execution or debugging reveals that the issue is no longer a local bug but an architectural mismatch, pause the pipeline and send the work back to `pulse:planning` or `pulse:validating` before continuing.

Update state:

```text
phase: go-mode/gate-3
```

---

## Gate 3: Approve Current-Phase Execution

Hard stop. This is the most critical gate.

Present:

- current phase name and number
- bead count
- HIGH-risk items
- spike results
- unresolved concerns, if any
- execution mode: `swarm` or `single-worker`

If approved -> continue.
If not -> loop back to planning or validating as needed.

---

## Step 5: Swarming + Executing (Current Phase)

Use `pulse:swarming` if preflight recommends `swarm`, otherwise invoke `pulse:executing` directly.

**The swarming skill will:**

- initialize the coordination runtime
- spawn workers for the current phase bead set
- monitor current-phase execution
- verify current-phase beads closed

### Phase loop rule

After current-phase execution completes:

- if `phase-plan.md` shows later phases still pending -> return to Step 3 for the next phase
- if the current phase was the final phase -> proceed to Step 6

Update state: either `phase: go-mode/planning-next-phase` or `phase: go-mode/reviewing`

---

## Step 6: Reviewing

Invoke `pulse:reviewing` only after the final phase swarm completes.

Review model:

- agents 1-4 are specialist reviewers
- agent 5 is the final synthesizer and always runs last
- review remains mandatory in both normal and quick mode

Outputs:

- review beads
- artifact verification result
- UAT result

Update state:

```text
phase: go-mode/gate-4
```

---

## Gate 4: Approve Merge

Hard stop. Never auto-merge.

Present:

- P1 count
- P2 count
- P3 count
- any open UAT failures

If P1 exists, merge is blocked until the user chooses a fix path.

If fix beads are created, execute them and re-run reviewing before presenting Gate 4 again.

---

## Step 7: Compounding

Invoke `pulse:compounding`.

Output:

- durable learning entries under `history/learnings/`

---

## Fallback Paths

### If exploring produces a CONTEXT.md the user rejects at GATE 1

```text
-> Identify which decisions need revision
-> Load pulse:exploring skill, focus on those specific gray areas
-> Update CONTEXT.md in place
-> Re-present GATE 1
```

### If the user rejects phase-plan.md at GATE 2

```text
-> Identify which phase names, boundaries, or stories feel wrong
-> Return to the whole-feature planning pass
-> Update phase-plan.md
-> Re-present GATE 2
```

### If validating fails after 3 plan-checker iterations

```text
-> Present failing dimensions to user
-> Ask: "Return to planning with these specific concerns?"
-> Load planning with the failure report as context
-> Re-run validating after the current phase is re-prepared
```

### If a spike fails

```text
-> STOP: do not proceed to GATE 3
-> Present: "Spike [id] failed: [reason]. Current phase is blocked."
-> Options: (a) Revise approach, (b) Descope the risky part, (c) Re-split phase boundaries
-> If revise: return to planning and then re-run validating
```

### If orchestrator context hits 65% mid-swarm

```text
-> Write handoff via .pulse/handoffs/coordinator.json and update manifest
-> Present: "Context budget reached. Current phase swarm paused.
            [X] beads complete, [Y] in flight.
            Resume in a new session."
-> End turn gracefully
```

### If P1 findings are present at GATE 4 and the user wants to fix

```text
-> Create fix beads via br create for each P1 finding
-> Load pulse:swarming skill (fix-bead swarm only)
-> After execution: re-run reviewing (targeted - fixes diff only)
-> Re-present GATE 4
-> Repeat until P1 = 0 or user explicitly overrides
```

---

## Pause and Resume

All pause flows use the handoff contract:

- `.pulse/handoffs/manifest.json`
- owner-scoped handoff files

Do not write or read the retired global handoff file.

When resuming:

1. run preflight if tooling may have changed
2. load `pulse:using-pulse`
3. read the manifest
4. resume the selected owner

---

## Quick Mode Pipeline (Reference)

For small fixes (<=3 files, LOW risk, no gray areas):

```text
planning (lightweight)
  -> one-phase plan
  -> approval gate
  -> one current-phase bead
  -> no multi-model refinement
  |
validating (lightweight)
  -> abbreviated structural verification
  -> skip spikes (LOW risk)
  -> bv check only
  |
swarming -> executing (single worker)
  |
reviewing (optional)
  -> skip if truly trivial
  |
compounding (only if lesson learned)
```

---

## Design Rationale

**Why 4 gates, not 3?**

Because the phase breakdown itself is now a first-class human decision. `CONTEXT.md` locks intent, `phase-plan.md` locks the feature shape, validating locks execution-readiness for the current phase, and reviewing locks merge-readiness.

**Why is GATE 3 the most critical?**

Execution is the only phase that creates source-code side effects. A broken current phase discovered post-execution costs far more to fix than one caught in validating.

**Why does planning now happen in two passes?**

Because "show me the whole shape" and "prepare one phase for execution" are different jobs. Combining them made phase/story explanations too abstract and pushed bead creation earlier than users wanted.

**What tone should the model use at every gate?**

Concrete and scenario-first. At every gate, the model should explain:

1. what becomes true or what is wrong
2. what the system does today
3. why that matters
4. one realistic example
5. what approval or change is needed next

Gate summaries should not rely on reviewer shorthand or planner jargon alone.
