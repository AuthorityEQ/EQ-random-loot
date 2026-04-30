"use client";

import { Suspense, useEffect, useDeferredValue, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BucketCard } from "@/components/BucketCard";
import { useSharedLoot } from "@/components/SharedLootToggle";
import "@/components/bucket-card.css";
import { useBucketDisplay } from "@/components/BucketDisplayProvider";
import { ExpansionTimeline } from "@/components/ExpansionTimeline";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { ItemFarmView } from "@/components/ItemFarmView";
import { ItemSlotFilter } from "@/components/ItemSlotFilter";
import { LevelRecommendations } from "@/components/LevelRecommendations";
import { MobLootList, type MobLootEntry } from "@/components/MobLootList";
import { SharedPoolSection } from "@/components/SharedPoolSection";
import { SearchBox } from "@/components/SearchBox";
import "@/components/search-box.css";
import { ShareFilterButton } from "@/components/ShareFilterButton";
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
import { itemToSlug, slugToItemName } from "@/lib/item-slug";
import { zoneToSlug } from "@/lib/zone-slug";
import { visibleBucketsForLevel } from "@/lib/level-bucket-filter";
import { lootModeLabel, lootModes, type LootMode } from "@/lib/lootModes";
import { filterBuckets, type Bucket, type ItemDetailsMap, type LootDataset } from "@/lib/search";
import { bucketHasMatchingItems, itemMatchesSlots, type SlotKey } from "@/lib/slot-filter";
import { getUniversalSearchResults, type UniversalSearchResult } from "@/lib/universal-search";
import { useUrlFilterState } from "@/lib/use-url-filter-state";
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

function sortItemNamesByStat(itemNames: string[], statFilter: StatFilter) {
  if (statFilter === "Any") return itemNames;

  return [...itemNames].sort((a, b) => {
    const aValue = getComparableStatValue(itemDetails[a], statFilter) ?? Number.NEGATIVE_INFINITY;
    const bValue = getComparableStatValue(itemDetails[b], statFilter) ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue || a.localeCompare(b);
  });
}

