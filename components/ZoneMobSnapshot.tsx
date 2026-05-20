import zoneMobSummariesData from "@/data/zone-mob-summaries.json";
import { zoneToSlug } from "@/lib/zone-slug";

export type ZoneMobSummary = {
  zoneSlug: string;
  zoneName: string;
  sourceFile: string;
  matched: boolean;
  hiddenFromZones?: boolean;
  deprecatedBy?: string;
  deprecatedReason?: string;
  expansion: string;
  expansionSource: string;
  sourceKind?: string;
  sourceUrl?: string;
  mobCount: number;
  unknownLevelCount: number;
  minLevel: number | null;
  maxLevel: number | null;
  averageLevel: number | null;
  medianLevel: number | null;
  levelCounts: Record<string, number>;
  levelBuckets: Record<string, number>;
  levelProfileLabel?: string | null;
  mobGroupNameCounts: Record<string, number>;
  classCounts: Record<string, number>;
  raceCounts: Record<string, number>;
  normalizedRaceCounts: Record<string, number>;
  normalizedRaceLevelCounts: Record<string, Record<string, number>>;
  raceAliases: Record<string, string[]>;
  typeCounts: Record<string, number>;
  notes: string[];
  eraTag: string | null;
  dataVersionTag: string | null;
  dataEra?: "revamp" | string | null;
  dataStatus?: "temporary" | string | null;
  expectedReplacement?: "classic-1.0" | string | null;
};

export type ZoneDataStatus = {
  dataEra: "original" | "revamp";
  dataStatus?: "filtered" | "temporary";
  expectedReplacement?: "classic-1.0";
  label: string;
  shortText: string;
  detailText: string;
};

type ZoneStatusInput = Partial<ZoneMobSummary> & {
  routeSlug?: string | null;
  zoneShortName?: string | null;
};

const bucketLabels = ["1-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61+"];
const allZoneMobSummaries = zoneMobSummariesData as unknown as ZoneMobSummary[];

