#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const STATE_SCHEMA_VERSION = "1.0";

function utcNow() {
  return new Date().toISOString();
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function fileTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function resolveRepoRoot(explicitRoot, startFrom = process.cwd()) {
  if (explicitRoot) {
    return path.resolve(explicitRoot);
  }

  const cwd = path.resolve(startFrom);
  try {
    const stdout = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return path.resolve(stdout.trim());
  } catch {
    let candidate = cwd;
    while (true) {
      if (
        fs.existsSync(path.join(candidate, ".git")) ||
        fs.existsSync(path.join(candidate, ".pulse", "onboarding.json"))
      ) {
        return candidate;
      }
      const parent = path.dirname(candidate);
      if (parent === candidate) {
        return cwd;
      }
      candidate = parent;
    }
  }
}

export function buildDefaultState(overrides = {}) {
  return {
    schema_version: STATE_SCHEMA_VERSION,
    phase: typeof overrides.phase === "string" && overrides.phase ? overrides.phase : "idle",
    active_skill:
      typeof overrides.active_skill === "string" ? overrides.active_skill : "pulse:using-pulse",
    active_feature: typeof overrides.active_feature === "string" ? overrides.active_feature : "",
    requested_mode: typeof overrides.requested_mode === "string" ? overrides.requested_mode : "",
    recommended_mode: typeof overrides.recommended_mode === "string" ? overrides.recommended_mode : "",
    handoff_manifest:
      typeof overrides.handoff_manifest === "string" && overrides.handoff_manifest
        ? overrides.handoff_manifest
        : ".pulse/handoffs/manifest.json",
    last_updated:
      typeof overrides.last_updated === "string" && overrides.last_updated
        ? overrides.last_updated
        : utcNow(),
  };
}

export function normalizePulseState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return buildDefaultState();
  }
  return buildDefaultState(state);
}

export function getPulseStatePaths(repoRoot) {
  return {
    onboarding: path.join(repoRoot, ".pulse", "onboarding.json"),
    toolingStatus: path.join(repoRoot, ".pulse", "tooling-status.json"),
    stateJson: path.join(repoRoot, ".pulse", "state.json"),
    stateMarkdown: path.join(repoRoot, ".pulse", "STATE.md"),
    handoffManifest: path.join(repoRoot, ".pulse", "handoffs", "manifest.json"),
    agents: path.join(repoRoot, "AGENTS.md"),
    criticalPatterns: path.join(repoRoot, "history", "learnings", "critical-patterns.md"),
  };
}

export function readPulseState(repoRoot) {
  const paths = getPulseStatePaths(repoRoot);
  return normalizePulseState(readJsonIfExists(paths.stateJson));
}

export function writePulseState(repoRoot, nextState) {
  const paths = getPulseStatePaths(repoRoot);
  const normalized = normalizePulseState(nextState);
  ensureParent(paths.stateJson);
  fs.writeFileSync(paths.stateJson, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

function parseLooseKeyValueMarkdown(text) {
  const parsed = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 _/-]+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const key = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    parsed[key] = match[2].trim();
  }
  return parsed;
}

function deriveFeature(status) {
  if (status.state_json.active_feature) {
    return status.state_json.active_feature;
  }
  const focus = status.state_markdown.focus || "";
  return focus === "(none)" ? "" : focus;
}

function buildNextReads(status) {
  const reads = ["AGENTS.md", ".pulse/tooling-status.json"];

  if (status.state_json.exists) {
    reads.push(".pulse/state.json");
  }

  if (status.state_markdown.exists) {
    reads.push(".pulse/STATE.md");
  }

  if (status.handoff_manifest.exists) {
    reads.push(".pulse/handoffs/manifest.json");
  }

  const feature = deriveFeature(status);
  if (feature) {
    reads.push(`history/${feature}/CONTEXT.md`);
  }

  if (status.critical_patterns_exists) {
    reads.push("history/learnings/critical-patterns.md");
  }

  return reads;
}

