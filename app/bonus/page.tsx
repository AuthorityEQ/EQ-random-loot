import type { Metadata } from "next";
import Link from "next/link";
import "./bonus-page.css";

export const metadata: Metadata = {
  title: "Daily Bonuses Disabled | Frostreaver Loot",
  description: "Daily Bonuses are currently disabled on Frostreaver Loot.",
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
          <h1>Daily Bonuses Disabled</h1>
          <p className="subhead">
            Daily Bonuses are currently disabled and hidden from site navigation.
            The tracker implementation is preserved in the codebase for possible
            future restoration.
          </p>
        </div>
      </header>

      <section className="bonus-disabled-panel" aria-label="Daily Bonuses disabled">
        <h2>Daily Bonuses are currently disabled.</h2>
        <p>
          This page no longer shows bonus reports because the data is not being
          maintained. Discord login is still available in the top bar for saved
          characters, epics, favorites, and other account-backed features.
        </p>
        <Link href="/">Return home</Link>
      </section>
    </main>
  );
}
