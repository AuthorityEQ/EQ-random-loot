/**
 * Hand-curated zone connection graph for EverQuest Classic / Kunark / Velious.
 *
 * Keys and values MUST match the canonical zone names that appear in mob.zone
 * across classic-group-named.json, kunark-group-named.json, and
 * velious-group-named.json exactly (case-sensitive).
 *
 * Connections are bidirectional by convention — if A lists B, B should list A.
 * This is intentionally minimal, covering the most-travelled routes.
 * Expand as needed; do not auto-generate from data.
 */
export const ZONE_CONNECTIONS: Record<string, string[]> = {
  // ── Classic ────────────────────────────────────────────────────────────────

  // Qeynos corridor
  "Qeynos Aqueducts": ["Qeynos Hills"],
  "Qeynos Hills": ["Qeynos Aqueducts", "North Karana"],
  "North Karana": ["Qeynos Hills", "South Karana", "West Karana", "Highpass Hold"],
  "South Karana": ["North Karana", "West Karana", "Lake Rathe"],
  "West Karana": ["North Karana", "South Karana", "Highpass Hold"],
  "Highpass Hold": ["West Karana", "North Karana"],
  "Rathe Mountains": ["South Karana", "Lake Rathe"],
  "Lake Rathe": ["Rathe Mountains", "South Karana"],

  // Freeport / commonlands corridor
  "Misty Thicket": ["South Ro"],
  "North Ro": ["South Ro", "Ocean of Tears"],
  "South Ro": ["North Ro", "Misty Thicket"],
  "Ocean of Tears": ["North Ro", "Butcherblock"],

  // Faydwer
  "Lesser Faydark": ["Mistmoore", "Butcherblock"],
  "Mistmoore": ["Lesser Faydark"],
  "Crushbone": ["Lesser Faydark"],
  "Butcherblock": ["Lesser Faydark", "Ocean of Tears"],

  // Cold north / fire
  "Everfrost": ["Permafrost"],
  "Permafrost": ["Everfrost"],
  "Lavastorm": ["Najena", "SolA (Solusek's Eye)"],
  "Najena": ["Lavastorm"],
  "SolA (Solusek's Eye)": ["Lavastorm", "SolB (Nag Lair)"],
  "SolB (Nag Lair)": ["SolA (Solusek's Eye)"],

  // Misc classic
  "Unrest": ["Lesser Faydark"],
  "Upper Guk": ["Lower Guk"],
  "Lower Guk": ["Upper Guk"],
  "Gorge of Xorbb": ["Highpass Hold"],
  "Splitpaw": ["South Karana"],
  "Steamfont": ["Lesser Faydark"],
  "Toxxulia Forest": ["Ocean of Tears"],

  // ── Kunark ─────────────────────────────────────────────────────────────────

  "Field of Bone": ["Kurn's Tower", "Kaesora", "Lake of Ill Omen", "Warslicks Woods"],
  "Kurn's Tower": ["Field of Bone"],
  "Kaesora": ["Field of Bone"],
  "Lake of Ill Omen": ["Field of Bone", "Burning Woods", "Dreadlands"],
  "Burning Woods": ["Lake of Ill Omen", "Warslicks Woods", "Sebilis", "Trakanon's Teeth"],
  "Warslicks Woods": ["Field of Bone", "Burning Woods", "City of Mist", "Karnor's Castle"],
  "City of Mist": ["Warslicks Woods"],
  "Karnor's Castle": ["Warslicks Woods"],
  "Sebilis": ["Burning Woods"],
  "Trakanon's Teeth": ["Burning Woods", "Emerald Jungle"],
  "Emerald Jungle": ["Trakanon's Teeth"],
  "Dreadlands": ["Lake of Ill Omen", "Howling Stones"],
  "Howling Stones": ["Dreadlands"],
  "Chardok": ["Dreadlands"],
  "Droga": ["Dreadlands"],
  "Dalnir": ["Lake of Ill Omen"],
  "Timorous Deep": ["Field of Bone"],

  // ── Velious ────────────────────────────────────────────────────────────────

  "Eastern Wastes": ["Wakening Lands", "Dragon Necropolis", "Kael Drakkel", "Great Divide"],
  "Great Divide": ["Eastern Wastes", "Crystal Caverns", "Icewell Keep"],
  "Crystal Caverns": ["Great Divide"],
  "Icewell Keep": ["Great Divide"],
  "Kael Drakkel": ["Eastern Wastes"],
  "Dragon Necropolis": ["Eastern Wastes"],
  "Wakening Lands": ["Eastern Wastes", "Velketor's Labyrinth", "Western Wastes"],
  "Velketor's Labyrinth": ["Wakening Lands"],
  "Western Wastes": ["Wakening Lands", "Cobalt Scar"],
  "Cobalt Scar": ["Western Wastes", "Siren's Grotto", "Iceclad"],
  "Siren's Grotto": ["Cobalt Scar"],
  "Iceclad": ["Cobalt Scar"],
  "Tower Frozen Shadow": ["Great Divide"],
};
