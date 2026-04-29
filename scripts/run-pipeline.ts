/**
 * run-pipeline.ts
 *
 * Orchestrates the canonical EQ random-loot data pipeline.
 * Each step is spawned as a child process so that existing scripts are
 * executed exactly as defined in package.json, with no reimplementation.
 *
 * Usage:
 *   node --experimental-strip-types scripts/run-pipeline.ts --mode=full
 *   node --experimental-strip-types scripts/run-pipeline.ts --mode=fast --dry-run
 *   node --experimental-strip-types scripts/run-pipeline.ts --mode=excel --continue-on-error
 *
 * Modes:
 *   fast   - corrections + validation only (no network enrichment)
 *   full   - corrections + zam enrichment + icons + validation
 *   excel  - excel ingest only
 *   scrape - zone/npc/progression scrape pipelines only
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "fast" | "full" | "excel" | "scrape";

type StepId =
  | "extract:item-names:classic"
  | "extract:item-names:all"
  | "apply:missing-corrections"
  | "apply:small-corrections"
  | "apply:manual-corrections"
  | "enrich:zam"
  | "apply:kunark-velious-corrections"
  | "mark:duplicates-clean"
  | "validate:item-details"
  | "import:item-icons:classic"
  | "import:item-icons:kunark"
  | "import:item-icons:velious"
  | "ingest:excel:tier1"
  | "normalize:factions"
  | "normalize:crafting"
  | "migrate:item-schema"
  | "enrich:zones-from-zam"
  | "enrich:npcs-from-zam"
  | "enrich:from-eqprogression";

type StepStatus = "pending" | "running" | "ok" | "skipped" | "failed";

type StepDef = {
  id: StepId;
  label: string;
  /** The node script file relative to cwd, or null if not yet implemented */
  scriptFile: string | null;
  /** Extra argv to pass after the script path */
  args?: string[];
  /** Env vars to inject */
  env?: Record<string, string>;
  /** Whether a non-zero exit is fatal (default true).  Optional steps may set false. */
  required?: boolean;
  /** Brief description for log headers */
  description: string;
  /** Estimated runtime for documentation purposes */
  estimatedSeconds: number;
};

type StepResult = {
  id: StepId;
  label: string;
  status: StepStatus;
  durationMs: number;
  exitCode: number | null;
  error?: string;
};

// ---------------------------------------------------------------------------
// Step registry — canonical order
// ---------------------------------------------------------------------------

