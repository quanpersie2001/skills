#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildDefaultState,
  normalizePulseState,
  syncPulseRuntimeArtifacts,
} from "./pulse_state.mjs";
import {
  readDependencyHealthSafe,
  buildDependencyWarningSummary,
} from "./pulse_dependencies.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const USING_PULSE_DIR = path.dirname(path.dirname(SCRIPT_PATH));
const PLUGIN_ROOT = path.dirname(path.dirname(USING_PULSE_DIR));
const PLUGIN_MANIFEST_PATH = path.join(PLUGIN_ROOT, ".codex-plugin", "plugin.json");
const AGENTS_TEMPLATE_PATH = path.join(PLUGIN_ROOT, "AGENTS.template.md");
const HOOK_TEMPLATES_DIR = path.join(USING_PULSE_DIR, "templates");
const ONBOARDING_SCHEMA_VERSION = "1.0";
const COMPACT_PROMPT_MARKER_START = "# PULSE: compact_prompt start";
const COMPACT_PROMPT_MARKER_END = "# PULSE: compact_prompt end";
const MIN_NODE_MAJOR = 18;
const MANAGED_HOOK_FILENAMES = [
  "pulse_session_start.mjs",
  "pulse_pre_tool_use.mjs",
  "pulse_stop.mjs",
];
const MANAGED_SUPPORT_FILES = {
  "pulse_status.mjs": path.join(USING_PULSE_DIR, "templates", "pulse_status.mjs"),
  "pulse_state.mjs": path.join(USING_PULSE_DIR, "scripts", "pulse_state.mjs"),
  "pulse_dependencies.mjs": path.join(USING_PULSE_DIR, "scripts", "pulse_dependencies.mjs"),
};
const LEGACY_HOOK_FILENAMES = [
  "pulse_session_start.py",
  "pulse_pre_tool_use.py",
  "pulse_stop.py",
];
const LEGACY_LEARNING_DIRECTORIES = ["learnings", "learning", "corrections", "ratchet"];

export function getNodeRuntimeStatus(version = process.versions.node) {
  const major = Number.parseInt(String(version).split(".")[0] || "0", 10);
  const supported = Number.isFinite(major) && major >= MIN_NODE_MAJOR;
  return {
    command: "node",
    minimum_major: MIN_NODE_MAJOR,
    supported,
    version,
  };
}

function utcNow() {
  return new Date().toISOString();
}

function loadPluginVersion() {
  return JSON.parse(fs.readFileSync(PLUGIN_MANIFEST_PATH, "utf8")).version;
}

