"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@/components/item-drawer.css";
import { EqItemInspect } from "@/components/EqItemInspect";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
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
import { classCanUseShields, formatClassOption, itemMatchesUseFilters } from "@/lib/item-use-filters";
import { parseRawSlot, type SlotKey } from "@/lib/slot-filter";
import type { ItemDetails, ItemDetailsMap, LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";

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
};

type BisCandidate = {
  itemName: string | null;
  details: ItemDetails | null;
  score: number;
};

type SavedBuild = {
  version: number;
  characterName: string;
  class: string;
  equippedGear: Record<string, string>;
};

type GearBuild = {
  id: string;
  name: string;
  class: string;
  equippedItems: Record<string, string | null>;
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
const recommendationLimit = 30;
const bisCandidateLimit = 10;
const rosterAutosaveKey = "loot-goblin-my-characters-roster-v1";
const anySpellFocus = "Any spell focus";
const anyBardMod = "Any bard mod";
const anyPetFocus = "Any pet focus";
const focusCategoryLabels: Record<FocusEffectCategory, string> = {
  spell: "Spell Focus",
  bard: "Bard Mod",
  pet: "Pet Focus",
};

function buildGearCandidates(): GearCandidate[] {
  const sourceMap = new Map<string, { expansions: Set<string>; zones: Set<string> }>();

  function touchItem(itemName: string, expansion: string, zones: string[]) {
    const entry = sourceMap.get(itemName) ?? { expansions: new Set<string>(), zones: new Set<string>() };
    entry.expansions.add(expansion);
    zones.forEach((zone) => entry.zones.add(zone));
    sourceMap.set(itemName, entry);
  }

  for (const dataset of groupDatasets) {
    for (const bucket of dataset.buckets) {
      for (const itemName of bucket.loot_pool) {
        touchItem(itemName, bucket.expansion, bucket.zones);
      }
    }
  }

  for (const dataset of raidDatasets) {
    for (const tier of dataset.tiers) {
      for (const boss of tier.bosses) {
        for (const itemName of boss.loot_pool ?? []) {
          touchItem(itemName, dataset.expansion, [boss.zone]);
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
    );
  }

  for (const [itemName, details] of Object.entries(itemDetails)) {
    if (details.acquisitionType !== "quest") continue;
    if (parseRawSlot(details.slot).size === 0) continue;

    const questSourceLabel = details.sourceNpcName
      ?? details.questName
      ?? (details.questId ? `Quest ${details.questId}` : "Quest item");
    const sourceLabel = questSourceLabel.toLowerCase().includes("quest")
      ? questSourceLabel
      : `${questSourceLabel} quest`;

    touchItem(itemName, details.expansion ?? "Velious", [sourceLabel]);
  }

  return Array.from(sourceMap.entries())
    .map(([itemName, source]) => {
      const details = itemDetails[itemName];
      if (!details) return null;
      return {
        itemName,
        details,
        expansions: Array.from(source.expansions).sort(),
        zones: Array.from(source.zones).sort(),
      };
    })
    .filter((candidate): candidate is GearCandidate => Boolean(candidate));
}

const gearCandidates = buildGearCandidates();

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

function canEquipItem(
  itemName: string,
  equippedGear: Record<string, string>,
  targetSlotId: string,
  classCode: ClassCode,
) {
  const details = itemDetails[itemName];

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

function getBisCandidatesForSlot(slot: GearSlot, classCode: ClassCode): BisCandidate[] {
  const bestByItem = new Map<string, BisCandidate>();

  for (const candidate of gearCandidates) {
    if (!itemMatchesSlot(candidate.details, slot.slotKey)) continue;
    if (!itemMatchesUseFilters(candidate.details, classCode, "Any")) continue;

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
    equippedGear: normalizeEquippedGear(candidate.equippedGear),
  };
}

function savedBuildToGearBuild(build: SavedBuild): GearBuild {
  const now = new Date().toISOString();
  return {
    id: createBuildId(),
    name: build.characterName.trim() || `${build.class} Character`,
    class: build.class,
    equippedItems: gearRecordToEquippedItems(build.equippedGear),
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
  const name = String(candidate.name ?? candidate.characterName ?? "").trim() || `${classCode} Character`;
  const equippedSource = candidate.equippedItems ?? candidate.equippedGear ?? {};
  const equippedGear = normalizeEquippedGear(equippedSource);
  const now = new Date().toISOString();

  return {
    id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : createBuildId(),
    name,
    class: classCode,
    equippedItems: gearRecordToEquippedItems(equippedGear),
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
  const [autosaveStatus, setAutosaveStatus] = useState<string | null>(null);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftBuildIdRef = useRef<string | null>(null);
  const lastAutosavePayloadRef = useRef<string | null>(null);
  const { hidePreview } = useItemPreview();

  const selectedGearSlot = gearSlots.find((slot) => slot.id === selectedSlotId) ?? gearSlots[0];
  const equippedItemName = equippedGear[selectedGearSlot.id];
  const selectedLabel = selectedGearSlot.label;
  const primaryEquippedName = equippedGear.primary;
  const primaryIsTwoHanded = primaryEquippedName ? isTwoHandedItem(itemDetails[primaryEquippedName]) : false;
  const secondaryBlockedByTwoHander = selectedGearSlot.id === "secondary" && primaryIsTwoHanded;
  const activeRosterMember = activeCharacterId
    ? roster.find((character) => character.id === activeCharacterId)
    : null;

  useEffect(() => {
    hidePreview();
  }, [hidePreview]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(rosterAutosaveKey);
      if (!saved) {
        setAutosaveReady(true);
        return;
      }

      const parsed = validateRoster(JSON.parse(saved));
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

  const recommendations = useMemo(() => {
    if (secondaryBlockedByTwoHander) return [];

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
          score: explanation.score,
          contributionSummary: formatContributionSummary(explanation.contributions),
        };
      })
      .sort((a, b) => {
        if (hasSpecificFocusFamily && a.matchesFocusFamily !== b.matchesFocusFamily) {
          return Number(b.matchesFocusFamily) - Number(a.matchesFocusFamily);
        }

        return b.score - a.score || a.itemName.localeCompare(b.itemName);
      })
      .slice(0, recommendationLimit);
  }, [equippedGear, focusOnly, secondaryBlockedByTwoHander, selectedBardMod, selectedClass, selectedPetFocus, selectedSpellFocus, selectedGearSlot.id, selectedGearSlot.slotKey]);

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
    const validation = canEquipItem(itemName, equippedGear, selectedGearSlot.id, selectedClass);
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
    return characterName.trim().length > 0 || Object.keys(equippedGear).length > 0;
  }

  function buildFromCurrent(id: string, existing?: GearBuild): GearBuild {
    const now = new Date().toISOString();
    const classCode = selectedClass;
    return {
      id,
      name: characterName.trim() || `${classCode} Character`,
      class: classCode,
      equippedItems: gearRecordToEquippedItems(equippedGear),
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
          return;
        }

        const payload = JSON.stringify(snapshot);
        if (payload === lastAutosavePayloadRef.current) return;

        window.localStorage.setItem(rosterAutosaveKey, payload);
        lastAutosavePayloadRef.current = payload;
        const savedTime = snapshot.updatedAt ? formatAutosaveTime(snapshot.updatedAt) : null;
        setAutosaveStatus(savedTime ? `Last autosaved: ${savedTime}` : "Autosaved locally");
      } catch {
        setLoadError("Unable to write local character autosave.");
      }
    }, 450);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveReady, roster, activeCharacterId, characterName, selectedClass, equippedGear]);

  function loadRosterMember(build: GearBuild) {
    hidePreview();
    draftBuildIdRef.current = null;
    setPreviewItemName(null);
    setCharacterName(build.name);
    setSelectedClass(normalizeClassCode(build.class));
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
    setFocusOnly(false);
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
      gearSlots.map((slot) => [slot.id, getBisCandidatesForSlot(slot, selectedClass)]),
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
          <h2>Equipment Slots</h2>
        </div>

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
                  {formatClassOption(classCode)}
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
            <input
              accept="application/json,.json"
              className="visually-hidden"
              onChange={(event) => void loadGroup(event.target.files?.[0])}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </div>
      </div>

      {loadMessage ? <p className="gear-load-feedback">{loadMessage}</p> : null}
      {loadError ? <p className="gear-load-feedback is-error">{loadError}</p> : null}
      <div className="gear-autosave-row">
        <p>{autosaveStatus ?? "Autosaves locally in this browser"}</p>
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
                        <small>{character.class}</small>
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
