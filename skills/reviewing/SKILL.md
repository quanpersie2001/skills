---
name: reviewing
description: Use after execution completes when the user needs final quality verification and release-readiness review before closeout.
metadata:
  version: '1.3'
  ecosystem: pulse
  upstream: swarming
  downstream: compounding
  dependencies:
    - id: beads-cli
      kind: command
      command: br
      missing_effect: unavailable
      reason: Reviewing creates review beads and closes the epic through br.
    - id: beads-viewer
      kind: command
      command: bv
      missing_effect: degraded
      reason: Reviewing verifies the live bead graph before epic closeout.
---

# Reviewing

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

Reviewing is the last automated quality gate before shipping. It verifies behavior, safety, and completeness rather than trusting bead closure alone.

## When to Invoke

- After `pulse:swarming` reports the final phase is complete
- Manually when auditing a branch or diff
- Optional flags: `--serial`, `--skip-uat` (only when human UAT is intentionally omitted and non-interactive evidence is used)

## Required Inputs

Read before starting:

- `.pulse/project-docs.json` when present, plus minimal relevant listed docs
- `history/<feature>/CONTEXT.md`
- `history/<feature>/approach.md`
- `history/<feature>/lifecycle-summary.md` when present
- `.pulse/STATE.md`
- git diff or worktree diff

If `.pulse/project-docs.json` is absent, detect and read the smallest relevant project docs (README, architecture, ADR, domain docs).

## Runtime Contract

All execution-time rules live in `references/runtime-appendix.md`. Treat that file as canonical for:

- 4+1 review orchestration
- severity mapping and review bead creation rules
- Gate 4 hard-block behavior for P1
- artifact verification contract and severity mapping
- UAT failure routing
- finishing checklist and closeout

## Minimum Flow

1. Run specialist review (4+1 model).
2. Create review beads by severity and deduplicate overlaps.
3. Enforce hard gate: if any P1 exists, stop and present; do not continue closeout.
4. Run artifact verification for all promised deliverables.
5. Run human UAT unless explicitly skipped under allowed mode.
6. Execute finishing and update Pulse state artifacts.
7. Hand off to `pulse:compounding`.

## Handoff

If paused, write a reviewing-owned handoff using `../using-pulse/references/handoff-contract.md` and register it in `.pulse/handoffs/manifest.json`.

After finishing completes, report feature completion and explicitly trigger compounding.

## References

- `references/runtime-appendix.md` — canonical runtime contract
- `references/review-agent-prompts.md` — exact prompts for all 5 agents
- `references/review-bead-template.md` — review bead format and creation contract