export function resolveRepoRoot(explicitRoot) {
  if (explicitRoot) {
    return path.resolve(explicitRoot);
  }

  const cwd = path.resolve(process.cwd());
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
      if (fs.existsSync(path.join(candidate, ".git"))) {
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

function readTemplate() {
  return `${fs.readFileSync(AGENTS_TEMPLATE_PATH, "utf8").replace(/\s*$/, "")}\n`;
}

function readTextIfExists(filePath) {
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

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function managedAgentsPresent(text) {
  return text.includes("<!-- PULSE:START -->") && text.includes("<!-- PULSE:END -->");
}

function mergeAgentsContent(existing, template) {
  const stripped = existing.trim();
  if (!stripped) {
    return { text: template, status: "created_from_template" };
  }

  if (managedAgentsPresent(existing)) {
    const updated = existing.replace(
      /<!-- PULSE:START -->[\s\S]*?<!-- PULSE:END -->\n?/,
      template,
    );
    return { text: `${updated.replace(/\s*$/, "")}\n`, status: "updated_managed_block" };
  }

  const glue = existing.endsWith("\n\n") ? "" : "\n\n";
  return {
    text: `${existing.replace(/\s*$/, "")}${glue}${template}`,
    status: "appended_managed_block",
  };
}

function insertBeforeFirstTable(text, block) {
  const match = text.match(/^\[/m);
  if (match && match.index !== undefined) {
    return `${text.slice(0, match.index)}${block}\n${text.slice(match.index)}`;
  }
  return `${text.replace(/\s*$/, "")}${text.trim() ? "\n\n" : ""}${block}\n`;
}

function findProjectDocMaxBytes(text) {
  const match = text.match(/^project_doc_max_bytes\s*=\s*(.+)$/m);
  if (!match) {
    return undefined;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : undefined;
}

function upsertProjectDocMaxBytes(text, existingValue) {
  const desired = 65536;
  const line = `project_doc_max_bytes = ${desired}`;

  if (existingValue === undefined) {
    return insertBeforeFirstTable(text, `${line}\n`);
  }

  if (existingValue >= desired) {
    return text;
  }

  return text.replace(/^project_doc_max_bytes\s*=\s*.+$/m, line);
}

function findSectionRange(text, sectionName) {
  const lines = text.split("\n");
  let offset = 0;
  let start = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (start === null) {
      if (line.trim() === `[${sectionName}]`) {
        start = offset + line.length + 1;
      }
      offset += line.length + 1;
      continue;
    }

    if (/^\[[^\]]+\]\s*$/.test(line)) {
      return { start, end: offset };
    }
    offset += line.length + 1;
  }

  return start === null ? null : { start, end: text.length };
}

function featureSectionBody(text) {
  const range = findSectionRange(text, "features");
  return range ? text.slice(range.start, range.end) : null;
}

function isCodexHooksEnabled(text) {
  const body = featureSectionBody(text);
  return body ? /^codex_hooks\s*=\s*true\s*$/m.test(body) : false;
}

function upsertFeaturesCodexHooks(text) {
  const range = findSectionRange(text, "features");
  if (!range) {
    const block = "[features]\ncodex_hooks = true\n";
    const suffix = text && !text.endsWith("\n") ? "\n" : "";
    return `${text}${suffix}${text.trim() ? "\n" : ""}${block}`;
  }

  let body = text.slice(range.start, range.end);
  if (/^codex_hooks\s*=/m.test(body)) {
    body = body.replace(/^codex_hooks\s*=.*$/m, "codex_hooks = true");
  } else {
    if (body && !body.endsWith("\n")) {
      body += "\n";
    }
    body += "codex_hooks = true\n";
  }

  return `${text.slice(0, range.start)}${body}${text.slice(range.end)}`;
}

function renderCompactPromptBlock() {
  return [
    COMPACT_PROMPT_MARKER_START,
    'compact_prompt = """',
    "MANDATORY: Pulse context compaction recovery.",
    "",
    "STOP. Before doing anything else:",
    "1. Read AGENTS.md completely.",
    "2. If present, run `node .codex/pulse_status.mjs --json` for a quick Pulse status snapshot.",
    "3. Read .pulse/tooling-status.json, .pulse/state.json, and .pulse/STATE.md if they exist.",
    "4. Read .pulse/handoffs/manifest.json and any active owner handoff you are resuming.",
    "5. Re-open the active feature CONTEXT.md before more planning or edits.",
    "6. Re-open the current bead or task before running more implementation commands.",
    "7. Check the current worktree state with git status before resuming.",
    "",
    "After completing these steps, briefly confirm what context you restored and only then continue.",
    '"""',
    COMPACT_PROMPT_MARKER_END,
    "",
  ].join("\n");
}

function hasManagedCompactPrompt(text) {
  return text.includes(COMPACT_PROMPT_MARKER_START) && text.includes(COMPACT_PROMPT_MARKER_END);
}

function hasCompactPrompt(text) {
  return /^compact_prompt\s*=/m.test(text);
}

function replaceExistingCompactPrompt(text, replacement) {
  const tripleQuotePattern = /^compact_prompt\s*=\s*"""[\s\S]*?^"""\s*$/m;
  if (tripleQuotePattern.test(text)) {
    return text.replace(tripleQuotePattern, replacement.replace(/\n$/, ""));
  }

  const singleLinePattern = /^compact_prompt\s*=.*$/m;
  if (singleLinePattern.test(text)) {
    return text.replace(singleLinePattern, replacement.replace(/\n$/, ""));
  }

  return insertBeforeFirstTable(text, replacement);
}

function mergeCompactPrompt(text, allowReplace) {
  if (hasManagedCompactPrompt(text)) {
    const updated = text.replace(
      new RegExp(
        `${escapeRegExp(COMPACT_PROMPT_MARKER_START)}[\\s\\S]*?${escapeRegExp(COMPACT_PROMPT_MARKER_END)}\\n?`,
      ),
      renderCompactPromptBlock(),
    );
    return {
      text: updated,
      compact_prompt_status: "managed",
    };
  }

  if (hasCompactPrompt(text) && !allowReplace) {
    return {
      text,
      compact_prompt_status: "conflict_preserved",
    };
  }

  if (hasCompactPrompt(text) && allowReplace) {
    return {
      text: replaceExistingCompactPrompt(text, renderCompactPromptBlock()),
      compact_prompt_status: "replaced",
    };
  }

  return {
    text: insertBeforeFirstTable(text, renderCompactPromptBlock()),
    compact_prompt_status: "installed",
  };
}

function mergeCodexConfig(configPath, allowCompactPromptReplace) {
  const existingText = readTextIfExists(configPath);
  const changes = [];

  let updatedText = existingText;
  const nextProjectDocText = upsertProjectDocMaxBytes(updatedText, findProjectDocMaxBytes(existingText));
  if (nextProjectDocText !== updatedText) {
    changes.push("set_project_doc_max_bytes");
    updatedText = nextProjectDocText;
  }

  const nextFeatureText = upsertFeaturesCodexHooks(updatedText);
  if (nextFeatureText !== updatedText) {
    changes.push("enable_codex_hooks_feature");
    updatedText = nextFeatureText;
  }

  const compactResult = mergeCompactPrompt(updatedText, allowCompactPromptReplace);
  if (compactResult.text !== updatedText) {
    changes.push(`compact_prompt_${compactResult.compact_prompt_status}`);
    updatedText = compactResult.text;
  } else if (compactResult.compact_prompt_status === "conflict_preserved") {
    changes.push("compact_prompt_conflict_preserved");
  }

  return {
    text: `${updatedText.replace(/\s*$/, "")}\n`,
    changes,
  };
}

function buildManagedHookCommand(fileName) {
  return `node .codex/hooks/${fileName}`;
}

function renderManagedHookEntries() {
  return {
    SessionStart: [
      {
        matcher: "startup|resume",
        hooks: [
          {
            type: "command",
            command: buildManagedHookCommand("pulse_session_start.mjs"),
            statusMessage: "Pulse: session bootstrap",
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: buildManagedHookCommand("pulse_pre_tool_use.mjs"),
            statusMessage: "Pulse: shell guardrails",
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          {
            type: "command",
            command: buildManagedHookCommand("pulse_stop.mjs"),
            statusMessage: "Pulse: end-of-turn check",
          },
        ],
      },
    ],
  };
}

function isPulseHook(hook) {
  const command = hook?.command || "";
  const status = hook?.statusMessage || "";
  return command.includes(".codex/hooks/pulse_") || status.startsWith("Pulse:");
}

function parseHooksJson(text) {
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}

function mergeHooksJson(hooksPath) {
  const existingText = readTextIfExists(hooksPath);
  const existing = existingText ? parseHooksJson(existingText) : {};
  const hooks = existing.hooks && typeof existing.hooks === "object" ? existing.hooks : {};
  const mergedHooks = { ...hooks };
  const changes = [];

  for (const [eventName, entries] of Object.entries(renderManagedHookEntries())) {
    const currentEntries = Array.isArray(mergedHooks[eventName]) ? mergedHooks[eventName] : [];
    const nextEntries = [];

    for (const entry of currentEntries) {
      const hooksList = Array.isArray(entry?.hooks) ? entry.hooks : [];
      const preservedHooks = hooksList.filter((hook) => !isPulseHook(hook));
      if (preservedHooks.length === hooksList.length) {
        nextEntries.push(entry);
        continue;
      }
      if (preservedHooks.length > 0) {
        nextEntries.push({
          ...entry,
          hooks: preservedHooks,
        });
      }
    }

    nextEntries.push(...entries);
    if (JSON.stringify(currentEntries) !== JSON.stringify(nextEntries)) {
      changes.push(`upsert_${eventName}`);
    }
    mergedHooks[eventName] = nextEntries;
  }

  return {
    text: `${JSON.stringify({ ...existing, hooks: mergedHooks }, null, 2)}\n`,
    changes,
  };
}

function hookScriptsNeedUpdate(repoRoot) {
  const hooksDir = path.join(repoRoot, ".codex", "hooks");

  for (const name of MANAGED_HOOK_FILENAMES) {
    const source = fs.readFileSync(path.join(HOOK_TEMPLATES_DIR, name), "utf8");
    const targetPath = path.join(hooksDir, name);
    if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, "utf8") !== source) {
      return true;
    }
  }

  for (const name of LEGACY_HOOK_FILENAMES) {
    if (fs.existsSync(path.join(hooksDir, name))) {
      return true;
    }
  }

  return false;
}

function supportScriptsNeedUpdate(repoRoot) {
  const codexDir = path.join(repoRoot, ".codex");

  for (const [name, sourcePath] of Object.entries(MANAGED_SUPPORT_FILES)) {
    const targetPath = path.join(codexDir, name);
    const source = fs.readFileSync(sourcePath, "utf8");
    if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, "utf8") !== source) {
      return true;
    }
  }

  return false;
}

