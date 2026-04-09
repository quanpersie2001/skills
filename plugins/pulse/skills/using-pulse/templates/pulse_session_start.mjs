#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readDependencyHealthSafe,
  normalizeDependencyTarget,
  uniqueSorted,
} from "../pulse_dependencies.mjs";
import { readGkgReadiness } from "../pulse_state.mjs";

function findRepoRoot(start) {
  let candidate = path.resolve(start || ".");
  while (true) {
    if (fs.existsSync(path.join(candidate, ".pulse", "onboarding.json"))) {
      return candidate;
    }
    if (fs.existsSync(path.join(candidate, ".git"))) {
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return candidate;
    }
    candidate = parent;
  }
}

async function readPayload() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

function buildSessionDependencyWarning(repoRoot) {
  const dependencyHealth = readDependencyHealthSafe(repoRoot);

  const missingDependencies = Array.isArray(dependencyHealth?.missing_dependencies)
    ? dependencyHealth.missing_dependencies
    : [];
  if (missingDependencies.length === 0) {
    return "";
  }

  const affectedSkills = uniqueSorted(
    missingDependencies.flatMap((dependency) =>
      Array.isArray(dependency.required_by) ? dependency.required_by : [],
    ),
  );
  const missingCommands = uniqueSorted(
    missingDependencies
      .filter((dependency) => dependency.kind === "command")
      .flatMap((dependency) => normalizeDependencyTarget(dependency.target)),
  );
  const missingMcpServers = uniqueSorted(
    missingDependencies
      .filter((dependency) => dependency.kind === "mcp_server")
      .flatMap((dependency) => normalizeDependencyTarget(dependency.target)),
  );

  const affected = affectedSkills.length > 0 ? affectedSkills.join(", ") : "(unknown skills)";
  const commands = missingCommands.length > 0 ? missingCommands.join(", ") : "none";
  const mcpServers = missingMcpServers.length > 0 ? missingMcpServers.join(", ") : "none";

  return (
    `Dependency warning: ${missingDependencies.length} declared dependencies are missing, ` +
    `so some Pulse skills are degraded or unavailable. ` +
    `Affected skills: ${affected}. ` +
    `Missing commands: ${commands}. ` +
    `Missing MCP server configuration: ${mcpServers}.`
  );
}

export async function main() {
  const payload = await readPayload();
  const repoRoot = findRepoRoot(payload.cwd || ".");
  const onboardingPath = path.join(repoRoot, ".pulse", "onboarding.json");
  const criticalPatterns = path.join(repoRoot, "history", "learnings", "critical-patterns.md");

  const notes = [];
  if (fs.existsSync(onboardingPath)) {
    notes.push(
      "Pulse onboarding is installed for this repo. Read AGENTS.md, then run node .codex/pulse_status.mjs --json for a quick scout before substantive work.",
    );
  } else {
    notes.push("Pulse onboarding is missing in this repo. Load pulse:using-pulse before continuing.");
  }

  if (fs.existsSync(criticalPatterns)) {
    notes.push("If you move into planning or execution, read history/learnings/critical-patterns.md.");
  }

  const gkgReadiness = await readGkgReadiness(repoRoot);
  if (gkgReadiness.supported_repo && (!gkgReadiness.server_reachable || !gkgReadiness.project_indexed)) {
    notes.push(`gkg readiness: ${gkgReadiness.recommended_action}`);
  } else if (!gkgReadiness.supported_repo) {
    notes.push(
      "This repo is outside gkg's supported language set, so architecture discovery should use grep/file inspection fallback.",
    );
  }

  const dependencyWarning = buildSessionDependencyWarning(repoRoot);
  if (dependencyWarning) {
    notes.push(dependencyWarning);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: notes.join(" "),
      },
    }),
  );
  return 0;
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  const argvPath = path.resolve(process.argv[1]);
  const selfPath = fileURLToPath(import.meta.url);
  if (argvPath === selfPath) {
    return true;
  }

  try {
    return fs.realpathSync.native(argvPath) === fs.realpathSync.native(selfPath);
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  process.exitCode = await main();
}
