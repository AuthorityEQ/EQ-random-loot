"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import "@/components/bucket-card.css";
import { RaidTierCard } from "@/components/raid/RaidTierCard";
import { useServer } from "@/components/ServerProvider";
import classicRaidData from "@/data/classic-raid.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import { SharedPoolSection } from "@/components/SharedPoolSection";
import { useBucketDisplay } from "@/components/BucketDisplayProvider";
import { itemToSlug } from "@/lib/item-slug";
import { raidTotals, dedupeTierLoot, bossesDroppingItem, type RaidBoss, type RaidDataset, type RaidTier } from "@/lib/raidTiers";
import { SERVER_META, isRandomLootServer } from "@/lib/server";
import { type Bucket, type ItemDetailsMap } from "@/lib/search";
import { zoneToSlug } from "@/lib/zone-slug";

const datasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const expansionOptions = datasets.map((dataset) => dataset.expansion);
const itemDetailsMap = itemDetailsData as ItemDetailsMap;

function expansionTone(expansion: string) {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

function getRaidBossDomId(bossName: string) {
  return `raid-boss-${bossName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function getRaidTierDomId(expansion: string, tier: string | number) {
  return `raid-tier-${expansion.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${String(tier).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function getItemDetails(name: string) {
  return itemDetailsMap[name];
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function findRaidItemByQuery(value: string | null) {
  const query = normalizeText(value ?? "");
  if (!query) return null;
  for (const ds of datasets) {
    for (const tier of ds.tiers) {
      for (const boss of tier.bosses) {
        for (const item of boss.loot_pool ?? []) {
          if (itemToSlug(item) === query || normalizeText(item) === query) {
            return item;
          }
        }
      }
    }
  }
  return null;
}

let _bossIdCounter = 0;
function makeBossBucket(boss: RaidBoss, expansion: string, raidTierName?: string): Bucket {
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
    raidTierName,
    mob_count: 1,
    loot_count: boss.loot_pool?.length ?? 0,
    zone_count: 1,
  };
}

function formatRaidTierLevelRange(bosses: RaidBoss[]) {
  const levels = bosses.map((boss) => boss.level).filter((level) => level > 0);
  if (levels.length === 0) return "N/A";
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return min === max ? String(min) : `${min}-${max}`;
}

function makeRaidTierBucket(tier: RaidTier, expansion: string, bucketId: number): Bucket {
  const zones = Array.from(new Set(tier.bosses.map((boss) => boss.zone)));
  return {
    bucket: bucketId,
    expansion,
    level_range: formatRaidTierLevelRange(tier.bosses),
    loot_pool: dedupeTierLoot(tier),
    mob_count: tier.bosses.length,
    loot_count: dedupeTierLoot(tier).length,
    mobs: tier.bosses.map((boss) => ({
      expansion,
      level: boss.level,
      loot: boss.loot_pool ?? [],
      name: boss.name,
      source_bucket: tier.name ?? `Tier ${tier.tier}`,
      zone: boss.zone,
    })),
    raidTierName: tier.name ?? `Tier ${tier.tier}`,
    zone_count: zones.length,
    zones,
  };
}

function RaidsPageContent() {
  const [activeExpansion, setActiveExpansion] = useState(expansionOptions[0]);
  const dataset = datasets.find((candidate) => candidate.expansion === activeExpansion) ?? datasets[0];
  const totals = useMemo(() => raidTotals(dataset.tiers), [dataset]);
  const [searchQuery, setSearchQuery] = useState("");
  const [raidItemFilter, setRaidItemFilter] = useState<string | null>(null);
  const { bucketed } = useBucketDisplay();
  const { server } = useServer();
  const randomLoot = isRandomLootServer(server);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [drawerItem, setDrawerItem] = useState<{ item: string; bucket: Bucket } | null>(null);
  const [bossOpenRequest, setBossOpenRequest] = useState<{ domId: string; requestId: number } | null>(null);

  useEffect(() => {
    const requestedExpansion = searchParams.get("expansion");
    if (requestedExpansion && expansionOptions.includes(requestedExpansion)) {
      setActiveExpansion(requestedExpansion);
    }
    const requestedItem = findRaidItemByQuery(searchParams.get("item"));
    if (requestedItem) {
      setRaidItemFilter(requestedItem);
      setSearchQuery("");
      return;
    }
    const requestedSearch = searchParams.get("search")?.trim();
    if (requestedSearch) {
      const matchedItem = findRaidItemByQuery(requestedSearch);
      if (matchedItem) {
        setRaidItemFilter(matchedItem);
        setSearchQuery("");
      } else {
        setRaidItemFilter(null);
        setSearchQuery(requestedSearch);
      }
      return;
    }
    setRaidItemFilter(null);
    setSearchQuery("");
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTier = params.get("tier");
    if (!requestedTier) return;
    const domId = getRaidTierDomId(activeExpansion, requestedTier);
    requestAnimationFrame(() => {
      document.getElementById(domId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [activeExpansion]);

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
          map.set(`${ds.expansion}|${boss.name}`, makeBossBucket(boss, ds.expansion, tier.name ?? `Tier ${tier.tier}`));
        }
      }
    }
    return map;
  }, []);

  // Build item→Bucket[] map so multi-boss items show all farming locations in the drawer
  const itemToBuckets = useMemo(() => {
    const map = new Map<string, Bucket[]>();
    let tierBucketId = 0;
    for (const ds of datasets) {
      for (const tier of ds.tiers) {
        const tierItems = dedupeTierLoot(tier);
        if (tierItems.length === 0) continue;
        tierBucketId += 1;
        const bucket = makeRaidTierBucket(tier, ds.expansion, tierBucketId);
        for (const item of tierItems) {
          const existing = map.get(item);
          if (existing) {
            existing.push(bucket);
          } else {
            map.set(item, [bucket]);
          }
        }
      }
    }
    return map;
  }, []);

  const filteredRaidDatasets = useMemo(() => {
    if (!raidItemFilter) return [];
    return datasets
      .map((ds) => ({
        ...ds,
        tiers: ds.tiers
          .map((tier) => ({
            ...tier,
            bosses: tier.bosses.filter((boss) => (boss.loot_pool ?? []).includes(raidItemFilter)),
          }))
          .filter((tier) => tier.bosses.length > 0),
      }))
      .filter((ds) => ds.tiers.length > 0);
  }, [raidItemFilter]);

  const matchingRaidBossCount = useMemo(
    () =>
      filteredRaidDatasets.reduce(
        (sum, ds) => sum + ds.tiers.reduce((tierSum, tier) => tierSum + tier.bosses.length, 0),
        0,
      ),
    [filteredRaidDatasets],
  );

  const visibleRaidDatasets = raidItemFilter ? filteredRaidDatasets : [dataset];

  type RaidSearchResult =
    | { type: "item"; itemName: string; bossName: string; tierName: string }
    | { type: "boss"; bossName: string; tierName: string; level: number; zone: string };

  const raidSearchResults = useMemo<RaidSearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: RaidSearchResult[] = [];
    for (const tier of dataset.tiers) {
      const tierName = tier.name ?? `Tier ${tier.tier}`;
      for (const boss of tier.bosses) {
        if (boss.name.toLowerCase().includes(q)) {
          out.push({ type: "boss", bossName: boss.name, tierName, level: boss.level, zone: boss.zone });
        }
        for (const item of boss.loot_pool ?? []) {
          if (item.toLowerCase().includes(q)) {
            out.push({ type: "item", itemName: item, bossName: boss.name, tierName });
          }
        }
      }
    }
    return out.slice(0, 30);
  }, [searchQuery, dataset]);

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
        <div className="expansion-filter" aria-label="Expansion filter">
          <span>Expansion</span>
          <div className="expansion-toggle-group">
            {expansionOptions.map((expansion) => {
              const active = activeExpansion === expansion;
              return (
                <button
                  aria-pressed={active}
                  className={`filter-button expansion-filter-button ${expansionTone(expansion)}${active ? " is-active" : ""}`}
                  key={expansion}
                  onClick={() => setActiveExpansion(expansion)}
                  type="button"
                >
                {expansion}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="raid-search-box">
        <input
          type="search"
          placeholder="Search raid items or bosses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="raid-search-input"
          aria-label="Search raid items or bosses"
        />
        {raidItemFilter ? (
          <div className="raid-item-filter-banner">
            <div>
              <strong>{raidItemFilter}</strong>
              <span>
                {matchingRaidBossCount > 0
                  ? ` drops from ${matchingRaidBossCount} tracked raid ${matchingRaidBossCount === 1 ? "boss" : "bosses"}.`
                  : " was not found in tracked raid loot pools."}
              </span>
            </div>
            <button
              className="filter-button"
              onClick={() => {
                setRaidItemFilter(null);
                router.push("/raids", { scroll: false });
              }}
              type="button"
            >
              Clear item filter
            </button>
          </div>
        ) : null}
        {raidSearchResults.length > 0 && (
          <ul className="raid-search-results" role="listbox" aria-label="Search results">
            {raidSearchResults.map((r, i) =>
              r.type === "item" ? (
                <li key={i} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="raid-search-result"
                    onClick={() => {
                      const bossBucket =
                        bossBucketMap.get(`${dataset.expansion}|${r.bossName}`) ??
                        makeBossBucket(
                          dataset.tiers.flatMap((t) => t.bosses).find((b) => b.name === r.bossName)!,
                          dataset.expansion,
                          r.tierName,
                        );
                      handleSelectLoot(r.itemName, bossBucket);
                      setSearchQuery("");
                    }}
                  >
                    <span className="raid-search-type">Item</span>
                    <span className="raid-search-name">{r.itemName}</span>
                    <span className="raid-search-meta">{r.bossName} · {r.tierName}</span>
                  </button>
                </li>
              ) : (
                <li key={i} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="raid-search-result"
                    onClick={() => {
                      const domId = getRaidBossDomId(r.bossName);
                      setBossOpenRequest({ domId, requestId: Date.now() });
                      requestAnimationFrame(() => {
                        const el = document.getElementById(domId);
                        el?.scrollIntoView({ behavior: "smooth", block: "start" });
                        el?.classList.add("is-highlighted");
                        setTimeout(() => el?.classList.remove("is-highlighted"), 1800);
                      });
                    }}
                  >
                    <span className="raid-search-type">Boss</span>
                    <span className="raid-search-name">{r.bossName}</span>
                    <span className="raid-search-meta">Level {r.level} · {r.zone}</span>
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <div className="raid-tier-list">
        {raidItemFilter && matchingRaidBossCount === 0 ? (
          <section className="raid-empty-state">
            <strong>No tracked raid bosses found for this item.</strong>
            <p>Try the normal raid search if the item has a variant spelling.</p>
          </section>
        ) : bucketed ? (
          visibleRaidDatasets.flatMap((visibleDataset) =>
            visibleDataset.tiers.map((tier) => (
              <RaidTierCard
                bossBucketMap={bossBucketMap}
                domId={getRaidTierDomId(visibleDataset.expansion, tier.tier)}
                expansion={visibleDataset.expansion}
                getItemDetails={getItemDetails}
                highlightItemName={raidItemFilter}
                key={`${visibleDataset.expansion}-${tier.tier}`}
                onSelectLoot={handleSelectLoot}
                tier={tier}
                bossOpenRequest={bossOpenRequest}
              />
            )),
          )
        ) : (
          visibleRaidDatasets.flatMap((visibleDataset) =>
            visibleDataset.tiers.map((tier) => (
              <SharedPoolSection
                key={`${visibleDataset.expansion}-${tier.tier}`}
                title={tier.name ?? `Tier ${tier.tier}`}
                kicker={`${visibleDataset.expansion} Raid Tier`}
                summary={`${tier.bosses.length} bosses / ${dedupeTierLoot(tier).length} unique items`}
                items={raidItemFilter ? [raidItemFilter] : dedupeTierLoot(tier)}
                getItemDetails={getItemDetails}
                getDroppedBy={(itemName) => bossesDroppingItem(tier, itemName).map((b) => b.name)}
                getBucketForItem={(itemName) => {
                  const bosses = bossesDroppingItem(tier, itemName);
                  return (
                    bossBucketMap.get(`${visibleDataset.expansion}|${bosses[0]?.name}`) ??
                    makeBossBucket(bosses[0], visibleDataset.expansion, tier.name ?? `Tier ${tier.tier}`)
                  );
                }}
                onSelectLoot={handleSelectLoot}
              />
            )),
          )
        )}
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

export default function RaidsPage() {
  return (
    <Suspense fallback={<main className="page" />}>
      <RaidsPageContent />
    </Suspense>
  );
}
