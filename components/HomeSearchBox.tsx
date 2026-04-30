"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import classicRaid from "@/data/classic-raid.json";
import kunarkRaid from "@/data/kunark-raid.json";
import veliousRaid from "@/data/velious-raid.json";
import itemDetailsData from "@/data/item-details.json";
import spellsData from "@/data/spells.json";
import droppedSpellsData from "@/data/dropped-spells.json";
import craftingData from "@/data/excel-imports/crafting-normalized.json";
import factionsData from "@/data/excel-imports/factions-normalized.json";
import { itemToSlug } from "@/lib/item-slug";
import { mobToSlug } from "@/lib/mob-slug";
import { zoneToSlug } from "@/lib/zone-slug";

type SearchEntry = {
  type: "item" | "mob" | "zone" | "spell" | "recipe" | "faction";
  name: string;
  href: string;
};

// ---------------------------------------------------------------------------
// Build search index once at module load time (not per render).
// We strip all detail — only { type, name, href } strings are kept.
// ---------------------------------------------------------------------------
function buildIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];

  // --- Items ---
  for (const name of Object.keys(itemDetailsData)) {
    entries.push({ type: "item", name, href: `/item/${itemToSlug(name)}` });
  }

  // --- Group-named mobs + zones ---
  const seenZones = new Set<string>();
  for (const dataset of [classicData, kunarkData, veliousData]) {
    for (const bucket of dataset.buckets) {
      for (const mob of bucket.mobs) {
        entries.push({
          type: "mob",
          name: mob.name,
          href: `/mob/${mobToSlug(mob.name)}`,
        });
        if (!seenZones.has(mob.zone)) {
          seenZones.add(mob.zone);
          entries.push({
            type: "zone",
            name: mob.zone,
            href: `/zone/${zoneToSlug(mob.zone)}`,
          });
        }
      }
    }
  }

  // --- Raid mobs + zones ---
  for (const dataset of [classicRaid, kunarkRaid, veliousRaid]) {
    for (const tier of dataset.tiers) {
      for (const boss of tier.bosses) {
        entries.push({
          type: "mob",
          name: boss.name,
          href: `/mob/${mobToSlug(boss.name)}`,
        });
        if (!seenZones.has(boss.zone)) {
          seenZones.add(boss.zone);
          entries.push({
            type: "zone",
            name: boss.zone,
            href: `/zone/${zoneToSlug(boss.zone)}`,
          });
        }
      }
    }
  }

  // --- Spells ---
  const seenSpells = new Set<string>();
  for (const spell of [...spellsData, ...droppedSpellsData]) {
    if (!seenSpells.has(spell.name)) {
      seenSpells.add(spell.name);
      entries.push({ type: "spell", name: spell.name, href: "/spells" });
    }
  }

  // --- Recipes ---
  const seenRecipes = new Set<string>();
  for (const recipe of craftingData.recipes) {
    if (!seenRecipes.has(recipe.name)) {
      seenRecipes.add(recipe.name);
      entries.push({ type: "recipe", name: recipe.name, href: "/crafting" });
    }
  }

  // --- Factions ---
  for (const faction of factionsData.factions) {
    entries.push({ type: "faction", name: faction.name, href: "/factions" });
  }

  return entries;
}

const ALL_ENTRIES: SearchEntry[] = buildIndex();

const TYPE_LABELS: Record<SearchEntry["type"], string> = {
  item: "Items",
  mob: "Mobs",
  zone: "Zones",
  spell: "Spells",
  recipe: "Recipes",
  faction: "Factions",
};

const TYPE_ORDER: SearchEntry["type"][] = [
  "item",
  "mob",
  "zone",
  "spell",
  "recipe",
  "faction",
];

const MAX_PER_GROUP = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function HomeSearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo<SearchEntry[]>(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return ALL_ENTRIES.filter((e) =>
      e.name.toLowerCase().includes(needle),
    ).slice(0, 60);
  }, [q]);

  const grouped = useMemo<Record<SearchEntry["type"], SearchEntry[]>>(() => {
    const g: Record<SearchEntry["type"], SearchEntry[]> = {
      item: [],
      mob: [],
      zone: [],
      spell: [],
      recipe: [],
      faction: [],
    };
    for (const m of matches) g[m.type].push(m);
    return g;
  }, [matches]);

  // Flat ordered list used for keyboard navigation
  const flatOrdered = useMemo<SearchEntry[]>(() => {
    const out: SearchEntry[] = [];
    for (const type of TYPE_ORDER) {
      out.push(...grouped[type].slice(0, MAX_PER_GROUP));
    }
    return out;
  }, [grouped]);

  const showDropdown = isOpen && matches.length > 0;

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function navigate(entry: SearchEntry) {
    router.push(entry.href);
    setQ("");
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatOrdered.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatOrdered.length) % flatOrdered.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const entry = flatOrdered[activeIndex];
      if (entry) navigate(entry);
    }
  }

  // Build a per-entry index offset so we can compute the global activeIndex
  // across groups while rendering.
  let globalIdx = -1;

  return (
    <div
      className="home-search"
      ref={containerRef}
      role="search"
      aria-label="Search all content"
    >
      <input
        aria-autocomplete="list"
        aria-controls={showDropdown ? "home-search-listbox" : undefined}
        aria-expanded={showDropdown}
        aria-label="Search items, mobs, zones, spells, recipes, factions"
        autoComplete="off"
        onBlur={() => {
          // Small delay so click on result fires before we close
          window.setTimeout(() => setIsOpen(false), 150);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search anything..."
        role="combobox"
        type="search"
        value={q}
      />

      {showDropdown && (
        <ul
          className="home-search-results"
          id="home-search-listbox"
          role="listbox"
          aria-label="Search results"
        >
          {TYPE_ORDER.map((type) => {
            const items = grouped[type].slice(0, MAX_PER_GROUP);
            if (items.length === 0) return null;
            return (
              <li key={type} className="home-search-group">
                <span className="home-search-group-label">
                  {TYPE_LABELS[type]}
                </span>
                <ul role="group" aria-label={TYPE_LABELS[type]}>
                  {items.map((entry) => {
                    globalIdx += 1;
                    const idx = globalIdx;
                    const isActive = idx === activeIndex;
                    return (
                      <li key={`${entry.type}-${entry.name}`} role="option" aria-selected={isActive}>
                        <Link
                          className={
                            isActive
                              ? "home-search-result is-active"
                              : "home-search-result"
                          }
                          href={entry.href}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => {
                            setQ("");
                            setIsOpen(false);
                          }}
                        >
                          {entry.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
