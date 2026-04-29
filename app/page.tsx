"use client";

import { useEffect, useMemo, useState } from "react";
import { BucketCard } from "@/components/BucketCard";
import "@/components/bucket-card.css";
import { ItemFarmView } from "@/components/ItemFarmView";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { LevelRecommendations } from "@/components/LevelRecommendations";
import { SearchBox } from "@/components/SearchBox";
import "@/components/search-box.css";
import { ZoneView } from "@/components/ZoneView";
import classicData from "@/data/classic-group-named.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import {
  matchesStatusFilter,
  type ItemFilter,
} from "@/lib/item-status";
import { lootModeLabel, lootModes, type LootMode } from "@/lib/lootModes";
import { filterBuckets, type Bucket, type ItemDetailsMap, type LootDataset } from "@/lib/search";
import { getUniversalSearchResults, type UniversalSearchResult } from "@/lib/universal-search";
import { getAllZones, getZoneView } from "@/lib/zones";

const datasets = [classicData, kunarkData, veliousData] as LootDataset[];
const buckets = datasets.flatMap((dataset) => dataset.buckets);
const contentType = "Group Named";
const itemDetails = itemDetailsData as ItemDetailsMap;
const expansionOptions = ["Classic", "Kunark", "Velious"] as const;
type ExpansionFilter = (typeof expansionOptions)[number];

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [lootMode] = useState<LootMode>("random");
  const [selectedExpansions, setSelectedExpansions] = useState<ExpansionFilter[]>([...expansionOptions]);
  const activeFilter: ItemFilter = "all";
  const reviewMode = false;
  const [selectedZone, setSelectedZone] = useState("");
  const [playerLevel, setPlayerLevel] = useState(1);
  const [levelInputValue, setLevelInputValue] = useState("1");
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [selectedLoot, setSelectedLoot] = useState<{ itemName: string; bucket: Bucket } | null>(null);
  const [selectedItemSearch, setSelectedItemSearch] = useState<{ itemName: string; buckets: Bucket[] } | null>(null);
  const [focusedMob, setFocusedMob] = useState<{ name: string; level: number; zone: string; bucket: number; expansion: string } | null>(null);
  const selectedExpansionSet = useMemo(() => new Set(selectedExpansions), [selectedExpansions]);
  const expansionBuckets = useMemo(
    () => buckets.filter((bucket) => selectedExpansionSet.has(bucket.expansion as ExpansionFilter)),
    [selectedExpansionSet],
  );
  const maxSupportedLevel = useMemo(
    () => Math.max(1, ...expansionBuckets.flatMap((bucket) => bucket.mobs.map((mob) => mob.level))),
    [expansionBuckets],
  );
  const expansionLabel = selectedExpansions.length === expansionOptions.length
    ? "All expansions"
    : selectedExpansions.join(", ");
  const modeLabel = lootModeLabel(lootMode);
  const allZones = useMemo(() => getAllZones(expansionBuckets), [expansionBuckets]);
  const selectedZoneView = useMemo(() => getZoneView(expansionBuckets, selectedZone), [expansionBuckets, selectedZone]);
  const typeaheadResults = useMemo(
    () => getUniversalSearchResults(expansionBuckets, debouncedQuery),
    [debouncedQuery, expansionBuckets],
  );
  const getItemDetails = (itemName: string) => itemDetails[itemName];
  const filteredBuckets = useMemo(() => {
    return filterBuckets(expansionBuckets, "")
      .map((bucket) => {
        const visibleLoot = bucket.loot_pool.filter((item) => {
          const details = itemDetails[item];
          return matchesStatusFilter(details, activeFilter, reviewMode);
        });

        return { bucket, visibleLoot };
      })
      .filter(({ visibleLoot }) => visibleLoot.length > 0);
  }, [activeFilter, expansionBuckets, reviewMode]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (playerLevel <= maxSupportedLevel) return;
    setPlayerLevel(maxSupportedLevel);
    if (!isEditingLevel) {
      setLevelInputValue(String(maxSupportedLevel));
    }
  }, [isEditingLevel, maxSupportedLevel, playerLevel]);

  useEffect(() => {
    if (!isEditingLevel) {
      setLevelInputValue(String(playerLevel));
    }
  }, [isEditingLevel, playerLevel]);

  function commitLevelInput() {
    const parsedLevel = Number.parseInt(levelInputValue, 10);
    if (!Number.isFinite(parsedLevel)) {
      setLevelInputValue(String(playerLevel));
      return;
    }

    const clampedLevel = Math.min(maxSupportedLevel, Math.max(1, parsedLevel));
    setPlayerLevel(clampedLevel);
    setLevelInputValue(String(clampedLevel));
  }

  function selectSearchResult(result: UniversalSearchResult) {
    if (result.type === "zone") {
      setSelectedZone(result.zone);
      setSelectedItemSearch(null);
      setFocusedMob(null);
      setSelectedLoot(null);
      setQuery("");
      return;
    }

    if (result.type === "item") {
      const firstBucket = result.buckets[0];
      setSelectedZone("");
      setFocusedMob(null);
      setSelectedItemSearch({ itemName: result.itemName, buckets: result.buckets });
      setQuery(result.itemName);
      if (firstBucket) {
        setSelectedLoot({ itemName: result.itemName, bucket: firstBucket });
      }
      return;
    }

    setSelectedZone(result.mob.zone);
    setSelectedItemSearch(null);
    setFocusedMob({
      name: result.mob.name,
      level: result.mob.level,
      zone: result.mob.zone,
      bucket: result.bucket.bucket,
      expansion: result.bucket.expansion,
    });
    setSelectedLoot(null);
    setQuery("");
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">
            {expansionLabel} / {contentType} / {modeLabel}
          </p>
          <h1>Frostreaver Random Loot Bucket Tool</h1>
          <p className="subhead">
            Bucket-first view of shared group named loot pools. Search by item, mob, or zone while
            preserving the bucket context used by Frostreaver-style random loot.
          </p>
        </div>

      </header>

      <div className="toolbar">
        <SearchBox
          results={typeaheadResults}
          value={query}
          onChange={(value) => {
            setQuery(value);
            setSelectedItemSearch(null);
          }}
          onSelectResult={selectSearchResult}
        />
        <div className="loot-mode-filter" aria-label="Loot mode">
          <span>Loot mode</span>
          <div className="expansion-toggle-group">
            {lootModes.map((mode) => (
              <button
                aria-pressed={mode.value === lootMode}
                className={mode.value === lootMode ? "filter-button is-active" : "filter-button"}
                disabled={!mode.enabled}
                key={mode.value}
                title={mode.enabled ? mode.label : "Normal Loot mode is planned but not active yet"}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <div className="expansion-filter" aria-label="Expansion filters">
          <span>Expansion</span>
          <div className="expansion-toggle-group">
            {expansionOptions.map((expansion) => (
              <button
                aria-pressed={selectedExpansionSet.has(expansion)}
                className={[
                  "filter-button",
                  "expansion-filter-button",
                  expansionTone(expansion),
                  selectedExpansionSet.has(expansion) ? "is-active" : null,
                ].filter(Boolean).join(" ")}
                key={expansion}
                onClick={() => {
                  setSelectedExpansions((current) => {
                    const isSelected = current.includes(expansion);
                    const next = isSelected
                      ? current.filter((value) => value !== expansion)
                      : [...current, expansion].sort((a, b) => expansionOptions.indexOf(a) - expansionOptions.indexOf(b));
                    return next.length > 0 ? next : current;
                  });
                  setSelectedZone("");
                  setSelectedLoot(null);
                  setSelectedItemSearch(null);
                }}
                type="button"
              >
                {expansion}
              </button>
            ))}
          </div>
        </div>
        <label className="zone-filter">
          <span>Zone filter</span>
          <input
            list="zone-options"
            onChange={(event) => {
              setSelectedZone(event.target.value);
              setSelectedItemSearch(null);
              setFocusedMob(null);
            }}
            placeholder="Select or type a zone"
            value={selectedZone}
          />
          <datalist id="zone-options">
            {allZones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </label>
        <label className="level-filter">
          <span>Your level</span>
          <input
            inputMode="numeric"
            max={maxSupportedLevel}
            min={1}
            onChange={(event) => {
              setLevelInputValue(event.target.value.replace(/\D/g, ""));
            }}
            onBlur={() => {
              setIsEditingLevel(false);
              commitLevelInput();
            }}
            onFocus={(event) => {
              setIsEditingLevel(true);
              event.target.select();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            pattern="[0-9]*"
            type="text"
            value={levelInputValue}
          />
        </label>
      </div>

      {!selectedItemSearch && !selectedZoneView ? (
        <LevelRecommendations buckets={expansionBuckets} level={playerLevel} onSelectZone={setSelectedZone} />
      ) : null}

      {selectedZoneView ? (
        <ZoneView
          activeFilter={activeFilter}
          getItemDetails={getItemDetails}
          onClearZone={() => {
            setSelectedZone("");
            setFocusedMob(null);
          }}
          onSelectLoot={(itemName, selectedBucket) => setSelectedLoot({ itemName, bucket: selectedBucket })}
          onSelectZone={setSelectedZone}
          reviewMode={reviewMode}
          focusedMob={focusedMob}
          zoneView={selectedZoneView}
        />
      ) : selectedItemSearch ? (
        <ItemFarmView
          buckets={selectedItemSearch.buckets}
          itemName={selectedItemSearch.itemName}
          onOpenItem={(itemName, bucket) => setSelectedLoot({ itemName, bucket })}
          onSelectZone={setSelectedZone}
        />
      ) : filteredBuckets.length > 0 ? (
        <div className="bucket-grid">
          {filteredBuckets.map(({ bucket, visibleLoot }) => (
            <BucketCard
              bucket={bucket}
              getItemDetails={getItemDetails}
              key={`${bucket.expansion}-${bucket.bucket}`}
              onSelectLoot={(itemName, selectedBucket) => setSelectedLoot({ itemName, bucket: selectedBucket })}
              onSelectZone={setSelectedZone}
              query=""
              visibleLoot={visibleLoot}
            />
          ))}
        </div>
      ) : (
        <p className="empty">No {expansionLabel} Group Named buckets match the active filters.</p>
      )}

      {selectedLoot ? (
        <ItemDrawer
          bucket={selectedLoot.bucket}
          contentType={contentType}
          details={itemDetails[selectedLoot.itemName]}
          expansion={selectedLoot.bucket.expansion}
          itemName={selectedLoot.itemName}
          itemBuckets={selectedItemSearch?.itemName === selectedLoot.itemName ? selectedItemSearch.buckets : undefined}
          onClose={() => setSelectedLoot(null)}
          onSelectZone={(zone) => {
            setSelectedZone(zone);
            setSelectedLoot(null);
          }}
        />
      ) : null}
    </main>
  );
}
