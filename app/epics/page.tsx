/**
 * Epic 1.0 Quest Tracker — Feature I
 *
 * Server Component shell. Loads epic quest data and passes it to the
 * EpicTrackerClient client component which owns all interactive state
 * (class selection, checkbox progress via EpicProgressProvider).
 *
 * LAYOUT INTEGRATION NOTE (do not apply yet — consolidation pass will apply):
 *   1. Wrap the provider stack in app/layout.tsx with <EpicProgressProvider>
 *      inside <FavoritesProvider> (order is not significant):
 *
 *        <EpicProgressProvider>
 *          <FavoritesProvider>
 *            ...
 *          </FavoritesProvider>
 *        </EpicProgressProvider>
 *
 *   2. Add a fourth nav link in app/layout.tsx beside "Favorites":
 *
 *        <Link href="/epics">Epic Quests</Link>
 *
 *      Once <EpicProgressProvider> is in layout.tsx, also remove the
 *      local <EpicProgressProvider> wrapper from EpicTrackerClient.tsx
 *      (the comment in that file explains the spot).
 */

import type { Metadata } from "next";
import { EpicTrackerClient } from "./EpicTrackerClient";
import "./epic-page.css";

// ---------------------------------------------------------------------------
// Data contract — shared with the Excel ingest agent
// ---------------------------------------------------------------------------

/**
 * Shape produced by the Excel ingest pipeline at
 * data/excel-imports/epic-quests.json.
 *
 * TOP-LEVEL FIELDS
 *   sheet_name   — Source sheet name from the workbook (informational).
 *   row_count    — Raw number of rows read (informational).
 *   extracted_at — ISO timestamp of the last ingest run.
 *   warnings     — Array of non-fatal ingest warnings.
 *   classes      — One entry per EQ class that has a 1.0 epic quest.
 *   _status      — Optional. Present only on the stub file;
 *                  value "pending_excel_ingest" signals "no real data yet".
 *
 * RawClassEpic (per-class object)
 *   class_name   — Uppercase class name e.g. "PALADIN", "SHADOW KNIGHT".
 *   weapon_name  — Uppercase weapon name e.g. "SINGING SHORT SWORD".
 *   steps        — Ordered array of RawEpicStep objects.
 *
 * RawEpicStep (per-step object)
 *   _source_row  — Row index in the source sheet (debugging aid).
 *   step         — Step number as a string (e.g. "1", "2").
 *   phase        — Optional phase label (empty string when unused).
 *   action       — Human-readable instruction text for this step.
 *   npc_mob      — NPC or mob name involved in the step; may be empty string.
 *   zone         — Zone name where the step occurs; may be empty string.
 *   items        — Item(s) received or consumed; free-text; may be empty.
 *   notes        — Additional notes; may be empty string.
 */
export type RawEpicStep = {
  _source_row: number;
  step: string;
  phase: string;
  action: string;
  npc_mob: string;
  zone: string;
  items: string;
  notes: string;
};

export type RawClassEpic = {
  class_name: string;
  weapon_name: string;
  steps: RawEpicStep[];
};

export type EpicQuestsFile = {
  sheet_name?: string;
  row_count?: number;
  extracted_at?: string;
  warnings?: string[];
  _status?: string;
  classes: RawClassEpic[];
};

// ---------------------------------------------------------------------------
// Canonical class list (14 classes with 1.0 epics)
// ---------------------------------------------------------------------------

/** Display-name list; order determines pill order in the selector bar. */
export const EPIC_CLASSES = [
  "Bard",
  "Cleric",
  "Druid",
  "Enchanter",
  "Magician",
  "Monk",
  "Necromancer",
  "Paladin",
  "Ranger",
  "Rogue",
  "Shadowknight",
  "Shaman",
  "Warrior",
  "Wizard",
] as const;

export type EpicClassName = (typeof EPIC_CLASSES)[number];

/**
 * Maps the uppercase ingest class name to the canonical display name used
 * across the UI and localStorage keys.
 */
const CLASS_NAME_MAP: Record<string, EpicClassName> = {
  BARD: "Bard",
  CLERIC: "Cleric",
  DRUID: "Druid",
  ENCHANTER: "Enchanter",
  MAGICIAN: "Magician",
  MONK: "Monk",
  NECROMANCER: "Necromancer",
  PALADIN: "Paladin",
  RANGER: "Ranger",
  ROGUE: "Rogue",
  "SHADOW KNIGHT": "Shadowknight",
  SHADOWKNIGHT: "Shadowknight",
  SHAMAN: "Shaman",
  WARRIOR: "Warrior",
  WIZARD: "Wizard",
};

