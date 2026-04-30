"use client";

import { useState } from "react";
import { ZoneLootList } from "@/components/ZoneLootList";
import { bucketLevelRange } from "@/lib/buckets";
import type { Bucket, Mob } from "@/lib/search";
import type { ZoneBucketGroup } from "@/lib/zones";

// ---------------------------------------------------------------------------
// Types passed in from the server page
// ---------------------------------------------------------------------------

export type GroupMobEntry = {
  mob: Mob;
  bucket: Bucket;
};

export type RaidBossEntry = {
  name: string;
  level: number;
  expansion: string;
  zone: string;
  loot_pool: string[];
  /** Synthetic Bucket built server-side so ZoneLootList can use it. */
  bucket: Bucket;
};

type Props = {
  zoneName: string;
  /** Mobs from group-named data (may be empty on raid-only zones). */
  groupMobs: GroupMobEntry[];
  /** Bucket groups for the "loot pool" panel header count. */
  bucketGroups: ZoneBucketGroup[];
  /** Total aggregated loot pool items (for "Show all" header). */
  aggregatedLootCount: number;
  /** Raid bosses present in this zone (may be empty). */
  raidBosses: RaidBossEntry[];
  /** Whether this is the raid-only render path (no group named data). */
  raidOnly: boolean;
};

// ---------------------------------------------------------------------------
// Filter key helpers
// ---------------------------------------------------------------------------

function groupMobKey(entry: GroupMobEntry): string {
  return `g:${entry.bucket.expansion}:${entry.bucket.bucket}:${entry.mob.name}:${entry.mob.level}`;
}

