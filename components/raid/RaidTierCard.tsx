"use client";

import { RaidBossCard } from "@/components/raid/RaidBossCard";
import type { RaidTier } from "@/lib/raidTiers";

type RaidTierCardProps = {
  tier: RaidTier;
};

export function RaidTierCard({ tier }: RaidTierCardProps) {
  return (
    <section className="raid-tier-card">
      <div className="raid-tier-header">
        <div>
          <p className="eyebrow">{typeof tier.tier === "number" ? `Tier ${tier.tier}` : tier.tier}</p>
          <h2>{tier.name}</h2>
        </div>
        <dl className="raid-tier-summary">
          <div>
            <dt>Bosses</dt>
            <dd>{tier.bosses.length}</dd>
          </div>
        </dl>
      </div>

      <div className="raid-boss-grid">
        {tier.bosses.map((boss) => (
          <RaidBossCard boss={boss} key={`${tier.tier}-${boss.name}`} />
        ))}
      </div>
    </section>
  );
}
