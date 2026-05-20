import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const defaultServerRoot = "C:/eqserver/eqemu server";
const defaultConfigPath = `${defaultServerRoot}/eqemu_config.json`;
const defaultSystemSqlPath = `${defaultServerRoot}/peq/create_tables_system.sql`;
const defaultMysqlPath = "C:/Program Files/MariaDB 10.11/bin/mysql.exe";
const zoneShortName = process.argv[2] ?? "cazicthule";
const configPath = resolve(process.argv[3] ?? defaultConfigPath);
const mysqlPath = process.argv[4] ?? defaultMysqlPath;
const systemSqlPath = resolve(process.argv[5] ?? defaultSystemSqlPath);

const rawOutputPath = resolve(`data/eqemu-${zoneShortName}-spawns-test.json`);
const summaryOutputPath = resolve(`data/eqemu-${zoneShortName}-zone-summary-test.json`);
const reportOutputPath = resolve("data/eqemu-zone-export-report.json");
const suppressionConfigPath = resolve("data/real-spawn-npc-suppressions.json");

const requiredTables = [
  "zone",
  "npc_types",
  "spawn2",
  "spawngroup",
  "spawnentry",
  "loottable",
  "lootdrop",
  "grid",
  "grid_entries",
];

const levelBucketDefinitions = [
  ["1-10", 1, 10],
  ["11-20", 11, 20],
  ["21-30", 21, 30],
  ["31-40", 31, 40],
  ["41-50", 41, 50],
  ["51-60", 51, 60],
  ["61+", 61, Number.POSITIVE_INFINITY],
];

const classNamesById = {
  1: "Warrior",
  2: "Cleric",
  3: "Paladin",
  4: "Ranger",
  5: "Shadowknight",
  6: "Druid",
  7: "Monk",
  8: "Bard",
  9: "Rogue",
  10: "Shaman",
  11: "Necromancer",
  12: "Wizard",
  13: "Magician",
  14: "Enchanter",
  15: "Beastlord",
  16: "Berserker",
  20: "Warrior GM",
  21: "Cleric GM",
  22: "Paladin GM",
  23: "Ranger GM",
  24: "Shadowknight GM",
  25: "Druid GM",
  26: "Monk GM",
  27: "Bard GM",
  28: "Rogue GM",
  29: "Shaman GM",
  30: "Necromancer GM",
  31: "Wizard GM",
  32: "Magician GM",
  33: "Enchanter GM",
  41: "Banker",
  60: "Merchant",
  61: "Discord Merchant",
  63: "Tribute Master",
  64: "Guild Tribute Master",
  66: "Alternate Currency Merchant",
  67: "Mercenary Merchant",
  70: "LDoN Adventure Recruiter",
  71: "LDoN Adventure Merchant",
};

const expansionNamesById = {
  "-1": "All / Unrestricted",
  0: "Classic",
  1: "Kunark",
  2: "Velious",
  3: "Luclin",
  4: "Planes of Power",
  5: "Legacy of Ykesha",
  6: "Lost Dungeons of Norrath",
  7: "Gates of Discord",
  8: "Omens of War",
  9: "Dragons of Norrath",
  10: "Depths of Darkhollow",
  11: "Prophecy of Ro",
  12: "The Serpent's Spine",
  13: "The Buried Sea",
  14: "Secrets of Faydwer",
};

const raceNormalizationRules = [
  ["frost giant", "Frost Giant"],
  ["storm giant", "Storm Giant"],
  ["sand giant", "Sand Giant"],
  ["hill giant", "Giant"],
  ["ice giant", "Giant"],
  ["fire giant", "Giant"],
  ["forest giant", "Giant"],
  ["giant", "Giant"],
  ["froglok", "Froglok"],
  ["goblin", "Goblin"],
  ["skeleton", "Skeleton"],
  ["skel", "Skeleton"],
  ["lizard man", "Lizard Man"],
  ["lizardman", "Lizard Man"],
  ["lizard", "Lizard Man"],
  ["orc", "Orc"],
  ["spider", "Spider"],
  ["dragon", "Dragon"],
  ["drake", "Drake"],
  ["kobold", "Kobold"],
  ["gnoll", "Gnoll"],
  ["iksar", "Iksar"],
  ["sarnak", "Sarnak"],
  ["troll", "Troll"],
  ["ogre", "Ogre"],
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
  ["golem", "Golem"],
  ["raptor", "Raptor"],
  ["piranha", "Piranha"],
  ["mosquito", "Mosquito"],
];

