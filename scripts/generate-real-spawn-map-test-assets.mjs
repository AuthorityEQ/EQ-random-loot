import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const brewallRoot = "C:\\Users\\Public\\Daybreak Game Company\\Installed Games\\EverQuest\\maps\\brewall";
const zoneMapAssetsPath = resolve("data/zone-map-assets.json");
const publicMapAssetRoot = resolve("public/zone-map-assets");
const zoneMapCalibrationsPath = resolve("data/zone-map-calibrations.json");
const nativeMapIndexPath = resolve("data/eqemu-native-map-debug-index.json");
const expansionReportPath = resolve("data/real-spawn-map-expansion-report.json");
const rolloutReportPath = resolve("data/real-spawn-map-rollout-report.json");
const realSpawnSummaryPath = resolve("data/eqemu-real-spawn-zone-summaries.json");

const spawnAxisPairs = [
  { axisA: "x", axisB: "y", key: "xy", label: "X/Y" },
  { axisA: "y", axisB: "x", key: "yx", label: "Y/X" },
  { axisA: "x", axisB: "z", key: "xz", label: "X/Z" },
  { axisA: "z", axisB: "x", key: "zx", label: "Z/X" },
  { axisA: "y", axisB: "z", key: "yz", label: "Y/Z" },
  { axisA: "z", axisB: "y", key: "zy", label: "Z/Y" },
];

const flipPatterns = [
  { key: "normal", label: "Normal", flipA: false, flipB: false },
  { key: "flip-a", label: "Flip A", flipA: true, flipB: false },
  { key: "flip-b", label: "Flip B", flipA: false, flipB: true },
  { key: "flip-both", label: "Flip Both", flipA: true, flipB: true },
];

const rotationPresets = [
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
];

const transformPatterns = spawnAxisPairs.flatMap((pair) => flipPatterns.flatMap((flip) => rotationPresets.map((rotation) => ({
  axisA: pair.axisA,
  axisB: pair.axisB,
  flipA: flip.flipA,
  flipB: flip.flipB,
  key: `${pair.key}-${flip.key}-${rotation.key}`,
  label: [pair.label, flip.label, rotation.label].filter(Boolean).join(" "),
  rotateX: rotation.rotateX,
  rotateY: rotation.rotateY,
  rotateZ: rotation.rotateZ,
}))));

const brewallFiles = new Set(existsSync(brewallRoot)
  ? readdirSync(brewallRoot).filter((file) => file.toLowerCase().endsWith(".txt")).map((file) => file.toLowerCase())
  : []);

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseNumber(value) {
  const number = Number.parseFloat(String(value).trim());
  return Number.isFinite(number) ? number : null;
}

function layerPath(shortName, suffix = "") {
  return `${brewallRoot}\\${shortName}${suffix}.txt`;
}

function layerExists(shortName, suffix = "") {
  return brewallFiles.has(`${shortName}${suffix}.txt`.toLowerCase());
}

function discoverZones() {
  const summaries = readJson(realSpawnSummaryPath, []);
  if (Array.isArray(summaries) && summaries.length) {
    return summaries
      .filter((zone) => zone?.zoneShortName && existsSync(resolve("data", `eqemu-${zone.zoneShortName}-spawns-test.json`)))
      .map((zone) => ({
        displayName: zone.zoneName ?? zone.zoneShortName,
        expansion: zone.expansion ?? "Unknown",
        shortName: zone.zoneShortName,
      }))
      .sort((a, b) => a.shortName.localeCompare(b.shortName));
  }

  return readdirSync(resolve("data"))
    .map((file) => /^eqemu-(.+)-spawns-test\.json$/.exec(file)?.[1])
    .filter(Boolean)
    .map((shortName) => ({ shortName, displayName: shortName, expansion: "Unknown" }))
    .sort((a, b) => a.shortName.localeCompare(b.shortName));
}

