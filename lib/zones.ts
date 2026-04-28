import type { Bucket, Mob } from "@/lib/search";

export type ZoneBucketGroup = {
  bucket: Bucket;
  mobs: Mob[];
};

export type ZoneView = {
  zone: string;
  totalMobs: number;
  bucketGroups: ZoneBucketGroup[];
};

export function getAllZones(buckets: Bucket[]) {
  return Array.from(new Set(buckets.flatMap((bucket) => bucket.mobs.map((mob) => mob.zone))))
    .sort((a, b) => a.localeCompare(b));
}

export function getZoneView(buckets: Bucket[], zone: string): ZoneView | null {
  const normalizedZone = zone.trim().toLowerCase();
  if (!normalizedZone) return null;
  const allZones = getAllZones(buckets);
  const exactZone = allZones.find((knownZone) => knownZone.toLowerCase() === normalizedZone);
  const partialMatches = allZones.filter((knownZone) => knownZone.toLowerCase().includes(normalizedZone));
  const resolvedZone = exactZone ?? (partialMatches.length === 1 ? partialMatches[0] : zone);

  const bucketGroups = buckets.flatMap((bucket) => {
    const mobs = bucket.mobs.filter((mob) => mob.zone.toLowerCase() === resolvedZone.toLowerCase());
    return mobs.length > 0 ? [{ bucket, mobs }] : [];
  });

  if (bucketGroups.length === 0) {
    return null;
  }

  return {
    zone: bucketGroups[0].mobs[0].zone,
    totalMobs: bucketGroups.reduce((total, group) => total + group.mobs.length, 0),
    bucketGroups,
  };
}
