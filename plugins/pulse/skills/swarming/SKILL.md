---
name: pulse:swarming
description: Orchestrates parallel worker agents for phase execution. Use after the pulse:validating skill approves the current phase for execution. Initializes the coordinator runtime, spawns bounded workers, monitors coordination, resolves blockers, and hands off either to planning for the next phase or to reviewing after the final phase. The orchestrator TENDS — it never implements beads directly.
metadata:
  version: '1.1'
  ecosystem: pulse
  role: orchestrator
---

# Swarming

You are the orchestrator. You launch workers, monitor the graph, resolve coordination issues, and keep the swarm moving.

You do not implement beads directly.

## Communication Standard

Blocker reports, conflict reports, and handoffs should be written so a busy teammate can understand them in one read.

Prefer:

- what is blocked
- what is happening right now
- one concrete example of the collision or failure
- what needs to happen next

Do not hide the real issue behind labels like "reservation conflict", "startup drift", or "runtime blocker" without explaining the practical effect.

## When to Use

Invoke only if all are true:

- `pulse:validating` has approved execution
- Current-phase beads are in `open` status and approved for execution
- `.pulse/tooling-status.json` says `recommended_mode=swarm`
- the coordination runtime is actually available

If preflight recommends `single-worker`, do not invoke this skill. Invoke `pulse:executing` directly instead.

Read `references/runtime-adapter-spec.md` before adapting these instructions to a concrete runtime.

## Phase 1: Confirm Swarm Readiness

1. Read `.pulse/tooling-status.json`
2. Read `.pulse/STATE.md`
3. Identify the current epic or feature bead root
4. Run a live graph check:

```bash
bv --robot-triage --graph-root <EPIC_ID>
```

Confirm:

- open executable work exists
- no validation blockers remain
- dependencies are sane

## Phase 2: Initialize the Coordination Runtime

Use the smallest runtime primitives that preserve these behaviors:

- register the project
- register the coordinator identity
- create or reuse the epic thread
- support worker-to-coordinator messaging
- support file reservation or an equivalent lock primitive

Canonical architecture terms:

- `ensure_project`
- `register_agent`
- `send_message`
- `fetch_inbox`
- `fetch_topic`
- `file_reservation_paths`

If the real runtime uses different names, keep the behavior, not the spelling.

## Phase 3: Spawn Workers

Spawn bounded workers that immediately load `pulse:executing`.

Provide each worker:

- coordinator identity
- epic ID and feature name
- project key
- startup hint only if genuinely useful
- task-scoped context by default

Do not assign permanent tracks or permanent file ownership.
Workers must self-route from the live bead graph.

Use `references/worker-template.md`.

## Phase 4: Tend the Swarm

Monitor:

- worker startup acknowledgments
- completion reports
- blocker alerts
- file conflict requests
- quiet periods that indicate drift or stalls

Re-check the graph regularly:

```bash
bv --robot-triage --graph-root <EPIC_ID>
```

### Coordinator responsibilities

- acknowledge real completion
- resolve or escalate blockers quickly — for persistent blockers, invoke `pulse:debugging` to investigate root cause before restarting the worker
- prevent silent file conflicts
- rebroadcast new locked decisions or corrections
- keep `.pulse/STATE.md` current

### Context checkpoint

If context exceeds 65%:

1. write `.pulse/handoffs/coordinator.json`
2. register it in `.pulse/handoffs/manifest.json`
3. post a pause notice on the epic thread
4. stop cleanly

Do not write the retired global handoff file.

### Worker Monitoring Checklist

Every monitoring cycle, check:

- **Queue balance**: if any worker has 0 beads remaining while others have 2+, rebalance
- **Stall detection**: no progress from a worker in 2+ cycles — ping, check for blockers, or restart
- **File conflicts**: two workers touching the same file — pause one and re-sequence the beads
- **Completion rate**: if < 50% beads closed after 60% elapsed time, escalate to the user
- **Blocker accumulation**: if 2+ workers report blockers on the same subsystem, pause the swarm and return to planning

## Phase 5: Swarm Complete

When no current-phase beads remain in progress and the live graph shows no executable work left for this phase:

1. run a final graph check
2. confirm all current-phase swarm-created work is closed or intentionally deferred
3. update `.pulse/STATE.md`
4. clear the active worker list
5. inspect `history/<feature>/phase-plan.md` and `.pulse/STATE.md`
6. determine whether more phases remain:

If more phases remain:

```
Active skill: swarming -> COMPLETE
Swarm: <EPIC_ID> - current phase complete
Next: planning for Phase <n+1>
```

Hand off with: "Swarm execution complete for the current phase. Return to pulse:planning to prepare the next phase."

If this was the final phase:

```
Active skill: swarming -> COMPLETE
Swarm: <EPIC_ID> - final phase complete
Next: reviewing
```

Hand off with: "Swarm execution complete for the final phase. Invoke pulse:reviewing skill."

## Red Flags

- orchestrator edits source code
- workers stop self-routing and start freelancing
- the same file conflict repeats without decomposition changes
- workers are idle while ready work exists
- swarm is attempted while preflight recommended `single-worker`

## References

- `references/worker-template.md`
- `references/message-templates.md`
- `references/runtime-adapter-spec.md`
