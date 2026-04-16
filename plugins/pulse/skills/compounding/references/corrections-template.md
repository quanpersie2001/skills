# Corrections File Template

Use this template when writing `.pulse/memory/corrections/YYYYMMDD-<slug>.md`.

One file per tactical correction. Use YAML frontmatter so recall can score the entry reliably.

---

## YAML Frontmatter (required, line 1 of file)

```yaml
---
date: YYYY-MM-DD
feature: <feature-name>
severity: critical | standard
tags: [tag1, tag2]
applies_when: <specific technical trigger>
scope: [path/or/component, optional-second-scope]
signals: [symptom1, symptom2]
---
```

---

## Body Format

```markdown
# Correction: <Concise Title>

**Why this exists:** <the repeated or expensive mistake this correction prevents>

## Wrong move

<Describe the bad assumption or action in one short paragraph.>

## Correct move

<Describe the concrete replacement behavior future agents should follow.>

## Evidence

- Feature: <feature-name>
- Files / commands / artifacts:
  - <path or command>

## Propagation

**Propagation:** correction
**Planner action:** attach this file in bead `learning_refs` when the trigger clearly matches.
```

---

## Quality bar

- `applies_when` must name a specific trigger, not a general phase.
- `scope` should name files, components, or surfaces when known.
- `signals` should capture the symptoms that would make this correction relevant.
- Keep the correction short, tactical, and directly actionable.
