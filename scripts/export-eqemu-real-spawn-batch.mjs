import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const defaultServerRoot = "C:/eqserver/eqemu server";
const defaultConfigPath = `${defaultServerRoot}/eqemu_config.json`;
const defaultMysqlPath = "C:/Program Files/MariaDB 10.11/bin/mysql.exe";
const configPath = resolve(process.argv[2] ?? defaultConfigPath);
const mysqlPath = process.argv[3] ?? defaultMysqlPath;
const maxExpansion = Number(process.argv[4] ?? 5);
const reportPath = resolve("data/eqemu-real-spawn-batch-report.json");

const expansionNamesById = {
  0: "Classic",
  1: "Kunark",
  2: "Velious",
  3: "Luclin",
  4: "Planes of Power",
  5: "Legacy of Ykesha",
};

function readConfig(path) {
  const config = JSON.parse(readFileSync(path, "utf8"));
  const database = config?.server?.database;
  if (!database?.host || !database?.username || !database?.db) {
    throw new Error(`Could not find server.database host/username/db in ${path}.`);
  }
  return {
    host: database.host,
    port: database.port ?? 3306,
    user: database.username,
    password: database.password ?? "",
    database: database.db,
  };
}

function writeTempDefaultsFile(database) {
  const path = resolve(tmpdir(), `frostreaver-eqemu-batch-${process.pid}-${Date.now()}.cnf`);
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
  if (result.status !== 0) {
    throw new Error(`mysql exited with ${result.status}: ${result.stderr.trim() || result.stdout.trim()}`);
  }
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

function assertSafeZoneShortName(value) {
  if (!/^[a-z0-9_]+$/i.test(value)) {
    throw new Error(`Unsafe zone shortname "${value}".`);
  }
}

function runNodeScript(script, zoneShortName) {
  const args = zoneShortName ? [script, zoneShortName] : [script];
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    error: result.error ? result.error.message : null,
  };
}

function hasExport(shortName) {
  return existsSync(resolve(`data/eqemu-${shortName}-spawns-test.json`))
    && existsSync(resolve(`data/eqemu-${shortName}-zone-summary-test.json`))
    && existsSync(resolve(`data/eqemu-${shortName}-loot-test.json`));
}

const database = readConfig(configPath);
const defaultsPath = writeTempDefaultsFile(database);
const report = {
  source: "Local EQEmu/PEQ database batch Real Spawn Data export",
  generatedAt: new Date().toISOString(),
  maxExpansion,
  expansionScope: Object.fromEntries(Object.entries(expansionNamesById).filter(([id]) => Number(id) <= maxExpansion)),
  configPath,
  mysqlPath,
  credentialsCommitted: false,
  credentialsHandling: "Credentials are read from local EQEmu config and passed through temporary mysql defaults files.",
  zonesConsidered: 0,
  zonesAlreadyExported: [],
  zonesExported: [],
  zonesSkipped: [],
  zonesFailed: [],
};

try {
  const sql = `
SELECT z.short_name, z.long_name, z.expansion, COUNT(s.id) AS spawn_count
FROM zone z
JOIN spawn2 s ON s.zone = z.short_name
WHERE z.expansion BETWEEN 0 AND ${Number.isFinite(maxExpansion) ? maxExpansion : 5}
  AND z.short_name REGEXP '^[A-Za-z0-9_]+$'
GROUP BY z.short_name, z.long_name, z.expansion
HAVING spawn_count > 0
ORDER BY z.expansion, z.short_name;`;
  const zones = parseTsv(runMysql(defaultsPath, sql));
  report.zonesConsidered = zones.length;

  for (const zone of zones) {
    const shortName = zone.short_name;
    try {
      assertSafeZoneShortName(shortName);
    } catch (error) {
      report.zonesSkipped.push({
        shortName,
        zoneName: zone.long_name,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (hasExport(shortName)) {
      report.zonesAlreadyExported.push({
        shortName,
        zoneName: zone.long_name,
        expansion: expansionNamesById[zone.expansion] ?? `Expansion ${zone.expansion}`,
        spawnCount: Number(zone.spawn_count),
      });
      continue;
    }

    const spawnResult = runNodeScript("scripts/export-eqemu-zone-spawns.mjs", shortName);
    if (!spawnResult.ok) {
      report.zonesFailed.push({
        shortName,
        zoneName: zone.long_name,
        step: "spawns",
        result: spawnResult,
      });
      continue;
    }

    const lootResult = runNodeScript("scripts/export-eqemu-zone-loot.mjs", shortName);
    if (!lootResult.ok) {
      report.zonesFailed.push({
        shortName,
        zoneName: zone.long_name,
        step: "loot",
        result: lootResult,
      });
      continue;
    }

    report.zonesExported.push({
      shortName,
      zoneName: zone.long_name,
      expansion: expansionNamesById[zone.expansion] ?? `Expansion ${zone.expansion}`,
      spawnCount: Number(zone.spawn_count),
      spawnResult: spawnResult.stdout ? JSON.parse(spawnResult.stdout) : null,
      lootResult: lootResult.stdout ? JSON.parse(lootResult.stdout) : null,
    });
  }

  const indexResult = runNodeScript("scripts/build-eqemu-real-spawn-index.mjs", "");
  const reconcileResult = runNodeScript("scripts/reconcile-eqemu-drop-items.mjs", "");
  report.indexRebuild = indexResult;
  report.itemReconciliation = reconcileResult;
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: report.zonesFailed.length === 0 && indexResult.ok && reconcileResult.ok,
    zonesConsidered: report.zonesConsidered,
    zonesAlreadyExported: report.zonesAlreadyExported.length,
    zonesExported: report.zonesExported.length,
    zonesSkipped: report.zonesSkipped.length,
    zonesFailed: report.zonesFailed.length,
    outputs: [reportPath],
  }, null, 2));
} finally {
  try {
    unlinkSync(defaultsPath);
  } catch {
    // Best-effort cleanup.
  }
}
