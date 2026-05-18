"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { fetchUserSettings, saveUserSettings } from "@/lib/user-settings-client";
import { normalizeSavedCraftingRecipeIds } from "@/lib/crafting-recipe-ids";

type SavedCraftingRecipesContextValue = {
  savedRecipeIds: Set<string>;
  ready: boolean;
  isSaved: (recipeId: string) => boolean;
  saveRecipe: (recipeId: string) => void;
  removeRecipe: (recipeId: string) => void;
  toggleRecipe: (recipeId: string) => boolean;
};

const storageKey = "loot-goblin-saved-crafting-recipes-v1";
const SavedCraftingRecipesContext = createContext<SavedCraftingRecipesContextValue | null>(null);

function readLocalSavedRecipeIds() {
  try {
    return normalizeSavedCraftingRecipeIds(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]"));
  } catch {
    return [];
  }
}

function writeLocalSavedRecipeIds(ids: string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // localStorage may be unavailable in private browsing or quota-limited modes.
  }
}

function sortedIds(ids: Iterable<string>) {
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

export function SavedCraftingRecipesProvider({ children }: { children: React.ReactNode }) {
  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCloudPayloadRef = useRef("");
  const { status: authStatus, data: session } = useSession();
  const isSignedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  useEffect(() => {
    setSavedRecipeIds(readLocalSavedRecipeIds());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLocalSavedRecipeIds(savedRecipeIds);
  }, [hydrated, savedRecipeIds]);

  useEffect(() => {
    if (!hydrated || authStatus === "loading") return;

    if (!isSignedIn) {
      setCloudReady(false);
      lastCloudPayloadRef.current = "";
      return;
    }

    let cancelled = false;
    setCloudReady(false);

    fetchUserSettings()
      .then((settings) => {
        if (cancelled || !settings) return;
        const localIds = readLocalSavedRecipeIds();
        const remoteIds = normalizeSavedCraftingRecipeIds(settings.preferences.savedCraftingRecipeIds);
        const merged = sortedIds([...remoteIds, ...localIds]);
        const payload = JSON.stringify(merged);

        setSavedRecipeIds(merged);
        writeLocalSavedRecipeIds(merged);
        lastCloudPayloadRef.current = payload;
        setCloudReady(true);

        if (payload !== JSON.stringify(remoteIds)) {
          saveUserSettings({ preferences: { savedCraftingRecipeIds: merged } }).catch(() => {});
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCloudReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, hydrated, isSignedIn, session?.user?.discordUserId]);

  useEffect(() => {
    if (!hydrated || !isSignedIn || !cloudReady) return;
    const payload = JSON.stringify(savedRecipeIds);
    if (payload === lastCloudPayloadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      saveUserSettings({ preferences: { savedCraftingRecipeIds: savedRecipeIds } })
        .then(() => {
          lastCloudPayloadRef.current = payload;
        })
        .catch(() => {});
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [cloudReady, hydrated, isSignedIn, savedRecipeIds]);

  const savedSet = useMemo(() => new Set(savedRecipeIds), [savedRecipeIds]);

  const saveRecipe = useCallback((recipeId: string) => {
    setSavedRecipeIds((current) => sortedIds([...current, recipeId]));
  }, []);

  const removeRecipe = useCallback((recipeId: string) => {
    setSavedRecipeIds((current) => current.filter((id) => id !== recipeId));
  }, []);

  const isSaved = useCallback((recipeId: string) => savedSet.has(recipeId), [savedSet]);

  const toggleRecipe = useCallback((recipeId: string) => {
    const currentlySaved = savedSet.has(recipeId);
    if (currentlySaved) removeRecipe(recipeId);
    else saveRecipe(recipeId);
    return !currentlySaved;
  }, [removeRecipe, saveRecipe, savedSet]);

  const value = useMemo<SavedCraftingRecipesContextValue>(() => ({
    savedRecipeIds: savedSet,
    ready: hydrated,
    isSaved,
    saveRecipe,
    removeRecipe,
    toggleRecipe,
  }), [hydrated, isSaved, removeRecipe, saveRecipe, savedSet, toggleRecipe]);

  return (
    <SavedCraftingRecipesContext.Provider value={value}>
      {children}
    </SavedCraftingRecipesContext.Provider>
  );
}

export function useSavedCraftingRecipes() {
  const context = useContext(SavedCraftingRecipesContext);
  if (!context) {
    throw new Error("useSavedCraftingRecipes must be used inside SavedCraftingRecipesProvider");
  }
  return context;
}
