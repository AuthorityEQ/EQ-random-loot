/**
 * GET /api/buckets
 *
 * List all loot buckets across expansions with summary statistics.
 *
 * Query params:
 *   exp    — filter by expansion: classic | kunark | velious
 *   bucket — filter by bucket number (integer)
 *
 * Response shape:
 *   { data: { buckets: BucketSummary[], total: number }, meta: {...} }
 */

export const revalidate = 86400;

import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import type { LootDataset, Bucket } from "@/lib/search";
import { bucketLevelRange } from "@/lib/buckets";
import { zoneToSlug } from "@/lib/zone-slug";
import {
  jsonOk,
  jsonBadRequest,
  corsOptions,
  strParam,
  intParam,
} from "@/lib/api-helpers";

const allDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const allBuckets: Bucket[] = allDatasets.flatMap((ds) => ds.buckets);

type BucketSummary = {
  bucket: number;
  expansion: string;
  levelRange: string;
  mobCount: number;
  zoneCount: number;
  lootPoolSize: number;
  zones: Array<{ name: string; slug: string; mobCount: number }>;
  lootPool: string[];
  sourceBucketsIncluded?: string[];
};

function summarizeBuckets(buckets: Bucket[]): BucketSummary[] {
  return buckets.map((b) => {
    // Build per-zone mob counts for this bucket
    const zoneCountMap = new Map<string, number>();
    for (const mob of b.mobs) {
      zoneCountMap.set(mob.zone, (zoneCountMap.get(mob.zone) ?? 0) + 1);
    }

    const zones = Array.from(zoneCountMap.entries())
      .map(([name, mobCount]) => ({ name, slug: zoneToSlug(name), mobCount }))
      .sort((a, b) => b.mobCount - a.mobCount || a.name.localeCompare(b.name));

    return {
      bucket: b.bucket,
      expansion: b.expansion,
      levelRange: bucketLevelRange(b.bucket, b.expansion),
      mobCount: b.mobs.length,
      zoneCount: zones.length,
      lootPoolSize: b.loot_pool.length,
      zones,
      lootPool: b.loot_pool,
      ...(b.source_buckets_included
        ? { sourceBucketsIncluded: b.source_buckets_included }
        : {}),
    };
  });
}

// Computed once at module startup
const ALL_BUCKET_SUMMARIES = summarizeBuckets(allBuckets);

const EXP_ORDER: Record<string, number> = { Classic: 0, Kunark: 1, Velious: 2 };

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const exp    = strParam(url, "exp");
  const bucket = intParam(url, "bucket");

  const validExpansions = ["classic", "kunark", "velious"];
  if (exp && !validExpansions.includes(exp)) {
    return jsonBadRequest(
      `Unknown expansion "${exp}". Valid values: ${validExpansions.join(", ")}`,
    );
  }

  let summaries = ALL_BUCKET_SUMMARIES;

  if (exp) {
    const expTitle = exp.charAt(0).toUpperCase() + exp.slice(1);
    summaries = summaries.filter((b) => b.expansion === expTitle);
  }

  if (bucket !== null) {
    summaries = summaries.filter((b) => b.bucket === bucket);
  }

  // Sort: expansion order, then bucket number ascending
  summaries = [...summaries].sort(
    (a, b) =>
      (EXP_ORDER[a.expansion] ?? 99) - (EXP_ORDER[b.expansion] ?? 99) ||
      a.bucket - b.bucket,
  );

  return jsonOk({ buckets: summaries, total: summaries.length });
}
