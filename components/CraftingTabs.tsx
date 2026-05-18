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

type CraftingSort = "trivial-low" | "trivial-high" | "alphabetical" | "components" | "metal-tier" | "slot";
type ResearchSort = "level-low" | "level-high" | "trivial-low" | "trivial-high" | "name";
type ResearchViewMode = "skill-up" | "lookup";
type JewelcraftFilters = {
  slot: string;
  metal: string;
  gem: string;
  statCategory: string;
  type: string;
  deity: string;
};
type TradeskillBrowseFilters = {
  category: string;
  slot: string;
  point: string;
  shaft: string;
  fletch: string;
  nockSize: string;
  range: string;
  damage: string;
};

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
  "sash",
  "belt",
  "collar",
  "veil",
  "skirt",
  "helm",
  "headband",
  "wristbands",
  "slippers",
  "pantaloons",
  "mail",
];

const researchExpansionFilters = [
  { label: "Classic", sourceExpansion: "Original" },
  { label: "Kunark", sourceExpansion: "Ruins of Kunark" },
  { label: "Velious", sourceExpansion: "Scars of Velious" },
  { label: "Luclin", sourceExpansion: "Shadows of Luclin" },
];

const earlyResearchExpansionCodes = new Set(researchExpansionFilters.map((filter) => filter.sourceExpansion));
const metalOrder: Record<string, number> = {
  Silver: 1,
  Electrum: 2,
  Gold: 3,
  Platinum: 4,
  Velium: 5,
};
const researchMetadataBySpellName = RESEARCH_SPELL_METADATA.reduce((map, metadata) => {
  const key = normalizeResearchSpellName(metadata.spellName);
  map.set(key, [...(map.get(key) ?? []), metadata]);
  return map;
}, new Map<string, ResearchSpellMetadata[]>());

function trivialDifficultyClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "is-trivial-unknown";
  if (value <= 50) return "is-trivial-green";
  if (value <= 100) return "is-trivial-blue";
  if (value <= 150) return "is-trivial-gold";
  if (value <= 200) return "is-trivial-orange";
  return "is-trivial-red";
}

function TrivialBadge({
  value,
  maxValue,
  compact = false,
}: {
  value: number | null | undefined;
  maxValue?: number | null;
  compact?: boolean;
}) {
  const displayValue = value === null || value === undefined
    ? "?"
    : maxValue !== null && maxValue !== undefined && maxValue !== value
      ? `${value}-${maxValue}`
      : String(value);
  const toneValue = maxValue ?? value;

  return (
    <span className={`trivial-badge ${trivialDifficultyClass(toneValue)}${compact ? " is-compact" : ""}`}>
      Trivial {displayValue}
    </span>
  );
}

