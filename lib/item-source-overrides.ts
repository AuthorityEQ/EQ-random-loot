import type { Bucket } from "@/lib/search";

const MOB_SPECIFIC_GROUP_ITEMS = new Set([
  "Lord Gimblox's Signet Ring",
]);

export function hasMobSpecificGroupSources(itemName: string) {
  return MOB_SPECIFIC_GROUP_ITEMS.has(itemName);
}

export function bucketWithItemSpecificMobs(bucket: Bucket, itemName: string): Bucket {
  if (!hasMobSpecificGroupSources(itemName)) return bucket;

  const mobs = bucket.mobs.filter((mob) => mob.loot.includes(itemName));
  if (mobs.length === 0) return bucket;

  const zones = Array.from(new Set(mobs.map((mob) => mob.zone))).sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    ...bucket,
    mob_count: mobs.length,
    mobs,
    zone_count: zones.length,
    zones,
  };
}
