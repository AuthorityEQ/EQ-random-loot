import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import realSpawnZoneSummariesData from "@/data/eqemu-real-spawn-zone-summaries.json";
import zoneMobDetailsData from "@/data/zone-mob-details.json";
import { ZoneDetailExplorer, type EqemuSpawnTestData, type ZoneMobDetailRow, type ZoneMobGroup } from "@/components/ZoneDetailExplorer";
import {
  canonicalizeZoneSummary,
  canonicalZoneAliases,
  canonicalZoneRouteSlug,
  getZoneMobSummaryByRouteSlug,
  normalizeRealSpawnSummary,
  ZoneDataStatusBadge,
  ZoneDataStatusNote,
  ZoneMobSnapshot,
  type ZoneMobSummary,
  zoneMobSummaries,
} from "@/components/ZoneMobSnapshot";

type ZoneMobDetailSet = {
  zoneSlug: string;
  routeSlug: string;
  zoneName: string;
  sourceFile: string;
  sourceKind?: string;
  sourceUrl?: string;
  spawnMapPrototype?: {
    sourceKind: string;
    coordinateNote: string;
    points: Array<{
      spawnGroupIndex: number;
      name: string;
      displayName: string;
      level: number | null;
      race: string;
      rawRace: string;
      className: string;
      x: number | null;
      y: number | null;
      z: number | null;
      heading: number | null;
      chance: number | null;
      respawnTime: number | null;
      candidateCount: number;
    }>;
  };
  mobGroups: ZoneMobGroup[];
  rows: ZoneMobDetailRow[];
};

const zoneMobDetails = zoneMobDetailsData as unknown as ZoneMobDetailSet[];
const realSpawnSummaries = (realSpawnZoneSummariesData as unknown as Array<ZoneMobSummary & { routeSlug?: string; zoneShortName?: string }>)
  .map((summary) => normalizeRealSpawnSummary(canonicalizeZoneSummary(summary)));
const zoneMobDetailsBySlug = new Map(zoneMobDetails.flatMap((detail) => [
  [detail.zoneSlug, detail],
  [detail.routeSlug, detail],
]));
const realSpawnSummariesByRouteSlug = new Map(realSpawnSummaries.flatMap((summary) => (
  canonicalZoneAliases(summary).map((alias) => [alias, summary] as const)
)));

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isDrogaRoute(shortName: string | null | undefined) {
  return (shortName ?? "").toLowerCase() === "droga";
}

function filterDrogaOriginalDetails(detail: ZoneMobDetailSet | null, shortName: string | null | undefined) {
  if (!detail || !isDrogaRoute(shortName)) return detail;
  const rows = detail.rows.filter((row) => typeof row.level === "number" && row.level < 41);
  const mobGroups = detail.mobGroups
    .map((group) => {
      const levels = group.levels.filter((level) => level < 41);
      return {
        ...group,
        count: levels.length,
        levelMax: levels.length ? Math.max(...levels) : null,
        levelMin: levels.length ? Math.min(...levels) : null,
        levels,
      };
    })
    .filter((group) => group.levels.length > 0);
  return { ...detail, mobGroups, rows };
}

function loadRealSpawnZone(routeSlug: string) {
  const summary = realSpawnSummariesByRouteSlug.get(routeSlug);
  if (!summary) return null;
  const shortName = summary.routeSlug ?? summary.zoneShortName;
  if (!shortName) return null;
  const summaryData = readJsonFile<{ summary: ZoneMobSummary; details: ZoneMobDetailSet }>(resolve(`data/eqemu-${shortName}-zone-summary-test.json`));
  const spawnData = readJsonFile<EqemuSpawnTestData>(resolve(`data/eqemu-${shortName}-spawns-test.json`));
  return {
    detail: filterDrogaOriginalDetails(summaryData?.details ?? null, shortName),
    shortName,
    spawnData,
    summary: normalizeRealSpawnSummary(summary),
  };
}

function resolveZoneRouteTargets(routeSlug: string) {
  const snapshotSummary = getZoneMobSummaryByRouteSlug(routeSlug);
  const realSpawnSummary = realSpawnSummariesByRouteSlug.get(routeSlug);
  return {
    realSpawnRouteSlug: realSpawnSummary ? canonicalZoneRouteSlug(realSpawnSummary) : null,
    realSpawnSummary,
    snapshotRouteSlug: snapshotSummary ? canonicalZoneRouteSlug(snapshotSummary) : null,
    snapshotSummary,
  };
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = new Set<string>();
  for (const summary of zoneMobSummaries) {
    slugs.add(summary.zoneSlug);
    slugs.add(canonicalZoneRouteSlug(summary));
  }
  for (const summary of realSpawnSummaries) {
    slugs.add(canonicalZoneRouteSlug(summary));
  }
  return Array.from(slugs).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const summary = getZoneMobSummaryByRouteSlug(slug) ?? realSpawnSummariesByRouteSlug.get(slug);
  if (!summary) return { title: "Zone Explorer | Frostreaver Loot" };
  return {
    title: `${summary.zoneName} Zone Snapshot | Frostreaver Loot`,
    description: `Mob snapshot and approximate level distribution for ${summary.zoneName}.`,
  };
}

export default async function ZoneSummaryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ source?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const initialDataSourceMode = resolvedSearchParams?.source === "spawns" ? "spawns" : "snapshot";
  const routeTargets = resolveZoneRouteTargets(slug);
  const realSpawnZone = initialDataSourceMode === "spawns" ? loadRealSpawnZone(slug) : null;
  const summary = routeTargets.snapshotSummary ?? realSpawnZone?.summary ?? routeTargets.realSpawnSummary;
  if (!summary) notFound();
  const useRealSpawnData = initialDataSourceMode === "spawns" && Boolean(realSpawnZone?.spawnData);
  const renderedSummary = useRealSpawnData ? realSpawnZone!.summary : summary;
  const detail = useRealSpawnData ? realSpawnZone?.detail : zoneMobDetailsBySlug.get(slug);
  const detailRows = detail?.rows ?? [];
  const spawnMapPrototype = detail?.spawnMapPrototype;

  return (
    <main className="page zones-page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="header">
        <div>
          <p className="eyebrow">Zone Explorer / Data Sample</p>
          <div className="zones-title-row">
            <h1>{renderedSummary.zoneName}</h1>
            <ZoneDataStatusBadge summary={renderedSummary} />
          </div>
          <p className="subhead">
            {renderedSummary.expansion} {useRealSpawnData ? "spawn-slot data from EQEmu/PEQ database" : `zone snapshot from ${renderedSummary.sourceKind ?? "imported CSV data"}`}. This is a zone feel overview, not a complete spawn encyclopedia.
          </p>
          <ZoneDataStatusNote summary={renderedSummary} />
        </div>
      </header>

      <div className="zones-detail-layout">
        <ZoneMobSnapshot summary={renderedSummary} variant="panel" />
        <ZoneDetailExplorer
          hasSnapshotData={Boolean(routeTargets.snapshotSummary)}
          initialDataSourceMode={initialDataSourceMode}
          summary={renderedSummary}
          rows={detailRows}
          mobGroups={detail?.mobGroups ?? []}
          realSpawnData={useRealSpawnData ? realSpawnZone?.spawnData ?? null : null}
          realSpawnRouteSlug={routeTargets.realSpawnRouteSlug}
          snapshotRouteSlug={routeTargets.snapshotRouteSlug}
          spawnMapPrototype={spawnMapPrototype}
        />
      </div>
    </main>
  );
}
