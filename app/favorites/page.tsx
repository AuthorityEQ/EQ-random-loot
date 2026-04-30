"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { useFavorites } from "@/components/FavoritesProvider";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import "@/components/bucket-card.css";
import classicData from "@/data/classic-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkData from "@/data/kunark-group-named.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousData from "@/data/velious-group-named.json";
import veliousRaidData from "@/data/velious-raid.json";
import type { Bucket, ItemDetailsMap, LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";

const datasets = [classicData, kunarkData, veliousData] as LootDataset[];
const buckets = datasets.flatMap((dataset) => dataset.buckets);

// Build a synthetic Bucket for each raid boss so raid-only favorites
// can open the item drawer (and be unfavorited) just like group-named items.
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
let _raidBucketCounter = 0;
/** Maps item name → first raid Bucket that contains it. */
const raidItemBucketMap = new Map<string, Bucket>();
for (const ds of raidDatasets) {
  for (const tier of ds.tiers) {
    for (const boss of tier.bosses) {
      if (!boss.loot_pool?.length) continue;
      _raidBucketCounter += 1;
      const syntheticBucket: Bucket = {
        bucket: _raidBucketCounter,
        level_range: String(boss.level),
        expansion: ds.expansion,
        mobs: [
          {
            name: boss.name,
            level: boss.level,
            zone: boss.zone,
            expansion: ds.expansion,
            source_bucket: boss.name,
            loot: boss.loot_pool,
          },
        ],
        zones: [boss.zone],
        loot_pool: boss.loot_pool,
        mob_count: 1,
        loot_count: boss.loot_pool.length,
        zone_count: 1,
      };
      for (const itemName of boss.loot_pool) {
        if (!raidItemBucketMap.has(itemName)) {
          raidItemBucketMap.set(itemName, syntheticBucket);
        }
      }
    }
  }
}
const itemDetails = itemDetailsData as ItemDetailsMap;
const expansionOrder = ["Classic", "Kunark", "Velious"];
const lockStorageKey = "frostreaver-favorites-locked";
type ViewMode = "grouped" | "flat";

type FavoriteSelection = {
  itemName: string;
  bucket: Bucket;
  itemBuckets: Bucket[];
};

type FavoriteRow = {
  id: string;
  name: string;
  details: ItemDetailsMap[string] | undefined;
  itemBuckets: Bucket[];
  firstBucket: Bucket | undefined;
  bestZone: string | null;
};

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites();
  const [selectedLoot, setSelectedLoot] = useState<FavoriteSelection | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [favoritesLocked, setFavoritesLocked] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(lockStorageKey);
      setFavoritesLocked(saved === null ? true : saved !== "unlocked");
    } catch {
      setFavoritesLocked(true);
    }
  }, []);

  function setLockState(locked: boolean) {
    setFavoritesLocked(locked);
    window.localStorage.setItem(lockStorageKey, locked ? "locked" : "unlocked");
  }

  function removeFavorite(name: string, details: FavoriteRow["details"]) {
    if (favoritesLocked) return;
    toggleFavorite(name, details);
  }
  const favoriteRows = useMemo(
    () =>
      favorites.map((favorite) => {
        const itemBuckets = buckets.filter((bucket) => bucket.loot_pool.includes(favorite.name));
        const groupFirstBucket = itemBuckets
          .sort((a, b) =>
            expansionOrder.indexOf(a.expansion) - expansionOrder.indexOf(b.expansion)
            || rangeSortValue(a.level_range) - rangeSortValue(b.level_range)
            || a.level_range.localeCompare(b.level_range),
          )[0];
        // Fall back to a synthetic raid bucket when the item has no group-named bucket.
        const firstBucket = groupFirstBucket ?? raidItemBucketMap.get(favorite.name);
        const bestZone = firstBucket ? bestZoneForBucket(firstBucket) : null;
        return {
          ...favorite,
          details: itemDetails[favorite.name],
          itemBuckets,
          firstBucket,
          bestZone,
        };
      }).sort((a, b) =>
        expansionOrder.indexOf(a.firstBucket?.expansion ?? "") - expansionOrder.indexOf(b.firstBucket?.expansion ?? "")
        || rangeSortValue(a.firstBucket?.level_range ?? "") - rangeSortValue(b.firstBucket?.level_range ?? "")
        || a.name.localeCompare(b.name),
      ),
    [favorites],
  );
  const groupedFavorites = useMemo(() => {
    const groups = new Map<string, typeof favoriteRows>();

    for (const row of favoriteRows) {
      const expansion = row.firstBucket?.expansion ?? "Unknown";
      const range = row.firstBucket?.level_range ?? "No bucket";
      const key = `${expansion}|${range}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    return Array.from(groups.entries())
      .map(([key, rows]) => {
        const [expansion, range] = key.split("|");
        return {
          expansion,
          range,
          rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
        };
      })
      .sort((a, b) =>
        expansionOrder.indexOf(a.expansion) - expansionOrder.indexOf(b.expansion)
        || rangeSortValue(a.range) - rangeSortValue(b.range)
        || a.range.localeCompare(b.range),
      );
  }, [favoriteRows]);

  function openFavorite(name: string, firstBucket?: Bucket, itemBuckets: Bucket[] = []) {
    if (firstBucket) {
      setSelectedLoot({ itemName: name, bucket: firstBucket, itemBuckets });
    }
  }

  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="header">
        <div>
          <p className="eyebrow">Local favorites</p>
          <h1>Favorites</h1>
          <p className="subhead">A color-coded farming checklist grouped by expansion and level range.</p>
        </div>
        <div className="favorites-controls">
          <div className={favoritesLocked ? "favorites-lock is-locked" : "favorites-lock is-unlocked"} aria-label="Favorites lock">
            <span>{favoritesLocked ? "Favorites locked" : "Favorites unlocked"}</span>
            <button
              aria-pressed={favoritesLocked}
              className={favoritesLocked ? "filter-button is-active" : "filter-button"}
              onClick={() => setLockState(true)}
              type="button"
            >
              Lock
            </button>
            <button
              aria-pressed={!favoritesLocked}
              className={!favoritesLocked ? "filter-button is-active" : "filter-button"}
              onClick={() => setLockState(false)}
              type="button"
            >
              Unlock
            </button>
          </div>
          <div className="favorites-view-toggle" aria-label="Favorites view">
            <button className={viewMode === "grouped" ? "filter-button is-active" : "filter-button"} onClick={() => setViewMode("grouped")} type="button">
              Grouped
            </button>
            <button className={viewMode === "flat" ? "filter-button is-active" : "filter-button"} onClick={() => setViewMode("flat")} type="button">
              Flat
            </button>
          </div>
        </div>
      </header>

      {favoriteRows.length > 0 && viewMode === "grouped" ? (
        <div className="favorites-group-list">
          {groupedFavorites.map(({ expansion, range, rows }) => (
            <section className="favorites-group" key={`${expansion}-${range}`}>
              <div className="favorites-group-heading">
                <div>
                  <p className="eyebrow">{expansion}</p>
                  <h2>{range}</h2>
                </div>
                <span>{rows.length} items</span>
              </div>
              <ul className="favorites-grid">
                {rows.map((row) => (
                  <FavoriteCard
                    key={row.id}
                    row={row}
                    locked={favoritesLocked}
                    onOpen={() => openFavorite(row.name, row.firstBucket, row.itemBuckets)}
                    onRemove={() => removeFavorite(row.name, row.details)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : favoriteRows.length > 0 ? (
        <ul className="favorites-grid">
          {favoriteRows.map((row) => (
            <FavoriteCard
              key={row.id}
              row={row}
              locked={favoritesLocked}
              onOpen={() => openFavorite(row.name, row.firstBucket, row.itemBuckets)}
              onRemove={() => removeFavorite(row.name, row.details)}
            />
          ))}
        </ul>
      ) : (
        <p className="empty">No favorites yet. Open an item and star it to add it here.</p>
      )}

      {selectedLoot ? (
        <ItemDrawer
          bucket={selectedLoot.bucket}
          contentType="Group Named"
          details={itemDetails[selectedLoot.itemName]}
          expansion={selectedLoot.bucket.expansion}
          itemBuckets={selectedLoot.itemBuckets}
          itemName={selectedLoot.itemName}
          onClose={() => setSelectedLoot(null)}
          onSelectZone={() => undefined}
        />
      ) : null}
    </main>
  );
}

function FavoriteCard({ row, locked, onOpen, onRemove }: { row: FavoriteRow; locked: boolean; onOpen: () => void; onRemove: () => void }) {
  const bucket = row.firstBucket;
  const range = bucket?.level_range ?? "No bucket";
  const { previewProps } = useItemPreview();

  return (
    <li>
      <div className={`favorite-card range-tone-${rangeTone(range)} ${expansionTone(bucket?.expansion)}`}>
        <button
          className="favorite-card-main"
          disabled={!bucket}
          onClick={onOpen}
          title={bucket ? "Open item details" : "This favorite is not present in the loaded bucket data"}
          type="button"
          {...previewProps(row.name, row.details)}
        >
          <strong>{row.name}</strong>
          <span>
            {bucket ? (
              <>
                <span className={`expansion-pill is-compact ${expansionTone(bucket.expansion)}`}>{bucket.expansion}</span>
                {" "}{range}
              </>
            ) : "Not in loaded buckets"}
          </span>
          {row.bestZone ? <em>Best: {row.bestZone}</em> : null}
        </button>
        <button
          aria-disabled={locked}
          className={locked ? "favorite-remove-button is-locked" : "favorite-remove-button"}
          disabled={locked}
          onClick={onRemove}
          title={locked ? "Favorites locked" : "Remove from favorites"}
          type="button"
        >
          <FavoriteIndicator details={row.details} itemName={row.name} />
        </button>
      </div>
    </li>
  );
}

function rangeSortValue(range: string) {
  return Number(range.match(/\d+/)?.[0] ?? 999);
}

function rangeTone(range: string) {
  if (range === "31-35") return "blue";
  if (range === "36-40") return "purple";
  if (range === "41-45") return "amber";
  if (range === "46-50") return "green";
  if (range === "51-55") return "red";
  if (range === "56-59" || range === "56-60") return "teal";
  if (range === "60+" || range === "60-70" || range === "61+" || range === "61-70") return "gold";
  return "neutral";
}

function expansionTone(expansion: string | undefined) {
  return expansion ? `expansion-tone-${expansion.toLowerCase()}` : "";
}

function bestZoneForBucket(bucket: Bucket) {
  const counts = new Map<string, number>();
  for (const mob of bucket.mobs) {
    counts.set(mob.zone, (counts.get(mob.zone) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
