import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Mob = {
  name: string;
  level: number;
  zone: string;
  source_bucket: string;
  loot: string[];
};

type Bucket = {
  bucket: number;
  level_range: string;
  mobs: Mob[];
  loot_pool: string[];
  zones: string[];
  source_buckets_included: string[];
  mob_count: number;
  loot_count: number;
  zone_count: number;
};

type Dataset = {
  metadata: Record<string, string>;
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
  match_confidence?: string;
  match_notes?: string[];
  missing_core_stats?: boolean;
  duplicate_name_risk?: boolean;
  parsing_warnings?: string[];
};

type ReviewEntry = {
  item: string;
  reason: string;
  url?: string;
};

const root = process.cwd();
const dataPath = path.join(root, "data", "classic-group-named.json");
const rootCopyPath = path.join(root, "classic-group-named.json");
const itemNamesPath = path.join(root, "data", "item-names.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reviewPath = path.join(root, "data", "item-enrichment-review.json");

const removedItems = [
  "Pulsating Brood Clutch",
  "Armadillo hide",
  "Lens of Glowing Amber",
];

const renames = [
  {
    from: "Ball of Golem Clay",
    to: "Ball of Golem Clay [ID 14315]",
    source: "https://everquest.allakhazam.com/db/item.html?item=14315",
  },
  {
    from: "Rubicite Leggings",
    to: "Rubicite Greaves",
    source: "https://everquest.allakhazam.com/db/item.html?item=1329",
  },
  {
    from: "Loam Cloak",
    to: "Loam Encrusted Cloak",
    source: "https://everquest.allakhazam.com/db/item.html?item=2154",
  },
];

const cleanItems = [
  "Alligator Tooth Earring",
  "Gypsy Medallion",
  "Pair of Bent Spectacles",
  "Skull of Jhen'Tra",
  "Superb Lion Skin",
  "Wolf-Hide Sleeves",
  "Granite Earring",
  "Lion-Skin Leggings",
  "Scute Shield",
  "Small Bone Shield",
  "Superb Wolf Hide",
  "Crystal Ring",
  "Jambiya",
  "Thaumaturgist's Robe",
  "Giant Laceless Sandal",
  "Mroons Toy",
  "Crown of Leaves",
  "Bark Shield",
  "Ghoulbane",
  "Pearl Kedge Totem",
  "Shard of Golem Stone",
  "Double-Bladed Bone Axe",
  "Grizzleknot Bark",
  "Vial of Vampire Blood",
  "Grimy Lance",
  "Power of Fire",
  "Man-o-War",
  "Silver Wolf Totem",
  "Devlas Ilkvel",
  "Kicsh Der Pavz",
  "Tesch Val Sinisch",
  "Eye of Petrifin",
  "Syythrak Hide Vest",
  "Thick Amber Potion",
  "Blazing Wand",
  "Shield of Prexus",
  "Gloomwater Arrow",
  "Seahorse Scale Cloak",
  "Polished Mithril Mask",
  "Stonemelder's Band",
  ...renames.map((rename) => rename.to),
];

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function placeholderItem(name: string): ItemDetails {
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
    sources: [{ name: "Allakhazam", url: `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}` }],
    confidence: "not_found",
    match_confidence: "not_found",
    match_notes: ["Manual placeholder created during bucket correction; item details not enriched yet."],
    missing_core_stats: true,
    duplicate_name_risk: false,
    parsing_warnings: [],
  };
}

function markClean(item: ItemDetails, note = "Manually tagged clean.") {
  item.confidence = "exact_match";
  item.match_confidence = "exact_match";
  item.match_notes = [note];
  item.missing_core_stats = false;
  item.duplicate_name_risk = false;
  item.parsing_warnings = [];
}

function replaceLootName(loot: string[], from: string, to: string) {
  return loot.map((item) => item === from ? to : item);
}

