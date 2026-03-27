---
name: pulse:executing
description: Per-agent implementation loop for the Pulse ecosystem. Use in two modes: worker mode under pulse:swarming, or degraded standalone single-worker mode when preflight does not allow a swarm. Implements the bead loop, verification discipline, and safe pause/resume behavior.
metadata:
  version: '1.2'
  ecosystem: pulse
---

# Executing

`pulse:executing` supports two modes:

- worker mode under `pulse:swarming`
- standalone single-worker mode when preflight recommends degraded execution

In both modes, the live bead graph is the source of truth for what to do next.

## Step 1: Initialize

Determine mode from invocation plus `.pulse/tooling-status.json`:

- if invoked by `pulse:swarming`, run in worker mode
- if `recommended_mode=single-worker`, run in standalone mode

Read in this order:

1. `AGENTS.md` if present
2. `.pulse/STATE.md`
3. `history/<feature>/CONTEXT.md`
4. the selected bead file

If the bead references `learning_refs`, read those specific learning files. Do not load all learnings by default.

### Resume

Use owner-scoped handoffs:

- worker mode -> `.pulse/handoffs/worker-<agent>.json`
- standalone mode -> `.pulse/handoffs/single-worker.json`

After restoring context, archive or mark the handoff consumed and update the manifest.

## Step 2: Get the Next Bead

Use the live graph:

```bash
bv --robot-priority
```

Select the top-ranked bead that:

- has no open dependencies
- is not reserved by another worker
- is compatible with the current mode

Read the bead fully before implementing.

Minimum fields to confirm:

| Field | Purpose |
|-------|---------|
| `dependencies` | Upstream bead IDs that must close first |
| `files` | Files/modules in scope for this bead |
| `verify` | Concrete verification commands to run |
| `verification_evidence` | Path to evidence artifact (typically `.pulse/verification/<feature>/<bead-id>.md`) |
| `testing_mode` | `tdd-required` / `test-after` / `no-test` |
| `decision_refs` | Locked decisions from CONTEXT.md relevant to this bead |
| `learning_refs` | Learning file paths to read before implementing |

If any required field is missing, stop and bounce the bead back to validating or planning. Do not guess from free-form prose.

If `testing_mode` is `tdd-required`, confirm `tdd_steps` is present before implementation starts.

## Step 3: Reserve Files

In worker mode, reserve all listed files before editing.

In standalone mode, there is no cross-worker race, but still treat the bead's `files` list as a hard scope boundary. Do not blend multiple beads into one ad hoc change.

If reservation fails in worker mode:

- report the conflict to the coordinator
- wait for resolution

## Step 4: Implement

Before writing:

1. read every file you will modify
2. re-read any `decision_refs` from `CONTEXT.md`
3. re-read any `learning_refs` cited by the bead

Honor locked decisions exactly. Do not improvise around them silently.

Match the codebase's existing patterns unless the bead explicitly says otherwise.

### Selective TDD

Respect the bead's `testing_mode`:

- `standard` -> implement normally, then verify with fresh evidence
- `tdd-required` -> run a real red-green loop before production code closes

For `tdd-required` beads:

1. write or update the smallest failing test that proves the intended behavior
2. run `tdd_steps.red` and confirm it fails for the expected reason
3. only then write the minimal production change
4. rerun `tdd_steps.green` and confirm it passes

If production code was written before the red check, discard or rewrite that portion within the bead scope and restart the loop. Do not claim TDD from memory or intent alone.

## Step 5: Verify

Run the bead's `verify` steps exactly as written.

Verification is not complete until you have fresh evidence from this execution pass.

Read the bead's `verification_evidence` field and update every declared artifact or explicit record there.

The standard artifact path is:

```text
.pulse/verification/<feature>/<bead-id>.md
```

The evidence record must include:

- bead ID and feature name
- `testing_mode`
- verification timestamp
- every `verify` command actually run
- exit code for each command
- concise observed result for each command
- paths to any generated proof artifacts, screenshots, logs, or findings files

If `testing_mode=tdd-required`, also record:

- the `tdd_steps.red` command
- the expected failure signal that was observed
- the `tdd_steps.green` command
- the passing result that was observed

If verification fails:

1. debug the root cause
2. retry up to 2 times
3. if still blocked:
   - worker mode -> notify the coordinator
   - standalone mode -> invoke `pulse:debugging` or surface the blocker to the user

Do not close the bead without a passing verification result and a fresh evidence record.

## Step 6: Close and Report

Always:

1. run a close-readiness check
2. close the bead with `br close`
3. create one atomic git commit per bead
4. release reservations if in worker mode
5. report completion

### Close-Readiness Check

Before `br close`, confirm all are true:

- file edits stayed within the bead's `files` scope, or any expansion was surfaced and approved
- locked decisions in `decision_refs` were re-checked against the final implementation
- all `verify` steps passed in a fresh run
- every declared `verification_evidence` entry is present and substantive
- any `tdd-required` red-green evidence is recorded
- no unresolved blocker, review finding, or failed follow-up is being silently deferred

Worker mode completion report goes to the coordinator.  
Standalone mode completion is recorded in `.pulse/STATE.md`.

Completion reports should include the verification evidence path or paths, the final verification status, and any scoped follow-up that still needs a new bead.

## Step 7: Loop or Pause

After each bead:

- if context is below 65%, loop
- if context is at or above 65%, write the owner handoff file and stop cleanly

### Handoff payloads

Worker mode payload:

- `current_bead`
- `last_bead_closed`
- `reserved_files`
- `verification_state`
- `verification_evidence_paths`

Standalone mode payload:

- `current_bead`
- `completed_beads`
- `blocked_beads`
- `next_priority_hint`
- `verification_evidence_paths`

Register the handoff in `.pulse/handoffs/manifest.json`.

## Red Flags

- executing without reading the bead file fully
- executing a bead that is missing canonical schema fields
- modifying files outside the bead's `files` scope without surfacing it
- skipping `verify`
- claiming success from stale or partial verification output
- closing a bead without a substantive `verification_evidence` record
- claiming `tdd-required` was satisfied without a real red failure and green pass
- bundling multiple beads into one commit
- reading the entire learnings corpus instead of the bead's cited learning refs
- writing the retired global handoff file
