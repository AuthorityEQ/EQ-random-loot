import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/components/item-drawer.css";
import "./item-page.css";
import { ItemDetailBody } from "@/components/ItemDetailBody";
import { ItemPageBackButton } from "@/components/ItemPageBackButton";
import classicData from "@/data/classic-group-named.json";
import itemDetailsData from "@/data/item-details.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import { buildItemSlugMap, slugToItemName } from "@/lib/item-slug";
import { type Bucket, type ItemDetailsMap, type LootDataset } from "@/lib/search";

const datasets = [classicData, kunarkData, veliousData] as LootDataset[];
const allBuckets: Bucket[] = datasets.flatMap((d) => d.buckets);
const itemDetails = itemDetailsData as ItemDetailsMap;

// Build slug maps once at module load (static data — safe as module-level const).
const { slugToName, nameToSlug } = buildItemSlugMap(itemDetails);

/** All buckets that contain a given item name in their loot pool. */
function getBucketsForItem(itemName: string): Bucket[] {
  return allBuckets.filter((b) => b.loot_pool.includes(itemName));
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

  const iconUrl = details?.iconPath
    ? `https://frostreaver.com${details.iconPath}`
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
  const primaryBucket = buckets[0];
  const slot = details?.slot ?? null;

  return (
    <main className="page">
      <div className="item-page-content">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="item-page-breadcrumb">
            <li>
              <a href="/">Loot</a>
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
        <ItemPageBackButton />

        {/* Item body — reuses the same markup as ItemDrawer */}
        <ItemDetailBody
          allBuckets={buckets}
          bucket={primaryBucket}
          details={details}
          itemName={itemName}
        />

        {/* "Where to farm" section — visible even when allBuckets is empty */}
        {buckets.length === 0 ? (
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
