---
name: pulse:swarming
description: Orchestrates parallel worker agents for phase execution. Use after the pulse:validating skill approves the current phase for execution. Initializes the coordinator runtime, spawns bounded worker subagents, monitors coordination for completions/blockers/file conflicts, coordinates rescues and course corrections, and hands off either to planning for the next phase or to reviewing after the final phase. The orchestrator TENDS — it never implements beads directly.
metadata:
  version: '1.2'
  ecosystem: pulse
  role: orchestrator
---

# Swarming

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

## Role Boundary — Read First

You are the **ORCHESTRATOR**. You launch workers, monitor coordination, handle escalations, and keep the swarm moving. You do NOT implement beads. If you find yourself editing source files, stop immediately — that is the pulse:executing skill's job.

- **swarming** = launches and tends workers (this skill)
- **executing** = each worker's self-routing implementation loop

## Hard Rule — Active Swarm Never Idles

If workers are spawned, online, busy, blocked, or expected to report, you are not in a waiting phase. You are in a tending phase.

While the swarm is active, you must keep looping through the coordination runtime and the live bead graph. Do not stop and wait for user direction just because the thread is quiet. Silence is work for the orchestrator:
- poll inboxes
- inspect the epic timeline
- send reminders
- resolve conflicts
- escalate only when the next move truly requires human judgment

User escalation is for real product decisions, unresolved blockers, or persistent worker silence after you have already tried to recover the swarm through the coordination runtime.

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

---

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

Update `.pulse/STATE.md` with current swarm intent and epic ID.

---

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

Define an epic topic tag:

```
EPIC_TOPIC="epic-<EPIC_ID>"
```

Bootstrap the epic coordination thread by sending the first message:

```
send_message(
  project_key="<project-root-path>",
  sender_name="<COORDINATOR_AGENT_NAME>",
  to=["<COORDINATOR_AGENT_NAME>"],
  subject="[SWARM START] <feature-name>",
  body_md="Swarm initialized for epic <EPIC_ID> ...",
  thread_id="<EPIC_ID>",
  topic="<EPIC_TOPIC>"
)
```

Template: see `references/message-templates.md` → **Spawn Notification**.

The epic thread is the coordination surface for:
- worker startup acknowledgments
- completion reports
- blocker alerts
- file conflict requests
- context handoffs
- overseer broadcasts

---

## Phase 3: Spawn Workers

Spawn bounded workers that immediately load `pulse:executing`.

```
Subagent(
  identity="Worker: <runtime-nickname>",
  context=<scoped worker context from references/worker-template.md>
)
```

`Subagent(...)` is the canonical contract. In an actual runtime, call whatever worker-spawn primitive is available, but preserve the same behavior: the orchestrator stays in control, each worker gets bounded scope by default, and workers report back through the coordination runtime plus the live bead graph.

Worker bootstrap is a two-step runtime handshake:

1. Call the runtime spawn primitive for the worker.
2. Capture the returned runtime nickname from the spawn result.
3. Immediately send follow-up startup context to that worker with:
   - `runtime_nickname`
   - `project_key`
   - `epic_id`
   - `epic_topic`
   - `feature_name`
   - `coordinator_agent_name`
   - optional `startup_hint`
4. Only after that follow-up arrives may the worker register its session with the coordination runtime.

Do not invent worker names locally. The parent runtime result is the source of truth for the runtime nickname.

Provide each worker:
- Runtime nickname plus the bootstrap context needed to resolve its Agent Mail identity
- Feature name / epic ID
- Instruction to load the `pulse:executing` skill immediately
- Optional startup hint if there is an urgent ready bead, clearly labeled as a hint rather than an assignment
- Scoped task-specific context by default; full parent-context inheritance only when explicitly needed

Do **not** assign workers fixed tracks, fixed waves, or fixed bead lists as the normal case. Workers are expected to:
1. register
2. read `AGENTS.md` and project context
3. post a startup acknowledgment with both identities
4. fetch inbox updates
5. call `bv --robot-priority`
6. reserve files
7. implement and report
8. loop

Mark spawned workers in `.pulse/STATE.md` under `## Active Workers` immediately after each spawn result.

Use one line per worker:

`- Runtime: <runtime-nickname> | Agent Mail: pending | Status: spawned | Current bead: -`

The worker startup acknowledgment will later replace `pending` with the resolved Agent Mail name returned by the coordination runtime session registration.

Use `references/worker-template.md`.

---

## Phase 4: Monitor + Tend

The swarm is live; now you manage it.

Run a poll-act-repeat loop for as long as any of these are true:
- a worker is `spawned`, `online`, `busy`, or `blocked`
- a worker owes a startup acknowledgment, completion report, blocker alert, or handoff
- `bv --robot-triage --graph-root <EPIC_ID>` still shows ready or in-progress work

Every loop cycle must do all of the following:

```
fetch_inbox(
  project_key="<project-root-path>",
  agent_name="<COORDINATOR_AGENT_NAME>",
  topic="<EPIC_TOPIC>"
)
fetch_topic(
  project_key="<project-root-path>",
  topic_name="<EPIC_TOPIC>"
)
```