function parseMapFile(layer) {
  if (!existsSync(layer.path)) return { ...layer, exists: false, lines: [], labels: [] };
  const lines = [];
  const labels = [];
  const source = readFileSync(layer.path, "utf8").replace(/^\uFEFF/, "");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(",").map((part) => part.trim());
    const recordType = parts[0].split(/\s+/)[0];
    const firstValue = parts[0].replace(/^[A-Z]\s+/, "");
    if (recordType === "L") {
      const values = [firstValue, ...parts.slice(1)].map(parseNumber);
      if (values.slice(0, 9).some((value) => value === null)) continue;
      lines.push({
        x1: values[0],
        y1: values[1],
        z1: values[2],
        x2: values[3],
        y2: values[4],
        z2: values[5],
        color: `rgb(${values[6]}, ${values[7]}, ${values[8]})`,
      });
    } else if (recordType === "P") {
      const values = [firstValue, ...parts.slice(1, 7)].map(parseNumber);
      if (values.slice(0, 7).some((value) => value === null)) continue;
      labels.push({
        x: values[0],
        y: values[1],
        z: values[2],
        color: `rgb(${values[3]}, ${values[4]}, ${values[5]})`,
        size: values[6],
        label: parts.slice(7).join(",").replace(/_/g, " ").trim(),
      });
    }
  }
  return { ...layer, exists: true, lines, labels };
}

