---
name: exploring
description: >-
  Use before feature work, refactor, or behavior modification when the user intent is
  already clear but implementation decisions are still fuzzy. Extracts locked decisions
  from the user through Socratic dialogue BEFORE research or planning begins.
  Implements GSD discuss-phase + Superpowers brainstorming + CE scope-tiering.
  Trigger phrases: add, change, implement, investigate implementation impact, lock
  decisions, clarify implementation choices, scope implementation work, resolve gray
  areas before planning. Output is history/{feature}/CONTEXT.md — the single
  source of truth for all downstream agents (planning, validating, swarming).
metadata:
  version: '1.0'
  ecosystem: pulse
  position: '2 of 9 — runs after using-pulse, before planning'
  dependencies: []
---

# Exploring Skill

If `.pulse/onboarding.json` is missing or stale for the current repo, stop and invoke `pulse:using-pulse` before continuing.

Research shows that 5–10 minutes spent extracting decisions before any planning begins
prevents hours of back-and-forth caused by planner assumptions ([GSD README](https://github.com/gsd-build/get-shit-done)).
This skill is that conversation. Teams who skip it get reasonable defaults; teams who use it get their vision.

## When to Use This Skill

Load when the user presents a feature request, asks to build or change something, or when
requirements are fuzzy enough that downstream agents would need to make implementation assumptions.
Skip for one-line fixes where all decisions are self-evident.

## Config Check

If `.pulse/config.json` contains `"skip_exploring": true`, this skill should be skipped in the pipeline. However:
- Still require CONTEXT.md to exist before planning proceeds
- If no CONTEXT.md exists and exploring is skipped, warn the user that planning will proceed without locked decisions
- Quick mode already bypasses exploring — this config is for standard/deep features where the user has pre-written CONTEXT.md

---

## Process

You MUST complete these phases in order. Create a task for each phase before starting.

---

### Phase 0: Scope Assessment

**Step 0.1 — Classify scope**

Assess from the request + a 30-second project scan:

- **Quick** — bounded, low ambiguity (e.g., rename a flag, tweak a label). Skip to Phase 2.
- **Standard** — normal feature with decisions to extract. Run all phases.
- **Deep** — cross-cutting, strategic, or highly ambiguous. Run all phases with extra depth.

If scope is unclear, ask ONE disambiguation question before continuing.

**Step 0.2 — Load project docs and prior context**

Read project docs first when available:

```
Read first (if exists):
- .pulse/project-docs.json                 ← canonical project-doc index and status
```

If `.pulse/project-docs.json` exists, read the smallest relevant listed docs before relying on feature history alone.
If `.pulse/project-docs.json` is missing, detect likely project docs (README, architecture, ADR, domain docs) and read the smallest relevant set.

Then load prior context:

```
Read (if exists):
- .pulse/memory/critical-patterns.md       ← promoted critical learnings
- .pulse/STATE.md                          ← any prior feature context
```

Build an internal summary of prior decisions. Use it to skip already-answered questions
and annotate options with "Previously decided: X."

**Step 0.3 — Multi-system decomposition check**

Does the request describe multiple independent subsystems? If yes:
> "This covers [A], [B], and [C] — three independent systems. Each needs its own exploring
> session. Let's start with [most foundational]. I'll note the others for later."

**Step 0.4 — Step-back move for decision framing**

Before domain classification, decide whether the request needs one brief step-back pass.
This is not a new phase and not a substitute for Socratic questioning. It is a short framing
move to make sure you are locking the right decisions.

Use it only when one of these is true:
- the request is clear about the desired change but unclear about the decision surface
- several gray areas look similar and you need to separate outcome decisions from implementation details
- the conversation is drifting toward components, libraries, or architecture before the user-facing or system-facing behavior is framed
- you are about to ask a question whose answer would not materially change planning assumptions

If you use the move, do it once and keep it short:
1. restate the practical outcome the feature must make true
2. name 2–4 decision axes that will shape planning
3. name what does not belong in exploring yet
4. turn that frame into the next single question

Keep the result internal unless a short external framing statement will help the user confirm the direction.
Do not let the move become a mini-plan, a deep architecture discussion, or a bundled set of questions.

Example internal frame:
- Outcome: "A caller can do X reliably."
- Decision axes: actor, success path, boundary conditions, out-of-scope behaviors
- Not yet: library choice, internal module layout, optimization work

---

### Phase 1: Domain Classification

Classify what is being built so Phase 2 probes the right ambiguity surface.

Use the canonical type definitions in `references/gray-area-probes.md` (SEE/CALL/RUN/READ/ORGANIZE).
One feature can span types (for example, SEE + CALL). Classify all that apply before moving on.

---

### Phase 2: Gray Area Identification

Generate 2–4 gray areas for this feature using the domain probes from `gray-area-probes.md`.

A gray area is a decision that:
- Affects implementation specifics
- Was not stated in the request
- Would force the planner to make an assumption without it

**Quick codebase scout** (grep only — no deep analysis):

Run a minimal keyword scan over likely source roots, read 2-3 relevant files, and annotate options with what already exists.
Keep this scout shallow; deep codebase analysis belongs to planning.

Filter OUT of gray areas:
- Technical implementation details (architecture, library choices)
- Performance concerns
- Scope expansion (new capabilities not requested)

Terminology discipline for gray areas:
- Reuse glossary terms from project docs when available
- If user language conflicts with project glossary, call out the conflict explicitly and ask which term/meaning should be locked
- If the wording materially changes implementation assumptions, cross-check the statement against both docs and quick code scout evidence before locking

---

### Phase 3: Socratic Exploration

<HARD-GATE>
Ask ONE question at a time. Wait for the user's response before asking the next question.
Do NOT batch questions. Do NOT answer your own questions.
Do NOT proceed to Phase 4 until all gray areas have been discussed and decisions locked.
This gate is non-negotiable. Elicitron (2024) demonstrates sequential questioning
identifies significantly more latent needs than batched approaches.
</HARD-GATE>

**Rules (apply without exception):**

1. One question per message — never bundled
2. Single-select multiple choice preferred over open-ended
3. Start broad (what/why/for whom) then narrow (constraints, edge cases)
4. If a gray area still feels muddy, use one brief step-back move before the next question so you ask about the decision that changes planning, not a local implementation detail
5. 3–4 questions per gray area, then checkpoint:
   > "More questions about [area], or move to next? (Remaining: [unvisited areas])"

**Scope creep response** — when the user suggests something outside scope:
> "[Feature X] is a new capability — that's its own work item. I'll note it as a
> deferred idea. Back to [current area]: [return to current question]"

**Decision locking** — after each gray area is resolved:
> "Locking decision [D_N]: [summary of decision]. Confirmed?"

Assign stable IDs in sequence: D1, D2, D3... These IDs are referenced in CONTEXT.md and
by all downstream agents. Do not reuse or renumber IDs once assigned.

---

### Phase 4: Context Assembly

Durable ambiguity rule:
- Exploring is the primary place to propose lazy project-doc scaffolding when repeated ambiguity is clearly project-level (not feature-local) and existing docs cannot resolve it.
- Keep this as a proposal, not an automatic write path. Confirm with the user before any scaffold action.
- Even when scaffolding is proposed, `history/<feature>/CONTEXT.md` remains the feature source of truth for locked implementation decisions.

**Step 4.1 — Write CONTEXT.md**

```
Path: history/<feature-slug>/CONTEXT.md
```

Load `references/context-template.md` and populate every section. Rules:
- Locked decisions must be concrete: "Card-based layout, not timeline" not "modern feel"
- Code context must cite file paths found during the scout
- Open questions must be split: "Resolve Before Planning" vs "Deferred to Planning"
- Every locked decision must reference its stable ID (D1, D2...)

**Step 4.2 — Self-review via subagent**

Spawn a fresh subagent using `references/context-reviewer-prompt.md` (never pass session history).

- If Issues Found: fix, re-spawn reviewer, repeat
- Maximum 2 iterations before asking the user to review directly

---

### Phase 5: Handoff

After CONTEXT.md passes review:

1. Update `.pulse/STATE.md`:
   ```
   Current: exploring complete for <feature>
   CONTEXT.md: history/<feature>/CONTEXT.md
   Locked decisions: D1...D_N
   Next: invoke pulse:planning skill
   ```

2. Present to user:
   > "Decisions captured. CONTEXT.md written to `history/<feature>/CONTEXT.md`.
   > CONTEXT.md is now the single source of truth for all downstream agents.
   > Invoke the pulse:planning skill to research the codebase, show the proposed phases and stories, and then wait for approval before current-phase preparation."

<HARD-GATE>
Do NOT invoke planning, write code, create beads, or take any implementation action.
The terminal state of this skill is writing CONTEXT.md and announcing handoff.
The ONLY valid next step is the user invoking the pulse:planning skill.
</HARD-GATE>

---

## What This Skill Does NOT Do

The planner reads CONTEXT.md and does these things — not you:

- Research external patterns or library options (that is planning's job)
- Analyze the codebase deeply (only quick grep here)
- Write code, pseudocode, or implementation sketches
- Create beads or suggest implementation approaches
- Propose architecture or technical solutions

Researchers and planners downstream read CONTEXT.md to know what to investigate and
what choices are already locked. Your job is to capture decisions clearly enough that
they can act without asking the user again.

---

## Anti-Patterns

**"This is too simple to need exploring"**
Every standard-scope request goes through this process. The CONTEXT.md can be short.
But downstream agents will make assumptions without it — and those assumptions compound.

**"I already know what to build"**
Your assumptions are hypotheses until the user confirms them.
Run Phase 3 and let the user lock the decisions.

**"The user wants to move fast"**
Speed comes from clarity. A 10-minute exploring session prevents a 2-hour planning rework
caused by locked decisions that contradicted what the user actually wanted.

---

## Red Flags

Stop immediately if you catch yourself doing any of these:

- Answering a question you just asked (HARD-GATE violation)
- Writing code or suggesting a library
- Asking two questions in the same message
- Skipping Phase 3 because the feature "seems obvious"
- Creating beads or referencing bead IDs
- Running deep codebase analysis instead of quick grep

---

## References

- `references/gray-area-probes.md` — probes per domain type (SEE/CALL/RUN/READ/ORGANIZE)
- `references/context-template.md` — the CONTEXT.md template to populate in Phase 4
- `references/context-reviewer-prompt.md` — canonical prompt for the Phase 4.2 self-review subagent
