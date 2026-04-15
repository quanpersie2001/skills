# Agent Mail Message Templates

Standard message formats for swarm coordination. All messages post to the epic thread (`thread_id=<EPIC_ID>`) unless noted otherwise.
Use a shared epic topic tag in all messages (recommended: `topic="epic-<EPIC_ID>"`).
Use `<COORDINATOR_AGENT_NAME>` for the coordinator identity, and keep it a valid Agent Mail adjective+noun name.

---

## 1. Spawn Notification

**Posted by:** Swarm coordinator (`<COORDINATOR_AGENT_NAME>`)
**When:** After coordination runtime setup is complete, before spawning workers
**Purpose:** Announces the swarm start and the self-routing execution model

Runtime call:
`send_message(project_key=..., sender_name="<COORDINATOR_AGENT_NAME>", to=["<COORDINATOR_AGENT_NAME>"], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [SWARM START] <feature-name>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: NORMAL

Swarm initialized for epic <EPIC_ID>.

Execution model:
- Workers are self-routing via `bv --robot-priority`
- File coordination happens through reservations
- Blockers and course corrections happen in this thread

Workers spawning now:
- Runtime: <RUNTIME_NICKNAME_1> / Agent Mail: pending
- Runtime: <RUNTIME_NICKNAME_2> / Agent Mail: pending
- Runtime: <RUNTIME_NICKNAME_3> / Agent Mail: pending

All workers: join this thread, post startup acknowledgment, then load the pulse:executing skill.
Coordinator: do not idle after this message. Keep polling `fetch_inbox(...)` and `fetch_topic(...)` until the swarm is complete.
```

---

## 2. Worker Spawn Acknowledgment

**Posted by:** Worker
**When:** Immediately on startup
**Purpose:** Confirms the worker is live and following the expected loop

Runtime call:
`send_message(project_key=..., sender_name="<AGENT_MAIL_NAME>", to=["<COORDINATOR_AGENT_NAME>"], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [ONLINE] <RUNTIME_NICKNAME> / <AGENT_MAIL_NAME> ready
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: NORMAL

Runtime nickname: <RUNTIME_NICKNAME>
Agent Mail name: <AGENT_MAIL_NAME>
AGENTS.md: read
Status: Loading pulse:executing skill.
Next step: fetch inbox, then run `bv --robot-priority`, then claim the top executable bead.
```

---

## 3. Completion Report

**Posted by:** Worker
**When:** After each bead is closed with `br close`
**Purpose:** Notifies orchestrator of progress

Runtime call:
`send_message(project_key=..., sender_name="<AGENT_MAIL_NAME>", to=["<COORDINATOR_AGENT_NAME>"], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [DONE] <bead-id>: <bead-title>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: NORMAL

Bead closed: <bead-id>
Title: <bead-title>
Worker:
- Runtime nickname: <RUNTIME_NICKNAME>
- Agent Mail name: <AGENT_MAIL_NAME>
Commit: <git-commit-hash>

Summary of changes:
<2-3 sentence description of what was implemented>

Files modified:
- <path/to/file1>
- <path/to/file2>

Verification:
- <command/result summary>

Context budget: ~<XX>% used
Next action: fetch inbox, then return to `bv --robot-priority`
```

---

## 4. Blocker Alert

**Posted by:** Worker
**When:** Immediately upon discovering a blocking issue
**Purpose:** Requests orchestrator intervention

Runtime call:
`send_message(project_key=..., sender_name="<AGENT_MAIL_NAME>", to=["<COORDINATOR_AGENT_NAME>"], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [BLOCKED] <bead-id> — <one-line description>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: HIGH

BLOCKED:
- Runtime nickname: <RUNTIME_NICKNAME>
- Agent Mail name: <AGENT_MAIL_NAME>
- Bead: <bead-id>

Blocker type: [MISSING_CONTEXT | DEPENDENCY_NOT_MET | TECHNICAL_FAILURE | AMBIGUITY]

Description:
<Clear description of what is blocking. Include errors, file names, and relevant details.>

What I need to proceed:
<Specific ask: information, release of a file reservation, user decision, etc.>

I am paused on this bead and waiting for a reply on this thread.
Until a reply arrives, I will keep polling `fetch_inbox(...)` on this topic.
```

---

## 5. File Conflict Request

**Posted by:** Worker
**When:** Worker needs a file another worker currently holds
**Purpose:** Coordinates file access without preassigned worker scopes

