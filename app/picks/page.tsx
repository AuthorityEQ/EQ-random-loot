"use client";

import { useMemo, useState } from "react";
import { pickExpansionNames, pickZones, type PickZone } from "@/data/pick-zones";

type SortKey = "zone" | "expansion" | "pickMin" | "pickMax";
type SortDirection = "asc" | "desc";

const expansionOptions = Object.entries(pickExpansionNames).map(([id, name]) => ({
  id: Number(id),
  name,
}));

function expansionTone(expansion: string) {
  const toneByExpansion: Record<string, string> = {
    Classic: "expansion-tone-classic",
    Kunark: "expansion-tone-kunark",
    Velious: "expansion-tone-velious",
    Luclin: "expansion-tone-luclin",
    "Planes of Power": "expansion-tone-pop",
    "Legacy of Ykesha": "expansion-tone-yks",
  };
  return toneByExpansion[expansion] ?? "expansion-tone-classic";
}

function expansionToneForZone(zone: PickZone) {
  const expansionName = pickExpansionNames[String(zone.expansionStart) as keyof typeof pickExpansionNames];
  return expansionTone(expansionName);
}

function formatPickMax(zone: PickZone) {
  return zone.pickMax === 0 && zone.pickMin > 0 ? "No max" : String(zone.pickMax);
}

function compareZones(a: PickZone, b: PickZone, sortKey: SortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (sortKey === "zone") {
    return multiplier * (a.zoneName.localeCompare(b.zoneName) || a.expansionStart - b.expansionStart);
  }

  if (sortKey === "pickMin") {
    return multiplier * (a.pickMin - b.pickMin || a.zoneName.localeCompare(b.zoneName));
  }

  if (sortKey === "pickMax") {
    const aMax = a.pickMax === 0 ? Number.POSITIVE_INFINITY : a.pickMax;
    const bMax = b.pickMax === 0 ? Number.POSITIVE_INFINITY : b.pickMax;
    return multiplier * (aMax - bMax || a.zoneName.localeCompare(b.zoneName));
  }

  return multiplier * (
    a.expansionStart - b.expansionStart
    || a.expansionEnd - b.expansionEnd
    || a.zoneName.localeCompare(b.zoneName)
  );
}

export default function PicksPage() {
  const [query, setQuery] = useState("");
  const [selectedExpansionIds, setSelectedExpansionIds] = useState<Set<number>>(
    () => new Set(expansionOptions.map((option) => option.id)),
  );
  const [sortKey, setSortKey] = useState<SortKey>("expansion");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const allExpansionsSelected = selectedExpansionIds.size === expansionOptions.length;
  const normalizedQuery = query.trim().toLowerCase();

  const visibleZones = useMemo(() => {
    return pickZones
      .filter((zone) => zone.zoneName.toLowerCase().includes(normalizedQuery))
      .filter((zone) => zone.expansionIds.some((expansionId) => selectedExpansionIds.has(expansionId)))
      .slice()
      .sort((a, b) => compareZones(a, b, sortKey, sortDirection));
  }, [normalizedQuery, selectedExpansionIds, sortDirection, sortKey]);

  function toggleExpansion(expansionId: number) {
    setSelectedExpansionIds((current) => {
      const next = new Set(current);
      if (next.has(expansionId)) {
        next.delete(expansionId);
      } else {
        next.add(expansionId);
      }
      return next.size > 0 ? next : current;
    });
  }

  function selectAllExpansions() {
    setSelectedExpansionIds(new Set(expansionOptions.map((option) => option.id)));
  }

  function clearFilters() {
    setQuery("");
    selectAllExpansions();
    setSortKey("expansion");
    setSortDirection("asc");
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ascending" : " descending";
  }

  return (
    <main className="page picks-page">
      <header className="header">
        <div>
          <p className="eyebrow">EverQuest / TLP</p>
          <h1>Picks</h1>
          <p className="subhead">This page shows pick thresholds for zones in early TLP expansions.</p>
        </div>
      </header>

      <section className="summary picks-summary" aria-label="Pick threshold summary">
        <div className="summary-item">
          <span className="summary-value">{pickZones.length}</span>
          <span className="summary-label">Pick-enabled zones</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{visibleZones.length}</span>
          <span className="summary-label">Visible zones</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">1-6</span>
          <span className="summary-label">Expansion range</span>
        </div>
      </section>

      <section className="toolbar picks-toolbar" aria-label="Pick filters">
        <label className="zone-filter picks-search">
          <span>Zone Search</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search zone name"
            type="search"
            value={query}
          />
        </label>

        <div className="expansion-filter" aria-label="Expansion filters">
          <span>Expansion</span>
          <div className="expansion-toggle-group">
            <button
              aria-pressed={allExpansionsSelected}
              className={allExpansionsSelected ? "filter-button is-active" : "filter-button"}
              onClick={selectAllExpansions}
              type="button"
            >
              All
            </button>
            {expansionOptions.map((expansion) => {
              const active = selectedExpansionIds.has(expansion.id);
              return (
                <button
                  aria-pressed={active}
                  className={[
                    "filter-button",
                    "expansion-filter-button",
                    expansionTone(expansion.name),
                    active ? "is-active" : null,
                  ].filter(Boolean).join(" ")}
                  key={expansion.id}
                  onClick={() => toggleExpansion(expansion.id)}
                  type="button"
                >
                  {expansion.name}
                </button>
              );
            })}
          </div>
        </div>

        <button className="filter-button picks-clear-button" onClick={clearFilters} type="button">
          Clear filters
        </button>
      </section>

      {visibleZones.length > 0 ? (
        <section className="picks-table-shell" aria-label="Pick threshold results">
          <table className="picks-table">
            <thead>
              <tr>
                <th>
                  <button onClick={() => changeSort("zone")} type="button">
                    Zone{sortLabel("zone")}
                  </button>
                </th>
                <th>
                  <button onClick={() => changeSort("expansion")} type="button">
                    Expansion{sortLabel("expansion")}
                  </button>
                </th>
                <th>
                  <button onClick={() => changeSort("pickMin")} type="button">
                    Pick Min{sortLabel("pickMin")}
                  </button>
                </th>
                <th>
                  <button onClick={() => changeSort("pickMax")} type="button">
                    Pick Max{sortLabel("pickMax")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleZones.map((zone) => (
                <tr key={zone.zoneId}>
                  <td>
                    <strong>{zone.zoneName}</strong>
                    <span>Zone ID {zone.zoneId}</span>
                  </td>
                  <td>
                    <span className={`expansion-pill is-compact ${expansionToneForZone(zone)}`}>
                      {zone.expansionName}
                    </span>
                  </td>
                  <td>{zone.pickMin}</td>
                  <td className={zone.pickMax === 0 ? "is-uncapped" : undefined}>{formatPickMax(zone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="empty">No pick zones match the active filters.</p>
      )}
    </main>
  );
}
