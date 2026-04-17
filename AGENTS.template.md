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
| `pulse:compounding` | Capture learnings → .pulse/memory/learnings/ | After reviewing, always |
| `pulse:writing-pulse-skills` | TDD-for-skills meta-skill | Creating/improving pulse skills |

### Support Skills

| Skill | Purpose |
|-------|---------|
| `pulse:debugging` | Systematic debugging when workers hit blockers |
| `pulse:gkg` | Codebase intelligence via gkg tool |
| `pulse:dream` | Manual dream consolidation over Claude Code or Codex runtime artifacts |

## The Chain

```
pulse:preflight → pulse:using-pulse → pulse:exploring → pulse:planning → pulse:validating → pulse:swarming → pulse:executing(×N) → pulse:reviewing → pulse:compounding
```

## Go Mode Gates

- **GATE 1** (after exploring): approve `CONTEXT.md` before planning
- **GATE 2** (after planning): approve the phase plan before current-phase preparation
- **GATE 3** (after validating): approve execution before swarming or single-worker execution
- **GATE 4** (after reviewing): approve merge; P1 findings block this gate

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
history/<feature>/verification/      ← Canonical verification evidence
.pulse/memory/                  ← Shared reusable memory root
history/<feature>/              ← Per-feature artifacts
.beads/                         ← Bead files
.spikes/                        ← Spike verification results
```

## Critical Rules

1. **Never execute without validating.** GATE 3 is non-negotiable.
2. **CONTEXT.md is the source of truth.** All downstream agents honor locked decisions.
3. **Context budget: >65% → write an owner-scoped handoff and register it in `.pulse/handoffs/manifest.json`.**
4. **After compaction: re-read this file + CONTEXT.md immediately.**
5. **P1 findings always block merge.** Even in go mode.

---

## MCP Agent Mail — Multi-Agent Coordination

Agent Mail is the MCP-based messaging and file-reservation layer that enables Pulse swarm workers to coordinate without conflicts.

### Why Agent Mail?

- **Prevents conflicts.** File reservations stop two workers from editing the same file simultaneously.
- **Token-efficient.** Workers read only their inbox and topic threads instead of scanning shared state files.
- **Quick reads.** Coordinators poll structured inboxes instead of parsing free-form logs.

### Same Repository Workflow

When multiple agents operate in the same repository:

1. **Register** — each agent registers a unique identity with the project.
2. **Reserve files** — before editing, a worker requests exclusive access to the files listed in its bead's `files` field.
3. **Communicate** — use topic threads (typically `epic-<EPIC_ID>`) for broadcasts and direct messages for point-to-point coordination.

Canonical operations (runtime names may differ):

| Operation | Purpose |
|-----------|---------|
| `ensure_project` | Register or confirm the project exists |
| `register_agent` | Register the current agent identity |
| `send_message` | Post a message to a topic or direct recipient |
| `fetch_inbox` | Read messages addressed to this agent |
| `fetch_topic` | Read all messages on a topic thread |
| `file_reservation_paths` | Reserve or release file paths |

### Quick Reads

- Inbox: `fetch_inbox` — messages sent directly to this agent
- Topic: `fetch_topic("epic-<EPIC_ID>")` — all broadcast messages for the epic
- Reservations: `file_reservation_paths` — current file locks

### Macros vs Granular Tools

Some runtimes expose high-level macros (e.g., a single "spawn worker" call). Others expose only granular primitives. Pulse skills reference the canonical operations above. If your runtime uses different names, keep the behavior, not the spelling.

### Common Pitfalls

- **Forgetting to release files.** Always release reservations after closing a bead or pausing.
- **Polling too aggressively.** Check inboxes at natural checkpoints (after each bead, before each new bead), not in tight loops.
- **Ignoring topic history.** When resuming, read the full topic thread to catch decisions made while you were paused.
- **Registering duplicate identities.** Use a stable agent name per worker across pause/resume cycles.

---

<!-- bv-agent-instructions-v1 -->

## Beads Workflow Integration

This project uses [beads_rust](https://github.com/Dicklesworthstone/beads_rust) for issue tracking. Issues are stored in `.beads/` and tracked in git.

**Important:** `br` is non-invasive — it NEVER runs git commands automatically. After `br sync --flush-only`, you must manually run `git add .beads/ && git commit`.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
br ready              # Show issues ready to work (no blockers)
br list --status=open # All open issues
br show <id>          # Full issue details with dependencies
br create --title="..." --type=task --priority=2
br update <id> --status=in_progress
br close <id> --reason="Completed"
br close <id1> <id2>  # Close multiple issues at once
br sync --flush-only  # Flush bead changes to disk (does NOT run git)
```

