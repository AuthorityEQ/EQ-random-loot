/**
 * GET /api/items/[slug]
 *
 * Returns a single item by its URL slug (e.g. "cloak-of-flames").
 *
 * Response shape:
 *   { data: { item: ItemDetails & { slug: string } }, meta: {...} }
 */

export const revalidate = 86400;

import itemDetailsData from "@/data/item-details.json";
import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import type { ItemDetailsMap, LootDataset } from "@/lib/search";
import { buildItemSlugMap } from "@/lib/item-slug";
import { bucketWithItemSpecificMobs } from "@/lib/item-source-overrides";
import { jsonOk, jsonNotFound, corsOptions } from "@/lib/api-helpers";

const itemDetails = itemDetailsData as ItemDetailsMap;
const allDatasets = [classicData, kunarkData, veliousData] as LootDataset[];

const { slugToName, nameToSlug } = buildItemSlugMap(itemDetails);

// Which buckets contain this item — computed once
function bucketsForItem(itemName: string) {
  return allDatasets.flatMap((ds) =>
    ds.buckets
      .filter((b) => b.loot_pool.includes(itemName))
      .map((b) => {
        const displayBucket = bucketWithItemSpecificMobs(b, itemName);
        return {
          expansion: displayBucket.expansion,
          bucket: displayBucket.bucket,
          levelRange: displayBucket.level_range,
          zones: displayBucket.zones,
        };
      }),
  );
}

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const itemName = slugToName.get(slug);

  if (!itemName) {
    return jsonNotFound(`No item found for slug "${slug}"`);
  }

  const details = itemDetails[itemName];
  if (!details) {
    return jsonNotFound(`Item data not available for "${itemName}"`);
  }

  return jsonOk({
    item: {
      slug: nameToSlug.get(itemName) ?? slug,
      ...details,
      foundInBuckets: bucketsForItem(itemName),
    },
  });
}
