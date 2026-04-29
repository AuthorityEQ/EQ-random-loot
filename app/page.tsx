"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BucketCard } from "@/components/BucketCard";
import "@/components/bucket-card.css";
import { ExpansionTimeline } from "@/components/ExpansionTimeline";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { ItemFarmView } from "@/components/ItemFarmView";
import { ItemSlotFilter } from "@/components/ItemSlotFilter";
import { LevelRecommendations } from "@/components/LevelRecommendations";
import { SearchBox } from "@/components/SearchBox";
import "@/components/search-box.css";
import { ServerStatusBadge } from "@/components/ServerStatusBadge";
import { ShareFilterButton } from "@/components/ShareFilterButton";
import { ZoneView } from "@/components/ZoneView";
import classicData from "@/data/classic-group-named.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import { bucketHasMatchingItems, itemMatchesSlots, type SlotKey } from "@/lib/slot-filter";
import { itemToSlug, slugToItemName } from "@/lib/item-slug";
import { lootModeLabel, lootModes, type LootMode } from "@/lib/lootModes";
import { filterBuckets, type Bucket, type ItemDetailsMap, type LootDataset } from "@/lib/search";
import { getUniversalSearchResults, type UniversalSearchResult } from "@/lib/universal-search";
import { useUrlFilterState } from "@/lib/use-url-filter-state";
import { getZoneView } from "@/lib/zones";

const datasets = [classicData, kunarkData, veliousData] as LootDataset[];
const buckets = datasets.flatMap((dataset) => dataset.buckets);
const contentType = "Group Named";
const itemDetails = itemDetailsData as ItemDetailsMap;
const expansionOptions = ["Classic", "Kunark", "Velious"] as const;
type ExpansionFilter = (typeof expansionOptions)[number];

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

function Home() {
  // ── URL-synced filter state (replaces individual useState for q/exp/zone/level) ──
  const { state: urlState, setState: setUrlState, shareUrl } = useUrlFilterState();
  const searchParams = useSearchParams();

  // Derive local names from urlState for minimal diff to the rest of the file
  const query        = urlState.q    ?? "";
  const selectedZone = urlState.zone ?? "";
  const playerLevel  = urlState.level ?? 1;
  const selectedExpansions = (
    urlState.exp ?? [...expansionOptions].map((e) => e.toLowerCase())
  ).map((e) => e.charAt(0).toUpperCase() + e.slice(1)) as ExpansionFilter[];

  // ── Local state (not synced to URL) ──────────────────────────────────────────
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [lootMode] = useState<LootMode>("random");
  const [levelInputValue, setLevelInputValue] = useState(String(playerLevel));
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [selectedLoot, setSelectedLoot] = useState<{ itemName: string; bucket: Bucket } | null>(null);
  const [selectedItemSearch, setSelectedItemSearch] = useState<{ itemName: string; buckets: Bucket[] } | null>(null);
  const [focusedMob, setFocusedMob] = useState<{ name: string; level: number; zone: string; bucket: number; expansion: string } | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>([]);

  // ── Cmd/Ctrl+click tracking ───────────────────────────────────────────────────
  // Tracks whether a modifier key was held during the most recent mousedown.
  // Used by onSelectLoot to decide between opening the drawer vs. navigating.
  const modifierHeldRef = useRef(false);
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      modifierHeldRef.current = event.metaKey || event.ctrlKey;
    }
    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => document.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, []);

  // ── Derived / memoised values ─────────────────────────────────────────────────
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
  const typeaheadResults = useMemo(
    () => getUniversalSearchResults(expansionBuckets, debouncedQuery),
    [debouncedQuery, expansionBuckets],
  );
  const getItemDetails = (itemName: string) => itemDetails[itemName];

  // Extended filteredBuckets — respects slot selection in addition to expansions
  const filteredBuckets = useMemo(() => {
    return filterBuckets(expansionBuckets, "")
      .map((bucket) => {
        const visibleLoot = selectedSlots.length === 0
          ? bucket.loot_pool
          : bucket.loot_pool.filter((item) =>
              itemMatchesSlots(item, itemDetails, selectedSlots)
            );
        return { bucket, visibleLoot };
      })
      .filter(({ bucket, visibleLoot }) =>
        visibleLoot.length > 0 &&
        (selectedSlots.length === 0 || bucketHasMatchingItems(bucket, itemDetails, selectedSlots))
      );
  }, [expansionBuckets, selectedSlots]);

  // ── Effects ───────────────────────────────────────────────────────────────────

  // ?item=<slug> — auto-open drawer when landing with an item slug in the URL.
  // Runs once on mount after hydration so it doesn't conflict with SSR.
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

  // ── Handlers ──────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">
            {expansionLabel} / {contentType} / {modeLabel}
          </p>
          <h1>Frostreaver Random Loot</h1>
          <p className="wip-line">Work in progress — DM AuthorityGames on Discord</p>
          {/* ServerStatusBadge: prominent in pre-launch hero; self-suppresses to quiet badge post-launch */}
          <ServerStatusBadge />
        </div>
      </header>

      {/* ExpansionTimeline: full mode, between header and toolbar */}
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
          getItemDetails={getItemDetails}
          onClearZone={() => {
            setUrlState({ zone: "" });
            setFocusedMob(null);
          }}
          onSelectLoot={handleSelectLoot}
          onSelectZone={(zone) => setUrlState({ zone })}
          focusedMob={focusedMob}
          zoneView={selectedZoneView}
        />
      ) : selectedItemSearch ? (
        <ItemFarmView
          buckets={selectedItemSearch.buckets}
          itemName={selectedItemSearch.itemName}
          onOpenItem={handleSelectLoot}
          onSelectZone={(zone) => setUrlState({ zone })}
        />
      ) : filteredBuckets.length > 0 ? (
        <div className="bucket-grid">
          {filteredBuckets.map(({ bucket, visibleLoot }) => (
            <BucketCard
              bucket={bucket}
              getItemDetails={getItemDetails}
              key={`${bucket.expansion}-${bucket.bucket}`}
              onSelectLoot={handleSelectLoot}
              onSelectZone={(zone) => setUrlState({ zone })}
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
            setUrlState({ zone });
            setSelectedLoot(null);
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
