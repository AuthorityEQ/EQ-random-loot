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
  | "picks";

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
    description: "Build and save gear sets for your characters.",
  },
  {
    id: "group-named",
    href: "/loot",
    title: "Group Named Loot",
    description:
      "Random loot buckets across Classic, Kunark, and Velious group-named mobs.",
  },
  {
    id: "raids",
    href: "/raids",
    title: "Raid Bosses",
    description: "Raid encounters and their loot pools.",
  },
  {
    id: "spells",
    href: "/spells",
    title: "Spells",
    description: "Browse spells, build shopping lists, and plan vendor routes.",
  },
  {
    id: "crafting",
    href: "/crafting",
    title: "Crafting",
    description: "Browse recipes, components, sources, and tradeskill paths.",
  },
  {
    id: "factions",
    href: "/factions",
    title: "Factions",
    description: "Velious Armor Sets.",
  },
  {
    id: "epics",
    href: "/epics",
    title: "Epic Quests",
    description:
      "Class epic walkthroughs with step-by-step progress tracking.",
  },
  {
    id: "normal-loot",
    href: "/normal-loot",
    title: "Normal Loot (Odus)",
    description:
      "Static (non-random) loot for Odus continent zones \u2014 Erudin, Paineel, Kerra Isle, Toxxulia.",
  },
  {
    id: "picks",
    href: "/picks",
    title: "Picks",
    description:
      "Find out how many people it takes to spawn a pick of a zone.",
  },
];

export const frostreaverFeatureCards: FeatureCardId[] = [
  "group-named",
  "raids",
  "spells",
  "crafting",
  "factions",
  "epics",
  "picks",
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
