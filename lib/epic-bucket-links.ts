import type { EpicClassName, NormalizedStep } from "@/app/epics/types";
import classicGroupData from "@/data/classic-group-named.json";
import kunarkGroupData from "@/data/kunark-group-named.json";
import veliousGroupData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import type { LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";

export type EpicBucketLink = {
  label: string;
  href: string;
  title: string;
  kind: "group" | "raid";
};

type BucketLinkEntry = EpicBucketLink & {
  mobName: string;
};

const groupDatasets = [classicGroupData, kunarkGroupData, veliousGroupData] as LootDataset[];
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];

// Manual EQ progression overrides for bucketed epic mobs that are not present
// in the current bucket datasets yet, or for old notes that refer to a chain
// step rather than the exact bucketed boss record.
const manualEpicBucketLinks = new Map<string, EpicBucketLink[]>([
  [
    "Cleric|15",
    [
      {
        label: "Kunark T2 Raid Bucket",
        href: "/raids?expansion=Kunark&tier=2",
        title: "View Kunark Tier 2 raid targets",
        kind: "raid",
      },
    ],
  ],
  [
    "Cleric|16",
    [
      {
        label: "Kunark T2 Raid Bucket",
        href: "/raids?expansion=Kunark&tier=2",
        title: "View Kunark Tier 2 raid targets",
        kind: "raid",
      },
    ],
  ],
  [
    "Cleric|23",
    [
      {
        label: "Kunark T2 Raid Bucket",
        href: "/raids?expansion=Kunark&tier=2",
        title: "View Kunark Tier 2 raid targets",
        kind: "raid",
      },
    ],
  ],
  [
    "Cleric|24",
    [
      {
        label: "Kunark T2 Raid Bucket",
        href: "/raids?expansion=Kunark&tier=2",
        title: "View Kunark Tier 2 raid targets",
        kind: "raid",
      },
    ],
  ],
  [
    "Monk|7",
    [
      {
        label: "Kunark T2 Group Bucket",
        href: "/loot?exp=kunark&bucket=11&level=60",
        title: "View the Kunark random group-loot bucket for this drop",
        kind: "group",
      },
    ],
  ],
  [
    "Monk|8",
    [
      {
        label: "Kunark T2 Group Bucket",
        href: "/loot?exp=kunark&bucket=11&level=60",
        title: "View the Kunark random group-loot bucket for this drop",
        kind: "group",
      },
    ],
  ],
]);

const bucketLinksByMobName = buildBucketLinksByMobName();

function buildBucketLinksByMobName() {
  const links = new Map<string, BucketLinkEntry[]>();

  for (const dataset of groupDatasets) {
    const expansion = dataset.metadata.expansion;
    for (const bucket of dataset.buckets) {
      const link: EpicBucketLink = {
        label: `${expansion} ${bucket.level_range} Group Bucket`,
        href: `/loot?exp=${encodeURIComponent(expansion.toLowerCase())}&bucket=${bucket.bucket}`,
        title: `View ${expansion} group bucket ${bucket.bucket}`,
        kind: "group",
      };

      for (const mob of bucket.mobs) {
        addBucketLink(links, mob.name, { ...link, mobName: mob.name });
      }
    }
  }

  for (const dataset of raidDatasets) {
    for (const tier of dataset.tiers) {
      if (String(tier.tier).toLowerCase().includes("non-random")) continue;
      const tierLabel = typeof tier.tier === "number" ? `T${tier.tier}` : String(tier.tier);
      const link: EpicBucketLink = {
        label: `${dataset.expansion} ${tierLabel} Raid Bucket`,
        href: `/raids?expansion=${encodeURIComponent(dataset.expansion)}&tier=${encodeURIComponent(String(tier.tier))}`,
        title: `View ${dataset.expansion} ${tierLabel} raid targets`,
        kind: "raid",
      };

      for (const boss of tier.bosses) {
        addBucketLink(links, boss.name, { ...link, mobName: boss.name });
      }
    }
  }

  return links;
}

function addBucketLink(map: Map<string, BucketLinkEntry[]>, mobName: string, link: BucketLinkEntry) {
  const key = normalizeMobName(mobName);
  const current = map.get(key) ?? [];
  if (!current.some((existing) => existing.href === link.href && existing.kind === link.kind)) {
    current.push(link);
  }
  map.set(key, current);
}

function normalizeMobName(value: string) {
  return value
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\band\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitNpcCandidates(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*(?:\/|,|;|\+|\bthen\b|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getStepNpcCandidates(step: NormalizedStep) {
  const candidates = new Set<string>();
  for (const npc of step.npcLinks) {
    candidates.add(npc.name);
  }
  if (step.npcMob) {
    for (const part of splitNpcCandidates(step.npcMob)) {
      candidates.add(part);
    }
  }
  for (const spawnNote of step.spawnNotes) {
    for (const part of splitNpcCandidates(spawnNote)) {
      candidates.add(part.replace(/\bwill spawn\b.*$/i, "").trim());
    }
  }
  return [...candidates].filter(Boolean);
}

function dedupeLinks(links: EpicBucketLink[]) {
  const seen = new Set<string>();
  const deduped: EpicBucketLink[] = [];
  for (const link of links) {
    const key = `${link.kind}|${link.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(link);
  }
  return deduped.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "raid" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function getEpicBucketLinks(className: EpicClassName, step: NormalizedStep) {
  const links = [...(manualEpicBucketLinks.get(`${className}|${step.stepRaw}`) ?? [])];
  for (const candidate of getStepNpcCandidates(step)) {
    links.push(...(bucketLinksByMobName.get(normalizeMobName(candidate)) ?? []));
  }
  return dedupeLinks(links);
}
