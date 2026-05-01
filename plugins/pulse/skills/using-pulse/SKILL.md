---
name: using-pulse
description: Use when bootstrapping or resuming work in a Pulse project after pulse:preflight, or when a request needs Pulse phase selection and mode-aware routing.
metadata:
  version: '2.2'
  ecosystem: pulse
  dependencies:
    - id: node-runtime
      kind: command
      command: node
      missing_effect: unavailable
      reason: Onboarding scripts and session hooks require Node.js 18+.
    - id: beads-cli
      kind: command
      command: br
      missing_effect: degraded
      reason: using-pulse references br for state and bead inspection.
    - id: beads-viewer
      kind: command
      command: bv
      missing_effect: degraded
      reason: using-pulse references bv for bead graph orientation.
---

# using-pulse

Bootstrap meta-skill. Load this after `pulse:preflight` to route into the correct next Pulse skill and resume safely.

Use this 3-plane model:

- **Operator plane** — user goal, approvals, active mode, and next gate.
- **Cookbook plane** — which Pulse skill to invoke next.
- **Scout plane** — repo truth: onboarding/tooling health, state mirrors, handoffs, and memory pointers.

This skill is a router + scout brief. It does not replace downstream skill contracts.

## Plugin Onboarding and Migration

Before any normal bootstrap, verify that the current repo is onboarded for the current Pulse plugin layout.

Most repos should already be on the current v3 layout. The migration wrapper is a remediation path for stale onboarding or older installs, not the default day-to-day Pulse flow.

Requires **Node.js 18+**. Run `node plugins/pulse/skills/v2-to-v3-migration/scripts/migrate_pulse_v2_to_v3.mjs --repo-root <repo-root>` and inspect the JSON result.

- If `status = "up_to_date"`: proceed immediately.
- Always inspect `details.dependency_warning` in the JSON output when present:
  - If `status = "warning"`, treat bootstrap as non-blocking but degraded and read the summary message.
  - Confirm which skills are affected plus the explicit split:
    - `Missing commands: ...`
    - `Missing MCP server configuration: ...`
  - Cross-check the same command-vs-MCP wording boundary against the session-start note and scout output.
- If `status = "missing_runtime"`: Node.js 18+ is not available -- ask the user to install it before continuing.
- If `status = "needs_migration"`:
  - summarize what the script wants to create or update from `actions`
  - read `legacy_signals` so the user can see whether this is a stale v2 layout, legacy Python hooks, or a partial Pulse install
  - if `requires_confirmation = true`, explain that an existing `compact_prompt` was found and Pulse will preserve it unless the user explicitly approves replacement
  - ask before making repo changes
  - after approval, run `node plugins/pulse/skills/v2-to-v3-migration/scripts/migrate_pulse_v2_to_v3.mjs --repo-root <repo-root> --apply`
  - only use `--allow-compact-prompt-replace` when the user explicitly approved replacing the repo's existing compaction prompt

Onboarding or migration installs or updates:

- root `AGENTS.md` from the plugin's `AGENTS.template.md`
- repo-local `.codex/config.toml`
- repo-local `.codex/hooks.json`
- repo-local `.codex/hooks/pulse_*.mjs`
- repo-local `.codex/pulse_state.mjs`
- repo-local `.codex/pulse_status.mjs`
- `.pulse/onboarding.json`
- `.pulse/state.json`

If onboarding is not complete, do not continue into the rest of the Pulse workflow.

## Before Anything Else

0. Confirm Pulse onboarding is current via `.pulse/onboarding.json`
   → If missing or stale: return to Plugin Onboarding above
1. Read `.pulse/tooling-status.json`.
2. If `.codex/pulse_status.mjs` exists, run `node .codex/pulse_status.mjs --json` for a quick read-only orientation snapshot.
3. If it is missing, invoke `pulse:preflight` first.
4. Respect `recommended_mode` from preflight:
   - `swarm` -> full multi-worker flow is allowed
   - `single-worker` -> skip `pulse:swarming` and execute directly with `pulse:executing`
   - `planning-only` -> do not start execution
   - `blocked` -> stop and clear blockers first

## Session Scout

After onboarding succeeds, run the repo-local scout first when available:

```bash
node .codex/pulse_status.mjs --json
```

The scout is read-only. It summarizes:

