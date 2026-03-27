---
name: pulse:gkg
description: Use when asked about codebase architecture, finding files or definitions related to a feature, tracing symbol relationships, checking how a module is wired, or when pulse:planning needs a discovery snapshot and gkg is available.
metadata:
  version: '1.0'
  ecosystem: pulse
  type: support
---

# gkg

Codebase intelligence support skill for Pulse.

Use this when structural codebase understanding matters more than line-by-line implementation:

- architecture snapshots
- finding definitions related to a feature
- tracing symbol references and module relationships
- confirming existing patterns before planning
- accelerating Pulse discovery when `gkg` is available

`pulse:gkg` is a support skill. It does not replace reading files. It helps narrow where to read and what to trust.

## Before You Start

1. Read `.pulse/tooling-status.json` if it exists.
2. Check whether `gkg` is marked ready.
3. If `gkg` is unavailable, use the fallback section below.

Do not assume `gkg` exists just because `pulse:planning/mcp.json` mentions it. Preflight is the source of truth for tool readiness.

## When to Use

- User asks: "What is the architecture of this project?"
- User asks: "Find files related to X"
- User asks: "Show me where Y is defined and used"
- User asks: "How is this module wired?"
- `pulse:planning` Phase 1 needs an architecture snapshot, pattern scan, or symbol trace
- `pulse:exploring` wants one lightweight pattern confirmation without deep manual analysis
- `pulse:validating` needs to confirm file-scope isolation or dependency shape for a risky bead

## Core Tooling Model

In Pulse, `gkg` is typically exposed through MCP-style tools rather than a single shell command.

The common primitives are:

- `repo_map`
  - architecture snapshot, top modules, likely entry points
- `search_codebase_definitions`
  - find definitions by symbol, concept, or subsystem
- `get_references`
  - trace where a symbol is used
- `get_definition`
  - fetch a specific definition for a symbol
- `read_definitions`
  - read multiple definitions in one pass when comparing patterns

If your runtime exposes different names, preserve the behavior, not the exact spelling.

## Usage Patterns

### 1. Architecture Snapshot

Use first when the codebase is unfamiliar and planning needs a map.

Goal:

- identify major packages or modules
- identify likely entry points
- identify a few key files to model after

Save results under `history/<feature>/discovery.md` using the `Architecture Snapshot` section from `pulse:planning/references/discovery-template.md`.

### 2. Pattern Search

Use when planning or exploring needs to answer:

- "Do we already have something like this?"
- "What pattern does this repo use for this kind of problem?"
- "Which existing files should the new work imitate?"

Prefer searching by behavior or subsystem, then follow up by reading the returned definitions directly.

Save the durable findings under `Existing Patterns` in `discovery.md`.

### 3. Symbol Trace

Use when a plan or risky change depends on how a symbol flows through the codebase.

Typical questions:

- where is this symbol defined?
- what imports or references it?
- does this file really sit on a shared path?
- will this bead collide with another bead's scope because of a shared integration point?

Use `get_definition` and `get_references` together before declaring a dependency or coordination concern.

### 4. Definition Reading

Use `read_definitions` when comparing multiple candidate patterns side by side.

This is especially useful during planning when:

- deciding between two existing patterns
- extracting the exact files that should appear in a bead's `files` scope
- confirming whether a risky component is truly novel or just a variation

## Integration with Pulse Skills

### With `pulse:planning`

This is the primary caller.

During Phase 1 Discovery:

- use `repo_map` for architecture topology
- use `search_codebase_definitions` for existing patterns and analogs
- use `get_references` or `get_definition` when file scope or coupling is unclear

Planning still owns `discovery.md`. `pulse:gkg` only accelerates the evidence-gathering step.

### With `pulse:exploring`

Use lightly.

At most:

- one architecture snapshot, or
- one pattern confirmation query

Do not let `pulse:gkg` turn exploring into deep planning. Exploring still exists to lock decisions with the user, not to perform exhaustive code research.

### With `pulse:validating`

Use selectively when validating needs to confirm:

- shared files that may break file-scope isolation
- whether a supposed dependency is real
- whether a risky component is actually novel

### With `pulse:executing`

Avoid using `pulse:gkg` as a substitute for bead context.

Workers should execute from:

- the bead
- `decision_refs`
- `learning_refs`
- `CONTEXT.md`

Only use `pulse:gkg` during execution if the bead is ambiguous enough that the work should probably bounce back to validating or planning anyway.

## Output Contract

When `pulse:gkg` is used during planning, record the relevant outputs in:

```text
history/<feature>/discovery.md
```

Capture only durable findings:

- module or package names
- exact file paths worth reading
- symbol relationships that affect scope or risk
- pattern summaries that change the plan

Do not dump raw tool output blindly into discovery artifacts. Summarize it into planning-ready form.

## Fallback Without gkg

If `gkg` is unavailable, fall back to local discovery:

- `rg --files`
- `rg "<keyword>"`
- direct file reads
- manifest and config inspection

Typical fallback mapping:

| Need | Fallback |
|---|---|
| architecture snapshot | `rg --files` + package manifests + top-level directory scan |
| definition search | `rg "<symbol or keyword>"` |
| reference trace | `rg "<symbol>"` and inspect imports/usages manually |
| pattern comparison | read 2-4 likely files directly |

If the fallback materially weakens discovery confidence, note that in `discovery.md`.

## Red Flags

- treating `gkg` as a replacement for reading the actual code
- using `pulse:gkg` to bypass `pulse:exploring` and make product decisions from code alone
- running deep `gkg` analysis during execution instead of bouncing an ambiguous bead back upstream
- copying raw tool output into `discovery.md` without summarizing why it matters
- assuming structural similarity means behavioral equivalence without reading the key files

## Handoff

```text
Codebase intelligence gathered. Record the durable findings in discovery artifacts and continue with pulse:planning or the calling skill.
```