function normalizeCanonicalZoneKey(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isCazicThuleRevampZone(summary: ZoneStatusInput) {
  const keys = [
    summary.zoneName,
    summary.zoneSlug,
    summary.routeSlug,
    summary.zoneShortName,
    summary.sourceFile,
  ].map(normalizeCanonicalZoneKey);

  return keys.some((key) => (
    key === "cazicthule"
    || key === "cthule"
    || key === "templeofcazicthule"
    || key === "accursedtempleofcazicthule"
  ));
}

export function canonicalizeZoneSummary<T extends ZoneStatusInput>(summary: T): T {
  if (!isCazicThuleRevampZone(summary)) return summary;
  return {
    ...summary,
    zoneSlug: "temple-of-cazic-thule",
    zoneName: "Temple of Cazic-Thule",
    routeSlug: "cazicthule",
  } as T;
}

export function canonicalZoneAliases(summary: ZoneStatusInput) {
  if (!isCazicThuleRevampZone(summary)) {
    return Array.from(new Set([
      summary.zoneSlug,
      summary.routeSlug,
      summary.zoneShortName,
      summary.sourceFile ? zoneSummaryRouteSlug(summary as Pick<ZoneMobSummary, "sourceFile" | "zoneSlug">) : null,
      summary.zoneName ? zoneToSlug(summary.zoneName) : null,
    ].filter((value): value is string => Boolean(value))));
  }

  return [
    "cazicthule",
    "cazic-thule",
    "cthule",
    "temple-of-cazic-thule",
    "accursed-temple-of-cazicthule",
  ];
}

export function canonicalZoneRouteSlug(summary: Pick<ZoneMobSummary, "sourceFile" | "zoneSlug"> & Partial<ZoneStatusInput>) {
  if (isCazicThuleRevampZone(summary)) return "cazicthule";
  return summary.routeSlug
    ?? summary.zoneShortName
    ?? zoneSummaryRouteSlug(summary);
}

function isDrogaRealSpawnSummary(summary: ZoneStatusInput) {
  return normalizeCanonicalZoneKey(summary.routeSlug)
    === "droga" || normalizeCanonicalZoneKey(summary.zoneShortName) === "droga";
}

function bucketForLevel(level: number) {
  if (level <= 10) return "1-10";
  if (level <= 20) return "11-20";
  if (level <= 30) return "21-30";
  if (level <= 40) return "31-40";
  if (level <= 50) return "41-50";
  if (level <= 60) return "51-60";
  return "61+";
}

function averageFromLevels(levels: number[]) {
  if (!levels.length) return null;
  return Number((levels.reduce((sum, level) => sum + level, 0) / levels.length).toFixed(1));
}

function medianFromLevels(levels: number[]) {
  if (!levels.length) return null;
  const sorted = [...levels].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
}

export function normalizeRealSpawnSummary(summary: ZoneMobSummary & { routeSlug?: string; zoneShortName?: string }) {
  if (!isDrogaRealSpawnSummary(summary)) return summary;
  const levelCounts = Object.fromEntries(
    Object.entries(summary.levelCounts ?? {})
      .filter(([level]) => Number(level) < 41),
  );
  const levels = Object.entries(levelCounts).flatMap(([level, count]) => (
    Array.from({ length: count }, () => Number(level))
  ));
  const levelBuckets = Object.fromEntries(bucketLabels.map((label) => [label, 0]));
  for (const level of levels) {
    levelBuckets[bucketForLevel(level)] = (levelBuckets[bucketForLevel(level)] ?? 0) + 1;
  }
  const normalizedRaceLevelCounts = Object.fromEntries(
    Object.entries(summary.normalizedRaceLevelCounts ?? {}).map(([race, counts]) => [
      race,
      Object.fromEntries(Object.entries(counts).filter(([level]) => Number(level) < 41)),
    ]).filter(([, counts]) => Object.values(counts as Record<string, number>).some((count) => count > 0)),
  ) as Record<string, Record<string, number>>;
  const normalizedRaceCounts = Object.fromEntries(
    Object.entries(normalizedRaceLevelCounts).map(([race, counts]) => [
      race,
      Object.values(counts).reduce((sum, count) => sum + count, 0),
    ]),
  );
  const filteredMobCount = levels.length;
  const notes = Array.from(new Set([
    "Droga Real Spawn Data is filtered to original/1.0-era mobs below level 41.",
    ...(summary.notes ?? []).filter((note) => !/2\.0|revamp/i.test(note)),
  ]));

  return {
    ...summary,
    averageLevel: averageFromLevels(levels),
    dataEra: "original",
    dataStatus: "filtered",
    dataVersionTag: "1.0 / Original Data",
    eraTag: "1.0 / Original Data",
    levelBuckets,
    levelCounts,
    levelProfileLabel: "Original 1.0 level range",
    maxLevel: levels.length ? Math.max(...levels) : null,
    medianLevel: medianFromLevels(levels),
    minLevel: levels.length ? Math.min(...levels) : null,
    mobCount: filteredMobCount,
    normalizedRaceCounts,
    normalizedRaceLevelCounts,
    notes,
    raceCounts: normalizedRaceCounts,
  };
}

function dedupeZoneSummaries<T extends ZoneMobSummary>(summaries: T[]) {
  const byRoute = new Map<string, T>();
  for (const summary of summaries) {
    const route = canonicalZoneRouteSlug(summary);
    if (!byRoute.has(route)) byRoute.set(route, summary);
  }
  return Array.from(byRoute.values());
}

export const zoneMobSummaries = dedupeZoneSummaries(allZoneMobSummaries
  .filter((summary) => !summary.hiddenFromZones)
  .map((summary) => canonicalizeZoneSummary(summary)));
const zoneMobSummaryBySlug = new Map(zoneMobSummaries.flatMap((summary) => (
  canonicalZoneAliases(summary).map((alias) => [alias, summary] as const)
)));
const zoneMobSummaryByRouteSlug = new Map(zoneMobSummaries.flatMap((summary) => (
  canonicalZoneAliases(summary).map((alias) => [alias, summary] as const)
)));

export const zoneLevelBucketLabels = bucketLabels;

export function zoneSummaryRouteSlug(summary: Pick<ZoneMobSummary, "sourceFile" | "zoneSlug">) {
  const baseName = summary.sourceFile.split(/[\\/]/).pop() ?? "";
  const sourceSlug = baseName.replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return sourceSlug || summary.zoneSlug;
}

export function getZoneMobSummary(zoneName: string) {
  return zoneMobSummaryBySlug.get(zoneToSlug(zoneName)) ?? null;
}

export function getZoneMobSummaryByRouteSlug(slug: string) {
  return zoneMobSummaryByRouteSlug.get(slug) ?? null;
}

export function topCountLabels(counts: Record<string, number>, limit = 3) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label]) => label);
}

