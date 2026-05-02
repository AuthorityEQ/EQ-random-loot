import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { questRewardMappings } from "../data/questRewardMappings.ts";

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
  acquisitionType?: "quest" | string;
  sourceNpcName?: string;
  sourceNpcId?: string;
  sourceItemName?: string;
  sourceItemId?: string;
  questSources?: Array<{
    sourceNpcName?: string;
    sourceNpcId?: string;
    sourceItemName: string;
    sourceItemId?: string;
    questName?: string;
    turnInNpcName?: string;
  }>;
};

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const namesPath = path.join(root, "data", "dozekar-reward-item-names.json");
const sourceNpcName = "Dozekar the Cursed";
const sourceNpcId = "6448";

function itemUrl(itemId: string | undefined) {
  return itemId ? `https://everquest.allakhazam.com/db/item.html?item=${itemId}` : "";
}

function blankQuestRewardItem(name: string, rewardItemId: string | undefined): ItemDetails {
  const url = itemUrl(rewardItemId);
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
    sources: url ? [{ name: "Allakhazam", url }] : [],
    confidence: "needs_review",
    match_confidence: "needs_review",
    match_notes: ["Dozekar quest reward placeholder; ready for targeted Allakhazam enrichment."],
    missing_core_stats: true,
    duplicate_name_risk: false,
    parsing_warnings: [],
    expansion: "Velious",
    iconPath: null,
  };
}

function addAllakhazamSource(item: ItemDetails, rewardItemId: string | undefined) {
  const url = itemUrl(rewardItemId);
  if (!url) return;

  item.sources ??= [];
  const existing = item.sources.find((source) => source.name === "Allakhazam");
  if (existing) {
    existing.url = url;
    return;
  }

  item.sources.unshift({ name: "Allakhazam", url });
}

function mergeUniqueSources(
  current: NonNullable<ItemDetails["questSources"]>,
  next: NonNullable<ItemDetails["questSources"]>[number],
) {
  const key = [
    next.sourceNpcId,
    next.sourceItemId,
    next.sourceItemName,
    next.questName,
    next.turnInNpcName,
  ].join("|");
  const exists = current.some((entry) => [
    entry.sourceNpcId,
    entry.sourceItemId,
    entry.sourceItemName,
    entry.questName,
    entry.turnInNpcName,
  ].join("|") === key);
  if (!exists) current.push(next);
}

const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
const dozekarRewards = questRewardMappings
  .filter((mapping) => mapping.sourceNpcId === sourceNpcId || mapping.sourceNpcName === sourceNpcName)
  .reduce((map, mapping) => {
    const entry = map.get(mapping.rewardItemName) ?? {
      rewardItemName: mapping.rewardItemName,
      rewardItemId: mapping.rewardItemId,
      mappings: [] as typeof questRewardMappings,
    };
    entry.rewardItemId ??= mapping.rewardItemId;
    entry.mappings.push(mapping);
    map.set(mapping.rewardItemName, entry);
    return map;
  }, new Map<string, { rewardItemName: string; rewardItemId?: string; mappings: typeof questRewardMappings }>());

const names = Array.from(dozekarRewards.keys()).sort((a, b) => a.localeCompare(b));
let created = 0;
let updated = 0;

for (const name of names) {
  const reward = dozekarRewards.get(name);
  if (!reward) continue;

  const item = details[name] ?? blankQuestRewardItem(name, reward.rewardItemId);
  if (!details[name]) created += 1;
  else updated += 1;

  addAllakhazamSource(item, reward.rewardItemId);
  item.name = item.name || name;
  item.expansion ||= "Velious";
  item.acquisitionType = "quest";
  item.sourceNpcName = sourceNpcName;
  item.sourceNpcId = sourceNpcId;

  const sortedMappings = [...reward.mappings].sort((a, b) =>
    (a.sourceItemName ?? "").localeCompare(b.sourceItemName ?? "")
      || (a.questName ?? "").localeCompare(b.questName ?? ""),
  );
  const primary = sortedMappings[0];
  if (primary?.sourceItemName) {
    item.sourceItemName = primary.sourceItemName;
    item.sourceItemId = primary.sourceItemId;
  }

  const questSources = [...(item.questSources ?? [])];
  for (const mapping of sortedMappings) {
    mergeUniqueSources(questSources, {
      sourceNpcName,
      sourceNpcId,
      sourceItemName: mapping.sourceItemName ?? "Quest reward",
      sourceItemId: mapping.sourceItemId,
      questName: mapping.questName,
      turnInNpcName: mapping.turnInNpcName,
    });
  }
  item.questSources = questSources;

  details[name] = item;
}

await mkdir(path.dirname(namesPath), { recursive: true });
await writeFile(namesPath, `${JSON.stringify(names, null, 2)}\n`);
await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);

console.log(`Prepared ${names.length} Dozekar quest reward item names.`);
console.log(`Created ${created} item detail placeholders; updated ${updated} existing records.`);
console.log(`Wrote ${namesPath}`);
