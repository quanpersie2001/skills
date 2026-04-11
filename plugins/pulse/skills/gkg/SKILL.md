---
name: gkg
description: >-
  Codebase intelligence support skill for Pulse using the gkg MCP tools. Use when
  planning or discovery needs an architecture snapshot, file or definition
  discovery, existing-pattern evidence, importer lookups, or a quick symbol
  trace in a supported repo. Primary path: scout readiness with
  `node .codex/pulse_status.mjs --json`, then `repo_map` plus
  `search_codebase_definitions` plus `read_definitions`.
metadata:
  version: '1.1'
  ecosystem: pulse
  type: support
  dependencies:
    - id: gkg
      kind: mcp_server
      server_names: [gkg]
      config_sources: [repo_codex_config, global_codex_config, plugin_mcp_manifest]
      missing_effect: unavailable
      reason: gkg skill requires the gkg MCP server for all codebase intelligence queries.
---

# gkg

Codebase intelligence support skill for Pulse.

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` first.

## Start With The Repo Scout

Do not start with `which gkg` or an imagined `gkg <subcommand>` discovery flow.

Run:

```bash
node .codex/pulse_status.mjs --json
```

Use the scout output as the source of truth for this repo:

- `gkg_readiness.supported_repo = false`: do not force gkg; use the fallback section below.
- `gkg_readiness.server_reachable = false`: gkg is not ready for query work yet.
- `gkg_readiness.project_indexed = false`: do not pretend MCP discovery is ready. Hand back to `pulse:using-pulse` readiness or follow the scout's `recommended_action`.
- If readiness is green, use MCP tools for discovery. Do not switch back to a CLI-shaped discovery workflow.

In Pulse, readiness is exposed through the scout. Treat that as the normal operator path.

## What Is Reliable Here

Use gkg as a discovery accelerator, not as a replacement for reading files.

Strong, normal-path tools in this repo:

- `list_projects`
- `index_project`
- `repo_map`
- `search_codebase_definitions`
- `read_definitions`

Helper-only tool:

- `import_usage` if your runtime exposes it

Non-core, lower-confidence tools:

- `get_references`
- `get_definition`

The practical rule is simple: use `repo_map` plus `search_codebase_definitions` plus `read_definitions` first, then fall back to local inspection whenever symbol-linking looks thin or suspicious.

## Primary Discovery Path

Use this path by default during Pulse planning and other codebase discovery work.

### 1. `repo_map`

Use first for unfamiliar areas. It is the best starting point for a compact architecture snapshot.

Use it to answer:

- which directories and files matter for this feature
- which files expose the main definitions in a target area
- how the local repo slice is shaped before deeper reads

When discovery is being written down for planning, save the result or summary to `history/<feature>/discovery.md` under `## Architecture Snapshot`.

### 2. `search_codebase_definitions`

Use next to find candidate symbols, classes, functions, constants, or handlers related to the feature.

Good uses:

- find auth entry points
- find route handlers
- find data access helpers
- find existing naming and pattern anchors before proposing a new approach

Keep search terms concrete and code-shaped. Prefer symbol names or narrow domain phrases over prose.

### 3. `read_definitions`

Use immediately after `search_codebase_definitions` to read the strongest matches in full.

This is the main evidence-gathering step. It is usually better than hopping file-to-file manually because it keeps discovery centered on actual definitions instead of filenames alone.

When planning writes formal discovery output, summarize the findings in `history/<feature>/discovery.md` under `## Existing Patterns`.

## Tool Guidance

### `list_projects`

Use as a light sanity check when the scout says gkg should work and you want to confirm the repo is present in the index.

Do not treat this as the primary readiness check. The scout comes first.

### `index_project`

Use to refresh an indexed project when the index is stale or after significant repo changes.

Do not use this as the first response to `project_indexed = false` in the scout unless the surrounding readiness workflow explicitly called for it.

### `get_references`

Treat as non-core and low-confidence in this repo.

Use it only when:

- you already know the exact definition to inspect
- you want a quick inbound-usage hint
- you are prepared to verify the answer with local file reads or `rg`

If it misses callers, gives a thin set, or returns ambiguous results, fall back immediately to `rg -n "<symbol>"` and nearby file inspection.

### `get_definition`

Treat as non-core and low-confidence in this repo.

Use it only as a quick jump helper from a known call site to a likely definition. Always confirm with `read_definitions` or a direct file read before relying on it.

If it cannot resolve the symbol cleanly, do not fight it. Fall back to `search_codebase_definitions`, `read_definitions`, and `rg`.

## Pulse Workflow Fit

Use this skill mainly during `pulse:planning` discovery work.

- `repo_map` feeds the architecture snapshot.
- `search_codebase_definitions` plus `read_definitions` feed the existing-pattern evidence.
- `get_references` and `get_definition` are optional spot tools, not the backbone of the workflow.

If planning is producing `history/<feature>/discovery.md`, keep the saved output concise and evidence-based:

- `## Architecture Snapshot`
- `## Existing Patterns`
- `## Dependency Notes` when importer or caller evidence materially affects the plan

Do not dump raw tool output when a short grounded summary will do.

## Practical Fallback Without gkg

If the scout says gkg is unsupported or not ready, use local inspection with `rg`.

Useful fallbacks:

- file inventory: `rg --files`
- narrow slice inventory: `rg --files | rg 'auth|router|db|queue'`
- symbol search: `rg -n "MySymbol|myFunction|authMiddleware" .`
- importer search: `rg -n "^import .*from ['\"].*target|require\\(.*target" .`
- definition search: `rg -n "export (async )?function|class |const .*=" .`

Then read the relevant files directly.

If planning is writing discovery output, note the fallback plainly in `history/<feature>/discovery.md`, for example:

> gkg was unavailable or not ready for this repo/session, so discovery used `rg` and direct file inspection.

## Guardrails

- Do not describe the workflow as `gkg map`, `gkg search`, `gkg refs`, or `gkg def`. Those are not the discovery interface this repo relies on.
- Do not skip the scout-based readiness check.
- Do not let symbol-linking tools outrank direct file evidence.
- Do not rely on `get_references` or `get_definition` without a fallback plan.
- Do not skip reading the actual files before code changes.

## Handoff

```text
Codebase intelligence gathered. Record the durable findings in discovery artifacts and continue with pulse:planning or the calling skill.
```