function buildRecommendedActions(status) {
  if (!status.onboarding.exists) {
    return [
      "Run Pulse onboarding before continuing.",
      "Use pulse:preflight or the onboard_pulse.mjs script to install repo-local assets.",
    ];
  }

  if (status.handoff_manifest.active_count > 0) {
    return [
      "Surface the active handoffs to the user before resuming.",
      "Read the chosen handoff path, then reopen the active feature context.",
    ];
  }

  if (status.tooling_status.next_skill) {
    return [`Next skill suggestion: ${status.tooling_status.next_skill}.`];
  }

  return [
    "Use this snapshot for fast orientation before deeper reads.",
    "If work is resuming, reopen the active feature context before planning or execution.",
  ];
}

export function readPulseStatus(repoRoot) {
  const paths = getPulseStatePaths(repoRoot);
  const onboarding = readJsonIfExists(paths.onboarding);
  const toolingStatus = readJsonIfExists(paths.toolingStatus);
  const stateJson = readJsonIfExists(paths.stateJson);
  const stateMarkdownText = fileTextIfExists(paths.stateMarkdown);
  const stateMarkdown = parseLooseKeyValueMarkdown(stateMarkdownText);
  const handoffManifest = readJsonIfExists(paths.handoffManifest);

  const status = {
    repo_root: repoRoot,
    onboarding: {
      exists: Boolean(onboarding),
      status: onboarding?.status || "",
      plugin_version: onboarding?.plugin_version || "",
    },
    tooling_status: {
      exists: Boolean(toolingStatus),
      status: typeof toolingStatus?.status === "string" ? toolingStatus.status : "",
      requested_mode:
        typeof toolingStatus?.requested_mode === "string" ? toolingStatus.requested_mode : "",
      recommended_mode:
        typeof toolingStatus?.recommended_mode === "string" ? toolingStatus.recommended_mode : "",
      next_skill: typeof toolingStatus?.next_skill === "string" ? toolingStatus.next_skill : "",
      blockers: Array.isArray(toolingStatus?.blockers) ? toolingStatus.blockers : [],
    },
    state_json: {
      exists: Boolean(stateJson),
      ...normalizePulseState(stateJson),
    },
    state_markdown: {
      exists: stateMarkdownText.trim() !== "",
      ...stateMarkdown,
    },
    handoff_manifest: {
      exists: Boolean(handoffManifest),
      active_count: Array.isArray(handoffManifest?.active) ? handoffManifest.active.length : 0,
      updated_at: typeof handoffManifest?.updated_at === "string" ? handoffManifest.updated_at : "",
    },
    critical_patterns_exists: fs.existsSync(paths.criticalPatterns),
    next_reads: [],
    recommended_actions: [],
  };

  status.next_reads = buildNextReads(status);
  status.recommended_actions = buildRecommendedActions(status);
  return status;
}

export function renderPulseStatus(status) {
  const onboarding = status.onboarding.exists
    ? `${status.onboarding.status || "installed"}${status.onboarding.plugin_version ? ` (${status.onboarding.plugin_version})` : ""}`
    : "missing";
  const feature = deriveFeature(status) || "(none)";
  const skill = status.state_json.active_skill || "(none)";
  const phase = status.state_json.phase || status.state_markdown.phase || "(none)";
  const requestedMode =
    status.tooling_status.requested_mode || status.state_json.requested_mode || "(unspecified)";
  const recommendedMode =
    status.tooling_status.recommended_mode || status.state_json.recommended_mode || "(unspecified)";

  return [
    "Pulse Status",
    `Repo: ${status.repo_root}`,
    `Onboarding: ${onboarding}`,
    `Feature: ${feature}`,
    `Skill: ${skill}`,
    `Phase: ${phase}`,
    `Requested mode: ${requestedMode}`,
    `Recommended mode: ${recommendedMode}`,
    `Active handoffs: ${status.handoff_manifest.active_count}`,
    "",
    "Next reads:",
    ...status.next_reads.map((item) => `- ${item}`),
    "",
    "Recommended actions:",
    ...status.recommended_actions.map((item) => `- ${item}`),
  ].join("\n");
}
