"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { fetchUserSettings, saveUserSettings } from "@/lib/user-settings-client";

type BucketDisplayContextValue = {
  bucketed: boolean;
  setBucketed: (bucketed: boolean) => void;
};

const storageKey = "frostreaver-bucket-display";
const BucketDisplayContext = createContext<BucketDisplayContextValue | null>(null);

function readBucketed() {
  try {
    return window.localStorage.getItem(storageKey) !== "off";
  } catch {
    return true;
  }
}

export function BucketDisplayProvider({ children }: { children: React.ReactNode }) {
  const [bucketed, setBucketedState] = useState(true);
  const [ready, setReady] = useState(false);
  const { status: authStatus, data: session } = useSession();
  const isSignedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  useEffect(() => {
    setBucketedState(readBucketed());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !isSignedIn) return;
    let cancelled = false;
    fetchUserSettings()
      .then((settings) => {
        const remoteBucketed = settings?.preferences.bucketed;
        if (!cancelled && typeof remoteBucketed === "boolean") {
          setBucketedState(remoteBucketed);
          window.localStorage.setItem(storageKey, remoteBucketed ? "on" : "off");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, ready]);

  function setBucketed(nextBucketed: boolean) {
    setBucketedState(nextBucketed);
    window.localStorage.setItem(storageKey, nextBucketed ? "on" : "off");
    if (isSignedIn) {
      window.setTimeout(() => {
        saveUserSettings({ preferences: { bucketed: nextBucketed } }).catch(() => {});
      }, 400);
    }
  }

  const value = useMemo(() => ({ bucketed, setBucketed }), [bucketed]);

  return <BucketDisplayContext.Provider value={value}>{children}</BucketDisplayContext.Provider>;
}

export function useBucketDisplay() {
  const context = useContext(BucketDisplayContext);
  if (!context) {
    throw new Error("useBucketDisplay must be used inside BucketDisplayProvider");
  }
  return context;
}
