# Contributing to Pulse

Pulse is a packaged skill plugin for Claude Code and Codex. Skills are defined as `SKILL.md` files — there is no compiled code. The plugin currently ships 23 skills that chain together to move from vague requirements to shipped, reviewed, compounded code.

---

## Skill Structure

Each skill lives in its own directory:

```
plugins/pulse/skills/<skill-name>/
├── SKILL.md              ← required; the entire skill definition
├── references/           ← files the skill body explicitly tells Claude to load
└── agents/               ← subagent YAML configs (if the skill spawns workers)
```

Skills are **auto-discovered** — no per-skill registration is needed in any manifest. Adding a directory with a valid `SKILL.md` is sufficient.

---

## SKILL.md Format

```yaml
---
name: my-skill
description: >-
  Use when <concrete triggering conditions only — no workflow summary>.
  Include trigger phrases the user might say.
metadata:
  version: '1.0'
  type: core          # core | support | meta
  ecosystem: pulse
  position: 5         # position in the delivery chain (if applicable)
---

# My Skill

## Overview
Brief purpose statement.

## Steps
Numbered operational instructions Claude follows.

## Outputs
What this skill produces (files written, beads created, etc.).

## Red Flags
Behaviors that indicate something has gone wrong — stop and correct them.

## Handoff
> Load `pulse:next-skill` now. [Brief reason.]
```

**Required fields:** `name`, `description`

**Description rule:** triggering conditions only, written in third person, max 1024 chars. Never put workflow steps in the description — agents skip the skill body when they find a summary there.

---

## Naming Conventions

- Directory names: `kebab-case`, no prefix (e.g., `my-skill/`)
- Skill `name` field: bare hyphen-case (e.g., `my-skill`)
- The plugin/runtime surfaces Pulse ecosystem skills with the `pulse:` prefix
- Keep directory name and the frontmatter skill name in sync

---

## How to Test a Skill

Pulse skills use **TDD discipline** via `pulse:writing-pulse-skills`. The iron law: no skill content before a failing test.

1. Define the behavior the skill must enforce and the failure modes without it.
2. Run 3–5 pressure scenarios **without** the skill; document exact agent rationalizations verbatim.
3. Write the minimal `SKILL.md` that addresses only the observed rationalizations.
4. Re-run the same scenarios **with** the skill; every scenario must now pass.
5. If an agent still fails, the skill has a bug — capture the new rationalization, patch the skill, re-test.

The plugin does have automated coverage for onboarding/runtime control-plane behavior in `plugins/pulse/skills/using-pulse/scripts/test_onboard_pulse.mjs`, but skill quality is still judged behaviorally: does an agent comply under pressure?

---

## Editing an Existing Skill

1. Read the current `SKILL.md` in full before making any change.
2. Change only what was asked — do not add features or sections not requested.
3. The Iron Law applies to edits: even a small change requires re-running pressure scenarios.
4. Body length limit: under 400 lines. Move supporting material to `references/`.

---

## PR Process

- One skill per PR is the strong preference; unrelated skill changes should be separate PRs.
- Always bump the version before opening a PR (see Versioning below).
- Markdown links must be repository-relative — no absolute `/Users/...` paths in committed docs.

---

## Versioning

The packaged plugin manifests and marketplace metadata must stay in sync. Use the bump script instead of editing them by hand:

```bash
./scripts/bump-version.sh patch   # bug fix or minor copy change  → x.y.Z+1
./scripts/bump-version.sh minor   # new skill or behavior change  → x.Y+1.0
./scripts/bump-version.sh major   # breaking / incompatible change → X+1.0.0
```

The script updates:
- `plugins/pulse/.claude-plugin/plugin.json`
- `plugins/pulse/.codex-plugin/plugin.json`
- `.agents/plugins/marketplace.json`

The raw skill mirror is generated from `plugins/pulse/skills/` via `scripts/sync-skills.sh`; it is not versioned separately.

**When to bump:**

| Change | Bump type |
|--------|-----------|
| New skill added | `minor` |
| Existing skill behavior contract changed | `minor` |
| Typo fix, wording, doc-only change | `patch` |
| Breaking change to pipeline or bead schema | `major` |
| Version already bumped manually this session | skip |

Include the version bump commit in the same PR as the change that caused it.

---

## Key Constraint: Beads CLI

The beads CLI binary is **`br`**, not `bd`. Use `br` consistently in examples, docs, and workflow instructions.

```bash
br sync --flush-only      # flush bead changes to disk
br create ...    # create a work item
br close <id>    # close a bead
```

---

## Session Protocol

```bash
git status
git add plugins/pulse/skills/<name>/SKILL.md
br sync --flush-only
git commit -m "feat(pulse): ..."
br sync --flush-only
git push
```
