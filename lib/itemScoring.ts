import type { ItemDetails } from "@/lib/search";

export const CLASS_STAT_WEIGHTS = {
  WAR: {
    AC: 7,
    HP: 2,
    MANA: 0,
    STR: 1,
    STA: 1,
    AGI: 1,
    DEX: 1,
    WIS: 0,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  CLR: {
    AC: 1,
    HP: 1,
    MANA: 6,
    STR: 0,
    STA: 2,
    AGI: 0,
    DEX: 0,
    WIS: 3,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  PAL: {
    AC: 7,
    HP: 2,
    MANA: 1,
    STR: 1,
    STA: 1,
    AGI: 1,
    DEX: 0,
    WIS: 0,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  RNG: {
    AC: 1,
    HP: 1,
    MANA: 1,
    STR: 3,
    STA: 1,
    AGI: 1,
    DEX: 3,
    WIS: 1,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  SHD: {
    AC: 8,
    HP: 2,
    MANA: 1,
    STR: 0,
    STA: 1,
    AGI: 0,
    DEX: 0,
    WIS: 0,
    INT: 1,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  DRU: {
    AC: 1,
    HP: 1,
    MANA: 6,
    STR: 0,
    STA: 2,
    AGI: 0,
    DEX: 0,
    WIS: 3,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  MNK: {
    AC: 1,
    HP: 1,
    MANA: 0,
    STR: 2,
    STA: 1,
    AGI: 2,
    DEX: 2,
    WIS: 0,
    INT: 0,
    CHA: 0,
    MR: 2,
    FR: 1,
    CR: 2,
    DR: 1,
    PR: 1,
  },

  BRD: {
    AC: 1,
    HP: 3,
    MANA: 0,
    STR: 0,
    STA: 2,
    AGI: 0,
    DEX: 0,
    WIS: 0,
    INT: 0,
    CHA: 0,
    MR: 2,
    FR: 2,
    CR: 2,
    DR: 2,
    PR: 2,
  },

  ROG: {
    AC: 1,
    HP: 1,
    MANA: 0,
    STR: 3,
    STA: 2,
    AGI: 2,
    DEX: 3,
    WIS: 0,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  SHM: {
    AC: 2,
    HP: 5,
    MANA: 2,
    STR: 0,
    STA: 2,
    AGI: 0,
    DEX: 0,
    WIS: 2,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  NEC: {
    AC: 1,
    HP: 5,
    MANA: 2,
    STR: 0,
    STA: 2,
    AGI: 0,
    DEX: 0,
    WIS: 0,
    INT: 2,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  WIZ: {
    AC: 1,
    HP: 2,
    MANA: 5,
    STR: 0,
    STA: 2,
    AGI: 0,
    DEX: 0,
    WIS: 0,
    INT: 3,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  MAG: {
    AC: 1,
    HP: 2,
    MANA: 5,
    STR: 0,
    STA: 2,
    AGI: 0,
    DEX: 0,
    WIS: 0,
    INT: 3,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  ENC: {
    AC: 1,
    HP: 4,
    MANA: 2,
    STR: 0,
    STA: 3,
    AGI: 0,
    DEX: 0,
    WIS: 0,
    INT: 2,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  BST: {
    AC: 1,
    HP: 2,
    MANA: 1,
    STR: 2,
    STA: 1,
    AGI: 2,
    DEX: 2,
    WIS: 1,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },

  // Initial Berserker heuristic: melee DPS weighting close to Rogue/Monk.
  // This is intentionally first-pass and should be tuned after comparison review.
  BER: {
    AC: 1,
    HP: 1,
    MANA: 0,
    STR: 3,
    STA: 2,
    AGI: 2,
    DEX: 3,
    WIS: 0,
    INT: 0,
    CHA: 0,
    MR: 1,
    FR: 1,
    CR: 1,
    DR: 1,
    PR: 1,
  },
} as const;

export type ClassCode = keyof typeof CLASS_STAT_WEIGHTS;
type BaseScoredStat = keyof (typeof CLASS_STAT_WEIGHTS)[ClassCode];
type AdditionalScoredStat = "MANA_REGEN" | "ATTACK";
export type ScoredStat = BaseScoredStat | AdditionalScoredStat;

// Conservative first-pass additions for newer parsed item fields. These are
// intentionally low-impact and should be tuned after real comparison review.
const ADDITIONAL_STAT_WEIGHTS = {
  WAR: { MANA_REGEN: 0, ATTACK: 1 },
  CLR: { MANA_REGEN: 2, ATTACK: 0.25 },
  PAL: { MANA_REGEN: 1, ATTACK: 1 },
  RNG: { MANA_REGEN: 1, ATTACK: 1 },
  SHD: { MANA_REGEN: 1, ATTACK: 1 },
  DRU: { MANA_REGEN: 2, ATTACK: 0.25 },
  MNK: { MANA_REGEN: 0, ATTACK: 1 },
  BRD: { MANA_REGEN: 0, ATTACK: 1 },
  ROG: { MANA_REGEN: 0, ATTACK: 1 },
  SHM: { MANA_REGEN: 2, ATTACK: 0.5 },
  NEC: { MANA_REGEN: 2, ATTACK: 0.25 },
  WIZ: { MANA_REGEN: 2, ATTACK: 0.25 },
  MAG: { MANA_REGEN: 2, ATTACK: 0.25 },
  ENC: { MANA_REGEN: 2, ATTACK: 0.25 },
  BST: { MANA_REGEN: 1, ATTACK: 1 },
  BER: { MANA_REGEN: 0, ATTACK: 1 },
} as const satisfies Record<ClassCode, Record<AdditionalScoredStat, number>>;

const SCORED_STATS = [
  "AC",
  "HP",
  "MANA",
  "STR",
  "STA",
  "AGI",
  "DEX",
  "WIS",
  "INT",
  "CHA",
  "MR",
  "FR",
  "CR",
  "DR",
  "PR",
  "MANA_REGEN",
  "ATTACK",
] as const satisfies readonly ScoredStat[];

export type ItemScoreContribution = {
  stat: ScoredStat;
  value: number;
  weight: number;
  contribution: number;
};

export type ItemScoreExplanation = {
  item: ItemDetails;
  classCode: string;
  score: number;
  contributions: ItemScoreContribution[];
};

export type RankedItem<T extends ItemDetails = ItemDetails> = {
  item: T;
  score: number;
  contributions: ItemScoreContribution[];
};

function normalizeClassCode(classCode: string): ClassCode | null {
  const normalized = classCode.trim().toUpperCase();
  return normalized in CLASS_STAT_WEIGHTS ? (normalized as ClassCode) : null;
}

function numericStat(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/^\+/, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getItemStatValue(item: ItemDetails, stat: ScoredStat): number {
  if (stat === "AC") return numericStat(item.ac);
  if (stat === "MANA_REGEN") return numericStat(item.manaRegen ?? item.mana_regen);
  if (stat === "ATTACK") return numericStat(item.attack);
  if (stat in item.resists) return numericStat(item.resists[stat]);
  return numericStat(item.stats?.[stat]);
}

function getStatWeight(classCode: ClassCode, stat: ScoredStat) {
  if (stat === "MANA_REGEN" || stat === "ATTACK") {
    return ADDITIONAL_STAT_WEIGHTS[classCode][stat];
  }

  return CLASS_STAT_WEIGHTS[classCode][stat];
}

export function formatScoredStatLabel(stat: ScoredStat) {
  if (stat === "MANA_REGEN") return "Mana Regen";
  if (stat === "ATTACK") return "Attack";
  return stat;
}

// Initial heuristic for first-pass item comparison. These weights are intentionally
// unnormalized and should be tuned later after reviewing real comparison results.
function getItemScoreExplanation(item: ItemDetails, classCode: ClassCode): ItemScoreExplanation {
  const contributions = SCORED_STATS.map((stat) => {
    const value = getItemStatValue(item, stat);
    const weight = getStatWeight(classCode, stat);
    return {
      stat,
      value,
      weight,
      contribution: value * weight,
    };
  }).filter((entry) => entry.value !== 0 && entry.weight !== 0)
    .sort((a, b) => b.contribution - a.contribution || a.stat.localeCompare(b.stat));

  return {
    item,
    classCode,
    score: contributions.reduce((sum, entry) => sum + entry.contribution, 0),
    contributions,
  };
}

export function scoreItemForClass(item: ItemDetails, classCode: string): number {
  const normalizedClassCode = normalizeClassCode(classCode);
  if (!normalizedClassCode) return 0;
  return getItemScoreExplanation(item, normalizedClassCode).score;
}

export function explainItemScore(item: ItemDetails, classCode: string): ItemScoreExplanation {
  const normalizedClassCode = normalizeClassCode(classCode);
  if (!normalizedClassCode) {
    return {
      item,
      classCode: classCode.trim().toUpperCase(),
      score: 0,
      contributions: [],
    };
  }
  return getItemScoreExplanation(item, normalizedClassCode);
}

export function rankItemsForClass<T extends ItemDetails>(items: T[], classCode: string): RankedItem<T>[] {
  const normalizedClassCode = normalizeClassCode(classCode);
  if (!normalizedClassCode) {
    return items.map((item) => ({ item, score: 0, contributions: [] }));
  }

  return items
    .map((item) => {
      const explanation = getItemScoreExplanation(item, normalizedClassCode);
      return {
        item,
        score: explanation.score,
        contributions: explanation.contributions,
      };
    })
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
}
