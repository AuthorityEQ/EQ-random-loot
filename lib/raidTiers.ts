export type RaidBoss = {
  name: string;
  level: number;
  zone: string;
  notes?: string;
  loot_pool?: string[];
};

export type RaidTier = {
  tier: number | string;
  name: string;
  bosses: RaidBoss[];
};

export type RaidDataset = {
  expansion: string;
  tiers: RaidTier[];
};

export function raidTotals(tiers: RaidTier[]) {
  const bosses = tiers.reduce((total, tier) => total + tier.bosses.length, 0);
  const zones = new Set(tiers.flatMap((tier) => tier.bosses.map((boss) => boss.zone))).size;

  return { bosses, zones };
}

/**
 * Returns a deduped list of unique item names across every boss's loot_pool
 * in a tier. Order: stable, sorted by first appearance, alphabetical for ties.
 */
export function dedupeTierLoot(tier: RaidTier): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const boss of tier.bosses) {
    for (const item of boss.loot_pool ?? []) {
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Given an item name and a tier, return the bosses that drop that item.
 * Used to render "dropped by: X, Y, Z" badges in the shared pool view.
 */
export function bossesDroppingItem(tier: RaidTier, itemName: string): RaidBoss[] {
  return tier.bosses.filter((boss) => (boss.loot_pool ?? []).includes(itemName));
}
