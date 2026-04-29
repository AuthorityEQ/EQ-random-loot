export interface FactionEntry {
  name: string;
  alignment: "good" | "neutral" | "evil";
  zones: string[];
  related_mobs: string[];
  quests: string[];
  required_items: string[];
  starting_value_by_race: Record<string, number>;
  allied_races: string[];
  kos_races: string[];
  tips: string[];
  notes: string;
}

export type FactionAlignment = FactionEntry["alignment"];

export interface FactionDataFile {
  _status?: string;
  factions: FactionEntry[];
}

// Normalize a faction name to a URL-safe slug
export function factionSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Recover the display name from a slug (best-effort; full lookup is via getFactionByName)
export function factionFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getFactionsByAlignment(
  factions: FactionEntry[],
  alignment: FactionAlignment,
): FactionEntry[] {
  return factions.filter((f) => f.alignment === alignment);
}

export function getFactionByName(
  factions: FactionEntry[],
  name: string,
): FactionEntry | undefined {
  const lower = name.toLowerCase();
  return factions.find((f) => f.name.toLowerCase() === lower);
}

export function getFactionBySlug(
  factions: FactionEntry[],
  slug: string,
): FactionEntry | undefined {
  return factions.find((f) => factionSlug(f.name) === slug);
}

export function getFactionsForZone(
  factions: FactionEntry[],
  zoneName: string,
): FactionEntry[] {
  const lower = zoneName.toLowerCase();
  return factions.filter((f) =>
    f.zones.some((z) => z.toLowerCase() === lower),
  );
}

export function getFactionsForMob(
  factions: FactionEntry[],
  mobName: string,
): FactionEntry[] {
  const lower = mobName.toLowerCase();
  return factions.filter((f) =>
    f.related_mobs.some((m) => m.toLowerCase() === lower),
  );
}

// Group factions into the three alignment buckets in display order
export function groupFactionsByAlignment(factions: FactionEntry[]): {
  alignment: FactionAlignment;
  label: string;
  factions: FactionEntry[];
}[] {
  const order: { alignment: FactionAlignment; label: string }[] = [
    { alignment: "good", label: "Good" },
    { alignment: "neutral", label: "Neutral" },
    { alignment: "evil", label: "Evil" },
  ];
  return order
    .map(({ alignment, label }) => ({
      alignment,
      label,
      factions: getFactionsByAlignment(factions, alignment),
    }))
    .filter((group) => group.factions.length > 0);
}
