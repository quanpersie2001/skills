# How to Read Pulse Evaluation Results

Use this guide to interpret outputs from `scripts/pulse-plugin-eval.mjs` and `pulse-eval-workspace/`.

It assumes the canonical workflow model in [`../ARCHITECTURE.md`](../ARCHITECTURE.md). This file focuses on evaluator output, not on redefining Pulse workflow semantics.

## Run + output modes

```bash
# Full human-readable run
node scripts/pulse-plugin-eval.mjs run

# Full machine-readable run
node scripts/pulse-plugin-eval.mjs run --json

# Prepare chat benchmark artifacts only
node scripts/pulse-plugin-eval.mjs benchmark --iteration 8 --eval-ids 21,2

# Finalize from filled evidence
node scripts/pulse-plugin-eval.mjs benchmark \
  --iteration 8 \
  --eval-ids 21,2 \
  --evidence pulse-eval-workspace/iteration-8/benchmark-evidence.json \
  --json
```

The runner emits checks grouped by phase:

- `static`
- `runtime`
- `scout`
- `benchmark`
- `scenarios` (finalized benchmark only)

Each check has status `PASS`, `WARN`, or `FAIL`.

## Artifact map

Inputs:

- Benchmark plan: [`.plugin-eval/benchmark.json`](../../.plugin-eval/benchmark.json)
- Scenario library: [`pulse-eval-workspace/evals.json`](../../pulse-eval-workspace/evals.json)

Generated prepare-step outputs:

- `pulse-eval-workspace/iteration-*/benchmark-packet.md`
- `pulse-eval-workspace/iteration-*/benchmark-evidence.json`

Generated finalize-step outputs:

- `pulse-eval-workspace/iteration-*/benchmark.json`
- `pulse-eval-workspace/iteration-*/benchmark.md`
- `pulse-eval-workspace/pulse-eval-review.html`

## Check status semantics

- **PASS**: the contract for that check is satisfied.
- **WARN**: the contract is degraded or incomplete; the run may still be usable, but treat claims carefully.
- **FAIL**: the contract is broken; do not publish benchmark conclusions from that run.

`--strict` upgrades warning-level drift to a failing process exit.

## Reading `benchmark-evidence.json`

This file is the bridge between the live chat run and the compiled benchmark artifacts.

Each scenario entry should contain:

- `response` — the assistant answer captured from the interactive chat
- `judge.passed` — manual pass/fail verdict from that same session
- `judge.summary` — short reason for the verdict
- `judge.satisfied`, `judge.missed`, `judge.warnings` — checklist-level notes

If `response` exists but the `judge` block is incomplete, the final benchmark will mark that scenario as `partial`.

## Reading `benchmark.json`

The main fields are:

- `selected_scenario_ids` — the exact scenario IDs included
- `runner.mode` — should now be `chat`
- `evidence_path` — where the finalized evidence came from
- `scenarios` — normalized scenario results merged with canonical prompts and expectations
- `verifiers` — repo-wide commands run after evidence finalization
- `run_summary` — aggregate completion/pass/fail counts
- `notes` — caveats that should appear in reporting

## Reading `run_summary`

`run_summary` reports:

- `count` — selected scenario count
- `completed` — scenarios with both response and filled judge verdict
- `passed` — completed scenarios whose manual verdict passed
- `failed` — completed scenarios whose manual verdict failed
- `partial` — scenarios with a response but incomplete judging
- `pending` — scenarios with no captured response yet
- `incomplete` — everything not counted as completed
- `pass_rate` — `passed / completed`

## Reading scenario entries

Each scenario entry in `benchmark.json.scenarios[]` carries three layers of signal:

1. **Coverage** — `status` (`completed`, `partial`, `pending`)
2. **Captured evidence** — `response` and `response_snippet`
3. **Judged behavior** — `judge.passed`, `judge.summary`, `judge.missed`, `judge.warnings`

Interpret them like this:

- `status = completed` and `judge.passed = true` → behavioral pass
- `status = completed` and `judge.passed = false` → behavioral miss
- `status = partial` → the chat answer was captured, but the verdict was not fully filled in
- `status = pending` → the scenario has not been run in chat yet

A prepared-only benchmark packet is not a benchmark result yet; only a finalized evidence file produces `benchmark.json` and `benchmark.md`.

## Scout vs benchmark caveats

The scout output is separate from scenario grading.

Use scout warnings to explain context such as:

- stale Pulse onboarding
- degraded `recommended_mode`
- missing GitNexus configuration

Do not collapse those warnings into “the scenario failed” unless the captured response or verdict says the same thing.

## Discrimination note in v2

The evaluator still emits a discrimination note, but chat-run v2 does not collect a normalized baseline automatically.

That means:

- treat the note as a caveat, not as proof of discriminating behavior
- do not claim with-skill vs baseline deltas from this evaluator alone
- use the note to show what the current system can and cannot prove

## Failure classification

Classify failures in this order:

1. local transport/setup issues (missing packet, missing evidence, malformed JSON)
2. dependency/readiness warnings from runtime or scout
3. incomplete evidence capture (`partial` / `pending` scenarios)
4. contract failures in model behavior (`completed` + failed verdict)

If evidence is incomplete, mark the run incomplete rather than behavioral-fail.

## What to publish

Each public benchmark note should include:

- scenario IDs tested
- whether the run was prepared only or finalized
- completed / passed / failed / incomplete counts
- readiness caveats from `runtime` and `scout`
- links to the packet, evidence, and finalized benchmark artifacts
- concrete next-step improvements
