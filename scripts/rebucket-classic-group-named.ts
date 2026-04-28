import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Mob = {
  name: string;
  level: number;
  zone: string;
  source_bucket: string;
  loot: string[];
};

type Bucket = {
  bucket: number;
  level_range: string;
  mobs: Mob[];
  loot_pool: string[];
  zones: string[];
  source_buckets_included: string[];
  mob_count: number;
  loot_count: number;
  zone_count: number;
};

type Dataset = {
  metadata: Record<string, string>;
  buckets: Bucket[];
};

const root = process.cwd();
const dataPath = path.join(root, "data", "classic-group-named.json");
const rootCopyPath = path.join(root, "classic-group-named.json");

function bucketForLevel(level: number) {
  return Math.floor((level - 1) / 5) + 1;
}

function levelRangeForBucket(bucket: number) {
  const start = (bucket - 1) * 5 + 1;
  return `${start}-${start + 4}`;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function sortMobs(mobs: Mob[]) {
  return mobs.sort((a, b) => (
    a.level - b.level
    || a.zone.localeCompare(b.zone)
    || a.name.localeCompare(b.name)
  ));
}

const dataset = JSON.parse(await readFile(dataPath, "utf8")) as Dataset;
const allMobs = dataset.buckets.flatMap((bucket) => bucket.mobs);
const grouped = new Map<number, Mob[]>();

for (const mob of allMobs) {
  const bucket = bucketForLevel(mob.level);
  const rebuiltMob = {
    ...mob,
    source_bucket: String(bucket),
  };
  grouped.set(bucket, [...(grouped.get(bucket) ?? []), rebuiltMob]);
}

const rebuiltBuckets: Bucket[] = Array.from(grouped.entries())
  .sort(([a], [b]) => a - b)
  .map(([bucket, mobs]) => {
    const sortedMobs = sortMobs(mobs);
    const lootPool = uniqueSorted(sortedMobs.flatMap((mob) => mob.loot));
    const zones = uniqueSorted(sortedMobs.map((mob) => mob.zone));

    return {
      bucket,
      level_range: levelRangeForBucket(bucket),
      mobs: sortedMobs,
      loot_pool: lootPool,
      zones,
      source_buckets_included: [String(bucket)],
      mob_count: sortedMobs.length,
      loot_count: lootPool.length,
      zone_count: zones.length,
    };
  });

const validationErrors: string[] = [];

for (const bucket of rebuiltBuckets) {
  for (const mob of bucket.mobs) {
    const expectedBucket = bucketForLevel(mob.level);
    if (expectedBucket !== bucket.bucket) {
      validationErrors.push(`${mob.name} level ${mob.level} is in bucket ${bucket.bucket}, expected ${expectedBucket}`);
    }
  }

  const expectedLoot = uniqueSorted(bucket.mobs.flatMap((mob) => mob.loot));
  if (JSON.stringify(expectedLoot) !== JSON.stringify(bucket.loot_pool)) {
    validationErrors.push(`Bucket ${bucket.bucket} loot_pool is not the deduplicated mob loot union`);
  }
}

if (validationErrors.length > 0) {
  console.error(validationErrors.join("\n"));
  process.exit(1);
}

const rebuiltDataset: Dataset = {
  ...dataset,
  metadata: {
    ...dataset.metadata,
    bucket_rule: "Buckets are grouped by mob level in 5-level ranges for the app: bucket = Math.floor((level - 1) / 5) + 1. Bucket 1=1-5, 2=6-10, 3=11-15, 4=16-20, and so on.",
    note: "Each bucket's loot_pool is the deduplicated union of all loot listed on mobs in that 5-level bucket. Individual mob loot is preserved under each mob for verification.",
  },
  buckets: rebuiltBuckets,
};

const output = `${JSON.stringify(rebuiltDataset, null, 2)}\n`;
await writeFile(dataPath, output);
await writeFile(rootCopyPath, output);

console.log(`Rebuilt ${rebuiltBuckets.length} 5-level buckets from ${allMobs.length} mobs.`);
