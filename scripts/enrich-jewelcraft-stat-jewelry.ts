import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type CraftingComponent = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: string;
  [key: string]: unknown;
};

type CraftingRecipe = {
  id?: number | string;
  expansion?: string | null;
  skill: string;
  name: string;
  trivial: number | null;
  components: CraftingComponent[];
  container: string;
  output: {
    name: string;
    count: number;
    imageUrl?: string | null;
  };
  notes?: string | null;
  sourceUrl?: string | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
};

type CraftingEnvelope = {
  recipes: CraftingRecipe[];
  [key: string]: unknown;
};

type ZamCandidate = {
  url: string;
  text: string;
  exactBaseName: boolean;
  nonEnchanted: boolean;
};

type ParsedZamItem = {
  name: string;
  url: string;
  itemId: string | null;
  iconUrl: string | null;
  slot: string | null;
  ac: number | null;
  stats: Record<string, number | string>;
  resists: Record<string, number | string>;
  classes: string[];
  races: string[];
  weight: number | null;
  size: string | null;
  item_type: string | null;
  stackable: boolean | null;
  expansion: string | null;
  hasStats: boolean;
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-jewelcraft-enrichment-report.json");
const cacheDir = path.join(root, "cache", "zam-pages");
const requestDelayMs = Number(process.env.ZAM_REQUEST_DELAY_MS ?? 350);
const userAgent = "FrostreaverLootReference/0.2 (+local jewelcraft enrichment; contact: local)";

const metalBars = new Set(["Silver Bar", "Electrum Bar", "Gold Bar", "Platinum Bar"]);
const statNote = "Using a normal metal bar creates the non-stat version.";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function htmlDecode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(html: string) {
  return htmlDecode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|tr|td|li|h1|h2|h3)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim(),
  );
}

