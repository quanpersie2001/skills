# AGENTS.md — Pulse Skill Ecosystem

Read this file at every session start. Re-read after any context compaction.

## What is Pulse?

A multi-skill ecosystem for agentic software development, built on the Flywheel toolchain (beads/bv/Agent Mail). Skills chain together to move from vague requirements to shipped, reviewed, compounded code.

## Skill Catalog

| Skill | Purpose | Invoke When |
|-------|---------|-------------|
| `pulse:using-pulse` | Bootstrap/meta — routing, go mode, state bootstrap | Session start, "build feature X" |
| `pulse:preflight` | Tool readiness, mode selection, project tooling status | Before planning or execution |
| `pulse:exploring` | Extract decisions via Socratic dialogue → CONTEXT.md | New feature, unclear requirements |
| `pulse:planning` | Research + synthesis + bead creation → approach.md + beads | After exploring, with CONTEXT.md |
| `pulse:validating` | Plan verification + spikes + bead polishing — THE GATE | After planning, before execution |
| `pulse:swarming` | Launch + tend parallel worker agents | After validating approves beads |
| `pulse:executing` | Per-agent worker loop (register → implement → close) | Loaded by workers spawned by swarming |
| `pulse:reviewing` | Specialist reviewers + 3-level verification + UAT + finishing | After swarming completes all beads |
| `pulse:compounding` | Capture learnings → history/learnings/ | After reviewing, always |
| `pulse:writing-pulse-skills` | TDD-for-skills meta-skill | Creating/improving pulse skills |

### Support Skills

| Skill | Purpose |
|-------|---------|
| `pulse:debugging` | Systematic debugging when workers hit blockers |
| `pulse:gkg` | Codebase intelligence via gkg tool |
| `pulse:dream` | Manual dream consolidation over Codex artifacts |

## The Chain

```
pulse:preflight → pulse:using-pulse → pulse:exploring → pulse:planning → pulse:validating → pulse:swarming → pulse:executing(×N) → pulse:reviewing → pulse:compounding
```

## Go Mode Gates

- **GATE 1** (after exploring): "Approve decisions/CONTEXT.md?"
- **GATE 2** (after validating): "Beads verified. Approve execution?"
- **GATE 3** (after reviewing): "P1 findings. Fix before merge?"

## Core Tools

- `br` — beads CLI (create/update/close work items)
- `bv` — beads viewer (graph analytics, priority routing)
- Agent Mail — inter-agent messaging, file reservations
- `gkg` — codebase intelligence (optional)
- CASS/CM — session search, cognitive memory (optional)

## File Conventions

```
.pulse/STATE.md                 ← Working memory
.pulse/config.json              ← Feature toggles (absent=enabled)
.pulse/tooling-status.json      ← Preflight result + recommended mode
.pulse/handoffs/manifest.json   ← Owner-scoped handoff index
.pulse/handoffs/*.json          ← Per-owner pause/resume state
.pulse/verification/            ← Execution evidence artifacts
history/<feature>/              ← Per-feature artifacts
history/learnings/              ← Accumulated knowledge
.beads/                         ← Bead files
.spikes/                        ← Spike verification results
```

## Critical Rules

1. **Never execute without validating.** GATE 2 is non-negotiable.
2. **CONTEXT.md is the source of truth.** All downstream agents honor locked decisions.
3. **Context budget: >65% → write an owner-scoped handoff and register it in `.pulse/handoffs/manifest.json`.**
4. **After compaction: re-read this file + CONTEXT.md immediately.**
5. **P1 findings always block merge.** Even in go mode.

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
