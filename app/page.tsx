"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BucketCard } from "@/components/BucketCard";
import "@/components/bucket-card.css";
import { useBucketDisplay } from "@/components/BucketDisplayProvider";
import { ItemFarmView } from "@/components/ItemFarmView";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { LevelRecommendations } from "@/components/LevelRecommendations";
import { MatchingItemList, type MatchingItemRow } from "@/components/MatchingItemList";
import { SearchBox } from "@/components/SearchBox";
import "@/components/search-box.css";
import { ZoneView } from "@/components/ZoneView";
import classicData from "@/data/classic-group-named.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import {
  classOptions,
  fallbackStatOptions,
  formatItemStatValue,
  getComparableStatValue,
  itemMatchesUseFilters,
  raceOptions,
  type ClassFilter,
  type RaceFilter,
  type SlotFilter,
  type StatFilter,
} from "@/lib/item-use-filters";
import { lootModes, type LootMode } from "@/lib/lootModes";
import { filterBuckets, type Bucket, type ItemDetailsMap, type LootDataset } from "@/lib/search";
import { getUniversalSearchResults, type UniversalSearchResult } from "@/lib/universal-search";
import { visibleBucketsForLevel } from "@/lib/level-bucket-filter";
import { getZoneView } from "@/lib/zones";

const datasets = [classicData, kunarkData, veliousData] as LootDataset[];
const buckets = datasets.flatMap((dataset) => dataset.buckets);
const contentType = "Group Named";
const itemDetails = itemDetailsData as ItemDetailsMap;
const expansionOptions = ["Classic", "Kunark", "Velious"] as const;
const fallbackSlotOptions = [
  "Any",
  "PRIMARY",
  "SECONDARY",
  "RANGE",
  "AMMO",
  "HEAD",
  "FACE",
  "EAR",
  "NECK",
  "SHOULDERS",
  "ARMS",
  "BACK",
  "WRIST",
  "HANDS",
  "FINGER",
  "CHEST",
  "LEGS",
  "FEET",
  "WAIST",
] as const;
const statOptionGroups = [
  {
    label: "Primary",
    options: ["HP", "MANA", "END", "AC", "Haste"],
  },
  {
    label: "Attributes",
    options: ["STR", "STA", "AGI", "DEX", "WIS", "INT", "CHA"],
  },
  {
    label: "Resists",
    options: ["MR", "FR", "CR", "DR", "PR"],
  },
] as const;
type ExpansionFilter = (typeof expansionOptions)[number];

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

function sortItemNamesByStat(itemNames: string[], statFilter: StatFilter) {
  if (statFilter === "Any") return itemNames;

  return [...itemNames].sort((a, b) => {
    const aValue = getComparableStatValue(itemDetails[a], statFilter) ?? Number.NEGATIVE_INFINITY;
    const bValue = getComparableStatValue(itemDetails[b], statFilter) ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue || a.localeCompare(b);
  });
}

