"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CRAFTING_SKILLS,
  SKILL_LABELS,
  type CraftingRecipe,
  type CraftingSkill,
} from "@/lib/crafting";
import { itemToSlug } from "@/lib/item-slug";
import { ItemDrawer } from "@/components/ItemDrawer";
import "@/components/item-drawer.css";
import { ItemIcon } from "@/components/ItemIcon";
import { useItemPreview } from "@/components/ItemPreviewProvider";
import {
  RESEARCH_CLASSES,
  RESEARCH_SPELL_METADATA,
  normalizeResearchSpellName,
  type ResearchClassName,
  type ResearchSpellMetadata,
} from "@/data/spell-research-spell-metadata";
import itemDetailsData from "@/data/item-details.json";
import type { Bucket, ItemDetailsMap } from "@/lib/search";

const itemDetailsMap = itemDetailsData as ItemDetailsMap;

type CraftingSort = "trivial-low" | "trivial-high" | "alphabetical" | "components";
type ResearchSort = "level-low" | "level-high" | "trivial-low" | "trivial-high" | "name";
type ResearchViewMode = "skill-up" | "lookup";

type ResearchSpellRow = {
  recipe: CraftingRecipe;
  metadata: ResearchSpellMetadata | null;
  className: ResearchClassName | "Unmapped";
  spellLevel: number | null;
  expectedTrivial: number | null;
  displayName: string;
  matchKey: string;
};

type ResearchSkillBand = {
  id: string;
  label: string;
  min: number;
  max: number;
  recipes: CraftingRecipe[];
};

type RecipeFamily = {
  id: string;
  name: string;
  recipes: CraftingRecipe[];
  minTrivial: number | null;
  maxTrivial: number | null;
  containers: string[];
  commonComponents: string[];
  simplestComponentCount: number;
  averageComponentCount: number;
};

let _craftingBucketIdCounter = 200000;
function makeCraftingBucket(itemName: string, recipe: CraftingRecipe): Bucket {
  _craftingBucketIdCounter += 1;
  return {
    bucket: _craftingBucketIdCounter,
    level_range: `${SKILL_LABELS[recipe.skill]} (Trivial ${recipe.trivial ?? "?"})`,
    expansion: "Classic",
    mobs: [],
    zones: [],
    loot_pool: [itemName],
    mob_count: 0,
    loot_count: 1,
    zone_count: 0,
  };
}

export type SkillData = {
  skill: CraftingSkill;
  recipes: CraftingRecipe[];
};

interface CraftingTabsProps {
  skillData: SkillData[];
}

const armorSlotSuffixes = [
  "cap",
  "coif",
  "mask",
  "gorget",
  "mantle",
  "cloak",
  "sleeves",
  "bracer",
  "bracelet",
  "gloves",
  "gauntlets",
  "tunic",
  "robe",
  "shirt",
  "pants",
  "leggings",
  "boots",
  "sandals",
];

const researchExpansionFilters = [
  { label: "Classic", sourceExpansion: "Original" },
  { label: "Kunark", sourceExpansion: "Ruins of Kunark" },
  { label: "Velious", sourceExpansion: "Scars of Velious" },
  { label: "Luclin", sourceExpansion: "Shadows of Luclin" },
];

const earlyResearchExpansionCodes = new Set(researchExpansionFilters.map((filter) => filter.sourceExpansion));
const researchMetadataBySpellName = RESEARCH_SPELL_METADATA.reduce((map, metadata) => {
  const key = normalizeResearchSpellName(metadata.spellName);
  map.set(key, [...(map.get(key) ?? []), metadata]);
  return map;
}, new Map<string, ResearchSpellMetadata[]>());

function formatTrivialRange(family: RecipeFamily) {
  if (family.minTrivial === null) return "Trivial unknown";
  if (family.maxTrivial === null || family.maxTrivial === family.minTrivial) return `Trivial ${family.minTrivial}`;
  return `Trivial ${family.minTrivial}-${family.maxTrivial}`;
}

