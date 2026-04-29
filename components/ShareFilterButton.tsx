"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShareFilterButtonProps {
  /** The full shareable URL to copy. Produced by useUrlFilterState().shareUrl */
  shareUrl: string;
  /** Optional additional className */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ShareFilterButton
 *
 * A small toolbar button that copies the current filtered URL to the
 * clipboard and briefly shows "Copied!" feedback.
 *
 * Usage (see integration steps in lib/use-url-filter-state.ts):
 *
 *   import { ShareFilterButton } from "@/components/ShareFilterButton";
 *
 *   // Inside <div className="toolbar"> near the SearchBox:
 *   <ShareFilterButton shareUrl={shareUrl} />
 */
export function ShareFilterButton({
  shareUrl,
  className,
}: ShareFilterButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the reset timer on unmount.
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);

      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // Clipboard API unavailable or denied — fall back to prompt.
      window.prompt("Copy this link:", shareUrl);
    }
  }, [shareUrl]);

  const classes = [
    "share-filter-button",
    copied ? "is-copied" : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-label={copied ? "Link copied to clipboard" : "Copy shareable link"}
      className={classes}
      onClick={handleClick}
      title={copied ? "Copied!" : "Copy link to current filters"}
      type="button"
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