function sortItemRowsByStat(rows: MatchingItemRow[], statFilter: StatFilter) {
  if (statFilter === "Any") return rows;

  return [...rows].sort((a, b) => {
    const aValue = getComparableStatValue(a.details, statFilter) ?? Number.NEGATIVE_INFINITY;
    const bValue = getComparableStatValue(b.details, statFilter) ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue || a.itemName.localeCompare(b.itemName);
  });
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function flatSearchMatches(itemName: string, bucket: Bucket, searchQuery: string) {
  const normalizedQuery = normalizeSearch(searchQuery);
  if (normalizedQuery.length < 2) return true;

  return itemName.toLowerCase().includes(normalizedQuery)
    || bucket.mobs.some((mob) => mob.name.toLowerCase().includes(normalizedQuery));
}

export default function Home() {
  const router = useRouter();
  const { bucketed } = useBucketDisplay();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [lootMode] = useState<LootMode>("random");
  const [selectedExpansions, setSelectedExpansions] = useState<ExpansionFilter[]>([...expansionOptions]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassFilter>("Any");
  const [selectedRace, setSelectedRace] = useState<RaceFilter>("Any");
  const [selectedSlot, setSelectedSlot] = useState<SlotFilter>("Any");
  const [selectedStat, setSelectedStat] = useState<StatFilter>("Any");
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
  const zoneGroups = useMemo(() => {
    return expansionOptions
      .filter((expansion) => selectedExpansionSet.has(expansion))
      .map((expansion) => {
        const zones = Array.from(
          new Set(
            expansionBuckets
              .filter((bucket) => bucket.expansion === expansion)
              .flatMap((bucket) => bucket.zones),
          ),
        ).sort((a, b) => a.localeCompare(b));
        return { expansion, zones };
      })
      .filter(({ zones }) => zones.length > 0);
  }, [expansionBuckets, selectedExpansionSet]);
  const selectedZoneView = useMemo(() => getZoneView(expansionBuckets, selectedZone), [expansionBuckets, selectedZone]);
  const slotOptions = useMemo(() => {
    const slots = new Set<string>();
    for (const details of Object.values(itemDetails)) {
      if (!details.slot) continue;
      for (const slot of details.slot.toUpperCase().split(/[,\s/]+/)) {
        if (slot) slots.add(slot);
      }
    }

    const derived = Array.from(slots).sort((a, b) => a.localeCompare(b));
    return derived.length > 0 ? ["Any", ...derived] : [...fallbackSlotOptions];
  }, []);
  const statOptions = useMemo(() => {
    const stats = new Set<string>();
    for (const details of Object.values(itemDetails)) {
      if (details.ac !== null && details.ac !== undefined && details.ac !== 0) stats.add("AC");
      if (details.haste) stats.add("Haste");
      for (const [key, value] of Object.entries(details.stats ?? {})) {
        if (value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0") {
          stats.add(key.toUpperCase());
        }
      }
      for (const [key, value] of Object.entries(details.resists ?? {})) {
        if (value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0") {
          stats.add(key.toUpperCase());
        }
      }
    }

    for (const option of fallbackStatOptions) {
      if (option !== "Any") stats.add(option);
    }

    const derived = Array.from(stats).sort((a, b) => a.localeCompare(b));
    return ["Any", ...derived];
  }, []);
  const itemIsVisible = (itemName: string) => itemMatchesUseFilters(itemDetails[itemName], selectedClass, selectedRace, selectedSlot, selectedStat);
  const getItemStatDisplay = (itemName: string) => formatItemStatValue(itemDetails[itemName], selectedStat);
  const typeaheadResults = useMemo(
    () => getUniversalSearchResults(expansionBuckets, debouncedQuery, itemIsVisible, getItemStatDisplay),
    [debouncedQuery, expansionBuckets, selectedClass, selectedRace, selectedSlot, selectedStat],
  );
  const getItemDetails = (itemName: string) => itemDetails[itemName];
  const levelVisibleBuckets = useMemo(() => visibleBucketsForLevel(expansionBuckets, playerLevel), [expansionBuckets, playerLevel]);
  const filteredBuckets = useMemo(() => {
    return filterBuckets(expansionBuckets, "")
      .filter((bucket) => levelVisibleBuckets.has(bucket))
      .map((bucket) => {
        return { bucket, visibleLoot: sortItemNamesByStat(bucket.loot_pool.filter(itemIsVisible), selectedStat) };
      })
      .filter(({ visibleLoot }) => visibleLoot.length > 0);
  }, [expansionBuckets, levelVisibleBuckets, selectedClass, selectedRace, selectedSlot, selectedStat]);
  const flatItemRows = useMemo(
    () => sortItemRowsByStat(uniqueSortedItemRows(filteredBuckets
      .flatMap(({ bucket, visibleLoot }) =>
        visibleLoot
          .filter((itemName) => flatSearchMatches(itemName, bucket, debouncedQuery))
          .map((itemName) => ({ itemName, bucket, details: itemDetails[itemName], statDisplay: getItemStatDisplay(itemName) })),
    )), selectedStat),
    [debouncedQuery, filteredBuckets, selectedStat],
  );
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

  function resetHome() {
    setQuery("");
    setDebouncedQuery("");
    setSelectedExpansions([...expansionOptions]);
    setSelectedZone("");
    setSelectedClass("Any");
    setSelectedRace("Any");
    setSelectedSlot("Any");
    setSelectedStat("Any");
    setPlayerLevel(1);
    setLevelInputValue("1");
    setIsEditingLevel(false);
    setSelectedLoot(null);
    setSelectedItemSearch(null);
    setFocusedMob(null);
  }

  useEffect(() => {
    window.addEventListener("frostreaver:reset-home", resetHome);
    return () => window.removeEventListener("frostreaver:reset-home", resetHome);
  });

  function selectSearchResult(result: UniversalSearchResult) {
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
      <header className="header hero-header" aria-label="Loot Goblin">
        <img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" />
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
                onClick={() => {
                  if (mode.value === "normal") {
                    router.push("/normal-loot");
                  }
                }}
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
          <span>Zone</span>
          <select
            onChange={(event) => {
              setSelectedZone(event.target.value);
              setSelectedItemSearch(null);
              setFocusedMob(null);
              setSelectedLoot(null);
            }}
            value={selectedZone}
          >
            <option value="">All zones</option>
            {zoneGroups.map(({ expansion, zones }) => (
              <optgroup key={expansion} label={expansion}>
                {zones.map((zone) => (
                  <option key={`${expansion}-${zone}`} value={zone}>
                    {zone}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="use-filter-group" aria-label="Item usability filters">
          <label className="class-filter">
            <span>Class</span>
            <select onChange={(event) => setSelectedClass(event.target.value as ClassFilter)} value={selectedClass}>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="race-filter">
            <span>Race</span>
            <select onChange={(event) => setSelectedRace(event.target.value as RaceFilter)} value={selectedRace}>
              {raceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="slot-filter">
            <span>Slot</span>
            <select onChange={(event) => setSelectedSlot(event.target.value)} value={selectedSlot}>
              {slotOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="stat-filter">
            <span>Stat</span>
            <select onChange={(event) => setSelectedStat(event.target.value)} value={selectedStat}>
              <option value="Any">Any</option>
              {statOptionGroups.map((group) => {
                const options = group.options.filter((option) => statOptions.includes(option));
                if (options.length === 0) return null;

                return (
                  <optgroup key={group.label} label={group.label}>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
        </div>
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
          bucketed={bucketed}
          getItemDetails={getItemDetails}
          getItemStatDisplay={getItemStatDisplay}
          itemIsVisible={itemIsVisible}
          levelVisibleBuckets={levelVisibleBuckets}
          statFilter={selectedStat}
          onClearZone={() => {
            setSelectedZone("");
            setFocusedMob(null);
          }}
          onSelectLoot={(itemName, selectedBucket) => setSelectedLoot({ itemName, bucket: selectedBucket })}
          onSelectZone={setSelectedZone}
          focusedMob={focusedMob}
          searchQuery={debouncedQuery}
          zoneView={selectedZoneView}
        />
      ) : selectedItemSearch ? (
        <ItemFarmView
          buckets={selectedItemSearch.buckets}
          itemName={selectedItemSearch.itemName}
          onOpenItem={(itemName, bucket) => setSelectedLoot({ itemName, bucket })}
          onSelectZone={setSelectedZone}
        />
      ) : bucketed && filteredBuckets.length > 0 ? (
        <div className="bucket-grid">
          {filteredBuckets.map(({ bucket, visibleLoot }) => (
            <BucketCard
              bucket={bucket}
              getItemDetails={getItemDetails}
              getItemStatDisplay={getItemStatDisplay}
              key={`${bucket.expansion}-${bucket.bucket}`}
              onSelectLoot={(itemName, selectedBucket) => setSelectedLoot({ itemName, bucket: selectedBucket })}
              onSelectZone={setSelectedZone}
              query=""
              visibleLoot={visibleLoot}
            />
          ))}
        </div>
      ) : !bucketed ? (
        <MatchingItemList
          rows={flatItemRows}
          onSelectLoot={(itemName, selectedBucket) => setSelectedLoot({ itemName, bucket: selectedBucket })}
        />
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
