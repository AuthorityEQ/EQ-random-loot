import type { Bucket } from "@/lib/search";

export function bucketForLevel(level: number, expansion?: string) {
  if (expansion === "Velious" && level >= 60) return 13;
  if (level >= 61) return 13;
  return Math.floor((level - 1) / 5) + 1;
}

export function bucketMinLevel(bucket: number, expansion?: string) {
  if (expansion === "Velious" && bucket === 13) return 60;
  return (bucket - 1) * 5 + 1;
}

export function bucketLevelRange(bucket: number, expansion?: string) {
  if (expansion === "Velious" && bucket === 12) return "56-59";
  if (expansion === "Velious" && bucket === 13) return "60+";
  if (bucket === 13) return "61+";
  const min = bucketMinLevel(bucket, expansion);
  return `${min}-${min + 4}`;
}

export function recommendedBucketNumbers(level: number, expansion?: string) {
  const bucket = bucketForLevel(level, expansion);
  const bucketMin = bucketMinLevel(bucket, expansion);
  const position = level - bucketMin;
  const recommendations = position <= 1
    ? [bucket - 1, bucket]
    : [bucket, bucket + 1];

  return Array.from(new Set(recommendations))
    .filter((bucketNumber) => bucketNumber >= 1)
    .sort((a, b) => a - b);
}

export function isRecommendedBucketForLevel(bucket: Bucket, level: number) {
  return recommendedBucketNumbers(level, bucket.expansion).includes(bucket.bucket);
}

export function bestZonesForBucket(bucket: Bucket, limit = 5) {
  const zones = new Map<string, typeof bucket.mobs>();

  for (const mob of bucket.mobs) {
    zones.set(mob.zone, [...(zones.get(mob.zone) ?? []), mob]);
  }

  return Array.from(zones.entries())
    .map(([zone, mobs]) => ({ zone, mobs }))
    .sort((a, b) => b.mobs.length - a.mobs.length || a.zone.localeCompare(b.zone))
    .slice(0, limit);
}
