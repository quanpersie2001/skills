---
name: using-pulse
description: Use when bootstrapping or resuming work in a Pulse project after pulse:preflight, or when you need to route a request to the right Pulse skill and execution mode.
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

Bootstrap meta-skill. Load this after `pulse:preflight`. It tells you which Pulse skill to invoke next, how the phases chain together, and how Pulse pauses and resumes safely.

Use this 3-plane model to stay oriented:

- **Operator plane** — what the human is trying to ship right now: the request, approvals, active mode, and next gate.
- **Cookbook plane** — which Pulse skill to load next: exploring, planning, validating, swarming, executing, reviewing, compounding, or a support skill.
- **Scout plane** — what the repo already knows: onboarding health, tooling readiness, state files, handoffs, and memory pointers.

Think of this skill as the router and scout brief for Pulse. It does not replace the downstream skill instructions; it gets you onto the right path with the right current-state context.

## Plugin Onboarding

Before any normal bootstrap, verify that the current repo is onboarded for the Pulse plugin.

Requires **Node.js 18+**. Run `node plugins/pulse/skills/using-pulse/scripts/onboard_pulse.mjs --repo-root <repo-root>` and inspect the JSON result.

- If `status = "up_to_date"`: proceed immediately.
- Always inspect `details.dependency_warning` in the JSON output:
  - If `status = "warning"`, treat bootstrap as non-blocking but degraded and read the summary message.
  - Confirm which skills are affected plus the explicit split:
    - `Missing commands: ...`
    - `Missing MCP server configuration: ...`
  - Cross-check the same command-vs-MCP wording boundary against the session-start note and scout output.
- If `status = "missing_runtime"`: Node.js 18+ is not available -- ask the user to install it before continuing.
- If onboarding is missing or stale:
  - summarize what the script wants to create or update
  - if `requires_confirmation = true`, explain that an existing `compact_prompt` was found and Pulse will preserve it unless the user explicitly approves replacement
  - ask before making repo changes
  - after approval, run `node plugins/pulse/skills/using-pulse/scripts/onboard_pulse.mjs --repo-root <repo-root> --apply`
  - only use `--allow-compact-prompt-replace` when the user explicitly approved replacing the repo's existing compaction prompt

Onboarding installs or updates:

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

This is the scout plane. After onboarding succeeds, use the repo-local scout command as the first quick orientation step whenever it is available:

```bash
node .codex/pulse_status.mjs --json
```

The scout is read-only. It summarizes:

- onboarding health
- gkg readiness for this repo
- dependency health across packaged skills
- `.pulse/state.json`
- `.pulse/STATE.md`
- `.pulse/handoffs/manifest.json`
- `.pulse/checkpoints/<feature>/...` when checkpoints exist for the active feature
- targeted memory-plane recall hooks from `.pulse/memory/`
- a small **recall pack** of the most relevant critical patterns, corrections, ratchet rules, and learnings
- memory hygiene warnings when the memory plane looks noisy or stale
- recommended next reads/actions

Use it to get the current truth quickly, then open the deeper files it points to. The scout tells you what already exists; it does not grant permission to skip the normal gates or downstream skill contracts.

Recall-pack rules:
- handoffs and live state remain authoritative
- checkpoints remain advisory
- the recall pack is only a focused reading list, not a new workflow state
- use it to avoid grepping the whole memory plane when only a few files are likely relevant

### gkg Readiness Is Part of Session Start

Treat `gkg` as a first-class discovery dependency for supported repositories.

After reading the scout output:

- If `gkg readiness` says the repo is unsupported: do not force gkg. Note the fallback and use grep/file inspection.
- If the repo is supported and `server_reachable = false`: make `gkg` ready before planning by running `gkg index <repo-root>` and then `gkg server start`.
- If the repo is supported and `project_indexed = false`: stop the server if needed, run `gkg index <repo-root>`, then start the server again.
- If both server and index are ready: downstream skills should assume `gkg` is the default architecture-discovery path, not an optional nice-to-have.

Supported repo languages for this bootstrap are: Ruby, Java, TypeScript / JavaScript, Kotlin, and Python.
Use the scout's `supported_languages` and `primary_supported_language` fields instead of guessing from the prompt.

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
| 9 | `pulse:debugging` | Root-cause blocked work, test failures, and runtime breakage; escalates architectural doubt back to planning when needed | A worker, review, or UAT path is stuck |
| 10 | `pulse:gkg` | Codebase intelligence support for discovery, pattern search, and symbol tracing | Architecture questions, related-file search, dependency tracing, or planning acceleration when gkg is ready |
| 11 | `pulse:dream` | Consolidate durable learnings from Codex artifacts into Pulse memory | Bootstrapping or curating learnings manually |
| 12 | `pulse:writing-pulse-skills` | Improve or create Pulse skills using a skill-TDD loop | Editing Pulse itself |

