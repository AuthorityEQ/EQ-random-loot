import type { ItemDetails } from "@/lib/search";

export const classOptions = [
  "Any",
  "WAR",
  "CLR",
  "PAL",
  "RNG",
  "SHD",
  "DRU",
  "MNK",
  "BRD",
  "ROG",
  "SHM",
  "NEC",
  "WIZ",
  "MAG",
  "ENC",
  "BST",
  "BER",
] as const;

export const raceOptions = [
  "Any",
  "BAR",
  "DEF",
  "DWF",
  "ERU",
  "GNM",
  "HEF",
  "HFL",
  "HUM",
  "IKS",
  "OGR",
  "TRL",
  "WEF",
  "VAH",
  "FRG",
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
] as const;

export type ClassFilter = (typeof classOptions)[number];
export type RaceFilter = (typeof raceOptions)[number];
export type SlotFilter = "Any" | string;
export type StatFilter = "Any" | string;

function tokenizeRestrictions(values?: string[] | string | null) {
  const list = Array.isArray(values) ? values : values ? [values] : [];

  return list
    .flatMap((value) => String(value).toUpperCase().split(/[,\s]+/))
    .map((value) => value.trim())
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

export function getItemStatValue(details: ItemDetails | undefined, statFilter: StatFilter) {
  if (!details || statFilter === "Any") return null;

  const normalized = statFilter.toUpperCase();
  if (normalized === "AC") return hasValue(details.ac) ? details.ac : null;
  if (normalized === "HASTE") return hasValue(details.haste) ? details.haste : null;

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

  const normalized = statFilter.toUpperCase();
  if (normalized === "AC") {
    return `${value} AC`;
  }

  if (typeof value === "number") {
    return `${value > 0 ? "+" : ""}${value} ${normalized}`;
  }

  const textValue = String(value);
  if (/^-/.test(textValue) || /^\+/.test(textValue)) {
    return `${textValue} ${normalized}`;
  }

  return `+${textValue} ${normalized}`;
}

export function itemMatchesUseFilters(
  details: ItemDetails | undefined,
  classFilter: ClassFilter,
  raceFilter: RaceFilter,
  slotFilter: SlotFilter = "Any",
  statFilter: StatFilter = "Any",
) {
  return allowsSelected(details?.classes, classFilter)
    && allowsSelected(details?.races, raceFilter)
    && matchesSlot(details, slotFilter)
    && (statFilter === "Any" || getItemStatValue(details, statFilter) !== null);
}
