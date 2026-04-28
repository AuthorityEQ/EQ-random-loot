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

const corrections = [
  {
    from: "Sepentskin Eyepatch",
    to: "Serpentskin Eyepatch",
    source: "https://everquest.allakhazam.com/db/item.html?item=1858",
  },
  {
    from: "Mystical Claws of Jo Jo",
    to: "Mystical Claws of Jojo",
    source: "https://everquest.allakhazam.com/db/item.html?item=171",
  },
  {
    from: "Obsidian Scimatar",
    to: "Obsidian Scimitar",
    source: "https://everquest.allakhazam.com/db/item.html?item=275",
  },
  {
    from: "Golden Crescent Key",
    to: "Golden Crescent Key",
    source: "https://everquest.allakhazam.com/db/item.html?item=21248",
  },
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
    sources: [],
    confidence: "not_found",
  };
}

function markClean(item: ItemDetails, name: string, source: string) {
  item.name = name;
  item.sources = [{ name: "Allakhazam", url: source }];
  item.confidence = "exact_match";
  item.match_confidence = "exact_match";
  item.match_notes = [];
  item.missing_core_stats = false;
  item.duplicate_name_risk = false;
  item.parsing_warnings = [];
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
    const confidence = detail.match_confidence ?? detail.confidence;
    const url = detail.sources?.[0]?.url;
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
    for (const correction of corrections) {
      mob.loot = mob.loot.map((item) => item === correction.from ? correction.to : item);
    }
    mob.loot = uniqueSorted(mob.loot);
  }
}

dataset.buckets = dataset.buckets.map(rebuildBucket);

for (const correction of corrections) {
  const item = details[correction.from] ?? details[correction.to] ?? placeholderItem(correction.to);
  delete details[correction.from];
  markClean(item, correction.to, correction.source);
  details[correction.to] = item;
}

const allLootNames = uniqueSorted(dataset.buckets.flatMap((bucket) => bucket.loot_pool));
const output = `${JSON.stringify(dataset, null, 2)}\n`;
await writeFile(dataPath, output);
await writeFile(rootCopyPath, output);
await writeFile(itemNamesPath, `${JSON.stringify(allLootNames, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reviewPath, `${JSON.stringify(buildReview(details), null, 2)}\n`);

console.log(JSON.stringify({
  lootItems: allLootNames.length,
  itemDetails: Object.keys(details).length,
}, null, 2));