const ALL_STEPS: StepDef[] = [
  // --- Extraction ---
  {
    id: "extract:item-names:classic",
    label: "extract:item-names (Classic)",
    scriptFile: "scripts/extract-item-names.ts",
    args: [],
    env: {},
    required: true,
    description: "Reads classic-group-named.json and writes data/item-names.json.",
    estimatedSeconds: 2,
  },
  {
    id: "extract:item-names:all",
    label: "extract:item-names (--all expansions)",
    scriptFile: "scripts/extract-item-names.ts",
    args: ["--all"],
    env: {},
    required: true,
    description: "Re-runs extract with --all flag to include Kunark/Velious names.",
    estimatedSeconds: 2,
  },

  // --- Corrections ---
  {
    id: "apply:missing-corrections",
    label: "apply:missing-corrections",
    scriptFile: "scripts/apply-missing-item-corrections.ts",
    required: true,
    description: "Fixes missing/placeholder items in the dataset and item-details.",
    estimatedSeconds: 3,
  },
  {
    id: "apply:small-corrections",
    label: "apply:small-corrections",
    scriptFile: "scripts/apply-small-item-corrections.ts",
    required: true,
    description: "Applies typo renames, set expansions, and small data fixes.",
    estimatedSeconds: 3,
  },
  {
    id: "apply:manual-corrections",
    label: "apply:manual-corrections",
    scriptFile: "scripts/apply-manual-item-corrections.ts",
    required: true,
    description: "Applies curated manual overrides: removes bad items, resolves renames.",
    estimatedSeconds: 3,
  },

  // --- Enrichment ---
  {
    id: "enrich:zam",
    label: "enrich:zam (with cache)",
    scriptFile: "scripts/enrich-items-from-zam.ts",
    env: { TARGET_EXPANSION: "Classic" },
    required: true,
    description: "Fetches item stats from Allakhazam with disk cache. Slow on cold cache (~1-3 hrs).",
    estimatedSeconds: 5400,
  },

  // --- Post-enrichment corrections ---
  {
    id: "apply:kunark-velious-corrections",
    label: "apply:kunark-velious-corrections",
    scriptFile: "scripts/apply-kunark-velious-corrections.ts",
    required: true,
    description: "Applies corrections specific to Kunark and Velious expansion items.",
    estimatedSeconds: 3,
  },
  {
    id: "mark:duplicates-clean",
    label: "mark:duplicates-clean",
    scriptFile: "scripts/mark-duplicate-items-clean.ts",
    required: true,
    description: "Resolves duplicate-name-risk flags after manual review pass.",
    estimatedSeconds: 2,
  },

  // --- Validation ---
  {
    id: "validate:item-details",
    label: "validate:item-details",
    scriptFile: "scripts/validate-item-details.ts",
    required: true,
    description: "Schema validation: checks required fields, forbidden keys, type assertions.",
    estimatedSeconds: 3,
  },

  // --- Icons ---
  {
    id: "import:item-icons:classic",
    label: "import:item-icons (classic)",
    scriptFile: "scripts/import-item-icons.ts",
    args: ["classic", "group-named"],
    required: false,
    description: "Downloads item icons from Allakhazam for Classic items.",
    estimatedSeconds: 1200,
  },
  {
    id: "import:item-icons:kunark",
    label: "import:item-icons (kunark)",
    scriptFile: "scripts/import-item-icons.ts",
    args: ["kunark", "group-named"],
    required: false,
    description: "Downloads item icons from Allakhazam for Kunark items.",
    estimatedSeconds: 900,
  },
  {
    id: "import:item-icons:velious",
    label: "import:item-icons (velious)",
    scriptFile: "scripts/import-item-icons.ts",
    args: ["velious", "group-named"],
    required: false,
    description: "Downloads item icons from Allakhazam for Velious items.",
    estimatedSeconds: 900,
  },

  // --- Optional new steps ---
  {
    id: "ingest:excel:tier1",
    label: "ingest:excel:tier1",
    scriptFile: "scripts/ingest-excel.ts",
    args: ["--all"],
    required: false,
    description: "Ingests all Excel sheets into data/excel-imports/ JSON files.",
    estimatedSeconds: 30,
  },
  {
    id: "normalize:factions",
    label: "normalize:factions",
    scriptFile: "scripts/normalize-faction-data.ts",
    required: false,
    description: "Normalizes raw factions.json into FactionEntry[] shape for the faction page.",
    estimatedSeconds: 5,
  },
  {
    id: "normalize:crafting",
    label: "normalize:crafting",
    scriptFile: "scripts/normalize-crafting-data.ts",
    required: false,
    description: "Normalizes raw crafting.json into { recipes: CraftingRecipe[] } shape for the crafting page.",
    estimatedSeconds: 5,
  },
  {
    id: "migrate:item-schema",
    label: "migrate:item-schema",
    scriptFile: "scripts/migrate-item-schema.ts",
    required: false,
    description: "Migrates item-details.json to the latest schema version.",
    estimatedSeconds: 5,
  },
  {
    id: "enrich:zones-from-zam",
    label: "enrich:zones-from-zam (optional)",
    scriptFile: null, // Not yet implemented
    required: false,
    description: "Scrapes zone metadata from Allakhazam. Script not yet implemented.",
    estimatedSeconds: 1800,
  },
  {
    id: "enrich:npcs-from-zam",
    label: "enrich:npcs-from-zam (optional)",
    scriptFile: null, // Not yet implemented
    required: false,
    description: "Scrapes NPC drop data from Allakhazam. Script not yet implemented.",
    estimatedSeconds: 1800,
  },
  {
    id: "enrich:from-eqprogression",
    label: "enrich:from-eqprogression (optional)",
    scriptFile: null, // Not yet implemented
    required: false,
    description: "Enriches item data from EQ Progression wiki. Script not yet implemented.",
    estimatedSeconds: 1800,
  },
];

// ---------------------------------------------------------------------------
// Mode definitions — which step IDs run in each mode
// ---------------------------------------------------------------------------

