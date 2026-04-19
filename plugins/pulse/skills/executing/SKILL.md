---
name: executing
description: >-
  Per-agent implementation loop for the Pulse ecosystem. Use in two modes: worker mode
  under pulse:swarming, or degraded standalone single-worker mode when preflight does not
  allow a swarm. Implements the bead loop, verification discipline, coordination reporting,
  and safe pause/resume behavior.
metadata:
  version: '1.3'
  ecosystem: pulse
  dependencies:
    - id: beads-cli
      kind: command
      command: br
      missing_effect: unavailable
      reason: Executing implements and closes beads through br.
    - id: beads-viewer
      kind: command
      command: bv
      missing_effect: degraded
      reason: Executing checks bead state with bv during the implementation loop.
    - id: agent-mail
      kind: mcp_server
      server_names: [mcp_agent_mail]
      config_sources: [repo_codex_config, global_codex_config]
      missing_effect: degraded
      reason: Workers report progress through Agent Mail in swarm mode.
---

# Executing

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

`pulse:executing` supports two modes:

- worker mode under `pulse:swarming`
- standalone single-worker mode when preflight recommends degraded execution

In both modes, the live bead graph is the source of truth for what to do next.

## Loop Overview

```
Initialize → Get Bead → Reserve Files → Implement → Verify → Close & Report
     ↑                                                               |
     └─────────────── Context OK? Loop ─────────────────────────────┘
                       Context >65%? → Handoff → Stop
```

---

## Step 1: Initialize

Determine mode from invocation plus `.pulse/tooling-status.json`:

- if invoked by `pulse:swarming`, run in worker mode
- if `recommended_mode=single-worker`, run in standalone mode

### 1a. Register with the Coordination Runtime (worker mode only)

Swarming gives you a runtime nickname first. Use that nickname as the attempted Agent Mail name, then keep the returned Agent Mail name for all later coordination calls.

Register your session with the coordination runtime:
- Use your runtime nickname as the attempted name
- Capture the resolved Agent Mail name from the registration result

Record both identities in your startup acknowledgment:
- `Runtime nickname: <runtime-nickname>`
- `Agent Mail name: <resolved-agent-mail-name>`

From this point on, use `resolved_agent_mail_name` for every coordination call.

### 1b. Read Project Context (in this order)

1. **AGENTS.md** — project operating manual (mandatory; skip nothing)
2. If present, run **`node .codex/pulse_status.mjs --json`** — quick onboarding/state/handoff scout
3. **.pulse/state.json** — machine-readable routing snapshot
4. **.pulse/STATE.md** — current project focus, decisions, active blockers
5. **history/\<feature\>/CONTEXT.md** — locked decisions that MUST be honored

If any of these files does not exist, note the absence and proceed — do not fabricate content.

If the bead references `learning_refs`, read those specific learning files. Do not load all learnings by default.

### 1c. Report Online Before Claiming Work (worker mode only)

Before you select a bead, you must report in on the epic thread. Startup is not complete until you read `AGENTS.md`, post a startup acknowledgment with both identities, say `AGENTS.md` was read and `pulse:executing` is loading, and run `fetch_inbox(...)` on the epic topic.

Do not call `bv --robot-priority` before this sequence is complete.

### 1d. Check for Handoff

Use owner-scoped handoffs:

- worker mode -> `.pulse/handoffs/worker-<agent>.json`
- standalone mode -> `.pulse/handoffs/single-worker.json`

If a handoff exists and was written by a prior instance of you (same agent identity):

1. Read it — restore active bead, progress markers, open questions
2. Resume from where it stopped; skip re-reading already-read files
3. Archive or mark the handoff consumed and update the manifest

---

## Step 2: Get the Next Bead

In worker mode, every loop starts with coordination, not bead selection.

Start with `fetch_inbox(project_key="<project-root-path>", agent_name="<resolved-agent-mail-name>", topic="<EPIC_TOPIC>")`.
If the thread looks stale, also run `fetch_topic(project_key="<project-root-path>", topic_name="<EPIC_TOPIC>")`.

### Normal path: self-route from the live graph

```bash
bv --robot-priority
```

Select the top-ranked bead that:

- has no open dependencies
- is not reserved by another worker
- is compatible with the current mode

### Exceptional path: direct orchestrator hint

If swarming suggests a bead via coordination, treat it as a startup hint or rescue instruction, not as a permanent assignment. Re-check the live graph before claiming the work.

### Read the bead fully

```bash
br show <bead-id>
```

Minimum fields to confirm:

