"use client";

import { useEffect, useRef, useState } from "react";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import type { MatchingItemRow } from "@/components/MatchingItemList";
import type { Bucket, ItemDetails } from "@/lib/search";
import type { ZoneView as ZoneViewData } from "@/lib/zones";

type ZoneViewProps = {
  zoneView: ZoneViewData;
  bucketed: boolean;
  focusedMob?: {
    name: string;
    level: number;
    zone: string;
    bucket: number;
    expansion: string;
  } | null;
  getItemDetails: (itemName: string) => ItemDetails | undefined;
  itemIsVisible: (itemName: string) => boolean;
  onClearZone: () => void;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
  onSelectZone: (zone: string) => void;
};

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

function bucketSortValue(bucket: Bucket) {
  return Number(bucket.level_range.match(/\d+/)?.[0] ?? 999);
}

function uniqueSortedItemRows(rows: MatchingItemRow[]) {
  const itemMap = new Map<string, MatchingItemRow>();

  for (const row of [...rows].sort((a, b) => bucketSortValue(a.bucket) - bucketSortValue(b.bucket) || a.itemName.localeCompare(b.itemName))) {
    if (!itemMap.has(row.itemName)) {
      itemMap.set(row.itemName, row);
    }
  }

  return Array.from(itemMap.values()).sort((a, b) => bucketSortValue(a.bucket) - bucketSortValue(b.bucket) || a.itemName.localeCompare(b.itemName));
}

