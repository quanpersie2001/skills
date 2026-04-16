---
name: reviewing
description: Post-execution quality verification for the Pulse ecosystem. Invoke after the final phase swarm completes. Runs 5 parallel specialist review agents, 3-level artifact verification, human UAT, and finishing (PR, cleanup, epic close). Review issues become beads instead of per-finding markdown files; P1 still blocks merge while P2/P3 become non-blocking follow-up beads. Absorbs finishing responsibilities and hands off to compounding.
metadata:
  version: '1.2'
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

Post-execution quality verification. You are the last automated gate before a feature ships. Your job is to catch what escaped execution — not just confirm tasks are closed, but verify that the work is correct, safe, and complete.

## Communication Standard

Reviewing is where terse technical shorthand is most dangerous. The default tone here is:

- explain the bug in plain language first
- then show the evidence
- then give one concrete failure scenario
- then give the smallest credible fix direction

If a finding makes sense only to someone who already read the diff carefully, it is not written well enough yet.

## When to Invoke

- After `pulse:swarming` reports the final phase is complete
- Manually: when spot-checking any branch or set of changes
- Flags: `--serial` (always serial), `--skip-uat` (auto mode only, skips Phase 3)

## Prerequisites

Read before starting:

- `history/<feature>/CONTEXT.md` — locked decisions (D1, D2...) and testable deliverables
- `history/<feature>/approach.md` — planned approach and risk map from planning
- `.pulse/STATE.md` — current epic state
- the git diff or worktree diff

## Phase 1: Specialist Review

Pulse uses five review roles. Agents 1-4 are specialist reviewers. Agent 5 is the learnings synthesizer and always runs last.

### Design Note: 4+1 Architecture

Pulse separates the learnings synthesizer (agent 5) from specialist review (agents 1-4) because the synthesizer needs to see all 4 specialist outputs to identify cross-cutting patterns. Running a combined 5th specialist in parallel would duplicate observations already covered by the other 4. Agent 5 runs after the specialists complete, not truly in parallel with them.

### Dispatch Rules

| Condition | Mode |
|-----------|------|
| ≤4 agents active | **Parallel** (default) |
| 5+ agents active | **Serial** (auto-switch — inform user) |
| `--serial` flag | Always serial |

With 5 agents, auto-switch to serial mode and tell the user: "Running review agents in serial mode (5 agents). Use --parallel to override."

### Agent Roster

Dispatch agents 1-4 first (parallel or serial per rules above). Agent 5 always runs last regardless of mode.

| Agent | Focus |
|-------|-------|
| 1 `code-quality` | Simplicity, readability, DRY, error handling, type safety |
| 2 `architecture` | Design patterns, coupling, separation of concerns, API design |
| 3 `security` | OWASP top 10, injection, auth, secrets, data exposure |
| 4 `test-coverage` | Missing tests, edge cases, integration gaps |
| 5 `learnings-synthesizer` | Always last — cross-reference `.pulse/memory/`, flag known patterns, suggest compounding entries, and mark repeated failures that may deserve correction or ratchet promotion |

### Isolated Context Per Agent — Critical

Each agent receives only:

1. The git diff (or worktree diff): `git diff <base>..<head>`
2. `history/<feature>/CONTEXT.md`
3. `history/<feature>/approach.md`

Do not pass session history, implementation notes, or agent communication logs. Reviewer objectivity depends on seeing only the work product, not the implementer's thought process.

See `references/review-agent-prompts.md` for the exact prompt for each agent.

### Review Bead Rules

Each distinct review issue becomes a bead. The full review write-up lives in the bead body itself: plain-language summary, current behavior, why it matters, concrete failure scenario, evidence, proposed solutions, and acceptance criteria.

Use the bead contract from `references/review-bead-template.md`.

Creation rules:

- **P1** -> create a blocking fix bead on the current review / epic-close path
- **P2** -> create a non-blocking follow-up bead
- **P3** -> create a non-blocking follow-up bead

