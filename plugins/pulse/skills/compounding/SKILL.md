---
name: compounding
description: Capture durable learnings from completed Pulse work so future planning gets smarter and future beads carry the right context. Invoke after reviewing completes and the feature is merged, or after a debugging session uncovers a non-obvious root cause. Runs three parallel analysis subagents (patterns/decisions/failures), synthesizes into .pulse/memory/learnings/YYYYMMDD-<slug>.md, promotes critical items to .pulse/memory/critical-patterns.md. Classifies the rest for planner-only or bead-local propagation. Key output: critical-patterns.md is read by every planning and exploring Phase 0 — this is the flywheel that makes the ecosystem smarter over time.
metadata:
  version: '1.3'
  ecosystem: pulse
  position: '8 of 9 — runs after reviewing, before next feature'
  dependencies:
    - id: beads-cli
      kind: command
      command: br
      missing_effect: degraded
      reason: Compounding reads bead history to reconstruct what work actually ran.
---

# Compounding

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

Compounding turns completed work into reusable memory.

Pulse uses a scoped memory model:

- planners ingest global learnings
- planners embed relevant learnings into beads via `learning_refs`
- workers read only bead-local learning refs, not the whole learnings corpus

This skill is where those future learnings are distilled and classified. Each feature that runs through compounding makes the next one cheaper. Skip this step and the ecosystem stays flat. Run it and it gets smarter every cycle.

## When to Use

- after `pulse:reviewing` completes and the feature is merged
- after a debugging session surfaces a non-obvious root cause
- after an abandoned feature if the failure taught something reusable

Skip only when nothing durable or reusable emerged.

---

## Phase 1: Gather Context

Collect all artifacts from the completed feature. Read:

```text
history/<feature>/CONTEXT.md          <- locked decisions (what we committed to)
history/<feature>/discovery.md        <- research findings (what we learned before coding)
history/<feature>/approach.md         <- synthesis + risk map (how we planned to do it)
.pulse/STATE.md                       <- runtime coordination state
.pulse/handoffs/manifest.json         <- and any owner files that still matter
.beads/ or `br show` output           <- the executable work graph we actually ran
review findings or review beads       <- P1/P2/P3 output from reviewing
.pulse/debug-notes/                   <- debug notes from debugging invocations
```

Also inspect the bead files to see which prior learnings were actually propagated through `learning_refs`.

Run this git command to get the feature's commit history:

```bash
git log --oneline feature/<feature-name>..main  # or the merged branch range
```

Build an internal summary:

- what was built
- what surprised us
- which prior learnings helped
- which missing learnings should have been embedded into beads

**If no history files exist:** fall back to reading the conversation/session summary and recent git diff. Compounding is still valuable even with partial context.

---

## Phase 2: Three-Category Analysis (3 Parallel Subagents)

Launch three subagents simultaneously. Each writes findings to a temp file.
Do NOT have subagents write the final learnings file — only the orchestrator writes that.

---

### Agent 1: Pattern Extractor

**Task for Agent 1:**

```
Read the feature artifacts provided. Identify all REUSABLE PATTERNS that emerged:

- Code patterns: new functions, utilities, abstractions worth standardizing
- Architecture patterns: structural decisions that worked and should be repeated
- Process patterns: workflow approaches that saved time or prevented errors
- Integration patterns: how this feature connected to other systems

For each pattern:
1. Name it concisely
2. Describe what it does and why it's valuable
3. Note the specific file/location where it was first used (if applicable)
4. State "applicable-when": under what conditions should future agents use this?

Write findings to: /tmp/compounding-patterns.md
```

---

### Agent 2: Decision Analyst

**Task for Agent 2:**

```
Read the feature artifacts provided. Identify all significant DECISIONS made during this work:

- Good calls: decisions that proved correct, saved time, or prevented problems
- Bad calls: decisions that were wrong, required rework, or added unnecessary complexity
- Surprises: things that turned out differently than expected (either direction)
- Trade-offs accepted: conscious choices where alternatives were considered

For each decision:
1. State the decision clearly (what was chosen vs what was rejected)
2. Describe how it played out in practice
3. Tag as: GOOD_CALL | BAD_CALL | SURPRISE | TRADEOFF
4. State the recommendation for future work

Write findings to: /tmp/compounding-decisions.md
```

---

### Agent 3: Failure Analyst

**Task for Agent 3:**

```
Read the feature artifacts provided. Identify all FAILURES, BLOCKERS, and WASTED EFFORT:

- Bugs introduced and their root causes
- Wrong assumptions that required backtracking
- Blockers encountered and how they were resolved (or not)
- Wasted effort: work done that turned out unnecessary
- Missing prerequisites discovered mid-execution
- Test gaps that allowed regressions

For each failure:
1. Describe what went wrong
2. Identify the root cause (not just the symptom)
3. State how long it blocked progress (estimate)
4. Write the prevention rule: what should future agents do differently?

Write findings to: /tmp/compounding-failures.md
```

---

## Phase 3: Synthesis and Propagation Triage

After all three agents complete, the orchestrator:

**Step 3.1 — Read all three temp files:**
```
/tmp/compounding-patterns.md
/tmp/compounding-decisions.md
/tmp/compounding-failures.md
```

**Step 3.2 — Triage each finding:**

Tag every learning with:
- `domain`: which technical or process domain (e.g., `auth`, `database`, `testing`, `bead-decomposition`, `agent-coordination`)
- `severity`: `critical` (affects multiple features, prevents serious waste, or reveals systemic risk) vs `standard` (valuable but feature-specific)
- `applicable-when`: concise condition for when future agents should apply this learning
- `category`: `pattern` | `decision` | `failure`

