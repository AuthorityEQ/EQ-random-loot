import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("data/zone-map-assets.json");
const calibrationPath = resolve("data/zone-map-calibrations.json");
const reportPath = resolve("data/real-spawn-map-transform-audit-report.json");

const globalDefaultTransform = {
  axisA: "x",
  axisB: "y",
  flipA: true,
  flipB: true,
  key: "xy-flip-both-global",
  label: "Global Brewall spawn convention: -X / -Y",
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
};

const transformCandidates = [
  { axisA: "x", axisB: "y", flipA: false, flipB: false, key: "xy-normal", label: "X/Y normal", rotateX: 0, rotateY: 0, rotateZ: 0 },
  { axisA: "x", axisB: "y", flipA: true, flipB: false, key: "xy-flip-x", label: "X/Y flip X", rotateX: 0, rotateY: 0, rotateZ: 0 },
  { axisA: "x", axisB: "y", flipA: false, flipB: true, key: "xy-flip-y", label: "X/Y flip Y", rotateX: 0, rotateY: 0, rotateZ: 0 },
  globalDefaultTransform,
  { axisA: "y", axisB: "x", flipA: false, flipB: false, key: "yx-normal", label: "Y/X normal", rotateX: 0, rotateY: 0, rotateZ: 0 },
  { axisA: "y", axisB: "x", flipA: true, flipB: false, key: "yx-flip-a", label: "Y/X flip A", rotateX: 0, rotateY: 0, rotateZ: 0 },
  { axisA: "y", axisB: "x", flipA: false, flipB: true, key: "yx-flip-b", label: "Y/X flip B", rotateX: 0, rotateY: 0, rotateZ: 0 },
  { axisA: "y", axisB: "x", flipA: true, flipB: true, key: "yx-flip-both", label: "Y/X flip both", rotateX: 0, rotateY: 0, rotateZ: 0 },
  { axisA: "x", axisB: "y", flipA: false, flipB: false, key: "xy-r180", label: "X/Y rotate 180", rotateX: 0, rotateY: 0, rotateZ: 180 },
  { axisA: "y", axisB: "x", flipA: false, flipB: true, key: "cazic-equivalent-yx-flip-b-rz270", label: "Cazic stored transform equivalent", rotateX: 0, rotateY: 0, rotateZ: 270 },
];

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function rotate(point, transform) {
  let x = point.x ?? 0;
  let y = point.y ?? 0;
  let z = point.z ?? 0;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  if (transform.rotateX) {
    const r = radians(transform.rotateX);
    const nextY = y * Math.cos(r) - z * Math.sin(r);
    const nextZ = y * Math.sin(r) + z * Math.cos(r);
    y = nextY;
    z = nextZ;
  }
  if (transform.rotateY) {
    const r = radians(transform.rotateY);
    const nextX = x * Math.cos(r) + z * Math.sin(r);
    const nextZ = -x * Math.sin(r) + z * Math.cos(r);
    x = nextX;
    z = nextZ;
  }
  if (transform.rotateZ) {
    const r = radians(transform.rotateZ);
    const nextX = x * Math.cos(r) - y * Math.sin(r);
    const nextY = x * Math.sin(r) + y * Math.cos(r);
    x = nextX;
    y = nextY;
  }
  return { x, y, z };
}

function axisValue(point, axis) {
  return typeof point[axis] === "number" && Number.isFinite(point[axis]) ? point[axis] : 0;
}

function applyTransform(point, transform) {
  const rotated = rotate(point, transform);
  let a = axisValue(rotated, transform.axisA);
  let b = axisValue(rotated, transform.axisB);
  if (transform.flipA) a *= -1;
  if (transform.flipB) b *= -1;
  return { x: a, y: b };
}

