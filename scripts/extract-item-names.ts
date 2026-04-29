import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Bucket = {
  loot_pool: string[];
};

type Dataset = {
  buckets: Bucket[];
};

type RaidBoss = {
  name: string;
  loot_pool?: string[];
};

type RaidTier = {
  bosses: RaidBoss[];
};

type RaidDataset = {
  expansion: string;
  tiers: RaidTier[];
};

const root = process.cwd();
const allFlag = process.argv.includes("--all");
const raidFlag = process.argv.includes("--raid");

if (raidFlag) {
  // Emit the sorted union of raid loot pool item names across all 3 expansions.
  const [classic, kunark, velious] = await Promise.all([
    readFile(path.join(root, "data", "classic-raid.json"), "utf8").then((raw) => JSON.parse(raw) as RaidDataset),
    readFile(path.join(root, "data", "kunark-raid.json"), "utf8").then((raw) => JSON.parse(raw) as RaidDataset),
    readFile(path.join(root, "data", "velious-raid.json"), "utf8").then((raw) => JSON.parse(raw) as RaidDataset),
  ]);

  const raidItemNames = Array.from(
    new Set(
      [classic, kunark, velious]
        .flatMap((dataset) => dataset.tiers.flatMap((tier) => tier.bosses.flatMap((boss) => boss.loot_pool ?? [])))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const outputPath = path.join(root, "data", "raid-item-names.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(raidItemNames, null, 2)}\n`);
  console.log(`Wrote ${raidItemNames.length} unique raid item names (Classic + Kunark + Velious) to ${outputPath}`);
} else if (allFlag) {
  // Emit the sorted union of Classic + Kunark + Velious item names.
  const [classic, kunark, velious] = await Promise.all([
    readFile(path.join(root, "data", "classic-group-named.json"), "utf8").then((raw) => JSON.parse(raw) as Dataset),
    readFile(path.join(root, "data", "kunark-group-named.json"), "utf8").then((raw) => JSON.parse(raw) as Dataset),
    readFile(path.join(root, "data", "velious-group-named.json"), "utf8").then((raw) => JSON.parse(raw) as Dataset),
  ]);

  const allItemNames = Array.from(
    new Set(
      [classic, kunark, velious]
        .flatMap((dataset) => dataset.buckets.flatMap((bucket) => bucket.loot_pool.map((item) => item.trim())))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const outputPath = path.join(root, "data", "all-item-names.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(allItemNames, null, 2)}\n`);
  console.log(`Wrote ${allItemNames.length} unique item names (Classic + Kunark + Velious) to ${outputPath}`);
} else {
  // Default: Classic only, output to item-names.json.
  const inputPath = path.join(root, "data", "classic-group-named.json");
  const outputPath = path.join(root, "data", "item-names.json");

  const raw = await readFile(inputPath, "utf8");
  const dataset = JSON.parse(raw) as Dataset;

  const itemNames = Array.from(
    new Set(dataset.buckets.flatMap((bucket) => bucket.loot_pool.map((item) => item.trim()))),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(itemNames, null, 2)}\n`);
  console.log(`Wrote ${itemNames.length} unique item names to ${outputPath}`);
}
