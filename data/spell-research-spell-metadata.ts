export type ResearchClassName =
  | "Bard"
  | "Beastlord"
  | "Cleric"
  | "Druid"
  | "Enchanter"
  | "Magician"
  | "Necromancer"
  | "Paladin"
  | "Ranger"
  | "Shadowknight"
  | "Shaman"
  | "Wizard";

export type ResearchSpellMetadata = {
  className: ResearchClassName;
  spellLevel: number;
  spellName: string;
  expectedTrivial: number;
};

export function normalizeResearchSpellName(value: string) {
  return value
    .replace(/^spell:\s*/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[\u2018\u2019'`]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const RESEARCH_CLASSES: ResearchClassName[] = [
  "Bard",
  "Beastlord",
  "Cleric",
  "Druid",
  "Enchanter",
  "Magician",
  "Necromancer",
  "Paladin",
  "Ranger",
  "Shadowknight",
  "Shaman",
  "Wizard",
];

// TODO: Enrich this from trusted Allakhazam/Lucy-style spell data for full Classic-Luclin class/level coverage.
// TODO: Add missing spell levels and missing spell classes that cannot be inferred from Research quills.
// TODO: Tag component availability by zone/era once research component data is enriched.
// TODO: Add Allakhazam links, subcombine chains, and advanced expansion validation after the active CSV import is stable.
// TODO: Improve skill-up recommendations after component availability and cost data exist.
export const RESEARCH_SPELL_METADATA: ResearchSpellMetadata[] = [
  { className: "Enchanter", spellLevel: 16, spellName: "Mesmerization", expectedTrivial: 52 },
  { className: "Enchanter", spellLevel: 19, spellName: "Berserker Strength", expectedTrivial: 60 },
  { className: "Enchanter", spellLevel: 20, spellName: "Color Shift", expectedTrivial: 60 },
  { className: "Enchanter", spellLevel: 22, spellName: "Strip Enchantment", expectedTrivial: 64 },
  { className: "Enchanter", spellLevel: 23, spellName: "Tepid Deeds", expectedTrivial: 67 },
  { className: "Enchanter", spellLevel: 25, spellName: "Feedback", expectedTrivial: 70 },
  { className: "Enchanter", spellLevel: 30, spellName: "Mana Sieve", expectedTrivial: 80 },
  { className: "Enchanter", spellLevel: 34, spellName: "Insipid Weakness", expectedTrivial: 88 },
  { className: "Enchanter", spellLevel: 36, spellName: "Gravity Flux", expectedTrivial: 94 },
  { className: "Enchanter", spellLevel: 36, spellName: "Mind Wipe", expectedTrivial: 92 },
  { className: "Enchanter", spellLevel: 41, spellName: "Shiftless Deeds", expectedTrivial: 103 },
  { className: "Enchanter", spellLevel: 42, spellName: "Pillage Enchantment", expectedTrivial: 104 },
  { className: "Enchanter", spellLevel: 43, spellName: "Color Skew", expectedTrivial: 106 },
  { className: "Enchanter", spellLevel: 45, spellName: "Reoccurring Amnesia", expectedTrivial: 110 },
  { className: "Enchanter", spellLevel: 45, spellName: "Paralyzing Earth", expectedTrivial: 110 },
  { className: "Enchanter", spellLevel: 46, spellName: "Allure", expectedTrivial: 112 },
  { className: "Enchanter", spellLevel: 46, spellName: "Blanket of Forgetfulness", expectedTrivial: 112 },
  { className: "Magician", spellLevel: 21, spellName: "Cornucopia", expectedTrivial: 63 },
  { className: "Magician", spellLevel: 22, spellName: "Everfount", expectedTrivial: 66 },
  { className: "Magician", spellLevel: 22, spellName: "Summoning: Water", expectedTrivial: 66 },
  { className: "Magician", spellLevel: 23, spellName: "Summoning: Fire", expectedTrivial: 67 },
  { className: "Magician", spellLevel: 24, spellName: "Summoning: Air", expectedTrivial: 70 },
  { className: "Magician", spellLevel: 26, spellName: "Greater Summoning: Water", expectedTrivial: 79 },
  { className: "Magician", spellLevel: 29, spellName: "Greater Summoning: Earth", expectedTrivial: 78 },
  { className: "Magician", spellLevel: 32, spellName: "Minor Conjuration: Fire", expectedTrivial: 86 },
  { className: "Magician", spellLevel: 33, spellName: "Minor Conjuration: Air", expectedTrivial: 87 },
  { className: "Magician", spellLevel: 36, spellName: "Lesser Conjuration: Water", expectedTrivial: 94 },
  { className: "Magician", spellLevel: 39, spellName: "Lesser Conjuration: Earth", expectedTrivial: 99 },
  { className: "Magician", spellLevel: 41, spellName: "Conjuration: Water", expectedTrivial: 103 },
  { className: "Magician", spellLevel: 43, spellName: "Conjuration: Air", expectedTrivial: 107 },
  { className: "Magician", spellLevel: 44, spellName: "Conjuration: Earth", expectedTrivial: 110 },
  { className: "Magician", spellLevel: 47, spellName: "Greater Conjuration: Fire", expectedTrivial: 115 },
  { className: "Magician", spellLevel: 48, spellName: "Greater Conjuration: Air", expectedTrivial: 114 },
  { className: "Magician", spellLevel: 49, spellName: "Greater Conjuration: Water", expectedTrivial: 119 },
  { className: "Necromancer", spellLevel: 15, spellName: "Voice Graft", expectedTrivial: 50 },
  { className: "Necromancer", spellLevel: 16, spellName: "Hungry Earth", expectedTrivial: 53 },
  { className: "Necromancer", spellLevel: 20, spellName: "Harmshield", expectedTrivial: 62 },
  { className: "Necromancer", spellLevel: 23, spellName: "Intensify Death", expectedTrivial: 70 },
  { className: "Necromancer", spellLevel: 24, spellName: "Haunting Corpse", expectedTrivial: 70 },
  { className: "Necromancer", spellLevel: 26, spellName: "Renew Bones", expectedTrivial: 76 },
  { className: "Necromancer", spellLevel: 31, spellName: "Call of Bones", expectedTrivial: 84 },
  { className: "Necromancer", spellLevel: 32, spellName: "Surge of Enfeeblement", expectedTrivial: 84 },
  { className: "Necromancer", spellLevel: 33, spellName: "Invoke Shadow", expectedTrivial: 87 },
  { className: "Necromancer", spellLevel: 41, spellName: "Dead Man Floating", expectedTrivial: 106 },
  { className: "Necromancer", spellLevel: 46, spellName: "Paralyzing Earth", expectedTrivial: 110 },
  { className: "Necromancer", spellLevel: 48, spellName: "Invoke Death", expectedTrivial: 118 },
  { className: "Necromancer", spellLevel: 48, spellName: "Lich", expectedTrivial: 119 },
  { className: "Necromancer", spellLevel: 49, spellName: "Bond of Death", expectedTrivial: 119 },
  { className: "Wizard", spellLevel: 14, spellName: "Project Lightning", expectedTrivial: 48 },
  { className: "Wizard", spellLevel: 15, spellName: "Pillar of Fire", expectedTrivial: 50 },
  { className: "Wizard", spellLevel: 18, spellName: "Fire Spiral of Al'Kabor", expectedTrivial: 56 },
  { className: "Wizard", spellLevel: 23, spellName: "Lightning Storm", expectedTrivial: 66 },
  { className: "Wizard", spellLevel: 24, spellName: "Column of Lightning", expectedTrivial: 68 },
  { className: "Wizard", spellLevel: 24, spellName: "Cast Force", expectedTrivial: 68 },
  { className: "Wizard", spellLevel: 26, spellName: "Energy Storm", expectedTrivial: 72 },
  { className: "Wizard", spellLevel: 28, spellName: "Shock Spiral of Al'Kabor", expectedTrivial: 76 },
  { className: "Wizard", spellLevel: 31, spellName: "Circle of Force", expectedTrivial: 82 },
  { className: "Wizard", spellLevel: 32, spellName: "Lava Storm", expectedTrivial: 84 },
  { className: "Wizard", spellLevel: 35, spellName: "Force Spiral of Al'Kabor", expectedTrivial: 91 },
  { className: "Wizard", spellLevel: 43, spellName: "Gravity Flux", expectedTrivial: 94 },
  { className: "Wizard", spellLevel: 45, spellName: "Supernova", expectedTrivial: 110 },
  { className: "Wizard", spellLevel: 48, spellName: "Wrath of Al'Kabor", expectedTrivial: 118 },
  { className: "Wizard", spellLevel: 48, spellName: "Paralyzing Earth", expectedTrivial: 110 },
  { className: "Wizard", spellLevel: 49, spellName: "Ice Comet", expectedTrivial: 118 },
];
