---
name: pulse:planning
description: >-
  Research, synthesize, and decompose a phase into a clear phase contract,
  story map, and executable beads. Use after pulse:exploring completes. Reads
  CONTEXT.md, retrieves institutional learnings, runs discovery and synthesis,
  writes discovery.md, approach.md, phase-contract.md, story-map.md, and then
  creates .beads/ work that matches the story structure. Invoked when the user
  says plan this phase, map the stories, break this into beads, research and
  plan, or when exploring hands off to planning.
metadata:
  version: '2.0'
  ecosystem: pulse
---

# Planning

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

Research the codebase, shape the phase as a small closed loop, map the stories inside that phase, and only then create beads.

> "Planning is the cheapest place to buy correctness. A bug caught in plan space costs 25x less to fix than one caught in code space." — Flywheel Complete Guide

## Core Planning Model

Pulse now plans at four levels:

```text
Whole Plan
  -> Phase
    -> Stories
      -> Beads
```

- **Whole Plan**: the larger arc, if one exists
- **Phase**: a small closed loop with a clear exit state
- **Story**: the internal narrative slice that moves the phase toward its exit state
- **Bead**: the executable worker unit

Do not jump from `approach.md` straight to beads. If the phase cannot be explained in simple terms with a clear exit state and story sequence, it is not ready for execution.

## Pipeline Overview

```text
CONTEXT.md (from exploring)
  |
Phase 0: Learnings Retrieval       -> institutional knowledge
Phase 1: Discovery (parallel)      -> history/<feature>/discovery.md
Phase 2: Synthesis                 -> history/<feature>/approach.md
Phase 3: Phase Contract            -> history/<feature>/phase-contract.md
Phase 4: Story Mapping             -> history/<feature>/story-map.md
Phase 5: Multi-Perspective Check   -> refine approach/contract/story map (HIGH-stakes only)
Phase 6: Bead Creation             -> .beads/*.md via br create
  |
Handoff: "Invoke pulse:validating skill"
```

## Before You Start

**Read CONTEXT.md first.** It is the single source of truth. Every research decision, every story, every bead must honor the locked decisions inside it.

```bash
cat history/<feature>/CONTEXT.md
```

If `CONTEXT.md` does not exist, stop. Tell the user: "Run the pulse:exploring skill first to lock decisions before planning."

If `.pulse/tooling-status.json` says `blocked`, stop and clear preflight blockers before planning further.

If a larger roadmap or whole-plan document exists, read it too. The phase contract must explain how this phase contributes to the larger arc.

---

## Phase 0: Learnings Retrieval

Institutional knowledge prevents re-solving solved problems. This phase is mandatory.

### Step 0.1: Always read critical patterns

```bash
cat history/learnings/critical-patterns.md
```

### Step 0.2: Grep for domain-relevant learnings

Extract 3-5 domain keywords from the feature name and `CONTEXT.md`, then run focused searches:

```bash
grep -r "tags:.*<keyword1>" history/learnings/ -l -i
grep -r "tags:.*<keyword2>" history/learnings/ -l -i
grep -r "<ComponentName>" history/learnings/ -l -i
```

### Step 0.3: Score and include

- Strong match -> read full file, include its insight
- Weak match -> skip

### Step 0.4: Document what you found

At the top of `history/<feature>/discovery.md`, add an `Institutional Learnings` section. If nothing relevant exists, write: `No prior learnings for this domain.`

---

## Phase 1: Discovery (Goal-Oriented Exploration)

Map the codebase, identify constraints, and research external patterns to the depth the phase requires.

### Discovery areas

Always explore:

1. **Architecture topology** — where this phase fits in the codebase
2. **Existing patterns** — what should be reused or modeled after
3. **Technical constraints** — runtime, deps, build/test requirements

Explore if relevant:

4. **External research** — only when the phase introduces a novel library, integration, or pattern

### Parallelization guidance

- **Standard phase**: 2-3 agents covering architecture, patterns, constraints
- **New integration/library**: 3-4 agents including external research
- **Pure refactor**: 1-2 agents focused on existing patterns and constraints
- **Architecture change**: go deep on topology and pattern replacement risk

If `.pulse/tooling-status.json` says `gkg` is ready, invoke `pulse:gkg` for the architecture snapshot, pattern search, and symbol/reference tracing portions of discovery.
If `gkg` is unavailable, fall back to `rg`, file-tree scans, and direct file reads. Record the downgrade in `discovery.md` when it materially affects confidence.

