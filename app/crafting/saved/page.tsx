import type { Metadata } from "next";
import Link from "next/link";
import { SavedCraftingRecipesPage } from "@/components/SavedCraftingRecipesPage";
import { allRecipes } from "@/lib/crafting";
import "../crafting-page.css";

export const metadata: Metadata = {
  title: "Favorite Crafting Recipes | Frostreaver Loot",
  description: "Saved EverQuest crafting recipes grouped by tradeskill.",
};

export default function SavedCraftingPage() {
  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="header">
        <div>
          <p className="eyebrow">Tradeskills / Saved Recipes</p>
          <h1>Favorite Recipes</h1>
          <p className="subhead">
            Your saved crafting recipes, grouped by tradeskill.
          </p>
        </div>
      </header>

      <SavedCraftingRecipesPage recipes={allRecipes} />
    </main>
  );
}
