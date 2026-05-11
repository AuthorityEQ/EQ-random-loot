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
  sourceName: string;
};

const groupDatasets = [classicGroupData, kunarkGroupData, veliousGroupData] as LootDataset[];
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];

function makeGroupBucketLink({
  expansion,
  bucket,
  label,
  title,
  level,
}: {
  expansion: string;
  bucket: number;
  label?: string;
  title?: string;
  level?: number;
}): EpicBucketLink {
  const params = new URLSearchParams({
    exp: expansion.toLowerCase(),
    bucket: String(bucket),
  });
  if (level) params.set("level", String(level));

  return {
    label: label ?? `${expansion} Group Bucket ${bucket}`,
    href: `/loot?${params.toString()}`,
    title: title ?? `View ${expansion} group bucket ${bucket}`,
    kind: "group",
  };
}

function makeRaidBucketLink({
  expansion,
  tier,
  label,
  title,
}: {
  expansion: string;
  tier: string | number;
  label?: string;
  title?: string;
}): EpicBucketLink {
  const tierLabel = typeof tier === "number" ? `T${tier}` : String(tier);
  const params = new URLSearchParams({
    expansion,
    tier: String(tier),
  });

  return {
    label: label ?? `${expansion} ${tierLabel} Raid Bucket`,
    href: `/raids?${params.toString()}`,
    title: title ?? `View ${expansion} ${tierLabel} raid targets`,
    kind: "raid",
  };
}

// Manual EQ progression overrides for bucketed epic mobs that are not present
// in the current bucket datasets yet, or for old notes that refer to a chain
// step rather than the exact bucketed boss record.
const manualEpicBucketLinks = new Map<string, EpicBucketLink[]>([
  [
    "Cleric|15",
    [
      makeRaidBucketLink({
        label: "Kunark T2 Raid Bucket",
        expansion: "Kunark",
        tier: 2,
        title: "View Kunark Tier 2 raid targets",
      }),
    ],
  ],
  [
    "Cleric|16",
    [
      makeRaidBucketLink({
        label: "Kunark T2 Raid Bucket",
        expansion: "Kunark",
        tier: 2,
        title: "View Kunark Tier 2 raid targets",
      }),
    ],
  ],
  [
    "Cleric|23",
    [
      makeRaidBucketLink({
        label: "Kunark T2 Raid Bucket",
        expansion: "Kunark",
        tier: 2,
        title: "View Kunark Tier 2 raid targets",
      }),
    ],
  ],
  [
    "Cleric|24",
    [
      makeRaidBucketLink({
        label: "Kunark T2 Raid Bucket",
        expansion: "Kunark",
        tier: 2,
        title: "View Kunark Tier 2 raid targets",
      }),
    ],
  ],
  [
    "Monk|7",
    [
      makeGroupBucketLink({
        label: "Kunark T2 Group Bucket",
        expansion: "Kunark",
        bucket: 11,
        level: 60,
        title: "View the Kunark random group-loot bucket for this drop",
      }),
    ],
  ],
  [
    "Monk|8",
    [
      makeGroupBucketLink({
        label: "Kunark T2 Group Bucket",
        expansion: "Kunark",
        bucket: 11,
        level: 60,
        title: "View the Kunark random group-loot bucket for this drop",
      }),
    ],
  ],
]);

const bucketLinksByMobName = buildBucketLinksByMobName();
const bucketLinksByItemName = buildBucketLinksByItemName();

