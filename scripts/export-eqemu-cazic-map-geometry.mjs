import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";

const zoneShortName = "cazicthule";
const serverRoot = "C:/eqserver/eqemu server";
const configPath = `${serverRoot}/eqemu_config.json`;
const mysqlPath = "C:/Program Files/MariaDB 10.11/bin/mysql.exe";
const mapPath = `${serverRoot}/maps/cazicthule.map`;
const navPath = `${serverRoot}/maps/peqmaps-main/nav/cazicthule.nav`;
const waterPath = `${serverRoot}/maps/peqmaps-main/water/cazicthule.wtr`;
const outputPath = resolve("data/eqemu-cazicthule-native-map-debug.json");
const reportPath = resolve("data/eqemu-cazicthule-native-map-report.json");

function readConfig() {
  const database = JSON.parse(readFileSync(configPath, "utf8"))?.server?.database;
  if (!database?.host || !database?.username || !database?.db) throw new Error(`Missing database config in ${configPath}`);
  return {
    host: database.host,
    port: database.port ?? 3306,
    user: database.username,
    password: database.password ?? "",
    database: database.db,
  };
}

function writeTempDefaultsFile(database) {
  const path = resolve(tmpdir(), `frostreaver-eqemu-map-${process.pid}-${Date.now()}.cnf`);
  writeFileSync(path, [
    "[client]",
    `host=${database.host}`,
    `port=${database.port}`,
    `user=${database.user}`,
    `password=${database.password}`,
    `database=${database.database}`,
    "",
  ].join("\n"));
  return path;
}

function runMysql(defaultsPath, sql) {
  const result = spawnSync(mysqlPath, [
    `--defaults-extra-file=${defaultsPath}`,
    "--batch",
    "--raw",
    "--execute",
    sql,
  ], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 80,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`mysql exited with ${result.status}: ${result.stderr.trim() || result.stdout.trim()}`);
  return result.stdout.replace(/\r\n/g, "\n").trimEnd();
}

function parseTsv(output) {
  if (!output.trim()) return [];
  const lines = output.split("\n");
  const headers = lines.shift().split("\t");
  return lines.filter(Boolean).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, normalizeSqlValue(values[index])]));
  });
}

function normalizeSqlValue(value) {
  if (value === undefined || value === "NULL" || value === "\\N") return null;
  return value;
}

function sqlString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function numberOrNull(value) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inflateEqemuFile(path) {
  const raw = readFileSync(path);
  const offset = raw.indexOf(Buffer.from([0x78, 0x5e]));
  if (offset === -1) return null;
  return {
    path,
    rawBytes: raw.length,
    compressedOffset: offset,
    inflated: inflateSync(raw.subarray(offset)),
  };
}

