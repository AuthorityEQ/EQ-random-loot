import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const dataDir = resolve("data");
const lootAssetDir = resolve("public/real-spawn-loot-assets");
const itemAssetDir = resolve("public/real-spawn-item-assets");
const manifestPath = resolve("data/real-spawn-loot-assets.json");
const reportPath = resolve("data/real-spawn-loot-assets-report.json");

mkdirSync(lootAssetDir, { recursive: true });
mkdirSync(itemAssetDir, { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function zoneShortNameFromFile(fileName) {
  return fileName.replace(/^eqemu-/, "").replace(/-loot-test\.json$/, "");
}

function stripItem(item, itemDetailsById) {
  if (item?.itemId && item.itemDetails && !itemDetailsById.has(item.itemId)) {
    itemDetailsById.set(item.itemId, {
      itemId: item.itemId,
      itemName: item.itemName ?? `Item ${item.itemId}`,
      itemIcon: item.itemIcon ?? item.itemDetails?.icon ?? null,
      itemIconPath: item.itemIconPath ?? item.itemDetails?.iconPath ?? null,
      itemDetails: item.itemDetails,
    });
  }

  return {
    itemId: item.itemId,
    itemName: item.itemName ?? null,
    itemIcon: item.itemIcon ?? item.itemDetails?.icon ?? null,
    itemIconPath: item.itemIconPath ?? item.itemDetails?.iconPath ?? null,
    dropChance: item.dropChance ?? null,
    charges: item.charges ?? null,
    minLevel: item.minLevel ?? null,
    maxLevel: item.maxLevel ?? null,
    multiplier: item.multiplier ?? null,
  };
}

function stripLootData(data, itemDetailsById) {
  return {
    zoneShortName: data.zoneShortName,
    sourceKind: data.sourceKind,
    assetKind: "stripped-real-spawn-loot",
    mobs: (Array.isArray(data.mobs) ? data.mobs : []).map((mob) => ({
      npcTypeId: mob.npcTypeId,
      rawName: mob.rawName ?? null,
      displayName: mob.displayName,
      level: mob.level ?? null,
      raceId: mob.raceId ?? null,
      classId: mob.classId ?? null,
      loottableId: mob.loottableId ?? null,
      loottableName: mob.loottableName ?? null,
      lootdrops: (Array.isArray(mob.lootdrops) ? mob.lootdrops : []).map((lootdrop) => ({
        lootdropId: lootdrop.lootdropId,
        lootdropName: lootdrop.lootdropName ?? null,
        tableProbability: lootdrop.tableProbability ?? null,
        tableMultiplier: lootdrop.tableMultiplier ?? null,
        items: (Array.isArray(lootdrop.items) ? lootdrop.items : []).map((item) => stripItem(item, itemDetailsById)),
      })),
    })),
  };
}

const manifest = {};
const itemDetailsById = new Map();
const zoneReports = [];

for (const fileName of readdirSync(dataDir)) {
  if (!/^eqemu-.+-loot-test\.json$/.test(fileName)) continue;
  const sourcePath = join(dataDir, fileName);
  const zoneShortName = zoneShortNameFromFile(fileName);
  const sourceBytes = readFileSync(sourcePath).byteLength;
  const source = readJson(sourcePath);
  const stripped = stripLootData(source, itemDetailsById);
  const outputPath = join(lootAssetDir, `${zoneShortName}.json`);
  const output = `${JSON.stringify(stripped)}\n`;
  writeFileSync(outputPath, output);
  const outputBytes = Buffer.byteLength(output);
  manifest[zoneShortName] = {
    assetUrl: `/real-spawn-loot-assets/${zoneShortName}.json`,
    sourceFile: `data/${fileName}`,
    sourceBytes,
    strippedBytes: outputBytes,
  };
  zoneReports.push({
    zoneShortName,
    sourceFile: `data/${fileName}`,
    sourceBytes,
    strippedBytes: outputBytes,
    savedBytes: sourceBytes - outputBytes,
    mobCount: stripped.mobs.length,
  });
}

let itemAssetCount = 0;
for (const [itemId, item] of itemDetailsById.entries()) {
  const outputPath = join(itemAssetDir, `${itemId}.json`);
  if (!existsSync(outputPath)) itemAssetCount += 1;
  writeFileSync(outputPath, `${JSON.stringify(item)}\n`);
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  zoneCount: zoneReports.length,
  itemAssetCount: itemDetailsById.size,
  totalSourceBytes: zoneReports.reduce((sum, zone) => sum + zone.sourceBytes, 0),
  totalStrippedBytes: zoneReports.reduce((sum, zone) => sum + zone.strippedBytes, 0),
  totalSavedBytes: zoneReports.reduce((sum, zone) => sum + zone.savedBytes, 0),
  largestStrippedAssets: [...zoneReports].sort((a, b) => b.strippedBytes - a.strippedBytes).slice(0, 20),
  zones: zoneReports,
}, null, 2)}\n`);

console.log(`Generated ${zoneReports.length} stripped loot assets from ${basename(dataDir)}.`);
console.log(`Generated ${itemAssetCount} new item detail assets (${itemDetailsById.size} total item detail assets written).`);