- onboarding health
- gitnexus readiness for this repo/session
- dependency health across packaged skills
- `.pulse/state.json`
- `.pulse/STATE.md`
- `.pulse/handoffs/manifest.json`
- `.pulse/checkpoints/<feature>/...` when checkpoints exist for the active feature
- `.pulse/project-docs.json` status and recommended project-doc reads when available
- targeted memory-plane recall hooks from `.pulse/memory/`
- a small **recall pack** of the most relevant critical patterns, corrections, ratchet rules, and learnings
- memory hygiene warnings when the memory plane looks noisy or stale
- recommended next reads/actions

Use it to get the current truth quickly, then open the deeper files it points to. The scout tells you what already exists; it does not grant permission to skip the normal gates or downstream skill contracts.

Recall-pack rules:
- handoffs and live state remain authoritative
- project docs remain authoritative for durable terminology and domain intent when available
- checkpoints remain advisory
- the recall pack is only a focused reading list, not a new workflow state
- use it to avoid grepping the whole memory plane when only a few files are likely relevant

### GitNexus Readiness Is Part of Session Start

Treat `gitnexus` as the preferred discovery path when configured.

After scout output:
- `configured = true`: prefer `pulse:gitnexus`, then confirm with direct file reads.
- `configured = false`: do not block flow; use grep/file inspection.
- use `matched_sources` to verify where MCP config came from.

Do not invent index-health checks at session start. Scout readiness is config status, not index quality.

---

## Dependency Declaration Contract

Every packaged Pulse skill must make its dependency posture explicit. There are only three valid states:

1. **Command-backed skill** — declare each required CLI under `metadata.dependencies` with `kind: command`, the binary name in `command`, a truthful `missing_effect`, and a short `reason`.
2. **MCP-backed skill** — declare each required MCP server under `metadata.dependencies` with `kind: mcp_server`, the expected `server_names`, the supported `config_sources`, a truthful `missing_effect`, and a short `reason`.
3. **Dependency-free packaged skill** — declare `metadata.dependencies: []` to say the skill was reviewed and does not rely on first-class external tools.

Do not leave a packaged skill with undeclared dependency posture. A missing declaration is treated as an uncovered inventory gap, not as an implicit dependency-free skill.

When updating or adding packaged Pulse skills, keep the docs and the live report aligned by running:

- `node plugins/pulse/skills/using-pulse/scripts/test_onboard_pulse.mjs`
- `bash scripts/sync-skills.sh --dry-run`

These checks are the package-wide contract: the report should stay fully covered, the docs must stay portable, and the synced skill bundle must reflect the same declaration rules.

---

## Skill Catalog

Read this as the Pulse cookbook: one line per skill, then route into the specialist that owns the next decision.

| # | Skill | One-line description | Load when... |
|---|---|---|---|
| 0 | `pulse:preflight` | Validate tooling and choose runtime mode | Starting, resuming, or before any execution-capable flow |
| 1 | `pulse:using-pulse` | This file. Routing, go mode, priority rules, resume contract | After preflight on any Pulse session |
| 1b | `pulse:brainstorming` | Turn vague intent into an approved design spec via structured dialogue | Idea is unformed, product direction is unclear, or design needs validation before locking decisions |
| 2 | `pulse:exploring` | Identify gray areas, lock decisions, write `CONTEXT.md` | Feature request is vague, new, or has unresolved intent |
| 3 | `pulse:planning` | Research + synthesis → `phase-plan.md`, then current-phase contract/story map + beads | Decisions are locked and we need the full phase/story breakdown and current-phase preparation |
| 4 | `pulse:validating` | Verify the current phase contract, story map, and bead graph before execution | The phase plan is approved and the current phase has stories and beads; need to prove the current phase is actually execution-ready |
| 5 | `pulse:swarming` | Launch and tend a worker pool for swarm execution | Preflight recommends `swarm` and execution is approved |
| 6 | `pulse:executing` | Implement beads in either worker mode or single-worker mode | Direct execution is happening |
| 7 | `pulse:reviewing` | 4 specialist reviewers plus a final synthesizer, artifact verification, and UAT | Execution is complete and quality must be verified |
| 8 | `pulse:compounding` | Capture durable learnings into `.pulse/memory/learnings/` | Feature shipped or a cycle completed |
| 9 | `pulse:systematic-debug-fix` | Root-cause-first bug fixing for blocked work, test failures, runtime breakage, and regression lock-down | A worker, review, or UAT path is stuck |
| 10 | `pulse:gitnexus` | Codebase intelligence support for architecture snapshots, symbol context, and dependency tracing | Architecture questions, related-file search, API consumer mapping, blast-radius checks, or planning acceleration when GitNexus is configured |
| 11 | `pulse:dev-note` | Capture one concrete developer learning from the current coding-with-AI session into a structured raw note | The user wants to save an insight, heuristic, reframe, or lesson they just learned while coding with AI |
| 12 | `pulse:dev-note-distil` | Distill pending raw dev notes into stable topic knowledge and rebuild the global topic index | The user wants to categorize, merge, consolidate, or distill accumulated developer notes into durable topics |
| 13 | `pulse:dream` | Consolidate durable learnings from Claude Code or Codex runtime artifacts into Pulse memory | Bootstrapping or curating learnings manually |
| 14 | `pulse:writing-pulse-skills` | Improve or create Pulse skills using a skill-TDD loop | Editing Pulse itself |
| 15 | `pulse:v2-to-v3-migration` | Assess and safely apply the Pulse repo migration wrapper for stale installs | Preflight or bootstrap detects legacy Pulse layout, version drift, or partial onboarding |
| 16 | `pulse:architecture-rescue` | Architecture hygiene report for shallow modules, leaky seams, ownership drift, and deepening opportunities | Repo-wide or subsystem-wide architecture cleanup is requested and the default output should be a report, not execution |

