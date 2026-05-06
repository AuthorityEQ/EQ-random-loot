"use client";

import { RaidBossCard } from "@/components/raid/RaidBossCard";
import type { Bucket, ItemDetails } from "@/lib/search";
import type { RaidTier } from "@/lib/raidTiers";

type RaidTierCardProps = {
  tier: RaidTier;
  expansion: string;
  bossBucketMap: Map<string, Bucket>;
  bossOpenRequest: { domId: string; requestId: number } | null;
  getItemDetails: (name: string) => ItemDetails | undefined;
  onSelectLoot: (item: string, bucket: Bucket) => void;
};

export function RaidTierCard({
  tier,
  expansion,
  bossBucketMap,
  bossOpenRequest,
  getItemDetails,
  onSelectLoot,
}: RaidTierCardProps) {
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
          <RaidBossCard
            boss={boss}
            bossBucket={bossBucketMap.get(`${expansion}|${boss.name}`)}
            domId={`raid-boss-${boss.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
            getItemDetails={getItemDetails}
            key={`${tier.tier}-${boss.name}`}
            openRequest={
              bossOpenRequest?.domId === `raid-boss-${boss.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`
                ? bossOpenRequest.requestId
                : undefined
            }
            onSelectLoot={onSelectLoot}
          />
        ))}
      </div>
    </section>
  );
}
