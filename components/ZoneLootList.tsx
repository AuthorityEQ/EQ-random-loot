"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import confidenceData from "@/data/loot-confidence.json";
import itemDetailsData from "@/data/item-details.json";
import { DEFAULT_CONFIDENCE, type ConfidenceMetadata } from "@/lib/confidence";
import { itemToSlug } from "@/lib/item-slug";
import { zoneToSlug } from "@/lib/zone-slug";
import type { Bucket, ItemDetailsMap } from "@/lib/search";

const itemDetailsMap = itemDetailsData as ItemDetailsMap;

type ZoneLootListProps = {
  items: string[];
  /** A Bucket-shaped object the drawer can attach to. The zone page builds one
      synthetic bucket per group/boss; pass it through. */
  bucket: Bucket;
  /** Optional: when this zone has multiple sources (raid bosses) for the same
      item, pass a per-item bucket map so the drawer's "Best Farming Locations"
      can list all of them. */
  itemBucketMap?: Record<string, Bucket[]>;
};

export function ZoneLootList({ items, bucket, itemBucketMap }: ZoneLootListProps) {
  const router = useRouter();
  const { previewProps } = useItemPreview();
  const [drawerItem, setDrawerItem] = useState<{ item: string; bucket: Bucket } | null>(null);

  // Cmd/Ctrl+click → open /item/<slug> in new tab
  const modifierHeldRef = useRef(false);
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      modifierHeldRef.current = event.metaKey || event.ctrlKey;
    }
    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => document.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, []);

  function handleSelectLoot(itemName: string, b: Bucket) {
    if (modifierHeldRef.current) {
      window.open(`/item/${itemToSlug(itemName)}`, "_blank", "noopener");
      modifierHeldRef.current = false;
      return;
    }
    setDrawerItem({ item: itemName, bucket: b });
  }

  return (
    <>
      <ul className="zone-loot-list">
        {items.map((itemName) => {
          const details = itemDetailsMap[itemName];
          const meta =
            (confidenceData as unknown as Record<string, ConfidenceMetadata>)[itemName] ??
            DEFAULT_CONFIDENCE;
          return (
            <li key={itemName}>
              <button
                className="loot-button"
                onClick={() => handleSelectLoot(itemName, bucket)}
                type="button"
                {...previewProps(itemName, details)}
              >
                <span className="loot-item-label">
                  <ItemIcon details={details} />
                  <span>{itemName}</span>
                </span>
                <span className="loot-item-actions">
                  {(meta.tier === "verified" || meta.tier === "high") && (
                    <ConfidenceBadge compact meta={meta} />
                  )}
                  <FavoriteIndicator details={details} itemName={itemName} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {drawerItem !== null ? (
        <ItemDrawer
          bucket={drawerItem.bucket}
          itemBuckets={
            itemBucketMap?.[drawerItem.item] ?? [drawerItem.bucket]
          }
          contentType="Zone"
          details={itemDetailsMap[drawerItem.item]}
          expansion={drawerItem.bucket.expansion}
          itemName={drawerItem.item}
          onClose={() => setDrawerItem(null)}
          onSelectZone={(zone) => {
            setDrawerItem(null);
            router.push(`/zone/${zoneToSlug(zone)}`);
          }}
        />
      ) : null}
    </>
  );
}