const MODE_STEPS: Record<Mode, StepId[]> = {
  fast: [
    "extract:item-names:classic",
    "extract:item-names:all",
    "apply:missing-corrections",
    "apply:small-corrections",
    "apply:manual-corrections",
    "apply:kunark-velious-corrections",
    "mark:duplicates-clean",
    "validate:item-details",
  ],
  full: [
    "extract:item-names:classic",
    "extract:item-names:all",
    "apply:missing-corrections",
    "apply:small-corrections",
    "apply:manual-corrections",
    "enrich:zam",
    "apply:kunark-velious-corrections",
    "mark:duplicates-clean",
    "validate:item-details",
    "import:item-icons:classic",
    "import:item-icons:kunark",
    "import:item-icons:velious",
  ],
  excel: [
    "ingest:excel:tier1",
    "normalize:factions",
    "normalize:crafting",
    "migrate:item-schema",
    "validate:item-details",
  ],
  scrape: [
    "enrich:zones-from-zam",
    "enrich:npcs-from-zam",
    "enrich:from-eqprogression",
  ],
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const raw = argv.slice(2);
  let mode: Mode = "full";
  let dryRun = false;
  let continueOnError = false;

  for (const arg of raw) {
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (!["fast", "full", "excel", "scrape"].includes(value)) {
        throw new Error(`Unknown mode: ${value}. Valid modes: fast, full, excel, scrape`);
      }
      mode = value as Mode;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--continue-on-error") {
      continueOnError = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { mode, dryRun, continueOnError };
}

function printHelp() {
  console.log([
    "",
    "Usage: node --experimental-strip-types scripts/run-pipeline.ts [options]",
    "",
    "Options:",
    "  --mode=fast|full|excel|scrape   Pipeline mode (default: full)",
    "  --dry-run                        Print steps without executing",
    "  --continue-on-error              Continue after non-zero exit codes",
    "  --help, -h                       Show this help",
    "",
    "Modes:",
    "  fast    Corrections + validation only. No network calls.",
    "  full    Full pipeline: corrections + ZAM enrichment + icons + validation.",
    "  excel   Excel ingest + schema migration + validation.",
    "  scrape  Optional scrape pipelines: ZAM zones/NPCs + EQ Progression.",
    "",
  ].join("\n"));
}

// ---------------------------------------------------------------------------
// Logging utilities
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

function nowIso() {
  return new Date().toISOString();
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

function statusColor(status: StepStatus) {
  switch (status) {
    case "ok": return `${GREEN}ok${RESET}`;
    case "failed": return `${RED}FAILED${RESET}`;
    case "skipped": return `${YELLOW}skipped${RESET}`;
    case "running": return `${CYAN}running${RESET}`;
    default: return `${DIM}pending${RESET}`;
  }
}

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

function logLine(prefix: string, message: string) {
  log(`${DIM}[${nowIso()}]${RESET} ${prefix} ${message}`);
}

// ---------------------------------------------------------------------------
// File log writer
// ---------------------------------------------------------------------------

class RunLogger {
  private lines: string[] = [];
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  write(line: string) {
    this.lines.push(line);
  }

  async flush() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, this.lines.join("\n") + "\n", "utf8");
  }

  async append(line: string) {
    this.lines.push(line);
    await appendFile(this.filePath, line + "\n", "utf8");
  }
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

const root = process.cwd();
const nodeExe = process.execPath;

async function runStep(
  step: StepDef,
  logger: RunLogger,
  dryRun: boolean,
): Promise<StepResult> {
  const startMs = Date.now();

  const header = `[${step.id}] ${step.description}`;
  log(`\n${BOLD}${CYAN}>>> ${step.label}${RESET}`);
  log(`    ${DIM}${step.description}${RESET}`);
  await logger.append(`\n${"=".repeat(72)}`);
  await logger.append(`STEP: ${step.id}`);
  await logger.append(`LABEL: ${step.label}`);
  await logger.append(`DESC: ${step.description}`);
  await logger.append(`START: ${nowIso()}`);

  // --- Script file not yet implemented ---
  if (step.scriptFile === null) {
    const msg = `Script not implemented — step will be skipped.`;
    log(`    ${YELLOW}[skip]${RESET} ${msg}`);
    await logger.append(`STATUS: skipped`);
    await logger.append(`REASON: ${msg}`);
    return {
      id: step.id,
      label: step.label,
      status: "skipped",
      durationMs: Date.now() - startMs,
      exitCode: null,
    };
  }

  const scriptPath = path.join(root, step.scriptFile);

  // --- Script file missing from disk ---
  if (!existsSync(scriptPath)) {
    const msg = `Script file not found on disk: ${step.scriptFile}`;
    log(`    ${YELLOW}[skip]${RESET} ${msg}`);
    await logger.append(`STATUS: skipped`);
    await logger.append(`REASON: ${msg}`);
    return {
      id: step.id,
      label: step.label,
      status: "skipped",
      durationMs: Date.now() - startMs,
      exitCode: null,
    };
  }

  const spawnArgs = [
    "--experimental-strip-types",
    scriptPath,
    ...(step.args ?? []),
  ];

  log(`    ${DIM}$ node ${spawnArgs.join(" ")}${RESET}`);
  await logger.append(`CMD: node ${spawnArgs.join(" ")}`);

  if (dryRun) {
    const msg = "[dry-run] Execution skipped.";
    log(`    ${YELLOW}${msg}${RESET}`);
    await logger.append(`STATUS: skipped`);
    await logger.append(`REASON: ${msg}`);
    return {
      id: step.id,
      label: step.label,
      status: "skipped",
      durationMs: Date.now() - startMs,
      exitCode: null,
    };
  }

  return new Promise<StepResult>((resolve) => {
    const child = spawn(nodeExe, spawnArgs, {
      cwd: root,
      env: {
        ...process.env,
        ...(step.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    function handleLine(stream: "stdout" | "stderr", data: Buffer) {
      const text = data.toString();
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim() === "") continue;
        const prefix = stream === "stderr" ? `${RED}[err]${RESET}` : `${DIM}[out]${RESET}`;
        log(`    ${prefix} ${line}`);
        // Log both streams to the file without ANSI codes
        logger.append(`${stream.toUpperCase()}: ${line}`).catch(() => {});
      }
    }

    child.stdout.on("data", (data: Buffer) => handleLine("stdout", data));
    child.stderr.on("data", (data: Buffer) => handleLine("stderr", data));

    child.on("close", async (code) => {
      const durationMs = Date.now() - startMs;
      const status: StepStatus = code === 0 ? "ok" : "failed";
      await logger.append(`EXIT: ${code ?? "null"}`);
      await logger.append(`DURATION: ${formatDuration(durationMs)}`);
      await logger.append(`STATUS: ${status}`);
      resolve({
        id: step.id,
        label: step.label,
        status,
        durationMs,
        exitCode: code,
      });
    });

    child.on("error", async (err) => {
      const durationMs = Date.now() - startMs;
      await logger.append(`ERROR: ${err.message}`);
      await logger.append(`STATUS: failed`);
      resolve({
        id: step.id,
        label: step.label,
        status: "failed",
        durationMs,
        exitCode: null,
        error: err.message,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------

function printSummary(results: StepResult[], totalMs: number) {
  log(`\n${BOLD}Pipeline Summary${RESET}`);
  log(`${"─".repeat(72)}`);

  const colWidths = { label: 42, status: 10, duration: 12 };

  log(
    `${BOLD}${"Step".padEnd(colWidths.label)}  ${"Status".padEnd(colWidths.status)}  ${"Duration".padEnd(colWidths.duration)}${RESET}`,
  );
  log("─".repeat(72));

  for (const r of results) {
    const label = r.label.slice(0, colWidths.label).padEnd(colWidths.label);
    const status = statusColor(r.status).padEnd(colWidths.status + 10); // +10 for ANSI chars
    const duration = formatDuration(r.durationMs).padStart(colWidths.duration);
    log(`${label}  ${status}  ${duration}`);
  }

  log("─".repeat(72));

  const failed = results.filter((r) => r.status === "failed");
  const ok = results.filter((r) => r.status === "ok");
  const skipped = results.filter((r) => r.status === "skipped");

  log(
    `Total: ${results.length} steps | ${GREEN}${ok.length} ok${RESET} | ${YELLOW}${skipped.length} skipped${RESET} | ${failed.length > 0 ? RED : ""}${failed.length} failed${failed.length > 0 ? RESET : ""} | ${formatDuration(totalMs)}`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv);
  } catch (err) {
    console.error(`${RED}Error:${RESET} ${err instanceof Error ? err.message : String(err)}`);
    printHelp();
    process.exit(1);
  }

  const { mode, dryRun, continueOnError } = parsed;

  // Build the run log path before any output so it appears in the header
  const runTs = timestamp();
  const logDir = path.join(root, "data", "pipeline-runs");
  const logPath = path.join(logDir, `${runTs}.log`);
  const logger = new RunLogger(logPath);

  // --- Header ---
  const dryLabel = dryRun ? " [DRY RUN]" : "";
  log(`\n${BOLD}EQ Random-Loot Pipeline${RESET}${dryLabel}`);
  log(`Mode: ${CYAN}${mode}${RESET}  |  Started: ${nowIso()}`);
  log(`Run log: ${DIM}${logPath}${RESET}`);

  await logger.append(`EQ RANDOM-LOOT PIPELINE RUN`);
  await logger.append(`mode=${mode} dry-run=${dryRun} continue-on-error=${continueOnError}`);
  await logger.append(`started=${nowIso()}`);
  await logger.append(`node=${process.version}`);
  await logger.append(`cwd=${root}`);

  // --- Resolve steps for this mode ---
  const stepIds = MODE_STEPS[mode];
  const stepMap = new Map(ALL_STEPS.map((s) => [s.id, s]));
  const steps = stepIds.map((id) => {
    const step = stepMap.get(id);
    if (!step) throw new Error(`Internal: no step definition for id "${id}"`);
    return step;
  });

  log(`\nSteps to run (${steps.length}):`);
  for (const [i, step] of steps.entries()) {
    const impl = step.scriptFile === null
      ? `${YELLOW}[not implemented]${RESET}`
      : existsSync(path.join(root, step.scriptFile))
        ? `${GREEN}[ready]${RESET}`
        : `${YELLOW}[file missing]${RESET}`;
    log(`  ${String(i + 1).padStart(2)}. ${step.label.padEnd(48)} ${impl}`);
  }

  if (dryRun) {
    log(`\n${YELLOW}[dry-run]${RESET} No steps will be executed.`);
    await logger.append(`\nDRY RUN — no steps executed`);
    await logger.flush();
    process.exit(0);
  }

  // --- Execute steps ---
  const results: StepResult[] = [];
  const pipelineStart = Date.now();
  let failedRequired = false;

  for (const step of steps) {
    if (failedRequired && !continueOnError) {
      // Mark remaining steps as skipped in summary
      results.push({
        id: step.id,
        label: step.label,
        status: "skipped",
        durationMs: 0,
        exitCode: null,
        error: "Pipeline aborted due to prior step failure.",
      });
      continue;
    }

    const result = await runStep(step, logger, dryRun);
    results.push(result);

    if (result.status === "failed") {
      const required = step.required !== false;
      log(`\n${RED}[fail]${RESET} Step "${step.label}" exited with code ${result.exitCode ?? "null"}`);
      if (required && !continueOnError) {
        log(`${RED}Required step failed. Aborting pipeline.${RESET}`);
        log(`Use --continue-on-error to proceed past failures.`);
        failedRequired = true;
      } else if (required) {
        log(`${YELLOW}Required step failed, but --continue-on-error is set.${RESET}`);
        failedRequired = true;
      } else {
        log(`${YELLOW}Optional step failed; continuing pipeline.${RESET}`);
      }
    }
  }

  const totalMs = Date.now() - pipelineStart;

  // --- Summary ---
  printSummary(results, totalMs);
  await logger.append(`\n${"=".repeat(72)}`);
  await logger.append(`PIPELINE COMPLETE`);
  await logger.append(`total_duration=${formatDuration(totalMs)}`);
  await logger.append(`finished=${nowIso()}`);

  for (const r of results) {
    await logger.append(`RESULT: ${r.id} status=${r.status} duration=${formatDuration(r.durationMs)} exit=${r.exitCode ?? "null"}`);
  }

  await logger.flush();
  log(`\nRun log written: ${logPath}`);

  // Exit non-zero if any required step failed
  if (failedRequired) {
    process.exit(1);
  }
}

await main();
