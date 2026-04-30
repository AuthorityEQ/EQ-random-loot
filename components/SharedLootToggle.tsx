"use client";

import { useEffect, useState } from "react";
import { useServer } from "@/components/ServerProvider";
import { isRandomLootServer } from "@/lib/server";

const STORAGE_KEY = "frostreaver-shared-loot";

type Value = "auto" | "on" | "off";

function readStored(): Value {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "on" || v === "off" ? v : "auto";
}

export function useSharedLoot() {
  const { server } = useServer();
  const [override, setOverride] = useState<Value>("auto");

  useEffect(() => {
    setOverride(readStored());
  }, []);

  const enabled =
    override === "auto" ? isRandomLootServer(server) : override === "on";

  function set(next: Value) {
    setOverride(next);
    if (typeof window !== "undefined") {
      if (next === "auto") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    }
  }

  return { enabled, override, set };
}

export function SharedLootToggle() {
  const { enabled, set } = useSharedLoot();

  return (
    <div className="shared-loot-toggle" aria-label="Shared loot mode">
      <span>Shared Loot</span>
      <button
        aria-pressed={enabled}
        className={`theme-toggle-button${enabled ? " is-active" : ""}`}
        onClick={() => set(enabled ? "off" : "on")}
        type="button"
      >
        {enabled ? "On" : "Off"}
      </button>
    </div>
  );
}