// ---------------------------------------------------------------------------
// Normalized types — what the client component receives
// ---------------------------------------------------------------------------

export type NormalizedStep = {
  /** 1-based step number (parsed from the raw string). */
  stepNumber: number;
  /** Raw string value from the sheet (kept for display). */
  stepRaw: string;
  phase: string;
  action: string;
  npcMob: string | null;
  zone: string | null;
  items: string | null;
  notes: string | null;
  sourceRow: number;
};

export type NormalizedClassEpic = {
  className: EpicClassName;
  weaponName: string;
  steps: NormalizedStep[];
};

// ---------------------------------------------------------------------------
// Data normalization
// ---------------------------------------------------------------------------

function normalizeStep(raw: RawEpicStep): NormalizedStep {
  return {
    stepNumber: Number.parseInt(raw.step, 10) || 0,
    stepRaw: raw.step,
    phase: raw.phase || "",
    action: raw.action || "",
    npcMob: raw.npc_mob || null,
    zone: raw.zone || null,
    items: raw.items || null,
    notes: raw.notes || null,
    sourceRow: raw._source_row,
  };
}

function normalizeClasses(rawClasses: RawClassEpic[]): NormalizedClassEpic[] {
  const result: NormalizedClassEpic[] = [];
  for (const raw of rawClasses) {
    const canonical = CLASS_NAME_MAP[raw.class_name.toUpperCase()];
    if (!canonical) continue;
    result.push({
      className: canonical,
      weaponName: raw.weapon_name,
      steps: raw.steps.map(normalizeStep),
    });
  }
  // Sort by canonical order
  return result.sort(
    (a, b) => EPIC_CLASSES.indexOf(a.className) - EPIC_CLASSES.indexOf(b.className),
  );
}

// ---------------------------------------------------------------------------
// Data loading (server-side)
// ---------------------------------------------------------------------------

async function loadEpicData(): Promise<{
  classes: NormalizedClassEpic[];
  isPending: boolean;
  usingFallback: boolean;
}> {
  let file: EpicQuestsFile = { _status: "missing", classes: [] };

  try {
    const mod = await import("@/data/excel-imports/epic-quests.json");
    file = mod.default as unknown as EpicQuestsFile;
  } catch {
    file = { _status: "pending_excel_ingest", classes: [] };
  }

  const isPending =
    file._status === "pending_excel_ingest" ||
    file._status === "missing" ||
    file.classes.length === 0;

  if (!isPending) {
    return { classes: normalizeClasses(file.classes), isPending: false, usingFallback: false };
  }

  // Try fallback placeholder data for UI testing
  try {
    const fallbackMod = await import("@/data/epic-quests-fallback.json");
    const fallback = fallbackMod.default as unknown as { classes: RawClassEpic[] };
    const fallbackNormalized = normalizeClasses(fallback.classes);
    return {
      classes: fallbackNormalized,
      isPending: true,
      usingFallback: fallbackNormalized.length > 0,
    };
  } catch {
    return { classes: [], isPending: true, usingFallback: false };
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Epic 1.0 Quest Tracker — Frostreaver",
  description:
    "Track your EverQuest Epic 1.0 weapon quest progression across all 14 classes, cross-linked to zones and mobs.",
};

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function EpicsPage() {
  const { classes, isPending, usingFallback } = await loadEpicData();

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Epic 1.0 Quests</p>
          <h1>Epic 1.0 Quests</h1>
          <p className="subhead">Track your epic progression — all 14 classes, every step.</p>
        </div>

        {classes.length > 0 && (
          <div className="summary" aria-label="Epic quest dataset summary">
            <div className="summary-item">
              <span className="summary-value">{classes.length}</span>
              <span className="summary-label">Classes</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">
                {classes.reduce((sum, c) => sum + c.steps.length, 0)}
              </span>
              <span className="summary-label">Total steps</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">
                {Math.round(
                  classes.reduce((sum, c) => sum + c.steps.length, 0) / Math.max(classes.length, 1),
                )}
              </span>
              <span className="summary-label">Avg steps</span>
            </div>
          </div>
        )}
      </header>

      {isPending && classes.length === 0 ? (
        <p className="epic-pending-state">
          Epic quest data is being prepared for launch — check back closer to May 27, 2026.
        </p>
      ) : (
        <EpicTrackerClient classes={classes} usingFallback={usingFallback} />
      )}
    </main>
  );
}
