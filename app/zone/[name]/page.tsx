import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import classicRaidData from "@/data/classic-raid.json";
import kunarkRaidData from "@/data/kunark-raid.json";
import veliousRaidData from "@/data/velious-raid.json";
import { bucketLevelRange } from "@/lib/buckets";
import type { Bucket, LootDataset } from "@/lib/search";
import { getZoneView } from "@/lib/zones";
import { zoneToSlug, slugToZone } from "@/lib/zone-slug";
import { ZONE_CONNECTIONS } from "@/lib/zone-connections";
import { ZoneMobFilter } from "@/components/ZoneMobFilter";
import type { RaidBossEntry } from "@/components/ZoneMobFilter";
import { Breadcrumb } from "./Breadcrumb";
import "./zone-page.css";

// ---------------------------------------------------------------------------
// Static data — loaded once at module level (server-only, no client boundary)
// ---------------------------------------------------------------------------

const allDatasets = [classicData, kunarkData, veliousData] as LootDataset[];
const allBuckets: Bucket[] = allDatasets.flatMap((d) => d.buckets);

// ---------------------------------------------------------------------------
// Raid data types and aggregation
// ---------------------------------------------------------------------------

type RaidBoss = {
  name: string;
  level: number;
  zone: string;
  loot_pool: string[];
};

type RaidTier = {
  tier: number;
  name: string;
  bosses: RaidBoss[];
};

type RaidDataset = {
  expansion: string;
  tiers: RaidTier[];
};

const allRaidDatasets: RaidDataset[] = [
  classicRaidData as RaidDataset,
  kunarkRaidData as RaidDataset,
  veliousRaidData as RaidDataset,
];

/** All raid bosses across all expansions, with their expansion attached. */
const allRaidBossesWithExpansion: (RaidBoss & { expansion: string })[] =
  allRaidDatasets.flatMap((d) =>
    d.tiers.flatMap((t) => t.bosses.map((b) => ({ ...b, expansion: d.expansion }))),
  );

/** Map from canonical zone name -> array of raid bosses in that zone. */
const raidBossesByZone = new Map<string, (RaidBoss & { expansion: string })[]>();
for (const boss of allRaidBossesWithExpansion) {
  const list = raidBossesByZone.get(boss.zone) ?? [];
  list.push(boss);
  raidBossesByZone.set(boss.zone, list);
}

/** All unique raid zone names. */
const allRaidZoneNames: string[] = Array.from(raidBossesByZone.keys()).sort((a, b) =>
  a.localeCompare(b),
);

/**
 * Resolves a slug back to a raid zone name.
 * Returns { name, expansion } using the first boss's expansion, or undefined.
 */
function slugToRaidZone(
  slug: string,
): { name: string; expansion: string } | undefined {
  for (const [zoneName, bosses] of raidBossesByZone) {
    if (zoneToSlug(zoneName) === slug) {
      return { name: zoneName, expansion: bosses[0].expansion };
    }
  }
  return undefined;
}

// Unique zone names, deduplicated across expansions
function getAllUniqueZones(buckets: Bucket[]): string[] {
  return Array.from(new Set(buckets.flatMap((b) => b.zones))).sort((a, b) =>
    a.localeCompare(b),
  );
}

