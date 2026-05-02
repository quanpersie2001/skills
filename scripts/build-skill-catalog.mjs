#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const skillsRoot = path.join(repoRoot, "skills");
const outputDir = path.join(repoRoot, "generated");
const outputJsonPath = path.join(outputDir, "skill-catalog.json");
const outputMdPath = path.join(outputDir, "skill-catalog.md");

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log(`Build Pulse skill catalog artifacts

Usage:
  node scripts/build-skill-catalog.mjs [--check]

Options:
  --check   Validate generated files are current and exit non-zero on drift
  --help    Show this help
`);
}

function readFrontmatter(raw, filePath) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`Missing YAML frontmatter in ${path.relative(repoRoot, filePath)}`);
  }

  const frontmatter = match[1];
  const lines = frontmatter.split(/\r?\n/);

  let name = null;
  let description = null;
  let metadataVersion = null;
  let metadataPosition = null;
  let inMetadata = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    if (/^metadata\s*:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }

    const topLevelMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (topLevelMatch && !line.startsWith("  ")) {
      inMetadata = false;
      const key = topLevelMatch[1];
      const rawValue = topLevelMatch[2];
      if (key === "name") name = normalizeScalar(rawValue);
      if (key === "description") {
        const parsed = parseFieldValue(lines, index, rawValue);
        description = parsed.value;
        index = parsed.nextIndex;
      }
      continue;
    }

    if (inMetadata) {
      const metadataMatch = line.match(/^\s{2}([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!metadataMatch) continue;
      const key = metadataMatch[1];
      const value = normalizeScalar(metadataMatch[2]);
      if (key === "version") metadataVersion = value;
      if (key === "position") metadataPosition = value;
    }
  }

  return {
    name,
    description,
    metadata: {
      version: metadataVersion,
      position: metadataPosition,
    },
  };
}

function normalizeScalar(raw) {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value) return "";

  const singleQuoted = value.match(/^'(.*)'$/);
  if (singleQuoted) return singleQuoted[1];

  const doubleQuoted = value.match(/^"(.*)"$/);
  if (doubleQuoted) return doubleQuoted[1];

  return value;
}

function parseFieldValue(lines, startIndex, rawValue) {
  const normalized = normalizeScalar(rawValue);
  if (normalized !== ">" && normalized !== ">-" && normalized !== "|" && normalized !== "|-" ) {
    return { value: normalized, nextIndex: startIndex };
  }

  const blockLines = [];
  let nextIndex = startIndex;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("  ")) {
      break;
    }

    blockLines.push(line.slice(2));
    nextIndex = index;
  }

  const trimmedLines = blockLines.map((line) => line.trim());
  const value = normalized.startsWith(">")
    ? trimmedLines.filter(Boolean).join(" ")
    : trimmedLines.join("\n").trim();

  return { value, nextIndex };
}

function collectSkills() {
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Skills root not found: ${path.relative(repoRoot, skillsRoot)}`);
  }

  const entries = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const skills = [];
  const errors = [];
  const nameToDir = new Map();

  for (const dirName of entries) {
    const skillDir = path.join(skillsRoot, dirName);
    const skillMdPath = path.join(skillDir, "SKILL.md");

    if (!fs.existsSync(skillMdPath)) {
      errors.push(`Missing SKILL.md for directory: skills/${dirName}`);
      continue;
    }

    const raw = fs.readFileSync(skillMdPath, "utf8");
    const parsed = readFrontmatter(raw, skillMdPath);

    if (!parsed.name) {
      errors.push(`Missing frontmatter name in skills/${dirName}/SKILL.md`);
      continue;
    }

    if (nameToDir.has(parsed.name) && nameToDir.get(parsed.name) !== dirName) {
      errors.push(
        `Duplicate skill name mapping: "${parsed.name}" appears in ${nameToDir.get(parsed.name)} and ${dirName}`,
      );
      continue;
    }

    nameToDir.set(parsed.name, dirName);

    skills.push({
      directory: dirName,
      name: parsed.name,
      description: parsed.description ?? "",
      metadata: {
        version: parsed.metadata.version,
        position: parsed.metadata.position,
      },
      hasReferencesDir: fs.existsSync(path.join(skillDir, "references")),
      hasScriptsDir: fs.existsSync(path.join(skillDir, "scripts")),
      hasAgentsDir: fs.existsSync(path.join(skillDir, "agents")),
      skillPath: `skills/${dirName}/SKILL.md`,
    });
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return skills;
}

function buildJson(skills) {
  return {
    schemaVersion: 1,
    sourceRoot: "skills",
    generatedFiles: [
      "generated/skill-catalog.json",
      "generated/skill-catalog.md",
    ],
    skillCount: skills.length,
    skills,
  };
}

function buildMarkdown(skills) {
  const lines = [
    "# Pulse Skill Catalog",
    "",
    "Generated by `scripts/build-skill-catalog.mjs`.",
    "",
    `Total skills: ${skills.length}`,
    "",
    "| Directory | Name | Version | Position | References | Scripts | Agents |",
    "|---|---|---|---|---:|---:|---:|",
  ];

  for (const skill of skills) {
    lines.push(
      `| ${skill.directory} | ${escapeCell(skill.name)} | ${escapeCell(skill.metadata.version ?? "")} | ${escapeCell(skill.metadata.position ?? "")} | ${skill.hasReferencesDir ? "yes" : "no"} | ${skill.hasScriptsDir ? "yes" : "no"} | ${skill.hasAgentsDir ? "yes" : "no"} |`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}`;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

function ensureOutputDir() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function checkOutput(pathName, expectedContent) {
  if (!fs.existsSync(pathName)) {
    return { ok: false, reason: `${path.relative(repoRoot, pathName)} is missing` };
  }

  const current = fs.readFileSync(pathName, "utf8");
  if (current !== expectedContent) {
    return { ok: false, reason: `${path.relative(repoRoot, pathName)} is stale` };
  }

  return { ok: true, reason: "" };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const skills = collectSkills();
  const jsonContent = `${JSON.stringify(buildJson(skills), null, 2)}\n`;
  const mdContent = buildMarkdown(skills);

  if (args.check) {
    const jsonCheck = checkOutput(outputJsonPath, jsonContent);
    const mdCheck = checkOutput(outputMdPath, mdContent);

    const failures = [jsonCheck, mdCheck].filter((x) => !x.ok);
    if (failures.length > 0) {
      for (const failure of failures) {
        console.error(failure.reason);
      }
      process.exit(1);
    }

    console.log("skill catalog is up to date");
    return;
  }

  ensureOutputDir();
  fs.writeFileSync(outputJsonPath, jsonContent, "utf8");
  fs.writeFileSync(outputMdPath, mdContent, "utf8");
  console.log("wrote generated/skill-catalog.json and generated/skill-catalog.md");
}

main();