function boundsForLines(lines) {
  const xs = [];
  const ys = [];
  for (const line of lines) {
    xs.push(line.x1, line.x2);
    ys.push(line.y1, line.y2);
  }
  if (!xs.length || !ys.length) return null;
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function boundsForPoints(points) {
  const xs = points.map((point) => point.x).filter(Number.isFinite);
  const ys = points.map((point) => point.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function inside(point, bounds) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function distanceToSegment(point, line) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - line.x1, point.y - line.y1);
  const t = Math.max(0, Math.min(1, ((point.x - line.x1) * dx + (point.y - line.y1) * dy) / lengthSquared));
  return Math.hypot(point.x - (line.x1 + t * dx), point.y - (line.y1 + t * dy));
}

function median(values) {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function scoreTransform(points, lines, bounds, transform) {
  const sampledLines = lines.length > 1800 ? lines.filter((_, index) => index % Math.ceil(lines.length / 1800) === 0) : lines;
  const transformedPoints = [];
  const distances = [];
  let inBoundsCount = 0;
  for (const point of points) {
    const transformed = applyTransform(point, transform);
    transformedPoints.push(transformed);
    if (inside(transformed, bounds)) inBoundsCount += 1;
    let nearest = Number.POSITIVE_INFINITY;
    for (const line of sampledLines) {
      const distance = distanceToSegment(transformed, line);
      if (distance < nearest) nearest = distance;
    }
    if (Number.isFinite(nearest)) distances.push(nearest);
  }
  return {
    averageDistance: distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : Number.POSITIVE_INFINITY,
    axisPair: `${transform.axisA}${transform.axisB}`,
    inBoundsCount,
    inBoundsRatio: points.length ? inBoundsCount / points.length : 0,
    medianDistance: median(distances),
    outOfBoundsCount: points.length - inBoundsCount,
    transformKey: transform.key,
    transformedBounds: boundsForPoints(transformedPoints),
  };
}

function transformToCalibration(transform, score, source) {
  return {
    source,
    axisPair: `${transform.axisA}${transform.axisB}`,
    axisA: transform.axisA,
    axisB: transform.axisB,
    selectedTransform: transform.key,
    flipA: transform.flipA,
    flipB: transform.flipB,
    flipX: transform.axisA === "x" ? transform.flipA : transform.axisB === "x" ? transform.flipB : false,
    flipY: transform.axisA === "y" ? transform.flipA : transform.axisB === "y" ? transform.flipB : false,
    offsetA: 0,
    offsetB: 0,
    offsetX: 0,
    offsetY: 0,
    rotateX: transform.rotateX,
    rotateY: transform.rotateY,
    rotateZ: transform.rotateZ,
    scaleA: 1,
    scaleB: 1,
    scaleX: 1,
    scaleY: 1,
    swapAxes: transform.axisA !== "x" || transform.axisB !== "y",
    swapXY: transform.axisA === "y" && transform.axisB === "x",
    score,
  };
}

function alignmentStatus(score, spawnCount) {
  if (!score || !spawnCount) return "missing spawn data";
  if (score.inBoundsRatio >= 0.82 && score.medianDistance <= 160) return "good";
  if (score.inBoundsRatio >= 0.55) return "partial";
  return "needs review";
}

const manifest = readJson(manifestPath, {});
const calibrations = readJson(calibrationPath, {});
const existingGlobalDefault = calibrations._globalDefault ?? null;
const zoneReports = [];
const transformWins = {};
const targetZones = new Set(["cazicthule", "cauldron", "innothule", "kaladima", "kaladimb", "soldunga"]);

calibrations._globalDefault = {
  note: "Default Brewall/EQEmu spawn coordinate convention for runtime map overlays. Per-zone spawnTransform entries may override this.",
  spawnTransform: transformToCalibration(globalDefaultTransform, null, "global-default-brewall-neg-x-neg-y"),
};

for (const [shortName, assetInfo] of Object.entries(manifest)) {
  const assetPath = resolve("public", assetInfo.assetUrl.replace(/^\//, ""));
  const spawnPath = resolve("data", `eqemu-${shortName}-spawns-test.json`);
  if (!existsSync(assetPath) || !existsSync(spawnPath)) {
    zoneReports.push({
      shortName,
      alignmentStatus: existsSync(assetPath) ? "missing spawn data" : "missing map",
      appliedTransformSource: "none",
    });
    continue;
  }
  const asset = readJson(assetPath, null);
  const spawnData = readJson(spawnPath, null);
  const lines = (asset?.layers ?? []).flatMap((layer) => layer.lines ?? []);
  const bounds = boundsForLines(lines) ?? asset?.bounds;
  const points = (spawnData?.primarySpawnRows ?? []).map((spawn) => ({ x: spawn.x, y: spawn.y, z: spawn.z }));
  if (!bounds || !lines.length || !points.length) {
    zoneReports.push({
      shortName,
      displayName: spawnData?.zoneName ?? shortName,
      alignmentStatus: !lines.length ? "missing map" : "missing spawn data",
      appliedTransformSource: "none",
    });
    continue;
  }

  const scored = transformCandidates.map((transform) => ({
    transform,
    score: scoreTransform(points, lines, bounds, transform),
  })).sort((a, b) => (
    b.score.inBoundsCount - a.score.inBoundsCount
    || a.score.medianDistance - b.score.medianDistance
    || a.score.averageDistance - b.score.averageDistance
    || a.score.transformKey.localeCompare(b.score.transformKey)
  ));
  const best = scored[0];
  const globalCandidate = scored.find((entry) => entry.transform.key === globalDefaultTransform.key);
  transformWins[best.transform.key] = (transformWins[best.transform.key] ?? 0) + 1;

  const globalScore = globalCandidate.score;
  const globalStatus = alignmentStatus(globalScore, points.length);
  const bestStatus = alignmentStatus(best.score, points.length);
  const useGlobal = globalStatus === "good"
    || (globalStatus === "partial" && globalScore.inBoundsRatio >= 0.7)
    || best.transform.key === globalDefaultTransform.key
    || best.transform.key === "xy-r180"
    || best.transform.key === "cazic-equivalent-yx-flip-b-rz270";
  const selected = useGlobal ? globalCandidate : best;
  const selectedStatus = alignmentStatus(selected.score, points.length);
  const appliedSource = useGlobal ? "global default" : "per-zone override";

  if (!calibrations[shortName]) {
    calibrations[shortName] = {
      zoneName: spawnData?.zoneName ?? shortName,
      defaultLayerKey: "main",
      layers: (asset.layers ?? []).map((layer) => ({
        key: layer.key,
        name: layer.name,
        mapImage: null,
        mapVectorKey: layer.key,
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
      })),
    };
  }
  calibrations[shortName].spawnTransform = transformToCalibration(
    selected.transform,
    selected.score,
    useGlobal ? "global-default-brewall-neg-x-neg-y" : "per-zone-auto-score-2d-v1",
  );
  calibrations[shortName].mapReadiness = selectedStatus;

  zoneReports.push({
    shortName,
    displayName: spawnData?.zoneName ?? shortName,
    targetZone: targetZones.has(shortName),
    spawnCount: points.length,
    lineCount: lines.length,
    selectedTransform: selected.transform.key,
    selectedTransformLabel: selected.transform.label,
    selectedTransformSource: appliedSource,
    alignmentStatus: selectedStatus,
    globalDefaultScore: globalScore,
    bestTransform: {
      key: best.transform.key,
      label: best.transform.label,
      status: bestStatus,
      score: best.score,
    },
    topCandidates: scored.slice(0, 8).map((entry) => ({
      key: entry.transform.key,
      label: entry.transform.label,
      score: entry.score,
    })),
    needsManualReview: selectedStatus === "needs review",
  });
}

const appliedGlobalCount = zoneReports.filter((zone) => zone.selectedTransformSource === "global default").length;
const overrideCount = zoneReports.filter((zone) => zone.selectedTransformSource === "per-zone override").length;
const report = {
  generatedAt: new Date().toISOString(),
  purpose: "Audit Brewall map overlay spawn coordinate transforms across Real Spawn Data zones.",
  workingCazicThuleFinding: "The previous Cazic-Thule stored transform yx-flip-b-rz270 is mathematically equivalent to rendering spawn X/Y as -X / -Y.",
  previousGlobalDefault: existingGlobalDefault,
  globalDefaultApplied: {
    key: globalDefaultTransform.key,
    label: globalDefaultTransform.label,
    axisPair: "xy",
    flipX: true,
    flipY: true,
    swapXY: false,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    zonesUsingGlobalDefault: appliedGlobalCount,
    zonesUsingPerZoneOverrides: overrideCount,
  },
  transformWinCounts: transformWins,
  summary: {
    zonesTested: zoneReports.length,
    good: zoneReports.filter((zone) => zone.alignmentStatus === "good").length,
    partial: zoneReports.filter((zone) => zone.alignmentStatus === "partial").length,
    needsReview: zoneReports.filter((zone) => zone.alignmentStatus === "needs review").length,
    missingMap: zoneReports.filter((zone) => zone.alignmentStatus === "missing map").length,
    missingSpawnData: zoneReports.filter((zone) => zone.alignmentStatus === "missing spawn data").length,
  },
  targetZoneChecks: zoneReports.filter((zone) => targetZones.has(zone.shortName)),
  failingZonesNeedingManualReview: zoneReports.filter((zone) => zone.needsManualReview),
  zones: zoneReports,
};

writeFileSync(calibrationPath, `${JSON.stringify(calibrations)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  summary: report.summary,
  globalDefaultApplied: report.globalDefaultApplied,
  targetZoneChecks: report.targetZoneChecks.map((zone) => ({
    shortName: zone.shortName,
    selectedTransform: zone.selectedTransform,
    source: zone.selectedTransformSource,
    status: zone.alignmentStatus,
    inBounds: zone.globalDefaultScore?.inBoundsCount,
    median: zone.globalDefaultScore?.medianDistance,
  })),
}, null, 2));
