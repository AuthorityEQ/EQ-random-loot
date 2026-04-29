"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";
import { EqItemInspect } from "@/components/EqItemInspect";
import type { ItemDetails } from "@/lib/search";

type PreviewState = {
  itemName: string;
  details?: ItemDetails;
  x: number;
  y: number;
};

type ItemPreviewContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  previewProps: (itemName: string, details?: ItemDetails) => {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseMove: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
  };
};

const storageKey = "frostreaver-item-preview";
const ItemPreviewContext = createContext<ItemPreviewContextValue | null>(null);

function canHoverPreview() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function readEnabled() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved === null ? true : saved === "on";
  } catch {
    return true;
  }
}

export function ItemPreviewProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    setEnabledState(readEnabled());
  }, []);

  function setEnabled(nextEnabled: boolean) {
    setEnabledState(nextEnabled);
    setPreview(null);
    window.localStorage.setItem(storageKey, nextEnabled ? "on" : "off");
  }

  const value = useMemo<ItemPreviewContextValue>(() => {
    function updatePreview(itemName: string, details: ItemDetails | undefined, event: React.MouseEvent<HTMLElement>) {
      if (!enabled || !canHoverPreview() || !details) return;
      setPreview({ itemName, details, x: event.clientX, y: event.clientY });
    }

    return {
      enabled,
      setEnabled,
      previewProps: (itemName: string, details?: ItemDetails) => ({
        onMouseEnter: (event) => updatePreview(itemName, details, event),
        onMouseMove: (event) => updatePreview(itemName, details, event),
        onMouseLeave: () => setPreview(null),
      }),
    };
  }, [enabled]);

  return (
    <ItemPreviewContext.Provider value={value}>
      {children}
      {enabled && preview ? <ItemPreviewTooltip preview={preview} /> : null}
    </ItemPreviewContext.Provider>
  );
}

export function useItemPreview() {
  const context = useContext(ItemPreviewContext);
  if (!context) {
    throw new Error("useItemPreview must be used inside ItemPreviewProvider");
  }
  return context;
}

function ItemPreviewTooltip({ preview }: { preview: PreviewState }) {
  const style = getTooltipStyle(preview.x, preview.y);
  const details = preview.details;
  if (!details) return null;

  return (
    <aside className="item-preview-tooltip" style={style} aria-hidden="true">
      <EqItemInspect compact details={details} itemName={preview.itemName} />
    </aside>
  );
}

function getTooltipStyle(x: number, y: number) {
  const width = 320;
  const height = 280;
  const left = Math.min(x + 18, window.innerWidth - width - 12);
  const top = Math.min(y + 18, window.innerHeight - height - 12);
  return {
    left: Math.max(12, left),
    top: Math.max(12, top),
  };
}
