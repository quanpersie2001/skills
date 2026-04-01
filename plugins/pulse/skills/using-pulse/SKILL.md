---
name: using-pulse
description: Bootstrap meta-skill for the Pulse agentic development ecosystem. Load after pulse:preflight on any Pulse project. Lists the Pulse skills with routing logic, full go-mode flow with 4 human gates, lightweight quick mode, priority rules, resume handling, and shared state contracts.
metadata:
  version: '2.1'
  ecosystem: pulse
---

# using-pulse

Bootstrap meta-skill. Load this after `pulse:preflight`. It tells you which Pulse skill to invoke next, how the phases chain together, and how Pulse pauses and resumes safely.

## Plugin Onboarding

Before any normal bootstrap, verify that the current repo is onboarded for the Pulse plugin.

Requires **Node.js 18+**. Run `node scripts/onboard_pulse.mjs --repo-root <repo-root>` from this skill directory and inspect the JSON result.

- If `status = "up_to_date"`: proceed immediately.
- If `status = "missing_runtime"`: Node.js 18+ is not available -- ask the user to install it before continuing.
- If onboarding is missing or stale:
  - summarize what the script wants to create or update
  - if `requires_confirmation = true`, explain that an existing `compact_prompt` was found and Pulse will preserve it unless the user explicitly approves replacement
  - ask before making repo changes
  - after approval, run `node scripts/onboard_pulse.mjs --repo-root <repo-root> --apply`
  - only use `--allow-compact-prompt-replace` when the user explicitly approved replacing the repo's existing compaction prompt

Onboarding installs or updates:

- root `AGENTS.md` from the plugin's `AGENTS.template.md`
- repo-local `.codex/config.toml`
- repo-local `.codex/hooks.json`
- repo-local `.codex/hooks/pulse_*.mjs`
- `.pulse/onboarding.json`

If onboarding is not complete, do not continue into the rest of the Pulse workflow.

## Before Anything Else

0. Confirm Pulse onboarding is current via `.pulse/onboarding.json`
   → If missing or stale: return to Plugin Onboarding above
1. Read `.pulse/tooling-status.json`.
2. If it is missing, invoke `pulse:preflight` first.
3. Respect `recommended_mode` from preflight:
   - `swarm` -> full multi-worker flow is allowed
   - `single-worker` -> skip `pulse:swarming` and execute directly with `pulse:executing`
   - `planning-only` -> do not start execution
   - `blocked` -> stop and clear blockers first

## Skill Catalog

| # | Skill | One-line description | Load when... |
|---|---|---|---|
| 0 | `pulse:preflight` | Validate tooling and choose runtime mode | Starting, resuming, or before any execution-capable flow |
| 1 | `pulse:using-pulse` | This file. Routing, go mode, priority rules, resume contract | After preflight on any Pulse session |
| 2 | `pulse:exploring` | Identify gray areas, lock decisions, write `CONTEXT.md` | Feature request is vague, new, or has unresolved intent |
| 3 | `pulse:planning` | Research + synthesis → `phase-plan.md`, then current-phase contract/story map + beads | Decisions are locked and we need the full phase/story breakdown and current-phase preparation |
| 4 | `pulse:validating` | Verify the current phase contract, story map, and bead graph before execution | The phase plan is approved and the current phase has stories and beads; need to prove the current phase is actually execution-ready |
| 5 | `pulse:swarming` | Launch and tend a worker pool for swarm execution | Preflight recommends `swarm` and execution is approved |
| 6 | `pulse:executing` | Implement beads in either worker mode or single-worker mode | Direct execution is happening |
| 7 | `pulse:reviewing` | 4 specialist reviewers plus a final synthesizer, artifact verification, and UAT | Execution is complete and quality must be verified |
| 8 | `pulse:compounding` | Capture durable learnings into `history/learnings/` | Feature shipped or a cycle completed |
| 9 | `pulse:debugging` | Root-cause blocked work, test failures, and runtime breakage; escalates architectural doubt back to planning when needed | A worker, review, or UAT path is stuck |
| 10 | `pulse:gkg` | Codebase intelligence support for discovery, pattern search, and symbol tracing | Architecture questions, related-file search, dependency tracing, or planning acceleration when gkg is ready |
| 11 | `pulse:dream` | Consolidate durable learnings from Codex artifacts into Pulse memory | Bootstrapping or curating learnings manually |
| 12 | `pulse:writing-pulse-skills` | Improve or create Pulse skills using a skill-TDD loop | Editing Pulse itself |

## Routing Logic

Given a user request, determine the first skill:

| Request type | First skill | Notes |
|---|---|---|
| Vague or new feature | `pulse:exploring` | Start here if intent or scope is still fuzzy |
| Clear implementation request | `pulse:planning` | Skip exploring only if decisions are already locked |
| Small, low-risk fix | `pulse:planning` in lightweight mode | Still validate before execution |
| "Review my code" | `pulse:reviewing` | Load directly |
| "What did we learn?" | `pulse:compounding` | Load directly |
| "Improve Pulse itself" | `pulse:writing-pulse-skills` | Load directly |
| "What is the architecture?" / "Find files related to X" / "How is Y wired?" | `pulse:gkg` | Use as a support skill for codebase intelligence; route back to planning if this is part of a larger feature flow |
| Agent blocked or failing | `pulse:debugging` | Load directly; if fixes stop converging or the failure hops subsystems, route back to `pulse:planning` or `pulse:validating` |
| "/go" or "run the full pipeline" | Go Mode | See `references/go-mode-pipeline.md` |
| Resume interrupted work | Resume Logic | Read the handoff manifest first |

