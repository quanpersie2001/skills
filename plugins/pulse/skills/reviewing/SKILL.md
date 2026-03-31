---
name: pulse:reviewing
description: Post-execution quality verification for the Pulse ecosystem. Invoke after the final phase swarm completes. Runs 5 parallel specialist review agents, 3-level artifact verification, human UAT, and finishing (PR, cleanup, epic close). Review issues become beads instead of per-finding markdown files; P1 still blocks merge while P2/P3 become non-blocking follow-up beads. Absorbs finishing responsibilities and hands off to compounding.
metadata:
  version: '1.1'
  ecosystem: pulse
---

# Reviewing

Reviewing is the final automated gate before merge.

## Communication Standard

Reviewing is where terse technical shorthand is most dangerous. The default tone here is:

- explain the bug in plain language first
- then show the evidence
- then give one concrete failure scenario
- then give the smallest credible fix direction

If a finding makes sense only to someone who already read the diff carefully, it is not written well enough yet.

## Inputs

Read:

- `history/<feature>/CONTEXT.md`
- `history/<feature>/approach.md`
- `.pulse/STATE.md`
- the git diff or worktree diff

## Phase 1: Specialist Review

Pulse uses five review roles:

- agents 1-4 are specialist reviewers
- agent 5 is the learnings synthesizer and always runs last

### Design Note: 4+1 Architecture

Pulse separates the learnings synthesizer (agent 5) from specialist review (agents 1-4) because the synthesizer needs to see all 4 specialist outputs to identify cross-cutting patterns. Running a combined 5th specialist in parallel would duplicate observations already covered by the other 4. Agent 5 runs after the specialists complete, not truly in parallel with them.

### Dispatch semantics

- default: agents 1-4 in parallel, then agent 5
- `--serial`: run agents 1-4 serially, then agent 5
- if the runtime cannot parallelize safely, fall back to serial and say so explicitly

There is no hidden auto-switch threshold.

### Shared review input

Agents 1-4 receive only:

1. diff
2. `CONTEXT.md`
3. `approach.md`

They do not receive bead files, live graph state, or session history.

Use `references/review-agent-prompts.md`.

### Review bead rules

Each distinct issue becomes a review bead. The full review write-up lives in the bead body itself: plain-language summary, current behavior, why it matters, concrete failure scenario, evidence, proposed solutions, and acceptance criteria.

- `P1` -> blocking bead on the current merge path
- `P2` -> non-blocking follow-up bead
- `P3` -> non-blocking follow-up bead

`P1` blocks merge. Always.

## Phase 2: Artifact Verification

Artifact verification is separate from the specialist reviewers.

This phase may use:

- diff
- `CONTEXT.md`
- `approach.md`
- bead files
- live bead graph

Goal:

1. check that required artifacts exist
2. check that they are substantive
3. check that they are wired into the system
4. check that verification evidence is present, readable, and tied to the accepted behavior
5. check that verification evidence lives in the standard artifact path when the feature uses it

If an artifact is missing or clearly stubbed, create a `P1` review bead.
If verification evidence is missing, vague, or only asserted in prose, create a `P1` review bead.
If the expected verification artifact path is absent, create a `P1` review bead.
If it exists and is substantive but not integrated into the current review / merge path, create a `P2` review bead.

### Findings Template

Use this structure for each finding in a review bead:

```markdown
## Finding: [title]
- **Severity**: P1 | P2 | P3
- **Location**: [file:line or module]
- **Description**: [what's wrong]
- **Recommendation**: [suggested fix]
```

### UAT Evidence for Non-Interactive Changes

For changes that cannot be manually walked through (APIs, config, infrastructure, CLI tools), UAT evidence should include:

- Verification command output (e.g., `curl` response, CLI invocation result)
- Before/after config diff or API response comparison
- Log output showing the change is active
- Automated test results covering the modified behavior

## Review Intake

When review beads already exist, resolve them deliberately before finishing:

1. Read every review bead in full before changing code.
2. Separate clear blockers from unclear feedback; do not guess at ambiguous items.
3. Verify each review bead against the codebase and the current diff before accepting it as real.
4. Fix one review item at a time when practical, then re-run the relevant verification.
5. Re-check the original finding after each fix to confirm the issue is actually gone.
6. Do not batch opaque review feedback into a blind patch set.

## Phase 3: Human UAT

Walk through every testable deliverable from `CONTEXT.md`.

If a UAT item fails:

1. invoke `pulse:debugging`
2. create a fix bead
3. execute the fix
4. re-check the failed item

Do not mark a skipped item as passed.

## Phase 4: Finishing

Before handoff to compounding:

1. ensure blocking review beads are resolved
2. run final build, test, and lint commands
3. present merge options to the user
4. close the epic only when the current path is actually complete
5. archive state as needed

When presenting serious findings to the user, do not stop at terse reviewer shorthand. Translate the finding into:

- what the code does today
- why that breaks the intended behavior
- one concrete scenario showing the failure
- the smallest credible fix direction

## Quick Mode

Quick mode still uses review. It only narrows scope:

- agents 1-4 may run against a smaller diff window
- UAT may be minimal if the change is non-interactive
- artifact verification still runs

## Red Flags

- review skipped because the change looks small
- agent 5 runs before agents 1-4 finish
- specialist reviewers are asked to inspect artifacts they were not given
- `P1` findings exist but merge continues
- artifact verification is skipped

## References

- `references/review-agent-prompts.md`
- `references/review-bead-template.md`
