import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import type { LootDataset } from "@/lib/search";
import type { RaidDataset } from "@/lib/raidTiers";
import { buildMobIndex, mobToSlug } from "@/lib/mob-slug";
import { Breadcrumb } from "./Breadcrumb";
import "./mob-page.css";

// ── Static data loaded once at module scope ──────────────────────────────────

const groupDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const raidDatasets = [classicRaidData, kunarkRaidData, veliousRaidData] as RaidDataset[];
const allGroupBuckets = groupDatasets.flatMap((d) => d.buckets);

// Build the index once; it's cheap (~1k mobs) and the module is server-only.
const mobIndex = buildMobIndex(allGroupBuckets, raidDatasets);

// ── generateStaticParams ──────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ name: string }[]> {
  return Array.from(mobIndex.keys()).map((slug) => ({ name: slug }));
}

// ── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const record = mobIndex.get(name);

  if (!record) {
    return {
      title: "Mob Not Found — Frostreaver Loot Buckets",
    };
  }

  const contentLabel = record.bucketNumber !== undefined
    ? `Bucket ${record.bucketNumber} (${record.bucketLevelRange})`
    : record.raidTierName ?? "Raid Boss";

  const description = `${record.name} is a level ${record.level} named in ${record.zone} (${record.expansion}). `
    + `${contentLabel} — ${record.lootPool.length} items in the loot pool.`;

  return {
    title: `${record.name} — ${record.expansion} ${record.zone} | Frostreaver Loot Buckets`,
    description,
    openGraph: {
      title: `${record.name} (Level ${record.level}) — ${record.zone}`,
      description,
      type: "website",
    },
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function MobPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const record = mobIndex.get(name);

  if (!record) {
    notFound();
  }

  const isGroupNamed = record.bucketNumber !== undefined;

  // Resolve zone slug for the cross-link (Feature C may not exist yet — link anyway)
  const zoneSlug = mobToSlug(record.zone);

  // For group-named mobs: resolve sibling slugs against the full index.
  // The sibling objects were stored with base slugs; we need the final slug
  // from the index (which may have a zone suffix after collision resolution).
  const resolvedSiblings = record.bucketSiblings.map((sibling) => {
    // Try direct lookup by base slug first, then scan for a slug that starts with the base.
    const baseSlug = mobToSlug(sibling.name);
    const exactRecord = mobIndex.get(baseSlug);
    if (exactRecord) {
      return { name: sibling.name, slug: baseSlug };
    }
    // Find any entry whose name matches (handles zone-suffixed slugs)
    for (const [slug, entry] of mobIndex) {
      if (entry.name === sibling.name) {
        return { name: sibling.name, slug };
      }
    }
    return { name: sibling.name, slug: baseSlug };
  });

  function expansionToneClass(expansion: string) {
    return `expansion-tone-${expansion.toLowerCase()}`;
  }

  return (
    <main className="page">
      <Breadcrumb
        contentType={isGroupNamed ? "Group Named" : "Raid Boss"}
        bucketNumber={record.bucketNumber}
        bucketLevelRange={record.bucketLevelRange}
        raidTierName={record.raidTierName}
        mobName={record.name}
      />

      {/* Hero */}
      <section className={`mob-hero ${expansionToneClass(record.expansion)}`}>
        <div className="mob-hero-topline">
          <div>
            <p className="mob-hero-kicker">
              {isGroupNamed
                ? `Bucket ${record.bucketNumber} · ${record.expansion}`
                : `Raid Boss · ${record.expansion}`}
            </p>
            <h1>{record.name}</h1>
            <div className="mob-hero-stats">
              <strong>Level {record.level}</strong>
              <span className="mob-hero-stat-sep">·</span>
              <span>
                Zone:{" "}
                <Link
                  href={`/zone/${zoneSlug}`}
                  className="mob-zone-link"
                >
                  {record.zone}
                </Link>
              </span>
              {record.bucketLevelRange ? (
                <>
                  <span className="mob-hero-stat-sep">·</span>
                  <span>Levels {record.bucketLevelRange}</span>
                </>
              ) : null}
            </div>
          </div>
          <span className={`expansion-pill ${expansionToneClass(record.expansion)}`}>
            {record.expansion}
          </span>
        </div>

        {/* Bucket / tier strip */}
        <div className="mob-bucket-strip">
          {isGroupNamed ? (
            <>
              <span className="mob-bucket-strip-label">Bucket</span>
              <span className="mob-bucket-strip-value">{record.bucketNumber}</span>
              <span className="mob-bucket-strip-label">Level range</span>
              <span className="mob-bucket-strip-value">{record.bucketLevelRange}</span>
              <span className="mob-bucket-strip-label">Loot pool</span>
              <span className="mob-bucket-strip-value">{record.lootPool.length} items</span>
            </>
          ) : (
            <>
              <span className="mob-bucket-strip-label">Tier</span>
              <span className="mob-bucket-strip-value">{record.raidTierName ?? "Raid"}</span>
              <span className="mob-bucket-strip-label">Loot pool</span>
              <span className="mob-bucket-strip-value">{record.lootPool.length} items</span>
            </>
          )}
        </div>
      </section>

      <div className="mob-page-grid">
        {/* Loot pool */}
        <section className="mob-section">
          <div className="mob-section-heading">
            <h2>
              {isGroupNamed
                ? `All loot from Bucket ${record.bucketNumber}`
                : "Loot pool"}
            </h2>
            <span>{record.lootPool.length} items</span>
          </div>
          {record.lootPool.length > 0 ? (
            <ul className="mob-loot-list">
              {record.lootPool.map((item) => {
                // Item slug: kebab-case name (Feature D links — may 404 until D ships)
                const itemSlug = mobToSlug(item);
                return (
                  <li key={item}>
                    <Link
                      href={`/item/${itemSlug}`}
                      className="mob-loot-item-link"
                    >
                      <span className="mob-loot-item-name">{item}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mob-loot-empty">No loot data available for this mob.</p>
          )}
        </section>

        {/* Sibling mobs in same bucket/tier */}
        {resolvedSiblings.length > 0 ? (
          <section className="mob-section">
            <div className="mob-section-heading">
              <h2>
                {isGroupNamed
                  ? `Other mobs in Bucket ${record.bucketNumber}`
                  : `Other bosses in this tier`}
              </h2>
              <span>{resolvedSiblings.length}</span>
            </div>
            <ul className="mob-siblings-list">
              {resolvedSiblings.map((sibling) => (
                <li key={sibling.slug} className="mob-sibling-item">
                  <Link
                    href={`/mob/${sibling.slug}`}
                    className="mob-sibling-link"
                    title={sibling.name}
                  >
                    {sibling.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
