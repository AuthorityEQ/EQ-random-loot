import type { Bucket } from "@/lib/search";

export type ItemBucketMatch = {
  bucket: Bucket;
  itemName: string;
};

export type ItemSearchMatch = {
  itemName: string;
  buckets: Bucket[];
};

export function findItemSearchMatch(buckets: Bucket[], query: string): ItemSearchMatch | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const itemNames = Array.from(new Set(buckets.flatMap((bucket) => bucket.loot_pool)));
  const exact = itemNames.find((itemName) => itemName.toLowerCase() === normalizedQuery);
  const partialMatches = itemNames.filter((itemName) => itemName.toLowerCase().includes(normalizedQuery));
  const itemName = exact ?? (partialMatches.length === 1 ? partialMatches[0] : null);

  if (!itemName) return null;

  const itemBuckets = buckets.filter((bucket) => bucket.loot_pool.includes(itemName));
  if (itemBuckets.length === 0) return null;

  return {
    itemName,
    buckets: itemBuckets,
  };
}
