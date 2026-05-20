import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const overrides = JSON.parse(fs.readFileSync(path.join(dataDir, "spawn-map-representative-overrides.json"), "utf8"));
const nativeMapIndex = JSON.parse(fs.readFileSync(path.join(dataDir, "eqemu-native-map-debug-index.json"), "utf8"));
const playerRareSources = JSON.parse(fs.readFileSync(path.join(dataDir, "real-spawn-player-rare-sources.json"), "utf8"));
const epicDropItemNameSet = new Set(playerRareSources.epicDropItemNames ?? []);

const namedTitlePattern = /\b(archon|avatar|baron|baroness|captain|chief|commander|count|countess|disciple|duke|duchess|emperor|empress|general|guardian|herald|king|knight|lady|lord|master|mistress|oracle|priest|prince|princess|prophet|queen|sage|seer|sentinel|sovereign|thex|viscount|warlord)\b/i;
const genericRolePattern = /\b(apprentice|archer|assassin|caster|champion|cleric|defender|guard|guardian|healer|knight|mage|minion|mystic|oracle|overseer|patriarch|priest|prisoner|protector|rogue|scout|sentinel|shaman|soldier|spirit|templar|warrior|wizard)\b/i;
const genericRacePattern = /\b(aviak|bat|beetle|brownie|crawler|drake|elemental|froglok|ghoul|giant|gnoll|goblin|golem|guard|imp|kobold|lizard|orc|piranha|rat|skeleton|snake|spider|tadpole|troll|wolf|zombie)\b/i;
const namedLootNamePattern = /\b(amulet|band|belt|blade|breastplate|bracer|cape|cloak|cord|crown|dagger|fang|gauntlets|gloves|greaves|hammer|heart|helm|jereed|leggings|mask|orb|robe|ring|scale|shield|sleeves|spear|staff|talisman|vambraces|wand)\b/i;

