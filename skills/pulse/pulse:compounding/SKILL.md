---
name: pulse:compounding
description: Capture durable learnings from completed Pulse work so future planning gets smarter and future beads carry the right context. Invoke after reviewing completes and the feature is merged, or after a debugging session uncovers a non-obvious root cause. Produces learning files, promotes only truly global rules to critical-patterns.md, and classifies the rest for planner-only or bead-local propagation.
metadata:
  version: '1.1'
  ecosystem: pulse
  position: '8 of 9 - runs after reviewing'
---

# Compounding

Compounding turns completed work into reusable memory.

Pulse now uses a scoped memory model:

- planners ingest global learnings
- planners embed relevant learnings into beads via `learning_refs`
- workers read only bead-local learning refs, not the whole learnings corpus

This skill is where those future learnings are distilled and classified.

## When to Use

- after `pulse:reviewing` completes and the feature is merged
- after a debugging session surfaces a non-obvious root cause
- after an abandoned feature if the failure taught something reusable

Skip only when nothing durable or reusable emerged.

## Phase 1: Gather Context

Read:

```text
history/<feature>/CONTEXT.md
history/<feature>/discovery.md
history/<feature>/approach.md
.pulse/STATE.md
.pulse/handoffs/manifest.json and any owner files that still matter
.beads/ or `br show` output
review findings or review beads
debug notes or learning candidates produced during debugging
```

Also inspect the bead files to see which prior learnings were actually propagated through `learning_refs`.

Goal:

- what was built
- what surprised us
- which prior learnings helped
- which missing learnings should have been embedded into beads

## Phase 2: Three-Category Analysis

Run three parallel subagents:

1. pattern extractor
2. decision analyst
3. failure analyst

They may write temp outputs, but only the main agent writes final learning artifacts.

### Pattern extractor

Identify reusable patterns in code, architecture, process, or integrations.

### Decision analyst

Identify good decisions, bad decisions, surprises, and accepted trade-offs.

### Failure analyst

Identify failures, blockers, wasted effort, missing prerequisites, and test gaps.

## Phase 3: Synthesis and Propagation Triage

After the parallel analysis completes, triage every learning with:

- `domain`
- `severity`
- `applicable-when`
- `category`
- `propagation`

### Propagation values

- `global-critical`
  - compact rule worth promoting to `critical-patterns.md`
  - should influence future planning broadly
- `bead-local`
  - relevant to specific implementation work
  - future planners should reference the learning file in bead `learning_refs`
- `planner-only`
  - useful for planning heuristics or decomposition
  - does not belong in worker context by default

Create the slug and write:

```text
history/learnings/YYYYMMDD-<slug>.md
```

Use `references/learnings-template.md`.

## Phase 4: Promote Only Truly Global Learnings

Promote a learning to `history/learnings/critical-patterns.md` only if all are true:

- it affects multiple future features or domains
- it would save meaningful time or prevent serious waste if known earlier
- it is short enough to remain useful in a compact planner-read file
- it is not merely a bead-local implementation note

Do not promote narrow execution notes that should instead be carried via `learning_refs`.

If `critical-patterns.md` does not exist, create it with a header that makes the audience clear:

```markdown
# Critical Patterns

Promoted global learnings for future planning and targeted debugging lookups.
Planning reads this file during Phase 0.
Debugging may consult it selectively when symptoms match a known pattern.
Workers do not read this file wholesale by default.

---
```

## Phase 5: Reinforce the Propagation Model

In the learning file and the compounding summary, state how the learning should flow downstream:

- `global-critical` -> planners read via `critical-patterns.md`
- `bead-local` -> future planners should attach the learning file path in `learning_refs`
- `planner-only` -> use in discovery, planning, or decomposition, not worker init

If you discover that a painful failure happened because a relevant learning never made it into the executing bead, call that out explicitly.

## Phase 6: Optional Memory Indexing

If optional memory systems exist, index the final learning file there.
File-based learnings remain the source of truth.

## Phase 7: Update STATE.md

Record:

- feature
- date
- learnings file path
- number of global promotions
- number of bead-local learnings

## Handoff

```text
Compounding complete.
- Learnings file written
- Global promotions: <N>
- Bead-local learnings: <N>
- Future planners should use these learnings via planning Phase 0 and bead learning_refs.
```

## Red Flags

- promoting everything as global-critical
- assuming every worker will read `critical-patterns.md`
- writing generic lessons with no actionable guidance
- failing to distinguish planner-only vs bead-local learnings
- not recording when missing `learning_refs` contributed to waste

## References

- `references/learnings-template.md`