Linkage rules:

- `P1` review beads may stay in the current epic-close path because they are blocking work
- `P2` / `P3` review beads must not be children of the current epic
- `P2` / `P3` traceability must use `external_ref=<source-epic-id>` plus labels such as `review`, `review-p2` / `review-p3`, and the source reviewer label

Title pattern:

```
Resolve Review P1: <problem title>
Resolve Review P2: <problem title>
Resolve Review P3: <problem title>
```

### Severity Rules

| Priority | Label | Criteria | Gate |
|----------|-------|----------|------|
| **P1** | CRITICAL | Security vulns, data corruption, breaking changes | Blocks merge — always |
| **P2** | IMPORTANT | Performance, architecture, reliability | Should fix before merge |
| **P3** | NICE-TO-HAVE | Minor improvements, cleanup, docs | Record for future |

Calibration rule: Not everything is P1. Severity inflation wastes cycles and trains reviewers to ignore findings. When in doubt, P2.

### Synthesis (After All Agents Complete)

1. Collect the review beads created by agents 1-4
2. Deduplicate overlapping issues — prefer one surviving review bead per distinct problem; close redundant duplicates with a reason such as `Duplicate of <bead-id>`
3. Surface `learnings-synthesizer` matches with known-pattern notes on the relevant review bead
4. When a failure repeats a prior mistake, mark whether it looks like:
   - a correction candidate (sharp tactical rule)
   - a ratchet candidate (must-check / non-regression guardrail)
   - or only a bead-local learning
5. Count: N P1, N P2, N P3 review beads
6. Present a summary table to user with bead IDs by severity

When presenting serious findings to the user, do not stop at terse reviewer shorthand. Translate the finding into:

- what the code does today
- why that breaks the intended behavior
- one concrete scenario showing the failure
- the smallest credible fix direction

If P1 review beads exist: HARD-GATE — stop and present. Do not proceed to Phase 2 until user acknowledges. Even in go mode, P1 is always human-gated. Acknowledge means the user has seen the P1 list and directed a fix path. It does not mean permission to merge with P1s open. All P1 review beads must be closed before Phase 4 finishing begins.

## Phase 2: Artifact Verification

Goal-backward check on every artifact named in `CONTEXT.md` and `approach.md`. Task completion does not equal goal achievement — a file existing is not evidence the feature works.

Run this as a subagent with isolated context (diff + CONTEXT.md + approach.md). Use the live bead graph and bead files when you need to verify acceptance criteria coverage.

### The 3 Levels

**Level 1 — EXISTS:** Does the file/component/route exist?

```bash
ls src/components/PaymentForm.tsx
```

**Level 2 — SUBSTANTIVE:** Is it real, not a stub?

Scan for anti-patterns:

```
return null / return {} / return []
Empty handlers: onClick={() => {}}
TODO / FIXME / PLACEHOLDER comments
console.log-only implementations
API routes returning static data without DB queries
Components with state that never renders state
```

**Level 3 — WIRED:** Is it imported and used in the integration layer?

```bash
grep -r "PaymentForm" src/pages/ src/app/
```

### Reporting

For each artifact:

- L1+L2+L3: fully wired
- L1+L2 only: created but not integrated — create a `P2` review bead
- L1 only (stub): exists but empty — create a `P1` review bead
- Missing: not found — create a `P1` review bead

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

Treat `.pulse/runs/<feature>/verification/` as the active evidence surface during execution and review. Only the final, durable subset should be promoted into `history/<feature>/verification/` during finishing or closeout.

## Review Intake

When review beads already exist, resolve them deliberately before finishing:

1. Read every review bead in full before changing code.
2. Separate clear blockers from unclear feedback; do not guess at ambiguous items.
3. Verify each review bead against the codebase and the current diff before accepting it as real.
4. Fix one review item at a time when practical, then re-run the relevant verification.
5. Re-check the original finding after each fix to confirm the issue is actually gone.
6. Do not batch opaque review feedback into a blind patch set.

