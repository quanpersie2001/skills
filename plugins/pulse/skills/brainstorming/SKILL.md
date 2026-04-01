---
name: brainstorming
description: >-
  Use before any creative or product work — designing features, planning architecture,
  scoping changes, or evaluating approaches. Turns vague intent into a documented,
  approved spec before any planning or implementation begins.
  Trigger phrases: design, brainstorm, think through, figure out, what should we build,
  how should we approach, explore options, evaluate, what's the best way to, help me think,
  let's plan, I want to build.
metadata:
  version: '1.0'
  ecosystem: pulse
  position: '1b of 9 — optional pre-step before pulse:exploring'
---

# Brainstorming Skill

Turns vague intent into a documented, approved design spec through structured dialogue —
before any codebase research or implementation planning begins.

Research shows that designs validated before implementation reduce planning rework by
removing assumption drift before it compounds across phases.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, create beads, or take any
implementation action until a design has been presented AND the user has approved it.
This applies regardless of perceived simplicity. The design can be short — but it MUST
exist and be approved.
</HARD-GATE>

## Anti-Pattern: "This is too simple to need a design"

Every feature goes through this process. A config flag, a single function, a UI tweak —
all of them. "Simple" projects are where unexamined assumptions cause the most wasted
planning work. The spec can be a paragraph. But you MUST present it and get approval.

---

## Checklist

Create a task for each item and complete them in order:

1. **Explore project context** — read files, docs, recent commits relevant to the request
2. **Assess scope** — is this one feature or multiple independent systems? (see Decomposition)
3. **Ask clarifying questions** — one at a time; purpose, constraints, success criteria
4. **Propose 2–3 approaches** — with trade-offs and your recommendation
5. **Present design** — in sections scaled to complexity; get user approval after each section
6. **Write spec doc** — save to `history/<feature>/spec.md` and note the path
7. **Spec self-review** — subagent check for placeholders, contradictions, scope, ambiguity
8. **User reviews spec** — ask user to confirm before proceeding
9. **Handoff to exploring** — invoke `pulse:exploring` to lock implementation decisions

---

## Process Flow

```dot
digraph brainstorming {
    "Explore project context" [shape=box];
    "Multi-system?" [shape=diamond];
    "Decompose first" [shape=box];
    "Ask clarifying questions" [shape=box];
    "Propose 2-3 approaches" [shape=box];
    "Present design sections" [shape=box];
    "User approves design?" [shape=diamond];
    "Write spec doc" [shape=box];
    "Spec self-review (subagent)" [shape=box];
    "User reviews spec?" [shape=diamond];
    "Invoke pulse:exploring" [shape=doublecircle];

    "Explore project context" -> "Multi-system?";
    "Multi-system?" -> "Decompose first" [label="yes"];
    "Multi-system?" -> "Ask clarifying questions" [label="no"];
    "Decompose first" -> "Ask clarifying questions";
    "Ask clarifying questions" -> "Propose 2-3 approaches";
    "Propose 2-3 approaches" -> "Present design sections";
    "Present design sections" -> "User approves design?" ;
    "User approves design?" -> "Present design sections" [label="no, revise"];
    "User approves design?" -> "Write spec doc" [label="yes"];
    "Write spec doc" -> "Spec self-review (subagent)";
    "Spec self-review (subagent)" -> "User reviews spec?";
    "User reviews spec?" -> "Write spec doc" [label="changes requested"];
    "User reviews spec?" -> "Invoke pulse:exploring" [label="approved"];
}
```

**The terminal state is invoking `pulse:exploring`.** Do NOT invoke planning, validating,
or any execution skill. After brainstorming, the ONLY valid next step is `pulse:exploring`.

---

## Phase 1: Explore Context

Before asking any question, understand what already exists:

- Check relevant files, docs, and the last few commits related to the topic
- Identify existing patterns, components, or decisions that constrain the design
- Note what can be reused vs. what needs to be created from scratch

Build an internal picture first — it makes your clarifying questions concrete instead of generic.

---

## Phase 2: Scope Assessment

Before asking detailed questions, assess whether the request is one feature or several:

**One feature** — scoped work with a clear boundary. Continue normally.

**Multiple independent systems** — e.g., "build a platform with auth, billing, and analytics."
Flag this immediately:

> "This covers [A], [B], and [C] — three independent systems. Each needs its own
> brainstorming session. Let's start with [most foundational]. I'll note the others for later."

Then brainstorm the first sub-system through the full flow. Each sub-system gets its own
spec → exploring → planning → execution cycle.

---

## Phase 3: Clarifying Questions

<HARD-GATE>
Ask ONE question at a time. Wait for the user's response before the next.
Do NOT batch questions. Do NOT answer your own questions.
This gate is non-negotiable — sequential questioning surfaces significantly more
latent requirements than batched approaches.
</HARD-GATE>

**Rules:**

- One question per message — never bundled
- Multiple-choice preferred over open-ended when possible
- Start broad (what, why, for whom) then narrow (constraints, edge cases, success criteria)
- 3–4 questions per topic area, then checkpoint: "More questions about [area], or move on?"