Then:
1. Process every new worker message before moving on
2. Update `.pulse/STATE.md` to reflect the latest worker status
3. Reply, remind, or coordinate immediately when a worker is blocked or waiting
4. Re-run the live graph check when a bead closes, a blocker clears, a worker goes silent, or the thread state looks stale

Use live graph checks for oversight, not assignment:

```bash
bv --robot-triage --graph-root <EPIC_ID>
```

Do not park in passive wait mode while the swarm is active. If the thread is quiet, you still keep polling and tending until the swarm is complete or a real human decision is needed.

### Worker Startup Acknowledgments

When a worker posts an online message:
1. Confirm it joined the correct epic thread
2. Confirm it reports both the runtime nickname and resolved Agent Mail name
3. Confirm it explicitly says `AGENTS.md` was read
4. Confirm it is loading `pulse:executing`
5. Confirm the worker's next step is `fetch_inbox(...)`, then `bv --robot-priority`
6. Update the matching `.pulse/STATE.md` worker entry from:
   `Runtime: <nickname> | Agent Mail: pending | Status: spawned | Current bead: -`
   to:
   `Runtime: <nickname> | Agent Mail: <resolved-name> | Status: online | Current bead: -`

If a worker does not post a startup acknowledgment:
1. After 2 poll cycles: send a direct reminder telling the worker to re-read `AGENTS.md`, post `[ONLINE]`, and fetch inbox
2. After 3 silent poll cycles: mark the worker `stalled-startup` in `.pulse/STATE.md` and send a second reminder
3. After 5 silent poll cycles with ready work remaining: escalate to the user with the specific worker name, current graph state, and recovery attempts already made

### Bead Completion Reports

When a worker posts a completion report:
1. Verify the bead is actually closed: `br status <bead-id>`
2. Acknowledge receipt on the thread
3. Confirm the report includes the bead ID, both worker identities, verification summary, and commit hash
4. Update `.pulse/STATE.md` using the existing worker entry keyed by runtime nickname
5. Re-check the graph to see what newly unblocked

### Blocker Alerts

When a worker posts a blocker alert:
1. Assess severity:
   - **Resolvable with existing context:** reply on the thread
   - **Needs another worker's status or release:** coordinate via thread
   - **Needs human judgment:** escalate to user quickly
   - **Persistent blocker:** invoke `pulse:debugging` to investigate root cause before restarting the worker
2. Do not let workers spin silently on blockers
3. Record blocker state in `.pulse/STATE.md` on the same worker entry that tracks both names

### File Conflict Requests

When a worker requests a file another worker holds:
1. Identify holder and requester
2. Coordinate one of:
   - holder releases at a safe checkpoint
   - requester waits
   - requester defers and creates a follow-up bead
3. Log the resolution in `.pulse/STATE.md` using the existing two-name worker entries

### Silence Ladder

Silence is not neutral. Treat it as a coordination problem to resolve.

- After 2 quiet poll cycles from a worker that should have reported: send a reminder
- After 3 quiet poll cycles from an active worker: send a direct status check telling the worker to fetch inbox, re-read `AGENTS.md` if needed, and report back on the epic thread
- After 5 quiet poll cycles while ready work, in-progress work, or unresolved reservations still exist: mark the worker stalled in `.pulse/STATE.md` and escalate to the user with the concrete status, what you already tried, and why the swarm cannot safely continue unattended

### Overseer Broadcasts

Use broadcast messages when the swarm needs a shared correction, for example:
- "re-read AGENTS.md after compaction"
- "do not touch file X until blocker Y is cleared"
- "new user decision: D7 is locked, honor it"
- "fetch inbox now before claiming new work"

### Worker Monitoring Checklist

Every monitoring cycle, also check:

- **Queue balance**: if any worker has 0 beads remaining while others have 2+, rebalance
- **File conflicts**: two workers touching the same file — pause one and re-sequence the beads
- **Completion rate**: if < 50% beads closed after 60% elapsed time, escalate to the user
- **Blocker accumulation**: if 2+ workers report blockers on the same subsystem, pause the swarm and return to planning

### Context Checkpoint

After each significant event, estimate your own context budget.

**If context >65% used:**
1. Write `.pulse/handoffs/coordinator.json` with complete swarm state (see `references/message-templates.md` → **Handoff JSON Template**)
2. Register it in `.pulse/handoffs/manifest.json`
3. Broadcast a pause notification on the epic thread
4. Report to user that the orchestrator paused safely and how to resume
5. Do NOT abandon the swarm without writing the handoff

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
     > "Swarm execution complete for the current phase. Return to pulse:planning to prepare the next phase."
   - if this was the final phase:
     > "Swarm execution complete for the final phase. Invoke pulse:reviewing skill."

---

## Red Flags

Stop and diagnose before continuing if you see:

- **Worker implements multiple beads at once** — self-routing does not mean parallelizing within one worker
- **Orchestrator edits source files** — role violation
- **Workers are idle but ready beads exist** — fetch inbox, inspect the thread, and recover the swarm instead of waiting for the user
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
| `references/worker-template.md` | Spawning any worker (Phase 3) |
| `references/message-templates.md` | Posting or parsing coordination messages |
| `references/runtime-adapter-spec.md` | Adapting canonical primitives to a concrete runtime |
| `references/pressure-scenarios.md` | Re-running RED/GREEN pressure tests for swarm coordination behavior |
