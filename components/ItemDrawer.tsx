"use client";

import { useEffect, useRef } from "react";
import { ItemDetailBody } from "@/components/ItemDetailBody";
import type { Bucket, ItemDetails } from "@/lib/search";

type ItemDrawerProps = {
  itemName: string;
  details?: ItemDetails;
  bucket?: Bucket;
  itemBuckets?: Bucket[];
  expansion?: string;
  contentType: string;
  onClose: () => void;
  onSelectZone?: (zone: string) => void;
};

export function ItemDrawer({
  itemName,
  details,
  bucket,
  itemBuckets,
  contentType: _contentType,
  onClose,
  onSelectZone,
}: ItemDrawerProps) {
  const allBuckets = itemBuckets?.length ? itemBuckets : bucket ? [bucket] : [];
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Move focus to the close button when the drawer mounts
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        aria-labelledby="item-drawer-title"
        aria-modal="true"
        className="item-drawer"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          aria-label="Close item details"
          className="drawer-close"
          onClick={onClose}
        >
          x
        </button>

        <ItemDetailBody
          allBuckets={allBuckets}
          bucket={bucket}
          details={details}
          itemName={itemName}
          onSelectZone={onSelectZone}
        />
      </aside>
    </div>
  );
}
