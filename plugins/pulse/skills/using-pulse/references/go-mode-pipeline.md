# Go Mode Pipeline

Load this file when running Pulse end-to-end.

## Overview

Go mode is the full Pulse pipeline from raw feature request to compounded learnings. It always starts with preflight and always has exactly 3 human gates.

```text
User: "/go <feature>"
  -> preflight
  -> using-pulse
  -> exploring
  -> [GATE 1: approve CONTEXT.md]
  -> planning
  -> validating
  -> [GATE 2: approve execution]
  -> swarming + executing xN
     OR executing(single-worker)
  -> reviewing
  -> [GATE 3: approve merge]
  -> compounding
  -> done
```

## Runtime Branch

Read `.pulse/tooling-status.json` after preflight:

- `recommended_mode=swarm` -> use `pulse:swarming`, then worker `pulse:executing`
- `recommended_mode=single-worker` -> skip `pulse:swarming`, invoke `pulse:executing` directly
- `recommended_mode=planning-only` -> stop before execution
- `recommended_mode=blocked` -> stop entirely

## Step 0: Preflight

Run `pulse:preflight`.

Outputs:

- `.pulse/tooling-status.json`
- `.pulse/STATE.md`
- optional resume notice via `.pulse/handoffs/manifest.json`

Do not enter the rest of Go mode until preflight returns `PASS` or `DEGRADED`.

## Step 1: Exploring

Invoke `pulse:exploring`.

Output:

- `history/<feature>/CONTEXT.md`

Update state:

```text
phase: go-mode/gate-1
```

## Gate 1: Approve CONTEXT.md

Hard stop. Do not proceed until the user approves the locked decisions.

Present:

- feature name
- number of locked decisions
- up to 5 key decisions
- any unresolved questions

If approved -> continue to planning.  
If not -> loop back to exploring.

## Step 2: Planning

Invoke `pulse:planning`.

Inputs:

- `history/<feature>/CONTEXT.md`
- `history/learnings/critical-patterns.md` if present

Outputs:

- `history/<feature>/discovery.md`
- `history/<feature>/approach.md`
- canonical bead files

Important planning contract:

- every HIGH-risk item must define a concrete `spike_question`
- planners do not create spike beads
- planners embed relevant learnings into bead descriptions

## Step 3: Validating

Invoke `pulse:validating`.

Inputs:

- bead files
- `CONTEXT.md`
- `discovery.md`
- `approach.md`

Validating responsibilities:

- run the plan-checker loop
- confirm bead schema and graph health
- materialize spike beads from `spike_question`
- execute spikes
- embed spike findings back into the affected beads

If a spike returns `NO`, stop and go back to planning.

If execution or debugging reveals that the issue is no longer a local bug but an architectural mismatch, pause the pipeline and send the work back to `pulse:planning` or `pulse:validating` before continuing.

Update state:

```text
phase: go-mode/gate-2
```

## Gate 2: Approve Execution

Hard stop. Present:

- bead count
- HIGH-risk items
- spike results
- unresolved concerns, if any
- execution mode: `swarm` or `single-worker`

If approved -> continue.  
If not -> loop back to planning or validating as needed.

## Step 4A: Swarm Execution

Use this branch only if preflight recommends `swarm`.

Invoke `pulse:swarming`, which launches worker agents that load `pulse:executing`.

Coordinator responsibilities:

- keep the epic thread alive
- resolve blockers and reservation conflicts
- write `.pulse/handoffs/coordinator.json` if paused

Worker responsibilities:

- self-route from the live bead graph
- reserve files before editing
- implement, verify, write evidence, close, report
- write `.pulse/handoffs/worker-<agent>.json` if paused

## Step 4B: Single-Worker Execution

Use this branch only if preflight recommends `single-worker`.

Invoke `pulse:executing` directly in standalone mode.

Responsibilities:

- self-route from the live bead graph
- execute one bead at a time
- write `.pulse/verification/<feature>/<bead-id>.md` or the declared evidence artifacts before closing a bead
- write `.pulse/handoffs/single-worker.json` if paused

If `pulse:debugging` escalates the work back to planning or validating, stop execution cleanly and hand the blocker off rather than forcing another patch.

## Step 5: Reviewing

Invoke `pulse:reviewing`.

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
phase: go-mode/gate-3
```

## Gate 3: Approve Merge

Hard stop. Never auto-merge.

Present:

- P1 count
- P2 count
- P3 count
- any open UAT failures

If P1 exists, merge is blocked until the user chooses a fix path.

## Step 6: Compounding

Invoke `pulse:compounding`.

Output:

- durable learning entries under `history/learnings/`

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
