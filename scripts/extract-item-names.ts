import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Bucket = {
  loot_pool: string[];
};

type Dataset = {
  buckets: Bucket[];
};

const root = process.cwd();
const allFlag = process.argv.includes("--all");

if (allFlag) {
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
