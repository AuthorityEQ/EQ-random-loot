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

import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useEpicProgress } from "@/components/EpicProgressProvider";
import { EpicTrackerCheckbox } from "@/components/EpicTrackerCheckbox";
import { ItemIcon } from "@/components/ItemIcon";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { EPIC_CLASSES, type EpicClassName, type EpicQuestLink, type EpicStepTag, type NormalizedClassEpic, type NormalizedStep } from "./types";
import classicGroupData from "@/data/classic-group-named.json";
import kunarkGroupData from "@/data/kunark-group-named.json";
import veliousGroupData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import { mobToSlug } from "@/lib/mob-slug";
import { zoneToSlug } from "@/lib/zone-slug";
import { buildMobIndex } from "@/lib/mob-slug";
import { getEpicBucketLinks, type EpicBucketLink } from "@/lib/epic-bucket-links";
import type { ItemDetailsMap, LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";
import itemDetailsData from "@/data/item-details.json";

const itemDetailsMap = itemDetailsData as unknown as ItemDetailsMap;
const groupDatasets = [classicGroupData, kunarkGroupData, veliousGroupData] as LootDataset[];
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const internalMobSlugs = new Set(buildMobIndex(groupDatasets.flatMap((dataset) => dataset.buckets), raidDatasets).keys());

function normalizeItemLookupName(value: string) {
  return value
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const itemDetailsByDisplayName = new Map(
  Object.values(itemDetailsMap).map((details) => [details.name.toLowerCase(), details]),
);
const itemDetailsByNormalizedName = new Map<string, ItemDetailsMap[string]>();
for (const [key, details] of Object.entries(itemDetailsMap)) {
  itemDetailsByNormalizedName.set(normalizeItemLookupName(key), details);
  itemDetailsByNormalizedName.set(normalizeItemLookupName(details.name), details);
}

function getEpicItemDetails(itemName: string) {
  return itemDetailsMap[itemName]
    ?? itemDetailsByDisplayName.get(itemName.toLowerCase())
    ?? itemDetailsByNormalizedName.get(normalizeItemLookupName(itemName));
}

const tagLabels: Record<EpicStepTag, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Group",
  raid: "Raid",
  rare: "Rare",
  skippable: "Skippable",
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

function EpicExternalOrInternalLink({
  className = "epic-link",
  href,
  internalHref,
  hasInternalTarget,
  children,
}: {
  className?: string;
  href?: string;
  internalHref: string;
  hasInternalTarget?: boolean;
  children: ReactNode;
}) {
  if (href) {
    return (
      <a
        className={className}
        href={href}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  if (!hasInternalTarget) {
    const label = typeof children === "string" ? children : internalHref.split("/").pop() ?? "";
    return (
      <a
        className={className}
        href={`https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(label)}`}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={internalHref} onClick={(event) => event.stopPropagation()}>
      {children}
    </Link>
  );
}

function EpicItemLinks({
  className,
  items,
  onOpenItem,
}: {
  className: string;
  items: EpicQuestLink[];
  onOpenItem: (itemName: string) => void;
}) {
  const { previewProps } = useItemPreview();

  return (
    <ul className="epic-items-list">
      {items.map((item) => {
        const details = getEpicItemDetails(item.name);
        const detailsAllakhazamUrl = details?.sources?.find((source) => source.name === "Allakhazam")?.url;
        const externalUrl = item.url ?? detailsAllakhazamUrl;
        return (
          <li key={`${item.name}-${item.url ?? "local"}`}>
            <span className="epic-item-action-row">
              <button
                className={className}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenItem(item.name);
                }}
                type="button"
                {...previewProps(item.name, details)}
              >
                <ItemIcon details={details} />
                <span>{item.name}</span>
              </button>
              {externalUrl ? (
                <a
                  aria-label={`View ${item.name} on Allakhazam`}
                  className="epic-item-external-link"
                  href={externalUrl}
                  onClick={(event) => event.stopPropagation()}
                  rel="noreferrer"
                  target="_blank"
                  title="View on Allakhazam"
                >
                  Alla
                </a>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EpicBucketChip({ bucketLink }: { bucketLink: EpicBucketLink }) {
  const chipClassName = `epic-bucket-chip is-${bucketLink.kind}`;
  if (!bucketLink.href) {
    return (
      <span className={`${chipClassName} is-static`} title={bucketLink.title}>
        {bucketLink.label}
      </span>
    );
  }

  return (
    <Link
      className={chipClassName}
      href={bucketLink.href}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      title={bucketLink.title}
    >
      {bucketLink.label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Step card — mirrors BucketCard visual pattern
// ---------------------------------------------------------------------------

function EpicStepCard({
  epicClassName,
  step,
  stepIndex,
  globalIndex,
  isExpanded,
  onOpenItem,
  onToggleExpanded,
}: {
  epicClassName: EpicClassName;
  step: NormalizedStep;
  stepIndex: number;
  globalIndex: number;
  isExpanded: boolean;
  onOpenItem: (itemName: string) => void;
  onToggleExpanded: (stepIndex: number) => void;
}) {
  const { getProgress } = useEpicProgress();
  const progress = getProgress(epicClassName);
  const isComplete = progress.completed.includes(stepIndex);
  const dropSource = extractDropSource(step);
  const showMobAsNpc = step.npcMob && !dropSource;
  const requiredItems =
    step.requiredItems.length > 0
      ? step.requiredItems
      : parseStepItems(step.items ?? "").map((name) => ({ name }));
  const dropItems = step.dropItems;
  const rewardItems = step.rewardItems;
  const createItems = step.createItems;
  const npcMobLabel = showMobAsNpc ? step.npcMob : dropSource;
  const npcLinks =
    step.npcLinks.length > 0
      ? step.npcLinks
      : npcMobLabel
        ? [{ name: npcMobLabel }]
        : [];
  const isSkippable = step.tags.includes("skippable");
  const visibleTags = step.tags.filter((tag) => tag !== "skippable");
  const bucketLinks = getEpicBucketLinks(epicClassName, step);

  function toggleExpanded() {
    onToggleExpanded(stepIndex);
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
        {isSkippable && <span className="epic-skippable-badge">Skippable</span>}
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
          {npcLinks.length > 0 && (
            <div className="epic-step-meta-pair">
              <dt>NPC / Mob</dt>
              <dd>
                <ul className="epic-inline-link-list">
                  {npcLinks.map((npc) => (
                    <li key={`${npc.name}-${npc.url ?? "local"}`}>
                      <EpicExternalOrInternalLink
                        hasInternalTarget={internalMobSlugs.has(mobToSlug(npc.name))}
                        href={npc.url}
                        internalHref={`/mob/${mobToSlug(npc.name)}`}
                      >
                        {npc.name}
                      </EpicExternalOrInternalLink>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {requiredItems.length > 0 && (
            <div className="epic-step-meta-pair epic-step-items-pair">
              <dt>Required items</dt>
              <dd>
                <EpicItemLinks
                  className="epic-item-link"
                  items={requiredItems}
                  onOpenItem={onOpenItem}
                />
              </dd>
            </div>
          )}
          {dropItems.length > 0 && (
            <div className="epic-step-meta-pair epic-step-drops-pair">
              <dt>Drops Item</dt>
              <dd>
                <EpicItemLinks
                  className="epic-item-link epic-drop-link"
                  items={dropItems}
                  onOpenItem={onOpenItem}
                />
              </dd>
            </div>
          )}
          {rewardItems.length > 0 && (
            <div className="epic-step-meta-pair epic-step-rewards-pair">
              <dt>Reward</dt>
              <dd>
                <EpicItemLinks
                  className="epic-item-link epic-reward-link"
                  items={rewardItems}
                  onOpenItem={onOpenItem}
                />
              </dd>
            </div>
          )}
          {createItems.length > 0 && (
            <div className="epic-step-meta-pair epic-step-creates-pair">
              <dt>Creates</dt>
              <dd>
                <EpicItemLinks
                  className="epic-item-link epic-create-link"
                  items={createItems}
                  onOpenItem={onOpenItem}
                />
              </dd>
            </div>
          )}
          {step.spawnNotes.length > 0 && (
            <div className="epic-step-meta-pair epic-step-spawns-pair">
              <dt>Spawns</dt>
              <dd>
                <ul className="epic-inline-link-list">
                  {step.spawnNotes.map((spawnNote) => (
                    <li key={spawnNote}>{spawnNote}</li>
                  ))}
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
          {bucketLinks.length > 0 && (
            <div className="epic-step-meta-pair epic-step-buckets-pair">
              <dt>Random loot</dt>
              <dd>
                <ul className="epic-bucket-chip-list">
                  {bucketLinks.map((bucketLink) => (
                    <li key={bucketLink.href}>
                      <EpicBucketChip bucketLink={bucketLink} />
                    </li>
                  ))}
                </ul>
              </dd>
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

function ClassSection({ classEpic }: { classEpic: NormalizedClassEpic }) {
  const { getProgress, clearProgress } = useEpicProgress();
  const { className, weaponName, steps } = classEpic;
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(() => new Set());
  const [drawerItemName, setDrawerItemName] = useState<string | null>(null);
  const progress = getProgress(className);
  const completedCount = progress.completed.length;
  const totalSteps = steps.length;
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  function toggleExpandedStep(stepIndex: number) {
    setExpandedSteps((current) => {
      const next = new Set(current);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  }

  function expandAllSteps() {
    setExpandedSteps(new Set(steps.map((_, index) => index)));
  }

  function collapseAllSteps() {
    setExpandedSteps(new Set());
  }

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

      <div className="epic-review-toolbar" aria-label={`${className} quest step review controls`}>
        <span>{totalSteps} steps</span>
        <button className="epic-review-button" onClick={expandAllSteps} type="button">
          Expand all
        </button>
        <button className="epic-review-button" onClick={collapseAllSteps} type="button">
          Collapse all
        </button>
      </div>

      {/* Step list */}
      <ol className="epic-steps-list" aria-label={`${className} epic quest steps`}>
        {steps.map((step, idx) => (
          <EpicStepCard
            key={`${className}-row${step.sourceRow}`}
            epicClassName={className}
            isExpanded={expandedSteps.has(idx)}
            onOpenItem={setDrawerItemName}
            onToggleExpanded={toggleExpandedStep}
            step={step}
            stepIndex={idx}
            globalIndex={idx}
          />
        ))}
      </ol>
      {drawerItemName !== null ? (
        <ItemDrawer
          contentType="Epic Quest"
          details={getEpicItemDetails(drawerItemName)}
          itemName={drawerItemName}
          onClose={() => setDrawerItemName(null)}
        />
      ) : null}
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
