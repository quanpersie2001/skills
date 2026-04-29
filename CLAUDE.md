# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

Pulse is a packaged skill plugin for Claude Code and Codex. It's a documentation-centric project — skills are defined as SKILL.md files, not compiled code. The repo ships 23 skills that chain together to move from vague requirements to shipped, reviewed, compounded code.

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
| GitNexus | `gitnexus` | Optional graph-backed codebase intelligence |

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
history/<feature>/verification/      ← canonical verification evidence
history/<feature>/CONTEXT.md         ← exploring output (source of truth for decisions)
history/<feature>/approach.md        ← planning synthesis
history/<feature>/lifecycle-summary.md ← durable audit summary for gates/outcomes/follow-up debt
                                       ← contract: using-pulse/references/history-lifecycle-contract.md
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

Pulse has automated coverage for onboarding/runtime control-plane behavior in `plugins/pulse/skills/using-pulse/scripts/test_onboard_pulse.mjs`. The `references/superpowers/tests/brainstorm-server/` suite is separate reference material and not part of the shipping plugin.

## Session Protocol

```bash
git status              # Check what changed
git add <files>         # Stage code changes
br sync --flush-only   # Flush bead changes to disk
git commit -m "..."     # Commit code
br sync --flush-only   # Flush any new bead changes to disk
git push                # Push to remote
```

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **pulse** (3155 symbols, 4322 relationships, 132 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/pulse/context` | Codebase overview, check index freshness |
| `gitnexus://repo/pulse/clusters` | All functional areas |
| `gitnexus://repo/pulse/processes` | All execution flows |
| `gitnexus://repo/pulse/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
