"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import realSpawnZoneSummariesData from "@/data/eqemu-real-spawn-zone-summaries.json";
import {
  canonicalizeZoneSummary,
  canonicalZoneRouteSlug,
  normalizeRealSpawnSummary,
  ZoneDataStatusBadge,
  ZoneMobSnapshot,
  type ZoneMobSummary,
  zoneMobSummaries,
} from "@/components/ZoneMobSnapshot";

type ExpansionFilter = "All" | "Classic" | "Kunark" | "Velious" | "Luclin" | "Planes of Power" | "Later / Other" | "Unmapped";
type ZoneSortMode = "alphabetical" | "mob-count" | "average-level" | "level-match" | "race-match";
export type ZoneDataSourceMode = "snapshot" | "spawns";

const primaryExpansionFilters: ExpansionFilter[] = ["All", "Classic", "Kunark", "Velious", "Luclin", "Planes of Power", "Later / Other"];
const primaryExpansionSet = new Set(["Classic", "Kunark", "Velious", "Luclin", "Planes of Power"]);
const zoneDataSourceStorageKey = "frostreaver-zone-data-source";
const realSpawnSummaries = (realSpawnZoneSummariesData as unknown as Array<ZoneMobSummary & { routeSlug?: string; zoneShortName?: string }>)
  .map((summary) => normalizeRealSpawnSummary(canonicalizeZoneSummary(summary)));
const expansionOrder = new Map([
  ["Classic", 0],
  ["Kunark", 1],
  ["Velious", 2],
  ["Luclin", 3],
  ["Planes of Power", 4],
  ["Legacy of Ykesha", 5],
  ["Unmapped", 99],
]);

function expansionFilterMatches(summary: ZoneMobSummary, filter: ExpansionFilter) {
  if (filter === "All") return true;
  if (filter === "Later / Other") return !primaryExpansionSet.has(summary.expansion) && summary.expansion !== "Unmapped";
  if (filter === "Unmapped") return summary.expansion === "Unmapped";
  return summary.expansion === filter;
}

function countMobsNearLevel(summary: ZoneMobSummary, level: number | null) {
  if (level === null) return 0;
  let count = 0;
  for (let currentLevel = level - 2; currentLevel <= level + 2; currentLevel += 1) {
    count += summary.levelCounts[String(currentLevel)] ?? 0;
  }
  return count;
}

function pluralRaceLabel(label: string) {
  if (/s$/i.test(label)) return label;
  if (/man$/i.test(label)) return `${label.slice(0, -3)}men`;
  return `${label}s`;
}

function normalizedRaceSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchingRaceLabels(summary: ZoneMobSummary, raceQuery: string) {
  if (!raceQuery) return [];
  const raceCounts = summary.normalizedRaceCounts ?? summary.raceCounts;
  const aliases = summary.raceAliases ?? {};
  return Object.keys(raceCounts).filter((race) => {
    const raceValue = race.toLowerCase();
    if (raceValue.includes(raceQuery)) return true;
    return (aliases[race] ?? []).some((alias) => alias.toLowerCase().includes(raceQuery));
  });
}

function countMatchingRaceMobs(summary: ZoneMobSummary, raceQuery: string, level: number | null) {
  const races = matchingRaceLabels(summary, raceQuery);
  if (races.length === 0) return 0;
  if (level === null) {
    const raceCounts = summary.normalizedRaceCounts ?? summary.raceCounts;
    return races.reduce((sum, race) => sum + (raceCounts[race] ?? 0), 0);
  }
  return races.reduce((sum, race) => {
    const levelCounts = summary.normalizedRaceLevelCounts?.[race] ?? {};
    let raceLevelCount = 0;
    for (let currentLevel = level - 2; currentLevel <= level + 2; currentLevel += 1) {
      raceLevelCount += levelCounts[String(currentLevel)] ?? 0;
    }
    return sum + raceLevelCount;
  }, 0);
}

function averageLevelDistance(summary: ZoneMobSummary, level: number | null) {
  if (level === null || summary.averageLevel === null) return Number.POSITIVE_INFINITY;
  return Math.abs(summary.averageLevel - level);
}

function searchableCountKeys(counts: Record<string, number>) {
  return Object.keys(counts).join(" ");
}

