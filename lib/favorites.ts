import type { ItemDetails } from "@/lib/search";

export type FavoriteItem = {
  id: string;
  name: string;
};

export function getFavoriteId(itemName: string, details?: ItemDetails) {
  const sourceUrl = details?.sources?.find((source) => source.name === "Allakhazam")?.url;
  const itemId = sourceUrl?.match(/[?&]item=(\d+)/i)?.[1];
  return itemId ? `zam:${itemId}` : `name:${itemName.toLowerCase()}`;
}
