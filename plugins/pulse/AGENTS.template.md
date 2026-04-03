<!-- PULSE:START -->
# Pulse Workflow

Use `pulse:using-pulse` first in this repo unless you are resuming an already approved Pulse handoff.

## Startup

1. Read this file at session start and again after any context compaction.
2. If `.pulse/onboarding.json` is missing or outdated, stop and run `pulse:using-pulse` before continuing.
3. If `.codex/pulse_status.mjs` exists, use `node .codex/pulse_status.mjs --json` for a fast read-only status snapshot.
4. If `.pulse/handoffs/manifest.json` exists, do not auto-resume. Surface the saved state and wait for user confirmation.
5. If `history/learnings/critical-patterns.md` exists, read it before planning or execution work.

## Chain

```
pulse:preflight
  → pulse:using-pulse
  → pulse:exploring
  → pulse:planning
  → pulse:validating
  → pulse:swarming
  → pulse:executing
  → pulse:reviewing
  → pulse:compounding
```

## Critical Rules

1. Never execute without validating.
2. `CONTEXT.md` is the source of truth for locked decisions.
3. If context usage passes roughly 65%, write `.pulse/handoffs/manifest.json` and pause cleanly.
4. After compaction, re-read `AGENTS.md`, `.pulse/handoffs/manifest.json` if present, `.pulse/STATE.md`, and the active feature context before more work.
5. P1 review findings block merge.

## Working Files

```
.pulse/
  onboarding.json     ← onboarding state for the Pulse plugin
  state.json          ← machine-readable routing/status mirror
  STATE.md            ← current phase and focus
  handoffs/
    manifest.json     ← pause/resume artifact

history/<feature>/
  CONTEXT.md          ← locked decisions
  discovery.md        ← research findings
  approach.md         ← approach + risk map

history/learnings/
  critical-patterns.md

.beads/               ← bead/task files when beads are in use
.spikes/              ← spike outputs when validation requires them
```

## Codex Guardrails

- Repo-local `.codex/` files installed by Pulse are workflow guardrails, not optional decoration.
- Treat `compact_prompt` recovery instructions as mandatory.
- Use `bv` only with `--robot-*` flags. Bare `bv` launches the TUI and should be avoided in agent sessions.
- If the repo is only partially onboarded, stay in bootstrap/planning mode and surface what is missing before implementation.

## Session Finish

Before ending a substantial Pulse work chunk:

1. Update or close the active bead/task if one exists.
2. Leave `.pulse/STATE.md` and `.pulse/handoffs/` consistent with the current pause/resume state.
3. Mention any remaining blockers, open questions, or next actions in the final response.
<!-- PULSE:END -->
