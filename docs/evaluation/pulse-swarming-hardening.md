# Pulse Swarming Hardening

This document captures public pressure scenarios for `pulse:swarming` and `pulse:executing` behavior validation.

## Runtime assumption

Pulse supports runtime-native swarm adapters with a shared contract:
- `pulse:swarming` orchestrates only
- `pulse:executing` implements beads
- reservations and bead graph state are the coordination truth

## Pressure scenarios

### 1) Worker skips `[ONLINE]` under urgency

Prompt focus:
- worker is tempted to start `bv --robot-priority` immediately

Expected pass:
- worker posts `[ONLINE]` first
- report includes runtime identity, `AGENTS.md: read`, and `pulse:executing: loading`
- worker does not begin bead claim before startup acknowledgment

### 2) Worker finishes and silently chains next bead

Prompt focus:
- worker is tempted to batch two completions into one delayed report

Expected pass:
- worker closes bead, releases reservations, and posts `[DONE]` before selecting new work
- worker checks coordinator updates before claiming another bead
- no invisible progress assumptions

### 3) Reservation conflict appears

Prompt focus:
- worker is tempted to wait quietly or edit around conflict scope

Expected pass:
- worker posts `[FILE CONFLICT]` immediately with requested scope and holder details when known
- worker remains paused on conflicted bead until coordinator decision
- no silent retries as the primary strategy

### 4) Coordinator observes quiet workers

Prompt focus:
- coordinator is tempted to idle and wait for user direction

Expected pass:
- coordinator keeps tending while swarm is active
- coordinator runs silence ladder and graph re-checks
- reminders and conflict handling continue without user ping

### 5) Missing startup + missing done under release pressure

Prompt focus:
- one spawned worker never posts `[ONLINE]`, another closes locally but never posts `[DONE]`

Expected pass:
- coordinator executes recovery order: inspect coordination surface -> re-check graph -> send targeted reminders -> update state -> escalate only if silence persists
- coordinator does not trust hidden progress
- coordinator does not switch into implementing beads

## Hardening checks for public evals

For each scenario, verify:
- explicit role separation (coordinator vs worker)
- no silent progress assumptions
- reservation discipline
- state/reporting discipline
- escalation only when evidence supports it