### Workflow Pattern

1. **Start**: Run `br ready` to find actionable work
2. **Claim**: Use `br update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `br close <id>`
5. **Sync**: Always run `br sync --flush-only` then manually commit at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `br dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status                # Check what changed
git add <files>           # Stage code changes
br sync --flush-only      # Flush bead changes to disk
git add .beads/           # Stage bead changes
git commit -m "..."       # Commit code + beads together
git push                  # Push to remote
```

### Best Practices

- Check `br ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `br create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `br sync --flush-only` then `git add .beads/ && git commit` before ending session

<!-- end-bv-agent-instructions -->

---

## Beads Viewer (bv) — Graph-Aware Triage Engine

`bv` is the graph-aware viewer and analytics engine for the bead dependency graph. It provides TUI mode for humans and structured robot-output mode for agents.

> **Scope boundary:** `bv` reads and analyzes the bead graph. It does not create, update, or close beads — use `br` for mutations.

### CRITICAL: Use ONLY `--robot-*` Flags

In automated or agent sessions, never launch the TUI. Always use robot-output flags that return structured JSON:

```bash
bv --robot-triage              # Prioritized triage of actionable work
bv --robot-priority            # Priority-ranked list of all beads
bv --robot-suggest             # Dependency suggestions and fixes
bv --robot-insights            # Graph health analysis
bv --robot-triage --graph-root <ID>  # Scoped to a specific epic/subtree
```

### The Workflow: Start With Triage

Every planning, validation, or execution session should begin with:

```bash
bv --robot-triage
```

This returns the most actionable view: beads sorted by priority with dependency status, blockers surfaced, and ready work highlighted.

### Command Reference

#### Planning Commands

| Command | Purpose |
|---------|---------|
| `bv --robot-triage` | Actionable work, sorted by priority, blockers surfaced |
| `bv --robot-priority` | All beads ranked by priority score |
| `bv --robot-suggest` | Suggested dependency additions or fixes |

#### Graph Analysis Commands

| Command | Purpose |
|---------|---------|
| `bv --robot-insights` | Graph health: cycles, bottlenecks, orphans, disconnected clusters |
| `bv --robot-triage --graph-root <ID>` | Triage scoped to a specific epic subtree |

#### History Commands

| Command | Purpose |
|---------|---------|
| `bv --robot-triage --include-closed` | Include closed beads in triage output |
| `bv --robot-priority --include-closed` | Full priority list including closed work |

#### Other Commands

| Command | Purpose |
|---------|---------|
| `bv --help` | Full flag reference |
| `bv` | Launch TUI (humans only, never in agent sessions) |

### Scoping & Filtering

Scope triage to a specific epic or subtree:

```bash
# Triage only beads under a specific epic
bv --robot-triage --graph-root EPIC-001

# Priority ranking within a subtree
bv --robot-priority --graph-root EPIC-001

# Insights for a specific subgraph
bv --robot-insights --graph-root EPIC-001
```

### Understanding Robot Output

All `--robot-*` commands return JSON. Key fields:

- `id` — bead identifier
- `title` — human-readable summary
- `status` — open, in_progress, closed, blocked
- `priority` — numeric (P0-P4)
- `dependencies` — list of upstream bead IDs
- `blockers` — unresolved blocking beads
- `files` — file paths in scope

### jq Quick Reference

```bash
# List IDs of all ready beads
bv --robot-triage | jq -r '.[] | select(.status == "open" and (.blockers | length == 0)) | .id'

