import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type CsvRow = Record<string, string>;

type Recipe = {
  id: number;
  expansion: string;
  tradeskill: string;
  sourceItemId: number;
  skill: "spell-research";
  name: string;
  trivial: number;
  components: Array<{ name: string; count: number }>;
  container: string;
  output: { name: string; count: number };
  notes: string | null;
  sourceUrl: null;
  sourceOutputCount: number;
  sourceMetadata: Record<string, string | number | boolean | null>;
};

const sourcePath = process.argv[2] ?? "C:/Users/at063/Downloads/research_recipes.csv";
const outputPath = resolve("data/crafting-spell-research-recipes.json");

const earlyExpansions = new Set([
  "Original",
  "Ruins of Kunark",
  "Scars of Velious",
  "Shadows of Luclin",
]);

const quillClassMap = new Map<string, string>([
  ["Quill of the Coercer", "Enchanter"],
  ["Quill of the Arcanist", "Wizard"],
  ["Quill of the Arch Lich", "Necromancer"],
  ["Quill of the Arch Convoker", "Magician"],
  ["Quill of the Archon", "Cleric"],
  ["Quill of the Prophet", "Shaman"],
  ["Quill of the Storm Warden", "Druid"],
  ["Quill of the Divine", "Paladin"],
  ["Quill of the Dread Lord", "Shadowknight"],
  ["Quill of the Feral Lord", "Beastlord"],
  ["Quill of the Forest Stalker", "Ranger"],
  ["Quill of the Maestro", "Bard"],
]);

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  if (!headers) return [];
  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.trim().length > 0))
    .map((dataRow) => Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])));
}

function parseIngredientList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d+)\s*x\s+(.+)$/i);
      if (!match) {
        return { name: part, count: 1 };
      }
      return {
        name: match[2].replace(/\s+/g, " ").trim(),
        count: Number(match[1]),
      };
    });
}

function classFromIngredients(components: Array<{ name: string; count: number }>) {
  for (const component of components) {
    const className = quillClassMap.get(component.name);
    if (className) return { className, quillName: component.name };
  }
  return { className: null, quillName: null };
}

const rows = parseCsv(readFileSync(sourcePath, "utf8"));
const skippedRows: Array<{ lineNumber: number; reason: string; row: CsvRow }> = [];
const recipes: Recipe[] = [];

rows.forEach((row, index) => {
  const id = Number(row.id);
  const trivial = Number(row.trivial);
  const name = row.name?.replace(/\s+/g, " ").trim();
  const expansion = row.expansion?.replace(/\s+/g, " ").trim();
  const ingredients = row.ingredients?.trim() ?? "";
  const components = parseIngredientList(ingredients);

  if (!Number.isFinite(id) || !name || !Number.isFinite(trivial) || !expansion || !ingredients || components.length === 0) {
    skippedRows.push({ lineNumber: index + 2, reason: "Missing id, name, trivial, expansion, or ingredients.", row });
    return;
  }

  const { className, quillName } = classFromIngredients(components);
  recipes.push({
    id,
    expansion,
    tradeskill: "Research",
    sourceItemId: id,
    skill: "spell-research",
    name,
    trivial,
    components,
    container: "Spell Research Table",
    output: { name, count: 1 },
    notes: className ? `Research class inferred from ${quillName}.` : null,
    sourceUrl: null,
    sourceOutputCount: 1,
    sourceMetadata: {
      sourceDataset: "research_recipes.csv",
      originalExpansion: expansion,
      rawIngredients: ingredients,
      researchClass: className,
      researchClassQuill: quillName,
      isEarlyEraResearch: earlyExpansions.has(expansion),
      // TODO: Future enrichment can add zone/vendor/component sourcing.
      // TODO: Future enrichment can add Allakhazam links and subcombine chains.
      // TODO: Future enrichment can add advanced expansion validation, spell levels, and missing spell classes.
    },
  });
});

const expansions = Array.from(new Set(recipes.map((recipe) => recipe.expansion))).sort((a, b) => a.localeCompare(b));
const classCounts = recipes.reduce<Record<string, number>>((counts, recipe) => {
  const className = typeof recipe.sourceMetadata.researchClass === "string" ? recipe.sourceMetadata.researchClass : "Unmapped";
  counts[className] = (counts[className] ?? 0) + 1;
  return counts;
}, {});
const expansionCounts = recipes.reduce<Record<string, number>>((counts, recipe) => {
  counts[recipe.expansion] = (counts[recipe.expansion] ?? 0) + 1;
  return counts;
}, {});

const payload = {
  source: "Structured Research combine dataset",
  sourceFile: sourcePath,
  parsedAt: new Date().toISOString(),
  parserNotes: [
    "CSV columns id, name, trivial, expansion, and ingredients are treated as recipeId, output/result, trivial, expansion, and component list.",
    "Ingredient strings are split on commas and parsed from the '<count>x <name>' pattern.",
    "Research class is inferred from known quill ingredients when present.",
    "ShareCraft cache extraction remains preserved separately for future component sourcing/subcombine enrichment.",
  ],
  skippedRows,
  expansions,
  classCounts,
  expansionCounts,
  recipes,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({
  sourcePath,
  outputPath,
  imported: recipes.length,
  skipped: skippedRows.length,
  classCounts,
  expansionCounts,
}, null, 2));
