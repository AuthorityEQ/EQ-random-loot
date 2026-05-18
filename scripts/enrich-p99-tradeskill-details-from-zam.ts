import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type Recipe = { skill: string; name: string; output: { name: string; imageUrl?: string | null }; sourceMetadata?: Record<string, unknown> };
type Component = { name: string; componentType?: string };
type ItemDetails = Record<string, unknown> & {
  stats?: Record<string, number | string>;
  resists?: Record<string, number | string>;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-p99-zam-enrichment-report.json");
const cacheDir = path.join(root, "cache", "zam-pages");
const skills = new Set(["baking", "smithing", "brewing", "fletching", "pottery", "tailoring", "tinkering"]);
const concurrency = Number(process.env.ZAM_CONCURRENCY ?? 8);

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function decode(value: string) {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'").replace(/&gt;/gi, ">").replace(/&lt;/gi, "<");
}

function stripTags(html: string) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim());
}

function normalize(value: string) {
  return value.replace(/\s*\[[^\]]+\]\s*$/g, "").replace(/\s*\([^)]*TLP[^)]*\)\s*$/gi, "").replace(/['`’]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function fetchCached(url: string, label: string) {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${slug(label)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");
  const response = await fetch(url, { headers: { "user-agent": "FrostreaverLootReference/0.2 (+local P99 tradeskill enrichment)", accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

function searchUrl(name: string) {
  return `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}`;
}

function canonicalItemUrl(url: string) {
  const href = url.startsWith("http") ? url : `https://everquest.allakhazam.com${url.startsWith("/") ? "" : "/"}${url}`;
  return href.replace(/&amp;/g, "&").match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? href;
}

function searchCandidates(searchHtml: string, name: string) {
  const seen = new Set<string>();
  return Array.from(searchHtml.matchAll(/href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({ url: canonicalItemUrl(match[1]), text: stripTags(match[2]) }))
    .filter((candidate) => {
      if (!candidate.text || seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return normalize(candidate.text) === normalize(name);
    });
}

function parseStats(text: string) {
  const stats: Record<string, number | string> = {};
  const resists: Record<string, number | string> = {};
  const resistMap = new Map([["MR", "MR"], ["DR", "DR"], ["PR", "PR"], ["FR", "FR"], ["CR", "CR"], ["SV MAGIC", "MR"], ["SV DISEASE", "DR"], ["SV POISON", "PR"], ["SV FIRE", "FR"], ["SV COLD", "CR"]]);
  for (const match of text.matchAll(/\b(STR|STA|AGI|DEX|WIS|INT|CHA|HP|MANA|MP|END|AC|MR|FR|CR|DR|PR|SV FIRE|SV COLD|SV MAGIC|SV POISON|SV DISEASE|Damage|DMG|Delay)\s*:?\s*([+-]?\d+%?)\b/gi)) {
    const key = match[1].toUpperCase() === "MP" ? "MANA" : match[1].toUpperCase();
    const value = match[2].includes("%") ? match[2] : Number(match[2]);
    const resistKey = resistMap.get(key);
    if (resistKey) resists[resistKey] = value;
    else if (!["AC", "DAMAGE", "DMG", "DELAY"].includes(key)) stats[key] = value;
  }
  return { stats, resists };
}

function parseItem(html: string, name: string, url: string) {
  const itemBlock = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlock);
  const iconRaw = html.match(/<img[^>]+class=["'][^"']*\bitemicon\b[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bitemicon\b/i)?.[1]
    ?? null;
  const iconPath = iconRaw?.startsWith("//") ? `https:${iconRaw}` : iconRaw;
  const { stats, resists } = parseStats(text);
  const number = (pattern: RegExp) => {
    const value = Number(text.match(pattern)?.[1] ?? NaN);
    return Number.isFinite(value) ? value : null;
  };
  return {
    name,
    url,
    iconPath,
    slot: text.match(/\bSlot:\s*([^\n]+)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null,
    ac: number(/\bAC:\s*([+-]?\d+)/i),
    damage: number(/\b(?:DMG|Damage):\s*(\d+)/i),
    delay: number(/\bDelay:\s*(\d+)/i),
    stats,
    resists,
    classes: text.match(/\bClass(?:es)?:\s*([^\n]+)/i)?.[1]?.split(/[,/ ]+/).filter(Boolean) ?? [],
    races: text.match(/\bRace(?:s)?:\s*([^\n]+)/i)?.[1]?.split(/[,/ ]+/).filter(Boolean) ?? [],
    weight: number(/\bWT:\s*(\d+(?:\.\d+)?)/i),
    size: text.match(/\bSize:\s*([^\n]+)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null,
    lore: /\bLORE(?:\s+ITEM)?\b/i.test(text),
    magic: /\bMAGIC(?:\s+ITEM)?\b/i.test(text),
    no_drop: /\b(?:NO\s+DROP|NO\s+TRADE)\b/i.test(text),
  };
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[] };
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const recipes = crafting.recipes.filter((recipe) => skills.has(recipe.skill) && recipe.sourceMetadata?.source === "Project1999 Wiki");
const byName = Array.from(new Map(recipes.map((recipe) => [recipe.output.name, recipe])).values());
const processComponents = new Set(
  crafting.recipes
    .flatMap((recipe) => ((recipe as Recipe & { components?: Component[] }).components ?? []))
    .filter((component) => component.componentType && !["ingredient", "finalItem", "unknown"].includes(component.componentType))
    .map((component) => component.name),
);
const report = {
  checkedBySkill: {} as Record<string, number>,
  enrichedBySkill: {} as Record<string, number>,
  unresolved: [] as Array<Record<string, unknown>>,
  ambiguous: [] as Array<Record<string, unknown>>,
  skippedProcessComponents: Array.from(processComponents).sort(),
  skippedEraSensitiveItems: [] as Array<Record<string, unknown>>,
};

for (const recipe of byName) report.checkedBySkill[recipe.skill] = (report.checkedBySkill[recipe.skill] ?? 0) + 1;

async function enrich(recipe: Recipe) {
  try {
    if (recipe.skill === "pottery" && recipe.sourceMetadata?.potteryIdol === true) {
      report.skippedEraSensitiveItems.push({
        skill: recipe.skill,
        name: recipe.output.name,
        reason: "Pottery idol stats are sourced from P99 shorthand; Allakhazam fallback may match live-era items with inflated stats.",
      });
      return;
    }
    const searchHtml = await fetchCached(searchUrl(recipe.output.name), `search:p99-tradeskill:${recipe.output.name}`);
    const candidates = searchCandidates(searchHtml, recipe.output.name);
    if (candidates.length === 0) {
      report.unresolved.push({ skill: recipe.skill, name: recipe.output.name, reason: "No exact Allakhazam item match found." });
      return;
    }
    if (candidates.length > 1) report.ambiguous.push({ skill: recipe.skill, name: recipe.output.name, candidates });
    const selected = candidates[0];
    const html = await fetchCached(selected.url, `item:${selected.url}`);
    const parsed = parseItem(html, recipe.output.name, selected.url);
    const existing = details[recipe.output.name] ?? {};
    details[recipe.output.name] = {
      ...existing,
      name: existing.name ?? recipe.output.name,
      slot: existing.slot ?? parsed.slot,
      ac: existing.ac ?? parsed.ac,
      damage: existing.damage ?? parsed.damage,
      delay: existing.delay ?? parsed.delay,
      stats: { ...(existing.stats ?? {}), ...parsed.stats },
      resists: { ...(existing.resists ?? {}), ...parsed.resists },
      classes: Array.isArray(existing.classes) && existing.classes.length ? existing.classes : parsed.classes,
      races: Array.isArray(existing.races) && existing.races.length ? existing.races : parsed.races,
      weight: existing.weight ?? parsed.weight,
      size: existing.size ?? parsed.size,
      lore: existing.lore ?? parsed.lore,
      magic: existing.magic ?? parsed.magic,
      no_drop: existing.no_drop ?? parsed.no_drop,
      iconPath: existing.iconPath ?? parsed.iconPath ?? recipe.output.imageUrl ?? null,
      sourceUrl: existing.sourceUrl ?? selected.url,
      sources: [
        ...((existing.sources ?? []) as Array<{ name: string; url: string }>),
        ...(((existing.sources ?? []) as Array<{ name: string; url: string }>).some((source) => source.url === selected.url) ? [] : [{ name: "Allakhazam", url: selected.url }]),
      ],
      match_notes: [
        ...((existing.match_notes ?? []) as string[]),
        "P99 tradeskill item detail fields enriched from exact Allakhazam fallback match without changing recipe structure.",
      ],
      missing_core_stats: false,
    };
    report.enrichedBySkill[recipe.skill] = (report.enrichedBySkill[recipe.skill] ?? 0) + 1;
  } catch (error) {
    report.unresolved.push({ skill: recipe.skill, name: recipe.output.name, reason: error instanceof Error ? error.message : String(error) });
  }
}

for (let i = 0; i < byName.length; i += concurrency) {
  await Promise.all(byName.slice(i, i + concurrency).map(enrich));
  console.log(`Processed ${Math.min(i + concurrency, byName.length)}/${byName.length}`);
}

await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Checked ${byName.length} unique P99 tradeskill outputs.`);
console.log(`Wrote ${reportPath}`);
