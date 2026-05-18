import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type Recipe = {
  skill: string;
  name: string;
  output: { name: string; imageUrl?: string | null };
  sourceMetadata?: Record<string, unknown>;
};

type ItemDetails = Record<string, unknown> & {
  name?: string;
  stats?: Record<string, number | string>;
  resists?: Record<string, number | string>;
  ac?: number | null;
  iconPath?: string | null;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-jewelcraft-zam-detail-enrichment-report.json");
const cacheDir = path.join(root, "cache", "zam-pages");
const userAgent = "FrostreaverLootReference/0.2 (+local jewelcraft detail enrichment; contact: local)";
const requestDelayMs = Number(process.env.ZAM_REQUEST_DELAY_MS ?? 350);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<");
}

function stripTags(html: string) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim(),
  );
}

function normalize(value: string) {
  return value.replace(/\s*\[[^\]]+\]\s*$/g, "").replace(/['`’]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function fetchCached(url: string, label: string) {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${slug(label)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");
  await sleep(requestDelayMs);
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
  });
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

function candidates(searchHtml: string, name: string) {
  return Array.from(searchHtml.matchAll(/href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({ url: canonicalItemUrl(match[1]), text: stripTags(match[2]) }))
    .filter((candidate) => candidate.text && normalize(candidate.text) === normalize(name) && !/\bnon[-\s]?enchanted\b/i.test(candidate.text));
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

function parseItem(html: string, name: string, url: string) {
  const itemBlock = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlock);
  const title = decode(html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i)?.[1] ?? name).replace(/^Item\s*:\s*/i, "").trim();
  const iconRaw = html.match(/<img[^>]+class=["'][^"']*\bitemicon\b[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bitemicon\b/i)?.[1]
    ?? null;
  const iconPath = iconRaw?.startsWith("//") ? `https:${iconRaw}` : iconRaw;
  const expansionHtml = html.match(/<strong>\s*Expansion:\s*<\/strong>([\s\S]*?)<br/i)?.[1];
  const expansion = expansionHtml ? (expansionHtml.match(/alt=["']([^"']+)["']/i)?.[1] ?? stripTags(expansionHtml)).trim() : null;
  const { stats, resists } = parseStats(text);
  const ac = Number(text.match(/\bAC:\s*([+-]?\d+)/i)?.[1] ?? NaN);
  return {
    name: title,
    url,
    iconPath,
    stats,
    resists,
    ac: Number.isFinite(ac) ? ac : null,
    expansion,
  };
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[] };
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const jewelcraft = crafting.recipes.filter((recipe) => recipe.skill === "jewelcraft" && recipe.sourceMetadata?.source === "Project1999 Jewelcrafting");
const report = {
  checked: jewelcraft.length,
  enriched: [] as Array<Record<string, unknown>>,
  unresolved: [] as Array<Record<string, unknown>>,
};

for (const recipe of jewelcraft) {
  try {
    const searchHtml = await fetchCached(searchUrl(recipe.output.name), `search:jewelcraft-zam:${recipe.output.name}`);
    const candidate = candidates(searchHtml, recipe.output.name)[0];
    if (!candidate) {
      report.unresolved.push({ name: recipe.output.name, reason: "No exact stat jewelry Allakhazam match found." });
      continue;
    }
    const html = await fetchCached(candidate.url, `item:${candidate.url}`);
    const parsed = parseItem(html, recipe.output.name, candidate.url);
    const existing = details[recipe.output.name] ?? {};
    details[recipe.output.name] = {
      ...existing,
      name: existing.name ?? recipe.output.name,
      ac: parsed.ac ?? existing.ac ?? null,
      stats: { ...(existing.stats ?? {}), ...parsed.stats },
      resists: { ...(existing.resists ?? {}), ...parsed.resists },
      iconPath: existing.iconPath ?? parsed.iconPath ?? recipe.output.imageUrl ?? null,
      sourceUrl: existing.sourceUrl ?? candidate.url,
      sources: [
        ...((existing.sources ?? []) as Array<{ name: string; url: string }>),
        ...(((existing.sources ?? []) as Array<{ name: string; url: string }>).some((source) => source.url === candidate.url) ? [] : [{ name: "Allakhazam", url: candidate.url }]),
      ],
      match_notes: [
        ...((existing.match_notes ?? []) as string[]),
        "Jewelcraft detail fields enriched from exact Allakhazam fallback match without changing P99 recipe structure.",
      ],
      missing_core_stats: false,
    };
    report.enriched.push({ name: recipe.output.name, url: candidate.url, stats: parsed.stats, resists: parsed.resists, ac: parsed.ac, iconPath: parsed.iconPath });
  } catch (error) {
    report.unresolved.push({ name: recipe.output.name, reason: error instanceof Error ? error.message : String(error) });
  }
}

await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Checked ${report.checked} Jewelcraft items.`);
console.log(`Enriched ${report.enriched.length}.`);
console.log(`Unresolved ${report.unresolved.length}.`);
console.log(`Wrote ${reportPath}`);
