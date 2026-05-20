import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const defaultServerRoot = "C:/eqserver/eqemu server";
const defaultConfigPath = `${defaultServerRoot}/eqemu_config.json`;
const defaultMysqlPath = "C:/Program Files/MariaDB 10.11/bin/mysql.exe";
const zoneShortName = process.argv[2] ?? "cazicthule";
const configPath = resolve(process.argv[3] ?? defaultConfigPath);
const mysqlPath = process.argv[4] ?? defaultMysqlPath;

const rawOutputPath = resolve(`data/eqemu-${zoneShortName}-loot-test.json`);
const reportOutputPath = resolve("data/eqemu-loot-investigation-report.json");
const dropItemReportOutputPath = resolve("data/eqemu-drop-item-report.json");
const itemIconReportOutputPath = resolve("data/eqemu-item-icon-report.json");
const itemDetailsPath = resolve("data/item-details.json");
const suppressionConfigPath = resolve("data/real-spawn-npc-suppressions.json");

const inspectedTables = [
  "npc_types",
  "loottable",
  "loottable_entries",
  "lootdrop",
  "lootdrop_entries",
  "items",
];

function assertSafeZoneShortName(value) {
  if (!/^[a-z0-9_]+$/i.test(value)) {
    throw new Error(`Unsafe zone shortname "${value}".`);
  }
}

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
  const path = resolve(tmpdir(), `frostreaver-eqemu-loot-${process.pid}-${Date.now()}.cnf`);
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

function sqlString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function numberOrNull(value) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function eqemuIconPath(iconId) {
  return typeof iconId === "number" && iconId > 0
    ? `https://wiki.project1999.com/images/Item_${iconId}.png`
    : null;
}

function hasExistingIcon(details) {
  return Boolean(details?.iconPath || details?.icon_url || details?.icon);
}

