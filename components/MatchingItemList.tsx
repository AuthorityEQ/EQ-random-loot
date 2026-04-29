"use client";

import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import type { Bucket, ItemDetails } from "@/lib/search";

export type MatchingItemRow = {
  itemName: string;
  bucket: Bucket;
  details?: ItemDetails;
  statDisplay?: string | null;
};

type MatchingItemListProps = {
  rows: MatchingItemRow[];
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
};

export function MatchingItemList({ rows, onSelectLoot }: MatchingItemListProps) {
  const { previewProps } = useItemPreview();

  return (
    <section className="zone-panel matching-items-panel">
      <div className="zone-panel-heading">
        <h3>Matching Items</h3>
        <span>{rows.length}</span>
      </div>
      {rows.length > 0 ? (
        <ul className="zone-loot-list matching-item-list">
          {rows.map(({ itemName, bucket, details, statDisplay }) => (
            <li key={itemName}>
              <button className="loot-button" onClick={() => onSelectLoot(itemName, bucket)} type="button" {...previewProps(itemName, details)}>
                <span className="loot-item-label">
                  <ItemIcon details={details} />
                  <span>{itemName}</span>
                </span>
                <span className="loot-item-actions">
                  {statDisplay ? <span className="loot-stat-value">{statDisplay}</span> : null}
                  <FavoriteIndicator details={details} itemName={itemName} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="loot-empty">No matching items found.</p>
      )}
    </section>
  );
}
