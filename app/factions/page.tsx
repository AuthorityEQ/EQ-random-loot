import type { Metadata } from "next";
import Link from "next/link";
import {
  groupFactionsByAlignment,
  factionSlug,
  type FactionEntry,
  type FactionDataFile,
} from "@/lib/factions";
import { mobToSlug } from "@/lib/mob-slug";
import { zoneToSlug } from "@/lib/zone-slug";
import factionNormalized from "@/data/excel-imports/factions-normalized.json";
import factionFallback from "@/data/factions-fallback.json";
import "./faction-page.css";

export const metadata: Metadata = {
  title: "Faction Guide — Frostreaver Loot Buckets",
  description:
    "EverQuest faction reference for Frostreaver. Browse factions by alignment, see which mobs grant or remove faction, find related quests, and check starting values by race.",
};

// Resolve faction data: prefer the normalized Excel ingest if it has the expected shape
// (_status === "normalized" and a populated factions array), fall back to the sample
// data file otherwise.
function resolveFactions(): FactionEntry[] {
  const normalized = factionNormalized as unknown as FactionDataFile;
  if (
    normalized._status === "normalized" &&
    Array.isArray(normalized.factions) &&
    normalized.factions.length > 0
  ) {
    return normalized.factions as FactionEntry[];
  }
  const fallback = factionFallback as unknown as FactionDataFile;
  return Array.isArray(fallback.factions)
    ? (fallback.factions as FactionEntry[])
    : [];
}

function isPending(): boolean {
  const normalized = factionNormalized as unknown as FactionDataFile;
  return (
    normalized._status !== "normalized" ||
    !Array.isArray(normalized.factions) ||
    normalized.factions.length === 0
  );
}

// Alignment display config
const ALIGNMENT_CONFIG: Record<
  FactionEntry["alignment"],
  { label: string }
> = {
  good: {
    label: "Good",
  },
  neutral: {
    label: "Neutral",
  },
  evil: {
    label: "Evil",
  },
};

const hiddenFactionNames = new Set(["Katta Castellum", "Sanctus Seru"]);
const factionMobOverrides: Record<string, string[]> = {
  "Coldain (Dwarves)": ["Dain Frostreaver IV", "Garadain Glacierbane"],
  "Claws of Veeshan (Dragons)": ["Lord Yelinak"],
  "Kromzek/Kromrif (Giants)": ["King Tormax", "The Avatar of War"],
};

// ---- Sub-components (plain functions — server component file) ----

function FactionZoneChips({ zones }: { zones: string[] }) {
  if (zones.length === 0) return null;
  return (
    <div className="faction-section">
      <span className="faction-chip-label">Zones</span>
      <div className="faction-chip-row">
        {zones.map((zone) => (
          <Link
            className="faction-zone-chip"
            href={`/zone/${zoneToSlug(zone)}`}
            key={zone}
            title={`View ${zone} zone details`}
          >
            {zone}
          </Link>
        ))}
      </div>
    </div>
  );
}

function FactionMobChips({ mobs }: { mobs: string[] }) {
  if (mobs.length === 0) return null;
  return (
    <div className="faction-section">
      <span className="faction-chip-label">Key Mobs</span>
      <div className="faction-chip-row">
        {mobs.map((mob) => (
          <Link
            className="faction-mob-chip"
            href={`/mob/${mobToSlug(mob)}`}
            key={mob}
            title={`View mob details for ${mob}`}
          >
            {mob}
          </Link>
        ))}
      </div>
    </div>
  );
}

function FactionQuestChips({ quests }: { quests: string[] }) {
  if (quests.length === 0) return null;
  return (
    <div className="faction-section">
      <span className="faction-chip-label">Related Quests</span>
      <div className="faction-chip-row">
        {quests.map((quest) => (
          <span className="faction-plain-chip" key={quest}>
            {quest}
          </span>
        ))}
      </div>
    </div>
  );
}

