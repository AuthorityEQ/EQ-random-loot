"use client";

/**
 * ServerStatusBadge
 *
 * A small, self-contained badge that communicates Frostreaver's server phase.
 * Designed as a reusable Tier 0 launch feature — safe to drop anywhere.
 *
 * ─── Three phases ────────────────────────────────────────────────────────────
 *
 *   pre-launch  now < LAUNCH_DATE
 *     Yellow/amber badge: "Frostreaver launches in {N}d {H}h"
 *     Uses --warning-bg / --warning-text / --warning-border tokens.
 *
 *   live        LAUNCH_DATE ≤ now < LAUNCH_DATE + 30 days
 *     Pulsing green badge: "Frostreaver is LIVE"
 *     Uses --accent-soft / --accent tokens + CSS keyframe pulse.
 *     Pulse is suppressed via @media (prefers-reduced-motion: reduce).
 *
 *   active      now ≥ LAUNCH_DATE + 30 days
 *     Quiet green text: "Live"
 *     Uses --accent token only; no background/border.
 *
 * ─── SSR safety ──────────────────────────────────────────────────────────────
 *
 *   The component renders a neutral placeholder during the first render (before
 *   hydration) to prevent server/client HTML mismatch. The real phase resolves
 *   immediately after mount via useEffect → setMounted(true).
 *
 * ─── Timer ───────────────────────────────────────────────────────────────────
 *
 *   Updates every 60 seconds. Pre-launch text shows days + hours (no seconds)
 *   so per-minute resolution is sufficient and avoids needless re-renders.
 *
 * ─── Integration points (consolidation pass) ─────────────────────────────────
 *
 *   Nav bar (app/layout.tsx):
 *     Place <ServerStatusBadge /> inside .app-nav-controls beside <ServerToggle />.
 *     The badge is compact by design — it fits inline at the same height (34px min).
 *
 *     Example:
 *       import { ServerStatusBadge } from "@/components/ServerStatusBadge";
 *       // inside <div className="app-nav-controls">:
 *       <ServerStatusBadge />
 *       <ServerToggle />
 *
 *   Hero area (app/page.tsx):
 *     During pre-launch show the badge prominently below the hero heading.
 *     After launch (phase "active") omit it from the hero — the nav badge is enough.
 *     Gate on phase client-side to avoid flash; the badge already handles this.
 *
 *     Example:
 *       import { ServerStatusBadge } from "@/components/ServerStatusBadge";
 *       // inside the hero <div className="header">:
 *       <ServerStatusBadge />
 *
 *   The component never throws and renders null only when no phase can be determined
 *   (unreachable in practice), so it is safe to place unconditionally.
 *
 * ─── API ─────────────────────────────────────────────────────────────────────
 *
 *   <ServerStatusBadge />
 *
 *   Props: none. Self-contained — reads expansion-schedule.json at import time.
 *
 * ─── CSS class contract ──────────────────────────────────────────────────────
 *
 *   .server-status-badge              — base layout + typography
 *   .server-status-badge.is-prelaunch — amber/warning palette
 *   .server-status-badge.is-live      — accent palette + pulse animation
 *   .server-status-badge.is-active    — quiet accent text only
 *
 *   All classes are defined in app/globals.css (appended at the bottom).
 */

import { useEffect, useRef, useState } from "react";
import scheduleData from "@/data/expansion-schedule.json";

// ─── Constants ────────────────────────────────────────────────────────────────

const LAUNCH_MS = new Date(scheduleData.launch_at_iso).getTime();

/**
 * "Live" window: T0 to T0+30 days.
 * After 30 days the server is simply "Active" — the excited LIVE state fades.
 */
const LIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_START_MS = LAUNCH_MS + LIVE_WINDOW_MS;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "pre-launch" | "live" | "active";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPhase(now: number): Phase {
  if (now < LAUNCH_MS) return "pre-launch";
  if (now < ACTIVE_START_MS) return "live";
  return "active";
}

/**
 * Returns whole days and leftover hours until the launch date.
 * Both values are clamped to zero once past launch.
 */
function getCountdown(now: number): { days: number; hours: number } {
  const remaining = Math.max(0, LAUNCH_MS - now);
  const totalHours = Math.floor(remaining / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { days, hours };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ServerStatusBadge() {
  /**
   * mounted gates the phase computation so SSR renders an invisible placeholder.
   * This is the same pattern used by ThemeToggle / FavoritesProvider in this project.
   */
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // First paint: resolve real time and mark mounted
    setNow(Date.now());
    setMounted(true);

    // Tick every 60 s — per-minute resolution is enough for days/hours display
    timerRef.current = setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  // ── SSR / pre-hydration placeholder ────────────────────────────────────────
  // Render an invisible element with the same base class so the DOM node exists
  // but no content flashes during hydration.
  if (!mounted) {
    return (
      <span
        className="server-status-badge"
        aria-hidden="true"
        style={{ visibility: "hidden" }}
      />
    );
  }

  const phase = getPhase(now);

  // ── Pre-launch ──────────────────────────────────────────────────────────────
  if (phase === "pre-launch") {
    const { days, hours } = getCountdown(now);
    return (
      <span
        className="server-status-badge is-prelaunch"
        role="status"
        aria-label={`Frostreaver launches in ${days} days ${hours} hours`}
      >
        <span aria-hidden="true">🟡</span>
        {" Frostreaver launches in "}
        <strong>{days}d {hours}h</strong>
      </span>
    );
  }

  // ── Live (T0 to T0+30 days) ─────────────────────────────────────────────────
  if (phase === "live") {
    return (
      <span
        className="server-status-badge is-live"
        role="status"
        aria-label="Frostreaver is LIVE"
      >
        <span aria-hidden="true">🟢</span>
        {" Frostreaver is "}
        <strong>LIVE</strong>
      </span>
    );
  }

  // ── Active (T0+30 days onwards) ─────────────────────────────────────────────
  return (
    <span
      className="server-status-badge is-active"
      role="status"
      aria-label="Frostreaver — server active"
    >
      <span aria-hidden="true">🟢</span>
      {" Live"}
    </span>
  );
}
