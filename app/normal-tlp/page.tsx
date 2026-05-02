import Link from "next/link";
import { FeatureGrid, normalTlpFeatureCards } from "@/components/FeatureGrid";

export default function NormalTlpPage() {
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

      <FeatureGrid cards={normalTlpFeatureCards} />
    </main>
  );
}
