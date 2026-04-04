# Golden Path: One Pulse Feature Run

This is the shortest concrete example of what a normal Pulse run is supposed to feel like.

## Example Request

> Add inbound email support for the agent inbox.

## The Flow

1. `pulse:using-pulse`
   - confirms onboarding
   - runs the scout step
   - chooses `standard_feature` mode

2. `pulse:exploring`
   - asks the missing product questions
   - locks decisions in `history/inbound-email/CONTEXT.md`

3. `pulse:planning`
   - reads `CONTEXT.md`
   - writes `discovery.md`, `approach.md`, `phase-plan.md`
   - prepares the current phase with `phase-1-contract.md`, `phase-1-story-map.md`, and phase-1 beads

4. `pulse:validating`
   - verifies the current phase
   - runs spikes for risky items
   - stops until execution is explicitly approved

5. `pulse:swarming` / `pulse:executing`
   - launches workers (or runs single-worker if preflight recommends it)
   - workers self-route from the live bead graph
   - work is implemented with file reservations and explicit verification

6. `pulse:reviewing`
   - runs specialist review
   - records P1/P2/P3 findings
   - blocks merge if P1 findings exist

7. `pulse:compounding`
   - writes the durable learnings for future work

## Quick Scout

Before resuming or planning deeper work on an onboarded repo:

```bash
node .codex/pulse_status.mjs --json
```

Use the scout output to decide which deeper artifacts to open next.

## Core Promise

Pulse is useful when the cost of getting the plan wrong is high. It is intentionally more structured than a normal coding chat so the system can carry decisions, gates, and coordination cleanly from request to shipped work.
