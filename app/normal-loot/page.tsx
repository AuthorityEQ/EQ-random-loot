import type { Metadata } from "next";
import Link from "next/link";
import { NormalLootCatalog, type ZoneLoot } from "@/components/NormalLootCatalog";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Normal Loot - Loot Goblin",
  description: "Imported EverQuest normal loot zone catalog.",
};

async function loadImportedZones() {
  const zoneLootDir = path.join(process.cwd(), "data", "generated", "zone-loot");

  try {
    const files = await readdir(zoneLootDir);
    const zoneFiles = files
      .filter((file) => file.endsWith(".json") && !file.endsWith("-summary.json"))
      .sort((a, b) => a.localeCompare(b));

    const zones = await Promise.all(zoneFiles.map(async (file) => {
      const contents = await readFile(path.join(zoneLootDir, file), "utf8");
      return JSON.parse(contents) as ZoneLoot;
    }));

    return zones.sort((a, b) => a.zone.localeCompare(b.zone));
  } catch {
    return [];
  }
}

export default async function NormalLootPage() {
  const zones = await loadImportedZones();

  return (
    <main className="page normal-loot-page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="normal-loot-header">
        <p className="eyebrow">EverQuest / Normal Loot</p>
        <h1>Normal Loot</h1>
        <p className="normal-loot-note">Normal Loot data is imported separately and may include incomplete or unverified entries.</p>
        <p className="normal-loot-status">Work in progress — this will take awhile.</p>
      </header>

      {zones.length === 0 ? (
        <p className="empty">No imported normal loot data found.</p>
      ) : (
        <NormalLootCatalog zones={zones} />
      )}
    </main>
  );
}