function writeHookScripts(repoRoot) {
  const hooksDir = path.join(repoRoot, ".codex", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  for (const name of LEGACY_HOOK_FILENAMES) {
    const legacyPath = path.join(hooksDir, name);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
    }
  }

  const written = [];
  for (const name of MANAGED_HOOK_FILENAMES) {
    const source = path.join(HOOK_TEMPLATES_DIR, name);
    const target = path.join(hooksDir, name);
    fs.copyFileSync(source, target);
    fs.chmodSync(target, 0o755);
    written.push(path.relative(repoRoot, target));
  }
  return written;
}

function writeSupportScripts(repoRoot) {
  const codexDir = path.join(repoRoot, ".codex");
  fs.mkdirSync(codexDir, { recursive: true });

  const written = [];
  for (const [name, sourcePath] of Object.entries(MANAGED_SUPPORT_FILES)) {
    const target = path.join(codexDir, name);
    fs.copyFileSync(sourcePath, target);
    fs.chmodSync(target, 0o755);
    written.push(path.relative(repoRoot, target));
  }
  return written;
}

function toPosixRelative(repoRoot, targetPath) {
  return path.relative(repoRoot, targetPath).split(path.sep).join("/");
}

function slugifyValue(value, fallback = "entry") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function collectFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  files.sort();
  return files;
}

function parseSimpleFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { data: {}, body: text.trim() };
  }

  const data = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) {
      continue;
    }
    const [, key, rawValue] = kv;
    const value = rawValue.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }

  return { data, body: text.slice(match[0].length).trim() };
}

function formatYamlScalar(value) {
  return String(value || "").replace(/\n+/g, " ").trim();
}

function formatYamlArray(values) {
  const normalized = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
  return `[${normalized.join(", ")}]`;
}

function inferLegacyDate(sourcePath, frontmatter) {
  const raw = typeof frontmatter.date === "string" ? frontmatter.date.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  const stat = fs.statSync(sourcePath);
  const iso = new Date(stat.mtimeMs).toISOString().slice(0, 10);
  return iso;
}

function inferLegacyFeature(frontmatter, relativePath) {
  if (typeof frontmatter.feature === "string" && frontmatter.feature.trim()) {
    return slugifyValue(frontmatter.feature.trim(), "legacy-learning");
  }

  const parts = relativePath.split("/");
  const stem = path.basename(relativePath, path.extname(relativePath));
  const candidate = parts.find((part) => !["history", "learning", "learnings", "corrections", "ratchet"].includes(part));
  return slugifyValue(candidate || stem, "legacy-learning");
}

function extractLegacyTitle(body, fallbackStem) {
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading) {
    return heading[1].trim();
  }

  const firstNonEmpty = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstNonEmpty ? firstNonEmpty.replace(/^[-*]\s*/, "").slice(0, 80) : fallbackStem;
}

function classifyLegacyMemory(body, relativePath) {
  const text = `${relativePath}\n${body}`.toLowerCase();
  if (/\bratchet\b|must-check|required checks?|non-regression|always verify|never merge without/.test(text)) {
    return "ratchet";
  }
  if (/\bcorrection\b|wrong move|correct move|should have|instead,|mistake|fix was/.test(text)) {
    return "correction";
  }
  return "learning";
}

