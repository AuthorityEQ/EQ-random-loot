"use client";

import type { Bucket } from "@/lib/search";
import { countStatuses, type StatusCounts } from "@/lib/item-status";
import type { ItemDetails } from "@/lib/search";
import { FavoriteIndicator } from "@/components/FavoriteIndicator";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { StatusBadge } from "@/components/StatusBadge";

type BucketCardProps = {
  bucket: Bucket;
  visibleLoot: string[];
  query?: string;
  getItemDetails: (itemName: string) => ItemDetails | undefined;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
  onSelectZone: (zone: string) => void;
};

function includesQuery(value: string, query: string) {
  return query.length > 0 && value.toLowerCase().includes(query);
}

function HealthPill({ label, value, tone }: { label: string; value: number; tone: keyof StatusCounts }) {
  return (
    <span className={`health-pill health-${tone}`} title={`${label}: ${value}`}>
      <strong>{value}</strong> {label}
    </span>
  );
}

export function BucketCard({ bucket, visibleLoot, query = "", getItemDetails, onSelectLoot, onSelectZone }: BucketCardProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const health = countStatuses(bucket.loot_pool, getItemDetails);
  const { previewProps } = useItemPreview();

  return (
    <article className="bucket-card">
      <div className="bucket-topline">
        <div>
          <p className="bucket-kicker">Bucket {bucket.bucket}</p>
          <h2>Levels {bucket.level_range}</h2>
        </div>
        <div className="bucket-badge">{bucket.expansion}</div>
      </div>

      <dl className="stats">
        <div>
          <dt>Mobs</dt>
          <dd>{bucket.mob_count ?? bucket.mobs.length}</dd>
        </div>
        <div>
          <dt>Loot</dt>
          <dd>{bucket.loot_count ?? bucket.loot_pool.length}</dd>
        </div>
        <div>
          <dt>Zones</dt>
          <dd>{bucket.zone_count ?? bucket.zones.length}</dd>
        </div>
      </dl>

      <section className="bucket-health" aria-label={`Bucket ${bucket.bucket} item health`}>
        <HealthPill label="total" tone="total" value={health.total} />
        <HealthPill label="clean" tone="clean" value={health.clean} />
        <HealthPill label="review" tone="review" value={health.review} />
        <HealthPill label="missing" tone="missing" value={health.missing} />
        <HealthPill label="duplicate" tone="duplicate" value={health.duplicate} />
      </section>

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

        <details>
          <summary>
            <span>Loot pool</span>
            <span>{visibleLoot.length} / {bucket.loot_pool.length}</span>
          </summary>
          <ul className="loot-list">
            {visibleLoot.map((item) => (
              <li key={item}>
                {(() => {
                  const details = getItemDetails(item);
                  return (
                <button
                  className={includesQuery(item, normalizedQuery) ? "loot-button is-text-match" : "loot-button"}
                  onClick={() => onSelectLoot(item, bucket)}
                  title="Open item details"
                  type="button"
                  {...previewProps(item, details)}
                >
                  <span>{item}</span>
                  <FavoriteIndicator details={details} itemName={item} />
                  <StatusBadge details={details} />
                </button>
                  );
                })()}
              </li>
            ))}
          </ul>
          {visibleLoot.length === 0 ? (
            <p className="loot-empty">No loot items in this bucket match the active filters.</p>
          ) : null}
        </details>
      </div>
    </article>
  );
}
