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

type CraftingComponent = {
  name: string;
  count: number;
};

type CraftingRecipe = {
  output: { name: string; count: number };
  components: CraftingComponent[];
};

type CraftingDataset = {
  recipes: CraftingRecipe[];
};

type EpicStep = {
  items: string;
};

type EpicClass = {
  class_name: string;
  weapon_name: string;
  steps: EpicStep[];
};

type EpicDataset = {
  classes: EpicClass[];
};

const EPIC_VERB_PREFIX = /^(Receive|Hand in|Give|Loot|Buy|Combine|Turn in|Reward):\s*/i;
const EPIC_TRAILING_PAREN = /\s*\([^)]*\)\s*$/;
const EPIC_STOP_WORDS = new Set(["the player", "this step", "unknown", "tba", "tbd"]);
const CRAFTING_PSEUDO_CATEGORY = /\([^)]*,[^)]*\)/;

function parseCraftingItemNames(dataset: CraftingDataset): string[] {
  const names = new Set<string>();
  for (const recipe of dataset.recipes) {
    names.add(recipe.output.name);
    for (const component of recipe.components) {
      names.add(component.name);
    }
  }
  return Array.from(names)
    .filter((name) => !CRAFTING_PSEUDO_CATEGORY.test(name))
    .sort((a, b) => a.localeCompare(b));
}

function parseEpicItemNames(dataset: EpicDataset): string[] {
  const names = new Set<string>();
  for (const cls of dataset.classes) {
    for (const step of cls.steps) {
      const raw = (step.items ?? "").trim();
      if (!raw) continue;
      const stripped = raw.replace(EPIC_VERB_PREFIX, "").replace(EPIC_TRAILING_PAREN, "");
      const fragments = stripped.split(/ and | & |, /);
      for (const fragment of fragments) {
        const trimmed = fragment.trim();
        if (trimmed.length < 3) continue;
        if (/^[a-z]/.test(trimmed)) continue;
        if (EPIC_STOP_WORDS.has(trimmed.toLowerCase())) continue;
        names.add(trimmed);
      }
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

const root = process.cwd();
const allFlag = process.argv.includes("--all");
const raidFlag = process.argv.includes("--raid");
const craftingFlag = process.argv.includes("--crafting");
const epicsFlag = process.argv.includes("--epics");

if (craftingFlag) {
  const datasetPath = path.join(root, "data", "excel-imports", "crafting-normalized.json");
  const dataset = JSON.parse(await readFile(datasetPath, "utf8")) as CraftingDataset;
  const craftingItemNames = parseCraftingItemNames(dataset);
  const outputPath = path.join(root, "data", "crafting-item-names.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(craftingItemNames, null, 2)}\n`);
  console.log(`Wrote ${craftingItemNames.length} unique crafting item names to ${outputPath}`);
} else if (epicsFlag) {
  const datasetPath = path.join(root, "data", "excel-imports", "epic-quests.json");
  const dataset = JSON.parse(await readFile(datasetPath, "utf8")) as EpicDataset;
  const epicItemNames = parseEpicItemNames(dataset);
  const outputPath = path.join(root, "data", "epic-item-names.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(epicItemNames, null, 2)}\n`);
  console.log(`Wrote ${epicItemNames.length} unique epic item names to ${outputPath}`);
} else if (raidFlag) {
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
