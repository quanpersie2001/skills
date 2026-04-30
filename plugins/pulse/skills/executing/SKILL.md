---
name: executing
description: >-
  Per-agent implementation loop for the Pulse ecosystem. Use in two modes: worker mode
  under pulse:swarming, or degraded standalone single-worker mode when preflight does not
  allow a swarm. Implements the bead loop, verification discipline, coordination reporting,
  and safe pause/resume behavior.
metadata:
  version: '1.4'
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

### 1a. Restore Worker Bootstrap Context (worker mode only)

Swarming gives you runtime-native startup context. Capture and keep these fields together for the rest of the run:

- `runtime_identity`
- `coordinator_identity`
- `adapter_name`
- `epic_id`
- `feature_name`
- optional `startup_hint`

Treat `startup_hint` as a hint, not a silent permanent assignment. Re-check the live graph before you claim work.

Do not invent extra registration, inbox, or topic mechanics if the active runtime does not use them.

### 1b. Read Project Context (in this order)

1. **AGENTS.md** — project operating manual (mandatory; skip nothing)
2. If present, run **`node .codex/pulse_status.mjs --json`** — quick onboarding/state/handoff/reservation scout
3. **.pulse/state.json** — machine-readable routing snapshot
4. **.pulse/STATE.md** — current project focus, decisions, active blockers
5. **history/<feature>/CONTEXT.md** — locked decisions that MUST be honored

If any of these files does not exist, note the absence and proceed — do not fabricate content.

If the bead references `learning_refs`, read those specific learning files. Do not load all learnings by default.

### 1c. Report `[ONLINE]` Before Claiming Work (worker mode only)

Before you select a bead, you must report in on the active coordination surface. Startup is not complete until you:

1. read `AGENTS.md`
2. load `pulse:executing`
3. post `[ONLINE]` including:
   - `runtime_identity`
   - `AGENTS.md: read`
   - `pulse:executing: loading`
   - `Next step: bv --robot-priority`

Do not call `bv --robot-priority` before this sequence is complete.

Runtime mapping:
- Claude Code -> send the startup acknowledgment to the coordinator with `SendMessage`
- Codex -> reply on the parent coordination thread
- otherwise -> use the active coordination surface defined by the runtime adapter

### 1d. Check for Handoff

Use owner-scoped handoffs:

- worker mode -> `.pulse/handoffs/worker-<runtime_identity>.json`
- standalone mode -> `.pulse/handoffs/single-worker.json`

If a handoff exists and was written by a prior instance of you (same worker identity):

1. Read it — restore active bead, progress markers, open questions
2. Resume from where it stopped; skip re-reading already-read files
3. Archive or mark the handoff consumed and update the manifest

---

## Step 2: Get the Next Bead

In worker mode, every loop starts with coordination visibility, not blind bead selection.

Check the active coordination surface for:
- new coordinator instructions
- unresolved blocker replies
- conflict decisions
- handoff or recovery instructions that affect your next move

Then follow the normal path from the live graph:

```bash
bv --robot-priority
```

Select the top-ranked bead that:

- has no open dependencies
- is not reserved by another worker
- is compatible with the current mode

### Exceptional path: direct orchestrator hint

If swarming suggests a bead via the active coordination surface, treat it as a startup hint or rescue instruction, not as a permanent assignment. Re-check the live graph before claiming the work.

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

### Phase-artifact read rule for non-trivial beads

Do not rely on the bead alone when the work is architecturally or operationally sensitive.

Before reserving files or writing code, read `history/<feature>/phase-<n>-contract.md` and `history/<feature>/phase-<n>-story-map.md` if any of these are true:

- `testing_mode` is `tdd-required`
- the bead touches multiple files across different modules or ownership boundaries
- the bead has multiple upstream dependencies or explicitly references story coordination, parallelism, shared file/context risk, or boundary preservation
- the `verify` path is multi-step, integration-heavy, or hard to explain in one line from the bead alone
- after reading the bead, more than one plausible implementation path still seems possible

For beads that touch module interfaces, ownership boundaries, or HIGH-risk constraints, also read the relevant parts of `history/<feature>/approach.md`.

If the bead is a small single-path change with tight file scope, unambiguous verification, and no boundary sensitivity, the bead plus `CONTEXT.md` is usually sufficient.

---

## Step 3: Reserve Files

In worker mode, reserve all listed files before editing with the shared repo-local helper.

Repeat `--path` for every declared file or glob you need to claim:

```bash
node .codex/pulse_reservations.mjs reserve --agent <runtime_identity> --bead <bead-id> --path "src/foo.ts" --path "src/bar.ts" --json
```

