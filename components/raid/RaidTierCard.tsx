"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RaidBossCard, RaidBossDetails } from "@/components/raid/RaidBossCard";
import type { Bucket, ItemDetails } from "@/lib/search";
import type { RaidBoss } from "@/lib/raidTiers";
import type { RaidTier } from "@/lib/raidTiers";

type RaidTierCardProps = {
  tier: RaidTier;
  expansion: string;
  domId?: string;
  bossBucketMap: Map<string, Bucket>;
  bossOpenRequest: { domId: string; requestId: number } | null;
  getItemDetails: (name: string) => ItemDetails | undefined;
  onSelectLoot: (item: string, bucket: Bucket) => void;
};

export function RaidTierCard({
  tier,
  expansion,
  domId,
  bossBucketMap,
  bossOpenRequest,
  getItemDetails,
  onSelectLoot,
}: RaidTierCardProps) {
  const [openBossName, setOpenBossName] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobileRaidLayout();
  const bossesByRow = useMemo(() => chunkBosses(tier.bosses, isMobile ? 1 : 2), [isMobile, tier.bosses]);

  useEffect(() => {
    if (!bossOpenRequest) return;
    const requestedBoss = tier.bosses.find((boss) => getBossDomId(boss.name) === bossOpenRequest.domId);
    if (requestedBoss) {
      setOpenBossName(requestedBoss.name);
    }
  }, [bossOpenRequest, tier.bosses]);

  useEffect(() => {
    if (!bossOpenRequest || !openBossName) return;
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [bossOpenRequest, openBossName]);

  return (
    <section className="raid-tier-card" id={domId}>
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
        {bossesByRow.map((row, rowIndex) => {
          const expandedBoss = row.find((boss) => boss.name === openBossName);
          return (
            <div className="raid-boss-row" key={`${tier.tier}-row-${rowIndex}`}>
              <div className="raid-boss-row-cards">
                {row.map((boss) => {
                  const open = boss.name === openBossName;
                  return (
                    <RaidBossCard
                      boss={boss}
                      domId={getBossDomId(boss.name)}
                      key={`${tier.tier}-${boss.name}`}
                      onToggle={() => setOpenBossName((current) => current === boss.name ? null : boss.name)}
                      open={open}
                    />
                  );
                })}
              </div>
              {expandedBoss ? (
                <RaidBossDetails
                  boss={expandedBoss}
                  bossBucket={bossBucketMap.get(`${expansion}|${expandedBoss.name}`)}
                  detailsId={`${getBossDomId(expandedBoss.name)}-details`}
                  detailsRef={detailsRef}
                  getItemDetails={getItemDetails}
                  onSelectLoot={onSelectLoot}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getBossDomId(name: string) {
  return `raid-boss-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function chunkBosses(bosses: RaidBoss[], size: number) {
  const rows: RaidBoss[][] = [];
  for (let index = 0; index < bosses.length; index += size) {
    rows.push(bosses.slice(index, index + size));
  }
  return rows;
}

function useIsMobileRaidLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