function displayMobName(rawName) {
  const cleaned = (rawName || "Unknown")
    .replace(/^#+/, "")
    .replace(/\d+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeSuppressionName(value) {
  return displayMobName(value).toLowerCase();
}

const npcSuppressionConfig = readJson(suppressionConfigPath, { globalNpcSuppressions: [] });
const suppressedNpcNames = new Set((npcSuppressionConfig.globalNpcSuppressions ?? []).map(normalizeSuppressionName));

function isSuppressedNpcName(value) {
  return suppressedNpcNames.has(normalizeSuppressionName(value));
}

function groupByMob(rows) {
  const mobs = new Map();
  const unresolvedLootReferences = [];

  for (const row of rows) {
    if (isSuppressedNpcName(row.npc_name)) continue;
    const npcTypeId = numberOrNull(row.npc_type_id);
    if (npcTypeId === null) continue;
    const mob = mobs.get(npcTypeId) ?? {
      npcTypeId,
      rawName: row.npc_name,
      displayName: displayMobName(row.npc_name),
      level: numberOrNull(row.level),
      raceId: numberOrNull(row.race),
      classId: numberOrNull(row.class),
      loottableId: numberOrNull(row.loottable_id),
      loottableName: row.loottable_name,
      lootdrops: new Map(),
    };

    const lootdropId = numberOrNull(row.lootdrop_id);
    if (lootdropId !== null) {
      const lootdrop = mob.lootdrops.get(lootdropId) ?? {
        lootdropId,
        lootdropName: row.lootdrop_name,
        tableProbability: numberOrNull(row.table_probability),
        tableMultiplier: numberOrNull(row.table_multiplier),
        items: [],
      };
      const itemId = numberOrNull(row.item_id);
      if (itemId !== null) {
        lootdrop.items.push({
          itemId,
          itemName: row.item_name,
          itemIcon: numberOrNull(row.icon),
          itemIconPath: eqemuIconPath(numberOrNull(row.icon)),
          itemDetails: {
            id: itemId,
            name: row.item_name,
            icon: numberOrNull(row.icon),
            iconPath: eqemuIconPath(numberOrNull(row.icon)),
            slots: numberOrNull(row.slots),
            classes: numberOrNull(row.classes),
            races: numberOrNull(row.races),
            ac: numberOrNull(row.ac),
            damage: numberOrNull(row.damage),
            delay: numberOrNull(row.delay),
            itemtype: numberOrNull(row.itemtype),
            itemclass: numberOrNull(row.itemclass),
            weight: numberOrNull(row.weight),
            size: numberOrNull(row.size),
            stackable: numberOrNull(row.stackable),
            stacksize: numberOrNull(row.stacksize),
            lore: row.lore,
            loregroup: numberOrNull(row.loregroup),
            magic: numberOrNull(row.magic),
            nodrop: numberOrNull(row.nodrop),
            norent: numberOrNull(row.norent),
            reqlevel: numberOrNull(row.reqlevel),
            reclevel: numberOrNull(row.reclevel),
            maxcharges: numberOrNull(row.maxcharges),
            stats: {
              STR: numberOrNull(row.astr),
              STA: numberOrNull(row.asta),
              DEX: numberOrNull(row.adex),
              AGI: numberOrNull(row.aagi),
              INT: numberOrNull(row.aint),
              WIS: numberOrNull(row.awis),
              CHA: numberOrNull(row.acha),
              HP: numberOrNull(row.hp),
              MANA: numberOrNull(row.mana),
              END: numberOrNull(row.endur),
            },
            resists: {
              MR: numberOrNull(row.mr),
              FR: numberOrNull(row.fr),
              CR: numberOrNull(row.cr),
              DR: numberOrNull(row.dr),
              PR: numberOrNull(row.pr),
              CORRUPTION: numberOrNull(row.svcorruption),
            },
            regen: numberOrNull(row.regen),
            manaregen: numberOrNull(row.manaregen),
            enduranceregen: numberOrNull(row.enduranceregen),
            attack: numberOrNull(row.attack),
            accuracy: numberOrNull(row.accuracy),
            avoidance: numberOrNull(row.avoidance),
            haste: numberOrNull(row.haste),
            effects: {
              click: numberOrNull(row.clickeffect),
              proc: numberOrNull(row.proceffect),
              worn: numberOrNull(row.worneffect),
              focus: numberOrNull(row.focuseffect),
              scroll: numberOrNull(row.scrolleffect),
            },
          },
          dropChance: numberOrNull(row.drop_chance),
          charges: numberOrNull(row.item_charges),
          minLevel: numberOrNull(row.minlevel),
          maxLevel: numberOrNull(row.maxlevel),
          multiplier: numberOrNull(row.drop_multiplier),
        });
      } else {
        unresolvedLootReferences.push({
          npcTypeId,
          mobName: row.npc_name,
          loottableId: numberOrNull(row.loottable_id),
          lootdropId,
          reason: "Lootdrop joined but no item row was resolved.",
        });
      }
      mob.lootdrops.set(lootdropId, lootdrop);
    }

    mobs.set(npcTypeId, mob);
  }

  return {
    mobs: [...mobs.values()].map((mob) => ({
      ...mob,
      lootdrops: [...mob.lootdrops.values()].map((lootdrop) => ({
        ...lootdrop,
        items: lootdrop.items.sort((a, b) => (b.dropChance ?? -1) - (a.dropChance ?? -1) || String(a.itemName).localeCompare(String(b.itemName))),
      })),
    })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    unresolvedLootReferences,
  };
}

function columnSet(report, tableName) {
  return new Set((report.tablesFound[tableName]?.columns ?? []).map((column) => column.field));
}

function selectColumn(columns, alias, columnName, outputName) {
  return columns.has(columnName)
    ? `${alias}.\`${columnName}\` AS ${outputName}`
    : `NULL AS ${outputName}`;
}

function loadExistingItemDetails() {
  try {
    return JSON.parse(readFileSync(itemDetailsPath, "utf8"));
  } catch {
    return {};
  }
}

function main() {
  assertSafeZoneShortName(zoneShortName);
  const database = readConfig(configPath);
  const defaultsPath = writeTempDefaultsFile(database);
  const report = {
    source: "Local EQEmu/PEQ database",
    zoneShortName,
    configPath,
    mysqlPath,
    credentialsCommitted: false,
    credentialsHandling: "Credentials were read from local EQEmu config and passed through a temporary mysql defaults file that is deleted after export.",
    tablesFound: {},
    joinsUsed: [
      "spawn2.zone -> spawnentry.spawngroupID -> npc_types.id",
      "npc_types.loottable_id -> loottable.id",
      "loottable.id -> loottable_entries.loottable_id",
      "loottable_entries.lootdrop_id -> lootdrop.id",
      "lootdrop.id -> lootdrop_entries.lootdrop_id",
      "lootdrop_entries.item_id -> items.id",
    ],
    caveats: [
      "Loot rows are possible drops from EQEmu loot tables, not observed live drops.",
      "Loot table probability and lootdrop entry chance are preserved separately; exact final drop odds may depend on EQEmu server rules.",
      "This is a one-zone prototype export and is not merged into Zone Snapshot data.",
    ],
    unresolvedLootReferences: [],
    suppressedNpcConfig: {
      sourceFile: suppressionConfigPath,
      globalNpcSuppressions: [...suppressedNpcNames],
    },
  };

  try {
    const tableRows = parseTsv(runMysql(defaultsPath, `SHOW TABLES WHERE Tables_in_${database.database} IN (${inspectedTables.map(sqlString).join(",")});`));
    const foundTableNames = new Set(tableRows.flatMap((row) => Object.values(row)));
    for (const tableName of inspectedTables) {
      report.tablesFound[tableName] = { found: foundTableNames.has(tableName) };
      if (foundTableNames.has(tableName)) {
        report.tablesFound[tableName].columns = parseTsv(runMysql(defaultsPath, `SHOW COLUMNS FROM \`${tableName}\`;`)).map((row) => ({
          field: row.Field,
          type: row.Type,
          null: row.Null,
          key: row.Key,
          default: row.Default,
        }));
      }
    }

    const missingRequired = inspectedTables.filter((tableName) => !foundTableNames.has(tableName));
    if (missingRequired.length) {
      report.caveats.push(`Missing expected loot tables: ${missingRequired.join(", ")}.`);
    }

    const loottableEntryColumns = columnSet(report, "loottable_entries");
    const lootdropEntryColumns = columnSet(report, "lootdrop_entries");
    const itemColumns = columnSet(report, "items");

    const itemDetailFields = [
      "id", "Name", "icon", "slots", "classes", "races", "ac", "damage", "delay", "itemtype", "itemclass",
      "weight", "size", "stackable", "stacksize", "lore", "loregroup", "magic", "nodrop", "norent",
      "reqlevel", "reclevel", "maxcharges", "astr", "asta", "adex", "aagi", "aint", "awis", "acha",
      "hp", "mana", "endur", "mr", "fr", "cr", "dr", "pr", "svcorruption", "regen", "manaregen",
      "enduranceregen", "attack", "accuracy", "avoidance", "haste", "clickeffect", "proceffect",
      "worneffect", "focuseffect", "scrolleffect",
    ];
    const itemFieldSelect = itemDetailFields.map((field) => selectColumn(itemColumns, "i", field, field)).join(",\n  ");

    const lootSql = `
SELECT DISTINCT
  nt.id AS npc_type_id,
  nt.name AS npc_name,
  nt.level,
  nt.race,
  nt.class,
  nt.loottable_id,
  lt.name AS loottable_name,
  ${selectColumn(loottableEntryColumns, "lte", "lootdrop_id", "lootdrop_id")},
  ${selectColumn(loottableEntryColumns, "lte", "multiplier", "table_multiplier")},
  ${selectColumn(loottableEntryColumns, "lte", "probability", "table_probability")},
  ld.name AS lootdrop_name,
  ${selectColumn(lootdropEntryColumns, "lde", "item_id", "item_id")},
  ${selectColumn(lootdropEntryColumns, "lde", "item_charges", "item_charges")},
  ${selectColumn(lootdropEntryColumns, "lde", "chance", "drop_chance")},
  ${selectColumn(lootdropEntryColumns, "lde", "minlevel", "minlevel")},
  ${selectColumn(lootdropEntryColumns, "lde", "maxlevel", "maxlevel")},
  ${selectColumn(lootdropEntryColumns, "lde", "multiplier", "drop_multiplier")},
  ${selectColumn(itemColumns, "i", "Name", "item_name")},
  ${selectColumn(itemColumns, "i", "icon", "icon")},
  ${itemFieldSelect}
FROM spawn2 s
LEFT JOIN spawnentry se ON se.spawngroupID = s.spawngroupID
LEFT JOIN npc_types nt ON nt.id = se.npcID
LEFT JOIN loottable lt ON lt.id = nt.loottable_id
LEFT JOIN loottable_entries lte ON lte.loottable_id = nt.loottable_id
LEFT JOIN lootdrop ld ON ld.id = lte.lootdrop_id
LEFT JOIN lootdrop_entries lde ON lde.lootdrop_id = ld.id
LEFT JOIN items i ON i.id = lde.item_id
WHERE s.zone = ${sqlString(zoneShortName)}
ORDER BY nt.name, lte.lootdrop_id, lde.chance DESC, i.Name;`;

    const rows = parseTsv(runMysql(defaultsPath, lootSql));
    const grouped = groupByMob(rows);
    const mobsWithLootTables = grouped.mobs.filter((mob) => mob.loottableId && mob.loottableId !== 0).length;
    const mobsWithResolvedDrops = grouped.mobs.filter((mob) => mob.lootdrops.some((lootdrop) => lootdrop.items.length > 0)).length;
    const resolvedItems = grouped.mobs.reduce((sum, mob) => sum + mob.lootdrops.reduce((inner, lootdrop) => inner + lootdrop.items.length, 0), 0);
    const existingItemDetails = loadExistingItemDetails();
    const uniqueDrops = new Map();
    for (const mob of grouped.mobs) {
      for (const lootdrop of mob.lootdrops) {
        for (const item of lootdrop.items) {
          uniqueDrops.set(item.itemId, item);
        }
      }
    }
    const matchedExisting = [];
    const onlyEqemu = [];
    const missingDetails = [];
    const iconResolvedItems = [];
    const iconMissingItems = [];
    const iconFallbackItems = [];
    const existingIconItems = [];
    for (const item of uniqueDrops.values()) {
      const existing = item.itemName ? existingItemDetails[item.itemName] : null;
      const eqemuIcon = eqemuIconPath(item.itemDetails?.icon ?? item.itemIcon);
      if (!item.itemName) {
        missingDetails.push({ itemId: item.itemId, reason: "Missing item name." });
      } else if (existing) {
        matchedExisting.push({ itemId: item.itemId, itemName: item.itemName });
      } else {
        onlyEqemu.push({ itemId: item.itemId, itemName: item.itemName });
      }

      if (existing && hasExistingIcon(existing)) {
        existingIconItems.push({
          itemId: item.itemId,
          itemName: item.itemName,
          iconPath: existing.iconPath ?? existing.icon_url ?? existing.icon,
          source: "existing item detail record",
        });
        iconResolvedItems.push({ itemId: item.itemId, itemName: item.itemName, iconPath: existing.iconPath ?? existing.icon_url ?? existing.icon, source: "existing" });
      } else if (eqemuIcon) {
        iconFallbackItems.push({
          itemId: item.itemId,
          itemName: item.itemName,
          iconId: item.itemDetails?.icon ?? item.itemIcon,
          iconPath: eqemuIcon,
          source: existing ? "EQEmu fallback for existing item without icon" : "EQEmu items.icon",
        });
        iconResolvedItems.push({ itemId: item.itemId, itemName: item.itemName, iconPath: eqemuIcon, source: "eqemu" });
      } else {
        iconMissingItems.push({
          itemId: item.itemId,
          itemName: item.itemName ?? null,
          reason: "No existing icon and no positive EQEmu items.icon value.",
        });
      }
    }

    report.totalZoneRows = rows.length;
    report.possibleMobCount = grouped.mobs.length;
    report.mobsWithLootTables = mobsWithLootTables;
    report.mobsWithResolvedDrops = mobsWithResolvedDrops;
    report.resolvedItems = resolvedItems;
    report.unresolvedLootReferences = grouped.unresolvedLootReferences;
    report.outputFiles = {
      raw: rawOutputPath,
      report: reportOutputPath,
      dropItemReport: dropItemReportOutputPath,
      itemIconReport: itemIconReportOutputPath,
    };

    mkdirSync(dirname(rawOutputPath), { recursive: true });
    writeFileSync(rawOutputPath, `${JSON.stringify({
      zoneShortName,
      sourceKind: "Local EQEmu/PEQ loot table export",
      mobs: grouped.mobs,
    }, null, 2)}\n`);
    writeFileSync(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(dropItemReportOutputPath, `${JSON.stringify({
      source: "Local EQEmu/PEQ items table joined from zone loot drops",
      zoneShortName,
      mobsWithResolvedDrops,
      uniqueDroppedItems: uniqueDrops.size,
      dropsWithResolvedItemDetails: uniqueDrops.size - missingDetails.length,
      dropsMissingItemDetails: missingDetails,
      itemsMatchedToExistingItemDetails: matchedExisting,
      itemsOnlyAvailableFromEqemuDb: onlyEqemu,
      fieldsExported: itemDetailFields,
      notes: [
        "Existing item detail records are preferred by the UI when names match.",
        "EQEmu item details are used as a fallback for dropped items without existing imported details.",
      ],
    }, null, 2)}\n`);
    writeFileSync(itemIconReportOutputPath, `${JSON.stringify({
      source: "Local EQEmu/PEQ items.icon field with existing site item icons preferred",
      zoneShortName,
      uniqueDroppedItems: uniqueDrops.size,
      resolvedIconCount: iconResolvedItems.length,
      existingIconCount: existingIconItems.length,
      eqemuFallbackIconCount: iconFallbackItems.length,
      missingIconCount: iconMissingItems.length,
      resolvedIcons: iconResolvedItems,
      existingIcons: existingIconItems,
      eqemuFallbackIcons: iconFallbackItems,
      missingIcons: iconMissingItems,
      iconPathTemplate: "https://wiki.project1999.com/images/Item_{icon}.png",
      notes: [
        "Existing imported item icons are preferred when present.",
        "EQEmu items.icon is mapped into the same iconPath field consumed by EqItemInspect.",
        "Missing icons should render the existing EQ-style placeholder instead of a broken image.",
      ],
    }, null, 2)}\n`);

    console.log(JSON.stringify({
      ok: true,
      zoneShortName,
      possibleMobCount: grouped.mobs.length,
      mobsWithLootTables,
      mobsWithResolvedDrops,
      resolvedItems,
      outputs: [rawOutputPath, reportOutputPath, dropItemReportOutputPath, itemIconReportOutputPath],
    }, null, 2));
  } finally {
    try {
      unlinkSync(defaultsPath);
    } catch {
      // Best-effort cleanup; the file only contains local credentials from the user's machine.
    }
  }
}

main();
