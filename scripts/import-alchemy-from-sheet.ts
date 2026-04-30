/**
 * import-alchemy-from-sheet.ts
 *
 * Fetches alchemy recipes from a public Google Sheet (CSV export) and merges
 * them into data/excel-imports/crafting-normalized.json alongside the existing
 * 65 P99 recipes.
 *
 * Sheet URL: https://docs.google.com/spreadsheets/d/1F4NQcujojtxNRub_E9SqUm5qYpLJqCgWEDxhvqnaVs4
 * CSV export: https://docs.google.com/spreadsheets/d/1F4NQcujojtxNRub_E9SqUm5qYpLJqCgWEDxhvqnaVs4/export?format=csv&gid=0
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-alchemy-from-sheet.ts
 *   node --experimental-strip-types scripts/import-alchemy-from-sheet.ts --force   # re-fetch CSV
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlchemyRecipe {
  skill: "alchemy";
  name: string;
  trivial: number | null;
  components: Array<{ name: string; count: number }>;
  container: string;
  output: { name: string; count: number };
  notes: string | null;
}

interface NormalizedCrafting {
  recipes: Array<{
    skill: string;
    name: string;
    trivial: number | null;
    components: Array<{ name: string; count: number }>;
    container: string;
    output: { name: string; count: number };
    notes?: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, "cache", "alchemy-pages");
const CACHE_FILE = path.join(CACHE_DIR, "sheet-export.csv");
const OUTPUT_PATH = path.join(ROOT, "data", "excel-imports", "crafting-normalized.json");

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1F4NQcujojtxNRub_E9SqUm5qYpLJqCgWEDxhvqnaVs4/export?format=csv&gid=0";

const ERA_TRIVIAL_CAP = 200;
const CONTAINER = "Medicine Bag";

// ---------------------------------------------------------------------------
// CSV parsing (handles quoted fields with embedded commas/newlines)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ",") i++;
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
  }
  return fields;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === "") continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Ingredient name normalization
// Capitalize each word; fix known abbreviations seen in the sheet
// ---------------------------------------------------------------------------

const INGREDIENT_ALIASES: Record<string, string> = {
  lucern: "Lucerne",
  birthwart: "Birthwort", // typo in sheet row 23
  "sage leaf": "Sage Leaf",
  fenugreek: "Fenugreek",
  "blue vervain bulb": "Blue Vervain Bulb",
  "valerian root": "Valerian Root",
  "mandrake root": "Mandrake Root",
  allspice: "Allspice",
  "maidenhair fern": "Maidenhair Fern",
  mullein: "Mullein",
  benzoin: "Benzoin",
  "night shade": "Night Shade",
  sumbul: "Sumbul",
  clubmoss: "Clubmoss",
  comfrey: "Comfrey",
  mercury: "Mercury",
  heliotrope: "Heliotrope",
  sandlewood: "Sandalwood",
  sandalwood: "Sandalwood",
  oakmoss: "Oakmoss",
  figwort: "Figwort",
  bladderwrack: "Bladderwrack",
  "star reach clover": "Star Reach Clover",
  yarrow: "Yarrow",
  agrimony: "Agrimony",
  "balm leaf": "Balm Leaves",
  "balm leaves": "Balm Leaves",
  "hill giant toes": "Hill Giant Toes",
  "fire giant toes": "Fire Giant Toes",
  "ice giant toes": "Ice Giant Toes",
  dragonwart: "Dragonwart",
  dhea: "Dhea",
  hyssop: "Hyssop",
  "lady's mantle": "Lady's Mantle",
  echinacea: "Echinacea",
  elderberry: "Elderberry",
  fennel: "Fennel",
  "eucalyptus leaf": "Eucalyptus Leaf",
  jatamasi: "Jatamasi",
  hydrangea: "Hydrangea",
  "mystic ash": "Mystic Ash",
  celandine: "Celandine Herb",
  "celandine herb": "Celandine Herb",
  "wolf blood": "Wolf Blood",
  clover: "Clover",
  "scale skin": "Scale Skin",
  birthwort: "Birthwort",
  "snake scale": "Snake Scale",
  "batwing": "Batwing",
  "cyclops eye": "Cyclops Eye",
  bugbane: "Bugbane",
  yerbhimba: "Yerbhimba",
  "sickle leaf": "Sickle Leaf",
  "blade leaf": "Blade Leaf",
  "betherium bark": "Betherium Bark",
  "duskglow vine": "Duskglow Vine",
  "violet tri-tube sap": "Violet Tri-Tube Sap",
  "tri-fern leaf": "Tri-Fern Leaf",
  "maliak leaf": "Maliak Leaf",
  wormwood: "Wormwood",
  "racial parts": "Racial Parts",
  "fish scale": "Fish Scale",
};

function normalizeIngredient(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === "") return "";
  if (INGREDIENT_ALIASES[lower]) return INGREDIENT_ALIASES[lower];
  // Title-case fallback
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Parse CSV rows into recipe objects
//
// Sheet column layout (repeated across 5 section blocks):
//   Col 0: Potion Name
//   Col 1: Ingred 1
//   Col 2: Ingred 2
//   Col 3: Ingred 3
//   Col 4: (blank)
//   Col 5: cost in pp
//   Col 6: Trivial
//   Col 7: Effect
//   Col 8: Duration
//   Col 9: (blank)
//   Col 10: notes
//
// Section title rows: col[0] has text, remaining cols are all empty
// Column header rows: col[0] == "Potion Name" (case-insensitive)
// ---------------------------------------------------------------------------

const SECTION_TITLE_KEYWORDS = [
  "stat/resist",
  "gate",
  "hp/mana",
  "heals",
  "movement",
];

function isSectionTitle(row: string[]): boolean {
  const first = (row[0] ?? "").trim().toLowerCase();
  if (!first) return false;
  const rest = row.slice(1).every((c) => c.trim() === "");
  if (!rest) return false;
  return SECTION_TITLE_KEYWORDS.some((kw) => first.includes(kw));
}

function isHeaderRow(row: string[]): boolean {
  return (row[0] ?? "").trim().toLowerCase() === "potion name";
}

function parseTrivial(raw: string): number | null {
  const s = raw.trim();
  if (!s || s === "n/a" || s === "???") return null;
  // ">NNN" means explicitly over that level — return NNN+1 so it exceeds the era cap
  const gtMatch = s.match(/^>(\d+)/);
  if (gtMatch) return parseInt(gtMatch[1], 10) + 1;
  // Handle ranges like "162-176" — take the lower bound
  const rangeMatch = s.match(/^(\d+)-\d+/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  // Handle "244?" etc
  const numMatch = s.match(/^(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
}

function parseSheetRows(rows: string[][]): AlchemyRecipe[] {
  const recipes: AlchemyRecipe[] = [];

  for (const row of rows) {
    if (isSectionTitle(row)) continue;
    if (isHeaderRow(row)) continue;

    const name = (row[0] ?? "").trim();
    if (!name) continue;

    const ingred1 = (row[1] ?? "").trim();
    const ingred2 = (row[2] ?? "").trim();
    const ingred3 = (row[3] ?? "").trim();
    const trivialRaw = (row[6] ?? "").trim();
    const effectRaw = (row[7] ?? "").trim();
    const notesColRaw = (row[10] ?? "").trim();

    // Skip if no ingredients at all (malformed row)
    if (!ingred1 && !ingred2 && !ingred3) continue;

    const trivial = parseTrivial(trivialRaw);

    // Build components from non-empty ingredients
    // Ingredients in CAPS (per sheet convention) are rare drops — keep them
    const components: Array<{ name: string; count: number }> = [];
    for (const raw of [ingred1, ingred2, ingred3]) {
      if (!raw) continue;
      const normalized = normalizeIngredient(raw);
      if (normalized) {
        components.push({ name: normalized, count: 1 });
      }
    }

    if (components.length === 0) continue;

    const notes = effectRaw || notesColRaw || null;

    recipes.push({
      skill: "alchemy",
      name,
      trivial,
      components,
      container: CONTAINER,
      output: { name, count: 1 },
      notes: notes || null,
    });
  }

  return recipes;
}

// ---------------------------------------------------------------------------
// Dedup logic
//
// The sheet uses short names ("Lesser Stability") while P99 uses full canonical
// names ("Potion of Lesser Stability"). We can't rely on name matching alone.
// Use a component-signature key (sorted normalized ingredient names) to detect
// structural duplicates. If the component signature matches an existing recipe,
// skip the sheet entry — the P99 canonical version is preferred.
// ---------------------------------------------------------------------------

function componentSignature(components: Array<{ name: string; count: number }>): string {
  return components
    .map((c) => `${c.name.toLowerCase()}x${c.count}`)
    .sort()
    .join("|");
}

function mergeWithExisting(
  sheetRecipes: AlchemyRecipe[],
  existing: NormalizedCrafting,
): { merged: NormalizedCrafting; added: number; skipped: number } {
  const existingAlchemy = existing.recipes.filter((r) => r.skill === "alchemy");
  const nonAlchemy = existing.recipes.filter((r) => r.skill !== "alchemy");

  // Build signature set from existing alchemy
  const existingSigs = new Set<string>(
    existingAlchemy.map((r) => componentSignature(r.components)),
  );

  // Also build name set (normalized lowercase) for exact-name dedup
  const existingNames = new Set<string>(
    existingAlchemy.map((r) => r.name.toLowerCase()),
  );

  const toAdd: AlchemyRecipe[] = [];
  let skipped = 0;

  for (const recipe of sheetRecipes) {
    const sig = componentSignature(recipe.components);
    const nameLower = recipe.name.toLowerCase();

    if (existingSigs.has(sig) || existingNames.has(nameLower)) {
      skipped++;
      continue;
    }

    toAdd.push(recipe);
    existingSigs.add(sig);
    existingNames.add(nameLower);
  }

  // Sort all alchemy: trivial asc (null last), then name
  const allAlchemy = [...existingAlchemy, ...toAdd].sort((a, b) => {
    if (a.trivial === null && b.trivial === null) return a.name.localeCompare(b.name);
    if (a.trivial === null) return 1;
    if (b.trivial === null) return -1;
    return a.trivial - b.trivial || a.name.localeCompare(b.name);
  });

  return {
    merged: { recipes: [...nonAlchemy, ...allAlchemy] },
    added: toAdd.length,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// Fetch / cache helpers
// ---------------------------------------------------------------------------

async function fetchCsv(force: boolean): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });

  if (!force && existsSync(CACHE_FILE)) {
    console.log(`  [cache] Using cached CSV: ${CACHE_FILE}`);
    return readFile(CACHE_FILE, "utf8");
  }

  console.log(`  [fetch] Downloading: ${SHEET_CSV_URL}`);
  const resp = await fetch(SHEET_CSV_URL);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText} fetching sheet CSV`);
  }
  const text = await resp.text();
  await writeFile(CACHE_FILE, text, "utf8");
  console.log(`  [cache] Saved to: ${CACHE_FILE}`);
  return text;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const force = process.argv.includes("--force");

  console.log("import-alchemy-from-sheet: starting");
  console.log(`  Sheet:  ${SHEET_CSV_URL}`);
  console.log(`  Cache:  ${CACHE_FILE}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
  console.log(`  Era filter: trivial <= ${ERA_TRIVIAL_CAP}`);
  if (force) console.log("  --force: will re-fetch CSV");

  // 1. Fetch CSV (or load cache)
  const csvText = await fetchCsv(force);
  const rows = parseCsv(csvText);
  console.log(`  CSV rows parsed: ${rows.length}`);

  // 2. Parse into recipe objects
  const parsed = parseSheetRows(rows);
  console.log(`  Recipes parsed from sheet: ${parsed.length}`);

  // 3. Era cap
  // Keep: null trivial (genuinely unknown) OR trivial <= cap
  // Exclude: trivial > cap (includes items marked ">200" in sheet, stored as 201+)
  const eraCapped = parsed.filter(
    (r) => r.trivial === null || r.trivial <= ERA_TRIVIAL_CAP,
  );
  const eraFiltered = parsed.length - eraCapped.length;
  console.log(`  After era cap (trivial <= ${ERA_TRIVIAL_CAP}): ${eraCapped.length} kept, ${eraFiltered} filtered`);

  if (eraFiltered > 0) {
    console.log("  Filtered out (trivial > 200):");
    for (const r of parsed.filter((r) => r.trivial !== null && r.trivial > ERA_TRIVIAL_CAP)) {
      console.log(`    - ${r.name} (trivial: ${r.trivial})`);
    }
  }

  // 4. Load existing
  const existingRaw = await readFile(OUTPUT_PATH, "utf8");
  const existing: NormalizedCrafting = JSON.parse(existingRaw);
  const recipesBefore = existing.recipes.filter((r) => r.skill === "alchemy").length;

  // 5. Merge + dedup
  const { merged, added, skipped } = mergeWithExisting(eraCapped, existing);
  const recipesAfter = merged.recipes.filter((r) => r.skill === "alchemy").length;

  // 6. Write output
  await writeFile(OUTPUT_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");

  // 7. Stats
  const stats = {
    rowsRead: rows.length,
    rowsParsed: parsed.length,
    rowsKept: eraCapped.length,
    rowsSkipped: skipped,
    eraFiltered,
    recipesBefore,
    recipesAfter,
    newRecipesAdded: added,
  };

  console.log("\nimport-alchemy-from-sheet: complete");
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
