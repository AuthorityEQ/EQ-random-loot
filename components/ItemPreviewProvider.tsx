"use client";

import "@/components/item-drawer.css";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { EqItemInspect } from "@/components/EqItemInspect";
import type { ItemDetails } from "@/lib/search";
import { fetchUserSettings, saveUserSettings } from "@/lib/user-settings-client";

type PreviewState = {
  itemName: string;
  details?: ItemDetails;
  footer?: React.ReactNode;
  x: number;
  y: number;
};

type ItemPreviewContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  hidePreview: () => void;
  previewProps: (itemName: string, details?: ItemDetails, footer?: React.ReactNode) => {
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
  const [ready, setReady] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewPositionRef = useRef<{ details?: ItemDetails; itemName: string; x: number; y: number } | null>(null);
  const { status: authStatus, data: session } = useSession();
  const isSignedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  useEffect(() => {
    setEnabledState(readEnabled());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !isSignedIn) return;
    let cancelled = false;
    fetchUserSettings()
      .then((settings) => {
        const remoteEnabled = settings?.preferences.itemPreview;
        if (!cancelled && typeof remoteEnabled === "boolean") {
          setEnabledState(remoteEnabled);
          window.localStorage.setItem(storageKey, remoteEnabled ? "on" : "off");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, ready]);

  function setEnabled(nextEnabled: boolean) {
    setEnabledState(nextEnabled);
    setPreview(null);
    window.localStorage.setItem(storageKey, nextEnabled ? "on" : "off");
    if (isSignedIn) {
      window.setTimeout(() => {
        saveUserSettings({ preferences: { itemPreview: nextEnabled } }).catch(() => {});
      }, 400);
    }
  }

  const value = useMemo<ItemPreviewContextValue>(() => {
    function hidePreviewSoon() {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      hideTimer.current = setTimeout(() => {
        previewPositionRef.current = null;
        setPreview(null);
      }, 90);
    }

    function updatePreview(itemName: string, details: ItemDetails | undefined, footer: React.ReactNode | undefined, event: React.MouseEvent<HTMLElement>) {
      if (!enabled || !canHoverPreview() || !details) return;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      const previous = previewPositionRef.current;
      if (
        previous
        && previous.itemName === itemName
        && previous.details === details
        && Math.abs(previous.x - event.clientX) < 8
        && Math.abs(previous.y - event.clientY) < 8
      ) {
        return;
      }
      previewPositionRef.current = { details, itemName, x: event.clientX, y: event.clientY };
      setPreview({ itemName, details, footer, x: event.clientX, y: event.clientY });
    }

    return {
      enabled,
      setEnabled,
      hidePreview: () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        previewPositionRef.current = null;
        setPreview(null);
      },
      previewProps: (itemName: string, details?: ItemDetails, footer?: React.ReactNode) => ({
        onMouseEnter: (event) => updatePreview(itemName, details, footer, event),
        onMouseMove: (event) => updatePreview(itemName, details, footer, event),
        onMouseLeave: hidePreviewSoon,
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
  if (typeof document === "undefined") return null;

  return createPortal(
    <aside className="item-preview-tooltip" style={style} aria-hidden="true">
      <EqItemInspect compact details={details} itemName={preview.itemName} />
      {preview.footer ? <div className="item-preview-footer">{preview.footer}</div> : null}
    </aside>,
    document.body,
  );
}

function getTooltipStyle(x: number, y: number) {
  const margin = 12;
  const offset = 18;
  const width = Math.min(420, window.innerWidth - margin * 2);
  const estimatedHeight = Math.min(520, window.innerHeight - margin * 2);
  const spaceRight = window.innerWidth - x - margin;
  const spaceBelow = window.innerHeight - y - margin;
  const preferredLeft = spaceRight >= width + offset ? x + offset : x - width - offset;
  const preferredTop = spaceBelow >= estimatedHeight * 0.68 ? y + offset : y - estimatedHeight - offset;
  const left = Math.min(Math.max(margin, preferredLeft), window.innerWidth - width - margin);
  const top = Math.min(Math.max(margin, preferredTop), window.innerHeight - estimatedHeight - margin);

  return {
    left,
    maxHeight: estimatedHeight,
    top,
    width,
  };
}
