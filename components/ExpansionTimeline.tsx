"use client";

/**
 * ExpansionTimeline
 *
 * Displays a launch countdown and expansion unlock tracker for Frostreaver.
 *
 * Integration note for consolidation pass:
 *   In app/page.tsx, import this component and place it just below the <header>
 *   and above the <div className="toolbar">. Use full mode (compact={false}, the
 *   default) on the home page. Use compact={true} if/when added to the nav bar.
 *
 *   Example:
 *     import { ExpansionTimeline } from "@/components/ExpansionTimeline";
 *     // inside the <main className="page"> return:
 *     <ExpansionTimeline />
 *
 *   The component is gated on data-server="frostreaver" set by the ServerProvider
 *   boot script on <html>. If the attribute is absent or set to a different value
 *   the component renders nothing — safe to place unconditionally once the
 *   ServerProvider boot script is wired in.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import scheduleData from "@/data/expansion-schedule.json";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpansionEntry = {
  name: string;
  unlock_iso: string | null;
  tentative: boolean;
  tone: string;
  estimated_after_weeks?: number;
};

type TimeLeft = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LAUNCH_DATE = new Date(scheduleData.launch_at_iso);
/** "Launch week" ends 5 days after launch at 19:00 UTC */
const LAUNCH_WEEK_END = new Date(LAUNCH_DATE.getTime() + 5 * 24 * 60 * 60 * 1000);
const EXPANSIONS = scheduleData.expansions as ExpansionEntry[];
const SERVER = scheduleData.server;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeTimeLeft(targetMs: number): TimeLeft {
  const totalMs = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalMs, days, hours, minutes, seconds };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatLaunchDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

function formatUnlockDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

function estimatedUnlockDate(launchDate: Date, afterWeeks: number): Date {
  return new Date(launchDate.getTime() + afterWeeks * 7 * 24 * 60 * 60 * 1000);
}

function relativeWeeks(targetDate: Date): string {
  const diffMs = targetDate.getTime() - Date.now();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffWeeks) >= 1) {
    return rtf.format(diffWeeks, "week");
  }
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return rtf.format(diffDays, "day");
}

