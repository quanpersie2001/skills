---
name: preflight
description: Use when starting any Pulse workflow, resuming a Pulse session, or before planning or execution when tool readiness may block the flow. Validate required tools, choose full or degraded mode, and write the project tooling status before proceeding.
metadata:
  version: '1.1'
  ecosystem: pulse
  position: '0 - runs before using-pulse or any execution-capable phase'
  type: bootstrap
---

# Preflight

Validate runtime readiness before Pulse spends planning or execution effort.
Do not explore, plan, validate, swarm, or execute until this skill finishes.

## When to Use

- User says: "start Pulse", "run Pulse", "/go", "resume Pulse"
- Before any full Pulse workflow
- Before execution if tool availability is uncertain
- After environment changes: new machine, new shell, new repo clone, broken tooling

## What This Skill Produces

- `.pulse/tooling-status.json`
- `.pulse/STATE.md` update with the latest preflight result
- One of three outcomes: `PASS`, `DEGRADED`, or `FAIL`

Load `references/tool-readiness-matrix.md` before Phase 2.

## Hard Rules

1. Never assume a tool exists because a repo or prior session mentioned it.
2. Never report `PASS` without running a real minimal check for each required tool.
3. If a tool is optional, record it as unavailable but do not fail the run.
4. If a tool is required for the requested mode, block that mode explicitly.
5. If the result is `FAIL`, do not continue into planning or execution.
6. If the result is `DEGRADED`, present the downgrade clearly before proceeding.

## Phase 1: Establish Pulse State

1. Resolve the project root.
2. Ensure `.pulse/` exists. Create it if missing.
3. Ensure `.pulse/handoffs/` exists. Create it if missing.
4. Ensure `.pulse/STATE.md` exists. If missing, create:

```markdown
# STATE
focus: (none)
phase: preflight
last_updated: <timestamp>
```

5. Ensure `.pulse/handoffs/manifest.json` exists. If missing, create:

```json
{
  "schema_version": "1.0",
  "updated_at": "<ISO-8601>",
  "active": []
}
```

6. Detect whether `.pulse/handoffs/manifest.json` contains active resume entries. Record that resume data exists, but do not auto-resume.
7. Infer the requested mode:
   - `full-pipeline`
   - `planning-only`
   - `execution-only`
   - `resume`

## Phase 2: Validate Core Tooling

Check the tools that Pulse depends on structurally:

- `git`
- `br`
- `bv`

Use the smallest real checks that prove the tool is callable. Recommended checks:

```bash
command -v git
command -v br
command -v bv
git rev-parse --show-toplevel
br --help
bv --help
```

Rules:

- If `git` is missing or the project is not a git repo, result is `FAIL`
- If `br` is missing, result is `FAIL`
- If `bv` is missing, result is `FAIL`
- If a command exists but the minimal call errors, mark it unavailable
- If `br` or `bv` is unavailable, include the install references from `references/tool-readiness-matrix.md` in the failure report

## Phase 3: Validate Execution Runtime

If the requested mode can lead to execution, validate the coordination runtime.

Primary concern:

- Agent Mail or the Pulse-equivalent coordination runtime

Run the smallest real health check available in the current environment.
Examples vary by runtime:

- service health or status command
- a no-op auth check
- a lightweight mailbox or connection probe

If no real health-check primitive exists, mark coordination runtime as unavailable.
Do not infer readiness from environment variables alone.

Decision rules:

- If requested mode is `full-pipeline` and swarm execution is expected:
  - coordination ready -> keep `swarm`
  - coordination unavailable -> set result to `DEGRADED` and recommend `single-worker`
- If requested mode is `execution-only` and the user explicitly asked for swarm mode:
  - coordination unavailable -> stop and present the downgrade decision

## Phase 4: Validate Optional Accelerators

Check optional helpers if relevant:

- `gkg`
- PR tooling such as `gh`
- docs or web research MCPs

Optional tools never fail preflight on their own.
Record impact instead:

- `gkg` missing -> discovery falls back to grep/find/manual reads
- `gh` missing -> no automated PR creation
- docs or web MCP missing -> research becomes manual or local-only

## Phase 5: Decide Outcome

Choose exactly one result:

- `PASS`
  - all required tools for the requested mode are ready
- `DEGRADED`
  - core tools are ready
  - at least one optional capability is missing, or swarm must downgrade to single-worker
- `FAIL`
  - any required tool for the requested mode is unavailable

Also choose `recommended_mode`:

- `swarm`
- `single-worker`
- `planning-only`
- `blocked`

## Phase 6: Write Artifacts

Write `.pulse/tooling-status.json` with this shape:

```json
{
  "timestamp": "<ISO-8601>",
  "project_root": "<absolute path>",
  "requested_mode": "full-pipeline",
  "recommended_mode": "single-worker",
  "status": "degraded",
  "tools": {
    "git": { "status": "ready", "check": "git rev-parse --show-toplevel" },
    "br": { "status": "ready", "check": "br --help" },
    "bv": { "status": "ready", "check": "bv --help" },
    "coordination": { "status": "unavailable", "check": "<actual health check or 'none available'>" }
  },
  "blockers": [],
  "degradations": [
    "Coordination runtime unavailable; execution downgraded to single-worker"
  ],
  "next_skill": "pulse:using-pulse"
}
```

Update `.pulse/STATE.md` with:

```markdown
phase: preflight
preflight_status: PASS | DEGRADED | FAIL
requested_mode: <mode>
recommended_mode: <mode>
tooling_status: .pulse/tooling-status.json
resume_manifest: .pulse/handoffs/manifest.json
last_updated: <timestamp>
```

## Phase 7: Present Result

Use this response shape:

```text
PREFLIGHT COMPLETE

Status: PASS | DEGRADED | FAIL
Requested mode: <mode>
Recommended mode: <mode>

Ready:
- <tool>
- <tool>

Missing or degraded:
- <tool> -> <impact>

Next:
- If PASS or DEGRADED: invoke pulse:using-pulse
- If FAIL: fix blockers before continuing
```

## Handoff

- `PASS` -> "Preflight complete. Pulse is ready. Invoke `pulse:using-pulse`."
- `DEGRADED` -> "Preflight complete with downgrade. Confirm the downgraded mode, then invoke `pulse:using-pulse`."
- `FAIL` -> "Preflight failed. Do not continue into Pulse flow until blockers are cleared."

## Red Flags

- Marking `PASS` without running actual checks
- Treating coordination runtime as optional in swarm mode
- Continuing after `FAIL`
- Hiding degraded mode from the user
- Reusing stale `.pulse/tooling-status.json` without refreshing it
- Using environment hints instead of real tool invocations

## References

- `references/tool-readiness-matrix.md`
- `../pulse:using-pulse/references/handoff-contract.md`
