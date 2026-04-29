/**
 * GET /api/zones/[slug]
 *
 * Returns a specific zone with all mobs, bucket groups, and aggregate loot pool.
 *
 * Response shape:
 *   { data: { zone: ZoneDetail }, meta: {...} }
 */

export const revalidate = 86400;

import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import type { LootDataset, Bucket } from "@/lib/search";
import { slugToZone } from "@/lib/zone-slug";
import { getZoneView } from "@/lib/zones";
import { mobToSlug } from "@/lib/mob-slug";
import { jsonOk, jsonNotFound, corsOptions } from "@/lib/api-helpers";

const allDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const allBuckets: Bucket[] = allDatasets.flatMap((ds) => ds.buckets);

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const resolved = slugToZone(slug, allBuckets);

  if (!resolved) {
    return jsonNotFound(`No zone found for slug "${slug}"`);
  }

  const { name: zoneName, expansion } = resolved;
  const zoneView = getZoneView(allBuckets, zoneName);

  if (!zoneView) {
    return jsonNotFound(`Zone data unavailable for "${zoneName}"`);
  }

  // Aggregate loot across all buckets that touch this zone
  const relatedBuckets = allBuckets.filter((b) => b.zones.includes(zoneName));
  const aggregateLootPool = Array.from(
    new Set(relatedBuckets.flatMap((b) => b.loot_pool)),
  ).sort((a, b) => a.localeCompare(b));

  const bucketGroups = zoneView.bucketGroups.map(({ bucket, mobs }) => ({
    bucket: bucket.bucket,
    levelRange: bucket.level_range,
    expansion: bucket.expansion,
    lootPool: bucket.loot_pool,
    mobs: mobs
      .map((mob) => ({
        name: mob.name,
        slug: mobToSlug(mob.name),
        level: mob.level,
        expansion: mob.expansion,
      }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
  }));

  return jsonOk({
    zone: {
      name: zoneName,
      slug,
      primaryExpansion: expansion,
      expansions: Array.from(new Set(relatedBuckets.map((b) => b.expansion))).sort(),
      totalMobs: zoneView.totalMobs,
      aggregateLootPool,
      aggregateLootPoolSize: aggregateLootPool.length,
      bucketGroups,
    },
  });
}