**Scope creep** — when the user suggests something out of scope:
> "[Feature X] is a new capability — that's its own work item. I'll note it as a
> deferred idea. Back to [current topic]: [return to question]"

---

## Phase 4: Propose Approaches

Present 2–3 different approaches before committing to one:

- Describe each option concisely with its trade-offs
- Lead with your recommended option and explain why
- Invite the user to push back or ask about specific trade-offs

Do NOT start designing until the user picks a direction.

---

## Phase 5: Present Design

Once the direction is clear, present the design:

- Scale each section to its complexity — a few sentences if simple, 200–300 words if nuanced
- Ask "Does this look right so far?" after each section before moving to the next
- Cover: architecture, key components, data flow, error handling, testing strategy
- Be ready to revise — if something doesn't make sense, go back and clarify

**Design for isolation:**

- Break the system into units each with one clear purpose and well-defined interfaces
- For each unit: what does it do, how do you use it, what does it depend on?
- Can someone understand a unit without reading its internals? Can you change the internals
  without breaking consumers? If not, the boundaries need work.

**Working in existing codebases:**

- Follow existing patterns — don't propose unrelated refactoring
- Where existing code has problems that affect the work (a file that's grown too large,
  tangled responsibilities), include targeted improvements as part of the design
- Stay focused on what serves the current goal

---

## Phase 6: Write Spec Doc

After the user approves the design, write the spec:

**Path:** `history/<feature-slug>/spec.md`

The spec must include:
- Problem statement and goals
- Approved approach (one sentence summary)
- Architecture and key components
- Data flow
- Error handling approach
- Testing strategy
- Out of scope (explicitly list what was deferred)

---

## Phase 7: Spec Self-Review

After writing the spec, spawn a subagent to review it:

```
You are a spec document reviewer. Verify this spec is complete and ready for planning.

Spec to review: history/<feature>/spec.md

What to check:
| Category     | What to Look For |
|--------------|-----------------|
| Completeness | TODOs, placeholders, "TBD", incomplete sections |
| Consistency  | Internal contradictions, conflicting requirements |
| Clarity      | Requirements ambiguous enough to cause building the wrong thing |
| Scope        | Focused enough for a single feature cycle |
| YAGNI        | Unrequested features, over-engineering |

Calibration: Only flag issues that would cause real problems during planning.
Approve unless there are serious gaps.

Output:
Status: Approved | Issues Found
Issues (if any): [Section] — [specific issue] — [why it matters for planning]
Recommendations (advisory, do not block): [suggestions]
```

- If Issues Found: fix inline, re-spawn reviewer, repeat (max 2 iterations)
- After 2 iterations with unresolved issues: ask the user to review directly

---

## Phase 8: User Review Gate

After the spec self-review passes:

> "Spec written to `history/<feature>/spec.md`. Please review it and let me know if
> you want any changes before we start locking implementation decisions."

Wait for the user's response. If they request changes: make them, re-run the self-review
loop. Only proceed once the user approves.

---

## Phase 9: Handoff

After user spec approval:

1. Update `.pulse/STATE.md`:
   ```
   Current: brainstorming complete for <feature>
   Spec: history/<feature>/spec.md
   Next: invoke pulse:exploring to lock implementation decisions
   ```

2. Present to user:
   > "Spec approved. Invoke `pulse:exploring` to extract implementation decisions
   > (gray areas, scope boundaries, and locked choices) before planning begins."

<HARD-GATE>
Do NOT invoke planning, create beads, or write any code.
The terminal state of this skill is a written, approved spec and STATE update.
The ONLY valid next step is the user invoking pulse:exploring.
</HARD-GATE>

---

## Key Principles

- **One question at a time** — never overwhelm
- **Multiple-choice preferred** — easier to answer than open-ended
- **YAGNI ruthlessly** — remove unrequested features from all designs
- **Always propose alternatives** — 2–3 approaches before settling
- **Incremental validation** — present design in sections, get approval before continuing
- **Be ready to revise** — go back and clarify when something doesn't fit

---

## What This Skill Does NOT Do

These are `pulse:exploring`'s responsibilities — not yours:

- Deep codebase research (only quick context reads here)
- Locking implementation decisions with stable IDs (D1, D2...)
- Gray area extraction against domain probes
- Writing `CONTEXT.md` (exploring does this)
- Creating beads or work items

Brainstorming delivers a design spec. Exploring delivers locked decisions.
Planning consumes both.

---

## Red Flags

Stop immediately if you catch yourself doing any of these:

- Writing code or pseudocode during the design phase
- Asking two questions in the same message
- Skipping the spec because the feature "seems obvious"
- Answering a question you just asked
- Invoking planning or executing before spec is approved
- Creating beads or referencing bead IDs

---

## Anti-Patterns

**"The user wants to move fast"**
Speed comes from clarity. A 10-minute design session prevents hours of planning rework
caused by wrong assumptions baked into beads.

**"I already know what to build"**
Your assumptions are hypotheses until the user validates them.
Run Phase 3 and let the user confirm the direction.

**"This is too small to document"**
The spec can be three sentences. But it MUST exist so exploring has a stable target.

---

## References

- `references/spec-reviewer-prompt.md` — subagent prompt for spec document review
