---
name: pulse:validating
description: The critical gate between planning and execution in the Pulse ecosystem. Load this skill after planning completes and before execution begins. Verifies plan soundness across 8 structural dimensions, materializes and executes time-boxed spikes for HIGH-risk items, polishes beads, and requires explicit approval before any code is written.
metadata:
  version: '1.1'
  ecosystem: pulse
---

# Validating

Validating is the last planning-space gate before code starts.

It owns:

- structural plan verification
- spike bead creation and spike execution
- bead graph polish
- final approval for execution

## Prerequisites

Read before starting:

- `history/<feature>/CONTEXT.md`
- `history/<feature>/discovery.md`
- `history/<feature>/approach.md`
- canonical bead files for this feature

If the bead files do not follow the canonical contract from `pulse:planning/references/bead-template.md`, fix that first.

## Phase 0: Schema Gate

Before running the plan-checker, validate the bead schema itself.

Every bead must have:

- `dependencies`
- `files`
- `verify`
- `verification_evidence`
- `testing_mode`
- `decision_refs`
- `learning_refs`

What to do:

1. scan every bead file for the required fields
2. if a field is missing, fail fast
3. normalize the bead immediately or return it to planning for repair

If `testing_mode` is `tdd-required`, the bead must also include `tdd_steps` with distinct red and green commands.

Do not let the plan-checker guess from prose when the schema is missing.

## Phase 1: Plan Verification

Run the plan-checker loop. Maximum 3 iterations.

### Step 1.1: Run plan-checker

Load `references/plan-checker-prompt.md`.

Inputs:

- all beads for the feature
- `CONTEXT.md`
- `discovery.md`
- `approach.md`

The plan-checker verifies 8 dimensions:

| # | Dimension | Core question |
|---|---|---|
| 1 | Requirement coverage | Does every locked decision map to one or more beads? |
| 2 | Dependency correctness | Are dependencies valid, explicit, and acyclic? |
| 3 | File scope isolation | Can concurrently ready beads avoid file collisions? |
| 4 | Context budget | Is each bead completable in one agent context window? |
| 5 | Verification quality | Does every bead have concrete `verify` steps and a usable evidence contract? |
| 6 | Gap detection | Would finishing all beads still leave feature gaps? |
| 7 | Risk alignment | Does every HIGH-risk item define a concrete `spike_question`? |
| 8 | Completeness | Would all beads together deliver the feature end-to-end? |

### Step 1.2: Triage

If all 8 dimensions pass, continue to Phase 2.

If any dimension fails:

1. fix the identified beads or approach sections
2. rerun the checker
3. stop after 3 rounds and escalate if structural failures remain

Do not game the checker with cosmetic wording.

## Phase 2: Spike Materialization and Execution

If `approach.md` has no HIGH-risk items, skip to Phase 3.

### Step 2.1: Materialize spike beads

For every HIGH-risk row in the risk map:

1. read the `component`
2. read the `spike_question`
3. read the `affected_beads`
4. create one spike bead that answers exactly that question

Example:

```bash
br create "Spike: Does JWT cookie auth work for WebSockets on this stack?" -t task -p 0
```

Immediately normalize the spike bead to the canonical schema:

- `type: spike`
- `spike_question`
- output file under `.spikes/<feature>/<spike-id>/FINDINGS.md`
- explicit `verify` entry that requires a definitive `YES` or `NO`
- `verification_evidence` pointing at `.spikes/<feature>/<spike-id>/FINDINGS.md`
- `testing_mode: standard`

### Step 2.2: Execute spikes in isolation

For each spike:

1. run it in isolated context
2. time-box it to 30 minutes
3. write `.spikes/<feature>/<spike-id>/FINDINGS.md`
4. close it with either:
   - `YES: <validated approach and constraints>`
   - `NO: <blocker and why it invalidates the approach>`

There is no "partial" result.

### Step 2.3: Apply spike results

If the spike returns `YES`:

- add the finding summary to the affected beads
- treat the validated constraint as locked for execution

If the spike returns `NO`:

- stop immediately
- update `approach.md` with the blocker summary
- return to `pulse:planning`
- rerun validating after the plan changes

## Phase 3: Bead Polishing

Run structured polish on the graph:

### Round 1: Dependency completeness

```bash
bv --robot-suggest
```

Apply real dependency fixes only.

### Round 2: Graph health

```bash
bv --robot-insights
```

Resolve cycles, bottlenecks, disconnected work, and orphaned beads.

### Round 3: Priority sanity

```bash
bv --robot-priority
```

Ensure priorities match the blocking structure.

### Fresh-eyes bead review

Load `references/bead-reviewer-prompt.md` and run a lightweight pre-close sanity-check on each ready bead. If the set is large, do it cluster-by-cluster with the same standard.

Use it to catch:

- missing verification evidence
- `testing_mode: tdd-required` without `tdd_steps`
- beads that still require outside context to understand

Fix all critical ambiguity before approval.

## Phase 4: Approval Gate

Before execution, present:

- bead count
- number of plan-checker iterations
- HIGH-risk items and spike outcomes
- number of `tdd-required` beads
- graph and polish changes made
- unresolved concerns, if any
- execution mode from preflight: `swarm` or `single-worker`

Hard gate:

```text
Validation complete. Approve execution?
```

Do not enter execution without an explicit user approval.

## Context Budget

If context exceeds 65%, write a validating-owned handoff using the shared envelope and register it in `.pulse/handoffs/manifest.json`.

## Handoff

If approved:

- `recommended_mode=swarm` -> invoke `pulse:swarming`
- `recommended_mode=single-worker` -> invoke `pulse:executing`

## Red Flags

- running plan-checker on beads that failed the schema gate
- Phase 1 expects spike beads to pre-exist
- HIGH-risk items have no concrete `spike_question`
- a spike answer is not definitive
- spike findings are not fed back into the affected beads
- execution starts without explicit approval
