/**
 * normalize-crafting-data.ts
 *
 * Transforms the raw Excel ingest output (data/excel-imports/crafting.json)
 * into the canonical CraftingRecipe[] shape expected by lib/crafting.ts.
 *
 * Output files:
 *   data/excel-imports/crafting-normalized.json        — { recipes: CraftingRecipe[] }
 *   data/excel-imports/crafting-normalization-report.json — stats + unmatched component names
 *
 * Usage:
 *   node --experimental-strip-types scripts/normalize-crafting-data.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CraftingSkill =
  | "tailoring"
  | "fletching"
  | "blacksmithing"
  | "jewelcraft"
  | "spell-research";

interface CraftingComponent {
  name: string;
  count: number;
}

interface CraftingRecipe {
  skill: CraftingSkill;
  name: string;
  trivial: number | null;
  components: CraftingComponent[];
  container: string;
  output: { name: string; count: number };
  notes: string | null;
}

interface RawRecord {
  _source_row: number;
  craft_type: string;
  recipe_name: string;
  trivial: number | null | undefined;
  ingredients: string | null | undefined;
  category?: string;
  notes?: string | null;
  // Jewelcraft-specific extra columns (not needed for output, but help parsing)
  metal_bar?: string;
  gem?: string;
  stats?: string;
}

interface RawInput {
  sheet_name: string;
  row_count: number;
  extracted_at: string;
  craft_types: string[];
  records: RawRecord[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, "data", "excel-imports", "crafting.json");
const OUTPUT_PATH = path.join(ROOT, "data", "excel-imports", "crafting-normalized.json");
const REPORT_PATH = path.join(ROOT, "data", "excel-imports", "crafting-normalization-report.json");
const ITEM_DETAILS_PATH = path.join(ROOT, "data", "item-details.json");

/** Maps raw craft_type strings to canonical CraftingSkill slugs. */
const SKILL_MAP: Record<string, CraftingSkill> = {
  "Tailoring": "tailoring",
  "Fletching": "fletching",
  "Blacksmithing": "blacksmithing",
  "Jewelcraft": "jewelcraft",
  "Spell Research": "spell-research",
};

/** Default container for each skill when the raw data provides none. */
const DEFAULT_CONTAINER: Record<CraftingSkill, string> = {
  tailoring: "Loom",
  fletching: "Fletcher's Kit",
  blacksmithing: "Forge",
  jewelcraft: "Jeweler's Kit",
  "spell-research": "Spell Research Kit",
};

// ---------------------------------------------------------------------------
// Ingredient string parsing
// ---------------------------------------------------------------------------

/**
 * Splits a raw ingredient string into individual token strings, respecting
 * parenthesized sub-lists so that "Various Pelts (Rat, Snake, Wolf, Bear)"
 * is not split on the commas inside the parens.
 *
 * The only primary separator recognised is ", " (comma-space) or "+" (with
 * optional surrounding spaces).
 */
function splitIngredientTokens(raw: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (depth === 0 && ch === "+") {
      // "+" separator (some potion / research recipes)
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = "";
    } else if (depth === 0 && ch === "," && raw[i + 1] === " ") {
      // ", " separator
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = "";
      i++; // skip the space
    } else {
      current += ch;
    }
  }

  const last = current.trim();
  if (last) tokens.push(last);

  return tokens;
}

/**
 * Parses a single token such as:
 *   "Arrow Shaft"            -> { name: "Arrow Shaft", count: 1 }
 *   "Metal Bits x2"          -> { name: "Metal Bits", count: 2 }
 *   "Sheet Metal x3"         -> { name: "Sheet Metal", count: 3 }
 *   "Silver Bar (2)"         -> { name: "Silver Bar", count: 2 }
 *   "Various Pelts (Rat, ...)"  -> { name: "Various Pelts (Rat, ...)", count: 1 }
 *
 * Disambiguation rule: a trailing "(N)" where N is a plain integer is treated
 * as a count qualifier.  Any other parenthesised content (letters/commas) is
 * kept as part of the name.
 */
function parseIngredientToken(token: string): CraftingComponent {
  // Pattern: trailing " xN" or " x N" (case-insensitive)
  const xCountMatch = token.match(/^(.+?)\s+[xX](\d+)$/);
  if (xCountMatch) {
    return { name: xCountMatch[1].trim(), count: parseInt(xCountMatch[2], 10) };
  }

  // Pattern: trailing " (N)" where N is purely numeric
  const parenCountMatch = token.match(/^(.+?)\s*\((\d+)\)$/);
  if (parenCountMatch) {
    return { name: parenCountMatch[1].trim(), count: parseInt(parenCountMatch[2], 10) };
  }

  // Default: count 1
  return { name: token.trim(), count: 1 };
}

/**
 * Full ingredient string -> components array.
 * Returns an empty array when the input is blank/null.
 */
function parseIngredients(raw: string | null | undefined): CraftingComponent[] {
  if (!raw || raw.trim() === "") return [];

  const tokens = splitIngredientTokens(raw.trim());
  return tokens.map(parseIngredientToken).filter((c) => c.name.length > 0);
}

// ---------------------------------------------------------------------------
// Skill + container helpers
// ---------------------------------------------------------------------------

function resolveSkill(craftType: string): CraftingSkill | null {
  return SKILL_MAP[craftType.trim()] ?? null;
}

function resolveContainer(skill: CraftingSkill, rawContainer?: string): string {
  if (rawContainer && rawContainer.trim().length > 0) return rawContainer.trim();
  return DEFAULT_CONTAINER[skill];
}

// ---------------------------------------------------------------------------
// Section header / legend row detection
// ---------------------------------------------------------------------------

