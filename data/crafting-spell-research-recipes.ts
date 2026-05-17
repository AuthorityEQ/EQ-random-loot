import spellResearchRecipeData from "@/data/crafting-spell-research-recipes.json";
import type { CraftingRecipe } from "@/lib/crafting";

type SpellResearchRecipeEnvelope = {
  recipes: CraftingRecipe[];
  skippedRows: Array<{ lineNumber: number; reason: string }>;
  expansions: string[];
};

// TODO: Future enrichment can add zone/vendor/component sourcing.
// TODO: Future enrichment can add Allakhazam links and subcombine chains.
// TODO: Future enrichment can add advanced expansion validation, missing spell levels, and missing spell classes.
// TODO: Preserve ShareCraft cache extraction as the long-term enrichment pipeline for component source metadata.
export const spellResearchRecipes: CraftingRecipe[] =
  (spellResearchRecipeData as SpellResearchRecipeEnvelope).recipes;

export const spellResearchSkippedRows =
  (spellResearchRecipeData as SpellResearchRecipeEnvelope).skippedRows;

export const spellResearchExpansions =
  (spellResearchRecipeData as SpellResearchRecipeEnvelope).expansions;
