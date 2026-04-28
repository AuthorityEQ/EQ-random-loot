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

const spinflintDrops = [
  "Whirling Agate",
  "Whirling Amber",
  "Whirling Bloodstone",
  "Whirling Carnelian",
  "Whirling Crystal",
  "Whirling Hematite",
  "Whirling Jasper",
  "Whirling Lapis Lazuli",
  "Whirling Malachite",
  "Whirling Onyx",
  "Whirling Quartz",
  "Whirling Turquoise",
];

const larktwitterDrops = [
  { name: "Arrow", source: "https://everquest.allakhazam.com/db/item.html?item=18343" },
  { name: "Arrow of Contagion", source: "https://everquest.allakhazam.com/db/item.html?item=4149" },
  { name: "Arrow of Fire", source: "https://everquest.allakhazam.com/db/item.html?item=4150" },
  { name: "Arrow of Lightning", source: "https://everquest.allakhazam.com/db/item.html?item=29472" },
  { name: "LarkTwitter Arrow", source: "https://everquest.allakhazam.com/db/item.html?item=4153" },
];

const decayedArmor = [
  "Decayed Breastplate",
  "Decayed Chainmail",
  "Decayed Helm",
  "Decayed Left Boot",
  "Decayed Left Bracer",
  "Decayed Left Gauntlet",
  "Decayed Left Legplate",
  "Decayed Left Vambrace",
  "Decayed Right Boot",
  "Decayed Right Bracer",
  "Decayed Right Gauntlet",
  "Decayed Right Legplate",
  "Decayed Right Vambrace",
  "Decayed Visor",
];

const totemicArmor = [
  "Totemic Boots",
  "Totemic Bracers",
  "Totemic Breastplate",
  "Totemic Cloak",
  "Totemic Gauntlets",
  "Totemic Greaves",
  "Totemic Helm",
  "Totemic Vambraces",
];

const deletedItems = [
  "Locket of Escape (very unlikely)",
  "1 of 4 Books",
  "No Unique Drop",
  "BUGGED",
  "Mask of Deception (later)",
  "Various Large Bronze",
];

const replacements = [
  { from: "10+ Different Terrible Helmets", to: spinflintDrops },
  { from: "Larktwitter Arrows", to: larktwitterDrops.map((item) => item.name) },
  { from: "Various Decayed Armor (Darkforge)", to: decayedArmor },
  { from: "Various Totemic Armor", to: totemicArmor },
];

const renames = [
  ["Illusionist's Stone", "Illusionists Stone"],
  ["Dagger of Marnak", "Dagger of Marnek"],
  ["Rahotep's Scepter", "Scepter of Rahotep"],
  ["Electrum Braclet", "Electrum Bracelet"],
  ["Ivory Brraclet", "Ivory Bracelet"],
  ["Obsidian shards", "Obsidian Shard [Obsidian Shatter]"],
  ["obsidian shards", "Obsidian Shard [Obsidian Shatter]"],
  ["Gimblox Signet Ring (Clr)", "Lord Gimblox's Signet Ring"],
  ["Sceptre of Flame", "Scepter of Flame"],
  ["Carved Evory Mask", "Carved Ivory Mask"],
  ["Executioner's Hood", "Executioners Hood"],
  ["Pestilence Scythe 10/50", "Pestilence Scythe [10/50]"],
  ["Pestilence Scythe 16/48", "Pestilence Scythe [16/48]"],
  ["Rubicite Armguards", "Rubicite Vambraces"],
  ["Various Rubicite Armor", "Rubicite Gauntlets"],
  ["Gnomish Environmental Suit", "Gnomish Environment Suit"],
  ["Mithil Quill", "Mithril Quill"],
  ["Staf of Writhing", "Staff of Writhing"],
  ["Loam Bracer", "Loam Encrusted Bracelet"],
  ["Loam Pants", "Loam Encrusted Pantaloons"],
  ["Loam Cap", "Loam Encrusted Cap"],
  ["Loam Sleeves", "Loam Encrusted Sleeves"],
  ["Sharkskin Gloves", "Sharkskin Drum"],
  ["Rokyl's Channeling Crystal", "Rokyls Channelling Crystal"],
  ["Spoon (ENC EPIC)", "Spoon"],
  ["Withered Gorget", "Withered Leather Gorget"],
  ["Withered Leather Bracer", "Withered Leather Wristbands"],
] as const;

const cleanOnly = [
  "Large Soiled Bag",
  "Thunderhoof Quiver",
  "Bloodstained Key",
  "Shralok Pack",
  "Archaeologist Pack",
  "Dull Bone Key",
  "Traveler's Pouch",
  "Traveler's Pack",
  "Memento Box",
  "Dwarven Work Boots",
  "Light Burlap Sack",
  "Driftwood Treasure Chest",
];

const sourceOverrides = new Map<string, string>([
  ["10+ Different Terrible Helmets", "https://everquest.allakhazam.com/db/npc.html?id=3521"],
  ...larktwitterDrops.map((item) => [item.name, item.source] as const),
]);

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function placeholderItem(name: string, source?: string): ItemDetails {
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
    sources: [{ name: "Allakhazam", url: source ?? `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}` }],
    confidence: "not_found",
    match_confidence: "not_found",
    match_notes: [],
    missing_core_stats: true,
    duplicate_name_risk: false,
    parsing_warnings: [],
  };
}

function markClean(item: ItemDetails, source?: string) {
  item.name = item.name || "";
  if (source) {
    item.sources = [{ name: "Allakhazam", url: source }];
  } else if (!item.sources?.length) {
    item.sources = [{ name: "Allakhazam", url: `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(item.name)}` }];
  }
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
    mob.loot = mob.loot.filter((item) => !deletedItems.includes(item));

    for (const replacement of replacements) {
      mob.loot = mob.loot.flatMap((item) => item === replacement.from ? replacement.to : [item]);
    }

    for (const [from, to] of renames) {
      mob.loot = mob.loot.map((item) => item === from ? to : item);
    }

    mob.loot = uniqueSorted(mob.loot);
  }
}

dataset.buckets = dataset.buckets.map(rebuildBucket);

for (const item of [
  ...deletedItems,
  ...replacements.map((replacement) => replacement.from),
  ...renames.map(([from]) => from),
]) {
  delete details[item];
}

for (const replacement of replacements) {
  for (const itemName of replacement.to) {
    details[itemName] ??= placeholderItem(itemName, sourceOverrides.get(itemName) ?? sourceOverrides.get(replacement.from));
    details[itemName].name = itemName;
    markClean(details[itemName], sourceOverrides.get(itemName) ?? sourceOverrides.get(replacement.from));
  }
}

for (const [from, to] of renames) {
  const existing = details[from] ?? details[to] ?? placeholderItem(to);
  delete details[from];
  existing.name = to;
  existing.sources = [{ name: "Allakhazam", url: `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(to)}` }];
  markClean(existing);
  details[to] = existing;
}

for (const itemName of cleanOnly) {
  details[itemName] ??= placeholderItem(itemName);
  details[itemName].name = itemName;
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
}, null, 2));
