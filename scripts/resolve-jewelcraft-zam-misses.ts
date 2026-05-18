import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Recipe = {
  skill: string;
  name: string;
  output: { name: string; imageUrl?: string | null };
  sourceMetadata?: Record<string, unknown>;
};
type ItemDetails = Record<string, unknown> & {
  stats?: Record<string, number | string>;
  resists?: Record<string, number | string>;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-jewelcraft-manual-resolution-report.json");
const manualMatches: Record<string, { searchName: string; url: string }> = {
  "Velium Rose Engagement Ring": {
    searchName: "Rose Velium Engagement Ring",
    url: "https://everquest.allakhazam.com/db/item.html?item=6087",
  },
  "Velium Wolf's Eye Necklace": {
    searchName: "Wolf's Eye Velium Necklace",
    url: "https://everquest.allakhazam.com/db/item.html?item=38588",
  },
  "Topaz Velium Necklace": {
    searchName: "Velium Topaz Necklace",
    url: "https://everquest.allakhazam.com/db/item.html?item=5926",
  },
  "Imbued Silvered Sapphire Necklace": {
    searchName: "Imbued Silver Sapphire Necklace",
    url: "https://everquest.allakhazam.com/db/item.html?item=4727",
  },
  "Imbued Black Sapphire Silvered Necklace": {
    searchName: "Imbued Black Sapphire Silver Necklace",
    url: "https://everquest.allakhazam.com/db/item.html?item=49802",
  },
  "Imbued Golden Black Sapphire Earring": {
    searchName: "Imbued Gold Black Sapphire Earring",
    url: "https://everquest.allakhazam.com/db/item.html?item=49801",
  },
};

function decode(value: string) {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'").replace(/&gt;/gi, ">").replace(/&lt;/gi, "<");
}

function stripTags(html: string) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim());
}

function parseStats(text: string) {
  const stats: Record<string, number | string> = {};
  const resists: Record<string, number | string> = {};
  const resistMap = new Map([["MR", "MR"], ["DR", "DR"], ["PR", "PR"], ["FR", "FR"], ["CR", "CR"], ["SV MAGIC", "MR"], ["SV DISEASE", "DR"], ["SV POISON", "PR"], ["SV FIRE", "FR"], ["SV COLD", "CR"]]);
  for (const match of text.matchAll(/\b(STR|STA|AGI|DEX|WIS|INT|CHA|HP|MANA|MP|END|AC|MR|FR|CR|DR|PR|SV FIRE|SV COLD|SV MAGIC|SV POISON|SV DISEASE)\s*:?\s*([+-]?\d+%?)\b/gi)) {
    const key = match[1].toUpperCase() === "MP" ? "MANA" : match[1].toUpperCase();
    const value = match[2].includes("%") ? match[2] : Number(match[2]);
    const resistKey = resistMap.get(key);
    if (resistKey) resists[resistKey] = value;
    else if (key !== "AC") stats[key] = value;
  }
  return { stats, resists };
}

function parseItem(html: string, url: string) {
  const itemBlock = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlock);
  const iconRaw = html.match(/<img[^>]+class=["'][^"']*\bitemicon\b[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bitemicon\b/i)?.[1]
    ?? null;
  const iconPath = iconRaw?.startsWith("//") ? `https:${iconRaw}` : iconRaw;
  const { stats, resists } = parseStats(text);
  const acValue = Number(text.match(/\bAC:\s*([+-]?\d+)/i)?.[1] ?? NaN);
  const title = decode(html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i)?.[1] ?? "").replace(/^Item\s*:\s*/i, "").trim();
  return {
    title,
    url,
    iconPath,
    ac: Number.isFinite(acValue) ? acValue : null,
    stats,
    resists,
    slot: text.match(/\bSlot:\s*([^\n]+)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null,
  };
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[] };
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const fixed: Array<Record<string, unknown>> = [];
const unresolved: Array<Record<string, unknown>> = [];
const deityAdded: Array<Record<string, unknown>> = [];

for (const recipe of crafting.recipes.filter((entry) => entry.skill === "jewelcraft" && entry.sourceMetadata?.jewelcraftType === "Deity/Imbued")) {
  const deity = typeof recipe.sourceMetadata?.deity === "string" ? recipe.sourceMetadata.deity.trim() : "";
  if (!deity) {
    unresolved.push({ name: recipe.name, reason: "Imbued recipe has no clear P99 deity metadata." });
    continue;
  }
  recipe.sourceMetadata = { ...recipe.sourceMetadata, deity, deities: deity };
  deityAdded.push({ name: recipe.name, deity });
}

for (const [p99Name, match] of Object.entries(manualMatches)) {
  const recipe = crafting.recipes.find((entry) => entry.skill === "jewelcraft" && entry.name === p99Name);
  if (!recipe) {
    unresolved.push({ name: p99Name, reason: "Recipe not found in P99 Jewelcraft data." });
    continue;
  }
  const html = await fetch(match.url).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${match.url}`);
    return response.text();
  });
  const parsed = parseItem(html, match.url);
  if (!parsed.title) {
    unresolved.push({ name: p99Name, reason: "Allakhazam title could not be parsed.", url: match.url });
    continue;
  }
  const existing = details[recipe.output.name] ?? {};
  details[recipe.output.name] = {
    ...existing,
    name: existing.name ?? recipe.output.name,
    slot: existing.slot ?? parsed.slot,
    ac: parsed.ac ?? existing.ac ?? null,
    stats: { ...(existing.stats ?? {}), ...parsed.stats },
    resists: { ...(existing.resists ?? {}), ...parsed.resists },
    iconPath: existing.iconPath ?? parsed.iconPath ?? recipe.output.imageUrl ?? null,
    sourceUrl: existing.sourceUrl ?? match.url,
    sources: [
      ...((existing.sources ?? []) as Array<{ name: string; url: string }>),
      ...(((existing.sources ?? []) as Array<{ name: string; url: string }>).some((source) => source.url === match.url) ? [] : [{ name: "Allakhazam", url: match.url }]),
    ],
    match_notes: [
      ...((existing.match_notes ?? []) as string[]),
      `Manually resolved Allakhazam detail match via alternate name "${match.searchName}" without changing P99 recipe structure.`,
    ],
    missing_core_stats: false,
  };
  recipe.sourceMetadata = {
    ...(recipe.sourceMetadata ?? {}),
    allakhazamResolvedName: parsed.title,
    allakhazamSearchName: match.searchName,
    allakhazamUrl: match.url,
  };
  fixed.push({ name: p99Name, allakhazamName: parsed.title, url: match.url, stats: parsed.stats, resists: parsed.resists, ac: parsed.ac });
}

await writeFile(craftingPath, `${JSON.stringify(crafting, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({ fixed, unresolved, deityAdded }, null, 2)}\n`);

console.log(`Fixed ${fixed.length} Jewelcraft Allakhazam misses.`);
console.log(`Added deity metadata to ${deityAdded.length} imbued recipes.`);
console.log(`Remaining unresolved ${unresolved.length}.`);
console.log(`Wrote ${reportPath}`);
