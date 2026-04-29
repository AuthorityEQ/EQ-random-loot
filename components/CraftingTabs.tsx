"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CRAFTING_SKILLS,
  SKILL_LABELS,
  itemSlug,
  type CraftingRecipe,
  type CraftingSkill,
} from "@/lib/crafting";

// ---------------------------------------------------------------------------
// Serializable data shape passed from the server page
// ---------------------------------------------------------------------------

export type SkillTierGroup = {
  tier: string;
  recipes: CraftingRecipe[];
};

export type SkillData = {
  skill: CraftingSkill;
  groups: SkillTierGroup[];
};

interface CraftingTabsProps {
  /** Pre-computed per-skill data, produced by the server page. */
  skillData: SkillData[];
}

// ---------------------------------------------------------------------------
// Recipe card
// ---------------------------------------------------------------------------

function RecipeCard({ recipe }: { recipe: CraftingRecipe }) {
  return (
    <article className={`recipe-card skill-tone-${recipe.skill}`}>
      <div className="recipe-card-topline">
        <div>
          <p className="recipe-card-kicker">{SKILL_LABELS[recipe.skill]}</p>
          <h3 className="recipe-card-name">
            <Link className="recipe-output-link" href={`/item/${itemSlug(recipe.output.name)}`}>
              {recipe.output.name}
            </Link>
            {recipe.output.count > 1 ? (
              <span className="recipe-output-count">x{recipe.output.count}</span>
            ) : null}
          </h3>
        </div>
        <dl className="recipe-meta">
          <div>
            <dt>Trivial</dt>
            <dd>{recipe.trivial !== null ? recipe.trivial : "—"}</dd>
          </div>
          <div>
            <dt>Container</dt>
            <dd>{recipe.container}</dd>
          </div>
          <div>
            <dt>Components</dt>
            <dd>{recipe.components.length}</dd>
          </div>
        </dl>
      </div>

      <div className="recipe-components">
        <h4 className="recipe-components-heading">Components</h4>
        <ul className="recipe-components-list">
          {recipe.components.map((component) => (
            <li className="recipe-component-item" key={`${component.name}-${component.count}`}>
              {component.count > 1 ? (
                <span className="recipe-component-count">{component.count}x</span>
              ) : null}
              <Link className="recipe-component-link" href={`/item/${itemSlug(component.name)}`}>
                {component.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {recipe.notes ? (
        <p className="recipe-notes">{recipe.notes}</p>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Tier section
// ---------------------------------------------------------------------------

function TierSection({ tier, recipes }: SkillTierGroup) {
  return (
    <section className="recipe-tier-section">
      <h3 className="recipe-tier-heading">
        <span className="recipe-tier-label">Trivial {tier}</span>
        <span className="recipe-tier-count">
          {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
        </span>
      </h3>
      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <RecipeCard key={`${recipe.skill}-${recipe.name}`} recipe={recipe} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Skill panel
// ---------------------------------------------------------------------------

function SkillPanel({ skill, groups }: SkillData) {
  if (groups.length === 0) {
    return (
      <p className="crafting-empty">
        No {SKILL_LABELS[skill]} recipes found in the current dataset.
      </p>
    );
  }
  return (
    <div className="crafting-skill-panel">
      {groups.map((group) => (
        <TierSection key={group.tier} tier={group.tier} recipes={group.recipes} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CraftingTabs — owns active-skill state
// ---------------------------------------------------------------------------

/**
 * Client component for the crafting page tab bar.
 * Receives pre-computed data from the server page so the server does all
 * the heavy JSON work; this component is only responsible for tab state.
 *
 * Uses the `.filter-button` + `--filter-*` token system for the tab strip.
 */
export function CraftingTabs({ skillData }: CraftingTabsProps) {
  const [activeSkill, setActiveSkill] = useState<CraftingSkill>(
    skillData[0]?.skill ?? "tailoring",
  );

  const active = skillData.find((s) => s.skill === activeSkill) ?? skillData[0];

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
            ]
              .filter(Boolean)
              .join(" ")}
            key={skill}
            onClick={() => setActiveSkill(skill)}
            role="tab"
            type="button"
          >
            {SKILL_LABELS[skill]}
          </button>
        ))}
      </div>

      <div
        aria-label={`${SKILL_LABELS[activeSkill]} recipes`}
        className="crafting-tab-panel"
        role="tabpanel"
      >
        {active ? <SkillPanel skill={active.skill} groups={active.groups} /> : null}
      </div>
    </div>
  );
}