When in doubt, start with `pulse:exploring`.

## Communication Contract

This is the default way models should communicate anywhere inside the Pulse workflow unless a narrower skill requires something stricter.

### The default tone

- practical first, abstract second
- scenario-first, not jargon-first
- explain what happens in real life or in the real system before naming the technical property
- translate decision IDs, invariants, and architecture terms into plain language
- prefer "here is what the code does today" over "here is the category of bug"

### What a good response sounds like

When presenting a plan, finding, blocker, or handoff, the model should usually answer in this order:

1. **Plain-language summary** -- what is happening or what is proposed
2. **Current behavior or current state** -- what the system does today
3. **Why it matters** -- what requirement, decision, or goal this affects
4. **Concrete scenario** -- one realistic example with values, timestamps, requests, user actions, or ordering
5. **Next step** -- the smallest credible fix, revision, or decision needed

### What to avoid

- terse shorthand like "violates D5", "non-monotonic", "race condition", "coverage gap", or "architecture concern" without immediate explanation
- summaries that assume the reader remembers the diff or the planning session
- abstract labels with no example of what would actually happen
- explanations that begin with terminology and only later reveal the user-visible problem

### Translation rule

If you use technical language, immediately translate it.

Examples:

- Instead of: `This write is non-monotonic.`
  Say: `An older update can overwrite a newer timestamp, so the system can think the user was last active earlier than they really were.`

- Instead of: `Violates D5.`
  Say: `Decision D5 says the fallback should use the most recent inbound user message time. Right now the code uses webhook ingest time instead, which can drift from the real message time.`

### Scope

Apply this tone to:

- planning summaries and story explanations
- validating failures and approval summaries
- reviewing findings and gate presentations
- swarming blocker reports and handoffs

If a skill gives a structured format, keep the structure but make the content follow this tone.

## State Bootstrap

On every session start:

0. Confirm Pulse onboarding is current via `.pulse/onboarding.json`
   → If missing or stale: return to Plugin Onboarding above
1. Ensure `.pulse/` exists.
2. Ensure `.pulse/STATE.md` exists. If missing, create:

```markdown
# STATE
focus: (none)
phase: idle
last_updated: <timestamp>
```

3. Ensure `.pulse/config.json` exists. If missing, create `{}`.
4. Ensure `.pulse/handoffs/manifest.json` exists. If missing, create an empty manifest as defined in `references/handoff-contract.md`.
5. If `history/learnings/critical-patterns.md` exists, note its presence in state.
   - Planning must read it.
   - Executing does not need to read it wholesale; planners must embed relevant learnings into beads.

## Resume Logic

Pulse does not use one global handoff file. It uses:

- `.pulse/handoffs/manifest.json`
- one owner-scoped handoff file per paused actor

Load `references/handoff-contract.md` before resuming.

If the manifest contains active entries:

1. Read the manifest, not random owner files.
2. Present each active handoff as:
   - owner
   - skill
   - feature
   - phase
   - next action
3. Ask the user which handoff to resume if more than one is active.
4. Load the skill named by the chosen handoff and continue from that owner file.
5. Do not auto-resume without user confirmation.

## Go Mode

Go mode chains all skills end-to-end with exactly 4 human gates. Load `references/go-mode-pipeline.md` for the complete step-by-step sequence.

**Trigger:** User says `/go [feature]`, "run the full pipeline", or "go mode".

**The 4 gates -- never skip these:**

```
GATE 1 (after exploring):
  Present history/<feature>/CONTEXT.md to user.
  Ask: "Decisions locked. Approve CONTEXT.md before planning?"
  HARD-GATE: do not invoke planning until user approves.

GATE 2 (after whole-feature planning):
  Present history/<feature>/phase-plan.md to user.
  Ask: "Phase breakdown complete. Approve this shape before current-phase preparation?"
  HARD-GATE: do not prepare the current phase or create beads until user approves.

GATE 3 (after validating the current phase):
  Present: phase exit state, story count, bead count, risk summary, spike results.
  Ask: "Current phase verified. Approve execution?"
  HARD-GATE: do not invoke swarming until user approves.

GATE 4 (after reviewing):
  Present: P1 count, P2 count, P3 count.
  If P1 > 0: "P1 findings block merge. Fix before proceeding?"
  If P1 = 0: "Review complete. Approve merge?"
  HARD-GATE: do not merge or close epic until user responds.
```

