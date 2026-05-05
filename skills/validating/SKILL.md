---
name: validating
description: >-
  Use after planning and before execution to verify phase and bead readiness and
  enforce explicit Gate 3 approval before any implementation starts.
metadata:
  version: '1.4'
  position: 3
  chain: exploring → planning → validating → (swarming | executing)
  dependencies:
    - id: beads-cli
      kind: command
      command: br
      missing_effect: unavailable
      reason: Validating verifies and manages beads through br.
    - id: beads-viewer
      kind: command
      command: bv
      missing_effect: degraded
      reason: Validating inspects the bead graph with bv before approving execution.
---

# Validating

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse`.

## Purpose

Do not start execution unless the current phase is structurally ready. This skill verifies that:
- the phase contract is observable and executable
- story sequencing is coherent
- beads are schema-valid and implementation-ready
- HIGH-risk items are proven through spikes
- execution stays blocked until explicit user approval

## Non-Negotiable Gates

- **Gate A — Plan approval must already be approved** in `history/<feature>/phase-plan.md`.
- **Gate B — Bead schema must pass** before structural checking.
- **Gate C (Gate 3) — Explicit user approval is mandatory before execution.**

If any gate fails, stop and route back; never “proceed anyway.”

## Required Inputs

- `history/<feature>/CONTEXT.md`
- `history/<feature>/discovery.md`
- `history/<feature>/approach.md`
- `history/<feature>/phase-plan.md`
- `history/<feature>/phase-<n>-contract.md`
- `history/<feature>/phase-<n>-story-map.md`
- all `.beads/*.md` for the phase/epic

If any required artifact is missing, return to `pulse:planning`.

## Runtime Flow (Hot Path)

### 0) Orient to the active phase (mandatory every run)

Read both:
- `history/<feature>/phase-plan.md` (approval source of truth)
- `.pulse/STATE.md` (mirror)

Confirm and present:
- approval status
- approved phase index/name
- story list and practical phase goal
- mirror status (in sync / out of sync / missing)

If plan approval is not `APPROVED`, stop.
If plan and mirror disagree, stop and return to planning for sync.

Use the orientation template from `references/runtime-appendix.md`.

### 1) Run schema gate (fail fast)

Before any structural checker:
- verify every bead has canonical required fields
- verify `testing_mode: tdd-required` beads include red/green `tdd_steps`
- verify `verify` and `verification_evidence` are concrete
- verify file scope is not obviously overbroad
- verify HIGH-risk beads include meaningful `learning_refs` when prior recall clearly applies

If schema fails, repair or route back to planning. Do not run plan-checker on malformed beads.

Use schema checklist in `references/runtime-appendix.md`.

### 2) Structural verification (max 3 iterations)

Run plan-checker against the full artifact set and evaluate all **8 dimensions**:
1. phase contract clarity
2. story coverage and ordering
3. decision coverage
4. dependency correctness
5. file scope isolation
6. context budget
7. verification completeness
8. exit-state completeness and risk alignment

Rules:
- PASS only if all 8 dimensions pass.
- On fail, fix exact artifacts and re-run.
- Maximum 3 iterations. If still failing after 3, escalate and stop.

Use the plan-checker runtime contract in `references/runtime-appendix.md`.

### 3) HIGH-risk spike discipline

For each HIGH-risk item from `approach.md`:
- create one spike bead with a single decisive `spike_question`
- execute in isolation with a hard 30-minute timebox
- produce `.spikes/<feature>/<spike-id>/FINDINGS.md`
- close spike with definitive `YES` or `NO`

If timebox expires without decision:
- present current findings
- offer: +15m extension (explicit approval), return to planning, or documented mitigation
- never silently continue beyond the timebox

Decision handling:
- **YES**: propagate constraints into affected beads/story map
- **NO**: stop, update `approach.md`, return to planning, then re-run validating

### 4) Bead polishing and readiness

Polish bead graph:
- `bv --robot-suggest` for dependency completeness
- `bv --robot-insights` for cycles/bottlenecks/orphans
- `bv --robot-priority` for foundational ordering
- deduplicate overlapping same-goal same-scope beads
- run fresh-eyes bead review and resolve all CRITICAL flags
- confirm story↔bead mapping coherence both directions

Then run exit-state readiness check:
- if stories are done, is phase exit state observably true?
- if beads close, are stories truly done?
- is demo credible?
- are architecture boundaries preserved?
- can executors implement without hidden design guesses?
- are scopes surgical (no opportunistic cleanup/future-proofing)?

Any “no/not sure” routes back to planning artifacts or bead set; do not approve.

### 5) Final approval gate (Gate 3 hard stop)

Present validation summary and request explicit approval.
Use structured question tools when available; otherwise plain text.

Execution is forbidden until approval is explicit.

On approval:
- update `.pulse/STATE.md` and `.pulse/state.json` to validated status
- default approved path: record `gate: GATE 3`, `gate_status: approved`, `next_action: manual_invoke`, and set `next_skill_recommended` from `recommended_mode`, then stop
- optional fast path: only continue in the same session when the user explicitly chooses an equivalent of `Approve and continue now`; in that case set `next_action: continue_now` before continuing
- mode mapping for `next_skill_recommended`:
  - `recommended_mode=swarm` → `pulse:swarming`
  - `recommended_mode=single-worker` → `pulse:executing`

On rejection:
- capture concern category and route back precisely (contract/story map/approach/beads)

Use final approval template/options in `references/runtime-appendix.md`.

## Execution Mode Compatibility

Validating must support both downstream modes:
- **Swarm mode**: all validations complete, recommend `pulse:swarming` as the next skill and default to `next_action: manual_invoke`
- **Single-worker mode**: all validations complete, recommend `pulse:executing` as the next skill and default to `next_action: manual_invoke`

Only switch to `next_action: continue_now` when the user explicitly asks to keep going in the same context. The validation standard is identical in both modes.

## Lightweight Mode

Allowed only for confirmed LOW-risk single-story single-bead work:
- abbreviated structural check on that story/bead
- skip spikes
- run `bv --robot-suggest`
- still require Gate 3 explicit approval

If uncertain, run full mode.

## Context Budget

If context exceeds 65%, write a validating-owned handoff using the shared envelope and register it in `.pulse/handoffs/manifest.json`.

## Red Flags

- any execution before Gate 3 approval
- skipping phase orientation on resume
- validating while plan approval is not `APPROVED`
- validating when `phase-plan.md` and `.pulse/STATE.md` disagree
- running plan-checker before schema gate passes
- attempting a 4th structural iteration
- missing or non-decisive HIGH-risk spike outcomes
- continuing after a `NO` spike
- unresolved CRITICAL bead-review flags at approval time
