"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import confidenceData from "@/data/loot-confidence.json";
import { DEFAULT_CONFIDENCE, type ConfidenceMetadata } from "@/lib/confidence";
import { type StatFilter } from "@/lib/item-use-filters";
import type { Bucket, ItemDetails } from "@/lib/search";
import { zoneToSlug } from "@/lib/zone-slug";

export type MobLootEntry = {
  /** Unique key: name + zone + level */
  key: string;
  mob: {
    name: string;
    level: number;
    zone: string;
    expansion: string;
  };
  bucket: Bucket;
  /** Filtered loot item names visible after all active filters */
  items: string[];
};

type MobLootListProps = {
  rows: MobLootEntry[];
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
  getItemDetails: (itemName: string) => ItemDetails | undefined;
  getItemStatDisplay: (itemName: string) => string | null;
  statFilter: StatFilter;
  pageSize?: number;
};

export function MobLootList({
  rows,
  onSelectLoot,
  getItemDetails,
  getItemStatDisplay,
  pageSize = 50,
}: MobLootListProps) {
  const { previewProps } = useItemPreview();
  const [renderedCount, setRenderedCount] = useState(pageSize);

  // Reset pagination whenever the result set changes (filter/search change).
  useEffect(() => {
    setRenderedCount(pageSize);
  }, [rows.length, pageSize]);

  const visibleRows = rows.slice(0, renderedCount);
  const remaining = rows.length - renderedCount;

  return (
    <section className="zone-panel matching-items-panel mob-loot-panel">
      <div className="zone-panel-heading">
        <h3>Mobs</h3>
        <span>{rows.length}</span>
      </div>
      {rows.length > 0 ? (
        <>
          <div className="mob-loot-list">
            {visibleRows.map(({ key, mob, bucket, items }) => {
              const zoneSlug = zoneToSlug(mob.zone);
              return (
                <details
                  className={`zone-loot-group bucket-tone-${bucket.bucket % 6} mob-loot-row`}
                  key={key}
                >
                  <summary className="zone-loot-summary mob-loot-summary">
                    <span className="mob-loot-name">{mob.name}</span>
                    <span className="mob-loot-meta">
                      <span className="mob-loot-level">Lvl {mob.level}</span>
                      <Link
                        className="mob-loot-zone-link"
                        href={`/zone/${zoneSlug}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {mob.zone}
                      </Link>
                    </span>
                    <strong className="mob-loot-count">{items.length} items</strong>
                  </summary>
                  {items.length > 0 ? (
                    <ul className="zone-loot-list">
                      {items.map((itemName) => {
                        const details = getItemDetails(itemName);
                        const statDisplay = getItemStatDisplay(itemName);
                        const meta =
                          (confidenceData as unknown as Record<string, ConfidenceMetadata>)[itemName] ??
                          DEFAULT_CONFIDENCE;
                        return (
                          <li key={itemName}>
                            <button
                              className="loot-button"
                              onClick={() => onSelectLoot(itemName, bucket)}
                              type="button"
                              {...previewProps(itemName, details)}
                            >
                              <span className="loot-item-label">
                                <ItemIcon details={details} />
                                <span>{itemName}</span>
                              </span>
                              <span className="loot-item-actions">
                                {statDisplay ? (
                                  <span className="loot-stat-value">{statDisplay}</span>
                                ) : null}
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
                  ) : null}
                </details>
              );
            })}
          </div>
          {remaining > 0 ? (
            <div className="show-more-row">
              <button
                className="show-more-button"
                onClick={() => setRenderedCount((c) => c + pageSize)}
                type="button"
              >
                Show more ({remaining} remaining)
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="loot-empty">No mobs match the active filters.</p>
      )}
    </section>
  );
}
