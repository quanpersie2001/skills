# Pulse Handoff Contract

Pulse uses owner-scoped handoffs plus a small manifest. It does not use one global handoff file.

## Why

The handoff system has to support multiple paused actors safely:

- planning
- swarm coordinator
- worker agents
- single-worker degraded execution

One shared JSON file creates race conditions and schema drift. Pulse avoids that by separating:

- `manifest.json` -> discovery and resume index
- `<owner>.json` -> checkpoint for exactly one owner

## Directory Layout

```text
.pulse/
  handoffs/
    manifest.json
    planning.json
    coordinator.json
    worker-<agent>.json
    single-worker.json
    archive/
```

## Manifest Schema

`manifest.json` is intentionally small:

```json
{
  "schema_version": "1.0",
  "updated_at": "<ISO-8601>",
  "active": [
    {
      "owner_id": "planning",
      "owner_type": "phase",
      "skill": "pulse:planning",
      "feature": "auth-refresh",
      "path": ".pulse/handoffs/planning.json",
      "phase": "planning/phase-4",
      "next_action": "Create remaining task beads",
      "summary": "Discovery and approach are complete"
    }
  ]
}
```

## Owner File Envelope

Every owner file must use the same outer envelope:

```json
{
  "schema_version": "2.0",
  "handoff_id": "planning-2026-03-27T10:15:00Z",
  "owner_type": "phase|coordinator|worker",
  "owner_id": "planning|GreenCastle|worker-blue-lake|single-worker",
  "skill": "pulse:planning",
  "feature": "auth-refresh",
  "phase": "planning/phase-4",
  "status": "paused|ready_to_resume|consumed|archived",
  "paused_at": "<ISO-8601>",
  "reason": "context_critical",
  "next_action": "Create remaining task beads",
  "read_first": [
    ".pulse/STATE.md",
    "history/auth-refresh/CONTEXT.md"
  ],
  "summary": "Discovery and approach are complete; bead creation is next.",
  "payload": {}
}
```

## Payload Expectations

Keep owner-specific data inside `payload`.

Examples:

- `planning.json`
  - `completed_through`
  - `artifacts_written`
  - `beads_created`
  - `open_questions`
- `coordinator.json`
  - `epic_id`
  - `graph_status`
  - `active_workers`
  - `blockers`
- `worker-<agent>.json`
  - `current_bead`
  - `reserved_files`
  - `verification_state`
- `single-worker.json`
  - `current_bead`
  - `completed_beads`
  - `blocked_beads`

## Lifecycle

1. Owner writes or updates its own handoff file.
2. Owner registers or updates its entry in `manifest.json`.
3. Resume starts from the manifest, never by scanning arbitrary files.
4. After successful resume, mark the owner file `consumed` or move it to `archive/`.
5. Remove the manifest entry only after the resume is confirmed.

## Rules

1. One owner file = one writer.
2. `using-pulse` only relies on the manifest plus the common envelope.
3. Workers do not overwrite coordinator state.
4. Coordinator does not overwrite worker state.
5. Resume flows always require user confirmation.
