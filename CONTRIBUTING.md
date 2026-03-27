# Contributing

This repo packages one plugin, `pulse`, with its canonical source under [`plugins/pulse/`](plugins/pulse). Use this guide when creating or editing skills, updating manifests, or changing the public workflow contract.

## Repository Truth

These paths matter most:

- [`plugins/pulse/skills/`](plugins/pulse/skills) is the only source of truth for skill content
- [`plugins/pulse/.codex-plugin/plugin.json`](plugins/pulse/.codex-plugin/plugin.json) is the Codex package manifest
- [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json) exposes the packaged `pulse` plugin to Codex
- [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) enumerates every skill path for Claude Code
- [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) exposes the Claude Code marketplace entries
- [`AGENTS.md`](AGENTS.md), [`README.md`](README.md), and this file are public contract docs and must stay in sync with the actual skills

## Where Skills Live

All shipped skills live under [`plugins/pulse/skills/`](plugins/pulse/skills).

```text
plugins/pulse/skills/
  using-pulse/
  preflight/
  exploring/
  planning/
  validating/
  swarming/
  executing/
  reviewing/
  compounding/
  debugging/
  gkg/
  dream/
  writing-pulse-skills/
  ai-multimodal/
  prompt-leverage/
  simplify-code/
  systematic-debug-fix/
```

Folder names are filesystem-safe and unprefixed. The namespace belongs in frontmatter:

- folder: `planning`
- skill name: `pulse:planning`

## SKILL.md Format

Every skill needs a `SKILL.md` with YAML frontmatter and a markdown body.

```yaml
---
name: pulse:my-skill
description: >-
  Use when this skill clearly applies. State the trigger scenarios, the kinds
  of requests it handles, and the artifacts or outcomes it produces.
metadata:
  version: '1.0'
  ecosystem: pulse
---

# My Skill

Operational instructions the agent follows when the skill is invoked.
```

### Required Fields

| Field | Purpose |
|-------|---------|
| `name` | Public skill identifier. Use `pulse:` for Pulse ecosystem skills and plain names for standalone skills |
| `description` | Trigger text for skill matching. This is the most important field |

### Common Optional Fields

| Field | Example | Purpose |
|-------|---------|---------|
| `metadata.version` | `'1.1'` | Track revisions |
| `metadata.ecosystem` | `pulse` | Group related skills |
| `metadata.type` | `bootstrap`, `support`, `meta` | Classify the role |
| `metadata.position` | `'4 of 9'` | Document chain placement when useful |
| `allowed-tools` | `Read, Write, Bash` | Restrict tools |
| `model` | `claude-sonnet-4-20250514` | Request a model |
| `mode` | `ultrathink` | Thinking mode preference |
| `license` | `MIT` | License declaration |

## Writing Good Descriptions

Descriptions decide whether a skill fires. Treat them as search metadata, not as mini-instructions.

Good:

```yaml
description: >-
  Systematic debugging for blocked work, test failures, build errors, runtime
  crashes, and integration issues in Pulse. Use when a worker is stuck, a
  verification step fails, or reviewing/UAT hands the work back.
```

Bad:

```yaml
description: Helps with debugging things
```

A strong description:

- starts with clear trigger scenarios
- includes user verbs such as `build`, `plan`, `review`, `debug`, `simplify`
- mentions outputs when that sharpens routing, such as `writes CONTEXT.md` or `creates review beads`
- stays concise enough to be scanned as metadata
- avoids retelling the workflow, because agents can mistake description text for the full instructions

## Skill Directory Layout

Use this shape by default:

```text
my-skill/
├── SKILL.md
├── references/
├── scripts/
└── agents/
```

Conventions:

- `SKILL.md` is required
- `references/` holds templates, probes, rubrics, and reference notes that the skill explicitly tells the agent to read
- `scripts/` holds executable helpers the skill invokes
- `agents/` holds subagent configuration or prompt files
- avoid adding extra human-only files inside skill directories unless they are genuinely part of the runtime contract; contributor-facing docs should live at repo root or under `references/`