In standalone mode, there is no cross-worker race, but still treat the bead's `files` list as a hard scope boundary. Do not blend multiple beads into one ad hoc change, and do not sneak in temporary cross-module structure that was not planned.

### If reservation fails in worker mode

1. Post `[FILE CONFLICT]` immediately on the active coordination surface
2. Include:
   - bead ID
   - requested paths
   - current holder when visible
   - why you need the scope
3. Wait for coordinator resolution
4. Keep watching the active coordination surface while blocked

Do not proceed without your reservations.
Do not edit around the conflict.

### If reservation succeeds

Proceed to implementation immediately.

---

## Step 4: Implement

### Read before writing

Read every source file you will modify. Do not write from memory or assumptions about file contents.

### Honor CONTEXT.md locked decisions

Before writing any code, scan your bead's description for decision IDs (D1, D2, ...). For each referenced ID:
1. Read the corresponding entry in `history/<feature>/CONTEXT.md`
2. Implement exactly as locked — do not reinterpret, do not "improve" a locked decision

### State assumptions before coding

Before you change a file, say what you believe is true:
- which existing path or component you are extending
- what the bead is explicitly asking you to preserve or change
- which phase exit-state or story done condition this bead advances when phase artifacts were required
- what will prove success once verification runs

If two plausible interpretations remain, stop. Surface the ambiguity explicitly and get the bead repaired or clarified instead of guessing in code.

### Follow existing patterns

Match naming conventions, error handling patterns, import styles, and test structures found in the codebase.

For new feature beads, do not invent temporary architecture just to get a first phase over the line. Preserve the planned module ownership, interfaces, and cross-module contracts from `CONTEXT.md`, `approach.md`, and the phase artifacts.

### Keep the change surgical

Prefer the smallest change that satisfies the bead.

Do not:
- introduce abstractions that only help hypothetical future work
- broaden scope into adjacent cleanup or refactors just because you noticed them
- add handling for scenarios the current system boundary cannot actually produce

If the bead genuinely requires multiple implementation steps, write a short step plan tied to the declared verification path before you start editing. If it is a one-step change, keep the plan in your head and the code lean.

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

Before you run them, be able to say what success looks like in one or two lines. If you cannot, the bead is still under-specified and should be clarified instead of hand-waved through execution.

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
2. compare the failure against the success criteria you named before verification
3. retry up to 2 times
4. if still blocked:
   - worker mode -> notify the coordinator on the active coordination surface and stay blocked until the situation is resolved
   - standalone mode -> invoke `pulse:systematic-debug-fix` or surface the blocker to the user

Do not quietly redefine success after a failing verify run. Either make the bead pass as written or escalate that the bead itself needs repair.

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

```bash
node .codex/pulse_reservations.mjs release --agent <runtime_identity> --json
```

Release **before** sending the completion report so other agents can acquire these files immediately.

### 6e. Send completion report (worker mode) or record completion (standalone)

Worker mode: post `[DONE]` on the active coordination surface.

Include:
- bead ID
- worker runtime identity
- commit hash
- short implementation summary
- files modified
- verification status
- verification evidence path or paths
- any scoped follow-up that still needs a new bead

Standalone mode: record completion in `.pulse/STATE.md`.

### 6f. Check coordination once after reporting (worker mode)

Before you claim the next bead, inspect the active coordination surface once for new instructions, blocker resolutions, or reservation-related follow-ups.

---

## Step 7: Loop or Pause

After each bead:

- if context is below 65%, loop back to Step 2
- if context is at or above 65%, write the owner handoff file and stop cleanly

### Writing the handoff

Use the standard handoff summary/resume briefing/transfer block contract from `pulse:using-pulse`. Treat this pause boundary as a checkpoint trigger: capture or refresh the feature checkpoint before stopping when the current phase meaningfully changed.

Worker mode handoff payload (write to `.pulse/handoffs/worker-<runtime_identity>.json`):