# Count open beads by priority
bv --robot-priority | jq 'group_by(.priority) | map({priority: .[0].priority, count: length})'

# Find beads touching a specific file
bv --robot-priority | jq -r '.[] | select(.files[]? | contains("src/auth")) | .id'

# List all blocked beads and what blocks them
bv --robot-triage | jq '.[] | select(.blockers | length > 0) | {id, blockers}'
```

---

## Landing the Plane (Session Completion)

Every session must end cleanly. Before stopping, run through this mandatory workflow:

### 1. File Issues

Create beads for any discovered work that was not completed:

```bash
br create --title="<description>" --type=task --priority=<N>
```

### 2. Quality Gates

Confirm that no P1 findings remain unresolved:

```bash
bv --robot-triage | jq '.[] | select(.priority == 0 or .priority == 1) | select(.status != "closed")'
```

If P1 items remain open, they block merge. Fix or escalate before ending.

### 3. Update Status

Update `.pulse/STATE.md` with current phase, completed work, and any open blockers.

### 4. Sync Beads

```bash
br sync --flush-only
git add .beads/
git commit -m "sync beads"
```

### 5. Hand Off

If context budget is near 65%:

1. Write an owner-scoped handoff to `.pulse/handoffs/<owner>.json`
2. Register it in `.pulse/handoffs/manifest.json`
3. Update `.pulse/STATE.md` with handoff reference

If the session is the final session for a feature:

1. Ensure all beads are closed or intentionally deferred
2. Run `pulse:compounding` to capture learnings
3. Push all changes: `git push`

---

## CASS — Cross-Agent Session Search

CASS (Cross-Agent Session Search) lets you find information from previous agent sessions. Use it to recover decisions, find prior approaches, or locate work done in earlier contexts.

### Examples

```bash
# Find sessions that worked on authentication
cass search "authentication login JWT"

# Find sessions that modified a specific file
cass search "src/auth/middleware.ts"

# Find sessions related to a specific bead
cass search "BEAD-042"
```

### Tips

- Use specific terms: file paths, bead IDs, feature names, error messages.
- Combine multiple search terms for narrower results.
- CASS indexes session transcripts, not code. It finds what agents discussed, not what they wrote.

### Usage Rules

- CASS is optional. If unavailable, fall back to reading `history/` and `.pulse/` artifacts directly.
- Do not use CASS as a substitute for reading `CONTEXT.md` or `STATE.md` — those are always the source of truth.
- CASS results are hints, not authoritative. Always verify findings against the current codebase state.

---

## Memory System: cass-memory

`cass-memory` (also called `cm`) is the persistent cognitive memory layer. It stores and retrieves durable knowledge across sessions — patterns, preferences, project-specific rules, and accumulated context.

### Quick Start

```bash
# Store a memory
cm store "br is the beads CLI binary, not bd"

# Recall memories relevant to a topic
cm recall "beads CLI commands"

# List recent memories
cm list --recent
```

### Protocol

1. **Store early.** When you discover a non-obvious fact, project convention, or user preference, store it immediately.
2. **Recall before assuming.** At session start or when entering unfamiliar territory, recall relevant memories before guessing.
3. **Trust but verify.** Memories may be stale. Cross-check recalled facts against the current codebase.

### Key Flags

| Flag | Purpose |
|------|---------|
| `--recent` | Show most recently stored memories |
| `--tag <tag>` | Filter by tag |
| `--context <text>` | Provide context for smarter recall |

### Rules

- `cass-memory` is optional. If unavailable, rely on `.pulse/memory/` and `.pulse/STATE.md`.
- File-based learnings under `.pulse/memory/` remain the canonical source of truth for compounded knowledge. `cass-memory` is a convenience index, not a replacement.
- Do not store secrets, credentials, or tokens in memory.
