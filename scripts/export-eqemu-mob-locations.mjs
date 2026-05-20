import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const zoneShortName = process.argv[2] ?? "crushbone";
const inputPath = resolve(`data/eqemu-${zoneShortName}-spawns-test.json`);
const csvOutputPath = resolve(`data/exports/${zoneShortName}-mob-locations.csv`);
const jsonOutputPath = resolve(`data/exports/${zoneShortName}-mob-locations.json`);
const reportOutputPath = resolve(`data/exports/${zoneShortName}-mob-locations-report.json`);
const shareCsvOutputPath = resolve(`data/${zoneShortName}-spawn-export.csv`);
const shareJsonOutputPath = resolve(`data/${zoneShortName}-spawn-export.json`);
const representativeReportPath = resolve("data/real-spawn-map-representative-report.json");

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
}

function boundsFor(rows, axis) {
  const values = rows.map((row) => numberOrNull(row[axis])).filter((value) => value !== null);
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: null, max: null };
}

const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const rows = Array.isArray(raw.primarySpawnRows) ? raw.primarySpawnRows : [];
const representativeReport = existsSync(representativeReportPath)
  ? JSON.parse(readFileSync(representativeReportPath, "utf8"))
  : null;
const zoneRepresentativeReport = representativeReport?.zones?.find((zone) => zone.zoneShortName === (raw.zoneShortName ?? zoneShortName));
const namedRareNames = new Set((zoneRepresentativeReport?.namedCandidatesDetected ?? []).map(normalizeName));
const representativeDiffsBySpawn2 = new Map(
  (zoneRepresentativeReport?.representativeDiffs ?? []).map((diff) => [diff.spawn2Id, diff]),
);

const exportRows = rows.map((row) => ({
  ...row,
})).map((row) => {
  const representativeDiff = representativeDiffsBySpawn2.get(row.spawn2Id);
  const primaryDisplayName = row.displayName ?? row.primaryNpcName ?? "Unknown";
  const primaryNamedRare = namedRareNames.has(normalizeName(primaryDisplayName));
  const candidateScoreByName = new Map(
    (representativeDiff?.candidates ?? []).map((candidate) => [normalizeName(candidate.name), candidate]),
  );
  const candidates = Array.isArray(row.candidates)
    ? row.candidates.map((candidate) => {
      const displayName = candidate.displayName ?? candidate.name ?? "Unknown";
      const score = candidateScoreByName.get(normalizeName(displayName));

      return {
        npcTypeId: candidate.npcTypeId ?? null,
        mobName: candidate.name ?? null,
        displayName,
        level: candidate.level ?? null,
        race: candidate.race ?? "Unknown",
        className: candidate.className ?? "Unknown",
        chance: candidate.chance ?? null,
        isNamedRare: Boolean(score?.named ?? namedRareNames.has(normalizeName(displayName))),
        selectedAsMapRepresentative: Boolean(score?.selected),
        classificationReason: score?.selected ? representativeDiff?.reason ?? "selected representative" : score?.named ? "named/rare candidate" : null,
        dropCount: score?.dropCount ?? null,
        meaningfulDropCount: score?.meaningfulDropCount ?? null,
      };
    })
    : [];
  const mapRepresentativeName = representativeDiff?.mapRepresentative ?? primaryDisplayName;
  const selectedCandidate = candidates.find((candidate) => candidate.selectedAsMapRepresentative)
    ?? candidates.find((candidate) => normalizeName(candidate.displayName) === normalizeName(mapRepresentativeName));

  return {
    zoneShortName: raw.zoneShortName ?? zoneShortName,
    spawn2Id: row.spawn2Id ?? null,
    spawngroupId: row.spawngroupId ?? null,
    mobName: row.primaryNpcName ?? null,
    displayName: primaryDisplayName,
    mapRepresentativeName,
    mapRepresentativeChance: representativeDiff?.representativeChance ?? selectedCandidate?.chance ?? row.chance ?? null,
    isNamedRare: Boolean(selectedCandidate?.isNamedRare ?? primaryNamedRare),
    classificationReason: representativeDiff?.reason ?? (primaryNamedRare ? "named/rare candidate" : "common primary candidate"),
    level: row.level ?? null,
    race: row.race ?? "Unknown",
    className: row.className ?? "Unknown",
    chance: row.chance ?? null,
    respawnTime: row.respawnTime ?? null,
    x: row.x ?? null,
    y: row.y ?? null,
    z: row.z ?? null,
    heading: row.heading ?? null,
    candidateCount: row.candidateCount ?? candidates.length,
    candidates,
  };
});