/**
 * Returns true if a record appears to be a section header, legend entry, or
 * otherwise not a real recipe row.
 *
 * Heuristics:
 * - recipe_name is missing or blank
 * - recipe_name matches known legend/header keywords
 * - trivial is missing AND ingredients is missing
 */
const HEADER_PATTERNS = [
  /^recipe(\s+name)?$/i,
  /^name$/i,
  /^header$/i,
  /^legend$/i,
  /^notes?$/i,
  /^category$/i,
  /^skill$/i,
  /^trivial$/i,
  /^ingredients?$/i,
];

function isHeaderRow(record: RawRecord): boolean {
  if (!record.recipe_name || record.recipe_name.trim() === "") return true;
  for (const pattern of HEADER_PATTERNS) {
    if (pattern.test(record.recipe_name.trim())) return true;
  }
  // No trivial and no ingredients strongly suggests a non-recipe row
  if (record.trivial == null && (!record.ingredients || record.ingredients.trim() === "")) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

function normalizeRecord(record: RawRecord): CraftingRecipe | null {
  if (isHeaderRow(record)) return null;

  const skill = resolveSkill(record.craft_type ?? "");
  if (skill === null) return null;

  const name = record.recipe_name.trim();
  const trivial = typeof record.trivial === "number" ? record.trivial : null;
  const components = parseIngredients(record.ingredients);
  const container = resolveContainer(skill);

  // Output is the recipe itself (output name = recipe name, count = 1)
  const output = { name, count: 1 };

  const rawNotes = record.notes?.trim() ?? null;
  const notes = rawNotes && rawNotes.length > 0 ? rawNotes : null;

  return { skill, name, trivial, components, container, output, notes };
}

// ---------------------------------------------------------------------------
// Cross-check against item-details.json
// ---------------------------------------------------------------------------

function loadItemDetailsKeys(): Set<string> {
  try {
    const raw = readFileSync(ITEM_DETAILS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return new Set(Object.keys(parsed));
  } catch {
    console.warn("  [warn] Could not read item-details.json — skipping cross-check.");
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  console.log("normalize-crafting-data: starting");

  // --- Load input ---
  let rawInput: RawInput;
  try {
    rawInput = JSON.parse(readFileSync(INPUT_PATH, "utf8")) as RawInput;
  } catch (err) {
    console.error(`  [error] Failed to read ${INPUT_PATH}: ${err}`);
    process.exit(1);
  }

  console.log(`  Input: ${rawInput.records.length} raw records from "${rawInput.sheet_name}"`);

  // --- Normalize ---
  const recipes: CraftingRecipe[] = [];
  let skippedRows = 0;
  let skippedBadSkill = 0;

  for (const record of rawInput.records) {
    if (isHeaderRow(record)) {
      skippedRows++;
      continue;
    }
    const recipe = normalizeRecord(record);
    if (recipe === null) {
      skippedBadSkill++;
      continue;
    }
    recipes.push(recipe);
  }

  console.log(`  Normalized: ${recipes.length} recipes`);
  console.log(`  Skipped header/legend rows: ${skippedRows}`);
  console.log(`  Skipped unknown skill rows: ${skippedBadSkill}`);

  // --- Skill breakdown ---
  const bySkill = new Map<CraftingSkill, number>();
  for (const r of recipes) {
    bySkill.set(r.skill, (bySkill.get(r.skill) ?? 0) + 1);
  }

  console.log("  By skill:");
  for (const [skill, count] of [...bySkill.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`    ${skill}: ${count}`);
  }

  // --- Cross-check components against item-details ---
  const itemKeys = loadItemDetailsKeys();
  const unmatchedSet = new Set<string>();
  const matchedSet = new Set<string>();

  for (const recipe of recipes) {
    for (const comp of recipe.components) {
      if (itemKeys.size === 0) break;
      if (itemKeys.has(comp.name)) {
        matchedSet.add(comp.name);
      } else {
        unmatchedSet.add(comp.name);
      }
    }
  }

  const unmatchedList = [...unmatchedSet].sort();
  const matchedList = [...matchedSet].sort();

  if (itemKeys.size > 0) {
    console.log(
      `  Component cross-check: ${matchedList.length} matched, ${unmatchedList.length} unmatched vs item-details.json`,
    );
  }

  // --- Write normalized output ---
  const normalizedOutput = { recipes };
  writeFileSync(OUTPUT_PATH, JSON.stringify(normalizedOutput, null, 2) + "\n", "utf8");
  console.log(`  Wrote: ${OUTPUT_PATH}`);

  // --- Write normalization report ---
  const report = {
    generated_at: new Date().toISOString(),
    source: INPUT_PATH,
    stats: {
      raw_record_count: rawInput.records.length,
      recipes_normalized: recipes.length,
      skipped_header_rows: skippedRows,
      skipped_unknown_skill: skippedBadSkill,
      by_skill: Object.fromEntries(bySkill.entries()),
      trivial_null_count: recipes.filter((r) => r.trivial === null).length,
      total_components: recipes.reduce((n, r) => n + r.components.length, 0),
      recipes_with_no_components: recipes.filter((r) => r.components.length === 0).length,
    },
    component_cross_check: {
      item_details_loaded: itemKeys.size > 0,
      item_details_key_count: itemKeys.size,
      matched_component_names: matchedList,
      unmatched_component_names: unmatchedList,
      unmatched_count: unmatchedList.length,
      matched_count: matchedList.length,
      note: "Unmatched names are candidates for future enrichment in item-details.json.",
    },
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`  Wrote: ${REPORT_PATH}`);

  console.log("normalize-crafting-data: done");
}

main();