Runtime call:
`send_message(project_key=..., sender_name="<AGENT_MAIL_NAME>", to=["<COORDINATOR_AGENT_NAME>"], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [FILE CONFLICT] <path/to/file>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: HIGH

File conflict:
- Runtime nickname: <RUNTIME_NICKNAME>
- Agent Mail name: <AGENT_MAIL_NAME>
- Needs a file that is currently reserved.

Requested file: <path/to/file>
Currently reserved by: <AGENT_NAME_holder or "unknown">
My bead: <bead-id>
Reason needed: <Why this file is required for this bead>

Awaiting orchestrator decision:
1. Request holder release at a safe checkpoint
2. Ask me to wait
3. Ask me to defer and create a follow-up bead

Until a decision arrives, I will keep polling `fetch_inbox(...)` on this topic.
```

---

## 6. File Conflict Resolution

**Posted by:** Swarm coordinator (`<COORDINATOR_AGENT_NAME>`)
**When:** Replying to a File Conflict Request

Runtime call:
`reply_message(project_key=..., message_id=<file-conflict-message-id>, sender_name="<COORDINATOR_AGENT_NAME>", body_md="...")`

```
Subject: Re: [FILE CONFLICT] <path/to/file>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: NORMAL

Decision on file conflict for <path/to/file>:

[Choose one:]

OPTION A — Wait:
<AGENT_NAME_requester>: wait for <AGENT_NAME_holder> to release the reservation.

OPTION B — Release requested:
<AGENT_NAME_holder>: please release <path/to/file> when you reach a safe checkpoint.
<AGENT_NAME_requester>: stand by until release is confirmed.

OPTION C — Defer:
<AGENT_NAME_requester>: defer this change. Create a follow-up bead and continue with the next executable bead.
```

---

## 7. Overseer Broadcast

**Posted by:** Swarm coordinator (`<COORDINATOR_AGENT_NAME>`)
**When:** Shared correction or reminder is needed across the swarm

Runtime call:
`send_message(project_key=..., sender_name="<COORDINATOR_AGENT_NAME>", to=[<worker-list>], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [OVERSEER] <short instruction>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: HIGH

Broadcast to all workers:

<Instruction or correction>

Examples:
- Re-read AGENTS.md before continuing
- Fetch inbox before claiming new work
- Do not touch <file/path> until blocker <id> is resolved
- Decision D7 is now locked; honor it in all remaining work
```

---

## 8. Missing Startup Reminder

**Posted by:** Swarm coordinator (`<COORDINATOR_AGENT_NAME>`)
**When:** A spawned worker has not posted `[ONLINE]` after 2 poll cycles
**Purpose:** Forces the worker back onto the thread and back through `AGENTS.md`

Runtime call:
`send_message(project_key=..., sender_name="<COORDINATOR_AGENT_NAME>", to=["<AGENT_MAIL_NAME-or-runtime-target>"], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [OVERSEER] Startup acknowledgment missing
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: HIGH

You were spawned for epic <EPIC_ID>, but you have not posted your startup acknowledgment yet.

Do this now, in order:
1. Re-read `AGENTS.md`
2. Post `[ONLINE]` with your runtime nickname and Agent Mail name
3. Confirm `AGENTS.md: read`
4. Run `fetch_inbox(...)`
5. Only then continue into `bv --robot-priority`
```

---

## 9. Silent Worker Reminder

**Posted by:** Swarm coordinator (`<COORDINATOR_AGENT_NAME>`)
**When:** An active worker has gone quiet for 3 poll cycles
**Purpose:** Pulls an off-thread or drifting worker back into the coordination loop

Runtime call:
`send_message(project_key=..., sender_name="<COORDINATOR_AGENT_NAME>", to=["<AGENT_MAIL_NAME>"], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [OVERSEER] Status update required
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: HIGH

You have gone quiet while the swarm is still active.

Reply on this thread with one of:
- `[DONE] <bead-id>` if the bead is complete
- `[BLOCKED] <bead-id>` if you need help
- `[FILE CONFLICT] <path>` if you are waiting on a reservation
- `Status: still working on <bead-id>` if you are actively progressing

Before replying, re-read `AGENTS.md` if you compacted or drifted, then run `fetch_inbox(...)`.
```

---

## 10. Coordinator Context Warning

**Posted by:** Swarm coordinator (`<COORDINATOR_AGENT_NAME>`)
**When:** Swarm coordinator detects its own context is approaching 65%
**Purpose:** Warns workers and records the pause using the standard handoff summary/resume briefing/transfer-block vocabulary

