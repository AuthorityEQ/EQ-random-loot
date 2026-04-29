import type { Bucket, Mob } from "@/lib/search";

export type UniversalSearchResult =
  | {
    type: "item";
    label: string;
    itemName: string;
    buckets: Bucket[];
  }
  | {
    type: "mob";
    label: string;
    mob: Mob;
    bucket: Bucket;
  };

type RankedResult = UniversalSearchResult & {
  rank: number;
};

const typeOrder = new Map<UniversalSearchResult["type"], number>([
  ["item", 0],
  ["mob", 1],
]);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function fuzzyMatches(value: string, query: string) {
  let queryIndex = 0;
  for (const char of value) {
    if (char === query[queryIndex]) {
      queryIndex += 1;
    }
    if (queryIndex === query.length) return true;
  }
  return false;
}

function matchRank(label: string, query: string) {
  const normalizedLabel = normalize(label);
  if (normalizedLabel.startsWith(query)) return 0;
  if (normalizedLabel.includes(query)) return 1;
  if (fuzzyMatches(normalizedLabel, query)) return 2;
  return null;
}

function sortResults(a: RankedResult, b: RankedResult) {
  return a.rank - b.rank
    || a.label.localeCompare(b.label)
    || (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99);
}

export function getUniversalSearchResults(
  buckets: Bucket[],
  query: string,
  itemIsVisible: (itemName: string) => boolean = () => true,
) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) {
    return {
      items: [] as UniversalSearchResult[],
      mobs: [] as UniversalSearchResult[],
    };
  }

  const itemMap = new Map<string, Bucket[]>();
  const mobMap = new Map<string, { mob: Mob; bucket: Bucket }>();

  for (const bucket of buckets) {
    for (const itemName of bucket.loot_pool) {
      if (!itemIsVisible(itemName)) continue;
      itemMap.set(itemName, [...(itemMap.get(itemName) ?? []), bucket]);
    }

    for (const mob of bucket.mobs) {
      mobMap.set(`${bucket.expansion}-${bucket.bucket}-${mob.zone}-${mob.level}-${mob.name}`, { mob, bucket });
    }
  }

  const items = Array.from(itemMap.entries())
    .map(([itemName, itemBuckets]): RankedResult | null => {
      const rank = matchRank(itemName, normalizedQuery);
      return rank === null ? null : {
        type: "item",
        label: itemName,
        itemName,
        buckets: itemBuckets,
        rank,
      };
    })
    .filter((entry): entry is RankedResult => Boolean(entry))
    .sort(sortResults)
    .slice(0, 8);

  const mobs = Array.from(mobMap.values())
    .map(({ mob, bucket }): (RankedResult & { type: "mob" }) | null => {
      const rank = matchRank(mob.name, normalizedQuery);
      return rank === null ? null : {
        type: "mob",
        label: mob.name,
        mob,
        bucket,
        rank,
      };
    })
    .filter((entry): entry is RankedResult & { type: "mob" } => Boolean(entry))
    .sort((a, b) => sortResults(a, b) || a.mob.zone.localeCompare(b.mob.zone))
    .slice(0, 8);

  return { items, mobs };
}
