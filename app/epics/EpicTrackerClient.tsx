"use client";

/**
 * EpicTrackerClient — interactive portion of the Epic 1.0 Quest Tracker.
 *
 * Responsibilities:
 *   - Class selector pill buttons (14 classes)
 *   - Per-class quest step list with BucketCard-style step cards
 *   - Progress bar, completed count, and clear-progress button
 *   - Cross-links: zone -> /zone/[slug], mob -> /mob/[slug]
 *
 * Provider note:
 *   EpicProgressProvider lives at root in app/layout.tsx — no local wrapper.
 */

import { useState } from "react";
import Link from "next/link";
import { useEpicProgress } from "@/components/EpicProgressProvider";
import { EpicTrackerCheckbox } from "@/components/EpicTrackerCheckbox";
import { EPIC_CLASSES, type EpicClassName, type NormalizedClassEpic, type NormalizedStep } from "./types";
import { mobToSlug } from "@/lib/mob-slug";
import { zoneToSlug } from "@/lib/zone-slug";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EpicTrackerClientProps = {
  classes: NormalizedClassEpic[];
  usingFallback: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a meaningful "drop source" mob from the items/action text when
 * the npcMob field is empty or the action mentions killing a mob.
 * Returns null when no mob is detectable.
 */
function extractDropSource(step: NormalizedStep): string | null {
  const text = [step.action, step.items].filter(Boolean).join(" ");
  // If action is "Kill X" or "Loot from X" pattern
  const killMatch = text.match(/\bkill\s+([A-Z][a-zA-Z\s']+?)(?:\s+in|\s+at|\s+and|$)/i);
  if (killMatch) return killMatch[1].trim();
  const lootMatch = text.match(/\bloot(?:ed)?\s+from\s+([A-Z][a-zA-Z\s']+?)(?:\s+in|\s+at|[,(]|$)/i);
  if (lootMatch) return lootMatch[1].trim();
  return null;
}

// ---------------------------------------------------------------------------
// Step card — mirrors BucketCard visual pattern
// ---------------------------------------------------------------------------

function EpicStepCard({
  epicClassName,
  step,
  stepIndex,
  globalIndex,
}: {
  epicClassName: EpicClassName;
  step: NormalizedStep;
  stepIndex: number;
  globalIndex: number;
}) {
  const { getProgress } = useEpicProgress();
  const progress = getProgress(epicClassName);
  const isComplete = progress.completed.includes(stepIndex);
  const dropSource = extractDropSource(step);
  const showMobAsNpc = step.npcMob && !dropSource;

  return (
    <li className={`epic-step-card${isComplete ? " is-complete" : ""}`}>
      <div className="epic-step-header">
        <EpicTrackerCheckbox
          className={epicClassName}
          stepIndex={stepIndex}
          label={`Step ${globalIndex + 1}: ${step.action}`}
        />
        <span className="epic-step-number">Step {globalIndex + 1}</span>
        <div className="epic-step-title">
          <h3 className="epic-step-name">{step.action}</h3>
          {step.phase && <span className="epic-step-type-pill">{step.phase}</span>}
        </div>
      </div>

      <dl className="epic-step-meta">
        {step.zone && (
          <div className="epic-step-meta-pair">
            <dt>Zone</dt>
            <dd>
              <Link className="epic-link" href={`/zone/${zoneToSlug(step.zone)}`}>
                {step.zone}
              </Link>
            </dd>
          </div>
        )}
        {showMobAsNpc && (
          <div className="epic-step-meta-pair">
            <dt>NPC / Mob</dt>
            <dd>
              <Link className="epic-link" href={`/mob/${mobToSlug(step.npcMob!)}`}>
                {step.npcMob}
              </Link>
            </dd>
          </div>
        )}
        {dropSource && (
          <div className="epic-step-meta-pair">
            <dt>Drops from</dt>
            <dd>
              <Link className="epic-link" href={`/mob/${mobToSlug(dropSource)}`}>
                {dropSource}
              </Link>
            </dd>
          </div>
        )}
        {step.items && (
          <div className="epic-step-meta-pair">
            <dt>Items</dt>
            <dd>{step.items}</dd>
          </div>
        )}
        {step.notes && (
          <div className="epic-step-meta-pair">
            <dt>Notes</dt>
            <dd>{step.notes}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Class section: progress bar + step list
// ---------------------------------------------------------------------------

function ClassSection({
  classEpic,
}: {
  classEpic: NormalizedClassEpic;
}) {
  const { getProgress, clearProgress } = useEpicProgress();
  const { className, weaponName, steps } = classEpic;
  const progress = getProgress(className);
  const completedCount = progress.completed.length;
  const totalSteps = steps.length;
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <>
      {/* Weapon name sub-header */}
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        {weaponName}
      </p>

      {/* Progress bar */}
      <div className="epic-progress-summary" aria-label={`${className} progress`}>
        <div
          className="epic-progress-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct}% complete`}
        >
          <div className="epic-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="epic-progress-label">
          <strong>{completedCount}</strong> / {totalSteps} steps
        </span>
        {completedCount > 0 && (
          <button
            className="epic-clear-button"
            onClick={() => clearProgress(className)}
            title={`Clear all ${className} epic progress`}
            type="button"
          >
            Clear
          </button>
        )}
      </div>

      {/* Step list */}
      <ol className="epic-steps-list" aria-label={`${className} epic quest steps`}>
        {steps.map((step, idx) => (
          <EpicStepCard
            key={`${className}-row${step.sourceRow}`}
            epicClassName={className}
            step={step}
            stepIndex={idx}
            globalIndex={idx}
          />
        ))}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inner interactive component (requires EpicProgressProvider in tree)
// ---------------------------------------------------------------------------

function EpicTrackerInner({ classes, usingFallback }: EpicTrackerClientProps) {
  const classMap = new Map<EpicClassName, NormalizedClassEpic>(
    classes.map((c) => [c.className, c]),
  );

  // Default to first class that has steps
  const firstAvailable =
    EPIC_CLASSES.find((name) => (classMap.get(name)?.steps.length ?? 0) > 0) ?? EPIC_CLASSES[0];

  const [selectedClass, setSelectedClass] = useState<EpicClassName>(firstAvailable);
  const activeClassEpic = classMap.get(selectedClass);

  return (
    <>
      {usingFallback && (
        <p className="epic-placeholder-badge">
          Showing placeholder steps for UI testing — real epic quest data will populate after the Excel ingest runs.
        </p>
      )}

      {/* Class selector pills */}
      <nav className="epic-class-bar" aria-label="Select class for epic tracker">
        {EPIC_CLASSES.map((name) => {
          const hasSteps = (classMap.get(name)?.steps.length ?? 0) > 0;
          const isActive = name === selectedClass;
          return (
            <button
              key={name}
              aria-pressed={isActive}
              className={[
                "filter-button",
                isActive ? "is-active" : null,
              ].filter(Boolean).join(" ")}
              disabled={!hasSteps}
              onClick={() => setSelectedClass(name)}
              title={
                hasSteps
                  ? `View ${name} epic quest — ${classMap.get(name)?.steps.length} steps`
                  : `${name} epic data not yet loaded`
              }
              type="button"
            >
              {name}
            </button>
          );
        })}
      </nav>

      {/* Per-class content */}
      {activeClassEpic && activeClassEpic.steps.length > 0 ? (
        <ClassSection classEpic={activeClassEpic} />
      ) : (
        <p className="epic-pending-state">
          {selectedClass} epic quest data is being prepared for launch — check back closer to May 27, 2026.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported component
//
// EpicProgressProvider now lives in app/layout.tsx — no local wrapper needed.
// ---------------------------------------------------------------------------

export function EpicTrackerClient(props: EpicTrackerClientProps) {
  return <EpicTrackerInner {...props} />;
}
