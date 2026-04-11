#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readDependencyHealthSafe } from "./pulse_dependencies.mjs";

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

const SUPPORTED_GKG_LANGUAGE_EXTENSIONS = {
  TypeScript: [".ts", ".tsx"],
  JavaScript: [".js", ".jsx", ".mjs", ".cjs"],
  Ruby: [".rb"],
  Java: [".java"],
  Kotlin: [".kt", ".kts"],
  Python: [".py"],
};

const SUPPORTED_GKG_BASENAMES = new Set(["Gemfile", "Rakefile", "Vagrantfile"]);

const OTHER_SOURCE_EXTENSIONS = new Set([
  ".go", ".rs", ".c", ".h", ".cpp", ".hpp", ".cc", ".cs",
  ".swift", ".m", ".mm", ".lua", ".r", ".R", ".scala",
  ".clj", ".ex", ".exs", ".hs", ".erl", ".dart", ".php",
]);

const WALK_SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "vendor", ".bundle",
  "__pycache__", ".venv", "venv", ".tox", "target", ".gradle",
  ".codex", ".pulse", ".beads", ".spikes", ".worktrees",
]);

const MANIFEST_LANGUAGE_HINTS = {
  "package.json": "JavaScript",
  "tsconfig.json": "TypeScript",
  "Gemfile": "Ruby",
  "Rakefile": "Ruby",
  "build.gradle": "Java",
  "build.gradle.kts": "Kotlin",
  "pom.xml": "Java",
  "setup.py": "Python",
  "pyproject.toml": "Python",
  "requirements.txt": "Python",
  "Pipfile": "Python",
};

const MAX_WALK_DEPTH = 3;

function collectRepoLanguageSignals(repoRoot) {
  const counts = { supported: 0, unsupported_code: 0, ignored: 0 };
  const supportedLanguages = new Set();
  const flatExtensions = new Map();

  for (const [lang, exts] of Object.entries(SUPPORTED_GKG_LANGUAGE_EXTENSIONS)) {
    for (const ext of exts) {
      flatExtensions.set(ext, lang);
    }
  }

  for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const hint = MANIFEST_LANGUAGE_HINTS[entry.name];
    if (hint) supportedLanguages.add(hint);
  }

  function walk(dir, depth) {
    if (depth > MAX_WALK_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!WALK_SKIP_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name), depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const ext = path.extname(entry.name);
      const lang = flatExtensions.get(ext);
      if (lang) {
        counts.supported += 1;
        supportedLanguages.add(lang);
        continue;
      }
      if (SUPPORTED_GKG_BASENAMES.has(entry.name)) {
        counts.supported += 1;
        supportedLanguages.add("Ruby");
        continue;
      }
      if (OTHER_SOURCE_EXTENSIONS.has(ext)) {
        counts.unsupported_code += 1;
        continue;
      }
      counts.ignored += 1;
    }
  }

  walk(repoRoot, 0);

  const sortedLanguages = [...supportedLanguages].sort();
  const total = counts.supported + counts.unsupported_code;
  let coverage = "none";
  if (total > 0) {
    coverage = counts.unsupported_code === 0 ? "full" : counts.supported > 0 ? "limited" : "none";
  }

  return {
    supported_languages: sortedLanguages,
    primary_supported_language: sortedLanguages[0] || null,
    counts,
    coverage,
  };
}

function normalizeFsPath(p) {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 1500) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function extractProjectPaths(payload) {
  const paths = new Set();
  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && /folder_path|project_root|repo_path|root_path|path/i.test(key)) {
        paths.add(value);
      }
      if (typeof value === "object") walk(value);
    }
  }
  walk(payload);
  return [...paths];
}

async function readGkgServerStatus(repoRoot) {
  const serverUrl = process.env.PULSE_GKG_SERVER_URL || "http://127.0.0.1:27495";
  const [info, workspace] = await Promise.all([
    fetchJsonWithTimeout(`${serverUrl}/api/info`),
    fetchJsonWithTimeout(`${serverUrl}/api/workspace/list`),
  ]);
  if (!info) {
    return { server_reachable: false, server_version: null, project_indexed: false };
  }

  const projectPaths = workspace ? extractProjectPaths(workspace) : [];
  const normalizedRoot = normalizeFsPath(repoRoot);
  const project_indexed = projectPaths.some((p) => normalizeFsPath(p) === normalizedRoot);

  return {
    server_reachable: true,
    server_version: info.version || info.server_version || null,
    project_indexed,
  };
}

function buildGkgRecommendedAction(signals, serverStatus) {
  if (!signals.supported_languages.length) {
    return "Use grep/file inspection fallback — this repo is outside gkg's supported language set.";
  }
  if (!serverStatus.server_reachable && !serverStatus.project_indexed) {
    return "Run `gkg index <repo-root>`, then `gkg server start` to enable gkg discovery.";
  }
  if (!serverStatus.server_reachable && serverStatus.project_indexed) {
    return "Run `gkg server start` to enable gkg discovery.";
  }
  if (serverStatus.server_reachable && !serverStatus.project_indexed) {
    return "Stop the server if needed, run `gkg index <repo-root>`, then restart it so this project is ready for gkg discovery.";
  }
  return "gkg is ready — use MCP tools as the default discovery path.";
}