export function ZonesExplorer() {
  const [dataSourceMode, setDataSourceMode] = useState<ZoneDataSourceMode>("snapshot");
  const [query, setQuery] = useState("");
  const [raceInput, setRaceInput] = useState("");
  const [expansionFilter, setExpansionFilter] = useState<ExpansionFilter>("All");
  const [levelInput, setLevelInput] = useState("");
  const [sortMode, setSortMode] = useState<ZoneSortMode>("alphabetical");
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedRaceQuery = normalizedRaceSearch(raceInput);
  const playerLevel = /^\d+$/.test(levelInput.trim()) ? Number(levelInput.trim()) : null;
  const nearLevelRange = playerLevel === null ? null : `${Math.max(1, playerLevel - 2)}-${playerLevel + 2}`;
  const activeSummaries = dataSourceMode === "spawns" ? realSpawnSummaries : zoneMobSummaries;
  const sourceLabel = dataSourceMode === "spawns" ? "Spawn-slot data from EQEmu/PEQ database" : "Approximate zone snapshot data";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(zoneDataSourceStorageKey);
      if (stored === "snapshot" || stored === "spawns") setDataSourceMode(stored);
    } catch {
      // localStorage can be unavailable; default snapshot mode is fine.
    }
  }, []);

  function updateDataSourceMode(mode: ZoneDataSourceMode) {
    setDataSourceMode(mode);
    try {
      window.localStorage.setItem(zoneDataSourceStorageKey, mode);
    } catch {
      // Ignore persistence failures.
    }
  }

  const expansionFilters = useMemo(() => {
    const hasUnmapped = activeSummaries.some((summary) => summary.expansion === "Unmapped");
    return hasUnmapped ? [...primaryExpansionFilters, "Unmapped" as const] : primaryExpansionFilters;
  }, [activeSummaries]);

  const raceSuggestions = useMemo(() => {
    const races = new Set<string>();
    for (const summary of activeSummaries) {
      for (const race of Object.keys(summary.normalizedRaceCounts ?? summary.raceCounts)) {
        if (race && race !== "Unknown") races.add(race);
      }
    }
    return Array.from(races).sort((a, b) => a.localeCompare(b));
  }, [activeSummaries]);

  const groupedZones = useMemo(() => {
    const summariesByRoute = new Map<string, typeof activeSummaries[number]>();
    for (const summary of activeSummaries) {
      const route = canonicalZoneRouteSlug(summary);
      if (!summariesByRoute.has(route)) summariesByRoute.set(route, summary);
    }
    const filtered = Array.from(summariesByRoute.values())
      .filter((summary) => {
        if (!expansionFilterMatches(summary, expansionFilter)) return false;
        if (normalizedRaceQuery && countMatchingRaceMobs(summary, normalizedRaceQuery, playerLevel) === 0) return false;
        if (!normalizedQuery) return true;
        const haystack = [
          summary.zoneName,
          summary.sourceFile,
          summary.zoneSlug,
          summary.expansion,
          summary.levelProfileLabel,
          searchableCountKeys(summary.mobGroupNameCounts),
          searchableCountKeys(summary.normalizedRaceCounts ?? summary.raceCounts),
          ...(summary.notes ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortMode === "race-match" && normalizedRaceQuery) {
          const matchDelta = countMatchingRaceMobs(b, normalizedRaceQuery, playerLevel) - countMatchingRaceMobs(a, normalizedRaceQuery, playerLevel);
          if (matchDelta !== 0) return matchDelta;
          const distanceDelta = averageLevelDistance(a, playerLevel) - averageLevelDistance(b, playerLevel);
          if (distanceDelta !== 0) return distanceDelta;
        }
        if (sortMode === "level-match" && playerLevel !== null) {
          const matchDelta = countMobsNearLevel(b, playerLevel) - countMobsNearLevel(a, playerLevel);
          if (matchDelta !== 0) return matchDelta;
          const distanceDelta = averageLevelDistance(a, playerLevel) - averageLevelDistance(b, playerLevel);
          if (distanceDelta !== 0) return distanceDelta;
        }
        if (sortMode === "mob-count") return b.mobCount - a.mobCount || a.zoneName.localeCompare(b.zoneName);
        if (sortMode === "average-level") {
          return (a.averageLevel ?? Number.POSITIVE_INFINITY) - (b.averageLevel ?? Number.POSITIVE_INFINITY)
            || a.zoneName.localeCompare(b.zoneName);
        }
        return (expansionOrder.get(a.expansion) ?? 98) - (expansionOrder.get(b.expansion) ?? 98)
          || a.zoneName.localeCompare(b.zoneName);
      });

    if (normalizedRaceQuery || (sortMode === "level-match" && playerLevel !== null)) {
      return [{ label: "Best matches", zones: filtered }];
    }

    const groups = new Map<string, ZoneMobSummary[]>();
    for (const summary of filtered) {
      const label = summary.expansion;
      groups.set(label, [...(groups.get(label) ?? []), summary]);
    }
    return Array.from(groups.entries())
      .sort(([labelA], [labelB]) => (expansionOrder.get(labelA) ?? 98) - (expansionOrder.get(labelB) ?? 98) || labelA.localeCompare(labelB))
      .map(([label, zones]) => ({ label, zones }));
  }, [activeSummaries, expansionFilter, normalizedQuery, normalizedRaceQuery, playerLevel, sortMode]);

  function updateLevelInput(value: string) {
    setLevelInput(value);
    if (normalizedRaceQuery) {
      setSortMode("race-match");
    } else if (/^\d+$/.test(value.trim())) {
      setSortMode("level-match");
    } else if (sortMode === "level-match" || sortMode === "race-match") {
      setSortMode("alphabetical");
    }
  }

  function updateRaceInput(value: string) {
    setRaceInput(value);
    if (normalizedRaceSearch(value)) {
      setSortMode("race-match");
    } else if (sortMode === "race-match") {
      setSortMode(playerLevel === null ? "alphabetical" : "level-match");
    }
  }

  function raceMatchBadge(summary: ZoneMobSummary) {
    if (!normalizedRaceQuery) return null;
    const total = countMatchingRaceMobs(summary, normalizedRaceQuery, playerLevel);
    if (total === 0) return null;
    const labels = matchingRaceLabels(summary, normalizedRaceQuery);
    const label = labels.length === 1 ? pluralRaceLabel(labels[0]) : "matching race mobs";
    if (playerLevel !== null && nearLevelRange) return `${total} ${label} level ${nearLevelRange}`;
    return `${total} ${label}`;
  }

  function zoneHref(summary: ZoneMobSummary) {
    const realSummary = summary as ZoneMobSummary & { routeSlug?: string; zoneShortName?: string };
    const routeSlug = dataSourceMode === "spawns" ? canonicalZoneRouteSlug(realSummary) : canonicalZoneRouteSlug(summary);
    return dataSourceMode === "spawns" ? `/zones/${routeSlug}?source=spawns` : `/zones/${routeSlug}`;
  }

  return (
    <section className="zones-explorer" aria-label="Zone explorer">
      <div className="zones-data-source-switch" aria-label="Zone data source">
        <div>
          <strong>Data Source</strong>
          <span>{sourceLabel}</span>
        </div>
        <div className="zones-data-source-buttons">
          <button
            aria-pressed={dataSourceMode === "snapshot"}
            className={dataSourceMode === "snapshot" ? "filter-button is-active" : "filter-button"}
            onClick={() => updateDataSourceMode("snapshot")}
            type="button"
          >
            Zone Snapshot
          </button>
          <button
            aria-pressed={dataSourceMode === "spawns"}
            className={dataSourceMode === "spawns" ? "filter-button is-active" : "filter-button"}
            onClick={() => updateDataSourceMode("spawns")}
            type="button"
          >
            Real Spawn Data
          </button>
        </div>
      </div>
      <div className="zones-search-row">
        <label className="zone-filter zones-search">
          <span>Search zones</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search zone name"
            type="search"
            value={query}
          />
        </label>
        <label className="zone-filter zones-level-filter">
          <span>My level</span>
          <input
            inputMode="numeric"
            min="1"
            onChange={(event) => updateLevelInput(event.target.value)}
            placeholder="e.g. 35"
            type="number"
            value={levelInput}
          />
        </label>
        <label className="zone-filter zones-race-filter">
          <span>Mob race</span>
          <input
            autoComplete="off"
            list="zone-race-suggestions"
            onChange={(event) => updateRaceInput(event.target.value)}
            placeholder="goblin, froglok, skeleton"
            type="search"
            value={raceInput}
          />
          <datalist id="zone-race-suggestions">
            {raceSuggestions.map((race) => <option key={race} value={race} />)}
          </datalist>
        </label>
        <label className="zone-filter zones-sort-filter">
          <span>Sort</span>
          <select onChange={(event) => setSortMode(event.target.value as ZoneSortMode)} value={sortMode}>
            <option value="alphabetical">Alphabetical</option>
            <option value="mob-count">Mob count</option>
            <option value="average-level">Average level</option>
            <option disabled={playerLevel === null} value="level-match">Most mobs near my level</option>
            <option disabled={!normalizedRaceQuery} value="race-match">Most matching race mobs</option>
          </select>
        </label>
        <span className="zones-result-count">
          {groupedZones.reduce((sum, group) => sum + group.zones.length, 0)} zones
        </span>
      </div>

      <div className="zones-expansion-filters" aria-label="Zone expansion filters">
        {expansionFilters.map((filter) => (
          <button
            aria-pressed={expansionFilter === filter}
            className={expansionFilter === filter ? "filter-button is-active" : "filter-button"}
            key={filter}
            onClick={() => setExpansionFilter(filter)}
            type="button"
          >
            {filter}
          </button>
        ))}
      </div>

      {groupedZones.length > 0 ? (
        <div className="zones-group-list">
          {groupedZones.map((group) => (
            <section className="zones-group" key={group.label}>
              <div className="zones-group-heading">
                <h2>{group.label}</h2>
                <span>{group.zones.length}</span>
              </div>
              <div className="zones-card-grid">
                {group.zones.map((summary) => (
                  <Link className="zones-card" href={zoneHref(summary)} key={`${summary.sourceFile}-${canonicalZoneRouteSlug(summary)}`}>
                    <div className="zones-card-heading">
                      <div>
                        <h3>{summary.zoneName}</h3>
                        <div className="zones-card-submeta">
                          <span>{summary.expansion}</span>
                          <ZoneDataStatusBadge summary={summary} />
                        </div>
                      </div>
                      {raceMatchBadge(summary) ? (
                        <strong className="zones-level-match-badge">
                          {raceMatchBadge(summary)}
                        </strong>
                      ) : playerLevel !== null && nearLevelRange ? (
                        <strong className="zones-level-match-badge">
                          {countMobsNearLevel(summary, playerLevel)} mobs level {nearLevelRange}
                        </strong>
                      ) : null}
                    </div>
                    <ZoneMobSnapshot summary={summary} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="empty">No zone summaries match that search.</p>
      )}
    </section>
  );
}
