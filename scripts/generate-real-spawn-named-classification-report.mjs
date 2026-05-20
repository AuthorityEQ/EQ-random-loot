import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const overridesPath = path.join(dataDir, "spawn-map-representative-overrides.json");
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, "utf8")) : {};
const playerRareSourcesPath = path.join(dataDir, "real-spawn-player-rare-sources.json");
const playerRareSources = fs.existsSync(playerRareSourcesPath)
  ? JSON.parse(fs.readFileSync(playerRareSourcesPath, "utf8"))
  : { epicItemNames: [], mobSources: {} };
const epicDropItemNameSet = new Set(playerRareSources.epicDropItemNames ?? []);

const namedTitlePattern = /\b(archon|avatar|baron|baroness|captain|chief|commander|count|countess|disciple|duke|duchess|emperor|empress|general|guardian|herald|king|knight|lady|lord|master|mistress|oracle|priest|prince|princess|prophet|queen|sage|seer|sentinel|sovereign|thex|viscount|warlord)\b/i;
const genericRolePattern = /\b(apprentice|archer|assassin|caster|champion|cleric|defender|guard|guardian|healer|knight|mage|minion|mystic|oracle|overseer|patriarch|priest|prisoner|protector|rogue|scout|sentinel|shaman|soldier|spirit|templar|warrior|wizard)\b/i;
const genericRacePattern = /\b(aviak|bat|beetle|brownie|crawler|drake|elemental|froglok|ghoul|giant|gnoll|goblin|golem|guard|imp|kobold|lizard|orc|piranha|rat|sarnak|skeleton|snake|spider|tadpole|troll|wolf|zombie)\b/i;
const utilityClassPattern = /\b(banker|merchant|guildmaster|guild master|shopkeeper|trader|vendor|tribute master)\b/i;
const utilityNamePattern = /\b(banker|merchant|vendor|guildmaster|guild master|shopkeeper|soulbinder|soul binder|priest of discord|teleporter|translocator|portal|tribute master|adventure recruiter|parcel merchant|guard captain)\b/i;
const namedLootNamePattern = /\b(amulet|band|belt|blade|breastplate|bracer|cape|cloak|cord|crown|dagger|fang|gauntlets|gloves|greaves|hammer|heart|helm|jereed|leggings|mask|orb|robe|ring|scale|shield|sleeves|spear|staff|talisman|vambraces|wand)\b/i;

