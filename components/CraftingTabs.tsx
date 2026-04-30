"use client";

import { useEffect, useRef, useState } from "react";
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
import itemDetailsData from "@/data/item-details.json";
import type { Bucket, ItemDetailsMap } from "@/lib/search";

const itemDetailsMap = itemDetailsData as ItemDetailsMap;

let _craftingBucketIdCounter = 200000;
function makeCraftingBucket(itemName: string, recipe: CraftingRecipe): Bucket {
  _craftingBucketIdCounter += 1;
  const expansion = "Classic";
  return {
    bucket: _craftingBucketIdCounter,
    level_range: `${SKILL_LABELS[recipe.skill]} (Trivial ${recipe.trivial ?? "?"})`,
    expansion,
    mobs: [],
    zones: [],
    loot_pool: [itemName],
    mob_count: 0,
    loot_count: 1,
    zone_count: 0,
  };
}

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

function RecipeCard({
  recipe,
  onSelectLoot,
}: {
  recipe: CraftingRecipe;
  onSelectLoot: (itemName: string, bucket: Bucket) => void;
}) {
  const { previewProps } = useItemPreview();
  const outputDetails = itemDetailsMap[recipe.output.name];

  return (
    <article className={`recipe-card skill-tone-${recipe.skill}`}>
      <div className="recipe-card-topline">
        <div>
          <p className="recipe-card-kicker">{SKILL_LABELS[recipe.skill]}</p>
          <h3 className="recipe-card-name">
            <button
              className="recipe-output-link"
              onClick={() => onSelectLoot(recipe.output.name, makeCraftingBucket(recipe.output.name, recipe))}
              type="button"
              {...previewProps(recipe.output.name, outputDetails)}
            >
              <ItemIcon details={outputDetails} />
              <span>{recipe.output.name}</span>
            </button>
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
          {recipe.components.map((component, idx) => {
            const d = itemDetailsMap[component.name];
            return (
              <li className="recipe-component-item" key={`${component.name}-${component.count}-${idx}`}>
                {component.count > 1 ? (
                  <span className="recipe-component-count">{component.count}x</span>
                ) : null}
                <button
                  className="recipe-component-link"
                  onClick={() => onSelectLoot(component.name, makeCraftingBucket(component.name, recipe))}
                  type="button"
                  {...previewProps(component.name, d)}
                >
                  <ItemIcon details={d} />
                  <span>{component.name}</span>
                </button>
              </li>
            );
          })}
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

function TierSection({
  tier,
  recipes,
  onSelectLoot,
}: SkillTierGroup & { onSelectLoot: (itemName: string, bucket: Bucket) => void }) {
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
          <RecipeCard
            key={`${recipe.skill}-${recipe.name}`}
            recipe={recipe}
            onSelectLoot={onSelectLoot}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Skill panel
// ---------------------------------------------------------------------------

function SkillPanel({
  skill,
  groups,
  onSelectLoot,
}: SkillData & { onSelectLoot: (itemName: string, bucket: Bucket) => void }) {
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
        <TierSection
          key={group.tier}
          tier={group.tier}
          recipes={group.recipes}
          onSelectLoot={onSelectLoot}
        />
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

  function handleCloseDrawer() {
    setDrawerItem(null);
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
        {active ? (
          <SkillPanel
            skill={active.skill}
            groups={active.groups}
            onSelectLoot={handleSelectLoot}
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
          onClose={handleCloseDrawer}
          onSelectZone={() => {}}
        />
      ) : null}
    </div>
  );
}
