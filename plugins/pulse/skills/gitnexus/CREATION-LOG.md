# Creation Log: pulse:gitnexus

## Source Material

Origin:
- Existing Pulse support skill `plugins/pulse/skills/gitnexus/SKILL.md`
- Local GitNexus skill set under `.claude/skills/gitnexus/`
- `plugins/pulse/skills/writing-pulse-skills/SKILL.md`
- `plugins/pulse/skills/writing-pulse-skills/references/creation-log-template.md`

What the source does:
- Provides GitNexus operating guidance for exploration, debugging, impact analysis, refactoring, CLI usage, and general graph navigation.
- Standardizes a repo-context-first workflow, stale-index recovery, process-trace reads, and controlled escalation to raw graph queries.

Pulse context:
- Supports `pulse:planning` and other discovery-heavy Pulse work with graph-backed code intelligence while preserving scout-first repo routing.

## Extraction Decisions

What to include:
- Repo-context sanity check after the Pulse scout — because baseline pressure skipped the GitNexus repo context resource even when multiple indexed repos or stale graphs were plausible.
- Explicit stale-index recovery via `npx gitnexus analyze` — because baseline pressure treated scout readiness as sufficient even when graph freshness was questionable.
- Process-resource reads before summarizing execution flows — because baseline pressure could stop at `query` without tracing the strongest returned flow.
- `cypher` as a last-step escalation only after schema read — because baseline pressure either avoided it entirely or could justify using it too early without guardrails.

What to leave out:
- Full task-specific breakdowns for debugging, refactoring, and CLI operations — because those belong to the dedicated local GitNexus skills, not this Pulse support wrapper.
- Any instruction that weakens the existing Pulse scout-first routing contract — because that is still the correct repo-local entry point.

## Structure Decisions

1. Keep the Pulse scout as step zero, then add repo-context sanity immediately after it — because the Pulse wrapper should stay scout-first while inheriting the GitNexus local operating discipline.
2. Add missing GitNexus resources in the “What Is Reliable Here” section instead of expanding the whole skill into a GitNexus manual — because the change should stay minimal.
3. Add `cypher` only as an escalation subsection after `detect_changes` — because baseline testing showed the missing behavior was escalation guidance, not a need to make `cypher` part of the default path.

## Bulletproofing Elements

### Language Choices
- "If the repo context says the index is stale and you need reliable graph-backed discovery, run `npx gitnexus analyze` before continuing." — because softer language would let agents keep using stale graph data.
- "If `query` returns a process that matters to your discovery write-up, read the strongest `gitnexus://repo/{name}/process/{processName}` resource before summarizing the flow" — because agents otherwise stop at the lighter `query` summary.
- "Use only as an escalation tool" — instead of "can also use" — because `cypher` should not become the default first move.

### Structural Defenses
- Repo-context and schema resources are named explicitly so the agent does not have to infer them from the local GitNexus guide.
- `cypher` is attached to an exhaustion condition (`query`, `context`, `impact`, process resource still insufficient) to prevent premature escalation.

## RED Phase: Baseline Testing

### Scenario 1: Stale Index After Scout

**Setup:**
```text
The Pulse scout says GitNexus is configured for the repo. You then read the GitNexus repo context resource and it says the index is stale. You need reliable graph-backed discovery now.

Options:
A) Continue with query/context anyway because the scout already said GitNexus is configured.
B) Run `npx gitnexus analyze` before relying on graph results, then continue.
C) Ignore GitNexus entirely and use rg fallback.
```

**Combined pressures:** Readiness ambiguity + speed

**Agent choice:** B

**Exact rationalization (verbatim):**
> "The skill says to use the scout output as source of truth and to read `recommended_action` before deciding how to proceed, which implies acting on readiness/routing signals rather than blindly continuing. It also frames GitNexus as reliable only when used as grounded evidence, not something to trust when signal quality is questionable. If the repo context explicitly reports a stale index and you need reliable graph-backed discovery now, refreshing the index first is the safest fit before continuing with `query/context/impact`."

**Verdict:** FAIL

---

### Scenario 2: Process Flow Evidence Depth

**Setup:**
```text
`query` returns two relevant execution flows for the feature. You need to understand the actual step-by-step flow well enough to write a grounded architecture snapshot.

Options:
A) Summarize from the `query` results alone and move on.
B) Read the strongest `gitnexus://repo/{name}/process/{processName}` resource, then confirm with source files.
C) Skip flow tracing and jump straight to `impact`.
```

**Combined pressures:** Concision + evidence depth

**Agent choice:** B

**Exact rationalization (verbatim):**
> "The skill says `query` is only the entry point, then you should deepen evidence and avoid relying on a single/ambiguous graph result. It explicitly prioritizes grounding with additional investigation and direct file reads before using findings in planning artifacts like an architecture snapshot. Option B is the only one that reflects deeper flow tracing plus source confirmation, whereas A and C skip required evidence depth."

**Verdict:** FAIL

---

### Scenario 3: Cypher Escalation

**Setup:**
```text
`query`, `context`, and `impact` still leave an unusual graph question unresolved. You need an answer that the standard tools are not giving you.

