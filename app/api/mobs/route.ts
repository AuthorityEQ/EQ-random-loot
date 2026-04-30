/**
 * GET /api/mobs
 *
 * Search mobs by zone (substring), level range, and/or expansion.
 *
 * Query params:
 *   zone      — zone name substring (case-insensitive)
 *   level     — exact level (integer)
 *   level_min — minimum level (inclusive)
 *   level_max — maximum level (inclusive)
 *   exp       — expansion: classic | kunark | velious
 *   name      — mob name substring (case-insensitive)
 *
 * Response shape:
 *   { data: { mobs: MobResult[], total: number }, meta: {...} }
 */

export const revalidate = 86400;

import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import type { LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";
import { mobToSlug } from "@/lib/mob-slug";
import {
  jsonOk,
  jsonBadRequest,
  corsOptions,
  strParam,
  intParam,
} from "@/lib/api-helpers";

const groupDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];

type MobResult = {
  name: string;
  slug: string;
  level: number;
  zone: string;
  expansion: string;
  type: "group-named" | "raid";
  lootPool: string[];
  bucketNumber?: number;
  bucketLevelRange?: string;
  raidTierName?: string;
};

function collectAllMobs(): MobResult[] {
  const results: MobResult[] = [];

  for (const ds of groupDatasets) {
    for (const bucket of ds.buckets) {
      for (const mob of bucket.mobs) {
        results.push({
          name: mob.name,
          slug: mobToSlug(mob.name),
          level: mob.level,
          zone: mob.zone,
          expansion: mob.expansion,
          type: "group-named",
          lootPool: bucket.loot_pool,
          bucketNumber: bucket.bucket,
          bucketLevelRange: bucket.level_range,
        });
      }
    }
  }

  for (const ds of raidDatasets) {
    for (const tier of ds.tiers) {
      for (const boss of tier.bosses) {
        results.push({
          name: boss.name,
          slug: mobToSlug(boss.name),
          level: boss.level,
          zone: boss.zone,
          expansion: ds.expansion,
          type: "raid",
          lootPool: boss.loot_pool ?? [],
          raidTierName: tier.name,
        });
      }
    }
  }

  return results;
}

// Computed once at module startup
const ALL_MOBS = collectAllMobs();

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zone     = strParam(url, "zone");
  const name     = strParam(url, "name");
  const exp      = strParam(url, "exp");
  const level    = intParam(url, "level");
  const levelMin = intParam(url, "level_min");
  const levelMax = intParam(url, "level_max");

  const validExpansions = ["classic", "kunark", "velious"];
  if (exp && !validExpansions.includes(exp)) {
    return jsonBadRequest(
      `Unknown expansion "${exp}". Valid values: ${validExpansions.join(", ")}`,
    );
  }

  let mobs = ALL_MOBS;

  if (zone) {
    mobs = mobs.filter((m) => m.zone.toLowerCase().includes(zone));
  }

  if (name) {
    mobs = mobs.filter((m) => m.name.toLowerCase().includes(name));
  }

  if (exp) {
    const expTitle = exp.charAt(0).toUpperCase() + exp.slice(1);
    mobs = mobs.filter((m) => m.expansion === expTitle);
  }

  if (level !== null) {
    mobs = mobs.filter((m) => m.level === level);
  } else {
    if (levelMin !== null) mobs = mobs.filter((m) => m.level >= levelMin);
    if (levelMax !== null) mobs = mobs.filter((m) => m.level <= levelMax);
  }

  // Sort: expansion order, then zone, then level, then name
  const expOrder: Record<string, number> = { Classic: 0, Kunark: 1, Velious: 2 };
  mobs = [...mobs].sort(
    (a, b) =>
      (expOrder[a.expansion] ?? 99) - (expOrder[b.expansion] ?? 99) ||
      a.zone.localeCompare(b.zone) ||
      a.level - b.level ||
      a.name.localeCompare(b.name),
  );

  return jsonOk({ mobs, total: mobs.length });
}