// ---------------------------------------------------------------------------
// Static generation
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<{ name: string }[]> {
  const groupZones = getAllUniqueZones(allBuckets);
  const raidZones = allRaidZoneNames;

  // Merge, deduplicate by slug (group-named wins canonical name on collision)
  const seen = new Set<string>();
  const params: { name: string }[] = [];

  for (const zone of [...groupZones, ...raidZones]) {
    const slug = zoneToSlug(zone);
    if (!seen.has(slug)) {
      seen.add(slug);
      params.push({ name: slug });
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name: slug } = await params;
  const resolved = slugToZone(slug, allBuckets) ?? slugToRaidZone(slug);
  const zoneName = resolved?.name ?? slug;
  const displayName = toTitleCase(zoneName);

  return {
    title: `${displayName} Loot — Frostreaver Loot Buckets`,
    description: `Named mob loot pool for ${displayName} on Frostreaver EverQuest. See all mobs, levels, and loot buckets.`,
    openGraph: {
      title: `${displayName} Loot — Frostreaver Loot Buckets`,
      description: `Named mob loot pool for ${displayName} on Frostreaver EverQuest.`,
      type: "website",
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTitleCase(str: string): string {
  // Preserve existing casing when the string is already mixed-case
  if (str !== str.toLowerCase()) return str;
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function expansionToneClass(expansion: string): string {
  return `expansion-tone-${expansion.toLowerCase()}`;
}

function deriveExpansionLabel(buckets: Bucket[], zoneName: string): string {
  const expansions = Array.from(
    new Set(
      buckets
        .filter((b) => b.zones.some((z) => z === zoneName))
        .map((b) => b.expansion),
    ),
  );
  return expansions.join(" / ");
}

function levelRange(buckets: Bucket[], zoneName: string): string {
  const levels = buckets
    .flatMap((b) => b.mobs)
    .filter((m) => m.zone === zoneName)
    .map((m) => m.level);

  if (levels.length === 0) return "Unknown";
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return min === max ? `${min}` : `${min}–${max}`;
}

/**
 * Returns zones in the same expansion, sorted by their minimum mob level.
 * Provides prev/next neighbors relative to the current zone within that set.
 */
function getExpansionNeighbors(
  allBuckets: Bucket[],
  zoneName: string,
): { previous?: string; next?: string } {
  const zoneExpansions = new Set(
    allBuckets
      .filter((b) => b.zones.includes(zoneName))
      .map((b) => b.expansion),
  );

  // Collect all zones in the same expansion(s)
  const siblingsWithLevel: { zone: string; minLevel: number }[] = [];
  const seen = new Set<string>();

  for (const bucket of allBuckets) {
    if (!zoneExpansions.has(bucket.expansion)) continue;
    for (const mob of bucket.mobs) {
      if (seen.has(mob.zone)) continue;
      seen.add(mob.zone);

      const minLevel = Math.min(
        ...allBuckets
          .flatMap((b) => b.mobs)
          .filter((m) => m.zone === mob.zone)
          .map((m) => m.level),
      );
      siblingsWithLevel.push({ zone: mob.zone, minLevel });
    }
  }

  siblingsWithLevel.sort(
    (a, b) => a.minLevel - b.minLevel || a.zone.localeCompare(b.zone),
  );

  const index = siblingsWithLevel.findIndex((s) => s.zone === zoneName);
  if (index === -1) return {};

  return {
    previous: siblingsWithLevel[index - 1]?.zone,
    next: siblingsWithLevel[index + 1]?.zone,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ZonePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: slug } = await params;

  // Resolve slug — try group-named first, then raid
  const resolved = slugToZone(slug, allBuckets) ?? slugToRaidZone(slug);

  if (!resolved) {
    notFound();
  }

  const { name: zoneName, expansion } = resolved;
  const zoneView = getZoneView(allBuckets, zoneName);
  const raidBossesHere = raidBossesByZone.get(zoneName) ?? [];

  // Unknown to both group-named AND raid data → 404
  if (!zoneView && raidBossesHere.length === 0) {
    notFound();
  }

  const connections = ZONE_CONNECTIONS[zoneName] ?? [];

  // ---------------------------------------------------------------------------
  // Raid-only zone render path
  // ---------------------------------------------------------------------------
  if (!zoneView) {
    const raidExpansions = Array.from(new Set(raidBossesHere.map((b) => b.expansion)));
    const primaryExpTone = expansionToneClass(expansion);

    return (
      <main className="page">
        <header className="hero-header" aria-label="Loot Goblin">
          <Link href="/" aria-label="Loot Goblin home">
            <img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" />
          </Link>
        </header>
        <Breadcrumb
          items={[
            { label: "Frostreaver Loot", href: "/" },
            { label: raidExpansions.join(" / ") },
            { label: zoneName },
          ]}
        />

        {/* Hero */}
        <div className={`zone-page-hero ${primaryExpTone}`}>
          <div className="zone-page-hero-body">
            <div className="expansion-pill-row">
              {raidExpansions.map((exp) => (
                <span
                  className={`expansion-pill ${expansionToneClass(exp)}`}
                  key={exp}
                >
                  {exp}
                </span>
              ))}
              <span className="expansion-pill expansion-pill-raid">Raid</span>
            </div>
            <h1 className="zone-page-title">{zoneName}</h1>
            <div className="zone-page-meta">
              <strong>{raidBossesHere.length} raid {raidBossesHere.length === 1 ? "boss" : "bosses"}</strong>
            </div>
          </div>
        </div>

        <div className="zone-page-sections">
          <ZoneMobFilter
            zoneName={zoneName}
            groupMobs={[]}
            bucketGroups={[]}
            aggregatedLootCount={0}
            raidBosses={raidBossesHere
              .slice()
              .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
              .map((boss, i): RaidBossEntry => ({
                name: boss.name,
                level: boss.level,
                expansion: boss.expansion,
                zone: boss.zone,
                loot_pool: boss.loot_pool,
                bucket: {
                  bucket: i,
                  level_range: `${boss.level}`,
                  expansion: boss.expansion,
                  mobs: [{ name: boss.name, level: boss.level, zone: boss.zone, expansion: boss.expansion, source_bucket: boss.name, loot: boss.loot_pool }],
                  loot_pool: boss.loot_pool,
                  zones: [boss.zone],
                },
              }))}
            raidOnly
          />

          {/* Connecting zones */}
          {connections.length > 0 && (
            <section className="zone-connections-panel">
              <h3>Connecting zones</h3>
              <ul className="zone-connections-list">
                {connections.map((connectedZone) => (
                  <li key={connectedZone}>
                    <Link
                      className="zone-connection-link"
                      href={`/zone/${zoneToSlug(connectedZone)}`}
                    >
                      {connectedZone}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Normal group-named zone render path
  // ---------------------------------------------------------------------------

  const expansionLabel = deriveExpansionLabel(allBuckets, zoneName);
  const mobLevelRange = levelRange(allBuckets, zoneName);
  const { previous, next } = getExpansionNeighbors(allBuckets, zoneName);

  // Buckets that include this zone, for the "Recommended buckets" panel
  const relatedBuckets = allBuckets.filter((b) => b.zones.includes(zoneName));

  // Aggregate loot pool across all related buckets
  const aggregatedLoot = Array.from(
    new Set(relatedBuckets.flatMap((b) => b.loot_pool)),
  ).sort((a, b) => a.localeCompare(b));

  // Mobs in this zone, sorted by level
  const mobsInZone = zoneView.bucketGroups
    .flatMap(({ mobs, bucket }) => mobs.map((mob) => ({ mob, bucket })))
    .sort((a, b) => a.mob.level - b.mob.level || a.mob.name.localeCompare(b.mob.name));

  const primaryExpTone = expansionToneClass(expansion);

  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <Breadcrumb
        items={[
          { label: "Frostreaver Loot", href: "/" },
          { label: expansionLabel },
          { label: zoneName },
        ]}
      />

      {/* Hero */}
      <div className={`zone-page-hero ${primaryExpTone}`}>
        <div className="zone-page-hero-body">
          <div className="expansion-pill-row">
            {Array.from(
              new Set(relatedBuckets.map((b) => b.expansion)),
            ).map((exp) => (
              <span
                className={`expansion-pill ${expansionToneClass(exp)}`}
                key={exp}
              >
                {exp}
              </span>
            ))}
          </div>
          <h1 className="zone-page-title">{zoneName}</h1>
          <div className="zone-page-meta">
            <strong>{zoneView.totalMobs} named mobs</strong>
            <span className="zone-level-range">Levels {mobLevelRange}</span>
          </div>
        </div>
      </div>

      <div className="zone-page-sections">
        <ZoneMobFilter
          zoneName={zoneName}
          groupMobs={mobsInZone}
          bucketGroups={zoneView.bucketGroups}
          aggregatedLootCount={aggregatedLoot.length}
          raidBosses={raidBossesHere
            .slice()
            .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
            .map((boss, i): RaidBossEntry => ({
              name: boss.name,
              level: boss.level,
              expansion: boss.expansion,
              zone: zoneName,
              loot_pool: boss.loot_pool,
              bucket: {
                bucket: 900000 + i,
                level_range: String(boss.level),
                expansion: boss.expansion,
                mobs: [{ name: boss.name, level: boss.level, zone: zoneName, expansion: boss.expansion, source_bucket: boss.name, loot: boss.loot_pool }],
                zones: [zoneName],
                loot_pool: boss.loot_pool,
              },
            }))}
          raidOnly={false}
        />

        {/* Connecting zones */}
        {connections.length > 0 && (
          <section className="zone-connections-panel">
            <h3>Connecting zones</h3>
            <ul className="zone-connections-list">
              {connections.map((connectedZone) => (
                <li key={connectedZone}>
                  <Link
                    className="zone-connection-link"
                    href={`/zone/${zoneToSlug(connectedZone)}`}
                  >
                    {connectedZone}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recommended buckets */}
        <section className="zone-buckets-panel">
          <h3>Buckets for {zoneName}</h3>
          <ul className="zone-bucket-list">
            {relatedBuckets.map((bucket) => {
              const range = bucketLevelRange(bucket.bucket, bucket.expansion);
              const toneClass = `zone-bucket-item bucket-tone-${bucket.bucket % 6}`;

              return (
                <li className={toneClass} key={`${bucket.expansion}-${bucket.bucket}`}>
                  <span className="zone-bucket-range">
                    <span className={`expansion-pill expansion-pill is-compact ${expansionToneClass(bucket.expansion)}`}>
                      {bucket.expansion}
                    </span>{" "}
                    Levels {range}
                  </span>
                  <span className="zone-bucket-stats">
                    <strong>{bucket.mobs.filter((m) => m.zone === zoneName).length}</strong> mobs
                    {" · "}
                    <strong>{bucket.loot_pool.length}</strong> items
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Sibling navigation */}
        {(previous || next) && (
          <nav className="zone-siblings" aria-label="Adjacent zones">
            {previous ? (
              <Link
                className="zone-sibling-link is-prev"
                href={`/zone/${zoneToSlug(previous)}`}
              >
                <span className="zone-sibling-direction">Previous zone</span>
                <span className="zone-sibling-name">{previous}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                className="zone-sibling-link is-next"
                href={`/zone/${zoneToSlug(next)}`}
              >
                <span className="zone-sibling-direction">Next zone</span>
                <span className="zone-sibling-name">{next}</span>
              </Link>
            ) : null}
          </nav>
        )}
      </div>
    </main>
  );
}