**Go mode sequence:**
```
preflight -> using-pulse -> exploring -> [GATE 1]
-> planning (whole feature) -> [GATE 2]
-> planning (current phase prep) -> validating -> [GATE 3]
-> swarming + executing xN OR executing(single-worker)
   -> if later phases remain: loop back to current phase prep
-> reviewing (after final phase) -> [GATE 4] -> compounding -> DONE
```

The branch depends on `.pulse/tooling-status.json`:

- `recommended_mode=swarm` -> use `pulse:swarming`
- `recommended_mode=single-worker` -> skip `pulse:swarming`, invoke `pulse:executing` directly

## Quick Mode

Quick mode is for a single low-risk change with no gray areas.

```text
planning(lightweight)
-> validating(lightweight, but still mandatory)
-> executing(single-worker)
-> reviewing(lightweight, still mandatory)
-> compounding only if a durable learning emerged
```

Classify as quick mode only if all are true:

- touches 3 files or fewer
- no new API surface or data model change
- no HIGH-risk component
- no unresolved intent

Quick mode never skips review entirely. It only reduces depth.

## Priority Rules

1. `P1` review findings always block merge.
2. Context budget always applies. If context exceeds 65%, the current owner writes its own handoff file and updates the manifest.
3. `CONTEXT.md` is the source of truth for product and architectural decisions.
4. Planning owns `critical-patterns.md` ingestion and must embed relevant learnings into beads. Workers execute from bead context first.
5. Planning defines `spike_question` for every HIGH-risk item. Validating owns spike bead creation and spike execution.
6. GATE 3 is the most critical gate. Execution is irreversible. If there is any doubt about the plan's soundness, do not approve. Loop back to validating.
7. Spike failures halt the pipeline. A failed spike means the approach is broken. Do not proceed to swarming; return to planning.
8. Preflight decides whether execution goes through `swarming` or directly through `executing`.
9. Never skip validating. Not for "obvious" plans, not for small changes.

## Red Flags

Pause and surface these immediately:

- a session jumps from exploring to execution
- execution starts while `recommended_mode=blocked`
- a skill writes to the retired global handoff path instead of the owner-scoped handoff directory
- a plan marks HIGH risk but does not define a concrete `spike_question`
- a reviewer is expected to inspect artifacts it was never given
- a worker ignores bead verification criteria or bead file scope
- review is skipped because the change "looks small"
- debugging keeps patching after repeated failed fixes instead of handing the work back for re-planning or re-validation
- `manifest.json` lists an active handoff but the referenced owner file is missing, or an owner file exists without a matching manifest entry

## File Quick Reference

```text
.pulse/
  STATE.md                     <- shared project state
  config.json                  <- feature toggles
  tooling-status.json          <- preflight output
  verification/                <- execution verification evidence artifacts
  debug-notes/                 <- debugging debug notes for compounding
  dream-pending/               <- ambiguous dream decisions awaiting approval
  handoffs/
    manifest.json             <- active handoff index
    planning.json             <- planning checkpoint
    coordinator.json          <- swarm coordinator checkpoint
    worker-<agent>.json       <- worker checkpoint
    single-worker.json        <- degraded execution checkpoint

history/<feature>/
  CONTEXT.md                  <- locked decisions from exploring
  discovery.md                <- research findings from planning
  approach.md                 <- synthesis, risk map, spike questions
  phase-plan.md               <- whole feature phase breakdown (approved before current-phase prep)
  phase-<n>-contract.md       <- current phase entry state, exit state, demo, unlocks, pivot signals
  phase-<n>-story-map.md      <- story sequence inside the current phase; maps stories to beads

history/learnings/
  critical-patterns.md        <- promoted critical learnings
  YYYYMMDD-<slug>.md          <- individual learning entries

.beads/                       <- bead files managed by br
.spikes/                      <- spike outputs and findings
.worktrees/                   <- optional worktrees for parallel execution
```

## Chaining Contract

Each skill reads upstream artifacts and writes downstream artifacts:

| Skill | Reads | Writes |
|---|---|---|
| exploring | user conversation | `history/<feature>/CONTEXT.md` |
| gkg | codebase structure, definitions, references | planning-ready discovery findings |
| planning | `CONTEXT.md`, relevant learnings, optional `pulse:gkg` findings | `discovery.md`, `approach.md`, `phase-plan.md`, `phase-<n>-contract.md`, `phase-<n>-story-map.md`, canonical bead files |
| validating | phase-plan.md, phase-<n>-contract.md, phase-<n>-story-map.md, .beads/*, approach.md, CONTEXT.md | validated current phase, `.spikes/` results |
| swarming | validated beads, `tooling-status.json`, `STATE.md` | coordinator mail state, coordinator handoff, updated `STATE.md` |
| executing | bead file, `STATE.md`, `CONTEXT.md` | implementation commits, `.pulse/verification/` evidence, `br close`, worker handoff if needed |
| reviewing | diff, `CONTEXT.md`, `approach.md` | review beads, artifact verification results, UAT outcome |
| compounding | feature history, review output | learning files under `history/learnings/` |

Every skill ends with an explicit handoff phrase:

```text
"[Outcome]. Invoke [next-skill] skill."
```

## References

- `references/go-mode-pipeline.md`
- `references/handoff-contract.md`
