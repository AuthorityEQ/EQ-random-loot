import type { ItemDetails } from "@/lib/search";

export type ItemStatus = "clean" | "review" | "missing" | "duplicate";
export type ItemFilter = "all" | ItemStatus;

export type StatusCounts = Record<ItemStatus, number> & {
  total: number;
};

export const statusMeta: Record<ItemStatus, { label: string; tooltip: string }> = {
  clean: {
    label: "Clean",
    tooltip: "Exact match with no missing stats, duplicate-name risk, or parser warnings.",
  },
  review: {
    label: "Review",
    tooltip: "Matched item data exists, but confidence or parsing notes need manual review.",
  },
  missing: {
    label: "Missing",
    tooltip: "No item page was found, item details are absent, or core stats are missing.",
  },
  duplicate: {
    label: "Duplicate",
    tooltip: "Multiple exact-name item pages exist; verify the selected Classic-era page.",
  },
};

export function getItemStatus(details?: ItemDetails): ItemStatus {
  if (!details || details.match_confidence === "not_found" || details.confidence === "not_found" || details.missing_core_stats) {
    return "missing";
  }

  if (details.duplicate_name_risk) {
    return "duplicate";
  }

  if ((details.match_confidence ?? details.confidence) !== "exact_match" || (details.parsing_warnings?.length ?? 0) > 0) {
    return "review";
  }

  return "clean";
}

export function isCleanItem(details?: ItemDetails) {
  return getItemStatus(details) === "clean";
}

export function emptyStatusCounts(): StatusCounts {
  return {
    total: 0,
    clean: 0,
    review: 0,
    missing: 0,
    duplicate: 0,
  };
}

export function countStatuses(itemNames: string[], getDetails: (itemName: string) => ItemDetails | undefined) {
  return itemNames.reduce((counts, itemName) => {
    const status = getItemStatus(getDetails(itemName));
    counts.total += 1;
    counts[status] += 1;
    return counts;
  }, emptyStatusCounts());
}

export function matchesStatusFilter(details: ItemDetails | undefined, filter: ItemFilter, reviewMode: boolean) {
  const status = getItemStatus(details);

  if (reviewMode && status === "clean") {
    return false;
  }

  if (filter === "all") {
    return true;
  }

  return status === filter;
}

export function getMissingFields(details?: ItemDetails) {
  if (!details) {
    return ["item details"];
  }

  const missing: string[] = [];
  const checks: Array<[string, unknown]> = [
    ["slot", details.slot],
    ["ac", details.ac],
    ["damage", details.damage],
    ["delay", details.delay],
    ["haste", details.haste],
    ["required_level", details.required_level],
    ["recommended_level", details.recommended_level],
    ["weight", details.weight],
    ["size", details.size],
    ["lore", details.lore],
    ["magic", details.magic],
    ["no_drop", details.no_drop],
    ["prestige", details.prestige],
  ];

  for (const [label, value] of checks) {
    if (value === null || value === undefined || value === "") {
      missing.push(label);
    }
  }

  if (Object.keys(details.stats).length === 0) missing.push("stats");
  if (Object.keys(details.resists).length === 0) missing.push("resists");
  if (details.classes.length === 0) missing.push("classes");
  if (details.races.length === 0) missing.push("races");
  if (details.worn_effects.length === 0) missing.push("worn_effects");
  if (details.focus_effects.length === 0) missing.push("focus_effects");
  if (details.click_effects.length === 0) missing.push("click_effects");
  if (details.proc_effects.length === 0) missing.push("proc_effects");
  if (details.aug_slots.length === 0) missing.push("aug_slots");

  return missing;
}
