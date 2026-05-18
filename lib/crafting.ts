/**
 * lib/crafting.ts
 *
 * Types and data-access helpers for the crafting / recipes page (Feature G).
 *
 * Data source:
 *  1. data/crafting-recipes.json — the dedicated replaceable recipe dataset.
 *
 * Schema expectations for the Excel ingest agent are documented at the bottom
 * of this file.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CraftingSkill =
  | "alchemy"
  | "baking"
  | "brewing"
  | "fletching"
  | "jewelcraft"
  | "pottery"
  | "smithing"
  | "spell-research"
  | "tailoring"
  | "tinkering"
  | "poison-making";

export interface CraftingComponent {
  name: string;
  count: number;
  sizeVariants?: string[];
  sizeVariantDetails?: Record<string, {
    name: string;
    sourceUrl?: string | null;
    allakhazamUrl?: string | null;
    imageUrl?: string | null;
  }>;
  componentType?: "finalItem" | "ingredient" | "template" | "intermediate" | "mold" | "sketch" | "firingComponent" | "processComponent" | "unknown";
  sourceNotes?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  subcombineRecipe?: {
    name: string;
    components: Array<{ name: string; count: number }>;
    container?: string | null;
    trivial?: number | null;
    sourceUrl?: string | null;
  } | null;
  placeholderDescription?: string | null;
  templateOptions?: string[];
  dataQualityNote?: string | null;
  zones?: string[];
  mobs?: string[];
  vendors?: string[];
  acquisitionType?: "dropped" | "vendor" | "crafted" | "foraged" | "ground spawn" | "quest" | "unknown";
  eraHint?: string | null;
  expansionHint?: string | null;
  imageUrl?: string | null;
}

export interface CraftingOutput {
  name: string;
  count: number;
  imageUrl?: string | null;
}

/** A single tradeskill recipe. */
export interface CraftingRecipe {
  /** Source recipe or item identifier when supplied by the data source. */
  id?: number | string;
  /** Expansion tag from the source dataset, preserved for progression filtering. */
  expansion?: string | null;
  /** Tradeskill label from the source dataset, when distinct from the normalized skill key. */
  tradeskill?: string | null;
  /** Source item id when supplied by the data source. */
  sourceItemId?: number | string | null;
  /** Identifies which tradeskill this recipe belongs to. */
  skill: CraftingSkill;
  /** Display name of the recipe (typically the output item name). */
  name: string;
  /** Trivial skill level — the skill level above which failures stop. null = unknown. */
  trivial: number | null;
  /** Ingredients required. */
  components: CraftingComponent[];
  /** Structured arrow-table metadata from P99 Fletching rows. */
  arrowMetadata?: {
    damage?: number | null;
    range?: number | null;
    cost?: string | null;
    point?: string | null;
    shaft?: string | null;
    fletch?: string | null;
    nockSize?: string | null;
    rangeOptions?: number[];
    unresolvedNockComponent?: boolean;
  };
  /** The tradeskill container required (e.g. "Loom", "Forge", "Fletcher's Kit"). */
  container: string;
  /** The item produced. */
  output: CraftingOutput;
  /** Structured size variants from source shorthand such as P99 Smithing (S | M | L). */
  sizeVariants?: string[];
  /** Real item/component records for each selected size variant. */
  sizeVariantDetails?: Record<string, {
    output: {
      name: string;
      sourceUrl?: string | null;
      allakhazamUrl?: string | null;
      imageUrl?: string | null;
      ac?: number | null;
      weight?: number | null;
    };
    components?: Record<string, {
      name: string;
      sourceUrl?: string | null;
      allakhazamUrl?: string | null;
      imageUrl?: string | null;
    }>;
  }>;
  /** Optional free-text notes (class restrictions, tips, etc.). */
  notes?: string | null;
  /** Original factual recipe source URL. */
  sourceUrl?: string | null;
  /** Dataset-specific output quantity when supplied separately from output.count. */
  sourceOutputCount?: number | null;
  /** Dataset-specific success flag, if present. */
  sourceSuccess?: boolean | null;
  /** Dataset-specific failure flag, if present. */
  sourceFailure?: boolean | null;
  /** Dataset-specific success/failure numeric value, if present. */
  sourceSuccessValue?: number | null;
  /** Raw source columns kept for later schema reconciliation. */
  sourceMetadata?: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Skill tier boundaries
// ---------------------------------------------------------------------------

/** Half-open ranges [min, max) for grouping recipes by trivial skill band. */
export const SKILL_TIERS: Array<{ label: string; min: number; max: number }> = [
  { label: "1–50",    min: 0,   max: 51       },
  { label: "51–100",  min: 51,  max: 101      },
  { label: "101–150", min: 101, max: 151      },
  { label: "151–200", min: 151, max: 201      },
  { label: "201–250", min: 201, max: 251      },
  { label: "251+",    min: 251, max: Infinity },
];

export function tierForTrivial(trivial: number | null): string {
  if (trivial === null) return "Unknown";
  for (const tier of SKILL_TIERS) {
    if (trivial >= tier.min && trivial < tier.max) return tier.label;
  }
  return "251+";
}

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

export const SKILL_LABELS: Record<CraftingSkill, string> = {
  alchemy:          "Alchemy",
  baking:           "Baking",
  brewing:          "Brewing",
  fletching:        "Fletching",
  jewelcraft:       "Jewelcraft",
  pottery:          "Pottery",
  smithing:         "Smithing",
  "spell-research": "Spell Research",
  tailoring:        "Tailoring",
  tinkering:        "Tinkering",
  "poison-making":  "Poison Making",
};

export const CRAFTING_SKILLS: CraftingSkill[] = [
  "alchemy",
  "baking",
  "brewing",
  "fletching",
  "jewelcraft",
  "pottery",
  "smithing",
  "spell-research",
  "tailoring",
  "tinkering",
  "poison-making",
];

// ---------------------------------------------------------------------------
// Slug helper (for /item/[slug] cross-links)
// ---------------------------------------------------------------------------

import { itemToSlug } from "@/lib/item-slug";

/**
 * Converts an item name into a URL-safe slug.
 * Delegates to the canonical itemToSlug helper which strips apostrophes
 * before normalising, fixing the 233-item divergence for names like
 * "Tolan's Darkwood Fists".
 */
export const itemSlug = itemToSlug;

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

import { craftingRecipes, isCraftingLiveData } from "@/data/crafting-recipes";

/** All recipes from the dedicated crafting dataset. */
export const allRecipes: CraftingRecipe[] = craftingRecipes;

/** True while the dedicated crafting dataset is active. */
export const isLiveData: boolean = isCraftingLiveData;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Returns all recipes for a given skill, sorted by trivial ascending. */
export function getRecipesBySkill(skill: CraftingSkill): CraftingRecipe[] {
  return allRecipes
    .filter((r) => r.skill === skill)
    .sort((a, b) => (a.trivial ?? 999) - (b.trivial ?? 999));
}

/** Groups recipes for a skill by their trivial tier label. */
export function getRecipesBySkillGrouped(
  skill: CraftingSkill,
): Array<{ tier: string; recipes: CraftingRecipe[] }> {
  const recipes = getRecipesBySkill(skill);

  const map = new Map<string, CraftingRecipe[]>();
  for (const recipe of recipes) {
    const tier = tierForTrivial(recipe.trivial);
    const existing = map.get(tier);
    if (existing) {
      existing.push(recipe);
    } else {
      map.set(tier, [recipe]);
    }
  }

  // Emit in defined tier order; unknown trivials come last.
  const ordered: Array<{ tier: string; recipes: CraftingRecipe[] }> = [];
  for (const { label } of SKILL_TIERS) {
    const group = map.get(label);
    if (group && group.length > 0) {
      ordered.push({ tier: label, recipes: group });
    }
  }
  const unknown = map.get("Unknown");
  if (unknown && unknown.length > 0) {
    ordered.push({ tier: "Unknown", recipes: unknown });
  }

  return ordered;
}

/** Returns every recipe that produces a specific item (by exact name). */
export function getRecipesForItem(itemName: string): CraftingRecipe[] {
  const lower = itemName.toLowerCase();
  return allRecipes.filter((r) => r.output.name.toLowerCase() === lower);
}

/** Returns every recipe that requires a specific component (by exact name). */
export function getRecipesUsingComponent(componentName: string): CraftingRecipe[] {
  const lower = componentName.toLowerCase();
  return allRecipes.filter((r) =>
    r.components.some((c) => c.name.toLowerCase() === lower),
  );
}

/*
  ===========================================================================
  SCHEMA EXPECTATIONS FOR THE EXCEL INGEST AGENT (Feature F)
  ===========================================================================

  The file data/crafting-recipes.json must have the top-level shape:

  {
    "recipes": [
      {
        "skill":      "alchemy" | "baking" | "brewing" | "fletching"
                       | "jewelcraft" | "pottery" | "smithing"
                       | "spell-research" | "tailoring" | "tinkering"
                       | "poison-making",
        "name":       string,         // recipe / output item display name
        "trivial":    number | null,  // skill level where failures stop
        "components": [
          {
            "name": string,
            "count": number,
            "sourceNotes"?: string | null,
            "zones"?: string[],
            "mobs"?: string[],
            "vendors"?: string[],
            "acquisitionType"?: "dropped" | "vendor" | "crafted" | "foraged"
                              | "ground spawn" | "quest" | "unknown",
            "eraHint"?: string | null,
            "expansionHint"?: string | null,
            "imageUrl"?: string | null
          }
        ],
        "container":  string,         // e.g. "Loom", "Forge", "Fletcher's Kit",
                                      //       "Jeweler's Kit", "Spell Research Kit"
        "output":     { "name": string, "count": number, "imageUrl"?: string | null },
        "notes":      string | null,  // optional class/tip notes
        "sourceUrl":  string | null
      }
    ]
  }

  Notes on field values:
  - `skill` must be lowercase hyphenated exactly as the union above.
  - `trivial` is the numeric trivial skill level; use null when unknown.
  - `components` count is per-combine (not stack size).
  - `output` count is items produced per successful combine (usually 1).
  - Component and output names should match item-details.json keys exactly
    when the item exists there, to enable /item/[slug] cross-linking.
  ===========================================================================
*/
