import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const inputDir = resolve(process.argv[2] ?? "data/zone-mob-csv-source");
const outputPath = resolve(process.argv[3] ?? "data/zone-mob-summaries.json");
const reportPath = resolve(process.argv[4] ?? "data/zone-mob-summary-report.json");
const expansionReportPath = resolve(process.argv[5] ?? "data/zone-expansion-mapping-report.json");
const detailOutputPath = resolve(process.argv[6] ?? "data/zone-mob-details.json");

const revampedZoneNames = new Set([
  "Cazic Thule",
  "Temple of Cazic-Thule",
  "Droga",
  "Temple of Droga",
  "The Temple of Droga",
  "Splitpaw",
  "The Lair of the Splitpaw",
  "Plane of Hate",
  "The Plane of Hate",
]);
const levelBucketDefinitions = [
  ["1-10", 1, 10],
  ["11-20", 11, 20],
  ["21-30", 21, 30],
  ["31-40", 31, 40],
  ["41-50", 41, 50],
  ["51-60", 51, 60],
  ["61+", 61, Number.POSITIVE_INFINITY],
];
const pickExpansionNamesById = {
  1: "Classic",
  2: "Kunark",
  3: "Velious",
  4: "Luclin",
  5: "Planes of Power",
  6: "Legacy of Ykesha",
  7: "Lost Dungeons of Norrath",
  8: "Gates of Discord",
  9: "Omens of War",
  10: "Dragons of Norrath",
  11: "Depths of Darkhollow",
  12: "Prophecy of Ro",
  13: "The Serpent's Spine",
  14: "The Buried Sea",
  15: "Secrets of Faydwer",
  16: "Seeds of Destruction",
  17: "Underfoot",
  18: "House of Thule",
  19: "Veil of Alaris",
  20: "Rain of Fear",
  21: "Call of the Forsaken",
  22: "The Darkened Sea",
  23: "The Broken Mirror",
  24: "Empires of Kunark",
  25: "Ring of Scale",
  26: "The Burning Lands",
  27: "Torment of Velious",
  28: "Claws of Veeshan",
  29: "Terror of Luclin",
  30: "Night of Shadows",
  31: "Laurion's Song",
};

