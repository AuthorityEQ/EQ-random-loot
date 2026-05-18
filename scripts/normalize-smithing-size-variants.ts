import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Component = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: string;
  componentType?: string;
  sizeVariants?: string[];
};

type Recipe = {
  skill: string;
  name: string;
  components: Component[];
  output: { name: string; count: number; imageUrl?: string | null };
  sizeVariants?: string[];
  sourceMetadata?: Record<string, unknown>;
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-smithing-size-variant-report.json");
const sizeVariantPattern = /\(\s*S\s*\|\s*M\s*\|\s*L\s*\)/i;
const sizeVariants = ["Small", "Medium", "Large"];
const sizeVariantCodes = "S|M|L";

function stripSizeVariantShorthand(value: string) {
  return value.replace(sizeVariantPattern, "").replace(/\s+/g, " ").trim();
}

function hasSizeVariant(value: string) {
  return sizeVariantPattern.test(value);
}

function isSizeWeightArtifact(component: Component) {
  return /^\d+(?:\.\d+)?$/.test(component.name.trim());
}

function normalizeComponent(component: Component) {
  if (!hasSizeVariant(component.name)) return component;
  return {
    ...component,
    name: stripSizeVariantShorthand(component.name),
    sizeVariants,
    componentType: /mold|sectional|boot|gauntlet/i.test(component.name)
      ? "mold"
      : component.componentType ?? "ingredient",
  };
}

const data = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, Record<string, unknown>>;
const corrected: Array<Record<string, unknown>> = [];
const removedComponents: Array<Record<string, unknown>> = [];
const migratedItemDetails: Array<Record<string, unknown>> = [];

for (const recipe of data.recipes) {
  if (recipe.skill !== "smithing") continue;
  const rawRecipeName = typeof recipe.sourceMetadata?.rawP99Name === "string" ? recipe.sourceMetadata.rawP99Name : recipe.name;
  const rawOutputName = recipe.output.name;
  const recipeHasSizeVariants = hasSizeVariant(rawRecipeName) || hasSizeVariant(rawOutputName)
    || recipe.components.some((component) => hasSizeVariant(component.name))
    || recipe.sizeVariants?.length;
  if (!recipeHasSizeVariants) continue;

  const cleanedRecipeName = stripSizeVariantShorthand(rawRecipeName);
  const cleanedOutputName = stripSizeVariantShorthand(rawOutputName);
  recipe.name = cleanedRecipeName;
  recipe.output = { ...recipe.output, name: cleanedOutputName };
  recipe.sizeVariants = sizeVariants;
  recipe.sourceMetadata = {
    ...(recipe.sourceMetadata ?? {}),
    rawP99Name: rawRecipeName,
    sizeVariantCodes,
    sizeVariants: sizeVariants.join("|"),
    // TODO: Future Smithing enrichment can split size-specific molds/items,
    // add race-size compatibility, and attach exact mold links per size.
  };

  const normalizedComponents = recipe.components
    .map(normalizeComponent)
    .filter((component) => {
      const remove = isSizeWeightArtifact(component) || hasSizeVariant(component.name);
      if (remove) {
        removedComponents.push({
          recipe: cleanedRecipeName,
          component: component.name,
          reason: isSizeWeightArtifact(component)
            ? "Removed P99 size/weight cell that had been parsed as a component."
            : "Removed raw size shorthand component after normalization.",
        });
      }
      return !remove;
    });
  recipe.components = normalizedComponents;
  const rawDetails = itemDetails[rawRecipeName];
  if (rawDetails && !itemDetails[cleanedOutputName]) {
    itemDetails[cleanedOutputName] = {
      ...rawDetails,
      name: cleanedOutputName,
      rawP99Name: rawRecipeName,
      sizeVariants,
    };
    migratedItemDetails.push({ before: rawRecipeName, after: cleanedOutputName });
  }
  corrected.push({
    id: recipe.sourceMetadata?.id ?? null,
    tableIndex: recipe.sourceMetadata?.tableIndex ?? null,
    row: recipe.sourceMetadata?.row ?? null,
    before: rawRecipeName,
    after: cleanedRecipeName,
    sizeVariants,
    removedNumericComponents: removedComponents.filter((entry) => entry.recipe === cleanedRecipeName).length,
  });
}

const report = {
  correctedCount: corrected.length,
  correctedTables: Array.from(new Set(corrected.map((entry) => entry.tableIndex))).filter((value) => value !== null),
  corrected,
  removedComponents,
  migratedItemDetails,
};

await writeFile(craftingPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Normalized ${corrected.length} Smithing size-variant recipes.`);
console.log(`Removed ${removedComponents.length} malformed size/weight shorthand components.`);
console.log(`Migrated ${migratedItemDetails.length} item-detail aliases to cleaned names.`);
console.log(`Wrote ${reportPath}`);
