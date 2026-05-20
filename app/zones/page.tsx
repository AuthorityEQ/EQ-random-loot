import type { Metadata } from "next";
import Link from "next/link";
import { ZonesExplorer } from "@/components/ZonesExplorer";

export const metadata: Metadata = {
  title: "Zone Explorer | Frostreaver Loot",
  description: "Browse EverQuest zone mob snapshots, approximate level ranges, and lightweight level distributions.",
};

export default function ZonesPage() {
  return (
    <main className="page zones-page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="header">
        <div>
          <p className="eyebrow">EverQuest / Zones</p>
          <h1>Zone Explorer</h1>
          <p className="subhead">
            Browse lightweight mob snapshots by zone: approximate level range, mob count, and level distribution from imported data samples.
          </p>
        </div>
      </header>

      <ZonesExplorer />
    </main>
  );
}
