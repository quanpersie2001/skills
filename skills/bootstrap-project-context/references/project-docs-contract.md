# Project Docs Contract

Project docs are a separate documentation plane from feature history and execution artifacts.

## Purpose

Use project docs to preserve stable repository understanding and durable architecture context for future sessions.

Do not collapse this into feature history files such as `history/<feature>/...`.

## Supported Structures

Choose exactly one context mode per repository:

1. `single-context`
   - One canonical `CONTEXT.md` at repo root.
   - Use this when one dominant domain language governs the repo.

2. `multi-context`
   - One canonical `CONTEXT-MAP.md` at repo root.
   - One `CONTEXT.md` per context area, linked from the map.
   - Use this only when separate bounded contexts have distinct vocabularies and can be mapped cleanly.

ADR support is optional in either mode:

- `adrs`
  - A directory containing Architecture Decision Records.
  - Prefer immutable ADR entries plus optional superseding ADRs.

## Mapping Artifact

Represent the selected structure in `.pulse/project-docs.json`.

This artifact is a routing map for agents and skills. In this skill, treat it as an instruction-level contract (no runtime implementation required).

Suggested shape:

```json
{
  "status": "mapped | detected | missing",
  "mode": "single-context | multi-context",
  "mode_reason": "Short explanation of why this mode fits the repo.",
  "context": {
    "root": "CONTEXT.md",
    "map": "CONTEXT-MAP.md",
    "entries": [
      {
        "id": "payments",
        "path": "docs/context/payments/CONTEXT.md"
      }
    ]
  },
  "glossary_paths": ["CONTEXT.md"],
  "adrs": {
    "enabled": true,
    "dir": "docs/adr"
  },
  "adr_paths": ["docs/adr/0001-bounded-contexts.md"]
}
```

## Scaffold Policy

If required project docs are missing:

1. Detect gaps.
2. Propose a minimal lazy scaffold plan.
3. Request explicit user confirmation before creating files.
4. Create only approved files.

Never auto-generate full docs without user confirmation.

Create `CONTEXT.md` only when the first domain term or invariant is worth recording.

Offer an ADR only when the decision is hard to reverse, surprising without context, and the result of a real trade-off.

## Templates

Use the shared templates in this directory:

- `project-context-template.md`
- `context-map-template.md`
- `adr-template.md`