## Routing Logic

Start in the operator plane: decide the work shape first, then load the cookbook entry that owns the next move.

### Mode Selection

| Mode | Use when... | Notes |
|---|---|---|
| `small_change` | Bug fix, wording/docs/config tweak, or local refactor with LOW risk, no gray areas, and no new capability, API, data model, or ownership boundary | Lightweight planning and validating, but still no skipping validating |
| `standard_feature` | Any new feature or refactor with clear value and moderate scope | Default mode for all new feature work |
| `high_risk_feature` | Cross-cutting, high-blast-radius, or architecture-sensitive feature/refactor work | Use deeper planning review and explicit spikes for risky items |

If the request introduces a new user-visible capability, workflow, subsystem, API surface, durable data model change, or ownership boundary, it is feature work. Do not route it into `small_change` or `Micro Mode`, even if the first implementation phase looks small.

Project docs routing discipline:
- Before routing decisions that depend on domain terminology, read `.pulse/project-docs.json` first when present and consume the smallest relevant listed docs.
- If missing, detect likely project docs and use them before relying only on feature-history artifacts.
- If user language conflicts with glossary/docs and would alter decisions or review outcomes, surface the conflict and resolve meaning explicitly.

### First-Skill Routing

Given a user request, determine which skill to invoke first:

| Request type | First skill | Notes |
|---|---|---|
| Unformed idea / design unclear | `pulse:brainstorming` | Use when what to build isn't clear yet; produces spec before exploring |
| Vague or new feature (what is clear, how is not) | `pulse:exploring` | Start here if intent is clear but implementation decisions are fuzzy; lock architecture and ownership before planning |
| Clear implementation request | `pulse:planning` | Skip exploring only if decisions are already locked and the feature shape is already defined |
| Small, low-risk fix | `pulse:planning` | Route in `small_change` mode only when no new capability or ownership boundary is introduced |
| "Review my code" | `pulse:reviewing` | Load directly |
| "Note this learning" / "save this insight" / "ghi lại ý này" | `pulse:dev-note` | Use to capture one concrete developer learning from the current coding-with-AI session |
| "Distill these dev notes" / "chưng cất notes" / "gom notes thành topic" | `pulse:dev-note-distil` | Use to turn accumulated raw dev notes into durable topic knowledge and a refreshed global index |
| "What did we learn?" | `pulse:compounding` | Load directly |
| "Improve Pulse itself" | `pulse:writing-pulse-skills` | Load directly |
| "What should we clean up in this subsystem?" / "Where are the shallow modules?" / "How should we improve the architecture here?" | `pulse:architecture-rescue` | Use for repo-wide or subsystem-wide rescue analysis; stay in report-only mode unless the user explicitly asks for planning or execution follow-through |
| "What is the architecture?" / "Find files related to X" / "How is Y wired?" | `pulse:gitnexus` | Use as a support skill for codebase intelligence; route back to planning if this is part of a larger feature flow |
| Agent blocked or failing | `pulse:systematic-debug-fix` | Load directly; if fixes stop converging or the failure exposes a planning or architecture gap, route back to `pulse:planning` or `pulse:validating` |
| "/go" or "run the full pipeline" | Go Mode | See `references/go-mode-pipeline.md` |
| Resume interrupted work | Resume Logic | Read the handoff manifest first |
| Trivial single-file task | Micro Mode | See Micro Mode section below; confirm with user before entering |

