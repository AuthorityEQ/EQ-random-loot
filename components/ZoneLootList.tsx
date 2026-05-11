"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { useSharedLoot } from "@/components/SharedLootToggle";
import itemDetailsData from "@/data/item-details.json";
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
  const { enabled: sharedLoot } = useSharedLoot();
  const [drawerItem, setDrawerItem] = useState<{ item: string; bucket: Bucket } | null>(null);

  // When sharedLoot is off, narrow to items that appear in at least one mob's
  // own loot array (per-mob mode for non-random-loot servers).
  const displayItems: string[] = sharedLoot
    ? items
    : (() => {
        const mobOwned = new Set(bucket.mobs.flatMap((m) => m.loot));
        return items.filter((item) => mobOwned.has(item));
      })();

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
        {displayItems.map((itemName) => {
          const details = itemDetailsMap[itemName];
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
