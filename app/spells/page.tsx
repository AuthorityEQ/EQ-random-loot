"use client";

import Link from "next/link";
import { useEffect, useDeferredValue, useMemo, useState } from "react";

import droppedSpellsData from "@/data/dropped-spells.json";
import spellsData from "@/data/spells.json";
import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import { formatEqPriceTotal, getShoppingListMinTotal, getVendorOptionsForShoppingList, getZoneSpellPriceTotal, spellShoppingKey, type ShoppingListSpell, type SpellVendor } from "@/lib/spell-shopping";
import { buildMobIndex, mobToSlug } from "@/lib/mob-slug";
import { zoneToSlug } from "@/lib/zone-slug";
import type { LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";

// ---------------------------------------------------------------------------
// Valid slug sets — built once at module level from the same data sources used
// by app/mob/[name]/page.tsx and app/zone/[name]/page.tsx. Mob links and zone
// links are only rendered as <Link> when the slug is present in these sets;
// otherwise plain <span> text is rendered to avoid 404 navigation.
// ---------------------------------------------------------------------------

const _groupDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const _raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const _allGroupBuckets = _groupDatasets.flatMap((d) => d.buckets);
const _mobIndex = buildMobIndex(_allGroupBuckets, _raidDatasets);

const validMobSlugs = new Set(_mobIndex.keys());

const validZoneSlugs = new Set(
  _allGroupBuckets.flatMap((b) => b.zones).map(zoneToSlug),
);

type SpellExpansion = "Classic" | "Kunark" | "Velious";

type SpellDropSource = {
  mob: string;
  zone: string;
  sourceUrl: string;
};

type SpellQuestSource = {
  name: string;
  npc?: string;
  zone?: string;
};

type SpellRecord = {
  name: string;
  level: number;
  class: string;
  expansion: SpellExpansion;
  description: string;
  sourceUrl: string;
  vendors?: SpellVendor[];
  vendorStatus?: "requires_manual_entry" | "no_vendor_data_found";
  sourceType?: "dropped_or_quested";
  dropSources?: SpellDropSource[];
  questSource?: SpellQuestSource;
  enrichmentStatus?: "ok" | "no_source_data" | "fetch_error";
};

type SelectedVendorStop = {
  zone: string;
  coveredSpellKeys: string[];
};

function isDroppedSpell(spell: SpellRecord): boolean {
  return (!spell.vendors || spell.vendors.length === 0) && spell.sourceType === "dropped_or_quested";
}

const expansionOrder: SpellExpansion[] = ["Classic", "Kunark", "Velious"];
const spells: SpellRecord[] = [
  ...(spellsData as SpellRecord[]),
  ...(droppedSpellsData as SpellRecord[]),
].sort((a, b) => {
  const classComp = a.class.localeCompare(b.class);
  if (classComp !== 0) return classComp;
  const expComp = expansionOrder.indexOf(a.expansion) - expansionOrder.indexOf(b.expansion);
  if (expComp !== 0) return expComp;
  const levelComp = a.level - b.level;
  if (levelComp !== 0) return levelComp;
  return a.name.localeCompare(b.name);
});
const shoppingListStorageKey = "frostreaver-spell-shopping-list";
const vendorPlanStorageKey = "frostreaver-spell-vendor-plan";
const purchasedSpellsStorageKey = "frostreaver-spell-purchased-list";

function expansionTone(expansion: SpellExpansion) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

function levelTone(level: number) {
  return `spell-level-tone-${((level - 1) % 6) + 1}`;
}

export default function SpellsPage() {
  const classOptions = Array.from(new Set(spells.map((spell) => spell.class))).sort();
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExpansions, setSelectedExpansions] = useState<Set<SpellExpansion>>(() => new Set(expansionOrder));
  const [levelInput, setLevelInput] = useState("");
  const deferredLevelInput = useDeferredValue(levelInput);
  const [showAll, setShowAll] = useState(false);
  const [bulkMinLevel, setBulkMinLevel] = useState("");
  const [bulkMaxLevel, setBulkMaxLevel] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [shoppingList, setShoppingList] = useState<ShoppingListSpell[]>([]);
  const [shoppingListReady, setShoppingListReady] = useState(false);
  const [viewMode, setViewMode] = useState<"spells" | "shopping" | "vendor" | "route">("spells");
  const [selectedVendorStops, setSelectedVendorStops] = useState<SelectedVendorStop[]>([]);
  const [ignoredVendorZones, setIgnoredVendorZones] = useState<string[]>([]);
  const [vendorPlanReady, setVendorPlanReady] = useState(false);
  const [purchasedSpellKeys, setPurchasedSpellKeys] = useState<string[]>([]);
  const [purchasedReady, setPurchasedReady] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const selectedLevel = deferredLevelInput.trim() === "" ? null : Number.parseInt(deferredLevelInput, 10);
  const shoppingKeys = useMemo(() => new Set(shoppingList.map(spellShoppingKey)), [shoppingList]);
  const purchasedKeys = useMemo(() => new Set(purchasedSpellKeys), [purchasedSpellKeys]);
  const activeShoppingList = useMemo(
    () => shoppingList.filter((spell) => !purchasedKeys.has(spellShoppingKey(spell))),
    [purchasedKeys, shoppingList],
  );
  const allVendorOptions = useMemo(() => getVendorOptionsForShoppingList(activeShoppingList), [activeShoppingList]);
  const selectedPlan = useMemo(
    () => selectedVendorStops
      .map((selectedStop) => {
        const zoneOption = allVendorOptions.find((option) => option.zone === selectedStop.zone);
        if (!zoneOption) return null;
        const coveredKeys = new Set(selectedStop.coveredSpellKeys);
        const vendors = zoneOption.vendors
          .map((vendor) => ({
            ...vendor,
            spells: vendor.spells.filter((spell) => coveredKeys.has(spell.key)),
          }))
          .filter((vendor) => vendor.spells.length > 0);
        if (vendors.length === 0) return null;
        return {
          ...zoneOption,
          vendors,
          totalSpells: selectedStop.coveredSpellKeys.length,
        };
      })
      .filter((option): option is NonNullable<typeof option> => Boolean(option)),
    [allVendorOptions, selectedVendorStops],
  );
  const coveredSpellKeys = useMemo(() => {
    return new Set(selectedVendorStops.flatMap((stop) => stop.coveredSpellKeys));
  }, [selectedVendorStops]);
  const remainingSpells = useMemo(
    () => activeShoppingList.filter((spell) => !coveredSpellKeys.has(spellShoppingKey(spell))),
    [activeShoppingList, coveredSpellKeys],
  );
  const vendorOptions = useMemo(
    () => getVendorOptionsForShoppingList(remainingSpells)
      .filter((option) => !ignoredVendorZones.includes(option.zone))
      .sort((a, b) => b.totalSpells - a.totalSpells || a.zone.localeCompare(b.zone)),
    [ignoredVendorZones, remainingSpells],
  );
  const routeStops = useMemo(
    () => selectedPlan
      .map((stop) => {
        const vendors = stop.vendors
          .map((vendor) => ({
            ...vendor,
            spells: vendor.spells
              .map((spell) => {
                  return {
                    ...spell,
                    purchased: purchasedKeys.has(spell.key),
                };
              })
              .filter((spell): spell is NonNullable<typeof spell> => Boolean(spell))
              .filter((spell) => !spell.purchased),
          }))
          .filter((vendor) => vendor.spells.length > 0);
        const uniqueSpellKeys = new Set(vendors.flatMap((vendor) => vendor.spells.map((spell) => spell.key)));
        const unpurchasedSpellKeys = new Set(vendors.flatMap((vendor) => vendor.spells.filter((spell) => !spell.purchased).map((spell) => spell.key)));
        return {
          ...stop,
          vendors,
          totalSpells: uniqueSpellKeys.size,
          remainingSpells: unpurchasedSpellKeys.size,
        };
      })
      .filter((stop) => stop.vendors.length > 0)
      .sort((a, b) => b.remainingSpells - a.remainingSpells || a.zone.localeCompare(b.zone)),
    [purchasedKeys, selectedPlan, shoppingList],
  );
  const plannedSpellKeys = useMemo(() => {
    return new Set(selectedVendorStops.flatMap((stop) => stop.coveredSpellKeys));
  }, [selectedVendorStops]);
  const plannedRemainingCount = useMemo(
    () => Array.from(plannedSpellKeys).filter((key) => !purchasedKeys.has(key)).length,
    [plannedSpellKeys, purchasedKeys],
  );
  const routeGrandTotal = useMemo(
    () => formatEqPriceTotal(getZoneSpellPriceTotal(routeStops.flatMap((stop) => stop.vendors))),
    [routeStops],
  );
  const shoppingListMinTotal = useMemo(
    () => formatEqPriceTotal(getShoppingListMinTotal(activeShoppingList)),
    [activeShoppingList],
  );
  const visibleSpells = useMemo(
    () =>
      spells
        .filter((spell) => selectedClass === "Any" || spell.class === selectedClass)
        .filter((spell) => selectedExpansions.has(spell.expansion))
        .filter((spell) => selectedLevel === null || spell.level === selectedLevel)
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    [selectedClass, selectedExpansions, selectedLevel],
  );

  // Reset showAll whenever the class filter changes.
  useEffect(() => {
    setShowAll(false);
  }, [selectedClass]);

  function toggleExpansion(expansion: SpellExpansion) {
    setSelectedExpansions((current) => {
      const next = new Set(current);
      if (next.has(expansion)) {
        next.delete(expansion);
      } else {
        next.add(expansion);
      }
      return next;
    });
  }

  function toggleShoppingListSpell(spell: SpellRecord) {
    const key = spellShoppingKey(spell);
    setShoppingList((current) => {
      if (current.some((savedSpell) => spellShoppingKey(savedSpell) === key)) {
        return current.filter((savedSpell) => spellShoppingKey(savedSpell) !== key);
      }

      return [
        ...current,
        {
          name: spell.name,
          level: spell.level,
          class: spell.class,
          expansion: spell.expansion,
          description: spell.description,
          sourceUrl: spell.sourceUrl,
          vendors: spell.vendors,
        },
      ].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    });
  }

  function toShoppingListSpell(spell: SpellRecord): ShoppingListSpell {
    return {
      name: spell.name,
      level: spell.level,
      class: spell.class,
      expansion: spell.expansion,
      description: spell.description,
      sourceUrl: spell.sourceUrl,
      vendors: spell.vendors,
    };
  }

  function bulkAddSpellsInRange() {
    setBulkError("");
    setBulkMessage("");

    const minLevel = Number.parseInt(bulkMinLevel, 10);
    const maxLevel = Number.parseInt(bulkMaxLevel, 10);
    if (!Number.isFinite(minLevel) || !Number.isFinite(maxLevel)) {
      setBulkError("Enter both levels.");
      return;
    }
    if (minLevel < 1 || maxLevel < 1) {
      setBulkError("Levels must be 1 or higher.");
      return;
    }
    if (minLevel > maxLevel) {
      setBulkError("Min level must be less than or equal to max level.");
      return;
    }

    const matchingSpells = visibleSpells.filter(
      (spell) =>
        !isDroppedSpell(spell) &&
        (spell.vendors?.length ?? 0) > 0 &&
        spell.level >= minLevel &&
        spell.level <= maxLevel,
    );
    const matchingKeys = new Set(matchingSpells.map(spellShoppingKey));
    const existingKeys = new Set(shoppingList.map(spellShoppingKey));
    const addedCount = matchingSpells.filter((spell) => !existingKeys.has(spellShoppingKey(spell))).length;

    setShoppingList((current) => {
      const currentKeys = new Set(current.map(spellShoppingKey));
      const additions = matchingSpells
        .filter((spell) => !currentKeys.has(spellShoppingKey(spell)))
        .map(toShoppingListSpell);
      return [...current, ...additions].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    });
    setPurchasedSpellKeys((current) => current.filter((key) => !matchingKeys.has(key)));
    setBulkMessage(`Added ${addedCount} ${addedCount === 1 ? "spell" : "spells"} to shopping list.`);
  }

  useEffect(() => {
    try {
      const rawList = window.localStorage.getItem(shoppingListStorageKey);
      if (rawList) {
        const parsed = JSON.parse(rawList) as ShoppingListSpell[];
        setShoppingList(parsed.filter((spell) => !isDroppedSpell(spell as SpellRecord)));
      }
    } catch {
      setShoppingList([]);
    } finally {
      setShoppingListReady(true);
    }
  }, []);

  useEffect(() => {
    if (!shoppingListReady) return;
    window.localStorage.setItem(shoppingListStorageKey, JSON.stringify(shoppingList));
  }, [shoppingList, shoppingListReady]);

  useEffect(() => {
    if (!shoppingListReady || !purchasedReady) return;
    const activeKeys = new Set(shoppingList.map(spellShoppingKey));
    setPurchasedSpellKeys((current) => current.filter((key) => activeKeys.has(key)));
    setSelectedVendorStops((current) =>
      current
        .map((stop) => ({
          ...stop,
          coveredSpellKeys: stop.coveredSpellKeys.filter((key) => activeKeys.has(key)),
        }))
        .filter((stop) => stop.coveredSpellKeys.length > 0),
    );
  }, [purchasedReady, shoppingList, shoppingListReady]);

  useEffect(() => {
    try {
      const rawPlan = window.localStorage.getItem(vendorPlanStorageKey);
      if (rawPlan) {
        const parsed = JSON.parse(rawPlan) as { selectedVendorStops?: SelectedVendorStop[]; selectedVendorZones?: string[]; ignoredVendorZones?: string[] };
        setSelectedVendorStops(
          parsed.selectedVendorStops
            ?? (parsed.selectedVendorZones ?? []).map((zone) => ({ zone, coveredSpellKeys: [] })),
        );
        setIgnoredVendorZones(parsed.ignoredVendorZones ?? []);
      }
    } catch {
      setSelectedVendorStops([]);
      setIgnoredVendorZones([]);
    } finally {
      setVendorPlanReady(true);
    }
  }, []);

  useEffect(() => {
    if (!vendorPlanReady) return;
    window.localStorage.setItem(vendorPlanStorageKey, JSON.stringify({ selectedVendorStops, ignoredVendorZones }));
  }, [ignoredVendorZones, selectedVendorStops, vendorPlanReady]);

  useEffect(() => {
    try {
      const rawPurchased = window.localStorage.getItem(purchasedSpellsStorageKey);
      if (rawPurchased) {
        setPurchasedSpellKeys(JSON.parse(rawPurchased));
      }
    } catch {
      setPurchasedSpellKeys([]);
    } finally {
      setPurchasedReady(true);
    }
  }, []);

  useEffect(() => {
    if (!purchasedReady) return;
    window.localStorage.setItem(purchasedSpellsStorageKey, JSON.stringify(purchasedSpellKeys));
  }, [purchasedReady, purchasedSpellKeys]);

  function useVendorZone(zone: string) {
    const zoneOption = vendorOptions.find((option) => option.zone === zone);
    if (!zoneOption) return;
    const coveredKeys = Array.from(new Set(zoneOption.vendors.flatMap((vendor) => vendor.spells.map((spell) => spell.key))));
    setSelectedVendorStops((current) => {
      if (current.some((stop) => stop.zone === zone)) return current;
      return [...current, { zone, coveredSpellKeys: coveredKeys }];
    });
    setIgnoredVendorZones((current) => current.filter((ignoredZone) => ignoredZone !== zone));
  }

  function ignoreVendorZone(zone: string) {
    setIgnoredVendorZones((current) => current.includes(zone) ? current : [...current, zone]);
  }

  function removeVendorZone(zone: string) {
    setSelectedVendorStops((current) => current.filter((stop) => stop.zone !== zone));
  }

  function togglePurchasedSpell(key: string) {
    setPurchasedSpellKeys((current) => current.includes(key) ? current.filter((savedKey) => savedKey !== key) : [...current, key]);
  }

  function clearCompletedRoute() {
    setPurchasedSpellKeys([]);
    setSelectedVendorStops([]);
    setIgnoredVendorZones([]);
    setViewMode("shopping");
  }

  function clearPurchased() {
    setPurchasedSpellKeys([]);
  }

  function confirmResetShoppingWorkflow() {
    setShoppingList([]);
    setPurchasedSpellKeys([]);
    setSelectedVendorStops([]);
    setIgnoredVendorZones([]);
    setViewMode("spells");
    setShowResetConfirm(false);
    window.localStorage.removeItem(shoppingListStorageKey);
    window.localStorage.removeItem(vendorPlanStorageKey);
    window.localStorage.removeItem(purchasedSpellsStorageKey);
  }

  useEffect(() => {
    if (!showResetConfirm) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowResetConfirm(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showResetConfirm]);

  return (
    <main className="page spells-page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="header spells-header">
        <div>
          <p className="eyebrow">EverQuest / Spells</p>
          <h1>Spells</h1>
          <p className="wip-line">Bard spell data preview</p>
        </div>
      </header>

      <div className="spell-view-actions">
        {viewMode === "route" ? (
          <>
            <button className="home-reset-button" onClick={() => setViewMode("vendor")} type="button">
              Back to Vendor Plan
            </button>
            <button className="home-reset-button" onClick={() => setViewMode("spells")} type="button">
              Back to Spells
            </button>
            <button className="home-reset-button is-danger" onClick={() => setShowResetConfirm(true)} type="button">
              Reset shopping list
            </button>
          </>
        ) : viewMode === "vendor" ? (
          <>
            <button className="home-reset-button" onClick={() => setViewMode("shopping")} type="button">
              Back to Shopping List
            </button>
            <button className="home-reset-button is-danger" onClick={() => setShowResetConfirm(true)} type="button">
              Reset shopping list
            </button>
          </>
        ) : viewMode === "shopping" ? (
          <>
            <button className="home-reset-button" onClick={() => setViewMode("spells")} type="button">
              Back to Spells
            </button>
            <button className="home-reset-button is-danger" onClick={() => setShowResetConfirm(true)} type="button">
              Reset shopping list
            </button>
          </>
        ) : (
          <button className="home-reset-button" onClick={() => setViewMode("shopping")} type="button">
            Shopping List <span>{shoppingList.length}</span>
          </button>
        )}
      </div>

      {viewMode === "route" ? (
        <section className="vendor-route-view" aria-label="Final vendor shopping route">
          <div className="vendor-plan-summary vendor-route-summary">
            <div>
              <h2>Shopping Route</h2>
              {routeStops.length > 0 ? (
                <ul>
                  {routeStops.map((stop) => (
                    <li key={stop.zone}>
                      <span>{stop.zone} - {stop.remainingSpells} spells / {stop.vendors.length} vendors</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No vendor stops selected.</p>
              )}
            </div>
            <div className="vendor-route-actions">
              <strong>
                {plannedRemainingCount === 0 && plannedSpellKeys.size > 0 ? "All planned spells purchased." : `Remaining planned spells: ${plannedRemainingCount}`}
              </strong>
              {routeGrandTotal ? <span className="vendor-route-total">Total: {routeGrandTotal}</span> : null}
              {purchasedSpellKeys.length > 0 ? (
                <button onClick={clearPurchased} type="button">Clear purchased</button>
              ) : null}
              {plannedRemainingCount === 0 && plannedSpellKeys.size > 0 ? (
                <button onClick={clearCompletedRoute} type="button">Clear completed route</button>
              ) : null}
            </div>
          </div>

          {routeStops.length > 0 ? (
            <div className="vendor-route-list">
              {routeStops.map((stop) => {
                const zoneTotal = formatEqPriceTotal(getZoneSpellPriceTotal(stop.vendors));
                return (
                <article className="vendor-zone-card vendor-route-card" key={stop.zone}>
                  <div className="vendor-zone-card-header">
                    <div>
                      <h3>{stop.zone}</h3>
                      <p>{stop.remainingSpells} spells to buy here</p>
                      <span>{stop.vendors.length} vendors</span>
                    </div>
                    {zoneTotal ? <strong className="vendor-price-total">Total: {zoneTotal}</strong> : null}
                  </div>
                  <div className="vendor-list">
                    {stop.vendors.map((vendor) => (
                      <div className="vendor-entry" key={vendor.npc}>
                        <strong>{vendor.npc}</strong>
                        <ul>
                          {vendor.spells.map((spell) => (
                            <li className={spell.purchased ? "is-purchased" : undefined} key={`${vendor.npc}-${spell.key}`}>
                              <button
                                aria-pressed={spell.purchased}
                                className="spell-purchase-button"
                                onClick={() => togglePurchasedSpell(spell.key)}
                                type="button"
                              >
                                <span>{spell.purchased ? "✓" : ""}</span>
                                <strong>{spell.name}</strong>
                              </button>
                              <em>{spell.class} Level {spell.level}{spell.price ? ` - ${spell.price}` : ""}</em>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>
                );
              })}
            </div>
          ) : (
            <p className="empty">
              {plannedSpellKeys.size > 0 ? "All planned spells purchased." : "No vendor stops selected."}
            </p>
          )}
        </section>
      ) : viewMode === "vendor" ? (
        <section className="vendor-plan-view" aria-label="Vendor plan">
          <div className="vendor-plan-summary">
            <div>
              <h2>Selected stops</h2>
              {selectedPlan.length > 0 ? (
                <ul>
                  {selectedPlan.map((stop) => {
                    const selectedStopTotal = formatEqPriceTotal(getZoneSpellPriceTotal(stop.vendors));
                    return (
                      <li key={stop.zone}>
                        <span>{stop.zone} - {stop.totalSpells} spells{selectedStopTotal ? ` - ${selectedStopTotal}` : ""}</span>
                        <button onClick={() => removeVendorZone(stop.zone)} type="button">Remove</button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>No vendor stops selected.</p>
              )}
            </div>
            <strong>
              {remainingSpells.length === 0 ? "All shopping list spells are covered." : `Remaining spells: ${remainingSpells.length}`}
            </strong>
            <button disabled={selectedPlan.length === 0} onClick={() => setViewMode("route")} type="button">
              View shopping route
            </button>
          </div>

          {vendorOptions.length > 0 ? (
            <div className="vendor-zone-grid">
              {vendorOptions.map((zoneOption) => {
                const zoneOptionTotal = formatEqPriceTotal(getZoneSpellPriceTotal(zoneOption.vendors));
                return (
                <article className="vendor-zone-card" key={zoneOption.zone}>
                  <div className="vendor-zone-card-header">
                    <div>
                      <div className="vendor-zone-title">
                        <h3>{zoneOption.zone}</h3>
                        {zoneOptionTotal ? <strong className="vendor-price-total is-inline">Total: {zoneOptionTotal}</strong> : null}
                      </div>
                      <p>{zoneOption.totalSpells} remaining uncovered spells sold here</p>
                      <span>{zoneOption.vendors.length} vendors</span>
                    </div>
                    <div className="vendor-zone-actions">
                      <button onClick={() => useVendorZone(zoneOption.zone)} type="button">Use this zone</button>
                      <button onClick={() => ignoreVendorZone(zoneOption.zone)} type="button">Ignore</button>
                    </div>
                  </div>
                  <div className="vendor-list">
                    {zoneOption.vendors.map((vendor) => (
                      <div className="vendor-entry" key={vendor.npc}>
                        <strong>{vendor.npc}</strong>
                        <ul>
                          {vendor.spells.map((spell) => (
                            <li key={`${vendor.npc}-${spell.key}`}>
                              <span>{spell.name}</span>
                              <em>{spell.price}</em>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>
                );
              })}
            </div>
          ) : (
            <p className="empty">
              {remainingSpells.length === 0 ? "All shopping list spells are covered." : "No vendor options for remaining spells."}
            </p>
          )}
        </section>
      ) : viewMode === "shopping" ? (
        <section className="spell-shopping-list" aria-label="Spell shopping list">
          {shoppingList.length > 0 ? (
            <>
              <div className="spell-shopping-summary">
                <strong>{shoppingList.length} spells selected</strong>
                <span>{allVendorOptions.length} vendor zones with known purchase data</span>
                {shoppingListMinTotal ? (
                  <span className="vendor-route-total">Cheapest possible: {shoppingListMinTotal}</span>
                ) : null}
                <button className="spell-list-button" onClick={() => setViewMode("vendor")} type="button">
                  Plan vendor route
                </button>
              </div>
              <div className="spell-list">
                {shoppingList.map((spell) => (
                  <article className={`spell-row spell-shopping-row ${expansionTone(spell.expansion as SpellExpansion)}`} key={spellShoppingKey(spell)}>
                    <div className={`spell-level-badge ${levelTone(spell.level)}`} aria-label={`Level ${spell.level}`}>
                      <span>{spell.level}</span>
                    </div>
                    <div className="spell-row-main">
                      {spell.sourceUrl ? (
                        <a className="spell-name" href={spell.sourceUrl} target="_blank" rel="noreferrer">
                          {spell.name}
                        </a>
                      ) : (
                        <strong className="spell-name">{spell.name}</strong>
                      )}
                      <p className="spell-description">{spell.description}</p>
                    </div>
                    <div className="spell-meta">
                      <span>{spell.class}</span>
                      <span className={`expansion-pill is-compact ${expansionTone(spell.expansion as SpellExpansion)}`}>{spell.expansion}</span>
                    </div>
                    <button className="spell-list-button is-active" onClick={() => toggleShoppingListSpell(spell as SpellRecord)} type="button">
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="empty">No spells in your shopping list.</p>
          )}
        </section>
      ) : (
        <>
      <section className="toolbar spells-toolbar" aria-label="Spell filters">
        <label className="class-filter">
          <span>Class</span>
          <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
            <option value="" disabled>Select class…</option>
            <option value="Any">Any class</option>
            {classOptions.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </label>

        <div className="expansion-filter">
          <span>Expansion</span>
          <div className="expansion-toggle-group">
            {expansionOrder.map((expansion) => {
              const active = selectedExpansions.has(expansion);
              return (
                <button
                  className={`filter-button expansion-filter-button ${expansionTone(expansion)}${active ? " is-active" : ""}`}
                  key={expansion}
                  onClick={() => toggleExpansion(expansion)}
                  type="button"
                  aria-pressed={active}
                >
                  {expansion}
                </button>
              );
            })}
          </div>
        </div>

        <label className="level-filter">
          <span>Level</span>
          <input
            inputMode="numeric"
            min={1}
            onChange={(event) => setLevelInput(event.target.value.replace(/\D/g, ""))}
            pattern="[0-9]*"
            placeholder="Any"
            type="text"
            value={levelInput}
          />
        </label>

        <div className="bulk-spell-add" aria-label="Bulk add spells">
          <span>Add range</span>
          <div className="bulk-spell-add-controls">
            <input
              aria-label="Minimum spell level"
              inputMode="numeric"
              min={1}
              onChange={(event) => setBulkMinLevel(event.target.value.replace(/\D/g, ""))}
              pattern="[0-9]*"
              placeholder="Min level"
              type="text"
              value={bulkMinLevel}
            />
            <input
              aria-label="Maximum spell level"
              inputMode="numeric"
              min={1}
              onChange={(event) => setBulkMaxLevel(event.target.value.replace(/\D/g, ""))}
              pattern="[0-9]*"
              placeholder="Max level"
              type="text"
              value={bulkMaxLevel}
            />
            <button className="spell-list-button" onClick={bulkAddSpellsInRange} type="button">
              Add all in range
            </button>
          </div>
          {bulkError ? <p className="bulk-spell-message is-error">{bulkError}</p> : null}
          {bulkMessage ? <p className="bulk-spell-message">{bulkMessage}</p> : null}
        </div>
      </section>

      {!selectedClass ? (
        <p className="empty">Select a class to view spells.</p>
      ) : visibleSpells.length === 0 ? (
        <p className="empty">No spells found.</p>
      ) : (
        <>
          <section className="spell-list" aria-label="Spell results">
            {(selectedClass === "Any" && !showAll ? visibleSpells.slice(0, 200) : visibleSpells).map((spell) => (
              <article className={`spell-row ${expansionTone(spell.expansion)}`} key={`${spell.name}-${spell.class}-${spell.expansion}-${spell.level}`}>
                <div className={`spell-level-badge ${levelTone(spell.level)}`} aria-label={`Level ${spell.level}`}>
                  <span>{spell.level}</span>
                </div>
                <div className="spell-row-main">
                  <a className="spell-name" href={spell.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {spell.name}
                  </a>
                  <p className="spell-description">{spell.description}</p>
                  {isDroppedSpell(spell) && (spell.dropSources?.length || spell.questSource) ? (
                    <div className="spell-source-detail">
                      {spell.dropSources?.length ? (
                        <ul className="spell-drop-sources" aria-label={`${spell.name} drop sources`}>
                          {spell.dropSources.map((src) => {
                            const mobSlug = mobToSlug(src.mob);
                            const zoneSlug = zoneToSlug(src.zone);
                            return (
                              <li key={`${src.mob}-${src.zone}`}>
                                <span className="spell-drop-mob">
                                  {validMobSlugs.has(mobSlug)
                                    ? <Link className="spell-source-link-inline" href={`/mob/${mobSlug}`}>{src.mob}</Link>
                                    : <span className="spell-source-link-inline">{src.mob}</span>}
                                </span>
                                <span className="spell-drop-sep">in</span>
                                <span className="spell-drop-zone">
                                  {validZoneSlugs.has(zoneSlug)
                                    ? <Link className="spell-source-link-inline" href={`/zone/${zoneSlug}`}>{src.zone}</Link>
                                    : <span className="spell-source-link-inline">{src.zone}</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {spell.questSource ? (
                        <p className="spell-quest-source">
                          <span className="spell-quest-label">Quest:</span> {spell.questSource.name}
                          {spell.questSource.npc ? <> from {spell.questSource.npc}</> : null}
                          {spell.questSource.zone ? <> in {spell.questSource.zone}</> : null}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {isDroppedSpell(spell) && !spell.dropSources?.length && !spell.questSource ? (
                    <p className="spell-source-unknown">No drop or quest data available.</p>
                  ) : null}
                </div>
                <div className="spell-meta">
                  <span>{spell.class}</span>
                  <span className={`expansion-pill is-compact ${expansionTone(spell.expansion)}`}>{spell.expansion}</span>
                </div>
                {isDroppedSpell(spell) ? (
                  <>
                    <span className="spell-badge spell-badge--dropped">Dropped</span>
                    <a className="spell-source-link" href={spell.sourceUrl} target="_blank" rel="noopener noreferrer">View on Allakhazam</a>
                  </>
                ) : (
                  <button className={`spell-list-button${shoppingKeys.has(spellShoppingKey(spell)) ? " is-active" : ""}`} onClick={() => toggleShoppingListSpell(spell)} type="button">
                    {shoppingKeys.has(spellShoppingKey(spell)) ? "In list" : "Add to list"}
                  </button>
                )}
              </article>
            ))}
          </section>
          {selectedClass === "Any" && !showAll && visibleSpells.length > 200 ? (
            <div className="spell-list-show-all">
              <button className="spell-list-button" onClick={() => setShowAll(true)} type="button">
                Show all {visibleSpells.length} spells
              </button>
            </div>
          ) : null}
        </>
      )}
        </>
      )}

      {showResetConfirm ? (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)} role="presentation">
          <section className="reset-confirm-modal" aria-labelledby="reset-shopping-title" aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog">
            <h2 id="reset-shopping-title">Reset shopping list?</h2>
            <p>This will clear your selected spells, vendor route, ignored zones, and purchased progress.</p>
            <div className="reset-confirm-actions">
              <button onClick={() => setShowResetConfirm(false)} type="button">Cancel</button>
              <button className="is-danger" onClick={confirmResetShoppingWorkflow} type="button">Reset list</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
