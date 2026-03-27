---
name: pulse:planning
description: Research, synthesize, and decompose features into executable beads for the Pulse ecosystem. Use after pulse:exploring completes or when intent is already locked. Reads CONTEXT.md and relevant learnings, writes discovery.md and approach.md, and creates canonical bead files for pulse:validating and execution.
metadata:
  version: '1.1'
  ecosystem: pulse
---

# Planning

Research the codebase, synthesize an approach, and decompose the feature into executable beads.

Planning owns:

- discovery
- synthesis
- bead decomposition
- turning institutional memory into implementation-ready context

Planning does not own spike execution. It defines the `spike_question`; `pulse:validating` materializes and runs the spike.

## Pipeline Overview

```text
CONTEXT.md
  -> Phase 0: Learnings retrieval
  -> Phase 1: Discovery
  -> Phase 2: Synthesis
  -> Phase 3: Adversarial refinement (only if needed)
  -> Phase 4: Decomposition into canonical beads
  -> handoff to pulse:validating
```

## Before You Start

Read:

- `history/<feature>/CONTEXT.md`
- `.pulse/tooling-status.json`

If `CONTEXT.md` does not exist, stop and invoke `pulse:exploring`.

If `.pulse/tooling-status.json` says `blocked`, stop and clear preflight blockers before planning further.

## Phase 0: Learnings Retrieval

This phase is mandatory.

### Step 1: Read critical patterns

If `history/learnings/critical-patterns.md` exists, read it in full.

### Step 2: Load only relevant learnings

Extract 3-5 domain keywords from the feature name and `CONTEXT.md`, then search `history/learnings/` for matching tags, modules, or subsystems.

### Step 3: Apply learnings

Record in `history/<feature>/discovery.md`:

- which learnings were relevant
- which concrete design choices they changed
- which gotchas must be embedded in downstream beads

## Phase 1: Discovery

Map the codebase, constraints, and external dependencies deeply enough to support a safe plan.

Discovery areas:

1. architecture topology
2. existing patterns and analogs
3. technical constraints and verification commands
4. external docs only if the feature introduces something genuinely new

Parallelize discovery when areas are independent.

If `.pulse/tooling-status.json` says `gkg` is ready, invoke `pulse:gkg` for the architecture snapshot, pattern search, and symbol/reference tracing portions of discovery.
If `gkg` is unavailable, fall back to `rg`, file-tree scans, and direct file reads. Record the downgrade in `discovery.md` when it materially affects confidence.

Output:

- `history/<feature>/discovery.md`

Use `references/discovery-template.md`.

## Phase 2: Synthesis

Produce `history/<feature>/approach.md` using `references/approach-template.md`.

The approach must include:

1. a concrete recommended approach
2. rejected alternatives
3. a full risk map
4. proposed file structure
5. dependency order
6. institutional learnings applied
7. open questions for validating

### Risk Rules

| Level | Criteria | Planning action |
|---|---|---|
| LOW | Existing pattern, bounded scope | Proceed |
| MEDIUM | Variation of an existing pattern | Call out constraints and verification |
| HIGH | Novel path, external dependency, large blast radius, or unknown feasibility | Define a concrete `spike_question` for validating |

For every HIGH-risk item, planning must define:

- `component`
- `reason`
- `validation_owner` = `validating`
- `spike_question` that can be answered `YES` or `NO`
- `affected_beads`
- a short decision gate with 2-3 concrete options and the recommendation
- whether the affected beads should use `testing_mode: tdd-required`

Planning does not create spike beads.

## Phase 3: Adversarial Refinement

Run this only for high-stakes features:

- 2 or more HIGH-risk items
- auth, data model, or API contract changes
- infra or architecture changes with long-term consequences

Run 1-2 rounds only.

The reviewer should answer:

1. what assumptions could be wrong
2. what failure modes are missing
3. what future regret this approach may create
4. what the risk map missed

Revise `approach.md` until changes become incremental.

## Phase 4: Decomposition

Convert the approved approach into real beads with `br create`.
Then normalize every bead file to the canonical Pulse schema in `references/bead-template.md`.

### Create the epic first

```bash
br create "<Feature Name>" -t epic -p 1
```

### Then create task beads

```bash
br create "<Action-oriented task title>" -t task --blocks <epic-id>
```

### Canonical bead requirements

Every task bead must explicitly include:

- `dependencies`
- `files`
- `verify`
- `verification_evidence`
- `testing_mode`
- `decision_refs`
- `learning_refs`

If the CLI cannot create these fields inline, create the bead first and update the bead file immediately after creation. Do not leave the contract implicit in prose alone.

Use `references/bead-template.md`.

### Post-Create Normalization Loop

After each `br create`:

1. open the bead file immediately
2. add or normalize the canonical fields
3. replace prose-only scope or verification text with structured fields
4. save only when the bead satisfies the schema gate below

Do not batch-create 20 beads and promise to normalize them later. Normalize each bead while planning context is still fresh.

### Schema Gate

A bead is not considered "created" in Pulse until all of these are true:

- `dependencies` exists, even if empty
- `files` exists, even if empty
- `verify` exists, even if empty
- `verification_evidence` exists, even if empty
- `testing_mode` exists
- `decision_refs` exists, even if empty
- `learning_refs` exists, even if empty
- the body contains a bounded goal and done criteria

If any field is missing, that is an incomplete planning artifact, not a valid bead.

### Decomposition rules

- one bead = one agent, one context window, roughly 30-90 minutes of work
- file scope must be tight enough for reservation planning
- verification must be runnable and concrete
- `verification_evidence` should point to `.pulse/verification/<feature>/<bead-id>.md` or another explicit evidence record path
- `testing_mode: tdd-required` for bugfixes, stateful logic, contract changes, or other high-risk behavior changes unless the approach explicitly says otherwise
- any relevant learnings from Phase 0 must be embedded directly into the bead
- any referenced locked decisions from `CONTEXT.md` must be carried into the bead

### What belongs in the bead body

- what must be implemented
- why it exists
- constraints from the plan
- relevant learnings or gotchas
- verification expectations
- the chosen testing mode and why it applies
- the evidence artifact or verification record the worker should produce

Do not force workers to rediscover planning context from scratch.

## Update STATE.md

After every major phase transition, update `.pulse/STATE.md` with:

```markdown
skill: planning
phase: <current phase>
feature: <feature>
artifacts:
  - history/<feature>/discovery.md
  - history/<feature>/approach.md
beads_created: <count or list>
last_updated: <timestamp>
```

## Context Budget

If context exceeds 65%, write `.pulse/handoffs/planning.json` using the envelope in `../pulse:using-pulse/references/handoff-contract.md` and register it in `.pulse/handoffs/manifest.json`.

Planning payload should include:

- `completed_through`
- `artifacts_written`
- `beads_created`
- `open_questions`

## Handoff

On success:

```text
Plan created with canonical beads and validation inputs.
Invoke pulse:validating before any execution.
```

## Red Flags

- skipping Phase 0 learnings retrieval
- ignoring locked decisions in `CONTEXT.md`
- writing pseudo-beads instead of real bead files
- treating a prose-only bead as valid without the canonical schema fields
- beads without `files`, `dependencies`, `verify`, `verification_evidence`, `testing_mode`, `decision_refs`, or `learning_refs`
- HIGH-risk items without a concrete `spike_question`
- workers needing to read half the repo because planning failed to embed context
