import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const inputDir = resolve(process.argv[2] ?? "data/zone-mob-csv-source/planes");
const summariesPath = resolve(process.argv[3] ?? "data/zone-mob-summaries.json");
const detailsPath = resolve(process.argv[4] ?? "data/zone-mob-details.json");
const summaryReportPath = resolve(process.argv[5] ?? "data/zone-mob-summary-report.json");
const expansionReportPath = resolve(process.argv[6] ?? "data/zone-expansion-mapping-report.json");
const importReportPath = resolve(process.argv[7] ?? "data/zone-mob-planes-import-report.json");

const levelBucketDefinitions = [
  ["1-10", 1, 10],
  ["11-20", 11, 20],
  ["21-30", 21, 30],
  ["31-40", 31, 40],
  ["41-50", 41, 50],
  ["51-60", 51, 60],
  ["61+", 61, Number.POSITIVE_INFINITY],
];

const filenameAliases = new Map(Object.entries({
  airplane: "Plane of Sky",
  fearplane: "Plane of Fear",
  growthplane: "Plane of Growth",
  hateplaneb: "Plane of Hate",
  mischiefplane: "Plane of Mischief",
}));

const raceNormalizationRules = [
  ["frost giant", "Frost Giant"],
  ["storm giant", "Storm Giant"],
  ["sand giant", "Sand Giant"],
  ["hill giant", "Hill Giant"],
  ["ice giant", "Ice Giant"],
  ["fire giant", "Fire Giant"],
  ["giant", "Giant"],
  ["froglok", "Froglok"],
  ["goblin", "Goblin"],
  ["skeleton", "Skeleton"],
  ["skel", "Skeleton"],
  ["orc", "Orc"],
  ["spider", "Spider"],
  ["dragon", "Dragon"],
  ["drake", "Drake"],
  ["kobold", "Kobold"],
  ["gnoll", "Gnoll"],
  ["lizard", "Lizard Man"],
  ["lizardman", "Lizard Man"],
  ["iksar", "Iksar"],
  ["sarnak", "Sarnak"],
  ["gnome", "Gnome"],
  ["human", "Human"],
  ["dark elf", "Dark Elf"],
  ["elf", "Elf"],
  ["dwarf", "Dwarf"],
  ["halfling", "Halfling"],
  ["barbarian", "Barbarian"],
  ["troll", "Troll"],
  ["ogre", "Ogre"],
  ["vampire", "Vampire"],
  ["ghoul", "Ghoul"],
  ["zombie", "Zombie"],
  ["spectre", "Spectre"],
  ["wisp", "Will-o-Wisp"],
  ["bat", "Bat"],
  ["bear", "Bear"],
  ["wolf", "Wolf"],
  ["rat", "Rat"],
  ["snake", "Snake"],
  ["beetle", "Beetle"],
  ["basilisk", "Basilisk"],
  ["griffon", "Griffon"],
  ["wyvern", "Wyvern"],
  ["elemental", "Elemental"],
  ["golem", "Golem"],
  ["treant", "Treant"],
  ["cyclops", "Cyclops"],
  ["minotaur", "Minotaur"],
  ["bixie", "Bixie"],
  ["aviak", "Aviak"],
  ["centaur", "Centaur"],
  ["grimling", "Grimling"],
  ["shiknar", "Shiknar"],
  ["akhevan", "Akhevan"],
  ["thought horror", "Thought Horror"],
  ["mephit", "Mephit"],
  ["imp", "Imp"],
  ["boar", "Boar"],
  ["cat", "Cat"],
  ["fish", "Fish"],
  ["fae drake", "Fae Drake"],
  ["efreeti", "Efreeti"],
  ["dervish", "Dervish"],
  ["phoenix", "Phoenix"],
  ["unicorn", "Unicorn"],
  ["brownie", "Brownie"],
  ["fairy", "Fairy"],
  ["harpy", "Harpy"],
  ["nightmare", "Nightmare"],
];

function allFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return allFiles(path);
    return [path];
  });
}

function zoneToSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeFilename(name) {
  return basename(name, extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function routeSlugFromSourceFile(name) {
  return basename(name, extname(name))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromFilename(name) {
  return basename(name, extname(name))
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function increment(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedCountObject(map) {
  return Object.fromEntries(
    Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(1));
}

function levelProfileLabel(levelBuckets, minLevel, maxLevel) {
  const entries = Object.entries(levelBuckets);
  const [peakBucket, peakCount] = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ["Unknown", 0];
  if (peakCount === 0) return null;
  if (minLevel !== null && maxLevel !== null && maxLevel - minLevel >= 30) return "Wide level spread";
  if (minLevel !== null && minLevel >= 50) return "High-level zone";
  return `Mostly ${peakBucket}`;
}

function displayMobName(rawName) {
  const cleaned = (rawName || "Unknown")
    .replace(/\d+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown";
  return cleaned
    .split(" ")
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

function titleCaseWords(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

function normalizeRaceName(rawRace) {
  const cleaned = (rawRace || "Unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown";
  const normalized = cleaned.toLowerCase();
  for (const [needle, label] of raceNormalizationRules) {
    if (normalized.includes(needle)) return label;
  }
  return titleCaseWords(cleaned);
}

function incrementNestedLevelCount(map, race, level) {
  if (!race || typeof level !== "number") return;
  const levelMap = map.get(race) ?? new Map();
  increment(levelMap, String(level));
  map.set(race, levelMap);
}

function sortedNestedLevelCounts(map) {
  return Object.fromEntries(
    Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([race, levelMap]) => [
        race,
        Object.fromEntries(Array.from(levelMap.entries()).sort((a, b) => Number(a[0]) - Number(b[0]))),
      ]),
  );
}

function raceAliasObject(map) {
  return Object.fromEntries(
    Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([race, aliases]) => [race, Array.from(aliases).sort((a, b) => a.localeCompare(b))]),
  );
}

function createMobGroup(displayName, rows) {
  if (rows.length === 0) return null;
  const numericLevels = rows.map((row) => row.level).filter((level) => typeof level === "number");
  const rawNames = Array.from(new Set(rows.map((row) => row.rawName))).sort((a, b) => a.localeCompare(b));
  const raceCounts = new Map();
  const rawRaceCounts = new Map();
  const classCounts = new Map();
  const typeCounts = new Map();
  const levels = Array.from(new Set(numericLevels)).sort((a, b) => a - b);
  for (const row of rows) {
    increment(raceCounts, row.race);
    increment(rawRaceCounts, row.rawRace);
    increment(classCounts, row.className);
    increment(typeCounts, row.type);
  }
  return {
    displayName,
    rawNames,
    count: rows.length,
    levelMin: numericLevels.length ? Math.min(...numericLevels) : null,
    levelMax: numericLevels.length ? Math.max(...numericLevels) : null,
    levels,
    raceCounts: sortedCountObject(raceCounts),
    rawRaceCounts: sortedCountObject(rawRaceCounts),
    classCounts: sortedCountObject(classCounts),
    typeCounts: sortedCountObject(typeCounts),
  };
}

function buildMobGroups(rows) {
  const rowsByDisplayName = new Map();
  for (const row of rows) {
    rowsByDisplayName.set(row.displayName, [...(rowsByDisplayName.get(row.displayName) ?? []), row]);
  }

  const groups = [];
  for (const [displayName, displayRows] of rowsByDisplayName.entries()) {
    const rowsByLevel = new Map();
    const unknownLevelRows = [];
    for (const row of displayRows) {
      if (typeof row.level === "number") rowsByLevel.set(row.level, [...(rowsByLevel.get(row.level) ?? []), row]);
      else unknownLevelRows.push(row);
    }

    const sortedLevels = Array.from(rowsByLevel.keys()).sort((a, b) => a - b);
    let currentLevels = [];
    for (const level of sortedLevels) {
      const previousLevel = currentLevels[currentLevels.length - 1];
      if (currentLevels.length === 0 || level - previousLevel <= 1) {
        currentLevels.push(level);
      } else {
        groups.push(createMobGroup(displayName, currentLevels.flatMap((currentLevel) => rowsByLevel.get(currentLevel) ?? [])));
        currentLevels = [level];
      }
    }
    if (currentLevels.length > 0) {
      groups.push(createMobGroup(displayName, currentLevels.flatMap((currentLevel) => rowsByLevel.get(currentLevel) ?? [])));
    }
    if (unknownLevelRows.length > 0) groups.push(createMobGroup(displayName, unknownLevelRows));
  }

  return groups
    .filter(Boolean)
    .sort((a, b) =>
      (a.levelMin ?? Number.POSITIVE_INFINITY) - (b.levelMin ?? Number.POSITIVE_INFINITY)
      || b.count - a.count
      || a.displayName.localeCompare(b.displayName)
    );
}

function readDailyBonusZoneExpansions() {
  const bonusSource = readFileSync(resolve("app/bonus/BonusTrackerClient.tsx"), "utf8");
  const zones = [];
  const pattern = /\{\s*zoneName:\s*"([^"]+)"\s*,\s*expansion:\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(bonusSource)) !== null) {
    zones.push({ zoneName: match[1], expansion: match[2] });
  }
  return zones;
}

function resolveZoneName(fileName) {
  const key = normalizeFilename(fileName);
  const aliasName = filenameAliases.get(key);
  if (aliasName) return { zoneName: aliasName, aliasUsed: key };
  return { zoneName: titleFromFilename(fileName), aliasUsed: null };
}

function parseZoneCsv(filePath, dailyExpansionsBySlug) {
  const sourceFile = basename(filePath);
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const header = parseCsvLine(lines[0] ?? "");
  const indexes = {
    name: header.findIndex((column) => /^name$/i.test(column)),
    level: header.findIndex((column) => /^level$/i.test(column)),
    class: header.findIndex((column) => /^class$/i.test(column)),
    race: header.findIndex((column) => /^race$/i.test(column)),
    type: header.findIndex((column) => /^type$/i.test(column)),
  };
  if (indexes.level === -1) {
    return { skipped: { sourceFile, reason: "Missing Level column." } };
  }

  const { zoneName, aliasUsed } = resolveZoneName(sourceFile);
  const zoneSlug = zoneToSlug(zoneName);
  const dailyMatch = dailyExpansionsBySlug.get(zoneSlug);
  const classCounts = new Map();
  const raceCounts = new Map();
  const normalizedRaceCounts = new Map();
  const normalizedRaceLevelCounts = new Map();
  const raceAliases = new Map();
  const typeCounts = new Map();
  const mobGroupNameCounts = new Map();
  const levelCounts = new Map();
  const mobRows = [];
  const levels = [];
  let mobCount = 0;
  let unknownLevelCount = 0;

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    if (row.length === 0) continue;
    mobCount += 1;
    const npcName = indexes.name === -1 ? "" : row[indexes.name] ?? "";
    const npcDisplayName = displayMobName(npcName);
    const npcClass = indexes.class === -1 ? "" : row[indexes.class] ?? "";
    const npcRace = indexes.race === -1 ? "" : row[indexes.race] ?? "";
    const normalizedRace = normalizeRaceName(npcRace);
    const npcType = indexes.type === -1 ? "" : row[indexes.type] ?? "";
    increment(mobGroupNameCounts, npcDisplayName);
    increment(classCounts, npcClass);
    increment(raceCounts, npcRace);
    increment(normalizedRaceCounts, normalizedRace);
    if (npcRace) {
      const aliases = raceAliases.get(normalizedRace) ?? new Set();
      aliases.add(npcRace);
      raceAliases.set(normalizedRace, aliases);
    }
    increment(typeCounts, npcType);

    const level = Number.parseInt(row[indexes.level] ?? "", 10);
    if (Number.isFinite(level)) {
      levels.push(level);
      increment(levelCounts, String(level));
      incrementNestedLevelCount(normalizedRaceLevelCounts, normalizedRace, level);
    } else {
      unknownLevelCount += 1;
    }
    mobRows.push({
      displayName: npcDisplayName,
      rawName: npcName || "Unknown",
      level: Number.isFinite(level) ? level : null,
      race: normalizedRace || "Unknown",
      rawRace: npcRace || "Unknown",
      className: npcClass || "Unknown",
      type: npcType || "Unknown",
    });
  }

  const levelBuckets = Object.fromEntries(levelBucketDefinitions.map(([label]) => [label, 0]));
  for (const level of levels) {
    const bucket = levelBucketDefinitions.find(([, min, max]) => level >= min && level <= max)?.[0] ?? "Unknown";
    levelBuckets[bucket] = (levelBuckets[bucket] ?? 0) + 1;
  }

  const minLevel = levels.length ? Math.min(...levels) : null;
  const maxLevel = levels.length ? Math.max(...levels) : null;
  const expansion = dailyMatch?.expansion ?? "Unmapped";
  const expansionSource = dailyMatch ? "daily-bonuses" : "unmapped";
  const notes = dailyMatch ? [] : [`No expansion mapping found for ${zoneName} from ${sourceFile}.`];

  const summary = {
    zoneSlug,
    zoneName,
    sourceFile,
    matched: Boolean(dailyMatch),
    expansion,
    expansionSource,
    mobCount,
    unknownLevelCount,
    minLevel,
    maxLevel,
    averageLevel: levels.length ? Number((levels.reduce((sum, level) => sum + level, 0) / levels.length).toFixed(1)) : null,
    medianLevel: median(levels),
    levelCounts: Object.fromEntries(Array.from(levelCounts.entries()).sort((a, b) => Number(a[0]) - Number(b[0]))),
    levelBuckets,
    levelProfileLabel: levelProfileLabel(levelBuckets, minLevel, maxLevel),
    mobGroupNameCounts: sortedCountObject(mobGroupNameCounts),
    classCounts: sortedCountObject(classCounts),
    raceCounts: sortedCountObject(raceCounts),
    normalizedRaceCounts: sortedCountObject(normalizedRaceCounts),
    normalizedRaceLevelCounts: sortedNestedLevelCounts(normalizedRaceLevelCounts),
    raceAliases: raceAliasObject(raceAliases),
    typeCounts: sortedCountObject(typeCounts),
    notes,
    eraTag: null,
    dataVersionTag: null,
  };

  const detail = {
    zoneSlug,
    routeSlug: routeSlugFromSourceFile(sourceFile) || zoneSlug,
    zoneName,
    sourceFile,
    mobGroups: buildMobGroups(mobRows),
    rows: mobRows.sort((a, b) =>
      (a.level ?? Number.POSITIVE_INFINITY) - (b.level ?? Number.POSITIVE_INFINITY)
      || a.displayName.localeCompare(b.displayName)
      || a.rawName.localeCompare(b.rawName)
      || a.race.localeCompare(b.race)
      || a.className.localeCompare(b.className)
      || a.type.localeCompare(b.type)
    ),
  };

  return {
    aliasUsed,
    detail,
    rowsProcessed: mobCount,
    summary,
    unknownLevelCount,
  };
}

function replaceByKey(items, keyFn, replacements) {
  const replacementKeys = new Set(replacements.map(keyFn));
  return [
    ...items.filter((item) => !replacementKeys.has(keyFn(item))),
    ...replacements,
  ].sort((a, b) => a.zoneName.localeCompare(b.zoneName));
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const dailyExpansionsBySlug = new Map(readDailyBonusZoneExpansions().map((zone) => [zoneToSlug(zone.zoneName), zone]));
const csvFiles = allFiles(inputDir).filter((file) => extname(file).toLowerCase() === ".csv");
const existingSummaries = JSON.parse(readFileSync(summariesPath, "utf8"));
const existingDetails = JSON.parse(readFileSync(detailsPath, "utf8"));
const summaryReport = JSON.parse(readFileSync(summaryReportPath, "utf8"));
const expansionReport = JSON.parse(readFileSync(expansionReportPath, "utf8"));

const imported = [];
const skippedFiles = [];
for (const file of csvFiles) {
  const parsed = parseZoneCsv(file, dailyExpansionsBySlug);
  if (parsed.skipped) {
    skippedFiles.push(parsed.skipped);
  } else {
    imported.push(parsed);
  }
}

const importedSummaries = imported.map((entry) => entry.summary);
const importedDetails = imported.map((entry) => entry.detail);
const mergedSummaries = replaceByKey(existingSummaries, (summary) => summary.zoneSlug, importedSummaries);
const mergedDetails = replaceByKey(existingDetails, (detail) => `${detail.zoneSlug}:${detail.routeSlug}`, importedDetails);

const rowsProcessed = imported.reduce((sum, entry) => sum + entry.rowsProcessed, 0);
const invalidLevelRows = imported.reduce((sum, entry) => sum + entry.unknownLevelCount, 0);
const matchedZones = importedSummaries.filter((summary) => summary.matched).map(({ zoneSlug, zoneName, sourceFile }) => ({ zoneSlug, zoneName, sourceFile }));
const unmatchedZones = importedSummaries.filter((summary) => !summary.matched).map(({ zoneSlug, zoneName, sourceFile }) => ({ zoneSlug, zoneName, sourceFile }));
const aliasesUsed = imported
  .filter((entry) => entry.aliasUsed)
  .map((entry) => ({
    sourceFile: entry.summary.sourceFile,
    alias: entry.aliasUsed,
    zoneName: entry.summary.zoneName,
    expansion: entry.summary.expansion,
  }));

summaryReport.incrementalImports = [
  ...(summaryReport.incrementalImports ?? []).filter((entry) => entry.name !== "planes-zone-snapshots"),
  {
    name: "planes-zone-snapshots",
    sourceDirectory: inputDir,
    processedFiles: importedSummaries.map((summary) => summary.sourceFile),
    rowsProcessed,
    rowsWithInvalidOrMissingLevels: invalidLevelRows,
    matchedZones,
    unmatchedZones,
    skippedFiles,
  },
];
summaryReport.totalCsvFilesProcessed = Math.max(summaryReport.totalCsvFilesProcessed ?? 0, mergedSummaries.length);
summaryReport.rowsProcessed = Math.max(summaryReport.rowsProcessed ?? 0, 0) + 0;
summaryReport.matchedZones = uniqueBy([...(summaryReport.matchedZones ?? []), ...matchedZones], (entry) => `${entry.zoneSlug}:${entry.sourceFile}`)
  .sort((a, b) => a.zoneName.localeCompare(b.zoneName));
summaryReport.unmatchedZones = (summaryReport.unmatchedZones ?? [])
  .filter((entry) => !importedSummaries.some((summary) => summary.zoneSlug === entry.zoneSlug || summary.sourceFile === entry.sourceFile))
  .concat(unmatchedZones)
  .sort((a, b) => a.zoneName.localeCompare(b.zoneName));

expansionReport.incrementalImports = [
  ...(expansionReport.incrementalImports ?? []).filter((entry) => entry.name !== "planes-zone-snapshots"),
  {
    name: "planes-zone-snapshots",
    sourceDirectory: inputDir,
    mappedZones: importedSummaries.filter((summary) => summary.expansion !== "Unmapped").map((summary) => ({
      zoneSlug: summary.zoneSlug,
      zoneName: summary.zoneName,
      sourceFile: summary.sourceFile,
      expansion: summary.expansion,
      expansionSource: summary.expansionSource,
      matchedZoneName: dailyExpansionsBySlug.get(summary.zoneSlug)?.zoneName ?? summary.zoneName,
    })),
    unmappedZones: unmatchedZones,
    aliasesUsed,
  },
];
expansionReport.totalCsvZones = mergedSummaries.length;
expansionReport.mappedZones = uniqueBy([
  ...(expansionReport.mappedZones ?? []),
  ...importedSummaries.filter((summary) => summary.expansion !== "Unmapped").map((summary) => ({
    zoneSlug: summary.zoneSlug,
    zoneName: summary.zoneName,
    sourceFile: summary.sourceFile,
    expansion: summary.expansion,
    expansionSource: summary.expansionSource,
    matchedZoneName: dailyExpansionsBySlug.get(summary.zoneSlug)?.zoneName ?? summary.zoneName,
  })),
], (entry) => `${entry.zoneSlug}:${entry.sourceFile}`).sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.unmappedZones = (expansionReport.unmappedZones ?? [])
  .filter((entry) => !importedSummaries.some((summary) => summary.zoneSlug === entry.zoneSlug || summary.sourceFile === entry.sourceFile))
  .concat(unmatchedZones)
  .sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.aliasesUsed = uniqueBy([...(expansionReport.aliasesUsed ?? []), ...aliasesUsed], (entry) => `${entry.alias}:${entry.sourceFile}`)
  .sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.suggestedAliases = (expansionReport.suggestedAliases ?? [])
  .filter((entry) => !importedSummaries.some((summary) => summary.sourceFile === entry.sourceFile));

const importReport = {
  sourceDirectory: inputDir,
  processedFiles: importedSummaries.map((summary) => summary.sourceFile),
  skippedFiles,
  rowsProcessed,
  rowsWithInvalidOrMissingLevels: invalidLevelRows,
  matchedZones,
  unmatchedZones,
  aliasesUsed,
  countsByExpansion: importedSummaries.reduce((acc, summary) => {
    acc[summary.expansion] = (acc[summary.expansion] ?? 0) + 1;
    return acc;
  }, {}),
  note: "Imported into Zone Snapshot generated JSON only. Real Spawn Data exports are separate and were not modified.",
};

writeFileSync(summariesPath, `${JSON.stringify(mergedSummaries, null, 2)}\n`);
writeFileSync(detailsPath, `${JSON.stringify(mergedDetails, null, 2)}\n`);
writeFileSync(summaryReportPath, `${JSON.stringify(summaryReport, null, 2)}\n`);
writeFileSync(expansionReportPath, `${JSON.stringify(expansionReport, null, 2)}\n`);
writeFileSync(importReportPath, `${JSON.stringify(importReport, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  sourceDirectory: inputDir,
  importedZones: importedSummaries.length,
  rowsProcessed,
  rowsWithInvalidOrMissingLevels: invalidLevelRows,
  matchedZones: matchedZones.map((zone) => zone.zoneName),
  unmatchedZones: unmatchedZones.map((zone) => zone.zoneName),
  outputFiles: [summariesPath, detailsPath, summaryReportPath, expansionReportPath, importReportPath],
}, null, 2));
