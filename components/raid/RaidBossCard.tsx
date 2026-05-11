"use client";

import type { Ref } from "react";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { useServer } from "@/components/ServerProvider";
import { isRandomLootServer } from "@/lib/server";
import type { Bucket, ItemDetails } from "@/lib/search";
import type { RaidBoss } from "@/lib/raidTiers";

type RaidBossCardProps = {
  boss: RaidBoss;
  domId?: string;
  open: boolean;
  onToggle: () => void;
};

type RaidBossDetailsProps = {
  boss: RaidBoss;
  bossBucket: Bucket | undefined;
  detailsId?: string;
  detailsRef?: Ref<HTMLDivElement>;
  getItemDetails: (name: string) => ItemDetails | undefined;
  onSelectLoot: (item: string, bucket: Bucket) => void;
};

export function RaidBossCard({ boss, domId, open, onToggle }: RaidBossCardProps) {
  const detailsId = domId ? `${domId}-details` : undefined;

  return (
    <article className={open ? "raid-boss-card is-open" : "raid-boss-card"} id={domId}>
      <button
        aria-controls={detailsId}
        aria-expanded={open}
        className="raid-boss-trigger"
        onClick={onToggle}
        type="button"
      >
        <span>
          <strong>{boss.name}</strong>
          <small>{boss.zone}</small>
        </span>
        <span>{boss.level > 0 ? `Level ${boss.level}` : "Zone"}</span>
      </button>
    </article>
  );
}

export function RaidBossDetails({
  boss,
  bossBucket,
  detailsId,
  detailsRef,
  getItemDetails,
  onSelectLoot,
}: RaidBossDetailsProps) {
  const { server } = useServer();
  const showLoot = isRandomLootServer(server) && (boss.loot_pool?.length ?? 0) > 0;
  const { previewProps } = useItemPreview();

  return (
    <div className="raid-boss-details" id={detailsId} ref={detailsRef}>
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
                  <FavoriteIndicator details={details} itemName={itemName} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