function inferLegacySeverity(body, frontmatter) {
  const raw = typeof frontmatter.severity === "string" ? frontmatter.severity.trim().toLowerCase() : "";
  if (raw === "critical" || raw === "standard") {
    return raw;
  }
  return /critical|sev0|sev1|blocker|must-fix/.test(body.toLowerCase()) ? "critical" : "standard";
}

function inferLegacyTags(relativePath, body, type) {
  const seed = new Set([type, "legacy-migration"]);
  const joined = `${relativePath} ${body}`.toLowerCase();
  for (const token of ["verification", "testing", "hooks", "memory", "planning", "review", "onboarding", "migration"]) {
    if (joined.includes(token)) {
      seed.add(token);
    }
  }
  return [...seed].slice(0, 6);
}

function buildLegacyAppliesWhen(type, feature, title) {
  if (type === "ratchet") {
    return `Work touches ${feature} or the same non-regression surface described in ${title}.`;
  }
  if (type === "correction") {
    return `Work risks repeating the same tactical mistake described in ${title}.`;
  }
  return `Work overlaps ${feature} or the scenario captured in ${title}.`;
}

function buildLegacyNormalizedDocument({
  type,
  date,
  feature,
  title,
  tags,
  severity,
  appliesWhen,
  scope,
  signals,
  sourceRelativePath,
  sourceHash,
  legacyBody,
}) {
  const migrationMarker = `<!-- pulse-migrated-source: ${sourceRelativePath} sha256:${sourceHash} -->`;
  const sharedFrontmatter = [
    "---",
    `date: ${date}`,
    `feature: ${formatYamlScalar(feature)}`,
    `severity: ${severity}`,
    `tags: ${formatYamlArray(tags)}`,
    `applies_when: ${formatYamlScalar(appliesWhen)}`,
    `scope: ${formatYamlArray(scope)}`,
    `signals: ${formatYamlArray(signals)}`,
  ];

  const safeTitle = title || "Legacy Note";
  const originalNote = legacyBody.trim() || "Legacy source file was empty.";

  if (type === "correction") {
    return [
      ...sharedFrontmatter,
      "---",
      migrationMarker,
      "",
      `# Correction: ${safeTitle}`,
      "",
      `**Why this exists:** Preserve a tactical fix migrated from legacy Pulse v2 memory at \`${sourceRelativePath}\`.`,
      "",
      "## Wrong move",
      "",
      "Treat the original legacy note as optional context or rewrite it without preserving the tactical mistake it was documenting.",
      "",
      "## Correct move",
      "",
      "Carry the legacy guidance forward into the current correction format, keep the v3 file canonical, and review the original note below before repeating the same mistake.",
      "",
      "## Evidence",
      "",
      `- Feature: ${feature}`,
      "- Files / commands / artifacts:",
      `  - ${sourceRelativePath}`,
      "",
      "## Propagation",
      "",
      "**Propagation:** correction",
      "**Planner action:** attach this file in bead `learning_refs` when the trigger clearly matches.",
      "",
      "## Legacy Source Note",
      "",
      originalNote,
      "",
    ].join("\n");
  }

  if (type === "ratchet") {
    return [
      ...sharedFrontmatter,
      "---",
      migrationMarker,
      "",
      `# Ratchet: ${safeTitle}`,
      "",
      `**Rule:** Re-check this legacy non-regression note whenever work overlaps ${feature}.`,
      "",
      "## Why this became a ratchet",
      "",
      `This guidance was promoted from legacy Pulse v2 memory at \`${sourceRelativePath}\` and likely represents a costly or repeated miss worth preserving.`,
      "",
      "## Required checks",
      "",
      `- Review the original migrated note before changing ${feature}.`,
      "- Confirm verification covers the failure mode or guardrail described below.",
      "",
      "## Evidence",
      "",
      `- Feature: ${feature}`,
      "- Files / commands / artifacts:",
      `  - ${sourceRelativePath}`,
      "",
      "## Propagation",
      "",
      "**Propagation:** ratchet",
      "**Planner action:** attach this file in bead `learning_refs` when the trigger clearly matches.",
      "**Validator action:** treat this as a must-check when the trigger clearly matches.",
      "",
      "## Legacy Source Note",
      "",
      originalNote,
      "",
    ].join("\n");
  }

  return [
    ...sharedFrontmatter.slice(0, 2),
    `categories: ${formatYamlArray([bodyToLearningCategory(legacyBody, type)])}`,
    ...sharedFrontmatter.slice(2),
    "---",
    migrationMarker,
    "",
    `# Learning: ${safeTitle}`,
    "",
    `**Category:** ${bodyToLearningCategory(legacyBody, type)}`,
    `**Severity:** ${severity}`,
    `**Tags:** ${formatYamlArray(tags)}`,
    `**Applicable-when:** ${appliesWhen}`,
    "",
    "## What Happened",
    "",
    `This note was migrated from legacy Pulse v2 memory at \`${sourceRelativePath}\`. The original content is preserved below so future work can reuse the context without depending on the retired layout.`,
    "",
    "## Root Cause / Key Insight",
    "",
    "The durable insight mattered enough to keep, but the original file did not match the current v3 learning template. Normalizing it keeps the canonical memory surface consistent while preserving the original details.",
    "",
    "## Recommendation for Future Work",
    "",
    "Review the migrated legacy note before making similar changes, and treat the original trigger and failure mode as the source of truth when deciding whether this learning applies.",
    "",
    "## Propagation Guidance",
    "",
    "**Propagation:** bead-local",
    "**Embed-in-bead-when:** The current work clearly matches the original trigger described in this migrated note.",
    "**Bead hint:** Review the migrated legacy learning before changing this area.",
    "",
    "## Legacy Source Note",
    "",
    originalNote,
    "",
  ].join("\n");
}