function normalizeName(value) {
  return String(value ?? "").replace(/^#+/, "").replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeTargetName(value) {
  return normalizeName(value).replace(/^(a|an|the)\s+/, "");
}

function isStaticUtilityCandidate(candidate) {
  const className = String(candidate.className ?? "");
  const displayName = String(candidate.displayName ?? "");
  const rawName = String(candidate.name ?? "").replace(/_/g, " ");
  return utilityClassPattern.test(className) || utilityNamePattern.test(displayName) || utilityNamePattern.test(rawName);
}

function isGenericSpawnName(candidate) {
  const rawName = String(candidate.name ?? "").toLowerCase();
  const name = normalizeTargetName(candidate.displayName || candidate.name);
  if (!name || rawName.startsWith("#")) return false;
  if (/\b(king|queen|lord|lady|disciple|prince|princess|emperor|empress|avatar|warlord)\b/i.test(name)) return false;
  return genericRacePattern.test(name) || genericRolePattern.test(name);
}

function isLikelyNamed(candidate) {
  const rawName = String(candidate.name ?? "").toLowerCase();
  if (rawName.startsWith("#")) return true;
  const name = String(candidate.displayName ?? "").trim();
  if (isGenericSpawnName(candidate)) return false;
  if (namedTitlePattern.test(name)) return true;
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

function candidateMatchesNamedOverride(candidate, names) {
  const candidateNames = [normalizeTargetName(candidate.displayName), normalizeTargetName(candidate.name)].filter(Boolean);
  const overrideNames = names.map(normalizeTargetName).filter(Boolean);
  return overrideNames.some((overrideName) => candidateNames.some((candidateName) => (
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

function itemKey(item) {
  return item.itemId ? `id:${item.itemId}` : `name:${normalizeTargetName(item.itemName)}`;
}

function buildLootDistribution(lootMobs) {
  const items = new Map();
  for (const mob of lootMobs ?? []) {
    const seen = new Set();
    for (const lootdrop of mob.lootdrops ?? []) {
      for (const item of lootdrop.items ?? []) {
        const key = itemKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        const current = items.get(key);
        if (current) {
          current.sourceNpcTypeIds.add(mob.npcTypeId);
          current.sourceMobCount = current.sourceNpcTypeIds.size;
        } else {
          items.set(key, {
            itemName: item.itemName ?? item.itemDetails?.name ?? "Unknown item",
            sourceMobCount: 1,
            sourceNpcTypeIds: new Set([mob.npcTypeId]),
          });
        }
      }
    }
  }
  return { itemCount: items.size, mobCount: lootMobs?.length ?? 0, items };
}

function itemHasStatsOrGear(item) {
  const raw = item.itemDetails;
  if (!raw) return false;
  const hasEquipmentSlot = typeof raw.slots === "number" && raw.slots > 0;
  const hasCoreStats = [raw.ac, raw.damage, raw.delay, raw.attack, raw.accuracy, raw.avoidance, raw.haste, raw.regen, raw.manaregen, raw.enduranceregen]
    .some((value) => typeof value === "number" && value !== 0);
  const hasStats = Object.values(raw.stats ?? {}).some((value) => typeof value === "number" && value !== 0)
    || Object.values(raw.resists ?? {}).some((value) => typeof value === "number" && value !== 0);
  return (hasEquipmentSlot && raw.itemtype !== 17) || hasCoreStats || hasStats;
}

function commonLootReason(item, distribution) {
  const name = item.itemName ?? item.itemDetails?.name ?? "";
  const sourceMobCount = distribution.items.get(itemKey(item))?.sourceMobCount ?? 1;
  const sourceRatio = distribution.mobCount ? sourceMobCount / distribution.mobCount : 0;
  if (/\b(coin|copper|silver|gold|platinum|page|rune|runes|words|parchment|scroll|spell:|research|spider silk|spider legs|meat|water|ration|bone chips?)\b/i.test(name)) return "generic vendor/research/spell/junk loot";
  if (/\b(agate|amber|bloodstone|carnelian|diamond|emerald|fire emerald|ivory|jade|jasper|malachite|opal|pearl|peridot|ruby|sapphire|star ruby|topaz|turquoise)\b/i.test(name)) return sourceMobCount > 1 ? "common gem loot" : null;
  if (/\b(cloth|raw-hide|raw hide|rusty|bronze|fine steel|small shield|kite shield|round shield|battle axe|dagger|short sword|long sword|mace|morning star|warhammer)\b/i.test(name)) return sourceMobCount > 2 || sourceRatio >= 0.04 ? "common weapon/armor loot" : null;
  return null;
}

function itemMeaningfulness(item, distribution) {
  const raw = item.itemDetails;
  const name = item.itemName ?? raw?.name ?? "";
  const isEpicItem = epicDropItemNameSet.has(normalizeTargetName(name));
  const sourceMobCount = distribution.items.get(itemKey(item))?.sourceMobCount ?? 1;
  const sourceRatio = distribution.mobCount ? sourceMobCount / distribution.mobCount : 0;
  const commonReason = commonLootReason(item, distribution);
  const lowDistribution = sourceMobCount <= 2 || sourceRatio <= 0.025;
  const limitedDistribution = sourceMobCount <= 5 || sourceRatio <= 0.06;
  const hasStatsOrGear = itemHasStatsOrGear(item);
  const hasNamedQualityFlag = raw?.nodrop === 0 || raw?.magic === 1 || Boolean(raw?.lore);
  const hasNamedLootName = namedLootNamePattern.test(name);
  const isUniqueNamedLoot = !commonReason && lowDistribution && (hasNamedLootName || hasStatsOrGear || hasNamedQualityFlag);
  const isMeaningful = isEpicItem || (!commonReason && (
    isUniqueNamedLoot
    || (hasStatsOrGear && lowDistribution)
    || (hasNamedQualityFlag && limitedDistribution)
    || (hasNamedLootName && lowDistribution)
  ));
  return { commonReason, isEpicItem, isMeaningful, isStatGearMeaningful: hasStatsOrGear && isMeaningful, isUniqueNamedLoot, sourceMobCount, uniquenessScore: Math.max(0, Math.min(1, 1 - sourceRatio)) };
}

function dropStats(mob, distribution) {
  const dropIds = new Set();
  const commonLootIds = new Set();
  const meaningfulIds = new Set();
  const statGearIds = new Set();
  const epicItemIds = new Set();
  const uniqueNamedLootIds = new Set();
  const commonExamples = [];
  let uniquenessTotal = 0;
  let uniquenessCount = 0;
  for (const lootdrop of mob?.lootdrops ?? []) {
    for (const item of lootdrop.items ?? []) {
      const key = String(item.itemId || item.itemName || "unknown");
      if (!key || key === "unknown") continue;
      const signal = itemMeaningfulness(item, distribution);
      dropIds.add(key);
      uniquenessTotal += signal.uniquenessScore;
      uniquenessCount += 1;
      if (signal.commonReason) {
        commonLootIds.add(key);
        if (commonExamples.length < 4) commonExamples.push({ itemName: item.itemName, reason: signal.commonReason, sourceMobCount: signal.sourceMobCount });
      }
      if (signal.isEpicItem) epicItemIds.add(key);
      if (signal.isUniqueNamedLoot) uniqueNamedLootIds.add(key);
      if (signal.isMeaningful) meaningfulIds.add(key);
      if (signal.isStatGearMeaningful) statGearIds.add(key);
    }
  }
  return {
    commonExamples,
    commonLootCount: commonLootIds.size,
    dropCount: dropIds.size,
    epicItemCount: epicItemIds.size,
    hasMeaningfulDrops: meaningfulIds.size > 0,
    lootUniquenessScore: uniquenessCount ? uniquenessTotal / uniquenessCount : 0,
    meaningfulDropCount: meaningfulIds.size,
    statGearDropCount: statGearIds.size,
    uniqueNamedLootCount: uniqueNamedLootIds.size,
  };
}

function classify(candidate, spawn, stats, overrideNames, spawnPointCount) {
  const isManualOverride = candidateMatchesNamedOverride(candidate, overrideNames);
  if (isManualOverride) return { isNamedRare: true, reason: "manual named override" };
  if (candidateIsEpicSource(candidate) || stats.epicItemCount > 0) return { isNamedRare: true, reason: "Epic item source" };
  if (candidateIsSiteRareSource(candidate)) return { isNamedRare: true, reason: "Site rare loot source" };
  if (isStaticUtilityCandidate(candidate)) return { isNamedRare: false, reason: "static utility NPC" };
  if (isCommonPopulationCandidate(candidate, stats, spawnPointCount, isManualOverride)) return { isNamedRare: false, reason: "Common population mob despite semi-unique loot" };
  const isLowChance = (candidate.chance ?? 100) <= 20;
  const likelyNamed = isLikelyNamed(candidate);
  if (hasSpecificNamedDisplay(candidate) && stats.uniqueNamedLootCount > 0) return { isNamedRare: true, reason: "unique named loot overrides spawn footprint" };
  if (likelyNamed && stats.hasMeaningfulDrops) return { isNamedRare: true, reason: "named candidate with meaningful loot" };
  if (!likelyNamed && isLowChance && stats.hasMeaningfulDrops) return { isNamedRare: true, reason: "low chance candidate with meaningful loot" };
  if (isLowChance) return { isNamedRare: false, reason: "low chance only; no site/epic/meaningful loot source" };
  return { isNamedRare: false, reason: stats.commonLootCount ? "common zone loot only" : "common spawn" };
}

const files = fs.readdirSync(dataDir).filter((name) => /^eqemu-.+-spawns-test\.json$/.test(name)).sort();

function buildSpawnFootprints(spawnRows) {
  const footprints = new Map();
  const seen = new Set();
  for (const spawn of spawnRows ?? []) {
    for (const candidate of spawn.candidates ?? []) {
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

const report = {
  generatedAt: new Date().toISOString(),
  rules: {
    note: "Loot alone no longer classifies a mob as Named/Rare. Loot only contributes when it is low-distribution, special, no-drop/lore/magic, or named-quality; common gems, spells, words/runes, and broad shared gear are treated as common zone loot.",
  },
  totals: {
    zonesScanned: 0,
    candidateRowsScanned: 0,
    downgradedFromLootOnlyRare: 0,
    commonLootExclusions: 0,
    namedRareRows: 0,
    epicSourcePromotions: 0,
    siteRarePromotions: 0,
    lowChanceOnlyDowngrades: 0,
    uniqueLootPromotions: 0,
    populationFootprintDowngrades: 0,
  },
  examples: {
    anivalTheBlade: [],
    diakuEliteSentry: [],
    overseerDalGuur: [],
    iksarBetrayer: [],
    wraithOfDizokHero: [],
    sarnakOverseer: [],
    epicSourcePromotions: [],
    siteRarePromotions: [],
    uniqueLootPromotions: [],
    populationFootprintDowngrades: [],
    lowChanceOnlyDowngrades: [],
    preservedNamedRare: [],
    downgradedFromLootOnlyRare: [],
    commonLootExclusions: [],
  },
};

for (const file of files) {
  const zoneShortName = file.replace(/^eqemu-/, "").replace(/-spawns-test\.json$/, "");
  const spawnData = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  const lootPath = path.join(dataDir, `eqemu-${zoneShortName}-loot-test.json`);
  const lootData = fs.existsSync(lootPath) ? JSON.parse(fs.readFileSync(lootPath, "utf8")) : { mobs: [] };
  const lootByNpcId = new Map((lootData.mobs ?? []).map((mob) => [mob.npcTypeId, mob]));
  const distribution = buildLootDistribution(lootData.mobs ?? []);
  const spawnFootprints = buildSpawnFootprints(spawnData.primarySpawnRows ?? []);
  const overrideNames = overrides[zoneShortName]?.namedOverrides ?? [];
  report.totals.zonesScanned += 1;

  for (const spawn of spawnData.primarySpawnRows ?? []) {
    for (const candidate of spawn.candidates ?? []) {
      report.totals.candidateRowsScanned += 1;
      const stats = dropStats(lootByNpcId.get(candidate.npcTypeId), distribution);
      const spawnPointCount = spawnFootprints.get(candidate.npcTypeId)?.spawnPointCount ?? null;
      const result = classify(candidate, spawn, stats, overrideNames, spawnPointCount);
      if (result.isNamedRare) report.totals.namedRareRows += 1;
      if (result.reason === "Epic item source") report.totals.epicSourcePromotions += 1;
      if (result.reason === "Site rare loot source") report.totals.siteRarePromotions += 1;
      if (result.reason === "unique named loot overrides spawn footprint") report.totals.uniqueLootPromotions += 1;
      if (result.reason === "Common population mob despite semi-unique loot") report.totals.populationFootprintDowngrades += 1;
      if (result.reason === "low chance only; no site/epic/meaningful loot source") report.totals.lowChanceOnlyDowngrades += 1;
      if (stats.commonLootCount) report.totals.commonLootExclusions += 1;
      const oldLootOnlyRare = itemHasStatsOrGear({ itemDetails: { slots: 1, itemtype: 0, stats: {}, resists: {} } }) && stats.dropCount > 0 && !result.isNamedRare;
      const entry = {
        zoneShortName,
        displayName: candidate.displayName,
        chance: candidate.chance,
        candidateCount: spawn.candidates?.length ?? 0,
        spawnPointCount,
        footprintPenalty: spawnFootprintPenalty(spawnPointCount),
        reason: result.reason,
        dropCount: stats.dropCount,
        meaningfulDropCount: stats.meaningfulDropCount,
        uniqueNamedLootCount: stats.uniqueNamedLootCount,
        commonLootCount: stats.commonLootCount,
        lootUniquenessScore: Number(stats.lootUniquenessScore.toFixed(3)),
        commonLootExamples: stats.commonExamples,
      };
      if (/sarnak overseer/i.test(candidate.displayName)) report.examples.sarnakOverseer.push(entry);
      if (/anival the blade/i.test(candidate.displayName)) report.examples.anivalTheBlade.push({ ...entry, isNamedRare: result.isNamedRare });
      if (/diaku elite sentry/i.test(candidate.displayName)) report.examples.diakuEliteSentry.push({ ...entry, isNamedRare: result.isNamedRare });
      if (/overseer dal[`'’]?guur/i.test(candidate.displayName)) report.examples.overseerDalGuur.push({ ...entry, isNamedRare: result.isNamedRare });
      if (/iksar betrayer/i.test(candidate.displayName)) report.examples.iksarBetrayer.push({ ...entry, isNamedRare: result.isNamedRare });
      if (/wraith of a di[`'’]?zok hero/i.test(candidate.displayName)) report.examples.wraithOfDizokHero.push({ ...entry, isNamedRare: result.isNamedRare });
      if (result.reason === "Epic item source" && report.examples.epicSourcePromotions.length < 80) report.examples.epicSourcePromotions.push(entry);
      if (result.reason === "Site rare loot source" && report.examples.siteRarePromotions.length < 80) report.examples.siteRarePromotions.push(entry);
      if (result.reason === "unique named loot overrides spawn footprint" && report.examples.uniqueLootPromotions.length < 80) report.examples.uniqueLootPromotions.push(entry);
      if (result.reason === "Common population mob despite semi-unique loot" && report.examples.populationFootprintDowngrades.length < 80) report.examples.populationFootprintDowngrades.push(entry);
      if (result.reason === "low chance only; no site/epic/meaningful loot source" && report.examples.lowChanceOnlyDowngrades.length < 80) report.examples.lowChanceOnlyDowngrades.push(entry);
      if (oldLootOnlyRare && report.examples.downgradedFromLootOnlyRare.length < 80) {
        report.totals.downgradedFromLootOnlyRare += 1;
        report.examples.downgradedFromLootOnlyRare.push(entry);
      } else if (oldLootOnlyRare) {
        report.totals.downgradedFromLootOnlyRare += 1;
      }
      if (stats.commonLootCount && report.examples.commonLootExclusions.length < 80) report.examples.commonLootExclusions.push(entry);
      if (/^(Solusek Kobold King|Enraged Disciple|Silverfang)$/i.test(candidate.displayName) && report.examples.preservedNamedRare.length < 20) {
        report.examples.preservedNamedRare.push({ ...entry, isNamedRare: result.isNamedRare });
      }
    }
  }
}

fs.writeFileSync(path.join(dataDir, "real-spawn-named-classification-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 2));