function buildBucketLinksByMobName() {
  const links = new Map<string, BucketLinkEntry[]>();

  for (const dataset of groupDatasets) {
    const expansion = dataset.metadata.expansion;
    for (const bucket of dataset.buckets) {
      const link = makeGroupBucketLink({
        bucket: bucket.bucket,
        expansion,
        label: `${expansion} ${bucket.level_range} Group Bucket`,
        title: `View ${expansion} group bucket ${bucket.bucket}`,
      });

      for (const mob of bucket.mobs) {
        addBucketLink(links, normalizeNpcOrMobName(mob.name), { ...link, sourceName: mob.name });
      }
    }
  }

  for (const dataset of raidDatasets) {
    for (const tier of dataset.tiers) {
      if (String(tier.tier).toLowerCase().includes("non-random")) continue;
      const tierLabel = typeof tier.tier === "number" ? `T${tier.tier}` : String(tier.tier);
      const link = makeRaidBucketLink({
        expansion: dataset.expansion,
        tier: tier.tier,
        label: `${dataset.expansion} ${tierLabel} Raid Bucket`,
        title: `View ${dataset.expansion} ${tierLabel} raid targets`,
      });

      for (const boss of tier.bosses) {
        addBucketLink(links, normalizeNpcOrMobName(boss.name), { ...link, sourceName: boss.name });
      }
    }
  }

  return links;
}

function buildBucketLinksByItemName() {
  const links = new Map<string, BucketLinkEntry[]>();

  for (const dataset of groupDatasets) {
    const expansion = dataset.metadata.expansion;
    for (const bucket of dataset.buckets) {
      const link = makeGroupBucketLink({
        bucket: bucket.bucket,
        expansion,
        label: `${expansion} ${bucket.level_range} Group Bucket`,
        title: `View ${expansion} group bucket ${bucket.bucket}`,
      });

      for (const itemName of bucket.loot_pool) {
        addBucketLink(links, normalizeItemName(itemName), { ...link, sourceName: itemName });
      }
    }
  }

  for (const dataset of raidDatasets) {
    for (const tier of dataset.tiers) {
      if (String(tier.tier).toLowerCase().includes("non-random")) continue;
      const tierLabel = typeof tier.tier === "number" ? `T${tier.tier}` : String(tier.tier);
      const link = makeRaidBucketLink({
        expansion: dataset.expansion,
        tier: tier.tier,
        label: `${dataset.expansion} ${tierLabel} Raid Bucket`,
        title: `View ${dataset.expansion} ${tierLabel} raid targets`,
      });

      for (const boss of tier.bosses) {
        for (const itemName of boss.loot_pool ?? []) {
          addBucketLink(links, normalizeItemName(itemName), { ...link, sourceName: itemName });
        }
      }
    }
  }

  return links;
}

function addBucketLink(map: Map<string, BucketLinkEntry[]>, key: string, link: BucketLinkEntry) {
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

function normalizeNpcOrMobName(value: string) {
  return normalizeMobName(value);
}

function normalizeItemName(value: string) {
  return value
    .toLowerCase()
    .replace(/[â€™`]/g, "'")
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

function stepLooksLikeDropAcquisition(step: NormalizedStep) {
  const text = [
    step.action,
    step.items,
    step.notes,
    step.phase,
  ].filter(Boolean).join(" ");

  return /\b(?:kill|loot|drops?|drop item|obtain|forage|ground spawn|retrieve|pickpocket|collect|dropped by)\b/i.test(text);
}

function splitItemCandidates(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/^(?:loot|drops?|reward|receive|obtain|obtained|pickpocket|forage|ground spawn|collect|buy|purchase):\s*/i, "")
    .split(/\s*(?:,|;|\+|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getStepItemCandidates(step: NormalizedStep) {
  const candidates = new Set<string>();

  for (const item of step.dropItems) {
    candidates.add(item.name);
  }

  if (stepLooksLikeDropAcquisition(step)) {
    for (const item of step.rewardItems) {
      candidates.add(item.name);
    }
    if (step.items) {
      for (const part of splitItemCandidates(step.items)) {
        candidates.add(part);
      }
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
    links.push(...(bucketLinksByMobName.get(normalizeNpcOrMobName(candidate)) ?? []));
  }
  for (const candidate of getStepItemCandidates(step)) {
    links.push(...(bucketLinksByItemName.get(normalizeItemName(candidate)) ?? []));
  }
  return dedupeLinks(links);
}
