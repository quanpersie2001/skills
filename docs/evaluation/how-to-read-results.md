# How to Read Pulse Evaluation Results

Use this guide to interpret outputs from `pulse-eval-workspace/`.

## Artifact map

- Scenario matrix: [`pulse-eval-workspace/evals.json`](../../pulse-eval-workspace/evals.json)
- Iteration summaries: `pulse-eval-workspace/iteration-*/benchmark.md`
- Review UI artifact: `pulse-eval-workspace/pulse-eval-review.html`

## Discriminating vs non-discriminating results

A run is **discriminating** when the skill-enabled run and baseline differ meaningfully in contract compliance.

A run is **non-discriminating** when both sides pass by deterministic fixture reading or prompt leakage. Non-discriminating passes are still useful for realism checks, but weaker for proving skill-specific value.

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
