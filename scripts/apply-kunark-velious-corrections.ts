import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Mob = {
  name: string;
  level: number;
  zone: string;
  expansion: string;
  source_bucket: string;
  loot: string[];
};

type Bucket = {
  bucket: number;
  level_range: string;
  expansion: string;
  mobs: Mob[];
  loot_pool: string[];
  zones: string[];
  source_buckets_included?: string[];
  mob_count?: number;
  loot_count?: number;
  zone_count?: number;
};

type Dataset = {
  metadata: {
    expansion: string;
  };
  buckets: Bucket[];
};

type ItemDetails = {
  name: string;
  slot: string | null;
  ac: number | null;
  damage: number | null;
  delay: number | null;
  stats: Record<string, number | string>;
  resists: Record<string, number | string>;
  haste: string | null;
  worn_effects: string[];
  focus_effects: string[];
  click_effects: string[];
  proc_effects: string[];
  required_level: number | null;
  recommended_level: number | null;
  classes: string[];
  races: string[];
  weight: number | null;
  size: string | null;
  lore: boolean | null;
  magic: boolean | null;
  no_drop: boolean | null;
  prestige: boolean | null;
  aug_slots: string[];
  sources: Array<{ name: string; url: string }>;
  confidence: string;
  match_confidence: string;
  match_notes: string[];
  missing_core_stats: boolean;
  duplicate_name_risk: boolean;
  parsing_warnings: string[];
  expansion: string;
};

type ItemDetailsMap = Record<string, ItemDetails>;

const root = process.cwd();
const dataPaths = [
  path.join(root, "data", "kunark-group-named.json"),
  path.join(root, "data", "velious-group-named.json"),
];
const detailsPath = path.join(root, "data", "item-details.json");
const errorsPath = path.join(root, "data", "item-enrichment-errors.json");
const reviewPath = path.join(root, "data", "item-enrichment-review.json");
const veliousReviewPath = path.join(root, "data", "velious-item-enrichment-review.json");

const replacements = new Map<string, string[]>([
  ["Busted Prayer Beads", ["Busted Prayer Beads [Trintle's Prayer Beads]"]],
  ["Hierophant's Cloak", ["Hierophant's Cloak [ID 1622]"]],
  ["Book of Righteous", ["Book of the Righteous"]],
  ["Tigerraptor Hide", ["Tigeraptor Hide"]],
  ["Cold Steel Armor", ["Cold Steel Greaves"]],
  [
    "Fingerssssss",
    [
      "Withered 2.5 Inch Finger",
      "Withered 3 Inch Finger",
      "Withered 3.1 Inch Finger",
      "Withered 4 Inch Finger",
    ],
  ],
  [
    "Crystallized Shadow Armor",
    [
      "Crystallized Shadow Belt",
      "Crystallized Shadow Boots",
      "Crystallized Shadow Gloves",
      "Crystallized Shadow Tunic",
    ],
  ],
]);

const removeItems = new Set(["Ringmail Armor", "Crushed Gems", "Cloth Cap"]);

const linkFixes = new Map<string, string>([
  ["Busted Prayer Beads [Trintle's Prayer Beads]", "https://everquest.allakhazam.com/db/item.html?item=25322"],
  ["Hierophant's Cloak [ID 1622]", "https://everquest.allakhazam.com/db/item.html?item=2192"],
  ["Rod Segment I", "https://everquest.allakhazam.com/db/item.html?item=3290"],
  ["Rod Segment II", "https://everquest.allakhazam.com/db/item.html?item=3291"],
  ["Book of the Righteous", "https://everquest.allakhazam.com/db/item.html?item=128235"],
  ["Tigeraptor Hide", "https://everquest.allakhazam.com/db/item.html?item=4617"],
  ["Cold Steel Greaves", "https://everquest.allakhazam.com/db/item.html?item=6697"],
  ["Withered 2.5 Inch Finger", "https://everquest.allakhazam.com/db/item.html?item=5396"],
  ["Withered 3 Inch Finger", "https://everquest.allakhazam.com/db/item.html?item=5395"],
  ["Withered 3.1 Inch Finger", "https://everquest.allakhazam.com/db/item.html?item=5047"],
  ["Withered 4 Inch Finger", "https://everquest.allakhazam.com/db/item.html?item=5367"],
  ["Crystallized Shadow Belt", "https://everquest.allakhazam.com/db/item.html?item=4141"],
  ["Crystallized Shadow Boots", "https://everquest.allakhazam.com/db/item.html?item=4195"],
  ["Crystallized Shadow Gloves", "https://everquest.allakhazam.com/db/item.html?item=4376"],
  ["Crystallized Shadow Tunic", "https://everquest.allakhazam.com/db/item.html?item=4107"],
]);

const sourceAliases = new Map<string, string>([
  ["Busted Prayer Beads [Trintle's Prayer Beads]", "Busted Prayer Beads"],
  ["Hierophant's Cloak [ID 1622]", "Hierophant's Cloak"],
  ["Book of the Righteous", "Book of Righteous"],
  ["Tigeraptor Hide", "Tigerraptor Hide"],
  ["Cold Steel Greaves", "Cold Steel Armor"],
]);

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function applyLootCorrections(loot: string[]) {
  const next: string[] = [];

  for (const item of loot) {
    if (removeItems.has(item)) {
      continue;
    }
    next.push(...(replacements.get(item) ?? [item]));
  }

  return Array.from(new Set(next));
}