function FactionRaceTable({
  values,
}: {
  values: Record<string, number>;
}) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;
  return (
    <details className="faction-disclosure">
      <summary>
        <span>Starting Values by Race</span>
      </summary>
      <div className="faction-disclosure-body">
        <table className="faction-race-table">
          <thead>
            <tr>
              <th>Race</th>
              <th>Starting Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([race, value]) => (
              <tr key={race}>
                <td>{race}</td>
                <td
                  className={
                    value > 0
                      ? "faction-value-positive"
                      : value < 0
                        ? "faction-value-negative"
                        : undefined
                  }
                >
                  {value > 0 ? `+${value}` : value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function FactionAlliedKos({
  allied,
  kos,
}: {
  allied: string[];
  kos: string[];
}) {
  if (allied.length === 0 && kos.length === 0) return null;
  return (
    <details className="faction-disclosure">
      <summary>
        <span>Allied / KOS Races</span>
      </summary>
      <div className="faction-disclosure-body" style={{ display: "grid", gap: "10px" }}>
        {allied.length > 0 && (
          <div className="faction-section">
            <span className="faction-chip-label">Allied Races</span>
            <div className="faction-chip-row">
              {allied.map((r) => (
                <span className="faction-value-positive faction-plain-chip" key={r}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
        {kos.length > 0 && (
          <div className="faction-section">
            <span className="faction-chip-label">KOS Races</span>
            <div className="faction-chip-row">
              {kos.map((r) => (
                <span className="faction-value-negative faction-plain-chip" key={r}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function FactionTips({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;
  return (
    <details className="faction-disclosure">
      <summary>
        <span>Grinding Tips</span>
      </summary>
      <div className="faction-disclosure-body">
        <ul className="faction-tips-list">
          {tips.map((tip, i) => (
            // tips are not guaranteed unique, use index as secondary key
            <li key={`${i}-${tip.slice(0, 24)}`}>{tip}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function FactionCard({ faction }: { faction: FactionEntry }) {
  const slug = factionSlug(faction.name);
  const relatedMobs = factionMobOverrides[faction.name] ?? faction.related_mobs;
  return (
    <article
      className={`faction-card faction-tone-${faction.alignment}`}
      id={`faction-${slug}`}
    >
      <div className="faction-card-header">
        <h3>{faction.name}</h3>
        <span className="faction-alignment-pill">
          {ALIGNMENT_CONFIG[faction.alignment]?.label ?? faction.alignment}
        </span>
      </div>

      {faction.notes && <p className="faction-notes">{faction.notes}</p>}

      <FactionZoneChips zones={faction.zones} />
      <FactionMobChips mobs={relatedMobs} />
      <FactionQuestChips quests={faction.quests} />
      <FactionAlliedKos allied={faction.allied_races} kos={faction.kos_races} />
      <FactionRaceTable values={faction.starting_value_by_race} />
      <FactionTips tips={faction.tips} />
    </article>
  );
}

// ---- Page ----

export default function FactionsPage() {
  const factions = resolveFactions();
  const pending = isPending();
  const visibleFactions = factions.filter((faction) => !hiddenFactionNames.has(faction.name));
  const groups = groupFactionsByAlignment(visibleFactions);

  return (
    <main className="factions-page">
      <header className="hero-header" aria-label="Loot Goblin">
        <Link href="/" aria-label="Loot Goblin home"><img className="hero-banner-image" src="/loot-goblin-banner4.png" alt="Loot Goblin" /></Link>
      </header>
      <header className="factions-hero">
        <p className="eyebrow">Reference / Faction Guide</p>
        <h1>Faction Guide</h1>
        <Link className="faction-feature-link" href="/velious-class-armor">
          ⚔ Velious Class Armor
        </Link>
      </header>

      {pending && (
        <div className="faction-empty" role="status">
          Faction data is being prepared for launch. Sample factions are shown below for
          reference.
        </div>
      )}

      {visibleFactions.length === 0 ? (
        <div className="faction-empty" role="status">
          Faction data is being prepared for launch.
        </div>
      ) : (
        groups.map(({ alignment, label, factions: groupFactions }) => (
          <section
            className={`faction-alignment-group faction-tone-${alignment}`}
            key={alignment}
          >
            <div className="faction-alignment-heading">
              <h2>{label} Factions</h2>
            </div>
            <div className="faction-card-grid">
              {groupFactions.map((faction) => (
                <FactionCard faction={faction} key={faction.name} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
