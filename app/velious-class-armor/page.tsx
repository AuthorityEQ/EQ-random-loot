import type { Metadata } from "next";
import Link from "next/link";
import { VeliousClassArmorBuilder } from "@/components/VeliousClassArmorBuilder";

export const metadata: Metadata = {
  title: "Velious Class Armor - Loot Goblin",
  description: "Compare Thurgadin, Kael, and Skyshrine class armor sets and preview a mixed Velious armor build.",
};

export default function VeliousClassArmorPage() {
  return (
    <main className="page velious-armor-page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home">
          <img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" />
        </Link>
      </header>

      <header className="velious-armor-hero">
        <p className="eyebrow">Velious / Class Armor</p>
        <h1>Velious Class Armor</h1>
        <p>
          Compare Thurgadin, Kael, and Skyshrine quest armor by class, then click pieces to preview a mixed set.
        </p>
      </header>

      <VeliousClassArmorBuilder />
    </main>
  );
}
