"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { RaidTierCard } from "@/components/raid/RaidTierCard";
import { useServer } from "@/components/ServerProvider";
import classicRaidData from "@/data/classic-raid.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import { SharedPoolSection } from "@/components/SharedPoolSection";
import { useBucketDisplay } from "@/components/BucketDisplayProvider";
import { itemToSlug } from "@/lib/item-slug";
import { raidTotals, dedupeTierLoot, bossesDroppingItem, type RaidBoss, type RaidDataset } from "@/lib/raidTiers";
import { SERVER_META, isRandomLootServer } from "@/lib/server";
import { type Bucket, type ItemDetailsMap } from "@/lib/search";
import { zoneToSlug } from "@/lib/zone-slug";

const datasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const expansionOptions = datasets.map((dataset) => dataset.expansion);
const itemDetailsMap = itemDetailsData as ItemDetailsMap;

function getItemDetails(name: string) {
  return itemDetailsMap[name];
}

let _bossIdCounter = 0;
function makeBossBucket(boss: RaidBoss, expansion: string): Bucket {
  _bossIdCounter += 1;
  return {
    bucket: _bossIdCounter,
    level_range: String(boss.level),
    expansion,
    mobs: [
      {
        name: boss.name,
        level: boss.level,
        zone: boss.zone,
        expansion,
        source_bucket: boss.name,
        loot: boss.loot_pool ?? [],
      },
    ],
    zones: [boss.zone],
    loot_pool: boss.loot_pool ?? [],
    mob_count: 1,
    loot_count: boss.loot_pool?.length ?? 0,
    zone_count: 1,
  };
}

export default function RaidsPage() {
  const [activeExpansion, setActiveExpansion] = useState(expansionOptions[0]);
  const dataset = datasets.find((candidate) => candidate.expansion === activeExpansion) ?? datasets[0];
  const totals = useMemo(() => raidTotals(dataset.tiers), [dataset]);
  const { bucketed } = useBucketDisplay();
  const { server } = useServer();
  const randomLoot = isRandomLootServer(server);
  const router = useRouter();

  const [drawerItem, setDrawerItem] = useState<{ item: string; bucket: Bucket } | null>(null);

  // Cmd/Ctrl+click tracking — modifier held during mousedown opens item page instead of drawer
  const modifierHeldRef = useRef(false);
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      modifierHeldRef.current = event.metaKey || event.ctrlKey;
    }
    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => document.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, []);

  // Pre-build a stable boss→Bucket map, keyed by "expansion|bossName"
  const bossBucketMap = useMemo(() => {
    _bossIdCounter = 0;
    const map = new Map<string, Bucket>();
    for (const ds of datasets) {
      for (const tier of ds.tiers) {
        for (const boss of tier.bosses) {
          map.set(`${ds.expansion}|${boss.name}`, makeBossBucket(boss, ds.expansion));
        }
      }
    }
    return map;
  }, []);

  // Build item→Bucket[] map so multi-boss items show all farming locations in the drawer
  const itemToBuckets = useMemo(() => {
    const map = new Map<string, Bucket[]>();
    for (const ds of datasets) {
      for (const tier of ds.tiers) {
        for (const boss of tier.bosses) {
          const bucket = bossBucketMap.get(`${ds.expansion}|${boss.name}`);
          if (!bucket) continue;
          for (const item of boss.loot_pool ?? []) {
            const existing = map.get(item);
            if (existing) {
              existing.push(bucket);
            } else {
              map.set(item, [bucket]);
            }
          }
        }
      }
    }
    return map;
  }, [bossBucketMap]);

  function handleSelectLoot(item: string, bucket: Bucket) {
    if (modifierHeldRef.current) {
      window.open(`/item/${itemToSlug(item)}`, "_blank", "noopener");
      modifierHeldRef.current = false;
      return;
    }
    setDrawerItem({ item, bucket });
  }

  function handleCloseDrawer() {
    setDrawerItem(null);
  }

  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="header">
        <div>
          <p className="eyebrow">{dataset.expansion} / Raid Bosses</p>
          <h1>{dataset.expansion} Raid Bosses</h1>
          <p className="subhead">
            {randomLoot
              ? `Expand a boss to see the ${SERVER_META[server].name} random-loot pool. Items open the item drawer.`
              : "Informational raid-tier reference. Loot is not shown for this server."}
          </p>
        </div>

        <div className="summary" aria-label="Raid dataset summary">
          <div className="summary-item">
            <span className="summary-value">{dataset.tiers.length}</span>
            <span className="summary-label">Tiers</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{totals.bosses}</span>
            <span className="summary-label">Boss groups</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{totals.zones}</span>
            <span className="summary-label">Zones</span>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <label className="expansion-filter">
          <span>Expansion</span>
          <select
            onChange={(event) => setActiveExpansion(event.target.value)}
            value={activeExpansion}
          >
            {expansionOptions.map((expansion) => (
              <option key={expansion} value={expansion}>
                {expansion}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="raid-tier-list">
        {bucketed
          ? dataset.tiers.map((tier) => (
              <RaidTierCard
                bossBucketMap={bossBucketMap}
                expansion={dataset.expansion}
                getItemDetails={getItemDetails}
                key={tier.tier}
                onSelectLoot={handleSelectLoot}
                tier={tier}
              />
            ))
          : dataset.tiers.map((tier) => (
              <SharedPoolSection
                key={tier.tier}
                title={tier.name ?? `Tier ${tier.tier}`}
                kicker={`${dataset.expansion} Raid Tier`}
                summary={`${tier.bosses.length} bosses · ${dedupeTierLoot(tier).length} unique items`}
                items={dedupeTierLoot(tier)}
                getItemDetails={getItemDetails}
                getDroppedBy={(itemName) => bossesDroppingItem(tier, itemName).map((b) => b.name)}
                getBucketForItem={(itemName) => {
                  const bosses = bossesDroppingItem(tier, itemName);
                  return (
                    bossBucketMap.get(`${dataset.expansion}|${bosses[0]?.name}`) ??
                    makeBossBucket(bosses[0], dataset.expansion)
                  );
                }}
                onSelectLoot={handleSelectLoot}
              />
            ))}
      </div>

      {drawerItem !== null ? (
        <ItemDrawer
          bucket={drawerItem.bucket}
          contentType="Raid Boss"
          details={getItemDetails(drawerItem.item)}
          expansion={drawerItem.bucket.expansion}
          itemBuckets={itemToBuckets.get(drawerItem.item) ?? []}
          itemName={drawerItem.item}
          onClose={handleCloseDrawer}
          onSelectZone={(zone) => {
            setDrawerItem(null);
            router.push(`/zone/${zoneToSlug(zone)}`);
          }}
        />
      ) : null}
    </main>
  );
}
