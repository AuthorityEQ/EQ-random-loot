export type RaidBoss = {
  name: string;
  level: number;
  zone: string;
  notes?: string;
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
