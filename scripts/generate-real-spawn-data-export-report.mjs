import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

const batchReportPath = resolve("data/eqemu-real-spawn-batch-report.json");
const indexReportPath = resolve("data/eqemu-real-spawn-export-report.json");
const reconciliationReportPath = resolve("data/eqemu-item-reconciliation-report.json");
const mapReportPath = resolve("data/real-spawn-map-expansion-report.json");
const outputPath = resolve("data/real-spawn-data-export-report.json");

const batch = readJson(batchReportPath, {});
const index = readJson(indexReportPath, {});
const reconciliation = readJson(reconciliationReportPath, {});
const mapReport = readJson(mapReportPath, {});

const mapZones = new Map((mapReport.zonesProcessed ?? mapReport.zones ?? []).map((zone) => [
  zone.zoneShortName ?? zone.shortName,
  zone,
]));

const exportedZones = (index.exportedZones ?? []).map((zone) => {
  const map = mapZones.get(zone.shortName);
  return {
    shortName: zone.shortName,
    zoneName: zone.displayName ?? zone.exportedZoneName ?? zone.shortName,
    expansion: zone.expansion ?? "Unknown",
    spawnSlots: zone.spawnSlots ?? 0,
    spawnCandidates: zone.spawnCandidates ?? 0,
    possibleMobs: zone.possibleMobs ?? 0,
    mobsWithResolvedDrops: zone.mobsWithResolvedDrops ?? 0,
    resolvedDropItems: zone.resolvedDropItems ?? 0,
    mapStatus: map?.alignmentStatus ?? map?.mapReadiness ?? "Map not enabled",
    mapFiles: map?.mapFiles ?? map?.layers ?? [],
  };
});

const missingMapFiles = exportedZones
  .filter((zone) => zone.mapStatus === "Missing map" || zone.mapStatus === "Map not enabled")
  .map((zone) => ({ shortName: zone.shortName, zoneName: zone.zoneName, mapStatus: zone.mapStatus }));

const report = {
  source: "Real Spawn Data export status through Legacy of Ykesha",
  generatedAt: new Date().toISOString(),
  scope: ["Classic", "Kunark", "Velious", "Luclin", "Planes of Power", "Legacy of Ykesha"],
  dataSeparation: "Zone Snapshot data is preserved separately. This report covers Real Spawn Data only.",
  batch: {
    zonesConsidered: batch.zonesConsidered ?? 0,
    zonesAlreadyExported: batch.zonesAlreadyExported?.length ?? 0,
    zonesExportedThisRun: batch.zonesExported?.length ?? 0,
    zonesSkipped: batch.zonesSkipped?.length ?? 0,
    zonesFailed: batch.zonesFailed?.length ?? 0,
    expansionScope: batch.expansionScope ?? {},
  },
  totals: {
    zonesExported: index.totals?.zones ?? exportedZones.length,
    spawnSlots: index.totals?.spawnSlots ?? 0,
    spawnCandidates: index.totals?.spawnCandidates ?? 0,
    possibleMobs: index.totals?.possibleMobs ?? 0,
    mobsWithResolvedDrops: index.totals?.mobsWithResolvedDrops ?? 0,
    resolvedDropItems: index.totals?.resolvedDropItems ?? 0,
    acceptedItemMatches: reconciliation.acceptedMatchCount ?? reconciliation.matchedItemCount ?? 0,
    rejectedItemMatches: reconciliation.rejectedMatchCount ?? 0,
    unmatchedItems: reconciliation.unmatchedItemCount ?? 0,
    fuzzyMatchesUsed: reconciliation.fuzzyMatchCount ?? 0,
  },
  expansionCoverage: index.expansionCoverage ?? {},
  exportedZones,
  skippedZones: [
    ...(index.skippedFiles ?? []),
    ...(batch.zonesSkipped ?? []),
  ],
  failedZones: batch.zonesFailed ?? [],
  missingMapFiles,
  itemReconciliation: {
    reportPath: reconciliationReportPath,
    acceptedMatchCount: reconciliation.acceptedMatchCount ?? reconciliation.matchedItemCount ?? 0,
    rejectedMatchCount: reconciliation.rejectedMatchCount ?? 0,
    lowConfidenceMatchCount: reconciliation.lowConfidenceMatchCount ?? 0,
    fuzzyMatchCount: reconciliation.fuzzyMatchCount ?? 0,
    unmatchedItemCount: reconciliation.unmatchedItemCount ?? 0,
    rustShortSwordExamples: (reconciliation.rejectedMatches ?? [])
      .filter((entry) => entry.eqemuItemName === "Rusty Short Sword")
      .slice(0, 8),
  },
  notes: [
    "One spawn2 row is treated as one spawn slot.",
    "Highest-chance candidates remain the summary-primary representative; map/player-facing representatives use separate named/loot priority logic.",
    "Existing item data is used only when the existing item name is compatible with the EQEmu drop item name.",
    "Unsafe itemId-only collisions fall back to Local EQEmu DB item details.",
    "Long coordinate lists remain internal for map/debug work and are not exposed by default.",
  ],
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  output: outputPath,
  zonesExported: report.totals.zonesExported,
  expansionCoverage: report.expansionCoverage,
  rejectedItemMatches: report.totals.rejectedItemMatches,
}, null, 2));
