"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CRAFTING_SKILLS, SKILL_LABELS, type CraftingRecipe, type CraftingSkill } from "@/lib/crafting";
import { getCraftingRecipeId } from "@/lib/crafting-recipe-ids";
import { useSavedCraftingRecipes } from "@/components/SavedCraftingRecipesProvider";

function trivialClass(value: number | null) {
  if (value === null) return "is-trivial-unknown";
  if (value <= 50) return "is-trivial-green";
  if (value <= 100) return "is-trivial-blue";
  if (value <= 150) return "is-trivial-gold";
  if (value <= 200) return "is-trivial-orange";
  return "is-trivial-red";
}

function RecipeTrivialBadge({ value }: { value: number | null }) {
  return (
    <span className={`trivial-badge is-compact ${trivialClass(value)}`}>
      Trivial {value ?? "?"}
    </span>
  );
}

function recipeCategory(recipe: CraftingRecipe) {
  const metadata = recipe.sourceMetadata ?? {};
  const candidates = [
    metadata.family,
    metadata.category,
    metadata.brewingUse,
    metadata.jewelcraftType,
    metadata.potteryCategory,
    metadata.tailoringSet,
    metadata.smithingSet,
    metadata.fletchingGroup,
  ];
  const value = candidates.find((entry) => typeof entry === "string" && entry.trim());
  if (typeof value === "string") return value;
  if (recipe.arrowMetadata) return "Arrows";
  return recipe.container || "Recipe";
}

function componentPreview(recipe: CraftingRecipe) {
  return recipe.components.slice(0, 5).map((component) => (
    <span className="saved-recipe-component" key={`${component.name}-${component.count}`}>
      {component.count > 1 ? `${component.count}x ` : ""}{component.name}
    </span>
  ));
}

export function SavedCraftingRecipesPage({ recipes }: { recipes: CraftingRecipe[] }) {
  const { savedRecipeIds, removeRecipe, saveRecipe } = useSavedCraftingRecipes();
  const [toast, setToast] = useState<{ message: string; recipeId: string } | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<CraftingSkill>>(() => new Set());

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const recipesById = useMemo(() => {
    const map = new Map<string, CraftingRecipe>();
    for (const recipe of recipes) {
      map.set(getCraftingRecipeId(recipe), recipe);
    }
    return map;
  }, [recipes]);

  const savedRecipes = useMemo(() => {
    return Array.from(savedRecipeIds)
      .map((recipeId) => recipesById.get(recipeId))
      .filter((recipe): recipe is CraftingRecipe => Boolean(recipe));
  }, [recipesById, savedRecipeIds]);

  const availableSkillFilters = useMemo(() => {
    const skills = new Set(savedRecipes.map((recipe) => recipe.skill));
    return CRAFTING_SKILLS.filter((skill) => skills.has(skill));
  }, [savedRecipes]);

  const groupedRecipes = useMemo(() => {
    const groups = new Map<CraftingSkill, CraftingRecipe[]>();
    for (const recipe of savedRecipes) {
      if (selectedSkills.size > 0 && !selectedSkills.has(recipe.skill)) continue;
      const group = groups.get(recipe.skill) ?? [];
      group.push(recipe);
      groups.set(recipe.skill, group);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => (a.trivial ?? 9999) - (b.trivial ?? 9999) || a.name.localeCompare(b.name));
    }

    return CRAFTING_SKILLS
      .map((skill) => ({ skill, recipes: groups.get(skill) ?? [] }))
      .filter((group) => group.recipes.length > 0);
  }, [savedRecipes, selectedSkills]);

  function toggleSkillFilter(skill: CraftingSkill) {
    setSelectedSkills((current) => {
      const next = new Set(current);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  }

  function handleRemove(recipe: CraftingRecipe) {
    const recipeId = getCraftingRecipeId(recipe);
    removeRecipe(recipeId);
    setToast({ message: "Recipe removed", recipeId });
  }

  if (savedRecipes.length === 0) {
    return (
      <>
        <section className="saved-recipes-empty">
          <p>No saved recipes yet.</p>
          <Link className="favorite-recipes-link" href="/crafting">Back to Crafting</Link>
        </section>
        {toast ? (
          <div className="crafting-save-toast" role="status">
            <span>{toast.message}</span>
            <button
              onClick={() => {
                saveRecipe(toast.recipeId);
                setToast(null);
              }}
              type="button"
            >
              Undo
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className="saved-recipes-page" aria-label="Saved crafting recipes">
      <div className="saved-recipes-filters" aria-label="Saved recipe tradeskill filters">
        <span>Tradeskill</span>
        <div>
          <button
            aria-pressed={selectedSkills.size === 0}
            className={selectedSkills.size === 0 ? "filter-button is-active" : "filter-button"}
            onClick={() => setSelectedSkills(new Set())}
            type="button"
          >
            All
          </button>
          {availableSkillFilters.map((skill) => {
            const active = selectedSkills.has(skill);
            return (
              <button
                aria-pressed={active}
                className={active ? "filter-button is-active" : "filter-button"}
                key={skill}
                onClick={() => toggleSkillFilter(skill)}
                type="button"
              >
                {SKILL_LABELS[skill]}
              </button>
            );
          })}
        </div>
      </div>

      {groupedRecipes.length === 0 ? (
        <section className="saved-recipes-empty">
          <p>No saved recipes match the selected tradeskill filters.</p>
          <button className="favorite-recipes-link" onClick={() => setSelectedSkills(new Set())} type="button">
            Show All Saved Recipes
          </button>
        </section>
      ) : null}

      {groupedRecipes.map((group) => (
        <section className="saved-recipes-group" key={group.skill}>
          <div className="saved-recipes-group-heading">
            <h2>{SKILL_LABELS[group.skill]}</h2>
            <span>{group.recipes.length} saved</span>
          </div>
          <div className="saved-recipes-list">
            {group.recipes.map((recipe) => (
              <article className={`saved-recipe-card skill-tone-${recipe.skill}`} key={getCraftingRecipeId(recipe)}>
                <div className="saved-recipe-main">
                  <div>
                    <p className="saved-recipe-category">{recipeCategory(recipe)}</p>
                    <h3>{recipe.output.name || recipe.name}</h3>
                  </div>
                  <RecipeTrivialBadge value={recipe.trivial} />
                </div>
                <div className="saved-recipe-components">
                  {componentPreview(recipe)}
                  {recipe.components.length > 5 ? <span className="saved-recipe-component">+{recipe.components.length - 5} more</span> : null}
                </div>
                <div className="saved-recipe-footer">
                  <span>{recipe.container || "Container unknown"}</span>
                  <button className="recipe-save-button is-saved" onClick={() => handleRemove(recipe)} type="button">
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {toast ? (
        <div className="crafting-save-toast" role="status">
          <span>{toast.message}</span>
          <button
            onClick={() => {
              saveRecipe(toast.recipeId);
              setToast(null);
            }}
            type="button"
          >
            Undo
          </button>
        </div>
      ) : null}
    </section>
  );
}
