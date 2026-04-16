# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

Pulse is a packaged skill plugin for Claude Code and Codex. It's a documentation-centric project — skills are defined as SKILL.md files, not compiled code. The repo ships 20 skills that chain together to move from vague requirements to shipped, reviewed, compounded code.

## Repository Layout

- `plugins/pulse/skills/` — canonical source for all skill definitions (each skill is a `SKILL.md` file in its own directory)
- `plugins/pulse/.codex-plugin/plugin.json` — Codex plugin manifest
- `plugins/pulse/.mcp.json` — packaged MCP manifest for shared runtime servers
- `.agents/plugins/marketplace.json` — Codex marketplace metadata
- `scripts/sync-skills.sh` — raw skill mirror helper for agents/Claude compatibility
- `AGENTS.md` — workflow rules and bead integration (re-read after context compaction)
- `references/` — upstream/pedagogical material (Superpowers, AI Multimodal, Khuym lineage docs); not part of the shipping plugin

## Key Tools

| Tool | CLI | Purpose |
|------|-----|---------|
| Beads CLI | **`br`** (not `bd`) | Create, update, close, sync work items |
| Beads viewer | `bv` | TUI and graph inspection |
| Git | `git` | Version control |
| Agent Mail | — | Worker orchestration (swarm mode only) |
| GKG | `gkg` | Optional codebase intelligence |

**Important:** The beads CLI binary is `br`. Use `br` in Pulse workflows and examples.

## Delivery Chain

The core workflow is a gated, linear pipeline:

```
pulse:preflight → pulse:using-pulse → pulse:exploring → pulse:planning → pulse:validating → pulse:swarming → pulse:executing(×N) → pulse:reviewing → pulse:compounding
```

Four human gates control progression:
- **GATE 1** (after exploring): Approve `CONTEXT.md`
- **GATE 2** (after planning): Approve `phase-plan.md`
- **GATE 3** (after validating): Approve execution — never skip this
- **GATE 4** (after reviewing): P1 findings must be fixed before merge approval

## Artifact Locations

```
.pulse/tooling-status.json           ← preflight writes this
.pulse/state.json                    ← machine-readable routing mirror
.pulse/STATE.md                      ← shared state across phases
.pulse/handoffs/manifest.json        ← owner-scoped pause/resume index
.pulse/runs/<feature>/verification/ ← active execution/review evidence
history/<feature>/verification/      ← promoted durable verification evidence
history/<feature>/CONTEXT.md         ← exploring output (source of truth for decisions)
history/<feature>/approach.md        ← planning synthesis
.beads/                              ← bead files (planning creates, executing closes)
.spikes/                             ← spike verification results
.pulse/memory/                      ← shared reusable memory output
```

## Editing Skills

Each skill lives at `plugins/pulse/skills/<name>/SKILL.md`. When adding or modifying a skill:

1. The SKILL.md is the entire skill definition — there's no separate code to compile.
2. Skills are auto-discovered — no per-skill registration needed in manifests.
3. Use `pulse:writing-pulse-skills` for TDD-style skill development.

## Testing

The main Pulse plugin has no automated test suite. The only test infrastructure is in `references/superpowers/tests/brainstorm-server/` (Node.js, `npm test`), which is reference material and not part of the shipping plugin.

## Session Protocol

```bash
git status              # Check what changed
git add <files>         # Stage code changes
br sync                 # Commit beads changes
git commit -m "..."     # Commit code
br sync                 # Commit any new beads changes
git push                # Push to remote
```
