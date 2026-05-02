import assert from "node:assert/strict";
import { explainItemScore } from "../lib/itemScoring.ts";
import type { ItemDetails } from "../lib/search.ts";

function readNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function parseStatBlock(text: string) {
  const stats: Record<string, number | string> = {};
  const resists: Record<string, number | string> = {};
  const statPattern = /\b(STR|STA|AGI|DEX|WIS|INT|CHA|HP|MANA|END|ENDUR|ENDURANCE|MR|FR|CR|DR|PR|SV FIRE|SV COLD|SV MAGIC|SV POISON|SV DISEASE)\s*:?\s*([+-]?\d+%?)\b/gi;
  const otherStatMap = new Map([
    ["hp", "HP"],
    ["mana", "MANA"],
    ["end", "END"],
    ["endur", "END"],
    ["endurance", "END"],
  ]);
  const resistMap = new Map([
    ["mr", "MR"],
    ["fr", "FR"],
    ["cr", "CR"],
    ["dr", "DR"],
    ["pr", "PR"],
    ["sv magic", "MR"],
    ["sv fire", "FR"],
    ["sv cold", "CR"],
    ["sv disease", "DR"],
    ["sv poison", "PR"],
  ]);

  for (const match of text.matchAll(statPattern)) {
    const rawKey = match[1].toLowerCase();
    const value = match[2].includes("%") ? match[2] : Number(match[2]);

    if (["str", "sta", "agi", "dex", "wis", "int", "cha"].includes(rawKey)) {
      stats[rawKey.toUpperCase()] = value;
      continue;
    }

    const otherKey = otherStatMap.get(rawKey);
    if (otherKey) {
      stats[otherKey] = value;
      continue;
    }

    const resistKey = resistMap.get(rawKey);
    if (resistKey) {
      resists[resistKey] = value;
    }
  }

  return { stats, resists };
}

const sample = `
LORE ITEM
Slot: EAR
AC: -15
STA: +8
HP: +75
SV MAGIC: +5
WT: 0.1 Size: TINY
Class: ALL
Race: ALL
`;
const { stats, resists } = parseStatBlock(sample);
const parsed = {
  name: "Hammered Golden Hoop",
  slot: "EAR",
  ac: readNumber(/\bAC:\s*([+-]?\d+)/i, sample),
  damage: null,
  delay: null,
  stats,
  resists,
  hp_regen: null,
  mana_regen: null,
  endurance_regen: null,
  haste: null,
  charges: null,
  worn_effects: [],
  focus_effects: [],
  click_effects: [],
  proc_effects: [],
  required_level: null,
  recommended_level: null,
  classes: ["ALL"],
  races: ["ALL"],
  weight: readNumber(/\bWT:\s*(\d+(?:\.\d+)?)/i, sample),
  size: "TINY",
  lore: true,
  magic: null,
  no_drop: null,
  prestige: null,
  aug_slots: [],
  sources: [{ name: "Allakhazam" as const, url: "https://everquest.allakhazam.com/db/item.html?item=6886" }],
  confidence: "exact_match",
  expansion: "Kunark",
} satisfies ItemDetails;

assert.equal(parsed.ac, -15);
assert.equal(parsed.stats.STA, 8);
assert.equal(parsed.stats.HP, 75);
assert.equal(parsed.resists.MR, 5);
assert.equal(parsed.weight, 0.1);

const explanation = explainItemScore(parsed, "WAR");
const acContribution = explanation.contributions.find((entry) => entry.stat === "AC");
assert.equal(acContribution?.value, -15);
assert.equal(acContribution?.contribution, -105);

console.log("Negative item stat parser test passed.");
