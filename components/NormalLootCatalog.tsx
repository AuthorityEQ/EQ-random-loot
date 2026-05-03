"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BaseItem = {
  name: string;
  url: string;
  expansion: string | null;
  availability: string | null;
};

type DropItem = BaseItem & {
  dropRate?: string;
  quantity?: string;
  notes?: string;
};

type VendorItem = BaseItem & {
  price?: string;
};

export type ImportedNpc = {
  id: string;
  name: string;
  url: string;
  npcType: string;
  expansion: string | null;
  availability: string | null;
  hasNormalLoot: boolean;
  levelRange: string;
  listedType: string;
  zone: string;
  zoneId: string;
  drops: DropItem[];
  vendorItems: VendorItem[];
  questRewards: BaseItem[];
  questTurnIns: BaseItem[];
  questItems: BaseItem[];
};

export type ZoneLoot = {
  zone: string;
  zoneId: string;
  zoneUrl: string;
  hasAnyNormalLoot: boolean;
  npcListUrlsProcessed: string[];
  mobs: ImportedNpc[];
};

type NpcTypeFilter = "all" | "mob" | "vendor" | "quest" | "unknown";
type ContentFilter = "all" | "drops" | "vendor" | "quest" | "none";
type SortMode = "name" | "level-asc" | "level-desc" | "type" | "items-desc";

type NormalLootCatalogProps = {
  zones: ZoneLoot[];
};

const npcSuggestionLimit = 20;

function itemMeta(item: BaseItem | DropItem | VendorItem) {
  return [item.expansion, item.availability].filter(Boolean).join(" - ");
}

function itemExtra(item: DropItem | VendorItem) {
  const pieces = [];
  if ("price" in item && item.price) pieces.push(item.price);
  if ("dropRate" in item && item.dropRate) pieces.push(item.dropRate);
  if ("quantity" in item && item.quantity) pieces.push(`Qty ${item.quantity}`);
  if ("notes" in item && item.notes) pieces.push(item.notes);
  return pieces.join(" - ");
}

function countQuestItems(npc: ImportedNpc) {
  return npc.questRewards.length + npc.questTurnIns.length + npc.questItems.length;
}

function countItems(npc: ImportedNpc) {
  return npc.drops.length + npc.vendorItems.length + countQuestItems(npc);
}

function countZoneItems(zone: ZoneLoot) {
  return zone.mobs.reduce((totals, npc) => {
    totals.drops += npc.drops.length;
    totals.vendor += npc.vendorItems.length;
    totals.quest += countQuestItems(npc);
    return totals;
  }, { drops: 0, vendor: 0, quest: 0 });
}

function zoneExpansion(zone: ZoneLoot) {
  const expansions = Array.from(new Set(zone.mobs.map((npc) => npc.expansion).filter(Boolean) as string[]));
  return expansions.length === 1 ? expansions[0] : expansions.length > 1 ? "Multiple expansions" : null;
}

function levelSortValue(levelRange: string) {
  return Number(levelRange.match(/\d+/)?.[0] ?? 9999);
}

function npcTypeMatches(npc: ImportedNpc, filter: NpcTypeFilter) {
  if (filter === "all") return true;
  if (filter === "mob") return npc.npcType === "mob" || npc.npcType === "mob_vendor";
  if (filter === "vendor") return npc.npcType === "vendor" || npc.npcType === "mob_vendor";
  return npc.npcType === filter;
}

function contentMatches(npc: ImportedNpc, filter: ContentFilter) {
  if (filter === "all") return true;
  if (filter === "drops") return npc.drops.length > 0;
  if (filter === "vendor") return npc.vendorItems.length > 0;
  if (filter === "quest") return countQuestItems(npc) > 0;
  return countItems(npc) === 0;
}