## Routing Logic

Start in the operator plane: decide the work shape first, then load the cookbook entry that owns the next move.

### Mode Selection

| Mode | Use when... | Notes |
|---|---|---|
| `small_change` | ≤3 files, no new API/data model, LOW risk, no gray areas | Lightweight planning and validating, but still no skipping validating |
| `standard_feature` | Normal feature or refactor with clear value but moderate scope | Default mode for most Pulse work |
| `high_risk_feature` | Cross-cutting, high-blast-radius, or architecture-sensitive work | Use deeper planning review and explicit spikes for risky items |

### First-Skill Routing

Given a user request, determine which skill to invoke first:

| Request type | First skill | Notes |
|---|---|---|
| Unformed idea / design unclear | `pulse:brainstorming` | Use when what to build isn't clear yet; produces spec before exploring |
| Vague or new feature (what is clear, how is not) | `pulse:exploring` | Start here if intent is clear but implementation decisions are fuzzy |
| Clear implementation request | `pulse:planning` | Skip exploring only if decisions are already locked |
| Small, low-risk fix | `pulse:planning` | Route in `small_change` mode |
| "Review my code" | `pulse:reviewing` | Load directly |
| "What did we learn?" | `pulse:compounding` | Load directly |
| "Improve Pulse itself" | `pulse:writing-pulse-skills` | Load directly |
| "What is the architecture?" / "Find files related to X" / "How is Y wired?" | `pulse:gkg` | Use as a support skill for codebase intelligence; route back to planning if this is part of a larger feature flow |
| Agent blocked or failing | `pulse:debugging` | Load directly; if fixes stop converging or the failure hops subsystems, route back to `pulse:planning` or `pulse:validating` |
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

That reference also defines optional human-readable companion formats for pause summaries, resume briefings, and paste-ready transfer blocks. Use them when helpful, but treat the JSON manifest and owner handoff files as the only source of truth.

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

Go mode is the full operator-plane pipeline: same routing chain, same cookbook, exactly 4 human gates. Load `references/go-mode-pipeline.md` for the complete step-by-step sequence.

**Trigger:** User says `/go [feature]`, "run the full pipeline", or "go mode".

**The 4 gates -- never skip these:**

If the active harness provides `AskUserQuestion`, `AskMeTool`, or another structured question tool, use it for every gate. Ask one gate at a time and prefer focused multiple-choice options over free-form replies. Only fall back to plain-text prompts when no structured question tool exists in the current harness.

```
GATE 1 (after exploring):
  Present history/<feature>/CONTEXT.md to user.
  Ask with structured options when available:
    - "Approve and continue"
    - "Revise decisions"
    - "Show CONTEXT.md"
  Plain-text fallback: "Decisions locked. Approve CONTEXT.md before planning?"
  HARD-GATE: do not invoke planning until user approves.

GATE 2 (after whole-feature planning):
  Present history/<feature>/phase-plan.md to user.
  Ask with structured options when available:
    - "Approve phase plan"
    - "Revise phase plan"
    - "Show phase-plan.md"
  Plain-text fallback: "Phase breakdown complete. Approve this shape before current-phase preparation?"
  HARD-GATE: do not prepare the current phase or create beads until user approves.

GATE 3 (after validating the current phase):
  Present: phase exit state, story count, bead count, risk summary, spike results.
  Ask with structured options when available:
    - "Approve execution"
    - "Review beads"
    - "Revise plan"
  Plain-text fallback: "Current phase verified. Approve execution?"
  HARD-GATE: do not invoke swarming until user approves.

GATE 4 (after reviewing):
  Present: P1 count, P2 count, P3 count.
  If P1 > 0: ask with structured options when available:
    - "Fix findings"
    - "Show review details"
    - "Override merge" only with explicit user confirmation
  If P1 = 0: ask with structured options when available:
    - "Approve merge"
    - "Show review details"
    - "Do not merge yet"
  Plain-text fallback:
    - If P1 > 0: "P1 findings block merge. Options: fix P1s now / show P1 details / override (requires explicit user confirmation)"
    - If P1 = 0: "No blocking findings. Ready to [create PR / merge to main / keep branch]. Approve? (yes / show P2s first / no)"
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

## Mode Guidance

### `small_change`

One-line concept: a low-risk change that still stays inside the normal Pulse gate structure.

For requests classified as `small_change`:

```text
planning (lightweight: single bead, no multi-model refinement)
  -> present one-phase plan and wait for approval
  -> validating (lightweight: single-story phase, abbreviated verification + bv check)
  -> executing (single-worker)
  -> reviewing (lightweight but still required)
  -> compounding (only if a lesson was learned)
