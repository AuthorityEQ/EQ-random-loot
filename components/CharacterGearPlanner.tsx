"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import "@/components/item-drawer.css";
import { EqItemInspect } from "@/components/EqItemInspect";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { useServer } from "@/components/ServerProvider";
import { questRewardMappings } from "@/data/questRewardMappings";
import classicData from "@/data/classic-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkData from "@/data/kunark-group-named.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousData from "@/data/velious-group-named.json";
import veliousRaidData from "@/data/velious-raid.json";
import {
  getFocusEffectCategory,
  getFocusEffectFamilyEntries,
  getFocusEffects,
  itemHasFocusEffect,
  itemMatchesFocusFamily,
  type FocusEffectCategory,
  type FocusEffectFamily,
} from "@/lib/item-effects";
import { isShieldItem, isTwoHandedItem } from "@/lib/item-weapon";
import { CLASS_STAT_WEIGHTS, explainItemScore, formatScoredStatLabel, type ClassCode } from "@/lib/itemScoring";
import { classCanUseShields, itemMatchesUseFilters } from "@/lib/item-use-filters";
import { parseRawSlot, type SlotKey } from "@/lib/slot-filter";
import type { ItemDetails, ItemDetailsMap, LootDataset, Mob } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";
import { fetchUserSettings, saveUserSettings } from "@/lib/user-settings-client";

type GearSlot = {
  id: string;
  slotKey: SlotKey;
  label: string;
  shortLabel: string;
  area: string;
  placeholder: string;
};

type GearCandidate = {
  itemName: string;
  details: ItemDetails;
  expansions: string[];
  zones: string[];
  sources: GearSourceInfo[];
};

type GearSourceInfo = {
  expansion: string;
  zones: string[];
  sourceName: string;
  sourceType: "group" | "raid" | "quest" | "item";
  npcNames?: string[];
  sourceMobs?: Pick<Mob, "name" | "zone" | "level">[];
  bucket?: number;
  levelRange?: string;
  bossLevel?: number;
  tierName?: string;
  sourceItemNames?: string[];
  mobCount?: number;
  lootCount?: number;
};

type BisCandidate = {
  itemName: string | null;
  details: ItemDetails | null;
  score: number;
};

type RecommendationSort = "score" | "ratio";
type WeaponFilter = "Any" | "Piercing" | "Slashing" | "Blunt" | "2H Slashing" | "2H Blunt" | "Hand to Hand" | "Bow";

type SavedBuild = {
  version: number;
  characterName: string;
  class: string;
  race?: string;
  equippedGear: Record<string, string>;
};

type GearBuild = {
  id: string;
  name: string;
  class: string;
  race?: string;
  server?: string;
  equippedItems: Record<string, string | null>;
  plannerItems?: GearPlannerManualItem[];
  createdAt?: string;
  updatedAt?: string;
};

