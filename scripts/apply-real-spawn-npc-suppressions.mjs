import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dataDir = resolve("data");
const lootAssetDir = resolve("public/real-spawn-loot-assets");
const configPath = resolve("data/real-spawn-npc-suppressions.json");
const reportPath = resolve("data/real-spawn-suppressed-npcs-report.json");

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value, pretty = true) {
  writeFileSync(path, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

function displayMobName(rawName) {
  const cleaned = String(rawName ?? "Unknown")
    .replace(/^#+/, "")
    .replace(/\d+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

function normalizeSuppressionName(value) {
  return displayMobName(value).toLowerCase();
}

const config = readJson(configPath, { globalNpcSuppressions: [] });
const suppressedNames = new Set((config.globalNpcSuppressions ?? []).map(normalizeSuppressionName));

function isSuppressedName(value) {
  return suppressedNames.has(normalizeSuppressionName(value));
}

function isSuppressedReference(value) {
  const normalized = normalizeSuppressionName(value).replace(/\s+\d+$/, "");
  if (normalized.length < 10) return false;
  return [...suppressedNames].some((name) => name === normalized || name.startsWith(normalized) || normalized.startsWith(name));
}

function countSuppressedCandidate(candidate) {
  return isSuppressedName(candidate?.displayName) || isSuppressedName(candidate?.name);
}

function sanitizeSpawnData(data, zoneShortName, report) {
  if (!data || !Array.isArray(data.primarySpawnRows)) return { data, changed: false };
  let changed = false;
  const affected = report.zoneDetails.get(zoneShortName) ?? {
    zoneShortName,
    countsRemoved: {
      candidates: 0,
      lootMobs: 0,
      mapPoints: 0,
      mobGroups: 0,
      rows: 0,
      spawnSlots: 0,
    },
    suppressedNames: {},
  };

  const primarySpawnRows = data.primarySpawnRows.flatMap((spawn) => {
    const originalCandidates = Array.isArray(spawn.candidates) ? spawn.candidates : [];
    const removedCandidates = originalCandidates.filter(countSuppressedCandidate);
    if (removedCandidates.length) {
      changed = true;
      affected.countsRemoved.candidates += removedCandidates.length;
      for (const candidate of removedCandidates) {
        const label = displayMobName(candidate.displayName ?? candidate.name);
        affected.suppressedNames[label] = (affected.suppressedNames[label] ?? 0) + 1;
      }
    }
    const candidates = originalCandidates.filter((candidate) => !countSuppressedCandidate(candidate));
    if (!candidates.length) {
      changed = true;
      affected.countsRemoved.spawnSlots += 1;
      if (!removedCandidates.length) {
        const label = displayMobName(spawn.displayName ?? spawn.primaryNpcName);
        affected.suppressedNames[label] = (affected.suppressedNames[label] ?? 0) + 1;
      }
      return [];
    }

    const spawngroupName = isSuppressedReference(spawn.spawngroupName) ? null : spawn.spawngroupName;
    if (!isSuppressedName(spawn.displayName) && !isSuppressedName(spawn.primaryNpcName)) {
      if (spawngroupName !== spawn.spawngroupName) changed = true;
      return [{ ...spawn, candidateCount: candidates.length, candidates, spawngroupName }];
    }

    changed = true;
    const replacement = candidates[0];
    return [{
      ...spawn,
      candidateCount: candidates.length,
      candidates,
      spawngroupName,
      primaryNpcId: replacement.npcTypeId,
      primaryNpcName: replacement.name,
      displayName: replacement.displayName,
      level: replacement.level,
      race: replacement.race,
      className: replacement.className,
      chance: replacement.chance,
    }];
  });

  if (changed) {
    report.zoneDetails.set(zoneShortName, affected);
    return {
      changed,
      data: {
        ...data,
        candidateCount: primarySpawnRows.reduce((sum, spawn) => sum + (spawn.candidates?.length ?? 0), 0),
        primarySpawnRows,
        spawnSlotCount: primarySpawnRows.length,
      },
    };
  }
  return { data, changed: false };
}

function sanitizeLootData(data, zoneShortName, report) {
  if (!data || !Array.isArray(data.mobs)) return { data, changed: false };
  let changed = false;
  const affected = report.zoneDetails.get(zoneShortName) ?? {
    zoneShortName,
    countsRemoved: {
      candidates: 0,
      lootMobs: 0,
      mapPoints: 0,
      mobGroups: 0,
      rows: 0,
      spawnSlots: 0,
    },
    suppressedNames: {},
  };
  const mobs = data.mobs.filter((mob) => {
    const suppressed = isSuppressedName(mob.displayName) || isSuppressedName(mob.rawName);
    if (suppressed) {
      changed = true;
      affected.countsRemoved.lootMobs += 1;
      const label = displayMobName(mob.displayName ?? mob.rawName);
      affected.suppressedNames[label] = (affected.suppressedNames[label] ?? 0) + 1;
    }
    return !suppressed;
  });
  if (changed) {
    report.zoneDetails.set(zoneShortName, affected);
    return { changed, data: { ...data, mobs } };
  }
  return { data, changed: false };
}

function sanitizeSummaryData(data, zoneShortName, report) {
  if (!data?.summary && !data?.details) return { data, changed: false };
  let changed = false;
  const summary = data.summary ? { ...data.summary } : data.summary;
  const details = data.details ? { ...data.details } : data.details;
  const affected = report.zoneDetails.get(zoneShortName) ?? {
    zoneShortName,
    countsRemoved: {
      candidates: 0,
      lootMobs: 0,
      mapPoints: 0,
      mobGroups: 0,
      rows: 0,
      spawnSlots: 0,
    },
    suppressedNames: {},
  };

  for (const key of ["mobGroupNameCounts", "classCounts", "raceCounts", "normalizedRaceCounts", "typeCounts"]) {
    if (!summary?.[key]) continue;
    for (const name of Object.keys(summary[key])) {
      if (isSuppressedName(name)) {
        changed = true;
        delete summary[key][name];
      }
    }
  }

  if (summary?.spawnMapPrototype?.points) {
    const before = summary.spawnMapPrototype.points.length;
    summary.spawnMapPrototype = {
      ...summary.spawnMapPrototype,
      points: summary.spawnMapPrototype.points.filter((point) => !isSuppressedName(point.displayName) && !isSuppressedName(point.name)),
    };
    const removed = before - summary.spawnMapPrototype.points.length;
    if (removed > 0) {
      changed = true;
      affected.countsRemoved.mapPoints += removed;
    }
  }

  if (Array.isArray(details?.mobGroups)) {
    const before = details.mobGroups.length;
    details.mobGroups = details.mobGroups.filter((group) => !isSuppressedName(group.displayName) && !(group.rawNames ?? []).some(isSuppressedName));
    const removed = before - details.mobGroups.length;
    if (removed > 0) {
      changed = true;
      affected.countsRemoved.mobGroups += removed;
    }
  }

  if (Array.isArray(details?.rows)) {
    const before = details.rows.length;
    details.rows = details.rows.filter((row) => !isSuppressedName(row.displayName) && !isSuppressedName(row.rawName));
    const removed = before - details.rows.length;
    if (removed > 0) {
      changed = true;
      affected.countsRemoved.rows += removed;
    }
  }

  if (changed) {
    report.zoneDetails.set(zoneShortName, affected);
    return { changed, data: { ...data, summary, details } };
  }
  return { data, changed: false };
}

const report = {
  generatedAt: new Date().toISOString(),
  configFile: "data/real-spawn-npc-suppressions.json",
  suppressedNpcNames: config.globalNpcSuppressions ?? [],
  filesChanged: [],
  zoneDetails: new Map(),
};

for (const fileName of readdirSync(dataDir)) {
  const spawnMatch = /^eqemu-(.+)-spawns-test\.json$/.exec(fileName);
  const lootMatch = /^eqemu-(.+)-loot-test\.json$/.exec(fileName);
  const summaryMatch = /^eqemu-(.+)-zone-summary-test\.json$/.exec(fileName);
  if (!spawnMatch && !lootMatch && !summaryMatch) continue;

  const zoneShortName = spawnMatch?.[1] ?? lootMatch?.[1] ?? summaryMatch?.[1];
  const filePath = join(dataDir, fileName);
  const data = readJson(filePath);
  const result = spawnMatch
    ? sanitizeSpawnData(data, zoneShortName, report)
    : lootMatch
      ? sanitizeLootData(data, zoneShortName, report)
      : sanitizeSummaryData(data, zoneShortName, report);
  if (result.changed) {
    writeJson(filePath, result.data);
    report.filesChanged.push(`data/${fileName}`);
  }
}

if (existsSync(lootAssetDir)) {
  for (const fileName of readdirSync(lootAssetDir)) {
    if (!fileName.endsWith(".json")) continue;
    const zoneShortName = fileName.replace(/\.json$/, "");
    const filePath = join(lootAssetDir, fileName);
    const result = sanitizeLootData(readJson(filePath), zoneShortName, report);
    if (result.changed) {
      writeJson(filePath, result.data, false);
      report.filesChanged.push(`public/real-spawn-loot-assets/${fileName}`);
    }
  }
}

const zoneSummariesPath = join(dataDir, "eqemu-real-spawn-zone-summaries.json");
const zoneSummaries = readJson(zoneSummariesPath, null);
if (Array.isArray(zoneSummaries)) {
  let changed = false;
  const sanitized = zoneSummaries.map((summary) => {
    const next = { ...summary };
    for (const key of ["mobGroupNameCounts", "classCounts", "raceCounts", "normalizedRaceCounts", "typeCounts"]) {
      if (!next[key]) continue;
      for (const name of Object.keys(next[key])) {
        if (isSuppressedName(name)) {
          changed = true;
          delete next[key][name];
        }
      }
    }
    return next;
  });
  if (changed) {
    writeJson(zoneSummariesPath, sanitized);
    report.filesChanged.push("data/eqemu-real-spawn-zone-summaries.json");
  }
}

const zoneDetails = [...report.zoneDetails.values()].sort((a, b) => a.zoneShortName.localeCompare(b.zoneShortName));
let outputReport = {
  generatedAt: report.generatedAt,
  configFile: report.configFile,
  suppressedNpcNames: report.suppressedNpcNames,
  zonesAffected: zoneDetails.length,
  countsRemoved: zoneDetails.reduce((totals, zone) => {
    for (const [key, value] of Object.entries(zone.countsRemoved)) {
      totals[key] = (totals[key] ?? 0) + value;
    }
    return totals;
  }, {}),
  filesChanged: report.filesChanged.sort((a, b) => a.localeCompare(b)),
  zones: zoneDetails,
  notes: [
    "Suppression is exact-name targeted after EQ-style display-name normalization.",
    "Legitimate invisible/utility/controller NPCs are preserved unless explicitly listed in the suppression config.",
  ],
};

const currentRemovedTotal = Object.values(outputReport.countsRemoved).reduce((sum, value) => sum + value, 0);
const previousReport = readJson(reportPath, null);
if (currentRemovedTotal === 0 && previousReport?.suppressedNpcNames?.join("|") === outputReport.suppressedNpcNames.join("|")) {
  outputReport = {
    ...previousReport,
    generatedAt: report.generatedAt,
    idempotencyCheckedAt: report.generatedAt,
    filesChangedOnLatestRun: report.filesChanged.sort((a, b) => a.localeCompare(b)),
    notes: [
      ...(previousReport.notes ?? []),
      "Latest run found no additional suppressed NPC candidates; previous removal counts were preserved.",
    ],
  };
}

writeJson(reportPath, outputReport);
console.log(JSON.stringify({
  ok: true,
  suppressedNpcNames: outputReport.suppressedNpcNames,
  zonesAffected: outputReport.zonesAffected,
  countsRemoved: outputReport.countsRemoved,
  filesChanged: outputReport.filesChanged.length,
  report: reportPath,
}, null, 2));