function normalizeName(value: string) {
  return value
    .replace(/\s*\[[^\]]+\]\s*$/g, "")
    .replace(/\s*\([^)]*TLP[^)]*\)\s*$/gi, "")
    .replace(/['`’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readString(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? htmlDecode(match[1]).replace(/\s+/g, " ").trim() : null;
}

function readNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function readList(pattern: RegExp, text: string) {
  const value = readString(pattern, text);
  if (!value) return [];
  return value.split(/[,/ ]+/).map((entry) => entry.trim()).filter(Boolean);
}

function readTableValue(label: string, html: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<tr><th[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/th><td[^>]*>([\\s\\S]*?)<\\/td><\\/tr>`, "i");
  const match = html.match(pattern);
  return match ? stripTags(match[1]).replace(/\s+/g, " ").trim() : null;
}

function parseStats(text: string) {
  const stats: Record<string, number | string> = {};
  const resists: Record<string, number | string> = {};
  const statPattern = /\b(STR|STA|AGI|DEX|WIS|INT|CHA|HP|MANA|END|ENDUR|ENDURANCE|MR|FR|CR|DR|PR|SV FIRE|SV COLD|SV MAGIC|SV POISON|SV DISEASE)\s*:?\s*([+-]?\d+%?)\b/gi;
  const resistMap = new Map([
    ["mr", "MR"],
    ["fr", "FR"],
    ["cr", "CR"],
    ["dr", "DR"],
    ["pr", "PR"],
    ["sv fire", "FR"],
    ["sv cold", "CR"],
    ["sv magic", "MR"],
    ["sv poison", "PR"],
    ["sv disease", "DR"],
  ]);

  for (const match of text.matchAll(statPattern)) {
    const key = match[1].toLowerCase();
    const value = match[2].includes("%") ? match[2] : Number(match[2]);
    const resistKey = resistMap.get(key);
    if (resistKey) resists[resistKey] = value;
    else stats[match[1].toUpperCase().replace("ENDUR", "ENDURANCE")] = value;
  }

  return { stats, resists };
}

async function fetchCached(url: string, label: string) {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${slug(label)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");

  await sleep(requestDelayMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

function searchUrl(name: string) {
  return `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}`;
}

function canonicalItemUrl(url: string) {
  const href = url.startsWith("http")
    ? url
    : `https://everquest.allakhazam.com${url.startsWith("/") ? "" : "/"}${url}`;
  return href.replace(/&amp;/g, "&").match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? href;
}

function getSearchCandidates(searchHtml: string, baseName: string) {
  const candidates = new Map<string, ZamCandidate>();
  for (const match of searchHtml.matchAll(/href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = canonicalItemUrl(match[1]);
    const text = stripTags(match[2]);
    if (!text) continue;
    const candidate = {
      url,
      text,
      exactBaseName: normalizeName(text) === normalizeName(baseName),
      nonEnchanted: /\bnon[-\s]?enchanted\b/i.test(text),
    };
    const existing = candidates.get(url);
    if (!existing || (candidate.exactBaseName && !existing.exactBaseName) || text.length > existing.text.length) {
      candidates.set(url, candidate);
    }
  }
  return Array.from(candidates.values());
}

function parseZamItem(html: string, requestedName: string, url: string): ParsedZamItem {
  const itemBlockHtml = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlockHtml);
  const titleName = readString(/<meta property=["']og:title["'] content=["']([^"']+)["']/i, html) ?? requestedName;
  const parsedName = titleName.replace(/^Item\s*:\s*/i, "").trim();
  const iconUrl = html.match(/<img[^>]+class=["'][^"']*\bitemicon\b[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bitemicon\b/i)?.[1]
    ?? null;
  const expansionHtml = html.match(/<strong>\s*Expansion:\s*<\/strong>([\s\S]*?)<br/i)?.[1];
  const expansion = expansionHtml
    ? (expansionHtml.match(/alt=["']([^"']+)["']/i)?.[1] ?? stripTags(expansionHtml)).replace(/\s+/g, " ").trim()
    : null;
  const { stats, resists } = parseStats(text);
  const ac = readNumber(/\bAC:\s*([+-]?\d+)/i, text);
  const itemId = url.match(/item=(\d+)/)?.[1] ?? null;
  const normalizedIconUrl = iconUrl?.startsWith("//")
    ? `https:${iconUrl}`
    : iconUrl;

  return {
    name: parsedName,
    url,
    itemId,
    iconUrl: normalizedIconUrl,
    slot: readString(/\bSlot:\s*([^\n]+)/i, text),
    ac,
    stats,
    resists,
    classes: readList(/\bClass(?:es)?:\s*([^\n]+)/i, text),
    races: readList(/\bRace(?:s)?:\s*([^\n]+)/i, text),
    weight: readNumber(/\bWT:\s*(\d+(?:\.\d+)?)/i, text),
    size: readString(/\bSize:\s*([^\n]+)/i, text),
    item_type: readTableValue("Item Type", html),
    stackable: (() => {
      const value = readTableValue("Stackable", html);
      return value ? /^yes$/i.test(value) : null;
    })(),
    expansion,
    hasStats: ac !== null || Object.keys(stats).length > 0 || Object.keys(resists).length > 0,
  };
}

function isPlainJewelryRecipe(recipe: CraftingRecipe) {
  if (recipe.skill !== "jewelcraft") return false;
  if (/\bnon[-\s]?enchanted\b/i.test(recipe.name)) return true;
  return recipe.components.some((component) => metalBars.has(component.name));
}

function enchantedComponent(component: CraftingComponent) {
  if (!metalBars.has(component.name)) return component;
  return {
    ...component,
    name: `Enchanted ${component.name}`,
  };
}

function appendNote(existing: string | null | undefined, note: string) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing} ${note}`;
}

function toItemDetails(item: ParsedZamItem, existing: Record<string, unknown> | undefined) {
  return {
    ...(existing ?? {}),
    name: item.name,
    slot: item.slot,
    ac: item.ac,
    damage: null,
    delay: null,
    skill: null,
    damage_bonus: null,
    stats: item.stats,
    resists: item.resists,
    hp_regen: null,
    mana_regen: null,
    endurance_regen: null,
    haste: null,
    worn_effects: [],
    focus_effects: [],
    click_effects: [],
    proc_effects: [],
    required_level: null,
    recommended_level: null,
    classes: item.classes,
    races: item.races,
    weight: item.weight,
    size: item.size,
    item_type: item.item_type,
    stackable: item.stackable,
    weight_reduction: null,
    capacity: null,
    size_capacity: null,
    lore: null,
    magic: null,
    no_drop: null,
    prestige: null,
    aug_slots: [],
    iconPath: item.iconUrl,
    sources: [{ name: "Allakhazam", url: item.url }],
    expansion: item.expansion ?? "Classic",
    confidence: "exact_match",
    match_notes: ["Selected exact-name Allakhazam jewelry item with parsed stats for Jewelcraft recipe display."],
    missing_core_stats: !item.hasStats,
    duplicate_name_risk: false,
    parsing_warnings: [],
    match_confidence: "exact_match",
  };
}

const craftingData = JSON.parse(await readFile(craftingPath, "utf8")) as CraftingEnvelope;
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, Record<string, unknown>>;
const report = {
  upgraded: [] as Array<Record<string, unknown>>,
  unresolved: [] as Array<Record<string, unknown>>,
  nonEnchantedOnly: [] as Array<Record<string, unknown>>,
  ambiguous: [] as Array<Record<string, unknown>>,
};

for (const recipe of craftingData.recipes) {
  if (!isPlainJewelryRecipe(recipe)) continue;

  const baseName = recipe.output.name.replace(/\s*\[[^\]]+\]\s*$/g, "").trim();
  const originalComponents = recipe.components.map((component) => `${component.count}x ${component.name}`).join(", ");
  const searchHtml = await fetchCached(searchUrl(baseName), `search:jewelcraft:${baseName}`);
  const candidates = getSearchCandidates(searchHtml, baseName);
  const exactCandidates = candidates.filter((candidate) => candidate.exactBaseName);
  const statCandidates: Array<{ candidate: ZamCandidate; item: ParsedZamItem }> = [];
  const nonStatCandidates: Array<{ candidate: ZamCandidate; item: ParsedZamItem }> = [];

  for (const candidate of exactCandidates) {
    const html = await fetchCached(candidate.url, `item:${candidate.url}`);
    const item = parseZamItem(html, baseName, candidate.url);
    if (!candidate.nonEnchanted && item.hasStats) statCandidates.push({ candidate, item });
    if (candidate.nonEnchanted || !item.hasStats) nonStatCandidates.push({ candidate, item });
  }

  if (statCandidates.length === 0) {
    const entry = {
      recipe: recipe.name,
      reason: exactCandidates.length === 0 ? "No exact Allakhazam item result found." : "Exact Allakhazam results did not include a stat-bearing enchanted item.",
      candidates,
    };
    report.unresolved.push(entry);
    if (nonStatCandidates.length > 0) report.nonEnchantedOnly.push(entry);
    continue;
  }

  if (statCandidates.length > 1) {
    report.ambiguous.push({
      recipe: recipe.name,
      reason: "Multiple exact stat-bearing Allakhazam jewelry candidates were found; selected the first exact non-bracketed result.",
      candidates: statCandidates.map(({ candidate, item }) => ({ text: candidate.text, url: item.url, stats: item.stats, resists: item.resists })),
    });
  }

  const selected = statCandidates[0].item;
  const nonStat = nonStatCandidates[0]?.item ?? null;
  const originalName = recipe.name;
  const originalOutputName = recipe.output.name;
  const originalOutputImageUrl = recipe.output.imageUrl ?? null;

  recipe.name = selected.name;
  recipe.output.name = selected.name;
  recipe.output.imageUrl = selected.iconUrl ?? recipe.output.imageUrl ?? null;
  recipe.components = recipe.components.map(enchantedComponent);
  recipe.notes = appendNote(recipe.notes, statNote);
  recipe.sourceMetadata = {
    ...(recipe.sourceMetadata ?? {}),
    jewelcraftStatJewelryResolved: true,
    originalPlainRecipeName: originalName,
    originalPlainOutputName: originalOutputName,
    originalPlainComponents: originalComponents,
    originalPlainOutputImageUrl: originalOutputImageUrl,
    allakhazamItemId: selected.itemId,
    allakhazamUrl: selected.url,
    nonStatAllakhazamUrl: nonStat?.url ?? null,
  };
  itemDetails[selected.name] = toItemDetails(selected, itemDetails[selected.name]);

  report.upgraded.push({
    originalName,
    displayName: selected.name,
    trivial: recipe.trivial,
    enchantedComponents: recipe.components.map((component) => `${component.count}x ${component.name}`),
    stats: selected.stats,
    resists: selected.resists,
    allakhazamUrl: selected.url,
    nonStatAllakhazamUrl: nonStat?.url ?? null,
  });
}

await writeFile(craftingPath, `${JSON.stringify(craftingData, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Upgraded ${report.upgraded.length} Jewelcraft recipes.`);
console.log(`Unresolved ${report.unresolved.length} Jewelcraft recipes.`);
console.log(`Ambiguous ${report.ambiguous.length} Jewelcraft recipes.`);
console.log(`Wrote ${reportPath}`);