When in doubt, start with `pulse:exploring`.

## Communication Contract

This is the operator-facing language contract for Pulse unless a narrower skill requires something stricter.

### The default tone

- practical first, abstract second
- scenario-first, not jargon-first
- explain what happens in real life or in the real system before naming the technical property
- translate decision IDs, invariants, and architecture terms into plain language
- prefer "here is what the code does today" over "here is the category of bug"

### Response shape

For plans, findings, blockers, and handoffs, answer in this order:
1. plain-language summary
2. current behavior/state
3. why it matters
4. one concrete scenario
5. next smallest step

### Avoid

- shorthand without explanation (for example: "violates D5", "race condition")
- summaries that assume prior context
- abstract labels without user-visible impact
- terminology-first explanations that hide the real behavior

### Translation rule

If technical language is needed, immediately translate it into user-visible behavior.

### Scope

Apply this tone to:

- planning summaries and story explanations
- validating failures and approval summaries
- reviewing findings and gate presentations
- swarming blocker reports and handoffs

If a skill gives a structured format, keep the structure but make the content follow this tone.

## State Bootstrap

This section defines the scout-plane bootstrap and the shared-memory root for an active Pulse repo.

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

3. Ensure `.pulse/state.json` exists. If missing, create a normalized routing mirror.
4. Ensure `.pulse/config.json` exists. If missing, create `{}`.
5. Ensure `.pulse/handoffs/manifest.json` exists. If missing, create an empty manifest as defined in `references/handoff-contract.md`.
6. Treat `.pulse/` as the control plane for Pulse session state and handoffs.
7. Treat `.pulse/memory/` as the canonical shared-memory subtree for reusable Pulse memory artifacts.
8. If `.pulse/memory/critical-patterns.md` exists, note its presence in state.
   - Planning must read it.
   - Executing does not need to read it wholesale; planners must embed relevant learnings into beads.

## Resume Logic

Resume handling stays in the scout plane: inspect the shared state first, then re-enter the cookbook skill named by the handoff.

Pulse does not use one global handoff file. It uses:

- `.pulse/handoffs/manifest.json`
- one owner-scoped handoff file per paused actor

Load `references/handoff-contract.md` before resuming.

That reference also defines the canonical rendered companion formats for pause summaries, resume briefings, and paste-ready transfer blocks. Generate or present those companions from the JSON manifest and owner handoff files, which remain the only source of truth.

If the manifest contains active entries:

1. Read the manifest, not random owner files.
2. Present each active handoff as:
   - owner
   - skill
   - feature
   - phase
   - summary
   - next action
3. Ask the user which handoff to resume if more than one is active.
4. After the user chooses, open that owner file and resume from the standard companion blocks:
   - `summary` -> the one-read handoff headline
   - `next_action` + `read_first` -> the resume briefing
   - `payload.transfer` -> the detailed transfer block
5. If `.pulse/checkpoints/<feature>/...` exists, treat the latest matching checkpoint as an advisory resume aid only:
   - use it for quick comparison, memory recall hooks, or a compact resume brief
   - never let it override the active handoff or current state mirrors
6. Load the skill named by the chosen handoff and continue from that owner file.
7. Do not auto-resume without user confirmation.

## Go Mode

Go mode is the full operator-plane pipeline with 4 human gates. Use `references/go-mode-pipeline.md` as the canonical protocol.

Trigger:
- User says `/go <feature>`, "run the full pipeline", or "go mode"

Non-negotiable gate contract:
- Gate 1: approve `history/<feature>/CONTEXT.md` before planning
- Gate 2: approve `history/<feature>/phase-plan.md` before current-phase prep
- Gate 3: approve current-phase execution after validating
- Gate 4: approve merge after reviewing (`P1` still blocks)

Execution branch from preflight:
- `recommended_mode=swarm` -> `pulse:swarming`
- `recommended_mode=single-worker` -> `pulse:executing` directly
- `recommended_mode=planning-only|blocked` -> do not start execution

