# Discovery Report: <Feature Name>

**Date**: <YYYY-MM-DD>
**Feature**: <feature-slug>
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

### Relevant Packages / Modules

| Package/Module | Purpose | Key Files |
|----------------|---------|-----------|
| `packages/domain` | Entities, ports | `src/entities/`, `src/ports/` |
| `packages/application` | Use cases, orchestration | `src/usecases/` |
| ... | ... | ... |

### Entry Points

- **API**: `packages/api/src/routers/...`
- **UI**: `apps/web/src/routes/...`
- **Server**: `apps/server/src/...`
- **Workers/Jobs**: `...` _(if applicable)_

### Key Files to Model After

- `<path>` — demonstrates `<pattern>` (use as reference for `<new component>`)
- `<path>` — demonstrates `<pattern>`

---

## Agent B: Pattern Search

> Source: GitNexus context/impact/route analysis + grep

### Similar Existing Implementations

| Feature/Component | Location | Pattern Used | Reusable? |
|-------------------|----------|--------------|-----------|
| [e.g., User CRUD] | `packages/domain/src/entities/user.ts` | Entity + Port + UseCase | Yes |
| ... | ... | ... | ... |

### Reusable Utilities

- **Validation**: `<path>` — `<what it does>`
- **Error handling**: `<path>` — `<what it does>`
- **Shared types**: `<path>`
- _(List any utility that the new feature should reuse rather than reimplement)_

### Naming Conventions

- Entities: `PascalCase` (e.g., `Invoice`, `Subscription`)
- Ports/Interfaces: `<Noun>Repository`, `<Noun>Service`
- Use cases: `<verb>-<noun>.ts` (e.g., `create-invoice.ts`)
- API routes: `<resource>s` plural (e.g., `/invoices`)
- Tests: `<filename>.test.ts` co-located or in `__tests__/`

---

## Agent C: Constraints Analysis

> Source: package.json, tsconfig, .env.example, lockfile

### Runtime & Framework

- **Node version**: `>=<version>`
- **Runtime**: Bun / Node / Deno
- **Language**: TypeScript `<version>`
- **Framework**: `<name>` `<version>`

### Existing Dependencies (Relevant to This Feature)

| Package | Version | Purpose |
|---------|---------|---------|
| [e.g., drizzle-orm] | [version] | ORM |
| ... | ... | ... |

### New Dependencies Needed

| Package | Reason | Risk Level |
|---------|--------|------------|
| [e.g., stripe] | Payment SDK | HIGH — new external dep |
| ... | ... | ... |

### Build / Quality Requirements

```bash
# Must pass before bead is closeable:
bun run check-types    # TypeScript type-check
bun run build          # Full build
bun run test           # Test suite
bun run lint           # Linter
```

### Database / Storage (if applicable)

- **ORM**: Drizzle / Prisma / raw SQL
- **Schema location**: `packages/db/src/schema/`
- **Migration command**: `bun run db:push` (dev) / `bun run db:migrate` (prod)

---

## Agent D: External Research

> Source: web_search, WebFetch, library docs
> Guided by locked decisions in CONTEXT.md — not generic research

### Library Documentation

| Library | Version | Key Docs |
|---------|---------|----------|
| [e.g., stripe] | 14.x | [URL or inline summary] |
| ... | ... | ... |

### Community Patterns

- **Pattern**: `<description>`
  - Why it applies: `<reason>`
  - Reference: `<URL>`

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
