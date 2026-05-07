"use client";

import { bestZonesForBucket } from "@/lib/buckets";
import type { Bucket } from "@/lib/search";

type ItemFarmViewProps = {
  itemName: string;
  buckets: Bucket[];
  onOpenItem: (itemName: string, bucket: Bucket) => void;
  onSelectZone: (zone: string) => void;
};

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

export function ItemFarmView({ itemName, buckets, onOpenItem, onSelectZone }: ItemFarmViewProps) {
  return (
    <section className="item-farm-view" aria-label={`Where to farm ${itemName}`}>
      <div className="item-farm-header">
        <div>
          <p className="eyebrow">Item search</p>
          <h2>{itemName}</h2>
          <p className="subhead">Where to farm this item</p>
        </div>
        <button className="clear-zone-button" onClick={() => onOpenItem(itemName, buckets[0])} type="button">
          Open item details
        </button>
      </div>

      <div className="item-farm-grid">
        {buckets.map((bucket) => {
          const zones = bestZonesForBucket(bucket, Number.POSITIVE_INFINITY);

          return (
            <article className={`item-farm-card is-highlighted ${expansionTone(bucket.expansion)}`} key={`${bucket.expansion}-${bucket.bucket}`}>
              <div>
                <p className="bucket-kicker">Highlighted bucket</p>
                <h3>Bucket {bucket.bucket}, levels {bucket.level_range}</h3>
                <p>
                  <span className={`expansion-pill is-compact ${expansionTone(bucket.expansion)}`}>{bucket.expansion}</span>
                  {" "}/ {bucket.mob_count ?? bucket.mobs.length} possible mobs in this bucket
                </p>
              </div>

              <div className="farming-panel is-highlighted">
                <h3>Best farming zones</h3>
                <p>Zones ranked by number of possible mobs in this bucket</p>
                <div className="farming-list">
                  {zones.map(({ zone, mobs }) => (
                    <div className="farming-zone is-highlighted" key={zone}>
                      <button className="zone-link farming-zone-name" onClick={() => onSelectZone(zone)} type="button">
                        {zone}
                      </button>
                      <span>{mobs.length} mobs in this bucket</span>
                      <ul>
                        {mobs.map((mob) => (
                          <li key={`${mob.name}-${mob.level}-${mob.zone}`}>
                            {mob.name}, level {mob.level}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
