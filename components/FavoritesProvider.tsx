"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getFavoriteId, type FavoriteItem } from "@/lib/favorites";
import type { ItemDetails } from "@/lib/search";

type FavoritesContextValue = {
  favorites: FavoriteItem[];
  isFavorite: (itemName: string, details?: ItemDetails) => boolean;
  toggleFavorite: (itemName: string, details?: ItemDetails) => void;
};

const storageKey = "frostreaver-favorites";
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readFavorites() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is FavoriteItem => typeof item?.id === "string" && typeof item?.name === "string")
      : [];
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(favorites));
  }, [favorites]);

  const value = useMemo<FavoritesContextValue>(() => {
    function isFavorite(itemName: string, details?: ItemDetails) {
      const id = getFavoriteId(itemName, details);
      return favorites.some((favorite) => favorite.id === id);
    }

    function toggleFavorite(itemName: string, details?: ItemDetails) {
      const id = getFavoriteId(itemName, details);
      setFavorites((current) => {
        if (current.some((favorite) => favorite.id === id)) {
          return current.filter((favorite) => favorite.id !== id);
        }

        return [...current, { id, name: itemName }].sort((a, b) => a.name.localeCompare(b.name));
      });
    }

    return { favorites, isFavorite, toggleFavorite };
  }, [favorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used inside FavoritesProvider");
  }
  return context;
}
