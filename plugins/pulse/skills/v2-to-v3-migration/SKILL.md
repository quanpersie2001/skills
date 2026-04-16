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
5. After apply, inspect `details.onboarding_apply.managed_assets.migration_summary.normalization_queue`.
6. If the queue contains migrated learning memory or critical patterns, do a second pass in the skill: reread each queued source/destination pair and rewrite the destination into the canonical v3 contract.
7. If semantic normalization is skipped, invalid, or cannot preserve the source facts, keep the fallback file written by the script instead of failing the migration.
8. Re-run the check or continue via `pulse:using-pulse`.

## Post-apply normalization contract

The script owns safe file movement, provenance, conflict handling, and deterministic fallback formatting. The skill owns semantic normalization after the script finishes.

Use the queue, not a fresh repo-wide scan:
- `normalization_queue.learning_memory[]`
- `normalization_queue.critical_patterns[]`

Each queue entry includes bounded rewrite inputs:
- `source_path`
- `destination_path`
- `source_hash`
- `target_kind`
- `destination_contains_fallback`

Normalization rules:
- preserve the source facts; do not invent incidents, scope, signals, or severity
- rewrite migrated memory entries into the current v3 templates under `.pulse/memory/learnings/`, `.pulse/memory/corrections/`, and `.pulse/memory/ratchet/`
- rewrite migrated critical patterns into `.pulse/memory/critical-patterns.md` as clean canonical entries
- keep provenance markers intact or replace them with an equivalent marker that still records source path, hash, and semantic-normalized status
- if the rewrite fails validation or loses source meaning, restore or keep the fallback output

Do not hardwire a provider-specific API client into the migration script. This skill-level pass should be done by prompting the model after the script run.

## Handoff to the rest of Pulse

- If migration returns `up_to_date`, continue through normal bootstrap.
- If it returns `needs_migration`, do not continue into planning or execution until the repo is updated or the user declines.
- If it returns `missing_runtime`, stop and have the user install or upgrade Node.js first.
