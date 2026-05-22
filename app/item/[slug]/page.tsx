import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/components/item-drawer.css";
import "./item-page.css";
import { ItemDetailBody } from "@/components/ItemDetailBody";
import { ItemPageBackButton } from "@/components/ItemPageBackButton";
import classicData from "@/data/classic-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkData from "@/data/kunark-group-named.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousData from "@/data/velious-group-named.json";
import veliousRaidData from "@/data/velious-raid.json";
import { buildItemSlugMap, slugToItemName } from "@/lib/item-slug";
import { dedupeTierLoot, type RaidBoss, type RaidDataset, type RaidTier } from "@/lib/raidTiers";
import { type Bucket, type ItemDetailsMap, type LootDataset } from "@/lib/search";

const datasets = [classicData, kunarkData, veliousData] as LootDataset[];
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const allBuckets: Bucket[] = datasets.flatMap((d) => d.buckets);
const itemDetails = itemDetailsData as ItemDetailsMap;

// Build slug maps once at module load (static data — safe as module-level const).
const { slugToName, nameToSlug } = buildItemSlugMap(itemDetails);

/** All buckets that contain a given item name in their loot pool. */
function getBucketsForItem(itemName: string): Bucket[] {
  return allBuckets.filter((b) => b.loot_pool.includes(itemName));
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

function getRaidBucketsForItem(itemName: string): Bucket[] {
  let bucketId = 0;
  const buckets: Bucket[] = [];
  for (const dataset of raidDatasets) {
    for (const tier of dataset.tiers) {
      if (!dedupeTierLoot(tier).includes(itemName)) continue;
      bucketId += 1;
      buckets.push(makeRaidTierBucket(tier, dataset.expansion, bucketId));
    }
  }
  return buckets;
}

// ── Static generation ────────────────────────────────────────────────────────

export function generateStaticParams(): { slug: string }[] {
  return Array.from(slugToName.keys()).map((slug) => ({ slug }));
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const itemName = slugToItemName(slug, itemDetails);

  if (!itemName) {
    return { title: "Item not found" };
  }

  const details = itemDetails[itemName];
  const slot = details?.slot ?? null;
  const expansion = details?.expansion ?? null;
  const description = [
    `${itemName} loot details`,
    slot ? `Slot: ${slot}` : null,
    expansion ? `${expansion} EverQuest Frostreaver` : null,
    "Drop locations and farming zones.",
  ]
    .filter(Boolean)
    .join(". ");

  const itemIconUrl = details?.iconPath ?? details?.icon ?? details?.icon_url;
  const iconUrl = itemIconUrl
    ? itemIconUrl.startsWith("http")
      ? itemIconUrl
      : `https://frostreaver.com${itemIconUrl}`
    : undefined;

  return {
    title: `${itemName} — Frostreaver Loot`,
    description,
    openGraph: {
      title: `${itemName} — Frostreaver Loot`,
      description,
      images: iconUrl ? [{ url: iconUrl, width: 40, height: 40, alt: itemName }] : [],
      type: "website",
    },
    alternates: {
      canonical: `/item/${nameToSlug.get(itemName) ?? slug}`,
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const itemName = slugToItemName(slug, itemDetails);

  if (!itemName) {
    notFound();
  }

  const details = itemDetails[itemName];
  const buckets = getBucketsForItem(itemName);
  const raidBuckets = getRaidBucketsForItem(itemName);
  const displayBuckets = raidBuckets.length > 0 ? raidBuckets : buckets;
  const primaryBucket = displayBuckets[0];
  const isRaidItem = raidBuckets.length > 0;
  const slot = details?.slot ?? null;

  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <div className="item-page-content">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="item-page-breadcrumb">
            <li>
              {isRaidItem ? (
                <a href={`/raids?item=${encodeURIComponent(nameToSlug.get(itemName) ?? slug)}`}>
                  Raids
                </a>
              ) : (
                <a href="/loot">Loot</a>
              )}
            </li>
            {slot ? (
              <li>
                <span>{slot}</span>
              </li>
            ) : null}
            <li>
              <span className="breadcrumb-current">{itemName}</span>
            </li>
          </ol>
        </nav>

        {/* Sticky back button — client island */}
        {isRaidItem ? null : <ItemPageBackButton />}

        {/* Item body — reuses the same markup as ItemDrawer */}
        <ItemDetailBody
          allBuckets={displayBuckets}
          bucket={primaryBucket}
          contentType={isRaidItem ? "Raid Boss" : undefined}
          details={details}
          itemName={itemName}
          showOpenPageAction={false}
        />

        {/* "Where to farm" section — visible even when allBuckets is empty */}
        {displayBuckets.length === 0 ? (
          <section className="farming-panel" style={{ marginTop: "20px" }}>
            <h3>Where to farm</h3>
            <p className="no-details">
              This item does not appear in any tracked loot pool.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
