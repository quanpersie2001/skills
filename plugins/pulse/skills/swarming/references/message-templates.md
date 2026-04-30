# Coordinator Event Templates

Standard message bodies for Pulse swarm coordination. Adapt the delivery primitive to the active runtime.

- Claude Code: use `SendMessage`
- Codex: use parent-thread follow-up / worker reply flow

Use one shared coordination surface per epic.

---

## 1. Spawn Notification

**Posted by:** coordinator
**When:** after swarm initialization, before workers begin execution

```text
[SWARM START] <feature-name>

Swarm initialized for epic <EPIC_ID>.

Execution model:
- Workers are self-routing via `bv --robot-priority`
- File coordination happens through `.codex/pulse_reservations.mjs`
- Blockers, completions, and conflicts report here

Workers spawning now:
- Runtime: <RUNTIME_IDENTITY_1> | Status: spawned
- Runtime: <RUNTIME_IDENTITY_2> | Status: spawned
- Runtime: <RUNTIME_IDENTITY_3> | Status: spawned

All workers: post `[ONLINE]`, then load `pulse:executing`.
Coordinator: keep tending until the swarm is complete.
```

---

## 2. Worker Startup Acknowledgment

**Posted by:** worker
**When:** immediately on startup

```text
[ONLINE] <RUNTIME_IDENTITY> ready

Runtime identity: <RUNTIME_IDENTITY>
AGENTS.md: read
pulse:executing: loading
Next step: run `bv --robot-priority`, then reserve the selected bead paths.
```

---

## 3. Completion Report

**Posted by:** worker
**When:** after `br close`

```text
[DONE] <bead-id>: <bead-title>

Bead closed: <bead-id>
Worker: <RUNTIME_IDENTITY>
Commit: <git-commit-hash>

Summary of changes:
<2-3 sentence implementation summary>

Files modified:
- <path/to/file1>
- <path/to/file2>

Verification evidence:
- <history/<feature>/verification/<bead-id>.md>
- <command/result summary>

Context budget: ~<XX>% used
Next step: sync with coordinator, then return to `bv --robot-priority`.
```

---

## 4. Blocker Alert

**Posted by:** worker
**When:** immediately after discovering a blocker

```text
[BLOCKED] <bead-id> — <one-line description>

Worker: <RUNTIME_IDENTITY>
Bead: <bead-id>
Blocker type: [MISSING_CONTEXT | DEPENDENCY_NOT_MET | TECHNICAL_FAILURE | AMBIGUITY]

Description:
<clear explanation of the blocker>

What I need to proceed:
<specific ask>

I am paused on this bead and waiting for coordinator guidance.
```

---

## 5. File Conflict Request

**Posted by:** worker
**When:** reservation helper rejects the requested scope

```text
[FILE CONFLICT] <path-or-scope>

Worker: <RUNTIME_IDENTITY>
Bead: <bead-id>
Requested paths:
- <path/to/file>
- <path/to/file>

Current holder(s):
- <holder-runtime-identity>

Reason needed:
<why this scope is required>

Awaiting coordinator decision:
1. Wait for release
2. Re-sequence work
3. Defer into a follow-up bead
```

---

## 6. File Conflict Resolution

**Posted by:** coordinator
**When:** replying to a file conflict

```text
[CONFLICT DECISION] <path-or-scope>

Decision:
- Requester: <REQUESTER_RUNTIME_IDENTITY>
- Holder: <HOLDER_RUNTIME_IDENTITY>
- Action: [WAIT | RELEASE_AT_SAFE_POINT | DEFER]

Notes:
<short resolution notes>
```

---

## 7. Overseer Broadcast

**Posted by:** coordinator
**When:** the whole swarm needs the same reminder or correction

```text
[OVERSEER] <short instruction>

Broadcast to all workers:
<instruction or correction>

Examples:
- Re-read `AGENTS.md` after compaction
- Do not touch <file/path> until blocker <id> is resolved
- Decision D7 is now locked; honor it in remaining work
- Refresh reservation state before claiming another bead
```

---