const filenameAliases = new Map(Object.entries({
  acrylia: "Acrylia Caverns",
  airplane: "Plane of Sky",
  akheva: "Akheva Ruins",
  beholder: "The Gorge of King Xorbb",
  bothunder: "Bastion of Thunder",
  burningwood: "The Burning Woods",
  butcher: "Butcherblock Mountains",
  cauldron: "Dagnor's Cauldron",
  cazicthule: "Temple of Cazic-Thule",
  charasis: "Howling Stones",
  citymist: "The City of Mist",
  cobaltscar: "Cobalt Scar",
  codecay: "Crypt of Decay",
  commonlands: "Commonlands",
  crystal: "Crystal Caverns",
  dawnshroud: "Dawnshroud Peaks",
  eastkarana: "The Eastern Plains of Karana",
  eastwastes: "Eastern Wastes",
  echo: "Echo Caverns",
  emeraldjungle: "Emerald Jungle",
  erudsxing: "Erud's Crossing",
  everfrost: "Everfrost Peaks",
  feerrott: "The Feerrott",
  fieldofbone: "The Field of Bone",
  fearplane: "Plane of Fear",
  firiona: "Firiona Vie",
  freeportsewers: "Freeport Sewers",
  freeportwest: "West Freeport",
  frontiermtns: "Frontier Mountains",
  frozenshadow: "Tower of Frozen Shadow",
  fungusgrove: "The Fungus Grove",
  gfaydark: "Greater Faydark",
  greatdivide: "Great Divide",
  griegsend: "Grieg's End",
  growthplane: "Plane of Growth",
  grimling: "Grimling Forest",
  droga: "Temple of Droga",
  dulak: "Dulak's Harbor",
  gukbottom: "Lower Guk",
  guktop: "Upper Guk",
  gunthak: "The Gulf of Gunthak",
  hatesfury: "Hate's Fury, The Scorned Maiden",
  highkeep: "High Keep",
  highpasshold: "Highpass Hold",
  hateplaneb: "Plane of Hate",
  hole: "The Hole",
  hohonora: "Halls of Honor",
  hohonorb: "Temple of Marr",
  hollowshade: "Hollowshade Moor",
  iceclad: "Iceclad Ocean",
  innothuleb: "Innothule Swamp",
  jaggedpine: "Jaggedpine Forest",
  kael: "Kael Drakkal",
  karnor: "Karnor's Castle",
  katta: "Katta Castellum",
  kedge: "Kedge Keep",
  kithicor: "Kithicor Forest",
  kurn: "Kurn's Tower",
  lakeofillomen: "Lake of Ill Omen",
  lakerathe: "Lake Rathetear",
  lavastorm: "The Lavastorm Mountains",
  lfaydark: "Lesser Faydark",
  maiden: "Maiden's Eye",
  letalis: "Mons Letalis",
  mistythicket: "Misty Thicket",
  mistmoore: "Castle Mistmoore",
  mischiefplane: "Plane of Mischief",
  mseru: "Marus Seru",
  nadox: "Crypt of Nadox",
  nedaria: "Nedaria's Landing",
  necropolis: "Dragon Necropolis",
  nektulos: "Nektulos Forest",
  netherbian: "Netherbian Lair",
  northkarana: "The Northern Plains of Karana",
  northro: "North Ro",
  nurga: "Mines of Nurga",
  oceanoftears: "Ocean of Tears",
  overthere: "The Overthere",
  paludal: "Paludal Caverns",
  paw: "The Lair of the Splitpaw",
  poair: "Plane of Air",
  podisease: "Plane of Disease",
  poeartha: "Plane of Earth A",
  poearthb: "Plane of Earth B",
  pofire: "Plane of Fire",
  poinnovation: "Plane of Innovation",
  pojustice: "Plane of Justice",
  ponightmare: "Plane of Nightmare",
  postorms: "Plane of Storm",
  potactics: "Plane of Tactics",
  potranquility: "Plane of Tranquility",
  potorment: "Plane of Torment",
  povalor: "Plane of Valor",
  powater: "Plane of Water",
  permafrost: "Permafrost Keep",
  qey2hh1: "Qeynos Hills",
  qeynos2: "North Qeynos",
  qeytoqrg: "Qeynos Hills",
  qcat: "The Qeynos Aqueduct System",
  qrg: "Surefall Glade",
  rathemtn: "Rathe Mountains",
  runnyeye: "Clan Runnyeye",
  scarlet: "Scarlet Desert",
  sebilis: "Old Sebilis",
  shadeweaver: "Shadeweaver's Thicket",
  sirens: "Siren's Grotto",
  skyfire: "Skyfire Mountains",
  sleeper: "Sleeper's Tomb",
  soldunga: "Solusek's Eye",
  soldungb: "Nagafen's Lair",
  solrotower: "Solusek Ro's Tower",
  soltemple: "Temple of Solusek Ro",
  southkarana: "The Southern Plains of Karana",
  southro: "South Ro",
  sseru: "Sanctus Seru",
  ssratemple: "Ssraeshza Temple",
  steamfontmts: "Steamfont Mountains",
  stonebrunt: "Stonebrunt Mountains",
  swampofnohope: "Swamp of No Hope",
  tenebrous: "Tenebrous Mountains",
  templeveeshan: "Temple of Veeshan",
  thedeep: "The Deep",
  thegrey: "The Grey",
  thurgadina: "Thurgadin",
  thurgadinb: "Icewell Keep",
  timorous: "Timorous Deep",
  toxxulia: "Toxxulia Forest",
  torgiran: "Torgiran Mines",
  trakanon: "Trakanon's Teeth",
  twilight: "Twilight Sea",
  umbral: "Umbral Plains",
  unrest: "Estate of Unrest",
  velketor: "Velketor's Labyrinth",
  vexthal: "Vex Thal",
  wakening: "Wakening Land",
  warslikswood: "Warsliks Wood",
  westwastes: "Western Wastes",
}));

const expansionAliasesByFilename = new Map(Object.entries({
  nedaria: "Legacy of Ykesha",
  poeartha: "Planes of Power",
  poearthb: "Planes of Power",
}));

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

function readPickZoneNames() {
  return readPickZoneRecords().map((zone) => zone.zoneName);
}