function bodyToLearningCategory(body, type) {
  if (type === "correction") {
    return "failure";
  }
  if (/\bdecision\b|chosen|tradeoff|decided/.test(body.toLowerCase())) {
    return "decision";
  }
  if (/\bfailure\b|incident|bug|broke|mistake/.test(body.toLowerCase())) {
    return "failure";
  }
  return "pattern";
}

function collectLegacyLearningSources(repoRoot) {
  const historyLearningRoot = path.join(repoRoot, "history", "learning");
  if (!fs.existsSync(historyLearningRoot)) {
    return [];
  }

  const sources = [];
  for (const directoryName of LEGACY_LEARNING_DIRECTORIES) {
    const dirPath = path.join(historyLearningRoot, directoryName);
    for (const filePath of collectFilesRecursively(dirPath)) {
      if (path.basename(filePath) === "critical-patterns.md") {
        continue;
      }
      if (path.extname(filePath).toLowerCase() !== ".md") {
        continue;
      }
      sources.push(filePath);
    }
  }

  for (const filePath of collectFilesRecursively(historyLearningRoot)) {
    const relative = toPosixRelative(repoRoot, filePath);
    if (relative === "history/learning/critical-patterns.md") {
      continue;
    }
    if (!relative.startsWith("history/learning/")) {
      continue;
    }
    if (path.extname(filePath).toLowerCase() !== ".md") {
      continue;
    }
    if (!sources.includes(filePath)) {
      sources.push(filePath);
    }
  }

  sources.sort();
  return sources;
}

function collectLegacyVerificationArtifacts(repoRoot) {
  const runsRoot = path.join(repoRoot, ".pulse", "runs");
  if (!fs.existsSync(runsRoot)) {
    return [];
  }

  return fs.readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const featureKey = entry.name;
      const verificationRoot = path.join(runsRoot, featureKey, "verification");
      const files = collectFilesRecursively(verificationRoot);
      return {
        featureKey,
        verificationRoot,
        files,
      };
    })
    .filter((entry) => entry.files.length > 0);
}

function ensureDestinationFilePath(targetDirectory, baseName, sourceRelativePath) {
  const preferred = path.join(targetDirectory, baseName);
  if (!fs.existsSync(preferred)) {
    return preferred;
  }

  const sourceHash = createHash("sha256").update(sourceRelativePath).digest("hex").slice(0, 8);
  const parsed = path.parse(baseName);
  return path.join(targetDirectory, `${parsed.name}-${sourceHash}${parsed.ext}`);
}

function removeEmptyParents(startDir, stopDir) {
  let current = startDir;
  const stopPath = path.resolve(stopDir);
  while (path.resolve(current).startsWith(stopPath)) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }
    if (fs.readdirSync(current).length > 0) {
      break;
    }
    fs.rmdirSync(current);
    if (path.resolve(current) === stopPath) {
      break;
    }
    current = path.dirname(current);
  }
}

function migrateLegacyLearningMemory(repoRoot) {
  const sources = collectLegacyLearningSources(repoRoot);
  const memoryRoot = path.join(repoRoot, ".pulse", "memory");
  const historyLearningRoot = path.join(repoRoot, "history", "learning");
  const result = {
    sources_found: sources.length,
    migrated_files: 0,
    normalized_counts: {
      learning: 0,
      correction: 0,
      ratchet: 0,
    },
    conflicts: [],
    outputs: [],
  };

  for (const sourcePath of sources) {
    const sourceRelativePath = toPosixRelative(repoRoot, sourcePath);
    const sourceText = fs.readFileSync(sourcePath, "utf8");
    const sourceHash = createHash("sha256").update(sourceText).digest("hex");
    const { data: frontmatter, body } = parseSimpleFrontmatter(sourceText);
    const type = classifyLegacyMemory(body, sourceRelativePath);
    const date = inferLegacyDate(sourcePath, frontmatter);
    const dateSlug = date.replace(/-/g, "");
    const feature = inferLegacyFeature(frontmatter, sourceRelativePath);
    const title = extractLegacyTitle(body, slugifyValue(path.basename(sourcePath, path.extname(sourcePath)), "legacy-note"));
    const tags = inferLegacyTags(sourceRelativePath, body, type);
    const severity = inferLegacySeverity(body, frontmatter);
    const appliesWhen = buildLegacyAppliesWhen(type, feature, title);
    const scope = [sourceRelativePath];
    const signals = [slugifyValue(title, "legacy-note")];
    const targetDirectory = path.join(memoryRoot, type === "learning" ? "learnings" : `${type}s`.replace("ratchets", "ratchet"));
    fs.mkdirSync(targetDirectory, { recursive: true });

    const baseName = `${dateSlug}-${slugifyValue(title, slugifyValue(feature, "legacy-note"))}.md`;
    let targetPath = ensureDestinationFilePath(targetDirectory, baseName, sourceRelativePath);
    const candidatePaths = [targetPath];
    if (targetPath !== path.join(targetDirectory, baseName)) {
      candidatePaths.unshift(path.join(targetDirectory, baseName));
    }

    let existingPath = null;
    for (const candidatePath of candidatePaths) {
      if (!fs.existsSync(candidatePath)) {
        continue;
      }
      const existingText = fs.readFileSync(candidatePath, "utf8");
      if (existingText.includes(`pulse-migrated-source: ${sourceRelativePath} `)) {
        existingPath = candidatePath;
        targetPath = candidatePath;
        break;
      }
    }

    const normalized = buildLegacyNormalizedDocument({
      type,
      date,
      feature,
      title,
      tags,
      severity,
      appliesWhen,
      scope,
      signals,
      sourceRelativePath,
      sourceHash,
      legacyBody: body,
    });

    if (existingPath) {
      const existingText = fs.readFileSync(existingPath, "utf8");
      if (existingText !== normalized) {
        result.conflicts.push(`${toPosixRelative(repoRoot, existingPath)} preserved over ${sourceRelativePath}`);
      }
      continue;
    }

    if (fs.existsSync(targetPath)) {
      result.conflicts.push(`${toPosixRelative(repoRoot, targetPath)} preserved over ${sourceRelativePath}`);
      continue;
    }

    fs.writeFileSync(targetPath, `${normalized.replace(/\s*$/, "")}\n`, "utf8");
    fs.rmSync(sourcePath, { force: true });
    removeEmptyParents(path.dirname(sourcePath), historyLearningRoot);
    result.migrated_files += 1;
    result.normalized_counts[type] += 1;
    result.outputs.push(toPosixRelative(repoRoot, targetPath));
  }

  return result;
}