```json
{
  "schema_version": "2.0",
  "handoff_id": "worker-<runtime_identity>-<ISO-8601>",
  "owner_type": "worker",
  "owner_id": "worker-<runtime_identity>",
  "skill": "pulse:executing",
  "feature": "<feature>",
  "phase": "execution/<EPIC_ID>",
  "status": "ready_to_resume",
  "paused_at": "<ISO timestamp>",
  "reason": "context_critical",
  "next_action": "Check the latest coordinator updates, then run bv --robot-priority before claiming more work.",
  "read_first": [
    "AGENTS.md",
    ".pulse/STATE.md",
    "history/<feature>/CONTEXT.md",
    ".pulse/handoffs/worker-<runtime_identity>.json"
  ],
  "summary": "Worker paused cleanly because context is near the limit. The next turn should restore coordination state, confirm the live graph, and continue from the highest-priority executable bead.",
  "payload": {
    "runtime": {
      "runtime_identity": "<runtime_identity>",
      "coordinator_identity": "<coordinator_identity>",
      "adapter_name": "<adapter_name>",
      "epic_id": "<EPIC_ID>",
      "feature_name": "<feature_name>"
    },
    "context_snapshot": {
      "tokens_used_pct": 0.67,
      "last_bead_closed": "<bead-id or null>"
    },
    "transfer": {
      "status": "Worker is paused safely and no longer editing files.",
      "completed": [
        "Closed bead <bead-id> and posted the completion report"
      ],
      "in_flight": [
        "No bead currently claimed; resume from the live graph after checking coordination updates"
      ],
      "blockers": [],
      "resume_notes": [
        "Inspect the active coordination surface before selecting work",
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

Worker mode: notify the coordinator after writing the handoff on the active coordination surface.

---

## Step 8: Post-Compact Recovery

**If you detect context compaction** (your conversation was summarized, or you notice gaps in your context):

**STOP immediately. Do not continue implementing.**

Re-read in this exact order before any further action:

1. `AGENTS.md`
2. `history/<feature>/CONTEXT.md`
3. the current bead you were working on: `br show <bead-id>`
4. if the bead qualifies as non-trivial under Step 2, re-read `history/<feature>/phase-<n>-contract.md` and `history/<feature>/phase-<n>-story-map.md`, plus `history/<feature>/approach.md` when boundary-sensitive or HIGH-risk
5. your active file reservations: `node .codex/pulse_reservations.mjs list --active-only --json`
6. the latest relevant coordinator updates on the active coordination surface

Only after re-reading all applicable items may you continue.

**Why this is non-negotiable:** Compaction erases knowledge of `AGENTS.md`, active reservations, and locked decisions. Agents that skip this step produce implementations that conflict with other workers and violate `CONTEXT.md` decisions.

---

## Red Flags

Stop and reassess if you notice any of these:

- **Executing without reading the bead file fully**
- **Executing a bead that is missing canonical schema fields**
- **Writing files outside your reserved scope** — you are creating conflicts for other workers
- **Skipping verification** — `it looks right` is not verification; run the actual criteria
- **Claiming success from stale or partial verification output**
- **Closing a bead without a substantive `verification_evidence` record**
- **Claiming `tdd-required` was satisfied without a real red failure and green pass**
- **Continuing after compaction without re-reading** — you have amnesia; fix it before proceeding
- **Implementing stubs, TODOs, or empty handlers** — these are not implementations; they are deferred failures
- **Ignoring a locked decision from CONTEXT.md**
- **Skipping required phase-contract/story-map reads for a non-trivial bead** — you are forcing execution to guess phase meaning and story intent
- **Guessing through ambiguity instead of surfacing it** — hidden design choices belong back in planning/validation, not in worker code
- **Bundling multiple beads into one commit** — atomic commits per bead are the audit trail; don't corrupt it
- **Claiming a bead without checking reservations** — self-routing still depends on file coordination
- **Closing or blocking a bead without reporting on the active coordination surface** — invisible progress breaks the swarm
- **Waiting silently for the coordinator** — if you are blocked, conflicted, handing off, or done, report it
- **Reading the entire learnings corpus instead of the bead's cited learning refs**
- **Writing the retired global handoff file**

---

## Quick Reference: Worker Actions

| Action | Call |
|--------|------|
| Get priority bead | `bv --robot-priority` |
| Read bead | `br show <id>` |
| Reserve files | `node .codex/pulse_reservations.mjs reserve --agent <runtime_identity> --bead <bead-id> --path "..." --json` |
| Release files | `node .codex/pulse_reservations.mjs release --agent <runtime_identity> --json` |
| Inspect reservations | `node .codex/pulse_reservations.mjs list --active-only --json` |
| Close bead | `br close <id> --reason "..."` |
| Send `[ONLINE]` / `[DONE]` / `[BLOCKED]` / `[FILE CONFLICT]` / `[HANDOFF]` | active coordination surface |

---

## Inputs You Receive from Swarming (Worker Mode)

When spawned, swarming provides:

- `runtime_identity` — your runtime identity from the parent spawn result
- `coordinator_identity` — swarm coordinator identity
- `adapter_name` — `claude-code` or `codex`
- `epic_id` — the coordination root for this feature
- `feature_name` — used to locate `history/<feature>/CONTEXT.md`
- `startup_hint` — optional: a bead or area the orchestrator wants checked first

If any startup inputs are missing, request clarification on the active coordination surface before proceeding.
