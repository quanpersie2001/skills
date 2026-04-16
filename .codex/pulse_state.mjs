#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readDependencyHealthSafe } from "./pulse_dependencies.mjs";

export const STATE_SCHEMA_VERSION = "1.0";
export const CHECKPOINT_SCHEMA_VERSION = "1.0";

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
    currentFeature: path.join(repoRoot, ".pulse", "current-feature.json"),
    runtimeSnapshot: path.join(repoRoot, ".pulse", "runtime-snapshot.json"),
    handoffManifest: path.join(repoRoot, ".pulse", "handoffs", "manifest.json"),
    checkpointsRoot: path.join(repoRoot, ".pulse", "checkpoints"),
    memoryRoot: path.join(repoRoot, ".pulse", "memory"),
    memoryLearnings: path.join(repoRoot, ".pulse", "memory", "learnings"),
    memoryCorrections: path.join(repoRoot, ".pulse", "memory", "corrections"),
    memoryRatchet: path.join(repoRoot, ".pulse", "memory", "ratchet"),
    agents: path.join(repoRoot, "AGENTS.md"),
    criticalPatterns: path.join(repoRoot, ".pulse", "memory", "critical-patterns.md"),
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
  if (status.current_feature?.feature_key) {
    return status.current_feature.feature_key;
  }
  if (status.state_json.active_feature) {
    return status.state_json.active_feature;
  }
  const focus = status.state_markdown.focus || "";
  return focus === "(none)" ? "" : focus;
}

function listDirectoryFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function toRepoRelative(repoRoot, targetPath) {
  return path.relative(repoRoot, targetPath).split(path.sep).join("/");
}

function normalizeSelector(selector) {
  return String(selector || "").trim().replaceAll("\\", "/");
}

function slugifyCheckpointPart(value, fallback = "checkpoint") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function validateCheckpointPathPart(value, fieldName) {
  const normalized = normalizeSelector(value);
  if (!normalized) {
    return `${fieldName} is required.`;
  }
  if (path.isAbsolute(normalized)) {
    return `${fieldName} must be relative.`;
  }
  if (normalized === "." || normalized === "..") {
    return `${fieldName} must not be '.' or '..'.`;
  }
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return `${fieldName} must not contain path traversal segments.`;
  }
  return "";
}

function validateCheckpointInputs(feature, checkpointId) {
  const featureError = validateCheckpointPathPart(feature, "feature");
  if (featureError) {
    return featureError;
  }
  const checkpointError = validateCheckpointPathPart(checkpointId, "checkpoint_id");
  if (checkpointError) {
    return checkpointError;
  }
  return "";
}

function ensureCheckpointFeatureDir(paths, feature) {
  const featureDir = path.join(paths.checkpointsRoot, feature);
  fs.mkdirSync(featureDir, { recursive: true });
  return featureDir;
}

function buildCheckpointRecordSummary(record, relativePath) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }

  const captured = record.captured && typeof record.captured === "object" ? record.captured : {};
  const links = record.links && typeof record.links === "object" ? record.links : {};
  const blockers = Array.isArray(record.blockers) ? record.blockers.filter(Boolean) : [];
  const memoryHooks = record.memory_hooks && typeof record.memory_hooks === "object"
    ? record.memory_hooks
    : {};

  return {
    schema_version: typeof record.schema_version === "string" ? record.schema_version : "",
    checkpoint_id: typeof record.checkpoint_id === "string" ? record.checkpoint_id : "",
    feature: typeof record.feature === "string" ? record.feature : "",
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    summary: typeof record.summary === "string" ? record.summary : "",
    next_action: typeof record.next_action === "string" ? record.next_action : "",
    path: relativePath || "",
    captured: {
      phase: typeof captured.phase === "string" ? captured.phase : "",
      gate: typeof captured.gate === "string" ? captured.gate : "",
      mode: typeof captured.mode === "string" ? captured.mode : "",
      story: typeof captured.story === "string" ? captured.story : "",
      bead: typeof captured.bead === "string" ? captured.bead : "",
    },
    blockers,
    links: {
      context: typeof links.context === "string" ? links.context : "",
      handoff: typeof links.handoff === "string" ? links.handoff : "",
      runtime_snapshot: typeof links.runtime_snapshot === "string" ? links.runtime_snapshot : "",
      verification: typeof links.verification === "string" ? links.verification : "",
    },
    memory_hooks: {
      critical_patterns: typeof memoryHooks.critical_patterns === "string"
        ? memoryHooks.critical_patterns
        : "",
      learnings: Array.isArray(memoryHooks.learnings) ? memoryHooks.learnings.filter(Boolean) : [],
      corrections: Array.isArray(memoryHooks.corrections)
        ? memoryHooks.corrections.filter(Boolean)
        : [],
      ratchet: Array.isArray(memoryHooks.ratchet) ? memoryHooks.ratchet.filter(Boolean) : [],
    },
    operator_summary: [
      typeof record.checkpoint_id === "string" && record.checkpoint_id ? record.checkpoint_id : "(unnamed checkpoint)",
      typeof captured.phase === "string" && captured.phase ? `phase=${captured.phase}` : "",
      typeof captured.gate === "string" && captured.gate ? `gate=${captured.gate}` : "",
      typeof record.next_action === "string" && record.next_action ? `next=${record.next_action}` : "",
      typeof record.summary === "string" && record.summary ? `summary=${record.summary}` : "",
      relativePath ? `path=${relativePath}` : "",
    ].filter(Boolean).join(" | "),
  };
}

