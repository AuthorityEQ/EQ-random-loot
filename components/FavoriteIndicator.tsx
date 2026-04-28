"use client";

import { useFavorites } from "@/components/FavoritesProvider";
import type { ItemDetails } from "@/lib/search";

type FavoriteIndicatorProps = {
  itemName: string;
  details?: ItemDetails;
};

export function FavoriteIndicator({ itemName, details }: FavoriteIndicatorProps) {
  const { isFavorite } = useFavorites();
  const active = isFavorite(itemName, details);

  return (
    <span aria-hidden="true" className={active ? "favorite-indicator is-active" : "favorite-indicator"}>
      {active ? "★" : "☆"}
    </span>
  );
}
