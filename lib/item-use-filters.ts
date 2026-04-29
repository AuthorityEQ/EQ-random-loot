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

export type ClassFilter = (typeof classOptions)[number];
export type RaceFilter = (typeof raceOptions)[number];
export type SlotFilter = "Any" | string;

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

export function itemMatchesUseFilters(
  details: ItemDetails | undefined,
  classFilter: ClassFilter,
  raceFilter: RaceFilter,
  slotFilter: SlotFilter = "Any",
) {
  return allowsSelected(details?.classes, classFilter)
    && allowsSelected(details?.races, raceFilter)
    && matchesSlot(details, slotFilter);
}
