# Pulse Plugin Evaluation

This runbook defines the maintainer entrypoint for Pulse plugin evaluation.

## Primary command

Run the first-class evaluator from repo root:

```bash
node scripts/pulse-plugin-eval.mjs
```

The runner executes three gates in order:
1. **Static plugin health** (manifest/marketplace/skills contracts)
2. **Runtime/dependency health** (`git`, `br`, `bv`, optional command execution)
3. **Scenario/benchmark health** (`pulse-eval-workspace` matrix + latest iteration artifacts)

## Gate 1 — Static plugin health

Covered by default runner checks:
- `.codex-plugin/plugin.json` exists and parses
- `.claude-plugin/plugin.json` exists and parses
- `.agents/plugins/marketplace.json` exists and parses
- `.mcp.json` exists and parses
- manifest/marketplace/plugin versions are in sync
- `skills/*/SKILL.md` contract is intact

## Gate 2 — Runtime/dependency health

Covered by default runner checks:
- `git`, `br`, `bv` are available on PATH
- optional scenario execution command can be run via `--run-cmd`

Example:

```bash
node scripts/pulse-plugin-eval.mjs --run-cmd "node skills/using-pulse/scripts/test_onboard_pulse.mjs"
```

If runtime dependencies are degraded, report which scenario conclusions are dependency-sensitive.

## Gate 3 — Scenario/benchmark health

Covered by default runner checks:
- `pulse-eval-workspace/evals.json` exists and is readable
- review artifact exists at `pulse-eval-workspace/pulse-eval-review.html`
- latest `iteration-*` is detected (or explicit `--iteration`)
- `benchmark.json` and `benchmark.md` are present for the selected iteration
- benchmark summary and discrimination signal are extractable

Useful options:

```bash
# Select iteration explicitly
node scripts/pulse-plugin-eval.mjs --iteration 6

# Require a scenario subset to exist in evals.json
node scripts/pulse-plugin-eval.mjs --eval-ids 7,8,19

# Emit machine-readable output
node scripts/pulse-plugin-eval.mjs --json

# Treat warnings as failures
node scripts/pulse-plugin-eval.mjs --strict
```

## Fix-first triage order

Use this order when reading failures:

1. manifest/metadata integrity
2. runtime/dependency readiness
3. gate-contract failures (Gates 1-4)
4. operator-path drift (docs claim vs actual behavior)
5. scenario-level behavioral misses

## Public reporting requirements

Every published evaluation summary should include:
- tested scenario IDs
- pass/fail counts
- dependency caveats
- discriminating/non-discriminating assessment
- links to benchmark artifacts and scenario source
