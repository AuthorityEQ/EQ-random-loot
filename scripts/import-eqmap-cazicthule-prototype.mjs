import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const baseUrl = "https://eqmap.vercel.app";
const zoneShortNameCandidates = ["cazicthule", "cthule", "cazicthule1", "cazicthule2"];
const summariesPath = resolve("data/zone-mob-summaries.json");
const detailsPath = resolve("data/zone-mob-details.json");
const testOutputPath = resolve("data/eqmap-cazicthule-classic-test.json");
const reportPath = resolve("data/eqmap-cazicthule-import-report.json");

const levelBucketDefinitions = [
  ["1-10", 1, 10],
  ["11-20", 11, 20],
  ["21-30", 21, 30],
  ["31-40", 31, 40],
  ["41-50", 41, 50],
  ["51-60", 51, 60],
  ["61+", 61, Number.POSITIVE_INFINITY],
];

const raceNormalizationRules = [
  ["froglok", "Froglok"],
  ["goblin", "Goblin"],
  ["skeleton", "Skeleton"],
  ["lizard", "Lizard Man"],
  ["lizardman", "Lizard Man"],
  ["troll", "Troll"],
  ["ghoul", "Ghoul"],
  ["zombie", "Zombie"],
  ["golem", "Golem"],
  ["spider", "Spider"],
  ["wolf", "Wolf"],
  ["rat", "Rat"],
];

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "frostreaver-eqmap-cazicthule-prototype/1.0" },
  });
  const text = await response.text();
  return { response, text };
}

async function fetchJsonIfAvailable(shortName) {
  const sourceUrl = `${baseUrl}/zones/${shortName}.json`;
  const { response, text } = await fetchText(sourceUrl);
  const contentType = response.headers.get("content-type") ?? "";
  const looksJson = contentType.includes("application/json") || text.trim().startsWith("[");
  if (!response.ok || !looksJson) return { shortName, sourceUrl, ok: false, status: response.status, contentType, textLength: text.length };
  return { shortName, sourceUrl, ok: true, status: response.status, contentType, textLength: text.length, json: JSON.parse(text) };
}

function parseRaceLookup(bundleText) {
  const match = bundleText.match(/var\s+Ay=JSON\.parse\(`([\s\S]*?)`\)/);
  if (!match) return {};
  const races = Function(`return JSON.parse(\`${match[1]}\`)`)();
  return Object.fromEntries(races.map((race) => [String(race.id), race.name]));
}

function parseClassLookup(bundleText) {
  const match = bundleText.match(/xA=\{([^}]+)\};function/);
  if (!match) return {};
  return Object.fromEntries([...match[1].matchAll(/(\d+):"([^"]+)"/g)].map(([, id, name]) => [id, name]));
}

