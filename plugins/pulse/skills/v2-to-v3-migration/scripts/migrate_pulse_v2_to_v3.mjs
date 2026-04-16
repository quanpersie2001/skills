#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveRepoRoot,
  getNodeRuntimeStatus,
  checkRepo,
  applyRepo,
} from "../../using-pulse/scripts/onboard_pulse.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const LEGACY_HOOK_FILENAMES = [
  "pulse_session_start.py",
  "pulse_pre_tool_use.py",
  "pulse_stop.py",
];
const V3_SUPPORT_FILES = [
  ".codex/pulse_status.mjs",
  ".codex/pulse_state.mjs",
  ".codex/pulse_dependencies.mjs",
];

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function buildPreservationGuarantees() {
  return {
    agents_outside_managed_markers: true,
    unrelated_hooks: true,
    pulse_data_not_wiped: true,
    compact_prompt_requires_explicit_replace: true,
  };
}

function detectLegacySignals(repoRoot, onboardingPayload) {
  const signals = [];
  const hooksDir = path.join(repoRoot, ".codex", "hooks");
  const hooksJsonPath = path.join(repoRoot, ".codex", "hooks.json");
  const hooksText = readTextIfExists(hooksJsonPath);
  const onboardingState = onboardingPayload?.details?.onboarding_state;
  const currentPluginVersion = onboardingPayload?.details?.plugin_version || "";

  for (const fileName of LEGACY_HOOK_FILENAMES) {
    const hookPath = path.join(hooksDir, fileName);
    if (fs.existsSync(hookPath)) {
      signals.push({
        id: "legacy_python_hook_file",
        detail: path.relative(repoRoot, hookPath),
      });
    }
  }

  if (/\.codex\/hooks\/pulse_(session_start|pre_tool_use|stop)\.py/.test(hooksText)) {
    signals.push({
      id: "legacy_python_hook_entries",
      detail: ".codex/hooks.json still references Python Pulse hook commands",
    });
  }

  if (onboardingState?.plugin_version && onboardingState.plugin_version !== currentPluginVersion) {
    signals.push({
      id: "stale_plugin_version",
      detail: `${onboardingState.plugin_version} -> ${currentPluginVersion}`,
    });
  }

  const missingSupportFiles = V3_SUPPORT_FILES.filter(
    (relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)),
  );
  if (missingSupportFiles.length > 0) {
    signals.push({
      id: "missing_v3_support_files",
      detail: missingSupportFiles.join(", "),
    });
  }

  const pulseIndicators = [
    Boolean(onboardingState),
    Boolean(onboardingPayload?.details?.agents_managed_block),
    fs.existsSync(path.join(repoRoot, ".pulse")),
    fs.existsSync(hooksDir) && fs.readdirSync(hooksDir).some((name) => name.startsWith("pulse_")),
  ];

  if (onboardingPayload?.status === "needs_onboarding" && pulseIndicators.some(Boolean) && signals.length === 0) {
    signals.push({
      id: "partial_pulse_install",
      detail: "Pulse-managed files exist but the repo is not current with the v3 layout",
    });
  }

  return signals;
}

function inferMigrationKind(onboardingPayload, legacySignals) {
  if (onboardingPayload.status === "up_to_date") {
    return "current";
  }
  if (onboardingPayload.status === "missing_runtime") {
    return "runtime_blocked";
  }
  if (legacySignals.some((signal) => signal.id === "stale_plugin_version")) {
    return "legacy_upgrade";
  }
  if (legacySignals.length > 0) {
    return "repair";
  }
  return "bootstrap";
}

function mapStatus(onboardingPayload) {
  if (onboardingPayload.status === "up_to_date") {
    return "up_to_date";
  }
  if (onboardingPayload.status === "missing_runtime") {
    return "missing_runtime";
  }
  return "needs_migration";
}

export function checkMigration(repoRoot, options = {}) {
  const runtime = getNodeRuntimeStatus(options.runtimeVersion);
  if (!runtime.supported) {
    return {
      repo_root: repoRoot,
      status: "missing_runtime",
      mode: "check",
      runtime,
      migration_kind: "runtime_blocked",
      legacy_signals: [],
      actions: ["install_supported_node_runtime"],
      requires_confirmation: false,
      preservation_guarantees: buildPreservationGuarantees(),
      details: {
        runtime,
      },
      message: `Pulse requires Node.js ${runtime.minimum_major}+ before migration can continue.`,
    };
  }

  const onboardingPayload = checkRepo(repoRoot);
  const legacySignals = detectLegacySignals(repoRoot, onboardingPayload);
  const migrationKind = inferMigrationKind(onboardingPayload, legacySignals);
  const status = mapStatus(onboardingPayload);

  return {
    repo_root: repoRoot,
    status,
    mode: "check",
    runtime: onboardingPayload.details?.runtime || runtime,
    migration_kind: migrationKind,
    legacy_signals: legacySignals,
    actions: onboardingPayload.actions || [],
    requires_confirmation: Boolean(onboardingPayload.requires_confirmation),
    preservation_guarantees: buildPreservationGuarantees(),
    details: onboardingPayload.details,
    message: status === "up_to_date"
      ? "Pulse repo is already current with the v3 layout."
      : "Pulse repo needs migration or onboarding updates before normal v3 bootstrap can continue.",
  };
}

export function applyMigration(repoRoot, options = {}) {
  const runtime = getNodeRuntimeStatus(options.runtimeVersion);
  if (!runtime.supported) {
    return checkMigration(repoRoot, options);
  }

  const applied = applyRepo(repoRoot, Boolean(options.allowCompactPromptReplace));
  const checked = checkMigration(repoRoot, options);

  return {
    ...checked,
    mode: "apply",
    result: applied.result,
    details: {
      ...checked.details,
      onboarding_apply: applied.result,
    },
  };
}

function parseCliArgs(argv) {
  const args = {
    repoRoot: undefined,
    apply: false,
    allowCompactPromptReplace: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo-root") {
      args.repoRoot = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--repo-root=")) {
      args.repoRoot = arg.slice("--repo-root=".length);
      continue;
    }
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--check" || arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--allow-compact-prompt-replace") {
      args.allowCompactPromptReplace = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        [
          "Usage: migrate_pulse_v2_to_v3.mjs [--repo-root <path>] [--apply] [--allow-compact-prompt-replace] [--check] [--json]",
          "",
          "Checks or applies the Pulse v2-to-v3 migration wrapper.",
        ].join("\n"),
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.allowCompactPromptReplace && !args.apply) {
    throw new Error("--allow-compact-prompt-replace requires --apply");
  }

  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  const repoRoot = resolveRepoRoot(args.repoRoot);
  const payload = args.apply
    ? applyMigration(repoRoot, { allowCompactPromptReplace: args.allowCompactPromptReplace })
    : checkMigration(repoRoot);

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  return payload.status === "missing_runtime" ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  process.exitCode = main();
}