function sortNpcs(npcs: ImportedNpc[], sortMode: SortMode) {
  return [...npcs].sort((a, b) => {
    if (sortMode === "level-asc") {
      return levelSortValue(a.levelRange) - levelSortValue(b.levelRange) || a.name.localeCompare(b.name);
    }
    if (sortMode === "level-desc") {
      return levelSortValue(b.levelRange) - levelSortValue(a.levelRange) || a.name.localeCompare(b.name);
    }
    if (sortMode === "type") {
      return a.npcType.localeCompare(b.npcType) || a.name.localeCompare(b.name);
    }
    if (sortMode === "items-desc") {
      return countItems(b) - countItems(a) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

function ImportedItemList({ items, kind }: { items: Array<BaseItem | DropItem | VendorItem>; kind: "drop" | "vendor" | "quest" }) {
  if (items.length === 0) return null;

  return (
    <ul className={`normal-loot-item-list is-${kind}`}>
      {items.map((item, index) => {
        const meta = itemMeta(item);
        const extra = itemExtra(item);

        return (
          <li key={`${item.url}-${extra}-${index}`}>
            <a href={item.url} rel="noreferrer" target="_blank">{item.name}</a>
            {extra ? <span>{extra}</span> : null}
            {meta ? <small>{meta}</small> : null}
          </li>
        );
      })}
    </ul>
  );
}

function NpcSection({ label, items, kind }: { label: string; items: Array<BaseItem | DropItem | VendorItem>; kind: "drop" | "vendor" | "quest" }) {
  if (items.length === 0) return null;

  return (
    <section className="normal-loot-section">
      <h4>{label}</h4>
      <ImportedItemList items={items} kind={kind} />
    </section>
  );
}

function NpcRow({ npc }: { npc: ImportedNpc }) {
  const questCount = countQuestItems(npc);
  const totalItems = countItems(npc);

  return (
    <details className={npc.hasNormalLoot ? "normal-npc-card has-normal-loot" : "normal-npc-card"}>
      <summary className="normal-npc-summary">
        <span className="normal-npc-name">{npc.name}</span>
        <span className="normal-npc-meta">
          <span className="normal-npc-type">{npc.npcType}</span>
          {npc.levelRange ? <span className="normal-npc-level">Level {npc.levelRange}</span> : null}
          <span>Drops: {npc.drops.length}</span>
          <span>Vendor: {npc.vendorItems.length}</span>
          <span>Quest: {questCount}</span>
        </span>
      </summary>

      <div className="normal-npc-details">
        <div className="normal-npc-links">
          <a href={npc.url} rel="noreferrer" target="_blank">Allakhazam NPC page</a>
          {npc.listedType ? <span>{npc.listedType}</span> : null}
          {npc.expansion ? <span>{npc.expansion}</span> : null}
        </div>

        {totalItems > 0 ? (
          <div className="normal-loot-sections">
            <NpcSection label="Drops" items={npc.drops} kind="drop" />
            <NpcSection label="Vendor Items" items={npc.vendorItems} kind="vendor" />
            <NpcSection label="Quest Rewards" items={npc.questRewards} kind="quest" />
            <NpcSection label="Quest Turn-ins" items={npc.questTurnIns} kind="quest" />
            <NpcSection label="Quest Items" items={npc.questItems} kind="quest" />
          </div>
        ) : (
          <p className="normal-loot-empty">No imported items listed.</p>
        )}
      </div>
    </details>
  );
}

export function NormalLootCatalog({ zones }: NormalLootCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [isNpcSearchOpen, setIsNpcSearchOpen] = useState(false);
  const [activeNpcSuggestionIndex, setActiveNpcSuggestionIndex] = useState(0);
  const [npcTypeFilter, setNpcTypeFilter] = useState<NpcTypeFilter>("all");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const npcSearchRef = useRef<HTMLLabelElement | null>(null);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const selectedZone = zones.find((zone) => zone.zoneId === selectedZoneId);
  const hasZoneSelection = Boolean(selectedZone);

  const suggestionSourceNpcs = useMemo(() => {
    return selectedZone?.mobs ?? [];
  }, [selectedZone]);

  const allNpcSuggestions = useMemo(() => {
    if (normalizedSearch.length < 2) return [];

    const startsWithMatches: ImportedNpc[] = [];
    const includesMatches: ImportedNpc[] = [];

    for (const npc of suggestionSourceNpcs) {
      const normalizedName = npc.name.toLowerCase();
      if (normalizedName.startsWith(normalizedSearch)) {
        startsWithMatches.push(npc);
      } else if (normalizedName.includes(normalizedSearch)) {
        includesMatches.push(npc);
      }
    }

    startsWithMatches.sort((a, b) => a.name.localeCompare(b.name));
    includesMatches.sort((a, b) => a.name.localeCompare(b.name));

    return [...startsWithMatches, ...includesMatches];
  }, [normalizedSearch, suggestionSourceNpcs]);

  const npcSuggestions = allNpcSuggestions.slice(0, npcSuggestionLimit);
  const showNpcSuggestions = isNpcSearchOpen && normalizedSearch.length >= 2 && npcSuggestions.length > 0;
  const hasMoreNpcSuggestions = allNpcSuggestions.length > npcSuggestionLimit;

  useEffect(() => {
    setActiveNpcSuggestionIndex(0);
  }, [searchQuery, selectedZoneId]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!npcSearchRef.current?.contains(event.target as Node)) {
        setIsNpcSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const filteredZones = useMemo(() => {
    if (!selectedZone) return [];

    return [selectedZone]
      .map((zone) => {
        const mobs = sortNpcs(zone.mobs.filter((npc) => {
          const matchesSearch = selectedNpcId
            ? npc.id === selectedNpcId
            : normalizedSearch.length === 0 || npc.name.toLowerCase().includes(normalizedSearch);
          return matchesSearch && npcTypeMatches(npc, npcTypeFilter) && contentMatches(npc, contentFilter);
        }), sortMode);
        return { ...zone, mobs };
      })
      .filter((zone) => zone.mobs.length > 0);
  }, [contentFilter, normalizedSearch, npcTypeFilter, selectedNpcId, selectedZone, sortMode]);

  const visibleNpcCount = filteredZones.reduce((sum, zone) => sum + zone.mobs.length, 0);
  const singleZoneSelected = Boolean(selectedZone);

  function updateZone(value: string) {
    setSelectedZoneId(value || null);
    setSelectedNpcId(null);
    setSearchQuery("");
    setIsNpcSearchOpen(false);
  }

  function updateNpcSearch(value: string) {
    if (!selectedZone) return;
    setSearchQuery(value);
    setSelectedNpcId(null);
    setIsNpcSearchOpen(true);
  }

  function clearNpcSearch() {
    setSearchQuery("");
    setSelectedNpcId(null);
    setIsNpcSearchOpen(false);
  }

  function selectNpcSuggestion(npc: ImportedNpc) {
    setSearchQuery(npc.name);
    setSelectedNpcId(npc.id);
    setIsNpcSearchOpen(false);
  }

  return (
    <>
      <section className="normal-loot-controls" aria-label="Normal loot filters">
        <label>
          <span>Zone</span>
          <select onChange={(event) => updateZone(event.target.value)} value={selectedZoneId ?? ""}>
            <option value="">Select a zone...</option>
            {zones.map((zone) => (
              <option key={zone.zoneId} value={zone.zoneId}>
                {zone.zone}
              </option>
            ))}
          </select>
        </label>
        {hasZoneSelection ? (
          <button className="normal-clear-filter-button" onClick={() => updateZone("")} type="button">
            Clear zone
          </button>
        ) : null}
        <label className="normal-npc-search" ref={npcSearchRef}>
          <span>NPC search</span>
          <input
            aria-activedescendant={showNpcSuggestions ? `normal-npc-suggestion-${activeNpcSuggestionIndex}` : undefined}
            aria-autocomplete="list"
            aria-controls={showNpcSuggestions ? "normal-npc-suggestions" : undefined}
            aria-expanded={showNpcSuggestions}
            autoComplete="off"
            disabled={!selectedZone}
            onChange={(event) => updateNpcSearch(event.target.value)}
            onFocus={() => setIsNpcSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                clearNpcSearch();
                return;
              }

              if (!showNpcSuggestions) return;

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveNpcSuggestionIndex((current) => (current + 1) % npcSuggestions.length);
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveNpcSuggestionIndex((current) => (current - 1 + npcSuggestions.length) % npcSuggestions.length);
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const npc = npcSuggestions[activeNpcSuggestionIndex];
                if (npc) selectNpcSuggestion(npc);
              }
            }}
            placeholder="NPC name"
            role="combobox"
            type="search"
            value={searchQuery}
          />
          {searchQuery ? (
            <button className="normal-npc-search-clear" onClick={clearNpcSearch} type="button">
              Clear
            </button>
          ) : null}
          {showNpcSuggestions ? (
            <div className="normal-npc-suggestions" id="normal-npc-suggestions" role="listbox">
              {npcSuggestions.map((npc, index) => (
                <button
                  aria-selected={index === activeNpcSuggestionIndex}
                  className={index === activeNpcSuggestionIndex ? "normal-npc-suggestion is-active" : "normal-npc-suggestion"}
                  id={`normal-npc-suggestion-${index}`}
                  key={npc.id}
                  onClick={() => selectNpcSuggestion(npc)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveNpcSuggestionIndex(index)}
                  role="option"
                  type="button"
                >
                  <strong>{npc.name}</strong>
                  <span>{npc.zone}</span>
                </button>
              ))}
              {hasMoreNpcSuggestions ? (
                <p className="normal-npc-suggestion-help">Showing top 20 matches. Keep typing to narrow results.</p>
              ) : null}
            </div>
          ) : null}
        </label>
        <label>
          <span>NPC type</span>
          <select disabled={!selectedZone} onChange={(event) => setNpcTypeFilter(event.target.value as NpcTypeFilter)} value={npcTypeFilter}>
            <option value="all">All</option>
            <option value="mob">Mob</option>
            <option value="vendor">Vendor</option>
            <option value="quest">Quest</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          <span>Content</span>
          <select disabled={!selectedZone} onChange={(event) => setContentFilter(event.target.value as ContentFilter)} value={contentFilter}>
            <option value="all">All</option>
            <option value="drops">Has drops</option>
            <option value="vendor">Has vendor items</option>
            <option value="quest">Has quest items</option>
            <option value="none">No items</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select disabled={!selectedZone} onChange={(event) => setSortMode(event.target.value as SortMode)} value={sortMode}>
            <option value="name">Name A-Z</option>
            <option value="level-asc">Level low to high</option>
            <option value="level-desc">Level high to low</option>
            <option value="type">NPC type</option>
            <option value="items-desc">Item count high to low</option>
          </select>
        </label>
        <p>{visibleNpcCount} NPCs shown</p>
      </section>

      {!hasZoneSelection ? (
        <p className="empty">Select a zone to view normal loot.</p>
      ) : filteredZones.length === 0 ? (
        <p className="empty">No NPCs match the active filters.</p>
      ) : (
        <div className="normal-zone-stack">
          {filteredZones.map((zone) => {
            const totals = countZoneItems(zone);
            const expansion = zoneExpansion(zone);

            return (
            <details className="zone-panel normal-zone-panel" key={zone.zoneId} open={singleZoneSelected}>
              <summary className="normal-zone-summary">
                <div>
                  <h3>
                    <a href={zone.zoneUrl} rel="noreferrer" target="_blank">{zone.zone}</a>
                  </h3>
                  <p>
                    {expansion ? `${expansion} - ` : ""}
                    {zone.mobs.length} NPCs shown
                  </p>
                </div>
                <span className="normal-zone-counts">
                  <b>{zone.mobs.length} NPCs</b>
                  <b>Drops: {totals.drops}</b>
                  <b>Vendor: {totals.vendor}</b>
                  <b>Quest: {totals.quest}</b>
                </span>
              </summary>

              <div className="normal-npc-list">
                {zone.mobs.map((npc) => (
                  <NpcRow key={npc.id} npc={npc} />
                ))}
              </div>
            </details>
          )})}
        </div>
      )}
    </>
  );
}
