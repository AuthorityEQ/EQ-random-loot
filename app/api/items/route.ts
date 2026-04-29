/**
 * GET /api/items
 *
 * Search items by name (case-insensitive substring), optionally filtered by
 * slot and/or expansion.
 *
 * Query params:
 *   q    — name substring (min 1 char; absent = all items)
 *   slot — normalized slot key: primary | secondary | head | chest | …
 *   exp  — expansion: classic | kunark | velious
 *
 * Response shape:
 *   { data: { items: ItemDetails[], total: number }, meta: {...} }
 */

export const revalidate = 86400;

import itemDetailsData from "@/data/item-details.json";
import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import type { ItemDetailsMap, LootDataset } from "@/lib/search";
import { buildItemSlugMap } from "@/lib/item-slug";
import { parseRawSlot, ALL_SLOT_KEYS } from "@/lib/slot-filter";
import type { SlotKey } from "@/lib/slot-filter";
import { jsonOk, jsonBadRequest, corsOptions, strParam } from "@/lib/api-helpers";

const itemDetails = itemDetailsData as ItemDetailsMap;
const allDatasets = [classicData, kunarkData, veliousData] as LootDataset[];

// Pre-compute slug maps once at module level
const { nameToSlug } = buildItemSlugMap(itemDetails);

// Collect the union of all item names that appear in at least one loot pool
const allLootPoolNames = new Set(
  allDatasets.flatMap((ds) => ds.buckets.flatMap((b) => b.loot_pool)),
);

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q    = strParam(url, "q");
  const slot = strParam(url, "slot");
  const exp  = strParam(url, "exp");

  // Validate expansion param if provided
  const validExpansions = ["classic", "kunark", "velious"];
  if (exp && !validExpansions.includes(exp)) {
    return jsonBadRequest(
      `Unknown expansion "${exp}". Valid values: ${validExpansions.join(", ")}`,
    );
  }

  let entries = Object.entries(itemDetails)
    // Only surface items that appear in at least one bucket's loot_pool
    .filter(([name]) => allLootPoolNames.has(name));

  // Filter by name substring
  if (q) {
    entries = entries.filter(([name]) => name.toLowerCase().includes(q));
  }

  // Filter by slot — parseRawSlot works on raw uppercase tokens, so we
  // normalise the incoming lowercase API param to match SlotKey membership.
  if (slot) {
    // Narrow the raw query string to SlotKey before calling the typed Set.has().
    // ALL_SLOT_KEYS membership is the runtime proof that the string is a valid SlotKey.
    const slotKey = ALL_SLOT_KEYS.has(slot as SlotKey) ? (slot as SlotKey) : null;
    if (slotKey) {
      entries = entries.filter(([, details]) => {
        const slots = parseRawSlot(details.slot);
        return slots.has(slotKey);
      });
    }
  }

  // Filter by expansion (stored as capitalized in ItemDetails)
  if (exp) {
    const expTitle = exp.charAt(0).toUpperCase() + exp.slice(1);
    entries = entries.filter(([, details]) => details.expansion === expTitle);
  }

  const items = entries.map(([name, details]) => ({
    slug: nameToSlug.get(name) ?? null,
    ...details,
  }));

  return jsonOk({ items, total: items.length });
}
