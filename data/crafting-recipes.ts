import craftingRecipeData from "@/data/crafting-recipes.json";
import { spellResearchRecipes } from "@/data/crafting-spell-research-recipes";
import type { CraftingRecipe } from "@/lib/crafting";

type CraftingRecipeEnvelope = {
  recipes: CraftingRecipe[];
};

// TODO: Crafting data should be replaced from the new trusted recipe source.
// TODO: Enrich recipe/item images and item stats from Allakhazam or another trusted item source.
// TODO: Add better expansion tags, era tags, and item availability tags during future Allakhazam enrichment.
const baseCraftingRecipes = (craftingRecipeData as CraftingRecipeEnvelope).recipes;

export const craftingRecipes: CraftingRecipe[] = [
  ...baseCraftingRecipes.filter((recipe) => recipe.skill !== "spell-research"),
  ...spellResearchRecipes,
];

export const isCraftingLiveData = true;
