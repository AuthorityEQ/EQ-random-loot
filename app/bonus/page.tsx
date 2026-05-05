import type { Metadata } from "next";
import Link from "next/link";
import { BonusTrackerClient } from "./BonusTrackerClient";
import "./bonus-page.css";

export const metadata: Metadata = {
  title: "Daily Bonuses | Frostreaver Loot",
  description:
    "Browse community-submitted EverQuest daily zone bonus reports for Frostreaver.",
};

export default function BonusPage() {
  return (
    <main className="page bonus-page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home">
          <img
            className="hero-banner-image"
            src="/loot-goblin-banner4.png"
            alt="Loot Goblin"
          />
        </Link>
      </header>

      <header className="header bonus-hero">
        <div>
          <p className="eyebrow">Community Tracker</p>
          <h1>Daily Bonuses</h1>
          <p className="subhead">
            Zones may receive a daily bonus at midnight. Reports here are
            community-submitted, so conflicting claims are preserved until the
            zone settles into a likely or confirmed result.
          </p>
        </div>
      </header>

      <BonusTrackerClient />
    </main>
  );
}
