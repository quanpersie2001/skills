# Approach: <Feature Name>

**Date**: <YYYY-MM-DD>
**Feature**: <feature-slug>
**Based on**:
- `history/<feature>/discovery.md`
- `history/<feature>/CONTEXT.md`

---

## 1. Gap Analysis

| Component | Have | Need | Gap Size |
|---|---|---|---|
| <component> | <what exists> | <what is needed> | <small / medium / large> |

---

## 2. Recommended Approach

Describe the concrete strategy in 3-5 sentences.

### Why This Approach

- <reason tied to an existing pattern>
- <reason tied to a locked decision>
- <reason tied to a discovery finding>

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| <decision> | <choice> | <why> |

### Architecture Baseline for Phase Slicing

Capture the durable architecture that phases must preserve.

#### Enduring Foundations

- <foundation that persists across all phases>
- <invariant that later work cannot bypass>

#### Ownership and Contracts

| Boundary | Owner | Contract / Interface | Constraint to Preserve |
|---|---|---|---|
| <module boundary> | <owner> | <API/event/data contract> | <what later phases must not violate> |

---

## 3. Alternatives Considered

### Option A: <name>

- Description: <brief>
- Why considered: <why it looked viable>
- Why rejected: <specific reason>

### Option B: <name>

- Description: <brief>
- Why considered: <why it looked viable>
- Why rejected: <specific reason>

---

## 4. Risk Map

Every component or subsystem touched by the feature must appear here.

| Component | Risk Level | Reason | Validation Owner | Spike Question | Affected Beads |
|---|---|---|---|---|---|
| <component> | LOW | <reason> | n/a | n/a | <bead ids or planned bead titles> |
| <component> | MEDIUM | <reason> | validating or n/a | <only if needed> | <beads> |
| <component> | HIGH | <reason> | validating | <YES/NO question> | <beads> |

### Rules for HIGH Risk

For every `HIGH` row:

- `Validation Owner` must be `validating`
- `Spike Question` must be present
- the question must be answerable `YES` or `NO`
- the question must be specific enough to materialize into a spike bead without re-planning

If there are no HIGH-risk items, write `n/a` in `Spike Question`.

### High-Risk Decision Gate

For every `HIGH` row, include a short decision gate in the prose around the risk map or in the recommended approach:

- 2-3 concrete options that were considered
- the recommended option
- the user-visible or validator-visible decision that must be locked before execution
- whether the affected beads should use `testing_mode: tdd-required`

---

## 5. Proposed File Structure

```text
<expected directories and files>
```

---

## 6. Dependency Order

Describe the intended implementation order by layers or groups.

### Parallelizable Groups

- Group A: <beads or planned work>
- Group B: <depends on Group A>

---

## 7. Institutional Learnings Applied

| Learning Source | Key Insight | How Applied |
|---|---|---|
| <learning file> | <insight> | <how it changed the plan> |

If none: `No prior institutional learnings relevant to this feature.`

---

## 8. Open Questions for Validating

- [ ] <question> - <why it matters>

If none: `No open questions. Plan is complete.`