### Output

All discovery findings go to:

`history/<feature>/discovery.md`

Use `references/discovery-template.md`.

---

## Phase 2: Synthesis

Spawn a synthesis subagent to close the gap between codebase reality and the phase requirements.

Read:

- `history/<feature>/CONTEXT.md`
- `history/<feature>/discovery.md`

Write:

- `history/<feature>/approach.md`

The synthesis subagent must produce:

1. **Gap Analysis**
2. **Recommended Approach**
3. **Alternatives Considered**
4. **Risk Map**
5. **Proposed File Structure**
6. **Institutional Learnings Applied**

Use `references/approach-template.md`.

### Risk classification

| Level | Criteria | Action |
|-------|----------|--------|
| LOW | Pattern exists in codebase | Proceed |
| MEDIUM | Variation of existing pattern | Interface sketch optional |
| HIGH | Novel, external dep, blast radius >5 files | Flag for validating to spike |

For every HIGH-risk item, planning must define:

- `component`
- `reason`
- `validation_owner` = `validating`
- `spike_question` that can be answered `YES` or `NO`
- `affected_beads`
- a short decision gate with 2-3 concrete options and the recommendation
- whether the affected beads should use `testing_mode: tdd-required`

Planning does not create spike beads.

---

## Phase 3: Phase Contract

Before creating beads, define the phase as a closed loop.

Write:

- `history/<feature>/phase-contract.md`

Use `references/phase-contract-template.md`.

The phase contract must answer, in plain language:

1. Why this phase exists now
2. What the **entry state** is
3. What the **exit state** is
4. What the simplest **demo story** is
5. What this phase unlocks next
6. What is explicitly out of scope
7. What signals would force a pivot

### Rules for a good phase contract

- The exit state must be observable, not aspirational
- The phase must close a meaningful small loop by itself
- The demo story must prove the phase is real
- If the phase fails, the team should know whether to debug locally or rethink the larger plan

If you cannot explain the phase in 3-5 simple sentences, the phase is not ready. Revise the approach before moving on.

---

## Phase 4: Story Mapping

Now break the phase into **Stories**, not "plans inside a phase."

Write:

- `history/<feature>/story-map.md`

Use `references/story-map-template.md`.

### Story rules

Every story must state:

- **Purpose**
- **Why now**
- **Contributes to**
- **Creates**
- **Unlocks**
- **Done looks like**

### Story quality checks

- Story 1 must have an obvious reason to exist first
- Every story must unlock or de-risk a later story, or directly close part of the exit state
- If all stories complete, the phase exit state should hold
- If a story cannot answer "what does this unlock?" it is probably not a real story

### Story count guidance

- **Typical phase**: 2-4 stories
- **Small phase**: 1-2 stories
- **Large phase**: split into multiple phases instead of creating 5+ stories

Stories are the human-readable narrative. Beads come after.

---

## Phase 5: Multi-Perspective Check

**Only for HIGH-stakes phases**: multiple HIGH-risk components, core architecture, auth flows, data model changes, or anything with a large blast radius.

For standard phases, skip to Phase 6.

Spawn a fresh subagent with:

- `history/<feature>/approach.md`
- `history/<feature>/phase-contract.md`
- `history/<feature>/story-map.md`

Prompt:

```text
Review this phase design for blind spots.

1. Does the phase contract really close a small loop?
2. Do the stories make sense in this order?
3. What is missing from the exit state?
4. Which story is too large, vague, or poorly ordered?
5. What would the team regret 6 months from now?
```

Iterate 1-2 rounds. Stop when changes become incremental.

---

## Phase 6: Bead Creation

Only now convert the story map into executable beads using `br create`.

### Non-negotiable rule

Never write pseudo-beads in Markdown. Create the real graph with `br`.

### Bead requirements

Every bead must include:

- clear title
- description with enough context for a fresh worker
- file scope
- dependencies
- verification criteria
- explicit story association

### Canonical bead fields

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

### Create epic first, then task beads

```bash
br create "<Feature Name>" -t epic -p 1
# -> br-<epic-id>

br create "<Action: Component>" -t task --blocks br-<epic-id>
# -> br-<id>

br dep add br-<id2> br-<id1>
```

### Story-to-bead decomposition rules

- One story usually becomes 1-3 beads
- A bead should not span multiple unrelated stories
- If a story needs 4+ substantial beads, re-check whether the story is too large
- The story order should still be visible after decomposition

