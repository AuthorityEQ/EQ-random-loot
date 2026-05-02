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
  sourceItemName?: string;
  sourceItemId?: string;
  questId?: string;
  questName?: string;
  turnInNpcName?: string;
  questSources?: Array<{
    sourceNpcName?: string;
    sourceNpcId?: string;
    sourceItemName: string;
    sourceItemId?: string;
    questId?: string;
    questName?: string;
    turnInNpcName?: string;
  }>;
};

type ItemSpec = {
  name: string;
  itemId: string;
  expansion: string;
  acquisitionType: "quest";
  questId?: string;
  questName?: string;
  turnInNpcName?: string;
  sourceItemName?: string;
  sourceItemId?: string;
  metadataNote: string;
};

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const namesPath = path.join(root, "data", "quest-1289-item-names.json");

const quest1289 = {
  questId: "1289",
  questName: "Tormax's Head - Dragons",
  turnInNpcName: "Lord Yelinak",
  sourceItemName: "King Tormax's Head",
  sourceItemId: "16178",
};

const itemSpecs: ItemSpec[] = [
  {
    name: "Gauntlets of Dragon Slaying",
    itemId: "4363",
    expansion: "Velious",
    acquisitionType: "quest",
    metadataNote: "Targeted quest item import requested from exact Allakhazam URL.",
  },
  {
    name: "Belt of Dwarf Slaying",
    itemId: "4362",
    expansion: "Velious",
    acquisitionType: "quest",
    metadataNote: "Targeted quest item import requested from exact Allakhazam URL.",
  },
  {
    name: "Clawed Griffin Sword",
    itemId: "6764",
    expansion: "Velious",
    acquisitionType: "quest",
    ...quest1289,
    metadataNote: "Quest 1289 reward imported from Tormax's Head - Dragons.",
  },
  {
    name: "White Dragonscale Boots",
    itemId: "6765",
    expansion: "Velious",
    acquisitionType: "quest",
    ...quest1289,
    metadataNote: "Quest 1289 reward imported from Tormax's Head - Dragons.",
  },
  {
    name: "White Dragon Helm",
    itemId: "6766",
    expansion: "Velious",
    acquisitionType: "quest",
    ...quest1289,
    metadataNote: "Quest 1289 reward imported from Tormax's Head - Dragons.",
  },
];

function itemUrl(itemId: string) {
  return `https://everquest.allakhazam.com/db/item.html?item=${itemId}`;
}

function blankItem(spec: ItemSpec): ItemDetails {
  return {
    name: spec.name,
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
    sources: [{ name: "Allakhazam", url: itemUrl(spec.itemId) }],
    confidence: "needs_review",
    match_confidence: "needs_review",
    match_notes: [spec.metadataNote],
    missing_core_stats: true,
    duplicate_name_risk: false,
    parsing_warnings: [],
    expansion: spec.expansion,
    iconPath: null,
  };
}

function setAllakhazamSource(item: ItemDetails, itemId: string) {
  const url = itemUrl(itemId);
  item.sources ??= [];
  const existing = item.sources.find((source) => source.name === "Allakhazam");
  if (existing) {
    existing.url = url;
    return;
  }
  item.sources.unshift({ name: "Allakhazam", url });
}

function addQuestSource(item: ItemDetails, spec: ItemSpec) {
  if (!spec.questId) return;

  const next = {
    sourceItemName: spec.sourceItemName ?? `Quest ${spec.questId}`,
    sourceItemId: spec.sourceItemId,
    questId: spec.questId,
    questName: spec.questName,
    turnInNpcName: spec.turnInNpcName,
  };
  const existing = item.questSources ?? [];
  const exists = existing.some((entry) =>
    entry.questId === next.questId
      && entry.questName === next.questName
      && entry.turnInNpcName === next.turnInNpcName,
  );
  if (!exists) {
    item.questSources = [...existing, next];
  }
}

const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
let created = 0;
let updated = 0;

for (const spec of itemSpecs) {
  const item = details[spec.name] ?? blankItem(spec);
  if (details[spec.name]) updated += 1;
  else created += 1;

  item.name = spec.name;
  item.expansion ||= spec.expansion;
  item.acquisitionType = spec.acquisitionType;
  setAllakhazamSource(item, spec.itemId);

  if (spec.questId) {
    item.questId = spec.questId;
    item.questName = spec.questName;
    item.turnInNpcName = spec.turnInNpcName;
    item.sourceItemName = spec.sourceItemName;
    item.sourceItemId = spec.sourceItemId;
    addQuestSource(item, spec);
  }

  item.match_notes = Array.from(new Set([...(item.match_notes ?? []), spec.metadataNote]));
  details[spec.name] = item;
}

const names = itemSpecs.map((spec) => spec.name);
await mkdir(path.dirname(namesPath), { recursive: true });
await writeFile(namesPath, `${JSON.stringify(names, null, 2)}\n`);
await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);

console.log(`Prepared ${names.length} targeted quest item names.`);
console.log(`Created ${created} item detail placeholders; updated ${updated} existing records.`);
console.log(`Wrote ${namesPath}`);
