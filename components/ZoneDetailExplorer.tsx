"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { EqItemInspect } from "@/components/EqItemInspect";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import { canonicalZoneRouteSlug, ZoneDataStatusBadge, ZoneDataStatusNote, type ZoneMobSummary } from "@/components/ZoneMobSnapshot";
import type { ZoneDataSourceMode } from "@/components/ZonesExplorer";
import itemDetailsData from "@/data/item-details.json";
import { itemToSlug } from "@/lib/item-slug";
import type { ItemDetails, ItemDetailsMap } from "@/lib/search";
import realSpawnLootAssetsData from "@/data/real-spawn-loot-assets.json";
import realSpawnPlayerRareSourcesData from "@/data/real-spawn-player-rare-sources.json";
import realSpawnNpcSuppressionsData from "@/data/real-spawn-npc-suppressions.json";
import zoneMapAssetsData from "@/data/zone-map-assets.json";
import zoneMapCalibrationsData from "@/data/zone-map-calibrations.json";
import spawnMapRepresentativeOverridesData from "@/data/spawn-map-representative-overrides.json";

export type ZoneMobDetailRow = {
  displayName: string;
  rawName: string;
  level: number | null;
  race: string;
  rawRace?: string;
  className: string;
  type: string;
};

export type ZoneMobGroup = {
  displayName: string;
  rawNames: string[];
  count: number;
  levelMin: number | null;
  levelMax: number | null;
  levels: number[];
  raceCounts: Record<string, number>;
  rawRaceCounts?: Record<string, number>;
  classCounts: Record<string, number>;
  typeCounts: Record<string, number>;
};

type SpawnMapPoint = {
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
};

type SpawnMapPrototypeData = {
  sourceKind: string;
  coordinateNote: string;
  points: SpawnMapPoint[];
};

type MapLine = {
  x1: number;
  y1: number;
  z1?: number;
  x2: number;
  y2: number;
  z2?: number;
  color: string;
};

type MapLabel = {
  x: number;
  y: number;
  z?: number;
  label: string;
  color: string;
  size?: number;
};

type MapAssetLayer = {
  key: string;
  name: string;
  lines: MapLine[];
  labels: MapLabel[];
};

type MapAsset = {
  assetUrl?: string;
  sourceKind: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  layers?: MapAssetLayer[];
};

type MapCalibrationLayer = {
  key: string;
  name: string;
  mapImage: string | null;
  mapVectorKey: string | null;
  zMin: number | null;
  zMax: number | null;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  flipX: boolean;
  flipY: boolean;
  swapXY: boolean;
  rotation: number;
};

type MapCalibration = {
  zoneName: string;
  defaultLayerKey: string;
  layers: MapCalibrationLayer[];
  spawnTransform?: {
    source: string;
    axisPair?: SpawnAxisPair;
    axisA?: SpawnAxis;
    axisB?: SpawnAxis;
    selectedTransform: string;
    flipA?: boolean;
    flipB?: boolean;
    flipX?: boolean;
    flipY?: boolean;
    offsetA?: number;
    offsetB?: number;
    offsetX?: number;
    offsetY?: number;
    rotateX?: number;
    rotateY?: number;
    rotateZ?: number;
    scaleA?: number;
    scaleB?: number;
    scaleX?: number;
    scaleY?: number;
    swapAxes?: boolean;
    swapXY?: boolean;
    score?: Partial<SpawnAlignmentScore> & { axisPair?: string };
  };
};

type NativeMapLine = {
  x1: number | null;
  y1: number | null;
  z1?: number | null;
  x2: number | null;
  y2: number | null;
  z2?: number | null;
  kind: string;
  gridid?: number;
};

type NativeMapPoint = {
  id?: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
  name?: string | null;
  displayName?: string;
  level?: number | null;
  race?: string;
};

type EqemuPrimarySpawn = {
  spawn2Id: number;
  spawngroupId: number | null;
  spawngroupName?: string;
  primaryNpcId?: number;
  primaryNpcName: string;
  displayName: string;
  level: number | null;
  race: string;
  className: string;
  chance: number | null;
  respawnTime: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
  candidateCount: number;
  candidates: EqemuSpawnCandidate[];
};

export type EqemuSpawnTestData = {
  zoneShortName?: string;
  zoneName?: string;
  candidateCount: number;
  primarySpawnRows: EqemuPrimarySpawn[];
  spawnSlotCount: number;
};

type EqemuSpawnCandidate = {
  npcTypeId: number;
  name: string;
  displayName: string;
  level: number | null;
  race: string;
  className: string;
  chance: number | null;
};

type NativeSpawnWithPrimary = NativeMapPoint & {
  primary?: EqemuPrimarySpawn;
  representative?: SpawnMapRepresentative;
  transformed?: { x: number; y: number };
};

type SpawnMapDotCategory = "common" | "special";
type SpawnMapRepresentativeReason = "common" | "epic-source" | "drops" | "gear-footprint" | "low-chance-generic" | "low-chance-with-drops" | "low-footprint-loot" | "named" | "named-with-drops" | "override" | "population" | "site-rare-source" | "static-utility" | "unique-loot";
type SpawnMapRepresentative = EqemuSpawnCandidate & {
  dropCount: number;
  hasMeaningfulDrops: boolean;
  commonLootCount: number;
  lootUniquenessScore: number;
  meaningfulDropCount: number;
  spawnPointCount: number | null;
  statGearDropCount: number;
  uniqueNamedLootCount: number;
  isLowChance: boolean;
  isManualOverride: boolean;
  isNamed: boolean;
  isEpicSource: boolean;
  isSiteRareSource: boolean;
  isUtility: boolean;
  isPopulation: boolean;
  footprintPenalty: number;
  skippedPrimaryCommon?: {
    chance: number | null;
    displayName: string;
  };
  reason: SpawnMapRepresentativeReason;
  reasonLabel: string;
};

type SpawnMapCandidateFootprint = {
  displayName: string;
  spawnPointCount: number;
};

type SpawnMapCandidateScore = {
  candidate: EqemuSpawnCandidate;
  dropCount: number;
  hasLowerSpawnFootprint: boolean;
  hasMeaningfulDrops: boolean;
  commonLootCount: number;
  isGeneric: boolean;
  isLowChance: boolean;
  isManualOverride: boolean;
  isNamed: boolean;
  isEpicSource: boolean;
  isSiteRareSource: boolean;
  isUtility: boolean;
  isPopulation: boolean;
  footprintPenalty: number;
  lootUniquenessScore: number;
  meaningfulDropCount: number;
  priority: number;
  reason: SpawnMapRepresentativeReason;
  spawnPointCount: number | null;
  statGearDropCount: number;
  uniqueNamedLootCount: number;
};

type SpawnMapRepresentativeOverrideConfig = Record<string, {
  namedOverrides?: string[];
}>;

type RealSpawnPlayerRareSource = {
  displayName: string;
  epicClasses?: string[];
  epicItems?: string[];
  groupLootExpansions?: string[];
  groupLootItems?: string[];
  sourceKinds?: string[];
  zones?: string[];
};

type RealSpawnPlayerRareSources = {
  epicDropItemNames?: string[];
  epicItemNames: string[];
  mobSources: Record<string, RealSpawnPlayerRareSource>;
};

type RealSpawnNpcSuppressions = {
  globalNpcSuppressions?: string[];
};

type RealSpawnFocus = {
  mobName: string;
  normalizedMobName: string;
  npcTypeId?: number | null;
  source: "list" | "map";
  spawn2Id?: number | null;
  spawngroupId?: number | null;
};

type EqemuLootItem = {
  itemId: number;
  itemName: string | null;
  itemIcon: number | null;
  itemIconPath?: string | null;
  itemDetails?: EqemuLootItemDetails | null;
  dropChance: number | null;
  charges: number | null;
  minLevel: number | null;
  maxLevel: number | null;
  multiplier: number | null;
};

type EqemuLootItemDetails = {
  id: number;
  name: string | null;
  icon: number | null;
  slots: number | null;
  classes: number | null;
  races: number | null;
  ac: number | null;
  damage: number | null;
  delay: number | null;
  itemtype: number | null;
  itemclass: number | null;
  weight: number | null;
  size: number | null;
  stackable: number | null;
  stacksize: number | null;
  lore: string | null;
  loregroup: number | null;
  magic: number | null;
  nodrop: number | null;
  norent: number | null;
  reqlevel: number | null;
  reclevel: number | null;
  maxcharges: number | null;
  stats: Record<string, number | null>;
  resists: Record<string, number | null>;
  regen: number | null;
  manaregen: number | null;
  enduranceregen: number | null;
  attack: number | null;
  accuracy: number | null;
  avoidance: number | null;
  haste: number | null;
  effects: Record<string, number | null>;
};

type EqemuLootDrop = {
  lootdropId: number;
  lootdropName: string | null;
  tableProbability: number | null;
  tableMultiplier: number | null;
  items: EqemuLootItem[];
};

type EqemuLootMob = {
  npcTypeId: number;
  rawName: string | null;
  displayName: string;
  level: number | null;
  raceId: number | null;
  classId: number | null;
  loottableId: number | null;
  loottableName: string | null;
  lootdrops: EqemuLootDrop[];
};

type ZoneLootDistributionEntry = {
  itemName: string;
  sourceMobCount: number;
  sourceNpcTypeIds: Set<number>;
};

type ZoneLootDistribution = {
  itemCount: number;
  mobCount: number;
  items: Map<string, ZoneLootDistributionEntry>;
};

export type EqemuLootTestData = {
  zoneShortName: string;
  sourceKind: string;
  mobs: EqemuLootMob[];
};

type NativeMapDebugData = {
  zoneShortName: string;
  zoneName: string;
  sourceKind: string;
  coordinateNote: string;
  mapReadiness?: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  collisionLines: NativeMapLine[];
  gridLines: NativeMapLine[];
  spawns: NativeMapPoint[];
  doors: NativeMapPoint[];
  zonePoints: NativeMapPoint[];
  objects: NativeMapPoint[];
  groundSpawns: NativeMapPoint[];
  traps: NativeMapPoint[];
};

type AnchorPoint = {
  id: number;
  mapX: number;
  mapY: number;
  eqX: string;
  eqY: string;
};

type BoundsMode = "map" | "spawn";
type NativeMapLayerChoice = "all" | "main" | "overlay" | "poi";
type NativeMapMode = "clean" | "full";
type NativeMapRenderMode = "dots" | "density";
type NativeMapFloorVariance = "loose" | "normal" | "tight";
type NativeViewBox = { minX: number; minY: number; width: number; height: number };
const defaultSpawnDotSize = 8;
type SpawnAxis = "x" | "y" | "z";
type SpawnAxisPair = "xy" | "yx" | "xz" | "zx" | "yz" | "zy";
type SpawnTransform = {
  axisA: SpawnAxis;
  axisB: SpawnAxis;
  key: string;
  label: string;
  flipA: boolean;
  flipB: boolean;
  offsetA: number;
  offsetB: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scaleA: number;
  scaleB: number;
};
type SpawnAlignmentScore = {
  averageDistance: number;
  inBoundsCount: number;
  medianDistance: number;
  outOfBoundsCount: number;
  axisA: SpawnAxis;
  axisB: SpawnAxis;
  transformedBounds: { minX: number; maxX: number; minY: number; maxY: number };
  transformKey: string;
};

type ScoredSpawnTransform = {
  score: SpawnAlignmentScore;
  transform: SpawnTransform;
};

const zoneMapAssets = zoneMapAssetsData as Record<string, MapAsset>;
const zoneMapCalibrations = zoneMapCalibrationsData as unknown as Record<string, MapCalibration>;
const realSpawnLootAssets = realSpawnLootAssetsData as Record<string, { assetUrl: string; sourceBytes?: number; strippedBytes?: number }>;
const realSpawnPlayerRareSources = realSpawnPlayerRareSourcesData as RealSpawnPlayerRareSources;
const realSpawnNpcSuppressions = realSpawnNpcSuppressionsData as RealSpawnNpcSuppressions;
const epicDropItemNameSet = new Set(realSpawnPlayerRareSources.epicDropItemNames ?? []);
const suppressedRealSpawnNpcNames = new Set((realSpawnNpcSuppressions.globalNpcSuppressions ?? []).map(normalizeSpawnMapName));

const samplePageSize = 50;
type MobCompositionView = "families" | "levels" | "table";

const transformModes = [
  { key: "normal", label: "Normal X/Y", flipX: false, flipY: false, swapXY: false, rotation: 0 },
  { key: "flip-x", label: "Flip X", flipX: true, flipY: false, swapXY: false, rotation: 0 },
  { key: "flip-y", label: "Flip Y", flipX: false, flipY: true, swapXY: false, rotation: 0 },
  { key: "flip-both", label: "Flip Both", flipX: true, flipY: true, swapXY: false, rotation: 0 },
  { key: "swap", label: "Swap X/Y", flipX: false, flipY: false, swapXY: true, rotation: 0 },
  { key: "swap-flip-x", label: "Swap + Flip X", flipX: true, flipY: false, swapXY: true, rotation: 0 },
  { key: "swap-flip-y", label: "Swap + Flip Y", flipX: false, flipY: true, swapXY: true, rotation: 0 },
  { key: "swap-flip-both", label: "Swap + Flip Both", flipX: true, flipY: true, swapXY: true, rotation: 0 },
  { key: "rotate-90", label: "Rotate 90", flipX: false, flipY: false, swapXY: false, rotation: 90 },
  { key: "rotate-180", label: "Rotate 180", flipX: false, flipY: false, swapXY: false, rotation: 180 },
  { key: "rotate-270", label: "Rotate 270", flipX: false, flipY: false, swapXY: false, rotation: 270 },
] as const;

const spawnAxisPairs: Array<{ axisA: SpawnAxis; axisB: SpawnAxis; key: string; label: string }> = [
  { axisA: "x", axisB: "y", key: "xy", label: "X/Y" },
  { axisA: "y", axisB: "x", key: "yx", label: "Y/X" },
  { axisA: "x", axisB: "z", key: "xz", label: "X/Z" },
  { axisA: "z", axisB: "x", key: "zx", label: "Z/X" },
  { axisA: "y", axisB: "z", key: "yz", label: "Y/Z" },
  { axisA: "z", axisB: "y", key: "zy", label: "Z/Y" },
];

const spawnTransformPatterns = [
  { key: "normal", label: "Normal", flipA: false, flipB: false },
  { key: "flip-a", label: "Flip A", flipA: true, flipB: false },
  { key: "flip-b", label: "Flip B", flipA: false, flipB: true },
  { key: "flip-both", label: "Flip Both", flipA: true, flipB: true },
] as const;

function makeSpawnTransform(axisA: SpawnAxis, axisB: SpawnAxis, pattern: typeof spawnTransformPatterns[number]): SpawnTransform {
  const axisLabel = `${axisA.toUpperCase()}/${axisB.toUpperCase()}`;
  return {
    axisA,
    axisB,
    key: `${axisA}${axisB}-${pattern.key}`,
    label: `${axisLabel} ${pattern.label}`,
    flipA: pattern.flipA,
    flipB: pattern.flipB,
    offsetA: 0,
    offsetB: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    scaleA: 1,
    scaleB: 1,
  };
}

const spawnRotationPresets = [
  { key: "r0", label: "", rotateX: 0, rotateY: 0, rotateZ: 0 },
  { key: "rx90", label: "Rot X 90", rotateX: 90, rotateY: 0, rotateZ: 0 },
  { key: "rx180", label: "Rot X 180", rotateX: 180, rotateY: 0, rotateZ: 0 },
  { key: "rx270", label: "Rot X 270", rotateX: 270, rotateY: 0, rotateZ: 0 },
  { key: "ry90", label: "Rot Y 90", rotateX: 0, rotateY: 90, rotateZ: 0 },
  { key: "ry180", label: "Rot Y 180", rotateX: 0, rotateY: 180, rotateZ: 0 },
  { key: "ry270", label: "Rot Y 270", rotateX: 0, rotateY: 270, rotateZ: 0 },
  { key: "rz90", label: "Rot Z 90", rotateX: 0, rotateY: 0, rotateZ: 90 },
  { key: "rz180", label: "Rot Z 180", rotateX: 0, rotateY: 0, rotateZ: 180 },
  { key: "rz270", label: "Rot Z 270", rotateX: 0, rotateY: 0, rotateZ: 270 },
] as const;

const spawnTransformCandidates: SpawnTransform[] = spawnAxisPairs.flatMap((pair) => spawnTransformPatterns.flatMap((pattern) => {
  const base = makeSpawnTransform(pair.axisA, pair.axisB, pattern);
  return spawnRotationPresets.map((rotation) => ({
    ...base,
    key: `${base.key}-${rotation.key}`,
    label: [base.label, rotation.label].filter(Boolean).join(" "),
    rotateX: rotation.rotateX,
    rotateY: rotation.rotateY,
    rotateZ: rotation.rotateZ,
  }));
}));
const friendCazicFlipTransform: SpawnTransform = {
  axisA: "x",
  axisB: "y",
  flipA: true,
  flipB: true,
  key: "xy-friend-flip-both",
  label: "Friend fix: -X / -Y",
  offsetA: 0,
  offsetB: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  scaleA: 1,
  scaleB: 1,
};

function spawnTransformLabelForKey(transformKey: string) {
  if (transformKey === friendCazicFlipTransform.key || transformKey === "xy-flip-both-global") {
    return "Global default: -X / -Y";
  }
  return spawnTransformCandidates.find((candidate) => candidate.key === transformKey)?.label ?? transformKey;
}

