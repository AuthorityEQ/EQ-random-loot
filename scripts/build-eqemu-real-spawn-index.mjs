import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve("data");
const summaryOutputPath = resolve("data/eqemu-real-spawn-zone-summaries.json");
const reportOutputPath = resolve("data/eqemu-real-spawn-export-report.json");
const maxExpansionArg = process.argv[2];
const maxExpansionId = maxExpansionArg === undefined || maxExpansionArg === "" ? 5 : Number(maxExpansionArg);

const friendlyZoneNames = {
  cazicthule: "Cazic-Thule",
  gukbottom: "Lower Guk",
  mistmoore: "Castle Mistmoore",
  sebilis: "Old Sebilis",
  soldungb: "Nagafen's Lair / Sol B",
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

const zones = readdirSync(dataDir)
  .map((name) => name.match(/^eqemu-(.+)-zone-summary-test\.json$/)?.[1])
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b));

const summaries = [];
const expansionCoverage = new Map();
const report = {
  source: "Local EQEmu/PEQ database exports",
  generatedAt: new Date().toISOString(),
  exportedZones: [],
  missingZones: [],
  skippedFiles: [],
  expansionCoverage: {},
  totals: {
    zones: 0,
    spawnSlots: 0,
    spawnCandidates: 0,
    possibleMobs: 0,
    mobsWithResolvedDrops: 0,
    resolvedDropItems: 0,
  },
  notes: [
    "Zone Snapshot data is separate and was not modified.",
    "Real Spawn Data summaries use one primary representative per spawn2 slot.",
    "Expanded Real Spawn Data details keep all spawn candidates and loot rows in the per-zone JSON exports.",
    "Exact spawn locations remain stored in per-zone spawn JSON files for future map/debug work, but normal UI keeps location lists hidden by default.",
  ],
};

for (const shortName of zones) {
  const summaryPath = resolve(dataDir, `eqemu-${shortName}-zone-summary-test.json`);
  const spawnPath = resolve(dataDir, `eqemu-${shortName}-spawns-test.json`);
  const lootPath = resolve(dataDir, `eqemu-${shortName}-loot-test.json`);
  const missing = [summaryPath, spawnPath, lootPath].filter((path) => !existsSync(path));

  if (missing.length) {
    report.missingZones.push({
      shortName,
      missingFiles: missing,
    });
    continue;
  }

  let summaryData;
  let spawnData;
  let lootData;
  try {
    summaryData = readJson(summaryPath);
    spawnData = readJson(spawnPath);
    lootData = readJson(lootPath);
  } catch (error) {
    report.skippedFiles.push({
      shortName,
      reason: error instanceof Error ? error.message : String(error),
    });
    continue;
  }

  const displayName = friendlyZoneNames[shortName] ?? summaryData.summary?.zoneName ?? spawnData.zoneName ?? shortName;
  if (typeof summaryData.summary?.eqemuExpansionId === "number" && summaryData.summary.eqemuExpansionId > maxExpansionId) {
    report.skippedFiles.push({
      shortName,
      reason: `Expansion id ${summaryData.summary.eqemuExpansionId} is beyond configured max ${maxExpansionId}.`,
      expansion: summaryData.summary.expansion,
    });
    continue;
  }
  const summary = {
    ...summaryData.summary,
    routeSlug: shortName,
    zoneShortName: shortName,
    zoneName: displayName,
    sourceFile: `eqemu-${shortName}-spawns-test.json`,
    sourceKind: "Spawn-slot data from EQEmu/PEQ database",
    notes: [
      ...(summaryData.summary?.notes ?? []),
      "Counts use one primary representative per spawn2 slot from the local EQEmu/PEQ database export.",
    ],
  };
  delete summary.spawnMapPrototype;

  const possibleMobs = Array.isArray(lootData.mobs) ? lootData.mobs.length : 0;
  const mobsWithResolvedDrops = Array.isArray(lootData.mobs)
    ? lootData.mobs.filter((mob) => (mob.lootdrops ?? []).some((lootdrop) => (lootdrop.items ?? []).length > 0)).length
    : 0;
  const resolvedDropItems = Array.isArray(lootData.mobs)
    ? lootData.mobs.reduce((mobSum, mob) => mobSum + (mob.lootdrops ?? []).reduce((dropSum, lootdrop) => dropSum + (lootdrop.items ?? []).length, 0), 0)
    : 0;

  summaries.push(summary);
  increment(expansionCoverage, summary.expansion ?? "Unknown");
  report.exportedZones.push({
    shortName,
    displayName,
    exportedZoneName: summaryData.summary?.zoneName ?? spawnData.zoneName ?? displayName,
    expansion: summary.expansion,
    spawnSlots: numberOrZero(spawnData.spawnSlotCount),
    spawnCandidates: numberOrZero(spawnData.candidateCount),
    possibleMobs,
    mobsWithResolvedDrops,
    resolvedDropItems,
    files: {
      summary: summaryPath,
      spawns: spawnPath,
      loot: lootPath,
    },
  });
}

for (const zone of report.exportedZones) {
  report.totals.zones += 1;
  report.totals.spawnSlots += zone.spawnSlots;
  report.totals.spawnCandidates += zone.spawnCandidates;
  report.totals.possibleMobs += zone.possibleMobs;
  report.totals.mobsWithResolvedDrops += zone.mobsWithResolvedDrops;
  report.totals.resolvedDropItems += zone.resolvedDropItems;
}

report.expansionCoverage = Object.fromEntries([...expansionCoverage.entries()].sort((a, b) => a[0].localeCompare(b[0])));
summaries.sort((a, b) => (a.expansion ?? "").localeCompare(b.expansion ?? "") || a.zoneName.localeCompare(b.zoneName));

writeFileSync(summaryOutputPath, `${JSON.stringify(summaries, null, 2)}\n`);
writeFileSync(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  summaries: summaries.length,
  missing: report.missingZones.length,
  skipped: report.skippedFiles.length,
  expansionCoverage: report.expansionCoverage,
  totals: report.totals,
  outputs: [summaryOutputPath, reportOutputPath],
}, null, 2));
