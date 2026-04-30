import Link from "next/link";
import { ExpansionTimeline } from "@/components/ExpansionTimeline";

const tools = [
  {
    href: "/loot",
    title: "Group Named Loot",
    description:
      "Random-loot buckets across Classic, Kunark, and Velious group-named mobs. Filter by class, slot, stat, and zone.",
  },
  {
    href: "/raids",
    title: "Raid Bosses",
    description:
      "Raid encounters and their loot pools. Per-server icon-driven loot lists with hover preview.",
  },
  {
    href: "/spells",
    title: "Spells",
    description:
      "Browse 1,728 spells, build a shopping list, plan a vendor route. Includes BST + drop sources.",
  },
  {
    href: "/crafting",
    title: "Crafting",
    description:
      "209 recipes across Tailoring, Fletching, Blacksmithing, Jewelcraft, Spell Research, and Alchemy.",
  },
  {
    href: "/factions",
    title: "Factions",
    description:
      "Faction reputation flows by tone (good / neutral / evil) with the mobs and turn-ins that move each one.",
  },
  {
    href: "/epics",
    title: "Epic Quests",
    description:
      "Epic 1.0 walkthroughs for all 14 classes with step-by-step progress tracking.",
  },
  {
    href: "/normal-loot",
    title: "Normal Loot (Odus)",
    description:
      "Static (non-random) loot for Odus continent zones — Erudin, Paineel, Kerra Isle, Toxxulia.",
  },
  {
    href: "/favorites",
    title: "Favorites",
    description:
      "Your saved loot items and progress, kept across sessions in localStorage.",
  },
];

export default function HomePage() {
  return (
    <main className="page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home">
          <img
            className="hero-banner-image"
            src="/loot-goblin-banner4.png"
            alt="Loot Goblin"
          />
        </Link>
      </header>

      <section className="home-intro">
        <h1>Loot Goblin EQ Tools</h1>
        <p>
          Tools and references for EverQuest TLP servers. Random-loot bucket
          lookups, vendor planning for spells, crafting recipes, faction guides,
          epic quest trackers, and more.
        </p>
      </section>

      <ExpansionTimeline />

      <section className="home-tools-grid" aria-label="Available tools">
        {tools.map((tool) => (
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
    </main>
  );
}
