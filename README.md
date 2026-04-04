<div align="center">

# Pulse

**A validate-first agentic delivery system for Claude Code and Codex**

[![Version](https://img.shields.io/badge/version-2.3.1-0F766E?style=flat-square)](plugins/pulse/.claude-plugin/plugin.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](docs/legal/terms.md)
[![Skills](https://img.shields.io/badge/skills-20-8B5CF6?style=flat-square)](plugins/pulse/skills)

*Stop agents from hallucinating requirements, skipping verification, and producing unauditable work.*

</div>

---

## What is Pulse?

Pulse wraps AI agents in a **gated delivery chain**. Every decision is locked before planning starts. Every plan is approved before code is written. Every bead of work is verified before it's closed. Every feature is reviewed before it merges.

Without this structure, agents skip steps. With it, they can't.

Pulse ships as **20 skills** — each a `SKILL.md` file loaded into context at invocation. No compiled code. No runtime to install beyond the tools you already use.

---

## What A Pulse Run Looks Like

Ask for a feature like:

> "Add inbound email support for the agent inbox."

Pulse moves that request through a repeatable chain:

1. `pulse:exploring` locks the missing decisions into `CONTEXT.md`.
2. `pulse:planning` turns those decisions into a phase plan, a current-phase contract, a story map, and beads.
3. `pulse:validating` checks that the current phase is sound before any implementation starts.
4. `pulse:swarming` and `pulse:executing` implement the current phase with reservations and live graph coordination.
5. `pulse:reviewing` verifies the work and records P1/P2/P3 findings.
6. `pulse:compounding` captures durable learnings for future work.

The point is not ceremony for its own sake. The point is to make expensive misunderstandings and avoidable rework much less likely.

## When To Use Pulse

Use Pulse when:

- the request is ambiguous or under-specified
- the work spans multiple files, systems, or agents
- the cost of getting the plan wrong is meaningful
- you want a reviewed and auditable path from request to shipped work

Do not reach for the full chain when:

- the task is a one-line fix with no ambiguity
- the work is obviously local and low-risk
- you do not need beads, coordination, or formal review gates

## Working Modes

Pulse keeps one core workflow but presents it in three user-facing modes:

- `small_change` — lightweight planning and validating for bounded low-risk work
- `standard_feature` — the default full Pulse workflow
- `high_risk_feature` — the full workflow plus deeper planning scrutiny and stronger spike discipline

The core contract does not change across modes:
- `CONTEXT.md` is still the source of truth
- `validating` still gates execution
- beads + `bv` + Agent Mail still drive coordination

---

## Lineage

Pulse is downstream of everal strong agentic-development systems and distills the parts that fit this repo owner's actual workflow:

- **[Khuym](https://github.com/hoangnb24/skills/tree/main)**, which provides most of the validate-first chain and Flywheel-style bead workflow
- **[Superpowers](https://github.com/obra/superpowers)**, which contributes the strongest behavioral discipline around brainstorming, verification, debugging, and skill design
- **[Flywheel](https://agent-flywheel.com/complete-guide)** contributes the operational backbone: beads, `bv`, Agent Mail, swarm execution, and the habit of turning plans into live work graphs instead of loose TODO lists.
- **[Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin)** contributes parallel review, severity-based findings, and the compound-learning loop that feeds future work.
- **[GSD](https://github.com/gsd-build/get-shit-done)** contributes the philosophy: discuss first, research second, plan third, and do not execute until the plan has been verified.

---

## The Delivery Chain

```mermaid
flowchart TD
    PF["`**pulse:preflight**
    validate tooling`"]
    UP["`**pulse:using-pulse**
    route the session`"]
    BR["`**pulse:brainstorming**
    design spec *(optional)*`"]
    EX["`**pulse:exploring**
    lock decisions → CONTEXT.md`"]
    PL["`**pulse:planning**
    research + phase plan + beads`"]
    VA["`**pulse:validating**
    8-dim check + spikes`"]
    SW["`**pulse:swarming**
    launch N workers`"]
    WK["`**pulse:executing**
    implement bead-by-bead`"]
    RV["`**pulse:reviewing**
    4 specialists + UAT`"]
    CP["`**pulse:compounding**
    capture learnings`"]

    PF --> UP
    UP -->|idea unclear| BR
    UP -->|intent clear| EX
    BR --> EX

    EX -->|"🔒 GATE 1 — approve CONTEXT.md"| PL
    PL -->|"🔒 GATE 2 — approve phase plan"| VA
    VA -->|"🔒 GATE 3 — approve execution (swarm)"| SW
    VA -->|"🔒 GATE 3 — approve execution (single)"| WK
    SW -->|spawns| WK
    WK -->|more phases| PL
    WK -->|final phase| RV
    SW -->|final phase| RV
    RV -->|"🔒 GATE 4 — approve merge"| CP

    style BR stroke-dasharray:5 5
    style SW fill:#fef3c7
    style WK fill:#fef3c7
```

### The 4 Human Gates

Every gate is a hard stop. Nothing proceeds without explicit approval.

| | Gate | Blocks what |
|---|---|---|
| 🔒 **Gate 1** | After exploring | Planning starts |
| 🔒 **Gate 2** | After phase plan | Beads are created |
| 🔒 **Gate 3** | After validating | Code is written |
| 🔒 **Gate 4** | After reviewing | Feature merges (P1 findings block this) |

---

## Skill Catalog

### Core Chain

| Skill | Role |
|-------|------|
| `pulse:preflight` | Checks `git`, `br`, `bv`, and coordination runtime; writes `.pulse/tooling-status.json`; chooses `swarm / single-worker / planning-only / blocked` |
| `pulse:using-pulse` | Session router; manages go-mode, small_change/standard_feature/high_risk_feature mode selection, micro mode, resume from handoffs, and repo-local Pulse status scouting |
| `pulse:brainstorming` | Turns vague intent into an approved design spec via one-question-at-a-time dialogue |
| `pulse:exploring` | Socratic decision extraction into `history/<feature>/CONTEXT.md`; assigns stable D1, D2... IDs |
| `pulse:planning` | Codebase research → `approach.md` + `phase-plan.md` → bead decomposition |
| `pulse:validating` | 8-dimension plan-checker, spike execution for HIGH-risk items, bead schema gate |
| `pulse:swarming` | Coordinator-only orchestration for parallel workers via Agent Mail |
| `pulse:executing` | Per-bead worker loop: claim → implement → verify → commit → close |
| `pulse:reviewing` | 4 parallel specialist reviewers + learnings synthesizer + artifact verification + UAT |
| `pulse:compounding` | Captures durable learnings into `history/learnings/` with propagation triage |

### Support Skills

| Skill | Role |
|-------|------|
| `pulse:debugging` | Root-cause blocked work; architecture suspicion gate escalates unfixable issues back to planning |
| `pulse:systematic-debug-fix` | Multi-bug tracker discipline: investigate before fixing, verify each fix, regression tests for all |
| `pulse:gkg` | Codebase intelligence via `gkg` tool or `rg` fallback; saves findings to `discovery.md` |
| `pulse:dream` | Consolidates Codex history into durable Pulse learnings with provenance tracking |
| `pulse:ai-multimodal` | Gemini-powered image/audio/video/document processing with bundled scripts |
| `pulse:simplify-code` | 4-lens code review (reuse, quality, efficiency, clarity) with optional safe fixes |
| `pulse:prompt-leverage` | Upgrades raw prompts into structured execution-ready prompts |
| `pulse:writing-pulse-skills` | TDD workshop for creating and improving Pulse skills (RED → GREEN → REFACTOR) |
| `bootstrap-project-context` | Standalone repo-onboarding utility that forces a docs-first, source-grounded architecture pass before implementation |
| `refresh-project-docs` | Standalone docs-sync utility that rewrites README and related docs to match the current repo state in evergreen language |

---

## Key Concepts

### Beads
Work items with a strict schema. Planning creates them, executing closes them.

```
id, title, phase, story
files          ← exact list of files the worker may touch
verify         ← exact commands that must pass before close
verification_evidence ← path where evidence is written
testing_mode   ← standard | tdd-required
risk           ← LOW | MEDIUM | HIGH
dependencies   ← upstream bead IDs
learning_refs  ← relevant learning file paths
decision_refs  ← CONTEXT.md decision IDs (D1, D2...)
```

### Institutional Memory
Learnings flow upward through three propagation paths:

```
global-critical  →  history/learnings/critical-patterns.md  (all future planners read this)
bead-local       →  embedded in bead learning_refs           (workers read at implementation time)
planner-only     →  planning reference only
```

### Context Budget
Any long-running skill writes a handoff and stops at **65% context**. The next session resumes from `.pulse/handoffs/manifest.json` — no work is lost.

### Pipeline Modes

| Mode | When |
|------|------|
| **Full (`standard_feature`)** | Multi-phase feature, swarm available |
| **Single-worker** | Multi-phase feature, no swarm |
| **Small change (`small_change`)** | ≤3 files, no HIGH risk, no new API surface |
| **High risk (`high_risk_feature`)** | Cross-cutting or architecture-sensitive work |
| **Micro** | Single file, trivial — skips planning/validating/reviewing |
| **Planning-only** | No execution tools available |

---

## Artifact Map

```
.pulse/
  tooling-status.json        ← preflight output
  state.json                 ← machine-readable routing mirror
  STATE.md                   ← shared state
  handoffs/manifest.json     ← resume index
  handoffs/<owner>.json      ← per-actor checkpoints
  verification/<feature>/    ← per-bead execution evidence
  debug-notes/               ← debugging notes → compounding
  dream-pending/             ← ambiguous learnings awaiting approval

history/<feature>/
  CONTEXT.md                 ← locked decisions (source of truth)
  discovery.md               ← codebase research
  approach.md                ← synthesis + risk map
  phase-plan.md              ← whole-feature phase breakdown
  phase-<n>-contract.md      ← phase entry/exit/demo/pivots
  phase-<n>-story-map.md     ← stories → beads mapping

history/learnings/
  critical-patterns.md       ← globally promoted patterns
  YYYYMMDD-<slug>.md         ← individual learning entries

.beads/                      ← bead files (br managed)
.spikes/                     ← spike execution results
```

---

## Requirements

| Tool | Required | Purpose |
|------|----------|---------|
| `git` | Yes | Version control |
| `br` | Yes | Beads CLI — create, update, close, sync work items |
| `bv` | Yes | Beads viewer — TUI + `bv --robot-priority` for worker bead selection |
| Node.js 18+ | Yes | Pulse onboarding script |
| Agent Mail | Swarm only | Worker coordination runtime |
| `gkg` | Optional | Faster codebase intelligence |

Run `pulse:preflight` to check your environment before starting.

---

## Installation

### Claude Code

```bash
# Add the marketplace
/plugin marketplace add quanpersie2001/pulse

# Install all skills at once
/plugin install pulse@pulse
```

Or install individual skills:

```bash
/plugin install pulse:preflight@pulse
/plugin install pulse:using-pulse@pulse
/plugin install pulse:exploring@pulse
# ... etc
```

### Codex

1. Clone this repo
2. Register `.agents/plugins/marketplace.json` as a local marketplace in Codex
3. Install the `pulse` plugin — all 20 skills are discovered automatically

---

## Session Scout

On onboarded repos, Pulse installs a read-only scout command:

```bash
node .codex/pulse_status.mjs --json
```

It summarizes onboarding health plus `.pulse/state.json`, `.pulse/STATE.md`, and `.pulse/handoffs/manifest.json` so humans and agents can orient quickly before opening deeper artifacts.

---

## Getting Started

```bash
# 1. Check your environment
pulse:preflight

# 2. Start a session
pulse:using-pulse

# 3. Describe what you want to build — Pulse routes you from there
```

For a full walkthrough, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/examples/golden-path.md`](docs/examples/golden-path.md).

---

## Documentation Checks

When you change public docs in this repo, keep links repository-relative and environment-agnostic:

```bash
bash scripts/check-markdown-links.sh
bash scripts/sync-skills.sh --dry-run
```

---

## Contributing

See [`plugins/pulse/CONTRIBUTING.md`](plugins/pulse/CONTRIBUTING.md) for skill structure, TDD discipline, naming conventions, versioning, and the PR process.

```bash
# Bump version before opening a PR
./scripts/bump-version.sh minor   # new skill or behavior change
./scripts/bump-version.sh patch   # doc fix or wording
```

---

<div align="center">

MIT License

</div>
