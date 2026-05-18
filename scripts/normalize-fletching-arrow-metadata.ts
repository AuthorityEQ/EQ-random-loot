import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Component = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: string;
  componentType?: string;
};

type Recipe = {
  id?: string;
  skill: string;
  name: string;
  expansion?: string | null;
  components: Component[];
  output: { name: string; count: number; imageUrl?: string | null };
  arrowMetadata?: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
};

type ItemDetails = {
  damage?: number | null;
  slot?: string | null;
  sources?: Array<{ name: string; url: string }>;
  [key: string]: unknown;
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-fletching-arrow-metadata-report.json");
const nockSizes = new Set(["Small", "Medium", "Large"]);

function parseRangeOptions(details?: ItemDetails) {
  const slot = String(details?.slot ?? "");
  const match = slot.match(/\bRange:\s*([0-9 /]+)\b/i);
  if (!match) return [];
  return match[1].split("/").map((entry) => Number(entry.trim())).filter((value) => Number.isFinite(value));
}

function rangeForNock(nockSize: string, ranges: number[]) {
  if (ranges.length === 0) return null;
  const sorted = [...ranges].sort((a, b) => a - b);
  if (/small/i.test(nockSize)) return sorted[0] ?? null;
  if (/medium/i.test(nockSize)) return sorted[Math.floor(sorted.length / 2)] ?? null;
  if (/large/i.test(nockSize)) return sorted[sorted.length - 1] ?? null;
  return null;
}

function classifyPoint(name: string) {
  return /hooked/i.test(name) && !/\bpoint\b/i.test(name) ? `${name} Point` : name;
}

const data = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const corrected: Array<Record<string, unknown>> = [];
const unresolvedNockComponents: Array<Record<string, unknown>> = [];

for (const recipe of data.recipes) {
  if (recipe.skill !== "fletching" || !/arrow/i.test(recipe.name)) continue;
  const nockComponent = recipe.components.find((component) => nockSizes.has(component.name));
  const alreadyMetadata = typeof recipe.arrowMetadata?.nockSize === "string";
  if (!nockComponent && !alreadyMetadata) continue;

  const point = classifyPoint(String(recipe.arrowMetadata?.point ?? recipe.sourceMetadata?.arrowPoint ?? recipe.components[0]?.name ?? ""));
  const shaft = String(recipe.arrowMetadata?.shaft ?? recipe.sourceMetadata?.arrowShaft ?? recipe.components[1]?.name ?? "");
  const fletch = String(recipe.arrowMetadata?.fletch ?? recipe.sourceMetadata?.arrowFletch ?? recipe.components[2]?.name ?? "");
  const nockSize = String(recipe.arrowMetadata?.nockSize ?? recipe.sourceMetadata?.arrowNockSize ?? nockComponent?.name ?? "");
  const details = itemDetails[recipe.output.name] ?? itemDetails[recipe.name];
  const rangeOptions = parseRangeOptions(details);
  const range = typeof recipe.arrowMetadata?.range === "number"
    ? recipe.arrowMetadata.range
    : rangeForNock(nockSize, rangeOptions);
  const damage = typeof recipe.arrowMetadata?.damage === "number"
    ? recipe.arrowMetadata.damage
    : typeof details?.damage === "number"
      ? details.damage
      : null;

  recipe.components = recipe.components
    .filter((component) => !nockSizes.has(component.name))
    .map((component, index) => index === 0 && /hooked/i.test(component.name) && !/\bpoint\b/i.test(component.name)
      ? { ...component, name: classifyPoint(component.name) }
      : component);
  recipe.arrowMetadata = {
    ...(recipe.arrowMetadata ?? {}),
    damage,
    range,
    cost: recipe.arrowMetadata?.cost ?? recipe.sourceMetadata?.arrowCost ?? null,
    point,
    shaft,
    fletch,
    nockSize,
    rangeOptions,
    unresolvedNockComponent: Boolean(nockSize),
  };
  recipe.sourceMetadata = {
    ...(recipe.sourceMetadata ?? {}),
    arrowTable: true,
    arrowDamage: damage,
    arrowRange: range,
    arrowPoint: point,
    arrowShaft: shaft,
    arrowFletch: fletch,
    arrowNockSize: nockSize,
    arrowRangeOptions: rangeOptions.join("|") || null,
    unresolvedNockComponent: Boolean(nockSize),
  };
  corrected.push({
    id: recipe.id ?? null,
    name: recipe.name,
    removedIngredient: nockComponent?.name ?? null,
    nockSize,
    damage,
    range,
    point,
    shaft,
    fletch,
  });
  if (nockSize) {
    unresolvedNockComponents.push({
      recipe: recipe.name,
      nockSize,
      note: "P99 source provides nock size, but this pass did not confidently map it to a standalone nock item name.",
    });
  }
}

const report = {
  correctedCount: corrected.length,
  removedRawNockIngredientCount: corrected.filter((entry) => entry.removedIngredient).length,
  corrected,
  unresolvedNockComponents,
};

await writeFile(craftingPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Normalized ${corrected.length} Fletching arrow recipes.`);
console.log(`Removed ${report.removedRawNockIngredientCount} raw nock-size ingredient chips.`);
console.log(`Unresolved nock component mappings: ${unresolvedNockComponents.length}`);
console.log(`Wrote ${reportPath}`);