Runtime call:
`send_message(project_key=..., sender_name="<COORDINATOR_AGENT_NAME>", to=[<worker-list>], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [CONTEXT WARNING] Coordinator approaching capacity
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: HIGH

Handoff summary:
Coordinator context is at ~<XX>% and the coordinator is pausing cleanly after saving a swarm handoff.

Resume briefing:
- Next action: Poll the epic thread, then run `bv --robot-triage --graph-root <EPIC_ID>` before sending new coordination instructions.
- Read first: `.pulse/STATE.md`, `.pulse/handoffs/coordinator.json`

Transfer block highlights:
- Status: Swarm coordinator is paused safely and workers have been left in a known state.
- Completed: processed thread updates through <mail-id>; recorded latest worker states in `.pulse/STATE.md`
- In flight: <worker / bead still needing active tending>
- Blockers: <none or concrete blocker summary>
- Resume notes: fetch inbox and topic updates before replying; confirm graph counts still match; do not assign new work until blockers/conflicts are reconciled.

Workers: continue the current bead safely, then report status to this thread.
```

---

## 11. Swarm Completion Announcement

**Posted by:** Swarm coordinator (`<COORDINATOR_AGENT_NAME>`)
**When:** All beads are verified closed

Runtime call:
`send_message(project_key=..., sender_name="<COORDINATOR_AGENT_NAME>", to=[<worker-list>], thread_id="<EPIC_ID>", topic="epic-<EPIC_ID>", ...)`

```
Subject: [SWARM COMPLETE] <feature-name> — all beads closed
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>
Importance: NORMAL

Swarm complete for epic <EPIC_ID>.

Summary:
- Beads implemented: <N>
- Workers used: <K>
- Build status: PASS
- Test status: PASS

All workers: your work is complete.

Next step: Invoke the pulse:reviewing skill.
```

---

## Handoff JSON Template

Write to `.pulse/handoffs/coordinator.json` when the swarm coordinator context exceeds 65%. Register it in `.pulse/handoffs/manifest.json` using the same top-level `summary`, `next_action`, and owner file path.

This template follows the standard handoff summary/resume briefing/transfer block contract from `pulse:using-pulse`.

```json
{
  "schema_version": "2.0",
  "handoff_id": "coordinator-<ISO-8601>",
  "owner_type": "coordinator",
  "owner_id": "<COORDINATOR_AGENT_NAME>",
  "skill": "pulse:swarming",
  "feature": "<feature-name>",
  "phase": "execution/<EPIC_ID>",
  "status": "ready_to_resume",
  "paused_at": "<ISO-8601 timestamp>",
  "reason": "context_critical",
  "next_action": "Poll the epic thread, then run bv --robot-triage --graph-root <EPIC_ID> before sending new coordination instructions.",
  "read_first": [
    ".pulse/STATE.md",
    ".pulse/handoffs/coordinator.json"
  ],
  "summary": "Coordinator paused safely because context is near the limit. Resume by restoring thread state, confirming the live graph still matches the handoff, and then continuing swarm tending.",
  "payload": {
    "swarm": {
      "epic_id": "<EPIC_ID>",
      "feature_name": "<feature-name>",
      "project_key": "<project-root-path>",
      "epic_topic": "epic-<EPIC_ID>"
    },
    "graph_status": {
      "open_beads": ["<bead-id-1>", "<bead-id-2>"],
      "in_progress_beads": ["<bead-id-3>"],
      "blocked_beads": ["<bead-id-4>"]
    },
    "active_workers": [
      {
        "runtime_nickname": "<RUNTIME_NICKNAME>",
        "agent_mail_name": "<AGENT_MAIL_NAME>",
        "current_bead": "<bead-id-3>",
        "status": "in_progress"
      }
    ],
    "open_blockers": [
      {
        "bead_id": "<bead-id>",
        "worker": {
          "runtime_nickname": "<RUNTIME_NICKNAME>",
          "agent_mail_name": "<AGENT_MAIL_NAME>"
        },
        "description": "<blocker description>",
        "thread_message_id": "<mail-id>"
      }
    ],
    "context_snapshot": {
      "tokens_used_pct": 0.67,
      "agent_mail_thread": "<EPIC_ID>"
    },
    "transfer": {
      "status": "Swarm coordinator is paused safely and workers have been left in a known state.",
      "completed": [
        "Processed thread updates through message <mail-id>",
        "Recorded latest worker states in .pulse/STATE.md"
      ],
      "in_flight": [
        "Need to resume tending worker <AGENT_MAIL_NAME> on bead <bead-id-3>"
      ],
      "blockers": [
        "Worker <AGENT_MAIL_NAME> is blocked on <bead-id-4>: <blocker description>"
      ],
      "resume_notes": [
        "Fetch inbox and topic updates before replying to any worker",
        "Confirm open/in-progress/blocked counts still match before resuming",
        "Do not assign new work until file conflicts and blockers are reconciled"
      ]
    }
  }
}
```