**Quality gate:** every learning MUST include a concrete `applicable-when` condition referencing a specific technical trigger (not a feeling or general advice). The `applicable-when` value must name a narrow, recognizable technical state — not a lifecycle phase. An `applicable-when` of "when implementing new features" or "when writing tests" fails this gate for the same reason as "be more thorough": neither names a trigger. Compare bad: `applicable-when: when implementing new features` vs good: `applicable-when: when migrating database columns with a non-null constraint`. If a finding from a subagent is vague (e.g., "test more carefully", "be more thorough") or has a generic `applicable-when`, rewrite it with the specific technical scenario and prevention rule, or discard it.

**Step 3.3 — Determine propagation:**

- `global-critical`
  - compact rule worth promoting to `critical-patterns.md`
  - should influence future planning broadly
- `bead-local`
  - relevant to specific implementation work
  - future planners should reference the learning file in bead `learning_refs`
- `planner-only`
  - useful for planning heuristics or decomposition
  - does not belong in worker context by default

**Step 3.4 — Determine slug:**

Create a short, descriptive slug: `<primary-topic>-<secondary-topic>` (e.g., `auth-token-refresh`, `bead-scope-isolation`, `db-migration-ordering`).

**Step 3.5 — Write the learnings file:**

```
.pulse/memory/learnings/YYYYMMDD-<slug>.md
```

Use the format from `references/learnings-template.md`. Include YAML frontmatter.

One learnings file per feature. Group related findings within that file — do NOT create separate files per finding.

---

## Phase 4: Promote Only Truly Global Learnings

For every finding tagged `severity: critical`:

**Promotion criteria (only promote if ALL are true):**
- Affects more than one potential future feature (not just this specific codebase area)
- Would cause meaningful wasted effort if future agents did not know it
- Is generalizable — not so implementation-specific it is useless elsewhere
- Is short enough to remain useful in a compact planner-read file
- Is not merely a bead-local implementation note

Do not promote narrow execution notes that should instead be carried via `learning_refs`.

**If criteria met, append to `.pulse/memory/critical-patterns.md`:**

```markdown
## [YYYYMMDD] <Learning Title>
**Category:** pattern | decision | failure
**Feature:** <feature-name>
**Tags:** [tag1, tag2]
**Propagation:** global-critical

<2-4 sentence summary of the learning and what to do differently>

**Full entry:** .pulse/memory/learnings/YYYYMMDD-<slug>.md
```

**If `.pulse/memory/critical-patterns.md` does not exist, create it with this header:**

```markdown
# Critical Patterns

Promoted global learnings for future planning and targeted debugging lookups.
Planning reads this file during Phase 0.
Debugging may consult it selectively when symptoms match a known pattern.
Workers do not read this file wholesale by default.

---
```

---

## Phase 5: Reinforce the Propagation Model

In the learning file and the compounding summary, state how the learning should flow downstream:

- `global-critical` -> planners read via `critical-patterns.md`
- `bead-local` -> future planners should attach the learning file path in `learning_refs`
- `planner-only` -> use in discovery, planning, or decomposition, not worker init

If you discover that a painful failure happened because a relevant learning never made it into the executing bead, call that out explicitly. This is a propagation failure and matters for future planning.

---

## Phase 6: Optional Memory Indexing

These steps are optional. Check `.pulse/config.json` for `cass_enabled` and `cm_enabled` flags.
If the config file is absent, skip both.

**If CASS is available:**
Index the session: provide the learnings file path to CASS for future semantic search. This enables future agents to retrieve relevant learnings by description, not just by tag.

**If CM (Cognitive Memory) is available:**
Store each critical-severity learning as a cognitive memory entry. Use the learning title as the memory key.

The file-based learnings are the primary system. CASS/CM are acceleration layers.

---

## Phase 7: Update STATE.md

Update `.pulse/STATE.md` and `.pulse/state.json` to record that compounding ran:

```markdown
## Last Compounding Run
- Feature: <feature-name>
- Date: YYYY-MM-DD
- Learnings file: .pulse/memory/learnings/YYYYMMDD-<slug>.md
- Critical promotions: N (or 0)
- Bead-local learnings: N
```

---

## Handoff

```text
Compounding complete.
- Learnings: .pulse/memory/learnings/YYYYMMDD-<slug>.md
- Critical promotions: N findings added to critical-patterns.md
- Bead-local learnings: N
- The ecosystem now has [N total] accumulated learnings.
- Future planners should use these learnings via planning Phase 0 and bead learning_refs.

Next feature starts with this knowledge available.
```

---

## Red Flags

- **Skipping compounding because "we're in a hurry."** The compound loop only works if it runs every cycle. If you are tempted to skip, run Phase 1 context gathering first — personally open and read CONTEXT.md, approach.md, review findings, and debug notes. The user's characterization of the feature ("it ran smoothly") does not count as Phase 1 completion. Only after reading the artifacts yourself, if you find zero surprises, zero failures, and zero new patterns, is a skip justified. Document the skip in STATE.md with the specific files read and what was found in each.
- **Promoting everything as global-critical.** critical-patterns.md is read at the start of every session. If it grows past 20-30 entries it becomes noise. Only promote learnings that would have saved >= 30 minutes if known in advance.
- **Writing generic learnings.** "Test more carefully" is worthless. "When migrating database columns with a non-null constraint, always provide a default in the migration or it will fail in production with zero rows affected" is valuable.
- **Fabricating findings.** If the feature ran smoothly with no surprises, write that. A short learnings file with 2 genuine entries is better than a long file with invented ones.
- **Assuming every worker should read `critical-patterns.md`.** Workers read bead-local `learning_refs` only.
- **Not recording when missing `learning_refs` contributed to waste.** This is the most actionable feedback for improving future planning.

---

## References

- `references/learnings-template.md` — full template for learnings files with YAML frontmatter
