"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { fetchUserSettings, saveUserSettings } from "@/lib/user-settings-client";

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

function hasProgress(store: EpicProgressStore) {
  return Object.values(store).some((progress) => progress.completed.length > 0 || progress.step > 0);
}

function mergeProgress(localStore: EpicProgressStore, remoteStore: EpicProgressStore): EpicProgressStore {
  const result: EpicProgressStore = { ...remoteStore };
  for (const [className, localProgress] of Object.entries(localStore)) {
    const remoteProgress = result[className] ?? defaultProgress();
    const completed = Array.from(new Set([...remoteProgress.completed, ...localProgress.completed])).sort((a, b) => a - b);
    result[className] = {
      step: Math.max(remoteProgress.step, localProgress.step, completed.length > 0 ? Math.max(...completed) : 0),
      completed,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const EpicProgressContext = createContext<EpicProgressContextValue | null>(null);

export function EpicProgressProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<EpicProgressStore>({});
  const [hydrated, setHydrated] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importPrompt, setImportPrompt] = useState<{ local: EpicProgressStore; remote: EpicProgressStore } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPayloadRef = useRef<string>("");
  const { status: authStatus, data: session } = useSession();
  const isSignedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    setStore(readStore());
    setHydrated(true);
  }, []);

  // Persist to localStorage for guests and as an offline fallback for signed-in users.
  useEffect(() => {
    if (!hydrated) return;
    writeStore(store);
  }, [hydrated, store]);

  useEffect(() => {
    if (!hydrated || authStatus === "loading") return;

    if (!isSignedIn) {
      setRemoteLoaded(false);
      setImportPrompt(null);
      setStatusMessage(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatusMessage("Loading saved progress...");
    setErrorMessage(null);

    fetchUserSettings()
      .then((settings) => {
        if (cancelled || !settings) return;
        const localStore = readStore();
        const remoteStore = settings.epicProgress as EpicProgressStore;
        const localHasProgress = hasProgress(localStore);
        const remoteHasProgress = hasProgress(remoteStore);

        if (localHasProgress && JSON.stringify(localStore) !== JSON.stringify(remoteStore)) {
          setImportPrompt({ local: localStore, remote: remoteStore });
          if (remoteHasProgress) {
            setStore(remoteStore);
          }
        } else {
          setStore(remoteStore);
        }
        setRemoteLoaded(true);
        setStatusMessage(null);
      })
      .catch(() => {
        if (cancelled) return;
        setRemoteLoaded(true);
        setStatusMessage(null);
        setErrorMessage("Signed-in progress could not be loaded. Local progress is still available.");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, hydrated, isSignedIn]);

  useEffect(() => {
    if (!hydrated || !isSignedIn || !remoteLoaded || importPrompt) return;
    const payload = JSON.stringify(store);
    if (payload === lastSavedPayloadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      setStatusMessage("Saving progress...");
      setErrorMessage(null);
      saveUserSettings({ epicProgress: store })
        .then(() => {
          lastSavedPayloadRef.current = payload;
          setStatusMessage(null);
        })
        .catch(() => {
          setStatusMessage(null);
          setErrorMessage("Progress could not be saved to your Discord account. It is still saved locally.");
        });
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, importPrompt, isSignedIn, remoteLoaded, store]);

  function importLocalProgress() {
    if (!importPrompt) return;
    const merged = mergeProgress(importPrompt.local, importPrompt.remote);
    setStore(merged);
    setImportPrompt(null);
    setRemoteLoaded(true);
    setStatusMessage("Saving imported progress...");
    saveUserSettings({ epicProgress: merged })
      .then(() => {
        lastSavedPayloadRef.current = JSON.stringify(merged);
        setStatusMessage(null);
      })
      .catch(() => {
        setStatusMessage(null);
        setErrorMessage("Imported progress is local for now; account sync failed.");
      });
  }

  function keepAccountProgress() {
    if (!importPrompt) return;
    setStore(importPrompt.remote);
    setImportPrompt(null);
    setRemoteLoaded(true);
  }

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

  return (
    <EpicProgressContext.Provider value={value}>
      {isSignedIn && (statusMessage || errorMessage || importPrompt) ? (
        <div className="user-sync-banner" role={errorMessage ? "alert" : "status"}>
          {importPrompt ? (
            <>
              <span>Local epic progress found. Import it into your Discord account?</span>
              <button onClick={importLocalProgress} type="button">Import</button>
              <button onClick={keepAccountProgress} type="button">Keep account</button>
            </>
          ) : (
            <span>{errorMessage ?? statusMessage}</span>
          )}
        </div>
      ) : null}
      {children}
    </EpicProgressContext.Provider>
  );
}

export function useEpicProgress(): EpicProgressContextValue {
  const context = useContext(EpicProgressContext);
  if (!context) {
    throw new Error("useEpicProgress must be used inside EpicProgressProvider");
  }
  return context;
}
