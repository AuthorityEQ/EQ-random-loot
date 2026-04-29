"use client";

import { useItemPreview } from "@/components/ItemPreviewProvider";

export function ItemPreviewToggle() {
  const { enabled, setEnabled } = useItemPreview();

  return (
    <div className="item-preview-toggle" aria-label="Item preview">
      <span>Item Preview</span>
      <button
        aria-pressed={!enabled}
        className={!enabled ? "theme-toggle-button is-active" : "theme-toggle-button"}
        onClick={() => setEnabled(false)}
        type="button"
      >
        Off
      </button>
      <button
        aria-pressed={enabled}
        className={enabled ? "theme-toggle-button is-active" : "theme-toggle-button"}
        onClick={() => setEnabled(true)}
        type="button"
      >
        On
      </button>
    </div>
  );
}