function parseCollisionTriangles(path) {
  const inflated = inflateEqemuFile(path);
  if (!inflated) return { metadata: { path, useful: false, reason: "No zlib stream found." }, lines: [] };
  const data = inflated.inflated;
  const likelyTriangleCount = data.readUInt32LE(0);
  const startOffset = 40;
  const maxTrianglesBySize = Math.floor((data.length - startOffset) / 36);
  const triangleCount = Math.min(likelyTriangleCount, maxTrianglesBySize);
  const stride = Math.max(1, Math.ceil(triangleCount / 4500));
  const lines = [];
  let rejectedTriangles = 0;

  for (let index = 0; index < triangleCount; index += stride) {
    const offset = startOffset + index * 36;
    const vertices = [
      { x: data.readFloatLE(offset), y: data.readFloatLE(offset + 4), z: data.readFloatLE(offset + 8) },
      { x: data.readFloatLE(offset + 12), y: data.readFloatLE(offset + 16), z: data.readFloatLE(offset + 20) },
      { x: data.readFloatLE(offset + 24), y: data.readFloatLE(offset + 28), z: data.readFloatLE(offset + 32) },
    ];
    if (!vertices.every((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y) && Number.isFinite(vertex.z))) {
      rejectedTriangles += 1;
      continue;
    }
    if (!vertices.every((vertex) => Math.abs(vertex.x) < 10000 && Math.abs(vertex.y) < 10000 && Math.abs(vertex.z) < 10000)) {
      rejectedTriangles += 1;
      continue;
    }
    lines.push({ x1: vertices[0].x, y1: vertices[0].y, z1: vertices[0].z, x2: vertices[1].x, y2: vertices[1].y, z2: vertices[1].z, kind: "collision" });
    lines.push({ x1: vertices[1].x, y1: vertices[1].y, z1: vertices[1].z, x2: vertices[2].x, y2: vertices[2].y, z2: vertices[2].z, kind: "collision" });
    lines.push({ x1: vertices[2].x, y1: vertices[2].y, z1: vertices[2].z, x2: vertices[0].x, y2: vertices[0].y, z2: vertices[0].z, kind: "collision" });
  }

  return {
    metadata: {
      path,
      useful: true,
      sourceKind: "EQEmu .map collision geometry",
      rawBytes: inflated.rawBytes,
      inflatedBytes: data.length,
      compressedOffset: inflated.compressedOffset,
      likelyTriangleCount,
      sampledTriangleStride: stride,
      renderedLineCount: lines.length,
      rejectedTriangles,
      note: "The parser treats the inflated payload after the first 40 bytes as triangle vertices. This is suitable for visual debugging, not a full .map spec implementation.",
    },
    lines,
  };
}

function fileInfo(path) {
  try {
    const raw = readFileSync(path);
    const magic = raw.subarray(0, 16).toString("latin1").replace(/[^ -~]/g, ".");
    return { path, exists: true, bytes: raw.length, magic };
  } catch {
    return { path, exists: false };
  }
}