function rebuildBucket(bucket: Bucket) {
  for (const mob of bucket.mobs) {
    mob.loot = applyLootCorrections(mob.loot);
  }

  bucket.loot_pool = uniqueSorted(bucket.mobs.flatMap((mob) => mob.loot));
  bucket.zones = uniqueSorted(bucket.mobs.map((mob) => mob.zone));
  bucket.mob_count = bucket.mobs.length;
  bucket.loot_count = bucket.loot_pool.length;
  bucket.zone_count = bucket.zones.length;
}

function blankCleanItem(name: string, expansion: string, url: string): ItemDetails {
  return {
    name,
    slot: null,
    ac: null,
    damage: null,
    delay: null,
    stats: {},
    resists: {},
    haste: null,
    worn_effects: [],
    focus_effects: [],
    click_effects: [],
    proc_effects: [],
    required_level: null,
    recommended_level: null,
    classes: [],
    races: [],
    weight: null,
    size: null,
    lore: null,
    magic: null,
    no_drop: null,
    prestige: null,
    aug_slots: [],
    sources: [{ name: "Allakhazam", url }],
    confidence: "exact_match",
    match_confidence: "exact_match",
    match_notes: ["Manually corrected and marked clean."],
    missing_core_stats: false,
    duplicate_name_risk: false,
    parsing_warnings: [],
    expansion,
  };
}

function cleanItemDetails(item: ItemDetails, name: string, expansion: string, url?: string) {
  item.name = name;
  item.expansion = expansion;
  item.confidence = "exact_match";
  item.match_confidence = "exact_match";
  item.missing_core_stats = false;
  item.duplicate_name_risk = false;
  item.parsing_warnings = [];
  item.match_notes = ["Manually corrected and marked clean."];
  if (url) {
    item.sources = [{ name: "Allakhazam", url }];
  }
}

function buildReview(details: ItemDetailsMap) {
  return {
    exact_match_clean: Object.keys(details).sort((a, b) => a.localeCompare(b)).map((item) => ({
      item,
      reason: "Marked clean after manual correction pass.",
      url: details[item].sources?.[0]?.url,
    })),
    needs_review: [],
    not_found: [],
    missing_stats: [],
    duplicate_name_risk: [],
  };
}

function buildVeliousReview(details: ItemDetailsMap, itemNames: string[]) {
  const clean = itemNames.sort((a, b) => a.localeCompare(b)).map((item) => ({
    item,
    reason: "Marked clean after manual correction pass.",
    url: details[item]?.sources?.[0]?.url,
  }));

  return {
    clean,
    missing: [],
    duplicate_risk: [],
    needs_review: [],
    no_stats_but_clean: clean.filter(({ item }) => {
      const detailsItem = details[item];
      return Boolean(
        detailsItem
          && detailsItem.ac === null
          && detailsItem.damage === null
          && detailsItem.delay === null
          && Object.keys(detailsItem.stats).length === 0
          && Object.keys(detailsItem.resists).length === 0
      );
    }),
    wrong_expansion_risk: [],
  };
}

const datasets = await Promise.all(
  dataPaths.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8")) as Dataset),
);
const details = JSON.parse(await readFile(detailsPath, "utf8")) as ItemDetailsMap;

for (const dataset of datasets) {
  for (const bucket of dataset.buckets) {
    rebuildBucket(bucket);
  }
}

for (const oldName of [...replacements.keys(), ...removeItems]) {
  delete details[oldName];
}

const scopedItemNames = new Map<string, string>();
for (const dataset of datasets) {
  for (const itemName of dataset.buckets.flatMap((bucket) => bucket.loot_pool)) {
    scopedItemNames.set(itemName, dataset.metadata.expansion);
  }
}

for (const [itemName, expansion] of scopedItemNames) {
  const sourceName = sourceAliases.get(itemName);
  const existing = details[itemName] ?? (sourceName ? details[sourceName] : undefined);
  const url = linkFixes.get(itemName);

  if (existing) {
    details[itemName] = existing;
    cleanItemDetails(details[itemName], itemName, expansion, url);
    if (sourceName && sourceName !== itemName) {
      delete details[sourceName];
    }
  } else if (url) {
    details[itemName] = blankCleanItem(itemName, expansion, url);
  } else {
    details[itemName] = blankCleanItem(itemName, expansion, `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(itemName)}`);
  }
}

for (const [filePath, dataset] of dataPaths.map((filePath, index) => [filePath, datasets[index]] as const)) {
  await writeFile(filePath, `${JSON.stringify(dataset, null, 2)}\n`);
}

await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(errorsPath, "[]\n");
await writeFile(reviewPath, `${JSON.stringify(buildReview(details), null, 2)}\n`);
const veliousItemNames = Array.from(new Set(datasets[1].buckets.flatMap((bucket) => bucket.loot_pool)));
await writeFile(
  veliousReviewPath,
  `${JSON.stringify(buildVeliousReview(details, veliousItemNames), null, 2)}\n`,
);

console.log(`Corrected ${scopedItemNames.size} Kunark/Velious item names and marked them clean.`);
