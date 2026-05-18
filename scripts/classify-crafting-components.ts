import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ComponentType =
  | "finalItem"
  | "ingredient"
  | "template"
  | "intermediate"
  | "mold"
  | "sketch"
  | "firingComponent"
  | "processComponent"
  | "unknown";

type Component = {
  name: string;
  count: number;
  componentType?: ComponentType;
  sourceNotes?: string | null;
  placeholderDescription?: string | null;
  templateOptions?: string[];
  dataQualityNote?: string | null;
  [key: string]: unknown;
};

type Recipe = {
  skill: string;
  name: string;
  components: Component[];
  sourceMetadata?: Record<string, unknown>;
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const reportPath = path.join(root, "data", "crafting-component-classification-report.json");

function classifyComponent(name: string, recipe: Recipe): ComponentType {
  if (/\bfiring sheet\b/i.test(name)) return "firingComponent";
  if (/\btemplate\b/i.test(name)) return "template";
  if (/\bsketch\b/i.test(name)) return "sketch";
  if (/\bmold\b/i.test(name)) return "mold";
  if (/^unfired\b/i.test(name)) return "intermediate";
  if (recipe.sourceMetadata?.potteryTwoStage === true && /^(clay\/water mixture|small block of clay|block of clay|large block of clay)$/i.test(name)) return "processComponent";
  if (/\b(?:kiln trivial|pottery wheel trivial|wheel trivial|trivial)\b/i.test(name)) return "processComponent";
  return "ingredient";
}

function describeTemplate(name: string, recipe: Recipe) {
  const base = name.replace(/\s+Template$/i, "").trim();
  const shape = base ? `${base.toLowerCase()}-shaped` : "template-based";
  return `Template component used for ${shape} ${recipe.skill === "pottery" ? "pottery" : "crafting"}. See recipe/source for valid template options.`;
}

const data = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[]; [key: string]: unknown };
const counts: Record<ComponentType, number> = {
  finalItem: 0,
  ingredient: 0,
  template: 0,
  intermediate: 0,
  mold: 0,
  sketch: 0,
  firingComponent: 0,
  processComponent: 0,
  unknown: 0,
};
const reclassified = new Map<string, { componentType: ComponentType; count: number; recipes: Set<string> }>();
const templatePlaceholders = new Map<string, {
  count: number;
  recipes: Set<string>;
  hasImportedOptions: boolean;
  sampleDescription: string;
}>();

for (const recipe of data.recipes) {
  for (const component of recipe.components) {
    const componentType = classifyComponent(component.name, recipe);
    component.componentType = componentType;
    counts[componentType] += 1;
    if (componentType !== "ingredient") {
      const entry = reclassified.get(component.name) ?? { componentType, count: 0, recipes: new Set<string>() };
      entry.count += 1;
      entry.recipes.add(recipe.name);
      reclassified.set(component.name, entry);
      component.sourceNotes = component.sourceNotes ?? "Classified as a crafting process component; not treated as a missing enriched item.";
      if (componentType === "template") {
        const description = describeTemplate(component.name, recipe);
        const options = Array.isArray(component.templateOptions) ? component.templateOptions.filter((option) => typeof option === "string" && option.trim()) : [];
        component.placeholderDescription = description;
        component.templateOptions = options;
        component.dataQualityNote = options.length > 0
          ? null
          : "Specific template options not imported yet.";
        component.sourceNotes = options.length > 0
          ? `${description} Valid options: ${options.join(" / ")}.`
          : `${description} Specific template options not imported yet.`;

        const placeholder = templatePlaceholders.get(component.name) ?? {
          count: 0,
          recipes: new Set<string>(),
          hasImportedOptions: false,
          sampleDescription: description,
        };
        placeholder.count += 1;
        placeholder.recipes.add(recipe.name);
        placeholder.hasImportedOptions = placeholder.hasImportedOptions || options.length > 0;
        templatePlaceholders.set(component.name, placeholder);
      }
    }
  }
}

const report = {
  counts,
  reclassified: Array.from(reclassified.entries())
    .map(([name, entry]) => ({
      name,
      componentType: entry.componentType,
      count: entry.count,
      sampleRecipes: Array.from(entry.recipes).slice(0, 8),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  templatePlaceholders: Array.from(templatePlaceholders.entries())
    .map(([name, entry]) => ({
      name,
      componentType: "template",
      count: entry.count,
      hasImportedOptions: entry.hasImportedOptions,
      sampleRecipes: Array.from(entry.recipes).slice(0, 8),
      description: entry.sampleDescription,
      dataQualityNote: entry.hasImportedOptions ? null : "Specific template options not imported yet.",
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  notes: [
    "TODO: Future work may map template items to real recipes.",
    "TODO: Future enrichment should map template placeholders to actual valid component item names from P99 or Allakhazam.",
    "TODO: Future work may map intermediate items to combine chains.",
    "TODO: Future work may add process-stage diagrams/workflows.",
  ],
};

await writeFile(craftingPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Classified ${Object.values(counts).reduce((sum, count) => sum + count, 0)} crafting components.`);
console.log(`Reclassified ${report.reclassified.length} unique process/template/intermediate components.`);
console.log(`Wrote ${reportPath}`);