function usage() {
  return [
    "Usage:",
    "  node scripts/export-eqemu-zone-spawns.mjs [zoneShortName] [configPath] [mysqlPath] [systemSqlPath]",
    "",
    "Defaults:",
    `  zoneShortName: ${zoneShortName}`,
    `  configPath: ${defaultConfigPath}`,
    `  mysqlPath: ${defaultMysqlPath}`,
    `  systemSqlPath: ${defaultSystemSqlPath}`,
  ].join("\n");
}

function assertSafeZoneShortName(value) {
  if (!/^[a-z0-9_]+$/i.test(value)) {
    throw new Error(`Unsafe zone shortname "${value}".\n${usage()}`);
  }
}

function readConfig(path) {
  const config = JSON.parse(readFileSync(path, "utf8"));
  const database = config?.server?.database;
  if (!database?.host || !database?.username || !database?.db) {
    throw new Error(`Could not find server.database host/username/db in ${path}.`);
  }
  return {
    host: database.host,
    port: database.port ?? 3306,
    user: database.username,
    password: database.password ?? "",
    database: database.db,
  };
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeSuppressionName(value) {
  return displayMobName(value).toLowerCase();
}

const npcSuppressionConfig = readJson(suppressionConfigPath, { globalNpcSuppressions: [] });
const suppressedNpcNames = new Set((npcSuppressionConfig.globalNpcSuppressions ?? []).map(normalizeSuppressionName));

function isSuppressedNpcName(value) {
  return suppressedNpcNames.has(normalizeSuppressionName(value));
}

function isSuppressedNpcReference(value) {
  const normalized = normalizeSuppressionName(value).replace(/\s+\d+$/, "");
  if (normalized.length < 10) return false;
  return [...suppressedNpcNames].some((name) => name === normalized || name.startsWith(normalized) || normalized.startsWith(name));
}

function writeTempDefaultsFile(database) {
  const path = resolve(tmpdir(), `frostreaver-eqemu-${process.pid}-${Date.now()}.cnf`);
  writeFileSync(path, [
    "[client]",
    `host=${database.host}`,
    `port=${database.port}`,
    `user=${database.user}`,
    `password=${database.password}`,
    `database=${database.database}`,
    "",
  ].join("\n"));
  return path;
}

function runMysql(defaultsPath, sql) {
  const result = spawnSync(mysqlPath, [
    `--defaults-extra-file=${defaultsPath}`,
    "--batch",
    "--raw",
    "--execute",
    sql,
  ], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 80,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`mysql exited with ${result.status}: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result.stdout.replace(/\r\n/g, "\n").trimEnd();
}

function parseTsv(output) {
  if (!output.trim()) return [];
  const lines = output.split("\n");
  const headers = lines.shift().split("\t");
  return lines.filter(Boolean).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, normalizeSqlValue(values[index])])); 
  });
}

function normalizeSqlValue(value) {
  if (value === undefined || value === "NULL" || value === "\\N") return null;
  return value;
}

function sqlString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function sqlLikeString(value) {
  return sqlString(`%${String(value).replace(/[%_]/g, "")}%`);
}

function numberOrNull(value) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function expansionLabel(value) {
  if (value === null || value === undefined || value === "") return null;
  return expansionNamesById[String(value)] ?? `Expansion ${value}`;
}

function titleCaseWords(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

function displayMobName(rawName) {
  const cleaned = (rawName || "Unknown")
    .replace(/^#+/, "")
    .replace(/\d+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown";
  return titleCaseWords(cleaned);
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

function increment(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function incrementNestedLevelCount(map, race, level) {
  if (!race || typeof level !== "number") return;
  const levelMap = map.get(race) ?? new Map();
  increment(levelMap, String(level));
  map.set(race, levelMap);
}

function sortedCountObject(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function sortedNestedLevelCounts(map) {
  return Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([race, levelMap]) => [
        race,
        Object.fromEntries([...levelMap.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
      ]),
  );
}

function raceAliasObject(map) {
  return Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([race, aliases]) => [race, [...aliases].sort((a, b) => a.localeCompare(b))]),
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
  const [peakBucket, peakCount] = Object.entries(levelBuckets).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ["Unknown", 0];
  if (peakCount === 0) return null;
  if (minLevel !== null && maxLevel !== null && maxLevel - minLevel >= 30) return "Wide level spread";
  if (minLevel !== null && minLevel >= 50) return "High-level zone";
  return `Mostly ${peakBucket}`;
}

function createMobGroup(displayName, rows) {
  if (rows.length === 0) return null;
  const numericLevels = rows.map((row) => row.level).filter((level) => typeof level === "number");
  const rawNames = [...new Set(rows.map((row) => row.rawName))].sort((a, b) => a.localeCompare(b));
  const raceCounts = new Map();
  const rawRaceCounts = new Map();
  const classCounts = new Map();
  const typeCounts = new Map();
  const levels = [...new Set(numericLevels)].sort((a, b) => a - b);
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

    const sortedLevels = [...rowsByLevel.keys()].sort((a, b) => a - b);
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

function readRaceLookup(path) {
  try {
    const sql = readFileSync(path, "utf8");
    const races = {};
    const tuplePattern = /\((\d+),11,'((?:\\'|[^'])*)'\)/g;
    let match;
    while ((match = tuplePattern.exec(sql)) !== null) {
      races[match[1]] = match[2].replace(/\\'/g, "'");
    }
    return races;
  } catch {
    return {};
  }
}

function pickPrimaryCandidate(candidates) {
  return [...candidates].sort((a, b) =>
    (b.chance ?? 0) - (a.chance ?? 0)
    || (b.level ?? 0) - (a.level ?? 0)
    || String(a.npcName ?? "").localeCompare(String(b.npcName ?? "")),
  )[0] ?? null;
}

function buildSummary({ requestedZoneShortName, resolvedZoneShortName, zoneRecord, spawnSlots, raceLookup }) {
  const primaryRows = spawnSlots.map((slot) => {
    const primary = pickPrimaryCandidate(slot.candidates);
    const rawRace = primary?.raceId !== null ? raceLookup[String(primary?.raceId)] ?? `Race ${primary?.raceId}` : "Unknown";
    const normalizedRace = normalizeRaceName(rawRace);
    const className = primary?.classId !== null ? classNamesById[primary?.classId] ?? `Class ${primary?.classId}` : "Unknown";
    return {
      spawn2Id: slot.spawn2Id,
      spawngroupId: slot.spawngroupId,
      spawngroupName: slot.spawngroupName,
      x: slot.x,
      y: slot.y,
      z: slot.z,
      heading: slot.heading,
      respawnTime: slot.respawnTime,
      variance: slot.variance,
      pathgrid: slot.pathgrid,
      primaryNpcId: primary?.npcTypeId ?? null,
      primaryNpcName: primary?.npcName ?? "Unknown",
      displayName: displayMobName(primary?.npcName),
      level: primary?.level ?? null,
      raceId: primary?.raceId ?? null,
      race: normalizedRace,
      rawRace,
      classId: primary?.classId ?? null,
      className,
      bodytype: primary?.bodytype ?? null,
      hp: primary?.hp ?? null,
      chance: primary?.chance ?? null,
      candidateCount: slot.candidates.length,
      candidates: slot.candidates.map((candidate) => {
        const candidateRawRace = candidate.raceId !== null ? raceLookup[String(candidate.raceId)] ?? `Race ${candidate.raceId}` : "Unknown";
        return {
          npcTypeId: candidate.npcTypeId,
          name: candidate.npcName ?? "Unknown",
          displayName: displayMobName(candidate.npcName),
          level: candidate.level,
          raceId: candidate.raceId,
          race: normalizeRaceName(candidateRawRace),
          rawRace: candidateRawRace,
          classId: candidate.classId,
          className: candidate.classId !== null ? classNamesById[candidate.classId] ?? `Class ${candidate.classId}` : "Unknown",
          bodytype: candidate.bodytype,
          hp: candidate.hp,
          chance: candidate.chance,
          spawnentryMinExpansion: candidate.spawnentryMinExpansion,
          spawnentryMaxExpansion: candidate.spawnentryMaxExpansion,
        };
      }),
    };
  });

  const detailRows = primaryRows.map((row) => ({
    displayName: row.displayName,
    rawName: row.primaryNpcName,
    level: row.level,
    race: row.race,
    rawRace: row.rawRace,
    className: row.className,
    type: "Spawn Slot",
    x: row.x,
    y: row.y,
    z: row.z,
    heading: row.heading,
    chance: row.chance,
    respawnTime: row.respawnTime,
    spawn2Id: row.spawn2Id,
    spawngroupId: row.spawngroupId,
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
      incrementNestedLevelCount(normalizedRaceLevelCounts, row.race, row.level);
    }
  }

  const levelBuckets = Object.fromEntries(levelBucketDefinitions.map(([label]) => [label, 0]));
  for (const level of levels) {
    const bucket = levelBucketDefinitions.find(([, min, max]) => level >= min && level <= max)?.[0] ?? "Unknown";
    levelBuckets[bucket] = (levelBuckets[bucket] ?? 0) + 1;
  }

  const minLevel = levels.length ? Math.min(...levels) : null;
  const maxLevel = levels.length ? Math.max(...levels) : null;
  const zoneSlug = String(zoneRecord?.long_name ?? zoneShortName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const sourceNote = "Source: local EQEmu/PEQ database export. Counts use one primary representative per spawn2 slot, selected from the highest-chance spawnentry candidate.";

  return {
    raw: {
      requestedZoneShortName,
      zoneShortName: resolvedZoneShortName,
      zoneName: zoneRecord?.long_name ?? zoneShortName,
      sourceKind: "Local EQEmu/PEQ database export",
      sourceNote,
      spawnSlotCount: spawnSlots.length,
      candidateCount: spawnSlots.reduce((sum, slot) => sum + slot.candidates.length, 0),
      primarySpawnRows: primaryRows,
    },
    summary: {
      zoneSlug,
      zoneName: zoneRecord?.long_name ?? zoneShortName,
      requestedZoneShortName,
      zoneShortName: resolvedZoneShortName,
      sourceFile: "local-eqemu-database",
      matched: true,
      expansion: expansionLabel(zoneRecord?.expansion),
      eqemuExpansionId: numberOrNull(zoneRecord?.expansion),
      expansionSource: "eqemu-zone-table",
      sourceKind: "Local EQEmu/PEQ database export",
      sourceNote,
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
      normalizedRaceLevelCounts: sortedNestedLevelCounts(normalizedRaceLevelCounts),
      raceAliases: raceAliasObject(raceAliases),
      typeCounts: sortedCountObject(typeCounts),
      notes: [
        sourceNote,
        "Read-only test export; not wired into production /zones data.",
      ],
      spawnMapPrototype: {
        sourceKind: "Local EQEmu/PEQ database export",
        coordinateNote: "Original EQEmu spawn2 x/y/z coordinates are preserved for map prototyping.",
        points: primaryRows.map((row) => ({
          spawn2Id: row.spawn2Id,
          spawngroupId: row.spawngroupId,
          name: row.primaryNpcName,
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
    },
    details: {
      zoneSlug,
      routeSlug: resolvedZoneShortName,
      zoneName: zoneRecord?.long_name ?? zoneShortName,
      sourceFile: "local-eqemu-database",
      sourceKind: "Local EQEmu/PEQ database export",
      sourceNote,
      mobGroups: buildMobGroups(detailRows),
      rows: detailRows.sort((a, b) =>
        (a.level ?? Number.POSITIVE_INFINITY) - (b.level ?? Number.POSITIVE_INFINITY)
        || a.displayName.localeCompare(b.displayName)
      ),
    },
  };
}

function buildSpawnSlots(rows) {
  const bySpawn2 = new Map();
  for (const row of rows) {
    if (isSuppressedNpcName(row.npc_name)) continue;
    const spawn2Id = numberOrNull(row.spawn2_id);
    if (spawn2Id === null) continue;
    const slot = bySpawn2.get(spawn2Id) ?? {
      spawn2Id,
      spawngroupId: numberOrNull(row.spawngroupID),
      zone: row.zone,
      version: numberOrNull(row.version),
      x: numberOrNull(row.x),
      y: numberOrNull(row.y),
      z: numberOrNull(row.z),
      heading: numberOrNull(row.heading),
      respawnTime: numberOrNull(row.respawntime),
      variance: numberOrNull(row.variance),
      pathgrid: numberOrNull(row.pathgrid),
      spawngroupName: isSuppressedNpcReference(row.spawngroup_name) ? null : row.spawngroup_name,
      candidates: [],
    };
    slot.candidates.push({
      npcTypeId: numberOrNull(row.npcID),
      npcName: row.npc_name,
      level: numberOrNull(row.level),
      raceId: numberOrNull(row.race),
      classId: numberOrNull(row.class),
      bodytype: numberOrNull(row.bodytype),
      hp: numberOrNull(row.hp),
      chance: numberOrNull(row.chance),
      spawnentryMinExpansion: numberOrNull(row.spawnentry_min_expansion),
      spawnentryMaxExpansion: numberOrNull(row.spawnentry_max_expansion),
    });
    bySpawn2.set(spawn2Id, slot);
  }
  return [...bySpawn2.values()].filter((slot) => slot.candidates.length > 0).sort((a, b) => a.spawn2Id - b.spawn2Id);
}

function lookupZoneRecord(defaultsPath, requestedShortName, report) {
  const exactRows = parseTsv(runMysql(defaultsPath, `SELECT zoneidnumber, short_name, long_name, expansion, min_expansion, max_expansion FROM zone WHERE short_name = ${sqlString(requestedShortName)} LIMIT 1;`));
  report.zoneLookupAttempts.push({ type: "exact-short-name", value: requestedShortName, matches: exactRows.length });
  if (exactRows.length > 0) return { record: exactRows[0], matchedBy: "exact-short-name" };

  const searchTerms = new Set([requestedShortName]);
  if (/cazic|cthule/i.test(requestedShortName)) {
    searchTerms.add("cazic");
    searchTerms.add("thule");
  }

  for (const term of searchTerms) {
    const rows = parseTsv(runMysql(defaultsPath, `
SELECT zoneidnumber, short_name, long_name, expansion, min_expansion, max_expansion
FROM zone
WHERE short_name LIKE ${sqlLikeString(term)}
   OR long_name LIKE ${sqlLikeString(term)}
ORDER BY
  CASE
    WHEN short_name = ${sqlString(requestedShortName)} THEN 0
    WHEN short_name LIKE ${sqlLikeString(term)} THEN 1
    ELSE 2
  END,
  zoneidnumber
LIMIT 25;`));
    report.zoneLookupAttempts.push({
      type: "zone-table-search",
      value: term,
      matches: rows.length,
      candidates: rows.map((row) => ({
        zoneidnumber: row.zoneidnumber,
        short_name: row.short_name,
        long_name: row.long_name,
      })),
    });
    if (rows.length > 0) return { record: rows[0], matchedBy: `zone-table-search:${term}` };
  }

  throw new Error(`No zone row found for short_name=${requestedShortName}.`);
}

function main() {
  assertSafeZoneShortName(zoneShortName);
  const database = readConfig(configPath);
  const defaultsPath = writeTempDefaultsFile(database);
  const report = {
    source: "Local EQEmu/PEQ database",
    configPath,
    mysqlPath,
    zoneShortName,
    credentialsCommitted: false,
    credentialsHandling: "Credentials were read from the local EQEmu config and passed to mysql through a temporary defaults file that is deleted after the export.",
    tables: {},
    zoneLookupAttempts: [],
    zonesAvailableSample: [],
    testZone: null,
    assumptions: [
      "spawn2 rows are treated as active spawn slots.",
      "The primary representative is the highest-chance spawnentry candidate, with level/name tie-breakers.",
      "All spawnentry candidates are preserved in the raw test output for debugging.",
    ],
    missingFields: [],
    suppressedNpcConfig: {
      sourceFile: suppressionConfigPath,
      globalNpcSuppressions: [...suppressedNpcNames],
    },
  };

  try {
    const tableRows = parseTsv(runMysql(defaultsPath, `SHOW TABLES WHERE Tables_in_${database.database} IN (${requiredTables.map(sqlString).join(",")});`));
    const foundTableNames = new Set(tableRows.flatMap((row) => Object.values(row)));
    for (const tableName of requiredTables) {
      report.tables[tableName] = { found: foundTableNames.has(tableName) };
      if (foundTableNames.has(tableName)) {
        report.tables[tableName].columns = parseTsv(runMysql(defaultsPath, `SHOW COLUMNS FROM \`${tableName}\`;`)).map((row) => ({
          field: row.Field,
          type: row.Type,
          null: row.Null,
          key: row.Key,
          default: row.Default,
        }));
      }
    }

    report.zonesAvailableSample = parseTsv(runMysql(defaultsPath, "SELECT zoneidnumber, short_name, long_name, expansion, min_expansion, max_expansion FROM zone ORDER BY short_name LIMIT 250;"));
    const { record: zoneRecord, matchedBy } = lookupZoneRecord(defaultsPath, zoneShortName, report);
    const resolvedZoneShortName = zoneRecord.short_name;

    const spawnSql = `
SELECT
  s.id AS spawn2_id,
  s.spawngroupID,
  s.zone,
  s.version,
  s.x,
  s.y,
  s.z,
  s.heading,
  s.respawntime,
  s.variance,
  s.pathgrid,
  sg.name AS spawngroup_name,
  se.npcID,
  se.chance,
  se.min_expansion AS spawnentry_min_expansion,
  se.max_expansion AS spawnentry_max_expansion,
  nt.id AS npc_type_id,
  nt.name AS npc_name,
  nt.level,
  nt.race,
  nt.class,
  nt.bodytype,
  nt.hp
FROM spawn2 s
LEFT JOIN spawngroup sg ON sg.id = s.spawngroupID
LEFT JOIN spawnentry se ON se.spawngroupID = s.spawngroupID
LEFT JOIN npc_types nt ON nt.id = se.npcID
WHERE s.zone = ${sqlString(resolvedZoneShortName)}
ORDER BY s.id, se.chance DESC, nt.level DESC, nt.name;`;
    const spawnRows = parseTsv(runMysql(defaultsPath, spawnSql));
    const spawnSlots = buildSpawnSlots(spawnRows);
    const raceLookup = readRaceLookup(systemSqlPath);
    const { raw, summary, details } = buildSummary({
      requestedZoneShortName: zoneShortName,
      resolvedZoneShortName,
      zoneRecord,
      spawnSlots,
      raceLookup,
    });

    report.testZone = {
      zoneShortName,
      resolvedZoneShortName,
      zoneName: zoneRecord.long_name,
      zoneId: numberOrNull(zoneRecord.zoneidnumber),
      matchedBy,
      spawnSlots: spawnSlots.length,
      candidateRows: spawnRows.length,
      primaryRepresentatives: raw.primarySpawnRows.length,
      outputFiles: {
        raw: rawOutputPath,
        summary: summaryOutputPath,
      },
    };

    mkdirSync(dirname(rawOutputPath), { recursive: true });
    writeFileSync(rawOutputPath, `${JSON.stringify(raw, null, 2)}\n`);
    writeFileSync(summaryOutputPath, `${JSON.stringify({ summary, details }, null, 2)}\n`);
    writeFileSync(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(JSON.stringify({
      ok: true,
      requestedZoneShortName: zoneShortName,
      resolvedZoneShortName,
      zoneName: zoneRecord.long_name,
      spawnSlots: spawnSlots.length,
      candidates: spawnRows.length,
      outputs: [rawOutputPath, summaryOutputPath, reportOutputPath],
    }, null, 2));
  } finally {
    try {
      unlinkSync(defaultsPath);
    } catch {
      // Best-effort cleanup; the file only contains local credentials from the user's machine.
    }
  }
}

main();