function normalizeForSearch(value: string) {
  return value.toLowerCase().replace(/['`]/g, "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function recipeFamilyName(recipe: CraftingRecipe) {
  const outputName = recipe.output.name || recipe.name;
  const normalized = normalizeForSearch(outputName);
  const armorSlotPattern = new RegExp(`\\s+(${armorSlotSuffixes.join("|")})$`, "i");
  const armorBase = outputName.replace(armorSlotPattern, "").trim();
  if (armorBase && armorBase !== outputName) return `${armorBase} Armor Set`;

  const jewelryMatch = outputName.match(/^(.+?)\s+[A-Za-z'` -]+\s+(Ring|Earring)$/i);
  if (jewelryMatch) return `${jewelryMatch[1]} ${jewelryMatch[2]}s`;

  const weaponMatch = outputName.match(/^(.+?)\s+(Short|Long|Two Handed|2H)\s+(Sword|Bow)$/i);
  if (weaponMatch) return `${weaponMatch[1]} ${weaponMatch[3]} Set`;

  if (/^minor summoning:|^summoning:|^greater summoning:/i.test(outputName)) return "Elemental Summoning Spells";
  if (normalized.includes(":")) return titleCase(outputName.split(":")[0] ?? outputName);
  return outputName;
}

function buildRecipeFamilies(recipes: CraftingRecipe[]) {
  const groups = new Map<string, CraftingRecipe[]>();
  for (const recipe of recipes) {
    const familyName = recipeFamilyName(recipe);
    const key = normalizeForSearch(`${recipe.skill}:${familyName}`);
    groups.set(key, [...(groups.get(key) ?? []), recipe]);
  }

  return Array.from(groups.entries()).map(([id, familyRecipes]) => {
    const sortedRecipes = [...familyRecipes].sort(
      (a, b) => (a.trivial ?? 9999) - (b.trivial ?? 9999) || a.output.name.localeCompare(b.output.name),
    );
    const trivialValues = sortedRecipes
      .map((recipe) => recipe.trivial)
      .filter((trivial): trivial is number => trivial !== null);
    const containers = Array.from(new Set(sortedRecipes.map((recipe) => recipe.container))).sort((a, b) => a.localeCompare(b));
    const componentCounts = sortedRecipes.map((recipe) => recipe.components.length);
    const componentFrequency = new Map<string, number>();
    for (const recipe of sortedRecipes) {
      for (const component of recipe.components) {
        componentFrequency.set(component.name, (componentFrequency.get(component.name) ?? 0) + 1);
      }
    }
    const commonComponents = Array.from(componentFrequency.entries())
      .filter(([, count]) => count === sortedRecipes.length)
      .map(([name]) => name)
      .slice(0, 3);

    return {
      id,
      name: recipeFamilyName(sortedRecipes[0]),
      recipes: sortedRecipes,
      minTrivial: trivialValues.length ? Math.min(...trivialValues) : null,
      maxTrivial: trivialValues.length ? Math.max(...trivialValues) : null,
      containers,
      commonComponents,
      simplestComponentCount: Math.min(...componentCounts),
      averageComponentCount: componentCounts.reduce((sum, count) => sum + count, 0) / componentCounts.length,
    };
  });
}

function recipeMatchesFilters(recipe: CraftingRecipe, familyName: string, query: string, minTrivial: number | null, maxTrivial: number | null) {
  const trivial = recipe.trivial;
  const matchesTrivial = trivial === null
    ? minTrivial === null && maxTrivial === null
    : (minTrivial === null || trivial >= minTrivial) && (maxTrivial === null || trivial <= maxTrivial);

  if (!matchesTrivial) return false;
  if (!query) return true;

  const haystack = [
    familyName,
    recipe.name,
    recipe.output.name,
    recipe.container,
    recipe.notes,
    ...recipe.components.map((component) => component.name),
  ].filter(Boolean).join(" ").toLowerCase();

  return haystack.includes(query);
}

function sortFamilies(families: RecipeFamily[], sort: CraftingSort) {
  return [...families].sort((a, b) => {
    if (sort === "trivial-high") {
      return (b.maxTrivial ?? -1) - (a.maxTrivial ?? -1) || a.name.localeCompare(b.name);
    }
    if (sort === "alphabetical") {
      return a.name.localeCompare(b.name);
    }
    if (sort === "components") {
      return a.simplestComponentCount - b.simplestComponentCount
        || a.averageComponentCount - b.averageComponentCount
        || a.name.localeCompare(b.name);
    }
    return (a.minTrivial ?? 9999) - (b.minTrivial ?? 9999) || a.name.localeCompare(b.name);
  });
}

function parseTrivialFilter(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displaySpellName(recipeName: string) {
  return recipeName.replace(/^Spell:\s*/i, "").trim();
}

function allakhazamSearchUrl(name: string) {
  return `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}`;
}

function getItemAllakhazamUrl(itemName: string) {
  const details = itemDetailsMap[itemName];
  const candidateUrls = [
    details?.sourceUrl,
    ...(details?.sources ?? []).map((source) => source.url),
  ].filter((url): url is string => Boolean(url));
  return candidateUrls.find((url) => /everquest\.allakhazam\.com\/db\/item\.html\?item=/i.test(url)) ?? null;
}

function isEarlyResearchRecipe(recipe: CraftingRecipe) {
  return recipe.expansion !== null && recipe.expansion !== undefined && earlyResearchExpansionCodes.has(recipe.expansion);
}

function getResearchSpellAllakhazamUrl(recipe: CraftingRecipe) {
  if (!isEarlyResearchRecipe(recipe)) return null;
  const sourceUrl = recipe.sourceMetadata?.researchSpellLevelSourceUrl;
  if (typeof sourceUrl === "string" && /everquest\.allakhazam\.com\/db\/spell\.html\?spell=/i.test(sourceUrl)) {
    return sourceUrl;
  }
  return getItemAllakhazamUrl(recipe.output.name) ?? allakhazamSearchUrl(displaySpellName(recipe.output.name || recipe.name));
}

function getResearchIngredientAllakhazamUrl(recipe: CraftingRecipe, ingredientName: string) {
  if (!isEarlyResearchRecipe(recipe)) return null;
  return getItemAllakhazamUrl(ingredientName) ?? allakhazamSearchUrl(ingredientName);
}

function getRecipeResearchClass(recipe: CraftingRecipe): ResearchClassName | null {
  const className = recipe.sourceMetadata?.researchClass;
  return typeof className === "string" && RESEARCH_CLASSES.includes(className as ResearchClassName)
    ? className as ResearchClassName
    : null;
}

function buildResearchSpellRows(recipes: CraftingRecipe[], showUnmapped: boolean): ResearchSpellRow[] {
  return recipes.flatMap<ResearchSpellRow>((recipe) => {
    const matchKey = normalizeResearchSpellName(recipe.name);
    const metadataMatches = researchMetadataBySpellName.get(matchKey) ?? [];
    const researchClass = getRecipeResearchClass(recipe);
    const enrichedSpellLevel = typeof recipe.sourceMetadata?.researchSpellLevel === "number"
      ? recipe.sourceMetadata.researchSpellLevel
      : null;
    if (metadataMatches.length > 0) {
      const rows = metadataMatches
        .filter((metadata) => researchClass === null || metadata.className === researchClass)
        .map((metadata) => ({
          recipe,
          metadata,
          className: metadata.className,
          spellLevel: metadata.spellLevel,
          expectedTrivial: metadata.expectedTrivial,
          displayName: displaySpellName(recipe.name),
          matchKey,
        }));
      if (rows.length > 0) return rows;
    }
    if (researchClass !== null) {
      return [{
        recipe,
        metadata: null,
        className: researchClass,
        spellLevel: enrichedSpellLevel,
        expectedTrivial: null,
        displayName: displaySpellName(recipe.name),
        matchKey,
      }];
    }
    if (!showUnmapped) return [];
    return [{
      recipe,
      metadata: null,
      className: "Unmapped" as const,
      spellLevel: null,
      expectedTrivial: null,
      displayName: displaySpellName(recipe.name),
      matchKey,
    }];
  });
}

function researchRowMatchesSearch(row: ResearchSpellRow, query: string) {
  if (!query) return true;
  const trivial = row.expectedTrivial ?? row.recipe.trivial;
  const haystack = [
    row.displayName,
    row.recipe.name,
    row.className,
    row.recipe.expansion,
    row.recipe.id,
    row.spellLevel,
    trivial,
  ].filter((value) => value !== null && value !== undefined).join(" ").toLowerCase();
  return haystack.includes(query);
}

function sortResearchRows(rows: ResearchSpellRow[], sort: ResearchSort) {
  return [...rows].sort((a, b) => {
    const aLevel = a.spellLevel ?? 9999;
    const bLevel = b.spellLevel ?? 9999;
    const aTrivial = a.expectedTrivial ?? a.recipe.trivial ?? 9999;
    const bTrivial = b.expectedTrivial ?? b.recipe.trivial ?? 9999;
    if (sort === "level-high") {
      return bLevel - aLevel || a.className.localeCompare(b.className) || aTrivial - bTrivial || a.displayName.localeCompare(b.displayName);
    }
    if (sort === "trivial-low") {
      return aTrivial - bTrivial || a.className.localeCompare(b.className) || aLevel - bLevel || a.displayName.localeCompare(b.displayName);
    }
    if (sort === "trivial-high") {
      return bTrivial - aTrivial || a.className.localeCompare(b.className) || aLevel - bLevel || a.displayName.localeCompare(b.displayName);
    }
    if (sort === "name") {
      return a.displayName.localeCompare(b.displayName) || a.className.localeCompare(b.className) || aLevel - bLevel;
    }
    return a.className.localeCompare(b.className) || aLevel - bLevel || aTrivial - bTrivial || a.displayName.localeCompare(b.displayName);
  });
}

function isResearchSkillUpRecipe(recipe: CraftingRecipe) {
  if (/^spell:/i.test(recipe.name)) return false;
  // TODO: Improve skill-up recommendations with real component availability, combine cost, and route quality.
  return /rune|ink|parchment|vellum|hide|quill|vial|salt|solution|component bag|scroll|tome|bone segment/i.test(recipe.name);
}

function buildResearchSkillBands(recipes: CraftingRecipe[]): ResearchSkillBand[] {
  const bandDefinitions = [
    { id: "1-50", label: "Skill 1-50", min: 0, max: 50 },
    { id: "51-100", label: "Skill 51-100", min: 51, max: 100 },
    { id: "101-150", label: "Skill 101-150", min: 101, max: 150 },
    { id: "151-200", label: "Skill 151-200", min: 151, max: 200 },
    { id: "201-250", label: "Skill 201-250", min: 201, max: 250 },
    { id: "251+", label: "Skill 251+", min: 251, max: Infinity },
  ];
  const skillUpRecipes = recipes
    .filter((recipe) => recipe.expansion !== null && recipe.expansion !== undefined && earlyResearchExpansionCodes.has(recipe.expansion))
    .filter(isResearchSkillUpRecipe)
    .sort((a, b) => (a.trivial ?? 9999) - (b.trivial ?? 9999) || a.name.localeCompare(b.name));

  return bandDefinitions.map((band) => ({
    ...band,
    recipes: skillUpRecipes.filter((recipe) => {
      const trivial = recipe.trivial ?? 9999;
      return trivial >= band.min && trivial <= band.max;
    }),
  })).filter((band) => band.recipes.length > 0);
}

function toggleSetValue<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function RecipeDetailRow({
  recipe,
  dimmed,
  onSelectLoot,
}: {
  recipe: CraftingRecipe;
  dimmed: boolean;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
}) {
  const { previewProps } = useItemPreview();
  const outputDetails = itemDetailsMap[recipe.output.name];

  return (
    <article className={dimmed ? "recipe-detail-row is-dimmed" : "recipe-detail-row"}>
      <div className="recipe-detail-heading">
        <button
          className="recipe-output-link"
          onClick={() => onSelectLoot(recipe.output.name, makeCraftingBucket(recipe.output.name, recipe))}
          type="button"
          {...previewProps(recipe.output.name, outputDetails)}
        >
          <ItemIcon details={outputDetails} />
          <span>{recipe.output.name}</span>
        </button>
        <span>{recipe.trivial !== null ? `Trivial ${recipe.trivial}` : "Trivial unknown"}</span>
      </div>
      <ul className="recipe-components-list">
        {recipe.components.map((component, idx) => {
          const componentDetails = itemDetailsMap[component.name];
          return (
            <li className="recipe-component-item" key={`${component.name}-${component.count}-${idx}`}>
              {component.count > 1 ? <span className="recipe-component-count">{component.count}x</span> : null}
              <button
                className="recipe-component-link"
                onClick={() => onSelectLoot(component.name, makeCraftingBucket(component.name, recipe))}
                type="button"
                {...previewProps(component.name, componentDetails)}
              >
                <ItemIcon details={componentDetails} />
                <span>{component.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {recipe.notes ? <p className="recipe-notes">{recipe.notes}</p> : null}
    </article>
  );
}

function RecipeFamilyCard({
  family,
  matchingRecipeIds,
  expanded,
  onToggle,
  onSelectLoot,
}: {
  family: RecipeFamily;
  matchingRecipeIds: Set<string>;
  expanded: boolean;
  onToggle: () => void;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
}) {
  const containers = family.containers.length === 1 ? family.containers[0] : "Mixed";
  const commonComponents = family.commonComponents.length ? family.commonComponents.join(", ") : "Varies by recipe";
  const skillTone = family.recipes[0]?.skill ?? "tailoring";

  return (
    <section className={`recipe-family-card skill-tone-${skillTone}`}>
      <button
        aria-expanded={expanded}
        className="recipe-family-summary"
        onClick={onToggle}
        type="button"
      >
        <span className="recipe-family-main">
          <span className="recipe-family-toggle">{expanded ? "-" : "+"}</span>
          <span>
            <strong>{family.name}</strong>
            <small>
              {family.recipes.length} recipe{family.recipes.length !== 1 ? "s" : ""} - {formatTrivialRange(family)}
            </small>
          </span>
        </span>
        <span className="recipe-family-meta">
          <span>Container: {containers}</span>
          <span>Common components: {commonComponents}</span>
        </span>
      </button>

      {expanded ? (
        <div className="recipe-family-details">
          {family.recipes.map((recipe) => {
            const recipeKey = `${recipe.skill}:${recipe.name}:${recipe.trivial ?? "unknown"}`;
            return (
              <RecipeDetailRow
                dimmed={matchingRecipeIds.size > 0 && !matchingRecipeIds.has(recipeKey)}
                key={recipeKey}
                recipe={recipe}
                onSelectLoot={onSelectLoot}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SkillPanel({
  skill,
  recipes,
  searchQuery,
  minTrivial,
  maxTrivial,
  sort,
  expandedFamilies,
  onToggleFamily,
  onSelectLoot,
}: SkillData & {
  searchQuery: string;
  minTrivial: string;
  maxTrivial: string;
  sort: CraftingSort;
  expandedFamilies: Set<string>;
  onToggleFamily: (familyId: string) => void;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
}) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const parsedMin = parseTrivialFilter(minTrivial);
  const parsedMax = parseTrivialFilter(maxTrivial);

  const filteredFamilies = useMemo(() => {
    const families = buildRecipeFamilies(recipes).map((family) => {
      const matchingRecipeIds = new Set<string>();
      for (const recipe of family.recipes) {
        if (recipeMatchesFilters(recipe, family.name, normalizedQuery, parsedMin, parsedMax)) {
          matchingRecipeIds.add(`${recipe.skill}:${recipe.name}:${recipe.trivial ?? "unknown"}`);
        }
      }
      return { family, matchingRecipeIds };
    }).filter(({ matchingRecipeIds }) => matchingRecipeIds.size > 0);

    return sortFamilies(families.map(({ family }) => family), sort).map((family) => ({
      family,
      matchingRecipeIds: families.find((entry) => entry.family.id === family.id)?.matchingRecipeIds ?? new Set<string>(),
    }));
  }, [normalizedQuery, parsedMax, parsedMin, recipes, sort]);

  if (recipes.length === 0) {
    return <p className="crafting-empty">No {SKILL_LABELS[skill]} recipes found in the current dataset.</p>;
  }

  if (filteredFamilies.length === 0) {
    return <p className="crafting-empty">No {SKILL_LABELS[skill]} recipe families match the active filters.</p>;
  }

  return (
    <div className="crafting-skill-panel">
      <div className="recipe-family-list">
        {filteredFamilies.map(({ family, matchingRecipeIds }) => (
          <RecipeFamilyCard
            expanded={expandedFamilies.has(family.id)}
            family={family}
            key={family.id}
            matchingRecipeIds={matchingRecipeIds}
            onSelectLoot={onSelectLoot}
            onToggle={() => onToggleFamily(family.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ResearchComponentSourceTags({ component }: { component: CraftingRecipe["components"][number] }) {
  // TODO: Future early-era Research enrichment should add icons/images, reliable
  // vendor/drop/forage/crafted source tags, zone availability, expansion
  // availability, and direct Allakhazam item IDs for ingredients.
  const tags = [
    component.acquisitionType && component.acquisitionType !== "unknown" ? component.acquisitionType : null,
    ...(component.zones ?? []),
    ...(component.vendors ?? []),
    ...(component.mobs ?? []),
    component.expansionHint ?? null,
    component.eraHint ?? null,
  ].filter((tag): tag is string => Boolean(tag));

  if (tags.length === 0) return null;
  return (
    <span className="recipe-component-source-tags">
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </span>
  );
}

function ResearchRecipeDetails({
  recipe,
}: {
  recipe: CraftingRecipe;
}) {
  const resultAllakhazamUrl = getResearchSpellAllakhazamUrl(recipe);
  return (
    <div className="research-recipe-details">
      <div className="research-spell-meta">
        <span>
          Result: {resultAllakhazamUrl ? (
            <a
              className="research-external-link"
              href={resultAllakhazamUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {recipe.output.name}
            </a>
          ) : recipe.output.name}
        </span>
        <span>Container: {recipe.container || "Unknown"}</span>
        <span>Expansion: {recipe.expansion ?? "Unknown"}</span>
        <span>Source/id: {recipe.id ?? recipe.sourceItemId ?? "Unknown"}</span>
      </div>
      {recipe.components.length > 0 ? (
        <ul className="recipe-components-list">
          {recipe.components.map((component, idx) => {
            const componentAllakhazamUrl = getResearchIngredientAllakhazamUrl(recipe, component.name);
            return (
              <li className="recipe-component-item research-component-item" key={`${component.name}-${component.count}-${idx}`}>
                {component.count > 1 ? <span className="recipe-component-count">{component.count}x</span> : null}
                {componentAllakhazamUrl ? (
                  <a
                    className="recipe-component-link"
                    href={componentAllakhazamUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <span>{component.name}</span>
                  </a>
                ) : (
                  <span
                  className="recipe-component-link"
                >
                  <span>{component.name}</span>
                  </span>
                )}
                <ResearchComponentSourceTags component={component} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="research-missing-components">Recipe components not available yet</p>
      )}
    </div>
  );
}

function ResearchSpellCard({
  row,
  expanded,
  onToggle,
}: {
  row: ResearchSpellRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const trivial = row.expectedTrivial ?? row.recipe.trivial;
  const sourceTrivial = row.recipe.trivial;
  const showSourceTrivial = row.expectedTrivial !== null && sourceTrivial !== null && row.expectedTrivial !== sourceTrivial;
  return (
    <article className="research-spell-card">
      <button
        aria-expanded={expanded}
        className="research-spell-summary"
        onClick={onToggle}
        type="button"
      >
        <span className="recipe-family-toggle">{expanded ? "-" : "+"}</span>
        <span className="research-spell-summary-body">
          <span className="research-spell-titleline">
            <strong>{row.displayName}</strong>
            <span>{row.recipe.expansion ?? "Unknown expansion"}</span>
          </span>
          <span className="research-spell-meta">
            <span>Class: {row.className}</span>
            <span>Level: {row.spellLevel ?? "Unknown"}</span>
            <span>Trivial: {trivial ?? "Unknown"}</span>
            {showSourceTrivial ? <span>Source trivial: {sourceTrivial}</span> : null}
            <span>Source/id: {row.recipe.id ?? row.recipe.sourceItemId ?? "Unknown"}</span>
          </span>
        </span>
      </button>
      {expanded ? <ResearchRecipeDetails recipe={row.recipe} /> : null}
    </article>
  );
}

function ResearchSkillUpView({
  recipes,
  expandedBands,
  onToggleBand,
}: {
  recipes: CraftingRecipe[];
  expandedBands: Set<string>;
  onToggleBand: (bandId: string) => void;
}) {
  const bands = useMemo(() => buildResearchSkillBands(recipes), [recipes]);
  return (
    <div className="research-skillup-list">
      {bands.map((band) => {
        const expanded = expandedBands.has(band.id);
        const minTrivial = band.recipes[0]?.trivial ?? null;
        const maxTrivial = band.recipes[band.recipes.length - 1]?.trivial ?? null;
        return (
          <section className="research-skillup-band" key={band.id}>
            <button
              aria-expanded={expanded}
              className="recipe-family-summary"
              onClick={() => onToggleBand(band.id)}
              type="button"
            >
              <span className="recipe-family-main">
                <span className="recipe-family-toggle">{expanded ? "-" : "+"}</span>
                <span>
                  <strong>{band.label}</strong>
                  <small>
                    {band.recipes.length} skill-up combine{band.recipes.length !== 1 ? "s" : ""} - Trivial {minTrivial ?? "?"}-{maxTrivial ?? "?"}
                  </small>
                </span>
              </span>
              <span className="recipe-family-meta">
                <span>Classic through Luclin only</span>
                <span>Sorted by trivial</span>
              </span>
            </button>
            {expanded ? (
              <div className="recipe-family-details">
                {band.recipes.map((recipe) => (
                  <article className="recipe-detail-row" key={`${recipe.id ?? recipe.name}:${recipe.trivial ?? "unknown"}`}>
                    <div className="recipe-detail-heading">
                      <span>{recipe.name}</span>
                      <span>{recipe.trivial !== null ? `Trivial ${recipe.trivial}` : "Trivial unknown"}</span>
                    </div>
                    <ResearchRecipeDetails recipe={recipe} />
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function ResearchPanel({
  recipes,
  researchViewMode,
  researchSearch,
  selectedResearchClasses,
  selectedResearchExpansions,
  showUnmappedResearch,
  researchSort,
  expandedResearchBands,
  expandedResearchSpells,
  onResearchViewModeChange,
  onResearchSearchChange,
  onToggleResearchClass,
  onToggleResearchExpansion,
  onToggleShowUnmappedResearch,
  onResearchSortChange,
  onToggleResearchBand,
  onToggleResearchSpell,
}: {
  recipes: CraftingRecipe[];
  researchViewMode: ResearchViewMode;
  researchSearch: string;
  selectedResearchClasses: Set<ResearchClassName>;
  selectedResearchExpansions: Set<string>;
  showUnmappedResearch: boolean;
  researchSort: ResearchSort;
  expandedResearchBands: Set<string>;
  expandedResearchSpells: Set<string>;
  onResearchViewModeChange: (value: ResearchViewMode) => void;
  onResearchSearchChange: (value: string) => void;
  onToggleResearchClass: (value: ResearchClassName) => void;
  onToggleResearchExpansion: (value: string) => void;
  onToggleShowUnmappedResearch: () => void;
  onResearchSortChange: (value: ResearchSort) => void;
  onToggleResearchBand: (bandId: string) => void;
  onToggleResearchSpell: (spellId: string) => void;
}) {
  const activeExpansionCodes = selectedResearchExpansions.size > 0
    ? selectedResearchExpansions
    : earlyResearchExpansionCodes;
  const normalizedQuery = researchSearch.trim().toLowerCase();
  const hasActiveFilter = normalizedQuery.length > 0
    || selectedResearchClasses.size > 0
    || selectedResearchExpansions.size > 0
    || showUnmappedResearch;

  const rows = useMemo(() => {
    if (!hasActiveFilter) return [];
    const filteredRecipes = recipes.filter((recipe) =>
      recipe.expansion !== null
      && recipe.expansion !== undefined
      && activeExpansionCodes.has(recipe.expansion),
    );
    return sortResearchRows(
      buildResearchSpellRows(filteredRecipes, showUnmappedResearch).filter((row) => {
        if (selectedResearchClasses.size > 0 && !selectedResearchClasses.has(row.className as ResearchClassName)) return false;
        return researchRowMatchesSearch(row, normalizedQuery);
      }),
      researchSort,
    );
  }, [activeExpansionCodes, hasActiveFilter, normalizedQuery, recipes, researchSort, selectedResearchClasses, showUnmappedResearch]);

  return (
    <div className="research-catalog">
      <div className="research-mode-toggle" role="tablist" aria-label="Spell Research view mode">
        <button
          aria-pressed={researchViewMode === "skill-up"}
          className={researchViewMode === "skill-up" ? "research-chip is-active" : "research-chip"}
          onClick={() => onResearchViewModeChange("skill-up")}
          type="button"
        >
          Skill-Up View
        </button>
        <button
          aria-pressed={researchViewMode === "lookup"}
          className={researchViewMode === "lookup" ? "research-chip is-active" : "research-chip"}
          onClick={() => onResearchViewModeChange("lookup")}
          type="button"
        >
          Spell Lookup View
        </button>
      </div>

      {researchViewMode === "skill-up" ? (
        <ResearchSkillUpView
          expandedBands={expandedResearchBands}
          onToggleBand={onToggleResearchBand}
          recipes={recipes}
        />
      ) : (
        <>
          <section className="research-controls" aria-label="Spell Research filters">
            <label className="crafting-filter research-search-filter">
              <span>Search Research</span>
              <input
                onChange={(event) => onResearchSearchChange(event.target.value)}
                placeholder="Search spell, class, expansion, or trivial"
                type="search"
                value={researchSearch}
              />
            </label>
            <label className="crafting-filter research-sort-filter">
              <span>Sort</span>
              <select value={researchSort} onChange={(event) => onResearchSortChange(event.target.value as ResearchSort)}>
                <option value="level-low">Spell Level Low to High</option>
                <option value="level-high">Spell Level High to Low</option>
                <option value="trivial-low">Trivial Low to High</option>
                <option value="trivial-high">Trivial High to Low</option>
                <option value="name">Name A-Z</option>
              </select>
            </label>
            <div className="research-chip-group" aria-label="Research class filters">
              <span>Class</span>
              <div>
                {RESEARCH_CLASSES.map((className) => (
                  <button
                    aria-pressed={selectedResearchClasses.has(className)}
                    className={selectedResearchClasses.has(className) ? "research-chip is-active" : "research-chip"}
                    key={className}
                    onClick={() => onToggleResearchClass(className)}
                    type="button"
                  >
                    {className}
                  </button>
                ))}
              </div>
            </div>
            <div className="research-chip-group" aria-label="Research expansion filters">
              <span>Expansion</span>
              <div>
                {researchExpansionFilters.map((expansion) => (
                  <button
                    aria-pressed={selectedResearchExpansions.has(expansion.sourceExpansion)}
                    className={selectedResearchExpansions.has(expansion.sourceExpansion) ? "research-chip is-active" : "research-chip"}
                    key={expansion.sourceExpansion}
                    onClick={() => onToggleResearchExpansion(expansion.sourceExpansion)}
                    type="button"
                  >
                    {expansion.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="research-toggle">
              <input
                checked={showUnmappedResearch}
                onChange={onToggleShowUnmappedResearch}
                type="checkbox"
              />
              <span>Show unmapped research records</span>
            </label>
          </section>

          {!hasActiveFilter ? (
            <p className="crafting-empty">Choose a class, expansion, or search term to view research spells.</p>
          ) : rows.length === 0 ? (
            <p className="crafting-empty">No Spell Research records match the active filters.</p>
          ) : (
            <div className="research-results">
              {rows.map((row) => {
                const spellKey = `${row.recipe.id ?? row.recipe.name}:${row.className}:${row.spellLevel ?? "unknown"}`;
                return (
                  <ResearchSpellCard
                    expanded={expandedResearchSpells.has(spellKey)}
                    key={spellKey}
                    onToggle={() => onToggleResearchSpell(spellKey)}
                    row={row}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CraftingTabs({ skillData }: CraftingTabsProps) {
  const [activeSkill, setActiveSkill] = useState<CraftingSkill>(skillData[0]?.skill ?? "tailoring");
  const [searchQuery, setSearchQuery] = useState("");
  const [minTrivial, setMinTrivial] = useState("");
  const [maxTrivial, setMaxTrivial] = useState("");
  const [sort, setSort] = useState<CraftingSort>("trivial-low");
  const [researchSearch, setResearchSearch] = useState("");
  const [selectedResearchClasses, setSelectedResearchClasses] = useState<Set<ResearchClassName>>(() => new Set());
  const [selectedResearchExpansions, setSelectedResearchExpansions] = useState<Set<string>>(() => new Set());
  const [showUnmappedResearch, setShowUnmappedResearch] = useState(false);
  const [researchSort, setResearchSort] = useState<ResearchSort>("level-low");
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(() => new Set());
  const [researchViewMode, setResearchViewMode] = useState<ResearchViewMode>("skill-up");
  const [expandedResearchBands, setExpandedResearchBands] = useState<Set<string>>(() => new Set());
  const [expandedResearchSpells, setExpandedResearchSpells] = useState<Set<string>>(() => new Set());
  const active = skillData.find((s) => s.skill === activeSkill) ?? skillData[0];
  const [drawerItem, setDrawerItem] = useState<{ item: string; bucket: Bucket } | null>(null);
  const modifierHeldRef = useRef(false);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      modifierHeldRef.current = event.metaKey || event.ctrlKey;
    }
    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => document.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, []);

  function handleSelectLoot(itemName: string, bucket: Bucket) {
    if (modifierHeldRef.current) {
      window.open(`/item/${itemToSlug(itemName)}`, "_blank", "noopener");
      modifierHeldRef.current = false;
      return;
    }
    setDrawerItem({ item: itemName, bucket });
  }

  function toggleFamily(familyId: string) {
    setExpandedFamilies((current) => {
      const next = new Set(current);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  }

  function toggleResearchClass(className: ResearchClassName) {
    setSelectedResearchClasses((current) => toggleSetValue(current, className));
  }

  function toggleResearchExpansion(expansion: string) {
    setSelectedResearchExpansions((current) => toggleSetValue(current, expansion));
  }

  function toggleResearchBand(bandId: string) {
    setExpandedResearchBands((current) => toggleSetValue(current, bandId));
  }

  function toggleResearchSpell(spellId: string) {
    setExpandedResearchSpells((current) => toggleSetValue(current, spellId));
  }

  return (
    <div className="crafting-tabs">
      <div className="crafting-tab-bar" role="tablist" aria-label="Crafting skill">
        {CRAFTING_SKILLS.map((skill) => (
          <button
            aria-pressed={skill === activeSkill}
            aria-selected={skill === activeSkill}
            className={[
              "filter-button",
              "crafting-tab-button",
              `skill-tone-${skill}`,
              skill === activeSkill ? "is-active" : null,
            ].filter(Boolean).join(" ")}
            key={skill}
            onClick={() => setActiveSkill(skill)}
            role="tab"
            type="button"
          >
            {SKILL_LABELS[skill]}
          </button>
        ))}
      </div>

      {activeSkill !== "spell-research" ? (
        <section className="crafting-controls" aria-label="Recipe filters">
          <label className="crafting-filter crafting-search-filter">
            <span>Search recipes/components</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search recipes or components"
              type="search"
              value={searchQuery}
            />
          </label>
          <label className="crafting-filter">
            <span>Min trivial</span>
            <input
              min={0}
              onChange={(event) => setMinTrivial(event.target.value)}
              placeholder="Any"
              step={1}
              type="number"
              value={minTrivial}
            />
          </label>
          <label className="crafting-filter">
            <span>Max trivial</span>
            <input
              min={0}
              onChange={(event) => setMaxTrivial(event.target.value)}
              placeholder="Any"
              step={1}
              type="number"
              value={maxTrivial}
            />
          </label>
          <label className="crafting-filter">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as CraftingSort)}>
              <option value="trivial-low">Lowest trivial first</option>
              <option value="trivial-high">Highest trivial first</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="components">Fewest components</option>
            </select>
          </label>
        </section>
      ) : null}

      <div
        aria-label={`${SKILL_LABELS[activeSkill]} recipes`}
        className="crafting-tab-panel"
        role="tabpanel"
      >
        {active && active.skill === "spell-research" ? (
          <ResearchPanel
            expandedResearchBands={expandedResearchBands}
            expandedResearchSpells={expandedResearchSpells}
            onResearchViewModeChange={setResearchViewMode}
            onResearchSearchChange={setResearchSearch}
            onResearchSortChange={setResearchSort}
            onToggleResearchBand={toggleResearchBand}
            onToggleResearchClass={toggleResearchClass}
            onToggleResearchExpansion={toggleResearchExpansion}
            onToggleResearchSpell={toggleResearchSpell}
            onToggleShowUnmappedResearch={() => setShowUnmappedResearch((current) => !current)}
            recipes={active.recipes}
            researchSearch={researchSearch}
            researchSort={researchSort}
            researchViewMode={researchViewMode}
            selectedResearchClasses={selectedResearchClasses}
            selectedResearchExpansions={selectedResearchExpansions}
            showUnmappedResearch={showUnmappedResearch}
          />
        ) : active ? (
          <SkillPanel
            expandedFamilies={expandedFamilies}
            maxTrivial={maxTrivial}
            minTrivial={minTrivial}
            onSelectLoot={handleSelectLoot}
            onToggleFamily={toggleFamily}
            recipes={active.recipes}
            searchQuery={searchQuery}
            skill={active.skill}
            sort={sort}
          />
        ) : null}
      </div>

      {drawerItem !== null ? (
        <ItemDrawer
          bucket={drawerItem.bucket}
          contentType="Recipe"
          details={itemDetailsMap[drawerItem.item]}
          expansion={drawerItem.bucket.expansion}
          itemName={drawerItem.item}
          onClose={() => setDrawerItem(null)}
          onSelectZone={() => {}}
        />
      ) : null}
    </div>
  );
}
