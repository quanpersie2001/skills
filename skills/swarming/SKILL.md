---
name: swarming
description: Use after pulse:validating approves execution and swarm mode is recommended, when the current phase should be run by coordinated parallel workers.
metadata:
  version: '1.3'
  ecosystem: pulse
  role: orchestrator
  dependencies:
    - id: beads-cli
      kind: command
      command: br
      missing_effect: unavailable
      reason: Swarming assigns and tracks beads through br.
    - id: beads-viewer
      kind: command
      command: bv
      missing_effect: degraded
      reason: Swarming inspects the live bead graph with bv.
---

# Swarming

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

## Role Boundary — Read First

You are the **ORCHESTRATOR**. You launch workers, monitor coordination, handle escalations, and keep the swarm moving. You do NOT implement beads. If you find yourself editing source files, stop immediately — that is the `pulse:executing` skill's job.

- **swarming** = launches and tends workers (this skill)
- **executing** = each worker's self-routing implementation loop

## Hard Rule — Active Swarm Never Idles

If workers are spawned, online, busy, blocked, or expected to report, you are not in a waiting phase. You are in a tending phase.

While the swarm is active, you must keep looping through the active coordination surface and the live bead graph. Do not stop and wait for user direction just because updates are quiet. Silence is work for the orchestrator:
- inspect worker follow-ups
- inspect the live graph
- send reminders
- resolve conflicts
- escalate only when the next move truly requires human judgment

User escalation is for real product decisions, unresolved blockers, or persistent worker silence after you have already tried to recover the swarm through the active coordination surface.

## Communication Standard

Blocker reports, conflict reports, and handoffs should be written so a busy teammate can understand them in one read.

Prefer:

- what is blocked
- what is happening right now
- one concrete example of the collision or failure
- what needs to happen next

Do not hide the real issue behind labels like `reservation conflict`, `startup drift`, or `runtime blocker` without explaining the practical effect.

## When to Use

Invoke only if all are true:

- `pulse:validating` has approved execution
- current-phase beads are in `open` status and approved for execution
- `.pulse/tooling-status.json` says `recommended_mode=swarm`
- the active CLI exposes a real native swarm path for this session
- if `.codex/pulse_status.mjs` exists, run `node .codex/pulse_status.mjs --json` first to confirm onboarding, current phase, reservations, and any saved handoff before launching the swarm

If preflight recommends `single-worker`, do not invoke this skill. Invoke `pulse:executing` directly instead.

Read `references/runtime-adapter-spec.md` before adapting these instructions to a concrete runtime.

---

## Phase 1: Confirm Swarm Readiness

1. Read `.pulse/tooling-status.json`
2. Read `.pulse/state.json` if present, then `.pulse/STATE.md`
3. Identify the current epic or feature bead root
4. Run a live graph check:

```bash
bv --robot-triage --graph-root <EPIC_ID>
```

Confirm:

- open executable work exists
- no validation blockers remain
- dependencies are sane

Update `.pulse/state.json` and `.pulse/STATE.md` with current swarm intent and epic ID.

---

## Phase 2: Initialize the Coordination Surface

Use the smallest runtime primitives that preserve these behaviors:

- spawn workers
- deliver startup context
- observe worker progress
- send coordinator follow-ups
- receive worker reports
- prevent overlapping file edits through the shared reservation helper
- write and restore owner-scoped handoffs

Adapter mapping:

### Claude Code

- use `TeamCreate` when explicit teammate coordination helps
- use `Agent` to spawn bounded workers
- use `SendMessage` for coordinator ↔ worker follow-ups
- use `Task*` only as optional runtime metadata, never as the work graph

### Codex

- use the native subagent spawn path
- use parent-thread follow-ups as the coordination surface
- keep bead selection and handoffs in the shared Pulse artifacts

Shared rules:

- beads plus `bv` stay the source of truth for work selection
- `.codex/pulse_reservations.mjs` is the file-coordination layer for every runtime
- `.pulse/STATE.md`, `.pulse/state.json`, and `.pulse/handoffs/` stay authoritative for pause/resume
- do not invent extra registration, inbox, or topic mechanics when the runtime does not use them

Post the swarm start notification on the active coordination surface using `references/swarming-appendix.md`.

That coordination surface is where workers report startup acknowledgments, completions, blockers, conflicts, handoffs, and receive overseer broadcasts.

---

## Phase 3: Spawn Workers

Spawn bounded workers that immediately load `pulse:executing`.

Provide each worker:
- `runtime_identity`
- `coordinator_identity`
- `adapter_name`
- `epic_id`
- `feature_name`
- optional `startup_hint`
- scoped task-specific context by default; full parent-context inheritance only when explicitly needed

Do not invent worker identities locally. Use the identity returned by the runtime's worker-spawn primitive.

Do **not** assign workers fixed tracks, fixed waves, or fixed bead lists as the normal case. Workers are expected to:
1. read `AGENTS.md` and project context
2. load `pulse:executing`
3. post an `[ONLINE]` acknowledgment
4. run `bv --robot-priority`
5. reserve bead paths through `.codex/pulse_reservations.mjs`
6. implement and report
7. loop

Mark spawned workers in `.pulse/STATE.md` under `## Active Workers` immediately after each spawn result.

Use one line per worker:

