import type { Mob } from "@/lib/search";
import type { RaidBoss, RaidDataset } from "@/lib/raidTiers";

/**
 * Convert a mob name to a URL-safe kebab-case slug.
 *
 * Rules:
 * - Lowercase
 * - Spaces and any punctuation/quotes replaced with hyphens
 * - Collapse multiple consecutive hyphens to one
 * - Strip leading/trailing hyphens
 */
export function mobToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * A unified mob record that can represent either a group-named mob
 * (which belongs to a Bucket) or a raid boss (which belongs to a Tier).
 */
export type MobRecord = {
  name: string;
  level: number;
  zone: string;
  expansion: string;
  /** The slug used in the URL — may have a zone suffix if two mobs share the same base slug. */
  slug: string;
  /** Present only for group-named mobs. */
  bucketNumber?: number;
  bucketLevelRange?: string;
  /** Present only for raid bosses. */
  raidTierName?: string;
  /** The full loot pool for this mob (own loot for group-named via bucket.loot_pool, or boss.loot_pool for raids). */
  lootPool: string[];
  /** For group-named: other mobs in the same bucket. For raid: other bosses in the same tier. */
  bucketSiblings: Array<{ name: string; slug: string }>;
};

/**
 * Build a deduplicated index of all mobs (group-named + raid bosses).
 * Handles slug collisions by appending a zone suffix.
 */
export function buildMobIndex(
  groupBuckets: import("@/lib/search").Bucket[],
  raidDatasets: RaidDataset[],
): Map<string, MobRecord> {
  // Step 1: collect raw entries
  type RawEntry = {
    name: string;
    level: number;
    zone: string;
    expansion: string;
    bucketNumber?: number;
    bucketLevelRange?: string;
    raidTierName?: string;
    lootPool: string[];
    bucketSiblings: Array<{ name: string }>;
  };

  const rawEntries: RawEntry[] = [];

  for (const bucket of groupBuckets) {
    const siblings = bucket.mobs.map((m) => ({ name: m.name }));
    for (const mob of bucket.mobs) {
      rawEntries.push({
        name: mob.name,
        level: mob.level,
        zone: mob.zone,
        expansion: mob.expansion,
        bucketNumber: bucket.bucket,
        bucketLevelRange: bucket.level_range,
        lootPool: bucket.loot_pool,
        bucketSiblings: siblings.filter((s) => s.name !== mob.name),
      });
    }
  }

  for (const dataset of raidDatasets) {
    for (const tier of dataset.tiers) {
      const siblings = tier.bosses.map((b) => ({ name: b.name }));
      for (const boss of tier.bosses) {
        rawEntries.push({
          name: boss.name,
          level: boss.level,
          zone: boss.zone,
          expansion: dataset.expansion,
          raidTierName: tier.name,
          lootPool: boss.loot_pool ?? [],
          bucketSiblings: siblings.filter((s) => s.name !== boss.name),
        });
      }
    }
  }

  // Step 2: compute base slugs and detect collisions
  const slugCount = new Map<string, number>();
  for (const entry of rawEntries) {
    const base = mobToSlug(entry.name);
    slugCount.set(base, (slugCount.get(base) ?? 0) + 1);
  }

  // Step 3: assign final slugs (with zone suffix on collision)
  const usedSlugs = new Set<string>();
  const index = new Map<string, MobRecord>();

  for (const entry of rawEntries) {
    const base = mobToSlug(entry.name);
    let slug = base;

    if ((slugCount.get(base) ?? 0) > 1 || usedSlugs.has(base)) {
      // Append zone suffix to disambiguate
      const zoneSlug = mobToSlug(entry.zone);
      slug = `${base}--${zoneSlug}`;
    }

    // If even the zone-suffixed slug collides (extremely rare), append level
    if (usedSlugs.has(slug)) {
      slug = `${slug}--${entry.level}`;
    }

    usedSlugs.add(slug);

    const siblingRecords = entry.bucketSiblings.map((s) => ({
      name: s.name,
      slug: mobToSlug(s.name),
    }));

    index.set(slug, {
      name: entry.name,
      level: entry.level,
      zone: entry.zone,
      expansion: entry.expansion,
      slug,
      bucketNumber: entry.bucketNumber,
      bucketLevelRange: entry.bucketLevelRange,
      raidTierName: entry.raidTierName,
      lootPool: entry.lootPool,
      bucketSiblings: siblingRecords,
    });
  }

  return index;
}

/**
 * Reverse-lookup: find a MobRecord by slug, tolerating the fact that
 * sibling slugs in bucketSiblings were stored as base slugs and may
 * need re-resolution after collisions are resolved.
 */
export function slugToMobName(
  slug: string,
  allMobs: Mob[],
): Mob | undefined {
  // Try exact match on base slug first
  const baseMatch = allMobs.find((m) => mobToSlug(m.name) === slug);
  if (baseMatch) return baseMatch;

  // Try stripping a potential zone suffix (--zone)
  const withoutSuffix = slug.replace(/--[^-].*$/, "");
  return allMobs.find((m) => mobToSlug(m.name) === withoutSuffix);
}
