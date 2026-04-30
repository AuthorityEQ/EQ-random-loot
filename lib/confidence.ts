/**
 * confidence.ts — Drop confidence scoring infrastructure
 *
 * Provides the data types, labels, colors, and helper functions for the
 * confidence tier system. Confidence represents how certain we are that an
 * item actually drops from a given source at a given rate.
 *
 * ---------------------------------------------------------------------------
 * INTEGRATION GUIDE (do not modify other files — this is for future work)
 * ---------------------------------------------------------------------------
 *
 * ### BucketCard — compact badge after each loot item
 * ```tsx
 * import { ConfidenceBadge } from "@/components/ConfidenceBadge";
 * import confidenceMap from "@/data/loot-confidence.json";
 * import type { ConfidenceMetadata } from "@/lib/confidence";
 *
 * // Inside the loot-list <li>:
 * const meta = (confidenceMap as Record<string, ConfidenceMetadata>)[item];
 * {meta ? <ConfidenceBadge compact meta={meta} /> : null}
 * ```
 *
 * ### ItemDetailBody — verbose badge in the Sources section
 * ```tsx
 * import { ConfidenceBadge } from "@/components/ConfidenceBadge";
 * import confidenceMap from "@/data/loot-confidence.json";
 * import type { ConfidenceMetadata } from "@/lib/confidence";
 *
 * // Inside the <div className="sources"> block, after the sources list:
 * const meta = (confidenceMap as Record<string, ConfidenceMetadata>)[itemName];
 * {meta ? <ConfidenceBadge meta={meta} /> : null}
 * ```
 *
 * ### ZoneView loot groups — compact badge on each row
 * ```tsx
 * import { ConfidenceBadge } from "@/components/ConfidenceBadge";
 * import confidenceMap from "@/data/loot-confidence.json";
 * import type { ConfidenceMetadata } from "@/lib/confidence";
 *
 * // Inside .zone-loot-list <li>:
 * const meta = (confidenceMap as Record<string, ConfidenceMetadata>)[item];
 * {meta ? <ConfidenceBadge compact meta={meta} /> : null}
 * ```
 *
 * ### Default fallback when an item has no confidence entry
 * ```ts
 * import { DEFAULT_CONFIDENCE } from "@/lib/confidence";
 * const meta = (confidenceMap as Record<string, ConfidenceMetadata>)[item] ?? DEFAULT_CONFIDENCE;
 * ```
 * ---------------------------------------------------------------------------
 * FUTURE: community reporting backend
 * ---------------------------------------------------------------------------
 * When the kill-feed/reporting API lands, update `source` to
 * `"community_reports"` and set `report_count` + `last_updated` from the API
 * response. The tier thresholds in `confidenceTierFromCount()` are the single
 * source of truth — raise them if report volume justifies it.
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/**
 * Ordered from most to least confident. Components should style tiers
 * in this precedence order.
 */
export type ConfidenceTier =
  | "verified"
  | "high"
  | "medium"
  | "low"
  | "guess";

export interface ConfidenceMetadata {
  tier: ConfidenceTier;
  /**
   * How the confidence value was determined:
   * - `binary_verified`   — confirmed against game binary / server packet data
   * - `official_data`     — sourced from official patch notes or game data export
   * - `community_reports` — aggregated from player kill-feed reports (post-launch)
   * - `imported`          — migrated from item-details.json without manual verification
   * - `tier_inferred`     — guessed from the loot bucket tier and item stats
   */
  source:
    | "binary_verified"
    | "official_data"
    | "community_reports"
    | "imported"
    | "tier_inferred";
  /** Number of independent community sightings. Undefined for non-community sources. */
  report_count?: number;
  /** ISO-8601 date string (YYYY-MM-DD) of the most recent data update. */
  last_updated?: string;
}

// ---------------------------------------------------------------------------
// Tier thresholds (community report count → tier)
// ---------------------------------------------------------------------------

/**
 * Derives a ConfidenceTier from a raw community report count.
 *
 * Thresholds:
 * | Count | Tier     |
 * |-------|----------|
 * | 50+   | verified |
 * | 10–49 | high     |
 * | 3–9   | medium   |
 * | 1–2   | low      |
 * | 0     | guess    |
 */
export function confidenceTierFromCount(count: number): ConfidenceTier {
  if (count >= 50) return "verified";
  if (count >= 10) return "high";
  if (count >= 3) return "medium";
  if (count >= 1) return "low";
  return "guess";
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Human-readable short label for each tier, suitable for badges. */
export const CONFIDENCE_LABELS: Record<ConfidenceTier, string> = {
  verified: "Verified",
  high: "High",
  medium: "Medium",
  low: "Low",
  guess: "Guess",
};

/**
 * CSS custom property references for badge colors. These map to existing
 * tokens where possible; `--confidence-guess-*` tokens are defined in
 * globals.css alongside the `.confidence-badge` rules.
 *
 * Values are the CSS variable names (with `var(...)` wrapper) so they can
 * be used in inline styles or className helpers.
 */
export const CONFIDENCE_COLORS: Record<ConfidenceTier, string> = {
  verified: "var(--accent)",
  high: "var(--exp-classic-primary)",
  medium: "var(--bucket-amber-card)",
  low: "var(--text-muted)",
  guess: "var(--confidence-guess-primary)",
};

/**
 * Source labels for tooltip display.
 */
export const SOURCE_LABELS: Record<ConfidenceMetadata["source"], string> = {
  binary_verified: "Binary verified",
  official_data: "Official data",
  community_reports: "Community reports",
  imported: "Imported from item data",
  tier_inferred: "Inferred from tier",
};

/**
 * Produces a human-readable summary string for a confidence entry.
 * Used in tooltip content and aria-labels.
 *
 * Examples:
 * - "Verified · 12 reports · official data · updated 2026-04-29"
 * - "High confidence · 23 reports · updated 2026-03-10"
 * - "Medium confidence · imported from item data"
 * - "Guess · inferred from tier"
 */
export function formatConfidence(meta: ConfidenceMetadata): string {
  const parts: string[] = [];

  const label = CONFIDENCE_LABELS[meta.tier];
  if (meta.tier === "verified") {
    parts.push("Verified");
  } else {
    parts.push(`${label} confidence`);
  }

  if (meta.report_count !== undefined && meta.report_count > 0) {
    parts.push(`${meta.report_count} ${meta.report_count === 1 ? "report" : "reports"}`);
  }

  parts.push(SOURCE_LABELS[meta.source]);

  if (meta.last_updated) {
    parts.push(`updated ${meta.last_updated}`);
  }

  return parts.join(" · ");
}

/**
 * The default confidence metadata applied to items not present in
 * loot-confidence.json. Callers should use this rather than hard-coding
 * a fallback so that the policy can be changed in one place.
 */
export const DEFAULT_CONFIDENCE: ConfidenceMetadata = {
  tier: "medium",
  source: "imported",
};
