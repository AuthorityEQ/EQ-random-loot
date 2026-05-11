"use client";

import type { Bucket } from "@/lib/search";
import type { ItemDetails } from "@/lib/search";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { itemHasFocusEffect } from "@/lib/item-effects";

type BucketCardProps = {
  bucket: Bucket;
  visibleLoot: string[];
  query?: string;
  showAllLoot?: boolean;
  /** When false, narrow the displayed loot to only items found in specific mob
   *  loot arrays (per-mob mode for TLP/non-random-loot servers). Defaults true. */
  sharedLoot?: boolean;
  getItemDetails: (itemName: string) => ItemDetails | undefined;
  getItemStatDisplay: (itemName: string) => string | null;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
  onSelectZone: (zone: string) => void;
};

function includesQuery(value: string, query: string) {
  return query.length > 0 && value.toLowerCase().includes(query);
}

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

export function BucketCard({ bucket, visibleLoot, query = "", showAllLoot = false, sharedLoot = true, getItemDetails, getItemStatDisplay, onSelectLoot, onSelectZone }: BucketCardProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const { previewProps } = useItemPreview();

  // When sharedLoot is off, narrow visibleLoot to only items that appear in at
  // least one mob's own loot array (per-mob mode for non-random-loot servers).
  const perMobItems: string[] = sharedLoot
    ? visibleLoot
    : (() => {
        const mobOwned = new Set(bucket.mobs.flatMap((m) => m.loot));
        return visibleLoot.filter((item) => mobOwned.has(item));
      })();
  const displayLoot = perMobItems;

  return (
    <article className={`bucket-card ${expansionTone(bucket.expansion)}`}>
      <div className="bucket-topline">
        <div>
          <p className="bucket-kicker">Bucket {bucket.bucket}</p>
          <h2>Levels {bucket.level_range}</h2>
        </div>
        <div className={`bucket-badge expansion-pill ${expansionTone(bucket.expansion)}`}>{bucket.expansion}</div>
      </div>

      <dl className="stats">
        <div>
          <dt>Mobs</dt>
          <dd>{bucket.mob_count ?? bucket.mobs.length}</dd>
        </div>
        <div>
          <dt>Loot</dt>
          <dd>{displayLoot.length}</dd>
        </div>
        <div>
          <dt>Zones</dt>
          <dd>{bucket.zone_count ?? bucket.zones.length}</dd>
        </div>
      </dl>

      <section className="zones" aria-label={`Bucket ${bucket.bucket} zones`}>
        {bucket.zones.map((zone) => (
          <button
            className={includesQuery(zone, normalizedQuery) ? "chip zone-chip is-match" : "chip zone-chip"}
            key={zone}
            onClick={() => onSelectZone(zone)}
            title={`Show zone view for ${zone}`}
            type="button"
          >
            {zone}
          </button>
        ))}
      </section>

      <div className="disclosure-list">
        <details>
          <summary>
            <span>Mob list</span>
            <span>{bucket.mobs.length}</span>
          </summary>
          <div className="mob-list">
            {bucket.mobs.map((mob) => (
              <div className="mob-row" key={`${mob.name}-${mob.level}-${mob.zone}`}>
                <strong className={includesQuery(mob.name, normalizedQuery) ? "is-text-match" : ""}>
                  {mob.name}
                </strong>
                <span>Level {mob.level}</span>
                <button
                  className={includesQuery(mob.zone, normalizedQuery) ? "zone-link is-text-match" : "zone-link"}
                  onClick={() => onSelectZone(mob.zone)}
                  title={`Show zone view for ${mob.zone}`}
                  type="button"
                >
                  {mob.zone}
                </button>
              </div>
            ))}
          </div>
        </details>

        <details key={String(showAllLoot)} open={showAllLoot}>
          <summary>
            <span>Loot pool</span>
            <span>{displayLoot.length} / {bucket.loot_pool.length}</span>
          </summary>
          <ul className="loot-list">
            {displayLoot.map((item) => (
              <li key={item}>
                {(() => {
                  const details = getItemDetails(item);
                  const statDisplay = getItemStatDisplay(item);
                  return (
                <button
                  className={includesQuery(item, normalizedQuery) ? "loot-button is-text-match" : "loot-button"}
                  onClick={() => onSelectLoot(item, bucket)}
                  title="Open item details"
                  type="button"
                  {...previewProps(item, details)}
                  >
                  <span className="loot-item-label">
                    <ItemIcon details={details} />
                    <span>{item}</span>
                  </span>
                  <span className="loot-item-actions">
                    {itemHasFocusEffect(details) ? <span className="loot-focus-badge">Focus</span> : null}
                    {statDisplay ? <span className="loot-stat-value">{statDisplay}</span> : null}
                    <FavoriteIndicator details={details} itemName={item} />
                  </span>
                </button>
                  );
                })()}
              </li>
            ))}
          </ul>
          {displayLoot.length === 0 ? (
            <p className="loot-empty">No loot items in this bucket match the active filters.</p>
          ) : null}
        </details>
      </div>
    </article>
  );
}
