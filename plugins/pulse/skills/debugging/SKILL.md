---
name: pulse:debugging
description: Systematic debugging for blocked work, test failures, build errors, runtime crashes, and integration issues in Pulse. Checks bead-local learning_refs first, then uses targeted global learning lookups when needed. Writes debug notes and learning candidates for compounding instead of assuming workers should read the entire global memory.
metadata:
  version: '1.1'
  ecosystem: pulse
---

# Debugging

Resolve blockers and failures systematically.
Do not guess. Triage, reproduce, diagnose, fix, then capture the learning.

## When to Use

- build failure
- test failure
- runtime error
- integration failure
- blocked worker or impossible bead
- UAT failure handed off from reviewing

## Step 1: Triage

Classify the issue before investigating:

| Type | Signals |
|---|---|
| build failure | compilation, typing, missing module, bundler failure |
| test failure | assertion mismatch, snapshot diff, timeout, flaky pass/fail |
| runtime error | crash, uncaught exception, undefined behavior |
| integration failure | HTTP 4xx/5xx, auth mismatch, env issue, schema mismatch |
| blocker | circular dependency, reservation conflict, impossible constraint |

Write a one-line classification:

```text
[TYPE] in [component]: [symptom]
```

## Step 2: Check Relevant Learnings Before Investigating Broadly

Pulse uses scoped memory. Check the smallest relevant memory source first.

### 2a. If debugging a bead, read its `learning_refs`

Open the bead and inspect:

- `learning_refs`
- `decision_refs`

Read only the learning files cited there.

If one of those learnings directly explains the issue, use it before searching broader memory.

### 2b. Targeted global lookup only if needed

If bead-local learning refs do not explain the issue, search `history/learnings/critical-patterns.md` with targeted keywords from the classification.

Do not read the full global file unless the search result demands it.

## Step 3: Reproduce

Run the exact failing command.
Capture exact output.
Confirm whether the issue is deterministic or flaky.

Use the smallest reproduction that still fails.

## Step 4: Diagnose

Work in this order:

1. read the implicated source files
2. inspect recent git changes
3. read the current bead and its expectations
4. re-check `CONTEXT.md` for violated locked decisions
5. inspect coordination messages if the issue may involve another worker

### Specific memory question to answer

After reading the bead and any learnings, decide which of these is true:

- the relevant learning existed and the implementation ignored it
- the relevant learning existed but was never propagated into the bead
- no relevant learning existed yet

That distinction matters for compounding.

Write the root cause as one sentence before fixing.

## Step 5: Fix and Verify

For a small fix:

- implement directly
- rerun the exact failing command
- run broader regression checks as appropriate

For a substantial fix:

- create a fix bead
- implement within that scope
- verify against the bead's criteria

If the failure is actually a locked-decision violation, surface it before silently "fixing" around it.

## Step 5.5: Architecture Suspicion Gate

If the same issue survives two focused fix attempts, or the failure starts hopping across subsystems instead of collapsing to one root cause, stop patching.

At that point:

- write the root cause as an architectural doubt, not another guess
- return the work to `pulse:planning` or `pulse:validating` if the shape of the fix needs to be rethought
- in worker or execution contexts, report the blocker instead of making a fourth patch attempt

This is the point where the problem has stopped being "one more fix" and started being "the plan or boundary is wrong."

## Step 6: Capture the Learning

Always write a debug note when the issue revealed:

- a new failure pattern
- a missing propagation step
- an outdated global pattern

Write the debug note to `.pulse/debug-notes/<bead-id>-debug.md` (create the directory if needed). Use this canonical path so `pulse:compounding` can find all debug notes reliably.

Template:

```markdown
## Debug Note: <date> - <classification>

Root cause: <one sentence>
Trigger: <what causes it>
Fix: <what resolved it>
Propagation recommendation: global-critical | bead-local | planner-only
Why: <why this should propagate that way>
Signal: <how to recognize it next time>
```

### If a known global pattern is outdated

Do not append directly to `critical-patterns.md` here.
Instead, write a debug note that says the existing pattern needs refresh and route it to `pulse:compounding`.

### If the issue should have been in the bead

Say so explicitly in the debug note:

```text
This failure would likely have been prevented if the bead had included learning_refs to <file>.
```

After the fix is verified, submit learning candidates to `pulse:compounding` so the debug note gets triaged and propagated. Do not leave debug notes orphaned in `.pulse/debug-notes/` without a compounding pass.

## Step 7: Handoff

Report:

- classification
- root cause
- fix applied
- verification result
- whether compounding should promote a new or updated learning

## Blocker Protocol

If the issue is a blocker rather than a code defect:

1. check dependencies
2. check reservations or coordination state
3. distinguish waiting from hard-blocked
4. report once, then pause

Do not spin indefinitely.

## Red Flags

- fixing symptoms instead of root cause
- skipping exact reproduction
- not checking bead `learning_refs` before broad memory lookup
- assuming every worker should read `critical-patterns.md`
- patching global learning files directly during ad hoc debugging
- treating a propagation failure as only a code bug
- making a third or fourth fix attempt after the failure keeps crossing subsystem boundaries