function metadataString(recipe: CraftingRecipe, key: string) {
  const value = recipe.sourceMetadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function getJewelcraftMeta(recipe: CraftingRecipe) {
  if (recipe.skill !== "jewelcraft" || metadataString(recipe, "source") !== "Project1999 Jewelcrafting") return null;
  return {
    type: metadataString(recipe, "jewelcraftType"),
    metal: metadataString(recipe, "metal"),
    metalTier: Number(recipe.sourceMetadata?.metalTier ?? 9999),
    gem: metadataString(recipe, "gem"),
    deity: metadataString(recipe, "deity"),
    slot: metadataString(recipe, "slot"),
    statCategory: metadataString(recipe, "statCategory"),
    enchantedBar: metadataString(recipe, "enchantedBar"),
    normalBar: metadataString(recipe, "normalBar"),
    p99ItemUrl: metadataString(recipe, "p99ItemUrl"),
    trivialText: metadataString(recipe, "trivialText"),
  };
}

function recipeMatchesJewelcraftFilters(recipe: CraftingRecipe, filters: JewelcraftFilters | null) {
  if (!filters) return true;
  const meta = getJewelcraftMeta(recipe);
  if (!meta) return true;
  return (!filters.slot || meta.slot === filters.slot)
    && (!filters.metal || meta.metal === filters.metal)
    && (!filters.gem || meta.gem === filters.gem)
    && (!filters.statCategory || meta.statCategory === filters.statCategory)
    && (!filters.type || meta.type === filters.type)
    && (!filters.deity || meta.deity === filters.deity);
}

function firstJewelcraftMeta(family: RecipeFamily) {
  return family.recipes.map(getJewelcraftMeta).find(Boolean) ?? null;
}

function hasPostLuclinRecipe(family: RecipeFamily) {
  return family.recipes.some((recipe) => recipe.sourceMetadata?.postLuclin === true);
}

function getTradeskillBrowseMeta(recipe: CraftingRecipe) {
  const tableIndex = Number(recipe.sourceMetadata?.tableIndex ?? -1);
  const name = recipe.output.name || recipe.name;
  const details = itemDetailsMap[name];
  const slot = String(details?.slot ?? "").split(/\s+/)[0] || "";
  if (recipe.skill === "jewelcraft") return null;
  if (recipe.skill === "tailoring") {
    const category = /^Wu's Fighting/i.test(name) ? "Wu's Fighting Armor"
      : /Crystalline Silk/i.test(name) ? "Crystalline Silk"
      : /Cured Silk/i.test(name) ? "Cured Silk"
      : /Raw Silk/i.test(name) ? "Raw Silk"
      : /Reinforced/i.test(name) ? "Reinforced Armor"
      : /Patchwork|Tattered/i.test(name) ? "Patchwork/Tattered"
      : /Studded/i.test(name) ? "Studded Leather"
      : /Ice Silk/i.test(name) ? "Ice Silk"
      : /Othmir/i.test(name) ? "Othmir Fur"
      : /Cobalt Drake/i.test(name) ? "Cobalt Drake"
      : /Tigeraptor/i.test(name) ? "Tigeraptor"
      : /Haze Panther/i.test(name) ? "Haze Panther"
      : /Arctic Wyvern/i.test(name) ? "Arctic Wyvern"
      : /Black Pantherskin/i.test(name) ? "Black Pantherskin"
      : tableIndex === 2 ? "Bags"
      : tableIndex === 3 ? "Components"
      : "Tailoring";
    return { category, slot };
  }
  if (recipe.skill === "smithing") {
    const category = tableIndex === 10 ? "Banded Armor"
      : tableIndex === 12 ? "Ornate Chain Armor"
      : tableIndex === 13 ? "Fine Plate Armor"
      : tableIndex === 11 ? "Shields"
      : tableIndex === 5 ? "Tarnished Weapons"
      : tableIndex === 6 ? "Forged Weapons"
      : tableIndex === 7 ? "Velium Weapons"
      : tableIndex === 8 ? "Silvered Weapons"
      : tableIndex === 9 ? "Arrowheads/Javelins"
      : tableIndex >= 1 && tableIndex <= 4 ? "Components/Tools"
      : "Smithing";
    const smithSlot = name.replace(/\s*\(.+?\)\s*/g, "").trim();
    return { category, slot: slot || smithSlot };
  }
  if (recipe.skill === "fletching") {
    const category = /arrow/i.test(name) ? "Arrows" : tableIndex === 5 || /bow/i.test(name) ? "Bows" : "Components";
    const arrow = getFletchingArrowMeta(recipe);
    return {
      category,
      slot: category === "Arrows" ? "Ammo" : category === "Bows" ? "Bow" : "",
      point: arrow?.point ?? "",
      shaft: arrow?.shaft ?? "",
      fletch: arrow?.fletch ?? "",
      nockSize: arrow?.nockSize ?? "",
      range: arrow?.range !== null && arrow?.range !== undefined ? String(arrow.range) : "",
      damage: arrow?.damage !== null && arrow?.damage !== undefined ? String(arrow.damage) : "",
    };
  }
  if (recipe.skill === "brewing") {
    const use = metadataString(recipe, "brewingUse");
    const yieldText = metadataString(recipe, "brewingYield");
    const container = recipe.container && !/^none$/i.test(recipe.container) ? recipe.container : "";
    return {
      category: use || "Brewing",
      slot: container,
      yield: yieldText,
    };
  }
  if (recipe.skill === "pottery") {
    const category = /idol/i.test(name) ? "Idols"
      : /vial/i.test(name) ? "Vials"
      : /bowl|jar|container/i.test(name) ? "Containers"
      : /clay|ceramic|skewer|cake round/i.test(name) ? "Clay/Ceramic Components"
      : "Pottery";
    return { category, slot };
  }
  if (recipe.skill === "tinkering") {
    const category = /cam|bow/i.test(name) ? "Bow Components"
      : /clockwork|probe|stalking/i.test(name) ? "Devices"
      : /lockpick|spyglass|compass|fishing/i.test(name) ? "Tools"
      : "Tinkered Items";
    return { category, slot };
  }
  return null;
}

function getFletchingArrowMeta(recipe: CraftingRecipe) {
  if (recipe.skill !== "fletching" || recipe.sourceMetadata?.arrowTable !== true) return null;
  const metadata = recipe.arrowMetadata ?? {};
  const fromMetadata = (key: string) => {
    const value = recipe.sourceMetadata?.[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
  const numberValue = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    damage: numberValue(metadata.damage ?? recipe.sourceMetadata?.arrowDamage),
    range: numberValue(metadata.range ?? recipe.sourceMetadata?.arrowRange),
    cost: typeof metadata.cost === "string" ? metadata.cost : fromMetadata("arrowCost"),
    point: typeof metadata.point === "string" ? metadata.point : fromMetadata("arrowPoint"),
    shaft: typeof metadata.shaft === "string" ? metadata.shaft : fromMetadata("arrowShaft"),
    fletch: typeof metadata.fletch === "string" ? metadata.fletch : fromMetadata("arrowFletch"),
    nockSize: typeof metadata.nockSize === "string" ? metadata.nockSize : fromMetadata("arrowNockSize"),
    unresolvedNockComponent: metadata.unresolvedNockComponent === true || recipe.sourceMetadata?.unresolvedNockComponent === true,
  };
}

function parseStageIngredients(value: string) {
  if (!value) return [];
  return value.split("|").map((entry) => {
    const match = entry.match(/^\s*(\d+)x\s+(.+?)\s*$/i);
    return match ? { count: Number(match[1]), name: match[2] } : { count: 1, name: entry.trim() };
  }).filter((entry) => entry.name);
}

function getPotteryStageMeta(recipe: CraftingRecipe) {
  if (recipe.skill !== "pottery" || recipe.sourceMetadata?.potteryTwoStage !== true) return null;
  const wheelTrivial = typeof recipe.sourceMetadata.potteryWheelTrivial === "number" ? recipe.sourceMetadata.potteryWheelTrivial : null;
  const kilnTrivial = typeof recipe.sourceMetadata.kilnTrivial === "number" ? recipe.sourceMetadata.kilnTrivial : null;
  return {
    wheelTrivial,
    kilnTrivial,
    finalTrivial: typeof recipe.sourceMetadata.finalTrivial === "number" ? recipe.sourceMetadata.finalTrivial : recipe.trivial,
    wheelIngredients: parseStageIngredients(metadataString(recipe, "potteryWheelIngredients")),
    kilnIngredients: parseStageIngredients(metadataString(recipe, "kilnIngredients")),
  };
}

function parseMetadataList(value: string) {
  return value.split("|").map((entry) => entry.trim()).filter(Boolean);
}

function statCodeLabel(code: string) {
  const labels: Record<string, string> = {
    MR: "Magic Resist",
    DR: "Disease Resist",
    PR: "Poison Resist",
    FR: "Fire Resist",
    CR: "Cold Resist",
  };
  return labels[code] ?? code;
}

function formatMetadataStatSummary(value: string) {
  return parseMetadataList(value)
    .map((entry) => {
      const match = entry.match(/^([A-Z]+)\s+([+-]?\d+)$/);
      if (!match) return entry;
      const amount = Number(match[2]);
      return `${statCodeLabel(match[1])} ${amount >= 0 ? "+" : ""}${amount}`;
    })
    .join(", ");
}

function getPotteryIdolMeta(recipe: CraftingRecipe) {
  if (recipe.skill !== "pottery" || recipe.sourceMetadata?.potteryIdol !== true) return null;
  return {
    slotUsage: parseMetadataList(metadataString(recipe, "slotUsage")),
    stats: formatMetadataStatSummary(metadataString(recipe, "p99StatSummary")),
    resists: formatMetadataStatSummary(metadataString(recipe, "p99ResistSummary")),
    deity: metadataString(recipe, "deity"),
    p99ItemUrl: metadataString(recipe, "p99ItemUrl"),
  };
}

function getSizeVariantMeta(recipe: CraftingRecipe) {
  const variants = recipe.sizeVariants?.length
    ? recipe.sizeVariants
    : parseMetadataList(metadataString(recipe, "sizeVariants"));
  if (variants.length === 0) return null;
  const codes = metadataString(recipe, "sizeVariantCodes") || variants.map((variant) => variant.charAt(0)).join("|");
  return {
    variants,
    codes: codes.split("|").map((entry) => entry.trim()).filter(Boolean),
  };
}

function smithingSizedComponentName(componentName: string, selectedSize: string, recipe: CraftingRecipe) {
  const variantName = recipe.components
    .find((component) => component.name === componentName)
    ?.sizeVariantDetails?.[selectedSize]?.name;
  if (variantName) return variantName;
  const base = componentName.replace(new RegExp(`^${selectedSize}\\s+`, "i"), "").trim();
  const tableIndex = Number(recipe.sourceMetadata?.tableIndex ?? -1);
  const shouldAddMoldSuffix = recipe.skill === "smithing"
    && tableIndex === 13
    && /^Plate\b/i.test(base)
    && !/\bMold\b/i.test(base);
  return `${selectedSize} ${base}${shouldAddMoldSuffix ? " Mold" : ""}`.replace(/\s+/g, " ").trim();
}

function getSelectedSizeVariantDetail(recipe: CraftingRecipe, selectedSize: string) {
  return recipe.sizeVariantDetails?.[selectedSize] ?? null;
}

function familySizeVariantMeta(family: RecipeFamily) {
  return family.recipes.map(getSizeVariantMeta).find(Boolean) ?? null;
}

function recipeMatchesTradeskillFilters(recipe: CraftingRecipe, filters: TradeskillBrowseFilters | null) {
  if (!filters) return true;
  const meta = getTradeskillBrowseMeta(recipe);
  if (!meta) return true;
  return (!filters.category || meta.category === filters.category)
    && (!filters.slot || meta.slot === filters.slot)
    && (!filters.point || meta.point === filters.point)
    && (!filters.shaft || meta.shaft === filters.shaft)
    && (!filters.fletch || meta.fletch === filters.fletch)
    && (!filters.nockSize || meta.nockSize === filters.nockSize)
    && (!filters.range || meta.range === filters.range)
    && (!filters.damage || meta.damage === filters.damage);
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
  const browseMeta = getTradeskillBrowseMeta(recipe);
  if (recipe.skill === "brewing") return outputName;
  if (recipe.skill === "smithing" && browseMeta?.category && ["Banded Armor", "Ornate Chain Armor", "Fine Plate Armor"].includes(browseMeta.category)) {
    return browseMeta.category;
  }
  if (recipe.skill === "tailoring" && browseMeta?.category && !["Tailoring", "Components", "Bags"].includes(browseMeta.category)) {
    return browseMeta.category;
  }
  if (recipe.skill === "fletching") {
    if (browseMeta?.category === "Arrows") return outputName.replace(/^CLASS\s+\d+\s+/i, "").replace(/\s+Arrow$/i, " Arrows");
    if (browseMeta?.category === "Bows") return "Bow Recipes";
  }
  if (recipe.skill === "pottery" && browseMeta?.category && browseMeta.category !== "Pottery") {
    return browseMeta.category;
  }
  if (recipe.skill === "tinkering" && browseMeta?.category) return browseMeta.category;
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
    const key = recipe.skill === "brewing"
      ? normalizeForSearch(`${recipe.skill}:${recipe.id ?? recipe.name}:${recipe.sourceMetadata?.tableIndex ?? ""}:${recipe.sourceMetadata?.row ?? ""}`)
      : normalizeForSearch(`${recipe.skill}:${familyName}`);
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
    metadataString(recipe, "brewingUse"),
    metadataString(recipe, "brewingYield"),
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
    if (sort === "metal-tier") {
      const aMeta = firstJewelcraftMeta(a);
      const bMeta = firstJewelcraftMeta(b);
      return (aMeta?.metalTier ?? 9999) - (bMeta?.metalTier ?? 9999)
        || (a.minTrivial ?? 9999) - (b.minTrivial ?? 9999)
        || a.name.localeCompare(b.name);
    }
    if (sort === "slot") {
      const aMeta = firstJewelcraftMeta(a);
      const bMeta = firstJewelcraftMeta(b);
      return (aMeta?.slot ?? "").localeCompare(bMeta?.slot ?? "")
        || (a.minTrivial ?? 9999) - (b.minTrivial ?? 9999)
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

function formatItemStats(details: ItemDetailsMap[string] | undefined) {
  if (!details) return "";
  const ac = details.ac !== null && details.ac !== undefined ? [`AC ${details.ac}`] : [];
  const stats = Object.entries(details.stats ?? {}).map(([key, value]) => `${key} ${value}`);
  const resists = Object.entries(details.resists ?? {}).map(([key, value]) => `${key} ${value}`);
  return [...ac, ...stats, ...resists].join(", ");
}

function isProcessComponent(component: Pick<CraftingRecipe["components"][number], "name" | "componentType">) {
  return Boolean(
    component.componentType
      && component.componentType !== "ingredient"
      && component.componentType !== "finalItem"
      && component.componentType !== "unknown",
  );
}

function ProcessComponentChip({
  component,
}: {
  component: Pick<CraftingRecipe["components"][number], "name" | "count" | "componentType" | "placeholderDescription" | "sourceNotes" | "templateOptions" | "dataQualityNote">;
}) {
  // TODO: Future enrichment should map template placeholders to exact valid item options from P99 or Allakhazam.
  const isTemplate = component.componentType === "template";
  const templateOptions = component.templateOptions?.filter(Boolean) ?? [];
  const description = component.placeholderDescription
    ?? component.sourceNotes
    ?? (isTemplate ? "Template component used by this recipe. Specific template options not imported yet." : component.componentType ?? "process component");
  const detail = isTemplate
    ? templateOptions.length > 0
      ? `Options: ${templateOptions.join(" / ")}`
      : "Specific template options not imported yet."
    : component.dataQualityNote ?? "";

  return (
    <li
      className={`recipe-component-item is-process-component${isTemplate ? " is-template-component" : ""}`}
      title={detail ? `${description} ${detail}` : description}
    >
      {component.count > 1 ? <span className="recipe-component-count">{component.count}x</span> : null}
      <span className="recipe-process-component-label">
        <span aria-hidden="true" className="recipe-process-component-icon" />
        <span>{component.name}</span>
      </span>
      {isTemplate ? (
        <span className="recipe-template-detail">
          {templateOptions.length > 0 ? `Options: ${templateOptions.join(" / ")}` : "Options not imported yet"}
        </span>
      ) : null}
    </li>
  );
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

function RecipeComponentContextTags({ component }: { component: CraftingRecipe["components"][number] }) {
  const tags = [
    component.acquisitionType && component.acquisitionType !== "unknown" ? component.acquisitionType : null,
    component.subcombineRecipe ? "subcombine" : null,
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

function componentContextTitle(component: CraftingRecipe["components"][number]) {
  return [
    component.sourceName && component.sourceName !== component.name ? `${component.name}: ${component.sourceName}` : component.name,
    component.acquisitionType && component.acquisitionType !== "unknown" ? `Acquisition: ${component.acquisitionType}` : null,
    component.sourceNotes ?? null,
    component.subcombineRecipe ? `Subcombine: ${component.subcombineRecipe.name}` : null,
  ].filter(Boolean).join(" - ");
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
  const jewelcraftMeta = getJewelcraftMeta(recipe);
  const browseMeta = getTradeskillBrowseMeta(recipe);
  const arrowMeta = getFletchingArrowMeta(recipe);
  const potteryStageMeta = getPotteryStageMeta(recipe);
  const potteryIdolMeta = getPotteryIdolMeta(recipe);
  const sizeVariantMeta = getSizeVariantMeta(recipe);
  const [selectedSize, setSelectedSize] = useState("Medium");
  const activeSize = sizeVariantMeta?.variants.includes(selectedSize)
    ? selectedSize
    : sizeVariantMeta?.variants.find((variant) => variant === "Medium") ?? sizeVariantMeta?.variants[0] ?? "Medium";
  const selectedSizeDetail = getSelectedSizeVariantDetail(recipe, activeSize);
  const selectedOutputName = selectedSizeDetail?.output.name ?? recipe.output.name;
  const selectedOutputDetails = itemDetailsMap[selectedOutputName] ?? outputDetails;
  const hasSizedComponent = recipe.components.some((component) => component.sizeVariants?.length);
  const jewelcraftStats = formatItemStats(outputDetails);

  return (
    <article className={dimmed ? "recipe-detail-row is-dimmed" : "recipe-detail-row"}>
      <div className="recipe-detail-heading">
        <button
          className="recipe-output-link"
          onClick={() => onSelectLoot(selectedOutputName, makeCraftingBucket(selectedOutputName, recipe))}
          type="button"
          {...previewProps(selectedOutputName, selectedOutputDetails)}
        >
          <ItemIcon details={selectedOutputDetails} />
          <span>{selectedOutputName}</span>
        </button>
        <TrivialBadge compact value={recipe.trivial} />
      </div>
      {sizeVariantMeta ? (
        <div className="recipe-size-selector-row">
          <span>Size</span>
          <div className="recipe-size-selector" role="group" aria-label={`${recipe.output.name} size`}>
            {sizeVariantMeta.variants.map((variant) => (
              <button
                className={variant === activeSize ? "is-active" : ""}
                key={variant}
                onClick={() => setSelectedSize(variant)}
                type="button"
              >
                {variant}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {potteryStageMeta ? (
        <div className="pottery-stage-list">
          <PotteryStage
            ingredients={potteryStageMeta.wheelIngredients}
            label="Stage 1: Pottery Wheel"
            onSelectLoot={onSelectLoot}
            recipe={recipe}
            trivial={potteryStageMeta.wheelTrivial}
          />
          <PotteryStage
            ingredients={potteryStageMeta.kilnIngredients}
            label="Stage 2: Kiln"
            onSelectLoot={onSelectLoot}
            recipe={recipe}
            trivial={potteryStageMeta.kilnTrivial}
          />
        </div>
      ) : (
        <ul className="recipe-components-list">
          {recipe.components.map((component, idx) => {
            if (isProcessComponent(component)) {
              return <ProcessComponentChip component={component} key={`${component.name}-${component.count}-${idx}`} />;
            }
            const componentDisplayName = component.sizeVariants?.length
              ? smithingSizedComponentName(component.name, activeSize, recipe)
              : component.name;
            const variantComponent = component.sizeVariantDetails?.[activeSize] ?? null;
            const componentDetails = itemDetailsMap[componentDisplayName] ?? itemDetailsMap[component.name];
            const componentTitle = variantComponent?.sourceUrl
              ? `${componentDisplayName} - P99 source: ${variantComponent.sourceUrl}`
              : componentContextTitle(component);
            return (
              <li className="recipe-component-item" key={`${component.name}-${component.count}-${idx}`}>
                {component.count > 1 ? <span className="recipe-component-count">{component.count}x</span> : null}
                <button
                  className="recipe-component-link"
                  onClick={() => onSelectLoot(componentDisplayName, makeCraftingBucket(componentDisplayName, recipe))}
                  title={componentTitle || undefined}
                  type="button"
                  {...previewProps(componentDisplayName, componentDetails)}
                >
                  <ItemIcon details={componentDetails} />
                  <span>{componentDisplayName}</span>
                </button>
                <RecipeComponentContextTags component={component} />
              </li>
            );
          })}
        </ul>
      )}
      {jewelcraftMeta ? (
        <div className="recipe-detail-meta">
          {jewelcraftMeta.enchantedBar ? <span>Bar: {jewelcraftMeta.enchantedBar}</span> : null}
          {jewelcraftMeta.gem ? <span>Gem: {jewelcraftMeta.gem}</span> : null}
          {jewelcraftMeta.slot ? <span>Slot: {jewelcraftMeta.slot}</span> : null}
          {jewelcraftMeta.statCategory ? <span>Type: {jewelcraftMeta.statCategory}</span> : null}
          {jewelcraftStats ? <span>Stats: {jewelcraftStats}</span> : null}
          {jewelcraftMeta.deity ? <span>Deity: {jewelcraftMeta.deity}</span> : null}
          {jewelcraftMeta.p99ItemUrl ? (
            <a href={jewelcraftMeta.p99ItemUrl} rel="noopener noreferrer" target="_blank">
              P99 source
            </a>
          ) : null}
        </div>
      ) : potteryIdolMeta ? (
        <div className="recipe-detail-meta">
          {potteryIdolMeta.slotUsage.length > 0 ? <span>Usable In: {potteryIdolMeta.slotUsage.join(" • ")}</span> : null}
          {potteryIdolMeta.stats ? <span>Stats: {potteryIdolMeta.stats}</span> : null}
          {potteryIdolMeta.resists ? <span>Resists: {potteryIdolMeta.resists}</span> : null}
          {potteryIdolMeta.deity ? <span>Deity: {potteryIdolMeta.deity}</span> : null}
          {potteryIdolMeta.p99ItemUrl ? (
            <a href={potteryIdolMeta.p99ItemUrl} rel="noopener noreferrer" target="_blank">
              P99 source
            </a>
          ) : null}
        </div>
      ) : browseMeta || recipe.sourceUrl ? (
        <div className="recipe-detail-meta">
          {browseMeta?.category ? <span>Category: {browseMeta.category}</span> : null}
          {browseMeta?.slot ? <span>Slot/type: {browseMeta.slot}</span> : null}
          {recipe.skill === "brewing" && metadataString(recipe, "brewingYield") ? <span>Yield: {metadataString(recipe, "brewingYield")}</span> : null}
          {arrowMeta?.damage !== null && arrowMeta?.damage !== undefined ? <span>Damage: {arrowMeta.damage}</span> : null}
          {arrowMeta?.range !== null && arrowMeta?.range !== undefined ? <span>Range: {arrowMeta.range}</span> : null}
          {arrowMeta?.point ? <span>Point: {arrowMeta.point}</span> : null}
          {arrowMeta?.shaft ? <span>Shaft: {arrowMeta.shaft}</span> : null}
          {arrowMeta?.fletch ? <span>Fletch: {arrowMeta.fletch}</span> : null}
          {arrowMeta?.nockSize ? <span>Nock: {arrowMeta.nockSize}</span> : null}
          {sizeVariantMeta ? <span>Selected size: {activeSize}</span> : null}
          {selectedSizeDetail?.output.weight !== null && selectedSizeDetail?.output.weight !== undefined ? <span>Weight: {selectedSizeDetail.output.weight}</span> : null}
          {formatItemStats(selectedOutputDetails) ? <span>Stats: {formatItemStats(selectedOutputDetails)}</span> : null}
          {selectedSizeDetail?.output.sourceUrl || recipe.sourceUrl ? (
            <a href={selectedSizeDetail?.output.sourceUrl ?? recipe.sourceUrl ?? ""} rel="noopener noreferrer" target="_blank">
              P99 source
            </a>
          ) : null}
          {selectedSizeDetail?.output.allakhazamUrl ? (
            <a href={selectedSizeDetail.output.allakhazamUrl} rel="noopener noreferrer" target="_blank">
              Allakhazam
            </a>
          ) : null}
        </div>
      ) : null}
      {sizeVariantMeta && hasSizedComponent ? <p className="recipe-size-note">Only the mold or pattern changes by size.</p> : null}
      {recipe.notes ? <p className="recipe-notes">{recipe.notes}</p> : null}
    </article>
  );
}

function PotteryStage({
  label,
  trivial,
  ingredients,
  recipe,
  onSelectLoot,
}: {
  label: string;
  trivial: number | null;
  ingredients: Array<{ count: number; name: string }>;
  recipe: CraftingRecipe;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
}) {
  const { previewProps } = useItemPreview();
  return (
    <section className="pottery-stage">
      <div className="pottery-stage-heading">
        <strong>{label}</strong>
        {trivial !== null ? <TrivialBadge compact value={trivial} /> : null}
      </div>
      <ul className="recipe-components-list">
        {ingredients.map((component, idx) => {
          const originalComponent = recipe.components.find((entry) => entry.name === component.name);
          if (originalComponent && isProcessComponent(originalComponent)) {
            return <ProcessComponentChip component={{ ...originalComponent, count: component.count }} key={`${label}-${component.name}-${idx}`} />;
          }
          const componentDetails = itemDetailsMap[component.name];
          return (
            <li className="recipe-component-item" key={`${label}-${component.name}-${idx}`}>
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
    </section>
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
  const commonComponents = family.commonComponents.length ? `Common: ${family.commonComponents.join(", ")}` : "Components vary";
  const recipeCountLabel = family.recipes.length > 1 ? `${family.recipes.length} recipes` : null;
  const skillTone = family.recipes[0]?.skill ?? "tailoring";
  const postLuclin = hasPostLuclinRecipe(family);
  const sizeVariantMeta = familySizeVariantMeta(family);
  const potteryStageLabel = family.recipes.length === 1 ? (() => {
    const meta = getPotteryStageMeta(family.recipes[0]);
    return meta && meta.wheelTrivial !== null && meta.kilnTrivial !== null ? `Wheel ${meta.wheelTrivial} · Kiln ${meta.kilnTrivial}` : null;
  })() : null;

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
            <span className="recipe-family-titleline">
              <strong>{family.name}</strong>
              <TrivialBadge value={family.minTrivial} maxValue={family.maxTrivial} />
              {postLuclin ? <span className="recipe-era-warning">Post-Luclin</span> : null}
            </span>
            <small className="recipe-family-subline">
              {recipeCountLabel ? <span className="recipe-family-count">{recipeCountLabel}</span> : null}
              {potteryStageLabel ? <span className="recipe-family-count">{potteryStageLabel}</span> : null}
              {sizeVariantMeta ? (
                <span className="recipe-size-badge">
                  Sizes: {sizeVariantMeta.codes.join(" / ")}
                </span>
              ) : null}
              <span className="recipe-family-common">{commonComponents}</span>
            </small>
          </span>
        </span>
        <span className="recipe-family-meta">
          <span className="recipe-container-pill">{containers}</span>
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
  jewelcraftFilters,
  tradeskillFilters,
  expandedFamilies,
  onToggleFamily,
  onFilteredFamilyIdsChange,
  onSelectLoot,
}: SkillData & {
  searchQuery: string;
  minTrivial: string;
  maxTrivial: string;
  sort: CraftingSort;
  jewelcraftFilters?: JewelcraftFilters | null;
  tradeskillFilters?: TradeskillBrowseFilters | null;
  expandedFamilies: Set<string>;
  onToggleFamily: (familyId: string) => void;
  onFilteredFamilyIdsChange: (familyIds: string[], shouldAutoExpand: boolean) => void;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
}) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const parsedMin = parseTrivialFilter(minTrivial);
  const parsedMax = parseTrivialFilter(maxTrivial);
  const shouldAutoExpandFilteredFamilies = Boolean(
    (tradeskillFilters?.category || tradeskillFilters?.slot || tradeskillFilters?.point || tradeskillFilters?.shaft || tradeskillFilters?.fletch || tradeskillFilters?.nockSize || tradeskillFilters?.range || tradeskillFilters?.damage)
      || (jewelcraftFilters?.slot || jewelcraftFilters?.type),
  );

  const filteredFamilies = useMemo(() => {
    const families = buildRecipeFamilies(recipes).map((family) => {
      const matchingRecipeIds = new Set<string>();
      for (const recipe of family.recipes) {
        if (recipeMatchesFilters(recipe, family.name, normalizedQuery, parsedMin, parsedMax)) {
          if (!recipeMatchesJewelcraftFilters(recipe, jewelcraftFilters ?? null)) continue;
          if (!recipeMatchesTradeskillFilters(recipe, tradeskillFilters ?? null)) continue;
          matchingRecipeIds.add(`${recipe.skill}:${recipe.name}:${recipe.trivial ?? "unknown"}`);
        }
      }
      return { family, matchingRecipeIds };
    }).filter(({ matchingRecipeIds }) => matchingRecipeIds.size > 0);

    return sortFamilies(families.map(({ family }) => family), sort).map((family) => ({
      family,
      matchingRecipeIds: families.find((entry) => entry.family.id === family.id)?.matchingRecipeIds ?? new Set<string>(),
    }));
  }, [jewelcraftFilters, normalizedQuery, parsedMax, parsedMin, recipes, sort, tradeskillFilters]);

  useEffect(() => {
    onFilteredFamilyIdsChange(filteredFamilies.map(({ family }) => family.id), shouldAutoExpandFilteredFamilies);
  }, [filteredFamilies, onFilteredFamilyIdsChange, shouldAutoExpandFilteredFamilies]);

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
            <TrivialBadge compact value={trivial} />
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
                  <small className="recipe-family-subline">
                    {band.recipes.length} skill-up combine{band.recipes.length !== 1 ? "s" : ""}
                  </small>
                </span>
              </span>
              <span className="recipe-family-meta">
                <TrivialBadge value={minTrivial} maxValue={maxTrivial} />
                <span>Classic through Luclin only</span>
              </span>
            </button>
            {expanded ? (
              <div className="recipe-family-details">
                {band.recipes.map((recipe) => (
                  <article className="recipe-detail-row" key={`${recipe.id ?? recipe.name}:${recipe.trivial ?? "unknown"}`}>
                    <div className="recipe-detail-heading">
                      <span>{recipe.name}</span>
                      <TrivialBadge compact value={recipe.trivial} />
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
  const [jewelcraftFilters, setJewelcraftFilters] = useState<JewelcraftFilters>({
    slot: "",
    metal: "",
    gem: "",
    statCategory: "",
    type: "",
    deity: "",
  });
  const [tradeskillFilters, setTradeskillFilters] = useState<TradeskillBrowseFilters>({
    category: "",
    slot: "",
    point: "",
    shaft: "",
    fletch: "",
    nockSize: "",
    range: "",
    damage: "",
  });
  const [researchSearch, setResearchSearch] = useState("");
  const [selectedResearchClasses, setSelectedResearchClasses] = useState<Set<ResearchClassName>>(() => new Set());
  const [selectedResearchExpansions, setSelectedResearchExpansions] = useState<Set<string>>(() => new Set());
  const [showUnmappedResearch, setShowUnmappedResearch] = useState(false);
  const [researchSort, setResearchSort] = useState<ResearchSort>("level-low");
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(() => new Set());
  const autoExpandedFilterKeyRef = useRef("");
  const [researchViewMode, setResearchViewMode] = useState<ResearchViewMode>("skill-up");
  const [expandedResearchBands, setExpandedResearchBands] = useState<Set<string>>(() => new Set());
  const [expandedResearchSpells, setExpandedResearchSpells] = useState<Set<string>>(() => new Set());
  const active = skillData.find((s) => s.skill === activeSkill) ?? skillData[0];
  const jewelcraftOptions = useMemo(() => {
    const recipes = activeSkill === "jewelcraft" ? active?.recipes ?? [] : [];
    const values = (key: keyof JewelcraftFilters) => Array.from(new Set(
      recipes
        .map(getJewelcraftMeta)
        .map((meta) => meta?.[key])
        .filter((value): value is string => Boolean(value)),
    )).sort((a, b) => a.localeCompare(b));
    return {
      slot: values("slot"),
      metal: values("metal").sort((a, b) => (metalOrder[a] ?? 999) - (metalOrder[b] ?? 999) || a.localeCompare(b)),
      gem: values("gem"),
      statCategory: values("statCategory"),
      type: values("type"),
      deity: values("deity"),
    };
  }, [active?.recipes, activeSkill]);
  const browseFilterOptions = useMemo(() => {
    const supportsFilters = ["smithing", "tailoring", "fletching", "pottery", "tinkering", "brewing"].includes(activeSkill);
    const recipes = supportsFilters ? active?.recipes ?? [] : [];
    const metas = recipes.map(getTradeskillBrowseMeta).filter((meta): meta is NonNullable<ReturnType<typeof getTradeskillBrowseMeta>> => Boolean(meta));
    const values = (key: "category" | "slot" | "point" | "shaft" | "fletch" | "nockSize" | "range" | "damage") => Array.from(new Set(
      metas.map((meta) => meta[key]).filter((value): value is string => Boolean(value)),
    )).sort((a, b) => key === "range" || key === "damage" ? Number(a) - Number(b) : a.localeCompare(b));
    return {
      category: values("category"),
      slot: values("slot"),
      point: values("point"),
      shaft: values("shaft"),
      fletch: values("fletch"),
      nockSize: values("nockSize"),
      range: values("range"),
      damage: values("damage"),
    };
  }, [active?.recipes, activeSkill]);
  const [drawerItem, setDrawerItem] = useState<{ item: string; bucket: Bucket } | null>(null);
  const modifierHeldRef = useRef(false);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      modifierHeldRef.current = event.metaKey || event.ctrlKey;
    }
    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () => document.removeEventListener("mousedown", handleMouseDown, { capture: true });
  }, []);

  useEffect(() => {
    setTradeskillFilters({ category: "", slot: "", point: "", shaft: "", fletch: "", nockSize: "", range: "", damage: "" });
  }, [activeSkill]);

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

  const handleFilteredFamilyIdsChange = useMemo(() => (
    familyIds: string[],
    shouldAutoExpand: boolean,
  ) => {
    const filterKey = shouldAutoExpand
      ? `${activeSkill}:${tradeskillFilters.category}:${tradeskillFilters.slot}:${tradeskillFilters.point}:${tradeskillFilters.shaft}:${tradeskillFilters.fletch}:${tradeskillFilters.nockSize}:${tradeskillFilters.range}:${tradeskillFilters.damage}:${jewelcraftFilters.slot}:${jewelcraftFilters.type}`
      : "";
    if (!shouldAutoExpand) {
      autoExpandedFilterKeyRef.current = "";
      return;
    }
    if (autoExpandedFilterKeyRef.current === filterKey) return;
    autoExpandedFilterKeyRef.current = filterKey;
    setExpandedFamilies((current) => new Set([...current, ...familyIds]));
  }, [activeSkill, jewelcraftFilters.slot, jewelcraftFilters.type, tradeskillFilters.category, tradeskillFilters.damage, tradeskillFilters.fletch, tradeskillFilters.nockSize, tradeskillFilters.point, tradeskillFilters.range, tradeskillFilters.shaft, tradeskillFilters.slot]);

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

  function updateJewelcraftFilter(key: keyof JewelcraftFilters, value: string) {
    setJewelcraftFilters((current) => ({ ...current, [key]: value }));
  }

  function updateTradeskillFilter(key: keyof TradeskillBrowseFilters, value: string) {
    setTradeskillFilters((current) => ({ ...current, [key]: value }));
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
        <section className={`crafting-controls${activeSkill === "jewelcraft" ? " is-jewelcraft" : ""}`} aria-label="Recipe filters">
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
              {activeSkill === "jewelcraft" ? (
                <>
                  <option value="metal-tier">Metal tier</option>
                  <option value="slot">Slot</option>
                </>
              ) : (
                <option value="components">Fewest components</option>
              )}
            </select>
          </label>
          {activeSkill === "jewelcraft" ? (
            <>
              <label className="crafting-filter">
                <span>Slot</span>
                <select value={jewelcraftFilters.slot} onChange={(event) => updateJewelcraftFilter("slot", event.target.value)}>
                  <option value="">Any slot</option>
                  {jewelcraftOptions.slot.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </label>
              <label className="crafting-filter">
                <span>Metal</span>
                <select value={jewelcraftFilters.metal} onChange={(event) => updateJewelcraftFilter("metal", event.target.value)}>
                  <option value="">Any metal</option>
                  {jewelcraftOptions.metal.map((metal) => <option key={metal} value={metal}>{metal}</option>)}
                </select>
              </label>
              <label className="crafting-filter">
                <span>Gem</span>
                <select value={jewelcraftFilters.gem} onChange={(event) => updateJewelcraftFilter("gem", event.target.value)}>
                  <option value="">Any gem</option>
                  {jewelcraftOptions.gem.map((gem) => <option key={gem} value={gem}>{gem}</option>)}
                </select>
              </label>
              <label className="crafting-filter">
                <span>Stat type</span>
                <select value={jewelcraftFilters.statCategory} onChange={(event) => updateJewelcraftFilter("statCategory", event.target.value)}>
                  <option value="">Any stats</option>
                  {jewelcraftOptions.statCategory.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="crafting-filter">
                <span>Recipe type</span>
                <select value={jewelcraftFilters.type} onChange={(event) => updateJewelcraftFilter("type", event.target.value)}>
                  <option value="">Basic + imbued</option>
                  {jewelcraftOptions.type.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              {jewelcraftOptions.deity.length > 0 ? (
                <label className="crafting-filter">
                  <span>Deity</span>
                  <select value={jewelcraftFilters.deity} onChange={(event) => updateJewelcraftFilter("deity", event.target.value)}>
                    <option value="">Any deity</option>
                    {jewelcraftOptions.deity.map((deity) => <option key={deity} value={deity}>{deity}</option>)}
                  </select>
                </label>
              ) : null}
              <p className="crafting-inline-note">Stat jewelry requires enchanted metal bars; normal bars create non-stat versions.</p>
            </>
          ) : null}
          {activeSkill !== "jewelcraft" && browseFilterOptions.category.length > 0 ? (
            <>
              <label className="crafting-filter">
                <span>Category</span>
                <select value={tradeskillFilters.category} onChange={(event) => updateTradeskillFilter("category", event.target.value)}>
                  <option value="">Any category</option>
                  {browseFilterOptions.category.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              {browseFilterOptions.slot.length > 0 ? (
                <label className="crafting-filter">
                  <span>Slot / type</span>
                  <select value={tradeskillFilters.slot} onChange={(event) => updateTradeskillFilter("slot", event.target.value)}>
                    <option value="">Any slot/type</option>
                    {browseFilterOptions.slot.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                  </select>
                </label>
              ) : null}
              {activeSkill === "fletching" && browseFilterOptions.point.length > 0 ? (
                <label className="crafting-filter">
                  <span>Point</span>
                  <select value={tradeskillFilters.point} onChange={(event) => updateTradeskillFilter("point", event.target.value)}>
                    <option value="">Any point</option>
                    {browseFilterOptions.point.map((point) => <option key={point} value={point}>{point}</option>)}
                  </select>
                </label>
              ) : null}
              {activeSkill === "fletching" && browseFilterOptions.shaft.length > 0 ? (
                <label className="crafting-filter">
                  <span>Shaft</span>
                  <select value={tradeskillFilters.shaft} onChange={(event) => updateTradeskillFilter("shaft", event.target.value)}>
                    <option value="">Any shaft</option>
                    {browseFilterOptions.shaft.map((shaft) => <option key={shaft} value={shaft}>{shaft}</option>)}
                  </select>
                </label>
              ) : null}
              {activeSkill === "fletching" && browseFilterOptions.fletch.length > 0 ? (
                <label className="crafting-filter">
                  <span>Fletch</span>
                  <select value={tradeskillFilters.fletch} onChange={(event) => updateTradeskillFilter("fletch", event.target.value)}>
                    <option value="">Any fletch</option>
                    {browseFilterOptions.fletch.map((fletch) => <option key={fletch} value={fletch}>{fletch}</option>)}
                  </select>
                </label>
              ) : null}
              {activeSkill === "fletching" && browseFilterOptions.nockSize.length > 0 ? (
                <label className="crafting-filter">
                  <span>Nock size</span>
                  <select value={tradeskillFilters.nockSize} onChange={(event) => updateTradeskillFilter("nockSize", event.target.value)}>
                    <option value="">Any nock</option>
                    {browseFilterOptions.nockSize.map((nockSize) => <option key={nockSize} value={nockSize}>{nockSize}</option>)}
                  </select>
                </label>
              ) : null}
              {activeSkill === "fletching" && browseFilterOptions.damage.length > 0 ? (
                <label className="crafting-filter">
                  <span>Damage</span>
                  <select value={tradeskillFilters.damage} onChange={(event) => updateTradeskillFilter("damage", event.target.value)}>
                    <option value="">Any damage</option>
                    {browseFilterOptions.damage.map((damage) => <option key={damage} value={damage}>{damage}</option>)}
                  </select>
                </label>
              ) : null}
              {activeSkill === "fletching" && browseFilterOptions.range.length > 0 ? (
                <label className="crafting-filter">
                  <span>Range</span>
                  <select value={tradeskillFilters.range} onChange={(event) => updateTradeskillFilter("range", event.target.value)}>
                    <option value="">Any range</option>
                    {browseFilterOptions.range.map((range) => <option key={range} value={range}>{range}</option>)}
                  </select>
                </label>
              ) : null}
              {activeSkill === "fletching" && browseFilterOptions.nockSize.length > 0 ? (
                <p className="crafting-inline-note">Nock is shown as arrow metadata from the P99 table.</p>
              ) : null}
            </>
          ) : null}
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
            onFilteredFamilyIdsChange={handleFilteredFamilyIdsChange}
            onToggleFamily={toggleFamily}
            recipes={active.recipes}
            searchQuery={searchQuery}
            jewelcraftFilters={active.skill === "jewelcraft" ? jewelcraftFilters : null}
            tradeskillFilters={active.skill !== "jewelcraft" ? tradeskillFilters : null}
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