function Home() {
  // ── URL-synced filter state ───────────────────────────────────────────────
  const { state: urlState, setState: setUrlState, shareUrl } = useUrlFilterState();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { bucketed } = useBucketDisplay();
  const { enabled: sharedLoot } = useSharedLoot();

  // Derive local names from urlState for minimal diff to the rest of the file
  const query           = urlState.q    ?? "";
  const selectedZone    = urlState.zone ?? "";
  const playerLevel     = urlState.level ?? 1;
  const selectedExpansions = (
    urlState.exp ?? [...expansionOptions].map((e) => e.toLowerCase())
  ).map((e) => e.charAt(0).toUpperCase() + e.slice(1)) as ExpansionFilter[];

  // ── Local state (not synced to URL) ──────────────────────────────────────
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const deferredQuery = useDeferredValue(debouncedQuery);
  const [lootMode, setLootMode] = useState<LootMode>("random");
  const showAllLoot = lootMode === "normal";
  const [levelInputValue, setLevelInputValue] = useState(String(playerLevel));
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [selectedLoot, setSelectedLoot] = useState<{ itemName: string; bucket: Bucket } | null>(null);
  const [selectedItemSearch, setSelectedItemSearch] = useState<{ itemName: string; buckets: Bucket[] } | null>(null);
  const [focusedMob, setFocusedMob] = useState<{ name: string; level: number; zone: string; bucket: number; expansion: string } | null>(null);

  // ── Shared-pool pagination (bucketed === false view) ─────────────────────
  const SHARED_POOL_PAGE_SIZE = 10;
  const [sharedPoolLimit, setSharedPoolLimit] = useState(SHARED_POOL_PAGE_SIZE);

  // ── Class / race / slot / stat filters (from main) ───────────────────────
  const [selectedClass, setSelectedClass] = useState<ClassFilter>("Any");
  const [selectedRace, setSelectedRace] = useState<RaceFilter>("Any");
  const [selectedSlot, setSelectedSlot] = useState<SlotFilter>("Any");
  const [selectedStat, setSelectedStat] = useState<StatFilter>("Any");

  // ── Slot-chip filter (from HEAD) ─────────────────────────────────────────
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>([]);

  // ── Cmd/Ctrl+click tracking ───────────────────────────────────────────────
  const modifierHeldRef = useRef(false);
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      modifierHeldRef.current = event.metaKey || event.ctrlKey;
    }
    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => document.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, []);

  // ── Derived / memoised values ─────────────────────────────────────────────
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

  // itemIsVisible applies class/race/slot/stat filters (main's use-filters)
  const itemIsVisible = (itemName: string) => itemMatchesUseFilters(itemDetails[itemName], selectedClass, selectedRace, selectedSlot, selectedStat);
  const getItemStatDisplay = (itemName: string) => formatItemStatValue(itemDetails[itemName], selectedStat);
  const typeaheadResults = useMemo(
    () => getUniversalSearchResults(expansionBuckets, debouncedQuery, itemIsVisible, getItemStatDisplay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, expansionBuckets, selectedClass, selectedRace, selectedSlot, selectedStat],
  );
  const getItemDetails = (itemName: string) => itemDetails[itemName];
  const levelVisibleBuckets = useMemo(() => visibleBucketsForLevel(expansionBuckets, playerLevel), [expansionBuckets, playerLevel]);

  // filteredBuckets: level filter (main) + class/race/slot/stat (main) + slot-chip filter (HEAD)
  const filteredBuckets = useMemo(() => {
    return filterBuckets(expansionBuckets, "")
      .filter((bucket) => levelVisibleBuckets.has(bucket))
      .map((bucket) => {
        // Apply class/race/slot/stat use-filter first, then slot-chip filter
        const useFilteredLoot = bucket.loot_pool.filter(itemIsVisible);
        const visibleLoot = selectedSlots.length === 0
          ? useFilteredLoot
          : useFilteredLoot.filter((item) => itemMatchesSlots(item, itemDetails, selectedSlots));
        return { bucket, visibleLoot: sortItemNamesByStat(visibleLoot, selectedStat) };
      })
      .filter(({ visibleLoot }) => visibleLoot.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansionBuckets, levelVisibleBuckets, selectedClass, selectedRace, selectedSlot, selectedStat, selectedSlots]);

  // mob-grouped rows for non-bucketed view
  const mobLootRows = useMemo<MobLootEntry[]>(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const seen = new Map<string, MobLootEntry>();

    for (const { bucket, visibleLoot } of filteredBuckets) {
      const visibleSet = new Set(visibleLoot);
      for (const mob of bucket.mobs) {
        const mobKey = `${mob.name}__${mob.zone}__${mob.level}`;

        // Apply search filter: match on item name OR mob name
        const matchingItems = mob.loot.filter((item) => {
          if (!visibleSet.has(item)) return false;
          if (normalizedQuery.length < 2) return true;
          return item.toLowerCase().includes(normalizedQuery)
            || mob.name.toLowerCase().includes(normalizedQuery);
        });

        if (matchingItems.length === 0) continue;

        if (!seen.has(mobKey)) {
          seen.set(mobKey, {
            key: mobKey,
            mob: { name: mob.name, level: mob.level, zone: mob.zone, expansion: mob.expansion },
            bucket,
            items: matchingItems,
          });
        }
      }
    }

    return Array.from(seen.values()).sort(
      (a, b) => a.mob.level - b.mob.level || a.mob.name.localeCompare(b.mob.name),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery, filteredBuckets]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // ?item=<slug> — auto-open drawer when landing with an item slug in the URL
  useEffect(() => {
    const itemSlug = searchParams.get("item");
    if (!itemSlug) return;

    const itemName = slugToItemName(itemSlug, itemDetails);
    if (!itemName) return;

    const matchingBucket = buckets.find((b) => b.loot_pool.includes(itemName));
    if (!matchingBucket) return;

    setSelectedLoot({ itemName, bucket: matchingBucket });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount

  // Debounce search query
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  // Clamp playerLevel when maxSupportedLevel changes
  useEffect(() => {
    if (playerLevel <= maxSupportedLevel) return;
    setUrlState({ level: maxSupportedLevel });
    if (!isEditingLevel) {
      setLevelInputValue(String(maxSupportedLevel));
    }
  }, [isEditingLevel, maxSupportedLevel, playerLevel, setUrlState]);

  // Keep levelInputValue in sync with playerLevel when not actively editing
  useEffect(() => {
    if (!isEditingLevel) {
      setLevelInputValue(String(playerLevel));
    }
  }, [isEditingLevel, playerLevel]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function commitLevelInput() {
    const parsedLevel = Number.parseInt(levelInputValue, 10);
    if (!Number.isFinite(parsedLevel)) {
      setLevelInputValue(String(playerLevel));
      return;
    }
    const clampedLevel = Math.min(maxSupportedLevel, Math.max(1, parsedLevel));
    setUrlState({ level: clampedLevel });
    setLevelInputValue(String(clampedLevel));
  }

  /**
   * Handle a loot item click.
   * Plain click → open the drawer.
   * Cmd/Ctrl+click → navigate to the item's standalone page in a new tab.
   */
  function handleSelectLoot(itemName: string, bucket: Bucket) {
    if (modifierHeldRef.current) {
      const slug = itemToSlug(itemName);
      window.open(`/item/${slug}`, "_blank", "noopener");
      modifierHeldRef.current = false;
      return;
    }
    setSelectedLoot({ itemName, bucket });
  }

  function resetHome() {
    setUrlState({ q: "", zone: "", level: 1, exp: [...expansionOptions].map((e) => e.toLowerCase()) });
    setDebouncedQuery("");
    setSelectedClass("Any");
    setSelectedRace("Any");
    setSelectedSlot("Any");
    setSelectedStat("Any");
    setSelectedSlots([]);
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
      setUrlState({ zone: "" });
      setFocusedMob(null);
      setSelectedItemSearch({ itemName: result.itemName, buckets: result.buckets });
      setUrlState({ q: result.itemName });
      if (firstBucket) {
        setSelectedLoot({ itemName: result.itemName, bucket: firstBucket });
      }
      return;
    }

    setUrlState({ zone: result.mob.zone });
    setSelectedItemSearch(null);
    setFocusedMob({
      name: result.mob.name,
      level: result.mob.level,
      zone: result.mob.zone,
      bucket: result.bucket.bucket,
      expansion: result.bucket.expansion,
    });
    setSelectedLoot(null);
    setUrlState({ q: "" });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      {/* ExpansionTimeline: full mode, between hero banner and toolbar */}
      <ExpansionTimeline />

      <div className="toolbar">
        <SearchBox
          results={typeaheadResults}
          value={query}
          onChange={(value) => {
            setUrlState({ q: value });
            setSelectedItemSearch(null);
          }}
          onSelectResult={selectSearchResult}
        />
        <ShareFilterButton shareUrl={shareUrl} />
        <div className="loot-mode-filter" aria-label="Loot mode">
          <span>Loot mode</span>
          <div className="expansion-toggle-group">
            {lootModes.map((mode) => (
              <button
                aria-pressed={mode.value === lootMode}
                className={mode.value === lootMode ? "filter-button is-active" : "filter-button"}
                disabled={!mode.enabled}
                key={mode.value}
                onClick={() => setLootMode(mode.value)}
                title={mode.value === "normal"
                  ? "Show all loot expanded across every bucket — slower on weaker devices"
                  : mode.label}
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
                  const current = selectedExpansions;
                  const isSelected = current.includes(expansion);
                  const next = isSelected
                    ? current.filter((value) => value !== expansion)
                    : [...current, expansion].sort((a, b) => expansionOptions.indexOf(a) - expansionOptions.indexOf(b));
                  const safeNext = next.length > 0 ? next : current;
                  setUrlState({ exp: safeNext.map((e) => e.toLowerCase()) });
                  setUrlState({ zone: "" });
                  setSelectedLoot(null);
                  setSelectedItemSearch(null);
                  setSelectedSlots([]);
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
              setUrlState({ zone: event.target.value });
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
        <ItemSlotFilter selected={selectedSlots} onChange={setSelectedSlots} />
      </div>

      {!selectedItemSearch && !selectedZoneView ? (
        <LevelRecommendations buckets={expansionBuckets} level={playerLevel} onSelectZone={(zone) => setUrlState({ zone })} />
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
            setUrlState({ zone: "" });
            setFocusedMob(null);
          }}
          onSelectLoot={handleSelectLoot}
          onSelectZone={(zone) => setUrlState({ zone })}
          focusedMob={focusedMob}
          searchQuery={debouncedQuery}
          zoneView={selectedZoneView}
        />
      ) : selectedItemSearch ? (
        <ItemFarmView
          buckets={selectedItemSearch.buckets}
          itemName={selectedItemSearch.itemName}
          onOpenItem={handleSelectLoot}
          onSelectZone={(zone) => setUrlState({ zone })}
        />
      ) : bucketed && filteredBuckets.length > 0 ? (
        <div className="bucket-grid">
          {filteredBuckets.map(({ bucket, visibleLoot }) => (
            <BucketCard
              bucket={bucket}
              getItemDetails={getItemDetails}
              getItemStatDisplay={getItemStatDisplay}
              key={`${bucket.expansion}-${bucket.bucket}`}
              onSelectLoot={handleSelectLoot}
              onSelectZone={(zone) => setUrlState({ zone })}
              query=""
              sharedLoot={sharedLoot}
              showAllLoot={showAllLoot}
              visibleLoot={visibleLoot}
            />
          ))}
        </div>
      ) : !bucketed ? (
        <div className="shared-pool-stack">
          {filteredBuckets.slice(0, sharedPoolLimit).map(({ bucket, visibleLoot }) => {
            if (visibleLoot.length === 0) return null;
            return (
              <SharedPoolSection
                key={`${bucket.expansion}-${bucket.bucket}`}
                title={`Levels ${bucket.level_range}`}
                kicker={`${bucket.expansion} Loot Bucket`}
                summary={`${bucket.mobs.length} mobs · ${bucket.zones.length} zones · ${visibleLoot.length} items`}
                items={visibleLoot}
                getItemDetails={getItemDetails}
                getBucketForItem={() => bucket}
                onSelectLoot={handleSelectLoot}
              />
            );
          })}
          {filteredBuckets.length > sharedPoolLimit && (
            <div className="shared-pool-pagination">
              <button
                className="filter-button"
                onClick={() => setSharedPoolLimit((prev) => prev + SHARED_POOL_PAGE_SIZE)}
                type="button"
              >
                Show more buckets ({filteredBuckets.length - sharedPoolLimit} remaining)
              </button>
            </div>
          )}
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
            // Restore the original in-page behavior: render <ZoneView> filtered
            // to that zone via urlState. Closes the drawer first.
            setSelectedLoot(null);
            setUrlState({ zone });
          }}
        />
      ) : null}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
