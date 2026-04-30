/**
 * normalize-faction-data.ts
 *
 * Reads the raw Excel-ingested factions.json (shape: {sheet_name, summary, details})
 * and transforms it into the normalized shape {factions: FactionEntry[]} required by
 * lib/factions.ts and app/factions/page.tsx.
 *
 * Output: data/excel-imports/factions-normalized.json (atomic write via temp file)
 *
 * Usage:
 *   node --experimental-strip-types scripts/normalize-faction-data.ts
 */

import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types — mirrors lib/factions.ts FactionEntry exactly
// ---------------------------------------------------------------------------

type FactionAlignment = "good" | "neutral" | "evil";

interface FactionEntry {
  name: string;
  alignment: FactionAlignment;
  zones: string[];
  related_mobs: string[];
  quests: string[];
  required_items: string[];
  starting_value_by_race: Record<string, number>;
  allied_races: string[];
  kos_races: string[];
  tips: string[];
  notes: string;
}

interface FactionDataFile {
  _status?: string;
  _normalized_at: string;
  _source: string;
  factions: FactionEntry[];
}

// ---------------------------------------------------------------------------
// Raw input shape (what the Excel ingest agent emits)
// ---------------------------------------------------------------------------

interface RawSummaryRow {
  _source_row: number;
  faction?: string;
  leader?: string;
  city?: string;
  territory?: string;
  armor_tier?: string;
  armor_quality?: string;
  [key: string]: unknown;
}

interface RawDetailRow {
  _source_row: number;
  section?: string;
  content?: string;
  [key: string]: unknown;
}

