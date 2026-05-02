#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    workspace: path.join(repoRoot, "pulse-eval-workspace"),
    runCmd: null,
    iteration: null,
    evalIds: null,
    skipStatic: false,
    skipRuntime: false,
    skipScenarios: false,
    strict: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--workspace") args.workspace = path.resolve(argv[++i]);
    else if (token === "--run-cmd") args.runCmd = argv[++i];
    else if (token === "--iteration") args.iteration = argv[++i];
    else if (token === "--eval-ids") args.evalIds = argv[++i];
    else if (token === "--skip-static") args.skipStatic = true;
    else if (token === "--skip-runtime") args.skipRuntime = true;
    else if (token === "--skip-scenarios") args.skipScenarios = true;
    else if (token === "--strict") args.strict = true;
    else if (token === "--json") args.json = true;
    else if (token === "--help" || token === "-h") args.help = true;
    else throw new Error(`Unknown option: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log(`Pulse plugin evaluation runner

Usage:
  node scripts/pulse-plugin-eval.mjs [options]

Options:
  --workspace <path>      Eval workspace (default: pulse-eval-workspace)
  --run-cmd <command>     Optional command to execute before scenario checks
  --iteration <name|num>  Explicit iteration (e.g. iteration-6 or 6)
  --eval-ids <list>       Comma-separated eval IDs to require (e.g. 7,8,19)
  --skip-static           Skip static manifest/skill checks
  --skip-runtime          Skip runtime dependency checks
  --skip-scenarios        Skip scenario/benchmark checks
  --strict                Exit non-zero when any WARN occurs
  --json                  Print JSON summary only
  --help                  Show this help
`);
}

function exists(p) {
  return fs.existsSync(p);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function addResult(results, phase, name, status, detail) {
  results.push({ phase, name, status, detail });
}

function findSkillCountClaims(raw) {
  const claims = [];
  const lines = raw.split(/\r?\n/);
  const claimPattern = /\b(\d{1,4})\b(?:\s+[A-Za-z][\w-]*){0,2}\s+skills?\b/gi;

  lines.forEach((line, index) => {
    let match;
    while ((match = claimPattern.exec(line)) !== null) {
      claims.push({
        count: Number(match[1]),
        line: index + 1,
        snippet: line.trim(),
      });
    }
  });

  return claims;
}

function findMissingMarkers(raw, markers) {
  return markers.filter(({ pattern }) => !pattern.test(raw)).map(({ label }) => label);
}

function runMemorySkillBoundaryChecks(results, skillsRoot) {
  const contracts = [
    {
      name: "dev-note",
      filePath: path.join(skillsRoot, "dev-note", "SKILL.md"),
      markers: [
        { label: "explicit user request boundary", pattern: /explicit user request/i },
        { label: "never auto-capture rule", pattern: /never auto-capture/i },
        { label: "current conversation scope", pattern: /current conversation/i },
      ],
    },
    {
      name: "dev-note-distil",
      filePath: path.join(skillsRoot, "dev-note-distil", "SKILL.md"),
      markers: [
        { label: "reader-facing scope", pattern: /reader-facing/i },
        { label: "runtime-memory exclusion", pattern: /not for runtime memory consolidation/i },
        { label: "compounding exclusion", pattern: /not for post-cycle compounding/i },
      ],
    },
    {
      name: "dream",
      filePath: path.join(skillsRoot, "dream", "SKILL.md"),
      markers: [
        { label: "machine-readable scope", pattern: /machine-readable/i },
        { label: "runtime artifact scope", pattern: /runtime artifacts/i },
        { label: "reader-facing exclusion", pattern: /not for reader-facing dev-note synthesis/i },
        { label: "compounding contrast", pattern: /does not replace compounding after completed Pulse work/i },
      ],
    },
    {
      name: "compounding",
      filePath: path.join(skillsRoot, "compounding", "SKILL.md"),
      markers: [
        { label: "post-cycle scope", pattern: /post-cycle/i },
        { label: "machine-readable scope", pattern: /machine-readable/i },
        { label: "completed Pulse work scope", pattern: /completed Pulse work/i },
        { label: "dream contrast", pattern: /Use `pulse:dream` for runtime-artifact consolidation outside that post-cycle moment\./i },
      ],
    },
  ];

  const issues = [];

  for (const contract of contracts) {
    if (!exists(contract.filePath)) {
      issues.push(`${contract.name} missing file`);
      continue;
    }

    const raw = fs.readFileSync(contract.filePath, "utf8");
    const missing = findMissingMarkers(raw, contract.markers);
    if (missing.length > 0) {
      issues.push(`${contract.name} missing ${missing.join(", ")}`);
    }
  }

  const usingPulsePath = path.join(skillsRoot, "using-pulse", "SKILL.md");
  if (!exists(usingPulsePath)) {
    issues.push("using-pulse missing file");
  } else {
    const usingPulseRaw = fs.readFileSync(usingPulsePath, "utf8");
    const routingMissing = findMissingMarkers(usingPulseRaw, [
      { label: "dev-note route", pattern: /Note this learning from this conversation/i },
      { label: "dev-note-distil route", pattern: /Distill accumulated dev notes for reading/i },
      { label: "dream route", pattern: /Consolidate runtime artifacts into machine memory/i },
      { label: "compounding route", pattern: /Capture post-cycle machine learnings/i },
    ]);
    if (routingMissing.length > 0) {
      issues.push(`using-pulse missing ${routingMissing.join(", ")}`);
    }
  }

  addResult(
    results,
    "static",
    "memory-skill-boundary-contract",
    issues.length === 0 ? "PASS" : "WARN",
    issues.length === 0 ? "memory skill boundaries are explicit" : issues.join("; "),
  );
}

function runStaticChecks(results) {
  const pluginManifestPath = path.join(repoRoot, ".codex-plugin/plugin.json");
  const claudePluginPath = path.join(repoRoot, ".claude-plugin/plugin.json");
  const claudeMarketplacePath = path.join(repoRoot, ".claude-plugin/marketplace.json");
  const marketplacePath = path.join(repoRoot, ".agents/plugins/marketplace.json");
  const mcpPath = path.join(repoRoot, ".mcp.json");
  const skillsRoot = path.join(repoRoot, "skills");

  const required = [pluginManifestPath, claudePluginPath, claudeMarketplacePath, marketplacePath, mcpPath, skillsRoot];
  for (const p of required) {
    addResult(results, "static", `exists:${path.relative(repoRoot, p)}`, exists(p) ? "PASS" : "FAIL", "");
  }

  if (!required.every(exists)) return;

  const manifest = readJson(pluginManifestPath);
  const claudePlugin = readJson(claudePluginPath);
  const claudeMarketplace = readJson(claudeMarketplacePath);
  const marketplace = readJson(marketplacePath);
  const mcp = readJson(mcpPath);

  const manifestVersion = manifest?.plugins?.[0]?.version ?? manifest?.version;
  const pluginVersion = claudePlugin?.version;
  const marketplaceVersion = marketplace?.plugins?.find((p) => p.name === "pulse")?.version;
  const claudeMarketplaceSource = claudeMarketplace?.plugins?.find((p) => p.name === "pulse")?.source;
  const marketplaceSourceRaw = marketplace?.plugins?.find((p) => p.name === "pulse")?.source;
  const marketplaceSource = typeof marketplaceSourceRaw === "string"
    ? marketplaceSourceRaw
    : marketplaceSourceRaw?.path;

  addResult(
    results,
    "static",
    "version-sync",
    manifestVersion && pluginVersion && marketplaceVersion && manifestVersion === pluginVersion && pluginVersion === marketplaceVersion ? "PASS" : "WARN",
    `manifest=${manifestVersion ?? "n/a"}, plugin=${pluginVersion ?? "n/a"}, marketplace=${marketplaceVersion ?? "n/a"}`,
  );
  addResult(
    results,
    "static",
    "claude-plugin-path-contract",
    claudePlugin?.skills === "./skills/" && claudePlugin?.mcpServers === "./.mcp.json" ? "PASS" : "WARN",
    `skills=${claudePlugin?.skills ?? "n/a"}, mcpServers=${claudePlugin?.mcpServers ?? "n/a"}`,
  );
  addResult(
    results,
    "static",
    "claude-marketplace-source",
    claudeMarketplaceSource === "." || claudeMarketplaceSource === "./" ? "PASS" : "WARN",
    `source=${claudeMarketplaceSource ?? "n/a"}`,
  );
  addResult(
    results,
    "static",
    "codex-marketplace-source",
    marketplaceSource === "." || marketplaceSource === "./" ? "PASS" : "WARN",
    `source=${marketplaceSource ?? "n/a"}`,
  );

  const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  const missingSkillFiles = skillDirs
    .map((d) => path.join(skillsRoot, d.name, "SKILL.md"))
    .filter((p) => !exists(p));

  const actualSkillCount = skillDirs.length;
  const skillCountClaimFiles = [
    path.join(repoRoot, "README.md"),
    path.join(repoRoot, "CONTRIBUTING.md"),
    path.join(repoRoot, "CLAUDE.md"),
    marketplacePath,
  ];
  const driftDetails = [];

  for (const filePath of skillCountClaimFiles) {
    if (!exists(filePath)) {
      driftDetails.push(`${path.relative(repoRoot, filePath)} (missing)`);
      continue;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const claims = findSkillCountClaims(raw);
    for (const claim of claims) {
      if (claim.count !== actualSkillCount) {
        driftDetails.push(
          `${path.relative(repoRoot, filePath)}:${claim.line} claims ${claim.count} skills (actual=${actualSkillCount})`,
        );
      }
    }
  }

  addResult(results, "static", "skills-discovered", skillDirs.length > 0 ? "PASS" : "FAIL", `count=${skillDirs.length}`);
  addResult(
    results,
    "static",
    "skill-count-claims-sync",
    driftDetails.length === 0 ? "PASS" : "WARN",
    driftDetails.length === 0 ? `all checked claims match actual=${actualSkillCount}` : driftDetails.join("; "),
  );
  addResult(
    results,
    "static",
    "skill-markdown-contract",
    missingSkillFiles.length === 0 ? "PASS" : "FAIL",
    missingSkillFiles.length === 0 ? "all skill dirs include SKILL.md" : missingSkillFiles.map((p) => path.relative(repoRoot, p)).join(", "),
  );
  runMemorySkillBoundaryChecks(results, skillsRoot);

  const catalogCheck = spawnSync(process.execPath, [path.join(repoRoot, "scripts/build-skill-catalog.mjs"), "--check"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  addResult(
    results,
    "static",
    "skill-catalog-generated",
    catalogCheck.status === 0 ? "PASS" : "FAIL",
    [catalogCheck.stdout, catalogCheck.stderr].filter(Boolean).join("\n").trim() || "(no output)",
  );

  const mcpServers = Object.keys(mcp || {});
  addResult(results, "static", "mcp-servers-parse", mcpServers.length > 0 ? "PASS" : "WARN", `servers=${mcpServers.join(", ") || "none"}`);
}

function checkCommand(command) {
  const shell = process.platform === "win32" ? "cmd" : "sh";
  const shellFlag = process.platform === "win32" ? "/c" : "-c";
  const out = spawnSync(shell, [shellFlag, `command -v ${command}`], { encoding: "utf8" });
  return out.status === 0;
}

function runRuntimeChecks(results, runCmd) {
  const requiredCommands = ["git", "br", "bv"];
  for (const cmd of requiredCommands) {
    addResult(results, "runtime", `command:${cmd}`, checkCommand(cmd) ? "PASS" : "WARN", "");
  }

  if (runCmd) {
    const shell = process.platform === "win32" ? "cmd" : "sh";
    const shellFlag = process.platform === "win32" ? "/c" : "-c";
    const out = spawnSync(shell, [shellFlag, runCmd], { encoding: "utf8" });
    const status = out.status === 0 ? "PASS" : "FAIL";
    const detail = [out.stdout, out.stderr].filter(Boolean).join("\n").trim().slice(0, 2000);
    addResult(results, "runtime", "scenario-run-command", status, detail || "(no output)");
  }
}

function normalizeIterationName(iterationArg) {
  if (!iterationArg) return null;
  if (iterationArg.startsWith("iteration-")) return iterationArg;
  if (/^\d+$/.test(iterationArg)) return `iteration-${iterationArg}`;
  return iterationArg;
}

function findLatestIteration(workspacePath) {
  const dirs = fs
    .readdirSync(workspacePath, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^iteration-\d+$/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
  return dirs[dirs.length - 1] ?? null;
}

function parseEvalIds(csv) {
  if (!csv) return null;
  return csv
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function runScenarioChecks(results, workspacePath, iterationArg, evalIdsArg) {
  const evalsPath = path.join(workspacePath, "evals.json");
  const reviewPath = path.join(workspacePath, "pulse-eval-review.html");

  addResult(results, "scenarios", "evals-json", exists(evalsPath) ? "PASS" : "FAIL", path.relative(repoRoot, evalsPath));
  addResult(results, "scenarios", "review-ui", exists(reviewPath) ? "PASS" : "WARN", path.relative(repoRoot, reviewPath));
  if (!exists(evalsPath)) return;

  const evals = readJson(evalsPath);
  const evalIds = new Set((evals.evals || []).map((e) => e.id));
  addResult(results, "scenarios", "scenario-count", evalIds.size > 0 ? "PASS" : "FAIL", `count=${evalIds.size}`);

  const requestedIds = parseEvalIds(evalIdsArg);
  if (requestedIds && requestedIds.length > 0) {
    const missing = requestedIds.filter((id) => !evalIds.has(id));
    addResult(
      results,
      "scenarios",
      "requested-eval-ids",
      missing.length === 0 ? "PASS" : "FAIL",
      missing.length === 0 ? `all present: ${requestedIds.join(",")}` : `missing: ${missing.join(",")}`,
    );
  }

  const requestedIteration = normalizeIterationName(iterationArg);
  const pickedIteration = requestedIteration || findLatestIteration(workspacePath);
  if (!pickedIteration) {
    addResult(results, "scenarios", "iteration-detected", "WARN", "no iteration-* directories found");
    return;
  }

  const iterationPath = path.join(workspacePath, pickedIteration);
  const benchmarkJsonPath = path.join(iterationPath, "benchmark.json");
  const benchmarkMdPath = path.join(iterationPath, "benchmark.md");

  addResult(results, "scenarios", "iteration-detected", exists(iterationPath) ? "PASS" : "FAIL", pickedIteration);
  addResult(results, "scenarios", "benchmark-json", exists(benchmarkJsonPath) ? "PASS" : "WARN", path.relative(repoRoot, benchmarkJsonPath));
  addResult(results, "scenarios", "benchmark-md", exists(benchmarkMdPath) ? "PASS" : "WARN", path.relative(repoRoot, benchmarkMdPath));

  if (!exists(benchmarkJsonPath)) return;

  const benchmark = readJson(benchmarkJsonPath);
  const runSummary = benchmark.run_summary || {};
  const withSkillPassRate = runSummary.with_skill?.pass_rate?.mean;
  const withoutSkillPassRate = runSummary.without_skill?.pass_rate?.mean;
  const deltaTime = runSummary.delta?.time_seconds;

  const detail = `with_skill_pass_rate=${withSkillPassRate ?? "n/a"}, without_skill_pass_rate=${withoutSkillPassRate ?? "n/a"}, delta_time=${deltaTime ?? "n/a"}`;
  addResult(results, "scenarios", "benchmark-summary", "PASS", detail);

  const discriminatingNote = Array.isArray(benchmark.notes)
    ? benchmark.notes.find((n) => /non-discriminating|discriminating/i.test(n))
    : null;
  addResult(
    results,
    "scenarios",
    "discrimination-signal",
    discriminatingNote ? "PASS" : "WARN",
    discriminatingNote || "no explicit discrimination note found",
  );
}

function finalize(results, strict) {
  const counts = {
    PASS: results.filter((r) => r.status === "PASS").length,
    WARN: results.filter((r) => r.status === "WARN").length,
    FAIL: results.filter((r) => r.status === "FAIL").length,
  };

  const shouldFail = counts.FAIL > 0 || (strict && counts.WARN > 0);
  return { counts, shouldFail };
}

function printText(results, counts) {
  const phases = ["static", "runtime", "scenarios"];
  for (const phase of phases) {
    const items = results.filter((r) => r.phase === phase);
    if (items.length === 0) continue;
    console.log(`\n[${phase}]`);
    for (const item of items) {
      const suffix = item.detail ? ` — ${item.detail}` : "";
      console.log(`${item.status.padEnd(4)} ${item.name}${suffix}`);
    }
  }

  console.log(`\nSummary: PASS=${counts.PASS} WARN=${counts.WARN} FAIL=${counts.FAIL}`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error.message || error));
    process.exit(2);
  }

  if (args.help) {
    printHelp();
    return;
  }

  const results = [];
  const workspacePath = args.workspace;

  if (!args.skipStatic) runStaticChecks(results);
  if (!args.skipRuntime) runRuntimeChecks(results, args.runCmd);
  if (!args.skipScenarios) runScenarioChecks(results, workspacePath, args.iteration, args.evalIds);

  const { counts, shouldFail } = finalize(results, args.strict);
  const output = {
    workspace: workspacePath,
    strict: args.strict,
    counts,
    status: shouldFail ? "FAIL" : "PASS",
    checks: results,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printText(results, counts);
    console.log(`Overall: ${output.status}`);
  }

  process.exit(shouldFail ? 1 : 0);
}

main();
