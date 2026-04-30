"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShareToDiscordButtonProps {
  /** The canonical item name, e.g. "Cloak of Flames" */
  itemName: string;
  /** Pre-computed URL slug, e.g. "cloak-of-flames" */
  itemSlug: string;
  /** Primary bucket for the item (used for the bucket label line). */
  bucketLabel?: string;
  /** Comma-separated drop location zones. */
  dropLocations?: string;
  /** Optional extra className */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function buildDiscordText(
  itemName: string,
  itemSlug: string,
  bucketLabel?: string,
  dropLocations?: string,
): string {
  const pageUrl = `${getBaseUrl()}/item/${itemSlug}`;
  const lines: string[] = [
    `**${itemName}** — [click to view](${pageUrl})`,
  ];
  if (dropLocations) {
    lines.push(`Drop locations: ${dropLocations}`);
  }
  if (bucketLabel) {
    lines.push(`Bucket: ${bucketLabel}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ShareToDiscordButton
 *
 * Copies a Discord-formatted message for the item to the clipboard.
 * Mirrors the ShareFilterButton pattern: 1.8s "Copied!" feedback, uses
 * the --filter-* CSS token system for styling.
 *
 * Usage:
 *   <ShareToDiscordButton
 *     itemName="Cloak of Flames"
 *     itemSlug="cloak-of-flames"
 *     bucketLabel="9 (45-49)"
 *     dropLocations="Nagafen's Lair, Permafrost"
 *   />
 */
export function ShareToDiscordButton({
  itemName,
  itemSlug,
  bucketLabel,
  dropLocations,
  className,
}: ShareToDiscordButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    const text = buildDiscordText(itemName, itemSlug, bucketLabel, dropLocations);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // Clipboard API unavailable or permission denied — fall back to prompt.
      window.prompt("Copy this Discord message:", text);
    }
  }, [itemName, itemSlug, bucketLabel, dropLocations]);

  const classes = [
    "share-discord-button",
    copied ? "is-copied" : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-label={
        copied
          ? "Discord message copied to clipboard"
          : "Copy Discord-formatted share message"
      }
      className={classes}
      onClick={handleClick}
      title={copied ? "Copied!" : "Share to Discord"}
      type="button"
    >
      {copied ? "Copied!" : "Share to Discord"}
    </button>
  );
}