function isServerMatch(): boolean {
  if (typeof document === "undefined") return false;
  const attr = document.documentElement.dataset.server;
  // If the attribute is not set at all (ServerProvider not yet wired),
  // we still render to allow development without the boot script.
  if (attr === undefined) return true;
  return attr === SERVER;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type CountdownBlockProps = {
  value: number;
  label: string;
};

function CountdownBlock({ value, label }: CountdownBlockProps) {
  return (
    <div className="etl-clock-block">
      <span className="etl-clock-digits">{pad(value)}</span>
      <span className="etl-clock-label">{label}</span>
    </div>
  );
}

type ExpansionRowProps = {
  expansion: ExpansionEntry;
  status: "unlocked" | "next" | "future";
  compact: boolean;
  nextUnlockDate?: Date | null;
};

function ExpansionRow({ expansion, status, compact, nextUnlockDate }: ExpansionRowProps) {
  const toneClass = `expansion-tone-${expansion.tone}`;
  const statusLabel =
    status === "unlocked" ? "Unlocked" :
    status === "next" ? "Next" :
    "Upcoming";

  const dateText = useMemo(() => {
    if (expansion.unlock_iso) {
      return formatUnlockDate(expansion.unlock_iso);
    }
    if (expansion.estimated_after_weeks !== undefined) {
      const est = estimatedUnlockDate(LAUNCH_DATE, expansion.estimated_after_weeks);
      return `~${formatUnlockDate(est.toISOString())}`;
    }
    return "TBD";
  }, [expansion]);

  const relativeText = useMemo(() => {
    if (status === "unlocked") return null;
    if (expansion.unlock_iso) {
      const d = new Date(expansion.unlock_iso);
      if (d > new Date()) return relativeWeeks(d);
      return null;
    }
    if (expansion.estimated_after_weeks !== undefined) {
      const est = estimatedUnlockDate(LAUNCH_DATE, expansion.estimated_after_weeks);
      return relativeWeeks(est);
    }
    return null;
  }, [expansion, status]);

  return (
    <div
      className={[
        "etl-expansion-row",
        toneClass,
        `etl-expansion-row--${status}`,
        compact ? "etl-expansion-row--compact" : null,
      ].filter(Boolean).join(" ")}
      aria-label={`${expansion.name}: ${statusLabel}`}
    >
      <div className="etl-expansion-left">
        <span className="etl-expansion-status-dot" aria-hidden="true" />
        <span className="etl-expansion-name">{expansion.name}</span>
        {expansion.tentative && status !== "unlocked" ? (
          <span className="etl-tentative-badge" title="Date not yet confirmed by Daybreak">
            tentative
          </span>
        ) : null}
      </div>
      <div className="etl-expansion-right">
        {!compact ? (
          <span className="etl-expansion-date">{dateText}</span>
        ) : null}
        {relativeText ? (
          <span className="etl-expansion-relative">{relativeText}</span>
        ) : null}
        {status === "next" && nextUnlockDate && !expansion.tentative ? (
          <span className="etl-expansion-next-label">Next</span>
        ) : null}
        {status === "unlocked" ? (
          <span className="etl-expansion-unlocked-badge">Live</span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ExpansionTimelineProps = {
  /**
   * compact=true: single-line countdown for nav bar use.
   * compact=false (default): full panel for home page use.
   */
  compact?: boolean;
};

export function ExpansionTimeline({ compact = false }: ExpansionTimelineProps) {
  const labelId = useId();
  const [now, setNow] = useState<number>(0);
  const [serverMatch, setServerMatch] = useState<boolean>(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydrate server-match check client-side only (document not available in SSR)
  useEffect(() => {
    setServerMatch(isServerMatch());
  }, []);

  // Tick every second while pre-launch, every minute after
  useEffect(() => {
    setNow(Date.now());
    const isPreLaunch = Date.now() < LAUNCH_DATE.getTime();
    const interval = isPreLaunch ? 1000 : 60_000;

    tickRef.current = setInterval(() => {
      setNow(Date.now());
    }, interval);

    return () => {
      if (tickRef.current !== null) clearInterval(tickRef.current);
    };
  }, []);

  const phase: "pre-launch" | "launch-week" | "post-launch" = useMemo(() => {
    if (now < LAUNCH_DATE.getTime()) return "pre-launch";
    if (now < LAUNCH_WEEK_END.getTime()) return "launch-week";
    return "post-launch";
  }, [now]);

  const timeToLaunch = useMemo(
    () => computeTimeLeft(LAUNCH_DATE.getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now],
  );

  const unlockedExpansions = useMemo(() => {
    if (phase === "pre-launch") return [];
    return EXPANSIONS.filter((exp) => {
      if (!exp.unlock_iso) return false;
      return new Date(exp.unlock_iso).getTime() <= now;
    });
  }, [phase, now]);

  const nextExpansion = useMemo(() => {
    if (phase === "pre-launch") return null;
    return EXPANSIONS.find((exp) => {
      if (exp.unlock_iso) return new Date(exp.unlock_iso).getTime() > now;
      return true; // tentative / no date yet
    }) ?? null;
  }, [phase, now]);

  const nextUnlockDate = useMemo<Date | null>(() => {
    if (!nextExpansion) return null;
    if (nextExpansion.unlock_iso) return new Date(nextExpansion.unlock_iso);
    if (nextExpansion.estimated_after_weeks !== undefined) {
      return estimatedUnlockDate(LAUNCH_DATE, nextExpansion.estimated_after_weeks);
    }
    return null;
  }, [nextExpansion]);

  const timeToNext = useMemo(() => {
    if (!nextUnlockDate || !nextExpansion?.unlock_iso) return null;
    return computeTimeLeft(nextUnlockDate.getTime());
  }, [nextExpansion, nextUnlockDate, now]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!serverMatch) return null;

  // ─── Compact mode ──────────────────────────────────────────────────────────

  if (compact) {
    if (phase === "pre-launch") {
      return (
        <div className="etl-compact" aria-label="Frostreaver launch countdown">
          <span className="etl-compact-label">Launch in</span>
          <span className="etl-compact-countdown">
            {now === 0 ? "—" : `${timeToLaunch.days}d ${pad(timeToLaunch.hours)}h ${pad(timeToLaunch.minutes)}m`}
          </span>
        </div>
      );
    }
    if (phase === "launch-week") {
      return (
        <div className="etl-compact etl-compact--live" aria-label="Frostreaver is live">
          <span className="etl-compact-live-dot" aria-hidden="true" />
          <span className="etl-compact-label">Frostreaver is LIVE</span>
        </div>
      );
    }
    if (nextExpansion && timeToNext) {
      return (
        <div className="etl-compact" aria-label={`Next unlock: ${nextExpansion.name}`}>
          <span className="etl-compact-label">{nextExpansion.name} in</span>
          <span className="etl-compact-countdown">
            {timeToNext.days}d {pad(timeToNext.hours)}h
          </span>
        </div>
      );
    }
    if (nextExpansion) {
      return (
        <div className="etl-compact" aria-label={`Next expansion: ${nextExpansion.name}`}>
          <span className="etl-compact-label">{nextExpansion.name}</span>
          <span className="etl-compact-tbd">schedule TBD</span>
        </div>
      );
    }
    return null;
  }

  // ─── Full mode ─────────────────────────────────────────────────────────────

  return (
    <section
      className="etl-panel"
      aria-labelledby={labelId}
      data-phase={phase}
    >
      {/* Pre-launch: big countdown */}
      {phase === "pre-launch" ? (
        <>
          <div className="etl-header">
            <p className="eyebrow" id={labelId}>Server Launch</p>
            <h2 className="etl-title">
              Frostreaver launches in
            </h2>
            <p className="etl-launch-human">{scheduleData.launch_at_human}</p>
          </div>

          <div className="etl-clock" aria-label={`${timeToLaunch.days} days, ${timeToLaunch.hours} hours, ${timeToLaunch.minutes} minutes, ${timeToLaunch.seconds} seconds`} role="timer">
            {now === 0 ? (
              <span className="etl-clock-placeholder">—</span>
            ) : (
              <>
                <CountdownBlock value={timeToLaunch.days} label="days" />
                <span className="etl-clock-sep" aria-hidden="true">:</span>
                <CountdownBlock value={timeToLaunch.hours} label="hrs" />
                <span className="etl-clock-sep" aria-hidden="true">:</span>
                <CountdownBlock value={timeToLaunch.minutes} label="min" />
                <span className="etl-clock-sep" aria-hidden="true">:</span>
                <CountdownBlock value={timeToLaunch.seconds} label="sec" />
              </>
            )}
          </div>

          <div className="etl-launch-content">
            <p className="etl-launch-content-label">Unlocked at launch</p>
            <div className="etl-expansion-list">
              {EXPANSIONS.filter((exp) => !exp.tentative).map((exp) => (
                <ExpansionRow
                  key={exp.name}
                  expansion={exp}
                  status="unlocked"
                  compact={false}
                />
              ))}
            </div>
          </div>

          {EXPANSIONS.some((exp) => exp.tentative) ? (
            <div className="etl-upcoming">
              <p className="etl-upcoming-label">Upcoming (tentative)</p>
              <div className="etl-expansion-list">
                {EXPANSIONS.filter((exp) => exp.tentative).map((exp) => (
                  <ExpansionRow
                    key={exp.name}
                    expansion={exp}
                    status="future"
                    compact={false}
                  />
                ))}
              </div>
              <p className="etl-caveat">{scheduleData.schedule_caveat}</p>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Launch week: live banner */}
      {phase === "launch-week" ? (
        <>
          <div className="etl-live-banner" role="status">
            <span className="etl-live-dot" aria-hidden="true" />
            <span id={labelId}>Frostreaver is LIVE</span>
          </div>

          <div className="etl-expansion-list">
            {unlockedExpansions.map((exp) => (
              <ExpansionRow
                key={exp.name}
                expansion={exp}
                status="unlocked"
                compact={false}
              />
            ))}
            {nextExpansion ? (
              <ExpansionRow
                key={nextExpansion.name}
                expansion={nextExpansion}
                status="next"
                compact={false}
                nextUnlockDate={nextUnlockDate}
              />
            ) : null}
            {EXPANSIONS.filter(
              (exp) =>
                exp !== nextExpansion &&
                !unlockedExpansions.includes(exp),
            ).map((exp) => (
              <ExpansionRow
                key={exp.name}
                expansion={exp}
                status="future"
                compact={false}
              />
            ))}
          </div>

          {nextExpansion?.tentative ? (
            <p className="etl-caveat">{scheduleData.schedule_caveat}</p>
          ) : null}
        </>
      ) : null}

      {/* Post-launch: unlocked + next countdown */}
      {phase === "post-launch" ? (
        <>
          <div className="etl-header">
            <p className="eyebrow" id={labelId}>Expansion Timeline</p>
            <h2 className="etl-title">Frostreaver</h2>
          </div>

          <div className="etl-expansion-list">
            {unlockedExpansions.map((exp) => (
              <ExpansionRow
                key={exp.name}
                expansion={exp}
                status="unlocked"
                compact={false}
              />
            ))}
            {nextExpansion ? (
              <ExpansionRow
                key={nextExpansion.name}
                expansion={nextExpansion}
                status="next"
                compact={false}
                nextUnlockDate={nextUnlockDate}
              />
            ) : null}
            {EXPANSIONS.filter(
              (exp) =>
                exp !== nextExpansion &&
                !unlockedExpansions.includes(exp),
            ).map((exp) => (
              <ExpansionRow
                key={exp.name}
                expansion={exp}
                status="future"
                compact={false}
              />
            ))}
          </div>

          {nextExpansion && timeToNext ? (
            <div className="etl-next-unlock">
              <p className="etl-next-unlock-label">
                {nextExpansion.name} unlocks in
              </p>
              <div className="etl-clock etl-clock--small" role="timer" aria-label={`${timeToNext.days} days until ${nextExpansion.name}`}>
                <CountdownBlock value={timeToNext.days} label="days" />
                <span className="etl-clock-sep" aria-hidden="true">:</span>
                <CountdownBlock value={timeToNext.hours} label="hrs" />
                <span className="etl-clock-sep" aria-hidden="true">:</span>
                <CountdownBlock value={timeToNext.minutes} label="min" />
              </div>
            </div>
          ) : nextExpansion ? (
            <p className="etl-caveat">
              {nextExpansion.name} — {scheduleData.schedule_caveat}
            </p>
          ) : null}
        </>
      ) : null}

      <p className="etl-source">
        Source: {scheduleData.schedule_source}
      </p>
    </section>
  );
}
