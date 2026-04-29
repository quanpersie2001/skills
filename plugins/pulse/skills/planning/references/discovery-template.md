# Discovery Report: <Feature Name>

**Date**: <YYYY-MM-DD>
**Feature**: <feature-slug>
**Discovery output**: `history/<feature>/discovery.md`
**CONTEXT.md reference**: `history/<feature>/CONTEXT.md`

---

## Institutional Learnings

> Read during Phase 0 from `.pulse/memory/learnings/`

### Critical Patterns (Always Applied)

- [Pattern from critical-patterns.md relevant to this feature, or "None applicable"]

### Domain-Specific Learnings

| File | Module | Key Insight | Severity |
|------|--------|-------------|----------|
| [path] | [module] | [the gotcha or pattern to apply] | [high/medium] |

_If no prior learnings found: "No prior learnings for this domain."_

---

## Agent A: Architecture Snapshot

> Source: GitNexus query + direct file reads

### Relevant Areas

| Area | Purpose | Key Paths |
|------|---------|-----------|
| `[module/package/skill]` | `[responsibility]` | `[paths]` |
| ... | ... | ... |

### Execution / Change Entry Points

- **User-facing surface**: `<CLI command / skill invocation / route / workflow trigger>`
- **Primary implementation path**: `<where behavior is implemented>`
- **State/artifact updates**: `<state files, manifests, generated docs, DB, etc.>`
- **Automation hooks**: `<scripts/CI/checks touched by this work>` _(if applicable)_

### Key Files to Model After

- `<path>` — demonstrates `<pattern>` (use as reference for `<new component>`)
- `<path>` — demonstrates `<pattern>`

---

## Agent B: Pattern Search

> Source: GitNexus context/impact/route analysis + grep

### Similar Existing Implementations

| Implementation | Location | Pattern Used | Reusable? |
|----------------|----------|--------------|-----------|
| `[similar behavior/workflow]` | `<path>` | `<pattern>` | Yes/Partial/No |
| ... | ... | ... | ... |

### Reusable Building Blocks

- **Core utility/helper**: `<path>` — `<what it does>`
- **Validation/guardrails**: `<path>` — `<what it does>`
- **Shared schema/types/contracts**: `<path>`
- **Artifact/template precedent**: `<path>` _(if docs/metadata-driven)_
- _(List any existing building block to reuse instead of reimplementing)_

### Naming & Structural Conventions to Mirror

- Files/folders: `<pattern used in this repo area>`
- Public interfaces (commands, exports, schemas): `<pattern>`
- Tests/verification artifacts: `<pattern + location>`

---

## Agent C: Constraints Analysis

> Source: package.json, tsconfig, .env.example, lockfile, or equivalent repo manifests

### Environment & Runtime Constraints

- **Primary runtime/toolchain**: `<runtime(s), language(s), version constraints>`
- **Execution context**: `<CLI/plugin/server/browser/CI/docs-only>`
- **Framework/platform constraints**: `<name/version or "N/A">`

### Existing Dependencies / Inputs (Relevant to This Feature)

| Dependency/Input | Version/Source | Purpose |
|------------------|----------------|---------|
| `[library/tool/spec/internal artifact]` | `[version/path]` | `[purpose]` |
| ... | ... | ... |

### New Dependencies / Inputs Needed

| Dependency/Input | Reason | Risk Level |
|------------------|--------|------------|
| `[library/tool/data source]` | `[reason]` | LOW/MEDIUM/HIGH |
| ... | ... | ... |

### Build / Quality Requirements

```bash
# Must pass before bead is closeable:
<typecheck/build/test/lint or artifact validation commands used by this repo area>
```

### Persistence / Artifact Surface (if applicable)

- **State or schema location**: `<path or "N/A">`
- **Generation/update command**: `<command or "N/A">`
- **Backward-compat constraints**: `<if any>`

---

## Agent D: External / Adjacent Research

> Source: web_search, WebFetch, upstream docs, internal references
> Guided by locked decisions in CONTEXT.md — not generic research

### Authoritative References

| Source | Version/Date | Key Reference |
|--------|--------------|---------------|
| `[library/spec/internal standard]` | `[version/date]` | `[URL/path or inline summary]` |
| ... | ... | ... |

### Proven Patterns

- **Pattern**: `<description>`
  - Why it applies: `<reason>`
  - Reference: `<URL/path>`

### Known Gotchas / Anti-Patterns

> These are the things that burn teams. Document them to prevent re-discovery.

- **Gotcha**: `<description>`
  - Why it matters: `<reason>`
  - How to avoid: `<action>`

- **Anti-pattern**: `<description>`
  - Common mistake: `<what people try>`
  - Correct approach: `<what to do instead>`

---

## Open Questions

> Items that were not resolvable through research alone.
> These will be raised to the synthesis subagent in Phase 2.

- [ ] `<Question>` — needed to finalize approach for `<component>`
- [ ] `<Question>` — impacts risk level of `<component>`

---

## Summary for Synthesis (Phase 2 Input)

> Brief synthesis for the subagent prompt. Fill this in after all agents complete.

**What we have**: `<1-2 sentences on existing codebase state relevant to the feature>`

**What we need**: `<1-2 sentences on the gap>`

**Key constraints from research**:
- `<Constraint 1>` (from Agent C)
- `<Constraint 2>` (from Agent D — gotcha)

**Institutional warnings to honor**:
- `<Learning from Phase 0 that must influence the approach>`