const csvColumns = [
  "zoneShortName",
  "spawn2Id",
  "spawngroupId",
  "mobName",
  "displayName",
  "mapRepresentativeName",
  "mapRepresentativeChance",
  "isNamedRare",
  "classificationReason",
  "level",
  "race",
  "className",
  "chance",
  "respawnTime",
  "x",
  "y",
  "z",
  "heading",
  "candidateCount",
  "candidatesSummary",
];

const csv = [
  csvColumns.join(","),
  ...exportRows.map((row) => csvColumns.map((column) => {
    if (column === "candidatesSummary") {
      return csvValue(row.candidates.map((candidate) => {
        const tag = candidate.isNamedRare ? " named/rare" : "";
        return `${candidate.displayName} ${candidate.chance ?? "?"}% L${candidate.level ?? "?"}${tag}`;
      }).join(" | "));
    }

    return csvValue(row[column]);
  }).join(",")),
].join("\n");

const coordinateBounds = {
  x: boundsFor(exportRows, "x"),
  y: boundsFor(exportRows, "y"),
  z: boundsFor(exportRows, "z"),
};

const report = {
  generatedAt: new Date().toISOString(),
  zoneShortName: raw.zoneShortName ?? zoneShortName,
  zoneName: raw.zoneName ?? zoneShortName,
  sourceKind: raw.sourceKind ?? "Local EQEmu/PEQ database export",
  sourceNote: raw.sourceNote ?? null,
  warning: "Emulator-derived spawn data; verify against the target server era before treating it as authoritative.",
  totalSpawnSlots: exportRows.length,
  totalCandidates: raw.candidateCount ?? exportRows.reduce((sum, row) => sum + row.candidates.length, 0),
  namedRareSpawnSlots: exportRows.filter((row) => row.isNamedRare).length,
  uniquePrimaryMobs: new Set(exportRows.map((row) => normalizeName(row.displayName))).size,
  uniqueMapRepresentatives: new Set(exportRows.map((row) => normalizeName(row.mapRepresentativeName))).size,
  coordinateBounds,
  classificationSource: zoneRepresentativeReport
    ? "data/real-spawn-map-representative-report.json"
    : "No representative report found; named/rare classification is limited.",
  transformCalibration: {
    note: "No transform is applied to export coordinates. Use raw EQEmu x/y/z values for map alignment.",
  },
  axisNotes: [
    "Coordinates are original EQEmu spawn2 x/y/z values.",
    "No map-image transform, rotation, flip, or scale has been applied.",
    "Use x/y/z as raw coordinate candidates for map alignment experiments.",
  ],
  sourceTablesUsed: [
    "spawn2",
    "spawngroup",
    "spawnentry",
    "npc_types",
  ],
  assumptions: [
    "One spawn2 row equals one spawn slot.",
    "Primary mob is the highest-chance spawnentry candidate, using the exporter tie-breakers.",
    "All spawn candidates are retained in the JSON export.",
    "CSV contains one row per spawn slot using the primary candidate.",
  ],
  outputs: {
    csv: csvOutputPath,
    json: jsonOutputPath,
    shareCsv: shareCsvOutputPath,
    shareJson: shareJsonOutputPath,
    report: reportOutputPath,
  },
};

mkdirSync(dirname(csvOutputPath), { recursive: true });
writeFileSync(csvOutputPath, `${csv}\n`);
const jsonExport = {
  zoneShortName: report.zoneShortName,
  zoneName: report.zoneName,
  sourceKind: report.sourceKind,
  sourceNote: report.sourceNote,
  warning: report.warning,
  generatedAt: report.generatedAt,
  summary: {
    totalSpawnSlots: report.totalSpawnSlots,
    totalCandidates: report.totalCandidates,
    namedRareSpawnSlots: report.namedRareSpawnSlots,
    uniquePrimaryMobs: report.uniquePrimaryMobs,
    uniqueMapRepresentatives: report.uniqueMapRepresentatives,
    coordinateBounds: report.coordinateBounds,
  },
  transformCalibration: report.transformCalibration,
  primarySpawnRows: exportRows,
};

writeFileSync(jsonOutputPath, `${JSON.stringify(jsonExport, null, 2)}\n`);
writeFileSync(shareJsonOutputPath, `${JSON.stringify(jsonExport, null, 2)}\n`);
writeFileSync(shareCsvOutputPath, `${csv}\n`);
writeFileSync(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  zoneShortName: report.zoneShortName,
  totalSpawnSlots: report.totalSpawnSlots,
  totalCandidates: report.totalCandidates,
  coordinateBounds,
  outputs: report.outputs,
}, null, 2));
