/**
 * GET /api/zones
 *
 * List all zones with summary metadata: mob count, level range,
 * expansions present, and slug.
 *
 * Query params:
 *   exp — filter by expansion: classic | kunark | velious
 *
 * Response shape:
 *   { data: { zones: ZoneSummary[], total: number }, meta: {...} }
 */

export const revalidate = 86400;

import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import type { LootDataset, Bucket, Mob } from "@/lib/search";
import { zoneToSlug } from "@/lib/zone-slug";
import { jsonOk, jsonBadRequest, corsOptions, strParam } from "@/lib/api-helpers";

const allDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const allBuckets: Bucket[] = allDatasets.flatMap((ds) => ds.buckets);

type ZoneSummary = {
  name: string;
  slug: string;
  expansions: string[];
  mobCount: number;
  levelMin: number;
  levelMax: number;
  lootPoolSize: number;
};

function buildZoneSummaries(buckets: Bucket[]): ZoneSummary[] {
  const zoneMap = new Map<
    string,
    { mobs: Mob[]; expansions: Set<string>; lootItems: Set<string> }
  >();

  for (const bucket of buckets) {
    for (const mob of bucket.mobs) {
      if (!zoneMap.has(mob.zone)) {
        zoneMap.set(mob.zone, {
          mobs: [],
          expansions: new Set(),
          lootItems: new Set(),
        });
      }
      const entry = zoneMap.get(mob.zone)!;
      entry.mobs.push(mob);
      entry.expansions.add(bucket.expansion);
      for (const item of bucket.loot_pool) {
        entry.lootItems.add(item);
      }
    }
  }

  return Array.from(zoneMap.entries())
    .map(([name, { mobs, expansions, lootItems }]) => {
      const levels = mobs.map((m) => m.level);
      return {
        name,
        slug: zoneToSlug(name),
        expansions: Array.from(expansions).sort(),
        mobCount: mobs.length,
        levelMin: Math.min(...levels),
        levelMax: Math.max(...levels),
        lootPoolSize: lootItems.size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Computed once at module startup
const ALL_ZONE_SUMMARIES = buildZoneSummaries(allBuckets);

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const exp = strParam(url, "exp");

  const validExpansions = ["classic", "kunark", "velious"];
  if (exp && !validExpansions.includes(exp)) {
    return jsonBadRequest(
      `Unknown expansion "${exp}". Valid values: ${validExpansions.join(", ")}`,
    );
  }

  let zones = ALL_ZONE_SUMMARIES;

  if (exp) {
    const expTitle = exp.charAt(0).toUpperCase() + exp.slice(1);
    zones = zones.filter((z) => z.expansions.includes(expTitle));
  }

  return jsonOk({ zones, total: zones.length });
}