`- Runtime: <runtime-identity> | Adapter: <adapter-name> | Status: spawned | Current bead: -`

The worker startup acknowledgment later updates the same line to `online`.

Use the worker prompt template in `references/swarming-appendix.md`.

---

## Phase 4: Monitor + Tend

The swarm is live; now you manage it.

Run a poll-act-repeat loop for as long as any of these are true:
- a worker is `spawned`, `online`, `busy`, or `blocked`
- a worker owes a startup acknowledgment, completion report, blocker alert, or handoff
- `bv --robot-triage --graph-root <EPIC_ID>` still shows ready or in-progress work

Every loop cycle must do all of the following:

1. Inspect every new worker update on the active coordination surface
2. Update `.pulse/STATE.md` to reflect the latest worker status
3. Reply, remind, or coordinate immediately when a worker is blocked or waiting
4. Re-run the live graph check when a bead closes, a blocker clears, a worker goes silent, or the coordination surface looks stale
5. Refresh reservation state when a conflict, release, or stalled worker could affect file ownership

Use live graph checks for oversight, not assignment:

```bash
bv --robot-triage --graph-root <EPIC_ID>
```

Do not park in passive wait mode while the swarm is active. If updates are quiet, you still keep tending until the swarm is complete or a real human decision is needed.

### Worker Event Handling

Treat worker events as protocol-driven, not ad hoc. The canonical protocol, required fields, and coordinator message bodies are in `references/swarming-appendix.md`.

Minimum coordinator obligations per cycle:
1. Validate incoming event shape against the contract.
2. Update the worker entry in `.pulse/STATE.md` keyed by runtime identity.
3. Verify bead-state transitions in `br`/`bv` before acknowledging completion.
4. Resolve reservations through `.codex/pulse_reservations.mjs` before permitting overlapping edits.
5. Escalate to the user when blockers require product judgment or a worker stays silent through the appendix silence ladder.

### Context Checkpoint

After each significant event, estimate your own context budget.

**If context >65% used:**
1. Write `.pulse/handoffs/coordinator.json` using the shared handoff envelope from `../using-pulse/references/handoff-contract.md`.
2. Register it in `.pulse/handoffs/manifest.json` using the same `summary`, `next_action`, and path.
3. Broadcast a pause notification on the active coordination surface that includes the rendered handoff summary, resume briefing, and transfer block highlights sourced from that JSON.
4. If `.pulse/checkpoints/<feature>/...` is in use, capture or refresh the feature checkpoint before leaving the swarm pause boundary.
5. Report to the user that the orchestrator paused safely and how to resume.
6. Do NOT abandon the swarm without writing the handoff.

The coordinator handoff must follow the same companion contract as planning/executing/validating:
- `summary` -> short orchestrator handoff headline
- `next_action` + `read_first` -> resume briefing for the next swarm turn
- `payload.transfer` -> detailed transfer block for live worker state, blockers, and restart notes

Do not write the retired global handoff file.

---

## Phase 5: Swarm Complete

When no current-phase beads remain `in_progress` and the graph shows no remaining executable work for the current phase:

1. Run final bead verification:
   ```bash
   bv --robot-triage --graph-root <EPIC_ID>
   ```
2. If orphaned or blocked beads remain:
   - report which beads remain and why
   - ask the user whether to defer, create cleanup beads, or continue later
3. If all current-phase beads are closed:
   - run final build/test commands appropriate to the project
   - clear `## Active Workers` from `.pulse/STATE.md`
   - inspect `history/<feature>/phase-plan.md` and `.pulse/STATE.md`
   - if more phases remain:
     ```
     Active skill: swarming -> COMPLETE
     Swarm: <EPIC_ID> - current phase complete
     Next: planning for Phase <n+1>
     ```
   - if this was the final phase:
     ```
     Active skill: swarming -> COMPLETE
     Swarm: <EPIC_ID> - final phase complete
     Next: reviewing
     ```

4. Handoff message:
   - if more phases remain:
     > "Swarm execution complete for the current phase. Return to `pulse:planning` to prepare the next phase."
   - if this was the final phase:
     > "Swarm execution complete for the final phase. Invoke `pulse:reviewing`."

---

## Red Flags

Stop and diagnose before continuing if you see:

- **Worker implements multiple beads at once** — self-routing does not mean parallelizing within one worker
- **Orchestrator edits source files** — role violation
- **Workers are idle but ready beads exist** — inspect the active coordination surface, inspect the graph, and recover the swarm instead of waiting for the user
- **No coordination activity for >5 poll cycles while work remains** — workers may be stuck, off-thread, or context-exhausted; run the silence ladder
- **The same file conflict repeats** — bead decomposition may be too coarse; escalate
- **Workers stop using `bv --robot-priority` and start freelancing** — re-broadcast the execution contract
- **Build/test failures accumulate without intervention** — create fix beads or stop and escalate
- **Swarm is attempted while preflight recommended `single-worker`** — stop and use standalone executing

---

## Reference Files

Load when needed:

| File | Load When |
|---|---|
| `references/swarming-appendix.md` | Worker startup template, message protocol, silence ladder, and coordinator handoff contract |
| `references/runtime-adapter-spec.md` | Adapting canonical swarm behaviors to a concrete runtime |
| `docs/evaluation/pulse-swarming-hardening.md` | Re-running RED/GREEN pressure tests for swarm coordination behavior |
