---
name: planning
description: >-
  Use after pulse:exploring when locked decisions are ready and the user needs
  an approved phase plan plus current-phase preparation for validation.
metadata:
  version: '2.3'
  ecosystem: pulse
  dependencies:
    - id: beads-cli
      kind: command
      command: br
      missing_effect: degraded
      reason: Planning creates beads for the current phase through br.
    - id: beads-viewer
      kind: command
      command: bv
      missing_effect: degraded
      reason: Planning uses bv to verify bead graph structure.
    - id: gitnexus
      kind: mcp_server
      server_names: [gitnexus]
      config_sources: [repo_codex_config, global_codex_config, plugin_mcp_manifest]
      missing_effect: degraded
      reason: Planning uses GitNexus MCP tools for codebase discovery when available.
---

# Planning

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

Planning has two jobs:
1. Make the whole feature legible in plain language.
2. Prepare only the next approved phase for validating and execution.

If this skill cannot explain the work with practical outcomes and realistic examples, it is not done.

## Core Planning Model

```text
Whole Feature
  -> Phase Plan
    -> Current Phase
      -> Stories
        -> Beads
```

- **Whole Feature**: the full thing the user asked for
- **Phase Plan**: meaningful chunks that reach that full result
- **Current Phase**: the one chunk prepared now
- **Story**: causal sequence inside the current phase
- **Bead**: worker-sized executable unit

For new feature work, define whole-feature architecture before slicing phases: enduring foundations, ownership boundaries, interfaces, and contracts first.

## Hot-Path Rules

- `history/<feature>/CONTEXT.md` is the source of truth; planning reads but never overrides locked decisions.
- Read `.pulse/project-docs.json` first when present, then listed docs before relying only on feature history artifacts.
- Gate 2 is mandatory: do not prepare current-phase artifacts or beads before explicit phase-plan approval.
- Plan the full feature first, but create beads only for the approved current phase.
- Keep phase descriptions outcome-first and scenario-first, not layer-jargon-first.
- Carry relevant corrections/ratchets from learnings into bead `learning_refs`.

## Pipeline

```text
CONTEXT.md
  -> Phase 0 Learnings Retrieval
  -> Phase 1 Discovery                 (history/<feature>/discovery.md)
  -> Phase 2 Synthesis                 (history/<feature>/approach.md)
  -> Phase 3 Whole Feature Phase Plan  (history/<feature>/phase-plan.md)
  -> HARD-GATE (Gate 2): human approval required
  -> default approved outcome: state sync + stop (`next_action: manual_invoke`, `next_skill_recommended: pulse:planning`)
  -> optional approved outcome: continue now in the same context (`next_action: continue_now`)
  -> Phase 4 Current Phase Contract    (history/<feature>/phase-<n>-contract.md)
  -> Phase 5 Current Phase Story Map   (history/<feature>/phase-<n>-story-map.md)
  -> Phase 6 Multi-Perspective Check   (HIGH-stakes only)
  -> Phase 7 Current Phase Bead Creation (.beads/* via br)
  -> Handoff: recommend pulse:validating for Phase <n> (`next_action: manual_invoke` by default)
```

## Phase Execution Contract

### Before you start

1. If `.pulse/scripts/pulse_status.mjs` exists, run `node .pulse/scripts/pulse_status.mjs --json`.
2. Read `history/<feature>/CONTEXT.md`; if missing, stop and ask user to run `pulse:exploring`.
3. Stop if `.pulse/tooling-status.json` reports `blocked`.
4. Read project docs first (`.pulse/project-docs.json` when present; otherwise minimal relevant docs set).

### Phase 0: Learnings Retrieval (mandatory)

1. Read `.pulse/memory/critical-patterns.md`.
2. Check staleness via `.pulse/STATE.md`; if last compounding is missing or >3 completed features old, warn and continue.
3. Use recall-pack pointers first (corrections -> ratchets -> learnings), then targeted grep only if needed.
4. Record `Institutional Learnings` at top of `history/<feature>/discovery.md`.

### Phase 1: Discovery

- Explore architecture topology, existing patterns, constraints, and external references only when novel.
- Prefer GitNexus when configured; explicitly document fallback when unavailable.
- Write `history/<feature>/discovery.md` using `references/planning-reference.md`.

### Phase 2: Synthesis

