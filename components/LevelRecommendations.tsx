"use client";

import { useMemo } from "react";
import { isRecommendedBucketForLevel } from "@/lib/buckets";
import type { Bucket, Mob } from "@/lib/search";

type LevelRecommendationsProps = {
  buckets: Bucket[];
  level: number;
  onSelectZone: (zone: string) => void;
};

export function LevelRecommendations({ buckets, level, onSelectZone }: LevelRecommendationsProps) {
  const recommendedZones = useMemo(() => {
    const recommendedBuckets = buckets.filter((bucket) => isRecommendedBucketForLevel(bucket, level));

    return Array.from(
      recommendedBuckets
        .flatMap((bucket) => bucket.mobs.map((mob) => ({ mob, bucket })))
        .reduce((zones, entry) => {
          const current = zones.get(entry.mob.zone) ?? {
            zone: entry.mob.zone,
            mobs: [] as Mob[],
            expansions: new Set<string>(),
            ranges: new Set<string>(),
          };
          current.mobs.push(entry.mob);
          current.expansions.add(entry.bucket.expansion);
          current.ranges.add(entry.bucket.level_range);
          zones.set(entry.mob.zone, current);
          return zones;
        }, new Map<string, { zone: string; mobs: Mob[]; expansions: Set<string>; ranges: Set<string> }>())
        .values(),
    ).sort(
      (a, b) =>
        b.mobs.length - a.mobs.length
        || b.ranges.size - a.ranges.size
        || a.zone.localeCompare(b.zone),
    );
  }, [buckets, level]);

  if (recommendedZones.length === 0) {
    return null;
  }

  return (
    <section className="level-recommendations" aria-label={`Best zones for level ${level}`}>
      <div className="level-recommendations-header">
        <div>
          <p className="eyebrow">Level guide</p>
          <h2>Best Zones for Your Level ({level})</h2>
        </div>
      </div>

      <div className="recommendation-card-grid">
        {recommendedZones.map(({ zone, mobs, expansions, ranges }, index) => {
          const expansionList = Array.from(expansions).sort((a, b) => a.localeCompare(b));
          const rangeList = Array.from(ranges).sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));

          return (
            <button
              className={index < 3 ? "recommendation-card is-top" : "recommendation-card"}
              key={zone}
              onClick={() => onSelectZone(zone)}
              type="button"
            >
              <span className="recommendation-rank">#{index + 1}</span>
              <span className="recommendation-main">
                <strong>{zone}</strong>
                <span>
                  {expansionList.join(", ")} <b>{mobs.length} named</b>
                </span>
              </span>
              <span className="recommendation-ranges">{rangeList.join(", ")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