## 8. Missing Startup Reminder

**Posted by:** coordinator
**When:** a spawned worker has not posted `[ONLINE]` after 2 poll cycles

```text
[OVERSEER] Startup acknowledgment missing

You were spawned for epic <EPIC_ID>, but you have not posted `[ONLINE]` yet.

Do this now, in order:
1. Re-read `AGENTS.md`
2. Post `[ONLINE]` with your runtime identity
3. Confirm `AGENTS.md: read`
4. Load `pulse:executing`
5. Only then continue into `bv --robot-priority`
```

---

## 9. Silent Worker Reminder

**Posted by:** coordinator
**When:** an active worker has gone quiet for 3 poll cycles

```text
[OVERSEER] Status update required

You have gone quiet while the swarm is still active.

Reply with one of:
- `[DONE] <bead-id>`
- `[BLOCKED] <bead-id>`
- `[FILE CONFLICT] <path>`
- `Status: still working on <bead-id>`

If you compacted, re-read `AGENTS.md` before replying.
```

---

## 10. Coordinator Context Warning

**Posted by:** coordinator
**When:** coordinator context approaches 65%

```text
[CONTEXT WARNING] Coordinator approaching capacity

Handoff summary:
Coordinator context is near the limit and the swarm handoff has been saved.

Resume briefing:
- Next action: reopen the coordination surface, then run `bv --robot-triage --graph-root <EPIC_ID>`.
- Read first: `.pulse/STATE.md`, `.pulse/handoffs/coordinator.json`

Transfer block highlights:
- Status: coordinator paused safely
- Completed: recorded latest worker state
- In flight: <worker / bead still needing attention>
- Blockers: <none or concrete blocker>
- Resume notes: refresh reservations before sending new guidance
```

---

## 11. Swarm Completion Announcement

**Posted by:** coordinator
**When:** all phase beads are verified closed

```text
[SWARM COMPLETE] <feature-name>

Swarm complete for epic <EPIC_ID>.

Summary:
- Beads implemented: <N>
- Workers used: <K>
- Build status: PASS
- Test status: PASS

Next step: invoke `pulse:reviewing`.
```

---

## Coordinator Handoff JSON Template

Write to `.pulse/handoffs/coordinator.json` when coordinator context exceeds 65%.

```json
{
  "schema_version": "2.0",
  "handoff_id": "coordinator-<ISO-8601>",
  "owner_type": "coordinator",
  "owner_id": "<COORDINATOR_IDENTITY>",
  "skill": "pulse:swarming",
  "feature": "<feature-name>",
  "phase": "execution/<EPIC_ID>",
  "status": "ready_to_resume",
  "paused_at": "<ISO-8601>",
  "reason": "context_critical",
  "next_action": "Reopen the coordination surface, then run bv --robot-triage --graph-root <EPIC_ID>.",
  "read_first": [
    ".pulse/STATE.md",
    ".pulse/handoffs/coordinator.json"
  ],
  "summary": "Coordinator paused safely because context is near the limit.",
  "payload": {
    "swarm": {
      "epic_id": "<EPIC_ID>",
      "feature_name": "<feature-name>",
      "adapter": "<claude-code|codex>"
    },
    "graph_status": {
      "open_beads": ["<bead-id-1>"],
      "in_progress_beads": ["<bead-id-2>"],
      "blocked_beads": ["<bead-id-3>"]
    },
    "active_workers": [
      {
        "runtime_identity": "<RUNTIME_IDENTITY>",
        "current_bead": "<bead-id-2>",
        "status": "in_progress"
      }
    ],
    "open_blockers": [],
    "transfer": {
      "status": "Coordinator paused safely.",
      "completed": ["Recorded latest worker state in .pulse/STATE.md"],
      "in_flight": ["Resume tending worker <RUNTIME_IDENTITY> on <bead-id-2>"],
      "blockers": [],
      "resume_notes": [
        "Refresh reservation state before replying",
        "Confirm graph counts still match",
        "Do not assign new work until conflicts are reconciled"
      ]
    }
  }
}
```
