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

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { useEpicProgress } from "@/components/EpicProgressProvider";
import { EpicTrackerCheckbox } from "@/components/EpicTrackerCheckbox";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { EPIC_CLASSES, type EpicClassName, type EpicStepTag, type NormalizedClassEpic, type NormalizedStep } from "./types";
import { mobToSlug } from "@/lib/mob-slug";
import { zoneToSlug } from "@/lib/zone-slug";
import { itemToSlug } from "@/lib/item-slug";
import type { Bucket, ItemDetailsMap } from "@/lib/search";
import itemDetailsData from "@/data/item-details.json";

const itemDetailsMap = itemDetailsData as unknown as ItemDetailsMap;

const tagLabels: Record<EpicStepTag, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Group",
  raid: "Raid",
  rare: "Rare",
};

function TagDots({ tags }: { tags: EpicStepTag[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="epic-tag-dots" aria-hidden="true">
      {tags.map((tag) => (
        <span className={`epic-tag-dot is-${tag}`} key={tag} />
      ))}
    </span>
  );
}

function TagText({ tags }: { tags: EpicStepTag[] }) {
  if (tags.length === 0) return null;
  return <span className="epic-tag-text">{tags.map((tag) => tagLabels[tag]).join(" • ")}</span>;
}

let _epicBucketIdCounter = 100000;
function makeEpicBucket(itemName: string, classEpic: NormalizedClassEpic, step: NormalizedStep): Bucket {
  _epicBucketIdCounter += 1;
  const expansion = "Velious";
  return {
    bucket: _epicBucketIdCounter,
    level_range: `${classEpic.className} epic`,
    expansion,
    mobs: step.npcMob
      ? [{
          name: step.npcMob,
          level: 0,
          zone: step.zone ?? "",
          expansion,
          source_bucket: step.npcMob,
          loot: [itemName],
        }]
      : [],
    zones: step.zone ? [step.zone] : [],
    loot_pool: [itemName],
    mob_count: step.npcMob ? 1 : 0,
    loot_count: 1,
    zone_count: step.zone ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const PREFIX_RE = /^(?:receive|hand\s+in|give|loot|buy|combine|turn\s+in|reward):\s*/i;
const TRAILING_PAREN_RE = /\s*\([^)]*\)\s*$/;
const SPLIT_RE = /\s*,\s*|\s+and\s+|\s*&\s*/i;
const STOP_WORDS_RE = /^(?:unknown|tba|tbd|the player|this step|none)$/i;

function parseStepItems(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const stripped = trimmed
    .replace(PREFIX_RE, "")
    .replace(TRAILING_PAREN_RE, "");
  const fragments = stripped.split(SPLIT_RE);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const frag of fragments) {
    const name = frag.trim();
    if (name.length < 3) continue;
    if (STOP_WORDS_RE.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

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
  classEpic,
  step,
  stepIndex,
  globalIndex,
  onSelectLoot,
}: {
  epicClassName: EpicClassName;
  classEpic: NormalizedClassEpic;
  step: NormalizedStep;
  stepIndex: number;
  globalIndex: number;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
}) {
  const { getProgress } = useEpicProgress();
  const { previewProps } = useItemPreview();
  const progress = getProgress(epicClassName);
  const isComplete = progress.completed.includes(stepIndex);
  const dropSource = extractDropSource(step);
  const showMobAsNpc = step.npcMob && !dropSource;
  const items = parseStepItems(step.items ?? "");
  const [isExpanded, setIsExpanded] = useState(false);
  const npcMobLabel = showMobAsNpc ? step.npcMob : dropSource;
  const visibleTags = step.tags;

  function toggleExpanded() {
    setIsExpanded((current) => !current);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded();
    }
  }

  return (
    <li
      aria-expanded={isExpanded}
      className={`epic-step-card${isComplete ? " is-complete" : ""}${isExpanded ? " is-expanded" : ""}`}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="epic-step-header">
        <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <EpicTrackerCheckbox
            className={epicClassName}
            stepIndex={stepIndex}
            label={`Step ${globalIndex + 1}: ${step.action}`}
          />
        </span>
        <span className="epic-step-number">Step {globalIndex + 1}</span>
        <div className="epic-step-summary">
          <h3 className="epic-step-name">{step.action}</h3>
          {step.zone && <span className="epic-step-zone-inline">({step.zone})</span>}
        </div>
        <div className="epic-step-tags" aria-label={visibleTags.length > 0 ? `Tags: ${visibleTags.map((tag) => tagLabels[tag]).join(", ")}` : undefined}>
          <TagDots tags={visibleTags} />
          <TagText tags={visibleTags} />
        </div>
        <span className="epic-step-chevron" aria-hidden="true">⌄</span>
      </div>

      <div className="epic-step-details-shell" aria-hidden={!isExpanded}>
        <dl className="epic-step-meta">
          {step.zone && (
            <div className="epic-step-meta-pair">
              <dt>Zone</dt>
              <dd>
                <Link className="epic-link" href={`/zone/${zoneToSlug(step.zone)}`} onClick={(event) => event.stopPropagation()}>
                  {step.zone}
                </Link>
              </dd>
            </div>
          )}
          {npcMobLabel && (
            <div className="epic-step-meta-pair">
              <dt>NPC / Mob</dt>
              <dd>
                <Link className="epic-link" href={`/mob/${mobToSlug(npcMobLabel)}`} onClick={(event) => event.stopPropagation()}>
                  {npcMobLabel}
                </Link>
              </dd>
            </div>
          )}
          {items.length > 0 && (
            <div className="epic-step-meta-pair epic-step-items-pair">
              <dt>Required items</dt>
              <dd>
                <ul className="epic-items-list">
                  {items.map((itemName) => {
                    const details = itemDetailsMap[itemName];
                    return (
                      <li key={itemName}>
                        <button
                          className="epic-item-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectLoot(itemName, makeEpicBucket(itemName, classEpic, step));
                          }}
                          type="button"
                          {...previewProps(itemName, details)}
                        >
                          <ItemIcon details={details} />
                          <span>{itemName}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
          )}
          {step.notes && (
            <div className="epic-step-meta-pair epic-step-notes-pair">
              <dt>Notes</dt>
              <dd>{step.notes}</dd>
            </div>
          )}
        </dl>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Class section: progress bar + step list
// ---------------------------------------------------------------------------

function ClassSection({
  classEpic,
  onSelectLoot,
}: {
  classEpic: NormalizedClassEpic;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
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
            classEpic={classEpic}
            step={step}
            stepIndex={idx}
            globalIndex={idx}
            onSelectLoot={onSelectLoot}
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

  const [drawerItem, setDrawerItem] = useState<{ item: string; bucket: Bucket } | null>(null);

  const modifierHeldRef = useRef(false);
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      modifierHeldRef.current = event.metaKey || event.ctrlKey;
    }
    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => document.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, []);

  function handleSelectLoot(itemName: string, bucket: Bucket) {
    if (modifierHeldRef.current) {
      window.open(`/item/${itemToSlug(itemName)}`, "_blank", "noopener");
      modifierHeldRef.current = false;
      return;
    }
    setDrawerItem({ item: itemName, bucket });
  }

  function handleCloseDrawer() {
    setDrawerItem(null);
  }

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
        <ClassSection classEpic={activeClassEpic} onSelectLoot={handleSelectLoot} />
      ) : (
        <p className="epic-pending-state">
          {selectedClass} epic quest data is being prepared for launch — check back closer to May 27, 2026.
        </p>
      )}

      {drawerItem !== null ? (
        <ItemDrawer
          bucket={drawerItem.bucket}
          contentType="Epic Quest"
          details={itemDetailsMap[drawerItem.item]}
          expansion={drawerItem.bucket.expansion}
          itemName={drawerItem.item}
          onClose={handleCloseDrawer}
          onSelectZone={() => {}}
        />
      ) : null}
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