Mode contract:
- `small_change`: low-risk local work with lightweight planning/validating/reviewing
- `standard_feature`: default full chain
- `high_risk_feature`: deeper planning and stricter spike discipline
- `Micro Mode`: explicit user-approved shortcut for trivial non-feature work only

For gate prompts, fallback behavior, go-mode sequence, and Micro Mode details, load `references/go-mode-pipeline.md`.

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
- review is skipped outside the approved lightweight `small_change` flow
- debugging keeps patching after repeated failed fixes instead of handing the work back for re-planning or re-validation
- `manifest.json` lists an active handoff but the referenced owner file is missing, or an owner file exists without a matching manifest entry
- `state.json` missing or stale after a phase transition
- `STATE.md` not updated after a phase transition

## File Quick Reference

This is the scout-plane map of the shared Pulse working set.

```text
.pulse/
  state.json                   <- machine-readable routing/status mirror
  STATE.md                     <- shared project state
  config.json                  <- feature toggles
  tooling-status.json          <- preflight output
  memory/dream-pending/        <- queued ambiguous dream items for explicitly non-blocking runs
  memory/                      <- shared reusable memory subtree for recall hooks and durable learnings
  checkpoints/                 <- advisory feature-scoped checkpoint metadata only
    <feature>/
      manifest.json           <- optional checkpoint index for one feature
      *.json                  <- valid checkpoint records; Beads repair backups and beads.db* are foreign here
  handoffs/
    manifest.json             <- active handoff index
    planning.json             <- planning checkpoint
    coordinator.json          <- swarm coordinator checkpoint
    worker-<agent>.json       <- worker checkpoint
    single-worker.json        <- degraded execution checkpoint

.codex/
  pulse_status.mjs             <- read-only scout for onboarding, state, and handoff
  pulse_state.mjs              <- shared state helpers used by the scout

history/<feature>/
  CONTEXT.md                  <- locked decisions from exploring
  discovery.md                <- research findings from planning
  approach.md                 <- synthesis, risk map, spike questions
  phase-plan.md               <- whole feature phase breakdown (approved before current-phase prep)
  phase-<n>-contract.md       <- current phase entry state, exit state, demo, unlocks, pivot signals
  phase-<n>-story-map.md      <- story sequence inside the current phase; maps stories to beads
  verification/               <- canonical verification evidence for the feature

.pulse/memory/
  critical-patterns.md        <- promoted critical learnings
  learnings/                  <- individual learning entries
  corrections/                <- durable corrections to prior guidance
  ratchet/                    <- durable quality bars and non-regression rules

.beads/                       <- bead files managed by br
.spikes/                      <- spike outputs and findings
.worktrees/                   <- optional worktrees for parallel execution
```

## Chaining Contract

Each skill reads upstream artifacts and writes downstream artifacts:

| Skill | Reads | Writes |
|---|---|---|
| exploring | user conversation | `history/<feature>/CONTEXT.md` |
| gitnexus | codebase structure, execution flows, symbol context, dependency impact | planning-ready discovery findings |
| dev-note | current chat context and the user’s note intent | `dev-notes/raws/YYYYMMDD.md` raw learning capture |
| dev-note-distil | pending raw dev notes plus existing topic pages | `dev-notes/distil/topics/*` and `dev-notes/distil/TOPICS.md` |
| planning | `CONTEXT.md`, relevant learnings, optional `pulse:gitnexus` findings | `discovery.md`, `approach.md`, `phase-plan.md`, `phase-<n>-contract.md`, `phase-<n>-story-map.md`, canonical bead files |
| validating | phase-plan.md, phase-<n>-contract.md, phase-<n>-story-map.md, .beads/*, approach.md, CONTEXT.md | validated current phase, `.spikes/` results |
| swarming | validated beads, `tooling-status.json`, `state.json`, `STATE.md` | coordinator mail state, coordinator handoff, updated `state.json`, updated `STATE.md` |
| executing | bead file, `STATE.md`, `CONTEXT.md` | implementation commits, canonical evidence under `history/<feature>/verification/`, `br close`, worker handoff if needed |
| reviewing | diff, `CONTEXT.md`, `approach.md` | review beads, artifact verification results, UAT outcome |
| compounding | feature history, review output | learning files under `.pulse/memory/learnings/` |

Every skill ends with an explicit handoff phrase:

```text
"[Outcome]. Invoke [next-skill] skill."
```

## References

- `references/go-mode-pipeline.md`
- `references/handoff-contract.md`
