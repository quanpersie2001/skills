# Swarm Message Templates

Use these message shapes when coordinating Pulse workers.

## Spawn Notification

```text
Subject: [SWARM START] <feature-name>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>

Swarm initialized for epic <EPIC_ID>.
Execution mode: swarm
Workers to follow.
```

## Worker Online

```text
Subject: [ONLINE] <AGENT_NAME> ready
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>

<AGENT_NAME> online. Loading pulse:executing.
```

## Completion Report

```text
Subject: [DONE] <bead-id>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>

Implemented: <summary>
Files: <list>
Verification: <commands and outcomes>
Commit: <hash>
```

## Blocker Alert

```text
Subject: [BLOCKED] <bead-id>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>

Blocked on: <problem>
Attempted: <what was tried>
Need: <specific help or decision>
```

## File Conflict Request

```text
Subject: [CONFLICT] <bead-id>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>

Need files: <list>
Currently held by: <agent>
Requested action: release | wait | split work
```

## Coordinator Pause Notice

```text
Subject: [PAUSE] coordinator context checkpoint
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>

Coordinator paused safely.
Resume artifacts:
- .pulse/handoffs/manifest.json
- .pulse/handoffs/coordinator.json
- .pulse/STATE.md
```

## Swarm Complete

```text
Subject: [SWARM COMPLETE] <feature-name>
Thread: <EPIC_ID>
Topic: epic-<EPIC_ID>

All executable beads are closed.
Next: invoke pulse:reviewing.
```

## Coordinator Handoff Payload

Coordinator pauses write `.pulse/handoffs/coordinator.json` using the shared Pulse handoff envelope plus a payload like:

```json
{
  "epic_id": "<EPIC_ID>",
  "graph_status": {
    "open_beads": [],
    "in_progress_beads": [],
    "blocked_beads": []
  },
  "active_workers": [
    {
      "agent_name": "<AGENT_NAME>",
      "current_bead": "<bead-id>",
      "status": "in_progress"
    }
  ],
  "blockers": []
}
```
