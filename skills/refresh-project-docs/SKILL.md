---
name: refresh-project-docs
description: Use when repository documentation is stale and the user asks to refresh docs to match the current codebase and workflows.
metadata:
  version: '1.0'
  dependencies: []
---

# Refresh Project Docs

Update documentation from the live repo state, not from outdated docs or feature-memory summaries.

If the user asks to improve or templatize a docs-refresh prompt, route to `pulse:prompt-leverage` first, then return here for docs execution.

## Mode

- `Docs execution`: inspect the repo and update the relevant docs directly.

## Workflow

### 1. Inventory the documentation surface

Find the docs that may need to move together:

- `README.md`
- contributor or setup docs
- `docs/` pages
- examples, templates, or onboarding guides
- CLI or API docs generated from source-adjacent files

Do not assume the README is the only source that matters.

### 2. Rebuild the current product and workflow state

Treat the repository as the source of truth.

Check the most authoritative artifacts available, such as:

- command help text, scripts, task runners, and package manifests
- config files, environment examples, and migration files
- implementation code for user-facing features
- tests that document supported behavior
- existing docs only after comparing them to the code

When commands, flags, options, or workflows can be verified from source, verify them instead of inferring.

### 3. Identify documentation deltas

Capture what the docs need to describe in their current form:

- current commands, subcommands, flags, and options
- current setup, install, deploy, and development flows
- current features, integrations, and limitations
- renamed, removed, or superseded behavior that should disappear from the docs
- duplicated guidance that now needs to be synchronized across files

### 4. Rewrite in evergreen current-state language

Write as if the documented behavior has always been part of the project.

Use these rules without exception:

- describe the present state, not the history of how it changed
- remove stale wording instead of narrating the transition
- preserve the project's voice and structure unless a clearer structure is needed
- update every relevant doc file that carries the affected information

Avoid release-note phrasing such as:

- `we added`
- `now supports`
- `recently`
- `has been updated`
- `X is now Y`

### 5. Verify before finishing

Check that:

- commands and examples match the real interface
- options and configuration names match the current code
- duplicated docs agree with each other
- stale statements, placeholders, and contradictions are removed
- links still resolve if you touched public docs

## Red Flags

Stop and correct the approach if any of these appear:

- trusting existing docs without checking source
- updating only `README.md` when the same information lives elsewhere
- documenting commands or flags that were not verified
- keeping historical phrasing like a mini changelog
- leaving contradictory old guidance in secondary docs

## Done Criteria

This skill is complete when the edited docs:

- describe only the current state of the project
- include the relevant commands, options, features, and workflows
- remove stale or transitional wording
- are internally consistent across the touched documentation set
