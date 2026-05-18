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
  iconPath?: string | null;
  sourceUrl?: string | null;
  stats?: Record<string, number | string>;
  resists?: Record<string, number | string>;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
};

type Candidate = {
  url: string;
  text: string;
  variant: string;
  score: number;
  matchReason: string;
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const priorReportPath = path.join(root, "data", "crafting-p99-zam-enrichment-report.json");
const reportPath = path.join(root, "data", "crafting-zam-fuzzy-enrichment-report.json");
const cacheDir = path.join(root, "cache", "zam-pages");
const skills = ["tinkering", "baking", "smithing", "brewing", "fletching", "pottery", "tailoring"];
const skillRank = new Map(skills.map((skill, index) => [skill, index]));
const concurrency = Number(process.env.ZAM_CONCURRENCY ?? 6);

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
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

function searchUrl(name: string) {
  return `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}`;
}

function canonicalItemUrl(url: string) {
  const href = url.startsWith("http") ? url : `https://everquest.allakhazam.com${url.startsWith("/") ? "" : "/"}${url}`;
  return href.replace(/&amp;/g, "&").match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? href;
}

async function fetchCached(url: string, label: string) {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${slug(label)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");
  const response = await fetch(url, { headers: { "user-agent": "FrostreaverLootReference/0.2 (+local fuzzy crafting enrichment)", accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

function normalize(value: string) {
  return value
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[‘’`']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\b(?:a|an|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compact(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

function singularToken(token: string) {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function singularNormalized(value: string) {
  return normalize(value).split(" ").map(singularToken).join(" ");
}

function variants(name: string) {
  const normalizedSpacing = name.replace(/[‘’`]/g, "'").replace(/\s+/g, " ").trim();
  const noArticle = normalizedSpacing.replace(/^(?:a|an|the)\s+/i, "");
  const punctuationAsSpaces = noArticle.replace(/[,/_-]+/g, " ").replace(/\s+/g, " ").trim();
  const withoutSizeHint = noArticle.replace(/\s*\(\s*S\s*\|\s*M\s*\|\s*L\s*\)\s*/gi, "").trim();
  const singular = singularNormalized(noArticle);
  return Array.from(new Set([
    normalizedSpacing,
    noArticle,
    `a ${noArticle}`,
    `an ${noArticle}`,
    `the ${noArticle}`,
    punctuationAsSpaces,
    withoutSizeHint,
    singular,
  ].map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean)));
}

function scoreCandidate(text: string, variant: string): Pick<Candidate, "score" | "matchReason"> | null {
  const candidateNorm = normalize(text);
  const variantNorm = normalize(variant);
  if (!candidateNorm || !variantNorm) return null;
  if (candidateNorm === variantNorm) return { score: 1, matchReason: "normalized exact match" };
  if (compact(text) === compact(variant)) return { score: 0.99, matchReason: "punctuation/spacing normalized match" };
  if (singularNormalized(text) === singularNormalized(variant)) return { score: 0.98, matchReason: "singular/plural normalized match" };
  if (candidateNorm.includes(variantNorm) || variantNorm.includes(candidateNorm)) {
    const shorter = Math.min(candidateNorm.length, variantNorm.length);
    const longer = Math.max(candidateNorm.length, variantNorm.length);
    const score = shorter / longer;
    if (score >= 0.86) return { score, matchReason: "contained normalized match" };
  }
  return null;
}

function searchCandidates(searchHtml: string, variant: string): Candidate[] {
  const seen = new Set<string>();
  return Array.from(searchHtml.matchAll(/href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({ url: canonicalItemUrl(match[1]), text: stripTags(match[2]) }))
    .filter((candidate) => {
      const key = `${candidate.url}:${candidate.text}`;
      if (!candidate.text || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candidate) => {
      const scored = scoreCandidate(candidate.text, variant);
      return scored ? { ...candidate, variant, ...scored } : null;
    })
    .filter((candidate): candidate is Candidate => candidate !== null);
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

function hasDirectZam(details: ItemDetails | undefined) {
  const urls = [details?.sourceUrl, ...(details?.sources ?? []).map((source) => source.url)].filter(Boolean);
  return urls.some((url) => /everquest\.allakhazam\.com\/db\/item\.html\?item=/i.test(String(url)));
}

function shouldSkip(recipe: Recipe) {
  if (recipe.skill === "pottery" && recipe.sourceMetadata?.potteryIdol === true) return true;
  if (/\(\s*S\s*\|\s*M\s*\|\s*L\s*\)/i.test(recipe.output.name)) return true;
  return false;
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[] };
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const priorReport = existsSync(priorReportPath)
  ? JSON.parse(await readFile(priorReportPath, "utf8")) as { unresolved?: Array<{ skill: string; name: string }>; ambiguous?: Array<{ skill: string; name: string }> }
  : { unresolved: [], ambiguous: [] };
const priorProblemNames = new Set([...(priorReport.unresolved ?? []), ...(priorReport.ambiguous ?? [])].map((entry) => `${entry.skill}:${entry.name}`));
const report = {
  checkedBySkill: {} as Record<string, number>,
  resolvedBySkill: {} as Record<string, number>,
  resolved: [] as Array<Record<string, unknown>>,
  ambiguous: [] as Array<Record<string, unknown>>,
  unresolved: [] as Array<Record<string, unknown>>,
  skipped: [] as Array<Record<string, unknown>>,
};
const recipes = Array.from(new Map(
  crafting.recipes
    .filter((recipe) => skills.includes(recipe.skill) && recipe.sourceMetadata?.source === "Project1999 Wiki")
    .map((recipe) => [recipe.output.name, recipe]),
).values())
  .filter((recipe) => {
    if (shouldSkip(recipe)) {
      const reason = recipe.skill === "pottery" && recipe.sourceMetadata?.potteryIdol === true
        ? "Pottery idol stats are era-sensitive and sourced from P99."
        : "Generic size placeholder output; fuzzy matching would risk linking the wrong concrete item.";
      report.skipped.push({ skill: recipe.skill, name: recipe.output.name, reason });
      return false;
    }
    const existing = details[recipe.output.name];
    return priorProblemNames.has(`${recipe.skill}:${recipe.output.name}`) || !existing?.iconPath || !hasDirectZam(existing);
  })
  .sort((a, b) => (skillRank.get(a.skill) ?? 999) - (skillRank.get(b.skill) ?? 999) || a.output.name.localeCompare(b.output.name));

for (const recipe of recipes) report.checkedBySkill[recipe.skill] = (report.checkedBySkill[recipe.skill] ?? 0) + 1;

async function resolveRecipe(recipe: Recipe) {
  const recipeVariants = variants(recipe.output.name);
  const allCandidates = new Map<string, Candidate>();
  try {
    for (const variant of recipeVariants) {
      const searchHtml = await fetchCached(searchUrl(variant), `search:fuzzy-crafting:${variant}`);
      for (const candidate of searchCandidates(searchHtml, variant)) {
        const existing = allCandidates.get(candidate.url);
        if (!existing || candidate.score > existing.score) allCandidates.set(candidate.url, candidate);
      }
    }
    const candidates = Array.from(allCandidates.values()).sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
    const strong = candidates.filter((candidate) => candidate.score >= 0.98);
    if (strong.length !== 1) {
      if (strong.length > 1 || candidates.length > 1) {
        report.ambiguous.push({
          skill: recipe.skill,
          name: recipe.output.name,
          variantsTried: recipeVariants,
          candidates: (strong.length > 1 ? strong : candidates).slice(0, 12),
          reason: strong.length > 1 ? "Multiple strong fuzzy matches." : "No single strong match; weaker candidates were found.",
        });
      } else {
        report.unresolved.push({
          skill: recipe.skill,
          name: recipe.output.name,
          variantsTried: recipeVariants,
          reason: candidates.length === 0 ? "No fuzzy Allakhazam item match found." : "Candidate score below safe threshold.",
          candidates,
        });
      }
      return;
    }

    const selected = strong[0];
    const html = await fetchCached(selected.url, `item:${selected.url}`);
    const parsed = parseItem(html, recipe.output.name, selected.url);
    const existing = details[recipe.output.name] ?? {};
    const matchNote = `Fuzzy crafting enrichment resolved Allakhazam match "${selected.text}" using "${selected.variant}" (${selected.matchReason}).`;
    const existingNotes = (existing.match_notes ?? []) as string[];
    details[recipe.output.name] = {
      ...existing,
      name: existing.name ?? recipe.output.name,
      slot: existing.slot ?? parsed.slot,
      ac: existing.ac ?? parsed.ac,
      damage: existing.damage ?? parsed.damage,
      delay: existing.delay ?? parsed.delay,
      stats: { ...parsed.stats, ...(existing.stats ?? {}) },
      resists: { ...parsed.resists, ...(existing.resists ?? {}) },
      classes: Array.isArray(existing.classes) && existing.classes.length ? existing.classes : parsed.classes,
      races: Array.isArray(existing.races) && existing.races.length ? existing.races : parsed.races,
      weight: existing.weight ?? parsed.weight,
      size: existing.size ?? parsed.size,
      lore: existing.lore ?? parsed.lore,
      magic: existing.magic ?? parsed.magic,
      no_drop: existing.no_drop ?? parsed.no_drop,
      iconPath: existing.iconPath ?? parsed.iconPath ?? recipe.output.imageUrl ?? null,
      sources: [
        ...((existing.sources ?? []) as Array<{ name: string; url: string }>),
        ...(((existing.sources ?? []) as Array<{ name: string; url: string }>).some((source) => source.url === selected.url) ? [] : [{ name: "Allakhazam", url: selected.url }]),
      ],
      match_notes: [
        ...existingNotes,
        ...(existingNotes.includes(matchNote) ? [] : [matchNote]),
      ],
      missing_core_stats: false,
    };
    report.resolvedBySkill[recipe.skill] = (report.resolvedBySkill[recipe.skill] ?? 0) + 1;
    report.resolved.push({
      skill: recipe.skill,
      name: recipe.output.name,
      matchedText: selected.text,
      url: selected.url,
      variantUsed: selected.variant,
      matchReason: selected.matchReason,
      score: selected.score,
      addedIcon: Boolean(!existing.iconPath && parsed.iconPath),
    });
  } catch (error) {
    report.unresolved.push({
      skill: recipe.skill,
      name: recipe.output.name,
      variantsTried: recipeVariants,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

for (let i = 0; i < recipes.length; i += concurrency) {
  await Promise.all(recipes.slice(i, i + concurrency).map(resolveRecipe));
  console.log(`Fuzzy processed ${Math.min(i + concurrency, recipes.length)}/${recipes.length}`);
}

await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Fuzzy checked ${recipes.length} unresolved crafting outputs.`);
console.log(`Resolved ${report.resolved.length}; ambiguous ${report.ambiguous.length}; unresolved ${report.unresolved.length}.`);
console.log(`Wrote ${reportPath}`);
