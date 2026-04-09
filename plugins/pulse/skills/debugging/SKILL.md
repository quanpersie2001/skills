---
name: debugging
description: Systematic debugging for blocked work, test failures, build errors, runtime crashes, and integration issues in Pulse. Checks bead-local learning_refs first, then uses targeted global learning lookups when needed. Writes debug notes and learning candidates for compounding instead of assuming workers should read the entire global memory.
metadata:
  version: '1.2'
  ecosystem: pulse
  dependencies:
    - id: beads-cli
      kind: command
      command: br
      missing_effect: degraded
      reason: Debugging checks bead context and creates fix beads with br when needed.
    - id: beads-viewer
      kind: command
      command: bv
      missing_effect: degraded
      reason: Debugging inspects blocker and cycle state with bv during triage.
    - id: agent-mail
      kind: mcp_server
      server_names: [mcp_agent_mail]
      config_sources: [repo_codex_config, global_codex_config]
      missing_effect: degraded
      reason: Debugging checks epic mail threads and reports blockers through Agent Mail.
---

# Debugging

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

Resolve blockers and failures systematically.
Do not guess. Triage, reproduce, diagnose, fix, then capture the learning.

## When to Use

- A build fails (compilation, type error, missing dependency)
- A test fails (assertion mismatch, flaky test, timeout)
- A runtime crash or exception occurs
- An integration breaks (API mismatch, env config, auth)
- A worker is stuck (circular dependency, conflicting changes, unresolvable blocker)
- Reviewing or executing hands off with a failure that needs root cause analysis

---

## Step 1: Triage — Classify the Issue

Classify before investigating. Misclassifying wastes time.

| Type | Signals |
|---|---|
| **Build failure** | Compilation error, type error, missing module, bundler failure |
| **Test failure** | Assertion mismatch, snapshot diff, timeout, flaky intermittent pass |
| **Runtime error** | Crash, uncaught exception, segfault, undefined behavior |
| **Integration failure** | HTTP 4xx/5xx, env variable missing, API schema mismatch, auth error |
| **Blocker** | Stuck agent, circular bead dependency, conflicting file reservations |

**Output of triage:** A one-line classification:

```text
[TYPE] in [component]: [symptom]
```

Example: `Build failure in packages/sdk: TS2345 type mismatch in auth.ts`

---

## Step 2: Check Relevant Learnings Before Investigating Broadly

Pulse uses scoped memory. Check the smallest relevant memory source first.

### 2a. If debugging a bead, read its `learning_refs`

Open the bead and inspect:

- `learning_refs`
- `decision_refs`

Read only the learning files cited there.

If one of those learnings directly explains the issue, use it before searching broader memory.

### 2b. Targeted global lookup only if needed

If bead-local learning refs do not explain the issue, search `history/learnings/critical-patterns.md` with targeted keywords from the classification:

```bash
grep -i "<keyword from classification>" history/learnings/critical-patterns.md 2>/dev/null
```

If a known pattern matches, jump directly to Step 4 (Fix) using the documented resolution.

Do not read the full global file unless the search result demands it.

---

## Step 3: Reproduce — Isolate the Failure

1. Run the exact command that failed — do not paraphrase it:
   ```bash
   # Whatever CI/worker ran — run it verbatim
   npm run build 2>&1 | tee /tmp/debug-output.txt
   # or: pytest tests/specific_test.py -v 2>&1 | tee /tmp/debug-output.txt
   ```

2. Capture error output verbatim. Do not summarize. The exact line numbers and messages matter.

3. Identify the minimal reproduction case:
   - Can you trigger the failure with one file change? One command?
   - Does it fail in isolation or only in combination with other changes?
   - Is it environment-specific (CI only, one machine only)?

4. Confirm reproducibility:
   - Run twice. If intermittent, classify as **flaky test**, not a deterministic failure.
   - Flaky tests require a different approach: check for shared state, race conditions, or test ordering.

