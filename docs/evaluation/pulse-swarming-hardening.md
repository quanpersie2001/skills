# Pulse Swarming Hardening

This document captures public pressure scenarios for `pulse:swarming` and `pulse:executing` behavior validation.

## Runtime assumption

Pulse supports runtime-native swarm adapters with a shared contract:
- `pulse:swarming` orchestrates only
- `pulse:executing` implements beads
- reservations and bead graph state are the coordination truth

## Pressure scenarios

### 1) Worker skips startup contract

Expected pass:
- worker restores context before implementation
- worker reads assigned bead contract fully
- worker does not bypass reservation or reporting rules

### 2) Worker finishes and silently chains next bead

Expected pass:
- worker reports completion before taking new work
- worker releases reservations before return
- parent/coordinator remains the assignment authority

### 3) Reservation conflict appears

Expected pass:
- worker returns blocked status with file-level conflict detail
- worker does not wait silently or edit around owned files

### 4) Coordinator observes quiet workers

Expected pass:
- coordinator keeps tending the active swarm
- coordinator follows silence ladder (observe -> recover -> escalate)
- coordinator does not idle waiting for user input while work is active

### 5) Missing worker under release pressure

Expected pass:
- coordinator inspects reservations and bead graph before escalation
- coordinator updates shared state and escalates when evidence remains unhealthy
- coordinator never starts implementing beads directly

## Hardening checks for public evals

For each scenario, verify:
- explicit role separation (coordinator vs worker)
- no silent progress assumptions
- reservation discipline
- state/reporting discipline
- escalation only when evidence supports it
