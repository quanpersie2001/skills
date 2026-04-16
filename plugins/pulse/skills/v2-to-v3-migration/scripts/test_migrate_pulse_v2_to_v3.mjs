#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { applyRepo } from "../../using-pulse/scripts/onboard_pulse.mjs";
import {
  checkMigration,
  applyMigration,
} from "./migrate_pulse_v2_to_v3.mjs";

const MIGRATION_SCRIPT_PATH = fileURLToPath(new URL("./migrate_pulse_v2_to_v3.mjs", import.meta.url));

function createLegacyPulseRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-migrate-"));
  applyRepo(root, false);

  const onboardingPath = path.join(root, ".pulse", "onboarding.json");
  const onboarding = JSON.parse(fs.readFileSync(onboardingPath, "utf8"));
  onboarding.plugin_version = "2.6.0";
  fs.writeFileSync(onboardingPath, `${JSON.stringify(onboarding, null, 2)}\n`, "utf8");

  const hooksDir = path.join(root, ".codex", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, "pulse_session_start.py"), "# legacy\n", "utf8");

  const hooksJsonPath = path.join(root, ".codex", "hooks.json");
  fs.writeFileSync(
    hooksJsonPath,
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
                {
                  type: "command",
                  command: "echo keep-unrelated-hook",
                  statusMessage: "Custom: keep me",
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

  fs.rmSync(path.join(root, ".codex", "pulse_status.mjs"), { force: true });
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Existing instructions\n", "utf8");

  const memoryFile = path.join(root, ".pulse", "memory", "learnings", "keep.md");
  fs.writeFileSync(memoryFile, "keep this memory\n", "utf8");

  return root;
}

test("checkMigration reports needs_migration for a stale v2-style repo without mutating files", () => {
  const root = createLegacyPulseRepo();

  try {
    const hooksJsonPath = path.join(root, ".codex", "hooks.json");
    const beforeHooks = fs.readFileSync(hooksJsonPath, "utf8");

    const result = checkMigration(root);

    assert.equal(result.status, "needs_migration");
    assert.equal(result.mode, "check");
    assert.equal(result.migration_kind, "legacy_upgrade");
    assert.equal(result.preservation_guarantees.unrelated_hooks, true);
    assert.equal(result.preservation_guarantees.pulse_data_not_wiped, true);
    assert.ok(result.actions.includes("sync_pulse_hook_scripts"));
    assert.ok(result.actions.includes("sync_pulse_support_scripts"));
    assert.deepEqual(
      result.legacy_signals.map((signal) => signal.id).sort(),
      ["legacy_python_hook_entries", "legacy_python_hook_file", "missing_v3_support_files", "stale_plugin_version"],
    );
    assert.equal(fs.readFileSync(hooksJsonPath, "utf8"), beforeHooks);
    assert.equal(
      fs.readFileSync(path.join(root, ".pulse", "memory", "learnings", "keep.md"), "utf8"),
      "keep this memory\n",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("applyMigration upgrades a stale repo while preserving unrelated hooks, AGENTS content, and pulse data", () => {
  const root = createLegacyPulseRepo();

  try {
    const result = applyMigration(root);
    const hooksJson = JSON.parse(fs.readFileSync(path.join(root, ".codex", "hooks.json"), "utf8"));
    const sessionStartEntries = hooksJson.hooks.SessionStart;
    const sessionStartHooks = sessionStartEntries.flatMap((entry) => entry.hooks || []);
    const agentsText = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
    const onboarding = JSON.parse(fs.readFileSync(path.join(root, ".pulse", "onboarding.json"), "utf8"));

    assert.equal(result.status, "up_to_date");
    assert.equal(result.mode, "apply");
    assert.equal(onboarding.plugin_version, "3.0.0");
    assert.equal(fs.existsSync(path.join(root, ".codex", "hooks", "pulse_session_start.py")), false);
    assert.ok(fs.existsSync(path.join(root, ".codex", "pulse_status.mjs")));
    assert.match(agentsText, /# Existing instructions/);
    assert.match(agentsText, /<!-- PULSE:START -->/);
    assert.ok(sessionStartHooks.some((hook) => hook.command === "echo keep-unrelated-hook"));
    assert.ok(sessionStartHooks.some((hook) => /pulse_session_start\.mjs/.test(hook.command)));
    assert.equal(
      fs.readFileSync(path.join(root, ".pulse", "memory", "learnings", "keep.md"), "utf8"),
      "keep this memory\n",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("applyMigration preserves unmanaged compact_prompt unless replacement is explicitly allowed", () => {
  const root = createLegacyPulseRepo();

  try {
    fs.writeFileSync(path.join(root, ".codex", "config.toml"), 'compact_prompt = """keep me"""\n', "utf8");

    const result = applyMigration(root);
    const configText = fs.readFileSync(path.join(root, ".codex", "config.toml"), "utf8");

    assert.equal(result.status, "needs_migration");
    assert.equal(result.requires_confirmation, true);
    assert.equal(result.result.status, "partial");
    assert.match(configText, /compact_prompt = """keep me"""/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("migration CLI is idempotent after apply", () => {
  const root = createLegacyPulseRepo();

  try {
    const applyStdout = execFileSync("node", [MIGRATION_SCRIPT_PATH, "--repo-root", root, "--apply"], {
      encoding: "utf8",
    });
    const applyPayload = JSON.parse(applyStdout);
    const checkStdout = execFileSync("node", [MIGRATION_SCRIPT_PATH, "--repo-root", root], {
      encoding: "utf8",
    });
    const checkPayload = JSON.parse(checkStdout);

    assert.equal(applyPayload.status, "up_to_date");
    assert.equal(checkPayload.status, "up_to_date");
    assert.equal(checkPayload.mode, "check");
    assert.deepEqual(checkPayload.legacy_signals, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checkMigration reports missing_runtime for unsupported Node versions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-migrate-"));

  try {
    const result = checkMigration(root, { runtimeVersion: "16.20.0" });

    assert.equal(result.status, "missing_runtime");
    assert.equal(result.mode, "check");
    assert.equal(result.runtime.supported, false);
    assert.ok(result.actions.includes("install_supported_node_runtime"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