## Phase 3: Human UAT

Walk the user through every testable deliverable from `CONTEXT.md`.

Protocol:

1. Extract all decisions with SEE (visual), CALL (API), or RUN (execution) verification from CONTEXT.md
2. For each deliverable, present: "Does [X] work as decided in [D-id]?"
3. Reference the exact decision ID so the user can verify against their original intent
4. One item at a time — HARD-GATE between each

Example prompt:

```
UAT Item 3 of 5 — Decision D4:
"Users can reset their password via email link (D4)."
Can you navigate to /forgot-password, enter an email, and confirm the reset email arrives?
[Pass / Fail / Skip]
```

On failure:

1. Invoke `pulse:debugging` — root-cause the failure
2. Create a fix bead: `br create "Fix: <description>" -t task -p 0 --parent <epic-id>`
3. Execute the fix bead (invoke `pulse:executing`)
4. Re-verify the specific UAT item
5. Do not proceed until the item passes or user explicitly accepts the failure

On skip: Record in `.pulse/STATE.md` with reason. Do not count as pass.

## Phase 4: Finishing

You are the last step before compounding. Close the loop completely.

### Checklist

```
[ ] All beads in epic are closed
    -> bv --robot-triage --graph-root <epic-id>
    -> Any open beads? Create final fix tasks or explicitly defer with br update --defer

[ ] Final build/test/lint passes
    -> Run project's standard commands (npm test / pytest / cargo test / etc.)
    -> If fails: create a P1 review bead, fix before continuing

[ ] Present merge options to user:
    1. Create PR (recommended)
    2. Merge directly
    3. Keep branch for further work
    4. Discard branch

[ ] Promote durable verification evidence
    -> keep active execution/review evidence under `.pulse/runs/<feature>/verification/` while the feature is still live
    -> copy or move only the final subset worth keeping into `history/<feature>/verification/`

[ ] Clean up worktree (if used)
    -> git worktree remove .worktrees/<feature>

[ ] Close epic bead
    -> br close <epic-id> --reason "Feature complete: <summary>"

[ ] Clear working state
    -> Archive STATE.md: cp .pulse/STATE.md history/<feature>/STATE-final.md
    -> Update state.json and STATE.md to reflect completion
```

### Merge Options Detail

Create PR:

```bash
gh pr create \
  --title "<feature title>" \
  --body "## Summary\n<description>\n\n## Verified\n- [ ] All UAT items passed\n- [ ] No P1 review beads remain open\n- P2 follow-up beads: <list or 'none'>\n- P3 follow-up beads: <list or 'none'>"
```

If P2 review beads exist: Include them in the PR body. Recommend fixing before merge, but user decides.
If P3 review beads exist: Add them to the PR body under "Future Work." Do not block merge.

## Quick Mode

Quick mode still uses review. It only narrows scope:

- agents 1-4 may run against a smaller diff window
- UAT may be minimal if the change is non-interactive
- artifact verification still runs

## Handoff

After Phase 4 completes:

> "Feature complete. Epic [id] closed. [N] learnings flagged by learnings-synthesizer.
> Invoke `pulse:compounding` skill to capture patterns, decisions, and failures for future planning cycles."

Update `.pulse/state.json` and `.pulse/STATE.md`:

```
STATUS: reviewing-complete
EPIC: <id>
HANDOFF: compounding
FLAGGED_LEARNINGS: <count>
```

## Red Flags

- review skipped because the change looks small
- agent 5 runs before agents 1-4 finish
- specialist reviewers are asked to inspect artifacts they were not given
- P1 findings exist but merge continues
- P1 review beads created but gate not stopped
- artifact verification skipped
- UAT failures marked as pass
- epic closed with open beads
- P2/P3 review beads attached as children of the current epic instead of using external_ref + labels

## References

- `references/review-agent-prompts.md` — exact prompts for all 5 agents
- `references/review-bead-template.md` — review bead format and creation contract
