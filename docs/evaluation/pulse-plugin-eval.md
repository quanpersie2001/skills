# Pulse Plugin Evaluation

This runbook defines the public evaluation contract for Pulse as an installable skill plugin.

## Gate 1 — Static plugin health

Validate packaged metadata and structure first.

Recommended checks:
- plugin manifests parse cleanly
- marketplace metadata is in sync with manifest versions
- skill directories are discoverable from `plugins/pulse/skills/`

A static pass is structural evidence only. It does not prove workflow routing or gate discipline.

## Gate 2 — Runtime/dependency health

Check operator-path readiness before behavioral claims.

Required checks:
- `git`, `br`, and `bv` are available
- Pulse onboarding/scout surfaces are reachable for the target repo
- runtime mode is explicit (`swarm`, `single-worker`, `planning-only`, or `blocked`)
- degraded dependencies are reported, not hidden

If a dependency is degraded, report which scenarios become dependency-sensitive.

## Gate 3 — Behavioral pilot

Run focused scenarios from [`pulse-eval-workspace/evals.json`](../../pulse-eval-workspace/evals.json).

Minimum public pilot slice:
- one routing skill (`using-pulse`, `exploring`, or `planning`)
- one execution gate skill (`validating`)
- one coordination skill (`swarming` or `executing`)

Score each run against:
- expected output contract
- expectations checklist
- must-not behaviors

Iterative benchmark snapshots should be published from `pulse-eval-workspace/iteration-*/benchmark.md`.

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
- whether results are discriminating or non-discriminating
- links to benchmark artifacts and scenario source
