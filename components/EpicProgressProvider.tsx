"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClassName =
  | "Bard"
  | "Cleric"
  | "Druid"
  | "Enchanter"
  | "Magician"
  | "Monk"
  | "Necromancer"
  | "Paladin"
  | "Ranger"
  | "Rogue"
  | "Shadowknight"
  | "Shaman"
  | "Warrior"
  | "Wizard";

export type ClassProgress = {
  /** The highest step index the player has reached (0-based). */
  step: number;
  /** Array of 0-based step indices the player has explicitly checked off. */
  completed: number[];
};

type EpicProgressStore = Record<string, ClassProgress>;

type EpicProgressContextValue = {
  getProgress: (className: ClassName) => ClassProgress;
  markStepComplete: (className: ClassName, stepIndex: number) => void;
  unmarkStep: (className: ClassName, stepIndex: number) => void;
  clearProgress: (className: ClassName) => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "frostreaver-epic-progress";

/**
 * Migration aliases — map old storage keys to canonical class names.
 * Empty for now; add entries here when class names are renamed in future data.
 * Format: ["old-key", "CanonicalClassName"]
 */
const migrationAliases = new Map<string, ClassName>([
  // example: ["paladin-old", "Paladin"],
]);

const defaultProgress = (): ClassProgress => ({ step: 0, completed: [] });

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readStore(): EpicProgressStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    const result: EpicProgressStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const rec = value as Record<string, unknown>;
      const step = typeof rec.step === "number" ? rec.step : 0;
      const completed = Array.isArray(rec.completed)
        ? (rec.completed as unknown[]).filter((n): n is number => typeof n === "number")
        : [];

      // Apply migration aliases
      const canonical = migrationAliases.get(key) ?? key;
      result[canonical] = { step, completed };
    }
    return result;
  } catch {
    return {};
  }
}

function writeStore(store: EpicProgressStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage may be unavailable (private browsing quota, etc.)
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const EpicProgressContext = createContext<EpicProgressContextValue | null>(null);

export function EpicProgressProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<EpicProgressStore>({});

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    setStore(readStore());
  }, []);

  // Persist on every change
  useEffect(() => {
    writeStore(store);
  }, [store]);

  const getProgress = useCallback(
    (className: ClassName): ClassProgress => store[className] ?? defaultProgress(),
    [store],
  );

  const markStepComplete = useCallback((className: ClassName, stepIndex: number) => {
    setStore((current) => {
      const prev = current[className] ?? defaultProgress();
      if (prev.completed.includes(stepIndex)) return current;
      const next: ClassProgress = {
        step: Math.max(prev.step, stepIndex),
        completed: [...prev.completed, stepIndex].sort((a, b) => a - b),
      };
      return { ...current, [className]: next };
    });
  }, []);

  const unmarkStep = useCallback((className: ClassName, stepIndex: number) => {
    setStore((current) => {
      const prev = current[className] ?? defaultProgress();
      if (!prev.completed.includes(stepIndex)) return current;
      const nextCompleted = prev.completed.filter((n) => n !== stepIndex);
      const next: ClassProgress = {
        step: nextCompleted.length > 0 ? Math.max(...nextCompleted) : 0,
        completed: nextCompleted,
      };
      return { ...current, [className]: next };
    });
  }, []);

  const clearProgress = useCallback((className: ClassName) => {
    setStore((current) => {
      const next = { ...current };
      delete next[className];
      return next;
    });
  }, []);

  const value = useMemo<EpicProgressContextValue>(
    () => ({ getProgress, markStepComplete, unmarkStep, clearProgress }),
    [getProgress, markStepComplete, unmarkStep, clearProgress],
  );

  return <EpicProgressContext.Provider value={value}>{children}</EpicProgressContext.Provider>;
}

export function useEpicProgress(): EpicProgressContextValue {
  const context = useContext(EpicProgressContext);
  if (!context) {
    throw new Error("useEpicProgress must be used inside EpicProgressProvider");
  }
  return context;
}