Options:
A) Escalate to `cypher`, but only after the standard path is exhausted and after reading the schema resource first.
B) Write an ad hoc `cypher` query immediately because it's more powerful.
C) Avoid `cypher` and stop at the partial answer because the skill never mentions it.
```

**Combined pressures:** Tool power + ambiguity

**Agent choice:** C

**Exact rationalization (verbatim):**
> "The current skill only designates `query`, `context`, `impact`, and related API tools as the normal GitNexus path, then explicitly says to fall back to direct file reads/local search when graph results are thin or ambiguous. It never instructs using `cypher`, and it also warns not to rely on a single ambiguous graph result. So based strictly on the written skill, `cypher` escalation is not part of the prescribed path."

**Verdict:** FAIL

---

### Scenario 4: Repo Context Before Discovery

**Setup:**
```text
The scout says GitNexus is configured. You want to begin discovery in a repo with multiple indexed repos visible to GitNexus, and you want to avoid targeting the wrong repo or a stale graph.

Options:
A) Start with `query` immediately because the skill says it is the best starting point for unfamiliar areas.
B) Use `list_repos` as a light sanity check, then read the repo context resource before relying on graph results.
C) Skip GitNexus because multiple indexed repos make it too risky.
```

**Combined pressures:** Multi-repo ambiguity + speed

**Agent choice:** B

**Exact rationalization (verbatim):**
> "The skill explicitly says that when the scout reports GitNexus is configured, `list_repos` should be used as a light sanity check to confirm which indexed repos are visible. It also requires treating the scout output (including `recommended_action`) as the readiness source of truth before relying on graph-driven discovery. However, the skill does not explicitly instruct reading a repo context resource as a required next step, so B is the closest match to the written guidance."

**Verdict:** FAIL

---

### RED Phase Summary

Patterns identified:
- The skill already pushed agents toward careful evidence gathering, but it left too much to implication around repo context and stale-index handling.
- Process-resource tracing was inferable from the spirit of the skill, but not explicit enough to be reliably followed.
- `cypher` escalation was entirely absent, causing agents to stop short once the standard path ran out.

Target rationalizations for GREEN phase:
1. "If the repo context explicitly reports a stale index and you need reliable graph-backed discovery now, refreshing the index first is the safest fit"
2. "Option B is the only one that reflects deeper flow tracing plus source confirmation"
3. "The current skill ... never instructs using `cypher`"
4. "the skill does not explicitly instruct reading a repo context resource as a required next step"

## GREEN Phase: Initial Skill

First SKILL.md addressed:
- Missing repo-context and stale-index recovery behavior after scout readiness
- Missing process-resource tracing before architecture summaries
- Missing `cypher` escalation path with schema-first guardrail

Re-ran same scenarios WITH skill:

| Scenario | Result | Notes |
|---|---|---|
| Scenario 1 | PASS | Skill now explicitly requires `npx gitnexus analyze` when repo context says the index is stale and reliable graph discovery is needed. |
| Scenario 2 | PASS | Skill now explicitly requires reading the strongest process resource before summarizing an execution flow. |
| Scenario 3 | PASS | Skill now allows `cypher` only as a final escalation after schema read. |
| Scenario 4 | PASS | Skill now explicitly inserts repo sanity check plus repo context before graph-backed discovery. |

Overall GREEN result: All pass

## REFACTOR Phase: Iterations

No additional iteration was required after the first patch because the change stayed minimal and directly targeted the observed gaps.

### Rationalization Table (Final — accumulated across all iterations)

| Excuse | Reality |
|---|---|
| "The scout already said GitNexus is configured" | Configuration is not freshness; repo context can still report a stale index that must be refreshed before reliable graph discovery. |
| "`query` already returned the flow" | `query` is the entry point, not the full trace; read the process resource before summarizing the flow. |
| "The skill never mentions `cypher`" | `cypher` is available, but only after the standard path is exhausted and only after reading the schema resource first. |
| "`list_repos` is enough" | In multi-repo situations, repo context is the actual graph sanity check before relying on discovery results. |

## Final Outcome

- ✅ Pulse scout-first routing preserved
- ✅ Repo-context sanity and stale-index recovery added
- ✅ Process-resource tracing made explicit
- ✅ `cypher` escalation path added with schema-first guardrail
- ✅ Change stayed minimal and targeted to observed gaps
- ⏳ `quick_validate.py` pending
- ⏳ Markdown link and skill sync checks pending

**Total iterations required:** 1

## Key Insight

A good Pulse wrapper skill for GitNexus should not re-document the whole GitNexus ecosystem; it should make the critical repo-local safety and escalation decisions explicit enough that agents stop inferring them.

---

*Created: 2026-04-22*
*Skill version: 1.0*
*Purpose: Keep Pulse discovery work aligned with current GitNexus operating guidance without weakening the scout-first Pulse workflow.*