function sortedCountEntries(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function CountSummary({
  counts,
  title,
}: {
  counts: Record<string, number>;
  title: string;
}) {
  const entries = sortedCountEntries(counts);
  if (entries.length === 0) return null;
  const topEntries = entries.slice(0, 5);

  return (
    <details className="zones-expandable-section" open>
      <summary>
        <span>{title}</span>
        <small>Top {topEntries.length} shown</small>
      </summary>
      <div className="zones-expandable-body">
        <ul className="zones-count-chip-list" aria-label={`${title} top entries`}>
          {topEntries.map(([label, count]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
        {entries.length > topEntries.length ? (
          <details className="zones-nested-details">
            <summary>Show full {title.toLowerCase()} list</summary>
            <div className="zones-full-count-list" aria-label={`${title} full list`}>
              {entries.map(([label, count]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function LevelBreakdown({ summary }: { summary: ZoneMobSummary }) {
  const exactEntries = Object.entries(summary.levelCounts).sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <details className="zones-expandable-section" open>
      <summary>
        <span>Level Breakdown</span>
        <small>Broad buckets by default</small>
      </summary>
      <div className="zones-expandable-body">
        <dl className="zones-bucket-detail-list">
          {Object.entries(summary.levelBuckets).map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <details className="zones-nested-details">
          <summary>Show exact per-level counts</summary>
          <dl className="zones-exact-level-list">
            {exactEntries.map(([level, count]) => (
              <div key={level}>
                <dt>Level {level}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </details>
  );
}

function SourceNotes({ summary }: { summary: ZoneMobSummary }) {
  return (
    <details className="zones-expandable-section">
      <summary>
        <span>Source Notes</span>
        <small>Import details</small>
      </summary>
      <div className="zones-source-notes zones-expandable-body">
        <span>Source file: {summary.sourceFile}</span>
        <span>Expansion: {summary.expansion}</span>
        <span>Expansion source: {summary.expansionSource}</span>
        {summary.sourceKind ? <span>Source: {summary.sourceKind}</span> : null}
        <span>Rows with unknown level: {summary.unknownLevelCount}</span>
        <span>{summary.matched ? "Matched to site zone data" : "Zone mapping reviewed"}</span>
        <ZoneDataStatusBadge summary={summary} />
        <ZoneDataStatusNote summary={summary} />
        {Array.from(new Set(summary.notes)).map((note, noteIndex) => <p key={`${noteIndex}-${note}`}>{note}</p>)}
      </div>
    </details>
  );
}

function raceSuggestions(points: SpawnMapPoint[] = []) {
  return Array.from(new Set(points.map((point) => point.race).filter((race) => race && race !== "Unknown"))).sort((a, b) => a.localeCompare(b));
}

function normalizeMapPoint(
  point: SpawnMapPoint,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  options: Pick<MapCalibrationLayer, "flipX" | "flipY" | "offsetX" | "offsetY" | "rotation" | "scaleX" | "scaleY" | "swapXY">,
) {
  return transformCoordinate(point.x ?? 0, point.y ?? 0, bounds, options);
}

function transformCoordinate(
  rawX: number,
  rawY: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  options: Pick<MapCalibrationLayer, "flipX" | "flipY" | "offsetX" | "offsetY" | "rotation" | "scaleX" | "scaleY" | "swapXY">,
) {
  const numeric = transformCoordinateNumeric(rawX, rawY, bounds, options);
  return {
    left: `${numeric.x}%`,
    top: `${numeric.y}%`,
  };
}

function transformCoordinateNumeric(
  rawX: number,
  rawY: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  options: Pick<MapCalibrationLayer, "flipX" | "flipY" | "offsetX" | "offsetY" | "rotation" | "scaleX" | "scaleY" | "swapXY">,
) {
  const baseX = options.swapXY ? rawY : rawX;
  const baseY = options.swapXY ? rawX : rawY;
  const minX = options.swapXY ? bounds.minY : bounds.minX;
  const maxX = options.swapXY ? bounds.maxY : bounds.maxX;
  const minY = options.swapXY ? bounds.minX : bounds.minY;
  const maxY = options.swapXY ? bounds.maxX : bounds.maxY;
  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1, maxY - minY);
  let x = ((baseX - minX) / xRange) * 100;
  let y = ((baseY - minY) / yRange) * 100;
  x = options.flipX ? 100 - x : x;
  y = options.flipY ? 100 - y : y;
  x = 50 + (x - 50) * options.scaleX + options.offsetX;
  y = 50 + (y - 50) * options.scaleY + options.offsetY;
  if (options.rotation) {
    const radians = (options.rotation * Math.PI) / 180;
    const dx = x - 50;
    const dy = y - 50;
    x = 50 + dx * Math.cos(radians) - dy * Math.sin(radians);
    y = 50 + dx * Math.sin(radians) + dy * Math.cos(radians);
  }
  return {
    x,
    y,
  };
}

function baseCoordinatePercent(
  rawX: number,
  rawY: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  options: Pick<MapCalibrationLayer, "flipX" | "flipY" | "swapXY">,
) {
  const baseX = options.swapXY ? rawY : rawX;
  const baseY = options.swapXY ? rawX : rawY;
  const minX = options.swapXY ? bounds.minY : bounds.minX;
  const maxX = options.swapXY ? bounds.maxY : bounds.maxX;
  const minY = options.swapXY ? bounds.minX : bounds.minY;
  const maxY = options.swapXY ? bounds.maxX : bounds.maxY;
  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1, maxY - minY);
  let x = ((baseX - minX) / xRange) * 100;
  let y = ((baseY - minY) / yRange) * 100;
  x = options.flipX ? 100 - x : x;
  y = options.flipY ? 100 - y : y;
  return { x, y };
}

function coordinateBounds(points: SpawnMapPoint[]) {
  const xs = points.map((point) => point.x).filter((value): value is number => typeof value === "number");
  const ys = points.map((point) => point.y).filter((value): value is number => typeof value === "number");
  if (!xs.length || !ys.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function padBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }, paddingRatio = 0.05) {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const padX = width * paddingRatio;
  const padY = height * paddingRatio;
  return {
    minX: bounds.minX - padX,
    maxX: bounds.maxX + padX,
    minY: bounds.minY - padY,
    maxY: bounds.maxY + padY,
  };
}

function boundsToViewBox(bounds: { minX: number; maxX: number; minY: number; maxY: number }): NativeViewBox {
  return {
    minX: bounds.minX,
    minY: bounds.minY,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  };
}

function combineBounds(boundsList: Array<{ minX: number; maxX: number; minY: number; maxY: number }>) {
  const usable = boundsList.filter((bounds) => Number.isFinite(bounds.minX) && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxY));
  if (!usable.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return {
    minX: Math.min(...usable.map((bounds) => bounds.minX)),
    maxX: Math.max(...usable.map((bounds) => bounds.maxX)),
    minY: Math.min(...usable.map((bounds) => bounds.minY)),
    maxY: Math.max(...usable.map((bounds) => bounds.maxY)),
  };
}

function nativePointBounds(points: NativeMapPoint[]) {
  const xs = points.map((point) => point.x).filter((value): value is number => typeof value === "number");
  const ys = points.map((point) => point.y).filter((value): value is number => typeof value === "number");
  if (!xs.length || !ys.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function nativeCoordinateValue(point: Pick<NativeMapPoint, "x" | "y" | "z">, axis: SpawnAxis) {
  return point[axis] ?? 0;
}

function rotateSpawnCoordinates(point: NativeMapPoint, transform: Pick<SpawnTransform, "rotateX" | "rotateY" | "rotateZ">) {
  let x = point.x ?? 0;
  let y = point.y ?? 0;
  let z = point.z ?? 0;
  const rotate = (degrees: number) => (degrees * Math.PI) / 180;

  if (transform.rotateX) {
    const radians = rotate(transform.rotateX);
    const nextY = y * Math.cos(radians) - z * Math.sin(radians);
    const nextZ = y * Math.sin(radians) + z * Math.cos(radians);
    y = nextY;
    z = nextZ;
  }

  if (transform.rotateY) {
    const radians = rotate(transform.rotateY);
    const nextX = x * Math.cos(radians) + z * Math.sin(radians);
    const nextZ = -x * Math.sin(radians) + z * Math.cos(radians);
    x = nextX;
    z = nextZ;
  }

  if (transform.rotateZ) {
    const radians = rotate(transform.rotateZ);
    const nextX = x * Math.cos(radians) - y * Math.sin(radians);
    const nextY = x * Math.sin(radians) + y * Math.cos(radians);
    x = nextX;
    y = nextY;
  }

  return { x, y, z };
}

function applySpawnTransform(
  point: NativeMapPoint,
  transform: SpawnTransform,
  _bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const rotatedPoint = rotateSpawnCoordinates(point, transform);
  let a = nativeCoordinateValue(rotatedPoint, transform.axisA);
  let b = nativeCoordinateValue(rotatedPoint, transform.axisB);

  if (transform.flipA) a *= -1;
  if (transform.flipB) b *= -1;

  return {
    x: a * transform.scaleA + transform.offsetA,
    y: b * transform.scaleB + transform.offsetB,
  };
}

function transformedPointBounds(points: Array<{ x: number; y: number }>) {
  if (!points.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function isPointInsideBounds(point: { x: number; y: number }, bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function distanceToSegment(point: { x: number; y: number }, line: MapLine) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - line.x1, point.y - line.y1);
  const t = Math.max(0, Math.min(1, ((point.x - line.x1) * dx + (point.y - line.y1) * dy) / lengthSquared));
  const projectedX = line.x1 + t * dx;
  const projectedY = line.y1 + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function nearestLineDistance(point: { x: number; y: number }, lines: MapLine[]) {
  if (!lines.length) return Number.POSITIVE_INFINITY;
  let nearest = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    const distance = distanceToSegment(point, line);
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}

function median(values: number[]) {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function scoreSpawnTransform(
  spawns: NativeMapPoint[],
  mapLines: MapLine[],
  mapBounds: { minX: number; maxX: number; minY: number; maxY: number },
  transform: SpawnTransform,
): SpawnAlignmentScore {
  const usableSpawns = spawns.filter((spawn) => typeof spawn.x === "number" && typeof spawn.y === "number");
  const distances: number[] = [];
  const transformedPoints: Array<{ x: number; y: number }> = [];
  let inBoundsCount = 0;

  for (const spawn of usableSpawns) {
    const transformed = applySpawnTransform(spawn, transform, mapBounds);
    transformedPoints.push(transformed);
    if (isPointInsideBounds(transformed, mapBounds)) inBoundsCount += 1;
    const distance = nearestLineDistance(transformed, mapLines);
    if (Number.isFinite(distance)) distances.push(distance);
  }

  const averageDistance = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : Number.POSITIVE_INFINITY;
  return {
    averageDistance,
    axisA: transform.axisA,
    axisB: transform.axisB,
    inBoundsCount,
    medianDistance: median(distances),
    outOfBoundsCount: usableSpawns.length - inBoundsCount,
    transformedBounds: transformedPointBounds(transformedPoints),
    transformKey: transform.key,
  };
}

function compareSpawnScores(a: SpawnAlignmentScore, b: SpawnAlignmentScore) {
  return (
    b.inBoundsCount - a.inBoundsCount
    || a.medianDistance - b.medianDistance
    || a.averageDistance - b.averageDistance
    || a.outOfBoundsCount - b.outOfBoundsCount
    || a.transformKey.localeCompare(b.transformKey)
  );
}

function findBestSpawnTransform(
  spawns: NativeMapPoint[],
  mapLines: MapLine[],
  mapBounds: { minX: number; maxX: number; minY: number; maxY: number },
): ScoredSpawnTransform | null {
  if (!mapLines.length) return null;
  const scored = spawnTransformCandidates.map((transform) => ({
    score: scoreSpawnTransform(spawns, mapLines, mapBounds, transform),
    transform,
  }));
  scored.sort((a, b) => compareSpawnScores(a.score, b.score));
  return scored[0] ?? null;
}

function SpawnMapPrototype({ map }: { map: SpawnMapPrototypeData }) {
  const zoneKey = "cazicthule";
  const mapAsset = zoneMapAssets[zoneKey];
  const mapCalibration = zoneMapCalibrations[zoneKey];
  const mapCalibrationLayers = Array.isArray(mapCalibration?.layers) ? mapCalibration.layers : [];
  const mapPoints = useMemo(() => Array.isArray(map.points) ? map.points : [], [map.points]);
  const defaultCalibration = mapCalibrationLayers.find((layer) => layer.key === mapCalibration?.defaultLayerKey) ?? mapCalibrationLayers[0] ?? {
    key: "fallback",
    name: "Fallback",
    mapImage: null,
    mapVectorKey: null,
    zMin: null,
    zMax: null,
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    flipX: false,
    flipY: false,
    swapXY: false,
    rotation: 0,
  };
  const [activeLayerKey, setActiveLayerKey] = useState(defaultCalibration.key);
  const [raceFilter, setRaceFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [dotOpacity, setDotOpacity] = useState(0.9);
  const [dotSize, setDotSize] = useState(8);
  const [copiedCalibration, setCopiedCalibration] = useState(false);
  const [calibration, setCalibration] = useState(defaultCalibration);
  const [boundsMode, setBoundsMode] = useState<BoundsMode>("map");
  const [anchors, setAnchors] = useState<AnchorPoint[]>([]);
  const normalizedRace = raceFilter.trim().toLowerCase();
  const normalizedName = nameFilter.trim().toLowerCase();
  const min = /^\d+$/.test(minLevel.trim()) ? Number(minLevel.trim()) : null;
  const max = /^\d+$/.test(maxLevel.trim()) ? Number(maxLevel.trim()) : null;

  const pointsWithCoordinates = useMemo(
    () => mapPoints.filter((point) => typeof point.x === "number" && typeof point.y === "number"),
    [mapPoints],
  );
  const bounds = useMemo(() => {
    if (mapAsset?.bounds) return mapAsset.bounds;
    const xs = pointsWithCoordinates.map((point) => point.x ?? 0);
    const ys = pointsWithCoordinates.map((point) => point.y ?? 0);
    if (!xs.length || !ys.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [mapAsset, pointsWithCoordinates]);
  const spawnBounds = useMemo(() => coordinateBounds(pointsWithCoordinates), [pointsWithCoordinates]);
  const activeBounds = boundsMode === "spawn" ? spawnBounds : bounds;
  const filteredPoints = useMemo(() => pointsWithCoordinates.filter((point) => {
    if (normalizedRace && !String(point.race ?? "").toLowerCase().includes(normalizedRace) && !String(point.rawRace ?? "").toLowerCase().includes(normalizedRace)) return false;
    if (normalizedName && !String(point.displayName ?? "").toLowerCase().includes(normalizedName) && !String(point.name ?? "").toLowerCase().includes(normalizedName)) return false;
    if (min !== null && (point.level === null || point.level < min)) return false;
    if (max !== null && (point.level === null || point.level > max)) return false;
    return true;
  }), [pointsWithCoordinates, normalizedRace, normalizedName, min, max]);
  const transformedFilteredPoints = useMemo(() => filteredPoints.map((point) => ({
    point,
    position: transformCoordinateNumeric(point.x ?? 0, point.y ?? 0, activeBounds, calibration),
  })), [activeBounds, calibration, filteredPoints]);
  const visibleSpawnCount = transformedFilteredPoints.filter(({ position }) => position.x >= 0 && position.x <= 100 && position.y >= 0 && position.y <= 100).length;
  const outOfBoundsSpawnCount = transformedFilteredPoints.length - visibleSpawnCount;
  const races = useMemo(() => raceSuggestions(mapPoints), [mapPoints]);
  const activeLayer = mapCalibrationLayers.find((layer) => layer.key === activeLayerKey) ?? calibration;
  const activeVectorLayer = mapAsset?.layers?.find((layer) => layer.key === activeLayer.mapVectorKey);
  const viewBox = `${bounds.minX} ${bounds.minY} ${Math.max(1, bounds.maxX - bounds.minX)} ${Math.max(1, bounds.maxY - bounds.minY)}`;
  const calibrationJson = JSON.stringify({
    [zoneKey]: {
      ...mapCalibration,
      defaultLayerKey: activeLayerKey,
      experiment: {
        note: "Map alignment experiment. Spawn coordinates and map art may use different coordinate systems.",
        boundsMode,
        anchors,
        diagnostics: {
          spawnBounds,
          mapBounds: bounds,
          visibleSpawnCount,
          outOfBoundsSpawnCount,
        },
      },
      layers: [{ ...calibration, key: activeLayerKey }],
    },
  }, null, 2);

  function setCalibrationNumber(key: "offsetX" | "offsetY" | "rotation" | "scaleX" | "scaleY", value: string) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    setCalibration((current) => ({ ...current, [key]: parsed }));
  }

  function selectLayer(key: string) {
    const nextLayer = mapCalibrationLayers.find((layer) => layer.key === key);
    setActiveLayerKey(key);
    if (nextLayer) setCalibration(nextLayer);
  }

  function applyTransformMode(modeKey: string) {
    const mode = transformModes.find((entry) => entry.key === modeKey);
    if (!mode) return;
    setCalibration((current) => ({
      ...current,
      flipX: mode.flipX,
      flipY: mode.flipY,
      rotation: mode.rotation,
      swapXY: mode.swapXY,
    }));
  }

  function resetCalibration() {
    setCalibration({ ...defaultCalibration });
    setBoundsMode("map");
    setAnchors([]);
  }

  function tryCommonEqOrientation() {
    setCalibration((current) => ({
      ...current,
      flipX: false,
      flipY: true,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      swapXY: false,
    }));
    setBoundsMode("map");
  }

  function centerOnSpawns() {
    const allPositions = pointsWithCoordinates.map((point) => transformCoordinateNumeric(point.x ?? 0, point.y ?? 0, activeBounds, calibration));
    if (!allPositions.length) return;
    const centerX = allPositions.reduce((sum, point) => sum + point.x, 0) / allPositions.length;
    const centerY = allPositions.reduce((sum, point) => sum + point.y, 0) / allPositions.length;
    setCalibration((current) => ({
      ...current,
      offsetX: Number((current.offsetX + 50 - centerX).toFixed(2)),
      offsetY: Number((current.offsetY + 50 - centerY).toFixed(2)),
    }));
  }

  function fitToSpawnBounds() {
    setBoundsMode("spawn");
    setCalibration((current) => ({
      ...current,
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
    }));
  }

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    if (anchors.length >= 3) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mapX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const mapY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    setAnchors((current) => [...current, {
      id: Date.now(),
      mapX: Number(mapX.toFixed(2)),
      mapY: Number(mapY.toFixed(2)),
      eqX: "",
      eqY: "",
    }]);
  }

  function updateAnchor(id: number, key: "eqX" | "eqY", value: string) {
    setAnchors((current) => current.map((anchor) => anchor.id === id ? { ...anchor, [key]: value } : anchor));
  }

  function removeAnchor(id: number) {
    setAnchors((current) => current.filter((anchor) => anchor.id !== id));
  }

  function applyAnchorCalibration() {
    const validAnchors = anchors
      .map((anchor) => ({
        ...anchor,
        numericEqX: Number(anchor.eqX),
        numericEqY: Number(anchor.eqY),
      }))
      .filter((anchor) => Number.isFinite(anchor.numericEqX) && Number.isFinite(anchor.numericEqY));
    if (validAnchors.length < 2) return;
    const [first, second] = validAnchors;
    const firstBase = baseCoordinatePercent(first.numericEqX, first.numericEqY, activeBounds, calibration);
    const secondBase = baseCoordinatePercent(second.numericEqX, second.numericEqY, activeBounds, calibration);
    const nextScaleX = Math.abs(secondBase.x - firstBase.x) > 0.001
      ? (second.mapX - first.mapX) / (secondBase.x - firstBase.x)
      : calibration.scaleX;
    const nextScaleY = Math.abs(secondBase.y - firstBase.y) > 0.001
      ? (second.mapY - first.mapY) / (secondBase.y - firstBase.y)
      : calibration.scaleY;
    const nextOffsetX = first.mapX - (50 + (firstBase.x - 50) * nextScaleX);
    const nextOffsetY = first.mapY - (50 + (firstBase.y - 50) * nextScaleY);
    setCalibration((current) => ({
      ...current,
      offsetX: Number(nextOffsetX.toFixed(2)),
      offsetY: Number(nextOffsetY.toFixed(2)),
      scaleX: Number(nextScaleX.toFixed(4)),
      scaleY: Number(nextScaleY.toFixed(4)),
    }));
  }

  async function copyCalibrationJson() {
    setCopiedCalibration(false);
    try {
      await navigator.clipboard.writeText(calibrationJson);
      setCopiedCalibration(true);
    } catch {
      setCopiedCalibration(false);
    }
  }

  return (
    <details className="zones-expandable-section zones-spawn-map-section" open>
      <summary>
        <span>Spawn Map Prototype</span>
        <small>{filteredPoints.length} spawn slots</small>
      </summary>
      <div className="zones-expandable-body">
        <p className="zones-map-note">
          Source: {map.sourceKind}. Counts use highest-chance candidate per spawn group. Imported zone snapshot; not a guaranteed live spawn list.
        </p>
        <p className="zones-map-note">
          Map alignment experiment. Spawn coordinates and map art may use different coordinate systems.
        </p>
        <div className="zones-map-toolbar">
          <label className="zone-filter">
            <span>Mob race</span>
            <input
              autoComplete="off"
              list="cazic-map-races"
              onChange={(event) => setRaceFilter(event.target.value)}
              placeholder="lizard, golem, spider"
              type="search"
              value={raceFilter}
            />
            <datalist id="cazic-map-races">
              {races.map((race) => <option key={race} value={race} />)}
            </datalist>
          </label>
          <label className="zone-filter">
            <span>Mob name</span>
            <input onChange={(event) => setNameFilter(event.target.value)} placeholder="Search name" type="search" value={nameFilter} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Min level</span>
            <input inputMode="numeric" onChange={(event) => setMinLevel(event.target.value)} type="number" value={minLevel} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Max level</span>
            <input inputMode="numeric" onChange={(event) => setMaxLevel(event.target.value)} type="number" value={maxLevel} />
          </label>
          {mapCalibration ? (
            <label className="zone-filter zones-map-layer-filter">
              <span>Map layer</span>
              <select onChange={(event) => selectLayer(event.target.value)} value={activeLayerKey}>
                {mapCalibrationLayers.map((layer) => <option key={layer.key} value={layer.key}>{layer.name}</option>)}
              </select>
            </label>
          ) : null}
          <div className="zones-map-toggle-group" aria-label="Coordinate toggles">
            <button className={showMap ? "filter-button is-active" : "filter-button"} onClick={() => setShowMap((value) => !value)} type="button">Map</button>
            <button className={showGrid ? "filter-button is-active" : "filter-button"} onClick={() => setShowGrid((value) => !value)} type="button">Grid</button>
          </div>
        </div>
        <div className="zones-transform-panel">
          <label className="zones-transform-select">
            <span>Transform mode</span>
            <select
              onChange={(event) => applyTransformMode(event.target.value)}
              value={transformModes.find((mode) =>
                mode.flipX === calibration.flipX
                && mode.flipY === calibration.flipY
                && mode.swapXY === calibration.swapXY
                && mode.rotation === calibration.rotation
              )?.key ?? "custom"}
            >
              <option value="custom">Custom</option>
              {transformModes.map((mode) => <option key={mode.key} value={mode.key}>{mode.label}</option>)}
            </select>
          </label>
          <button className="filter-button" onClick={fitToSpawnBounds} type="button">Fit to spawn bounds</button>
          <button className="filter-button" onClick={centerOnSpawns} type="button">Center on spawns</button>
          <button className="filter-button" onClick={tryCommonEqOrientation} type="button">Try common EQ orientation</button>
          <button className="filter-button" onClick={resetCalibration} type="button">Reset</button>
        </div>
        <div className="zones-calibration-panel">
          <label><span>Scale X</span><input step="0.01" type="number" value={calibration.scaleX} onChange={(event) => setCalibrationNumber("scaleX", event.target.value)} /></label>
          <label><span>Scale Y</span><input step="0.01" type="number" value={calibration.scaleY} onChange={(event) => setCalibrationNumber("scaleY", event.target.value)} /></label>
          <label><span>Offset X</span><input step="0.5" type="number" value={calibration.offsetX} onChange={(event) => setCalibrationNumber("offsetX", event.target.value)} /></label>
          <label><span>Offset Y</span><input step="0.5" type="number" value={calibration.offsetY} onChange={(event) => setCalibrationNumber("offsetY", event.target.value)} /></label>
          <label><span>Rotation</span><input step="1" type="number" value={calibration.rotation} onChange={(event) => setCalibrationNumber("rotation", event.target.value)} /></label>
          <label><span>Dot size</span><input max="18" min="3" step="1" type="number" value={dotSize} onChange={(event) => setDotSize(Number(event.target.value) || 8)} /></label>
          <label><span>Dot opacity</span><input max="1" min="0.1" step="0.05" type="number" value={dotOpacity} onChange={(event) => setDotOpacity(Number(event.target.value) || 0.9)} /></label>
          <button className={calibration.flipX ? "filter-button is-active" : "filter-button"} onClick={() => setCalibration((current) => ({ ...current, flipX: !current.flipX }))} type="button">Flip X</button>
          <button className={calibration.flipY ? "filter-button is-active" : "filter-button"} onClick={() => setCalibration((current) => ({ ...current, flipY: !current.flipY }))} type="button">Flip Y</button>
          <button className={calibration.swapXY ? "filter-button is-active" : "filter-button"} onClick={() => setCalibration((current) => ({ ...current, swapXY: !current.swapXY }))} type="button">Swap X/Y</button>
          <button className="filter-button" onClick={copyCalibrationJson} type="button">{copiedCalibration ? "Copied" : "Copy calibration JSON"}</button>
        </div>
        <div className="zones-anchor-panel">
          <div className="zones-anchor-heading">
            <strong>Manual anchors</strong>
            <span>Click the map to place up to 3 anchors, then enter matching EQ x/y.</span>
          </div>
          {anchors.length ? (
            <div className="zones-anchor-list">
              {anchors.map((anchor, index) => (
                <div className="zones-anchor-row" key={anchor.id}>
                  <span>Anchor {index + 1}: {anchor.mapX}%, {anchor.mapY}%</span>
                  <input aria-label={`Anchor ${index + 1} EQ X`} onChange={(event) => updateAnchor(anchor.id, "eqX", event.target.value)} placeholder="EQ X" type="number" value={anchor.eqX} />
                  <input aria-label={`Anchor ${index + 1} EQ Y`} onChange={(event) => updateAnchor(anchor.id, "eqY", event.target.value)} placeholder="EQ Y" type="number" value={anchor.eqY} />
                  <button className="filter-button" onClick={() => removeAnchor(anchor.id)} type="button">Remove</button>
                </div>
              ))}
            </div>
          ) : <p>No anchors placed yet.</p>}
          <div className="zones-anchor-actions">
            <button className="filter-button" disabled={anchors.length < 2} onClick={applyAnchorCalibration} type="button">Apply 2-anchor scale/offset</button>
            <button className="filter-button" onClick={() => setAnchors([])} type="button">Clear anchors</button>
          </div>
        </div>
        <div className="zones-map-diagnostics">
          <div><span>Bounds</span><strong>{boundsMode === "spawn" ? "Spawn bounds" : "Map bounds"}</strong></div>
          <div><span>Spawn X</span><strong>{spawnBounds.minX.toFixed(0)} to {spawnBounds.maxX.toFixed(0)}</strong></div>
          <div><span>Spawn Y</span><strong>{spawnBounds.minY.toFixed(0)} to {spawnBounds.maxY.toFixed(0)}</strong></div>
          <div><span>Map width</span><strong>{(bounds.maxX - bounds.minX).toFixed(0)}</strong></div>
          <div><span>Map height</span><strong>{(bounds.maxY - bounds.minY).toFixed(0)}</strong></div>
          <div><span>Visible spawns</span><strong>{visibleSpawnCount}</strong></div>
          <div><span>Out of bounds</span><strong>{outOfBoundsSpawnCount}</strong></div>
          <div><span>Rotation</span><strong>{calibration.rotation} deg</strong></div>
        </div>
        <div className={showGrid ? "zones-spawn-map has-grid" : "zones-spawn-map"} aria-label="Cazic-Thule spawn map prototype" onClick={handleMapClick}>
          {showMap && activeVectorLayer ? (
            <svg aria-hidden="true" className="zones-map-vector" preserveAspectRatio="xMidYMid meet" viewBox={viewBox}>
              {activeVectorLayer.lines.map((line, index) => (
                <line
                  key={`${activeVectorLayer.key}-line-${index}`}
                  stroke={line.color}
                  strokeLinecap="round"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                  x1={line.x1}
                  x2={line.x2}
                  y1={line.y1}
                  y2={line.y2}
                />
              ))}
            </svg>
          ) : null}
          {anchors.map((anchor, index) => (
            <span
              className="zones-map-anchor"
              key={anchor.id}
              style={{ left: `${anchor.mapX}%`, top: `${anchor.mapY}%` }}
            >
              {index + 1}
            </span>
          ))}
          {filteredPoints.map((point, index) => {
            const position = normalizeMapPoint(point, activeBounds, calibration);
            const title = `${point.displayName}\nLevel: ${point.level ?? "Unknown"}\nRace: ${point.race}\nClass: ${point.className}\nChance: ${point.chance ?? "Unknown"}%\nRespawn: ${point.respawnTime ?? "Unknown"}\nLoc: ${point.x}, ${point.y}, ${point.z}`;
            return (
              <button
                aria-label={`${point.displayName}, level ${point.level ?? "unknown"}`}
                className="zones-spawn-point"
                key={`prototype-spawn-${point.spawnGroupIndex ?? "unknown"}-${point.name ?? point.displayName ?? "mob"}-${point.x ?? "x"}-${point.y ?? "y"}-${point.z ?? "z"}-${index}`}
                onClick={(event) => event.stopPropagation()}
                style={{ ...position, height: `${dotSize}px`, opacity: dotOpacity, width: `${dotSize}px` }}
                title={title}
                type="button"
              >
                <span className="zones-spawn-point-tooltip">
                  <strong>{point.displayName}</strong>
                  <small>Level {point.level ?? "Unknown"} {point.race}</small>
                  <small>{point.className} - {point.chance ?? "?"}% - respawn {point.respawnTime ?? "?"}</small>
                  <small>{point.x}, {point.y}, {point.z}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="zones-map-note">{map.coordinateNote}</p>
      </div>
    </details>
  );
}

function formatRespawn(seconds: number | null) {
  if (seconds === null) return "Unknown";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

const namedTitlePattern = /\b(archon|avatar|baron|baroness|captain|chief|commander|count|countess|disciple|duke|duchess|emperor|empress|general|guardian|herald|king|knight|lady|lord|master|mistress|oracle|priest|prince|princess|prophet|queen|sage|seer|sentinel|sovereign|thex|viscount|warlord)\b/i;
const genericRolePattern = /\b(apprentice|archer|assassin|caster|champion|cleric|defender|guard|guardian|healer|knight|mage|minion|mystic|oracle|overseer|patriarch|priest|prisoner|protector|rogue|scout|sentinel|shaman|soldier|spirit|templar|warrior|wizard)\b/i;
const genericRacePattern = /\b(aviak|bat|beetle|brownie|crawler|drake|elemental|froglok|ghoul|giant|gnoll|goblin|golem|guard|imp|kobold|lizard|orc|piranha|rat|skeleton|snake|spider|tadpole|troll|wolf|zombie)\b/i;
const utilityClassPattern = /\b(banker|merchant|guildmaster|guild master|shopkeeper|trader|vendor|tribute master)\b/i;
const utilityNamePattern = /\b(banker|merchant|vendor|guildmaster|guild master|shopkeeper|soulbinder|soul binder|priest of discord|teleporter|translocator|portal|tribute master|adventure recruiter|parcel merchant|guard captain)\b/i;
const namedLootNamePattern = /\b(amulet|band|belt|blade|breastplate|bracer|cape|cloak|cord|crown|dagger|fang|gauntlets|gloves|greaves|hammer|heart|helm|jereed|leggings|mask|orb|robe|ring|scale|shield|sleeves|spear|staff|talisman|vambraces|wand)\b/i;

function isStaticUtilityCandidate(candidate: Pick<EqemuSpawnCandidate, "className" | "displayName" | "name">) {
  const className = String(candidate.className ?? "");
  const displayName = String(candidate.displayName ?? "");
  const rawName = String(candidate.name ?? "").replace(/_/g, " ");
  return utilityClassPattern.test(className) || utilityNamePattern.test(displayName) || utilityNamePattern.test(rawName);
}

function isGenericSpawnName(candidate: Pick<EqemuSpawnCandidate, "displayName" | "name">) {
  const rawName = String(candidate.name ?? "").toLowerCase();
  const name = normalizeSpawnMapTargetName(candidate.displayName || candidate.name);
  if (!name || rawName.startsWith("#")) return false;
  if (namedTitlePattern.test(name)) return false;
  return genericRacePattern.test(name) || genericRolePattern.test(name);
}

function isLikelyNamed(candidate: Pick<EqemuSpawnCandidate, "displayName" | "name">) {
  const rawName = String(candidate.name ?? "").toLowerCase();
  if (rawName.startsWith("#")) return true;
  const name = String(candidate.displayName ?? "").trim();
  if (namedTitlePattern.test(name)) return true;
  if (isGenericSpawnName(candidate)) return false;
  return !/^(a|an|the)\s+/i.test(name) && !/\b(trap|unknown|radiant|raidstopper)\b/i.test(name);
}

function hasSpecificNamedDisplay(candidate: Pick<EqemuSpawnCandidate, "displayName" | "name">) {
  const name = String(candidate.displayName || candidate.name || "").replace(/_/g, " ").trim();
  return Boolean(name)
    && !/^(a|an|the)\s+/i.test(name)
    && !/\b(trap|unknown|radiant|raidstopper)\b/i.test(name);
}

function isPlayerRelevantNamedCandidate(
  candidate: EqemuSpawnCandidate,
  spawn: Pick<EqemuPrimarySpawn, "candidates"> | undefined,
  dropStats: ReturnType<typeof lootMobDropStats>,
  isManualOverride: boolean,
  spawnPointCount: number | null = null,
) {
  if (isManualOverride) return true;
  if (candidateIsEpicSource(candidate) || candidateIsSiteRareSource(candidate)) return true;
  if (isStaticUtilityCandidate(candidate)) return false;
  if (isCommonPopulationCandidate(candidate, dropStats, spawnPointCount, isManualOverride)) return false;
  return dropStats.hasMeaningfulDrops && isLikelyNamed(candidate);
}

function spawnFootprintPenalty(spawnPointCount: number | null) {
  if (typeof spawnPointCount !== "number") return 0;
  if (spawnPointCount >= 30) return 3;
  if (spawnPointCount >= 20) return 2;
  if (spawnPointCount >= 12) return 1;
  return 0;
}

function isCommonPopulationCandidate(
  candidate: EqemuSpawnCandidate,
  dropStats: ReturnType<typeof lootMobDropStats>,
  spawnPointCount: number | null,
  isManualOverride: boolean,
) {
  if (isManualOverride || candidateIsEpicSource(candidate) || candidateIsSiteRareSource(candidate)) return false;
  if (String(candidate.name ?? "").startsWith("#")) return false;
  const chance = candidate.chance ?? 100;
  const penalty = spawnFootprintPenalty(spawnPointCount);
  if (penalty < 2) return false;
  if (chance <= 20) return false;
  if (dropStats.epicItemCount > 0) return false;
  return true;
}

function candidateLabels(candidate: EqemuSpawnCandidate, spawn?: EqemuPrimarySpawn) {
  const labels: string[] = [];
  if (isStaticUtilityCandidate(candidate)) labels.push("Static utility NPC");
  else if (isLikelyNamed(candidate)) labels.push("Named candidate");
  if ((candidate.chance ?? 100) <= 20) labels.push("Low chance");
  if ((spawn?.candidates ?? []).length > 1) labels.push("Placeholder group");
  if ((spawn?.respawnTime ?? 0) >= 1800) labels.push("Long respawn");
  if (labels.length === 0) labels.push("Common candidate");
  return labels;
}

function candidateSearchText(candidate: EqemuSpawnCandidate) {
  return `${candidate.displayName ?? ""} ${candidate.name ?? ""}`.toLowerCase();
}

function normalizeSpawnMapName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^#+/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isSuppressedRealSpawnNpcName(value: string | null | undefined) {
  return suppressedRealSpawnNpcNames.has(normalizeSpawnMapName(value));
}

function isSuppressedRealSpawnCandidate(candidate: Pick<EqemuSpawnCandidate, "displayName" | "name">) {
  return isSuppressedRealSpawnNpcName(candidate.displayName) || isSuppressedRealSpawnNpcName(candidate.name);
}

function isDrogaRealSpawnPayload(value: { zoneShortName?: string | null } | null | undefined) {
  return (value?.zoneShortName ?? "").toLowerCase() === "droga";
}

function isOriginalDrogaLevel(level: number | null | undefined) {
  return typeof level === "number" && level < 41;
}

function sanitizeEqemuSpawnData(spawnData: EqemuSpawnTestData | null | undefined): EqemuSpawnTestData | null {
  if (!spawnData || !Array.isArray(spawnData.primarySpawnRows)) return spawnData ?? null;
  const filterDrogaOriginal = isDrogaRealSpawnPayload(spawnData);
  const primarySpawnRows = spawnData.primarySpawnRows.flatMap((spawn) => {
    const candidates = (Array.isArray(spawn.candidates) ? spawn.candidates : []).filter((candidate) => (
      !isSuppressedRealSpawnCandidate(candidate)
      && (!filterDrogaOriginal || isOriginalDrogaLevel(candidate.level))
    ));
    if (!candidates.length) return [];
    if (
      !isSuppressedRealSpawnNpcName(spawn.displayName)
      && !isSuppressedRealSpawnNpcName(spawn.primaryNpcName)
      && (!filterDrogaOriginal || isOriginalDrogaLevel(spawn.level))
    ) {
      return [{ ...spawn, candidateCount: candidates.length, candidates }];
    }
    const replacement = candidates[0];
    return [{
      ...spawn,
      candidateCount: candidates.length,
      candidates,
      primaryNpcId: replacement.npcTypeId,
      primaryNpcName: replacement.name,
      displayName: replacement.displayName,
      level: replacement.level,
      race: replacement.race,
      className: replacement.className,
      chance: replacement.chance,
    }];
  });
  return {
    ...spawnData,
    candidateCount: primarySpawnRows.reduce((sum, spawn) => sum + spawn.candidates.length, 0),
    primarySpawnRows,
    spawnSlotCount: primarySpawnRows.length,
  };
}

function sanitizeEqemuLootData(lootData: EqemuLootTestData | null | undefined): EqemuLootTestData | null {
  if (!lootData || !Array.isArray(lootData.mobs)) return lootData ?? null;
  const filterDrogaOriginal = isDrogaRealSpawnPayload(lootData);
  return {
    ...lootData,
    mobs: lootData.mobs.filter((mob) => (
      !isSuppressedRealSpawnNpcName(mob.displayName)
      && !isSuppressedRealSpawnNpcName(mob.rawName)
      && (!filterDrogaOriginal || isOriginalDrogaLevel(mob.level))
    )),
  };
}

function normalizeSpawnMapTargetName(value: string | null | undefined) {
  return normalizeSpawnMapName(value).replace(/^(a|an|the)\s+/, "");
}

function makeRealSpawnFocus(candidate: EqemuSpawnCandidate, spawn: EqemuPrimarySpawn | undefined, source: RealSpawnFocus["source"]): RealSpawnFocus {
  const mobName = candidate.displayName || candidate.name || spawn?.displayName || "Unknown";
  return {
    mobName,
    normalizedMobName: normalizeSpawnMapTargetName(mobName),
    npcTypeId: candidate.npcTypeId >= 0 ? candidate.npcTypeId : null,
    source,
    spawn2Id: spawn?.spawn2Id ?? null,
    spawngroupId: spawn?.spawngroupId ?? null,
  };
}

function realSpawnFocusMatchesCandidate(focus: RealSpawnFocus | null, candidate: EqemuSpawnCandidate) {
  if (!focus) return true;
  if (typeof focus.npcTypeId === "number" && focus.npcTypeId >= 0 && candidate.npcTypeId === focus.npcTypeId) return true;
  const candidateNames = [
    normalizeSpawnMapTargetName(candidate.displayName),
    normalizeSpawnMapTargetName(candidate.name),
  ].filter(Boolean);
  return candidateNames.some((name) => name === focus.normalizedMobName || name.includes(focus.normalizedMobName));
}

function realSpawnFocusMatchesSpawn(focus: RealSpawnFocus | null, spawn: EqemuPrimarySpawn) {
  if (!focus) return true;
  if (typeof focus.spawn2Id === "number" && spawn.spawn2Id === focus.spawn2Id) return true;
  return (spawn.candidates ?? []).some((candidate) => realSpawnFocusMatchesCandidate(focus, candidate));
}

function candidateMatchesNamedOverride(candidate: EqemuSpawnCandidate, overrides: string[]) {
  if (!overrides.length) return false;
  const candidateNames = [
    normalizeSpawnMapTargetName(candidate.displayName),
    normalizeSpawnMapTargetName(candidate.name),
  ].filter(Boolean);
  const overrideNames = overrides.map(normalizeSpawnMapTargetName).filter(Boolean);
  return overrideNames.some((overrideName) => candidateNames.some((candidateName) => (
    candidateName === overrideName || candidateName.includes(overrideName)
  )));
}

function playerRareSourceForCandidate(candidate: Pick<EqemuSpawnCandidate, "displayName" | "name">) {
  const names = [
    normalizeSpawnMapTargetName(candidate.displayName),
    normalizeSpawnMapTargetName(candidate.name),
  ].filter(Boolean);
  for (const name of names) {
    const source = realSpawnPlayerRareSources.mobSources[name];
    if (source) return source;
  }
  return undefined;
}

function candidateIsEpicSource(candidate: Pick<EqemuSpawnCandidate, "displayName" | "name">) {
  return playerRareSourceForCandidate(candidate)?.sourceKinds?.includes("epic-source-mob") ?? false;
}

function candidateIsSiteRareSource(candidate: Pick<EqemuSpawnCandidate, "displayName" | "name">) {
  return playerRareSourceForCandidate(candidate)?.sourceKinds?.includes("group-named-loot") ?? false;
}

function lootMobDropCount(mob: EqemuLootMob | undefined) {
  const itemIds = new Set<string>();
  for (const lootdrop of mob?.lootdrops ?? []) {
    for (const item of lootdrop.items ?? []) {
      itemIds.add(String(item.itemId || item.itemName || "unknown"));
    }
  }
  return itemIds.size;
}

function eqemuLootItemHasStatsOrGear(item: EqemuLootItem) {
  const raw = item.itemDetails;
  if (!raw) return false;
  const hasEquipmentSlot = typeof raw.slots === "number" && raw.slots > 0;
  const hasCoreStats = [
    raw.ac,
    raw.damage,
    raw.delay,
    raw.attack,
    raw.accuracy,
    raw.avoidance,
    raw.haste,
    raw.regen,
    raw.manaregen,
    raw.enduranceregen,
  ].some((value) => typeof value === "number" && value !== 0);
  const hasStats = Object.values(raw.stats ?? {}).some((value) => typeof value === "number" && value !== 0)
    || Object.values(raw.resists ?? {}).some((value) => typeof value === "number" && value !== 0);
  const isEquipmentLike = hasEquipmentSlot && raw.itemtype !== 17;
  return isEquipmentLike || hasCoreStats || hasStats;
}

function zoneLootItemKey(item: Pick<EqemuLootItem, "itemId" | "itemName">) {
  return item.itemId ? `id:${item.itemId}` : `name:${normalizeSpawnMapTargetName(item.itemName)}`;
}

function buildZoneLootDistribution(lootMobs: EqemuLootMob[]): ZoneLootDistribution {
  const items = new Map<string, ZoneLootDistributionEntry>();
  for (const mob of lootMobs) {
    if (typeof mob.npcTypeId !== "number") continue;
    const seenForMob = new Set<string>();
    for (const lootdrop of mob.lootdrops ?? []) {
      for (const item of lootdrop.items ?? []) {
        const key = zoneLootItemKey(item);
        if (!key || seenForMob.has(key)) continue;
        seenForMob.add(key);
        const current = items.get(key);
        if (current) {
          current.sourceNpcTypeIds.add(mob.npcTypeId);
          current.sourceMobCount = current.sourceNpcTypeIds.size;
        } else {
          items.set(key, {
            itemName: item.itemName ?? item.itemDetails?.name ?? "Unknown item",
            sourceMobCount: 1,
            sourceNpcTypeIds: new Set([mob.npcTypeId]),
          });
        }
      }
    }
  }
  return {
    itemCount: items.size,
    mobCount: lootMobs.length,
    items,
  };
}

function commonZoneLootReason(item: EqemuLootItem, distribution?: ZoneLootDistribution) {
  const name = item.itemName ?? item.itemDetails?.name ?? "";
  const sourceMobCount = distribution?.items.get(zoneLootItemKey(item))?.sourceMobCount ?? 1;
  const sourceRatio = distribution?.mobCount ? sourceMobCount / distribution.mobCount : 0;
  if (/\b(coin|copper|silver|gold|platinum|page|rune|runes|words|parchment|scroll|spell:|research|spider silk|spider legs|meat|water|ration|bone chips?)\b/i.test(name)) {
    return "generic vendor/research/spell/junk loot";
  }
  if (/\b(agate|amber|bloodstone|carnelian|diamond|emerald|fire emerald|ivory|jade|jasper|malachite|opal|pearl|peridot|ruby|sapphire|star ruby|topaz|turquoise)\b/i.test(name)) {
    return sourceMobCount > 1 ? "common gem loot" : null;
  }
  if (/\b(cloth|raw-hide|raw hide|rusty|bronze|fine steel|small shield|kite shield|round shield|battle axe|dagger|short sword|long sword|mace|morning star|warhammer)\b/i.test(name)) {
    return sourceMobCount > 2 || sourceRatio >= 0.04 ? "common weapon/armor loot" : null;
  }
  return null;
}

function eqemuLootItemMeaningfulness(item: EqemuLootItem, distribution?: ZoneLootDistribution) {
  if (!item.itemId && !item.itemName) {
    return {
      commonReason: "missing item identity",
      isMeaningful: false,
      isStatGearMeaningful: false,
      isUniqueNamedLoot: false,
      sourceMobCount: 0,
      uniquenessScore: 0,
    };
  }
  const raw = item.itemDetails;
  const name = item.itemName ?? raw?.name ?? "";
  const isEpicItem = epicDropItemNameSet.has(normalizeSpawnMapTargetName(name));
  const distributionEntry = distribution?.items.get(zoneLootItemKey(item));
  const sourceMobCount = distributionEntry?.sourceMobCount ?? 1;
  const sourceRatio = distribution?.mobCount ? sourceMobCount / distribution.mobCount : 0;
  const commonReason = commonZoneLootReason(item, distribution);
  const lowDistribution = sourceMobCount <= 2 || sourceRatio <= 0.025;
  const limitedDistribution = sourceMobCount <= 5 || sourceRatio <= 0.06;
  const hasStatsOrGear = eqemuLootItemHasStatsOrGear(item);
  const hasNamedQualityFlag = raw?.nodrop === 0 || raw?.magic === 1 || Boolean(raw?.lore);
  const hasNamedLootName = namedLootNamePattern.test(name);
  const isUniqueNamedLoot = !commonReason && lowDistribution && (hasNamedLootName || hasStatsOrGear || hasNamedQualityFlag);
  const isMeaningful = isEpicItem || (!commonReason && (
    isUniqueNamedLoot
    || (hasStatsOrGear && lowDistribution)
    || (hasNamedQualityFlag && limitedDistribution)
    || (hasNamedLootName && lowDistribution)
  ));
  return {
    commonReason,
    isEpicItem,
    isMeaningful,
    isStatGearMeaningful: hasStatsOrGear && isMeaningful,
    isUniqueNamedLoot,
    sourceMobCount,
    uniquenessScore: sourceMobCount <= 0 ? 0 : Math.max(0, Math.min(1, 1 - sourceRatio)),
  };
}

function eqemuLootItemIsMeaningful(item: EqemuLootItem, distribution?: ZoneLootDistribution) {
  return eqemuLootItemMeaningfulness(item, distribution).isMeaningful;
}

function lootMobDropStats(mob: EqemuLootMob | undefined, distribution?: ZoneLootDistribution) {
  const dropIds = new Set<string>();
  const meaningfulIds = new Set<string>();
  const statGearIds = new Set<string>();
  const commonLootIds = new Set<string>();
  const epicItemIds = new Set<string>();
  const uniqueNamedLootIds = new Set<string>();
  let uniquenessScoreTotal = 0;
  let uniquenessScoreCount = 0;
  for (const lootdrop of mob?.lootdrops ?? []) {
    for (const item of lootdrop.items ?? []) {
      const key = String(item.itemId || item.itemName || "unknown");
      if (!key || key === "unknown") continue;
      dropIds.add(key);
      const meaningfulness = eqemuLootItemMeaningfulness(item, distribution);
      uniquenessScoreTotal += meaningfulness.uniquenessScore;
      uniquenessScoreCount += 1;
      if (meaningfulness.commonReason) commonLootIds.add(key);
      if (meaningfulness.isEpicItem) epicItemIds.add(key);
      if (meaningfulness.isUniqueNamedLoot) uniqueNamedLootIds.add(key);
      if (meaningfulness.isMeaningful) meaningfulIds.add(key);
      if (meaningfulness.isStatGearMeaningful) statGearIds.add(key);
    }
  }
  return {
    commonLootCount: commonLootIds.size,
    dropCount: dropIds.size,
    epicItemCount: epicItemIds.size,
    hasMeaningfulDrops: meaningfulIds.size > 0,
    lootUniquenessScore: uniquenessScoreCount ? uniquenessScoreTotal / uniquenessScoreCount : 0,
    meaningfulDropCount: meaningfulIds.size,
    statGearDropCount: statGearIds.size,
    uniqueNamedLootCount: uniqueNamedLootIds.size,
  };
}

function representativeReasonLabel(reason: SpawnMapRepresentativeReason) {
  switch (reason) {
    case "override":
      return "manual named override";
    case "epic-source":
      return "Epic item source";
    case "site-rare-source":
      return "Site rare loot source";
    case "unique-loot":
      return "unique named loot overrides spawn footprint";
    case "population":
      return "Common population mob despite semi-unique loot";
    case "gear-footprint":
      return "loot-bearing rare candidate / lower spawn footprint";
    case "named-with-drops":
      return "named candidate with meaningful unique loot";
    case "named":
      return "named candidate";
    case "low-footprint-loot":
      return "low-spawn-count candidate with meaningful loot";
    case "low-chance-with-drops":
      return "low chance candidate with drops";
    case "drops":
      return "candidate with meaningful drops";
    case "low-chance-generic":
      return "low chance only";
    case "static-utility":
      return "static utility NPC (common fallback)";
    default:
      return "highest chance common mob";
  }
}

function primarySpawnAsCandidate(primary: EqemuPrimarySpawn): EqemuSpawnCandidate {
  return {
    npcTypeId: -1,
    name: primary.primaryNpcName,
    displayName: primary.displayName,
    level: primary.level,
    race: primary.race,
    className: primary.className,
    chance: primary.chance,
  };
}

function chooseSpawnMapRepresentative(
  primary: EqemuPrimarySpawn | undefined,
  zoneShortName: string,
  lootMobsByNpcTypeId: Map<number, EqemuLootMob>,
  lootDistribution: ZoneLootDistribution,
  spawnFootprintsByNpcTypeId: Map<number, SpawnMapCandidateFootprint>,
): SpawnMapRepresentative | undefined {
  if (!primary) return undefined;
  const candidates = (primary.candidates ?? []).length ? primary.candidates : [primarySpawnAsCandidate(primary)];
  const overrides = spawnMapRepresentativeOverrides[zoneShortName]?.namedOverrides ?? [];
  const primaryCandidate = candidates.find((candidate) => (
    typeof primary.primaryNpcId === "number" && candidate.npcTypeId === primary.primaryNpcId
  )) ?? candidates.find((candidate) => (
    normalizeSpawnMapTargetName(candidate.displayName) === normalizeSpawnMapTargetName(primary.displayName)
    && (candidate.chance ?? null) === (primary.chance ?? null)
  )) ?? primarySpawnAsCandidate(primary);
  const finiteFootprints = candidates
    .map((candidate) => spawnFootprintsByNpcTypeId.get(candidate.npcTypeId)?.spawnPointCount ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const maxCandidateFootprint = finiteFootprints.length ? Math.max(...finiteFootprints) : null;
  const ranked: SpawnMapCandidateScore[] = candidates.map((candidate) => {
    const isManualOverride = candidateMatchesNamedOverride(candidate, overrides);
    const dropStats = lootMobDropStats(lootMobsByNpcTypeId.get(candidate.npcTypeId), lootDistribution);
    const isLowChance = (candidate.chance ?? 100) <= 20;
    const isGeneric = isGenericSpawnName(candidate);
    const isUtility = isStaticUtilityCandidate(candidate);
    const isEpicSource = candidateIsEpicSource(candidate) || dropStats.epicItemCount > 0;
    const isSiteRareSource = candidateIsSiteRareSource(candidate);
    const spawnPointCount = spawnFootprintsByNpcTypeId.get(candidate.npcTypeId)?.spawnPointCount ?? null;
    const footprintPenalty = spawnFootprintPenalty(spawnPointCount);
    const hasLowerSpawnFootprint = typeof spawnPointCount === "number"
      && typeof maxCandidateFootprint === "number"
      && spawnPointCount < maxCandidateFootprint;
    const isPopulation = isCommonPopulationCandidate(candidate, dropStats, spawnPointCount, isManualOverride);
    const isNamed = isPlayerRelevantNamedCandidate(candidate, primary, dropStats, isManualOverride, spawnPointCount);
    const priority = isUtility && !isManualOverride
      ? 8
      : isPopulation
        ? 8
      : isManualOverride
      ? 0
      : isEpicSource
        ? 1
        : isSiteRareSource
          ? 2
          : hasSpecificNamedDisplay(candidate) && dropStats.uniqueNamedLootCount > 0
            ? 3
          : isNamed && dropStats.hasMeaningfulDrops
            ? 4
            : hasLowerSpawnFootprint && dropStats.hasMeaningfulDrops
              ? 5
              : isLowChance && dropStats.hasMeaningfulDrops
                ? 6
                : isLowChance
                  ? 7
                  : 8;
    const reason: SpawnMapRepresentativeReason = isUtility && !isManualOverride
      ? "static-utility"
      : isPopulation
        ? "population"
      : priority === 0
      ? "override"
      : priority === 1
        ? "epic-source"
        : priority === 2
          ? "site-rare-source"
          : priority === 3
            ? "unique-loot"
            : priority === 4
              ? "named-with-drops"
              : priority === 5
                ? "low-footprint-loot"
              : priority === 6
                ? "low-chance-with-drops"
                : priority === 7
                  ? "low-chance-generic"
                  : "common";
    return {
      candidate,
      commonLootCount: dropStats.commonLootCount,
      dropCount: dropStats.dropCount,
      hasLowerSpawnFootprint,
      hasMeaningfulDrops: dropStats.hasMeaningfulDrops,
      isLowChance,
      isManualOverride,
      isEpicSource,
      isNamed,
      isSiteRareSource,
      isUtility,
      isPopulation,
      isGeneric,
      footprintPenalty,
      lootUniquenessScore: dropStats.lootUniquenessScore,
      meaningfulDropCount: dropStats.meaningfulDropCount,
      priority,
      reason,
      spawnPointCount,
      statGearDropCount: dropStats.statGearDropCount,
      uniqueNamedLootCount: dropStats.uniqueNamedLootCount,
    };
  }).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.statGearDropCount !== b.statGearDropCount) return b.statGearDropCount - a.statGearDropCount;
    if (a.meaningfulDropCount !== b.meaningfulDropCount) return b.meaningfulDropCount - a.meaningfulDropCount;
    const footprintA = a.spawnPointCount ?? Number.POSITIVE_INFINITY;
    const footprintB = b.spawnPointCount ?? Number.POSITIVE_INFINITY;
    if (footprintA !== footprintB) return footprintA - footprintB;
    if (a.isGeneric !== b.isGeneric) return a.isGeneric ? 1 : -1;
    const chanceA = a.candidate.chance ?? Number.POSITIVE_INFINITY;
    const chanceB = b.candidate.chance ?? Number.POSITIVE_INFINITY;
    if (chanceA !== chanceB) return chanceA - chanceB;
    if (a.dropCount !== b.dropCount) return b.dropCount - a.dropCount;
    return a.candidate.displayName.localeCompare(b.candidate.displayName);
  });
  const best = ranked[0];
  if (!best) return undefined;
  const skippedPrimaryCommon = best.candidate.npcTypeId !== primaryCandidate.npcTypeId
    ? {
      chance: primaryCandidate.chance,
      displayName: primaryCandidate.displayName || primary.displayName,
    }
    : undefined;
  return {
    ...best.candidate,
    dropCount: best.dropCount,
    commonLootCount: best.commonLootCount,
    hasMeaningfulDrops: best.hasMeaningfulDrops,
    lootUniquenessScore: best.lootUniquenessScore,
    meaningfulDropCount: best.meaningfulDropCount,
    spawnPointCount: best.spawnPointCount,
    statGearDropCount: best.statGearDropCount,
    uniqueNamedLootCount: best.uniqueNamedLootCount,
    isLowChance: best.isLowChance,
    isManualOverride: best.isManualOverride,
    isEpicSource: best.isEpicSource,
    isNamed: best.isNamed,
    isSiteRareSource: best.isSiteRareSource,
    isUtility: best.isUtility,
    isPopulation: best.isPopulation,
    footprintPenalty: best.footprintPenalty,
    reason: best.reason,
    reasonLabel: representativeReasonLabel(best.reason),
    skippedPrimaryCommon,
  };
}

function spawnMapCandidateDebugRows(
  primary: EqemuPrimarySpawn | undefined,
  zoneShortName: string,
  lootMobsByNpcTypeId: Map<number, EqemuLootMob>,
  lootDistribution: ZoneLootDistribution,
  spawnFootprintsByNpcTypeId: Map<number, SpawnMapCandidateFootprint>,
  selectedRepresentative: SpawnMapRepresentative | undefined,
) {
  if (!primary) return [];
  const candidates = (primary.candidates ?? []).length ? primary.candidates : [primarySpawnAsCandidate(primary)];
  const overrides = spawnMapRepresentativeOverrides[zoneShortName]?.namedOverrides ?? [];
  return candidates.map((candidate) => {
    const dropStats = lootMobDropStats(lootMobsByNpcTypeId.get(candidate.npcTypeId), lootDistribution);
    const isManualOverride = candidateMatchesNamedOverride(candidate, overrides);
    const isLowChance = (candidate.chance ?? 100) <= 20;
    const spawnPointCount = spawnFootprintsByNpcTypeId.get(candidate.npcTypeId)?.spawnPointCount ?? null;
    const isNamed = isPlayerRelevantNamedCandidate(candidate, primary, dropStats, isManualOverride, spawnPointCount);
    const isPopulation = isCommonPopulationCandidate(candidate, dropStats, spawnPointCount, isManualOverride);
    const selected = selectedRepresentative?.npcTypeId === candidate.npcTypeId;
    return {
      candidate,
      dropStats,
      footprintPenalty: spawnFootprintPenalty(spawnPointCount),
      isLowChance,
      isManualOverride,
      isNamed,
      isPopulation,
      isUtility: isStaticUtilityCandidate(candidate),
      selected,
      spawnPointCount,
    };
  });
}

function formatNumberRange(values: number[], fallback = "Unknown") {
  if (!values.length) return fallback;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return minValue === maxValue ? String(minValue) : `${minValue}-${maxValue}`;
}

function formatChanceRange(values: number[]) {
  if (!values.length) return "?%";
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return minValue === maxValue ? `${minValue}%` : `${minValue}-${maxValue}%`;
}

function formatAverageChance(values: number[]) {
  if (!values.length) return "?%";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return `${average.toFixed(average < 10 ? 1 : 0)}%`;
}

function formatRespawnRange(values: number[]) {
  if (!values.length) return "Unknown";
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return minValue === maxValue ? formatRespawn(minValue) : `${formatRespawn(minValue)}-${formatRespawn(maxValue)}`;
}

type RareGroupOption = "chance" | "level" | "none" | "race";
type RareSortOption = "chance-high" | "chance-low" | "drops" | "level" | "name" | "race" | "respawn" | "spawn-points";
type NamedSpawnGroup = {
  candidates: Array<{ candidate: EqemuSpawnCandidate; spawn: EqemuPrimarySpawn }>;
  chanceBucket: string;
  chanceBucketRank: number;
  chanceMax: number | null;
  chanceMin: number | null;
  classNames: Set<string>;
  displayName: string;
  isNamed: boolean;
  levelMax: number | null;
  levelMin: number | null;
  levels: number[];
  races: Set<string>;
  respawnMax: number | null;
  respawns: number[];
  spawnPointCount: number;
  chances: number[];
};

type SpawnCandidateSummary = {
  chanceMax: number | null;
  chanceMin: number | null;
  count: number;
  isNamed: boolean;
  name: string;
};

type SpawnCandidateSetSummary = {
  candidates: EqemuSpawnCandidate[];
  count: number;
  respawnMax: number | null;
  respawnMin: number | null;
};

type PossibleDropSummary = {
  itemId: number;
  itemName: string;
  itemIcon: number | null;
  itemIconPath?: string | null;
  itemDetails: EqemuLootItemDetails | null;
  dropChanceMax: number | null;
  dropChanceMin: number | null;
  lootdropNames: Set<string>;
  mobNames: Set<string>;
};

type SelectedDropInspect = {
  details: ItemDetails;
  drop: PossibleDropSummary;
  source: "both" | "eqemu" | "existing";
};

type ExistingItemMatch = {
  details: ItemDetails;
  method: "item-id-and-name" | "normalized-name";
  name: string;
};

type EqemuItemDetailAsset = {
  itemId: number;
  itemName: string;
  itemIcon: number | null;
  itemIconPath?: string | null;
  itemDetails: EqemuLootItemDetails | null;
};

const eqemuItemDetailAssetCache = new Map<number, Promise<EqemuItemDetailAsset | null>>();
const existingItemDetails = itemDetailsData as ItemDetailsMap;
const spawnMapRepresentativeOverrides = spawnMapRepresentativeOverridesData as SpawnMapRepresentativeOverrideConfig;
const existingItemDetailsByNormalizedName = new Map(
  Object.entries(existingItemDetails).map(([name, details]) => [normalizeItemNameForMatch(name), details]),
);
const existingItemDetailsByItemId = new Map(
  Object.values(existingItemDetails)
    .filter((details) => details.itemId)
    .map((details) => [String(details.itemId), details]),
);

const classBitLabels: Array<[number, string]> = [
  [1, "WAR"], [2, "CLR"], [4, "PAL"], [8, "RNG"], [16, "SHD"], [32, "DRU"], [64, "MNK"], [128, "BRD"],
  [256, "ROG"], [512, "SHM"], [1024, "NEC"], [2048, "WIZ"], [4096, "MAG"], [8192, "ENC"], [16384, "BST"], [32768, "BER"],
];

const raceBitLabels: Array<[number, string]> = [
  [1, "HUM"], [2, "BAR"], [4, "ERU"], [8, "ELF"], [16, "HIE"], [32, "DEF"], [64, "HEF"], [128, "DWF"],
  [256, "TRL"], [512, "OGR"], [1024, "HFL"], [2048, "GNM"], [4096, "IKS"], [8192, "VAH"], [16384, "FRG"], [32768, "DRK"],
];

const slotBitLabels: Array<[number, string]> = [
  [1, "Charm"], [2, "Ear"], [4, "Head"], [8, "Face"], [16, "Ear"], [32, "Neck"], [64, "Shoulders"], [128, "Arms"],
  [256, "Back"], [512, "Wrist"], [1024, "Wrist"], [2048, "Range"], [4096, "Hands"], [8192, "Primary"], [16384, "Secondary"],
  [32768, "Finger"], [65536, "Finger"], [131072, "Chest"], [262144, "Legs"], [524288, "Feet"], [1048576, "Waist"], [2097152, "Power Source"], [4194304, "Ammo"],
];

function chanceBucketFor(chance: number | null) {
  if (chance === null) return { label: "Unknown", rank: 5 };
  if (chance <= 1) return { label: "Very rare", rank: 1 };
  if (chance <= 5) return { label: "Rare", rank: 2 };
  if (chance <= 20) return { label: "Uncommon", rank: 3 };
  return { label: "Common", rank: 4 };
}

function spawnMapDotCategory(spawn: NativeSpawnWithPrimary): SpawnMapDotCategory {
  if (spawn.representative) {
    return ["epic-source", "gear-footprint", "low-chance-with-drops", "low-footprint-loot", "named", "named-with-drops", "override", "site-rare-source", "unique-loot"].includes(spawn.representative.reason)
      ? "special"
      : "common";
  }
  return "common";
}

function spawnMapDotCategoryLabel(category: SpawnMapDotCategory) {
  switch (category) {
    case "special":
      return "Named / Rare";
    default:
      return "Common";
  }
}

function spawnMapCandidateNames(spawn: NativeSpawnWithPrimary) {
  const names = new Set<string>();
  const primary = spawn.primary;
  if (primary?.displayName) names.add(primary.displayName.toLowerCase());
  if (primary?.primaryNpcName) names.add(primary.primaryNpcName.toLowerCase());
  for (const candidate of primary?.candidates ?? []) {
    if (candidate.displayName) names.add(candidate.displayName.toLowerCase());
    if (candidate.name) names.add(candidate.name.toLowerCase());
  }
  return names;
}

function spawnMapSharesCandidate(a: NativeSpawnWithPrimary, b: NativeSpawnWithPrimary) {
  if (a.id !== undefined && a.id !== null && a.id === b.id) return true;
  const aNames = spawnMapCandidateNames(a);
  if (!aNames.size) return false;
  for (const name of spawnMapCandidateNames(b)) {
    if (aNames.has(name)) return true;
  }
  return false;
}

function floorVarianceBands(variance: NativeMapFloorVariance) {
  switch (variance) {
    case "tight":
      return { far: 120, mid: 55, near: 20 };
    case "loose":
      return { far: 280, mid: 150, near: 60 };
    default:
      return { far: 180, mid: 90, near: 35 };
  }
}

function interpolateOpacity(distance: number, start: number, end: number, startOpacity: number, endOpacity: number) {
  if (end <= start) return endOpacity;
  const progress = Math.min(1, Math.max(0, (distance - start) / (end - start)));
  return startOpacity + (endOpacity - startOpacity) * progress;
}

function floorDistanceOpacity(distance: number | null, variance: NativeMapFloorVariance) {
  if (distance === null) return 1;
  const bands = floorVarianceBands(variance);
  if (distance <= bands.near) return 1;
  if (distance <= bands.mid) return interpolateOpacity(distance, bands.near, bands.mid, 1, 0.7);
  if (distance <= bands.far) return interpolateOpacity(distance, bands.mid, bands.far, 0.7, 0.35);
  return 0.1;
}

function mapLineAverageZ(line: MapLine | NativeMapLine) {
  const values = [line.z1, line.z2].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mapLineOverlapsZRange(line: MapLine | NativeMapLine, zMin: number, zMax: number) {
  const values = [line.z1, line.z2].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return false;
  if (values.some((value) => value >= zMin && value <= zMax)) return true;
  if (values.length < 2) return false;
  return Math.min(...values) <= zMax && Math.max(...values) >= zMin;
}

function geometryHeightOpacity(z: number | null | undefined, focusZ: number | null, variance: NativeMapFloorVariance, enabled: boolean) {
  if (!enabled || focusZ === null || typeof z !== "number" || !Number.isFinite(z)) return 1;
  return Math.max(0.14, floorDistanceOpacity(Math.abs(z - focusZ), variance));
}

function spawnMapTooltip(spawn: NativeSpawnWithPrimary, category: SpawnMapDotCategory) {
  const primary = spawn.primary;
  const candidates = primary?.candidates ?? [];
  const representative = spawn.representative;
  const otherRareCandidates = candidates
    .filter((candidate) => candidate.npcTypeId !== representative?.npcTypeId)
    .filter((candidate) => isLikelyNamed(candidate) || (candidate.chance ?? 100) <= 20)
    .map((candidate) => `${candidate.displayName} (${candidate.chance ?? "?"}%)`);
  return [
    `Representative: ${representative?.displayName ?? primary?.displayName ?? spawn.displayName ?? spawn.name ?? `Spawn ${spawn.id}`}`,
    `Classification: ${spawnMapDotCategoryLabel(category)}`,
    `Reason: ${representative?.reasonLabel ?? "highest chance common mob"}`,
    representative?.skippedPrimaryCommon
      ? `Skipped primary common: ${representative.skippedPrimaryCommon.displayName} (${representative.skippedPrimaryCommon.chance ?? "?"}%)`
      : null,
    `Level: ${representative?.level ?? primary?.level ?? spawn.level ?? "Unknown"}`,
    `Race: ${representative?.race ?? primary?.race ?? spawn.race ?? "Unknown"}`,
    `Chance: ${representative?.chance ?? primary?.chance ?? "Unknown"}%`,
    `Respawn: ${formatRespawn(primary?.respawnTime ?? null)}`,
    otherRareCandidates.length ? `Other rare candidates: ${otherRareCandidates.slice(0, 4).join(", ")}${otherRareCandidates.length > 4 ? ", ..." : ""}` : "Other rare candidates: none",
    candidates.length > 1 ? `${candidates.length} possible spawn candidates` : "Single listed candidate",
    `Loc: X ${formatCoordinate(spawn.x ?? null)} / Y ${formatCoordinate(spawn.y ?? null)} / Z ${formatCoordinate(spawn.z ?? null)}`,
  ].filter(Boolean).join("\n");
}

function levelBucketFor(level: number | null) {
  if (level === null) return "Unknown level";
  const bucketMin = Math.floor(level / 10) * 10;
  const minLabel = bucketMin === 0 ? 1 : bucketMin;
  return `${minLabel}-${bucketMin + 9}`;
}

function namedSpawnGroupKey(group: NamedSpawnGroup) {
  return group.displayName.toLowerCase();
}

function spawnLocationKey(spawn: EqemuPrimarySpawn, candidate: EqemuSpawnCandidate, index: number) {
  return `${spawn.spawn2Id ?? "spawn"}-${candidate.npcTypeId ?? candidate.name ?? candidate.displayName}-${index}`;
}

function formatCoordinate(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "?";
  return Number.isInteger(value) ? String(value) : String(Math.round(value));
}

function formatSpawnLocation(spawn: EqemuPrimarySpawn) {
  return `X ${formatCoordinate(spawn.x)} / Y ${formatCoordinate(spawn.y)} / Z ${formatCoordinate(spawn.z)}`;
}

function placeholderSummary(spawn: EqemuPrimarySpawn, currentCandidate: EqemuSpawnCandidate) {
  const alternatives = (spawn.candidates ?? []).filter((candidate) =>
    candidate.npcTypeId !== currentCandidate.npcTypeId
    || candidate.name !== currentCandidate.name
  );
  if (!alternatives.length) return "No alternate spawn candidates listed.";
  const namedCount = alternatives.filter((candidate) => isLikelyNamed(candidate)).length;
  const commonCount = alternatives.length - namedCount;
  if (namedCount && commonCount) return `${alternatives.length} possible placeholders: ${commonCount} common, ${namedCount} named.`;
  if (namedCount) return `${namedCount} named alternative${namedCount === 1 ? "" : "s"} listed.`;
  return `${commonCount} possible placeholder${commonCount === 1 ? "" : "s"} listed.`;
}

function summarizeCandidateNames(group: NamedSpawnGroup, includeRare: boolean) {
  const currentName = group.displayName.toLowerCase();
  const summaries = new Map<string, SpawnCandidateSummary>();

  for (const { spawn } of group.candidates) {
    for (const candidate of spawn.candidates ?? []) {
      const name = candidate.displayName || candidate.name || "Unknown";
      if (name.toLowerCase() === currentName) continue;
      const candidateIsRare = isLikelyNamed(candidate) || (candidate.chance ?? 100) <= 20;
      if (includeRare !== candidateIsRare) continue;
      const summary = summaries.get(name) ?? {
        chanceMax: null,
        chanceMin: null,
        count: 0,
        isNamed: isLikelyNamed(candidate),
        name,
      };
      summary.count += 1;
      summary.isNamed = summary.isNamed || isLikelyNamed(candidate);
      if (typeof candidate.chance === "number") {
        summary.chanceMin = summary.chanceMin === null ? candidate.chance : Math.min(summary.chanceMin, candidate.chance);
        summary.chanceMax = summary.chanceMax === null ? candidate.chance : Math.max(summary.chanceMax, candidate.chance);
      }
      summaries.set(name, summary);
    }
  }

  return Array.from(summaries.values())
    .sort((a, b) => (a.chanceMin ?? 100) - (b.chanceMin ?? 100) || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6);
}

function candidateChanceText(summary: SpawnCandidateSummary) {
  if (summary.chanceMin === null) return "unknown chance";
  return summary.chanceMin === summary.chanceMax ? `${summary.chanceMin}%` : `${summary.chanceMin}-${summary.chanceMax}%`;
}

function summarizeCandidateSets(group: NamedSpawnGroup) {
  const sets = new Map<string, SpawnCandidateSetSummary>();

  for (const { spawn } of group.candidates) {
    const candidates = [...(spawn.candidates ?? [])].sort((a, b) =>
      (b.chance ?? -1) - (a.chance ?? -1)
      || a.displayName.localeCompare(b.displayName)
    );
    const signature = candidates.map((candidate) => `${candidate.displayName}:${candidate.chance ?? "?"}`).join("|");
    const summary = sets.get(signature) ?? {
      candidates,
      count: 0,
      respawnMax: null,
      respawnMin: null,
    };
    summary.count += 1;
    if (typeof spawn.respawnTime === "number") {
      summary.respawnMin = summary.respawnMin === null ? spawn.respawnTime : Math.min(summary.respawnMin, spawn.respawnTime);
      summary.respawnMax = summary.respawnMax === null ? spawn.respawnTime : Math.max(summary.respawnMax, spawn.respawnTime);
    }
    sets.set(signature, summary);
  }

  return Array.from(sets.values()).sort((a, b) => b.count - a.count);
}

function coordinateBoundsText(group: NamedSpawnGroup) {
  const axes = [
    { label: "X", values: group.candidates.map(({ spawn }) => spawn.x).filter((value): value is number => typeof value === "number") },
    { label: "Y", values: group.candidates.map(({ spawn }) => spawn.y).filter((value): value is number => typeof value === "number") },
    { label: "Z", values: group.candidates.map(({ spawn }) => spawn.z).filter((value): value is number => typeof value === "number") },
  ];
  return axes.map(({ label, values }) => {
    if (!values.length) return `${label} ?`;
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    return minValue === maxValue
      ? `${label} ${formatCoordinate(minValue)}`
      : `${label} ${formatCoordinate(minValue)} to ${formatCoordinate(maxValue)}`;
  }).join(" / ");
}

function summarizePossibleDrops(group: NamedSpawnGroup, lootMobsByNpcTypeId: Map<number, EqemuLootMob>) {
  const drops = new Map<number, PossibleDropSummary>();
  const seenNpcTypeIds = new Set<number>();

  for (const { candidate } of group.candidates) {
    if (seenNpcTypeIds.has(candidate.npcTypeId)) continue;
    seenNpcTypeIds.add(candidate.npcTypeId);
    const lootMob = lootMobsByNpcTypeId.get(candidate.npcTypeId);
    if (!lootMob) continue;
    for (const lootdrop of lootMob.lootdrops ?? []) {
      for (const item of lootdrop.items ?? []) {
        if (!item.itemId) continue;
        const summary = drops.get(item.itemId) ?? {
          itemId: item.itemId,
          itemIcon: item.itemIcon ?? item.itemDetails?.icon ?? null,
          itemIconPath: item.itemIconPath ?? null,
          itemDetails: item.itemDetails ?? null,
          itemName: item.itemName ?? `Item ${item.itemId}`,
          dropChanceMax: null,
          dropChanceMin: null,
          lootdropNames: new Set<string>(),
          mobNames: new Set<string>(),
        };
        if (typeof item.dropChance === "number") {
          summary.dropChanceMin = summary.dropChanceMin === null ? item.dropChance : Math.min(summary.dropChanceMin, item.dropChance);
          summary.dropChanceMax = summary.dropChanceMax === null ? item.dropChance : Math.max(summary.dropChanceMax, item.dropChance);
        }
        if (lootdrop.lootdropName) summary.lootdropNames.add(lootdrop.lootdropName);
        summary.mobNames.add(lootMob.displayName);
        drops.set(item.itemId, summary);
      }
    }
  }

  return Array.from(drops.values()).sort((a, b) =>
    (b.dropChanceMax ?? -1) - (a.dropChanceMax ?? -1)
    || a.itemName.localeCompare(b.itemName)
  );
}

function formatDropChanceRange(drop: PossibleDropSummary) {
  if (drop.dropChanceMin === null) return "unknown";
  return drop.dropChanceMin === drop.dropChanceMax ? `${drop.dropChanceMin}%` : `${drop.dropChanceMin}-${drop.dropChanceMax}%`;
}

function dropRarityLabel(drop: PossibleDropSummary) {
  const chance = drop.dropChanceMin;
  if (chance === null) return "Unknown";
  if (chance <= 1) return "Very rare";
  if (chance <= 5) return "Rare";
  if (chance <= 20) return "Uncommon";
  return "Common";
}

function dropSourceLabel(source: SelectedDropInspect["source"]) {
  if (source === "both") return "Existing item data + EQEmu drop source";
  if (source === "existing") return "Existing item details";
  return "Local EQEmu DB fallback";
}

function eqemuIconPath(iconId: number | null | undefined) {
  return typeof iconId === "number" && iconId > 0
    ? `https://wiki.project1999.com/images/Item_${iconId}.png`
    : null;
}

function hasItemIcon(details: ItemDetails) {
  const optional = details as ItemDetails & { icon?: string | null; iconPath?: string | null; icon_url?: string | null };
  return Boolean(optional.iconPath || optional.icon_url || optional.icon);
}

function formatSetRespawnRange(setSummary: SpawnCandidateSetSummary) {
  const values = [setSummary.respawnMin, setSummary.respawnMax].filter((value): value is number => typeof value === "number");
  return formatRespawnRange(values);
}

function bitmaskLabels(value: number | null | undefined, labels: Array<[number, string]>) {
  if (!value || value < 0) return [];
  return labels.filter(([bit]) => (value & bit) === bit).map(([, label]) => label);
}

function nonZero(value: number | null | undefined) {
  return typeof value === "number" && value !== 0 ? value : null;
}

function eqemuItemTypeLabel(value: number | null | undefined) {
  const labels: Record<number, string> = {
    0: "1H Slashing",
    1: "2H Slashing",
    2: "Piercing",
    3: "1H Blunt",
    4: "2H Blunt",
    5: "Archery",
    10: "Armor",
    14: "Food",
    15: "Drink",
    17: "Arrow",
    18: "Key",
    20: "Throwing",
    27: "Book",
    35: "2H Piercing",
    45: "Hand to Hand",
  };
  return typeof value === "number" ? labels[value] ?? `Item Type ${value}` : null;
}

function normalizeItemNameForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function existingItemDisplayName(details: ItemDetails | undefined, fallback = "") {
  return String(details?.name ?? fallback);
}

function itemNamesAreCompatible(a: string | null | undefined, b: string | null | undefined) {
  const normalizedA = normalizeItemNameForMatch(String(a ?? ""));
  const normalizedB = normalizeItemNameForMatch(String(b ?? ""));
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

function findExistingItemMatch(drop: PossibleDropSummary): ExistingItemMatch | null {
  const idMatch = existingItemDetailsByItemId.get(String(drop.itemId));
  if (idMatch && itemNamesAreCompatible(existingItemDisplayName(idMatch), drop.itemName)) {
    return { details: idMatch, method: "item-id-and-name", name: existingItemDisplayName(idMatch, drop.itemName) };
  }

  const directNameMatch = existingItemDetails[drop.itemName];
  if (directNameMatch) {
    return { details: directNameMatch, method: "normalized-name", name: drop.itemName };
  }

  const normalizedName = normalizeItemNameForMatch(drop.itemName);
  const normalizedMatch = existingItemDetailsByNormalizedName.get(normalizedName);
  if (normalizedMatch && itemNamesAreCompatible(existingItemDisplayName(normalizedMatch), drop.itemName)) {
    return { details: normalizedMatch, method: "normalized-name", name: existingItemDisplayName(normalizedMatch, drop.itemName) };
  }

  return null;
}

function hasAnyEqemuStats(raw: EqemuLootItemDetails | null | undefined) {
  if (!raw) return false;
  if ([raw.ac, raw.damage, raw.delay, raw.attack, raw.accuracy, raw.avoidance, raw.haste].some((value) => typeof value === "number" && value !== 0)) return true;
  return Object.values(raw.stats ?? {}).some((value) => typeof value === "number" && value !== 0)
    || Object.values(raw.resists ?? {}).some((value) => typeof value === "number" && value !== 0);
}

function eqemuItemTypeLabelWithConfidence(raw: EqemuLootItemDetails | null | undefined) {
  if (!raw) return null;
  const label = eqemuItemTypeLabel(raw.itemtype);
  if (!label) return null;
  const hasEquipmentShape = Boolean(raw.slots && raw.slots > 0) || hasAnyEqemuStats(raw);
  const isQuestionableGenericItem = !hasEquipmentShape && raw.itemclass === 0 && raw.stackable === 1;
  if (isQuestionableGenericItem) return null;
  if (raw.itemtype === 17 && !hasEquipmentShape) return null;
  return label;
}

function eqemuItemSizeLabel(value: number | null | undefined) {
  const labels: Record<number, string> = {
    0: "Tiny",
    1: "Small",
    2: "Medium",
    3: "Large",
    4: "Giant",
  };
  return typeof value === "number" ? labels[value] ?? `Size ${value}` : null;
}

function eqemuItemToDetails(drop: PossibleDropSummary): SelectedDropInspect {
  const existingMatch = findExistingItemMatch(drop);
  if (existingMatch) {
    const existing = existingMatch.details;
    const source = drop.itemDetails ? "both" : "existing";
    const iconPath = drop.itemIconPath ?? eqemuIconPath(drop.itemDetails?.icon ?? drop.itemIcon);
    const details = !hasItemIcon(existing) && iconPath ? { ...existing, iconPath } : existing;
    return {
      details: {
        ...details,
        match_notes: [
          ...(details.match_notes ?? []),
          `Matched to existing item data by ${existingMatch.method}.`,
        ],
      },
      drop,
      source,
    };
  }

  const raw = drop.itemDetails;
  const fallbackIcon = raw?.icon ?? drop.itemIcon ?? null;
  const details: ItemDetails = {
    name: drop.itemName,
    itemId: String(drop.itemId),
    sourceUrl: null,
    slot: bitmaskLabels(raw?.slots, slotBitLabels).join(" ") || null,
    ac: nonZero(raw?.ac),
    damage: nonZero(raw?.damage),
    delay: nonZero(raw?.delay),
    stats: Object.fromEntries(Object.entries(raw?.stats ?? {}).map(([key, value]) => [key, nonZero(value)]).filter(([, value]) => value !== null)) as Record<string, number | string>,
    resists: Object.fromEntries(Object.entries(raw?.resists ?? {}).map(([key, value]) => [key, nonZero(value)]).filter(([, value]) => value !== null)) as Record<string, number | string>,
    hp_regen: nonZero(raw?.regen),
    mana_regen: nonZero(raw?.manaregen),
    endurance_regen: nonZero(raw?.enduranceregen),
    attack: nonZero(raw?.attack),
    haste: nonZero(raw?.haste) !== null ? String(raw?.haste) : null,
    charges: nonZero(raw?.maxcharges),
    worn_effects: [],
    focus_effects: [],
    click_effects: [],
    proc_effects: [],
    required_level: nonZero(raw?.reqlevel),
    recommended_level: nonZero(raw?.reclevel),
    classes: bitmaskLabels(raw?.classes, classBitLabels),
    races: bitmaskLabels(raw?.races, raceBitLabels),
    weight: typeof raw?.weight === "number" ? raw.weight / 10 : null,
    size: eqemuItemSizeLabel(raw?.size),
    item_type: eqemuItemTypeLabelWithConfidence(raw),
    iconPath: drop.itemIconPath ?? eqemuIconPath(fallbackIcon),
    stackable: raw?.stackable === 1,
    lore: Boolean(raw?.lore && raw.lore !== "*"),
    magic: raw?.magic === 1,
    no_drop: raw?.nodrop === 0,
    prestige: null,
    aug_slots: [],
    sources: [{ name: "Local EQEmu DB", url: "#" }],
    confidence: raw ? "eqemu-fallback-low-confidence-enums" : "limited",
    match_notes: raw ? ["Fallback item details exported from the local EQEmu items table. Low-confidence numeric enum labels are hidden."] : ["Limited item details available from local loot export."],
    missing_core_stats: !raw,
    duplicate_name_risk: false,
    parsing_warnings: raw ? [] : ["No EQEmu items table row was exported for this drop."],
    expansion: "Local EQEmu DB",
    iconId: fallbackIcon,
    extraStats: {
      ...(nonZero(raw?.accuracy) !== null ? { Accuracy: raw?.accuracy ?? 0 } : {}),
      ...(nonZero(raw?.avoidance) !== null ? { Avoidance: raw?.avoidance ?? 0 } : {}),
    },
  };

  return {
    details,
    drop,
    source: "eqemu",
  };
}

function loadEqemuItemDetailAsset(itemId: number) {
  const cached = eqemuItemDetailAssetCache.get(itemId);
  if (cached) return cached;
  const request = fetch(`/real-spawn-item-assets/${itemId}.json`)
    .then((response) => (response.ok ? response.json() as Promise<EqemuItemDetailAsset> : null))
    .catch(() => null);
  eqemuItemDetailAssetCache.set(itemId, request);
  return request;
}

function DropInspectFooter({
  inspect,
  mobName,
  zoneName,
}: {
  inspect: SelectedDropInspect;
  mobName: string;
  zoneName: string;
}) {
  return (
    <div className="zones-drop-inspect-footer">
      <span>Dropped by: <strong>{mobName}</strong></span>
      <span>Drop chance: <strong>{formatDropChanceRange(inspect.drop)}</strong></span>
      <span>Zone: <strong>{zoneName}</strong></span>
      <span>Source: <strong>{dropSourceLabel(inspect.source)}</strong></span>
      {inspect.source === "eqemu" && !inspect.drop.itemDetails ? <em>Limited item details available.</em> : null}
    </div>
  );
}

function DropInspectRow({
  drop,
  groupKey,
  mobName,
  onToggle,
  selected,
  zoneName,
}: {
  drop: PossibleDropSummary;
  groupKey: string;
  mobName: string;
  onToggle: () => void;
  selected: boolean;
  zoneName: string;
}) {
  const { previewProps } = useItemPreview();
  const [loadedItemAsset, setLoadedItemAsset] = useState<EqemuItemDetailAsset | null>(null);
  const hydratedDrop = useMemo(() => {
    if (!loadedItemAsset?.itemDetails) return drop;
    return {
      ...drop,
      itemIcon: drop.itemIcon ?? loadedItemAsset.itemIcon,
      itemIconPath: drop.itemIconPath ?? loadedItemAsset.itemIconPath,
      itemDetails: loadedItemAsset.itemDetails,
    };
  }, [drop, loadedItemAsset]);
  const inspect = useMemo(() => eqemuItemToDetails(hydratedDrop), [hydratedDrop]);
  const footer = <DropInspectFooter inspect={inspect} mobName={mobName} zoneName={zoneName} />;
  const chance = formatDropChanceRange(drop);
  const rarity = dropRarityLabel(drop);
  const itemPreviewProps = previewProps(drop.itemName, inspect.details, footer);

  function warmItemDetails(event?: MouseEvent<HTMLElement>) {
    if (!drop.itemDetails && !loadedItemAsset) {
      loadEqemuItemDetailAsset(drop.itemId).then((asset) => setLoadedItemAsset(asset));
    }
    if (event) itemPreviewProps.onMouseEnter(event);
  }

  return (
    <button
      {...itemPreviewProps}
      aria-pressed={selected}
      className={selected ? "zones-possible-drop-row is-selected" : "zones-possible-drop-row"}
      onClick={() => {
        warmItemDetails();
        onToggle();
      }}
      onMouseEnter={warmItemDetails}
      type="button"
    >
      {[
        <strong key="name">{drop.itemName}</strong>,
        <span key="chance">{chance}</span>,
        <span className={`zones-drop-rarity is-${rarity.toLowerCase().replace(/\s+/g, "-")}`} key="rarity">{rarity}</span>,
      ]}
    </button>
  );
}

function RealSpawnDataIntel({
  lootMobs,
  lootPending = false,
  onClearFocus,
  onSelectFocus,
  selectedFocus,
  spawnData,
  zoneName,
}: {
  lootMobs: EqemuLootMob[];
  lootPending?: boolean;
  onClearFocus?: () => void;
  onSelectFocus?: (focus: RealSpawnFocus) => void;
  selectedFocus?: RealSpawnFocus | null;
  spawnData: EqemuSpawnTestData | null;
  zoneName: string;
}) {
  const sectionRef = useRef<HTMLDetailsElement | null>(null);
  const eqemuSpawnRows = useMemo(() => (
    Array.isArray(spawnData?.primarySpawnRows)
      ? spawnData.primarySpawnRows.map((spawn) => ({
        ...spawn,
        candidates: Array.isArray(spawn.candidates) ? spawn.candidates.filter((candidate) => !isSuppressedRealSpawnCandidate(candidate)) : [],
      })).filter((spawn) => spawn.candidates.length > 0)
      : []
  ), [spawnData]);
  const eqemuLootMobsByNpcTypeId = useMemo(() => new Map(
    (Array.isArray(lootMobs) ? lootMobs : [])
      .filter((mob) => !isSuppressedRealSpawnNpcName(mob.displayName) && !isSuppressedRealSpawnNpcName(mob.rawName))
      .map((mob) => [mob.npcTypeId, mob]),
  ), [lootMobs]);
  const zoneLootDistribution = useMemo(
    () => buildZoneLootDistribution(Array.isArray(lootMobs) ? lootMobs : []),
    [lootMobs],
  );
  const [nameFilter, setNameFilter] = useState("");
  const [raceFilter, setRaceFilter] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [maxChance, setMaxChance] = useState("");
  const [minSpawnPoints, setMinSpawnPoints] = useState("");
  const [namedOnly, setNamedOnly] = useState(false);
  const [lowChanceOnly, setLowChanceOnly] = useState(false);
  const [hasDropsOnly, setHasDropsOnly] = useState(false);
  const [rareGroupBy, setRareGroupBy] = useState<RareGroupOption>("none");
  const [rareSort, setRareSort] = useState<RareSortOption>("chance-low");
  const [expandedNamedKey, setExpandedNamedKey] = useState<string | null>(null);
  const [expandedLocationKey, setExpandedLocationKey] = useState<string | null>(null);
  const [selectedDropKey, setSelectedDropKey] = useState<string | null>(null);
  const [showExactLocationsKey, setShowExactLocationsKey] = useState<string | null>(null);
  const [visibleSpawnGroupCount, setVisibleSpawnGroupCount] = useState(40);
  const normalizedName = nameFilter.trim().toLowerCase();
  const normalizedRace = raceFilter.trim().toLowerCase();
  const min = /^\d+$/.test(minLevel.trim()) ? Number(minLevel.trim()) : null;
  const max = /^\d+$/.test(maxLevel.trim()) ? Number(maxLevel.trim()) : null;
  const chanceCap = /^\d+$/.test(maxChance.trim()) ? Number(maxChance.trim()) : null;
  const minSpawns = /^\d+$/.test(minSpawnPoints.trim()) ? Number(minSpawnPoints.trim()) : null;
  const zoneNamedOverrides = useMemo(
    () => spawnMapRepresentativeOverrides[spawnData?.zoneShortName ?? ""]?.namedOverrides ?? [],
    [spawnData?.zoneShortName],
  );
  const spawnFootprintsByNpcTypeId = useMemo(() => {
    const footprints = new Map<number, SpawnMapCandidateFootprint>();
    const seen = new Set<string>();
    for (const spawn of eqemuSpawnRows) {
      const candidates = (spawn.candidates ?? []).length ? spawn.candidates : [primarySpawnAsCandidate(spawn)];
      for (const candidate of candidates) {
        if (typeof candidate.npcTypeId !== "number") continue;
        const key = `${candidate.npcTypeId}:${spawn.spawn2Id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const current = footprints.get(candidate.npcTypeId);
        footprints.set(candidate.npcTypeId, {
          displayName: current?.displayName ?? candidate.displayName,
          spawnPointCount: (current?.spawnPointCount ?? 0) + 1,
        });
      }
    }
    return footprints;
  }, [eqemuSpawnRows]);
  const candidateIsNamedForIntel = (candidate: EqemuSpawnCandidate, spawn: EqemuPrimarySpawn) => {
    const isManualOverride = candidateMatchesNamedOverride(candidate, zoneNamedOverrides);
    const dropStats = lootMobDropStats(eqemuLootMobsByNpcTypeId.get(candidate.npcTypeId), zoneLootDistribution);
    const spawnPointCount = spawnFootprintsByNpcTypeId.get(candidate.npcTypeId)?.spawnPointCount ?? null;
    return isPlayerRelevantNamedCandidate(candidate, spawn, dropStats, isManualOverride, spawnPointCount);
  };

  const filteredSpawnRows = useMemo(() => eqemuSpawnRows.filter((spawn) => {
    if (!realSpawnFocusMatchesSpawn(selectedFocus ?? null, spawn)) return false;
    const candidates = Array.isArray(spawn.candidates) ? spawn.candidates : [];
    const candidateMatch = candidates.some((candidate) => {
      if (!realSpawnFocusMatchesCandidate(selectedFocus ?? null, candidate)) return false;
      if (normalizedName && !candidateSearchText(candidate).includes(normalizedName)) return false;
      if (normalizedRace && !String(candidate.race ?? "").toLowerCase().includes(normalizedRace)) return false;
      if (min !== null && (candidate.level === null || candidate.level < min)) return false;
      if (max !== null && (candidate.level === null || candidate.level > max)) return false;
      if (chanceCap !== null && (candidate.chance ?? 100) > chanceCap) return false;
      if (namedOnly && !candidateIsNamedForIntel(candidate, spawn)) return false;
      if (lowChanceOnly && (candidate.chance ?? 100) > 20) return false;
      return true;
    });
    return candidateMatch;
  }), [chanceCap, eqemuSpawnRows, lowChanceOnly, max, min, namedOnly, normalizedName, normalizedRace, selectedFocus, zoneNamedOverrides, eqemuLootMobsByNpcTypeId, zoneLootDistribution, spawnFootprintsByNpcTypeId]);

  const rareCandidates = useMemo(() => filteredSpawnRows.flatMap((spawn) => (spawn.candidates ?? [])
    .filter((candidate) => {
      if (!realSpawnFocusMatchesCandidate(selectedFocus ?? null, candidate)) return false;
      if (normalizedName && !candidateSearchText(candidate).includes(normalizedName)) return false;
      if (normalizedRace && !String(candidate.race ?? "").toLowerCase().includes(normalizedRace)) return false;
      if (min !== null && (candidate.level === null || candidate.level < min)) return false;
      if (max !== null && (candidate.level === null || candidate.level > max)) return false;
      if (chanceCap !== null && (candidate.chance ?? 100) > chanceCap) return false;
      if (namedOnly && !candidateIsNamedForIntel(candidate, spawn)) return false;
      if (lowChanceOnly && (candidate.chance ?? 100) > 20) return false;
      return true;
    })
    .map((candidate) => ({ candidate, spawn })))
    .sort((a, b) =>
      (a.candidate.chance ?? 100) - (b.candidate.chance ?? 100)
      || (b.candidate.level ?? 0) - (a.candidate.level ?? 0)
      || a.candidate.displayName.localeCompare(b.candidate.displayName)
    )
    , [chanceCap, filteredSpawnRows, lowChanceOnly, max, min, namedOnly, normalizedName, normalizedRace, selectedFocus, zoneNamedOverrides, eqemuLootMobsByNpcTypeId, zoneLootDistribution, spawnFootprintsByNpcTypeId]);

  const rareCandidateGroups = useMemo(() => {
    const groups = new Map<string, NamedSpawnGroup>();

    for (const entry of rareCandidates) {
      const key = String(entry.candidate.displayName || entry.candidate.name || "Unknown").toLowerCase();
      const group = groups.get(key) ?? {
        candidates: [],
        chanceBucket: "Unknown",
        chanceBucketRank: 5,
        chanceMax: null,
        chanceMin: null,
        classNames: new Set<string>(),
        displayName: entry.candidate.displayName || entry.candidate.name || "Unknown",
        isNamed: false,
        levelMax: null,
        levelMin: null,
        levels: [],
        races: new Set<string>(),
        respawnMax: null,
        spawnPointCount: 0,
        chances: [],
        respawns: [],
      };
      group.candidates.push(entry);
      group.spawnPointCount += 1;
      group.isNamed = group.isNamed || candidateIsNamedForIntel(entry.candidate, entry.spawn);
      if (entry.candidate.className) group.classNames.add(entry.candidate.className);
      if (entry.candidate.race) group.races.add(entry.candidate.race);
      if (typeof entry.candidate.level === "number") group.levels.push(entry.candidate.level);
      if (typeof entry.candidate.chance === "number") group.chances.push(entry.candidate.chance);
      if (typeof entry.spawn.respawnTime === "number") group.respawns.push(entry.spawn.respawnTime);
      groups.set(key, group);
    }

    return Array.from(groups.values()).map((group) => {
      const chanceMin = group.chances.length ? Math.min(...group.chances) : null;
      const chanceMax = group.chances.length ? Math.max(...group.chances) : null;
      const bucket = chanceBucketFor(chanceMin);
      return {
        ...group,
        chanceBucket: bucket.label,
        chanceBucketRank: bucket.rank,
        chanceMax,
        chanceMin,
        levelMax: group.levels.length ? Math.max(...group.levels) : null,
        levelMin: group.levels.length ? Math.min(...group.levels) : null,
        respawnMax: group.respawns.length ? Math.max(...group.respawns) : null,
      };
    }).filter((group) =>
      (minSpawns === null || group.spawnPointCount >= minSpawns)
      && (!hasDropsOnly || summarizePossibleDrops(group, eqemuLootMobsByNpcTypeId).length > 0)
    );
  }, [eqemuLootMobsByNpcTypeId, hasDropsOnly, minSpawns, rareCandidates, spawnFootprintsByNpcTypeId, zoneLootDistribution, zoneNamedOverrides]);

  const dropCountsByGroup = useMemo(() => new Map(
    rareCandidateGroups.map((group) => [namedSpawnGroupKey(group), summarizePossibleDrops(group, eqemuLootMobsByNpcTypeId).length]),
  ), [eqemuLootMobsByNpcTypeId, rareCandidateGroups]);

  const sortedRareCandidateGroups = useMemo(() => {
    return [...rareCandidateGroups].sort((a, b) => {
      const namedSort = Number(b.isNamed) - Number(a.isNamed);
      if (rareSort === "name") return a.displayName.localeCompare(b.displayName);
      if (rareSort === "level") return (b.levelMax ?? -1) - (a.levelMax ?? -1) || a.displayName.localeCompare(b.displayName);
      if (rareSort === "race") return (Array.from(a.races)[0] ?? "Unknown").localeCompare(Array.from(b.races)[0] ?? "Unknown") || a.displayName.localeCompare(b.displayName);
      if (rareSort === "spawn-points") return b.spawnPointCount - a.spawnPointCount || a.displayName.localeCompare(b.displayName);
      if (rareSort === "drops") return (dropCountsByGroup.get(namedSpawnGroupKey(b)) ?? 0) - (dropCountsByGroup.get(namedSpawnGroupKey(a)) ?? 0) || a.displayName.localeCompare(b.displayName);
      if (rareSort === "chance-high") return (b.chanceMax ?? -1) - (a.chanceMax ?? -1) || a.displayName.localeCompare(b.displayName);
      if (rareSort === "respawn") return (b.respawnMax ?? -1) - (a.respawnMax ?? -1) || a.displayName.localeCompare(b.displayName);
      return (a.chanceMin ?? 100) - (b.chanceMin ?? 100) || namedSort || a.displayName.localeCompare(b.displayName);
    });
  }, [dropCountsByGroup, rareCandidateGroups, rareSort]);

  const groupedRareCandidateGroups = useMemo(() => {
    const sections = new Map<string, NamedSpawnGroup[]>();
    for (const group of sortedRareCandidateGroups) {
      const section = rareGroupBy === "none"
        ? "All named / rare spawns"
        : rareGroupBy === "race"
          ? Array.from(group.races)[0] ?? "Unknown race"
          : rareGroupBy === "chance"
            ? group.chanceBucket
            : levelBucketFor(group.levelMin);
      sections.set(section, [...(sections.get(section) ?? []), group]);
    }
    return Array.from(sections.entries()).sort(([labelA], [labelB]) => labelA.localeCompare(labelB));
  }, [rareGroupBy, sortedRareCandidateGroups]);

  const rareSummary = useMemo(() => {
    const lowChanceCount = rareCandidateGroups.filter((group) => (group.chanceMin ?? 100) <= 20).length;
    const raceCount = new Set(rareCandidateGroups.flatMap((group) => Array.from(group.races))).size;
    const longestRespawn = Math.max(...rareCandidateGroups.map((group) => group.respawnMax ?? 0), 0);
    return {
      lowChanceCount,
      longestRespawn,
      raceCount,
      total: rareCandidateGroups.length,
    };
  }, [rareCandidateGroups]);

  useEffect(() => {
    setVisibleSpawnGroupCount(40);
  }, [chanceCap, hasDropsOnly, lowChanceOnly, max, min, namedOnly, normalizedName, normalizedRace]);

  useEffect(() => {
    if (expandedNamedKey && !rareCandidateGroups.some((group) => namedSpawnGroupKey(group) === expandedNamedKey)) {
      setExpandedNamedKey(null);
      setExpandedLocationKey(null);
      setSelectedDropKey(null);
      setShowExactLocationsKey(null);
    }
  }, [expandedNamedKey, rareCandidateGroups]);

  useEffect(() => {
    if (!selectedFocus) return;
    const matchingGroup = rareCandidateGroups.find((group) => (
      group.candidates.some(({ candidate }) => realSpawnFocusMatchesCandidate(selectedFocus, candidate))
    ));
    if (matchingGroup) {
      setExpandedNamedKey(namedSpawnGroupKey(matchingGroup));
      setExpandedLocationKey(null);
      setSelectedDropKey(null);
      setShowExactLocationsKey(null);
    }
  }, [rareCandidateGroups, selectedFocus]);

  return (
    <details className="zones-expandable-section zones-real-spawn-intel" open ref={sectionRef}>
      <summary>
        <span>Real Spawn Intelligence</span>
        <small>{spawnData?.spawnSlotCount ?? eqemuSpawnRows.length} spawn slots / {spawnData?.candidateCount ?? eqemuSpawnRows.reduce((sum, spawn) => sum + (spawn.candidates?.length ?? 0), 0)} candidates</small>
      </summary>
      <div className="zones-expandable-body">
        <p className="zones-map-note">
          Spawn-slot data from EQEmu/PEQ. This view emphasizes rare candidates, placeholders, spawn groups, chances, and respawn timers.
        </p>
        {lootPending ? (
          <p className="zones-map-note">Loading drop data from a static zone asset...</p>
        ) : null}
        {selectedFocus ? (
          <div className="zones-real-spawn-focus-banner">
            <div>
              <span>Map selection</span>
              <strong>{selectedFocus.mobName}</strong>
              <small>
                Showing matching drops, spawn candidates, and placeholder alternatives.
              </small>
            </div>
            <button className="filter-button" onClick={onClearFocus} type="button">Clear selection</button>
          </div>
        ) : null}
        <div className="zones-real-spawn-filters">
          <label className="zone-filter">
            <span>Mob name</span>
            <input onChange={(event) => setNameFilter(event.target.value)} placeholder="Search candidates" type="search" value={nameFilter} />
          </label>
          <label className="zone-filter">
            <span>Race</span>
            <input onChange={(event) => setRaceFilter(event.target.value)} placeholder="Race" type="search" value={raceFilter} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Min level</span>
            <input onChange={(event) => setMinLevel(event.target.value)} type="number" value={minLevel} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Max level</span>
            <input onChange={(event) => setMaxLevel(event.target.value)} type="number" value={maxLevel} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Max chance</span>
            <input onChange={(event) => setMaxChance(event.target.value)} placeholder="Any" type="number" value={maxChance} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Min spawns</span>
            <input onChange={(event) => setMinSpawnPoints(event.target.value)} type="number" value={minSpawnPoints} />
          </label>
          <label className="zone-filter zones-real-spawn-select">
            <span>Sort</span>
            <select onChange={(event) => setRareSort(event.target.value as RareSortOption)} value={rareSort}>
              <option value="chance-low">Lowest chance</option>
              <option value="name">Name</option>
              <option value="level">Level</option>
              <option value="race">Race</option>
              <option value="spawn-points">Most spawn points</option>
              <option value="drops">Most drops</option>
              <option value="chance-high">Highest chance</option>
              <option value="respawn">Longest respawn</option>
            </select>
          </label>
          <label className="zone-filter zones-real-spawn-select">
            <span>Group</span>
            <select onChange={(event) => setRareGroupBy(event.target.value as RareGroupOption)} value={rareGroupBy}>
              <option value="none">No grouping</option>
              <option value="race">Race</option>
              <option value="chance">Chance bucket</option>
              <option value="level">Level range</option>
            </select>
          </label>
          <button className={namedOnly ? "filter-button is-active" : "filter-button"} onClick={() => setNamedOnly((value) => !value)} type="button">Named only</button>
          <button className={lowChanceOnly ? "filter-button is-active" : "filter-button"} onClick={() => setLowChanceOnly((value) => !value)} type="button">Low chance only</button>
          <button className={hasDropsOnly ? "filter-button is-active" : "filter-button"} onClick={() => setHasDropsOnly((value) => !value)} type="button">Has drops</button>
        </div>

        {eqemuSpawnRows.length === 0 ? (
          <p className="empty">Real spawn data is not available for this zone yet.</p>
        ) : null}

        <section className="zones-real-spawn-section">
          <div className="zones-real-spawn-heading">
            <h3>Possible Mobs</h3>
            <span>{sortedRareCandidateGroups.length} mobs / {rareCandidates.length} spawn entries</span>
          </div>
          <div className="zones-real-spawn-summary-strip">
            <div><span>Possible mobs</span><strong>{rareSummary.total}</strong></div>
            <div><span>Low-chance candidates</span><strong>{rareSummary.lowChanceCount}</strong></div>
            <div><span>Unique races</span><strong>{rareSummary.raceCount}</strong></div>
            <div><span>Longest respawn</span><strong>{formatRespawn(rareSummary.longestRespawn || null)}</strong></div>
          </div>
          {sortedRareCandidateGroups.length === 0 ? (
            <p className="empty">No possible mobs match these filters.</p>
          ) : null}
          <div className="zones-named-hunt-list">
            {groupedRareCandidateGroups.map(([sectionLabel, groups]) => (
              <section className="zones-named-hunt-group" key={sectionLabel}>
                {rareGroupBy !== "none" ? <h4>{sectionLabel} <span>{groups.length}</span></h4> : null}
                {groups.map((group) => {
                  const groupKey = namedSpawnGroupKey(group);
                  const isExpanded = expandedNamedKey === groupKey;
                  const groupFocusCandidate = group.candidates[0];
                  const isFocusedGroup = selectedFocus
                    ? group.candidates.some(({ candidate }) => realSpawnFocusMatchesCandidate(selectedFocus, candidate))
                    : false;
                  const commonPlaceholders = isExpanded ? summarizeCandidateNames(group, false) : [];
                  const otherRareCandidates = isExpanded ? summarizeCandidateNames(group, true) : [];
                  const candidateSets = isExpanded ? summarizeCandidateSets(group) : [];
                  const possibleDrops = isExpanded ? summarizePossibleDrops(group, eqemuLootMobsByNpcTypeId) : [];
                  const dropCount = isExpanded ? possibleDrops.length : dropCountsByGroup.get(groupKey) ?? 0;
                  const selectedDrop = isExpanded && selectedDropKey
                    ? possibleDrops.find((drop) => `${groupKey}-${drop.itemId}` === selectedDropKey) ?? null
                    : null;
                  const selectedDropInspect = selectedDrop ? eqemuItemToDetails(selectedDrop) : null;
                  return (
                    <article className={[
                      "zones-named-hunt-card",
                      isExpanded ? "is-expanded" : "",
                      isFocusedGroup ? "is-map-focused" : "",
                    ].filter(Boolean).join(" ")} key={groupKey}>
                      <button
                        aria-expanded={isExpanded}
                        className="zones-named-hunt-summary"
                        onClick={() => {
                          if (groupFocusCandidate) {
                            const focus = makeRealSpawnFocus(groupFocusCandidate.candidate, undefined, "list");
                            onSelectFocus?.(focus);
                          }
                          setExpandedNamedKey(isExpanded ? null : groupKey);
                          setExpandedLocationKey(null);
                          setSelectedDropKey(null);
                          setShowExactLocationsKey(null);
                        }}
                        type="button"
                      >
                        <strong>{group.displayName}</strong>
                        <span>Level {formatNumberRange(group.levels)}</span>
                        <span>{Array.from(group.races).join(", ") || "Unknown race"}</span>
                        <span>{Array.from(group.classNames).join(", ") || "Unknown class"}</span>
                        <span>{formatChanceRange(group.chances)}</span>
                        <span>{group.spawnPointCount} spawn point{group.spawnPointCount === 1 ? "" : "s"}</span>
                        <span>{formatRespawnRange(group.respawns)} respawn</span>
                        <span>{dropCount ? `${dropCount} drop${dropCount === 1 ? "" : "s"}` : "No drops"}</span>
                      </button>
                      {isExpanded ? (
                        <div className="zones-spawn-location-list">
                          {possibleDrops.length ? (
                            <div className="zones-possible-drops is-primary">
                              <div className="zones-possible-drops-heading">
                                <strong>Possible drops</strong>
                                <span>{possibleDrops.length} resolved item{possibleDrops.length === 1 ? "" : "s"}</span>
                              </div>
                              <div className="zones-possible-drop-list">
                                {possibleDrops.map((drop) => (
                                  <DropInspectRow
                                    drop={drop}
                                    groupKey={groupKey}
                                    key={drop.itemId}
                                    mobName={group.displayName}
                                    onToggle={() => setSelectedDropKey((current) => current === `${groupKey}-${drop.itemId}` ? null : `${groupKey}-${drop.itemId}`)}
                                    selected={selectedDropKey === `${groupKey}-${drop.itemId}`}
                                    zoneName={zoneName}
                                  />
                                ))}
                              </div>
                              {selectedDropInspect ? (
                                <div className="zones-drop-inspect-panel">
                                  <EqItemInspect compact details={selectedDropInspect.details} itemName={selectedDropInspect.drop.itemName} />
                                  <DropInspectFooter inspect={selectedDropInspect} mobName={group.displayName} zoneName={zoneName} />
                                  {selectedDropInspect.source === "existing" || selectedDropInspect.source === "both" ? (
                                    <a className="zones-drop-item-page-link" href={`/item/${itemToSlug(selectedDropInspect.drop.itemName)}`}>Open item page</a>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <p className="zones-spawn-loot-empty">No resolved drops found in local DB.</p>
                          )}
                          <details className="zones-spawn-secondary-details">
                            <summary>
                              <strong>Show spawn details</strong>
                              <span>{group.spawnPointCount} spawn point{group.spawnPointCount === 1 ? "" : "s"} / {candidateSets.length} candidate set{candidateSets.length === 1 ? "" : "s"}</span>
                            </summary>
                            <div className="zones-spawn-location-overview">
                              <div className="zones-spawn-pattern-grid">
                                <div><span>Spawn points</span><strong>{group.spawnPointCount}</strong></div>
                                <div><span>Chance</span><strong>{formatChanceRange(group.chances)}</strong></div>
                                <div><span>Respawn</span><strong>{formatRespawnRange(group.respawns)}</strong></div>
                                <div><span>Coordinate bounds</span><strong>{coordinateBoundsText(group)}</strong></div>
                              </div>
                              <div className="zones-spawn-pattern-columns">
                                <div>
                                  <strong>Common placeholders</strong>
                                  {commonPlaceholders.length ? (
                                    <ul>
                                      {commonPlaceholders.map((summary) => (
                                        <li key={summary.name}>
                                          <span>{summary.name}</span>
                                          <em>{candidateChanceText(summary)}</em>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : <p>No common placeholders listed.</p>}
                                </div>
                                <div>
                                  <strong>Other rare candidates</strong>
                                  {otherRareCandidates.length ? (
                                    <ul>
                                      {otherRareCandidates.map((summary) => (
                                        <li key={summary.name}>
                                          <span>{summary.name}</span>
                                          <em>{candidateChanceText(summary)}</em>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : <p>No other rare candidates listed.</p>}
                                </div>
                              </div>
                              <div className="zones-spawn-candidate-set-list">
                                {candidateSets.map((setSummary, setIndex) => (
                                  <details className="zones-spawn-candidate-set" key={`${groupKey}-set-${setIndex}`}>
                                    <summary>
                                      <strong>{setSummary.count} location{setSummary.count === 1 ? "" : "s"} with this candidate set</strong>
                                      <span>Respawn {formatSetRespawnRange(setSummary)}</span>
                                    </summary>
                                    <div className="zones-spawn-candidate-list">
                                      {setSummary.candidates.map((alternative, alternativeIndex) => {
                                        const labels = candidateLabels(alternative, group.candidates[0]?.spawn);
                                        return (
                                          <div key={`${groupKey}-set-${setIndex}-${alternative.npcTypeId ?? alternative.name}-${alternativeIndex}`}>
                                            <strong>{alternative.displayName}</strong>
                                            <span>{alternative.chance ?? "?"}%</span>
                                            <span>Level {alternative.level ?? "Unknown"}</span>
                                            <span>{alternative.race}</span>
                                            <span>{alternative.className}</span>
                                            <span>{labels.length ? labels.join(" / ") : "Common"}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </details>
                                ))}
                              </div>
                              <button
                                className="zones-show-more-button"
                                onClick={() => {
                                  const willShow = showExactLocationsKey !== groupKey;
                                  setShowExactLocationsKey(willShow ? groupKey : null);
                                  setExpandedLocationKey(null);
                                }}
                                type="button"
                              >
                                {showExactLocationsKey === groupKey ? "Hide exact locations" : `Show ${group.spawnPointCount} exact locations`}
                              </button>
                            </div>
                          </details>
                          {showExactLocationsKey === groupKey ? group.candidates.map(({ candidate, spawn }, index) => {
                            const locationKey = spawnLocationKey(spawn, candidate, index);
                            const isLocationExpanded = expandedLocationKey === locationKey;
                            return (
                              <article className={isLocationExpanded ? "zones-spawn-location-card is-expanded" : "zones-spawn-location-card"} key={locationKey}>
                                <button
                                  aria-expanded={isLocationExpanded}
                                  className="zones-spawn-location-summary"
                                  onClick={() => setExpandedLocationKey(isLocationExpanded ? null : locationKey)}
                                  type="button"
                                >
                                  <strong>{formatSpawnLocation(spawn)}</strong>
                                  <span>Chance {candidate.chance ?? "?"}%</span>
                                  <span>Respawn {formatRespawn(spawn.respawnTime)}</span>
                                  <span>{placeholderSummary(spawn, candidate)}</span>
                                </button>
                                {isLocationExpanded ? (
                                  <div className="zones-spawn-candidate-panel">
                                    <div className="zones-spawn-candidate-panel-head">
                                      <strong>Spawn candidates</strong>
                                      <span>Possible placeholders for this location</span>
                                    </div>
                                    <div className="zones-spawn-candidate-list">
                                      {(spawn.candidates ?? []).map((alternative, alternativeIndex) => {
                                        const labels = candidateLabels(alternative, spawn);
                                        const candidateKey = `${spawn.spawn2Id ?? "spawn"}-${alternative.npcTypeId ?? alternative.name ?? alternative.displayName}-${alternativeIndex}`;
                                        return (
                                          <div key={candidateKey}>
                                            <strong>{alternative.displayName}</strong>
                                            <span>{alternative.chance ?? "?"}%</span>
                                            <span>Level {alternative.level ?? "Unknown"}</span>
                                            <span>{alternative.race}</span>
                                            <span>{alternative.className}</span>
                                            <span>{labels.length ? labels.join(" / ") : "Common"}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <small className="zones-spawn-debug-note">
                                      Debug: spawn group {spawn.spawngroupId ?? "Unknown"} / spawn slot {spawn.spawn2Id ?? "Unknown"}
                                    </small>
                                  </div>
                                ) : null}
                              </article>
                            );
                          }) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            ))}
          </div>
        </section>

        <section className="zones-real-spawn-section">
          <div className="zones-real-spawn-heading">
            <h3>Spawn Groups</h3>
            <span>{filteredSpawnRows.length} matching slots</span>
          </div>
          <div className="zones-spawn-group-list">
            {filteredSpawnRows.slice(0, visibleSpawnGroupCount).map((spawn, spawnIndex) => (
              <details className="zones-spawn-group-card" key={spawn.spawn2Id ?? `${spawn.displayName}-${spawnIndex}`}>
                <summary>
                  <span>{spawn.displayName}</span>
                  <small>{spawn.candidates?.length ?? 0} candidates / respawn {formatRespawn(spawn.respawnTime)} / group {spawn.spawngroupId ?? "Unknown"}</small>
                </summary>
                <div className="zones-spawn-candidate-list">
                  {(spawn.candidates ?? []).map((candidate, candidateIndex) => (
                    <div key={`${spawn.spawn2Id ?? "spawn"}-${candidate.npcTypeId ?? candidate.name ?? candidate.displayName}-${candidateIndex}`}>
                      <strong>{candidate.displayName}</strong>
                      <span>{candidate.chance ?? "?"}%</span>
                      <span>Level {candidate.level ?? "Unknown"}</span>
                      <span>{candidate.race}</span>
                      <span>{candidate.className}</span>
                      <span>{candidateLabels(candidate, spawn).join(" / ")}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          {filteredSpawnRows.length > visibleSpawnGroupCount ? (
            <button
              className="zones-show-more-button"
              onClick={() => setVisibleSpawnGroupCount((current) => current + 40)}
              type="button"
            >
              Show 40 more spawn groups
            </button>
          ) : null}
        </section>
      </div>
    </details>
  );
}

function SpawnMapPausedNotice() {
  return (
    <div className="zones-empty-state">
      <strong>Spawn map prototype paused while we improve performance.</strong>
      <span>Map parsing, export scripts, and calibration data are still preserved for later.</span>
    </div>
  );
}

function NativeCoordinateMapDebug({
  data,
  lootData,
  onClearFocus,
  onSelectFocus,
  selectedFocus,
  spawnData,
}: {
  data: NativeMapDebugData;
  lootData?: EqemuLootTestData | null;
  onClearFocus?: () => void;
  onSelectFocus?: (focus: RealSpawnFocus) => void;
  selectedFocus?: RealSpawnFocus | null;
  spawnData?: EqemuSpawnTestData | null;
}) {
  const zoneShortName = data.zoneShortName;
  const mapAssetManifest = zoneMapAssets[zoneShortName];
  const mapSectionRef = useRef<HTMLDetailsElement | null>(null);
  const [shouldLoadMapAsset, setShouldLoadMapAsset] = useState(false);
  const [loadedMapAsset, setLoadedMapAsset] = useState<MapAsset | null>(null);
  const mapAsset = loadedMapAsset ?? (Array.isArray(mapAssetManifest?.layers) && mapAssetManifest.layers.length ? mapAssetManifest : null);
  const nativeBounds = data.bounds ?? { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const mapLayers = Array.isArray(mapAsset?.layers) ? mapAsset.layers : [];
  const nativeSpawns = Array.isArray(data.spawns) ? data.spawns : [];
  const collisionLines = Array.isArray(data.collisionLines) ? data.collisionLines : [];
  const gridLines = Array.isArray(data.gridLines) ? data.gridLines : [];
  const doors = Array.isArray(data.doors) ? data.doors : [];
  const zonePoints = Array.isArray(data.zonePoints) ? data.zonePoints : [];
  const groundSpawns = Array.isArray(data.groundSpawns) ? data.groundSpawns : [];
  useEffect(() => {
    const node = mapSectionRef.current;
    if (!node || shouldLoadMapAsset) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoadMapAsset(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoadMapAsset(true);
        observer.disconnect();
      }
    }, { rootMargin: "500px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoadMapAsset]);

  useEffect(() => {
    let cancelled = false;
    setLoadedMapAsset(null);
    if (!shouldLoadMapAsset || !mapAssetManifest?.assetUrl) return undefined;
    fetch(mapAssetManifest.assetUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((asset: MapAsset | null) => {
        if (!cancelled) setLoadedMapAsset(asset);
      })
      .catch(() => {
        if (!cancelled) setLoadedMapAsset(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mapAssetManifest?.assetUrl, shouldLoadMapAsset]);
  const primarySpawnsById = useMemo(() => new Map(
    (Array.isArray(spawnData?.primarySpawnRows) ? spawnData.primarySpawnRows : [])
      .map((spawn) => [spawn.spawn2Id, spawn] as const),
  ), [spawnData]);
  const lootMobsByNpcTypeId = useMemo(() => new Map(
    (Array.isArray(lootData?.mobs) ? lootData.mobs : [])
      .map((mob) => [mob.npcTypeId, mob] as const),
  ), [lootData]);
  const zoneLootDistribution = useMemo(
    () => buildZoneLootDistribution(Array.isArray(lootData?.mobs) ? lootData.mobs : []),
    [lootData],
  );
  const spawnFootprintsByNpcTypeId = useMemo(() => {
    const footprints = new Map<number, SpawnMapCandidateFootprint>();
    const seen = new Set<string>();
    for (const spawn of Array.isArray(spawnData?.primarySpawnRows) ? spawnData.primarySpawnRows : []) {
      const candidates = (spawn.candidates ?? []).length ? spawn.candidates : [primarySpawnAsCandidate(spawn)];
      for (const candidate of candidates) {
        if (typeof candidate.npcTypeId !== "number") continue;
        const key = `${candidate.npcTypeId}:${spawn.spawn2Id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const current = footprints.get(candidate.npcTypeId);
        footprints.set(candidate.npcTypeId, {
          displayName: current?.displayName ?? candidate.displayName,
          spawnPointCount: (current?.spawnPointCount ?? 0) + 1,
        });
      }
    }
    return footprints;
  }, [spawnData]);
  const representativeZoneShortName = spawnData?.zoneShortName ?? data.zoneShortName;
  const [activeBrewallLayer, setActiveBrewallLayer] = useState<NativeMapLayerChoice>("main");
  const [mapMode, setMapMode] = useState<NativeMapMode>("clean");
  const [renderMode, setRenderMode] = useState<NativeMapRenderMode>("dots");
  const [showMapLines, setShowMapLines] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showCollision, setShowCollision] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showDoors, setShowDoors] = useState(false);
  const [showZonePoints, setShowZonePoints] = useState(false);
  const [showSpawns, setShowSpawns] = useState(true);
  const [showGroundSpawns, setShowGroundSpawns] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const configuredSpawnTransform = zoneMapCalibrations[zoneShortName]?.spawnTransform;
  const configuredAxisPair = configuredSpawnTransform?.axisPair ?? "xy";
  const configuredAxesFromPair = spawnAxisPairs.find((pair) => pair.key === configuredAxisPair) ?? spawnAxisPairs[0];
  const configuredAxisA = configuredSpawnTransform?.axisA ?? configuredAxesFromPair.axisA;
  const configuredAxisB = configuredSpawnTransform?.axisB ?? configuredAxesFromPair.axisB;
  const configuredSelectedTransform = configuredSpawnTransform?.selectedTransform ?? "normal";
  const configuredTransformKey = /^(xy|yx|xz|zx|yz|zy)-/.test(configuredSelectedTransform)
    ? configuredSelectedTransform
    : `${configuredAxisA}${configuredAxisB}-${configuredSelectedTransform}`;
  const configuredTransform = configuredSpawnTransform
    ? {
      axisA: configuredAxisA,
      axisB: configuredAxisB,
      key: configuredTransformKey,
      label: spawnTransformLabelForKey(configuredTransformKey),
      flipA: configuredSpawnTransform.flipA ?? configuredSpawnTransform.flipX ?? false,
      flipB: configuredSpawnTransform.flipB ?? configuredSpawnTransform.flipY ?? false,
      offsetA: configuredSpawnTransform.offsetA ?? configuredSpawnTransform.offsetX ?? 0,
      offsetB: configuredSpawnTransform.offsetB ?? configuredSpawnTransform.offsetY ?? 0,
      rotateX: configuredSpawnTransform.rotateX ?? 0,
      rotateY: configuredSpawnTransform.rotateY ?? 0,
      rotateZ: configuredSpawnTransform.rotateZ ?? 0,
      scaleA: configuredSpawnTransform.scaleA ?? configuredSpawnTransform.scaleX ?? 1,
      scaleB: configuredSpawnTransform.scaleB ?? configuredSpawnTransform.scaleY ?? 1,
    }
    : friendCazicFlipTransform;
  const [spawnTransform, setSpawnTransform] = useState<SpawnTransform>(configuredTransform);
  const [alignmentSource, setAlignmentSource] = useState(configuredSpawnTransform?.source ?? "Default");
  const [dotSize, setDotSize] = useState(defaultSpawnDotSize);
  const [dotOpacity, setDotOpacity] = useState(0.82);
  const [showDotOutline, setShowDotOutline] = useState(true);
  const [copiedSpawnCalibration, setCopiedSpawnCalibration] = useState(false);
  const [selectedSpawnId, setSelectedSpawnId] = useState<number | null>(selectedFocus?.spawn2Id ?? null);
  const [hoveredSpawnId, setHoveredSpawnId] = useState<number | null>(null);
  const [mapSpecialOnly, setMapSpecialOnly] = useState(false);
  const [mapNameFilter, setMapNameFilter] = useState("");
  const [mapRaceFilter, setMapRaceFilter] = useState("");
  const [mapMinLevel, setMapMinLevel] = useState("");
  const [mapMaxLevel, setMapMaxLevel] = useState("");
  const [showAllFloors, setShowAllFloors] = useState(false);
  const [floorVariance, setFloorVariance] = useState<NativeMapFloorVariance>("normal");
  const [fadeMapByHeight, setFadeMapByHeight] = useState(true);
  const [zFilterEnabled, setZFilterEnabled] = useState(false);
  const [zCenter, setZCenter] = useState(0);
  const [zRange, setZRange] = useState(0);
  const [viewBox, setViewBox] = useState<NativeViewBox | null>(null);
  const [dragStart, setDragStart] = useState<{ pointerId: number; clientX: number; clientY: number; viewBox: NativeViewBox } | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoveredSpawnIdRef = useRef<number | null>(null);
  const selectedLayers = useMemo(() => {
    if (activeBrewallLayer === "all") return mapLayers;
    return mapLayers.filter((layer) => layer.key === activeBrewallLayer);
  }, [activeBrewallLayer, mapLayers]);
  const mapLineBounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const layer of selectedLayers) {
      for (const line of layer.lines) {
        xs.push(line.x1, line.x2);
        ys.push(line.y1, line.y2);
      }
    }
    if (!xs.length || !ys.length) return mapAsset?.bounds ?? nativeBounds;
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [mapAsset, nativeBounds, selectedLayers]);
  const selectedMapLines = useMemo(() => selectedLayers.flatMap((layer) => layer.lines), [selectedLayers]);
  const mapZBounds = useMemo(() => {
    const values: number[] = [];
    const addZ = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) values.push(value);
    };
    for (const spawn of nativeSpawns) addZ(spawn.z);
    for (const layer of selectedLayers) {
      for (const line of layer.lines) {
        addZ(line.z1);
        addZ(line.z2);
      }
      for (const label of layer.labels) addZ(label.z);
    }
    for (const line of collisionLines) {
      addZ(line.z1);
      addZ(line.z2);
    }
    for (const line of gridLines) {
      addZ(line.z1);
      addZ(line.z2);
    }
    if (!values.length) return null;
    const min = Math.floor(Math.min(...values));
    const max = Math.ceil(Math.max(...values));
    return { min, max, midpoint: Math.round((min + max) / 2), span: Math.max(1, max - min) };
  }, [collisionLines, gridLines, nativeSpawns, selectedLayers]);
  const activeZFilter = zFilterEnabled && mapZBounds !== null;
  const activeZMin = mapZBounds ? zCenter - zRange : null;
  const activeZMax = mapZBounds ? zCenter + zRange : null;
  const spawnBounds = useMemo(() => nativePointBounds(nativeSpawns), [nativeSpawns]);
  const allBounds = useMemo(() => combineBounds([mapLineBounds, spawnBounds]), [mapLineBounds, spawnBounds]);
  const enrichedSpawns = useMemo(() => nativeSpawns.map((spawn) => {
    const primary = typeof spawn.id === "number" ? primarySpawnsById.get(spawn.id) : undefined;
    return {
      ...spawn,
      primary,
      representative: chooseSpawnMapRepresentative(primary, representativeZoneShortName, lootMobsByNpcTypeId, zoneLootDistribution, spawnFootprintsByNpcTypeId),
    };
  }), [lootMobsByNpcTypeId, nativeSpawns, primarySpawnsById, representativeZoneShortName, spawnFootprintsByNpcTypeId, zoneLootDistribution]);
  // The Cazic-Thule friend-fix test is intentionally manual: keep the Brewall map fixed
  // and compare the targeted -X/-Y spawn transform without running expensive auto-score sweeps.
  const bestAutoAlignment: ScoredSpawnTransform | null = null;
  const currentAlignmentScore = useMemo(
    () => scoreSpawnTransform(nativeSpawns, selectedMapLines, mapLineBounds, spawnTransform),
    [mapLineBounds, nativeSpawns, selectedMapLines, spawnTransform],
  );
  const transformedSpawns = useMemo(() => enrichedSpawns.map((spawn) => ({
    ...spawn,
    transformed: applySpawnTransform(spawn, spawnTransform, mapLineBounds),
  })), [enrichedSpawns, mapLineBounds, spawnTransform]);
  const filteredTransformedSpawns = useMemo(() => {
    const nameQuery = mapNameFilter.trim().toLowerCase();
    const raceQuery = mapRaceFilter.trim().toLowerCase();
    const minLevel = mapMinLevel.trim() ? Number.parseInt(mapMinLevel, 10) : null;
    const maxLevel = mapMaxLevel.trim() ? Number.parseInt(mapMaxLevel, 10) : null;

    return transformedSpawns.filter((spawn) => {
      if (!Number.isFinite(spawn.transformed.x) || !Number.isFinite(spawn.transformed.y)) return false;
      const primary = spawn.primary;
      const representative = spawn.representative;
      const category = spawnMapDotCategory(spawn);
      if (mapSpecialOnly && category !== "special") return false;
      if (nameQuery) {
        const haystack = [
          representative?.displayName,
          representative?.name,
          primary?.displayName,
          primary?.primaryNpcName,
          spawn.displayName,
          spawn.name,
        ].join(" ").toLowerCase();
        if (!haystack.includes(nameQuery)) return false;
      }
      if (raceQuery) {
        const raceText = String(representative?.race ?? primary?.race ?? spawn.race ?? "").toLowerCase();
        if (!raceText.includes(raceQuery)) return false;
      }
      const level = representative?.level ?? primary?.level ?? spawn.level ?? null;
      if (minLevel !== null && Number.isFinite(minLevel) && (level === null || level < minLevel)) return false;
      if (maxLevel !== null && Number.isFinite(maxLevel) && (level === null || level > maxLevel)) return false;
      if (activeZFilter) {
        if (typeof spawn.z !== "number" || !Number.isFinite(spawn.z)) return false;
        if (activeZMin !== null && spawn.z < activeZMin) return false;
        if (activeZMax !== null && spawn.z > activeZMax) return false;
      }
      return true;
    });
  }, [activeZFilter, activeZMax, activeZMin, mapMaxLevel, mapMinLevel, mapNameFilter, mapRaceFilter, mapSpecialOnly, transformedSpawns]);
  const hasActiveMapFilter = mapSpecialOnly
    || Boolean(mapNameFilter.trim())
    || Boolean(mapRaceFilter.trim())
    || Boolean(mapMinLevel.trim())
    || Boolean(mapMaxLevel.trim())
    || activeZFilter;
  const renderTransformedSpawns = useMemo(() => [...filteredTransformedSpawns].sort((a, b) => {
    const aSelected = a.id === selectedSpawnId;
    const bSelected = b.id === selectedSpawnId;
    if (aSelected !== bSelected) return aSelected ? 1 : -1;
    const aHovered = a.id === hoveredSpawnId;
    const bHovered = b.id === hoveredSpawnId;
    if (aHovered !== bHovered) return aHovered ? 1 : -1;
    const aSpecial = spawnMapDotCategory(a) === "special";
    const bSpecial = spawnMapDotCategory(b) === "special";
    if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
    return 0;
  }), [filteredTransformedSpawns, hoveredSpawnId, selectedSpawnId]);
  const transformedSpawnBounds = useMemo(() => nativePointBounds(transformedSpawns.map((spawn) => ({
    x: spawn.transformed.x,
    y: spawn.transformed.y,
    z: spawn.z,
  }))), [transformedSpawns]);
  const selectedSpawn = selectedSpawnId === null ? null : enrichedSpawns.find((spawn) => spawn.id === selectedSpawnId) ?? null;
  const selectedRepresentative = selectedSpawn?.representative;
  const selectedSpawnCategory = selectedSpawn ? spawnMapDotCategory(selectedSpawn) : null;
  const selectedRepresentativeDropCount = selectedRepresentative
    ? lootMobDropCount(lootMobsByNpcTypeId.get(selectedRepresentative.npcTypeId))
    : 0;
  const selectedCandidateDebugRows = useMemo(() => spawnMapCandidateDebugRows(
    selectedSpawn?.primary,
    representativeZoneShortName,
    lootMobsByNpcTypeId,
    zoneLootDistribution,
    spawnFootprintsByNpcTypeId,
    selectedRepresentative,
  ), [lootMobsByNpcTypeId, representativeZoneShortName, selectedRepresentative, selectedSpawn, spawnFootprintsByNpcTypeId, zoneLootDistribution]);
  const selectedRepresentativeSpawnPointCount = selectedRepresentative
    ? enrichedSpawns.filter((spawn) => (
      spawn.primary?.candidates?.some((candidate) => realSpawnFocusMatchesCandidate(makeRealSpawnFocus(selectedRepresentative, selectedSpawn?.primary, "map"), candidate))
    )).length
    : 0;
  const hoveredSpawn = hoveredSpawnId === null ? null : filteredTransformedSpawns.find((spawn) => spawn.id === hoveredSpawnId) ?? null;
  const activeFocusSpawn = (hoveredSpawnId === null ? null : filteredTransformedSpawns.find((spawn) => spawn.id === hoveredSpawnId) ?? null)
    ?? (selectedSpawnId === null ? null : filteredTransformedSpawns.find((spawn) => spawn.id === selectedSpawnId) ?? null);
  const selectedFocusSpawn = selectedSpawnId === null ? null : filteredTransformedSpawns.find((spawn) => spawn.id === selectedSpawnId) ?? null;
  const mapFocusActive = activeFocusSpawn !== null || hasActiveMapFilter;
  const spawnFocusActive = !showAllFloors && selectedFocusSpawn !== null;
  const activeFloorZ = spawnFocusActive && typeof selectedFocusSpawn.z === "number" ? selectedFocusSpawn.z : null;
  const heightFadingActive = spawnFocusActive && activeFloorZ !== null;
  const mapHeightFadingActive = heightFadingActive && fadeMapByHeight;
  const hoveredZDifference = activeFloorZ !== null && typeof hoveredSpawn?.z === "number" ? Math.abs(hoveredSpawn.z - activeFloorZ) : null;
  const outOfBoundsSpawns = currentAlignmentScore.outOfBoundsCount;
  const currentViewBox = viewBox ?? boundsToViewBox(padBounds(mapLineBounds));
  const svgViewBox = `${currentViewBox.minX} ${currentViewBox.minY} ${currentViewBox.width} ${currentViewBox.height}`;
  const zoomLevel = Math.max(1, Math.round(((mapLineBounds.maxX - mapLineBounds.minX) / currentViewBox.width) * 10) / 10);
  const mapUnitDotSize = dotSize;
  const visibleMapLayers = useMemo(() => selectedLayers.map((layer) => ({
    ...layer,
    labels: layer.labels
      .filter((label) => !activeZFilter || (typeof label.z === "number" && activeZMin !== null && activeZMax !== null && label.z >= activeZMin && label.z <= activeZMax))
      .map((label) => ({
        ...label,
        heightOpacity: geometryHeightOpacity(label.z, activeFloorZ, floorVariance, mapHeightFadingActive),
      })),
    lines: layer.lines
      .filter((line) => !activeZFilter || (activeZMin !== null && activeZMax !== null && mapLineOverlapsZRange(line, activeZMin, activeZMax)))
      .map((line) => ({
        ...line,
        heightOpacity: geometryHeightOpacity(mapLineAverageZ(line), activeFloorZ, floorVariance, mapHeightFadingActive),
      })),
  })), [activeFloorZ, activeZFilter, activeZMax, activeZMin, floorVariance, mapHeightFadingActive, selectedLayers]);
  const visibleCollisionLines = useMemo(() => collisionLines
    .filter(validLine)
    .filter((line) => !activeZFilter || (activeZMin !== null && activeZMax !== null && mapLineOverlapsZRange(line, activeZMin, activeZMax)))
    .map((line) => ({
      ...line,
      heightOpacity: geometryHeightOpacity(mapLineAverageZ(line), activeFloorZ, floorVariance, mapHeightFadingActive),
    })), [activeFloorZ, activeZFilter, activeZMax, activeZMin, collisionLines, floorVariance, mapHeightFadingActive]);
  const visibleGridLines = useMemo(() => gridLines
    .filter(validLine)
    .filter((line) => !activeZFilter || (activeZMin !== null && activeZMax !== null && mapLineOverlapsZRange(line, activeZMin, activeZMax)))
    .map((line) => ({
      ...line,
      heightOpacity: geometryHeightOpacity(mapLineAverageZ(line), activeFloorZ, floorVariance, mapHeightFadingActive),
    })), [activeFloorZ, activeZFilter, activeZMax, activeZMin, floorVariance, gridLines, mapHeightFadingActive]);
  const spawnRenderState = useMemo(() => {
    const focusNames = activeFocusSpawn ? spawnMapCandidateNames(activeFocusSpawn) : null;
    const stateById = new Map<number | string, {
      combinedOpacity: number;
      isDimmed: boolean;
      isFocusRelated: boolean;
      isOtherFloor: boolean;
    }>();
    for (const spawn of filteredTransformedSpawns) {
      const isSelected = spawn.id === selectedSpawnId;
      const isHovered = spawn.id === hoveredSpawnId;
      let isFocusRelated = true;
      if (activeFocusSpawn && focusNames) {
        isFocusRelated = Boolean(spawn.id !== undefined && spawn.id !== null && spawn.id === activeFocusSpawn.id);
        if (!isFocusRelated) {
          for (const name of spawnMapCandidateNames(spawn)) {
            if (focusNames.has(name)) {
              isFocusRelated = true;
              break;
            }
          }
        }
      }
      const zDistance = activeFloorZ !== null && typeof spawn.z === "number" ? Math.abs(spawn.z - activeFloorZ) : null;
      const zOpacity = heightFadingActive ? floorDistanceOpacity(zDistance, floorVariance) : 1;
      const focusOpacity = mapFocusActive && activeFocusSpawn !== null && !isFocusRelated && !isSelected && !isHovered ? 0.78 : 1;
      const combinedOpacity = Math.max(isSelected || isHovered ? 1 : 0.08, dotOpacity * zOpacity * focusOpacity);
      stateById.set(spawn.id ?? `${spawn.x}-${spawn.y}-${spawn.z}`, {
        combinedOpacity,
        isDimmed: combinedOpacity < dotOpacity * 0.72,
        isFocusRelated,
        isOtherFloor: zOpacity <= 0.35,
      });
    }
    return stateById;
  }, [activeFloorZ, activeFocusSpawn, dotOpacity, filteredTransformedSpawns, floorVariance, heightFadingActive, hoveredSpawnId, mapFocusActive, selectedSpawnId]);

  useEffect(() => {
    setViewBox(boundsToViewBox(padBounds(mapLineBounds)));
  }, [activeBrewallLayer, mapLineBounds.maxX, mapLineBounds.maxY, mapLineBounds.minX, mapLineBounds.minY]);

  useEffect(() => {
    if (!mapZBounds) {
      setZFilterEnabled(false);
      setZCenter(0);
      setZRange(0);
      return;
    }
    setZCenter(mapZBounds.midpoint);
    setZRange(Math.ceil(mapZBounds.span / 2));
  }, [mapZBounds?.max, mapZBounds?.midpoint, mapZBounds?.min, mapZBounds?.span]);

  useEffect(() => () => {
    if (hoverFrameRef.current !== null) window.cancelAnimationFrame(hoverFrameRef.current);
  }, []);

  useEffect(() => {
    if (!selectedFocus) {
      setSelectedSpawnId(null);
      return;
    }
    if (typeof selectedFocus.spawn2Id === "number") {
      setSelectedSpawnId(selectedFocus.spawn2Id);
      return;
    }
    const matchingSpawn = enrichedSpawns.find((spawn) => (
      spawn.primary?.candidates?.some((candidate) => realSpawnFocusMatchesCandidate(selectedFocus, candidate))
    ));
    setSelectedSpawnId(typeof matchingSpawn?.id === "number" ? matchingSpawn.id : null);
  }, [enrichedSpawns, selectedFocus]);

  function validLine(line: NativeMapLine) {
    return typeof line.x1 === "number" && typeof line.y1 === "number" && typeof line.x2 === "number" && typeof line.y2 === "number";
  }

  function validPoint(point: NativeMapPoint) {
    return typeof point.x === "number" && typeof point.y === "number";
  }

  function scheduleHoveredSpawn(spawnId: number | null) {
    pendingHoveredSpawnIdRef.current = spawnId;
    if (hoverFrameRef.current !== null) return;
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      setHoveredSpawnId((current) => (
        current === pendingHoveredSpawnIdRef.current ? current : pendingHoveredSpawnIdRef.current
      ));
    });
  }

  function fitBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }, padding = 0.05) {
    setViewBox(boundsToViewBox(padBounds(bounds, padding)));
  }

  function resetZoom() {
    fitBounds(mapLineBounds);
  }

  function resetMapControls() {
    setDotSize(defaultSpawnDotSize);
    setZFilterEnabled(false);
    if (mapZBounds) {
      setZCenter(mapZBounds.midpoint);
      setZRange(Math.ceil(mapZBounds.span / 2));
    } else {
      setZCenter(0);
      setZRange(0);
    }
  }

  function setCleanMode() {
    setMapMode("clean");
    setShowLabels(false);
    setShowCollision(false);
    setShowGrid(false);
    setShowDoors(false);
    setShowZonePoints(false);
    setShowGroundSpawns(false);
    setShowMapLines(true);
    setShowSpawns(true);
  }

  function setFullMode() {
    setMapMode("full");
    setShowLabels(true);
    setShowDoors(true);
    setShowZonePoints(true);
    setShowGroundSpawns(true);
    setShowMapLines(true);
    setShowSpawns(true);
  }

  function zoomMapAt(clientX: number, clientY: number, deltaY: number, rect: DOMRect) {
    const current = currentViewBox;
    const cursorX = current.minX + ((clientX - rect.left) / Math.max(1, rect.width)) * current.width;
    const cursorY = current.minY + ((clientY - rect.top) / Math.max(1, rect.height)) * current.height;
    const factor = deltaY > 0 ? 1.14 : 0.88;
    const nextWidth = Math.max(40, Math.min(current.width * factor, (mapLineBounds.maxX - mapLineBounds.minX) * 1.6));
    const nextHeight = Math.max(40, Math.min(current.height * factor, (mapLineBounds.maxY - mapLineBounds.minY) * 1.6));
    const cursorRatioX = (cursorX - current.minX) / current.width;
    const cursorRatioY = (cursorY - current.minY) / current.height;
    setViewBox({
      minX: cursorX - cursorRatioX * nextWidth,
      minY: cursorY - cursorRatioY * nextHeight,
      width: nextWidth,
      height: nextHeight,
    });
  }

  useEffect(() => {
    const target = svgRef.current;
    if (!target) return undefined;
    const svgNode: SVGSVGElement = target;
    function handleNativeWheel(event: globalThis.WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      zoomMapAt(event.clientX, event.clientY, event.deltaY, svgNode.getBoundingClientRect());
    }
    svgNode.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => svgNode.removeEventListener("wheel", handleNativeWheel);
  }, [currentViewBox, mapLineBounds.maxX, mapLineBounds.maxY, mapLineBounds.minX, mapLineBounds.minY]);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, viewBox: currentViewBox });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragStart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - dragStart.clientX) / Math.max(1, rect.width)) * dragStart.viewBox.width;
    const dy = ((event.clientY - dragStart.clientY) / Math.max(1, rect.height)) * dragStart.viewBox.height;
    setViewBox({
      ...dragStart.viewBox,
      minX: dragStart.viewBox.minX - dx,
      minY: dragStart.viewBox.minY - dy,
    });
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragStart?.pointerId === event.pointerId) setDragStart(null);
  }

  function selectSpawn(spawnId: number | null) {
    setSelectedSpawnId(spawnId);
    if (spawnId === null) {
      onClearFocus?.();
      return;
    }
    const spawn = enrichedSpawns.find((entry) => entry.id === spawnId);
    if (spawn?.representative) {
      onSelectFocus?.(makeRealSpawnFocus(spawn.representative, spawn.primary, "map"));
    }
  }

  function viewSpawnDetailsBelow() {
    document.querySelector(".zones-real-spawn-intel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyAutoAlignment() {
    if (!bestAutoAlignment) return;
    setSpawnTransform(bestAutoAlignment.transform);
    setAlignmentSource("Auto-align button");
  }

  function applySpawnTransformPreset(transformKey: string) {
    if (transformKey === friendCazicFlipTransform.key) {
      setSpawnTransform(friendCazicFlipTransform);
      setAlignmentSource("Friend fix: -X / -Y");
      return;
    }
    const preset = spawnTransformCandidates.find((candidate) => candidate.key === transformKey);
    if (!preset) return;
    setSpawnTransform(preset);
    setAlignmentSource("Manual preset");
  }

  function updateSpawnTransformNumber(key: "offsetA" | "offsetB" | "rotateX" | "rotateY" | "rotateZ" | "scaleA" | "scaleB", value: string) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    setSpawnTransform((current) => ({ ...current, key: "manual", label: "Manual override", [key]: parsed }));
    setAlignmentSource("Manual override");
  }

  function toggleSpawnTransform(key: "flipA" | "flipB") {
    setSpawnTransform((current) => ({ ...current, key: "manual", label: "Manual override", [key]: !current[key] }));
    setAlignmentSource("Manual override");
  }

  function setSpawnAxes(axisKey: string) {
    const pair = spawnAxisPairs.find((entry) => entry.key === axisKey);
    if (!pair) return;
    setSpawnTransform((current) => ({
      ...current,
      axisA: pair.axisA,
      axisB: pair.axisB,
      key: "manual",
      label: "Manual override",
    }));
    setAlignmentSource("Manual override");
  }

  function applyExperimentalFitToMapBounds() {
    const baseTransform = {
      ...spawnTransform,
      offsetA: 0,
      offsetB: 0,
      scaleA: 1,
      scaleB: 1,
    };
    const basePoints = enrichedSpawns.map((spawn) => applySpawnTransform(spawn, baseTransform, mapLineBounds));
    const baseBounds = transformedPointBounds(basePoints);
    const spawnWidth = Math.max(1, baseBounds.maxX - baseBounds.minX);
    const spawnHeight = Math.max(1, baseBounds.maxY - baseBounds.minY);
    const mapWidth = Math.max(1, mapLineBounds.maxX - mapLineBounds.minX);
    const mapHeight = Math.max(1, mapLineBounds.maxY - mapLineBounds.minY);
    const nextScaleA = mapWidth / spawnWidth;
    const nextScaleB = mapHeight / spawnHeight;
    const centerX = (mapLineBounds.minX + mapLineBounds.maxX) / 2;
    const centerY = (mapLineBounds.minY + mapLineBounds.maxY) / 2;
    const nextOffsetA = mapLineBounds.minX - (centerX + (baseBounds.minX - centerX) * nextScaleA);
    const nextOffsetB = mapLineBounds.minY - (centerY + (baseBounds.minY - centerY) * nextScaleB);
    setSpawnTransform((current) => ({
      ...current,
      key: "manual-fit",
      label: "Experimental fit",
      offsetA: Number(nextOffsetA.toFixed(2)),
      offsetB: Number(nextOffsetB.toFixed(2)),
      scaleA: Number(nextScaleA.toFixed(4)),
      scaleB: Number(nextScaleB.toFixed(4)),
    }));
    setAlignmentSource("Experimental fit to map bounds");
  }

  function applyRotationPreset(rotation: typeof spawnRotationPresets[number]) {
    setSpawnTransform((current) => ({
      ...current,
      key: "manual",
      label: "Manual 3D rotation",
      rotateX: rotation.rotateX,
      rotateY: rotation.rotateY,
      rotateZ: rotation.rotateZ,
    }));
    setAlignmentSource("Manual 3D rotation preset");
  }

  const spawnCalibrationJson = JSON.stringify({
    [zoneShortName]: {
      ...zoneMapCalibrations[zoneShortName],
      spawnTransform: {
        source: alignmentSource,
        axisPair: `${spawnTransform.axisA}${spawnTransform.axisB}`.toUpperCase(),
        axisA: spawnTransform.axisA,
        axisB: spawnTransform.axisB,
        selectedTransform: spawnTransform.key,
        flipA: spawnTransform.flipA,
        flipB: spawnTransform.flipB,
        flipX: spawnTransform.axisA === "x" ? spawnTransform.flipA : spawnTransform.axisB === "x" ? spawnTransform.flipB : false,
        flipY: spawnTransform.axisA === "y" ? spawnTransform.flipA : spawnTransform.axisB === "y" ? spawnTransform.flipB : false,
        swapXY: false,
        offsetA: spawnTransform.offsetA,
        offsetB: spawnTransform.offsetB,
        rotateX: spawnTransform.rotateX,
        rotateY: spawnTransform.rotateY,
        rotateZ: spawnTransform.rotateZ,
        scaleA: spawnTransform.scaleA,
        scaleB: spawnTransform.scaleB,
        score: currentAlignmentScore,
      },
    },
  }, null, 2);

  async function copySpawnCalibration() {
    await navigator.clipboard.writeText(spawnCalibrationJson);
    setCopiedSpawnCalibration(true);
    window.setTimeout(() => setCopiedSpawnCalibration(false), 1500);
  }

  if (!mapLayers.length && !nativeSpawns.length) {
    return (
      <details className="zones-expandable-section zones-native-map-section">
        <summary>
          <span>Experimental Map Alignment</span>
          <small>Prototype unavailable</small>
        </summary>
        <div className="zones-expandable-body">
          <p className="empty">Native map geometry and spawn coordinates are not available for this zone yet.</p>
        </div>
      </details>
    );
  }

  return (
    <details className="zones-expandable-section zones-native-map-section" open ref={mapSectionRef}>
      <summary>
        <span>Spawn Map</span>
        <small>{data.mapReadiness ?? "Experimental map"} / {filteredTransformedSpawns.length} visible spawns / {nativeSpawns.length} total</small>
      </summary>
      <div className="zones-expandable-body">
        <p className="zones-map-note">
          Brewall EQ client map geometry with local EQEmu spawn slots overlaid for {data.zoneName}. Zoom, pan, and filter the dots to scout rooms and named paths.
        </p>
        <div className="zones-map-quick-filters" aria-label="Spawn map filters">
          <button className={mapSpecialOnly ? "filter-button is-active" : "filter-button"} onClick={() => setMapSpecialOnly((value) => !value)} type="button">Named / Rare only</button>
          <label className="zone-filter zones-map-level-filter">
            <span>Mob name</span>
            <input onChange={(event) => setMapNameFilter(event.target.value)} placeholder="Silverfang" type="search" value={mapNameFilter} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Race</span>
            <input onChange={(event) => setMapRaceFilter(event.target.value)} placeholder="Piranha" type="search" value={mapRaceFilter} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Min level</span>
            <input min="1" onChange={(event) => setMapMinLevel(event.target.value)} type="number" value={mapMinLevel} />
          </label>
          <label className="zone-filter zones-map-level-filter">
            <span>Max level</span>
            <input min="1" onChange={(event) => setMapMaxLevel(event.target.value)} type="number" value={mapMaxLevel} />
          </label>
        </div>
        <div className="zones-map-toolbar-row">
          <div className="zones-map-legend" aria-label="Spawn dot legend">
            {(["common", "special"] as SpawnMapDotCategory[]).map((category) => (
              <span key={category}><i className={`is-${category}`} />{spawnMapDotCategoryLabel(category)}</span>
            ))}
            <span><i className="is-selected" />Selected</span>
          </div>
        </div>
        <div className="zones-native-map-controls zones-map-scan-controls" aria-label="Spawn map scan controls">
          <button className="filter-button" onClick={resetZoom} type="button">Reset Zoom</button>
          <label className="zones-transform-select">
            <span>Spawn Dot Size</span>
            <input
              max="18"
              min="4"
              onChange={(event) => setDotSize(Number(event.target.value) || defaultSpawnDotSize)}
              step="1"
              type="range"
              value={dotSize}
            />
            <small>{dotSize}</small>
          </label>
          <button
            className={activeZFilter ? "filter-button is-active" : "filter-button"}
            disabled={!mapZBounds}
            onClick={() => setZFilterEnabled((value) => !value)}
            type="button"
          >
            Filter by Z
          </button>
          <label className="zones-transform-select">
            <span>Z Center</span>
            <input
              disabled={!mapZBounds}
              max={mapZBounds?.max ?? 0}
              min={mapZBounds?.min ?? 0}
              onChange={(event) => setZCenter(Number(event.target.value) || 0)}
              step="1"
              type="range"
              value={zCenter}
            />
            <small>{Math.round(zCenter)}</small>
          </label>
          <label className="zones-transform-select">
            <span>Z Range</span>
            <input
              disabled={!mapZBounds}
              max={mapZBounds?.span ?? 1}
              min="1"
              onChange={(event) => setZRange(Math.max(1, Number(event.target.value) || 1))}
              step="1"
              type="range"
              value={Math.max(1, zRange)}
            />
            <small>{Math.round(zRange)}</small>
          </label>
          <span className="zones-map-z-label">
            {activeZFilter && activeZMin !== null && activeZMax !== null
              ? `Showing Z: ${Math.round(activeZMin)} to ${Math.round(activeZMax)}`
              : mapZBounds
                ? `Z available: ${mapZBounds.min} to ${mapZBounds.max}`
                : "No Z data"}
          </span>
          <button className="filter-button" onClick={resetMapControls} type="button">Reset Map Controls</button>
        </div>
        <details className="zones-map-debug">
          <summary>Map Debug</summary>
          <div className="zones-map-debug-body">
        <div className="zones-native-map-controls">
          <label className="zones-transform-select">
            <span>Brewall layer</span>
            <select onChange={(event) => setActiveBrewallLayer(event.target.value as "all" | "main" | "overlay" | "poi")} value={activeBrewallLayer}>
              <option value="main">Main</option>
              <option value="poi">Layer 1</option>
              <option value="overlay">Layer 2</option>
              <option value="all">All Layers</option>
            </select>
          </label>
          <button className={mapMode === "clean" ? "filter-button is-active" : "filter-button"} onClick={setCleanMode} type="button">Clean mode</button>
          <button className={mapMode === "full" ? "filter-button is-active" : "filter-button"} onClick={setFullMode} type="button">Full map mode</button>
          <button className={showMapLines ? "filter-button is-active" : "filter-button"} onClick={() => setShowMapLines((value) => !value)} type="button">Map lines</button>
          <button className={showLabels ? "filter-button is-active" : "filter-button"} onClick={() => setShowLabels((value) => !value)} type="button">Labels</button>
          <button className={showSpawns ? "filter-button is-active" : "filter-button"} onClick={() => setShowSpawns((value) => !value)} type="button">Spawns</button>
          <button className={showDoors ? "filter-button is-active" : "filter-button"} onClick={() => setShowDoors((value) => !value)} type="button">Doors</button>
          <button className={showZonePoints ? "filter-button is-active" : "filter-button"} onClick={() => setShowZonePoints((value) => !value)} type="button">Zone points</button>
          <button className={showGroundSpawns ? "filter-button is-active" : "filter-button"} onClick={() => setShowGroundSpawns((value) => !value)} type="button">Ground spawns</button>
          <button className={showGrid ? "filter-button is-active" : "filter-button"} onClick={() => setShowGrid((value) => !value)} type="button">Path grids</button>
          <button className={showCollision ? "filter-button is-active" : "filter-button"} onClick={() => setShowCollision((value) => !value)} type="button">Collision debug</button>
        </div>
        <div className="zones-native-map-controls">
          <button className="filter-button" onClick={() => fitBounds(allBounds)} type="button">Fit All</button>
          <button className="filter-button" onClick={() => fitBounds(mapLineBounds)} type="button">Fit Geometry</button>
          <button className="filter-button" onClick={() => fitBounds(transformedSpawnBounds, 0.12)} type="button">Fit Spawns</button>
          <button className="filter-button" onClick={resetZoom} type="button">Reset Zoom</button>
          <button className="filter-button" onClick={applyExperimentalFitToMapBounds} type="button">Experimental fit spawns to map</button>
          <button
            className={spawnTransform.key === friendCazicFlipTransform.key ? "filter-button is-active" : "filter-button"}
            onClick={() => applySpawnTransformPreset(friendCazicFlipTransform.key)}
            type="button"
          >
            Friend fix: -X / -Y
          </button>
          <button className="filter-button" disabled type="button">Auto-align paused</button>
          <button className="filter-button" onClick={copySpawnCalibration} type="button">{copiedSpawnCalibration ? "Copied" : "Use this transform / Copy JSON"}</button>
          <button className={renderMode === "dots" ? "filter-button is-active" : "filter-button"} onClick={() => setRenderMode("dots")} type="button">Dots</button>
          <button className={renderMode === "density" ? "filter-button is-active" : "filter-button"} onClick={() => setRenderMode("density")} type="button">Density</button>
        </div>
        <div className="zones-native-map-controls zones-native-transform-controls" aria-label="Manual transform presets">
          {spawnAxisPairs.map((pair) => {
            const preset = makeSpawnTransform(pair.axisA, pair.axisB, spawnTransformPatterns[0]);
            return (
            <button
              className={spawnTransform.axisA === pair.axisA && spawnTransform.axisB === pair.axisB ? "filter-button is-active" : "filter-button"}
              key={preset.key}
              onClick={() => setSpawnAxes(pair.key)}
              type="button"
            >
              {pair.label}
            </button>
            );
          })}
          {spawnTransformPatterns.map((pattern) => (
            <button
              className={spawnTransform.flipA === pattern.flipA && spawnTransform.flipB === pattern.flipB ? "filter-button is-active" : "filter-button"}
              key={`flip-${pattern.key}`}
              onClick={() => {
                setSpawnTransform((current) => ({
                  ...current,
                  flipA: pattern.flipA,
                  flipB: pattern.flipB,
                  key: "manual",
                  label: "Manual override",
                }));
                setAlignmentSource("Manual flip preset");
              }}
              type="button"
            >
              {pattern.label}
            </button>
          ))}
        </div>
        <div className="zones-native-map-controls zones-native-transform-controls">
          <label className="zones-transform-select">
            <span>Spawn axes</span>
            <select onChange={(event) => setSpawnAxes(event.target.value)} value={`${spawnTransform.axisA}${spawnTransform.axisB}`}>
              {spawnAxisPairs.map((pair) => <option key={pair.key} value={pair.key}>{pair.label}</option>)}
            </select>
          </label>
          <button className={spawnTransform.flipA ? "filter-button is-active" : "filter-button"} onClick={() => toggleSpawnTransform("flipA")} type="button">Flip A</button>
          <button className={spawnTransform.flipB ? "filter-button is-active" : "filter-button"} onClick={() => toggleSpawnTransform("flipB")} type="button">Flip B</button>
          <label className="zones-transform-select">
            <span>Rotate X</span>
            <input onChange={(event) => updateSpawnTransformNumber("rotateX", event.target.value)} step="5" type="number" value={spawnTransform.rotateX} />
          </label>
          <label className="zones-transform-select">
            <span>Rotate Y</span>
            <input onChange={(event) => updateSpawnTransformNumber("rotateY", event.target.value)} step="5" type="number" value={spawnTransform.rotateY} />
          </label>
          <label className="zones-transform-select">
            <span>Rotate Z</span>
            <input onChange={(event) => updateSpawnTransformNumber("rotateZ", event.target.value)} step="5" type="number" value={spawnTransform.rotateZ} />
          </label>
          <label className="zones-transform-select">
            <span>Spawn scale A</span>
            <input onChange={(event) => updateSpawnTransformNumber("scaleA", event.target.value)} step="0.05" type="number" value={spawnTransform.scaleA} />
          </label>
          <label className="zones-transform-select">
            <span>Spawn scale B</span>
            <input onChange={(event) => updateSpawnTransformNumber("scaleB", event.target.value)} step="0.05" type="number" value={spawnTransform.scaleB} />
          </label>
          <label className="zones-transform-select">
            <span>Spawn offset A</span>
            <input onChange={(event) => updateSpawnTransformNumber("offsetA", event.target.value)} step="10" type="number" value={spawnTransform.offsetA} />
          </label>
          <label className="zones-transform-select">
            <span>Spawn offset B</span>
            <input onChange={(event) => updateSpawnTransformNumber("offsetB", event.target.value)} step="10" type="number" value={spawnTransform.offsetB} />
          </label>
        </div>
        <div className="zones-native-map-controls zones-native-transform-controls" aria-label="3D rotation presets">
          {spawnRotationPresets.map((rotation) => (
            <button
              className={spawnTransform.rotateX === rotation.rotateX && spawnTransform.rotateY === rotation.rotateY && spawnTransform.rotateZ === rotation.rotateZ ? "filter-button is-active" : "filter-button"}
              key={rotation.key}
              onClick={() => applyRotationPreset(rotation)}
              type="button"
            >
              {rotation.label || "No 3D rotation"}
            </button>
          ))}
        </div>
        <div className="zones-native-map-controls zones-native-transform-controls">
          <label className="zones-transform-select">
            <span>Spawn Dot Size</span>
            <input max="18" min="4" onChange={(event) => setDotSize(Number(event.target.value) || defaultSpawnDotSize)} step="1" type="range" value={dotSize} />
          </label>
          <label className="zones-transform-select">
            <span>Dot opacity</span>
            <input max="1" min="0.25" onChange={(event) => setDotOpacity(Number(event.target.value))} step="0.05" type="range" value={dotOpacity} />
          </label>
          <button className={showDotOutline ? "filter-button is-active" : "filter-button"} onClick={() => setShowDotOutline((value) => !value)} type="button">Dot outline</button>
        </div>
        <div className="zones-native-map-stats">
          <span>Map X {mapLineBounds.minX.toFixed(0)} to {mapLineBounds.maxX.toFixed(0)}</span>
          <span>Map Y {mapLineBounds.minY.toFixed(0)} to {mapLineBounds.maxY.toFixed(0)}</span>
          <span>Spawn X {spawnBounds.minX.toFixed(0)} to {spawnBounds.maxX.toFixed(0)}</span>
          <span>Spawn Y {spawnBounds.minY.toFixed(0)} to {spawnBounds.maxY.toFixed(0)}</span>
          <span>Spawn axes {spawnTransform.axisA.toUpperCase()}/{spawnTransform.axisB.toUpperCase()}</span>
          <span>3D rotation X {spawnTransform.rotateX} / Y {spawnTransform.rotateY} / Z {spawnTransform.rotateZ}</span>
          <span>Transform {spawnTransform.label}</span>
          <span>Calibration {alignmentSource}</span>
          <span>In-bounds spawns {currentAlignmentScore.inBoundsCount}</span>
          <span>Out-of-bounds spawns {outOfBoundsSpawns}</span>
          <span>Median line distance {Number.isFinite(currentAlignmentScore.medianDistance) ? currentAlignmentScore.medianDistance.toFixed(1) : "n/a"}</span>
          <span>Spawn bounds X {transformedSpawnBounds.minX.toFixed(0)} to {transformedSpawnBounds.maxX.toFixed(0)}</span>
          <span>Spawn bounds Y {transformedSpawnBounds.minY.toFixed(0)} to {transformedSpawnBounds.maxY.toFixed(0)}</span>
          <span>Zoom {zoomLevel}x</span>
          <span>Grid lines {gridLines.length}</span>
          <span>Doors {doors.length}</span>
          <span>Zone points {zonePoints.length}</span>
        </div>
        {selectedCandidateDebugRows.length ? (
          <div className="zones-map-debug-candidates">
            <strong>Selected spawn candidate scoring</strong>
            <div className="zones-map-debug-candidate-grid">
              {selectedCandidateDebugRows.map((row) => (
                <div className={row.selected ? "zones-map-debug-candidate is-selected" : "zones-map-debug-candidate"} key={`${row.candidate.npcTypeId}-${row.candidate.displayName}`}>
                  <span>{row.candidate.displayName}</span>
                  <small>{row.candidate.chance ?? "?"}% chance</small>
                  <small>{row.spawnPointCount ?? "?"} spawn points</small>
                  <small>{row.dropStats.dropCount} drops / {row.dropStats.meaningfulDropCount} meaningful / {row.dropStats.commonLootCount} common</small>
                  <small>loot uniqueness {(row.dropStats.lootUniquenessScore * 100).toFixed(0)}% / unique loot {row.dropStats.uniqueNamedLootCount}</small>
                  <small>footprint penalty {row.footprintPenalty}</small>
                  <small>{row.isManualOverride ? "override" : row.isPopulation ? "population mob" : row.isNamed ? "named score" : row.isLowChance ? "low chance" : "common"}</small>
                  <small>{row.selected ? `selected: ${selectedRepresentative?.reasonLabel ?? "chosen"}` : "not selected"}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
          </div>
        </details>
        <div className="zones-native-map-layout">
        <svg
          className={dragStart ? "zones-native-map is-panning" : "zones-native-map"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={svgRef}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={svgViewBox}
          aria-label={`${data.zoneName} Brewall map with EQEmu spawn overlay`}
        >
          <g>
            <rect
              className="zones-native-map-bounds-rect"
              height={Math.max(1, mapLineBounds.maxY - mapLineBounds.minY)}
              width={Math.max(1, mapLineBounds.maxX - mapLineBounds.minX)}
              x={mapLineBounds.minX}
              y={mapLineBounds.minY}
            />
            <rect
              className="zones-native-spawn-bounds-rect"
              height={Math.max(1, transformedSpawnBounds.maxY - transformedSpawnBounds.minY)}
              width={Math.max(1, transformedSpawnBounds.maxX - transformedSpawnBounds.minX)}
              x={transformedSpawnBounds.minX}
              y={transformedSpawnBounds.minY}
            />
            {showMapLines ? visibleMapLayers.flatMap((layer) => layer.lines.map((line, index) => (
              <line
                className="zones-brewall-map-line"
                key={`${layer.key}-line-${index}`}
                stroke={line.color}
                style={{ opacity: line.heightOpacity }}
                x1={line.x1}
                x2={line.x2}
                y1={line.y1}
                y2={line.y2}
              />
            ))) : null}
            {showLabels ? visibleMapLayers.flatMap((layer) => layer.labels.map((label, index) => (
              <text
                className="zones-brewall-map-label"
                fill={label.color}
                fontSize={Math.max(18, (label.size ?? 2) * 8)}
                key={`${layer.key}-label-${index}`}
                style={{ opacity: label.heightOpacity }}
                x={label.x}
                y={label.y}
              >
                {label.label}
              </text>
            ))) : null}
            {showCollision ? visibleCollisionLines.map((line, index) => (
              <line className="zones-native-collision-line" key={`collision-${index}`} style={{ opacity: line.heightOpacity }} x1={line.x1 ?? 0} x2={line.x2 ?? 0} y1={line.y1 ?? 0} y2={line.y2 ?? 0} />
            )) : null}
            {showGrid ? visibleGridLines.map((line, index) => (
              <line className="zones-native-grid-line" key={`grid-${line.gridid ?? "unknown"}-${index}`} style={{ opacity: line.heightOpacity }} x1={line.x1 ?? 0} x2={line.x2 ?? 0} y1={line.y1 ?? 0} y2={line.y2 ?? 0} />
            )) : null}
            {showDoors ? doors.filter(validPoint).map((point, index) => (
              <circle className="zones-native-door-point" cx={point.x ?? 0} cy={point.y ?? 0} key={`door-${point.id ?? index}-${point.x ?? "x"}-${point.y ?? "y"}`} r="8">
                <title>{point.name ?? "Door"} {point.x}, {point.y}, {point.z}</title>
              </circle>
            )) : null}
            {showZonePoints ? zonePoints.filter(validPoint).map((point, index) => (
              <circle className="zones-native-zone-point" cx={point.x ?? 0} cy={point.y ?? 0} key={`zone-point-${point.id ?? index}-${point.x ?? "x"}-${point.y ?? "y"}`} r="10">
                <title>Zone point {point.id} {point.x}, {point.y}, {point.z}</title>
              </circle>
            )) : null}
            {showGroundSpawns ? groundSpawns.filter(validPoint).map((point, index) => (
              <circle className="zones-native-ground-point" cx={point.x ?? 0} cy={point.y ?? 0} key={`ground-${point.id ?? index}-${point.x ?? "x"}-${point.y ?? "y"}`} r="9">
                <title>{point.name ?? "Ground spawn"} {point.x}, {point.y}, {point.z}</title>
              </circle>
            )) : null}
            {showSpawns ? renderTransformedSpawns.map((point, index) => {
              const isSelected = point.id === selectedSpawnId;
              const isHovered = point.id === hoveredSpawnId;
              const category = spawnMapDotCategory(point);
              const renderState = spawnRenderState.get(point.id ?? `${point.x}-${point.y}-${point.z}`);
              const isInteractiveFocus = isSelected || isHovered;
              const isFilteredFocus = mapFocusActive && (hasActiveMapFilter || Boolean(renderState?.isFocusRelated));
              const combinedOpacity = renderState?.combinedOpacity ?? dotOpacity;
              const spawnRadius = renderMode === "density"
                ? mapUnitDotSize * 2.2
                : isSelected
                  ? mapUnitDotSize * 1.85
                  : isHovered
                    ? mapUnitDotSize * 1.65
                      : isFilteredFocus
                        ? mapUnitDotSize * 1.28
                      : category === "special"
                        ? mapUnitDotSize * 1.32
                        : mapUnitDotSize;
              const dotClassName = [
                "zones-native-spawn-point",
                `is-${category}`,
                renderMode === "density" ? "is-density" : "",
                isSelected ? "is-selected" : "",
                isHovered ? "is-hovered" : "",
                hasActiveMapFilter ? "is-filter-match" : "",
                mapFocusActive && renderState?.isFocusRelated ? "is-focus-related" : "",
                renderState?.isDimmed ? "is-dimmed" : "",
                renderState?.isOtherFloor ? "is-other-floor" : "",
                showDotOutline ? "has-outline" : "",
              ].filter(Boolean).join(" ");
              return (
                <g
                  className="zones-native-spawn-target"
                  key={`spawn-${point.id ?? index}-${point.x ?? "x"}-${point.y ?? "y"}-${point.z ?? "z"}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectSpawn(point.id ?? null);
                  }}
                  onMouseEnter={() => scheduleHoveredSpawn(point.id ?? null)}
                  onMouseLeave={() => scheduleHoveredSpawn(null)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <title>{spawnMapTooltip(point, category)}</title>
                  <circle
                    className="zones-native-spawn-hit-target"
                    cx={point.transformed.x}
                    cy={point.transformed.y}
                r={Math.max(mapUnitDotSize * 3, 18)}
                  />
                  <circle
                    className={dotClassName}
                    cx={point.transformed.x}
                    cy={point.transformed.y}
                    r={spawnRadius}
                    style={{ opacity: combinedOpacity }}
                  />
                </g>
              );
            }) : null}
          </g>
        </svg>
        <aside className="zones-spawn-selection-panel" aria-label="Selected spawn details">
          {selectedSpawn ? (
            <>
              <div>
                <span>Selected Spawn</span>
                <strong>{selectedRepresentative?.displayName ?? selectedSpawn.primary?.displayName ?? selectedSpawn.name ?? `Spawn ${selectedSpawn.id}`}</strong>
              </div>
              <dl>
                <div><dt>Level</dt><dd>{selectedRepresentative?.level ?? selectedSpawn.primary?.level ?? "Unknown"}</dd></div>
                <div><dt>Race</dt><dd>{selectedRepresentative?.race ?? selectedSpawn.primary?.race ?? "Unknown"}</dd></div>
                <div><dt>Class</dt><dd>{selectedRepresentative?.className ?? selectedSpawn.primary?.className ?? "Unknown"}</dd></div>
                <div><dt>Chance</dt><dd>{selectedRepresentative?.chance ?? selectedSpawn.primary?.chance ?? "Unknown"}%</dd></div>
                <div><dt>Respawn</dt><dd>{selectedSpawn.primary?.respawnTime ?? "Unknown"}</dd></div>
                <div><dt>Tag</dt><dd>{selectedSpawnCategory ? <span className={`zones-spawn-selection-tag is-${selectedSpawnCategory}`}>{spawnMapDotCategoryLabel(selectedSpawnCategory)}</span> : "Unknown"}</dd></div>
                <div><dt>Drops</dt><dd>{selectedRepresentativeDropCount}</dd></div>
                {selectedRepresentative && selectedRepresentative.meaningfulDropCount > 0 ? (
                  <div><dt>Loot signal</dt><dd>{selectedRepresentative.meaningfulDropCount} notable drop{selectedRepresentative.meaningfulDropCount === 1 ? "" : "s"}</dd></div>
                ) : null}
                <div><dt>Spawn points</dt><dd>{selectedRepresentativeSpawnPointCount || "Unknown"}</dd></div>
                {selectedRepresentative?.spawnPointCount ? (
                  <div><dt>Zone footprint</dt><dd>{selectedRepresentative.spawnPointCount} spawn points</dd></div>
                ) : null}
                <div><dt>Coords</dt><dd>X {formatCoordinate(selectedSpawn.x ?? null)} / Y {formatCoordinate(selectedSpawn.y ?? null)} / Z {formatCoordinate(selectedSpawn.z ?? null)}</dd></div>
                {(selectedSpawn.primary?.candidateCount ?? 0) > 1 ? (
                  <div><dt>Candidates</dt><dd>{selectedSpawn.primary?.candidateCount}</dd></div>
                ) : null}
              </dl>
              {(() => {
                const otherCandidates = (selectedSpawn.primary?.candidates ?? [])
                  .filter((candidate) => candidate.npcTypeId !== selectedRepresentative?.npcTypeId)
                  .slice(0, 6);
                if (otherCandidates.length === 0) return null;
                return (
                  <div className="zones-spawn-selection-candidates">
                    <strong>Other candidates</strong>
                    <span>{otherCandidates.map((candidate) => `${candidate.displayName} (${candidate.chance ?? "?"}%)`).join(", ")}</span>
                  </div>
                );
              })()}
              <button className="filter-button" onClick={viewSpawnDetailsBelow} type="button">View details below</button>
              <button className="filter-button" onClick={() => selectSpawn(null)} type="button">Clear selection</button>
            </>
          ) : (
            <p>Click a spawn dot to inspect its primary mob, chance, respawn, and coordinates.</p>
          )}
        </aside>
        </div>
      </div>
    </details>
  );
}

function countSummary(counts: Record<string, number>, limit = 3) {
  return sortedCountEntries(counts).slice(0, limit).map(([label]) => label).join(", ") || "Unknown";
}

function countBreakdown(counts: Record<string, number>) {
  return sortedCountEntries(counts);
}

function rowMatchesQuery(row: ZoneMobDetailRow, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  return [
    row.displayName,
    row.rawName,
    row.level === null ? "unknown" : String(row.level),
    row.race,
    row.rawRace ?? "",
  ].join(" ").toLowerCase().includes(normalizedQuery);
}

function groupMatchesQuery(group: ZoneMobGroup, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  return [
    group.displayName,
    ...group.rawNames,
    ...Object.keys(group.raceCounts),
    ...Object.keys(group.rawRaceCounts ?? {}),
    ...group.levels.map(String),
  ].join(" ").toLowerCase().includes(normalizedQuery);
}

function MobTable({ rows }: { rows: ZoneMobDetailRow[] }) {
  const [visibleCount, setVisibleCount] = useState(samplePageSize);
  const visibleRows = rows.slice(0, visibleCount);

  return (
    <div className="zones-compose-view">
      <div className="zones-mob-sample-meta">
        Showing {visibleRows.length} of {rows.length} matching rows
      </div>
      <div className="zones-mob-sample-table" role="table" aria-label="Imported mob sample rows">
        <div className="zones-mob-sample-row is-header" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Level</span>
          <span role="columnheader">Race</span>
          <span role="columnheader">Class</span>
        </div>
        {visibleRows.map((row, index) => (
          <div className="zones-mob-sample-row" role="row" key={`${row.rawName}-${row.level ?? "unknown"}-${index}`}>
            <strong role="cell">{row.displayName}</strong>
            <span role="cell">{row.level ?? "Unknown"}</span>
            <span role="cell">{row.race}</span>
            <span role="cell">{row.className}</span>
          </div>
        ))}
      </div>
      {visibleRows.length < rows.length ? (
        <button
          className="zones-show-more-button"
          onClick={() => setVisibleCount((current) => current + samplePageSize)}
          type="button"
        >
          Show 50 more
        </button>
      ) : null}
    </div>
  );
}

function formatLevelRange(group: ZoneMobGroup) {
  if (group.levelMin === null || group.levelMax === null) return "level unknown";
  if (group.levelMin === group.levelMax) return `level ${group.levelMin}`;
  return `levels ${group.levelMin}-${group.levelMax}`;
}

function MobFamilyCards({ groups }: { groups: ZoneMobGroup[] }) {
  return (
    <div className="zones-family-grid">
      {groups.map((group, index) => (
        <article className="zones-family-card" key={`${group.displayName}-${group.levelMin ?? "unknown"}-${index}`}>
          <div className="zones-family-card-heading">
            <strong>{group.displayName}</strong>
            <span>{group.count} mobs</span>
          </div>
          <div className="zones-family-card-meta">
            <span>{formatLevelRange(group)}</span>
            <span>Race: {countSummary(group.raceCounts, 2)}</span>
            <span>Classes: {countSummary(group.classCounts)}</span>
          </div>
          <details className="zones-family-more">
            <summary>Details</summary>
            <div>
              <span>Exact levels: {group.levels.length ? group.levels.join(", ") : "Unknown"}</span>
              <span>Class breakdown: {countBreakdown(group.classCounts).map(([label, count]) => `${label} ${count}`).join(" / ")}</span>
              <span>Race breakdown: {countBreakdown(group.raceCounts).map(([label, count]) => `${label} ${count}`).join(" / ")}</span>
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}

function buildLevelGroups(rows: ZoneMobDetailRow[]) {
  const levels = new Map<number | "Unknown", Map<string, { count: number; rows: ZoneMobDetailRow[] }>>();
  for (const row of rows) {
    const level = row.level ?? "Unknown";
    const byName = levels.get(level) ?? new Map();
    const entry = byName.get(row.displayName) ?? { count: 0, rows: [] };
    entry.count += 1;
    entry.rows.push(row);
    byName.set(row.displayName, entry);
    levels.set(level, byName);
  }
  return Array.from(levels.entries())
    .sort(([levelA], [levelB]) => {
      if (levelA === "Unknown") return 1;
      if (levelB === "Unknown") return -1;
      return levelA - levelB;
    })
    .map(([level, byName]) => ({
      level,
      mobs: Array.from(byName.entries())
        .map(([displayName, entry]) => ({ displayName, ...entry }))
        .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName)),
    }));
}

function LevelMobGroups({ rows }: { rows: ZoneMobDetailRow[] }) {
  const levelGroups = useMemo(() => buildLevelGroups(rows), [rows]);
  return (
    <div className="zones-level-family-list">
      {levelGroups.map((levelGroup) => (
        <section className="zones-level-family-card" key={levelGroup.level}>
          <h3>Level {levelGroup.level}</h3>
          <ul>
            {levelGroup.mobs.map((mob) => {
              const classSummary = countSummary(
                mob.rows.reduce<Record<string, number>>((counts, row) => {
                  counts[row.race] = (counts[row.race] ?? 0) + 1;
                  return counts;
                }, {}),
                2,
              );
              return (
                <li key={mob.displayName}>
                  <strong>{mob.count} {mob.displayName}</strong>
                  <span>{classSummary}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MobComposition({ groups, rows }: { groups: ZoneMobGroup[]; rows: ZoneMobDetailRow[] }) {
  const [activeView, setActiveView] = useState<MobCompositionView>("levels");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(
    () => groups.filter((group) => groupMatchesQuery(group, normalizedQuery)),
    [groups, normalizedQuery],
  );
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesQuery(row, normalizedQuery)),
    [rows, normalizedQuery],
  );

  return (
    <details className="zones-expandable-section zones-composition-section" open>
      <summary>
        <span>Mob Composition</span>
        <small>{filteredGroups.length} families</small>
      </summary>
      <div className="zones-expandable-body">
        <div className="zones-composition-toolbar">
          <label className="zone-filter zones-mob-sample-search">
            <span>Search mobs</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, race, level"
              type="search"
              value={query}
            />
          </label>
          <div className="zones-composition-tabs" role="tablist" aria-label="Mob composition views">
            {([
              ["families", "Families"],
              ["levels", "Levels"],
              ["table", "Table"],
            ] as const).map(([view, label]) => (
              <button
                aria-pressed={activeView === view}
                className={activeView === view ? "filter-button is-active" : "filter-button"}
                key={view}
                onClick={() => setActiveView(view)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {activeView === "families" ? <MobFamilyCards groups={filteredGroups} /> : null}
        {activeView === "levels" ? <LevelMobGroups rows={filteredRows} /> : null}
        {activeView === "table" ? <MobTable key={normalizedQuery} rows={filteredRows} /> : null}
      </div>
    </details>
  );
}

function realSpawnDataToNativeMapData(spawnData: EqemuSpawnTestData | null | undefined, zoneName: string): NativeMapDebugData | null {
  if (!spawnData?.zoneShortName || !Array.isArray(spawnData.primarySpawnRows) || !spawnData.primarySpawnRows.length) return null;
  const mapAssetManifest = zoneMapAssets[spawnData.zoneShortName];
  if (!mapAssetManifest?.assetUrl) return null;
  return {
    zoneShortName: spawnData.zoneShortName,
    zoneName: spawnData.zoneName ?? zoneName,
    sourceKind: "Brewall EQ map text + local EQEmu spawn slots",
    coordinateNote: "Map geometry loads from a per-zone static asset. Spawn dots are derived from EQEmu spawn2 coordinates.",
    mapReadiness: "Experimental map",
    bounds: mapAssetManifest.bounds ?? { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    collisionLines: [],
    gridLines: [],
    spawns: spawnData.primarySpawnRows.map((spawn) => ({
      id: spawn.spawn2Id,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      name: spawn.primaryNpcName,
      displayName: spawn.displayName,
      level: spawn.level,
      race: spawn.race,
    })),
    doors: [],
    zonePoints: [],
    objects: [],
    groundSpawns: [],
    traps: [],
  };
}

export function ZoneDetailExplorer({
  initialDataSourceMode = "snapshot",
  hasSnapshotData = true,
  mobGroups,
  realSpawnData,
  realSpawnRouteSlug,
  rows,
  snapshotRouteSlug,
  spawnMapPrototype,
  summary,
}: {
  hasSnapshotData?: boolean;
  initialDataSourceMode?: ZoneDataSourceMode;
  mobGroups: ZoneMobGroup[];
  realSpawnData?: EqemuSpawnTestData | null;
  realSpawnRouteSlug?: string | null;
  rows: ZoneMobDetailRow[];
  snapshotRouteSlug?: string | null;
  spawnMapPrototype?: SpawnMapPrototypeData;
  summary: ZoneMobSummary;
}) {
  const router = useRouter();
  const [dataSourceMode, setDataSourceMode] = useState<ZoneDataSourceMode>(initialDataSourceMode);
  const [realSpawnFocus, setRealSpawnFocus] = useState<RealSpawnFocus | null>(null);
  const [loadedRealSpawnLoot, setLoadedRealSpawnLoot] = useState<EqemuLootTestData | null>(null);
  const [realSpawnLootLoading, setRealSpawnLootLoading] = useState(false);
  const sanitizedRealSpawnData = useMemo(() => sanitizeEqemuSpawnData(realSpawnData), [realSpawnData]);
  const sanitizedRealSpawnLoot = useMemo(() => sanitizeEqemuLootData(loadedRealSpawnLoot), [loadedRealSpawnLoot]);
  const canonicalRouteSlug = useMemo(() => canonicalZoneRouteSlug(summary), [summary]);
  const snapshotTargetRouteSlug = snapshotRouteSlug ?? canonicalRouteSlug;
  const realSpawnTargetRouteSlug = realSpawnRouteSlug ?? canonicalRouteSlug;
  const hasRealSpawnData = Boolean(sanitizedRealSpawnData && Array.isArray(sanitizedRealSpawnData.primarySpawnRows) && sanitizedRealSpawnData.primarySpawnRows.length > 0);
  const showRealSpawnSystems = dataSourceMode === "spawns" && hasRealSpawnData;
  const showRealSpawnUnavailable = dataSourceMode === "spawns" && !hasRealSpawnData;
  const showSnapshotUnavailable = dataSourceMode === "snapshot" && !hasSnapshotData;
  const realSpawnShortName = sanitizedRealSpawnData?.zoneShortName ?? "";
  const realSpawnLootAssetUrl = realSpawnShortName ? realSpawnLootAssets[realSpawnShortName]?.assetUrl : undefined;
  const realSpawnNativeMap = useMemo(
    () => realSpawnDataToNativeMapData(sanitizedRealSpawnData, summary.zoneName),
    [sanitizedRealSpawnData, summary.zoneName],
  );
  const showSpawnMapPrototype = showRealSpawnSystems && Boolean(realSpawnNativeMap);

  useEffect(() => {
    let cancelled = false;
    if (!showRealSpawnSystems || !realSpawnLootAssetUrl) {
      setLoadedRealSpawnLoot(null);
      setRealSpawnLootLoading(false);
      return undefined;
    }
    setRealSpawnLootLoading(true);
    fetch(realSpawnLootAssetUrl)
      .then((response) => (response.ok ? response.json() as Promise<EqemuLootTestData> : null))
      .then((payload) => {
        if (!cancelled) setLoadedRealSpawnLoot(payload);
      })
      .catch(() => {
        if (!cancelled) setLoadedRealSpawnLoot(null);
      })
      .finally(() => {
        if (!cancelled) setRealSpawnLootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [realSpawnLootAssetUrl, showRealSpawnSystems]);

  useEffect(() => {
    setDataSourceMode(initialDataSourceMode);
    if (initialDataSourceMode !== "spawns") setRealSpawnFocus(null);
    try {
      window.localStorage.setItem("frostreaver-zone-data-source", initialDataSourceMode);
    } catch {
      // Ignore persistence failures.
    }
  }, [initialDataSourceMode]);

  function updateDataSourceMode(mode: ZoneDataSourceMode) {
    setDataSourceMode(mode);
    if (mode !== "spawns") setRealSpawnFocus(null);
    try {
      window.localStorage.setItem("frostreaver-zone-data-source", mode);
    } catch {
      // Ignore persistence failures.
    }
    router.push(mode === "spawns" ? `/zones/${realSpawnTargetRouteSlug}?source=spawns` : `/zones/${snapshotTargetRouteSlug}`);
  }

  return (
    <section className="zones-drilldown" aria-label="Zone detail drill-down">
      <div className="zones-data-source-switch" aria-label="Zone detail data source">
        <div>
          <strong>Data Source</strong>
          <span>{dataSourceMode === "spawns" ? "Spawn-slot data from EQEmu/PEQ database" : "Approximate zone snapshot data"}</span>
        </div>
        <div className="zones-data-source-buttons">
          <button className={dataSourceMode === "snapshot" ? "filter-button is-active" : "filter-button"} onClick={() => updateDataSourceMode("snapshot")} type="button">Zone Snapshot</button>
          <button className={dataSourceMode === "spawns" ? "filter-button is-active" : "filter-button"} onClick={() => updateDataSourceMode("spawns")} type="button">Real Spawn Data</button>
        </div>
      </div>
      <p className="zones-snapshot-warning">
        {dataSourceMode === "spawns"
          ? "Spawn data is sourced from EQEmu/PEQ emulator databases and may not exactly match every TLP, P99, or live-era server."
          : "This is an imported zone snapshot, not a complete or exact spawn encyclopedia."}
      </p>
      {showSpawnMapPrototype && realSpawnNativeMap ? (
        <NativeCoordinateMapDebug
          data={realSpawnNativeMap}
          lootData={sanitizedRealSpawnLoot}
          onClearFocus={() => setRealSpawnFocus(null)}
          onSelectFocus={setRealSpawnFocus}
          selectedFocus={realSpawnFocus}
          spawnData={sanitizedRealSpawnData}
        />
      ) : showRealSpawnSystems ? <SpawnMapPausedNotice /> : null}
      {showRealSpawnUnavailable ? (
        <div className="zones-empty-state">
          <strong>Real Spawn Data is not available for this zone yet.</strong>
          <span>Zone Snapshot data is still shown below so the page stays usable.</span>
        </div>
      ) : null}
      {showSnapshotUnavailable ? (
        <div className="zones-empty-state">
          <strong>Zone Snapshot data is not available for this zone yet.</strong>
          <span>Real Spawn Data may still be available from the data source switch.</span>
        </div>
      ) : null}
      {showRealSpawnSystems ? (
        <RealSpawnDataIntel
          lootMobs={sanitizedRealSpawnLoot?.mobs ?? []}
          lootPending={realSpawnLootLoading}
          onClearFocus={() => setRealSpawnFocus(null)}
          onSelectFocus={setRealSpawnFocus}
          selectedFocus={realSpawnFocus}
          spawnData={sanitizedRealSpawnData ?? null}
          zoneName={summary.zoneName}
        />
      ) : hasSnapshotData ? <CountSummary title="Mob Races" counts={summary.normalizedRaceCounts ?? summary.raceCounts} /> : null}
      {hasSnapshotData ? (
        <>
          <LevelBreakdown summary={summary} />
          <MobComposition groups={mobGroups} rows={rows} />
          <SourceNotes summary={summary} />
        </>
      ) : null}
    </section>
  );
}
