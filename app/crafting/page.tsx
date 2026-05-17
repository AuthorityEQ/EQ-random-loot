import type { Metadata } from "next";
import Link from "next/link";
import { CraftingTabs, type SkillData } from "@/components/CraftingTabs";
import {
  CRAFTING_SKILLS,
} from "@/lib/crafting";
import { craftingRecipes, isCraftingLiveData } from "@/data/crafting-recipes";
import "./crafting-page.css";

export const metadata: Metadata = {
  title: "Crafting Recipes | Frostreaver Loot",
  description:
    "Browse EverQuest tradeskill recipes for Tailoring, Fletching, Blacksmithing, Jewelcraft, and Spell Research on Frostreaver.",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CraftingPage() {
  // Pre-compute all skill data on the server so CraftingTabs only handles
  // tab-state switching (RSC-compatible: no function props cross the boundary).
  const skillData: SkillData[] = CRAFTING_SKILLS.map((skill) => ({
    skill,
    recipes: craftingRecipes
      .filter((recipe) => recipe.skill === skill)
      .sort((a, b) => (a.trivial ?? 999) - (b.trivial ?? 999)),
  }));

  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="header">
        <div>
          <p className="eyebrow">Tradeskills / Recipes</p>
          <h1>Crafting Recipes</h1>
          <p className="subhead">
            Browse tradeskill recipe families by skill, trivial range, and component.
            Component names link to item detail pages where available.
          </p>
          {!isCraftingLiveData ? (
            <p className="crafting-tier2-notice">
              Crafting data unlocking post-launch — Tier 2 feature.
              Displaying sample stub recipes until the Excel ingest pipeline runs.
            </p>
          ) : null}
        </div>
      </header>

      <CraftingTabs skillData={skillData} />
    </main>
  );
}