function boundsForLines(lines) {
  const xs = [];
  const ys = [];
  for (const line of lines) {
    xs.push(line.x1, line.x2);
    ys.push(line.y1, line.y2);
  }
  if (!xs.length || !ys.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function boundsForPoints(points) {
  const xs = points.map((point) => point.x).filter((value) => typeof value === "number" && Number.isFinite(value));
  const ys = points.map((point) => point.y).filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!xs.length || !ys.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function nativeCoordinateValue(point, axis) {
  return typeof point[axis] === "number" ? point[axis] : 0;
}

function rotateSpawnCoordinates(point, transform) {
  let x = point.x ?? 0;
  let y = point.y ?? 0;
  let z = point.z ?? 0;
  const rotate = (degrees) => (degrees * Math.PI) / 180;

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

function applyTransform(point, transform) {
  const rotatedPoint = rotateSpawnCoordinates(point, transform);
  let a = nativeCoordinateValue(rotatedPoint, transform.axisA);
  let b = nativeCoordinateValue(rotatedPoint, transform.axisB);
  if (transform.flipA) a *= -1;
  if (transform.flipB) b *= -1;
  return { x: a, y: b };
}

function insideBounds(point, bounds) {
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
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function scoreTransform(points, lines, bounds, transform) {
  const sampledLines = lines.length > 1800 ? lines.filter((_, index) => index % Math.ceil(lines.length / 1800) === 0) : lines;
  const distances = [];
  let inBoundsCount = 0;
  const transformedPoints = [];
  for (const point of points) {
    const transformed = applyTransform(point, transform);
    transformedPoints.push(transformed);
    if (insideBounds(transformed, bounds)) inBoundsCount += 1;
    if (sampledLines.length) {
      let nearest = Number.POSITIVE_INFINITY;
      for (const line of sampledLines) {
        const distance = distanceToSegment(transformed, line);
        if (distance < nearest) nearest = distance;
      }
      if (Number.isFinite(nearest)) distances.push(nearest);
    }
  }
  const averageDistance = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : Number.POSITIVE_INFINITY;
  return {
    averageDistance,
    axisPair: `${transform.axisA}${transform.axisB}`,
    inBoundsCount,
    medianDistance: median(distances),
    outOfBoundsCount: points.length - inBoundsCount,
    transformKey: transform.key,
    transformedBounds: boundsForPoints(transformedPoints),
  };
}

function bestTransform(points, lines, bounds) {
  const scored = transformPatterns.map((transform) => ({
    transform,
    score: scoreTransform(points, lines, bounds, transform),
  }));
  scored.sort((a, b) => (
    b.score.inBoundsCount - a.score.inBoundsCount
    || a.score.medianDistance - b.score.medianDistance
    || a.score.averageDistance - b.score.averageDistance
    || a.score.outOfBoundsCount - b.score.outOfBoundsCount
    || a.score.transformKey.localeCompare(b.score.transformKey)
  ));
  return scored[0] ?? null;
}

function readinessFor(score, spawnCount, mapFileStatus) {
  if (!mapFileStatus.hasMap) return "missing";
  if (!score || spawnCount === 0) return "needs review";
  const inBoundsRatio = score.inBoundsCount / Math.max(1, spawnCount);
  if (inBoundsRatio >= 0.8 && score.medianDistance <= 120) return "good";
  if (inBoundsRatio >= 0.55) return "partial";
  return "needs review";
}

function meaningfulDropCount(lootData) {
  const items = new Set();
  for (const mob of lootData?.mobs ?? []) {
    for (const lootdrop of mob.lootdrops ?? []) {
      for (const item of lootdrop.items ?? []) {
        if (item.itemId || item.itemName) items.add(String(item.itemId || item.itemName));
      }
    }
  }
  return items.size;
}

function likelyNamedCount(spawnData) {
  const names = new Set();
  for (const spawn of spawnData?.primarySpawnRows ?? []) {
    for (const candidate of spawn.candidates ?? []) {
      const raw = String(candidate.name ?? "").toLowerCase();
      const display = String(candidate.displayName ?? "").trim();
      if (raw.startsWith("#") || (display && !/^(a|an|the)\s+/i.test(display))) {
        names.add(display || raw);
      }
    }
  }
  return names.size;
}

const zoneMapAssets = {};
const nativeMapIndex = {};
const calibrations = readJson(zoneMapCalibrationsPath, {});
const zones = discoverZones();
const report = {
  generatedAt: new Date().toISOString(),
  source: "Brewall map text + existing EQEmu Real Spawn exports",
  scope: "All exported Real Spawn Data zones currently present in data/eqemu-real-spawn-zone-summaries.json.",
  summary: {
    zonesConsidered: zones.length,
    mapsEnabled: 0,
    mapsSkipped: 0,
    good: 0,
    partial: 0,
    needsReview: 0,
    missing: 0,
  },
  zonesProcessed: [],
  enabledZones: [],
  skippedZones: [],
  notes: [
    "Zone Snapshot data is not modified.",
    "Map dots use existing EQEmu spawn export coordinates; this script does not query the database.",
    "Alignment status is a heuristic based on spawn bounds, map bounds, and nearest visible Brewall line distance.",
    "Only zones with good or partial readiness are written to the runtime map index.",
  ],
};

mkdirSync(publicMapAssetRoot, { recursive: true });

for (const zone of zones) {
  const sourceLayers = [
    { exists: layerExists(zone.shortName), key: "main", name: "Main", path: layerPath(zone.shortName) },
    { exists: layerExists(zone.shortName, "_1"), key: "poi", name: "Points", path: layerPath(zone.shortName, "_1") },
    { exists: layerExists(zone.shortName, "_2"), key: "overlay", name: "Overlay", path: layerPath(zone.shortName, "_2") },
  ];
  const layers = sourceLayers.map((layer) => (layer.exists ? parseMapFile(layer) : { ...layer, lines: [], labels: [] }));
  const existingLayers = layers.filter((layer) => layer.exists);
  const mapLines = existingLayers.flatMap((layer) => layer.lines);
  const mapBounds = boundsForLines(mapLines);
  const spawnData = readJson(resolve("data", `eqemu-${zone.shortName}-spawns-test.json`), null);
  const lootData = readJson(resolve("data", `eqemu-${zone.shortName}-loot-test.json`), null);
  const spawnRows = spawnData?.primarySpawnRows ?? [];
  const nativeSpawns = spawnRows.map((spawn) => ({
    id: spawn.spawn2Id,
    spawngroupID: spawn.spawngroupId,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    heading: spawn.heading,
    respawnTime: spawn.respawnTime,
    pathgrid: spawn.pathgrid ?? null,
  }));
  const scored = mapLines.length && nativeSpawns.length ? bestTransform(nativeSpawns, mapLines, mapBounds) : null;
  const mapFileStatus = {
    hasMap: existingLayers.length > 0,
    existingFiles: existingLayers.map((layer) => layer.path),
    missingFiles: layers.filter((layer) => !layer.exists).map((layer) => layer.path),
  };
  const readiness = readinessFor(scored?.score ?? null, nativeSpawns.length, mapFileStatus);
  const enabled = spawnData && (readiness === "good" || readiness === "partial");

  if (enabled) {
    const mapAsset = {
      sourceKind: "Brewall EQ map text",
      sourceFiles: existingLayers.map((layer) => layer.path),
      bounds: mapBounds,
      layers: existingLayers.map(({ key, name, lines, labels }) => ({ key, name, lines, labels })),
    };
    writeFileSync(resolve(publicMapAssetRoot, `${zone.shortName}.json`), `${JSON.stringify(mapAsset)}\n`);
    zoneMapAssets[zone.shortName] = {
      assetUrl: `/zone-map-assets/${zone.shortName}.json`,
      sourceKind: mapAsset.sourceKind,
      sourceFiles: mapAsset.sourceFiles,
      bounds: mapAsset.bounds,
      layers: [],
    };
    nativeMapIndex[zone.shortName] = {
      zoneShortName: zone.shortName,
      zoneName: spawnData.zoneName ?? zone.displayName,
      sourceKind: "Existing EQEmu Real Spawn export + Brewall map overlay",
      coordinateNote: "Spawn dots are one EQEmu spawn2 slot each, rendered against Brewall EQ map text in native EQ coordinates.",
      mapReadiness: readiness,
      bounds: mapBounds,
      collisionLines: [],
      gridLines: [],
      spawns: nativeSpawns,
      doors: [],
      zonePoints: [],
      objects: [],
      groundSpawns: [],
      traps: [],
    };
  }

  if (enabled && scored) {
    calibrations[zone.shortName] = {
      zoneName: spawnData?.zoneName ?? zone.displayName,
      defaultLayerKey: "main",
      layers: existingLayers.map((layer) => ({
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
      spawnTransform: {
        source: "auto-score-rollout-v1",
        axisPair: scored.transform.axisA + scored.transform.axisB,
        axisA: scored.transform.axisA,
        axisB: scored.transform.axisB,
        selectedTransform: scored.transform.key,
        flipA: scored.transform.flipA,
        flipB: scored.transform.flipB,
        flipX: scored.transform.axisA === "x" ? scored.transform.flipA : scored.transform.axisB === "x" ? scored.transform.flipB : false,
        flipY: scored.transform.axisA === "y" ? scored.transform.flipA : scored.transform.axisB === "y" ? scored.transform.flipB : false,
        offsetA: 0,
        offsetB: 0,
        offsetX: 0,
        offsetY: 0,
        rotateX: scored.transform.rotateX,
        rotateY: scored.transform.rotateY,
        rotateZ: scored.transform.rotateZ,
        scaleA: 1,
        scaleB: 1,
        scaleX: 1,
        scaleY: 1,
        swapAxes: scored.transform.axisA !== "x" || scored.transform.axisB !== "y",
        swapXY: scored.transform.axisA === "y" && scored.transform.axisB === "x",
        score: scored.score,
      },
    };
  }

  const zoneReport = {
    shortName: zone.shortName,
    displayName: spawnData?.zoneName ?? zone.displayName,
    expansion: zone.expansion,
    enabled,
    alignmentStatus: readiness,
    mapFileStatus,
    layerCount: existingLayers.length,
    lineCount: mapLines.length,
    labelCount: existingLayers.reduce((sum, layer) => sum + layer.labels.length, 0),
    mapBounds,
    spawnBounds: boundsForPoints(nativeSpawns),
    spawnCount: nativeSpawns.length,
    candidateCount: spawnData?.candidateCount ?? 0,
    namedCount: likelyNamedCount(spawnData),
    dropCount: meaningfulDropCount(lootData),
    selectedTransform: scored?.transform ?? null,
    score: scored?.score ?? null,
    unresolvedIssues: [
      ...(spawnData ? [] : ["Missing Real Spawn export"]),
      ...(mapFileStatus.hasMap ? [] : ["Missing Brewall map text"]),
      ...(readiness === "needs review" ? ["Alignment needs manual review"] : []),
    ],
  };

  report.zonesProcessed.push(zoneReport);
  report.summary[readiness === "needs review" ? "needsReview" : readiness] += 1;
  if (enabled) {
    report.summary.mapsEnabled += 1;
    report.enabledZones.push(zoneReport);
  } else {
    report.summary.mapsSkipped += 1;
    report.skippedZones.push(zoneReport);
  }
}

writeFileSync(zoneMapAssetsPath, `${JSON.stringify(zoneMapAssets)}\n`);
writeFileSync(nativeMapIndexPath, `${JSON.stringify(nativeMapIndex)}\n`);
writeFileSync(zoneMapCalibrationsPath, `${JSON.stringify(calibrations)}\n`);
writeFileSync(expansionReportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(rolloutReportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  summary: report.summary,
  sampleEnabled: report.enabledZones.slice(0, 12).map((zone) => ({
    shortName: zone.shortName,
    alignmentStatus: zone.alignmentStatus,
    spawns: zone.spawnCount,
    layers: zone.layerCount,
    transform: zone.selectedTransform?.key ?? null,
  })),
  outputs: [zoneMapAssetsPath, nativeMapIndexPath, zoneMapCalibrationsPath, expansionReportPath, rolloutReportPath],
}, null, 2));