function normalizeName(value) {
  return String(value ?? "")
    .replace(/^#+/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTargetName(value) {
  return normalizeName(value).replace(/^(a|an|the)\s+/, "");
}

function isGenericSpawnName(candidate) {
  const rawName = String(candidate.name ?? "").toLowerCase();
  const name = normalizeTargetName(candidate.displayName || candidate.name);
  if (!name || rawName.startsWith("#")) return false;
  if (namedTitlePattern.test(name)) return false;
  return genericRacePattern.test(name) || genericRolePattern.test(name);
}

function isLikelyNamed(candidate) {
  const rawName = String(candidate.name ?? "").toLowerCase();
  if (rawName.startsWith("#")) return true;
  const name = String(candidate.displayName ?? "").trim();
  if (namedTitlePattern.test(name)) return true;
  if (isGenericSpawnName(candidate)) return false;
  return !/^(a|an|the)\s+/i.test(name) && !/\b(trap|unknown|radiant|raidstopper)\b/i.test(name);
}

function hasSpecificNamedDisplay(candidate) {
  const name = String(candidate.displayName || candidate.name || "").replace(/_/g, " ").trim();
  return Boolean(name)
    && !/^(a|an|the)\s+/i.test(name)
    && !/\b(trap|unknown|radiant|raidstopper)\b/i.test(name);
}

function spawnFootprintPenalty(spawnPointCount) {
  if (typeof spawnPointCount !== "number") return 0;
  if (spawnPointCount >= 30) return 3;
  if (spawnPointCount >= 20) return 2;
  if (spawnPointCount >= 12) return 1;
  return 0;
}

function isCommonPopulationCandidate(candidate, stats, spawnPointCount, isManualOverride) {
  if (isManualOverride || candidateIsEpicSource(candidate) || candidateIsSiteRareSource(candidate)) return false;
  if (String(candidate.name ?? "").startsWith("#")) return false;
  if ((candidate.chance ?? 100) <= 20) return false;
  if (stats.epicItemCount > 0) return false;
  return spawnFootprintPenalty(spawnPointCount) >= 2;
}

function matchesOverride(candidate, names) {
  const candidateNames = [normalizeTargetName(candidate.displayName), normalizeTargetName(candidate.name)].filter(Boolean);
  return names.some((overrideName) => candidateNames.some((candidateName) => (
    candidateName === overrideName || candidateName.includes(overrideName)
  )));
}

function playerRareSourceForCandidate(candidate) {
  const candidateNames = [normalizeTargetName(candidate.displayName), normalizeTargetName(candidate.name)].filter(Boolean);
  for (const name of candidateNames) {
    const source = playerRareSources.mobSources?.[name];
    if (source) return source;
  }
  return undefined;
}

function candidateIsEpicSource(candidate) {
  return playerRareSourceForCandidate(candidate)?.sourceKinds?.includes("epic-source-mob") ?? false;
}

function candidateIsSiteRareSource(candidate) {
  return playerRareSourceForCandidate(candidate)?.sourceKinds?.includes("group-named-loot") ?? false;
}

function itemHasStatsOrGear(item) {
  const raw = item?.itemDetails;
  if (!raw) return false;
  const hasEquipmentSlot = typeof raw.slots === "number" && raw.slots > 0;
  const hasCoreStats = [
    raw.ac,
    raw.damage,
    raw.delay,
    raw.attack,
    raw.accuracy,
    raw.avoidance,
    raw.haste,
    raw.regen,
    raw.manaregen,
    raw.enduranceregen,
  ].some((value) => typeof value === "number" && value !== 0);
  const hasStats = Object.values(raw.stats ?? {}).some((value) => typeof value === "number" && value !== 0)
    || Object.values(raw.resists ?? {}).some((value) => typeof value === "number" && value !== 0);
  return (hasEquipmentSlot && raw.itemtype !== 17) || hasCoreStats || hasStats;
}

function itemSignal(item, sourceMobCount = 1, sourceRatio = 0) {
  if (!item?.itemId && !item?.itemName) return { isMeaningful: false, isUniqueNamedLoot: false };
  const raw = item.itemDetails;
  const name = item.itemName ?? raw?.name ?? "";
  if (epicDropItemNameSet.has(normalizeTargetName(name))) return { isMeaningful: true, isUniqueNamedLoot: true };
  const hasSpecialFlag = raw?.nodrop === 0 || raw?.magic === 1 || Boolean(raw?.lore);
  const looksLikeJunk = /\b(coin|copper|silver|gold|platinum|page|rune|words|spider silk|spider legs|meat|water|ration|bone chips?)\b/i.test(name);
  const lowDistribution = sourceMobCount <= 2 || sourceRatio <= 0.025;
  const hasStatsOrGear = itemHasStatsOrGear(item);
  const hasNamedLootName = namedLootNamePattern.test(name);
  const isUniqueNamedLoot = lowDistribution && !looksLikeJunk && (hasNamedLootName || hasStatsOrGear || hasSpecialFlag);
  return {
    isMeaningful: isUniqueNamedLoot || hasStatsOrGear || (hasSpecialFlag && !looksLikeJunk),
    isUniqueNamedLoot,
  };
}

function buildLootDistribution(lootMobs) {
  const items = new Map();
  for (const mob of lootMobs ?? []) {
    const seen = new Set();
    for (const lootdrop of mob.lootdrops ?? []) {
      for (const item of lootdrop.items ?? []) {
        const key = item.itemId ? `id:${item.itemId}` : `name:${normalizeTargetName(item.itemName)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const current = items.get(key);
        if (current) {
          current.sourceNpcTypeIds.add(mob.npcTypeId);
          current.sourceMobCount = current.sourceNpcTypeIds.size;
        } else {
          items.set(key, { sourceMobCount: 1, sourceNpcTypeIds: new Set([mob.npcTypeId]) });
        }
      }
    }
  }
  return { mobCount: lootMobs?.length ?? 0, items };
}

function dropStats(mob, distribution) {
  const dropIds = new Set();
  const meaningfulIds = new Set();
  const statGearIds = new Set();
  const epicItemIds = new Set();
  const uniqueNamedLootIds = new Set();
  if (!mob) {
    return { dropCount: 0, epicItemCount: 0, meaningfulDropCount: 0, statGearDropCount: 0, uniqueNamedLootCount: 0, hasMeaningfulDrops: false };
  }
  for (const lootdrop of mob.lootdrops ?? []) {
    for (const item of lootdrop.items ?? []) {
      const key = String(item.itemId || item.itemName || "unknown");
      if (!key || key === "unknown") continue;
      const distributionKey = item.itemId ? `id:${item.itemId}` : `name:${normalizeTargetName(item.itemName)}`;
      const sourceMobCount = distribution?.items.get(distributionKey)?.sourceMobCount ?? 1;
      const sourceRatio = distribution?.mobCount ? sourceMobCount / distribution.mobCount : 0;
      const signal = itemSignal(item, sourceMobCount, sourceRatio);
      dropIds.add(key);
      if (epicDropItemNameSet.has(normalizeTargetName(item.itemName ?? item.itemDetails?.name))) epicItemIds.add(key);
      if (signal.isMeaningful) meaningfulIds.add(key);
      if (signal.isUniqueNamedLoot) uniqueNamedLootIds.add(key);
      if (itemHasStatsOrGear(item)) statGearIds.add(key);
    }
  }
  return {
    dropCount: dropIds.size,
    epicItemCount: epicItemIds.size,
    meaningfulDropCount: meaningfulIds.size,
    statGearDropCount: statGearIds.size,
    uniqueNamedLootCount: uniqueNamedLootIds.size,
    hasMeaningfulDrops: meaningfulIds.size > 0,
  };
}

function reasonLabel(reason) {
  switch (reason) {
    case "override": return "manual named override";
    case "epic-source": return "Epic item source";
    case "site-rare-source": return "Site rare loot source";
    case "unique-loot": return "unique named loot overrides spawn footprint";
    case "gear-footprint": return "loot-bearing rare candidate / lower spawn footprint";
    case "named-with-drops": return "named candidate with drops";
    case "named": return "named candidate";
    case "low-footprint-loot": return "low-spawn-count candidate with meaningful loot";
    case "low-chance-with-drops": return "low chance candidate with drops";
    case "drops": return "candidate with meaningful drops";
    case "low-chance-generic": return "low chance only";
    case "population": return "Common population mob despite semi-unique loot";
    default: return "highest chance common mob";
  }
}

function buildSpawnFootprints(spawnRows) {
  const footprints = new Map();
  const seen = new Set();
  for (const spawn of spawnRows ?? []) {
    const candidates = Array.isArray(spawn.candidates) && spawn.candidates.length
      ? spawn.candidates
      : [{
        npcTypeId: spawn.primaryNpcId ?? -1,
        displayName: spawn.displayName,
      }];
    for (const candidate of candidates) {
      if (typeof candidate.npcTypeId !== "number") continue;
      const key = `${candidate.npcTypeId}:${spawn.spawn2Id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const current = footprints.get(candidate.npcTypeId);
      footprints.set(candidate.npcTypeId, {
        displayName: current?.displayName ?? candidate.displayName,
        spawnPointCount: (current?.spawnPointCount ?? 0) + 1,
      });
    }
  }
  return footprints;
}

function chooseRepresentative(spawn, zoneShortName, lootByNpcId, spawnFootprints, lootDistribution) {
  const candidates = Array.isArray(spawn.candidates) && spawn.candidates.length
    ? spawn.candidates
    : [{
      npcTypeId: spawn.primaryNpcId ?? -1,
      name: spawn.primaryNpcName,
      displayName: spawn.displayName,
      level: spawn.level,
      race: spawn.race,
      className: spawn.className,
      chance: spawn.chance,
    }];
  const overrideNames = (overrides[zoneShortName]?.namedOverrides ?? []).map(normalizeTargetName).filter(Boolean);
  const primaryCandidate = candidates.find((candidate) => (
    typeof spawn.primaryNpcId === "number" && candidate.npcTypeId === spawn.primaryNpcId
  )) ?? candidates.find((candidate) => (
    normalizeTargetName(candidate.displayName) === normalizeTargetName(spawn.displayName)
    && (candidate.chance ?? null) === (spawn.chance ?? null)
  )) ?? candidates[0];
  const finiteFootprints = candidates
    .map((candidate) => spawnFootprints.get(candidate.npcTypeId)?.spawnPointCount ?? null)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const maxCandidateFootprint = finiteFootprints.length ? Math.max(...finiteFootprints) : null;
  const ranked = candidates.map((candidate) => {
    const isManualOverride = matchesOverride(candidate, overrideNames);
    const stats = dropStats(lootByNpcId.get(candidate.npcTypeId), lootDistribution);
    const isEpicSource = candidateIsEpicSource(candidate) || stats.epicItemCount > 0;
    const isSiteRareSource = candidateIsSiteRareSource(candidate);
    const isLowChance = (candidate.chance ?? 100) <= 20;
    const isGeneric = isGenericSpawnName(candidate);
    const spawnPointCount = spawnFootprints.get(candidate.npcTypeId)?.spawnPointCount ?? null;
    const isPopulation = isCommonPopulationCandidate(candidate, stats, spawnPointCount, isManualOverride);
    const isNamed = isManualOverride || isEpicSource || isSiteRareSource || (!isPopulation && isLikelyNamed(candidate) && stats.hasMeaningfulDrops);
    const hasLowerSpawnFootprint = typeof spawnPointCount === "number"
      && typeof maxCandidateFootprint === "number"
      && spawnPointCount < maxCandidateFootprint;
    const priority = isManualOverride
      ? 0
      : isEpicSource
        ? 1
        : isSiteRareSource
          ? 2
          : isPopulation
            ? 8
          : hasSpecificNamedDisplay(candidate) && stats.uniqueNamedLootCount > 0
            ? 3
            : isNamed && stats.hasMeaningfulDrops
              ? 4
              : hasLowerSpawnFootprint && stats.hasMeaningfulDrops
                ? 5
                : isLowChance && stats.hasMeaningfulDrops
                  ? 6
                  : isLowChance
                    ? 7
                    : 8;
    const reason = priority === 0
      ? "override"
      : priority === 1
        ? "epic-source"
        : priority === 2
          ? "site-rare-source"
          : isPopulation
            ? "population"
          : priority === 3
            ? "unique-loot"
            : priority === 4
              ? "named-with-drops"
              : priority === 5
                ? "low-footprint-loot"
                : priority === 6
                  ? "low-chance-with-drops"
                  : priority === 7
                    ? "low-chance-generic"
                  : "common";
    return {
      candidate,
      ...stats,
      hasLowerSpawnFootprint,
      isGeneric,
      isPopulation,
      isLowChance,
      isManualOverride,
      isNamed,
      isEpicSource,
      isSiteRareSource,
      priority,
      reason,
      spawnPointCount,
      footprintPenalty: spawnFootprintPenalty(spawnPointCount),
    };
  }).sort((a, b) => (
    a.priority - b.priority
    || b.statGearDropCount - a.statGearDropCount
    || b.meaningfulDropCount - a.meaningfulDropCount
    || (a.spawnPointCount ?? Number.POSITIVE_INFINITY) - (b.spawnPointCount ?? Number.POSITIVE_INFINITY)
    || (a.isGeneric === b.isGeneric ? 0 : a.isGeneric ? 1 : -1)
    || (a.candidate.chance ?? Number.POSITIVE_INFINITY) - (b.candidate.chance ?? Number.POSITIVE_INFINITY)
    || b.dropCount - a.dropCount
    || a.candidate.displayName.localeCompare(b.candidate.displayName)
  ));
  const best = ranked[0];
  return { primaryCandidate, representative: best };
}

const zones = [];
let checkedSpawnGroups = 0;
let differingRepresentatives = 0;
let namedCandidatesDetected = 0;
let manualOverridesUsed = 0;
let epicSourcePromotions = 0;
let siteRarePromotions = 0;
let lowChanceOnlyRepresentatives = 0;
const notableExamples = [];

for (const zoneShortName of Object.keys(nativeMapIndex).sort()) {
  const spawnPath = path.join(dataDir, `eqemu-${zoneShortName}-spawns-test.json`);
  if (!fs.existsSync(spawnPath)) continue;
  const lootPath = path.join(dataDir, `eqemu-${zoneShortName}-loot-test.json`);
  const spawnData = JSON.parse(fs.readFileSync(spawnPath, "utf8"));
  const lootData = fs.existsSync(lootPath) ? JSON.parse(fs.readFileSync(lootPath, "utf8")) : { mobs: [] };
  const lootByNpcId = new Map((lootData.mobs ?? []).map((mob) => [mob.npcTypeId, mob]));
  const lootDistribution = buildLootDistribution(lootData.mobs ?? []);
  const spawnFootprints = buildSpawnFootprints(spawnData.primarySpawnRows ?? []);
  const zoneRows = [];
  const detectedNames = new Set();
  let zoneOverridesUsed = 0;

  for (const spawn of spawnData.primarySpawnRows ?? []) {
    checkedSpawnGroups += 1;
    const { primaryCandidate, representative } = chooseRepresentative(spawn, zoneShortName, lootByNpcId, spawnFootprints, lootDistribution);
    if (!representative) continue;
    for (const candidate of spawn.candidates ?? []) {
      if (isLikelyNamed(candidate)) detectedNames.add(candidate.displayName);
    }
    if (representative.isManualOverride) {
      manualOverridesUsed += 1;
      zoneOverridesUsed += 1;
    }
    if (representative.reason === "epic-source") epicSourcePromotions += 1;
    if (representative.reason === "site-rare-source") siteRarePromotions += 1;
    if (representative.reason === "low-chance-generic") lowChanceOnlyRepresentatives += 1;
    const candidateScores = (spawn.candidates ?? []).map((candidate) => {
      const stats = dropStats(lootByNpcId.get(candidate.npcTypeId), lootDistribution);
      return {
        name: candidate.displayName,
        chance: candidate.chance,
        named: isLikelyNamed(candidate),
        epicSource: candidateIsEpicSource(candidate) || stats.epicItemCount > 0,
        siteRareSource: candidateIsSiteRareSource(candidate),
        selected: candidate.npcTypeId === representative.candidate.npcTypeId,
        spawnPointCount: spawnFootprints.get(candidate.npcTypeId)?.spawnPointCount ?? null,
        footprintPenalty: spawnFootprintPenalty(spawnFootprints.get(candidate.npcTypeId)?.spawnPointCount ?? null),
        populationMob: isCommonPopulationCandidate(candidate, stats, spawnFootprints.get(candidate.npcTypeId)?.spawnPointCount ?? null, false),
        dropCount: stats.dropCount,
        meaningfulDropCount: stats.meaningfulDropCount,
        uniqueNamedLootCount: stats.uniqueNamedLootCount,
        statGearDropCount: stats.statGearDropCount,
      };
    });
    const isNotable = [representative.candidate.displayName, ...candidateScores.map((candidate) => candidate.name)]
      .some((name) => /^(an iksar betrayer|iksar betrayer|wraith of a di[`'’]?zok hero|noxious spider|solusek kobold king)$/i.test(name));
    if (isNotable) {
      notableExamples.push({
        zoneShortName,
        spawn2Id: spawn.spawn2Id,
        primaryCommonMob: primaryCandidate.displayName,
        primaryChance: primaryCandidate.chance,
        mapRepresentative: representative.candidate.displayName,
        representativeChance: representative.candidate.chance,
        reason: reasonLabel(representative.reason),
        candidates: candidateScores,
      });
    }
    if (
      representative.candidate.npcTypeId !== primaryCandidate.npcTypeId
      && (
        normalizeTargetName(representative.candidate.displayName) !== normalizeTargetName(primaryCandidate.displayName)
        || representative.reason !== "common"
      )
    ) {
      differingRepresentatives += 1;
      zoneRows.push({
        spawn2Id: spawn.spawn2Id,
        spawngroupId: spawn.spawngroupId,
        primaryCommonMob: primaryCandidate.displayName,
        primaryChance: primaryCandidate.chance,
        mapRepresentative: representative.candidate.displayName,
        representativeChance: representative.candidate.chance,
        reason: reasonLabel(representative.reason),
        representativeDropCount: representative.dropCount,
        representativeMeaningfulDropCount: representative.meaningfulDropCount,
        representativeStatGearDropCount: representative.statGearDropCount,
        representativeSpawnPointCount: representative.spawnPointCount,
        candidates: candidateScores,
      });
    }
  }

  namedCandidatesDetected += detectedNames.size;
  zones.push({
    zoneShortName,
    zoneName: spawnData.zoneName ?? nativeMapIndex[zoneShortName]?.zoneName ?? zoneShortName,
    checkedSpawnGroups: (spawnData.primarySpawnRows ?? []).length,
    differingRepresentativeCount: zoneRows.length,
    namedCandidatesDetected: Array.from(detectedNames).sort(),
    manualOverrideNames: overrides[zoneShortName]?.namedOverrides ?? [],
    manualOverrideUses: zoneOverridesUsed,
    representativeDiffs: zoneRows,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    checkedZones: zones.length,
    checkedSpawnGroups,
    differingRepresentatives,
    namedCandidatesDetected,
    manualOverridesUsed,
    epicSourcePromotions,
    siteRarePromotions,
    lowChanceOnlyRepresentatives,
    notableExamples: notableExamples.length,
  },
  notes: [
    "Map representatives use player-relevant candidate priority and do not change EQEmu highest-chance primary summary counts.",
    "Manual overrides, epic-source mobs/items, and existing site group-named loot sources outrank chance-only heuristics.",
    "Low-chance-only candidates are tracked but do not receive Named/Rare map coloring without site/epic/meaningful-loot support.",
    "Generic race/class labels are prevented from winning named priority unless they have stronger site or loot evidence.",
  ],
  zones,
  notableExamples,
};

fs.writeFileSync(path.join(dataDir, "real-spawn-map-representative-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote representative report for ${zones.length} zones; ${differingRepresentatives} spawn slots differ from primary.`);
