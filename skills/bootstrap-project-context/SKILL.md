---
name: bootstrap-project-context
description: Use when starting work in an unfamiliar repository, resuming after lost context, or when the user asks to bootstrap repo understanding before implementation.
metadata:
  version: '1.0'
  dependencies: []
---

# Bootstrap Project Context

Start a session by absorbing the repo's explicit instructions first, then confirm the real system shape from source.

If the user asks to improve or templatize a bootstrap prompt, route to `pulse:prompt-leverage` first, then return here for repo orientation execution.

Use the shared project-docs contract in [references/project-docs-contract.md](references/project-docs-contract.md) when bootstrapping or validating downstream project documentation structure.

## Mode

- `Repo bootstrap`: read the operating docs, investigate the repo, and deliver an onboarding summary.

## Workflow

### 1. Read the explicit repo contract first

Read these files completely when they exist:

- `AGENTS.md`
- `README.md`

Treat them as mandatory orientation, not optional background.

If the repo exposes a read-only status or onboarding scout, you may use it as a supplement after the mandatory docs pass, never as a substitute for reading the docs.

### 2. Resolve project-docs contract and scaffold policy

Treat project docs as a separate plane from feature history.

Support these repository patterns:

- `single-context`: one top-level `CONTEXT.md`
- `multi-context`: one top-level `CONTEXT-MAP.md` plus per-context `CONTEXT.md` files
- `adrs`: ADR directory for durable architectural decisions

By default, report the selected structure as a proposed `.pulse/project-docs.json` mapping artifact in the skill workflow instructions.
Do not create or update `.pulse/project-docs.json` unless the user explicitly approves applying the detected mapping.

Detect exactly one of:
- `single-context`
- `multi-context`
- `none-yet`

Return the evidence paths that justify that choice.

When docs already exist:
- inspect them for glossary, ownership, and boundary cues
- validate the mapping in-session and report it as a proposed `.pulse/project-docs.json` update
- apply the `.pulse/project-docs.json` create/update only after explicit user approval

When docs do not exist:
- propose only the lightest lazy scaffold needed for the first resolved term or durable decision
- keep the absence explicit instead of silently inventing repo language

If project docs are missing, default to a lazy scaffold proposal and ask for explicit user confirmation before creating files. Never force eager scaffolding.

Use these references when scaffolding is approved:

- [references/project-context-template.md](references/project-context-template.md)
- [references/context-map-template.md](references/context-map-template.md)
- [references/adr-template.md](references/adr-template.md)

### 3. Build a source-first map of the repository

Understand the codebase from the implementation, not from naming alone.

Inspect the most informative source artifacts first, such as:

- package manifests, build files, task runners, and lockfiles
- top-level app or service directories
- primary entrypoints and framework bootstraps
- configuration files, environment examples, and schemas
- tests that reveal supported behavior
- architecture docs and design notes when present

Aim to identify:

- what the project is for
- who or what uses it
- the major subsystems and how they relate
- the main execution paths, data flows, and external integrations
- the development and verification commands that matter

### 4. Trace the technical architecture with enough depth

Go broad before going deep.

At minimum, determine:

- the primary language, framework, and runtime model
- the main module boundaries
- where requests, jobs, or user actions enter the system
- where state lives
- how the project is configured, built, and tested

Read representative files from each important area. Do not pretend to understand the architecture from one or two files, but do not exhaustively read the whole repo when a targeted map is enough.

### 5. Return a practical onboarding synthesis

Summarize the repo in a way that helps the next turn start strong.

Include:

- project purpose
- architecture summary
- major components and responsibilities
- important commands and workflows
- notable conventions or operating constraints from `AGENTS.md`
- project-doc mode, glossary sources, and terminology hotspots that future exploring sessions should honor
- open questions or areas that still need deeper inspection
- the best next files or directories to read for the user's likely goal

### 6. Verify the orientation pass

Before finishing, check that your summary is grounded in files you actually inspected.

Make sure you did not:

- skip `AGENTS.md` or `README.md`
- confuse docs intent with real implementation behavior
- describe architecture that you did not verify from source
- miss an obvious top-level subsystem, runtime, or integration

## Red Flags

Stop and correct the approach if any of these appear:

- skimming `AGENTS.md` or `README.md`
- jumping into code without first reading the repo instructions
- inferring architecture from directory names alone
- giving a hand-wavy summary with no file-grounded evidence
- over-reading low-value files instead of building a representative system map

## Done Criteria

This skill is complete when the repo-orientation pass:

- begins with a full read of `AGENTS.md` and `README.md` when present
- explains the project's purpose and technical architecture from inspected source
- identifies the main components, workflows, and important commands
- returns a concrete detected mapping and/or lazy scaffold proposal, and only applies mapping/scaffold changes after explicit user approval
- captures repo-specific conventions and open questions clearly enough for the next turn to start productively
