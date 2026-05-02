import Link from "next/link";

export type FeatureCardId =
  | "characters"
  | "group-named"
  | "raids"
  | "spells"
  | "crafting"
  | "factions"
  | "epics"
  | "normal-loot"
  | "favorites";

type FeatureCard = {
  id: FeatureCardId;
  href: string;
  title: string;
  description: string;
};

const tools: FeatureCard[] = [
  {
    id: "characters",
    href: "/characters",
    title: "My Characters",
    description:
      "Build and save gear sets for your characters. Plan BIS, compare items, and manage your group.",
  },
  {
    id: "group-named",
    href: "/loot",
    title: "Group Named Loot",
    description:
      "Random-loot buckets across Classic, Kunark, and Velious group-named mobs. Filter by class, slot, stat, and zone.",
  },
  {
    id: "raids",
    href: "/raids",
    title: "Raid Bosses",
    description:
      "Raid encounters and their loot pools. Per-server icon-driven loot lists with hover preview.",
  },
  {
    id: "spells",
    href: "/spells",
    title: "Spells",
    description:
      "Browse 1,728 spells, build a shopping list, plan a vendor route. Includes BST + drop sources.",
  },
  {
    id: "crafting",
    href: "/crafting",
    title: "Crafting",
    description:
      "209 recipes across Tailoring, Fletching, Blacksmithing, Jewelcraft, Spell Research, and Alchemy.",
  },
  {
    id: "factions",
    href: "/factions",
    title: "Factions",
    description:
      "Faction reputation flows by tone (good / neutral / evil) with the mobs and turn-ins that move each one.",
  },
  {
    id: "epics",
    href: "/epics",
    title: "Epic Quests",
    description:
      "Epic 1.0 walkthroughs for all 14 classes with step-by-step progress tracking.",
  },
  {
    id: "normal-loot",
    href: "/normal-loot",
    title: "Normal Loot (Odus)",
    description:
      "Static (non-random) loot for Odus continent zones \u2014 Erudin, Paineel, Kerra Isle, Toxxulia.",
  },
  {
    id: "favorites",
    href: "/favorites",
    title: "Favorites",
    description:
      "Your saved loot items and progress, kept across sessions in localStorage.",
  },
];

export const frostreaverFeatureCards: FeatureCardId[] = [
  "group-named",
  "raids",
  "spells",
  "crafting",
  "factions",
  "epics",
  "favorites",
  "characters",
];

export const normalTlpFeatureCards: FeatureCardId[] = [
  "normal-loot",
  "spells",
  "crafting",
  "factions",
  "epics",
];

type FeatureGridProps = {
  cards?: FeatureCardId[];
};

export function FeatureGrid({ cards }: FeatureGridProps) {
  const visibleTools = cards
    ? cards
        .map((id) => tools.find((tool) => tool.id === id))
        .filter((tool): tool is FeatureCard => Boolean(tool))
    : tools;

  return (
    <section className="home-tools-grid" aria-label="Available tools">
      {visibleTools.map((tool) => (
        <Link
          className="home-tool-card"
          key={tool.href}
          href={tool.href}
        >
          <h2>{tool.title}</h2>
          <p>{tool.description}</p>
        </Link>
      ))}
    </section>
  );
}
