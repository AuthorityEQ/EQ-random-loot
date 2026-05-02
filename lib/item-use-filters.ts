import type { ItemDetails } from "@/lib/search";
import { itemEffectsMatchQuery, itemHasFocusEffect } from "@/lib/item-effects";
import { isShieldItem } from "@/lib/item-weapon";

export const classOptions = [
  "Any",
  "BRD",
  "BST",
  "BER",
  "CLR",
  "DRU",
  "ENC",
  "MAG",
  "MNK",
  "NEC",
  "PAL",
  "RNG",
  "ROG",
  "SHD",
  "SHM",
  "WAR",
  "WIZ",
] as const;

export const raceOptions = [
  "Any",
  "BAR",
  "DEF",
  "DWF",
  "ERU",
  "FRG",
  "GNM",
  "HEF",
  "HFL",
  "HUM",
  "IKS",
  "OGR",
  "TRL",
  "WEF",
  "VAH",
] as const;

export const fallbackStatOptions = [
  "Any",
  "AC",
  "HP",
  "MANA",
  "END",
  "STR",
  "STA",
  "AGI",
  "DEX",
  "WIS",
  "INT",
  "CHA",
  "MR",
  "FR",
  "CR",
  "DR",
  "PR",
  "Haste",
  "Mana Regen",
  "Attack",
] as const;

export type ClassFilter = (typeof classOptions)[number];
export type RaceFilter = (typeof raceOptions)[number];
export type SlotFilter = "Any" | string;
export type StatFilter = "Any" | string;

export const noShieldClasses = new Set(["RNG", "BRD", "BER", "ROG", "MNK", "BST"]);

export function classCanUseShields(classCode: string) {
  return !noShieldClasses.has(classCode.toUpperCase());
}

const classTokenAliases: Record<string, string> = {
  BERSERKER: "BER",
};

export const classDisplayNames: Record<string, string> = {
  BER: "Berserker",
};

export function formatClassOption(option: string) {
  const displayName = classDisplayNames[option];
  return displayName ? `${option} - ${displayName}` : option;
}

function tokenizeRestrictions(values?: string[] | string | null) {
  const list = Array.isArray(values) ? values : values ? [values] : [];

  return list
    .flatMap((value) => String(value).toUpperCase().split(/[,\s]+/))
    .map((value) => value.trim())
    .map((value) => classTokenAliases[value] ?? value)
    .filter(Boolean);
}

function allowsSelected(values: string[] | string | null | undefined, selected: string) {
  if (selected === "Any") return true;

  const tokens = tokenizeRestrictions(values);
  if (tokens.length === 0) return true;

  const allIndex = tokens.indexOf("ALL");
  const exceptIndex = tokens.findIndex((token) => token === "EXCEPT" || token === "BUT");

  if (allIndex !== -1 && exceptIndex !== -1 && exceptIndex > allIndex) {
    return !tokens.slice(exceptIndex + 1).includes(selected);
  }

  if (allIndex !== -1) return true;

  return tokens.includes(selected);
}

function matchesSlot(details: ItemDetails | undefined, slotFilter: SlotFilter) {
  if (slotFilter === "Any") return true;
  if (!details?.slot) return false;

  return details.slot
    .toUpperCase()
    .split(/[,\s/]+/)
    .filter(Boolean)
    .includes(slotFilter);
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0";
}

function normalizeStatFilter(statFilter: StatFilter) {
  return statFilter.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function getItemStatValue(details: ItemDetails | undefined, statFilter: StatFilter) {
  if (!details || statFilter === "Any") return null;

  const normalized = normalizeStatFilter(statFilter);
  if (normalized === "AC") return hasValue(details.ac) ? details.ac : null;
  if (normalized === "HASTE") return hasValue(details.haste) ? details.haste : null;
  if (normalized === "MANA_REGEN") {
    const manaRegen = details.manaRegen ?? details.mana_regen;
    return hasValue(manaRegen) ? manaRegen : null;
  }
  if (normalized === "ATTACK") {
    const attack = details.attack ?? details.atk;
    return hasValue(attack) ? attack : null;
  }

  const statValue = details.stats?.[normalized];
  if (hasValue(statValue)) return statValue;

  const resistValue = details.resists?.[normalized];
  if (hasValue(resistValue)) return resistValue;

  return null;
}

export function getComparableStatValue(details: ItemDetails | undefined, statFilter: StatFilter) {
  const value = getItemStatValue(details, statFilter);
  if (value === null) return null;

  if (typeof value === "number") return value;

  const parsed = Number.parseFloat(String(value).replace(/[^+\-\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatItemStatValue(details: ItemDetails | undefined, statFilter: StatFilter) {
  const value = getItemStatValue(details, statFilter);
  if (value === null) return null;

  if (statFilter.toUpperCase() === "HASTE") {
    return `${value} Haste`;
  }

  const normalized = normalizeStatFilter(statFilter);
  const displayLabel = normalized === "MANA_REGEN" ? "Mana Regen" : normalized === "ATTACK" ? "Attack" : normalized;
  if (normalized === "AC") {
    return `${value} AC`;
  }

  if (typeof value === "number") {
    return `${value > 0 ? "+" : ""}${value} ${displayLabel}`;
  }

  const textValue = String(value);
  if (/^-/.test(textValue) || /^\+/.test(textValue)) {
    return `${textValue} ${displayLabel}`;
  }

  return `+${textValue} ${displayLabel}`;
}

export function itemMatchesUseFilters(
  details: ItemDetails | undefined,
  classFilter: ClassFilter,
  raceFilter: RaceFilter,
  slotFilter: SlotFilter = "Any",
  statFilter: StatFilter = "Any",
  focusOnly = false,
  effectQuery = "",
) {
  if (classFilter !== "Any" && !classCanUseShields(classFilter) && isShieldItem(details)) {
    return false;
  }

  return allowsSelected(details?.classes, classFilter)
    && allowsSelected(details?.races, raceFilter)
    && matchesSlot(details, slotFilter)
    && (statFilter === "Any" || getItemStatValue(details, statFilter) !== null)
    && (!focusOnly || itemHasFocusEffect(details))
    && itemEffectsMatchQuery(details, effectQuery);
}