| Field | Purpose |
|-------|---------|
| `dependencies` | Upstream bead IDs that must close first |
| `files` | Files/modules in scope for this bead |
| `verify` | Concrete verification commands to run |
| `verification_evidence` | Path to the canonical evidence artifact (typically `history/<feature>/verification/<bead-id>.md`) |
| `testing_mode` | `standard` / `tdd-required` |
| `decision_refs` | Locked decisions from CONTEXT.md relevant to this bead |
| `learning_refs` | Learning file paths to read before implementing |

If any required field is missing, stop and bounce the bead back to validating or planning. Do not guess from free-form prose.

If `testing_mode` is `tdd-required`, confirm `tdd_steps` is present before implementation starts.

---

## Step 3: Reserve Files

In worker mode, reserve all listed files before editing.

```
file_reservation_paths(
  project_key: "<project-root-path>",
  agent_name: "<resolved-agent-mail-name>",
  paths: ["src/foo.ts", "src/bar.ts"],
  reason: "Working bead <bead-id>"
)
```

In standalone mode, there is no cross-worker race, but still treat the bead's `files` list as a hard scope boundary. Do not blend multiple beads into one ad hoc change, and do not sneak in temporary cross-module structure that was not planned.

### If reservation fails in worker mode:

Report the conflict to the coordinator:

```
send_message(
  project_key: "<project-root-path>",
  sender_name: "<resolved-agent-mail-name>",
  to: ["<COORDINATOR_AGENT_NAME>"],
  thread_id: "<EPIC_ID>",
  topic: "<EPIC_TOPIC>",
  subject: "File conflict on <bead-id>",
  body_md: "Need files: [list]. Currently held by: [holder]. Requesting resolution."
)
```

Wait for resolution. Do not proceed without your reservations.
While waiting, keep polling `fetch_inbox(...)` on the epic topic.

### If reservation succeeds:

Proceed to implementation immediately.

---

## Step 4: Implement

### Read before writing

Read every source file you will modify. Do not write from memory or assumptions about file contents.

### Honor CONTEXT.md locked decisions

Before writing any code, scan your bead's description for decision IDs (D1, D2, ...). For each referenced ID:
1. Read the corresponding entry in `history/<feature>/CONTEXT.md`
2. Implement exactly as locked — do not reinterpret, do not "improve" a locked decision

### Follow existing patterns

Match naming conventions, error handling patterns, import styles, and test structures found in the codebase.

For new feature beads, do not invent temporary architecture just to get a first phase over the line. Preserve the planned module ownership, interfaces, and cross-module contracts from `CONTEXT.md`, `approach.md`, and the phase artifacts.

### No pseudo-implementations

Every artifact you create must be:
- **Substantive**: real logic, not stubs or TODOs
- **Wired**: imported, exported, and integrated — not floating code

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

---

## Step 5: Verify

Run the bead's `verify` steps exactly as written. Do not substitute easier checks.

Verification is not complete until you have fresh evidence from this execution pass.

Read the bead's `verification_evidence` field and update every declared artifact or explicit record there.

The standard artifact path is:

```text
history/<feature>/verification/<bead-id>.md
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
   - worker mode -> notify the coordinator via coordination runtime; keep polling `fetch_inbox(...)` while blocked
   - standalone mode -> invoke `pulse:debugging` or surface the blocker to the user

Do not close the bead without a passing verification result and a fresh evidence record.

---

## Step 6: Close and Report

All actions must complete. Do not skip any, and do not start another bead until the completion report is sent (worker mode) or recorded (standalone mode).

### 6a. Close-Readiness Check

Before `br close`, confirm all are true:

- file edits stayed within the bead's `files` scope, or any expansion was surfaced and approved
- locked decisions in `decision_refs` were re-checked against the final implementation
- all `verify` steps passed in a fresh run
- every declared `verification_evidence` entry is present and substantive
- any `tdd-required` red-green evidence is recorded
- no unresolved blocker, review finding, or failed follow-up is being silently deferred

### 6b. Close the bead

```bash
br close <bead-id> --reason "Completed: <one-line summary of what was implemented>"
```

### 6c. Atomic git commit

One commit per bead. Exactly this format:

```bash
git add <files-you-modified>
git commit -m "feat(<bead-id>): <summary matching br close reason>"
```

Do not batch multiple beads into one commit. Do not commit unrelated changes.

### 6d. Release file reservations (worker mode)

```
release_file_reservations(
  agent_name: "<resolved-agent-mail-name>",
  paths: ["src/foo.ts", "src/bar.ts"]
)
```

Release **before** sending the completion report so other agents can acquire these files immediately.

### 6e. Send completion report (worker mode) or record completion (standalone)

Worker mode:

```
send_message(
  project_key: "<project-root-path>",
  sender_name: "<resolved-agent-mail-name>",
  to: ["<COORDINATOR_AGENT_NAME>"],
  thread_id: "<EPIC_ID>",
  topic: "<EPIC_TOPIC>",
  subject: "Completed <bead-id>",
  body_md: "Runtime nickname: <runtime-nickname>. Agent Mail name: <resolved-agent-mail-name>. Implemented: [summary]. Files: [list]. Verification: [tests passed / build clean]. Commit: [hash]."
)
```

Standalone mode: record completion in `.pulse/STATE.md`.

Completion reports should include the verification evidence path or paths, the final verification status, and any scoped follow-up that still needs a new bead.

### 6f. Check inbox once after reporting (worker mode)

Before you claim the next bead, run `fetch_inbox(project_key="<project-root-path>", agent_name="<resolved-agent-mail-name>", topic="<EPIC_TOPIC>")`.

---

## Step 7: Loop or Pause

After each bead:

- if context is below 65%, loop back to Step 2
- if context is at or above 65%, write the owner handoff file and stop cleanly

### Writing the handoff

Use the standard handoff summary/resume briefing/transfer block contract from `pulse:using-pulse`. Treat this pause boundary as a checkpoint trigger: capture or refresh the feature checkpoint before stopping when the current phase meaningfully changed.

Worker mode handoff payload (write to `.pulse/handoffs/worker-<agent>.json`):

```json
{
  "schema_version": "2.0",
  "handoff_id": "worker-<resolved-agent-mail-name>-<ISO-8601>",
  "owner_type": "worker",
  "owner_id": "worker-<resolved-agent-mail-name>",
  "skill": "pulse:executing",
  "feature": "<feature>",
  "phase": "execution/<EPIC_ID>",
  "status": "ready_to_resume",
  "paused_at": "<ISO timestamp>",
  "reason": "context_critical",
  "next_action": "Check the epic thread, then run bv --robot-priority before claiming more work.",
  "read_first": [
    "AGENTS.md",
    ".pulse/STATE.md",
    "history/<feature>/CONTEXT.md",
    ".pulse/handoffs/worker-<agent>.json"
  ],
  "summary": "Worker paused cleanly because context is near the limit. The next turn should rejoin coordination, confirm the current graph state, and continue from the highest-priority executable bead.",
  "payload": {
    "runtime": {
      "runtime_nickname": "<runtime-nickname>",
      "agent_mail_name": "<resolved-agent-mail-name>",
      "epic_id": "<EPIC_ID>",
      "epic_topic": "<EPIC_TOPIC>",
      "coordinator_agent_name": "<COORDINATOR_AGENT_NAME>"
    },
    "context_snapshot": {
      "tokens_used_pct": 0.67,
      "last_bead_closed": "<bead-id or null>"
    },
    "transfer": {
      "status": "Worker is paused safely and no longer editing files.",
      "completed": [
        "Closed bead <bead-id> and sent the completion report"
      ],
      "in_flight": [
        "No bead currently claimed; resume from the live graph after checking mail"
      ],
      "blockers": [],
      "resume_notes": [
        "Run fetch_inbox(...) on <EPIC_TOPIC> before selecting work",
        "Re-check file reservations before editing any file",
        "Use bv --robot-priority as the source of truth for the next bead"
      ]
    },
    "verification_evidence_paths": [
      "history/<feature>/verification/<bead-id>.md"
    ]
  }
}
```

Standalone mode handoff payload (write to `.pulse/handoffs/single-worker.json`):

```json
{
  "schema_version": "2.0",
  "handoff_id": "single-worker-<ISO-8601>",
  "owner_type": "worker",
  "owner_id": "single-worker",
  "skill": "pulse:executing",
  "feature": "<feature>",
  "phase": "execution/standalone",
  "status": "ready_to_resume",
  "paused_at": "<ISO timestamp>",
  "reason": "context_critical",
  "next_action": "Re-read state, inspect the next executable bead, and continue the standalone loop.",
  "read_first": [
    "AGENTS.md",
    ".pulse/STATE.md",
    "history/<feature>/CONTEXT.md",
    ".pulse/handoffs/single-worker.json"
  ],
  "summary": "Single-worker execution paused cleanly because context is near the limit. Resume by restoring state, checking the next bead, and continuing verification discipline.",
  "payload": {
    "context_snapshot": {
      "tokens_used_pct": 0.67,
      "last_bead_closed": "<bead-id or null>"
    },
    "transfer": {
      "status": "Standalone execution is paused safely.",
      "completed": [
        "Closed bead <bead-id> and recorded completion in .pulse/STATE.md"
      ],
      "in_flight": [
        "Next priority hint: <bead-id or short description>"
      ],
      "blockers": [],
      "resume_notes": [
        "Read the current bead fully with br show before editing",
        "Keep file edits within the next bead's declared scope",
        "Update verification evidence before closing another bead"
      ]
    },
    "verification_evidence_paths": [
      "history/<feature>/verification/<bead-id>.md"
    ]
  }
}
```

Register the handoff in `.pulse/handoffs/manifest.json` using the same `summary`, `next_action`, and owner file path.

Worker mode: notify the coordinator after writing the handoff.

```
send_message(
  project_key: "<project-root-path>",
  sender_name: "<resolved-agent-mail-name>",
  to: ["<COORDINATOR_AGENT_NAME>"],
  thread_id: "<EPIC_ID>",
  topic: "<EPIC_TOPIC>",
  subject: "[HANDOFF] <runtime-nickname> / <resolved-agent-mail-name>",
  body_md: "Handoff summary: Worker paused cleanly because context is near the limit.\n\nResume briefing:\n- Next action: Check the epic thread, then run bv --robot-priority before claiming more work.\n- Read first: AGENTS.md, .pulse/STATE.md, history/<feature>/CONTEXT.md, .pulse/handoffs/worker-<agent>.json\n\nTransfer block:\n- Status: Worker is paused safely and no longer editing files.\n- Completed: [closed bead(s), sent completion report, updated evidence]\n- In flight: [next bead or \"none currently claimed\"]\n- Blockers: [none or concrete blocker]\n- Resume notes: [mail check, reservation check, graph check]"
)
```

---

## Step 8: Post-Compact Recovery

**If you detect context compaction** (your conversation was summarized, or you notice gaps in your context):

**STOP immediately. Do not continue implementing.**

Re-read in this exact order before any further action:

1. `AGENTS.md`
2. `history/<feature>/CONTEXT.md`
3. The current bead you were working on: `br show <bead-id>`
4. Your active file reservations (query the coordination runtime, worker mode only)

Only after re-reading all applicable items may you continue.

**Why this is non-negotiable:** Compaction erases knowledge of AGENTS.md, active reservations, and locked decisions. Agents that skip this step produce implementations that conflict with other workers and violate CONTEXT.md decisions.

---

## Red Flags

Stop and reassess if you notice any of these:

- **Executing without reading the bead file fully**
- **Executing a bead that is missing canonical schema fields**
- **Writing files outside your reserved scope** — you are creating conflicts for other workers
- **Skipping verification** — "it looks right" is not verification; run the actual criteria
- **Claiming success from stale or partial verification output**
- **Closing a bead without a substantive `verification_evidence` record**
- **Claiming `tdd-required` was satisfied without a real red failure and green pass**
- **Continuing after compaction without re-reading** — you have amnesia; fix it before proceeding
- **Implementing stubs, TODOs, or empty handlers** — these are not implementations; they are deferred failures
- **Ignoring a locked decision from CONTEXT.md**
- **Bundling multiple beads into one commit** — atomic commits per bead are the audit trail; don't corrupt it
- **Claiming a bead without checking reservations** — self-routing still depends on file coordination
- **Closing or blocking a bead without reporting via the coordination runtime** — off-thread progress is invisible progress; it breaks the swarm
- **Waiting silently for the coordinator** — if you are blocked, conflicted, handing off, or done, post and keep polling
- **Reading the entire learnings corpus instead of the bead's cited learning refs**
- **Writing the retired global handoff file**

---

## Quick Reference: Tool Calls (Worker Mode)

| Action | Call |
|--------|------|
| Register | Session registration via coordination runtime |
| Get priority bead | `bv --robot-priority` |
| Read bead | `br show <id>` |
| Reserve files | `file_reservation_paths(...)` |
| Release files | `release_file_reservations(...)` |
| Close bead | `br close <id> --reason "..."` |
| Send mail | `send_message(project_key=..., sender_name=..., to=[...], thread_id=..., topic=..., subject=..., body_md=...)` |
| Reply in thread | `reply_message(project_key=..., message_id=..., sender_name=..., body_md=...)` |
| Check inbox | `fetch_inbox(project_key=..., agent_name=..., topic=...)` |
| Check epic timeline | `fetch_topic(project_key=..., topic_name=...)` |

---

## Inputs You Receive from Swarming (Worker Mode)

When spawned, swarming provides (via coordination message or task prompt):

- `runtime_nickname` — your runtime nickname from the parent spawn result
- `coordinator_agent_name` — swarm coordinator identity
- `epic_thread_id` — the coordination thread for this feature (normally the epic bead ID)
- `epic_topic` — shared swarm topic tag (recommended: `epic-<EPIC_ID>`)
- `startup_hint` — optional: a bead or area the orchestrator wants checked first
- `feature_name` — used to locate `history/<feature>/CONTEXT.md`

You resolve `resolved_agent_mail_name` yourself during session registration with the coordination runtime.

If any of the startup inputs are missing, query the coordination runtime for the swarm coordination message before proceeding.