```

Choose `small_change` when ALL of these are true:
- Change touches 3 files or fewer
- No new API surface or data model changes
- Risk is clearly LOW
- No gray areas about intent
- The phase can honestly be expressed as one story

### `standard_feature`

One-line concept: the default Pulse delivery path for ordinary feature and refactor work.

Use this for the default Pulse chain. This is the normal case for most feature work:

```text
exploring -> planning -> validating -> swarming/executing -> reviewing -> compounding
```

### `high_risk_feature`

One-line concept: a change where wrong assumptions are expensive, so Pulse slows down before execution.

Use this when the work is cross-cutting, hard to reverse, or likely to fail if assumptions are wrong.

Additional expectations:
- more discovery depth during planning
- explicit second-opinion refinement during planning
- spike discipline for risky items during validating
- slower approval at GATE 3 before execution begins

### Micro Mode

One-line concept: a user-approved shortcut for genuinely trivial work, not a stealth way to bypass normal Pulse discipline.

Micro mode is for genuinely trivial tasks that do not warrant the full Pulse pipeline or even `small_change` mode.

### When micro mode applies

All of the following must be true:

- single-file change (at most one file modified)
- zero new dependencies introduced
- estimated 1-2 beads maximum
- no architectural decisions required
- no gray areas or unresolved intent

If any condition is false, fall back to `small_change` mode or the full pipeline.

### User-facing trigger

Before entering micro mode, tell the user:

> "This task looks trivial. I'll run in micro-mode: abbreviated exploring → single-bead execute → done. Planning, validating, swarming, and reviewing will be skipped. Confirm?"

Do not proceed until the user confirms.

### Micro mode flow

```text
exploring (abbreviated) -> executing (single-worker, single bead) -> DONE
```

**Abbreviated exploring** means: capture only the what, where, and done-criteria. Skip gray-area probing and decision locking beyond the minimum needed to execute safely.

**Single-bead execute** means: create one bead with `br`, implement it, verify it, close it.

**Done** means: the change is committed. No reviewing gate, no handoff ceremony.

### What micro mode skips

- `pulse:planning`
- `pulse:validating`
- `pulse:swarming`
- `pulse:reviewing`
- `pulse:compounding` — micro mode does not produce durable learnings; skip compounding unless an unexpected non-obvious insight emerged

### What micro mode does NOT skip

- Pulse onboarding check
- `pulse:preflight` (tooling-status.json must exist)
- Bead verification criteria (the bead still needs `verify` and evidence)

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
  runs/                        <- active runtime artifacts, including verification evidence
  debug-notes/                 <- debugging debug notes for compounding
  dream-pending/               <- ambiguous dream decisions awaiting approval
  memory/                      <- shared reusable memory subtree for recall hooks and durable learnings
  checkpoints/                 <- advisory feature-scoped checkpoints for list/show/diff/resume-brief
    <feature>/
      manifest.json           <- optional checkpoint index for one feature
      *.json                  <- checkpoint records
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
| gkg | codebase structure, definitions, references | planning-ready discovery findings |
| planning | `CONTEXT.md`, relevant learnings, optional `pulse:gkg` findings | `discovery.md`, `approach.md`, `phase-plan.md`, `phase-<n>-contract.md`, `phase-<n>-story-map.md`, canonical bead files |
| validating | phase-plan.md, phase-<n>-contract.md, phase-<n>-story-map.md, .beads/*, approach.md, CONTEXT.md | validated current phase, `.spikes/` results |
| swarming | validated beads, `tooling-status.json`, `state.json`, `STATE.md` | coordinator mail state, coordinator handoff, updated `state.json`, updated `STATE.md` |
| executing | bead file, `STATE.md`, `CONTEXT.md` | implementation commits, active evidence under `.pulse/runs/<feature>/verification/`, `br close`, worker handoff if needed |
| reviewing | diff, `CONTEXT.md`, `approach.md` | review beads, artifact verification results, UAT outcome |
| compounding | feature history, review output | learning files under `.pulse/memory/learnings/` |

Every skill ends with an explicit handoff phrase:

```text
"[Outcome]. Invoke [next-skill] skill."
```

## References

- `references/go-mode-pipeline.md`
- `references/handoff-contract.md`