function readCheckpointManifest(featureDir) {
  const manifestPath = path.join(featureDir, "manifest.json");
  const manifest = readJsonIfExists(manifestPath);
  return {
    path: manifestPath,
    manifest: manifest && typeof manifest === "object" && !Array.isArray(manifest) ? manifest : null,
  };
}

function listCheckpointEntries(repoRoot, featureDir, manifest) {
  const listedEntries = Array.isArray(manifest?.checkpoints) ? manifest.checkpoints : [];
  const entries = [];
  const relativeFeatureDir = toRepoRelative(repoRoot, featureDir);

  for (const entry of listedEntries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const checkpointPath = typeof entry.path === "string" ? entry.path : "";
    if (!checkpointPath) {
      continue;
    }
    const checkpointFile = path.join(featureDir, checkpointPath);
    const checkpointRecord = readJsonIfExists(checkpointFile);
    const summary = buildCheckpointRecordSummary(
      checkpointRecord,
      `${relativeFeatureDir}/${normalizeSelector(checkpointPath)}`,
    );
    if (summary) {
      entries.push(summary);
    }
  }

  const knownEntryPaths = new Set(entries.map((entry) => entry.path));
  for (const fileName of listDirectoryFiles(featureDir)) {
    if (fileName === "manifest.json" || !fileName.endsWith(".json")) {
      continue;
    }
    const relativePath = `${relativeFeatureDir}/${fileName}`;
    if (knownEntryPaths.has(relativePath)) {
      continue;
    }
    const checkpointRecord = readJsonIfExists(path.join(featureDir, fileName));
    const summary = buildCheckpointRecordSummary(checkpointRecord, relativePath);
    if (summary) {
      entries.push(summary);
    }
  }

  entries.sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""));
  return entries;
}

function summarizeCheckpointFeature(paths, feature) {
  const checkpointsRootExists = fs.existsSync(paths.checkpointsRoot);
  if (!feature) {
    return {
      root_exists: checkpointsRootExists,
      feature: "",
      directory_exists: false,
      manifest_exists: false,
      count: 0,
      latest: null,
      entries: [],
    };
  }

  const repoRoot = path.dirname(paths.agents);
  const featureDir = path.join(paths.checkpointsRoot, feature);
  const { manifest } = readCheckpointManifest(featureDir);
  const entries = listCheckpointEntries(repoRoot, featureDir, manifest);

  return {
    root_exists: checkpointsRootExists,
    feature,
    directory_exists: fs.existsSync(featureDir),
    manifest_exists: Boolean(manifest),
    manifest_updated_at: typeof manifest?.updated_at === "string" ? manifest.updated_at : "",
    count: entries.length,
    latest: entries[0] || null,
    entries,
  };
}