`references/` files are never auto-loaded. The `SKILL.md` body must explicitly tell the agent when to read them.

## Pulse Workflow Conventions

Skills in the `pulse:` namespace inherit extra rules.

### Bootstrap and Chain Order

Pulse sessions start with bootstrap:

```text
pulse:preflight -> pulse:using-pulse
```

The delivery chain is:

```text
pulse:exploring -> pulse:planning -> pulse:validating -> pulse:swarming -> pulse:executing -> pulse:reviewing -> pulse:compounding
```

Support routing may also invoke `pulse:debugging`, `pulse:gkg`, or `pulse:dream`.

### Hard Contract Rules

- Never execute without `pulse:validating`
- `history/<feature>/CONTEXT.md` is the source of truth
- quick mode still validates and reviews; it only reduces depth
- `P1` review findings always block merge
- pause/resume uses `.pulse/handoffs/manifest.json` plus owner-scoped handoff files under `.pulse/handoffs/`
- chain skills should update `.pulse/STATE.md` when they change phase ownership

### Bead Contract

Planning and validating now assume a canonical bead schema. These fields must exist:

- `dependencies`
- `files`
- `verify`
- `verification_evidence`
- `testing_mode`
- `decision_refs`
- `learning_refs`

If `testing_mode: tdd-required`, the bead must also include `tdd_steps` with distinct red and green commands.

### Reviewing and Debugging

Public docs and skill changes should preserve these current behaviors:

- `pulse:reviewing` includes specialist review, artifact verification, review intake, and human UAT
- verification evidence is a first-class artifact, not a vague claim in prose
- `pulse:debugging` contains an Architecture Suspicion Gate that escalates repeated non-converging fixes back to planning or validating

## Adding a New Skill

1. Create the directory under [`plugins/pulse/skills/`](plugins/pulse/skills):

   ```bash
   mkdir -p plugins/pulse/skills/my-skill
   ```

2. Write `SKILL.md`.

3. Add `references/`, `scripts/`, or `agents/` only when the skill really needs them.

4. If the skill is exposed to Claude Code, update:
   - [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)
   - [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)

5. Codex packaging usually does not need a per-skill manifest change because [`plugins/pulse/.codex-plugin/plugin.json`](plugins/pulse/.codex-plugin/plugin.json) already points Codex at `./skills/`.

6. Update any public docs that mention the changed contract. That often includes:
   - [`README.md`](README.md)
   - [`CONTRIBUTING.md`](CONTRIBUTING.md)
   - [`AGENTS.md`](AGENTS.md)
   - lineage docs under [`references/lineage/`](references/lineage)

7. Test the skill end to end.

## Testing a Skill

Minimum check:

1. Install the local repo marketplace in Codex or Claude Code
2. Start a fresh session
3. Ask for something that should trigger the skill
4. Verify the right skill is discovered and the body instructions are followed

For Pulse ecosystem skills, use [`pulse:writing-pulse-skills`](plugins/pulse/skills/writing-pulse-skills/SKILL.md). That skill is the repo-standard process for pressure testing:

- write pressure scenarios first
- observe baseline rationalization without the skill
- change the skill to close those gaps
- rerun the scenarios to confirm behavior improved

When editing chain skills, also test the surrounding contract:

- `preflight` and `using-pulse` still route correctly
- quick mode still includes validating and reviewing
- owner-scoped handoffs still point at `.pulse/handoffs/manifest.json`
- bead schema changes still line up across planning, validating, executing, and reviewing

## Documentation Rules

- use repository-relative links for files that live in this repo
- external links are fine when you are citing upstream projects or public documentation
- never commit absolute local filesystem paths such as `/Users/...`
- verify links point to real files
- treat drift between docs and shipped skills as a bug

## Standalone Skills

Standalone skills use the same `SKILL.md` structure, but they do not need Pulse chain handoffs or `.pulse/STATE.md` updates unless they explicitly integrate with the main workflow.
