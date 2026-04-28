"use client";

import { useMemo, useState } from "react";
import { RaidTierCard } from "@/components/raid/RaidTierCard";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import { raidTotals, type RaidDataset } from "@/lib/raidTiers";

const datasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const expansionOptions = datasets.map((dataset) => dataset.expansion);

export default function RaidsPage() {
  const [activeExpansion, setActiveExpansion] = useState(expansionOptions[0]);
  const dataset = datasets.find((candidate) => candidate.expansion === activeExpansion) ?? datasets[0];
  const totals = useMemo(() => raidTotals(dataset.tiers), [dataset]);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">{dataset.expansion} / Raid Bosses</p>
          <h1>{dataset.expansion} Raid Bosses</h1>
          <p className="subhead">
            Informational raid-tier reference. Raid tiers are separate from group named buckets and
            do not include loot in this view.
          </p>
        </div>

        <div className="summary" aria-label="Raid dataset summary">
          <div className="summary-item">
            <span className="summary-value">{dataset.tiers.length}</span>
            <span className="summary-label">Tiers</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{totals.bosses}</span>
            <span className="summary-label">Boss groups</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{totals.zones}</span>
            <span className="summary-label">Zones</span>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <label className="expansion-filter">
          <span>Expansion</span>
          <select
            onChange={(event) => setActiveExpansion(event.target.value)}
            value={activeExpansion}
          >
            {expansionOptions.map((expansion) => (
              <option key={expansion} value={expansion}>
                {expansion}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="raid-tier-list">
        {dataset.tiers.map((tier) => (
          <RaidTierCard key={tier.tier} tier={tier} />
        ))}
      </div>
    </main>
  );
}