function parseCriticalPatternEntries(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const entries = [];
  const matches = [...trimmed.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [{ title: trimmed.slice(0, 80), body: trimmed }];
  }

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index;
    const end = index + 1 < matches.length ? matches[index + 1].index : trimmed.length;
    const block = trimmed.slice(start, end).trim();
    entries.push({ title: matches[index][1].trim(), body: block });
  }
  return entries;
}

function mergeLegacyCriticalPatterns(repoRoot) {
  const historyLearningRoot = path.join(repoRoot, "history", "learning");
  const sourcePath = path.join(historyLearningRoot, "critical-patterns.md");
  const targetPath = path.join(repoRoot, ".pulse", "memory", "critical-patterns.md");
  const result = {
    source_exists: fs.existsSync(sourcePath),
    appended_entries: 0,
    skipped_entries: 0,
  };

  if (!result.source_exists) {
    return result;
  }

  const sourceEntries = parseCriticalPatternEntries(fs.readFileSync(sourcePath, "utf8"));
  const existingText = readTextIfExists(targetPath);
  const existingEntries = parseCriticalPatternEntries(existingText);
  const existingTitles = new Set(existingEntries.map((entry) => entry.title.toLowerCase()));
  const existingBodies = new Set(existingEntries.map((entry) => entry.body.replace(/\s+/g, " ").trim().toLowerCase()));
  const additions = [];

  for (const entry of sourceEntries) {
    const normalizedBody = entry.body.replace(/\s+/g, " ").trim().toLowerCase();
    if (existingTitles.has(entry.title.toLowerCase()) || existingBodies.has(normalizedBody)) {
      result.skipped_entries += 1;
      continue;
    }
    additions.push(entry.body);
    existingTitles.add(entry.title.toLowerCase());
    existingBodies.add(normalizedBody);
  }

  if (additions.length === 0) {
    return result;
  }

  const nextText = existingText.trim()
    ? `${existingText.replace(/\s*$/, "")}\n\n${additions.join("\n\n")}`
    : `${additions.join("\n\n")}\n`;
  ensureParent(targetPath);
  fs.writeFileSync(targetPath, `${nextText.replace(/\s*$/, "")}\n`, "utf8");
  fs.rmSync(sourcePath, { force: true });
  removeEmptyParents(path.dirname(sourcePath), historyLearningRoot);
  result.appended_entries = additions.length;
  return result;
}

function migrateLegacyVerificationArtifacts(repoRoot) {
  const features = collectLegacyVerificationArtifacts(repoRoot);
  const runsRoot = path.join(repoRoot, ".pulse", "runs");
  const result = {
    features_found: features.length,
    copied_files: 0,
    conflicts: [],
  };

  for (const feature of features) {
    const historyVerificationRoot = path.join(repoRoot, "history", feature.featureKey, "verification");
    fs.mkdirSync(historyVerificationRoot, { recursive: true });

    for (const sourcePath of feature.files) {
      const relativeInsideVerification = path.relative(feature.verificationRoot, sourcePath);
      const destinationPath = path.join(historyVerificationRoot, relativeInsideVerification);
      ensureParent(destinationPath);

      if (!fs.existsSync(destinationPath)) {
        fs.copyFileSync(sourcePath, destinationPath);
        fs.rmSync(sourcePath, { force: true });
        result.copied_files += 1;
        continue;
      }

      const sourceText = fs.readFileSync(sourcePath);
      const destinationText = fs.readFileSync(destinationPath);
      if (Buffer.compare(sourceText, destinationText) !== 0) {
        result.conflicts.push(
          `${toPosixRelative(repoRoot, destinationPath)} preserved over ${toPosixRelative(repoRoot, sourcePath)}`,
        );
        continue;
      }

      fs.rmSync(sourcePath, { force: true });
    }

    removeEmptyParents(feature.verificationRoot, runsRoot);
  }

  return result;
}

function buildRuntimeBlockedPayload(repoRoot, action) {
  const runtime = getNodeRuntimeStatus();
  return {
    repo_root: repoRoot,
    status: "missing_runtime",
    action,
    requires_confirmation: false,
    actions: ["install_supported_node_runtime"],
    message: `Pulse requires Node.js ${MIN_NODE_MAJOR}+ before onboarding can continue. Install Node.js and rerun onboarding.`,
    details: {
      runtime,
    },
  };
}