### Embed story context in each bead

For every bead, include:

```markdown
## Story Context

Story: <Story Name>
Purpose: <what this story makes true>
Contributes To: <phase exit-state statement>
Unlocks: <what the next story or phase can now do>

## Planning Context

From approach.md: <specific decision that applies here>

## Institutional Learnings

From history/learnings/<file>:
- <key gotcha or pattern>
```

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

### Decomposition principles

- One bead = one agent, one context window, ~30-90 minutes
- Never create a bead that requires reading 10+ files
- File scope must be tight enough for reservation planning
- Verification must be runnable and concrete
- `verification_evidence` should point to `.pulse/verification/<feature>/<bead-id>.md` or another explicit evidence record path
- `testing_mode: tdd-required` for bugfixes, stateful logic, contract changes, or other high-risk behavior changes unless the approach explicitly says otherwise
- Shared files require explicit dependencies
- Story closure matters more than layer purity
- Any relevant learnings from Phase 0 must be embedded directly into the bead
- Any referenced locked decisions from `CONTEXT.md` must be carried into the bead

### What belongs in the bead body

- what must be implemented
- why it exists
- constraints from the plan
- relevant learnings or gotchas
- verification expectations
- the chosen testing mode and why it applies
- the evidence artifact or verification record the worker should produce

Do not force workers to rediscover planning context from scratch.

### Complete the story map

After bead creation, fill the `Story-To-Bead Mapping` section in `history/<feature>/story-map.md`.

The validator must be able to trace:

`phase exit state -> story -> bead`

---

## Update STATE.md

After major planning transitions, update `.pulse/STATE.md`:

```markdown
## Current State

Skill: planning
Phase: <phase name>
Feature: <feature-name>

## Artifacts Written

- history/<feature>/discovery.md
- history/<feature>/approach.md
- history/<feature>/phase-contract.md
- history/<feature>/story-map.md
- .beads/*.md

## Story Summary

Stories: <N>
Epic: br-<id>

## Risk Summary

HIGH-risk components: [list] -> flagged for validating to spike
```

---

## Context Budget

If context exceeds 65% at any phase transition, write `.pulse/handoffs/planning.json` using the envelope in `../pulse:using-pulse/references/handoff-contract.md` and register it in `.pulse/handoffs/manifest.json`.

Planning payload should include:

- `completed_through`
- `artifacts_written`
- `beads_created`
- `open_questions`
- `stories_defined`

```json
{
  "skill": "planning",
  "feature": "<feature-name>",
  "completed_through": "Phase <N>",
  "next_phase": "Phase <N+1>",
  "artifacts": [
    "history/<feature>/discovery.md",
    "history/<feature>/approach.md",
    "history/<feature>/phase-contract.md",
    "history/<feature>/story-map.md"
  ],
  "stories_defined": ["Story 1", "Story 2"],
  "beads_created": ["br-101", "br-102"]
}
```

---

## Handoff

On successful completion:

> **Phase plan created and mapped into stories.**
>
> - Discovery: `history/<feature>/discovery.md`
> - Approach: `history/<feature>/approach.md`
> - Phase Contract: `history/<feature>/phase-contract.md`
> - Story Map: `history/<feature>/story-map.md`
> - HIGH-risk components flagged: [list or "none"]
>
> **Invoke pulse:validating skill before execution.**

HARD-GATE: do not hand off to swarming directly.

---

## Boundary Clarifications

**Planning READS** `CONTEXT.md` — it does not override locked decisions.

**Planning DEFINES** the phase contract and story map before it creates beads.

**Planning CREATES** draft beads — validating verifies and polishes them.

**Planning does the research** that exploring deliberately avoided.

**Planning does NOT run spikes** — validating owns spike execution.

---

## Red Flags

- Skipping learnings retrieval
- Ignoring `CONTEXT.md`
- Creating beads before a phase contract exists
- Creating beads before stories are clear
- Stories with no clear unlock or contribution
- Exit states that are vague or non-observable
- Writing pseudo-beads in Markdown
- Treating a prose-only bead as valid without the canonical schema fields
- Beads without `files`, `dependencies`, `verify`, `verification_evidence`, `testing_mode`, `decision_refs`, or `learning_refs`
- HIGH-risk items without a concrete `spike_question`
- Missing dependencies between beads
- Workers needing to read half the repo because planning failed to embed context