export async function readGkgReadiness(repoRoot) {
  const signals = collectRepoLanguageSignals(repoRoot);
  const serverStatus = await readGkgServerStatus(repoRoot);
  const recommended_action = buildGkgRecommendedAction(signals, serverStatus);

  return {
    supported_repo: signals.supported_languages.length > 0,
    supported_languages: signals.supported_languages,
    primary_supported_language: signals.primary_supported_language,
    coverage: signals.coverage,
    ...serverStatus,
    recommended_action,
  };
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

export async function readPulseStatus(repoRoot) {
  const paths = getPulseStatePaths(repoRoot);
  const onboarding = readJsonIfExists(paths.onboarding);
  const toolingStatus = readJsonIfExists(paths.toolingStatus);
  const stateJson = readJsonIfExists(paths.stateJson);
  const stateMarkdownText = fileTextIfExists(paths.stateMarkdown);
  const stateMarkdown = parseLooseKeyValueMarkdown(stateMarkdownText);
  const handoffManifest = readJsonIfExists(paths.handoffManifest);

  const dependencyHealth = readDependencyHealthSafe(repoRoot);
  const gkgReadiness = await readGkgReadiness(repoRoot);

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
    dependency_health: dependencyHealth,
    gkg_readiness: gkgReadiness,
    next_reads: [],
    recommended_actions: [],
  };

  status.next_reads = buildNextReads(status);
  status.recommended_actions = buildRecommendedActions(status);
  return status;
}

function formatDependencyTarget(target) {
  if (Array.isArray(target)) {
    return target.filter(Boolean).join(", ");
  }
  return String(target || "");
}

function formatDependencyImpact(missingDependency) {
  const requiredBy = Array.isArray(missingDependency.required_by)
    ? missingDependency.required_by.join(", ")
    : "(unknown skills)";
  const effects = Array.isArray(missingDependency.missing_effects)
    ? missingDependency.missing_effects.join(", ")
    : "degraded";
  return `Affects: ${requiredBy}. Reported status impact: ${effects}.`;
}

function renderDependencyHealthLines(status) {
  const dependencyHealth =
    status.dependency_health && typeof status.dependency_health === "object"
      ? status.dependency_health
      : null;
  const summary = dependencyHealth?.summary || {};
  const missingDependencies = Array.isArray(dependencyHealth?.missing_dependencies)
    ? dependencyHealth.missing_dependencies
    : [];
  const uncoveredSkills = Array.isArray(dependencyHealth?.uncovered_skills)
    ? dependencyHealth.uncovered_skills
    : [];

  const lines = [
    "Dependency health:",
    `- Packaged skill coverage: ${summary.skills_total || 0} total (${summary.skills_with_declared_dependencies || 0} with declared dependencies, ${summary.skills_dependency_free || 0} dependency-free, ${summary.skills_uncovered || 0} uncovered)`,
    `- Availability among covered skills: ${summary.skills_available || 0} available, ${summary.skills_degraded || 0} degraded, ${summary.skills_unavailable || 0} unavailable`,
    `- Declared dependencies: ${summary.declared_dependencies || 0}`,
    `- Missing declared dependencies: ${summary.missing_dependencies || 0}`,
  ];

  lines.push("- Uncovered packaged skills:");
  if (uncoveredSkills.length === 0) {
    lines.push("  - none");
  } else {
    for (const skill of uncoveredSkills) {
      lines.push(`  - ${skill.skill_name} (${skill.skill_file})`);
    }
  }

  if (missingDependencies.length === 0) {
    lines.push("- Missing commands: none");
    lines.push("- Missing MCP server configuration: none");
    return lines;
  }

  const missingCommands = missingDependencies.filter((dependency) => dependency.kind === "command");
  const missingMcpServers = missingDependencies.filter(
    (dependency) => dependency.kind === "mcp_server",
  );

  lines.push("- Missing commands:");
  if (missingCommands.length === 0) {
    lines.push("  - none");
  } else {
    for (const dependency of missingCommands) {
      lines.push(
        `  - ${formatDependencyTarget(dependency.target)}. ${formatDependencyImpact(dependency)}`,
      );
    }
  }

  lines.push("- Missing MCP server configuration:");
  if (missingMcpServers.length === 0) {
    lines.push("  - none");
  } else {
    for (const dependency of missingMcpServers) {
      lines.push(
        `  - ${formatDependencyTarget(dependency.target)}. ${formatDependencyImpact(dependency)}`,
      );
    }
  }

  return lines;
}

function renderGkgReadinessLines(status) {
  const readiness = status.gkg_readiness && typeof status.gkg_readiness === "object"
    ? status.gkg_readiness
    : null;
  if (!readiness) {
    return [];
  }

  const supportedLanguages =
    Array.isArray(readiness.supported_languages) && readiness.supported_languages.length > 0
      ? readiness.supported_languages.join(", ")
      : "none";
  const serverStatus = readiness.server_reachable
    ? `reachable${readiness.server_version ? ` (${readiness.server_version})` : ""}`
    : "unreachable";

  return [
    "gkg readiness:",
    `- Supported repo: ${readiness.supported_repo ? "yes" : "no"}`,
    `- Supported languages: ${supportedLanguages}`,
    `- Primary supported language: ${readiness.primary_supported_language || "n/a"}`,
    `- Coverage: ${readiness.coverage || "unknown"}`,
    `- Server: ${serverStatus}`,
    `- Project indexed: ${readiness.project_indexed ? "yes" : "no"}`,
    `- Recommended action: ${readiness.recommended_action || "n/a"}`,
  ];
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
    ...renderGkgReadinessLines(status),
    "",
    ...renderDependencyHealthLines(status),
    "",
    "Next reads:",
    ...status.next_reads.map((item) => `- ${item}`),
    "",
    "Recommended actions:",
    ...status.recommended_actions.map((item) => `- ${item}`),
  ].join("\n");
}