export function ZoneView({
  zoneView,
  bucketed,
  focusedMob = null,
  getItemDetails,
  itemIsVisible,
  onClearZone,
  onSelectLoot,
}: ZoneViewProps) {
  const [highlightedBucketKey, setHighlightedBucketKey] = useState<string | null>(null);
  const [openLootKeys, setOpenLootKeys] = useState<Set<string>>(new Set());
  const { previewProps } = useItemPreview();
  const lootRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expansions = Array.from(new Set(zoneView.bucketGroups.map(({ bucket }) => bucket.expansion))).sort((a, b) => a.localeCompare(b));
  const levelRanges = Array.from(new Set(zoneView.bucketGroups.map(({ bucket }) => bucket.level_range)))
    .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const allMobs = zoneView.bucketGroups
    .flatMap(({ mobs, bucket }) => mobs.map((mob) => ({ mob, bucket })))
    .sort((a, b) => a.mob.level - b.mob.level || a.mob.name.localeCompare(b.mob.name));
  const flatItemRows = uniqueSortedItemRows(zoneView.bucketGroups.flatMap(({ bucket }) =>
    bucket.loot_pool
      .filter(itemIsVisible)
      .map((itemName) => ({ itemName, bucket, details: getItemDetails(itemName) })),
  ));

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  const getBucketKey = (bucket: Bucket) => `${bucket.expansion}-${bucket.bucket}-${bucket.level_range}`;
  function selectMobBucket(bucket: Bucket) {
    const bucketKey = getBucketKey(bucket);
    setOpenLootKeys((current) => new Set(current).add(bucketKey));
    setHighlightedBucketKey(bucketKey);

    window.requestAnimationFrame(() => {
      lootRefs.current[bucketKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }

    highlightTimer.current = setTimeout(() => {
      setHighlightedBucketKey(null);
    }, 1800);
  }

  useEffect(() => {
    if (!focusedMob) return;
    const match = zoneView.bucketGroups.find(({ bucket, mobs }) =>
      bucket.expansion === focusedMob.expansion
      && bucket.bucket === focusedMob.bucket
      && mobs.some((mob) => mob.name === focusedMob.name && mob.level === focusedMob.level),
    );
    if (!match) return;
    selectMobBucket(match.bucket);
  }, [focusedMob, zoneView]);

  return (
    <section className="zone-view" aria-label={`${zoneView.zone} zone view`}>
      <div className={`zone-view-header ${expansions.length === 1 ? expansionTone(expansions[0]!) : ""}`}>
        <div>
          <div className="expansion-pill-row">
            {expansions.map((expansion) => (
              <span className={`expansion-pill ${expansionTone(expansion)}`} key={expansion}>
                {expansion}
              </span>
            ))}
          </div>
          <h2>{zoneView.zone}</h2>
          <div className="zone-summary-line">
            <strong>{zoneView.totalMobs} named mobs</strong>
            <span>Levels {levelRanges.join(", ")}</span>
          </div>
        </div>
        <button className="clear-zone-button" onClick={onClearZone} type="button">
          Clear zone filter
        </button>
      </div>

      <section className="zone-panel zone-named-panel">
        <div className="zone-panel-heading">
          <h3>Named mobs</h3>
          <span>{allMobs.length}</span>
        </div>
        <div className="zone-mob-list">
          {allMobs.map(({ mob, bucket }) => (
            <button className={`zone-mob-item bucket-tone-${bucket.bucket % 6}`} key={`${bucket.expansion}-${bucket.bucket}-${mob.name}-${mob.level}`} onClick={() => selectMobBucket(bucket)} type="button">
              <strong>{mob.name}</strong>
              <span>
                <b>{bucket.level_range}</b>
                Level {mob.level}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="zone-panel">
        <div className="zone-panel-heading">
          <h3>{bucketed ? `Loot in ${zoneView.zone}` : "Matching Items"}</h3>
          {bucketed ? (
            <div className="zone-loot-actions" aria-label="Loot section controls">
              <button
                onClick={() => setOpenLootKeys(new Set(zoneView.bucketGroups.map(({ bucket }) => getBucketKey(bucket))))}
                type="button"
              >
                Expand all
              </button>
              <button onClick={() => setOpenLootKeys(new Set())} type="button">
                Collapse all
              </button>
            </div>
          ) : <span>{flatItemRows.length}</span>}
        </div>
        {bucketed ? (
          <div className="zone-loot-groups">
            {zoneView.bucketGroups.map(({ bucket }) => {
              const visibleLoot = bucket.loot_pool.filter(itemIsVisible);
              const bucketKey = getBucketKey(bucket);

              return (
                <details
                  className={`zone-loot-group bucket-tone-${bucket.bucket % 6}${highlightedBucketKey === getBucketKey(bucket) ? " is-highlighted" : ""}`}
                  id={`bucket-${bucket.level_range.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}`}
                  key={`${bucket.expansion}-${bucket.bucket}`}
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open;
                    setOpenLootKeys((current) => {
                      const next = new Set(current);
                      if (isOpen) {
                        next.add(bucketKey);
                      } else {
                        next.delete(bucketKey);
                      }
                      return next;
                    });
                  }}
                  open={openLootKeys.has(bucketKey)}
                  ref={(element) => {
                    lootRefs.current[bucketKey] = element;
                  }}
                >
                  <summary className="zone-loot-summary">
                    <span>Levels {bucket.level_range}</span>
                    <strong>{visibleLoot.length} items</strong>
                  </summary>
                  {visibleLoot.length > 0 ? (
                    <ul className="zone-loot-list">
                      {visibleLoot.map((item) => {
                        const details = getItemDetails(item);
                        return (
                          <li key={item}>
                            <button className="loot-button" onClick={() => onSelectLoot(item, bucket)} type="button" {...previewProps(item, details)}>
                              <span className="loot-item-label">
                                <ItemIcon details={details} />
                                <span>{item}</span>
                              </span>
                              <FavoriteIndicator details={details} itemName={item} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="loot-empty">No loot items in this bucket.</p>
                  )}
                </details>
              );
            })}
          </div>
        ) : flatItemRows.length > 0 ? (
          <ul className="zone-loot-list matching-item-list">
            {flatItemRows.map(({ itemName, bucket, details }) => (
              <li key={itemName}>
                <button className="loot-button" onClick={() => onSelectLoot(itemName, bucket)} type="button" {...previewProps(itemName, details)}>
                  <span className="loot-item-label">
                    <ItemIcon details={details} />
                    <span>{itemName}</span>
                  </span>
                  <FavoriteIndicator details={details} itemName={itemName} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="loot-empty">No matching items found.</p>
        )}
      </section>
    </section>
  );
}