function tokenizeRecallValue(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function stripDatedMemoryPrefix(fileName) {
  return fileName.toLowerCase().replace(/^\d{8}-/, "");
}

function buildRecallSelectionContext(feature, status) {
  return {
    feature_tokens: [...new Set(tokenizeRecallValue(feature))],
    blocker_tokens: [...new Set(
      (Array.isArray(status.tooling_status?.blockers) ? status.tooling_status.blockers : [])
        .flatMap((item) => tokenizeRecallValue(item)),
    )],
    phase_tokens: [...new Set(tokenizeRecallValue(status.current_feature?.phase || status.state_json?.phase || ""))],
  };
}

function classifyRecallEntry(relativePath, selectionContext) {
  const fileName = stripDatedMemoryPrefix(path.basename(relativePath, path.extname(relativePath)));
  const reasons = [];

  for (const token of selectionContext.feature_tokens || []) {
    if (token && fileName.includes(token)) {
      reasons.push(`feature:${token}`);
    }
  }
  for (const token of selectionContext.phase_tokens || []) {
    if (token && fileName.includes(token)) {
      reasons.push(`phase:${token}`);
    }
  }
  for (const token of selectionContext.blocker_tokens || []) {
    if (token && fileName.includes(token)) {
      reasons.push(`blocker:${token}`);
    }
  }

  return {
    path: relativePath,
    reasons: [...new Set(reasons)],
  };
}

function pickRelevantRecallEntries(pathsList, selectionContext) {
  const matched = [];
  const fallback = [];

  for (const relativePath of pathsList) {
    const entry = classifyRecallEntry(relativePath, selectionContext);
    if (entry.reasons.length > 0) {
      matched.push(entry);
    } else {
      fallback.push(entry);
    }
  }

  return matched.length > 0 ? matched.slice(0, 3) : fallback.slice(0, 3);
}

function getFileSizeSafe(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function getFileAgeDaysSafe(filePath) {
  try {
    const modifiedAt = fs.statSync(filePath).mtimeMs;
    const ageMs = Date.now() - modifiedAt;
    return Math.floor(ageMs / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

function collectDuplicateMemorySlugs(relativePaths) {
  const counts = new Map();
  for (const relativePath of relativePaths) {
    const slug = stripDatedMemoryPrefix(path.basename(relativePath, path.extname(relativePath)));
    counts.set(slug, (counts.get(slug) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug)
    .sort((left, right) => left.localeCompare(right));
}

function buildMemoryHygiene(paths, selectedRecall, allRecallPaths) {
  const warnings = [];
  const criticalPatternsBytes = fs.existsSync(paths.criticalPatterns) ? getFileSizeSafe(paths.criticalPatterns) : 0;

  if (criticalPatternsBytes > 24 * 1024) {
    warnings.push("critical-patterns.md is getting large; review for compact, globally useful guidance only.");
  }

  const duplicateLearnings = collectDuplicateMemorySlugs(allRecallPaths.learnings);
  if (duplicateLearnings.length > 0) {
    warnings.push(`Possible duplicate learnings: ${duplicateLearnings.join(", ")}.`);
  }

  const duplicateCorrections = collectDuplicateMemorySlugs(allRecallPaths.corrections);
  if (duplicateCorrections.length > 0) {
    warnings.push(`Possible duplicate corrections: ${duplicateCorrections.join(", ")}.`);
  }

  const staleEntries = [
    ...selectedRecall.learnings,
    ...selectedRecall.corrections,
    ...selectedRecall.ratchet,
  ].flatMap((entry) => {
    const absolutePath = path.join(path.dirname(paths.agents), entry.path);
    const ageDays = getFileAgeDaysSafe(absolutePath);
    return ageDays !== null && ageDays > 180 ? [`${entry.path} (${ageDays}d old)`] : [];
  });
  if (staleEntries.length > 0) {
    warnings.push(`Selected memory entries may be stale: ${staleEntries.join(", ")}.`);
  }

  return {
    warnings,
    stats: {
      critical_patterns_bytes: criticalPatternsBytes,
      learnings_count: allRecallPaths.learnings.length,
      corrections_count: allRecallPaths.corrections.length,
      ratchet_count: allRecallPaths.ratchet.length,
    },
  };
}

function summarizeRecallReason(entry, fallbackReason) {
  if (!entry || !Array.isArray(entry.reasons) || entry.reasons.length === 0) {
    return fallbackReason;
  }

  return `matched ${entry.reasons.join(", ")}`;
}

function buildRecallPack(criticalPatternsPath, selectedRecall) {
  const pack = [];

  if (criticalPatternsPath) {
    pack.push({
      kind: "critical-patterns",
      path: criticalPatternsPath,
      reason: "global planning baseline",
    });
  }

  for (const entry of selectedRecall.corrections) {
    pack.push({
      kind: "correction",
      path: entry.path,
      reason: summarizeRecallReason(entry, "targeted tactical guardrail"),
    });
  }
  for (const entry of selectedRecall.ratchet) {
    pack.push({
      kind: "ratchet",
      path: entry.path,
      reason: summarizeRecallReason(entry, "targeted non-regression rule"),
    });
  }
  for (const entry of selectedRecall.learnings) {
    pack.push({
      kind: "learning",
      path: entry.path,
      reason: summarizeRecallReason(entry, "targeted prior lesson"),
    });
  }

  return pack;
}

function summarizeMemoryRecall(paths, feature, status) {
  const memoryRootExists = fs.existsSync(paths.memoryRoot);
  const criticalPatternsExists = fs.existsSync(paths.criticalPatterns);
  const learnings = listDirectoryFiles(paths.memoryLearnings).map((fileName) => path.join(".pulse", "memory", "learnings", fileName));
  const corrections = listDirectoryFiles(paths.memoryCorrections).map((fileName) => path.join(".pulse", "memory", "corrections", fileName));
  const ratchet = listDirectoryFiles(paths.memoryRatchet).map((fileName) => path.join(".pulse", "memory", "ratchet", fileName));
  const selectionContext = buildRecallSelectionContext(feature, status);
  const selectedRecall = {
    learnings: pickRelevantRecallEntries(learnings, selectionContext),
    corrections: pickRelevantRecallEntries(corrections, selectionContext),
    ratchet: pickRelevantRecallEntries(ratchet, selectionContext),
  };
  const criticalPatternsPath = criticalPatternsExists ? ".pulse/memory/critical-patterns.md" : "";

  return {
    root_exists: memoryRootExists,
    critical_patterns: criticalPatternsPath,
    learnings: selectedRecall.learnings.map((entry) => entry.path),
    corrections: selectedRecall.corrections.map((entry) => entry.path),
    ratchet: selectedRecall.ratchet.map((entry) => entry.path),
    selection_context: selectionContext,
    recall_pack: buildRecallPack(criticalPatternsPath, selectedRecall),
    hygiene: buildMemoryHygiene(paths, selectedRecall, { learnings, corrections, ratchet }),
  };
}

function buildCheckpointMemoryHooks(paths, status, feature) {
  const recall = summarizeMemoryRecall(paths, feature, status);
  return {
    critical_patterns: recall.critical_patterns,
    learnings: recall.learnings,
    corrections: recall.corrections,
    ratchet: recall.ratchet,
  };
}

function pickRuntimeSourcePath(relativePath, repoRoot) {
  if (!relativePath || typeof relativePath !== "string") {
    return "";
  }
  return fs.existsSync(path.join(repoRoot, relativePath)) ? normalizeSelector(relativePath) : "";
}

function inferCheckpointCaptured(status) {
  const currentFeature = status.current_feature && typeof status.current_feature === "object"
    ? status.current_feature
    : {};
  const runtimeSnapshot = status.runtime_snapshot && typeof status.runtime_snapshot === "object"
    ? status.runtime_snapshot
    : {};
  const stateJson = status.state_json && typeof status.state_json === "object" ? status.state_json : {};

  return {
    phase: currentFeature.phase || runtimeSnapshot.phase || stateJson.phase || "",
    gate: currentFeature.gate || "",
    mode: runtimeSnapshot.recommended_mode || stateJson.recommended_mode || "",
    story: "",
    bead: "",
  };
}

function inferCheckpointSummary(status, feature) {
  const phase = status.current_feature?.phase || status.runtime_snapshot?.phase || status.state_json?.phase || "idle";
  const gate = status.current_feature?.gate || "";
  const parts = [feature || "feature", `phase ${phase}`];
  if (gate) {
    parts.push(gate.toLowerCase());
  }
  return `${parts.join(" ")} snapshot`.trim();
}

function inferCheckpointNextAction(status) {
  if (status.handoff_manifest?.active?.[0]?.next_action) {
    return status.handoff_manifest.active[0].next_action;
  }
  if (status.tooling_status?.next_skill) {
    return `Open ${status.tooling_status.next_skill}`;
  }
  if (Array.isArray(status.recommended_actions) && status.recommended_actions[0]) {
    return status.recommended_actions[0];
  }
  return "Review current state before continuing.";
}

function inferCheckpointLinks(paths, status, feature, repoRoot) {
  const links = {
    context: "",
    handoff: "",
    runtime_snapshot: "",
    verification: "",
  };

  if (feature) {
    const contextPath = path.join(repoRoot, "history", feature, "CONTEXT.md");
    if (fs.existsSync(contextPath)) {
      links.context = `history/${feature}/CONTEXT.md`;
    }

    const verificationPath = path.join(repoRoot, ".pulse", "verification", feature);
    if (fs.existsSync(verificationPath)) {
      links.verification = `.pulse/verification/${feature}/`;
    }
  }

  const activeHandoffPath = status.handoff_manifest?.active?.[0]?.path || "";
  if (activeHandoffPath) {
    links.handoff = normalizeSelector(activeHandoffPath);
  }

  links.runtime_snapshot = pickRuntimeSourcePath(".pulse/runtime-snapshot.json", repoRoot);
  return links;
}

function buildCheckpointRecordFromStatus(paths, status, options = {}) {
  const repoRoot = path.dirname(paths.agents);
  const feature = String(options.feature || deriveFeature(status) || "").trim();
  if (!feature) {
    return {
      ok: false,
      error: "Cannot save checkpoint without an active feature.",
      record: null,
    };
  }

  const createdAt = typeof options.created_at === "string" && options.created_at
    ? options.created_at
    : utcNow();
  const captured = {
    ...inferCheckpointCaptured(status),
    ...(options.captured && typeof options.captured === "object" ? options.captured : {}),
  };
  const summary = typeof options.summary === "string" && options.summary.trim()
    ? options.summary.trim()
    : inferCheckpointSummary(status, feature);
  const nextAction = typeof options.next_action === "string" && options.next_action.trim()
    ? options.next_action.trim()
    : inferCheckpointNextAction(status);
  const checkpointId = typeof options.checkpoint_id === "string" && options.checkpoint_id.trim()
    ? options.checkpoint_id.trim()
    : `${createdAt.replace(/[:.]/g, "-")}-${slugifyCheckpointPart(captured.phase || captured.gate || "snapshot")}`;
  const validationError = validateCheckpointInputs(feature, checkpointId);
  if (validationError) {
    return {
      ok: false,
      error: validationError,
      record: null,
    };
  }
  const blockers = Array.isArray(options.blockers)
    ? options.blockers.filter(Boolean)
    : Array.isArray(status.tooling_status?.blockers)
      ? status.tooling_status.blockers.filter(Boolean)
      : [];
  const links = {
    ...inferCheckpointLinks(paths, status, feature, repoRoot),
    ...(options.links && typeof options.links === "object" ? options.links : {}),
  };
  const memory_hooks = {
    ...buildCheckpointMemoryHooks(paths, status, feature),
    ...(options.memory_hooks && typeof options.memory_hooks === "object" ? options.memory_hooks : {}),
  };

  return {
    ok: true,
    error: "",
    record: {
      schema_version: CHECKPOINT_SCHEMA_VERSION,
      checkpoint_id: checkpointId,
      feature,
      created_at: createdAt,
      summary,
      next_action: nextAction,
      captured: {
        phase: typeof captured.phase === "string" ? captured.phase : "",
        gate: typeof captured.gate === "string" ? captured.gate : "",
        mode: typeof captured.mode === "string" ? captured.mode : "",
        story: typeof captured.story === "string" ? captured.story : "",
        bead: typeof captured.bead === "string" ? captured.bead : "",
      },
      links: {
        context: typeof links.context === "string" ? normalizeSelector(links.context) : "",
        handoff: typeof links.handoff === "string" ? normalizeSelector(links.handoff) : "",
        runtime_snapshot: typeof links.runtime_snapshot === "string"
          ? normalizeSelector(links.runtime_snapshot)
          : "",
        verification: typeof links.verification === "string" ? normalizeSelector(links.verification) : "",
      },
      blockers,
      memory_hooks: {
        critical_patterns: typeof memory_hooks.critical_patterns === "string"
          ? normalizeSelector(memory_hooks.critical_patterns)
          : "",
        learnings: Array.isArray(memory_hooks.learnings)
          ? memory_hooks.learnings.filter(Boolean).map((item) => normalizeSelector(item))
          : [],
        corrections: Array.isArray(memory_hooks.corrections)
          ? memory_hooks.corrections.filter(Boolean).map((item) => normalizeSelector(item))
          : [],
        ratchet: Array.isArray(memory_hooks.ratchet)
          ? memory_hooks.ratchet.filter(Boolean).map((item) => normalizeSelector(item))
          : [],
      },
    },
  };
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
  for (const handoff of status.handoff_manifest?.active || []) {
    if (handoff.path) {
      reads.push(handoff.path);
    }
  }

  const feature = deriveFeature(status);
  if (feature) {
    reads.push(`history/${feature}/CONTEXT.md`);
  }

  if (status.checkpoints?.latest?.path) {
    reads.push(status.checkpoints.latest.path);
  }

  for (const entry of status.memory_recall?.recall_pack || []) {
    if (entry.path) {
      reads.push(entry.path);
    }
  }

  return [...new Set(reads)];
}

function buildRecommendedActions(status) {
  if (!status.onboarding.exists) {
    return [
      "Run Pulse onboarding before continuing.",
      "Use pulse:preflight or the onboard_pulse.mjs script to install repo-local assets.",
    ];
  }

  const recallPack = Array.isArray(status.memory_recall?.recall_pack)
    ? status.memory_recall.recall_pack
    : [];
  const hygieneWarnings = Array.isArray(status.memory_recall?.hygiene?.warnings)
    ? status.memory_recall.hygiene.warnings
    : [];

  if (status.handoff_manifest.active_count > 0) {
    const actions = [
      "Surface the active handoffs to the user before resuming.",
      "Read the chosen handoff path, then reopen the active feature context.",
    ];

    if (status.checkpoints?.latest?.path) {
      actions.push("Use the latest checkpoint as an advisory resume brief, not as a replacement for the active handoff.");
    }
    if (recallPack.length > 0) {
      actions.push("Use the targeted recall pack to reopen only the most relevant critical patterns, corrections, ratchet rules, and learnings.");
    }
    if (hygieneWarnings.length > 0) {
      actions.push(`Memory hygiene warning: ${hygieneWarnings[0]}`);
    }

    return actions;
  }

  if (status.tooling_status.next_skill) {
    const actions = [`Next skill suggestion: ${status.tooling_status.next_skill}.`];
    if (status.checkpoints?.latest?.path) {
      actions.push("If you are re-entering an active feature, compare the latest checkpoint against the current runtime snapshot before planning or execution.");
    }
    if (recallPack.length > 0) {
      actions.push("Before planning or debugging, consult the targeted recall pack instead of grepping the whole memory plane.");
    }
    if (hygieneWarnings.length > 0) {
      actions.push(`Memory hygiene warning: ${hygieneWarnings[0]}`);
    }
    return actions;
  }

  const actions = [
    "Use this snapshot for fast orientation before deeper reads.",
    "If work is resuming, reopen the active feature context before planning or execution.",
  ];

  if (status.checkpoints?.latest?.path) {
    actions.push("Use the latest checkpoint for a quick resume brief or diff, but treat current state and handoffs as authoritative.");
  }
  if (recallPack.length > 0) {
    actions.push("Use the targeted recall pack to pull in the smallest relevant memory context before planning, debugging, or review.");
  }
  if (hygieneWarnings.length > 0) {
    actions.push(`Memory hygiene warning: ${hygieneWarnings[0]}`);
  }

  return actions;
}

function summarizeCurrentFeature(currentFeature) {
  if (!currentFeature || typeof currentFeature !== "object" || Array.isArray(currentFeature)) {
    return {
      exists: false,
      feature_key: "",
      phase: "",
      gate: "",
      updated_at: "",
      status: "",
    };
  }

  return {
    exists: true,
    feature_key: typeof currentFeature.feature_key === "string" ? currentFeature.feature_key : "",
    phase: typeof currentFeature.phase === "string" ? currentFeature.phase : "",
    gate: typeof currentFeature.gate === "string" ? currentFeature.gate : "",
    updated_at: typeof currentFeature.updated_at === "string" ? currentFeature.updated_at : "",
    status: typeof currentFeature.status === "string" ? currentFeature.status : "",
  };
}

function summarizeRuntimeSnapshot(runtimeSnapshot) {
  if (!runtimeSnapshot || typeof runtimeSnapshot !== "object" || Array.isArray(runtimeSnapshot)) {
    return {
      exists: false,
      schema_version: "",
      active_feature: "",
      active_skill: "",
      phase: "",
      requested_mode: "",
      recommended_mode: "",
      updated_at: "",
      source: null,
    };
  }

  const source = runtimeSnapshot.source && typeof runtimeSnapshot.source === "object"
    ? {
        state_json: typeof runtimeSnapshot.source.state_json === "string"
          ? runtimeSnapshot.source.state_json
          : "",
        state_markdown: typeof runtimeSnapshot.source.state_markdown === "string"
          ? runtimeSnapshot.source.state_markdown
          : "",
        current_feature: typeof runtimeSnapshot.source.current_feature === "string"
          ? runtimeSnapshot.source.current_feature
          : "",
      }
    : null;

  return {
    exists: true,
    schema_version: typeof runtimeSnapshot.schema_version === "string"
      ? runtimeSnapshot.schema_version
      : "",
    active_feature: typeof runtimeSnapshot.active_feature === "string"
      ? runtimeSnapshot.active_feature
      : "",
    active_skill: typeof runtimeSnapshot.active_skill === "string" ? runtimeSnapshot.active_skill : "",
    phase: typeof runtimeSnapshot.phase === "string" ? runtimeSnapshot.phase : "",
    requested_mode: typeof runtimeSnapshot.requested_mode === "string"
      ? runtimeSnapshot.requested_mode
      : "",
    recommended_mode: typeof runtimeSnapshot.recommended_mode === "string"
      ? runtimeSnapshot.recommended_mode
      : "",
    updated_at: typeof runtimeSnapshot.updated_at === "string" ? runtimeSnapshot.updated_at : "",
    source,
  };
}

function summarizeActiveHandoffEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const ownerId = typeof entry.owner_id === "string" ? entry.owner_id : "";
  const ownerType = typeof entry.owner_type === "string" ? entry.owner_type : "";
  const skill = typeof entry.skill === "string" ? entry.skill : "";
  const feature = typeof entry.feature === "string" ? entry.feature : "";
  const phase = typeof entry.phase === "string" ? entry.phase : "";
  const nextAction = typeof entry.next_action === "string" ? entry.next_action : "";
  const summary = typeof entry.summary === "string" ? entry.summary : "";
  const handoffPath = typeof entry.path === "string" ? entry.path : "";

  return {
    owner_id: ownerId,
    owner_type: ownerType,
    skill,
    feature,
    phase,
    next_action: nextAction,
    summary,
    path: handoffPath,
    operator_summary: [
      ownerId || "(unknown owner)",
      skill ? `via ${skill}` : "",
      feature ? `feature=${feature}` : "",
      phase ? `phase=${phase}` : "",
      nextAction ? `next=${nextAction}` : "",
      summary ? `summary=${summary}` : "",
      handoffPath ? `path=${handoffPath}` : "",
    ].filter(Boolean).join(" | "),
  };
}

function summarizeHandoffManifest(handoffManifest) {
  const activeEntries = Array.isArray(handoffManifest?.active)
    ? handoffManifest.active.map(summarizeActiveHandoffEntry).filter(Boolean)
    : [];

  return {
    exists: Boolean(handoffManifest),
    active_count: activeEntries.length,
    updated_at: typeof handoffManifest?.updated_at === "string" ? handoffManifest.updated_at : "",
    active: activeEntries,
  };
}
export async function readPulseStatus(repoRoot) {
  const paths = getPulseStatePaths(repoRoot);
  const onboarding = readJsonIfExists(paths.onboarding);
  const toolingStatus = readJsonIfExists(paths.toolingStatus);
  const stateJson = readJsonIfExists(paths.stateJson);
  const stateMarkdownText = fileTextIfExists(paths.stateMarkdown);
  const stateMarkdown = parseLooseKeyValueMarkdown(stateMarkdownText);
  const currentFeature = readJsonIfExists(paths.currentFeature);
  const runtimeSnapshot = readJsonIfExists(paths.runtimeSnapshot);
  const handoffManifest = readJsonIfExists(paths.handoffManifest);

  const dependencyHealth = readDependencyHealthSafe(repoRoot);
  const gkgReadiness = await readGkgReadiness(repoRoot);

  const stateJsonSummary = {
    exists: Boolean(stateJson),
    ...normalizePulseState(stateJson),
  };
  const stateMarkdownSummary = {
    exists: stateMarkdownText.trim() !== "",
    ...stateMarkdown,
  };
  const currentFeatureSummary = summarizeCurrentFeature(currentFeature);
  const runtimeSnapshotSummary = summarizeRuntimeSnapshot(runtimeSnapshot);
  const handoffManifestSummary = summarizeHandoffManifest(handoffManifest);
  const derivedFeature = deriveFeature({
    current_feature: currentFeatureSummary,
    state_json: stateJsonSummary,
    state_markdown: stateMarkdownSummary,
  });
  const checkpoints = summarizeCheckpointFeature(paths, derivedFeature);

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
    state_json: stateJsonSummary,
    state_markdown: stateMarkdownSummary,
    current_feature: currentFeatureSummary,
    runtime_snapshot: runtimeSnapshotSummary,
    handoff_manifest: handoffManifestSummary,
    checkpoints,
    critical_patterns_exists: fs.existsSync(paths.criticalPatterns),
    dependency_health: dependencyHealth,
    gkg_readiness: gkgReadiness,
    memory_recall: null,
    next_reads: [],
    recommended_actions: [],
  };

  status.memory_recall = summarizeMemoryRecall(paths, derivedFeature, status);
  status.next_reads = buildNextReads(status);
  status.recommended_actions = buildRecommendedActions(status);
  return status;
}

async function loadStatusAndPaths(repoRoot) {
  return {
    repoRoot,
    paths: getPulseStatePaths(repoRoot),
    status: await readPulseStatus(repoRoot),
  };
}

function selectCheckpointEntry(entries, selector) {
  if (!selector) {
    return entries[0] || null;
  }

  const normalized = normalizeSelector(selector);
  return entries.find((entry) => {
    const entryPath = normalizeSelector(entry.path);
    return entry.checkpoint_id === selector || entryPath === normalized || entryPath.endsWith(`/${normalized}`);
  }) || null;
}

function buildCheckpointDiff(left, right) {
  const diffField = (beforeValue, afterValue) => ({
    before: beforeValue,
    after: afterValue,
    changed: beforeValue !== afterValue,
  });

  return {
    from: left ? {
      checkpoint_id: left.checkpoint_id,
      path: left.path,
      created_at: left.created_at,
    } : null,
    to: right ? {
      checkpoint_id: right.checkpoint_id,
      path: right.path,
      created_at: right.created_at,
    } : null,
    fields: {
      summary: diffField(left?.summary || "", right?.summary || ""),
      next_action: diffField(left?.next_action || "", right?.next_action || ""),
      phase: diffField(left?.captured?.phase || "", right?.captured?.phase || ""),
      gate: diffField(left?.captured?.gate || "", right?.captured?.gate || ""),
      mode: diffField(left?.captured?.mode || "", right?.captured?.mode || ""),
      story: diffField(left?.captured?.story || "", right?.captured?.story || ""),
      bead: diffField(left?.captured?.bead || "", right?.captured?.bead || ""),
      blockers: diffField(
        JSON.stringify(left?.blockers || []),
        JSON.stringify(right?.blockers || []),
      ),
      handoff: diffField(left?.links?.handoff || "", right?.links?.handoff || ""),
      verification: diffField(left?.links?.verification || "", right?.links?.verification || ""),
      critical_patterns: diffField(
        left?.memory_hooks?.critical_patterns || "",
        right?.memory_hooks?.critical_patterns || "",
      ),
      learnings: diffField(
        JSON.stringify(left?.memory_hooks?.learnings || []),
        JSON.stringify(right?.memory_hooks?.learnings || []),
      ),
      corrections: diffField(
        JSON.stringify(left?.memory_hooks?.corrections || []),
        JSON.stringify(right?.memory_hooks?.corrections || []),
      ),
      ratchet: diffField(
        JSON.stringify(left?.memory_hooks?.ratchet || []),
        JSON.stringify(right?.memory_hooks?.ratchet || []),
      ),
    },
  };
}

export async function checkpointSave(repoRoot, options = {}) {
  const { status, paths } = await loadStatusAndPaths(repoRoot);
  const built = buildCheckpointRecordFromStatus(paths, status, options);
  if (!built.ok || !built.record) {
    return {
      ok: false,
      operation: "save",
      feature: String(options.feature || deriveFeature(status) || "").trim(),
      checkpoint: null,
      error: built.error || "Checkpoint save failed.",
    };
  }

  const record = built.record;
  const featureDir = ensureCheckpointFeatureDir(paths, record.feature);
  const fileName = `${record.checkpoint_id}.json`;
  const filePath = path.join(featureDir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const { manifest } = readCheckpointManifest(featureDir);
  const listed = Array.isArray(manifest?.checkpoints) ? manifest.checkpoints.filter(Boolean) : [];
  const nextManifest = {
    schema_version: CHECKPOINT_SCHEMA_VERSION,
    updated_at: utcNow(),
    checkpoints: [
      {
        checkpoint_id: record.checkpoint_id,
        path: fileName,
      },
      ...listed.filter((entry) => entry.checkpoint_id !== record.checkpoint_id && entry.path !== fileName),
    ],
  };
  fs.writeFileSync(
    path.join(featureDir, "manifest.json"),
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    "utf8",
  );

  return {
    ok: true,
    operation: "save",
    feature: record.feature,
    checkpoint: buildCheckpointRecordSummary(record, `.pulse/checkpoints/${record.feature}/${fileName}`),
    error: "",
  };
}

export async function checkpointList(repoRoot, options = {}) {
  const { status } = await loadStatusAndPaths(repoRoot);
  const feature = String(options.feature || deriveFeature(status) || "").trim();
  const checkpoints = summarizeCheckpointFeature(getPulseStatePaths(repoRoot), feature);
  return {
    ok: true,
    operation: "list",
    feature,
    checkpoints,
  };
}

export async function checkpointShow(repoRoot, options = {}) {
  const { status } = await loadStatusAndPaths(repoRoot);
  const feature = String(options.feature || deriveFeature(status) || "").trim();
  const checkpoints = summarizeCheckpointFeature(getPulseStatePaths(repoRoot), feature);
  const checkpoint = selectCheckpointEntry(checkpoints.entries, options.selector || options.checkpoint_id || options.path);
  return {
    ok: Boolean(checkpoint),
    operation: "show",
    feature,
    checkpoint: checkpoint || null,
    error: checkpoint ? "" : "Checkpoint not found.",
  };
}

export async function checkpointDiff(repoRoot, options = {}) {
  const { status } = await loadStatusAndPaths(repoRoot);
  const feature = String(options.feature || deriveFeature(status) || "").trim();
  const checkpoints = summarizeCheckpointFeature(getPulseStatePaths(repoRoot), feature);
  const left = selectCheckpointEntry(checkpoints.entries, options.left || options.from);
  const right = selectCheckpointEntry(checkpoints.entries, options.right || options.to) || checkpoints.entries[0] || null;
  if (!left || !right) {
    return {
      ok: false,
      operation: "diff",
      feature,
      error: "Two checkpoints are required for diff.",
      diff: null,
    };
  }

  return {
    ok: true,
    operation: "diff",
    feature,
    diff: buildCheckpointDiff(left, right),
  };
}

export async function checkpointResumeBrief(repoRoot, options = {}) {
  const { status } = await loadStatusAndPaths(repoRoot);
  const feature = String(options.feature || deriveFeature(status) || "").trim();
  const checkpoints = summarizeCheckpointFeature(getPulseStatePaths(repoRoot), feature);
  const checkpoint = selectCheckpointEntry(checkpoints.entries, options.selector || options.checkpoint_id || options.path);
  if (!checkpoint) {
    return {
      ok: false,
      operation: "resume-brief",
      feature,
      error: "Checkpoint not found.",
      resume_brief: null,
    };
  }

  return {
    ok: true,
    operation: "resume-brief",
    feature,
    checkpoint,
    resume_brief: {
      feature,
      checkpoint,
      authoritative_handoffs: status.handoff_manifest.active,
      current_runtime: status.runtime_snapshot,
      current_feature: status.current_feature,
      memory_recall: status.memory_recall,
      next_reads: [...new Set([
        checkpoint.path,
        ...status.next_reads,
      ])],
      note: "Checkpoints are advisory snapshots. Current handoffs and state files remain authoritative.",
    },
  };
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

function renderOperatorSurfaceLines(status) {
  const lines = ["Operator surface:"];
  const currentFeature = status.current_feature && typeof status.current_feature === "object"
    ? status.current_feature
    : { exists: false };
  const runtimeSnapshot = status.runtime_snapshot && typeof status.runtime_snapshot === "object"
    ? status.runtime_snapshot
    : { exists: false };
  const handoffManifest = status.handoff_manifest && typeof status.handoff_manifest === "object"
    ? status.handoff_manifest
    : { exists: false, active_count: 0, active: [] };
  const checkpoints = status.checkpoints && typeof status.checkpoints === "object"
    ? status.checkpoints
    : { root_exists: false, count: 0, latest: null };
  const memoryRecall = status.memory_recall && typeof status.memory_recall === "object"
    ? status.memory_recall
    : {
        root_exists: false,
        critical_patterns: "",
        learnings: [],
        corrections: [],
        ratchet: [],
        recall_pack: [],
        hygiene: { warnings: [] },
      };

  lines.push(
    `- Current feature snapshot: ${currentFeature.exists ? "present" : "missing"}`,
  );
  if (currentFeature.exists) {
    lines.push(`  - feature_key: ${currentFeature.feature_key || "(none)"}`);
    lines.push(`  - phase: ${currentFeature.phase || "(none)"}`);
    lines.push(`  - gate: ${currentFeature.gate || "(none)"}`);
    lines.push(`  - status: ${currentFeature.status || "(none)"}`);
    lines.push(`  - updated_at: ${currentFeature.updated_at || "(none)"}`);
  }

  lines.push(
    `- Runtime snapshot: ${runtimeSnapshot.exists ? "present" : "missing"}`,
  );
  if (runtimeSnapshot.exists) {
    lines.push(`  - schema_version: ${runtimeSnapshot.schema_version || "(none)"}`);
    lines.push(`  - active_feature: ${runtimeSnapshot.active_feature || "(none)"}`);
    lines.push(`  - active_skill: ${runtimeSnapshot.active_skill || "(none)"}`);
    lines.push(`  - phase: ${runtimeSnapshot.phase || "(none)"}`);
    lines.push(`  - requested_mode: ${runtimeSnapshot.requested_mode || "(unspecified)"}`);
    lines.push(`  - recommended_mode: ${runtimeSnapshot.recommended_mode || "(unspecified)"}`);
    lines.push(`  - updated_at: ${runtimeSnapshot.updated_at || "(none)"}`);
  }

  lines.push(`- Active handoffs: ${handoffManifest.active_count || 0}`);
  if (Array.isArray(handoffManifest.active) && handoffManifest.active.length > 0) {
    for (const handoff of handoffManifest.active) {
      lines.push(`  - ${handoff.operator_summary}`);
    }
    lines.push(`  - manifest_updated_at: ${handoffManifest.updated_at || "(none)"}`);
  }

  lines.push(`- Checkpoint root: ${checkpoints.root_exists ? "present" : "missing"}`);
  if (checkpoints.feature) {
    lines.push(`  - feature: ${checkpoints.feature}`);
    lines.push(`  - checkpoint_count: ${checkpoints.count || 0}`);
    if (checkpoints.latest) {
      lines.push(`  - latest_checkpoint: ${checkpoints.latest.operator_summary}`);
      lines.push(`  - latest_checkpoint_created_at: ${checkpoints.latest.created_at || "(none)"}`);
    }
  }

  lines.push(`- Memory recall root: ${memoryRecall.root_exists ? "present" : "missing"}`);
  if (memoryRecall.critical_patterns) {
    lines.push(`  - critical_patterns: ${memoryRecall.critical_patterns}`);
  }
  if ((memoryRecall.learnings || []).length > 0) {
    lines.push(`  - learnings: ${(memoryRecall.learnings || []).join(", ")}`);
  }
  if ((memoryRecall.corrections || []).length > 0) {
    lines.push(`  - corrections: ${(memoryRecall.corrections || []).join(", ")}`);
  }
  if ((memoryRecall.ratchet || []).length > 0) {
    lines.push(`  - ratchet: ${(memoryRecall.ratchet || []).join(", ")}`);
  }
  if ((memoryRecall.recall_pack || []).length > 0) {
    lines.push("  - recall_pack:");
    for (const entry of memoryRecall.recall_pack) {
      lines.push(`    - ${entry.kind}: ${entry.path} (${entry.reason})`);
    }
  }
  if ((memoryRecall.hygiene?.warnings || []).length > 0) {
    lines.push("  - hygiene_warnings:");
    for (const warning of memoryRecall.hygiene.warnings) {
      lines.push(`    - ${warning}`);
    }
  }

  return lines;
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
    ...renderOperatorSurfaceLines(status),
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