- Read `CONTEXT.md` + `discovery.md`.
- Write `history/<feature>/approach.md` using `references/planning-reference.md`.
- Include gap analysis, recommended approach, alternatives, risk map, proposed structure, learnings applied.
- For every HIGH risk define: component, reason, validating owner, YES/NO spike question, affected beads, decision gate options, and `testing_mode` expectation.

### Phase 3: Whole Feature Phase Plan (Gate 2 setup)

- Write `history/<feature>/phase-plan.md` using `references/planning-reference.md`.
- Must define foundation-first architecture baseline and 2-4 meaningful phases with observable outcomes.
- Set `Approval status: PENDING` and stop for user approval.
- If revised, set or keep `REVISE_REQUIRED`; only set `APPROVED` after explicit approval.
- Default approved path: update runtime state only, record `gate: GATE 2`, `gate_status: approved`, `next_skill_recommended: pulse:planning`, and `next_action: manual_invoke`, then stop.
- Optional fast path: only enter Phase 4 immediately when the user explicitly chooses an equivalent of `Approve and continue now`; in that case set `next_action: continue_now` before continuing.

Approval sync checklist before moving forward:
1. Update `history/<feature>/phase-plan.md` approval state.
2. Sync same state into `.pulse/STATE.md` and `.pulse/state.json`.
3. Confirm both artifacts name the same approved phase.
4. Do not enter current-phase preparation unless the user explicitly asked to continue now in the same context.

### Phase 4: Current Phase Contract

- Select first unprepared phase from `.pulse/STATE.md` unless user chooses another.
- Write `history/<feature>/phase-<n>-contract.md` using `references/planning-reference.md`.
- Must lock entry/exit states, demo walkthrough, unlocks, non-goals, assumptions, and success criteria.

### Phase 5: Current Phase Story Map

- Write `history/<feature>/phase-<n>-story-map.md` using `references/planning-reference.md`.
- Stories must state what happens, why now, serial/parallel safety, shared-collision risk, done criteria, and testing discipline hints.

### Phase 6: Multi-Perspective Check (HIGH-stakes only)

Run only for high-stakes phases (core architecture/auth/data model/high blast radius). Iterate 1-2 rounds across phase plan, contract, and story map until changes are incremental.

### Phase 7: Current Phase Bead Creation

- Create real beads with `br create`; never pseudo-beads in markdown.
- Create one whole-feature epic first if missing, then current-phase task beads only.
- The epic remains open across phases. Do not treat a phase-complete subtree as permission to close the whole-feature epic.
- Populate the epic bead with a minimal phase snapshot sourced from `history/<feature>/phase-plan.md` plus `.pulse/STATE.md`:
  - `total_phases`
  - `current_phase`
  - `completed_phases`
  - `final_phase_ready`
- Treat that epic snapshot as operator-facing convenience only. `phase-plan.md` and `.pulse/STATE.md` remain the source of truth.
- Normalize every bead immediately with required schema fields:
  - `dependencies`, `files`, `verify`, `verification_evidence`, `testing_mode`, `decision_refs`, `learning_refs`
- Use `references/bead-template.md` for bead schema details.
- Fill Story-To-Bead Mapping in `phase-<n>-story-map.md` after bead creation.

## STATE + Handoff

After major transitions, update `.pulse/STATE.md` as a mirror of durable artifacts (source of truth remains history files).

If context exceeds 65% at a phase boundary:
- write `.pulse/handoffs/planning.json` with the shared envelope from `../using-pulse/references/handoff-contract.md`
- register it in `.pulse/handoffs/manifest.json`
- keep payload concise and phase-specific (`completed_through`, `artifacts_written`, `beads_created`, `open_questions`, `stories_defined`)

## Completion Handoff

On success:
- discovery, approach, phase-plan, phase-contract, and story-map are written
- Gate 2 approval is recorded and synced
- only current-phase beads are created and normalized
- the whole-feature epic remains open unless the final phase has already completed and reviewing later closes it
- HIGH-risk components are flagged for validating

Then hand off with: **Recommend `pulse:validating` for Phase <n> as the next skill, default to `next_action: manual_invoke`, and continue in the same session only when the user explicitly asks for it.**

## Red Flags

- Skipping learnings retrieval or ignoring `CONTEXT.md`
- Proceeding past phase plan without approval
- Treating phases as technical buckets instead of real outcomes
- Creating beads for later phases
- Vague, non-observable exit states
- Prose-only bead scope/verification or missing canonical fields
- HIGH-risk items without concrete YES/NO spike questions
- Missing dependencies across shared files/contexts