function boundsForGeometry({ lines, points }) {
  const xs = [];
  const ys = [];
  const include = (x, y) => {
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  };
  for (const line of lines) {
    include(line.x1, line.y1);
    include(line.x2, line.y2);
  }
  for (const point of points) include(point.x, point.y);
  if (!xs.length || !ys.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function gridLinesFromEntries(entries) {
  const byGrid = new Map();
  for (const entry of entries) {
    const gridid = numberOrNull(entry.gridid);
    if (gridid === null) continue;
    byGrid.set(gridid, [...(byGrid.get(gridid) ?? []), entry]);
  }
  const lines = [];
  for (const [gridid, rows] of byGrid.entries()) {
    const sorted = rows.sort((a, b) => (numberOrNull(a.number) ?? 0) - (numberOrNull(b.number) ?? 0));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      lines.push({
        gridid,
        kind: "path-grid",
        x1: numberOrNull(previous.x),
        y1: numberOrNull(previous.y),
        z1: numberOrNull(previous.z),
        x2: numberOrNull(current.x),
        y2: numberOrNull(current.y),
        z2: numberOrNull(current.z),
      });
    }
  }
  return lines;
}

function main() {
  const database = readConfig();
  const defaultsPath = writeTempDefaultsFile(database);
  try {
    const zone = parseTsv(runMysql(defaultsPath, `SELECT zoneidnumber, short_name, long_name, expansion FROM zone WHERE short_name = ${sqlString(zoneShortName)} LIMIT 1;`))[0];
    if (!zone) throw new Error(`No zone row found for ${zoneShortName}.`);
    const zoneId = numberOrNull(zone.zoneidnumber);

    const spawns = parseTsv(runMysql(defaultsPath, `
SELECT id, spawngroupID, zone, version, x, y, z, heading, respawntime, pathgrid
FROM spawn2
WHERE zone = ${sqlString(zoneShortName)}
ORDER BY id;`)).map((row) => ({
      id: numberOrNull(row.id),
      spawngroupID: numberOrNull(row.spawngroupID),
      x: numberOrNull(row.x),
      y: numberOrNull(row.y),
      z: numberOrNull(row.z),
      heading: numberOrNull(row.heading),
      respawnTime: numberOrNull(row.respawntime),
      pathgrid: numberOrNull(row.pathgrid),
    }));

    const grid = parseTsv(runMysql(defaultsPath, `SELECT id, zoneid, type, type2 FROM grid WHERE zoneid = ${zoneId} ORDER BY id;`));
    const gridEntries = parseTsv(runMysql(defaultsPath, `SELECT gridid, zoneid, number, x, y, z, heading, pause, centerpoint FROM grid_entries WHERE zoneid = ${zoneId} ORDER BY gridid, number;`));
    const doors = parseTsv(runMysql(defaultsPath, `SELECT id, doorid, zone, name, pos_x, pos_y, pos_z, heading, opentype, dest_zone, dest_x, dest_y, dest_z FROM doors WHERE zone = ${sqlString(zoneShortName)} ORDER BY id;`)).map((row) => ({
      id: numberOrNull(row.id),
      doorid: numberOrNull(row.doorid),
      name: row.name,
      x: numberOrNull(row.pos_x),
      y: numberOrNull(row.pos_y),
      z: numberOrNull(row.pos_z),
      heading: numberOrNull(row.heading),
      openType: numberOrNull(row.opentype),
      destZone: row.dest_zone,
      destX: numberOrNull(row.dest_x),
      destY: numberOrNull(row.dest_y),
      destZ: numberOrNull(row.dest_z),
    }));
    const zonePoints = parseTsv(runMysql(defaultsPath, `SELECT id, zone, number, x, y, z, heading, target_zone_id, target_x, target_y, target_z, target_heading FROM zone_points WHERE zone = ${sqlString(zoneShortName)} ORDER BY id;`)).map((row) => ({
      id: numberOrNull(row.id),
      number: numberOrNull(row.number),
      x: numberOrNull(row.x),
      y: numberOrNull(row.y),
      z: numberOrNull(row.z),
      heading: numberOrNull(row.heading),
      targetZoneId: numberOrNull(row.target_zone_id),
      targetX: numberOrNull(row.target_x),
      targetY: numberOrNull(row.target_y),
      targetZ: numberOrNull(row.target_z),
      targetHeading: numberOrNull(row.target_heading),
    }));
    const objects = parseTsv(runMysql(defaultsPath, `SELECT id, zoneid, xpos, ypos, zpos, heading, itemid, objectname, type FROM object WHERE zoneid = ${zoneId} ORDER BY id;`)).map((row) => ({
      id: numberOrNull(row.id),
      x: numberOrNull(row.xpos),
      y: numberOrNull(row.ypos),
      z: numberOrNull(row.zpos),
      heading: numberOrNull(row.heading),
      itemid: numberOrNull(row.itemid),
      name: row.objectname,
      type: numberOrNull(row.type),
    }));
    const groundSpawns = parseTsv(runMysql(defaultsPath, `SELECT id, zoneid, min_x, max_x, min_y, max_y, max_z, heading, name, item, comment FROM ground_spawns WHERE zoneid = ${zoneId} ORDER BY id;`)).map((row) => ({
      id: numberOrNull(row.id),
      minX: numberOrNull(row.min_x),
      maxX: numberOrNull(row.max_x),
      minY: numberOrNull(row.min_y),
      maxY: numberOrNull(row.max_y),
      z: numberOrNull(row.max_z),
      x: ((numberOrNull(row.min_x) ?? 0) + (numberOrNull(row.max_x) ?? 0)) / 2,
      y: ((numberOrNull(row.min_y) ?? 0) + (numberOrNull(row.max_y) ?? 0)) / 2,
      heading: numberOrNull(row.heading),
      name: row.name,
      item: numberOrNull(row.item),
      comment: row.comment,
    }));
    const traps = parseTsv(runMysql(defaultsPath, `SELECT id, zone, x, y, z, chance, radius, effect, message, level FROM traps WHERE zone = ${sqlString(zoneShortName)} ORDER BY id;`)).map((row) => ({
      id: numberOrNull(row.id),
      x: numberOrNull(row.x),
      y: numberOrNull(row.y),
      z: numberOrNull(row.z),
      chance: numberOrNull(row.chance),
      radius: numberOrNull(row.radius),
      effect: numberOrNull(row.effect),
      message: row.message,
      level: numberOrNull(row.level),
    }));

    const collision = parseCollisionTriangles(mapPath);
    const gridLines = gridLinesFromEntries(gridEntries);
    const nativeGeometry = {
      zoneShortName,
      zoneName: zone.long_name,
      sourceKind: "Local EQEmu native coordinate debug export",
      coordinateNote: "All overlays are rendered in native EQ x/y space without PNG alignment. Collision geometry is sampled from the local EQEmu .map file; path grids and markers are from EQEmu database tables.",
      bounds: boundsForGeometry({ lines: [...collision.lines, ...gridLines], points: [...spawns, ...doors, ...zonePoints, ...objects, ...groundSpawns, ...traps] }),
      collisionLines: collision.lines,
      gridLines,
      spawns,
      doors,
      zonePoints,
      objects,
      groundSpawns,
      traps,
    };
    const report = {
      zoneShortName,
      zoneName: zone.long_name,
      files: {
        map: { ...fileInfo(mapPath), ...collision.metadata },
        nav: fileInfo(navPath),
        water: fileInfo(waterPath),
      },
      tables: {
        spawn2: { useful: true, rows: spawns.length, contains: "Spawn slots and x/y/z coordinates." },
        grid: { useful: true, rows: grid.length, contains: "Path grid definitions keyed by zone id." },
        grid_entries: { useful: true, rows: gridEntries.length, contains: "Path waypoints in native x/y/z coordinates." },
        doors: { useful: true, rows: doors.length, contains: "Door/object marker coordinates and destination metadata." },
        zone_points: { useful: true, rows: zonePoints.length, contains: "Zone connection markers and target coordinates." },
        object: { useful: true, rows: objects.length, contains: "Placed world objects with native coordinates." },
        ground_spawns: { useful: true, rows: groundSpawns.length, contains: "Ground spawn regions; center point is derived for debug rendering." },
        traps: { useful: true, rows: traps.length, contains: "Trap marker coordinates/radius/effect metadata." },
      },
      conclusion: [
        "The local EQEmu .map file is the best local geometry source because it uses the same native coordinate family as spawn2.",
        "Database grid/door/zone_point/object/ground_spawn/trap tables provide useful overlays and validation markers, not full visual map geometry.",
        "The .nav file is likely pathing/navmesh data and is useful long-term, but was not parsed beyond file identification in this prototype.",
        "This is better than PNG alignment because it avoids screenshot scaling/cropping/orientation problems.",
      ],
      caveats: [
        "The .map triangle parser is a conservative visual-debug parser, not a complete EQEmu map format implementation.",
        "Cazic-Thule data appears to be the local PEQ/revamped-era zone content.",
        "Z-level/floor separation still needs a later layer/filter pass.",
      ],
    };
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(nativeGeometry, null, 2)}\n`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      ok: true,
      outputPath,
      reportPath,
      spawns: spawns.length,
      collisionLines: collision.lines.length,
      gridLines: gridLines.length,
      doors: doors.length,
      zonePoints: zonePoints.length,
      objects: objects.length,
      groundSpawns: groundSpawns.length,
      traps: traps.length,
    }, null, 2));
  } finally {
    try {
      unlinkSync(defaultsPath);
    } catch {
      // Best-effort cleanup for the temporary local DB defaults file.
    }
  }
}

main();
