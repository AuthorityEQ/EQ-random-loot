"use client";

import { useServer } from "@/components/ServerProvider";
import type { ServerId } from "@/lib/server";

// ---------------------------------------------------------------------------
// Label map — display name for each server id
// ---------------------------------------------------------------------------

const SERVER_LABELS: Record<ServerId, string> = {
  frostreaver: "Frostreaver",
  teek: "Teek",
  mischief: "Mischief",
};

const SERVER_ORDER: ServerId[] = ["frostreaver", "teek", "mischief"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServerToggle() {
  const { server, setServer } = useServer();

  return (
    <div className="server-toggle" aria-label="Server">
      {SERVER_ORDER.map((id) => (
        <button
          aria-pressed={server === id}
          className={
            server === id
              ? "server-toggle-button is-active"
              : "server-toggle-button"
          }
          key={id}
          onClick={() => setServer(id)}
          type="button"
        >
          {SERVER_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
