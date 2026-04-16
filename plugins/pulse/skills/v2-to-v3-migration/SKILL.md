---
name: v2-to-v3-migration
description: Use when a repo has stale Pulse onboarding, legacy Python hooks, or a partial pre-3.0.0 install that needs Pulse v2-to-v3 migration.
metadata:
  version: '1.0'
  dependencies:
    - id: node-runtime
      kind: command
      command: node
      missing_effect: unavailable
      reason: The migration wrapper and onboarding authority require Node.js 18+.
---

# v2-to-v3-migration

Use this skill when a repo already has Pulse traces from an older layout and needs a safe path onto the current `3.x` structure.

This is a migration wrapper, not a second installer. It reuses the existing onboarding authority from `using-pulse/scripts/onboard_pulse.mjs` so the mutation rules stay in one place.

## When to Use

- `pulse:preflight` or `pulse:using-pulse` says the repo needs Pulse migration
- `.pulse/onboarding.json` exists but points at an older plugin version
- `.codex/hooks.json` or `.codex/hooks/` still references legacy Python Pulse hooks
- the repo has a partial Pulse install and needs the current Node-based support files

## Safety Contract

Migration is read-only by default.

Preserve these boundaries without exception:
- keep AGENTS content outside the managed Pulse markers
- keep unrelated `.codex/hooks.json` entries
- keep existing `.pulse/memory/`, checkpoints, handoffs, runs, and other repo-local Pulse data
- never replace an unmanaged `compact_prompt` unless the user explicitly approves replacement

## Commands

Check first:

```bash
node plugins/pulse/skills/v2-to-v3-migration/scripts/migrate_pulse_v2_to_v3.mjs --repo-root <project_root>
```

Apply after approval:

```bash
node plugins/pulse/skills/v2-to-v3-migration/scripts/migrate_pulse_v2_to_v3.mjs --repo-root <project_root> --apply
```

Only if the user explicitly approved replacing an unmanaged compact prompt:

```bash
node plugins/pulse/skills/v2-to-v3-migration/scripts/migrate_pulse_v2_to_v3.mjs --repo-root <project_root> --apply --allow-compact-prompt-replace
```

## Status Contract

The script reports one of:

- `up_to_date` — repo already matches the current Pulse layout
- `needs_migration` — repo needs migration or onboarding updates before normal v3 bootstrap can continue
- `missing_runtime` — Node.js 18+ is not available, so migration cannot run

The payload also surfaces:
- `legacy_signals` — why this looks like v2 or a stale install
- `actions` — the underlying onboarding actions that would be applied
- `requires_confirmation` — whether unmanaged `compact_prompt` replacement would need approval
- `preservation_guarantees` — the non-destructive boundaries the wrapper keeps intact

## Operator Flow

1. Run the check command.
2. Read the `legacy_signals` and `actions`.
3. If `requires_confirmation = true`, explain that Pulse will preserve the existing unmanaged compact prompt unless the user explicitly approves replacement.
4. Ask before running `--apply`.
5. After apply, re-run the check or continue via `pulse:using-pulse`.

## Handoff to the rest of Pulse

- If migration returns `up_to_date`, continue through normal bootstrap.
- If it returns `needs_migration`, do not continue into planning or execution until the repo is updated or the user declines.
- If it returns `missing_runtime`, stop and have the user install or upgrade Node.js first.
