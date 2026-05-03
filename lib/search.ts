export type Mob = {
  name: string;
  level: number;
  zone: string;
  expansion: string;
  source_bucket: string;
  loot: string[];
  faction?: string;
};

export type Bucket = {
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

export type LootDataset = {
  metadata: {
    game: string;
    server: string;
    expansion: string;
    content_type: string;
    bucket_rule: string;
    note: string;
    source: string;
  };
  buckets: Bucket[];
};

export type ItemEffectType = "focus" | "bardMod" | "worn" | "click" | "proc" | "unknown";

export type ItemEffect = {
  name: string;
  type: ItemEffectType;
  description?: string;
};

export type ItemDetails = {
  name: string;
  itemId?: string | null;
  sourceUrl?: string | null;
  slot: string | null;
  ac: number | null;
  damage: number | null;
  delay: number | null;
  skill?: string | number | null;
  damage_bonus?: string | number | null;
  stats: Record<string, number | string>;
  resists: Record<string, number | string>;
  hp_regen?: number | null;
  mana_regen?: number | null;
  manaRegen?: number | null;
  endurance_regen?: number | null;
  atk?: number | null;
  attack?: number | null;
  haste: string | null;
  charges?: number | string | null;
  worn_effects: string[];
  focus_effects: string[];
  click_effects: string[];
  proc_effects: string[];
  effects?: ItemEffect[];
  required_level: number | null;
  recommended_level: number | null;
  classes: string[];
  races: string[];
  weight: number | null;
  size: string | null;
  item_type?: string | null;
  itemType?: string | null;
  weaponType?: "1H" | "2H" | "shield" | "ranged" | "other" | null;
  isTwoHanded?: boolean | null;
  stackable?: boolean | null;
  weight_reduction?: string | null;
  capacity?: number | null;
  size_capacity?: string | null;
  quest?: boolean | null;
  placeable?: boolean | null;
  augmentation?: Array<{
    slot: number;
    type: number;
    description: string;
  }>;
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
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
  acquisitionType?: "quest" | string;
  relatedQuestId?: string | number;
  source?: string;
  sourceCategory?: string;
  armorSet?: "Thurgadin" | "Kael" | "Skyshrine" | string;
  sourceNpcName?: string;
  sourceNpcId?: string;
  raidBucket?: number;
  sourceItemName?: string;
  sourceItemId?: string;
  questId?: string;
  questName?: string;
  turnInNpcName?: string;
  extraStats?: Record<string, string | number | boolean>;
  rawItemText?: string;
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

export type ItemDetailsMap = Record<string, ItemDetails>;

function matches(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

export function filterBuckets(buckets: Bucket[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return buckets;
  }

  return buckets.filter((bucket) => {
    const itemMatch = bucket.loot_pool.some((item) => matches(item, normalizedQuery));
    const mobMatch = bucket.mobs.some((mob) => matches(mob.name, normalizedQuery));
    const zoneMatch = bucket.zones.some((zone) => matches(zone, normalizedQuery));

    return itemMatch || mobMatch || zoneMatch;
  });
}
