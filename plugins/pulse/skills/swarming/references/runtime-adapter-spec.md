# Runtime Adapter Spec

Pulse defines a canonical coordination model. Real runtimes may implement it with different tool names.

## Canonical Primitives

These are architecture terms, not mandatory function names:

- `ensure_project`
- `register_agent`
- `send_message`
- `fetch_inbox`
- `fetch_topic`
- `file_reservation_paths`
- `release_file_reservations`

## Behavioral Contract

Any runtime adapter must preserve:

1. coordinator can discover or create project-level coordination state
2. coordinator and workers have stable identities
3. workers can report completion, blockers, and conflicts
4. file reservation or equivalent collision prevention exists
5. the coordinator can safely pause and resume

## Degraded Mode

If a runtime cannot satisfy the contract well enough for swarm execution:

- preflight must recommend `single-worker`
- Pulse skips `pulse:swarming`
- execution happens through standalone `pulse:executing`

Do not fake swarm behavior with unreliable coordination.
