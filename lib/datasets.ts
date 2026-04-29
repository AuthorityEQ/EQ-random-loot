import classicGroupNamedData from "@/data/classic-group-named.json";
import kunarkGroupNamedData from "@/data/kunark-group-named.json";
import veliousGroupNamedData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import type { LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";
import type { ServerId } from "@/lib/server";

export type DatasetKey =
  | "classic-group-named"
  | "kunark-group-named"
  | "velious-group-named"
  | "classic-raid"
  | "kunark-raid"
  | "velious-raid";

type GroupNamedKey =
  | "classic-group-named"
  | "kunark-group-named"
  | "velious-group-named";

type RaidKey = "classic-raid" | "kunark-raid" | "velious-raid";

const GROUP_NAMED_DATASETS: Record<GroupNamedKey, LootDataset> = {
  "classic-group-named": classicGroupNamedData as LootDataset,
  "kunark-group-named": kunarkGroupNamedData as LootDataset,
  "velious-group-named": veliousGroupNamedData as LootDataset,
};

const RAID_DATASETS: Record<RaidKey, RaidDataset> = {
  "classic-raid": classicRaidData as RaidDataset,
  "kunark-raid": kunarkRaidData as RaidDataset,
  "velious-raid": veliousRaidData as RaidDataset,
};

/**
 * Returns the dataset for the given server and key.
 *
 * All servers currently share the same data. This function is the seam point
 * for future per-server divergence — when Teek or Mischief get different
 * loot tables, branch on `server` here rather than changing call sites.
 *
 * TODO: decide whether server-specific overrides should live in separate JSON
 * files (data/teek-classic-group-named.json) or in a runtime patch layer.
 */
export function getDataset(
  _server: ServerId,
  key: GroupNamedKey,
): LootDataset;
export function getDataset(
  _server: ServerId,
  key: RaidKey,
): RaidDataset;
export function getDataset(
  _server: ServerId,
  key: DatasetKey,
): LootDataset | RaidDataset {
  if (key in GROUP_NAMED_DATASETS) {
    return GROUP_NAMED_DATASETS[key as GroupNamedKey];
  }
  return RAID_DATASETS[key as RaidKey];
}
