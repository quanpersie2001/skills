# Golden Path: One Pulse Feature Run

This is the shortest concrete example of what a normal Pulse run is supposed to feel like.

## Example Request

> Add inbound email support for the agent inbox.

## The Flow

1. `pulse:preflight`
   - checks onboarding, tooling readiness, and recommended mode
   - confirms whether the repo can run swarm, single-worker, planning-only, or is blocked

2. `pulse:using-pulse`
   - reads the preflight result
   - runs the scout step
   - chooses `standard_feature` mode

3. `pulse:exploring`
   - asks the missing product questions
   - locks decisions in `history/inbound-email/CONTEXT.md`

4. `pulse:planning`
   - reads `CONTEXT.md`
   - routes mode → shape (`work-shape.md`, `phase-plan.md`, or `epic-map.md`)
   - prepares current work artifacts (`current-story-pack.md` or `phase-<n>-contract.md` + `phase-<n>-story-map.md`) and bead timing

5. `pulse:validating`
   - verifies feasibility/readiness for the selected current work
   - runs spikes for risky items
   - may route back once to planning for current-work bead creation
   - stops until execution is explicitly approved

6. `pulse:swarming` / `pulse:executing`
   - starts only after Gate 3 approval of feasibility-validated current work
   - launches workers (or runs single-worker if preflight recommends it)
   - workers self-route from the live bead graph
   - work is implemented with file reservations and explicit verification

7. `pulse:reviewing`
   - runs specialist review
   - records P1/P2/P3 findings
   - blocks merge if P1 findings exist

8. `pulse:compounding`
   - writes the durable learnings for future work

## Quick Scout

Before resuming or planning deeper work on an onboarded repo:

```bash
node .pulse/scripts/pulse_status.mjs --json
```

Use the scout output to decide which deeper artifacts to open next.

## Core Promise

Pulse is useful when the cost of getting the plan wrong is high. It is intentionally more structured than a normal coding chat so the system can carry decisions, gates, and coordination cleanly from request to shipped work.