function normalizeZoneStatusKey(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isKnownTemporaryRevampZone(summary: ZoneStatusInput) {
  const keys = [
    summary.zoneName,
    summary.zoneSlug,
    summary.routeSlug,
    summary.zoneShortName,
    summary.sourceFile,
  ].map(normalizeZoneStatusKey);

  return keys.some((key) => (
    key.includes("cazicthule")
    || key.includes("templeofdroga")
    || key === "droga"
    || key.includes("splitpaw")
    || key === "paw"
    || key === "hateplane"
    || key === "hateplaneb"
    || key.includes("planeofhate")
  ));
}

export function getZoneDataStatus(summary: ZoneStatusInput): ZoneDataStatus | null {
  if (summary.dataEra === "original" || /1\.0|original/i.test(summary.dataVersionTag ?? "")) {
    return {
      dataEra: "original",
      dataStatus: "filtered",
      label: "1.0 / Original Data",
      shortText: "Using original-era Real Spawn Data.",
      detailText: "High-level revamp mobs are filtered from this source.",
    };
  }

  if (summary.dataEra === "revamp" || summary.dataVersionTag || isKnownTemporaryRevampZone(summary)) {
    return {
      dataEra: "revamp",
      dataStatus: "temporary",
      expectedReplacement: "classic-1.0",
      label: "2.0 / Revamp Data",
      shortText: "Using temporary 2.0/revamp-era data.",
      detailText: "Will be updated when classic-era data becomes available.",
    };
  }

  return null;
}

export function ZoneDataStatusBadge({ summary }: { summary: ZoneStatusInput }) {
  const status = getZoneDataStatus(summary);
  if (!status) return null;

  return (
    <span
      className="zone-data-status-badge"
      title={status.dataEra === "original"
        ? "This Real Spawn Data source is filtered to original-era mobs."
        : "This zone currently uses later-era snapshot data because reliable classic-era data is not yet available."}
    >
      {status.label}
    </span>
  );
}

export function ZoneDataStatusNote({ summary }: { summary: ZoneStatusInput }) {
  const status = getZoneDataStatus(summary);
  if (!status) return null;

  return (
    <p className="zone-data-status-note">
      <strong>{status.shortText}</strong> {status.detailText}
    </p>
  );
}

export function ZoneMobSnapshot({
  summary,
  variant = "compact",
}: {
  summary: ZoneMobSummary;
  variant?: "compact" | "panel";
}) {
  const levelRange = summary.minLevel !== null && summary.maxLevel !== null
    ? `${summary.minLevel}-${summary.maxLevel}`
    : "Unknown";
  const commonRaces = topCountLabels(summary.normalizedRaceCounts ?? summary.raceCounts);
  const maxBucketCount = Math.max(1, ...bucketLabels.map((label) => summary.levelBuckets[label] ?? 0));

  return (
    <div className={variant === "panel" ? "zone-mob-snapshot is-panel" : "zone-mob-snapshot"}>
      {variant === "panel" ? (
        <div className="zone-mob-snapshot-heading">
          <strong>Mob Snapshot</strong>
          <span>Data sample</span>
        </div>
      ) : null}
      <div className="zone-mob-snapshot-chips">
        <span>Mobs: {summary.mobCount}</span>
        <span>Levels: {levelRange}</span>
        {summary.averageLevel !== null ? <span>Avg: {summary.averageLevel}</span> : null}
        {summary.medianLevel !== null ? <span>Median: {summary.medianLevel}</span> : null}
        {summary.levelProfileLabel ? <span>{summary.levelProfileLabel}</span> : null}
        {commonRaces.length > 0 ? <span>Common races: {commonRaces.join(", ")}</span> : null}
      </div>
      <div className="zone-level-distribution" aria-label={`Approximate level distribution for ${summary.zoneName}`}>
        {bucketLabels.map((label) => {
          const count = summary.levelBuckets[label] ?? 0;
          const width = count > 0 ? Math.max(10, Math.round((count / maxBucketCount) * 100)) : 0;
          return (
            <div className="zone-level-bucket" key={label}>
              <span className="zone-level-bucket-label">{label}</span>
              <span className="zone-level-bucket-track">
                <span className="zone-level-bucket-fill" style={{ width: `${width}%` }} />
              </span>
              <span className="zone-level-bucket-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
