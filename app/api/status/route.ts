/**
 * GET /api/status
 *
 * Returns server/plugin status: server name, version, launch date,
 * expansion timeline, and dataset stats.
 *
 * This endpoint uses a short cache window so public status checks do not
 * become a launch-day Function Invocation hot spot.
 *
 * Response shape:
 *   { data: StatusPayload, meta: {...} }
 */

export const revalidate = 60;

import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import expansionSchedule from "@/data/expansion-schedule.json";
import itemDetailsData from "@/data/item-details.json";
import type { LootDataset, ItemDetailsMap } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";
import { API_VERSION, API_SOURCE, jsonOk, corsOptions } from "@/lib/api-helpers";

const groupDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const raidDatasets  = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const itemDetails   = itemDetailsData as ItemDetailsMap;

function datasetStats() {
  const allGroupBuckets = groupDatasets.flatMap((ds) => ds.buckets);
  const allRaidBosses   = raidDatasets.flatMap((ds) => ds.tiers.flatMap((t) => t.bosses));

  const zones = new Set(allGroupBuckets.flatMap((b) => b.zones));
  const groupLootItems = new Set(allGroupBuckets.flatMap((b) => b.loot_pool));
  const enrichedItems  = Object.keys(itemDetails).length;

  return {
    groupNamedBuckets:  allGroupBuckets.length,
    groupNamedMobs:     allGroupBuckets.reduce((n, b) => n + b.mobs.length, 0),
    groupNamedLootPool: groupLootItems.size,
    raidBosses:         allRaidBosses.length,
    uniqueZones:        zones.size,
    enrichedItems,
  };
}

function expansionStatus() {
  const now = Date.now();
  return expansionSchedule.expansions.map((exp) => ({
    name:          exp.name,
    unlockIso:     exp.unlock_iso ?? null,
    isLive:        exp.unlock_iso ? new Date(exp.unlock_iso).getTime() <= now : false,
    tentative:     exp.tentative,
    tone:          (exp as Record<string, unknown>).tone as string | undefined ?? null,
  }));
}

export async function OPTIONS() {
  return corsOptions();
}

export async function GET() {
  return jsonOk({
    server:      expansionSchedule.server,
    apiVersion:  API_VERSION,
    apiSource:   API_SOURCE,
    launchIso:   expansionSchedule.launch_at_iso,
    launchHuman: expansionSchedule.launch_at_human,
    isLaunched:  new Date(expansionSchedule.launch_at_iso).getTime() <= Date.now(),
    expansions:  expansionStatus(),
    dataStats:   datasetStats(),
  });
}