export function checkRepo(repoRoot) {
  const runtime = getNodeRuntimeStatus();
  if (!runtime.supported) {
    return buildRuntimeBlockedPayload(repoRoot, "check");
  }

  const dependencyHealth = readDependencyHealthSafe(repoRoot);
  const dependencyWarning = buildDependencyWarningSummary(dependencyHealth);

  const pluginVersion = loadPluginVersion();
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const configPath = path.join(repoRoot, ".codex", "config.toml");
  const hooksPath = path.join(repoRoot, ".codex", "hooks.json");
  const onboardingPath = path.join(repoRoot, ".pulse", "onboarding.json");
  const statePath = path.join(repoRoot, ".pulse", "state.json");

  const agentsText = readTextIfExists(agentsPath);
  const agentsExists = agentsText.trim() !== "";
  const managedAgents = agentsExists && managedAgentsPresent(agentsText);

  const configText = readTextIfExists(configPath);
  const hooksText = readTextIfExists(hooksPath);

  let onboarding = {};
  if (fs.existsSync(onboardingPath)) {
    try {
      onboarding = JSON.parse(fs.readFileSync(onboardingPath, "utf8"));
    } catch {
      onboarding = {};
    }
  }

  const compactPromptManaged = hasManagedCompactPrompt(configText);
  const compactPromptConflict = hasCompactPrompt(configText) && !compactPromptManaged;

  const legacyLearningSources = collectLegacyLearningSources(repoRoot);
  const legacyCriticalPatternsPath = path.join(repoRoot, "history", "learning", "critical-patterns.md");
  const legacyVerificationArtifacts = collectLegacyVerificationArtifacts(repoRoot);

  const actions = [];
  if (!agentsExists) {
    actions.push("create_AGENTS.md");
  } else if (!managedAgents) {
    actions.push("append_pulse_managed_block_to_AGENTS.md");
  }

  if (!configText) {
    actions.push("create_.codex/config.toml");
  } else {
    const projectDocMaxBytes = findProjectDocMaxBytes(configText);
    if (projectDocMaxBytes === undefined || projectDocMaxBytes < 65536) {
      actions.push("set_project_doc_max_bytes");
    }
    if (!isCodexHooksEnabled(configText)) {
      actions.push("enable_features.codex_hooks");
    }
    if (compactPromptConflict) {
      actions.push("compact_prompt_requires_confirmation");
    } else if (!compactPromptManaged) {
      actions.push("install_pulse_compact_prompt");
    }
  }

  let hooksNeedMerge = false;
  if (!hooksText) {
    actions.push("create_.codex/hooks.json");
    hooksNeedMerge = true;
  } else {
    try {
      hooksNeedMerge = mergeHooksJson(hooksPath).text !== `${hooksText.replace(/\s*$/, "")}\n`;
    } catch {
      hooksNeedMerge = true;
    }
  }

  if (hooksNeedMerge) {
    actions.push("install_pulse_hook_entries");
  }

  if (hookScriptsNeedUpdate(repoRoot)) {
    actions.push("sync_pulse_hook_scripts");
  }

  if (supportScriptsNeedUpdate(repoRoot)) {
    actions.push("sync_pulse_support_scripts");
  }

  const state = readJsonIfExists(statePath);
  const normalizedState = normalizePulseState(state);
  const stateNeedsWrite =
    !state || JSON.stringify(state, null, 2) !== JSON.stringify(normalizedState, null, 2);
  if (stateNeedsWrite) {
    actions.push("write_.pulse/state.json");
  }

  if (onboarding.plugin_version !== pluginVersion) {
    actions.push("write_.pulse/onboarding.json");
  }

  if (legacyLearningSources.length > 0) {
    actions.push("migrate_legacy_learning_memory");
  }

  if (fs.existsSync(legacyCriticalPatternsPath)) {
    actions.push("migrate_legacy_critical_patterns");
  }

  if (legacyVerificationArtifacts.length > 0) {
    actions.push("migrate_legacy_verification_artifacts");
  }

  return {
    repo_root: repoRoot,
    status: actions.length === 0 ? "up_to_date" : "needs_onboarding",
    actions,
    requires_confirmation: compactPromptConflict,
    details: {
      plugin_version: pluginVersion,
      agents_exists: agentsExists,
      agents_managed_block: managedAgents,
      config_exists: fs.existsSync(configPath),
      hooks_exists: fs.existsSync(hooksPath),
      compact_prompt_conflict: compactPromptConflict,
      onboarding_state: Object.keys(onboarding).length > 0 ? onboarding : null,
      state_exists: fs.existsSync(statePath),
      runtime,
      dependency_health: dependencyHealth,
      dependency_warning: dependencyWarning,
      legacy_learning_sources: legacyLearningSources.map((sourcePath) => toPosixRelative(repoRoot, sourcePath)),
      legacy_critical_patterns: fs.existsSync(legacyCriticalPatternsPath)
        ? toPosixRelative(repoRoot, legacyCriticalPatternsPath)
        : "",
      legacy_verification_features: legacyVerificationArtifacts.map((entry) => ({
        feature: entry.featureKey,
        verification_root: toPosixRelative(repoRoot, entry.verificationRoot),
        files: entry.files.map((filePath) => toPosixRelative(repoRoot, filePath)),
      })),
    },
  };
}

