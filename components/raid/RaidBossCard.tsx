"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { useServer } from "@/components/ServerProvider";
import confidenceData from "@/data/loot-confidence.json";
import { DEFAULT_CONFIDENCE, type ConfidenceMetadata } from "@/lib/confidence";
import { isRandomLootServer } from "@/lib/server";
import type { Bucket, ItemDetails } from "@/lib/search";
import type { RaidBoss } from "@/lib/raidTiers";

type RaidBossCardProps = {
  boss: RaidBoss;
  bossBucket: Bucket | undefined;
  domId?: string;
  getItemDetails: (name: string) => ItemDetails | undefined;
  onSelectLoot: (item: string, bucket: Bucket) => void;
};

export function RaidBossCard({ boss, bossBucket, domId, getItemDetails, onSelectLoot }: RaidBossCardProps) {
  const [open, setOpen] = useState(false);
  const { server } = useServer();
  const showLoot = isRandomLootServer(server) && (boss.loot_pool?.length ?? 0) > 0;
  const { previewProps } = useItemPreview();

  return (
    <article className="raid-boss-card" id={domId}>
      <button
        aria-expanded={open}
        className="raid-boss-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>
          <strong>{boss.name}</strong>
          <small>{boss.zone}</small>
        </span>
        <span>{boss.level > 0 ? `Level ${boss.level}` : "Zone"}</span>
      </button>

      {open ? (
        <div className="raid-boss-details">
          <dl className="raid-meta">
            <div>
              <dt>Zone</dt>
              <dd>{boss.zone}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{boss.level > 0 ? boss.level : "N/A"}</dd>
            </div>
            {showLoot ? (
              <div>
                <dt>Loot pool</dt>
                <dd>{boss.loot_pool!.length} items</dd>
              </div>
            ) : null}
          </dl>
          {boss.notes ? <p className="raid-notes">{boss.notes}</p> : null}
          {showLoot && bossBucket ? (
            <ul className="raid-loot-pool" aria-label={`${boss.name} random loot pool`}>
              {boss.loot_pool!.map((itemName) => {
                const details = getItemDetails(itemName);
                const meta =
                  (confidenceData as unknown as Record<string, ConfidenceMetadata>)[itemName] ??
                  DEFAULT_CONFIDENCE;
                return (
                  <li key={itemName}>
                    <button
                      className="loot-button"
                      onClick={() => onSelectLoot(itemName, bossBucket)}
                      type="button"
                      {...previewProps(itemName, details)}
                    >
                      <span className="loot-item-label">
                        <ItemIcon details={details} />
                        <span>{itemName}</span>
                      </span>
                      {(meta.tier === "verified" || meta.tier === "high") && (
                        <ConfidenceBadge compact meta={meta} />
                      )}
                      <FavoriteIndicator details={details} itemName={itemName} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