type GearPlannerManualItem = {
  id: string;
  itemName: string;
  slotId?: string | null;
  category?: string;
  tags?: string[];
  notes?: string;
  utilityBagSlot?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type GearRoster = {
  version: 1;
  rosterName?: string;
  characters: GearBuild[];
  activeCharacterId?: string;
  updatedAt?: string;
};

type GearShoppingNeed = {
  characterId: string;
  characterName: string;
  class: string;
  slotId: string;
  slotLabel: string;
  manualItemId?: string;
  category?: string;
  tags?: string[];
  notes?: string;
  utilityBagSlot?: number | null;
};

type GearShoppingItem = {
  itemName: string;
  details: ItemDetails;
  needs: GearShoppingNeed[];
  expansions: string[];
  zones: string[];
  sources: GearSourceInfo[];
  itemType: string;
};

type GearShoppingDisplayItem = GearShoppingItem & {
  completedNeeds: GearShoppingNeed[];
  gearScore: number;
  obtainedCount: number;
  remainingNeeds: GearShoppingNeed[];
  totalCount: number;
};

const gearSlots: GearSlot[] = [
  { id: "ear1", slotKey: "ear", label: "Ear I", shortLabel: "E1", area: "ear1", placeholder: "ring" },
  { id: "head", slotKey: "head", label: "Head", shortLabel: "Hd", area: "head", placeholder: "helm" },
  { id: "face", slotKey: "face", label: "Face", shortLabel: "Fa", area: "face", placeholder: "mask" },
  { id: "ear2", slotKey: "ear", label: "Ear II", shortLabel: "E2", area: "ear2", placeholder: "ring" },
  { id: "chest", slotKey: "chest", label: "Chest", shortLabel: "Ch", area: "chest", placeholder: "chest" },
  { id: "neck", slotKey: "neck", label: "Neck", shortLabel: "Nk", area: "neck", placeholder: "neck" },
  { id: "arms", slotKey: "arms", label: "Arms", shortLabel: "Ar", area: "arms", placeholder: "arms" },
  { id: "back", slotKey: "back", label: "Back", shortLabel: "Bk", area: "back", placeholder: "back" },
  { id: "belt", slotKey: "waist", label: "Belt", shortLabel: "Be", area: "belt", placeholder: "belt" },
  { id: "shoulders", slotKey: "shoulders", label: "Shoulders", shortLabel: "Sh", area: "shoulders", placeholder: "shoulders" },
  { id: "wrist1", slotKey: "wrist", label: "Wrist I", shortLabel: "W1", area: "wrist1", placeholder: "wrist" },
  { id: "wrist2", slotKey: "wrist", label: "Wrist II", shortLabel: "W2", area: "wrist2", placeholder: "wrist" },
  { id: "hands", slotKey: "hands", label: "Hands", shortLabel: "Ha", area: "hands", placeholder: "hands" },
  { id: "feet", slotKey: "feet", label: "Feet", shortLabel: "Ft", area: "feet", placeholder: "feet" },
  { id: "finger1", slotKey: "finger", label: "Finger I", shortLabel: "F1", area: "finger1", placeholder: "ring" },
  { id: "finger2", slotKey: "finger", label: "Finger II", shortLabel: "F2", area: "finger2", placeholder: "ring" },
  { id: "primary", slotKey: "primary", label: "Primary", shortLabel: "Pri", area: "primary", placeholder: "primary" },
  { id: "secondary", slotKey: "secondary", label: "Secondary", shortLabel: "Sec", area: "secondary", placeholder: "secondary" },
  { id: "ranged", slotKey: "range", label: "Ranged", shortLabel: "Rng", area: "ranged", placeholder: "ranged" },
  { id: "ammo", slotKey: "ammo", label: "Ammo", shortLabel: "Am", area: "ammo", placeholder: "ammo" },
];

const groupDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const itemDetails = itemDetailsData as ItemDetailsMap;
const classCodes = (Object.keys(CLASS_STAT_WEIGHTS) as ClassCode[]).sort((a, b) => a.localeCompare(b));
const raceCodes = ["BAR", "DEF", "DWF", "ERU", "GNM", "HAF", "HEF", "HUM", "IKS", "OGR", "TRL", "VAH", "WEF"] as const;
type RaceCode = (typeof raceCodes)[number];
const gearSlotSelectOptions = [...gearSlots].sort((a, b) => a.label.localeCompare(b.label));
const gearSlotIds = new Set(gearSlots.map((slot) => slot.id));
const legacyGearSlotIdMap: Record<string, string> = {
  ear: "ear1",
  wrist: "wrist1",
  "finger-left": "finger1",
  "finger-right": "finger2",
  waist: "belt",
  range: "ranged",
};
const utilityBagBaseSize = 20;
const utilityBagExpansionSize = 10;
const recommendationLimit = 30;
const weaponFilterOrder: WeaponFilter[] = ["Any", "Piercing", "Slashing", "Blunt", "2H Slashing", "2H Blunt", "Hand to Hand", "Bow"];
const bisCandidateLimit = 10;
const rosterAutosaveKey = "loot-goblin-my-characters-roster-v1";
const gearPlannerStateStorageKey = "loot-goblin-gear-planner-state-v1";
const gearShoppingObtainedStorageKey = "loot-goblin-gear-shopping-obtained-v1";
const gearShoppingHideObtainedStorageKey = "loot-goblin-gear-shopping-hide-obtained-v1";
const plannerNoteMaxLength = 200;
const cloudRosterPreferenceKey = "myCharacters";
const anySpellFocus = "Any spell focus";
const anyBardMod = "Any bard mod";
const anyPetFocus = "Any pet focus";
const focusCategoryLabels: Record<FocusEffectCategory, string> = {
  spell: "Spell Focus",
  bard: "Bard Mod",
  pet: "Pet Focus",
};
const classicPlanarGearSource = "Classic Planar Gear";
const expansionOrder = ["Classic", "Kunark", "Velious", "Luclin", "Planes of Power", "Legacy of Ykesha"] as const;
const raceTokenAliases: Record<string, RaceCode | string> = {
  ELF: "WEF",
  HFL: "HAF",
};

function getExpansionSortValue(expansion: string) {
  const index = expansionOrder.indexOf(expansion as (typeof expansionOrder)[number]);
  return index === -1 ? expansionOrder.length : index;
}

function sortExpansions(values: Iterable<string>) {
  return Array.from(values).sort((a, b) => getExpansionSortValue(a) - getExpansionSortValue(b) || a.localeCompare(b));
}

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

function numericItemValue(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getWeaponRatio(details: ItemDetails) {
  const damage = numericItemValue(details.damage);
  const delay = numericItemValue(details.delay);
  if (damage === null || delay === null || delay <= 0) return null;
  return damage / delay;
}

function getWeaponFilterValue(details: ItemDetails): WeaponFilter | null {
  const skill = String(details.skill ?? "").trim();
  const itemType = String(details.itemType ?? details.item_type ?? "").trim();
  const combined = `${skill} ${itemType}`.replace(/\s+/g, " ");

  if (/\barchery\b|\bbow\b/i.test(combined) || details.weaponType === "ranged") return "Bow";
  if (/\bhand\s*to\s*hand\b/i.test(combined)) return "Hand to Hand";
  if (/\b2\s*h(?:and)?\s*slashing\b|\b2HS\b/i.test(combined)) return "2H Slashing";
  if (/\b2\s*h(?:and)?\s*blunt\b|\b2HB\b/i.test(combined)) return "2H Blunt";
  if (/\bpiercing\b|\b1HP\b|\b2HP\b/i.test(combined)) return "Piercing";
  if (/\bslashing\b|\b1HS\b/i.test(combined)) return "Slashing";
  if (/\bblunt\b|\b1HB\b/i.test(combined)) return "Blunt";
  return null;
}

function itemMatchesWeaponFilter(details: ItemDetails, weaponFilter: WeaponFilter) {
  return weaponFilter === "Any" || getWeaponFilterValue(details) === weaponFilter;
}

function itemScoreLookupKeys(itemName: string, details: ItemDetails) {
  return [details.itemId ? String(details.itemId) : null, itemName].filter((key): key is string => Boolean(key));
}

function getGlobalItemScore(
  itemName: string,
  details: ItemDetails,
  globalScoreByItemId: Map<string, number>,
  fallbackScore: number,
) {
  for (const key of itemScoreLookupKeys(itemName, details)) {
    const score = globalScoreByItemId.get(key);
    if (score !== undefined) return score;
  }
  return fallbackScore;
}

function gearShoppingNeedKey(itemName: string, need: GearShoppingNeed) {
  return `${itemName}::${need.characterId}::${need.manualItemId ?? need.slotId}`;
}

function plannerItemNeedSlotId(item: GearPlannerManualItem) {
  return item.utilityBagSlot !== null && item.utilityBagSlot !== undefined
    ? `utility-${item.id}`
    : `manual-${item.slotId ?? item.category ?? item.id}`;
}

function getUtilityBagCapacity(items: GearPlannerManualItem[]) {
  const highestSlot = items.reduce((max, item) => {
    const slot = item.utilityBagSlot;
    return typeof slot === "number" && Number.isInteger(slot) && slot >= 0 ? Math.max(max, slot) : max;
  }, -1);
  const usedSlots = highestSlot + 1;
  if (usedSlots <= utilityBagBaseSize) return utilityBagBaseSize;
  return Math.ceil(usedSlots / utilityBagExpansionSize) * utilityBagExpansionSize;
}

function isClassicPlanarQuestArmor(details: ItemDetails) {
  return details.expansion === "Classic"
    && details.acquisitionType === "questTurnIn"
    && String(details.relatedQuestId ?? "") === "2459";
}

function buildGearCandidates(): GearCandidate[] {
  const sourceMap = new Map<string, { expansions: Set<string>; zones: Set<string>; sources: GearSourceInfo[] }>();

  function touchItem(itemName: string, expansion: string, zones: string[], sourceInfo: GearSourceInfo) {
    const entry = sourceMap.get(itemName) ?? { expansions: new Set<string>(), zones: new Set<string>(), sources: [] };
    entry.expansions.add(expansion);
    zones.forEach((zone) => entry.zones.add(zone));
    entry.sources.push(sourceInfo);
    sourceMap.set(itemName, entry);
  }

  for (const dataset of groupDatasets) {
    for (const bucket of dataset.buckets) {
      const sourceInfo: GearSourceInfo = {
        expansion: bucket.expansion,
        zones: bucket.zones,
        sourceName: `Bucket ${bucket.bucket} Group Mobs`,
        sourceType: "group",
        npcNames: bucket.mobs.map((mob) => mob.name),
        sourceMobs: bucket.mobs.map((mob) => ({ name: mob.name, zone: mob.zone, level: mob.level })),
        bucket: bucket.bucket,
        levelRange: bucket.level_range,
        sourceItemNames: bucket.loot_pool,
        mobCount: bucket.mob_count ?? bucket.mobs.length,
        lootCount: bucket.loot_pool.length,
      };
      for (const itemName of bucket.loot_pool) {
        touchItem(itemName, bucket.expansion, bucket.zones, sourceInfo);
      }
    }
  }

  for (const dataset of raidDatasets) {
    for (const tier of dataset.tiers) {
      const tierBosses = tier.bosses.map((boss) => ({ name: boss.name, zone: boss.zone, level: boss.level }));
      const tierLootPool = Array.from(new Set(tier.bosses.flatMap((boss) => boss.loot_pool ?? []))).sort((a, b) => a.localeCompare(b));
      for (const boss of tier.bosses) {
        for (const itemName of boss.loot_pool ?? []) {
          touchItem(itemName, dataset.expansion, [boss.zone], {
            expansion: dataset.expansion,
            zones: [boss.zone],
            sourceName: boss.name,
            sourceType: "raid",
            npcNames: tierBosses.map((tierBoss) => tierBoss.name),
            sourceMobs: tierBosses,
            bossLevel: boss.level,
            tierName: tier.name,
            sourceItemNames: tierLootPool,
            mobCount: tierBosses.length,
            lootCount: tierLootPool.length,
          });
        }
      }
    }
  }

  for (const mapping of questRewardMappings) {
    const questSourceLabel = mapping.sourceNpcName ?? mapping.questName ?? (mapping.questId ? `Quest ${mapping.questId}` : "Quest");
    touchItem(
      mapping.rewardItemName,
      itemDetails[mapping.rewardItemName]?.expansion ?? "Velious",
      [`${questSourceLabel} quest`],
      {
        expansion: itemDetails[mapping.rewardItemName]?.expansion ?? "Velious",
        zones: [`${questSourceLabel} quest`],
        sourceName: questSourceLabel,
        sourceType: "quest",
        npcNames: mapping.sourceNpcName ? [mapping.sourceNpcName] : undefined,
        sourceItemNames: [mapping.rewardItemName],
        lootCount: 1,
      },
    );
  }

  for (const [itemName, details] of Object.entries(itemDetails)) {
    if (isClassicPlanarQuestArmor(details)) {
      if (parseRawSlot(details.slot).size > 0) {
        touchItem(itemName, "Classic", [classicPlanarGearSource], {
          expansion: "Classic",
          zones: [classicPlanarGearSource],
          sourceName: classicPlanarGearSource,
          sourceType: "quest",
          sourceItemNames: [itemName],
          lootCount: 1,
        });
      }
      continue;
    }

    if (details.acquisitionType !== "quest" && details.sourceCategory !== "Targeted Allakhazam item import") continue;
    if (parseRawSlot(details.slot).size === 0) continue;

    const questSourceLabel = details.sourceNpcName
      ?? details.questName
      ?? (details.questId ? `Quest ${details.questId}` : details.sourceCategory ?? "Item database");
    const sourceLabel = details.acquisitionType === "quest"
      ? (questSourceLabel.toLowerCase().includes("quest") ? questSourceLabel : `${questSourceLabel} quest`)
      : questSourceLabel;

    touchItem(itemName, details.expansion ?? "Velious", [sourceLabel], {
      expansion: details.expansion ?? "Velious",
      zones: [sourceLabel],
      sourceName: questSourceLabel,
      sourceType: details.acquisitionType === "quest" ? "quest" : "item",
      npcNames: details.sourceNpcName ? [details.sourceNpcName] : undefined,
      sourceItemNames: [itemName],
      lootCount: 1,
    });
  }

  return Array.from(sourceMap.entries())
    .map(([itemName, source]) => {
      const details = itemDetails[itemName];
      if (!details) return null;
      return {
        itemName,
        details,
        expansions: sortExpansions(source.expansions),
        zones: Array.from(source.zones).sort(),
        sources: source.sources,
      };
    })
    .filter((candidate): candidate is GearCandidate => Boolean(candidate));
}

const gearCandidates = buildGearCandidates();
const gearCandidateByName = new Map(gearCandidates.map((candidate) => [candidate.itemName, candidate]));
const fullGearSourceByItemName = new Map(gearCandidates.map((candidate) => [candidate.itemName, candidate.sources]));
const plannerExpansionOptions = sortExpansions(new Set(gearCandidates.flatMap((candidate) => candidate.expansions)));

function getGearSlotLabel(slotId: string) {
  return gearSlots.find((slot) => slot.id === slotId)?.label ?? slotId;
}

function getItemTypeLabel(details: ItemDetails) {
  return details.itemType ?? details.item_type ?? details.weaponType ?? (details.acquisitionType === "quest" ? "Quest reward" : "Gear");
}

function normalizeProgressionOverrideName(value: string) {
  return value.trim().toLowerCase();
}

// Manual EQ progression classification overrides. These are intentionally
// conservative and only affect the optional "Hide endgame / special" planner filter.
const HIGH_END_QUEST_ITEM_NAMES = new Set([
  "belt of dwarf slaying",
  "bladesoul's spiritual armguards",
  "bladesoul's spiritual diadem",
  "black flower of functionality",
  "blue flower of functionality",
  "green flower of functionality",
  "red flower of functionality",
  "ring of dain frostreaver iv",
  "white flower of functionality",
].map(normalizeProgressionOverrideName));

const RAID_OR_HIGH_END_ITEM_NAMES = new Set([
  "ancient prismatic axe",
  "ancient prismatic battlehammer",
  "ancient prismatic bow",
  "ancient prismatic brawl stick",
  "ancient prismatic claymore",
  "ancient prismatic fist wraps",
  "ancient prismatic lance",
  "ancient prismatic mace",
  "ancient prismatic spear",
  "ancient prismatic staff",
  "ancient prismatic stiletto",
  "ancient prismatic warsword",
  "buckler of insight",
  "white dragonscale boots",
  "white dragonscale helm",
].map(normalizeProgressionOverrideName));

const HIGH_END_SOURCE_KEYWORDS = [
  "dozekar",
];

function textIncludes(value: string | undefined | null, needle: string) {
  return Boolean(value?.toLowerCase().includes(needle));
}

function metadataIncludes(details: ItemDetails, needle: string) {
  return [
    details.source,
    details.sourceCategory,
    details.questName,
    details.sourceNpcName,
    details.acquisitionType,
    details.armorSet,
    ...(details.tags ?? []),
    ...(details.categories ?? []),
    ...(details.searchKeywords ?? []),
    ...(details.match_notes ?? []),
  ].some((value) => textIncludes(String(value ?? ""), needle));
}

function sourceIncludes(source: GearSourceInfo, needle: string) {
  return [
    source.sourceName,
    source.tierName,
    ...(source.zones ?? []),
    ...(source.npcNames ?? []),
    ...(source.sourceItemNames ?? []),
    ...(source.sourceMobs ?? []).flatMap((mob) => [mob.name, mob.zone]),
  ].some((value) => textIncludes(String(value ?? ""), needle));
}

function hasHighEndProgressionOverride(itemName: string, details: ItemDetails, sources: GearSourceInfo[]) {
  const normalizedName = normalizeProgressionOverrideName(itemName);
  return HIGH_END_QUEST_ITEM_NAMES.has(normalizedName)
    || RAID_OR_HIGH_END_ITEM_NAMES.has(normalizedName)
    || normalizedName.includes("flower of functionality")
    || HIGH_END_SOURCE_KEYWORDS.some((keyword) => metadataIncludes(details, keyword) || sources.some((source) => sourceIncludes(source, keyword)));
}

function isRaidItem(details: ItemDetails, sources: GearSourceInfo[]) {
  return sources.some((source) => source.sourceType === "raid")
    || Boolean(details.raidBucket)
    || metadataIncludes(details, "raid");
}

function isEpicItem(details: ItemDetails, sources: GearSourceInfo[]) {
  return metadataIncludes(details, "epic")
    || sources.some((source) => metadataIncludes(details, "epic") || textIncludes(source.sourceName, "epic") || source.zones.some((zone) => textIncludes(zone, "epic")));
}

function isVeliousQuestArmor(details: ItemDetails, sources: GearSourceInfo[]) {
  const velious = details.expansion === "Velious" || sources.some((source) => source.expansion === "Velious");
  if (!velious) return false;
  return Boolean(details.armorSet)
    || metadataIncludes(details, "thurgadin")
    || metadataIncludes(details, "skyshrine")
    || metadataIncludes(details, "kael")
    || sources.some((source) => source.sourceType === "quest" && (
      textIncludes(source.sourceName, "thurgadin")
      || textIncludes(source.sourceName, "skyshrine")
      || textIncludes(source.sourceName, "kael")
      || source.zones.some((zone) => textIncludes(zone, "thurgadin") || textIncludes(zone, "skyshrine") || textIncludes(zone, "kael"))
    ));
}

function isEndgameOrSpecialItem(itemName: string, details: ItemDetails, sources: GearSourceInfo[]) {
  return hasHighEndProgressionOverride(itemName, details, sources)
    || isRaidItem(details, sources)
    || isEpicItem(details, sources)
    || isVeliousQuestArmor(details, sources)
    || metadataIncludes(details, "endgame")
    || metadataIncludes(details, "special acquisition");
}

function getShoppingItemScore(item: GearShoppingItem) {
  return Math.max(
    0,
    ...item.needs.map((need) => {
      const classCode = String(need.class ?? "").toUpperCase();
      if (!(classCode in CLASS_STAT_WEIGHTS)) return 0;
      return explainItemScore(item.details, classCode).score;
    }),
  );
}

function getCandidateForItem(itemName: string) {
  const candidate = gearCandidateByName.get(itemName);
  if (candidate) return candidate;
  const details = itemDetails[itemName];
  if (!details) return null;
  const fallbackSourceName = details.sourceNpcName
    ?? details.questName
    ?? details.source
    ?? details.sources?.[0]?.name
    ?? "Item source";
  const fallbackZone = details.sourceNpcName
    ? `${details.sourceNpcName} quest`
    : details.source ?? details.questName ?? details.sources?.[0]?.url ?? "";

  return {
    itemName,
    details,
    expansions: details.expansion ? [details.expansion] : [],
    zones: fallbackZone ? [fallbackZone] : [],
    sources: [{
      expansion: details.expansion,
      zones: fallbackZone ? [fallbackZone] : [],
      sourceName: fallbackSourceName,
      sourceType: details.sourceNpcName || details.questName ? "quest" as const : "item" as const,
      npcNames: details.sourceNpcName ? [details.sourceNpcName] : undefined,
      sourceItemNames: [itemName],
      lootCount: 1,
    }],
  };
}

function sourceMatchesQuery(source: GearSourceInfo, query: string) {
  if (!query) return true;
  return source.sourceName.toLowerCase().includes(query)
    || source.zones.some((zone) => zone.toLowerCase().includes(query))
    || (source.npcNames ?? []).some((npcName) => npcName.toLowerCase().includes(query))
    || (source.sourceItemNames ?? []).some((itemName) => itemName.toLowerCase().includes(query));
}

function formatSourceSummary(source: GearSourceInfo) {
  if (source.sourceType === "raid") {
    const zoneLabel = source.zones.slice(0, 2).join(", ");
    return [source.sourceName, zoneLabel].filter(Boolean).join(" / ");
  }
  const zoneLabel = source.zones.slice(0, 2).join(", ");
  const npcLabel = source.npcNames?.slice(0, 2).join(", ");
  const bucketLabel = source.bucket ? `Bucket ${source.bucket}${source.levelRange ? `, levels ${source.levelRange}` : ""}` : null;
  return [source.sourceName, zoneLabel, npcLabel, bucketLabel].filter(Boolean).join(" / ");
}

function sourceIdentity(source: GearSourceInfo) {
  const sourceName = source.sourceType === "raid" && source.tierName ? source.tierName : source.sourceName;
  const sourceLocation = source.sourceType === "raid" && source.sourceMobs?.length
    ? source.sourceMobs.map((mob) => mob.name).sort((a, b) => a.localeCompare(b)).join("|")
    : source.zones.join("|");
  return [
    source.sourceType,
    source.expansion,
    source.bucket ?? "",
    sourceName,
    sourceLocation,
  ].join("::");
}

function normalizeSourceKeyPart(value: string | number | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/https?:\/\/\S+/g, (url) => url.replace(/\/+$/, ""))
    .replace(/[’']/g, "")
    .replace(/[\/\\|]+/g, " ")
    .replace(/[.,:;()[\]{}"!?]+/g, " ")
    .replace(/\bquests\b/g, "quest")
    .replace(/\bquest\s+quest\b/g, "quest")
    .replace(/\s+quest$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeAdjacentDuplicateWords(value: string) {
  const words = value.split(" ").filter(Boolean);
  return words.filter((word, index) => index === 0 || word !== words[index - 1]).join(" ");
}

function normalizeSourcePhrase(value: string | number | null | undefined) {
  return removeAdjacentDuplicateWords(normalizeSourceKeyPart(value));
}

function normalizeSourceKeyList(values: Array<string | number | null | undefined>) {
  return values
    .map(normalizeSourcePhrase)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function removeRepeatedSourceTitle(sourceTitle: string, value: string | number | null | undefined) {
  const normalizedTitle = normalizeSourcePhrase(sourceTitle);
  let normalizedValue = normalizeSourcePhrase(value);
  if (!normalizedValue || !normalizedTitle) return normalizedValue;
  if (normalizedValue === normalizedTitle) return "";
  if (normalizedValue.startsWith(`${normalizedTitle} `)) {
    normalizedValue = normalizedValue.slice(normalizedTitle.length).trim();
  }
  if (normalizedValue.endsWith(` ${normalizedTitle}`)) {
    normalizedValue = normalizedValue.slice(0, -normalizedTitle.length).trim();
  }
  return normalizedValue === normalizedTitle ? "" : normalizedValue;
}

function sourceCompletenessScore(source: GearSourceInfo) {
  return [
    source.sourceName,
    source.tierName,
    source.levelRange,
    source.bossLevel,
    source.bucket,
    source.mobCount,
    source.lootCount,
    ...(source.zones ?? []),
    ...(source.npcNames ?? []),
    ...(source.sourceItemNames ?? []),
    ...(source.sourceMobs ?? []).flatMap((mob) => [mob.name, mob.zone, mob.level]),
  ].filter((value) => value !== undefined && value !== null && String(value).trim()).length;
}

function normalizeSourceKey(source: GearSourceInfo) {
  const sourceName = source.sourceType === "raid" && source.tierName ? source.tierName : source.sourceName;
  const rawSourceLocation = source.sourceType === "raid" && source.sourceMobs?.length
    ? source.sourceMobs.flatMap((mob) => [mob.name, mob.zone])
    : [...(source.zones ?? []), ...(source.npcNames ?? [])];
  const sourceLocation = rawSourceLocation
    .map((value) => source.sourceType === "quest" ? removeRepeatedSourceTitle(sourceName, value) : normalizeSourcePhrase(value))
    .filter(Boolean);

  return [
    normalizeSourcePhrase(source.expansion),
    String(source.sourceType).toLowerCase(),
    normalizeSourcePhrase(sourceName),
    normalizeSourceKeyList(sourceLocation),
  ].filter(Boolean).join("::");
}

// Raw imports can repeat the same quest/source in slightly different shapes.
// Deduplicate only for planner display, keeping the richer version of a source card.
function dedupeItemSources(sources: GearSourceInfo[]) {
  const deduped = new Map<string, GearSourceInfo>();
  for (const source of sources) {
    const key = normalizeSourceKey(source);
    const existing = deduped.get(key);
    if (!existing || sourceCompletenessScore(source) > sourceCompletenessScore(existing)) {
      deduped.set(key, source);
    }
  }
  return Array.from(deduped.values());
}

function mergeGearSources(primarySources: GearSourceInfo[] | undefined, fallbackSources: GearSourceInfo[] | undefined) {
  const merged = new Map<string, GearSourceInfo>();
  for (const source of [...(primarySources ?? []), ...(fallbackSources ?? [])]) {
    merged.set(sourceIdentity(source), source);
  }
  return dedupeItemSources(Array.from(merged.values()));
}

function getFullGearSources(itemName: string, fallbackSources: GearSourceInfo[] = []) {
  return mergeGearSources(fullGearSourceByItemName.get(itemName), fallbackSources);
}

function sourceTypeLabel(source: GearSourceInfo) {
  if (source.sourceType === "raid") return "Raid";
  if (source.sourceType === "group") return "Group";
  if (source.sourceType === "quest") return "Quest";
  return "Item";
}

function formatSourceDetailList(values: string[] | undefined, fallback: string) {
  return values?.length ? values.join(", ") : fallback;
}

function formatMobLevel(level: Mob["level"] | undefined) {
  if (level === undefined || level === null) return null;
  return String(level);
}

function groupSourceMobsByZone(source: GearSourceInfo) {
  const zones = new Map<string, Pick<Mob, "name" | "zone" | "level">[]>();
  for (const mob of source.sourceMobs ?? []) {
    const zoneName = mob.zone || "Unknown";
    const mobs = zones.get(zoneName) ?? [];
    mobs.push(mob);
    zones.set(zoneName, mobs);
  }

  return Array.from(zones.entries())
    .sort(([zoneA], [zoneB]) => zoneA.localeCompare(zoneB))
    .map(([zoneName, mobs]) => ({
      zoneName,
      mobs: mobs.sort((mobA, mobB) => mobA.name.localeCompare(mobB.name)),
    }));
}

function sortRaidSourceMobs(source: GearSourceInfo) {
  const zoneGroups = new Map<string, { order: number; mobs: Pick<Mob, "name" | "zone" | "level">[] }>();
  for (const [index, mob] of (source.sourceMobs ?? []).entries()) {
    const zoneName = mob.zone || "Unknown";
    const zoneGroup = zoneGroups.get(zoneName) ?? { order: index, mobs: [] };
    zoneGroup.mobs.push(mob);
    zoneGroups.set(zoneName, zoneGroup);
  }

  const groups = Array.from(zoneGroups.entries())
    .sort(([zoneA, groupA], [zoneB, groupB]) => {
      if (groupA.order !== groupB.order) return groupA.order - groupB.order;
      return zoneA.localeCompare(zoneB);
    });

  return groups.flatMap(([, group]) => group.mobs.sort((mobA, mobB) => mobA.name.localeCompare(mobB.name)));
}

function itemMatchesSlot(details: ItemDetails, slotKey: SlotKey) {
  return parseRawSlot(details.slot).has(slotKey);
}

function getItemIconUrl(details: ItemDetails | undefined) {
  if (!details) return null;
  return details.iconPath ?? details.icon ?? details.icon_url ?? null;
}

function normalizeLoreName(itemName: string) {
  return itemName.trim().toLowerCase().replace(/\s+/g, " ");
}

function getLoreComparisonName(itemName: string, details: ItemDetails | undefined) {
  return normalizeLoreName(details?.name ?? itemName);
}

function isLoreDuplicate(
  itemName: string,
  equippedGear: Record<string, string>,
  targetSlotId: string,
) {
  const details = itemDetails[itemName];
  if (!details?.lore) return false;

  const loreName = getLoreComparisonName(itemName, details);

  return Object.entries(equippedGear).some(([slotId, equippedItemName]) => {
    if (slotId === targetSlotId || !equippedItemName) return false;

    const equippedDetails = itemDetails[equippedItemName];
    if (!equippedDetails?.lore) return false;

    return getLoreComparisonName(equippedItemName, equippedDetails) === loreName;
  });
}

function normalizeRaceCode(value: unknown): RaceCode | "" {
  const raceCode = String(value ?? "").toUpperCase().trim();
  if (!raceCode) return "";
  const normalizedRaceCode = raceTokenAliases[raceCode] ?? raceCode;
  return raceCodes.includes(normalizedRaceCode as RaceCode) ? normalizedRaceCode as RaceCode : "";
}

function tokenizeRaceRestrictions(values?: string[] | string | null) {
  const list = Array.isArray(values) ? values : values ? [values] : [];

  return list
    .flatMap((value) => String(value).toUpperCase().split(/[,\s]+/))
    .map((value) => value.trim())
    .map((value) => raceTokenAliases[value] ?? value)
    .filter(Boolean);
}

function itemMatchesRace(details: ItemDetails | undefined, raceCode: RaceCode | "") {
  if (!raceCode) return true;

  const tokens = tokenizeRaceRestrictions(details?.races);
  if (tokens.length === 0) return true;

  const allIndex = tokens.indexOf("ALL");
  const exceptIndex = tokens.findIndex((token) => token === "EXCEPT" || token === "BUT");

  if (allIndex !== -1 && exceptIndex !== -1 && exceptIndex > allIndex) {
    return !tokens.slice(exceptIndex + 1).includes(raceCode);
  }

  if (allIndex !== -1) return true;

  return tokens.includes(raceCode);
}

function canEquipItem(
  itemName: string,
  equippedGear: Record<string, string>,
  targetSlotId: string,
  classCode: ClassCode,
  raceCode: RaceCode | "",
) {
  const details = itemDetails[itemName];

  if (!itemMatchesRace(details, raceCode)) {
    return {
      canEquip: false,
      reason: "This item cannot be equipped by your selected race.",
    };
  }

  if (!classCanUseShields(classCode) && isShieldItem(details)) {
    return {
      canEquip: false,
      reason: `${classCode} cannot equip shields.`,
    };
  }

  if (isLoreDuplicate(itemName, equippedGear, targetSlotId)) {
    return {
      canEquip: false,
      reason: `You can only equip one LORE item: ${itemName}`,
    };
  }

  const primaryName = equippedGear.primary;
  const primaryDetails = primaryName ? itemDetails[primaryName] : undefined;

  if (targetSlotId === "secondary" && isTwoHandedItem(primaryDetails)) {
    return {
      canEquip: false,
      reason: "Secondary cannot be equipped while using a two-handed weapon.",
    };
  }

  return { canEquip: true };
}

function sanitizeEquippedGear(equippedGear: Record<string, string>) {
  const next: Record<string, string> = {};
  const usedLoreNames = new Set<string>();

  for (const slot of gearSlots) {
    const itemName = equippedGear[slot.id];
    const details = itemName ? itemDetails[itemName] : undefined;
    if (!itemName || !details) continue;
    const primaryName = next.primary;
    const primaryDetails = primaryName ? itemDetails[primaryName] : undefined;
    if (slot.id === "secondary" && isTwoHandedItem(primaryDetails)) continue;

    if (details.lore) {
      const loreName = getLoreComparisonName(itemName, details);
      if (usedLoreNames.has(loreName)) continue;
      usedLoreNames.add(loreName);
    }

    next[slot.id] = itemName;
  }

  return next;
}

function getBisCandidatesForSlot(slot: GearSlot, classCode: ClassCode, raceCode: RaceCode | ""): BisCandidate[] {
  const bestByItem = new Map<string, BisCandidate>();

  for (const candidate of gearCandidates) {
    if (!itemMatchesSlot(candidate.details, slot.slotKey)) continue;
    if (!itemMatchesUseFilters(candidate.details, classCode, "Any")) continue;
    if (!itemMatchesRace(candidate.details, raceCode)) continue;

    const score = explainItemScore(candidate.details, classCode).score;
    const existing = bestByItem.get(candidate.itemName);
    if (!existing || score > existing.score) {
      bestByItem.set(candidate.itemName, {
        itemName: candidate.itemName,
        details: candidate.details,
        score,
      });
    }
  }

  return [
    ...Array.from(bestByItem.values())
      .sort((a, b) => b.score - a.score || (a.itemName ?? "").localeCompare(b.itemName ?? ""))
      .slice(0, bisCandidateLimit),
    { itemName: null, details: null, score: 0 },
  ];
}

function findBestBisCombination(slots: GearSlot[], candidatesBySlot: Record<string, BisCandidate[]>) {
  const loreSlotMap = new Map<string, Set<string>>();
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  for (const slot of slots) {
    for (const candidate of candidatesBySlot[slot.id]) {
      if (!candidate.details?.lore || !candidate.itemName) continue;
      const loreName = getLoreComparisonName(candidate.itemName, candidate.details);
      const slotIds = loreSlotMap.get(loreName) ?? new Set<string>();
      slotIds.add(slot.id);
      loreSlotMap.set(loreName, slotIds);
    }
  }

  const multiSlotLoreNames = new Set(
    Array.from(loreSlotMap.entries())
      .filter(([, slotIds]) => slotIds.size > 1)
      .map(([loreName]) => loreName),
  );

  const weaponConflictSlotIds = new Set<string>();
  if (
    slotById.has("primary")
    && slotById.has("secondary")
    && candidatesBySlot.primary?.some((candidate) => isTwoHandedItem(candidate.details))
  ) {
    weaponConflictSlotIds.add("primary");
    weaponConflictSlotIds.add("secondary");
  }

  if (multiSlotLoreNames.size === 0 && weaponConflictSlotIds.size === 0) {
    const bestGear: Record<string, string> = {};
    for (const slot of slots) {
      const itemName = candidatesBySlot[slot.id][0]?.itemName;
      if (itemName) bestGear[slot.id] = itemName;
    }
    return bestGear;
  }

  const conflictSlotIds = new Set<string>(weaponConflictSlotIds);
  for (const loreName of multiSlotLoreNames) {
    loreSlotMap.get(loreName)?.forEach((slotId) => conflictSlotIds.add(slotId));
  }

  const finalGear: Record<string, string> = {};
  for (const slot of slots) {
    if (conflictSlotIds.has(slot.id)) continue;
    const bestItem = candidatesBySlot[slot.id][0]?.itemName;
    if (bestItem) finalGear[slot.id] = bestItem;
  }

  const adjacency = new Map<string, Set<string>>();
  conflictSlotIds.forEach((slotId) => adjacency.set(slotId, new Set<string>()));
  if (conflictSlotIds.has("primary") && conflictSlotIds.has("secondary")) {
    adjacency.get("primary")?.add("secondary");
    adjacency.get("secondary")?.add("primary");
  }
  for (const loreName of multiSlotLoreNames) {
    const slotIds = Array.from(loreSlotMap.get(loreName) ?? []).filter((slotId) => conflictSlotIds.has(slotId));
    for (const slotId of slotIds) {
      for (const otherSlotId of slotIds) {
        if (slotId !== otherSlotId) adjacency.get(slotId)?.add(otherSlotId);
      }
    }
  }

  const visited = new Set<string>();
  const components: GearSlot[][] = [];
  for (const slotId of conflictSlotIds) {
    if (visited.has(slotId)) continue;
    const stack = [slotId];
    const component: GearSlot[] = [];
    visited.add(slotId);

    while (stack.length > 0) {
      const currentSlotId = stack.pop() as string;
      const slot = slotById.get(currentSlotId);
      if (slot) component.push(slot);

      adjacency.get(currentSlotId)?.forEach((nextSlotId) => {
        if (visited.has(nextSlotId)) return;
        visited.add(nextSlotId);
        stack.push(nextSlotId);
      });
    }

    components.push(component);
  }

  function loreNameFor(candidate: BisCandidate) {
    return candidate.details?.lore && candidate.itemName
      ? getLoreComparisonName(candidate.itemName, candidate.details)
      : null;
  }

  function currentPrimaryIsTwoHanded(currentGear: Record<string, string>) {
    const primaryName = currentGear.primary;
    return primaryName ? isTwoHandedItem(itemDetails[primaryName]) : false;
  }

  function canPlaceCandidate(slot: GearSlot, candidate: BisCandidate, currentGear: Record<string, string>) {
    if (!candidate.itemName) return true;
    if (slot.id === "secondary" && currentPrimaryIsTwoHanded(currentGear)) return false;
    if (slot.id === "primary" && isTwoHandedItem(candidate.details) && currentGear.secondary) return false;
    return true;
  }

  function solveComponent(componentSlots: GearSlot[]) {
    const searchSlots = [...componentSlots].sort(
      (a, b) => candidatesBySlot[a.id].length - candidatesBySlot[b.id].length || a.id.localeCompare(b.id),
    );
    const greedyGear: Record<string, string> = {};
    const greedyLore = new Set<string>();
    let greedyScore = 0;

    for (const slot of searchSlots) {
      const chosen = candidatesBySlot[slot.id].find((candidate) => {
        const loreName = loreNameFor(candidate);
        return (!loreName || !greedyLore.has(loreName)) && canPlaceCandidate(slot, candidate, greedyGear);
      });
      if (!chosen) continue;
      const loreName = loreNameFor(chosen);
      if (chosen.itemName) greedyGear[slot.id] = chosen.itemName;
      if (loreName) greedyLore.add(loreName);
      greedyScore += chosen.score;
    }

    const bestRemainingScore: number[] = [];
    for (let index = searchSlots.length - 1; index >= 0; index -= 1) {
      const slot = searchSlots[index];
      bestRemainingScore[index] = (candidatesBySlot[slot.id][0]?.score ?? 0) + (bestRemainingScore[index + 1] ?? 0);
    }

    let bestScore = greedyScore;
    let bestGear = greedyGear;
    let visits = 0;
    const maxVisits = 50000;

    function search(index: number, usedLoreNames: Set<string>, currentGear: Record<string, string>, currentScore: number) {
      visits += 1;
      if (visits > maxVisits) return;
      if (currentScore + (bestRemainingScore[index] ?? 0) < bestScore) return;
      if (index >= searchSlots.length) {
        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestGear = { ...currentGear };
        }
        return;
      }

      const slot = searchSlots[index];
      for (const candidate of candidatesBySlot[slot.id]) {
        const loreName = loreNameFor(candidate);
        if (loreName && usedLoreNames.has(loreName)) continue;
        if (!canPlaceCandidate(slot, candidate, currentGear)) continue;

        if (candidate.itemName) currentGear[slot.id] = candidate.itemName;
        else delete currentGear[slot.id];
        if (loreName) usedLoreNames.add(loreName);

        search(index + 1, usedLoreNames, currentGear, currentScore + candidate.score);

        if (loreName) usedLoreNames.delete(loreName);
        delete currentGear[slot.id];
      }
    }

    search(0, new Set<string>(), {}, 0);
    return bestGear;
  }

  for (const component of components) {
    Object.assign(finalGear, solveComponent(component));
  }

  return finalGear;
}

function formatContributionSummary(contributions: ReturnType<typeof explainItemScore>["contributions"]) {
  return contributions
    .slice(0, 3)
    .map((entry) => `${formatScoredStatLabel(entry.stat)} ${entry.value > 0 ? "+" : ""}${entry.value}`)
    .join(" · ");
}

function safeFileName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "loot-goblin-build";
}

function createBuildId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeClassCode(value: unknown): ClassCode {
  const classCode = String(value ?? "").toUpperCase();
  if (!(classCode in CLASS_STAT_WEIGHTS)) {
    throw new Error("That build uses an unsupported class.");
  }

  return classCode as ClassCode;
}

function normalizeGearSlotId(slotId: string) {
  if (gearSlotIds.has(slotId)) return slotId;
  const migratedSlotId = legacyGearSlotIdMap[slotId];
  return migratedSlotId && gearSlotIds.has(migratedSlotId) ? migratedSlotId : null;
}

function normalizeEquippedGear(values: unknown): Record<string, string> {
  const equippedGear: Record<string, string> = {};
  if (!values || typeof values !== "object") return equippedGear;

  for (const [slotId, itemName] of Object.entries(values as Record<string, unknown>)) {
    const normalizedSlotId = normalizeGearSlotId(slotId);
    if (!normalizedSlotId || typeof itemName !== "string" || equippedGear[normalizedSlotId]) continue;
    if (itemName && itemDetails[itemName]) {
      equippedGear[normalizedSlotId] = itemName;
    }
  }

  return sanitizeEquippedGear(equippedGear);
}

function gearRecordToEquippedItems(equippedGear: Record<string, string>): Record<string, string | null> {
  return Object.fromEntries(gearSlots.map((slot) => [slot.id, equippedGear[slot.id] ?? null]));
}

function equippedItemsToGearRecord(equippedItems: Record<string, string | null>): Record<string, string> {
  const equippedGear: Record<string, string> = {};

  for (const [slotId, itemName] of Object.entries(equippedItems)) {
    const normalizedSlotId = normalizeGearSlotId(slotId);
    if (!normalizedSlotId || !itemName || !itemDetails[itemName] || equippedGear[normalizedSlotId]) continue;
    equippedGear[normalizedSlotId] = itemName;
  }

  return sanitizeEquippedGear(equippedGear);
}

function equippedSlotCountFromItems(equippedItems: Record<string, string | null>) {
  return gearSlots.filter((slot) => Boolean(equippedItems[slot.id])).length;
}

function normalizePlannerItems(values: unknown): GearPlannerManualItem[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();

  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const candidate = value as Partial<GearPlannerManualItem>;
    const itemName = typeof candidate.itemName === "string" && itemDetails[candidate.itemName]
      ? candidate.itemName
      : null;
    if (!itemName) return [];

    const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : createBuildId();
    if (seen.has(id)) return [];
    seen.add(id);

    const normalizedSlot = typeof candidate.slotId === "string" ? normalizeGearSlotId(candidate.slotId) : null;
    const rawUtilityBagSlot = candidate.utilityBagSlot;
    const utilityBagSlot = typeof rawUtilityBagSlot === "number" && Number.isInteger(rawUtilityBagSlot) && rawUtilityBagSlot >= 0
      ? rawUtilityBagSlot
      : null;
    const tags = Array.isArray(candidate.tags)
      ? candidate.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim()).slice(0, 6)
      : [];

    return [{
      id,
      itemName,
      slotId: normalizedSlot,
      category: typeof candidate.category === "string" && candidate.category.trim() ? candidate.category.trim() : undefined,
      tags: tags.length > 0 ? tags : undefined,
      notes: typeof candidate.notes === "string" && candidate.notes.trim() ? candidate.notes.trim().slice(0, plannerNoteMaxLength) : undefined,
      utilityBagSlot,
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : undefined,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
    }];
  });
}

function formatAutosaveTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function upsertBuild(roster: GearBuild[], build: GearBuild) {
  const index = roster.findIndex((entry) => entry.id === build.id);
  if (index === -1) {
    return [...roster, build];
  }

  return roster.map((entry) => (entry.id === build.id ? build : entry));
}

function serializeRoster(roster: GearRoster | null) {
  return roster ? JSON.stringify(roster) : "";
}

function readLocalRoster(): { roster: GearRoster | null; raw: string | null } {
  const raw = window.localStorage.getItem(rosterAutosaveKey);
  if (!raw) return { roster: null, raw: null };
  return { roster: validateRoster(JSON.parse(raw)), raw };
}

function persistRosterSnapshotToLocal(snapshot: GearRoster | null) {
  if (!snapshot || snapshot.characters.length === 0) {
    window.localStorage.removeItem(rosterAutosaveKey);
    return null;
  }

  const payload = JSON.stringify(snapshot);
  window.localStorage.setItem(rosterAutosaveKey, payload);
  return payload;
}

function characterMergeKey(character: GearBuild) {
  return [
    character.name.trim().toLocaleLowerCase(),
    character.class.trim().toLocaleLowerCase(),
    (character.server ?? "").trim().toLocaleLowerCase(),
  ].join("|");
}

function mergeRosters(remoteRoster: GearRoster | null, localRoster: GearRoster | null): GearRoster | null {
  const remoteCharacters = remoteRoster?.characters ?? [];
  const localCharacters = localRoster?.characters ?? [];
  if (remoteCharacters.length === 0 && localCharacters.length === 0) return null;

  const merged = [...remoteCharacters];
  const seen = new Set(merged.map(characterMergeKey));

  for (const character of localCharacters) {
    const key = characterMergeKey(character);
    if (seen.has(key)) continue;
    merged.push(character);
    seen.add(key);
  }

  return {
    version: 1,
    rosterName: remoteRoster?.rosterName ?? localRoster?.rosterName ?? "Loot Goblin Roster",
    characters: merged,
    activeCharacterId: remoteRoster?.activeCharacterId ?? localRoster?.activeCharacterId ?? merged[0]?.id,
    updatedAt: new Date().toISOString(),
  };
}

function validateBuild(raw: unknown): SavedBuild {
  if (!raw || typeof raw !== "object") {
    throw new Error("That file is not a valid character build.");
  }

  const candidate = raw as Partial<SavedBuild>;
  if (typeof candidate.version !== "number" || typeof candidate.characterName !== "string" || typeof candidate.class !== "string" || !candidate.equippedGear || typeof candidate.equippedGear !== "object") {
    throw new Error("That build file is missing required fields.");
  }

  return {
    version: 1,
    characterName: candidate.characterName,
    class: normalizeClassCode(candidate.class),
    race: normalizeRaceCode(candidate.race),
    equippedGear: normalizeEquippedGear(candidate.equippedGear),
  };
}

function savedBuildToGearBuild(build: SavedBuild): GearBuild {
  const now = new Date().toISOString();
  return {
    id: createBuildId(),
    name: build.characterName.trim() || `${build.class} Character`,
    class: build.class,
    race: normalizeRaceCode(build.race) || undefined,
    equippedItems: gearRecordToEquippedItems(build.equippedGear),
    plannerItems: [],
    createdAt: now,
    updatedAt: now,
  };
}

function validateGearBuild(raw: unknown): GearBuild {
  if (!raw || typeof raw !== "object") {
    throw new Error("One roster character is invalid.");
  }

  const candidate = raw as Partial<GearBuild> & { characterName?: unknown; equippedGear?: unknown };
  const classCode = normalizeClassCode(candidate.class);
  const raceCode = normalizeRaceCode(candidate.race);
  const name = String(candidate.name ?? candidate.characterName ?? "").trim() || `${classCode} Character`;
  const equippedSource = candidate.equippedItems ?? candidate.equippedGear ?? {};
  const equippedGear = normalizeEquippedGear(equippedSource);
  const now = new Date().toISOString();

  return {
    id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : createBuildId(),
    name,
    class: classCode,
    race: raceCode || undefined,
    server: typeof candidate.server === "string" && candidate.server.trim() ? candidate.server : undefined,
    equippedItems: gearRecordToEquippedItems(equippedGear),
    plannerItems: normalizePlannerItems(candidate.plannerItems),
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : now,
  };
}

function validateRoster(raw: unknown): GearRoster {
  if (!raw || typeof raw !== "object") {
    throw new Error("That file is not a valid roster.");
  }

  const candidate = raw as Partial<GearRoster>;
  if (Array.isArray(candidate.characters)) {
    const characters = candidate.characters.map(validateGearBuild);
    const activeCharacterId = characters.some((character) => character.id === candidate.activeCharacterId)
      ? candidate.activeCharacterId
      : characters[0]?.id;

    return {
      version: 1,
      rosterName: typeof candidate.rosterName === "string" ? candidate.rosterName : undefined,
      characters,
      activeCharacterId,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
    };
  }

  const legacyBuild = savedBuildToGearBuild(validateBuild(raw));
  return {
    version: 1,
    characters: [legacyBuild],
    activeCharacterId: legacyBuild.id,
  };
}

export function CharacterGearPlanner() {
  const [selectedSlotId, setSelectedSlotId] = useState("head");
  const [selectedClass, setSelectedClass] = useState<ClassCode>("WAR");
  const [selectedRace, setSelectedRace] = useState<RaceCode | "">("");
  const [characterName, setCharacterName] = useState("");
  const [equippedGear, setEquippedGear] = useState<Record<string, string>>({});
  const [roster, setRoster] = useState<GearBuild[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showBisConfirm, setShowBisConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete-character" | "delete-group" | null>(null);
  const [previewItemName, setPreviewItemName] = useState<string | null>(null);
  const [focusOnly, setFocusOnly] = useState(false);
  const [selectedSpellFocus, setSelectedSpellFocus] = useState(anySpellFocus);
  const [selectedBardMod, setSelectedBardMod] = useState(anyBardMod);
  const [selectedPetFocus, setSelectedPetFocus] = useState(anyPetFocus);
  const [recommendationMaxGearScore, setRecommendationMaxGearScore] = useState("");
  const [selectedWeaponFilter, setSelectedWeaponFilter] = useState<WeaponFilter>("Any");
  const [recommendationSort, setRecommendationSort] = useState<RecommendationSort>("score");
  const [autosaveStatus, setAutosaveStatus] = useState<string | null>(null);
  const [plannerSaveStatus, setPlannerSaveStatus] = useState<string | null>(null);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudImportPrompt, setCloudImportPrompt] = useState<{ merged: GearRoster; localCount: number } | null>(null);
  const [viewMode, setViewMode] = useState<"roster" | "shopping">("roster");
  const [plannerSelectedCharacterIds, setPlannerSelectedCharacterIds] = useState<Set<string>>(() => new Set());
  const [plannerSelectedExpansions, setPlannerSelectedExpansions] = useState<Set<string>>(() => new Set(plannerExpansionOptions));
  const [plannerItemQuery, setPlannerItemQuery] = useState("");
  const [plannerSourceQuery, setPlannerSourceQuery] = useState("");
  const [gearShoppingObtainedNeedKeys, setGearShoppingObtainedNeedKeys] = useState<Set<string>>(() => new Set());
  const [gearShoppingObtainedReady, setGearShoppingObtainedReady] = useState(false);
  const [hideObtainedGear, setHideObtainedGear] = useState(false);
  const [hideEndgameGear, setHideEndgameGear] = useState(false);
  const [maxGearScore, setMaxGearScore] = useState("");
  const [addPlannerItemOpen, setAddPlannerItemOpen] = useState(false);
  const [addPlannerItemQuery, setAddPlannerItemQuery] = useState("");
  const [selectedAddPlannerItemName, setSelectedAddPlannerItemName] = useState("");
  const [addPlannerItemMessage, setAddPlannerItemMessage] = useState<string | null>(null);
  const [addPlannerItemCharacterId, setAddPlannerItemCharacterId] = useState("");
  const [addPlannerItemPlacement, setAddPlannerItemPlacement] = useState("utility");
  const [addPlannerItemNotes, setAddPlannerItemNotes] = useState("");
  const [addPlannerUtilitySlot, setAddPlannerUtilitySlot] = useState<number | null>(null);
  const [expandedUtilityBags, setExpandedUtilityBags] = useState<Set<string>>(() => new Set());
  const [selectedUtilityItem, setSelectedUtilityItem] = useState<{ characterId: string; itemId: string } | null>(null);
  const [expandedSourceItems, setExpandedSourceItems] = useState<Set<string>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftBuildIdRef = useRef<string | null>(null);
  const lastAutosavePayloadRef = useRef<string | null>(null);
  const lastCloudRosterPayloadRef = useRef<string | null>(null);
  const pendingPlannerSelectedCharacterIdsRef = useRef<string[] | null>(null);
  const { hidePreview } = useItemPreview();
  const { server } = useServer();
  const { status: authStatus, data: session } = useSession();
  const isSignedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  const selectedGearSlot = gearSlots.find((slot) => slot.id === selectedSlotId) ?? gearSlots[0];
  const equippedItemName = equippedGear[selectedGearSlot.id];
  const selectedLabel = selectedGearSlot.label;
  const primaryEquippedName = equippedGear.primary;
  const primaryIsTwoHanded = primaryEquippedName ? isTwoHandedItem(itemDetails[primaryEquippedName]) : false;
  const secondaryBlockedByTwoHander = selectedGearSlot.id === "secondary" && primaryIsTwoHanded;
  const activeRosterMember = activeCharacterId
    ? roster.find((character) => character.id === activeCharacterId)
    : null;
  const plannerRoster = useMemo(() => {
    let nextRoster = saveActiveToRoster(roster);
    if (!activeCharacterId && currentHasContent()) {
      const draftBuild = buildFromCurrent(draftBuildIdRef.current ?? "draft-current-character");
      nextRoster = upsertBuild(nextRoster, draftBuild);
    }
    return nextRoster;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacterId, characterName, equippedGear, roster, selectedClass, selectedRace, server]);
  const plannerSelectedExpansionSet = useMemo(() => plannerSelectedExpansions, [plannerSelectedExpansions]);
  const allPlannerExpansionsSelected = plannerSelectedExpansionSet.size === plannerExpansionOptions.length;
  const plannerSelectedCharacters = useMemo(
    () => plannerRoster.filter((character) => plannerSelectedCharacterIds.has(character.id)),
    [plannerRoster, plannerSelectedCharacterIds],
  );
  const addPlannerItemMatches = useMemo(() => {
    const query = addPlannerItemQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    const tokens = query.split(/\s+/).filter(Boolean);

    return Object.entries(itemDetails)
      .map(([itemName, details]) => {
        const haystack = [
          itemName,
          details.expansion,
          details.sourceNpcName,
          details.questName,
          details.item_type,
          details.itemType,
          ...(details.tags ?? []),
          ...(details.categories ?? []),
          ...(details.aliases ?? []),
          ...(details.searchKeywords ?? []),
          ...(details.click_effects ?? []),
          ...(details.worn_effects ?? []),
          ...(details.focus_effects ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        const tokenMatches = tokens.filter((token) => haystack.includes(token)).length;
        if (tokenMatches === 0 && !itemName.toLowerCase().includes(query)) return null;
        const startsWithBonus = itemName.toLowerCase().startsWith(query) ? 4 : 0;
        const exactBonus = itemName.toLowerCase() === query ? 10 : 0;
        return { itemName, details, score: exactBonus + startsWithBonus + tokenMatches };
      })
      .filter((match): match is { itemName: string; details: ItemDetails; score: number } => Boolean(match))
      .sort((a, b) => b.score - a.score || a.itemName.localeCompare(b.itemName))
      .slice(0, 12);
  }, [addPlannerItemQuery]);
  const gearShoppingItems = useMemo<GearShoppingItem[]>(() => {
    const itemMap = new Map<string, GearShoppingItem>();

    for (const character of plannerSelectedCharacters) {
      for (const [slotId, itemName] of Object.entries(character.equippedItems)) {
        if (!itemName) continue;
        const candidate = getCandidateForItem(itemName);
        if (!candidate) continue;

        const current = itemMap.get(itemName) ?? {
          itemName,
          details: candidate.details,
          needs: [],
          expansions: candidate.expansions,
          zones: candidate.zones,
          sources: candidate.sources,
          itemType: getItemTypeLabel(candidate.details),
        };
        current.needs.push({
          characterId: character.id,
          characterName: character.name,
          class: character.class,
          slotId,
          slotLabel: getGearSlotLabel(slotId),
        });
        itemMap.set(itemName, current);
      }

      for (const plannerItem of character.plannerItems ?? []) {
        const candidate = getCandidateForItem(plannerItem.itemName);
        if (!candidate) continue;
        const itemName = plannerItem.itemName;
        const current = itemMap.get(itemName) ?? {
          itemName,
          details: candidate.details,
          needs: [],
          expansions: candidate.expansions,
          zones: candidate.zones,
          sources: candidate.sources,
          itemType: getItemTypeLabel(candidate.details),
        };
        const slotLabel = plannerItem.utilityBagSlot !== null && plannerItem.utilityBagSlot !== undefined
          ? "Utility Bag"
          : plannerItem.slotId
            ? getGearSlotLabel(plannerItem.slotId)
            : "Custom Goal";
        current.needs.push({
          characterId: character.id,
          characterName: character.name,
          class: character.class,
          slotId: plannerItemNeedSlotId(plannerItem),
          slotLabel,
          manualItemId: plannerItem.id,
          category: plannerItem.category,
          tags: plannerItem.tags,
          notes: plannerItem.notes,
          utilityBagSlot: plannerItem.utilityBagSlot,
        });
        itemMap.set(itemName, current);
      }
    }

    return Array.from(itemMap.values())
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [plannerSelectedCharacters]);
  const filteredGearShoppingItems = useMemo<GearShoppingDisplayItem[]>(() => {
    const itemQuery = plannerItemQuery.trim().toLowerCase();
    const sourceQuery = plannerSourceQuery.trim().toLowerCase();
    const parsedMaxGearScore = maxGearScore.trim() ? Number(maxGearScore) : Number.POSITIVE_INFINITY;
    const hasMaxGearScore = Number.isFinite(parsedMaxGearScore);

    return gearShoppingItems
      .map((item) => {
        const completedNeeds = item.needs.filter((need) => gearShoppingObtainedNeedKeys.has(gearShoppingNeedKey(item.itemName, need)));
        const remainingNeeds = item.needs.filter((need) => !gearShoppingObtainedNeedKeys.has(gearShoppingNeedKey(item.itemName, need)));
        return {
          ...item,
          completedNeeds,
          gearScore: getShoppingItemScore(item),
          obtainedCount: completedNeeds.length,
          remainingNeeds,
          totalCount: item.needs.length,
        };
      })
      .filter((item) => {
        if (hideObtainedGear && item.remainingNeeds.length === 0) return false;
        if (hideEndgameGear && isEndgameOrSpecialItem(item.itemName, item.details, item.sources)) return false;
        if (hasMaxGearScore && item.gearScore > parsedMaxGearScore) return false;
        const expansionMatches = item.expansions.length === 0
          || item.expansions.some((expansion) => plannerSelectedExpansionSet.has(expansion));
        const itemMatches = !itemQuery || item.itemName.toLowerCase().includes(itemQuery);
        const sourceMatches = !sourceQuery
          || item.zones.some((zone) => zone.toLowerCase().includes(sourceQuery))
          || item.sources.some((source) => sourceMatchesQuery(source, sourceQuery));
        return expansionMatches && itemMatches && sourceMatches;
      })
      .sort((a, b) => {
        const aComplete = a.remainingNeeds.length === 0 ? 1 : 0;
        const bComplete = b.remainingNeeds.length === 0 ? 1 : 0;
        return aComplete - bComplete || a.itemName.localeCompare(b.itemName);
      });
  }, [gearShoppingItems, gearShoppingObtainedNeedKeys, hideEndgameGear, hideObtainedGear, maxGearScore, plannerItemQuery, plannerSelectedExpansionSet, plannerSourceQuery]);
  const gearShoppingProgress = useMemo(() => {
    const total = gearShoppingItems.reduce((sum, item) => sum + item.needs.length, 0);
    const obtained = gearShoppingItems.reduce(
      (sum, item) => sum + item.needs.filter((need) => gearShoppingObtainedNeedKeys.has(gearShoppingNeedKey(item.itemName, need))).length,
      0,
    );

    return { obtained, remaining: total - obtained, total };
  }, [gearShoppingItems, gearShoppingObtainedNeedKeys]);
  const sourcePlannerOverlapItems = useMemo(() => {
    const itemsBySource = new Map<string, Set<string>>();
    for (const item of gearShoppingItems) {
      for (const source of getFullGearSources(item.itemName, item.sources)) {
        const key = sourceIdentity(source);
        const itemNames = itemsBySource.get(key) ?? new Set<string>();
        itemNames.add(item.itemName);
        itemsBySource.set(key, itemNames);
      }
    }
    return itemsBySource;
  }, [gearShoppingItems]);
  const plannerAssignedGearCount = useMemo(
    () => plannerRoster.reduce((sum, character) => sum + equippedSlotCountFromItems(character.equippedItems), 0),
    [plannerRoster],
  );
  const plannerActiveFilters = [
    plannerSelectedCharacterIds.size !== plannerRoster.length ? "characters" : null,
    !allPlannerExpansionsSelected ? "expansions" : null,
    plannerItemQuery.trim() ? "item search" : null,
    plannerSourceQuery.trim() ? "source search" : null,
    hideObtainedGear ? "hide obtained" : null,
    hideEndgameGear ? "hide endgame" : null,
    maxGearScore.trim() ? "max gear score" : null,
  ].filter(Boolean);

  useEffect(() => {
    hidePreview();
  }, [hidePreview]);

  useEffect(() => {
    try {
      const rawPlannerState = window.localStorage.getItem(gearPlannerStateStorageKey);
      if (rawPlannerState) {
        const parsed = JSON.parse(rawPlannerState) as {
          obtainedNeedKeys?: unknown;
          hideObtainedGear?: unknown;
          selectedCharacterIds?: unknown;
          savedAt?: unknown;
        };
        if (Array.isArray(parsed.obtainedNeedKeys)) {
          setGearShoppingObtainedNeedKeys(new Set(parsed.obtainedNeedKeys.filter((key): key is string => typeof key === "string")));
        }
        if (typeof parsed.hideObtainedGear === "boolean") {
          setHideObtainedGear(parsed.hideObtainedGear);
        }
        if (Array.isArray(parsed.selectedCharacterIds)) {
          pendingPlannerSelectedCharacterIdsRef.current = parsed.selectedCharacterIds.filter((id): id is string => typeof id === "string");
        }
        if (typeof parsed.savedAt === "string") {
          const savedTime = formatAutosaveTime(parsed.savedAt);
          setPlannerSaveStatus(savedTime ? `Last saved locally: ${savedTime}` : "Planner saved locally");
        }
      } else {
        const rawKeys = window.localStorage.getItem(gearShoppingObtainedStorageKey);
        if (rawKeys) {
          const parsed = JSON.parse(rawKeys);
          if (Array.isArray(parsed)) {
            setGearShoppingObtainedNeedKeys(new Set(parsed.filter((key): key is string => typeof key === "string")));
          }
        }

        setHideObtainedGear(window.localStorage.getItem(gearShoppingHideObtainedStorageKey) === "1");
      }
    } catch {
      window.localStorage.removeItem(gearPlannerStateStorageKey);
      window.localStorage.removeItem(gearShoppingObtainedStorageKey);
      window.localStorage.removeItem(gearShoppingHideObtainedStorageKey);
    } finally {
      setGearShoppingObtainedReady(true);
    }
  }, []);

  useEffect(() => {
    if (!gearShoppingObtainedReady) return;
    const savedAt = new Date().toISOString();
    window.localStorage.setItem(
      gearShoppingObtainedStorageKey,
      JSON.stringify(Array.from(gearShoppingObtainedNeedKeys).sort()),
    );
    window.localStorage.setItem(gearShoppingHideObtainedStorageKey, hideObtainedGear ? "1" : "0");
    window.localStorage.setItem(gearPlannerStateStorageKey, JSON.stringify({
      version: 1,
      obtainedNeedKeys: Array.from(gearShoppingObtainedNeedKeys).sort(),
      hideObtainedGear,
      selectedCharacterIds: Array.from(plannerSelectedCharacterIds).sort(),
      savedAt,
    }));
    const savedTime = formatAutosaveTime(savedAt);
    setPlannerSaveStatus(savedTime ? `Autosaved locally: ${savedTime}` : "Planner autosaved locally");
  }, [gearShoppingObtainedNeedKeys, gearShoppingObtainedReady, hideObtainedGear, plannerSelectedCharacterIds]);

  useEffect(() => {
    setPlannerSelectedCharacterIds((current) => {
      const validIds = new Set(plannerRoster.map((character) => character.id));
      const pendingIds = pendingPlannerSelectedCharacterIdsRef.current;
      if (pendingIds) {
        pendingPlannerSelectedCharacterIdsRef.current = null;
        const restored = new Set(pendingIds.filter((id) => validIds.has(id)));
        if (restored.size > 0) return restored;
      }
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      for (const id of validIds) {
        if (current.size === 0 || current.has(id)) next.add(id);
      }
      return next;
    });
  }, [plannerRoster]);

  useEffect(() => {
    setAddPlannerItemCharacterId((current) => {
      if (plannerRoster.some((character) => character.id === current)) return current;
      return plannerRoster[0]?.id ?? "";
    });
  }, [plannerRoster]);

  useEffect(() => {
    try {
      const { roster: parsed, raw: saved } = readLocalRoster();
      if (!parsed || !saved) {
        setAutosaveReady(true);
        return;
      }

      lastAutosavePayloadRef.current = saved;
      setRoster(parsed.characters);

      const activeBuild = parsed.characters.find((character) => character.id === parsed.activeCharacterId)
        ?? parsed.characters[0];
      if (activeBuild) {
        loadRosterMember(activeBuild);
        setLoadMessage("Restored local autosave.");
      }

      const restoredTime = parsed.updatedAt ? formatAutosaveTime(parsed.updatedAt) : null;
      setAutosaveStatus(restoredTime ? `Last autosaved: ${restoredTime}` : "Autosaved locally");
    } catch {
      window.localStorage.removeItem(rosterAutosaveKey);
      setLoadError("Ignored a corrupt local character autosave.");
    } finally {
      setAutosaveReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autosaveReady) return;

    if (!isSignedIn) {
      setCloudReady(false);
      setCloudImportPrompt(null);
      lastCloudRosterPayloadRef.current = null;
      return;
    }

    let cancelled = false;
    setCloudReady(false);
    fetchUserSettings()
      .then((settings) => {
        if (cancelled) return;

        const localSnapshot = readLocalRoster().roster;
        const remoteSnapshot = settings?.preferences?.[cloudRosterPreferenceKey]
          ? validateRoster(settings.preferences[cloudRosterPreferenceKey])
          : null;

        if (remoteSnapshot?.characters.length) {
          const remotePayload = serializeRoster(remoteSnapshot);
          lastCloudRosterPayloadRef.current = remotePayload;
          const localPayload = serializeRoster(localSnapshot);
          const localHasDifferentCharacters = Boolean(localSnapshot?.characters.length) && localPayload !== remotePayload;

          setRoster(remoteSnapshot.characters);
          const activeBuild = remoteSnapshot.characters.find((character) => character.id === remoteSnapshot.activeCharacterId)
            ?? remoteSnapshot.characters[0];
          if (activeBuild) {
            loadRosterMember(activeBuild);
          }
          const localPayloadWritten = persistRosterSnapshotToLocal(remoteSnapshot);
          lastAutosavePayloadRef.current = localPayloadWritten;
          setAutosaveStatus("Loaded from Discord account");
          setLoadError(null);

          if (localHasDifferentCharacters) {
            const merged = mergeRosters(remoteSnapshot, localSnapshot);
            if (merged) {
              setCloudImportPrompt({ merged, localCount: localSnapshot?.characters.length ?? 0 });
            }
          }
          return;
        }

        if (localSnapshot?.characters.length) {
          const merged = mergeRosters(null, localSnapshot);
          if (merged) {
            setCloudImportPrompt({ merged, localCount: localSnapshot.characters.length });
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Unable to load Discord character save. Local autosave is still available.");
        }
      })
      .finally(() => {
        if (!cancelled) setCloudReady(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveReady, isSignedIn]);

  const focusFamilyOptions = useMemo(() => {
    const families: Record<FocusEffectCategory, Set<string>> = {
      spell: new Set<string>(),
      bard: new Set<string>(),
      pet: new Set<string>(),
    };

    for (const candidate of gearCandidates) {
      getFocusEffectFamilyEntries(candidate.details).forEach(({ category, family }) => {
        families[category].add(family);
      });
    }

    return {
      spell: [anySpellFocus, ...Array.from(families.spell).sort((a, b) => a.localeCompare(b))],
      bard: [anyBardMod, ...Array.from(families.bard).sort((a, b) => a.localeCompare(b))],
      pet: [anyPetFocus, ...Array.from(families.pet).sort((a, b) => a.localeCompare(b))],
    };
  }, []);

  const globalScoreByItemId = useMemo(() => {
    const scoreMap = new Map<string, number>();
    for (const candidate of gearCandidates) {
      const globalScore = Math.max(
        0,
        ...classCodes.map((classCode) => explainItemScore(candidate.details, classCode).score),
      );

      for (const key of itemScoreLookupKeys(candidate.itemName, candidate.details)) {
        scoreMap.set(key, Math.max(scoreMap.get(key) ?? 0, globalScore));
      }
    }
    return scoreMap;
  }, []);

  const weaponFilterOptions = useMemo<WeaponFilter[]>(() => {
    const values = new Set<WeaponFilter>();
    for (const candidate of gearCandidates) {
      const weaponValue = getWeaponFilterValue(candidate.details);
      if (weaponValue) values.add(weaponValue);
    }
    return weaponFilterOrder.filter((option) => option === "Any" || values.has(option));
  }, []);

  const recommendations = useMemo(() => {
    if (secondaryBlockedByTwoHander) return [];
    const parsedMaxGearScore = recommendationMaxGearScore.trim() ? Number(recommendationMaxGearScore) : Number.POSITIVE_INFINITY;
    const hasMaxGearScore = Number.isFinite(parsedMaxGearScore);

    const activeFocusFilters: FocusEffectFamily[] = [
      selectedSpellFocus !== anySpellFocus ? { category: "spell", family: selectedSpellFocus } : null,
      selectedBardMod !== anyBardMod ? { category: "bard", family: selectedBardMod } : null,
      selectedPetFocus !== anyPetFocus ? { category: "pet", family: selectedPetFocus } : null,
    ].filter((entry): entry is FocusEffectFamily => Boolean(entry));
    const hasSpecificFocusFamily = activeFocusFilters.length > 0;
    const matchesActiveFocus = (details: ItemDetails) =>
      activeFocusFilters.some(({ category, family }) => itemMatchesFocusFamily(details, family, category));

    return gearCandidates
      .filter((candidate) => itemMatchesSlot(candidate.details, selectedGearSlot.slotKey))
      .filter((candidate) => itemMatchesUseFilters(candidate.details, selectedClass, "Any"))
      .filter((candidate) => itemMatchesRace(candidate.details, selectedRace))
      .filter((candidate) => itemMatchesWeaponFilter(candidate.details, selectedWeaponFilter))
      .filter((candidate) => !isLoreDuplicate(candidate.itemName, equippedGear, selectedGearSlot.id))
      .filter((candidate) => {
        if (!focusOnly) return true;
        return hasSpecificFocusFamily
          ? matchesActiveFocus(candidate.details)
          : itemHasFocusEffect(candidate.details);
      })
      .map((candidate) => {
        const explanation = explainItemScore(candidate.details, selectedClass);
        const matchesFocusFamily = hasSpecificFocusFamily
          ? matchesActiveFocus(candidate.details)
          : false;
        return {
          ...candidate,
          hasFocus: itemHasFocusEffect(candidate.details),
          matchesFocusFamily,
          ratio: getWeaponRatio(candidate.details),
          score: explanation.score,
          contributionSummary: formatContributionSummary(explanation.contributions),
        };
      })
      .filter((candidate) => {
        if (!hasMaxGearScore) return true;
        return getGlobalItemScore(candidate.itemName, candidate.details, globalScoreByItemId, candidate.score) <= parsedMaxGearScore;
      })
      .sort((a, b) => {
        if (hasSpecificFocusFamily && a.matchesFocusFamily !== b.matchesFocusFamily) {
          return Number(b.matchesFocusFamily) - Number(a.matchesFocusFamily);
        }

        if (recommendationSort === "ratio") {
          return (b.ratio ?? -1) - (a.ratio ?? -1) || b.score - a.score || a.itemName.localeCompare(b.itemName);
        }

        return b.score - a.score || a.itemName.localeCompare(b.itemName);
      })
      .slice(0, recommendationLimit);
  }, [equippedGear, focusOnly, globalScoreByItemId, recommendationMaxGearScore, recommendationSort, secondaryBlockedByTwoHander, selectedBardMod, selectedClass, selectedPetFocus, selectedRace, selectedSpellFocus, selectedGearSlot.id, selectedGearSlot.slotKey, selectedWeaponFilter]);

  const equippedFocusSummary = useMemo(() => {
    const summary: Record<FocusEffectCategory, Array<{ slot: string; effect: string }>> = {
      spell: [],
      bard: [],
      pet: [],
    };

    for (const slot of gearSlots) {
      const itemName = equippedGear[slot.id];
      const effects = itemName ? getFocusEffects(itemDetails[itemName]) : [];

      for (const effect of effects) {
        summary[getFocusEffectCategory(effect.name)].push({ slot: slot.label, effect: effect.name });
      }
    }

    return summary;
  }, [equippedGear]);
  const hasEquippedFocusEffects = Object.values(equippedFocusSummary).some((effects) => effects.length > 0);

  const previewCandidate = useMemo(() => {
    if (!previewItemName) return null;
    const recommendationCandidate = recommendations.find((candidate) => candidate.itemName === previewItemName);
    if (recommendationCandidate) return recommendationCandidate;

    const gearCandidate = gearCandidates.find((candidate) => candidate.itemName === previewItemName);
    if (gearCandidate) {
      const explanation = explainItemScore(gearCandidate.details, selectedClass);
      return {
        ...gearCandidate,
        hasFocus: itemHasFocusEffect(gearCandidate.details),
        matchesFocusFamily: false,
        score: explanation.score,
        contributionSummary: formatContributionSummary(explanation.contributions),
      };
    }

    const details = itemDetails[previewItemName];
    if (!details) return null;

    const explanation = explainItemScore(details, selectedClass);
    return {
      itemName: previewItemName,
      details,
      expansions: details.expansion ? [details.expansion] : [],
      zones: details.acquisitionType === "quest" && details.sourceNpcName ? [`${details.sourceNpcName} quest`] : [],
      hasFocus: itemHasFocusEffect(details),
      matchesFocusFamily: false,
      score: explanation.score,
      contributionSummary: formatContributionSummary(explanation.contributions),
    };
  }, [previewItemName, recommendations, selectedClass]);

  useEffect(() => {
    setPreviewItemName((current) => {
      if (!current) return current;
      const isRecommended = recommendations.some((candidate) => candidate.itemName === current);
      const isEquipped = Object.values(equippedGear).includes(current);
      return isRecommended || isEquipped || itemDetails[current] ? current : null;
    });
  }, [equippedGear, recommendations]);

  useEffect(() => {
    if (!primaryIsTwoHanded || !equippedGear.secondary) return;
    setEquippedGear((current) => {
      if (!current.secondary) return current;
      const next = { ...current };
      delete next.secondary;
      return next;
    });
    setLoadMessage("Equipped a two-handed weapon. Secondary was cleared.");
    setLoadError(null);
  }, [equippedGear.secondary, primaryIsTwoHanded]);

  function equipItem(itemName: string) {
    const details = itemDetails[itemName];
    const validation = canEquipItem(itemName, equippedGear, selectedGearSlot.id, selectedClass, selectedRace);
    if (!validation.canEquip) {
      hidePreview();
      setPreviewItemName(itemName);
      setLoadMessage(null);
      setLoadError(validation.reason ?? "That item cannot be equipped in the selected slot.");
      return;
    }

    const isEquippingTwoHandedPrimary = selectedGearSlot.id === "primary" && isTwoHandedItem(details);
    const willClearSecondary = isEquippingTwoHandedPrimary && Boolean(equippedGear.secondary);
    hidePreview();
    setPreviewItemName(itemName);
    setEquippedGear((current) => {
      const next = {
        ...current,
        [selectedGearSlot.id]: itemName,
      };
      if (isEquippingTwoHandedPrimary) {
        delete next.secondary;
      }
      return next;
    });
    setLoadError(null);
    setLoadMessage(willClearSecondary ? "Equipped a two-handed weapon. Secondary was cleared." : null);
  }

  function currentHasContent() {
    return characterName.trim().length > 0 || Boolean(selectedRace) || Object.keys(equippedGear).length > 0;
  }

  function buildFromCurrent(id: string, existing?: GearBuild): GearBuild {
    const now = new Date().toISOString();
    const classCode = selectedClass;
    return {
      id,
      name: characterName.trim() || `${classCode} Character`,
      class: classCode,
      race: selectedRace || undefined,
      server,
      equippedItems: gearRecordToEquippedItems(equippedGear),
      plannerItems: existing?.plannerItems ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  function saveActiveToRoster(rosterSnapshot: GearBuild[]) {
    if (!activeCharacterId) return rosterSnapshot;
    const existing = rosterSnapshot.find((character) => character.id === activeCharacterId);
    return upsertBuild(rosterSnapshot, buildFromCurrent(activeCharacterId, existing));
  }

  function persistRosterAutosave(characters: GearBuild[], nextActiveCharacterId?: string | null) {
    if (characters.length === 0) {
      window.localStorage.removeItem(rosterAutosaveKey);
      lastAutosavePayloadRef.current = null;
      setAutosaveStatus(null);
      return;
    }

    const updatedAt = new Date().toISOString();
    const snapshot: GearRoster = {
      version: 1,
      rosterName: "Loot Goblin Roster",
      characters,
      activeCharacterId: nextActiveCharacterId ?? characters[0]?.id,
      updatedAt,
    };
    const payload = JSON.stringify(snapshot);
    window.localStorage.setItem(rosterAutosaveKey, payload);
    lastAutosavePayloadRef.current = payload;
    const savedTime = formatAutosaveTime(updatedAt);
    setAutosaveStatus(savedTime ? `Last autosaved: ${savedTime}` : "Autosaved locally");
  }

  function buildAutosaveRosterSnapshot(): GearRoster | null {
    let nextRoster = saveActiveToRoster(roster);
    let nextActiveId = activeCharacterId ?? undefined;

    if (!activeCharacterId && currentHasContent()) {
      const id = draftBuildIdRef.current ?? createBuildId();
      draftBuildIdRef.current = id;
      const existing = nextRoster.find((character) => character.id === id);
      const build = buildFromCurrent(id, existing);
      nextRoster = upsertBuild(nextRoster, build);
      nextActiveId = id;
    }

    if (nextRoster.length === 0) return null;

    return {
      version: 1,
      rosterName: "Loot Goblin Roster",
      characters: nextRoster,
      activeCharacterId: nextActiveId,
      updatedAt: new Date().toISOString(),
    };
  }

  useEffect(() => {
    if (!autosaveReady) return;

    const timeout = window.setTimeout(() => {
      try {
        const snapshot = buildAutosaveRosterSnapshot();
        if (!snapshot) {
          window.localStorage.removeItem(rosterAutosaveKey);
          lastAutosavePayloadRef.current = null;
          setAutosaveStatus(null);
          if (isSignedIn && cloudReady && !cloudImportPrompt && lastCloudRosterPayloadRef.current) {
            saveUserSettings({ preferences: { [cloudRosterPreferenceKey]: null } })
              .then(() => {
                lastCloudRosterPayloadRef.current = null;
                setAutosaveStatus("Discord character save cleared");
              })
              .catch(() => {
                setLoadError("Unable to clear Discord character save.");
              });
          }
          return;
        }

        const payload = JSON.stringify(snapshot);
        if (payload === lastAutosavePayloadRef.current) return;

        window.localStorage.setItem(rosterAutosaveKey, payload);
        lastAutosavePayloadRef.current = payload;
        const savedTime = snapshot.updatedAt ? formatAutosaveTime(snapshot.updatedAt) : null;
        setAutosaveStatus(savedTime ? `Last autosaved locally: ${savedTime}` : "Autosaved locally");

        if (isSignedIn && cloudReady && !cloudImportPrompt) {
          if (payload === lastCloudRosterPayloadRef.current) return;
          saveUserSettings({ preferences: { [cloudRosterPreferenceKey]: snapshot } })
            .then(() => {
              lastCloudRosterPayloadRef.current = payload;
              const cloudSavedTime = snapshot.updatedAt ? formatAutosaveTime(snapshot.updatedAt) : null;
              setAutosaveStatus(cloudSavedTime ? `Last saved to Discord: ${cloudSavedTime}` : "Saved to Discord account");
            })
            .catch(() => {
              setLoadError("Unable to save characters to Discord. Local autosave is still available.");
            });
        }
      } catch {
        setLoadError("Unable to write local character autosave.");
      }
    }, 450);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveReady, roster, activeCharacterId, characterName, selectedClass, selectedRace, equippedGear, isSignedIn, cloudReady, cloudImportPrompt]);

  function loadRosterMember(build: GearBuild) {
    hidePreview();
    draftBuildIdRef.current = null;
    setPreviewItemName(null);
    setCharacterName(build.name);
    setSelectedClass(normalizeClassCode(build.class));
    setSelectedRace(normalizeRaceCode(build.race));
    setEquippedGear(equippedItemsToGearRecord(build.equippedItems));
    setActiveCharacterId(build.id);
  }

  function addCurrentToGroup() {
    const id = activeCharacterId ?? draftBuildIdRef.current ?? createBuildId();
    const currentRoster = activeCharacterId ? roster : saveActiveToRoster(roster);
    const existing = currentRoster.find((character) => character.id === id);
    const build = buildFromCurrent(id, existing);
    const nextRoster = upsertBuild(currentRoster, build);
    setRoster(nextRoster);
    hidePreview();
    draftBuildIdRef.current = null;
    setActiveCharacterId(null);
    setCharacterName("");
    setSelectedClass("WAR");
    setSelectedRace("");
    setEquippedGear({});
    setPreviewItemName(null);
    setLoadError(null);
    setLoadMessage(`${build.name} saved to group. New character started.`);
  }

  function selectRosterMember(id: string) {
    const nextRoster = saveActiveToRoster(roster);
    const nextBuild = nextRoster.find((character) => character.id === id);
    if (!nextBuild) return;
    setRoster(nextRoster);
    loadRosterMember(nextBuild);
    setLoadError(null);
    setLoadMessage(`${nextBuild.name} loaded.`);
  }

  function startNewCharacter() {
    setRoster((current) => saveActiveToRoster(current));
    hidePreview();
    draftBuildIdRef.current = null;
    setActiveCharacterId(null);
    setCharacterName("");
    setSelectedClass("WAR");
    setSelectedRace("");
    setEquippedGear({});
    setPreviewItemName(null);
    setLoadError(null);
    setLoadMessage("New character started.");
  }

  function clearCurrentBuildState() {
    hidePreview();
    draftBuildIdRef.current = null;
    setActiveCharacterId(null);
    setCharacterName("");
    setSelectedClass("WAR");
    setSelectedRace("");
    setSelectedSlotId("head");
    setEquippedGear({});
    setPreviewItemName(null);
  }

  function requestDeleteCharacter() {
    if (!activeRosterMember) return;
    setConfirmAction("delete-character");
  }

  function requestDeleteGroup() {
    if (roster.length === 0 && !currentHasContent()) return;
    setConfirmAction("delete-group");
  }

  function confirmDeleteCharacter() {
    if (!activeCharacterId) {
      setConfirmAction(null);
      return;
    }

    const deletedIndex = roster.findIndex((character) => character.id === activeCharacterId);
    const nextRoster = roster.filter((character) => character.id !== activeCharacterId);
    setRoster(nextRoster);
    setConfirmAction(null);
    setLoadError(null);

    if (nextRoster.length > 0) {
      const nextBuild = nextRoster[Math.min(Math.max(deletedIndex, 0), nextRoster.length - 1)];
      persistRosterAutosave(nextRoster, nextBuild.id);
      loadRosterMember(nextBuild);
      setLoadMessage(`${activeRosterMember?.name ?? "Character"} deleted. ${nextBuild.name} loaded.`);
      return;
    }

    persistRosterAutosave([], null);
    clearCurrentBuildState();
    setLoadMessage("Character deleted. Your group is empty.");
  }

  function confirmDeleteGroup() {
    persistRosterAutosave([], null);
    setRoster([]);
    clearCurrentBuildState();
    setConfirmAction(null);
    setLoadError(null);
    setLoadMessage("Group deleted.");
  }

  function confirmPendingAction() {
    if (confirmAction === "delete-character") {
      confirmDeleteCharacter();
      return;
    }

    if (confirmAction === "delete-group") {
      confirmDeleteGroup();
    }
  }

  function applyCloudRoster(snapshot: GearRoster, message: string) {
    setRoster(snapshot.characters);
    const activeBuild = snapshot.characters.find((character) => character.id === snapshot.activeCharacterId)
      ?? snapshot.characters[0];
    if (activeBuild) {
      loadRosterMember(activeBuild);
    } else {
      clearCurrentBuildState();
    }
    const payload = persistRosterSnapshotToLocal(snapshot);
    lastAutosavePayloadRef.current = payload;
    lastCloudRosterPayloadRef.current = JSON.stringify(snapshot);
    setCloudImportPrompt(null);
    setLoadError(null);
    setAutosaveStatus(message);
  }

  function importLocalCharactersToCloud() {
    if (!cloudImportPrompt) return;
    const snapshot = cloudImportPrompt.merged;
    applyCloudRoster(snapshot, "Importing local characters...");
    saveUserSettings({ preferences: { [cloudRosterPreferenceKey]: snapshot } })
      .then(() => {
        lastCloudRosterPayloadRef.current = JSON.stringify(snapshot);
        setAutosaveStatus("Local characters imported to Discord account");
      })
      .catch(() => {
        setLoadError("Unable to import local characters to Discord.");
      });
  }

  function dismissCloudImportPrompt() {
    const snapshot = buildAutosaveRosterSnapshot();
    lastCloudRosterPayloadRef.current = snapshot ? JSON.stringify(snapshot) : null;
    setCloudImportPrompt(null);
    setLoadError(null);
    setLoadMessage("Local character import skipped.");
  }

  function unequipSelectedSlot() {
    setEquippedGear((current) => {
      const next = { ...current };
      delete next[selectedGearSlot.id];
      return next;
    });
  }

  function clearRecommendationFilters() {
    hidePreview();
    setPreviewItemName(null);
    setSelectedSpellFocus(anySpellFocus);
    setSelectedBardMod(anyBardMod);
    setSelectedPetFocus(anyPetFocus);
    setRecommendationMaxGearScore("");
    setSelectedWeaponFilter("Any");
    setRecommendationSort("score");
    setFocusOnly(false);
  }

  function openGearShoppingList() {
    setRoster((current) => saveActiveToRoster(current));
    setViewMode("shopping");
    setLoadError(null);
    setLoadMessage(null);
  }

  function togglePlannerCharacter(characterId: string) {
    setPlannerSelectedCharacterIds((current) => {
      const next = new Set(current);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.add(characterId);
      }
      return next;
    });
  }

  function selectAllPlannerCharacters() {
    setPlannerSelectedCharacterIds(new Set(plannerRoster.map((character) => character.id)));
  }

  function togglePlannerExpansion(expansion: string) {
    setPlannerSelectedExpansions((current) => {
      const next = new Set(current);
      if (next.has(expansion)) {
        next.delete(expansion);
      } else {
        next.add(expansion);
      }
      if (next.size === 0) return current;
      return new Set(plannerExpansionOptions.filter((option) => next.has(option)));
    });
  }

  function selectAllPlannerExpansions() {
    setPlannerSelectedExpansions(new Set(plannerExpansionOptions));
  }

  function clearPlannerFilters() {
    selectAllPlannerCharacters();
    selectAllPlannerExpansions();
    setPlannerItemQuery("");
    setPlannerSourceQuery("");
    setHideObtainedGear(false);
    setHideEndgameGear(false);
    setMaxGearScore("");
  }

  function savePlannerState(message = "Planner saved locally") {
    const savedAt = new Date().toISOString();
    const snapshot = buildAutosaveRosterSnapshot();
    if (snapshot) {
      const payload = JSON.stringify(snapshot);
      window.localStorage.setItem(rosterAutosaveKey, payload);
      lastAutosavePayloadRef.current = payload;
      const savedTime = formatAutosaveTime(savedAt);
      setAutosaveStatus(savedTime ? `Last autosaved locally: ${savedTime}` : "Autosaved locally");
    }

    window.localStorage.setItem(
      gearShoppingObtainedStorageKey,
      JSON.stringify(Array.from(gearShoppingObtainedNeedKeys).sort()),
    );
    window.localStorage.setItem(gearShoppingHideObtainedStorageKey, hideObtainedGear ? "1" : "0");
    window.localStorage.setItem(gearPlannerStateStorageKey, JSON.stringify({
      version: 1,
      obtainedNeedKeys: Array.from(gearShoppingObtainedNeedKeys).sort(),
      hideObtainedGear,
      selectedCharacterIds: Array.from(plannerSelectedCharacterIds).sort(),
      savedAt,
    }));

    const savedTime = formatAutosaveTime(savedAt);
    setPlannerSaveStatus(savedTime ? `${message}: ${savedTime}` : message);
  }

  function openAddPlannerItem(characterId?: string, placement = "utility", utilitySlot: number | null = null) {
    setAddPlannerItemCharacterId(characterId ?? plannerSelectedCharacters[0]?.id ?? plannerRoster[0]?.id ?? "");
    setAddPlannerItemPlacement(placement);
    setAddPlannerUtilitySlot(utilitySlot);
    setAddPlannerItemMessage(null);
    setAddPlannerItemOpen(true);
  }

  function stageManualPlannerItem(itemName: string) {
    setSelectedAddPlannerItemName(itemName);
    setAddPlannerItemQuery(itemName);
    setAddPlannerItemMessage(null);
  }

  function addSelectedManualPlannerItem() {
    const itemName = selectedAddPlannerItemName;
    const characterId = addPlannerItemCharacterId || plannerRoster[0]?.id;
    if (!itemName || !itemDetails[itemName]) {
      setAddPlannerItemMessage("Select an item before adding it.");
      return;
    }
    if (!characterId) {
      setAddPlannerItemMessage("Choose a character before adding the item.");
      return;
    }
    const now = new Date().toISOString();

    setRoster((current) => current.map((character) => {
      if (character.id !== characterId) return character;
      const existingPlannerItems = character.plannerItems ?? [];
      const utilityCapacity = getUtilityBagCapacity(existingPlannerItems);
      const usedUtilitySlots = new Set(
        existingPlannerItems
          .map((item) => item.utilityBagSlot)
          .filter((slot): slot is number => typeof slot === "number"),
      );
      const nextUtilitySlot = addPlannerUtilitySlot !== null && !usedUtilitySlots.has(addPlannerUtilitySlot)
        ? addPlannerUtilitySlot
        : Array.from({ length: utilityCapacity }, (_, index) => index)
          .find((index) => !usedUtilitySlots.has(index)) ?? utilityCapacity;
      const isUtility = addPlannerItemPlacement === "utility";
      const slotId = addPlannerItemPlacement.startsWith("slot:")
        ? addPlannerItemPlacement.replace("slot:", "")
        : null;
      const plannerItem: GearPlannerManualItem = {
        id: createBuildId(),
        itemName,
        slotId: slotId && normalizeGearSlotId(slotId) ? slotId : null,
        notes: addPlannerItemNotes.trim() || undefined,
        utilityBagSlot: isUtility ? nextUtilitySlot ?? null : null,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...character,
        plannerItems: [...existingPlannerItems, plannerItem],
        updatedAt: now,
      };
    }));

    setAddPlannerItemQuery("");
    setSelectedAddPlannerItemName("");
    setAddPlannerItemNotes("");
    setAddPlannerUtilitySlot(null);
    setAddPlannerItemMessage(`${itemName} added.`);
    setLoadError(null);
    setLoadMessage(`${itemName} added to the Gear Planner.`);
  }

  function toggleUtilityBag(characterId: string) {
    setExpandedUtilityBags((current) => {
      const next = new Set(current);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.add(characterId);
      }
      return next;
    });
  }

  function removeManualPlannerItem(characterId: string, itemId: string) {
    setRoster((current) => current.map((character) => {
      if (character.id !== characterId) return character;
      return {
        ...character,
        plannerItems: (character.plannerItems ?? []).filter((item) => item.id !== itemId),
        updatedAt: new Date().toISOString(),
      };
    }));
    setSelectedUtilityItem(null);
  }

  function toggleSourceDetails(itemName: string) {
    setExpandedSourceItems((current) => {
      const next = new Set(current);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  }

  function toggleGearShoppingNeedObtained(itemName: string, need: GearShoppingNeed) {
    const key = gearShoppingNeedKey(itemName, need);
    setGearShoppingObtainedNeedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function markVisibleGearObtained() {
    setGearShoppingObtainedNeedKeys((current) => {
      const next = new Set(current);
      for (const item of filteredGearShoppingItems) {
        for (const need of item.remainingNeeds) {
          next.add(gearShoppingNeedKey(item.itemName, need));
        }
      }
      return next;
    });
  }

  function resetVisibleGearObtained() {
    setGearShoppingObtainedNeedKeys((current) => {
      const next = new Set(current);
      for (const item of filteredGearShoppingItems) {
        for (const need of item.needs) {
          next.delete(gearShoppingNeedKey(item.itemName, need));
        }
      }
      return next;
    });
  }

  function requestEquipBis() {
    if (!selectedClass) {
      setLoadMessage(null);
      setLoadError("Choose a class before equipping BIS.");
      return;
    }
    setShowBisConfirm(true);
  }

  function confirmEquipBis() {
    const candidatesBySlot = Object.fromEntries(
      gearSlots.map((slot) => [slot.id, getBisCandidatesForSlot(slot, selectedClass, selectedRace)]),
    );
    const nextGear = sanitizeEquippedGear(findBestBisCombination(gearSlots, candidatesBySlot));

    hidePreview();
    setPreviewItemName(null);
    setEquippedGear(nextGear);
    setShowBisConfirm(false);
    setLoadError(null);
    setLoadMessage("Best-in-slot gear equipped.");
  }

  function clearLocalAutosave() {
    if (!window.confirm("Clear the local autosaved roster from this browser? Your currently open planner will stay on screen.")) {
      return;
    }

    const snapshot = buildAutosaveRosterSnapshot();
    window.localStorage.removeItem(rosterAutosaveKey);
    lastAutosavePayloadRef.current = snapshot ? JSON.stringify(snapshot) : null;
    setAutosaveStatus(null);
    setLoadError(null);
    setLoadMessage("Local autosave cleared.");
  }

  function saveGroup() {
    let nextRoster = saveActiveToRoster(roster);
    let nextActiveId = activeCharacterId ?? undefined;

    if (!activeCharacterId && currentHasContent()) {
      const id = draftBuildIdRef.current ?? createBuildId();
      draftBuildIdRef.current = id;
      const build = buildFromCurrent(id);
      nextRoster = upsertBuild(nextRoster, build);
      nextActiveId = id;
      setActiveCharacterId(id);
    }

    const rosterFile: GearRoster = {
      version: 1,
      rosterName: "Loot Goblin Roster",
      characters: nextRoster,
      activeCharacterId: nextActiveId,
    };
    const blob = new Blob([JSON.stringify(rosterFile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "loot-goblin-roster.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setRoster(nextRoster);
    setLoadError(null);
    setLoadMessage("Group saved.");
  }

  async function loadGroup(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = validateRoster(JSON.parse(await file.text()));
      setRoster(parsed.characters);
      const activeBuild = parsed.characters.find((character) => character.id === parsed.activeCharacterId)
        ?? parsed.characters[0];
      if (activeBuild) {
        loadRosterMember(activeBuild);
      } else {
        setActiveCharacterId(null);
        setCharacterName("");
        setSelectedClass("WAR");
        setSelectedRace("");
        setEquippedGear({});
        setPreviewItemName(null);
      }
      setLoadError(null);
      setLoadMessage(parsed.characters.length === 1 ? "Group loaded. 1 character available." : `Group loaded. ${parsed.characters.length} characters available.`);
    } catch (error) {
      setLoadMessage(null);
      setLoadError(error instanceof Error ? error.message : "Unable to load that roster file.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <section className="character-gear-planner" aria-label="Character gear slot recommendations">
      <div className="character-gear-controls">
        <div>
          <p className="eyebrow">Gear Planner</p>
          <h2>{viewMode === "shopping" ? "Gear Shopping List" : "Equipment Slots"}</h2>
        </div>

        {viewMode === "shopping" ? (
          <div className="character-build-actions">
            <button className="character-action-button is-secondary" onClick={() => setViewMode("roster")} type="button">
              Back to Characters
            </button>
            <button className="character-action-button" onClick={() => fileInputRef.current?.click()} type="button">
              Load My Characters JSON
            </button>
          </div>
        ) : (
        <div className="character-build-controls">
          <label className="character-name-filter">
            <span>Character Name</span>
            <input
              onChange={(event) => setCharacterName(event.target.value)}
              placeholder="Name"
              type="text"
              value={characterName}
            />
          </label>
          <label className="class-filter character-class-filter">
            <span>Class</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value as ClassCode)}>
              {classCodes.map((classCode) => (
                <option key={classCode} value={classCode}>
                  {classCode}
                </option>
              ))}
            </select>
          </label>
          <label className="class-filter character-race-filter">
            <span>Race</span>
            <select value={selectedRace} onChange={(event) => setSelectedRace(normalizeRaceCode(event.target.value))}>
              <option value="">Any</option>
              {raceCodes.map((raceCode) => (
                <option key={raceCode} value={raceCode}>
                  {raceCode}
                </option>
              ))}
            </select>
          </label>
          <div className="character-slot-filter-stack">
            <label className="slot-filter character-slot-filter">
              <span>Weapon Type</span>
              <select value={selectedWeaponFilter} onChange={(event) => setSelectedWeaponFilter(event.target.value as WeaponFilter)}>
                {weaponFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="slot-filter character-slot-filter">
              <span>Slot</span>
              <select value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.target.value)}>
                {gearSlotSelectOptions.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="class-filter character-focus-family-filter">
            <span>Spell Focus</span>
            <select value={selectedSpellFocus} onChange={(event) => setSelectedSpellFocus(event.target.value)}>
              {focusFamilyOptions.spell.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="class-filter character-focus-family-filter">
            <span>Bard Mod</span>
            <select value={selectedBardMod} onChange={(event) => setSelectedBardMod(event.target.value)}>
              {focusFamilyOptions.bard.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="character-name-filter character-score-filter">
            <span>Max Gear Score</span>
            <input
              min={0}
              onChange={(event) => setRecommendationMaxGearScore(event.target.value)}
              placeholder="No cap"
              step={1}
              type="number"
              value={recommendationMaxGearScore}
            />
          </label>
          <label className="class-filter character-recommendation-sort-filter">
            <span>Sort</span>
            <select value={recommendationSort} onChange={(event) => setRecommendationSort(event.target.value as RecommendationSort)}>
              <option value="score">Score High to Low</option>
              <option value="ratio">Ratio High to Low</option>
            </select>
          </label>
          <button
            className="character-action-button character-clear-filters-button"
            onClick={clearRecommendationFilters}
            type="button"
          >
            Remove All Filters
          </button>
          <label className="class-filter character-focus-family-filter">
            <span>Pet Focus</span>
            <select value={selectedPetFocus} onChange={(event) => setSelectedPetFocus(event.target.value)}>
              {focusFamilyOptions.pet.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="focus-filter-toggle character-focus-filter">
            <input
              checked={focusOnly}
              onChange={(event) => setFocusOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Only show focus items</span>
          </label>
          <div className="character-build-actions">
            <button className="character-action-button is-secondary" onClick={startNewCharacter} type="button">New Character</button>
            <button className="character-action-button" onClick={addCurrentToGroup} type="button">Add to Group</button>
            <button className="character-action-button" onClick={saveGroup} type="button">Save Group</button>
            <button className="character-action-button" onClick={() => fileInputRef.current?.click()} type="button">Load Group</button>
            <button className="character-action-button is-danger" disabled={!activeRosterMember} onClick={requestDeleteCharacter} type="button">Delete Character</button>
            <button className="character-action-button is-danger" disabled={roster.length === 0 && !currentHasContent()} onClick={requestDeleteGroup} type="button">Delete Group</button>
            <button className="character-action-button is-bis" onClick={requestEquipBis} type="button">Equip BIS</button>
            <button className="character-action-button is-progression" onClick={openGearShoppingList} type="button">
              Gear Shopping List <span aria-hidden="true">-&gt;</span>
            </button>
          </div>
        </div>
        )}
        <input
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(event) => void loadGroup(event.target.files?.[0])}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {loadMessage ? <p className="gear-load-feedback">{loadMessage}</p> : null}
      {loadError ? <p className="gear-load-feedback is-error">{loadError}</p> : null}
      {isSignedIn && !cloudReady ? (
        <p className="gear-load-feedback">Loading Discord character save...</p>
      ) : null}
      {cloudImportPrompt ? (
        <div className="user-sync-banner" role="status">
          <span>
            Import {cloudImportPrompt.localCount} local {cloudImportPrompt.localCount === 1 ? "character" : "characters"} into this Discord account?
          </span>
          <button onClick={importLocalCharactersToCloud} type="button">Import</button>
          <button onClick={dismissCloudImportPrompt} type="button">Skip</button>
        </div>
      ) : null}
      {viewMode === "shopping" ? (
        <section className="gear-shopping-view" aria-label="Gear shopping list">
          <div className="spell-shopping-summary gear-shopping-summary">
            <strong>Showing {filteredGearShoppingItems.length} of {gearShoppingItems.length} items</strong>
            <span>{plannerSelectedCharacters.length} selected characters</span>
            <span>{gearShoppingProgress.total} total copies</span>
            <span>{gearShoppingProgress.obtained} obtained</span>
            <span>{gearShoppingProgress.remaining} remaining</span>
            <span>{plannerSaveStatus ?? "Planner autosaves locally"}</span>
          </div>

          <section className="toolbar gear-shopping-toolbar" aria-label="Gear shopping filters">
            <div className="gear-shopping-character-filter" aria-label="Character filters">
              <span>Characters</span>
              <div className="expansion-toggle-group">
                <button
                  aria-pressed={plannerSelectedCharacterIds.size === plannerRoster.length && plannerRoster.length > 0}
                  className={plannerSelectedCharacterIds.size === plannerRoster.length && plannerRoster.length > 0 ? "filter-button is-active" : "filter-button"}
                  disabled={plannerRoster.length === 0}
                  onClick={selectAllPlannerCharacters}
                  type="button"
                >
                  All
                </button>
                {plannerRoster.map((character) => {
                  const active = plannerSelectedCharacterIds.has(character.id);
                  return (
                    <button
                      aria-pressed={active}
                      className={active ? "filter-button is-active" : "filter-button"}
                      key={character.id}
                      onClick={() => togglePlannerCharacter(character.id)}
                      type="button"
                    >
                      {character.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="expansion-filter" aria-label="Expansion filters">
              <span>Expansion</span>
              <div className="expansion-toggle-group">
                <button
                  aria-pressed={allPlannerExpansionsSelected}
                  className={allPlannerExpansionsSelected ? "filter-button is-active" : "filter-button"}
                  onClick={selectAllPlannerExpansions}
                  type="button"
                >
                  All
                </button>
                {plannerExpansionOptions.map((expansion) => {
                  const active = plannerSelectedExpansionSet.has(expansion);
                  return (
                    <button
                      aria-pressed={active}
                      className={[
                        "filter-button",
                        "expansion-filter-button",
                        expansionTone(expansion),
                        active ? "is-active" : null,
                      ].filter(Boolean).join(" ")}
                      key={expansion}
                      onClick={() => togglePlannerExpansion(expansion)}
                      type="button"
                    >
                      {expansion}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="character-name-filter gear-shopping-search">
              <span>Item Search</span>
              <input
                onChange={(event) => setPlannerItemQuery(event.target.value)}
                placeholder="Search item name"
                type="search"
                value={plannerItemQuery}
              />
            </label>

            <label className="character-name-filter gear-shopping-search">
              <span>Zone / Source</span>
              <input
                onChange={(event) => setPlannerSourceQuery(event.target.value)}
                placeholder="Search zone, NPC, bucket"
                type="search"
                value={plannerSourceQuery}
              />
            </label>

            <label className="gear-shopping-toggle">
              <input
                checked={hideObtainedGear}
                onChange={(event) => setHideObtainedGear(event.target.checked)}
                type="checkbox"
              />
              <span>Hide Obtained Gear</span>
            </label>

            <label className="gear-shopping-toggle gear-shopping-special-toggle">
              <input
                checked={hideEndgameGear}
                onChange={(event) => setHideEndgameGear(event.target.checked)}
                type="checkbox"
              />
              <span>
                Hide endgame / special acquisition items
                <small>Hide raid, epic, and Velious quest armor targets while focusing on leveling upgrades.</small>
              </span>
            </label>

            <label className="character-name-filter gear-shopping-search gear-shopping-score-filter">
              <span>Max gear score</span>
              <input
                min={0}
                onChange={(event) => setMaxGearScore(event.target.value)}
                placeholder="No cap"
                step={1}
                type="number"
                value={maxGearScore}
              />
            </label>

            <button className="character-action-button is-progression gear-shopping-clear" onClick={() => openAddPlannerItem()} type="button">
              Add Item
            </button>

            <button className="character-action-button is-save gear-shopping-clear" onClick={() => savePlannerState("Saved")} type="button">
              Save Planner
            </button>

            <button
              className="character-action-button is-complete gear-shopping-clear"
              disabled={filteredGearShoppingItems.every((item) => item.remainingNeeds.length === 0)}
              onClick={markVisibleGearObtained}
              type="button"
            >
              Mark all obtained
            </button>

            <button
              className="character-action-button is-danger gear-shopping-clear"
              disabled={filteredGearShoppingItems.every((item) => item.obtainedCount === 0)}
              onClick={resetVisibleGearObtained}
              type="button"
            >
              Reset Obtained Status
            </button>

            <button className="character-action-button is-secondary gear-shopping-clear" onClick={clearPlannerFilters} type="button">
              Clear Filters
            </button>
          </section>

          {addPlannerItemOpen ? (
            <section className="gear-planner-add-item" aria-label="Add item to Gear Planner">
              <div className="gear-planner-add-controls">
                <label className="character-name-filter gear-shopping-search">
                  <span>Search Any Item</span>
                  <input
                    autoFocus
                    onChange={(event) => {
                      setAddPlannerItemQuery(event.target.value);
                      setSelectedAddPlannerItemName("");
                      setAddPlannerItemMessage(null);
                    }}
                    placeholder="Search item name"
                    type="search"
                    value={addPlannerItemQuery}
                  />
                </label>
                <label className="class-filter character-class-filter">
                  <span>Character</span>
                  <select value={addPlannerItemCharacterId} onChange={(event) => setAddPlannerItemCharacterId(event.target.value)}>
                    {plannerRoster.map((character) => (
                      <option key={character.id} value={character.id}>{character.name}</option>
                    ))}
                  </select>
                </label>
                <label className="class-filter character-class-filter">
                  <span>Attach To</span>
                  <select value={addPlannerItemPlacement} onChange={(event) => setAddPlannerItemPlacement(event.target.value)}>
                    <option value="utility">Utility Bag</option>
                    <option value="custom">Custom Goal</option>
                    {gearSlotSelectOptions.map((slot) => (
                      <option key={slot.id} value={`slot:${slot.id}`}>{slot.label}</option>
                    ))}
                  </select>
                </label>
                <label className="character-name-filter gear-shopping-search">
                  <span>Notes</span>
                  <input
                    maxLength={plannerNoteMaxLength}
                    onChange={(event) => setAddPlannerItemNotes(event.target.value)}
                    placeholder="Optional farming note"
                    type="text"
                    value={addPlannerItemNotes}
                  />
                  <small className="planner-note-counter">{addPlannerItemNotes.length} / {plannerNoteMaxLength}</small>
                </label>
                <button className="character-action-button is-secondary gear-shopping-clear" onClick={() => setAddPlannerItemOpen(false)} type="button">
                  Close
                </button>
                <button
                  className="character-action-button is-progression gear-shopping-clear"
                  disabled={!selectedAddPlannerItemName}
                  onClick={addSelectedManualPlannerItem}
                  type="button"
                >
                  Add
                </button>
              </div>
              {selectedAddPlannerItemName ? (
                <div className="gear-planner-selected-item">
                  <ItemIcon details={itemDetails[selectedAddPlannerItemName]} />
                  <span>
                    <strong>{selectedAddPlannerItemName}</strong>
                    <em>Ready to add. Choose character, attach target, and notes before confirming.</em>
                  </span>
                </div>
              ) : null}
              {addPlannerItemMessage ? <p className="gear-planner-add-hint">{addPlannerItemMessage}</p> : null}
              {addPlannerItemQuery.trim().length < 2 ? (
                <p className="gear-planner-add-hint">Type at least 2 characters to search the full item database.</p>
              ) : addPlannerItemMatches.length === 0 ? (
                <p className="gear-planner-add-hint">No items matched that search.</p>
              ) : (
                <div className="gear-planner-search-results">
                  {addPlannerItemMatches.map((match) => {
                    const candidate = getCandidateForItem(match.itemName);
                    return (
                      <button
                        aria-pressed={selectedAddPlannerItemName === match.itemName}
                        className={selectedAddPlannerItemName === match.itemName ? "is-selected" : undefined}
                        key={match.itemName}
                        onClick={() => stageManualPlannerItem(match.itemName)}
                        type="button"
                      >
                        <ItemIcon details={match.details} />
                        <span>
                          <strong>{match.itemName}</strong>
                          <em>{[match.details.expansion, candidate?.zones.slice(0, 2).join(", ")].filter(Boolean).join(" / ") || "Source unknown"}</em>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {plannerSelectedCharacters.length > 0 ? (
            <section className="utility-bag-board" aria-label="Character utility bags">
              {plannerSelectedCharacters.map((character) => {
                const utilityItems = (character.plannerItems ?? []).filter((item) => item.utilityBagSlot !== null && item.utilityBagSlot !== undefined);
                const utilityBySlot = new Map(utilityItems.map((item) => [item.utilityBagSlot ?? -1, item]));
                const utilityCapacity = getUtilityBagCapacity(utilityItems);
                const expanded = expandedUtilityBags.has(character.id);
                const selectedItem = selectedUtilityItem?.characterId === character.id
                  ? utilityItems.find((item) => item.id === selectedUtilityItem.itemId)
                  : null;
                const selectedCandidate = selectedItem ? getCandidateForItem(selectedItem.itemName) : null;
                const selectedNeed: GearShoppingNeed | null = selectedItem ? {
                  characterId: character.id,
                  characterName: character.name,
                  class: character.class,
                  slotId: plannerItemNeedSlotId(selectedItem),
                  slotLabel: "Utility Bag",
                  manualItemId: selectedItem.id,
                  category: selectedItem.category,
                  tags: selectedItem.tags,
                  notes: selectedItem.notes,
                  utilityBagSlot: selectedItem.utilityBagSlot,
                } : null;
                const selectedObtained = selectedItem && selectedNeed
                  ? gearShoppingObtainedNeedKeys.has(gearShoppingNeedKey(selectedItem.itemName, selectedNeed))
                  : false;

                return (
                  <section className="utility-bag-card" key={character.id}>
                    <button
                      aria-expanded={expanded}
                      className="utility-bag-header"
                      onClick={() => toggleUtilityBag(character.id)}
                      type="button"
                    >
                      <span>
                        <strong>{character.name}</strong>
                        <em>
                          {utilityItems.length} / {utilityCapacity} utility slots
                          {utilityCapacity > utilityBagBaseSize ? " - expanded" : ""}
                        </em>
                      </span>
                      <b>{expanded ? "Collapse" : "Open Utility Bag"}</b>
                    </button>
                    {expanded ? (
                      <>
                        <div className="utility-bag-grid">
                          {Array.from({ length: utilityCapacity }, (_, slotIndex) => {
                            const plannerItem = utilityBySlot.get(slotIndex);
                            const details = plannerItem ? itemDetails[plannerItem.itemName] : undefined;
                            const need: GearShoppingNeed | null = plannerItem ? {
                              characterId: character.id,
                              characterName: character.name,
                              class: character.class,
                              slotId: plannerItemNeedSlotId(plannerItem),
                              slotLabel: "Utility Bag",
                              manualItemId: plannerItem.id,
                              category: plannerItem.category,
                              tags: plannerItem.tags,
                              notes: plannerItem.notes,
                              utilityBagSlot: plannerItem.utilityBagSlot,
                            } : null;
                            const obtained = plannerItem && need
                              ? gearShoppingObtainedNeedKeys.has(gearShoppingNeedKey(plannerItem.itemName, need))
                              : false;

                            return (
                              <button
                                aria-label={plannerItem ? `${plannerItem.itemName} utility slot` : `Add utility item to slot ${slotIndex + 1}`}
                                className={[
                                  "utility-bag-slot",
                                  plannerItem ? "is-filled" : "is-empty",
                                  obtained ? "is-obtained" : null,
                                ].filter(Boolean).join(" ")}
                                key={slotIndex}
                                onClick={() => {
                                  if (plannerItem) {
                                    setSelectedUtilityItem({ characterId: character.id, itemId: plannerItem.id });
                                  } else {
                                    openAddPlannerItem(character.id, "utility", slotIndex);
                                  }
                                }}
                                type="button"
                              >
                                {plannerItem ? <ItemIcon details={details} /> : null}
                                {obtained ? <span className="utility-bag-check">Done</span> : null}
                              </button>
                            );
                          })}
                        </div>
                        {selectedItem && selectedCandidate && selectedNeed ? (
                          <div className="utility-bag-detail">
                            <div>
                              <strong>{selectedItem.itemName}</strong>
                              <span>{selectedCandidate.expansions.join(", ") || "Expansion unknown"}</span>
                              {selectedCandidate.sources.slice(0, 3).map((source, index) => (
                                <em key={`${selectedItem.id}-${source.sourceName}-${index}`}>{formatSourceSummary(source)}</em>
                              ))}
                              {selectedItem.notes ? <p>{selectedItem.notes}</p> : null}
                            </div>
                            <div className="utility-bag-detail-actions">
                              <button
                                className={selectedObtained ? "character-action-button is-complete" : "character-action-button is-progression"}
                                onClick={() => toggleGearShoppingNeedObtained(selectedItem.itemName, selectedNeed)}
                                type="button"
                              >
                                {selectedObtained ? "Obtained" : "Mark obtained"}
                              </button>
                              <button className="character-action-button is-secondary" onClick={() => removeManualPlannerItem(character.id, selectedItem.id)} type="button">
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </section>
                );
              })}
            </section>
          ) : null}

          {plannerRoster.length === 0 ? (
            <p className="empty">No characters created yet. Go back to Characters and add a character to start a gear plan.</p>
          ) : plannerAssignedGearCount === 0 ? (
            <p className="empty">No gear assigned yet. Equip desired items on your characters, then return to the shopping list.</p>
          ) : plannerSelectedCharacters.length === 0 ? (
            <p className="empty">Select at least one character to build a gear list.</p>
          ) : filteredGearShoppingItems.length === 0 ? (
            <p className="empty">
              {plannerActiveFilters.length > 0 ? "No needed items match the active filters. Try clearing filters if raid, epic, Velious quest armor, or high-score targets may be hidden." : "No needed gear found for the selected characters."}
            </p>
          ) : (
            <div className="gear-shopping-list">
              {filteredGearShoppingItems.map((item) => {
                const fullSources = getFullGearSources(item.itemName, item.sources);
                return (
                <article
                  className={item.remainingNeeds.length === 0 ? "gear-shopping-card is-obtained" : "gear-shopping-card"}
                  key={item.itemName}
                >
                  <div className="gear-shopping-card-main">
                    <ItemIcon details={item.details} />
                    <div>
                      <h3>{item.itemName}</h3>
                      <div className="gear-shopping-meta">
                        {item.expansions.map((expansion) => (
                          <span className={`expansion-pill is-compact ${expansionTone(expansion)}`} key={expansion}>
                            {expansion}
                          </span>
                        ))}
                        <span>{item.itemType}</span>
                        {item.gearScore > 0 ? <span>Score {Math.round(item.gearScore)}</span> : null}
                        <span>{item.obtainedCount} / {item.totalCount} obtained</span>
                        <span>{item.remainingNeeds.length} remaining</span>
                      </div>
                    </div>
                  </div>

                  <div className="gear-shopping-needs" aria-label={`${item.itemName} needed by`}>
                    {item.remainingNeeds.length > 0 ? (
                      <div className="gear-shopping-need-group">
                        <span className="gear-shopping-need-heading">Still needed by</span>
                        <div>
                          {item.remainingNeeds.map((need) => (
                            <label className="gear-shopping-need-chip" key={`${need.characterId}-${need.slotId}`}>
                              <input
                                checked={false}
                                onChange={() => toggleGearShoppingNeedObtained(item.itemName, need)}
                                type="checkbox"
                              />
                              <span>
                                <strong>{need.characterName}</strong>
                                <em>{need.slotLabel} / {need.class}</em>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {!hideObtainedGear && item.completedNeeds.length > 0 ? (
                      <div className="gear-shopping-need-group is-completed">
                        <span className="gear-shopping-need-heading">Completed for</span>
                        <div>
                          {item.completedNeeds.map((need) => (
                            <label className="gear-shopping-need-chip is-obtained" key={`${need.characterId}-${need.slotId}`}>
                              <input
                                checked
                                onChange={() => toggleGearShoppingNeedObtained(item.itemName, need)}
                                type="checkbox"
                              />
                              <span>
                                <strong>{need.characterName}</strong>
                                <em>{need.slotLabel} / {need.class}</em>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="gear-shopping-sources">
                    <h4>Sources</h4>
                    {fullSources.length > 0 ? (
                      <>
                        <ul>
                          {fullSources.slice(0, 4).map((source, index) => (
                            <li key={`${item.itemName}-${source.sourceName}-${index}`}>
                              <strong>{source.expansion}</strong>
                              <span>{formatSourceSummary(source)}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          aria-expanded={expandedSourceItems.has(item.itemName)}
                          className="gear-source-expand-button"
                          onClick={() => toggleSourceDetails(item.itemName)}
                          type="button"
                        >
                          {expandedSourceItems.has(item.itemName) ? "Collapse Sources" : `Show Full Sources (${fullSources.length})`}
                        </button>
                        {expandedSourceItems.has(item.itemName) ? (
                          <div className="gear-source-detail-list">
                            {fullSources.map((source, index) => {
                              const groupedMobs = groupSourceMobsByZone(source);
                              const raidMobs = source.sourceType === "raid" ? sortRaidSourceMobs(source) : [];
                              const isRaidBucketSource = source.sourceType === "raid" && raidMobs.length > 0;
                              const overlapItems = Array.from(sourcePlannerOverlapItems.get(sourceIdentity(source)) ?? [])
                                .filter((overlapItemName) => overlapItemName !== item.itemName)
                                .sort((a, b) => a.localeCompare(b));
                              return (
                                <section className="gear-source-detail" key={`${item.itemName}-${source.sourceName}-detail-${index}`}>
                                  <div className="gear-source-detail-heading">
                                    <strong>{isRaidBucketSource ? `${source.tierName ?? source.sourceName} / ${source.expansion}` : source.sourceName}</strong>
                                    {isRaidBucketSource ? null : <span>{sourceTypeLabel(source)} / {source.expansion}</span>}
                                  </div>
                                  {isRaidBucketSource ? (
                                    <>
                                      <ul className="gear-source-raid-targets">
                                        {raidMobs.map((mob) => (
                                          <li key={`${source.sourceName}-${mob.name}`}>
                                            {mob.name}
                                          </li>
                                        ))}
                                      </ul>
                                      {overlapItems.length > 0 ? (
                                        <p className="gear-source-overlap-summary">
                                          Also sources {overlapItems.length} other planner {overlapItems.length === 1 ? "item" : "items"}: {overlapItems.join(", ")}.
                                        </p>
                                      ) : null}
                                    </>
                                  ) : (
                                  <dl>
                                    <div>
                                      <dt>Zones</dt>
                                      <dd>{formatSourceDetailList(source.zones, "Unknown")}</dd>
                                    </div>
                                    {source.bucket ? (
                                      <div>
                                        <dt>Bucket</dt>
                                        <dd>Bucket {source.bucket}{source.levelRange ? ` / Levels ${source.levelRange}` : ""}</dd>
                                      </div>
                                    ) : null}
                                    {source.tierName || source.bossLevel ? (
                                      <div>
                                        <dt>Raid Context</dt>
                                        <dd>{[source.tierName, source.bossLevel ? `Level ${source.bossLevel}` : null].filter(Boolean).join(" / ")}</dd>
                                      </div>
                                    ) : null}
                                    {groupedMobs.length > 0 ? (
                                      <div>
                                        <dt>Farm Targets</dt>
                                        <dd>
                                          <div className="gear-source-zone-groups">
                                            {groupedMobs.map((zoneGroup) => (
                                              <section className="gear-source-zone-group" key={`${source.sourceName}-${zoneGroup.zoneName}`}>
                                                <strong>{zoneGroup.zoneName}</strong>
                                                <ul>
                                                  {zoneGroup.mobs.map((mob) => {
                                                    const levelLabel = formatMobLevel(mob.level);
                                                    return (
                                                      <li key={`${source.sourceName}-${zoneGroup.zoneName}-${mob.name}`}>
                                                        {mob.name}{levelLabel ? ` (${levelLabel})` : ""}
                                                      </li>
                                                    );
                                                  })}
                                                </ul>
                                              </section>
                                            ))}
                                          </div>
                                        </dd>
                                      </div>
                                    ) : source.npcNames?.length ? (
                                      <div>
                                        <dt>NPCs</dt>
                                        <dd>{formatSourceDetailList(source.npcNames, "Unknown")}</dd>
                                      </div>
                                    ) : null}
                                    {source.mobCount || source.lootCount ? (
                                      <div>
                                        <dt>Source Size</dt>
                                        <dd>{[
                                          source.mobCount ? `${source.mobCount} ${source.mobCount === 1 ? "NPC" : "NPCs"}` : null,
                                          source.lootCount ? `${source.lootCount} loot ${source.lootCount === 1 ? "item" : "items"}` : null,
                                        ].filter(Boolean).join(" / ")}</dd>
                                      </div>
                                    ) : null}
                                    {overlapItems.length > 0 ? (
                                      <div>
                                        <dt>Overlap</dt>
                                        <dd>Also sources {overlapItems.length} other planner {overlapItems.length === 1 ? "item" : "items"}: {overlapItems.join(", ")}.</dd>
                                      </div>
                                    ) : null}
                                  </dl>
                                  )}
                                </section>
                              );
                            })}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p>No source metadata available.</p>
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
      <>
      <div className="gear-autosave-row">
        <p>{autosaveStatus ?? (isSignedIn ? "Autosaves to Discord after loading" : "Autosaves locally in this browser")}</p>
        <button className="character-action-button is-secondary" onClick={clearLocalAutosave} type="button">
          Clear Local Save
        </button>
      </div>

      <div className="character-roster-layout">
        <aside className="character-roster-panel" aria-label="My group roster">
          <div className="character-roster-heading">
            <div>
              <p className="eyebrow">Roster</p>
              <h3>My Group</h3>
            </div>
            <span>{roster.length}</span>
          </div>
          {activeRosterMember ? (
            <p className="character-roster-active">Editing {activeRosterMember.name}</p>
          ) : (
            <p className="character-roster-active">Draft character</p>
          )}
          {roster.length > 0 ? (
            <ul className="character-roster-list">
              {roster.map((character) => {
                const equippedCount = equippedSlotCountFromItems(character.equippedItems);
                return (
                  <li key={character.id}>
                    <button
                      aria-pressed={character.id === activeCharacterId}
                      className={character.id === activeCharacterId ? "character-roster-entry is-active" : "character-roster-entry"}
                      onClick={() => selectRosterMember(character.id)}
                      type="button"
                    >
                      <span>
                        <strong>{character.name}</strong>
                        <small>{character.race ? `${character.class} / ${character.race}` : character.class}</small>
                      </span>
                      <em>{equippedCount}/{gearSlots.length} slots equipped</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="character-roster-empty">Add a character to start your group.</p>
          )}
        </aside>

        <div className="character-roster-main">
          <section className="gear-focus-summary" aria-label="Gear focus summary">
            <div>
              <p className="eyebrow">Gear Focus Summary</p>
              <h3>Equipped Focus Effects</h3>
            </div>
            {hasEquippedFocusEffects ? (
              <div className="gear-focus-category-list">
                {(["spell", "bard", "pet"] as FocusEffectCategory[]).map((category) => {
                  const effects = equippedFocusSummary[category];
                  if (effects.length === 0) return null;

                  return (
                    <section className="gear-focus-category" key={category}>
                      <h4>{focusCategoryLabels[category]}</h4>
                      <ul className="gear-focus-list">
                        {effects.map((entry) => (
                          <li key={`${category}-${entry.slot}-${entry.effect}`}>
                            <span>{entry.slot}</span>
                            <strong>{entry.effect}</strong>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            ) : (
              <p>No focus effects equipped.</p>
            )}
          </section>

          <div className="character-gear-shell">
            <div className="character-gear-board" aria-label="Equipment slot selector">
          <div className="gear-character-info-panel" aria-hidden="true" />
          <div className="gear-silhouette" aria-hidden="true">
            <span>{characterName.trim() || "Character Preview"}</span>
          </div>
          {gearSlots.map((slot) => {
            const equippedName = equippedGear[slot.id];
            const equippedDetails = equippedName ? itemDetails[equippedName] : undefined;
            const equippedIconUrl = getItemIconUrl(equippedDetails);
            const isSecondaryBlockedSlot = slot.id === "secondary" && primaryIsTwoHanded && !equippedName;
            return (
              <button
                aria-pressed={selectedSlotId === slot.id}
                className={`gear-slot gear-slot-${slot.area}${selectedSlotId === slot.id ? " is-active" : ""}${equippedName ? " has-item" : ""}${isSecondaryBlockedSlot ? " is-disabled" : ""}`}
                key={slot.id}
                onFocus={() => {
                  if (!equippedName) return;
                  hidePreview();
                  setPreviewItemName(equippedName);
                }}
                onMouseEnter={() => {
                  if (!equippedName) return;
                  hidePreview();
                  setPreviewItemName(equippedName);
                }}
                onClick={() => {
                  hidePreview();
                  setSelectedSlotId(slot.id);
                  if (equippedName) {
                    setPreviewItemName(equippedName);
                  }
                }}
                title={isSecondaryBlockedSlot ? "Secondary blocked by two-handed weapon" : equippedName ? `${slot.label}: ${equippedName}` : slot.label}
                type="button"
              >
                {isSecondaryBlockedSlot ? (
                  <>
                    <span className={`gear-slot-placeholder gear-placeholder-${slot.placeholder}`} aria-hidden="true" />
                    <span className="gear-slot-name">Blocked</span>
                  </>
                ) : equippedName ? (
                  <>
                    <span className="gear-slot-equipped-label">{slot.label}</span>
                    {equippedIconUrl ? (
                      <img
                        alt={equippedName}
                        className="gear-slot-equipped-icon"
                        src={equippedIconUrl}
                        title={equippedName}
                      />
                    ) : (
                      <span
                        aria-label={equippedName}
                        className={`gear-slot-placeholder gear-placeholder-${slot.placeholder}`}
                        role="img"
                        title={equippedName}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <span className={`gear-slot-placeholder gear-placeholder-${slot.placeholder}`} aria-hidden="true" />
                    <span className="gear-slot-name">{slot.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <aside className="gear-recommendations" aria-live="polite">
          <div className="gear-recommendations-heading">
            <div>
              <p className="eyebrow">{selectedClass}</p>
              <h3>{selectedLabel} Recommendations</h3>
              {equippedItemName ? <p className="gear-equipped-line">Equipped: {equippedItemName}</p> : null}
            </div>
            <span>{recommendations.length}</span>
          </div>
          {equippedItemName ? (
            <button className="character-action-button is-secondary" onClick={unequipSelectedSlot} type="button">
              Unequip {selectedLabel}
            </button>
          ) : null}

          {secondaryBlockedByTwoHander ? (
            <p className="empty">Secondary is unavailable while using a two-handed weapon.</p>
          ) : recommendations.length > 0 ? (
            <ul className="gear-recommendation-list">
              {recommendations.map((row) => (
                <li key={row.itemName}>
                  <button
                    className={`gear-recommendation-link${equippedItemName === row.itemName ? " is-equipped" : ""}`}
                    onClick={() => equipItem(row.itemName)}
                    onFocus={() => {
                      hidePreview();
                      setPreviewItemName(row.itemName);
                    }}
                    onMouseEnter={() => {
                      hidePreview();
                      setPreviewItemName(row.itemName);
                    }}
                    type="button"
                  >
                    <span className="gear-recommendation-main">
                      <ItemIcon details={row.details} />
                      <span>
                        <strong>{row.itemName}</strong>
                        <small>{row.expansions.join(", ")}{row.zones.length ? ` · ${row.zones.slice(0, 2).join(", ")}` : ""}</small>
                      </span>
                    </span>
                    <span className="gear-recommendation-meta">
                      <b>{Math.round(row.score)}</b>
                      {row.ratio !== null ? <small>Ratio {row.ratio.toFixed(2)}</small> : null}
                      {row.contributionSummary ? <small>{row.contributionSummary}</small> : null}
                      <FavoriteIndicator details={row.details} itemName={row.itemName} />
                      {row.hasFocus ? <span className="gear-focus-badge">Focus</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No recommendations found for {selectedLabel}.</p>
          )}
        </aside>

        <aside className="gear-fixed-preview" aria-live="polite">
          <div className="gear-fixed-preview-heading">
            <p className="eyebrow">Item Preview</p>
            <h3>Details</h3>
          </div>
          {previewCandidate ? (
            <div className="gear-fixed-preview-body">
              <EqItemInspect compact details={previewCandidate.details} itemName={previewCandidate.itemName} />
              <dl className="gear-preview-context">
                {previewCandidate.expansions.length > 0 ? (
                  <div>
                    <dt>Expansion</dt>
                    <dd>{previewCandidate.expansions.join(", ")}</dd>
                  </div>
                ) : null}
                {previewCandidate.zones.length > 0 ? (
                  <div>
                    <dt>Source</dt>
                    <dd>{previewCandidate.zones.slice(0, 4).join(", ")}{previewCandidate.zones.length > 4 ? "..." : ""}</dd>
                  </div>
                ) : null}
                {previewCandidate.details.sources?.length > 0 ? (
                  <div>
                    <dt>Reference</dt>
                    <dd>
                      <a href={previewCandidate.details.sources[0].url} rel="noreferrer" target="_blank">
                        {previewCandidate.details.sources[0].name}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : (
            <p className="gear-preview-empty">Hover an item to preview details.</p>
          )}
        </aside>
          </div>
        </div>
      </div>
      </>
      )}

      {showBisConfirm ? (
        <div className="modal-backdrop" onClick={() => setShowBisConfirm(false)} role="presentation">
          <section className="reset-confirm-modal" aria-labelledby="equip-bis-title" aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog">
            <h2 id="equip-bis-title">Equip BIS?</h2>
            <p>Equip best-in-slot items for this class? This will replace your currently equipped gear.</p>
            <div className="reset-confirm-actions">
              <button onClick={() => setShowBisConfirm(false)} type="button">Cancel</button>
              <button className="is-danger" onClick={confirmEquipBis} type="button">Equip BIS</button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="modal-backdrop" onClick={() => setConfirmAction(null)} role="presentation">
          <section
            className="reset-confirm-modal"
            aria-labelledby="delete-roster-action-title"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <h2 id="delete-roster-action-title">
              {confirmAction === "delete-character" ? "Delete character?" : "Delete group?"}
            </h2>
            <p>
              {confirmAction === "delete-character"
                ? "Delete this character from your group? This cannot be undone."
                : "Delete your entire group? This removes all characters from this browser and cannot be undone."}
            </p>
            <div className="reset-confirm-actions">
              <button onClick={() => setConfirmAction(null)} type="button">Cancel</button>
              <button className="is-danger" onClick={confirmPendingAction} type="button">
                {confirmAction === "delete-character" ? "Delete Character" : "Delete Group"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
