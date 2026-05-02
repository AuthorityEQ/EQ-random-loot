import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ItemDetails = {
  name: string;
  slot: string | null;
  ac: number | null;
  damage: number | null;
  delay: number | null;
  skill?: string | null;
  damage_bonus?: number | null;
  stats: Record<string, number | string>;
  resists: Record<string, number | string>;
  hp_regen?: number | null;
  mana_regen?: number | null;
  manaRegen?: number | null;
  endurance_regen?: number | null;
  attack?: number | null;
  haste: string | null;
  charges?: number | string | null;
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
  item_type?: string | null;
  stackable?: boolean | null;
  weight_reduction?: string | null;
  capacity?: number | null;
  size_capacity?: string | null;
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
  expansion: string;
  iconPath?: string | null;
  acquisitionType?: "quest" | "drop" | string;
  sourceNpcName?: string;
  sourceNpcId?: string;
  raidBucket?: number;
};

type RaidBoss = {
  name: string;
  level: number;
  zone: string;
  loot_pool: string[];
};

type RaidTier = {
  tier: number;
  name: string;
  bosses: RaidBoss[];
};

type RaidDataset = {
  expansion: string;
  tiers: RaidTier[];
};

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const raidPath = path.join(root, "data", "velious-raid.json");
const namesPath = path.join(root, "data", "zlandicar-raid-item-names.json");

const zlandicar = {
  sourceNpcName: "Zlandicar",
  sourceNpcId: "5441",
  zone: "Dragon Necropolis",
  level: 70,
  raidBucket: 3,
};

// Known Loot from Allakhazam's Zlandicar page, excluding obvious later-era
// drops such as Defiant gear, binding powder, and reinforced rods.
const zlandicarDrops = [
  { name: "Black Marble", itemId: "3760" },
  { name: "Cowl of Mortality", itemId: "4805" },
  { name: "Cracked Claw of Zlandicar", itemId: "4774" },
  { name: "First Brood Talisman", itemId: "4822" },
  { name: "Flawless Diamond", itemId: "3755" },
  { name: "Frakadar's Talisman", itemId: "4640" },
  { name: "Gauntlets of Mortality", itemId: "4804" },
  { name: "Jaundice Gem", itemId: "3762" },
  { name: "Massive Dragonclaw Shard", itemId: "4931" },
  { name: "Song: Composition of Ervaj", itemId: "9410" },
  { name: "Spell: Aegolism", itemId: "8540" },
  { name: "Spell: Arch Lich", itemId: "8475" },
  { name: "Spell: Banishment", itemId: "8490" },
  { name: "Spell: Call of the Predator", itemId: "8459" },
  { name: "Spell: Death Peace", itemId: "8453" },
  { name: "Spell: Divine Strength", itemId: "8464" },
  { name: "Spell: Focus of Spirit", itemId: "8431" },
  { name: "Spell: Gift of Brilliance", itemId: "8505" },
  { name: "Spell: Ice Spear of Solist", itemId: "8425" },
  { name: "Spell: Monster Summoning III", itemId: "8487" },
  { name: "Spell: Protection of the Glades", itemId: "8517" },
  { name: "Spell: Wrath of the Elements", itemId: "8630" },
  { name: "Zlandicar's Heart", itemId: "4778" },
  { name: "Zlandicar's Talisman", itemId: "4803" },
];

function itemUrl(itemId: string) {
  return `https://everquest.allakhazam.com/db/item.html?item=${itemId}`;
}

function blankDropItem(name: string, itemId: string): ItemDetails {
  return {
    name,
    slot: null,
    ac: null,
    damage: null,
    delay: null,
    skill: null,
    damage_bonus: null,
    stats: {},
    resists: {},
    hp_regen: null,
    mana_regen: null,
    manaRegen: null,
    endurance_regen: null,
    attack: null,
    haste: null,
    charges: null,
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
    item_type: null,
    stackable: null,
    weight_reduction: null,
    capacity: null,
    size_capacity: null,
    lore: null,
    magic: null,
    no_drop: null,
    prestige: null,
    aug_slots: [],
    sources: [{ name: "Allakhazam", url: itemUrl(itemId) }],
    confidence: "needs_review",
    match_confidence: "needs_review",
    match_notes: ["Zlandicar raid drop placeholder; ready for targeted Allakhazam enrichment."],
    missing_core_stats: true,
    duplicate_name_risk: false,
    parsing_warnings: [],
    expansion: "Velious",
    iconPath: null,
    acquisitionType: "drop",
    sourceNpcName: zlandicar.sourceNpcName,
    sourceNpcId: zlandicar.sourceNpcId,
    raidBucket: zlandicar.raidBucket,
  };
}

function setAllakhazamSource(item: ItemDetails, itemId: string) {
  item.sources ??= [];
  const url = itemUrl(itemId);
  const existing = item.sources.find((source) => source.name === "Allakhazam");
  if (existing) {
    existing.url = url;
    return;
  }
  item.sources.unshift({ name: "Allakhazam", url });
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
const raid = JSON.parse(await readFile(raidPath, "utf8")) as RaidDataset;
let created = 0;
let updated = 0;

for (const drop of zlandicarDrops) {
  const item = details[drop.name] ?? blankDropItem(drop.name, drop.itemId);
  if (details[drop.name]) updated += 1;
  else created += 1;

  item.name = drop.name;
  item.expansion = "Velious";
  item.acquisitionType = "drop";
  item.sourceNpcName = zlandicar.sourceNpcName;
  item.sourceNpcId = zlandicar.sourceNpcId;
  item.raidBucket = zlandicar.raidBucket;
  setAllakhazamSource(item, drop.itemId);
  item.match_notes = Array.from(new Set([...(item.match_notes ?? []), "Tagged as a Zlandicar Velious raid bucket 3 drop."]));

  details[drop.name] = item;
}

const tier = raid.tiers.find((entry) => entry.tier === zlandicar.raidBucket);
if (!tier) {
  throw new Error(`Velious raid bucket ${zlandicar.raidBucket} was not found.`);
}

const nextBoss: RaidBoss = {
  name: zlandicar.sourceNpcName,
  level: zlandicar.level,
  zone: zlandicar.zone,
  loot_pool: zlandicarDrops.map((drop) => drop.name),
};
const existingBossIndex = tier.bosses.findIndex((boss) => normalizeName(boss.name) === normalizeName(zlandicar.sourceNpcName));
if (existingBossIndex >= 0) {
  tier.bosses[existingBossIndex] = nextBoss;
} else {
  const klandicarIndex = tier.bosses.findIndex((boss) => normalizeName(boss.name) === "klandicar");
  tier.bosses.splice(klandicarIndex >= 0 ? klandicarIndex + 1 : tier.bosses.length, 0, nextBoss);
}

const names = zlandicarDrops.map((drop) => drop.name);
await mkdir(path.dirname(namesPath), { recursive: true });
await writeFile(namesPath, `${JSON.stringify(names, null, 2)}\n`);
await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(raidPath, `${JSON.stringify(raid, null, 2)}\n`);

console.log(`Prepared ${names.length} Zlandicar raid item names.`);
console.log(`Created ${created} item detail placeholders; updated ${updated} existing records.`);
console.log(`Placed Zlandicar in Velious raid bucket ${zlandicar.raidBucket}.`);
console.log(`Wrote ${namesPath}`);
