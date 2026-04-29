"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

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

  useEffect(() => {
    setBucketedState(readBucketed());
  }, []);

  function setBucketed(nextBucketed: boolean) {
    setBucketedState(nextBucketed);
    window.localStorage.setItem(storageKey, nextBucketed ? "on" : "off");
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
