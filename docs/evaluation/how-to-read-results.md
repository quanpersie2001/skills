# How to Read Pulse Evaluation Results

Use this guide to interpret outputs from `scripts/pulse-plugin-eval.mjs` and `pulse-eval-workspace/`.

## Run + output modes

```bash
# Human-readable summary
node scripts/pulse-plugin-eval.mjs

# Machine-readable summary
node scripts/pulse-plugin-eval.mjs --json
```

The runner emits checks grouped by phase:
- `static`
- `runtime`
- `scenarios`

Each check has status `PASS`, `WARN`, or `FAIL`.

## Artifact map

- Scenario matrix: [`pulse-eval-workspace/evals.json`](../../pulse-eval-workspace/evals.json)
- Iteration summaries: `pulse-eval-workspace/iteration-*/benchmark.md`
- Iteration benchmark data: `pulse-eval-workspace/iteration-*/benchmark.json`
- Review UI artifact: `pulse-eval-workspace/pulse-eval-review.html`

## Status semantics

- **PASS**: contract satisfied.
- **WARN**: contract is incomplete or potentially degraded; evaluation can continue unless `--strict` is used.
- **FAIL**: contract broken; fix before publishing benchmark claims.

`--strict` upgrades warning-level drift to failing exit status.

## Discriminating vs non-discriminating results

A run is **discriminating** when the skill-enabled run and baseline differ meaningfully in contract compliance.

A run is **non-discriminating** when both sides pass by deterministic fixture reading or prompt leakage. Non-discriminating passes are still useful for realism checks, but weaker for proving skill-specific value.

The runner surfaces this from benchmark notes via `scenarios/discrimination-signal`.

## Failure classification

Classify failures in this order:
1. infrastructure/transport/account limits
2. dependency readiness
3. fixture/scenario setup errors
4. contract failures in skill behavior

If infrastructure fails, mark the run incomplete rather than behavioral-fail.

## What to publish

Each public benchmark note should include:
- scenario IDs tested
- with-skill vs baseline pass rate
- timing deltas
- dependency caveats
- discriminating/non-discriminating assessment
- concrete next-step improvements
