import type { CraftingRecipe } from "@/lib/crafting";

function normalizeRecipeIdPart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function getCraftingRecipeId(recipe: Pick<CraftingRecipe, "id" | "skill" | "name" | "trivial" | "output">) {
  if (recipe.id !== null && recipe.id !== undefined && String(recipe.id).trim()) {
    return `${recipe.skill}:${String(recipe.id).trim()}`;
  }

  const outputName = recipe.output?.name || recipe.name;
  return [
    recipe.skill,
    normalizeRecipeIdPart(outputName),
    recipe.trivial ?? "unknown",
  ].join(":");
}

export function normalizeSavedCraftingRecipeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));
}
