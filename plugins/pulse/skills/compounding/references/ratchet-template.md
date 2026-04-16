# Ratchet File Template

Use this template when writing `.pulse/memory/ratchet/YYYYMMDD-<slug>.md`.

A ratchet is a non-regression rule earned by repeated failures, repeated corrections, or an especially costly miss.

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
# Ratchet: <Concise Title>

**Rule:** <the must-check or non-regression bar future agents must honor>

## Why this became a ratchet

<Explain the repeated or expensive failure pattern that promoted this into a must-check rule.>

## Required checks

- <verification or review step 1>
- <verification or review step 2>

## Evidence

- Feature: <feature-name>
- Files / commands / artifacts:
  - <path or command>

## Propagation

**Propagation:** ratchet
**Planner action:** attach this file in bead `learning_refs` when the trigger clearly matches.
**Validator action:** treat this as a must-check when the trigger clearly matches.
```

---

## Quality bar

- `applies_when` must name a recognizable technical trigger.
- `Required checks` must be concrete and runnable/reviewable.
- Keep ratchets narrow enough that they stay meaningful and are not ignored as noise.