export function applyRepo(repoRoot, allowCompactPromptReplace) {
  const runtime = getNodeRuntimeStatus();
  if (!runtime.supported) {
    return buildRuntimeBlockedPayload(repoRoot, "apply");
  }

  const pluginVersion = loadPluginVersion();
  const template = readTemplate();

  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const configPath = path.join(repoRoot, ".codex", "config.toml");
  const hooksPath = path.join(repoRoot, ".codex", "hooks.json");
  const onboardingPath = path.join(repoRoot, ".pulse", "onboarding.json");
  const statePath = path.join(repoRoot, ".pulse", "state.json");
  const checkpointsRootPath = path.join(repoRoot, ".pulse", "checkpoints");
  const memoryRootPath = path.join(repoRoot, ".pulse", "memory");
  const memoryLearningsPath = path.join(memoryRootPath, "learnings");
  const memoryCorrectionsPath = path.join(memoryRootPath, "corrections");
  const memoryRatchetPath = path.join(memoryRootPath, "ratchet");

  ensureParent(agentsPath);
  ensureParent(configPath);
  ensureParent(hooksPath);
  ensureParent(onboardingPath);
  ensureParent(statePath);
  fs.mkdirSync(checkpointsRootPath, { recursive: true });
  fs.mkdirSync(memoryLearningsPath, { recursive: true });
  fs.mkdirSync(memoryCorrectionsPath, { recursive: true });
  fs.mkdirSync(memoryRatchetPath, { recursive: true });

  const mergedAgents = mergeAgentsContent(readTextIfExists(agentsPath), template);
  fs.writeFileSync(agentsPath, mergedAgents.text, "utf8");

  const configResult = mergeCodexConfig(configPath, allowCompactPromptReplace);
  fs.writeFileSync(configPath, configResult.text, "utf8");

  const hooksResult = mergeHooksJson(hooksPath);
  fs.writeFileSync(hooksPath, hooksResult.text, "utf8");

  const defaultState = buildDefaultState();
  const nextState = normalizePulseState({
    ...defaultState,
    ...readJsonIfExists(statePath),
  });
  fs.writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  syncPulseRuntimeArtifacts(repoRoot);

  const hookScripts = writeHookScripts(repoRoot);
  const supportScripts = writeSupportScripts(repoRoot);

  const onboardingNotes = [];
  let status = "complete";
  if (configResult.changes.includes("compact_prompt_conflict_preserved")) {
    status = "partial";
    onboardingNotes.push(
      "Existing compact_prompt preserved; Pulse compaction recovery was not installed.",
    );
  }

  const legacyLearningMigration = migrateLegacyLearningMemory(repoRoot);
  const legacyCriticalPatternsMigration = mergeLegacyCriticalPatterns(repoRoot);
  const legacyVerificationMigration = migrateLegacyVerificationArtifacts(repoRoot);
  const migrationConflicts = [
    ...legacyLearningMigration.conflicts,
    ...legacyVerificationMigration.conflicts,
  ];
  if (migrationConflicts.length > 0) {
    onboardingNotes.push(
      `Legacy migration preserved canonical v3 destinations for ${migrationConflicts.length} conflicting path(s).`,
    );
  }

  const onboardingPayload = {
    schema_version: ONBOARDING_SCHEMA_VERSION,
    plugin: "pulse",
    plugin_version: pluginVersion,
    installed_at: utcNow(),
    status,
    managed_assets: {
      agents_mode: mergedAgents.status,
      config_changes: configResult.changes,
      hook_changes: hooksResult.changes,
      hook_scripts: hookScripts,
      support_scripts: supportScripts,
      state_file: path.relative(repoRoot, statePath),
      checkpoints_root: path.relative(repoRoot, checkpointsRootPath),
      memory_root: path.relative(repoRoot, memoryRootPath),
      memory_directories: [
        path.relative(repoRoot, memoryLearningsPath),
        path.relative(repoRoot, memoryCorrectionsPath),
        path.relative(repoRoot, memoryRatchetPath),
      ],
      migration_summary: {
        legacy_learning_sources: legacyLearningMigration.sources_found,
        migrated_learning_files: legacyLearningMigration.migrated_files,
        normalized_counts: legacyLearningMigration.normalized_counts,
        critical_patterns_appended: legacyCriticalPatternsMigration.appended_entries,
        legacy_verification_features: legacyVerificationMigration.features_found,
        verification_files_copied: legacyVerificationMigration.copied_files,
        conflicts_skipped: migrationConflicts,
        outputs: {
          learning_memory: legacyLearningMigration.outputs,
        },
      },
    },
    notes: onboardingNotes,
  };
  fs.writeFileSync(`${onboardingPath}`, `${JSON.stringify(onboardingPayload, null, 2)}\n`, "utf8");

  return {
    ...checkRepo(repoRoot),
    applied: true,
    result: onboardingPayload,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCliArgs(argv) {
  const args = {
    repoRoot: undefined,
    apply: false,
    allowCompactPromptReplace: false,
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
    if (arg === "--allow-compact-prompt-replace") {
      args.allowCompactPromptReplace = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        [
          "Usage: onboard_pulse.mjs [--repo-root <path>] [--apply] [--allow-compact-prompt-replace]",
          "",
          "Checks or applies Pulse repo onboarding.",
        ].join("\n"),
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  const repoRoot = resolveRepoRoot(args.repoRoot);
  const payload = args.apply
    ? applyRepo(repoRoot, args.allowCompactPromptReplace)
    : checkRepo(repoRoot);

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  return payload.status === "missing_runtime" ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  process.exitCode = main();
}