function titleCaseWords(value) {
  return value.split(" ").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function cleanDisplayName(name) {
  return (name || "Unknown")
    .replace(/^#+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeRaceName(rawRace) {
  const cleaned = (rawRace || "Unknown").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Unknown";
  const normalized = cleaned.toLowerCase();
  for (const [needle, label] of raceNormalizationRules) {
    if (normalized.includes(needle)) return label;
  }
  return titleCaseWords(cleaned);
}

function increment(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function incrementNested(map, key, level) {
  if (!key || typeof level !== "number") return;
  const levelMap = map.get(key) ?? new Map();
  increment(levelMap, String(level));
  map.set(key, levelMap);
}

function sortedCountObject(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function sortedNestedCountObject(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, counts]) => [
    key,
    Object.fromEntries([...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
  ]));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(1));
}

function levelProfileLabel(levelBuckets, minLevel, maxLevel) {
  const [peakBucket, peakCount] = Object.entries(levelBuckets).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ["Unknown", 0];
  if (peakCount === 0) return null;
  if (minLevel !== null && maxLevel !== null && maxLevel - minLevel >= 30) return "Wide level spread";
  if (minLevel !== null && minLevel >= 50) return "High-level zone";
  return `Mostly ${peakBucket}`;
}

function pickPrimaryCandidate(candidates) {
  return [...candidates].sort((a, b) =>
    (b.chance ?? 0) - (a.chance ?? 0)
    || (b.level ?? 0) - (a.level ?? 0)
    || String(a.name ?? "").localeCompare(String(b.name ?? "")),
  )[0] ?? null;
}

function createMobGroup(displayName, rows) {
  const numericLevels = rows.map((row) => row.level).filter((level) => typeof level === "number");
  const raceCounts = new Map();
  const rawRaceCounts = new Map();
  const classCounts = new Map();
  const typeCounts = new Map();
  for (const row of rows) {
    increment(raceCounts, row.race);
    increment(rawRaceCounts, row.rawRace);
    increment(classCounts, row.className);
    increment(typeCounts, row.type);
  }
  const levels = [...new Set(numericLevels)].sort((a, b) => a - b);
  return {
    displayName,
    rawNames: [...new Set(rows.map((row) => row.rawName))].sort((a, b) => a.localeCompare(b)),
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
  const byName = new Map();
  for (const row of rows) byName.set(row.displayName, [...(byName.get(row.displayName) ?? []), row]);
  return [...byName.entries()]
    .map(([displayName, groupRows]) => createMobGroup(displayName, groupRows))
    .sort((a, b) => (a.levelMin ?? Infinity) - (b.levelMin ?? Infinity) || b.count - a.count || a.displayName.localeCompare(b.displayName));
}

function buildSummaryAndDetails({ sourceUrl, shortName, zoneGroups, raceById, classById }) {
  const primarySpawnRows = zoneGroups.map((candidates, spawnGroupIndex) => {
    const primary = pickPrimaryCandidate(candidates);
    const rawRace = raceById[String(primary?.race)] ?? "Unknown";
    const race = normalizeRaceName(rawRace);
    return {
      spawnGroupIndex,
      spawnGroupId: primary?.id ?? null,
      name: primary?.name ?? "Unknown",
      displayName: cleanDisplayName(primary?.name),
      level: Number.isFinite(primary?.level) ? primary.level : null,
      raceId: primary?.race ?? null,
      race,
      rawRace,
      classId: primary?.class ?? null,
      className: classById[String(primary?.class)] ?? "Unknown",
      x: primary?.x ?? null,
      y: primary?.y ?? null,
      z: primary?.z ?? null,
      heading: primary?.heading ?? null,
      chance: primary?.chance ?? null,
      respawnTime: primary?.respawnTime ?? null,
      candidateCount: candidates.length,
      candidates: candidates.map((candidate, spawnIndex) => ({
        spawnIndex,
        id: candidate.id ?? null,
        name: candidate.name ?? "Unknown",
        displayName: cleanDisplayName(candidate.name),
        level: Number.isFinite(candidate.level) ? candidate.level : null,
        raceId: candidate.race ?? null,
        race: normalizeRaceName(raceById[String(candidate.race)] ?? "Unknown"),
        rawRace: raceById[String(candidate.race)] ?? "Unknown",
        classId: candidate.class ?? null,
        className: classById[String(candidate.class)] ?? "Unknown",
        x: candidate.x ?? null,
        y: candidate.y ?? null,
        z: candidate.z ?? null,
        heading: candidate.heading ?? null,
        chance: candidate.chance ?? null,
        respawnTime: candidate.respawnTime ?? null,
      })),
    };
  });

  const detailRows = primarySpawnRows.map((row) => ({
    displayName: row.displayName,
    rawName: row.name,
    level: row.level,
    race: row.race,
    rawRace: row.rawRace,
    className: row.className,
    type: "Spawn Group",
    x: row.x,
    y: row.y,
    z: row.z,
    heading: row.heading,
    chance: row.chance,
    respawnTime: row.respawnTime,
    candidateCount: row.candidateCount,
  }));

  const levels = detailRows.map((row) => row.level).filter((level) => typeof level === "number");
  const levelCounts = new Map();
  const mobGroupNameCounts = new Map();
  const classCounts = new Map();
  const raceCounts = new Map();
  const normalizedRaceCounts = new Map();
  const normalizedRaceLevelCounts = new Map();
  const raceAliases = new Map();
  const typeCounts = new Map();

  for (const row of detailRows) {
    increment(mobGroupNameCounts, row.displayName);
    increment(classCounts, row.className);
    increment(raceCounts, row.rawRace);
    increment(normalizedRaceCounts, row.race);
    increment(typeCounts, row.type);
    if (row.rawRace) {
      const aliases = raceAliases.get(row.race) ?? new Set();
      aliases.add(row.rawRace);
      raceAliases.set(row.race, aliases);
    }
    if (typeof row.level === "number") {
      increment(levelCounts, String(row.level));
      incrementNested(normalizedRaceLevelCounts, row.race, row.level);
    }
  }

  const levelBuckets = Object.fromEntries(levelBucketDefinitions.map(([label]) => [label, 0]));
  for (const level of levels) {
    const bucket = levelBucketDefinitions.find(([, min, max]) => level >= min && level <= max)?.[0] ?? "Unknown";
    levelBuckets[bucket] = (levelBuckets[bucket] ?? 0) + 1;
  }

  const minLevel = levels.length ? Math.min(...levels) : null;
  const maxLevel = levels.length ? Math.max(...levels) : null;
  const note = "Source: EQMap/PEQ spawn-group data. Counts use the highest-chance candidate per spawn group.";
  const summary = {
    zoneSlug: "cazic-thule",
    zoneName: "Cazic-Thule",
    sourceFile: `${shortName}.json`,
    matched: true,
    expansion: "Classic",
    expansionSource: "eqmap-prototype",
    sourceKind: "EQMap/PEQ spawn-group data",
    sourceUrl,
    eraTag: "Classic / likely 1.0",
    dataVersionTag: null,
    mobCount: detailRows.length,
    unknownLevelCount: detailRows.filter((row) => row.level === null).length,
    minLevel,
    maxLevel,
    averageLevel: levels.length ? Number((levels.reduce((sum, level) => sum + level, 0) / levels.length).toFixed(1)) : null,
    medianLevel: median(levels),
    levelCounts: Object.fromEntries([...levelCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
    levelBuckets,
    levelProfileLabel: levelProfileLabel(levelBuckets, minLevel, maxLevel),
    mobGroupNameCounts: sortedCountObject(mobGroupNameCounts),
    classCounts: sortedCountObject(classCounts),
    raceCounts: sortedCountObject(raceCounts),
    normalizedRaceCounts: sortedCountObject(normalizedRaceCounts),
    normalizedRaceLevelCounts: sortedNestedCountObject(normalizedRaceLevelCounts),
    raceAliases: Object.fromEntries([...raceAliases.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([race, aliases]) => [race, [...aliases].sort()])),
    typeCounts: sortedCountObject(typeCounts),
    notes: [
      note,
      "Imported zone snapshot; not a guaranteed live spawn list.",
    ],
  };

  const detail = {
    zoneSlug: summary.zoneSlug,
    routeSlug: shortName,
    zoneName: summary.zoneName,
    sourceFile: summary.sourceFile,
    sourceKind: summary.sourceKind,
    sourceUrl,
    spawnMapPrototype: {
      sourceKind: summary.sourceKind,
      coordinateNote: "Coordinates are normalized from EQMap x/y values for this lightweight prototype.",
      points: primarySpawnRows.map((row) => ({
        spawnGroupIndex: row.spawnGroupIndex,
        name: row.name,
        displayName: row.displayName,
        level: row.level,
        race: row.race,
        rawRace: row.rawRace,
        className: row.className,
        x: row.x,
        y: row.y,
        z: row.z,
        heading: row.heading,
        chance: row.chance,
        respawnTime: row.respawnTime,
        candidateCount: row.candidateCount,
      })),
    },
    mobGroups: buildMobGroups(detailRows),
    rows: detailRows.sort((a, b) => (a.level ?? Infinity) - (b.level ?? Infinity) || a.displayName.localeCompare(b.displayName)),
  };

  return { summary, detail, primarySpawnRows };
}

async function main() {
  const manifest = JSON.parse((await fetchText(`${baseUrl}/asset-manifest.json`)).text);
  const mainJsPath = manifest.files?.["main.js"];
  const bundleText = (await fetchText(new URL(mainJsPath, baseUrl).href)).text;
  const raceById = parseRaceLookup(bundleText);
  const classById = parseClassLookup(bundleText);

  const attempts = [];
  let selected = null;
  for (const shortName of zoneShortNameCandidates) {
    const attempt = await fetchJsonIfAvailable(shortName);
    attempts.push({ shortName, sourceUrl: attempt.sourceUrl, ok: attempt.ok, status: attempt.status, contentType: attempt.contentType, textLength: attempt.textLength });
    if (!selected && attempt.ok) selected = attempt;
  }
  if (!selected) throw new Error("No EQMap Cazic-Thule shortname returned usable JSON.");

  const { summary, detail, primarySpawnRows } = buildSummaryAndDetails({
    sourceUrl: selected.sourceUrl,
    shortName: selected.shortName,
    zoneGroups: selected.json,
    raceById,
    classById,
  });

  const summaries = JSON.parse(readFileSync(summariesPath, "utf8"));
  const details = JSON.parse(readFileSync(detailsPath, "utf8"));
  let oldCsvHidden = false;
  for (const oldSummary of summaries) {
    if (oldSummary.sourceFile === "cazicthule.csv" || oldSummary.zoneSlug === "temple-of-cazic-thule") {
      oldSummary.hiddenFromZones = true;
      oldSummary.deprecatedBy = "eqmap-cazicthule-prototype";
      oldSummary.deprecatedReason = "Likely Cazic-Thule 2.0/revamped CSV snapshot; hidden from normal player browsing.";
      oldCsvHidden = true;
    }
  }

  const nextSummaries = summaries.filter((existing) => existing.sourceFile !== summary.sourceFile && existing.zoneSlug !== summary.zoneSlug);
  nextSummaries.push(summary);
  nextSummaries.sort((a, b) => a.zoneName.localeCompare(b.zoneName));

  const nextDetails = details.filter((existing) => existing.sourceFile !== detail.sourceFile && existing.zoneSlug !== detail.zoneSlug && existing.routeSlug !== detail.routeSlug);
  nextDetails.push(detail);
  nextDetails.sort((a, b) => a.zoneName.localeCompare(b.zoneName));

  const testOutput = {
    zoneShortName: selected.shortName,
    zoneName: summary.zoneName,
    sourceUrl: selected.sourceUrl,
    sourceKind: summary.sourceKind,
    eraTag: summary.eraTag,
    spawnGroupCount: selected.json.length,
    candidateCount: selected.json.reduce((sum, group) => sum + group.length, 0),
    primarySpawnRows,
  };
  const report = {
    shortnameAttempts: attempts,
    selectedShortname: selected.shortName,
    sourceUrl: selected.sourceUrl,
    spawnGroupsImported: selected.json.length,
    candidatesImported: testOutput.candidateCount,
    primaryRepresentativeCount: primarySpawnRows.length,
    oldCsvCazicThuleHidden: oldCsvHidden,
    missingFields: {
      primaryWithoutLevel: primarySpawnRows.filter((row) => row.level === null).length,
      primaryWithoutRace: primarySpawnRows.filter((row) => !row.race || row.race === "Unknown").length,
      primaryWithoutClass: primarySpawnRows.filter((row) => !row.className || row.className === "Unknown").length,
      primaryWithoutCoordinates: primarySpawnRows.filter((row) => row.x === null || row.y === null || row.z === null).length,
    },
    uncertainties: [
      "EQMap data appears PEQ/EQEmu-derived and should be treated as likely 1.0/classic approximation, not authoritative classic proof.",
      "Highest-chance candidates are representative rows; lower-chance named or alternate candidates remain nested in the test output for debugging.",
      "Reuse/license terms are unclear from the static app assets.",
    ],
  };

  writeFileSync(summariesPath, `${JSON.stringify(nextSummaries, null, 2)}\n`);
  writeFileSync(detailsPath, `${JSON.stringify(nextDetails, null, 2)}\n`);
  writeFileSync(testOutputPath, `${JSON.stringify(testOutput, null, 2)}\n`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Imported ${summary.zoneName} from ${selected.sourceUrl}`);
  console.log(`Primary representatives: ${primarySpawnRows.length}; candidates: ${testOutput.candidateCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