---

## Step 4: Diagnose — Root Cause Analysis

Work through these checks in order. Stop when you find the cause.

### 4a. Read the relevant source files

```bash
# Find the file mentioned in the error
grep -rn "<error symbol or function>" src/ --include="*.ts" -l
# Then read the file
```

Do not read the entire codebase. Read exactly the files implicated by the error output.

### 4b. Check git blame for recent changes

```bash
git log --oneline -20          # What changed recently?
git blame <file> -L <line>,<line>  # Who changed the failing line?
git diff HEAD~3 -- <file>      # What did it look like before?
```

If a recent commit introduced the failure, the fix is likely reverting or adjusting that change.

### 4c. Check bead context

```bash
br show <bead-id>   # What was this bead supposed to do?
```

Verify: does the failure indicate the bead was implemented against the wrong spec, or that it was implemented correctly but the spec was wrong?

### 4d. Check CONTEXT.md for decision violations

```bash
cat history/<feature>/CONTEXT.md
```

Ask: was a locked decision (D1, D2...) violated by the implementation? Decision violations are a frequent root cause — the code does something "reasonable" that was explicitly excluded.

### 4e. Check Agent Mail for related blockers

```
fetch_topic(project_key="<project-root-path>", topic_name="<EPIC_TOPIC>")
fetch_inbox(project_key="<project-root-path>", agent_name="<agent-name>", topic="<EPIC_TOPIC>")
```

Another worker may have already reported the same issue or a related conflict. Avoid duplicate debugging.

### 4f. Specific memory question to answer

After reading the bead and any learnings, decide which of these is true:

- the relevant learning existed and the implementation ignored it
- the relevant learning existed but was never propagated into the bead
- no relevant learning existed yet

That distinction matters for compounding.

### 4g. Narrow to root cause

After checks 4a–4f, write a one-sentence root cause:

> Root cause: `<file>:<line>` — `<what is wrong and why>`

If you cannot write this sentence, you do not have the root cause yet. Do not proceed to Fix.

---

## Step 5: Fix — Apply and Verify

### Fix size determines approach

**Small fix** (1–3 files, obvious change, low risk):
- Implement directly
- Commit: `fix(<bead-id>): <what was wrong and what was changed>`
- Run verification immediately:
  ```bash
  npm run build && npm test   # or language equivalent
  ```

**Substantial fix** (cross-cutting change, logic redesign, multiple files):
- Create a fix bead before implementing:
  ```bash
  br create "Fix: <root cause summary>" -t task --blocks <original-bead-id>
  ```
- Implement in the fix bead's scope
- Run verification: the fix bead's acceptance criteria must pass

**Decision violation** (CONTEXT.md decision ignored):
- Do not silently fix — the decision may need to be revisited
- Report via Agent Mail before implementing:
  ```
  send_message(
    project_key: "<project-root-path>",
    sender_name: "<agent-name>",
    to: ["<COORDINATOR_AGENT_NAME>"],
    thread_id: "<epic-thread-id>",
    topic: "<EPIC_TOPIC>",
    subject: "Decision violation found: <decision-id>",
    body_md: "Bead <id> violated decision <D#>: <what was done vs what was decided>. Proposed fix: <approach>."
  )
  ```
- Wait for response or implement the conservative fix (honor the locked decision)

### Verify the fix

Run the exact command that originally failed. It must pass cleanly — not "mostly pass":

```bash
# Rerun original failing command
<original-failing-command>

# Also run broader test suite to check for regressions
npm test   # or equivalent
```

If verification fails, do not report success. Return to Step 4 with new information.

### Report the fix via Agent Mail

```
send_message(
  project_key: "<project-root-path>",
  sender_name: "<agent-name>",
  to: ["<COORDINATOR_AGENT_NAME>"],
  thread_id: "<epic-thread-id>",
  topic: "<EPIC_TOPIC>",
  subject: "Fix applied: <classification from Step 1>",
  body_md: "Root cause: <sentence from 4g>. Fix: <what was changed>. Verification: passed."
)
```

