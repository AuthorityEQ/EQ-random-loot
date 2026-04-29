"use client";

import type { ConfidenceMetadata, ConfidenceTier } from "@/lib/confidence";
import { CONFIDENCE_LABELS, formatConfidence } from "@/lib/confidence";

// ---------------------------------------------------------------------------
// Tier → CSS modifier class
// ---------------------------------------------------------------------------

const TIER_CLASS: Record<ConfidenceTier, string> = {
  verified: "is-verified",
  high: "is-high",
  medium: "is-medium",
  low: "is-low",
  guess: "is-guess",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ConfidenceBadgeProps = {
  meta: ConfidenceMetadata;
  /**
   * `compact` — single-word label, small pill. Use in BucketCard loot list and
   * ZoneView loot group rows where space is tight.
   *
   * Default (verbose) — label + source line + report count + date. Use in
   * ItemDetailBody sources section.
   */
  compact?: boolean;
  /** Extra className forwarded to the root element. */
  className?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ConfidenceBadge
 *
 * Renders an inline pill indicating how confident we are that an item
 * actually drops from its listed source.
 *
 * Color coding (via BEM modifier classes on `.confidence-badge`):
 * - verified → green  (`--accent`)
 * - high     → blue   (`--exp-classic-primary`)
 * - medium   → amber  (`--bucket-amber-card` family)
 * - low      → gray   (`--text-muted`)
 * - guess    → rust   (`--confidence-guess-*`)
 *
 * Tooltip via the native `title` attribute — accessible on keyboard focus and
 * screen readers without requiring a JS tooltip library. Content is produced
 * by `formatConfidence()` so wording stays centralised.
 *
 * Usage:
 * ```tsx
 * // Compact — loot list row
 * <ConfidenceBadge compact meta={meta} />
 *
 * // Verbose — item detail sources section
 * <ConfidenceBadge meta={meta} />
 * ```
 */
export function ConfidenceBadge({
  meta,
  compact = false,
  className,
}: ConfidenceBadgeProps) {
  const tierClass = TIER_CLASS[meta.tier];
  const tooltip = formatConfidence(meta);
  const label = CONFIDENCE_LABELS[meta.tier];

  const rootClass = [
    "confidence-badge",
    tierClass,
    compact ? "is-compact" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (compact) {
    return (
      <span
        aria-label={tooltip}
        className={rootClass}
        title={tooltip}
      >
        {label}
      </span>
    );
  }

  // Verbose variant: label + secondary detail line
  const sourceLine = buildSourceLine(meta);

  return (
    <span
      aria-label={tooltip}
      className={rootClass}
      title={tooltip}
    >
      <span className="confidence-badge-label">{label}</span>
      {sourceLine ? (
        <span className="confidence-badge-detail">{sourceLine}</span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Produces the detail line shown in the verbose variant.
 * Examples:
 *   "12 reports"
 *   "Official data"
 *   "12 reports · 2026-04-29"
 */
function buildSourceLine(meta: ConfidenceMetadata): string {
  const parts: string[] = [];

  if (meta.report_count !== undefined && meta.report_count > 0) {
    parts.push(
      `${meta.report_count} ${meta.report_count === 1 ? "report" : "reports"}`,
    );
  }

  if (meta.last_updated) {
    parts.push(meta.last_updated);
  }

  // Only add source label when there's no report count (avoids redundancy
  // with the tier tier label in the verbose view)
  if (parts.length === 0) {
    const SOURCE_SHORT: Record<ConfidenceMetadata["source"], string> = {
      binary_verified: "Binary verified",
      official_data: "Official data",
      community_reports: "Community reports",
      imported: "Imported",
      tier_inferred: "Tier inferred",
    };
    parts.push(SOURCE_SHORT[meta.source]);
  }

  return parts.join(" · ");
}
