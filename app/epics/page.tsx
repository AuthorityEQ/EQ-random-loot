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

import dynamic from "next/dynamic";
import Link from "next/link";
import "./epic-page.css";

// Import types and constants from types module (not exported from page itself)
import type {
  RawEpicStep,
  RawClassEpic,
  EpicQuestsFile,
  NormalizedStep,
  NormalizedClassEpic,
  EpicClassName,
} from "./types";
import { EPIC_CLASSES, CLASS_NAME_MAP } from "./types";

const EpicTrackerClient = dynamic(
  () => import("./EpicTrackerClient").then((mod) => ({ default: mod.EpicTrackerClient })),
);

// ---------------------------------------------------------------------------
// Data contract — shared with the Excel ingest agent
// ---------------------------------------------------------------------------

// Types are now imported from ./types.ts
// This comment serves as documentation that type definitions have been centralized

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
    tags: raw.tags ?? [],
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
// Page (Server Component)
// ---------------------------------------------------------------------------

async function EpicsPageContent() {
  const { classes, isPending, usingFallback } = await loadEpicData();

  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
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

export default EpicsPageContent;
