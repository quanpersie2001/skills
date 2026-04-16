#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { applyRepo, checkRepo, getNodeRuntimeStatus } from "./onboard_pulse.mjs";
import { buildPulseDependencyReport } from "./pulse_dependencies.mjs";
import { syncPulseRuntimeArtifacts } from "./pulse_state.mjs";

const LOCAL_USING_PULSE_SKILL_PATH = fileURLToPath(new URL("../SKILL.md", import.meta.url));
const LOCAL_REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

test("applyRepo creates full repo onboarding with node-based hooks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    const result = applyRepo(root, false);

    assert.equal(result.result.status, "complete");
    assert.equal(result.status, "up_to_date");
    assert.equal(result.details.runtime.supported, true);
    assert.ok(fs.existsSync(path.join(root, "AGENTS.md")));
    assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /Pulse Workflow/);
    assert.ok(fs.existsSync(path.join(root, ".codex", "config.toml")));
    assert.ok(fs.existsSync(path.join(root, ".codex", "hooks.json")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "onboarding.json")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "state.json")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "current-feature.json")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "runtime-snapshot.json")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "checkpoints")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "memory", "learnings")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "memory", "corrections")));
    assert.ok(fs.existsSync(path.join(root, ".pulse", "memory", "ratchet")));
    assert.ok(fs.existsSync(path.join(root, ".codex", "hooks", "pulse_session_start.mjs")));
    assert.ok(fs.existsSync(path.join(root, ".codex", "pulse_state.mjs")));
    assert.ok(fs.existsSync(path.join(root, ".codex", "pulse_status.mjs")));
    assert.match(
      fs.readFileSync(path.join(root, ".codex", "hooks.json"), "utf8"),
      /node \.codex\/hooks\/pulse_session_start\.mjs/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("applyRepo appends managed block to existing agents instructions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    fs.writeFileSync(path.join(root, "AGENTS.md"), "# Existing instructions\n", "utf8");

    applyRepo(root, false);
    const agentsText = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");

    assert.match(agentsText, /# Existing instructions/);
    assert.match(agentsText, /<!-- PULSE:START -->/);
    assert.equal((agentsText.match(/<!-- PULSE:START -->/g) || []).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("applyRepo preserves an existing compact_prompt without explicit replace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    const codexDir = path.join(root, ".codex");
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(path.join(codexDir, "config.toml"), 'compact_prompt = """keep me"""\n', "utf8");

    const result = applyRepo(root, false);
    const configText = fs.readFileSync(path.join(codexDir, "config.toml"), "utf8");

    assert.match(configText, /compact_prompt = """keep me"""/);
    assert.equal(result.result.status, "partial");
    assert.match(JSON.stringify(result.result), /compact_prompt/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checkRepo flags stale python hook commands and legacy hook files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    const hooksDir = path.join(root, ".codex", "hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(
      path.join(root, ".codex", "hooks.json"),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: "startup|resume",
                hooks: [
                  {
                    type: "command",
                    command:
                      'python3 "$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.codex/hooks/pulse_session_start.py"',
                    statusMessage: "Pulse: session bootstrap",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(path.join(hooksDir, "pulse_session_start.py"), "# legacy\n", "utf8");

    const result = checkRepo(root);

    assert.equal(result.status, "needs_onboarding");
    assert.ok(result.actions.includes("install_pulse_hook_entries"));
    assert.ok(result.actions.includes("sync_pulse_hook_scripts"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("pulse status scout renders json for an onboarded repo", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);

    const stdout = execFileSync("node", [path.join(root, ".codex", "pulse_status.mjs"), "--json"], {
      cwd: root,
      encoding: "utf8",
    });

    const payload = JSON.parse(stdout);
    const normalizedRoot = fs.realpathSync.native(root);
    const normalizedPayloadRoot = fs.realpathSync.native(payload.repo_root);
    assert.equal(normalizedPayloadRoot, normalizedRoot);
    assert.equal(payload.state_json.exists, true);
    assert.equal(payload.current_feature.exists, true);
    assert.equal(payload.current_feature.feature_key, "");
    assert.equal(payload.current_feature.phase, "idle");
    assert.equal(payload.current_feature.status, "idle");
    assert.equal(payload.runtime_snapshot.exists, true);
    assert.equal(payload.runtime_snapshot.active_feature, "");
    assert.equal(payload.runtime_snapshot.phase, "idle");
    assert.equal(payload.runtime_snapshot.active_skill, "pulse:using-pulse");
    assert.equal(fs.existsSync(path.join(root, ".pulse", "checkpoints")), true);
    assert.equal(fs.existsSync(path.join(root, ".pulse", "memory", "learnings")), true);
    assert.equal(fs.existsSync(path.join(root, ".pulse", "memory", "corrections")), true);
    assert.equal(fs.existsSync(path.join(root, ".pulse", "memory", "ratchet")), true);
    assert.equal(payload.checkpoints.root_exists, true);
    assert.equal(payload.checkpoints.count, 0);
    assert.equal(payload.memory_recall.root_exists, true);
    assert.equal(payload.memory_recall.critical_patterns, "");
    assert.equal(payload.handoff_manifest.active_count, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("syncPulseRuntimeArtifacts initializes and refreshes persisted control-plane mirrors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    fs.writeFileSync(
      path.join(root, ".pulse", "state.json"),
      `${JSON.stringify({
        active_feature: "sync-feature",
        active_skill: "pulse:planning",
        phase: "planning",
        requested_mode: "swarm",
        recommended_mode: "single-worker",
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "STATE.md"),
      "Focus: markdown-feature\nPhase: execution\nGate: GATE 3\n",
      "utf8",
    );

    const synced = syncPulseRuntimeArtifacts(root);
    const currentFeature = JSON.parse(
      fs.readFileSync(path.join(root, ".pulse", "current-feature.json"), "utf8"),
    );
    const runtimeSnapshot = JSON.parse(
      fs.readFileSync(path.join(root, ".pulse", "runtime-snapshot.json"), "utf8"),
    );

    assert.equal(synced.current_feature.feature_key, "sync-feature");
    assert.equal(currentFeature.feature_key, "sync-feature");
    assert.equal(currentFeature.phase, "planning");
    assert.equal(currentFeature.gate, "GATE 3");
    assert.equal(currentFeature.status, "active");
    assert.equal(runtimeSnapshot.active_feature, "sync-feature");
    assert.equal(runtimeSnapshot.active_skill, "pulse:planning");
    assert.equal(runtimeSnapshot.phase, "planning");
    assert.equal(runtimeSnapshot.requested_mode, "swarm");
    assert.equal(runtimeSnapshot.recommended_mode, "single-worker");
    assert.equal(runtimeSnapshot.source.current_feature, ".pulse/current-feature.json");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("syncPulseRuntimeArtifacts treats '(none)' feature placeholders as empty pointers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    fs.writeFileSync(
      path.join(root, ".pulse", "STATE.md"),
      "Focus: (none)\nPhase: preflight\n",
      "utf8",
    );

    const synced = syncPulseRuntimeArtifacts(root);
    const currentFeature = JSON.parse(
      fs.readFileSync(path.join(root, ".pulse", "current-feature.json"), "utf8"),
    );
    const runtimeSnapshot = JSON.parse(
      fs.readFileSync(path.join(root, ".pulse", "runtime-snapshot.json"), "utf8"),
    );

    assert.equal(synced.current_feature.feature_key, "");
    assert.equal(synced.current_feature.status, "idle");
    assert.equal(currentFeature.feature_key, "");
    assert.equal(currentFeature.status, "idle");
    assert.equal(runtimeSnapshot.active_feature, "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("pulse status scout surfaces current-feature, runtime snapshot, canonical handoff summaries, and targeted recall guidance", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);

    fs.writeFileSync(
      path.join(root, ".pulse", "current-feature.json"),
      `${JSON.stringify({
        feature_key: "operator-surface-foundation",
        phase: "planning",
        gate: "GATE 2",
        status: "active",
        updated_at: "2026-04-16T10:00:00.000Z",
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "runtime-snapshot.json"),
      `${JSON.stringify({
        schema_version: "1.0",
        active_feature: "snapshot-feature",
        active_skill: "pulse:planning",
        phase: "validating",
        requested_mode: "swarm",
        recommended_mode: "swarm",
        updated_at: "2026-04-16T10:05:00.000Z",
        source: {
          state_json: ".pulse/state.json",
          state_markdown: ".pulse/STATE.md",
          current_feature: ".pulse/current-feature.json",
        },
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "critical-patterns.md"),
      `${"# Critical patterns\n"}${"A".repeat(25000)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "learnings", "20260401-operator-surface-foundation.md"),
      "learning\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "learnings", "20260301-operator-surface-foundation.md"),
      "older learning\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "corrections", "20260402-planning-gate.md"),
      "correction\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "corrections", "20260302-planning-gate.md"),
      "older correction\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "ratchet", "20260403-planning-ratchet.md"),
      "ratchet\n",
      "utf8",
    );
    fs.mkdirSync(path.join(root, ".pulse", "checkpoints", "operator-surface-foundation"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, ".pulse", "checkpoints", "operator-surface-foundation", "manifest.json"),
      `${JSON.stringify({
        schema_version: "1.0",
        updated_at: "2026-04-16T10:07:00.000Z",
        checkpoints: [
          {
            checkpoint_id: "2026-04-16T10-07-00Z-planning",
            path: "2026-04-16T10-07-00Z-planning.json",
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "checkpoints", "operator-surface-foundation", "2026-04-16T10-07-00Z-planning.json"),
      `${JSON.stringify({
        schema_version: "1.0",
        checkpoint_id: "2026-04-16T10-07-00Z-planning",
        feature: "operator-surface-foundation",
        created_at: "2026-04-16T10:07:00.000Z",
        summary: "Planning is complete and validating is next",
        next_action: "Run pulse:validating for the current phase",
        captured: {
          phase: "planning/phase-4",
          gate: "GATE 2",
          mode: "standard_feature",
          story: "Story 2",
          bead: "BEAD-014",
        },
        links: {
          context: "history/operator-surface-foundation/CONTEXT.md",
          handoff: ".pulse/handoffs/planning.json",
          runtime_snapshot: ".pulse/runtime-snapshot.json",
          verification: ".pulse/runs/operator-surface-foundation/verification/",
        },
        blockers: ["Awaiting validation approval"],
        memory_hooks: {
          critical_patterns: ".pulse/memory/critical-patterns.md",
          learnings: [".pulse/memory/learnings/operator-surface-foundation.md"],
          corrections: [".pulse/memory/corrections/planning-gate.md"],
          ratchet: [".pulse/memory/ratchet/planning-ratchet.md"],
        },
      }, null, 2)}\n`,
      "utf8",
    );
    fs.mkdirSync(path.join(root, ".pulse", "handoffs"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".pulse", "handoffs", "manifest.json"),
      `${JSON.stringify({
        schema_version: "1.0",
        updated_at: "2026-04-16T10:06:00.000Z",
        active: [
          {
            owner_id: "planning",
            owner_type: "phase",
            skill: "pulse:planning",
            feature: "operator-surface-foundation",
            path: ".pulse/handoffs/planning.json",
            phase: "planning/phase-4",
            next_action: "Create remaining task beads",
            summary: "Discovery and approach are complete",
          },
          {
            owner_id: "worker-blue-lake",
            owner_type: "worker",
            skill: "pulse:executing",
            feature: "operator-surface-foundation",
            path: ".pulse/handoffs/worker-blue-lake.json",
            phase: "execution/phase-4",
            next_action: "Resume bead implementation",
            summary: "Verification is pending after the code change",
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    const jsonStdout = execFileSync(
      "node",
      [path.join(root, ".codex", "pulse_status.mjs"), "--json"],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    const textStdout = execFileSync("node", [path.join(root, ".codex", "pulse_status.mjs")], {
      cwd: root,
      encoding: "utf8",
    });

    const payload = JSON.parse(jsonStdout);
    assert.equal(payload.feature, undefined);
    assert.equal(payload.current_feature.exists, true);
    assert.equal(payload.current_feature.feature_key, "operator-surface-foundation");
    assert.equal(payload.current_feature.phase, "planning");
    assert.equal(payload.current_feature.gate, "GATE 2");
    assert.equal(payload.runtime_snapshot.exists, true);
    assert.equal(payload.runtime_snapshot.active_feature, "snapshot-feature");
    assert.equal(payload.runtime_snapshot.source.current_feature, ".pulse/current-feature.json");
    assert.equal(payload.state_json.active_feature, "");
    assert.equal(payload.handoff_manifest.active_count, 2);
    assert.equal(payload.handoff_manifest.active.length, 2);
    assert.equal(payload.handoff_manifest.active[0].owner_id, "planning");
    assert.equal(
      payload.handoff_manifest.active[0].operator_summary,
      "planning | via pulse:planning | feature=operator-surface-foundation | phase=planning/phase-4 | next=Create remaining task beads | summary=Discovery and approach are complete | path=.pulse/handoffs/planning.json",
    );
    assert.equal(
      payload.handoff_manifest.active[1].operator_summary,
      "worker-blue-lake | via pulse:executing | feature=operator-surface-foundation | phase=execution/phase-4 | next=Resume bead implementation | summary=Verification is pending after the code change | path=.pulse/handoffs/worker-blue-lake.json",
    );
    assert.equal(payload.checkpoints.root_exists, true);
    assert.equal(payload.checkpoints.feature, "operator-surface-foundation");
    assert.equal(payload.checkpoints.count, 1);
    assert.equal(payload.checkpoints.latest.checkpoint_id, "2026-04-16T10-07-00Z-planning");
    assert.equal(
      payload.checkpoints.latest.operator_summary,
      "2026-04-16T10-07-00Z-planning | phase=planning/phase-4 | gate=GATE 2 | next=Run pulse:validating for the current phase | summary=Planning is complete and validating is next | path=.pulse/checkpoints/operator-surface-foundation/2026-04-16T10-07-00Z-planning.json",
    );
    assert.equal(payload.memory_recall.critical_patterns, ".pulse/memory/critical-patterns.md");
    assert.deepEqual(payload.memory_recall.learnings, [
      ".pulse/memory/learnings/20260301-operator-surface-foundation.md",
      ".pulse/memory/learnings/20260401-operator-surface-foundation.md",
    ]);
    assert.deepEqual(payload.memory_recall.corrections, [
      ".pulse/memory/corrections/20260302-planning-gate.md",
      ".pulse/memory/corrections/20260402-planning-gate.md",
    ]);
    assert.deepEqual(payload.memory_recall.ratchet, [
      ".pulse/memory/ratchet/20260403-planning-ratchet.md",
    ]);
    assert.deepEqual(payload.memory_recall.recall_pack, [
      {
        kind: "critical-patterns",
        path: ".pulse/memory/critical-patterns.md",
        reason: "global planning baseline",
      },
      {
        kind: "correction",
        path: ".pulse/memory/corrections/20260302-planning-gate.md",
        reason: "matched phase:planning",
      },
      {
        kind: "correction",
        path: ".pulse/memory/corrections/20260402-planning-gate.md",
        reason: "matched phase:planning",
      },
      {
        kind: "ratchet",
        path: ".pulse/memory/ratchet/20260403-planning-ratchet.md",
        reason: "matched phase:planning",
      },
      {
        kind: "learning",
        path: ".pulse/memory/learnings/20260301-operator-surface-foundation.md",
        reason: "matched feature:operator, feature:surface, feature:foundation",
      },
      {
        kind: "learning",
        path: ".pulse/memory/learnings/20260401-operator-surface-foundation.md",
        reason: "matched feature:operator, feature:surface, feature:foundation",
      },
    ]);
    assert.ok(payload.memory_recall.hygiene.warnings.includes(
      "critical-patterns.md is getting large; review for compact, globally useful guidance only.",
    ));
    assert.ok(payload.memory_recall.hygiene.warnings.includes(
      "Possible duplicate learnings: operator-surface-foundation.",
    ));
    assert.ok(payload.memory_recall.hygiene.warnings.includes(
      "Possible duplicate corrections: planning-gate.",
    ));
    assert.ok(payload.next_reads.includes(".pulse/handoffs/manifest.json"));
    assert.ok(payload.next_reads.includes(".pulse/handoffs/planning.json"));
    assert.ok(payload.next_reads.includes("history/operator-surface-foundation/CONTEXT.md"));
    assert.ok(
      payload.next_reads.includes(
        ".pulse/checkpoints/operator-surface-foundation/2026-04-16T10-07-00Z-planning.json",
      ),
    );
    assert.ok(payload.next_reads.includes(".pulse/memory/critical-patterns.md"));
    assert.ok(payload.next_reads.includes(".pulse/memory/corrections/20260302-planning-gate.md"));
    assert.ok(payload.recommended_actions.some((item) => item.includes("targeted recall pack")));
    assert.ok(payload.recommended_actions.some((item) => item.includes("Memory hygiene warning")));
    assert.match(textStdout, /Feature: operator-surface-foundation/);
    assert.match(textStdout, /Operator surface:/);
    assert.match(textStdout, /Current feature snapshot: present/);
    assert.match(textStdout, /Runtime snapshot: present/);
    assert.match(textStdout, /active_feature: snapshot-feature/);
    assert.match(textStdout, /Checkpoint root: present/);
    assert.match(textStdout, /checkpoint_count: 1/);
    assert.match(textStdout, /Memory recall root: present/);
    assert.match(textStdout, /critical_patterns: \.pulse\/memory\/critical-patterns\.md/);
    assert.match(textStdout, /recall_pack:/);
    assert.match(textStdout, /critical-patterns: \.pulse\/memory\/critical-patterns\.md \(global planning baseline\)/);
    assert.match(textStdout, /hygiene_warnings:/);
    assert.match(textStdout, /Possible duplicate learnings: operator-surface-foundation\./);
    assert.match(textStdout, /Active handoffs: 2/);
    assert.match(
      textStdout,
      /planning \| via pulse:planning \| feature=operator-surface-foundation \| phase=planning\/phase-4 \| next=Create remaining task beads \| summary=Discovery and approach are complete \| path=.pulse\/handoffs\/planning.json/,
    );
    assert.match(
      textStdout,
      /2026-04-16T10-07-00Z-planning \| phase=planning\/phase-4 \| gate=GATE 2 \| next=Run pulse:validating for the current phase \| summary=Planning is complete and validating is next \| path=.pulse\/checkpoints\/operator-surface-foundation\/2026-04-16T10-07-00Z-planning.json/,
    );
    assert.match(
      textStdout,
      /worker-blue-lake \| via pulse:executing \| feature=operator-surface-foundation \| phase=execution\/phase-4 \| next=Resume bead implementation \| summary=Verification is pending after the code change \| path=.pulse\/handoffs\/worker-blue-lake.json/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint commands save, list, show, diff, and resume-brief through installed pulse_status", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    fs.mkdirSync(path.join(root, "history", "checkpoint-ops"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "history", "checkpoint-ops", "CONTEXT.md"),
      "# Context\n",
      "utf8",
    );
    fs.mkdirSync(path.join(root, ".pulse", "runs", "checkpoint-ops", "verification"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".pulse", "current-feature.json"),
      `${JSON.stringify({
        feature_key: "checkpoint-ops",
        phase: "validating",
        gate: "GATE 3",
        status: "active",
        updated_at: "2026-04-16T11:00:00.000Z",
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "runtime-snapshot.json"),
      `${JSON.stringify({
        schema_version: "1.0",
        active_feature: "checkpoint-ops",
        active_skill: "pulse:validating",
        phase: "validating",
        requested_mode: "swarm",
        recommended_mode: "swarm",
        updated_at: "2026-04-16T11:00:00.000Z",
      }, null, 2)}\n`,
      "utf8",
    );
    fs.mkdirSync(path.join(root, ".pulse", "handoffs"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".pulse", "handoffs", "manifest.json"),
      `${JSON.stringify({
        schema_version: "1.0",
        updated_at: "2026-04-16T11:01:00.000Z",
        active: [
          {
            owner_id: "planning",
            owner_type: "phase",
            skill: "pulse:planning",
            feature: "checkpoint-ops",
            path: ".pulse/handoffs/planning.json",
            phase: "planning/phase-5",
            next_action: "Review the current phase contract",
            summary: "Planning is complete and validation is queued",
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "critical-patterns.md"),
      "# Critical patterns\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "memory", "learnings", "checkpoint-ops.md"),
      "learning\n",
      "utf8",
    );

    const saveOne = JSON.parse(
      execFileSync(
        "node",
        [
          path.join(root, ".codex", "pulse_status.mjs"),
          "checkpoint",
          "save",
          "--json",
          "--summary",
          "Validation approved and execution is next",
          "--next-action",
          "Open pulse:executing",
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );
    const saveTwo = JSON.parse(
      execFileSync(
        "node",
        [
          path.join(root, ".codex", "pulse_status.mjs"),
          "checkpoint",
          "save",
          "--json",
          "--summary",
          "Execution finished and review is next",
          "--next-action",
          "Open pulse:reviewing",
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );

    const listPayload = JSON.parse(
      execFileSync(
        "node",
        [path.join(root, ".codex", "pulse_status.mjs"), "checkpoint", "list", "--json"],
        { cwd: root, encoding: "utf8" },
      ),
    );
    const showPayload = JSON.parse(
      execFileSync(
        "node",
        [
          path.join(root, ".codex", "pulse_status.mjs"),
          "checkpoint",
          "show",
          "--json",
          "--checkpoint-id",
          saveOne.checkpoint.checkpoint_id,
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );
    const diffPayload = JSON.parse(
      execFileSync(
        "node",
        [
          path.join(root, ".codex", "pulse_status.mjs"),
          "checkpoint",
          "diff",
          "--json",
          "--from",
          saveOne.checkpoint.checkpoint_id,
          "--to",
          saveTwo.checkpoint.checkpoint_id,
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );
    const resumePayload = JSON.parse(
      execFileSync(
        "node",
        [
          path.join(root, ".codex", "pulse_status.mjs"),
          "checkpoint",
          "resume-brief",
          "--json",
          "--checkpoint-id",
          saveTwo.checkpoint.checkpoint_id,
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );

    assert.equal(saveOne.ok, true);
    assert.equal(saveOne.feature, "checkpoint-ops");
    assert.equal(saveOne.checkpoint.links.context, "history/checkpoint-ops/CONTEXT.md");
    assert.equal(saveOne.checkpoint.links.handoff, ".pulse/handoffs/planning.json");
    assert.equal(saveOne.checkpoint.links.runtime_snapshot, ".pulse/runtime-snapshot.json");
    assert.equal(saveOne.checkpoint.links.verification, ".pulse/runs/checkpoint-ops/verification/");
    assert.equal(saveOne.checkpoint.memory_hooks.critical_patterns, ".pulse/memory/critical-patterns.md");
    assert.deepEqual(saveOne.checkpoint.memory_hooks.learnings, [".pulse/memory/learnings/checkpoint-ops.md"]);
    assert.equal(saveTwo.ok, true);
    assert.equal(listPayload.ok, true);
    assert.equal(listPayload.checkpoints.count, 2);
    assert.equal(listPayload.checkpoints.latest.checkpoint_id, saveTwo.checkpoint.checkpoint_id);
    assert.equal(showPayload.ok, true);
    assert.equal(showPayload.checkpoint.checkpoint_id, saveOne.checkpoint.checkpoint_id);
    assert.equal(diffPayload.ok, true);
    assert.equal(diffPayload.diff.fields.summary.changed, true);
    assert.equal(diffPayload.diff.fields.next_action.changed, true);
    assert.equal(resumePayload.ok, true);
    assert.equal(resumePayload.resume_brief.checkpoint.checkpoint_id, saveTwo.checkpoint.checkpoint_id);
    assert.ok(resumePayload.resume_brief.next_reads.includes(saveTwo.checkpoint.path));
    assert.equal(
      resumePayload.resume_brief.note,
      "Checkpoints are advisory snapshots. Current handoffs and state files remain authoritative.",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint commands prefer active verification paths but fall back to legacy verification paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    fs.mkdirSync(path.join(root, "history", "legacy-verification"), { recursive: true });
    fs.writeFileSync(path.join(root, "history", "legacy-verification", "CONTEXT.md"), "# Context\n", "utf8");
    fs.mkdirSync(path.join(root, ".pulse", "verification", "legacy-verification"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".pulse", "current-feature.json"),
      `${JSON.stringify({
        feature_key: "legacy-verification",
        phase: "reviewing",
        gate: "GATE 4",
        status: "active",
        updated_at: "2026-04-16T12:00:00.000Z",
      }, null, 2)}\n`,
      "utf8",
    );

    const savePayload = JSON.parse(
      execFileSync(
        "node",
        [path.join(root, ".codex", "pulse_status.mjs"), "checkpoint", "save", "--json"],
        { cwd: root, encoding: "utf8" },
      ),
    );

    assert.equal(savePayload.ok, true);
    assert.equal(savePayload.checkpoint.links.verification, ".pulse/verification/legacy-verification/");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint commands fail soft for malformed entries, missing selectors, and invalid save inputs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    fs.mkdirSync(path.join(root, ".pulse", "checkpoints", "soft-fail-feature"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".pulse", "current-feature.json"),
      `${JSON.stringify({
        feature_key: "soft-fail-feature",
        phase: "planning",
        gate: "GATE 2",
        status: "active",
        updated_at: "2026-04-16T12:00:00.000Z",
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "checkpoints", "soft-fail-feature", "manifest.json"),
      `${JSON.stringify({
        schema_version: "1.0",
        updated_at: "2026-04-16T12:00:00.000Z",
        checkpoints: [
          { checkpoint_id: "broken", path: "broken.json" },
        ],
      }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, ".pulse", "checkpoints", "soft-fail-feature", "broken.json"),
      "{not-json}\n",
      "utf8",
    );

    const listPayload = JSON.parse(
      execFileSync(
        "node",
        [path.join(root, ".codex", "pulse_status.mjs"), "checkpoint", "list", "--json"],
        { cwd: root, encoding: "utf8" },
      ),
    );

    let showExitCode = 0;
    let showStdout = "";
    try {
      showStdout = execFileSync(
        "node",
        [
          path.join(root, ".codex", "pulse_status.mjs"),
          "checkpoint",
          "show",
          "--json",
          "--checkpoint-id",
          "missing-entry",
        ],
        { cwd: root, encoding: "utf8" },
      );
    } catch (error) {
      showExitCode = error.status;
      showStdout = error.stdout;
    }

    let invalidSaveExitCode = 0;
    let invalidSaveStdout = "";
    try {
      invalidSaveStdout = execFileSync(
        "node",
        [
          path.join(root, ".codex", "pulse_status.mjs"),
          "checkpoint",
          "save",
          "--json",
          "--feature",
          "../escape-feature",
          "--checkpoint-id",
          "../outside",
        ],
        { cwd: root, encoding: "utf8" },
      );
    } catch (error) {
      invalidSaveExitCode = error.status;
      invalidSaveStdout = error.stdout;
    }
    const invalidSave = JSON.parse(invalidSaveStdout);

    const missingFeatureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));
    let missingFeatureSaveExitCode = 0;
    let missingFeatureSaveStdout = "";
    try {
      applyRepo(missingFeatureRoot, false);
      try {
        missingFeatureSaveStdout = execFileSync(
          "node",
          [path.join(missingFeatureRoot, ".codex", "pulse_status.mjs"), "checkpoint", "save", "--json"],
          { cwd: missingFeatureRoot, encoding: "utf8" },
        );
      } catch (error) {
        missingFeatureSaveExitCode = error.status;
        missingFeatureSaveStdout = error.stdout;
      }
    } finally {
      fs.rmSync(missingFeatureRoot, { recursive: true, force: true });
    }
    const missingFeatureSave = JSON.parse(missingFeatureSaveStdout);

    assert.equal(listPayload.ok, true);
    assert.equal(listPayload.checkpoints.count, 0);
    assert.equal(showExitCode, 1);
    assert.equal(JSON.parse(showStdout).ok, false);
    assert.equal(JSON.parse(showStdout).error, "Checkpoint not found.");
    assert.equal(invalidSaveExitCode, 1);
    assert.equal(invalidSave.ok, false);
    assert.equal(invalidSave.error, "feature must not contain path traversal segments.");
    assert.equal(fs.existsSync(path.join(root, ".pulse", "outside.json")), false);
    assert.equal(fs.existsSync(path.join(root, ".pulse", "escape-feature")), false);
    assert.equal(missingFeatureSaveExitCode, 1);
    assert.equal(missingFeatureSave.ok, false);
    assert.equal(missingFeatureSave.error, "Cannot save checkpoint without an active feature.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("getNodeRuntimeStatus enforces the minimum supported major version", () => {
  assert.equal(getNodeRuntimeStatus("18.0.0").supported, true);
  assert.equal(getNodeRuntimeStatus("17.9.1").supported, false);
});

test("dependency report distinguishes dependency-free packaged skills from uncovered ones", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-coverage-"));
  const skillsRoot = path.join(root, "plugins", "pulse", "skills");

  try {
    const alphaDir = path.join(skillsRoot, "alpha");
    const betaDir = path.join(skillsRoot, "beta");
    fs.mkdirSync(alphaDir, { recursive: true });
    fs.mkdirSync(betaDir, { recursive: true });

    fs.writeFileSync(
      path.join(alphaDir, "SKILL.md"),
      [
        "---",
        "name: alpha",
        "metadata:",
        "  dependencies: []",
        "---",
        "",
        "# alpha",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(betaDir, "SKILL.md"),
      [
        "---",
        "name: beta",
        "description: uncovered fixture",
        "---",
        "",
        "# beta",
        "",
      ].join("\n"),
      "utf8",
    );

    const report = buildPulseDependencyReport({
      repoRoot: root,
      skillsRoot,
      globalCodexConfigPath: path.join(root, "missing-global.toml"),
      commandProbe: () => ({ available: true, detail: "unused in coverage test" }),
    });

    assert.equal(report.summary.skills_total, 2);
    assert.equal(report.summary.skills_covered, 1);
    assert.equal(report.summary.skills_dependency_free, 1);
    assert.equal(report.summary.skills_uncovered, 1);
    assert.equal(report.summary.skills_available, 1);
    assert.equal(report.summary.declared_dependencies, 0);
    assert.deepEqual(report.uncovered_skills.map((skill) => skill.skill_name), ["beta"]);

    const alpha = report.skills.find((skill) => skill.skill_name === "alpha");
    const beta = report.skills.find((skill) => skill.skill_name === "beta");
    assert.equal(alpha?.coverage_status, "dependency_free");
    assert.equal(alpha?.status, "available");
    assert.equal(beta?.coverage_status, "uncovered");
    assert.equal(beta?.status, "uncovered");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("dependency helper marks missing command and missing mcp_server dependencies", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-deps-"));
  const skillsRoot = path.join(root, "plugins", "pulse", "skills");

  try {
    const alphaDir = path.join(skillsRoot, "alpha");
    fs.mkdirSync(alphaDir, { recursive: true });
    fs.writeFileSync(
      path.join(alphaDir, "SKILL.md"),
      [
        "---",
        "name: alpha",
        "metadata:",
        "  dependencies:",
        "    - id: must-have-command",
        "      kind: command",
        "      command: definitely-missing-command",
        "      missing_effect: unavailable",
        "      reason: required",
        "    - id: am-server",
        "      kind: mcp_server",
        "      server_names: [mcp_agent_mail]",
        "      config_sources: [repo_codex_config, global_codex_config]",
        "      missing_effect: degraded",
        "      reason: coordination",
        "---",
        "",
        "# alpha",
        "",
      ].join("\n"),
      "utf8",
    );

    const report = buildPulseDependencyReport({
      repoRoot: root,
      skillsRoot,
      globalCodexConfigPath: path.join(root, "missing-global.toml"),
      commandProbe: () => ({ available: false, detail: "missing in test" }),
    });

    assert.equal(report.summary.skills_total, 1);
    assert.equal(report.summary.skills_available, 0);
    assert.equal(report.summary.skills_unavailable, 1);
    assert.equal(report.summary.missing_dependencies, 2);
    assert.equal(report.skills[0].status, "unavailable");
    assert.deepEqual(
      report.skills[0].missing_dependencies.map((dependency) => dependency.id).sort(),
      ["am-server", "must-have-command"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checkRepo reports dependency health summary without blocking onboarding status", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    const payload = checkRepo(root);

    assert.equal(payload.status, "up_to_date");
    assert.ok(payload.details.dependency_health);
    assert.ok(typeof payload.details.dependency_health.summary.skills_total === "number");
    assert.ok(typeof payload.details.dependency_health.summary.skills_uncovered === "number");
    assert.ok(Array.isArray(payload.details.dependency_health.skills));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checkRepo promotes missing dependency data into an operator-facing warning summary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    const skillsRoot = path.join(root, "plugins", "pulse", "skills");
    const alphaDir = path.join(skillsRoot, "alpha");
    fs.mkdirSync(alphaDir, { recursive: true });
    fs.writeFileSync(
      path.join(alphaDir, "SKILL.md"),
      [
        "---",
        "name: alpha",
        "metadata:",
        "  dependencies:",
        "    - id: missing-cli",
        "      kind: command",
        "      command: definitely-missing-command",
        "      missing_effect: unavailable",
        "      reason: required for test",
        "    - id: missing-server",
        "      kind: mcp_server",
        "      server_names: [definitely_missing_mcp_server_name]",
        "      config_sources: [repo_codex_config, global_codex_config]",
        "      missing_effect: degraded",
        "      reason: required for test",
        "---",
        "",
        "# alpha",
        "",
      ].join("\n"),
      "utf8",
    );

    const payload = checkRepo(root);
    const warning = payload.details.dependency_warning;

    assert.equal(warning.status, "warning");
    assert.equal(warning.missing_dependencies_count, 2);
    assert.deepEqual(warning.affected_skills, ["alpha"]);
    assert.match(warning.message, /Dependency warning:/);
    assert.match(warning.message, /alpha/);
    assert.match(warning.message, /Missing commands: definitely-missing-command/);
    assert.match(
      warning.message,
      /Missing MCP server configuration: definitely_missing_mcp_server_name/,
    );
    assert.equal(warning.missing_commands.length, 1);
    assert.equal(warning.missing_commands[0].command, "definitely-missing-command");
    assert.equal(warning.missing_mcp_servers.length, 1);
    assert.deepEqual(warning.missing_mcp_servers[0].servers, ["definitely_missing_mcp_server_name"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("installed pulse_status text distinguishes missing commands from missing MCP config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-onboard-"));

  try {
    applyRepo(root, false);
    const skillsRoot = path.join(root, "plugins", "pulse", "skills");
    const alphaDir = path.join(skillsRoot, "alpha");
    fs.mkdirSync(alphaDir, { recursive: true });
    fs.writeFileSync(
      path.join(alphaDir, "SKILL.md"),
      [
        "---",
        "name: alpha",
        "metadata:",
        "  dependencies:",
        "    - id: missing-cli",
        "      kind: command",
        "      command: definitely-missing-command",
        "      missing_effect: unavailable",
        "      reason: required for test",
        "    - id: missing-server",
        "      kind: mcp_server",
        "      server_names: [definitely_missing_mcp_server_name]",
        "      config_sources: [repo_codex_config, global_codex_config]",
        "      missing_effect: degraded",
        "      reason: required for test",
        "---",
        "",
        "# alpha",
        "",
      ].join("\n"),
      "utf8",
    );

    const stdout = execFileSync("node", [path.join(root, ".codex", "pulse_status.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    assert.match(stdout, /Missing commands:/);
    assert.match(stdout, /Missing MCP server configuration:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("packaged Pulse inventory has full dependency coverage", () => {
  const report = buildPulseDependencyReport({ repoRoot: LOCAL_REPO_ROOT });
  const skillText = fs.readFileSync(LOCAL_USING_PULSE_SKILL_PATH, "utf8");
  const pluginMcp = JSON.parse(
    fs.readFileSync(
      path.join(LOCAL_REPO_ROOT, "plugins", "pulse", ".mcp.json"),
      "utf8",
    ),
  );

  assert.equal(report.summary.skills_total, report.summary.skills_covered);
  assert.equal(report.summary.skills_uncovered, 0);
  assert.deepEqual(report.uncovered_skills, []);

  assert.match(skillText, /## Dependency Declaration Contract/);
  assert.match(skillText, /kind: command/);
  assert.match(skillText, /kind: mcp_server/);
  assert.match(skillText, /metadata\.dependencies: \[\]/);
  assert.match(skillText, /bash scripts\/sync-skills\.sh --dry-run/);
  assert.equal(pluginMcp.gkg.type, "sse");
  assert.equal(pluginMcp.gkg.url, "http://localhost:27495/mcp/sse");
  assert.deepEqual(pluginMcp.gkg.includeTools, [
    "list_projects",
    "index_project",
    "repo_map",
    "search_codebase_definitions",
    "get_references",
    "get_definition",
    "read_definitions",
  ]);
});