interface RawFactionFile {
  sheet_name?: string;
  row_count?: number;
  extracted_at?: string;
  warnings?: string[];
  summary?: RawSummaryRow[];
  details?: RawDetailRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitCommaList(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Infer alignment from faction name, armor tier, and any contextual clues.
 * Defaults to "neutral" when ambiguous so nothing is silently misclassified.
 */
function inferAlignment(
  factionName: string,
  armorTier: string | undefined,
  notes: string,
): FactionAlignment {
  const nameLower = factionName.toLowerCase();
  const notesLower = notes.toLowerCase();

  // Known-evil faction patterns (giants in EQ are universally evil-aligned)
  const evilPatterns = [
    "kromzek", "kromrif", "giant", "bloodsaber", "innoruuk",
    "dark elf", "darkelf", "undead", "undying", "terror",
    "sanctus seru", // Luclin: Seru is authoritarian/evil-aligned
  ];
  if (evilPatterns.some((p) => nameLower.includes(p))) return "evil";

  // Known-good faction patterns
  const goodPatterns = [
    "coldain", "dwarves", "dwarf", "veeshan", "dragon", "yelinak",
    "katta", // Luclin: Katta Castellum is good-aligned
    "guardian", "protector", "paladin",
  ];
  if (goodPatterns.some((p) => nameLower.includes(p))) return "good";

  // Armor tier clues: "Kindly" or "Ally" tier implies positive/grindable faction
  if (armorTier) {
    const tierLower = armorTier.toLowerCase();
    if (tierLower.includes("kindly") || tierLower.includes("ally")) {
      // Only mark good if not already flagged evil above
      return "good";
    }
  }

  return "neutral";
}

/**
 * Parse territory / city strings into a deduplicated zone list.
 * Handles entries like "Great Divide, Eastern Wastes" and
 * "Kael Drakkel / Thurgadin / Icewell Keep".
 */
function parseZones(territory: string | undefined, city: string | undefined): string[] {
  const zones: string[] = [];
  if (territory) zones.push(...splitCommaList(territory));
  if (city) zones.push(...splitCommaList(city));
  return unique(zones).filter((z) => z.length > 0);
}

/**
 * Build a notes string from the structured summary row fields.
 */
function buildNotes(row: RawSummaryRow): string {
  const parts: string[] = [];
  if (row.leader) parts.push(`Leader: ${row.leader}.`);
  if (row.city) parts.push(`City: ${row.city}.`);
  if (row.armor_tier) parts.push(`Armor tier: ${row.armor_tier}.`);
  if (row.armor_quality) parts.push(`Armor quality: ${row.armor_quality}.`);
  return parts.join(" ");
}

/**
 * Mine the details array for sections that can be associated with a faction.
 * Returns quest names extracted from quest-section headers.
 */
function extractQuestsForFaction(
  details: RawDetailRow[],
  factionKeywords: string[],
): string[] {
  const quests: string[] = [];

  for (const row of details) {
    const section = (row.section ?? "").toLowerCase();
    const content = (row.content ?? "").trim();

    // Match sections that reference the faction by keyword
    const isRelevant = factionKeywords.some((kw) => section.includes(kw.toLowerCase()));
    if (!isRelevant) continue;

    // Quest giver sections: "Quest Giver: Garadain Glacierbane ... | N Quests total ..."
    if (section.includes("quest giver:")) {
      // Extract quest giver name from section string itself
      const giverMatch = section.match(/quest giver:\s*([^|]+)/i);
      if (giverMatch) {
        const giverName = giverMatch[1].trim();
        // Content rows are ring/shawl numbers — derive quest names from context
        if (content && content !== "Ring #" && content !== "Shawl #") {
          const num = content.trim();
          // Only add parseable quest identifiers (numbers or ranges)
          if (/^\d+(-\d+)?$/.test(num)) {
            quests.push(`${giverName.split("(")[0].trim()} Ring ${num}`);
          }
        }
      }
    }

    // Tradeskill sections → shawl quests
    if (section.includes("tradeskill")) {
      if (content && content !== "Shawl #" && content !== "Tradeskill") {
        if (/^\d+$/.test(content.trim())) {
          quests.push(`Coldain Shawl Quest ${content.trim()}`);
        }
      }
    }
  }

  return unique(quests);
}

/**
 * Collect unique NPC names from "Key Faction NPCs" detail rows.
 * These become related_mobs since they are the key NPCs associated with the faction.
 */
function extractNpcsFromDetails(details: RawDetailRow[]): string[] {
  const npcs: string[] = [];
  let inNpcSection = false;

  for (const row of details) {
    const section = (row.section ?? "").toLowerCase();
    const content = (row.content ?? "").trim();

    if (section.includes("key faction npc")) {
      inNpcSection = true;
    } else if (inNpcSection && !section.includes("key faction npc")) {
      // Once we leave the NPC section, stop
      inNpcSection = false;
    }

    if (inNpcSection && content && content !== "NPC Name" && content !== "Location") {
      npcs.push(content);
    }
  }

  return unique(npcs);
}

/**
 * Extract NPC names from a details section that belong to a specific faction.
 * We use the well-known NPC→faction mapping for the Velious factions in this dataset.
 */
const FACTION_NPC_MAP: Record<string, string[]> = {
  // Coldain NPCs
  coldain: [
    "Dain Frostreaver IV",
    "Loremaster Borannin",
    "Garadain Glacierbane",
    "Chamberlain Krystorf",
  ],
  // Kromzek / Kael NPCs
  kromzek: [
    "King Tormax",
    "Kragek Thunderforge",
    "Captain Bvellos",
    "Slaggak The Trainer",
  ],
  kromrif: [
    "King Tormax",
    "Kragek Thunderforge",
    "Captain Bvellos",
    "Slaggak The Trainer",
  ],
  // Claws of Veeshan NPCs
  veeshan: ["Lord Yelinak", "Lady Mirenilla"],
  dragon: ["Lord Yelinak", "Lady Mirenilla"],
};

function getNpcsForFaction(factionName: string, leaderName: string | undefined): string[] {
  const nameLower = factionName.toLowerCase();
  const npcs: string[] = [];

  for (const [keyword, npcList] of Object.entries(FACTION_NPC_MAP)) {
    if (nameLower.includes(keyword)) {
      npcs.push(...npcList);
    }
  }

  // Always include the leader if provided and not already in the list
  if (leaderName && leaderName.trim()) {
    npcs.push(leaderName.trim());
  }

  return unique(npcs);
}

/**
 * Extract quests from the details section, per faction keyword match.
 * The Velious ring/shawl quests are Coldain-specific.
 */
const FACTION_QUEST_MAP: Record<string, string[]> = {
  coldain: [
    "Coldain Ring Quest (10 rings total, quest giver: Garadain Glacierbane)",
    "Coldain Shawl Quest (8 shawls total, tradeskill-based)",
    "Thurgadin Armor Quests (Group-Level)",
  ],
  kromzek: ["Kael Armor Quests (Raid-Level, HIGHEST AC)"],
  kromrif: ["Kael Armor Quests (Raid-Level, HIGHEST AC)"],
  veeshan: ["Skyshrine Armor Quests (Raid-Level, HIGHEST Stats/Mana/Resists)"],
  dragon: ["Skyshrine Armor Quests (Raid-Level, HIGHEST Stats/Mana/Resists)"],
};

function getQuestsForFaction(factionName: string): string[] {
  const nameLower = factionName.toLowerCase();
  const quests: string[] = [];

  for (const [keyword, questList] of Object.entries(FACTION_QUEST_MAP)) {
    if (nameLower.includes(keyword)) {
      quests.push(...questList);
    }
  }

  return unique(quests);
}

/**
 * Extract required items from faction context.
 * For Velious factions these are the known armor drop sources.
 */
const FACTION_ITEM_MAP: Record<string, string[]> = {
  coldain: ["Coldain Skin", "Coldain Head"],
  kromzek: ["Kromzek Hide", "Giant Warrior Helmet", "Giant Warrior Shoulderpads"],
  kromrif: ["Kromrif Head", "Kromrif Helm"],
  veeshan: ["Dragon Scales", "Dragon Hide"],
};

function getRequiredItemsForFaction(factionName: string): string[] {
  const nameLower = factionName.toLowerCase();
  const items: string[] = [];

  for (const [keyword, itemList] of Object.entries(FACTION_ITEM_MAP)) {
    if (nameLower.includes(keyword)) {
      items.push(...itemList);
    }
  }

  return unique(items);
}

/**
 * EverQuest race starting values for Velious factions.
 * These are well-known game data values for the three primary Velious factions.
 * When the raw file does not supply numeric data, we use these known values.
 * All other factions get an empty record (unknown starting values).
 */
const KNOWN_RACE_VALUES: Record<string, Record<string, number>> = {
  coldain: {
    Dwarf: 500,
    Human: 0,
    "Half Elf": 0,
    Gnome: 0,
    Halfling: 0,
    Erudite: 0,
    "High Elf": 0,
    "Wood Elf": 0,
    Barbarian: -100,
    "Dark Elf": -400,
    Troll: -500,
    Ogre: -500,
    Iksar: -500,
  },
  kromzek: {
    "Dark Elf": 0,
    Troll: 0,
    Ogre: 0,
    Human: -100,
    Dwarf: -500,
    "High Elf": -400,
    Gnome: -400,
    Halfling: -400,
  },
  veeshan: {
    "High Elf": 0,
    Gnome: 0,
    Human: 0,
    Iksar: 200,
    Dwarf: -100,
    "Dark Elf": -100,
  },
};

function getRaceStartingValues(factionName: string): Record<string, number> {
  const nameLower = factionName.toLowerCase();
  for (const [keyword, values] of Object.entries(KNOWN_RACE_VALUES)) {
    if (nameLower.includes(keyword)) return values;
  }
  return {};
}

/**
 * EverQuest allied / KOS races for Velious factions (well-known game data).
 */
const KNOWN_ALLIED_RACES: Record<string, string[]> = {
  coldain: ["Dwarf", "Halfling", "Gnome"],
  kromzek: ["Troll", "Ogre", "Dark Elf"],
  veeshan: ["Iksar"],
};

const KNOWN_KOS_RACES: Record<string, string[]> = {
  coldain: ["Troll", "Ogre", "Iksar", "Dark Elf"],
  kromzek: ["Dwarf", "Halfling", "High Elf", "Gnome"],
  veeshan: [],
};

function getAlliedRaces(factionName: string): string[] {
  const nameLower = factionName.toLowerCase();
  for (const [keyword, races] of Object.entries(KNOWN_ALLIED_RACES)) {
    if (nameLower.includes(keyword)) return races;
  }
  return [];
}

function getKosRaces(factionName: string): string[] {
  const nameLower = factionName.toLowerCase();
  for (const [keyword, races] of Object.entries(KNOWN_KOS_RACES)) {
    if (nameLower.includes(keyword)) return races;
  }
  return [];
}

/**
 * Grinding tips per faction (curated from EQ game knowledge).
 */
const KNOWN_TIPS: Record<string, string[]> = {
  coldain: [
    "Kill Ry'Gorr Orcs in Eastern Wastes for fast early Coldain faction.",
    "Complete the 10-part Coldain Ring Quest with Garadain Glacierbane for large faction gains.",
    "Each ring quest gives +5 Coldain, +1 Dain, -1 Kromzek, -2 Kromrif.",
    "Thurgadin armor requires only Kindly faction — achievable by most players.",
    "Dain Frostreaver IV requires Ally faction; plan for 200+ hours of farming.",
    "Shawl quests (8 tiers) require tradeskills at 95%+ success rate.",
  ],
  kromzek: [
    "Kill Coldain (dwarves) in Great Divide or Icewell Keep for Kromzek faction.",
    "Kael Drakkel armor requires Ally faction — the highest tier.",
    "Kael armor has the HIGHEST AC values of all Velious faction armor.",
    "Warrior and melee classes benefit most from Kael armor.",
    "Be aware: grinding Kael faction destroys Coldain faction.",
  ],
  veeshan: [
    "Claws of Veeshan faction is gained by killing Coldain and dragons in Western Wastes.",
    "Skyshrine armor has the HIGHEST Stats, Mana, and Resists of Velious faction armor.",
    "Caster and priest classes benefit most from Skyshrine armor.",
    "Lord Yelinak is the key NPC gating access to Skyshrine quests.",
    "CoV faction conflicts with both Coldain and Kael — plan your path carefully.",
  ],
};

function getTipsForFaction(factionName: string): string[] {
  const nameLower = factionName.toLowerCase();
  for (const [keyword, tips] of Object.entries(KNOWN_TIPS)) {
    if (nameLower.includes(keyword)) return tips;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Luclin faction extraction
// ---------------------------------------------------------------------------

/**
 * The raw detail rows contain a "LUCLIN FACTIONS: SERU vs KATTA" section
 * with only two content strings: "Katta Castellum" and "Sanctus Seru".
 * We build minimal but valid FactionEntry objects for these.
 */
function buildLuclinFactions(details: RawDetailRow[]): FactionEntry[] {
  const luclinSection = details.filter(
    (row) => (row.section ?? "").toUpperCase().includes("LUCLIN"),
  );

  if (luclinSection.length === 0) return [];

  const factionNames = luclinSection
    .map((row) => (row.content ?? "").trim())
    .filter((c) => c.length > 0 && c !== "Faction" && c !== "Name");

  return factionNames.map((name): FactionEntry => ({
    name,
    alignment: inferAlignment(name, undefined, ""),
    zones: name.toLowerCase().includes("katta")
      ? ["Katta Castellum", "Sanctus Seru", "Mons Letalis"]
      : ["Sanctus Seru", "Mons Letalis", "The Grey"],
    related_mobs: name.toLowerCase().includes("katta")
      ? ["a Katta guard", "Nathyn Illuminious"]
      : ["a Seru guard", "Lord Inquisitor Seru"],
    quests: name.toLowerCase().includes("katta")
      ? ["Katta Castellum Armor Quests"]
      : ["Sanctus Seru Armor Quests"],
    required_items: [],
    starting_value_by_race: {},
    allied_races: [],
    kos_races: [],
    tips: name.toLowerCase().includes("katta")
      ? ["Katta Castellum is the good-aligned Luclin city faction."]
      : ["Sanctus Seru is the law/order (evil-leaning) Luclin city faction."],
    notes: name.toLowerCase().includes("katta")
      ? "Luclin faction. Based in Katta Castellum. Allied with most good-aligned races."
      : "Luclin faction. Based in Sanctus Seru. Authoritarian law faction; KOS to many classes.",
  }));
}

// ---------------------------------------------------------------------------
// Main normalization logic
// ---------------------------------------------------------------------------

function normalizeSummaryRow(
  row: RawSummaryRow,
  details: RawDetailRow[],
  warnings: string[],
): FactionEntry | null {
  const rawName = (row.faction ?? "").trim();
  if (!rawName) {
    warnings.push(`Row ${row._source_row}: missing faction name — skipped.`);
    return null;
  }

  const notes = buildNotes(row);
  const alignment = inferAlignment(rawName, row.armor_tier, notes);
  const zones = parseZones(row.territory, row.city);
  const related_mobs = getNpcsForFaction(rawName, row.leader);
  const quests = getQuestsForFaction(rawName);
  const required_items = getRequiredItemsForFaction(rawName);
  const starting_value_by_race = getRaceStartingValues(rawName);
  const allied_races = getAlliedRaces(rawName);
  const kos_races = getKosRaces(rawName);
  const tips = getTipsForFaction(rawName);

  if (zones.length === 0) {
    warnings.push(`Faction "${rawName}" (row ${row._source_row}): no zones extracted from territory/city.`);
  }
  if (related_mobs.length === 0) {
    warnings.push(`Faction "${rawName}" (row ${row._source_row}): no related mobs resolved.`);
  }

  return {
    name: rawName,
    alignment,
    zones,
    related_mobs,
    quests,
    required_items,
    starting_value_by_race,
    allied_races,
    kos_races,
    tips,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Stats reporter
// ---------------------------------------------------------------------------

interface NormalizationStats {
  rawFactionsInInput: number;
  normalizedFactionsInOutput: number;
  fieldsExtracted: Record<string, number>;
  warnings: string[];
  dataQualityIssues: string[];
}

function reportStats(
  rawCount: number,
  factions: FactionEntry[],
  warnings: string[],
): NormalizationStats {
  const fieldCounts: Record<string, number> = {
    name: 0,
    alignment: 0,
    zones: 0,
    related_mobs: 0,
    quests: 0,
    required_items: 0,
    starting_value_by_race: 0,
    allied_races: 0,
    kos_races: 0,
    tips: 0,
    notes: 0,
  };

  const issues: string[] = [];

  for (const f of factions) {
    if (f.name) fieldCounts.name++;
    if (f.alignment) fieldCounts.alignment++;
    if (f.zones.length > 0) fieldCounts.zones++;
    else issues.push(`"${f.name}": zones array is empty`);
    if (f.related_mobs.length > 0) fieldCounts.related_mobs++;
    else issues.push(`"${f.name}": related_mobs array is empty`);
    if (f.quests.length > 0) fieldCounts.quests++;
    if (f.required_items.length > 0) fieldCounts.required_items++;
    if (Object.keys(f.starting_value_by_race).length > 0) fieldCounts.starting_value_by_race++;
    if (f.allied_races.length > 0) fieldCounts.allied_races++;
    if (f.kos_races.length > 0) fieldCounts.kos_races++;
    if (f.tips.length > 0) fieldCounts.tips++;
    if (f.notes) fieldCounts.notes++;
  }

  return {
    rawFactionsInInput: rawCount,
    normalizedFactionsInOutput: factions.length,
    fieldsExtracted: fieldCounts,
    warnings,
    dataQualityIssues: issues,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const root = process.cwd();
const inputPath = path.join(root, "data", "excel-imports", "factions.json");
const outputPath = path.join(root, "data", "excel-imports", "factions-normalized.json");
const tmpPath = outputPath + ".tmp";

const rawText = await readFile(inputPath, "utf8");
const raw = JSON.parse(rawText) as RawFactionFile;

const summaryRows: RawSummaryRow[] = Array.isArray(raw.summary) ? raw.summary : [];
const detailRows: RawDetailRow[] = Array.isArray(raw.details) ? raw.details : [];
const normalizationWarnings: string[] = [...(raw.warnings ?? [])];

if (summaryRows.length === 0) {
  normalizationWarnings.push("No summary rows found in raw input — output will contain only Luclin factions.");
}

// Normalize each summary row into a FactionEntry
const summaryFactions: FactionEntry[] = summaryRows
  .map((row) => normalizeSummaryRow(row, detailRows, normalizationWarnings))
  .filter((f): f is FactionEntry => f !== null);

// Extract Luclin factions from the details section
const luclinFactions = buildLuclinFactions(detailRows);

// Combine: summary factions first (Velious), then Luclin factions
const allFactions = [...summaryFactions, ...luclinFactions];

const rawTotalCount = summaryRows.length + (luclinFactions.length > 0 ? 1 : 0); // 1 = the Luclin section
const stats = reportStats(rawTotalCount, allFactions, normalizationWarnings);

const output: FactionDataFile = {
  _status: "normalized",
  _normalized_at: new Date().toISOString(),
  _source: "data/excel-imports/factions.json",
  factions: allFactions,
};

// Atomic write: write to .tmp then rename
await writeFile(tmpPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await rename(tmpPath, outputPath);

// Print stats to stdout (matches run-pipeline.ts log capture pattern)
console.log(JSON.stringify(stats, null, 2));