function readPickZoneRecords() {
  const pickZonesSource = readFileSync(resolve("data/pick-zones.ts"), "utf8");
  const match = pickZonesSource.match(/export const pickZones = (\[[\s\S]*?\]) as const satisfies PickZone\[];/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
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
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
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

const raceNormalizationRules = [
  ["frost giant", "Frost Giant"],
  ["storm giant", "Storm Giant"],
  ["sand giant", "Sand Giant"],
  ["hill giant", "Hill Giant"],
  ["ice giant", "Ice Giant"],
  ["fire giant", "Fire Giant"],
  ["forest giant", "Forest Giant"],
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
];

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

function resolveZoneName(fileName, knownZonesBySlug) {
  const key = normalizeFilename(fileName);
  const aliasName = filenameAliases.get(key);
  if (aliasName) return { zoneName: aliasName, matched: knownZonesBySlug.has(zoneToSlug(aliasName)), aliasUsed: key };

  const directSlug = zoneToSlug(basename(fileName, extname(fileName)));
  if (knownZonesBySlug.has(directSlug)) return { zoneName: knownZonesBySlug.get(directSlug), matched: true, aliasUsed: null };
  return { zoneName: titleFromFilename(fileName), matched: false, aliasUsed: null };
}

function pickExpansionName(record) {
  if (!record) return null;
  if (record.expansionName && record.expansionName !== "All Other Zones") return record.expansionName;
  return pickExpansionNamesById[record.expansionStart] ?? "Later / Other";
}

function resolveExpansion({ zoneName, zoneSlug, sourceFile }, dailyExpansionsBySlug, pickZonesBySlug) {
  const fileKey = normalizeFilename(sourceFile);
  const dailyMatch = dailyExpansionsBySlug.get(zoneSlug);
  const pickMatch = pickZonesBySlug.get(zoneSlug);
  if (dailyMatch) {
    return {
      expansion: dailyMatch.expansion,
      source: "daily-bonuses",
      pickExpansion: pickExpansionName(pickMatch),
      pickGrouping: pickMatch?.expansionName ?? null,
      matchedZoneName: dailyMatch.zoneName,
    };
  }
  if (pickMatch) {
    return {
      expansion: pickExpansionName(pickMatch),
      source: pickMatch.expansionName === "All Other Zones" ? "pick-expansion-id" : "pick-zones",
      pickExpansion: pickExpansionName(pickMatch),
      pickGrouping: pickMatch.expansionName,
      matchedZoneName: pickMatch.zoneName,
    };
  }
  const expansionAlias = expansionAliasesByFilename.get(fileKey);
  if (expansionAlias) {
    return {
      expansion: expansionAlias,
      source: "filename-expansion-alias",
      pickExpansion: null,
      pickGrouping: null,
      matchedZoneName: zoneName,
    };
  }
  return {
    expansion: "Unmapped",
    source: "unmapped",
    pickExpansion: null,
    pickGrouping: null,
    matchedZoneName: zoneName,
    note: `No expansion mapping found for ${zoneName} from ${sourceFile}.`,
  };
}

const pickZoneRecords = readPickZoneRecords();
const pickZonesBySlug = new Map(pickZoneRecords.map((zone) => [zoneToSlug(zone.zoneName), zone]));
const dailyZoneExpansions = readDailyBonusZoneExpansions();
const dailyExpansionsBySlug = new Map(dailyZoneExpansions.map((zone) => [zoneToSlug(zone.zoneName), zone]));
const knownZonesBySlug = new Map([
  ...pickZoneRecords.map((zone) => [zoneToSlug(zone.zoneName), zone.zoneName]),
  ...dailyZoneExpansions.map((zone) => [zoneToSlug(zone.zoneName), zone.zoneName]),
]);
const summaries = [];
const details = [];
const report = {
  sourceDirectory: inputDir,
  totalCsvFilesProcessed: 0,
  matchedZones: [],
  unmatchedZones: [],
  skippedFiles: [],
  rowsProcessed: 0,
  rowsWithInvalidOrMissingLevels: 0,
  zonesTaggedLikelyRevamped: [],
  duplicateSlugMappings: [],
};
const expansionReport = {
  source: "Daily Bonuses baseZones mapping with pick-zone expansion-id fallback",
  totalCsvZones: 0,
  mappedZones: [],
  unmappedZones: [],
  zonesMissingFromDailyBonusMapping: [],
  differsFromPickGrouping: [],
  aliasesUsed: [],
  suggestedAliases: [],
};
const slugSources = new Map();

for (const fileName of readdirSync(inputDir)) {
  if (fileName.startsWith(".") || extname(fileName).toLowerCase() !== ".csv") {
    report.skippedFiles.push(fileName);
    continue;
  }

  report.totalCsvFilesProcessed += 1;
  const sourceFile = fileName;
  const raw = readFileSync(join(inputDir, fileName), "utf8").replace(/^\uFEFF/, "");
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
    report.skippedFiles.push(`${fileName}: missing Level column`);
    continue;
  }

  const { zoneName, matched, aliasUsed } = resolveZoneName(fileName, knownZonesBySlug);
  const zoneSlug = zoneToSlug(zoneName);
  const expansionResolution = resolveExpansion({ zoneName, zoneSlug, sourceFile }, dailyExpansionsBySlug, pickZonesBySlug);
  const siteMatched = matched || expansionResolution.source !== "unmapped";
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
    report.rowsProcessed += 1;
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
    }
    else {
      unknownLevelCount += 1;
      report.rowsWithInvalidOrMissingLevels += 1;
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

  const notes = [];
  let dataVersionTag = null;
  let dataEra = null;
  let dataStatus = null;
  let expectedReplacement = null;
  if (revampedZoneNames.has(zoneName)) {
    dataVersionTag = "2.0 / Revamp Data";
    dataEra = "revamp";
    dataStatus = "temporary";
    expectedReplacement = "classic-1.0";
    notes.push("Using temporary 2.0/revamp-era data. Will be updated when classic-era data becomes available.");
    report.zonesTaggedLikelyRevamped.push(zoneName);
  }
  if (expansionResolution.note) notes.push(expansionResolution.note);

  const previousSource = slugSources.get(zoneSlug);
  if (previousSource) report.duplicateSlugMappings.push({ zoneSlug, sourceFiles: [previousSource, sourceFile] });
  slugSources.set(zoneSlug, sourceFile);

  const minLevel = levels.length ? Math.min(...levels) : null;
  const maxLevel = levels.length ? Math.max(...levels) : null;
  const summary = {
    zoneSlug,
    zoneName,
    sourceFile,
    matched: siteMatched,
    expansion: expansionResolution.expansion,
    expansionSource: expansionResolution.source,
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
    eraTag: dataVersionTag,
    dataVersionTag,
    dataEra,
    dataStatus,
    expectedReplacement,
  };

  summaries.push(summary);
  details.push({
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
  });
  if (siteMatched) report.matchedZones.push({ zoneSlug, zoneName, sourceFile });
  else report.unmatchedZones.push({ zoneSlug, zoneName, sourceFile });

  if (expansionResolution.source === "unmapped") {
    expansionReport.unmappedZones.push({ zoneSlug, zoneName, sourceFile });
  } else {
    expansionReport.mappedZones.push({
      zoneSlug,
      zoneName,
      sourceFile,
      expansion: expansionResolution.expansion,
      expansionSource: expansionResolution.source,
      matchedZoneName: expansionResolution.matchedZoneName,
    });
  }
  if (expansionResolution.source !== "daily-bonuses") {
    expansionReport.zonesMissingFromDailyBonusMapping.push({
      zoneSlug,
      zoneName,
      sourceFile,
      expansion: expansionResolution.expansion,
      expansionSource: expansionResolution.source,
    });
  }
  if (expansionResolution.pickGrouping && expansionResolution.pickGrouping !== expansionResolution.expansion) {
    expansionReport.differsFromPickGrouping.push({
      zoneSlug,
      zoneName,
      sourceFile,
      mappedExpansion: expansionResolution.expansion,
      pickGrouping: expansionResolution.pickGrouping,
      pickExpansion: expansionResolution.pickExpansion,
    });
  }
  if (aliasUsed) {
    expansionReport.aliasesUsed.push({
      sourceFile,
      alias: aliasUsed,
      zoneName,
      expansion: expansionResolution.expansion,
    });
  }
  if (expansionResolution.source === "unmapped") {
    expansionReport.suggestedAliases.push({
      sourceFile,
      suggestedAliasKey: normalizeFilename(sourceFile),
      suggestedZoneName: zoneName,
    });
  }
}

summaries.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
details.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
report.matchedZones.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
report.unmatchedZones.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
report.zonesTaggedLikelyRevamped = Array.from(new Set(report.zonesTaggedLikelyRevamped)).sort();
expansionReport.totalCsvZones = summaries.length;
expansionReport.mappedZones.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.unmappedZones.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.zonesMissingFromDailyBonusMapping.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.differsFromPickGrouping.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.aliasesUsed.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
expansionReport.suggestedAliases.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));

mkdirSync(resolve("data"), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(summaries, null, 2)}\n`);
writeFileSync(detailOutputPath, `${JSON.stringify(details, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(expansionReportPath, `${JSON.stringify(expansionReport, null, 2)}\n`);
console.log(`Generated ${summaries.length} zone mob summaries at ${outputPath}`);
console.log(`Generated ${details.length} zone mob detail sets at ${detailOutputPath}`);
console.log(`Report written to ${reportPath}`);
console.log(`Expansion report written to ${expansionReportPath}`);
