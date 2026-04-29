"use client";

import { useBucketDisplay } from "@/components/BucketDisplayProvider";

export function BucketDisplayToggle() {
  const { bucketed, setBucketed } = useBucketDisplay();

  return (
    <div className="item-preview-toggle" aria-label="Bucketed item display">
      <span>Buckets</span>
      <button
        aria-pressed={!bucketed}
        className={!bucketed ? "theme-toggle-button is-active" : "theme-toggle-button"}
        onClick={() => setBucketed(false)}
        type="button"
      >
        Off
      </button>
      <button
        aria-pressed={bucketed}
        className={bucketed ? "theme-toggle-button is-active" : "theme-toggle-button"}
        onClick={() => setBucketed(true)}
        type="button"
      >
        On
      </button>
    </div>
  );
}