---

## Step 5.5: Architecture Suspicion Gate

If the same issue survives two focused fix attempts, or the failure starts hopping across subsystems instead of collapsing to one root cause, stop patching.

At that point:

- write the root cause as an architectural doubt, not another guess
- return the work to `pulse:planning` or `pulse:validating` if the shape of the fix needs to be rethought
- in worker or execution contexts, report the blocker instead of making a fourth patch attempt

This is the point where the problem has stopped being "one more fix" and started being "the plan or boundary is wrong."

---

## Step 6: Capture the Learning

### If this is a new failure pattern

Write a debug note to `.pulse/debug-notes/<bead-id>-debug.md` (create the directory if needed). Use this canonical path so `pulse:compounding` can find all debug notes reliably.

Template:

```markdown
## Debug Note: <date> — <classification>

**Root cause**: <one sentence>
**Trigger**: <what causes this>
**Fix**: <what resolves it>
**Propagation recommendation**: global-critical | bead-local | planner-only
**Why**: <why this should propagate that way>
**Signal**: <how to recognize this pattern in future>
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

---

## Blocker-Specific Protocol

When a worker is stuck (cannot make progress, not a code error):

1. Check bead dependencies: `bv --robot-insights 2>/dev/null | jq '.Cycles'`
2. Check file reservations via Agent Mail for conflicts
3. Determine: is this **waiting for another worker** or **genuinely blocked**?

**Waiting for another worker** — report to orchestrator and yield:
```
send_message(
  project_key: "<project-root-path>",
  sender_name: "<agent-name>",
  to: ["<COORDINATOR_AGENT_NAME>"],
  thread_id: "<epic-thread-id>",
  topic: "<EPIC_TOPIC>",
  subject: "Blocked: waiting on <bead-id>",
  body_md: "<bead-id> cannot proceed until <dependency> completes. Pausing."
)
```

**Genuinely blocked** (circular dep, impossible constraint, conflicting decisions):
```
send_message(
  project_key: "<project-root-path>",
  sender_name: "<agent-name>",
  to: ["<COORDINATOR_AGENT_NAME>"],
  thread_id: "<epic-thread-id>",
  topic: "<EPIC_TOPIC>",
  subject: "Hard blocker: <description>",
  body_md: "Cannot resolve: <what is impossible and why>. Options: <A> or <B>. Needs human decision."
)
```

Do not spin. One report, then pause and let the orchestrator escalate.

---

## Red Flags

- Fixing symptoms instead of root cause — if the same error recurs after the fix, root cause was not found
- Skipping exact reproduction
- Not checking bead `learning_refs` before broad memory lookup
- Assuming every worker should read `critical-patterns.md`
- Patching global learning files directly during ad hoc debugging
- Treating a propagation failure as only a code bug
- Committing a fix without running verification with the exact failing command
- Decision violation silently patched instead of reported and aligned
- Making a third fix attempt after two focused fixes failed, regardless of whether the failure crosses subsystem boundaries

---

## Quick Reference

| Situation | First action |
|---|---|
| Build fails | `git log --oneline -10` — check recent changes |
| Test fails | Run test verbatim, capture exact assertion output |
| Flaky test | Run 5x — if intermittent, check shared state/ordering |
| Runtime crash | Read stack trace top-to-bottom, find first line in your code |
| Integration error | Check env vars, then API response body (not just status code) |
| Worker stuck | Check bead deps with `bv`, then Agent Mail for conflicts |
| Recurring issue | Check bead `learning_refs` first, then `critical-patterns.md` |
| Decision violation | Report via Agent Mail before fixing |

## Handoff

Report:

- classification
- root cause
- fix applied
- verification result
- whether compounding should promote a new or updated learning
