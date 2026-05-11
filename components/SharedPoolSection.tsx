"use client";

import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { itemHasFocusEffect } from "@/lib/item-effects";
import type { Bucket, ItemDetails } from "@/lib/search";

type SharedPoolSectionProps = {
  /** Section header label, e.g. "Velious Tier 1" or "Levels 50-55" */
  title: string;
  /** Optional kicker above the title, e.g. "Raid Tier" or "Loot Bucket" */
  kicker?: string;
  /** Optional summary line, e.g. "5 bosses · 27 items" */
  summary?: string;
  /** The deduped flat list of item names */
  items: string[];
  /** Resolves an item name to its full details (icon, stats, etc.) */
  getItemDetails: (itemName: string) => ItemDetails | undefined;
  /** Optional: returns the bosses/mobs that drop a given item — for "dropped by" badges */
  getDroppedBy?: (itemName: string) => string[];
  /** Bucket to attach when item is clicked (used by drawer's "Best Farming Locations") */
  getBucketForItem: (itemName: string) => Bucket;
  /** Click handler — typically opens the drawer */
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
};

export function SharedPoolSection({
  title,
  kicker,
  summary,
  items,
  getItemDetails,
  getDroppedBy,
  getBucketForItem,
  onSelectLoot,
}: SharedPoolSectionProps) {
  const { previewProps } = useItemPreview();

  return (
    <section className="shared-pool-section">
      <header className="shared-pool-header">
        {kicker ? <p className="shared-pool-kicker">{kicker}</p> : null}
        <h2 className="shared-pool-title">{title}</h2>
        {summary ? <p className="shared-pool-summary">{summary}</p> : null}
      </header>
      <ul className="shared-pool-list">
        {items.map((itemName) => {
          const details = getItemDetails(itemName);
          const droppedBy = getDroppedBy?.(itemName) ?? [];
          return (
            <li key={itemName}>
              <button
                className="loot-button"
                onClick={() => onSelectLoot(itemName, getBucketForItem(itemName))}
                type="button"
                {...previewProps(itemName, details)}
              >
                <span className="loot-item-label">
                  <ItemIcon details={details} />
                  <span>{itemName}</span>
                </span>
                <span className="loot-item-actions">
                  {itemHasFocusEffect(details) ? <span className="loot-focus-badge">Focus</span> : null}
                  {droppedBy.length > 1 ? (
                    <span className="shared-pool-dropped-by" title={droppedBy.join(", ")}>
                      ×{droppedBy.length}
                    </span>
                  ) : null}
                  <FavoriteIndicator details={details} itemName={itemName} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