function raidBossKey(boss: RaidBossEntry): string {
  return `r:${boss.expansion}:${boss.name}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ZoneMobFilter({
  zoneName,
  groupMobs,
  bucketGroups,
  aggregatedLootCount,
  raidBosses,
  raidOnly,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  function toggle(key: string) {
    setSelectedKey((prev) => (prev === key ? null : key));
  }

  // Derive filtered loot panel content based on selectedKey
  const selectedGroupMob = selectedKey?.startsWith("g:")
    ? groupMobs.find((e) => groupMobKey(e) === selectedKey) ?? null
    : null;

  const selectedRaidBoss = selectedKey?.startsWith("r:")
    ? raidBosses.find((b) => raidBossKey(b) === selectedKey) ?? null
    : null;

  // For display in the loot panel heading
  const selectedName =
    selectedGroupMob?.mob.name ?? selectedRaidBoss?.name ?? null;

  // Compute loot items to show
  const filteredBucketGroups: ZoneBucketGroup[] = selectedGroupMob
    ? bucketGroups.filter(
        (bg) =>
          bg.bucket.expansion === selectedGroupMob.bucket.expansion &&
          bg.bucket.bucket === selectedGroupMob.bucket.bucket,
      )
    : bucketGroups;

  const filteredGroupLootItems: string[] = selectedGroupMob
    ? selectedGroupMob.mob.loot
    : [];

  const filteredRaidBosses: RaidBossEntry[] = selectedRaidBoss
    ? [selectedRaidBoss]
    : raidBosses;

  // Total item count for header
  const shownLootCount = selectedGroupMob
    ? filteredGroupLootItems.length
    : selectedRaidBoss
      ? selectedRaidBoss.loot_pool.length
      : aggregatedLootCount;

  // ---------------------------------------------------------------------------
  // Raid-only zone render path
  // ---------------------------------------------------------------------------
  if (raidOnly) {
    return (
      <>
        {/* Raid boss mob list */}
        <section className="zone-panel zone-named-panel">
          <div className="zone-panel-heading">
            <h2>Raid bosses in {zoneName}</h2>
            <span>{raidBosses.length}</span>
          </div>
          {selectedKey && (
            <div className="zone-mob-filter-bar">
              <button
                className="zone-mob-filter-clear"
                type="button"
                onClick={() => setSelectedKey(null)}
              >
                Show all
              </button>
            </div>
          )}
          <div className="zone-mob-list">
            {raidBosses.map((boss) => {
              const key = raidBossKey(boss);
              const isActive = selectedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`zone-mob-item bucket-tone-0${isActive ? " is-active" : ""}`}
                  onClick={() => toggle(key)}
                  aria-pressed={isActive}
                >
                  <strong>{boss.name}</strong>
                  <span>
                    <b>Raid</b>
                    Level {boss.level}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Raid loot panel */}
        <section className="zone-panel">
          <div className="zone-panel-heading">
            <h2>
              {selectedName
                ? `${selectedName} loot`
                : `Loot pool in ${zoneName}`}
            </h2>
            <span>{shownLootCount} items</span>
          </div>
          <div className="zone-loot-groups">
            {filteredRaidBosses.map((boss, i) => {
              const toneClass = `zone-loot-group bucket-tone-${i % 6}`;
              return (
                <details
                  className={toneClass}
                  key={`${boss.expansion}-${boss.name}`}
                  open={selectedRaidBoss !== null}
                >
                  <summary className="zone-loot-summary">
                    <span>{boss.name}</span>
                    <strong>{boss.loot_pool.length} items</strong>
                  </summary>
                  <ZoneLootList bucket={boss.bucket} items={boss.loot_pool} />
                </details>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Group-named (+ optional mixed raid) render path
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Named mob list */}
      <section className="zone-panel zone-named-panel">
        <div className="zone-panel-heading">
          <h2>Mobs in {zoneName}</h2>
          <span>{groupMobs.length}</span>
        </div>
        {selectedKey && (
          <div className="zone-mob-filter-bar">
            <button
              className="zone-mob-filter-clear"
              type="button"
              onClick={() => setSelectedKey(null)}
            >
              Show all
            </button>
          </div>
        )}
        <div className="zone-mob-list">
          {groupMobs.map((entry) => {
            const key = groupMobKey(entry);
            const isActive = selectedKey === key;
            return (
              <button
                key={key}
                type="button"
                className={`zone-mob-item bucket-tone-${entry.bucket.bucket % 6}${isActive ? " is-active" : ""}`}
                onClick={() => toggle(key)}
                aria-pressed={isActive}
              >
                <strong>{entry.mob.name}</strong>
                <span>
                  <b>{bucketLevelRange(entry.bucket.bucket, entry.bucket.expansion)}</b>
                  Level {entry.mob.level}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Raid boss panel for mixed zones */}
      {raidBosses.length > 0 && (
        <section className="zone-panel zone-named-panel">
          <div className="zone-panel-heading">
            <h2>Raid bosses in {zoneName}</h2>
            <span>{raidBosses.length}</span>
          </div>
          <div className="zone-mob-list">
            {raidBosses.map((boss) => {
              const key = raidBossKey(boss);
              const isActive = selectedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`zone-mob-item bucket-tone-0${isActive ? " is-active" : ""}`}
                  onClick={() => toggle(key)}
                  aria-pressed={isActive}
                >
                  <strong>{boss.name}</strong>
                  <span>
                    <b>Raid</b>
                    Level {boss.level}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Group-named loot pool */}
      <section className="zone-panel">
        <div className="zone-panel-heading">
          <h2>
            {selectedName
              ? `${selectedName} loot`
              : `Loot pool in ${zoneName}`}
          </h2>
          <span>
            {selectedGroupMob
              ? filteredGroupLootItems.length
              : aggregatedLootCount}{" "}
            items
          </span>
        </div>
        <div className="zone-loot-groups">
          {selectedGroupMob ? (
            /* Single-mob view: show just this mob's loot inside its bucket tone */
            <details
              className={`zone-loot-group bucket-tone-${selectedGroupMob.bucket.bucket % 6}`}
              open
            >
              <summary className="zone-loot-summary">
                <span>{selectedGroupMob.mob.name}</span>
                <strong>{filteredGroupLootItems.length} items</strong>
              </summary>
              <ZoneLootList
                bucket={selectedGroupMob.bucket}
                items={filteredGroupLootItems}
              />
            </details>
          ) : (
            /* All-mobs view: one <details> per bucket group */
            filteredBucketGroups.map(({ bucket }) => {
              const bucketKey = `${bucket.expansion}-${bucket.bucket}`;
              const toneClass = `zone-loot-group bucket-tone-${bucket.bucket % 6}`;
              return (
                <details className={toneClass} key={bucketKey}>
                  <summary className="zone-loot-summary">
                    <span>Levels {bucket.level_range}</span>
                    <strong>{bucket.loot_pool.length} items</strong>
                  </summary>
                  <ZoneLootList bucket={bucket} items={bucket.loot_pool} />
                </details>
              );
            })
          )}
        </div>
      </section>

      {/* Raid loot panel for mixed zones */}
      {raidBosses.length > 0 && (
        <section className="zone-panel">
          <div className="zone-panel-heading">
            <h2>
              {selectedRaidBoss
                ? `${selectedRaidBoss.name} loot`
                : `Raid loot in ${zoneName}`}
            </h2>
            <span>
              {selectedRaidBoss
                ? selectedRaidBoss.loot_pool.length
                : Array.from(
                    new Set(raidBosses.flatMap((b) => b.loot_pool)),
                  ).length}{" "}
              items
            </span>
          </div>
          <div className="zone-loot-groups">
            {filteredRaidBosses.map((boss, i) => (
              <details
                className={`zone-loot-group bucket-tone-${i % 6}`}
                key={`raid-${boss.expansion}-${boss.name}`}
                open={selectedRaidBoss !== null}
              >
                <summary className="zone-loot-summary">
                  <span>{boss.name}</span>
                  <strong>{boss.loot_pool.length} items</strong>
                </summary>
                <ZoneLootList bucket={boss.bucket} items={boss.loot_pool} />
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