function rebuildBucket(bucket: Bucket): Bucket {
  const lootPool = uniqueSorted(bucket.mobs.flatMap((mob) => mob.loot));
  const zones = uniqueSorted(bucket.mobs.map((mob) => mob.zone));
  return {
    ...bucket,
    loot_pool: lootPool,
    zones,
    mob_count: bucket.mobs.length,
    loot_count: lootPool.length,
    zone_count: zones.length,
  };
}

function buildReview(details: Record<string, ItemDetails>) {
  const review = {
    exact_match_clean: [] as ReviewEntry[],
    needs_review: [] as ReviewEntry[],
    not_found: [] as ReviewEntry[],
    missing_stats: [] as ReviewEntry[],
    duplicate_name_risk: [] as ReviewEntry[],
  };

  for (const [item, detail] of Object.entries(details).sort(([a], [b]) => a.localeCompare(b))) {
    const url = detail.sources?.[0]?.url;
    const confidence = detail.match_confidence ?? detail.confidence;
    const reason = detail.match_notes?.join(" ") || confidence;
    if (confidence === "exact_match" && !detail.missing_core_stats && !detail.duplicate_name_risk && (detail.parsing_warnings?.length ?? 0) === 0) {
      review.exact_match_clean.push({ item, reason: "Manual or parsed clean item.", url });
    }
    if (confidence === "needs_review" || detail.confidence === "needs_review") {
      review.needs_review.push({ item, reason, url });
    }
    if (confidence === "not_found") {
      review.not_found.push({ item, reason, url });
    }
    if (detail.missing_core_stats) {
      review.missing_stats.push({ item, reason: "Core item stats are missing.", url });
    }
    if (detail.duplicate_name_risk) {
      review.duplicate_name_risk.push({ item, reason, url });
    }
  }

  return review;
}

const dataset = JSON.parse(await readFile(dataPath, "utf8")) as Dataset;
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;

for (const bucket of dataset.buckets) {
  for (const mob of bucket.mobs) {
    mob.loot = mob.loot.filter((item) => !removedItems.includes(item));

    for (const rename of renames) {
      mob.loot = replaceLootName(mob.loot, rename.from, rename.to);
    }

    if (bucket.level_range === "21-25") {
      mob.loot = mob.loot.flatMap((item) => item === "Keys" ? ["Bloodstained Key", "Dull Bone Key"] : [item]);
    }

    if (bucket.level_range === "26-30") {
      mob.loot = mob.loot.flatMap((item) => item === "Keys" ? ["Golden Crescent Key"] : [item]);
    }

    mob.loot = uniqueSorted(mob.loot);
  }
}

dataset.buckets = dataset.buckets.map(rebuildBucket);

for (const removed of [...removedItems, "Keys"]) {
  delete details[removed];
}

for (const rename of renames) {
  const existing = details[rename.from] ?? placeholderItem(rename.to);
  delete details[rename.from];
  existing.name = rename.to;
  existing.sources = [{ name: "Allakhazam", url: rename.source }];
  details[rename.to] = existing;
  markClean(details[rename.to], `Manually renamed from "${rename.from}" and tagged clean.`);
}

for (const replacement of ["Bloodstained Key", "Dull Bone Key", "Golden Crescent Key"]) {
  details[replacement] ??= placeholderItem(replacement);
}

const missingCleanItems: string[] = [];
for (const itemName of cleanItems) {
  if (!details[itemName]) {
    missingCleanItems.push(itemName);
    details[itemName] = placeholderItem(itemName);
  }
  markClean(details[itemName]);
}

const allLootNames = uniqueSorted(dataset.buckets.flatMap((bucket) => bucket.loot_pool));
const datasetOutput = `${JSON.stringify(dataset, null, 2)}\n`;
await writeFile(dataPath, datasetOutput);
await writeFile(rootCopyPath, datasetOutput);
await writeFile(itemNamesPath, `${JSON.stringify(allLootNames, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reviewPath, `${JSON.stringify(buildReview(details), null, 2)}\n`);

console.log(JSON.stringify({
  buckets: dataset.buckets.length,
  lootItems: allLootNames.length,
  itemDetails: Object.keys(details).length,
  missingCleanItems,
}, null, 2));
