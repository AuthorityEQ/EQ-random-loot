import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Bucket = {
  loot_pool: string[];
};

type Dataset = {
  buckets: Bucket[];
};

const root = process.cwd();
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
