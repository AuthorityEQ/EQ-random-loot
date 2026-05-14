/**
 * slot-filter.ts
 *
 * Slot-based filtering logic for the loot browser.
 *
 * Raw data notes (from item-details.json):
 *   - item.slot is uppercase and may contain MULTIPLE space-separated tokens
 *     e.g. "PRIMARY SECONDARY", "EAR FINGER", "WRIST LEGS"
 *   - Observed singular forms: FINGER (not FINGERS), SHOULDERS (not SHOULDER),
 *     RANGE (not RANGED)
 *   - This module normalizes the raw tokens to lowercase SlotKey values.
 */

import type { Bucket, ItemDetailsMap } from "@/lib/search";

// ── Category / key types ─────────────────────────────────────────────────────

export type SlotCategory = "weapons" | "armor" | "accessories";

export type SlotKey =
  | "primary"
  | "secondary"
  | "range"
  | "ammo"
  | "head"
  | "chest"
  | "arms"
  | "waist"
  | "legs"
  | "feet"
  | "wrist"
  | "hands"
  | "ear"
  | "face"
  | "neck"
  | "back"
  | "shoulders"
  | "finger";

// ── Category definitions ─────────────────────────────────────────────────────

export const SLOT_CATEGORIES: Record<SlotCategory, SlotKey[]> = {
  weapons:     ["primary", "secondary", "range", "ammo"],
  armor:       ["head", "chest", "arms", "waist", "legs", "feet", "wrist", "hands"],
  accessories: ["ear", "face", "neck", "back", "shoulders", "finger"],
};

// All slot keys in a flat set for quick membership testing
export const ALL_SLOT_KEYS = new Set<SlotKey>(
  (Object.values(SLOT_CATEGORIES) as SlotKey[][]).flat(),
);

// ── Display labels ────────────────────────────────────────────────────────────

export const SLOT_LABELS: Record<SlotKey, string> = {
  primary:   "Primary",
  secondary: "Secondary",
  range:     "Ranged",
  ammo:      "Ammo",
  head:      "Head",
  chest:     "Chest",
  arms:      "Arms",
  waist:     "Waist",
  legs:      "Legs",
  feet:      "Feet",
  wrist:     "Wrist",
  hands:     "Hands",
  ear:       "Ear",
  face:      "Face",
  neck:      "Neck",
  back:      "Back",
  shoulders: "Shoulders",
  finger:    "Fingers",
};

export const CATEGORY_LABELS: Record<SlotCategory, string> = {
  weapons:     "Weapons",
  armor:       "Armor",
  accessories: "Accessories",
};

// ── Raw-token normalisation ───────────────────────────────────────────────────

/**
 * Map raw uppercase data tokens (from item.slot) to SlotKey values.
 * Handles the quirks observed in item-details.json:
 *   RANGED -> range, FINGER -> finger (used for FINGERS), SHOULDER -> shoulders, etc.
 */
const TOKEN_TO_SLOT_KEY: Record<string, SlotKey> = {
  PRIMARY:   "primary",
  SECONDARY: "secondary",
  RANGE:     "range",
  RANGED:    "range",
  AMMO:      "ammo",
  HEAD:      "head",
  CHEST:     "chest",
  ARMS:      "arms",
  WAIST:     "waist",
  LEG:       "legs",
  LEGS:      "legs",
  PANT:      "legs",
  PANTS:     "legs",
  FEET:      "feet",
  WRIST:     "wrist",
  HANDS:     "hands",
  EAR:       "ear",
  FACE:      "face",
  NECK:      "neck",
  BACK:      "back",
  SHOULDER:  "shoulders",
  SHOULDERS: "shoulders",
  FINGER:    "finger",
  FINGERS:   "finger",
};

/**
 * Parse a raw slot string into the set of SlotKey values it represents.
 * Returns an empty set for null / unknown tokens.
 */
export function parseRawSlot(raw: string | null | undefined): Set<SlotKey> {
  if (!raw) return new Set();
  const keys = new Set<SlotKey>();
  for (const token of raw.split(" ")) {
    const mapped = TOKEN_TO_SLOT_KEY[token.toUpperCase()];
    if (mapped) keys.add(mapped);
  }
  return keys;
}

// ── Filtering helpers ─────────────────────────────────────────────────────────

/**
 * Returns true when the given item matches ANY of the requested slots.
 * If selectedSlots is empty the filter is considered inactive and all items pass.
 */
export function itemMatchesSlots(
  itemName: string,
  details: ItemDetailsMap,
  selectedSlots: SlotKey[],
): boolean {
  if (selectedSlots.length === 0) return true;

  const item = details[itemName];
  if (!item) return false;

  const itemSlots = parseRawSlot(item.slot);
  if (itemSlots.size === 0) return false;

  return selectedSlots.some((key) => itemSlots.has(key));
}

/**
 * Returns true when at least one item in the bucket's loot_pool matches
 * ANY of the selected slots.
 */
export function bucketHasMatchingItems(
  bucket: Bucket,
  details: ItemDetailsMap,
  selectedSlots: SlotKey[],
): boolean {
  if (selectedSlots.length === 0) return true;
  return bucket.loot_pool.some((item) => itemMatchesSlots(item, details, selectedSlots));
}
