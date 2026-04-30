"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_SERVER, SERVER_IDS, type ServerId } from "@/lib/server";

// ---------------------------------------------------------------------------
// Context contract
// ---------------------------------------------------------------------------

type ServerContextValue = {
  server: ServerId;
  setServer: (server: ServerId) => void;
};

const ServerContext = createContext<ServerContextValue | null>(null);

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const storageKey = "frostreaver-server";

/**
 * Migration aliases for historical storage values → canonical ServerId.
 * Populated on a per-need basis; empty for the initial launch.
 *
 * Example (when a server is renamed in the future):
 *   ["old-server-name", "frostreaver"],
 */
const serverAliases = new Map<string, ServerId>([]);

function resolveStoredValue(raw: string | null): ServerId | null {
  if (raw === null) return null;
  const direct = SERVER_IDS.find((id) => id === raw);
  if (direct) return direct;
  return serverAliases.get(raw) ?? null;
}

// ---------------------------------------------------------------------------
// Boot-time read
//
// Mirror the inline boot script logic so React state is consistent with what
// the script already stamped onto document.documentElement.dataset.server.
// Reads URL param first (same priority order as the boot script).
// ---------------------------------------------------------------------------

function readInitialServer(): ServerId {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("server");
    const fromParam = resolveStoredValue(param);
    if (fromParam) return fromParam;

    const fromStorage = resolveStoredValue(
      window.localStorage.getItem(storageKey),
    );
    return fromStorage ?? DEFAULT_SERVER;
  } catch {
    return DEFAULT_SERVER;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ServerProvider({ children }: { children: React.ReactNode }) {
  // Start with the default; swap in the real value after mount to avoid
  // hydration mismatches (same pattern as FavoritesProvider / ThemeToggle).
  const [server, setServerState] = useState<ServerId>(DEFAULT_SERVER);

  useEffect(() => {
    const initial = readInitialServer();
    setServerState(initial);
    document.documentElement.dataset.server = initial;
  }, []);

  const value = useMemo<ServerContextValue>(() => {
    function setServer(next: ServerId) {
      setServerState(next);
      document.documentElement.dataset.server = next;
      window.localStorage.setItem(storageKey, next);
    }

    return { server, setServer };
  }, [server]);

  return (
    <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useServer(): ServerContextValue {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error("useServer must be used inside ServerProvider");
  }
  return context;
}
