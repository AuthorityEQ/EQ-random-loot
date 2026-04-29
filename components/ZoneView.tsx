"use client";

import { useEffect, useRef, useState } from "react";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { matchesStatusFilter, type ItemFilter } from "@/lib/item-status";
import type { Bucket, ItemDetails } from "@/lib/search";
import type { ZoneView as ZoneViewData } from "@/lib/zones";

type ZoneViewProps = {
  zoneView: ZoneViewData;
  activeFilter: ItemFilter;
  focusedMob?: {
    name: string;
    level: number;
    zone: string;
    bucket: number;
    expansion: string;
  } | null;
  reviewMode: boolean;
  getItemDetails: (itemName: string) => ItemDetails | undefined;
  onClearZone: () => void;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
  onSelectZone: (zone: string) => void;
};

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

export function ZoneView({
  zoneView,
  activeFilter,
  focusedMob = null,
  reviewMode,
  getItemDetails,
  onClearZone,
  onSelectLoot,
}: ZoneViewProps) {
  const [highlightedBucketKey, setHighlightedBucketKey] = useState<string | null>(null);
  const [selectedMobKey, setSelectedMobKey] = useState<string | null>(null);
  const [openBucketKeys, setOpenBucketKeys] = useState<Set<string>>(new Set());
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
  const bestBucket = [...zoneView.bucketGroups].sort((a, b) => b.mobs.length - a.mobs.length || Number(a.bucket.level_range.split("-")[0]) - Number(b.bucket.level_range.split("-")[0]))[0];

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  const getBucketKey = (bucket: Bucket) => `${bucket.expansion}-${bucket.bucket}-${bucket.level_range}`;
  const getMobKey = (bucket: Bucket, mobName: string, level: number) => `${getBucketKey(bucket)}-${mobName}-${level}`;
  function selectMobBucket(bucket: Bucket, mobName: string, level: number) {
    const bucketKey = getBucketKey(bucket);
    setSelectedMobKey(getMobKey(bucket, mobName, level));
    setOpenBucketKeys((current) => new Set(current).add(bucketKey));
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
    selectMobBucket(match.bucket, focusedMob.name, focusedMob.level);
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
          {bestBucket ? (
            <div className="zone-best-bucket">
              <span>Best bucket: {bestBucket.bucket.level_range}</span>
              <strong>{bestBucket.mobs.length} mobs</strong>
            </div>
          ) : null}
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
            <button className={`zone-mob-item bucket-tone-${bucket.bucket % 6}`} key={`${bucket.expansion}-${bucket.bucket}-${mob.name}-${mob.level}`} onClick={() => selectMobBucket(bucket, mob.name, mob.level)} type="button">
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
          <h3>Buckets</h3>
          <span>{zoneView.bucketGroups.length}</span>
        </div>
        <div className="zone-bucket-overview">
          {zoneView.bucketGroups.map(({ bucket, mobs }) => (
            <details
              className={`zone-bucket-card bucket-tone-${bucket.bucket % 6}`}
              key={`${bucket.expansion}-${bucket.bucket}`}
              onToggle={(event) => {
                const bucketKey = getBucketKey(bucket);
                const isOpen = event.currentTarget.open;
                setOpenBucketKeys((current) => {
                  const next = new Set(current);
                  if (isOpen) {
                    next.add(bucketKey);
                  } else {
                    next.delete(bucketKey);
                  }
                  return next;
                });
              }}
              open={openBucketKeys.has(getBucketKey(bucket))}
            >
              <summary>
                <span>Bucket {bucket.level_range}</span>
                <strong>{mobs.length} mobs</strong>
              </summary>
              <ul>
                {mobs.map((mob) => (
                  <li className={selectedMobKey === getMobKey(bucket, mob.name, mob.level) ? "is-selected" : undefined} key={`${mob.name}-${mob.level}`}>
                    <span>{mob.name}</span>
                    <strong>{mob.level}</strong>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section className="zone-panel">
        <div className="zone-panel-heading">
          <h3>Loot in {zoneView.zone}</h3>
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
        </div>
        <div className="zone-loot-groups">
          {zoneView.bucketGroups.map(({ bucket }) => {
            const visibleLoot = bucket.loot_pool.filter((item) => matchesStatusFilter(getItemDetails(item), activeFilter, reviewMode));
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
                            <span>{item}</span>
                            <FavoriteIndicator details={details} itemName={item} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="loot-empty">No loot items in this bucket match the active review filters.</p>
                )}
              </details>
            );
          })}
        </div>
      </section>
    </section>
  );
}
