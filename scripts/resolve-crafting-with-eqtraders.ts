import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type Recipe = {
  skill: string;
  name: string;
  output: { name: string; imageUrl?: string | null };
  sourceUrl?: string | null;
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

type EqContext = {
  skill: string;
  name: string;
  url: string;
  pageTitle: string;
  pageUrl: string;
  contextType: "recipeOutput" | "componentOrSubcombine";
};

type ZamCandidate = {
  url: string;
  text: string;
  variant: string;
  score: number;
  matchReason: string;
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const fuzzyReportPath = path.join(root, "data", "crafting-zam-fuzzy-enrichment-report.json");
const reportPath = path.join(root, "data", "crafting-eqtraders-fallback-report.json");
const cacheDir = path.join(root, "cache", "eqtraders-pages");
const zamCacheDir = path.join(root, "cache", "zam-pages");
const eqBase = "https://www.eqtraders.com";
const eqIndexUrl = `${eqBase}/articles/article_page.php?article=g28&menustr=080000000000`;
const categoryPages: Record<string, string> = {
  baking: "/articles/article_page.php?article=g33&menustr=080020000000",
  brewing: "/articles/article_page.php?article=g34&menustr=080030000000",
  fletching: "/articles/article_page.php?article=g39&menustr=080060000000",
  pottery: "/articles/article_page.php?article=g55&menustr=080090000000",
  smithing: "/articles/article_page.php?article=g57&menustr=080100000000",
  tailoring: "/articles/article_page.php?article=g62&menustr=080110000000",
  tinkering: "/articles/article_page.php?article=g66&menustr=080120000000",
};
const earlyPageLabel = /complete list|old world|velious|luclin|normal recipes|armor recipes|geerlok recipes|basic|tools|weapons|armors|arrows|bows|other|quest|imbued|vials|steins|kiln|basics and bags|basic leathers|basic silks|velious leathers|velious silks|velious furs|luclin leathers|luclin silks|alcoholic|non-alcoholic|tempers|tannins/i;
const lateEraLabel = /planes of power|legacy of ykesha|lost dungeons|gates of discord|omens of war|dragons of norrath|darkhollow|prophecy|serpent|buried|secrets|seeds|underfoot|house of thule|alaris|rain of fear|forsaken|darkened sea|empire|shattering|brood|laurion|night of shadows|terror|claws of veeshan|torment of velious|the burning lands|ros|eok|tss|sof|tbm|dodh|por|god|oow|ldon|loy|pop/i;

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#147;|&#148;/g, "\"")
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

function clean(html: string) {
  return stripTags(html).replace(/\s+/g, " ").trim();
}

function absoluteEqUrl(href: string) {
  const normalized = decode(href).replace(/\s+/g, "");
  if (normalized.startsWith("http")) return normalized;
  return `${eqBase}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

function canonicalEqItemUrl(url: string) {
  const normalized = url.replace("https://www.eqtraders.com//", "https://www.eqtraders.com/");
  const item = normalized.match(/^(https:\/\/www\.eqtraders\.com\/items\/show_item\.php\?item=\d+)/i)?.[1];
  return item ?? normalized;
}

async function fetchCached(url: string, label: string, dir = cacheDir) {
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${slug(label)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");
  const response = await fetch(url, { headers: { "user-agent": "FrostreaverLootReference/0.2 (+local EQTraders fallback resolver)", accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
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

function sourceAlias(recipe: Recipe) {
  const url = recipe.sourceUrl ?? "";
  const last = decodeURIComponent(url.split("/").pop() ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return last && !/^https?:/i.test(last) ? last : "";
}

function candidateAliases(recipe: Recipe) {
  return Array.from(new Set([recipe.output.name, recipe.name, sourceAlias(recipe)].filter(Boolean)));
}

function findPageLinks(categoryHtml: string) {
  return Array.from(categoryHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({
      href: decode(match[1]).replace(/\s+/g, ""),
      label: clean(match[2]),
    }))
    .filter((link) => /\/recipes\/(?:pottery_)?recipe_page\.php/i.test(link.href))
    .filter((link) => earlyPageLabel.test(link.label) && !lateEraLabel.test(link.label))
    .map((link) => ({ ...link, url: absoluteEqUrl(link.href) }));
}

function pageTitle(html: string) {
  return clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "EQTraders recipe page");
}

function parseEqContexts(skill: string, html: string, pageUrl: string): EqContext[] {
  const title = pageTitle(html);
  const contexts: EqContext[] = [];
  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = Array.from(row[0].matchAll(/<td[^>]*class=["']intable2?["'][^>]*>([\s\S]*?)<\/td>/gi)).map((match) => match[1]);
    if (cells.length < 2) continue;
    const itemAnchor = cells[0].match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (itemAnchor) {
      contexts.push({
        skill,
        name: clean(itemAnchor[2]),
        url: absoluteEqUrl(itemAnchor[1]),
        pageTitle: title,
        pageUrl,
        contextType: "recipeOutput",
      });
    }
    for (const componentAnchor of cells[1].matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      contexts.push({
        skill,
        name: clean(componentAnchor[2]),
        url: absoluteEqUrl(componentAnchor[1]),
        pageTitle: title,
        pageUrl,
        contextType: "componentOrSubcombine",
      });
    }
  }
  return contexts;
}

function scoreEqContext(context: EqContext, recipe: Recipe) {
  const aliases = candidateAliases(recipe);
  for (const alias of aliases) {
    if (normalize(context.name) === normalize(alias)) return { score: 1, alias, reason: "normalized exact EQTraders match" };
    if (compact(context.name) === compact(alias)) return { score: 0.99, alias, reason: "punctuation/spacing normalized EQTraders match" };
  }
  for (const alias of aliases) {
    const contextNorm = normalize(context.name);
    const aliasNorm = normalize(alias);
    if (!contextNorm || !aliasNorm) continue;
    if (contextNorm.includes(aliasNorm) || aliasNorm.includes(contextNorm)) {
      const shorter = Math.min(contextNorm.length, aliasNorm.length);
      const longer = Math.max(contextNorm.length, aliasNorm.length);
      const score = shorter / longer;
      if (score >= 0.78) return { score, alias, reason: "contained EQTraders context match" };
    }
  }
  return null;
}

function uniqueScoredContexts(scored: Array<{ context: EqContext; score: number; alias: string; reason: string }>) {
  const byKey = new Map<string, { context: EqContext; score: number; alias: string; reason: string }>();
  for (const entry of scored) {
    const key = `${canonicalEqItemUrl(entry.context.url)}:${normalize(entry.context.name)}:${entry.context.contextType}`;
    const old = byKey.get(key);
    if (!old || entry.score > old.score) byKey.set(key, entry);
  }
  return Array.from(byKey.values()).sort((a, b) => b.score - a.score || a.context.name.localeCompare(b.context.name));
}

function searchUrl(name: string) {
  return `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(name)}`;
}

function canonicalItemUrl(url: string) {
  const href = url.startsWith("http") ? url : `https://everquest.allakhazam.com${url.startsWith("/") ? "" : "/"}${url}`;
  return href.replace(/&amp;/g, "&").match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? href;
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

function scoreZamCandidate(text: string, variant: string): Pick<ZamCandidate, "score" | "matchReason"> | null {
  if (normalize(text) === normalize(variant)) return { score: 1, matchReason: "normalized exact match" };
  if (compact(text) === compact(variant)) return { score: 0.99, matchReason: "punctuation/spacing normalized match" };
  if (singularNormalized(text) === singularNormalized(variant)) return { score: 0.98, matchReason: "singular/plural normalized match" };
  return null;
}

function parseZamCandidates(html: string, variant: string): ZamCandidate[] {
  const seen = new Set<string>();
  return Array.from(html.matchAll(/href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({ url: canonicalItemUrl(match[1]), text: stripTags(match[2]) }))
    .filter((candidate) => {
      const key = `${candidate.url}:${candidate.text}`;
      if (!candidate.text || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candidate) => {
      const scored = scoreZamCandidate(candidate.text, variant);
      return scored ? { ...candidate, variant, ...scored } : null;
    })
    .filter((candidate): candidate is ZamCandidate => candidate !== null);
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

function parseZamItem(html: string, name: string, url: string) {
  const itemBlock = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlock);
  const iconRaw = html.match(/<img[^>]+class=["'][^"']*\bitemicon\b[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bitemicon\b/i)?.[1]
    ?? null;
  const iconPath = iconRaw?.startsWith("//") ? `https:${iconRaw}` : iconRaw;
  const { stats, resists } = parseStats(text);
  return { name, url, iconPath, stats, resists };
}

function mergeSource(details: ItemDetails, name: string, url: string) {
  const sources = details.sources ?? [];
  return sources.some((source) => source.url === url) ? sources : [...sources, { name, url }];
}

function mergeNote(details: ItemDetails, note: string) {
  const notes = details.match_notes ?? [];
  return notes.includes(note) ? notes : [...notes, note];
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[] };
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const fuzzyReport = JSON.parse(await readFile(fuzzyReportPath, "utf8")) as {
  unresolved: Array<{ skill: string; name: string }>;
  ambiguous: Array<{ skill: string; name: string }>;
  skipped?: Array<{ skill: string; name: string }>;
};
const targetKeys = new Set([...fuzzyReport.unresolved, ...fuzzyReport.ambiguous, ...(fuzzyReport.skipped ?? [])].map((entry) => `${entry.skill}:${entry.name}`));
const targets = Array.from(new Map(
  crafting.recipes
    .filter((recipe) => targetKeys.has(`${recipe.skill}:${recipe.output.name}`))
    .map((recipe) => [recipe.output.name, recipe]),
).values());

const report = {
  sourceIndex: eqIndexUrl,
  checked: targets.length,
  checkedBySkill: {} as Record<string, number>,
  pagesFetchedBySkill: {} as Record<string, number>,
  resolvedViaEqContext: [] as Array<Record<string, unknown>>,
  eqContextOnly: [] as Array<Record<string, unknown>>,
  stillAmbiguous: [] as Array<Record<string, unknown>>,
  stillUnresolved: [] as Array<Record<string, unknown>>,
  likelyPlaceholderOrSubcombine: [] as Array<Record<string, unknown>>,
};
for (const target of targets) report.checkedBySkill[target.skill] = (report.checkedBySkill[target.skill] ?? 0) + 1;

const contextsBySkill = new Map<string, EqContext[]>();
for (const [skill, categoryPath] of Object.entries(categoryPages)) {
  const categoryUrl = absoluteEqUrl(categoryPath);
  const categoryHtml = await fetchCached(categoryUrl, `eqtraders-category:${skill}`);
  const pageLinks = findPageLinks(categoryHtml);
  const contexts: EqContext[] = [];
  for (const link of pageLinks) {
    const html = await fetchCached(link.url, `eqtraders-recipe-page:${skill}:${link.url}`);
    contexts.push(...parseEqContexts(skill, html, link.url));
  }
  contextsBySkill.set(skill, contexts);
  report.pagesFetchedBySkill[skill] = pageLinks.length;
}

for (const recipe of targets) {
  const contexts = contextsBySkill.get(recipe.skill) ?? [];
  const scored = contexts
    .map((context) => {
      const score = scoreEqContext(context, recipe);
      return score ? { context, ...score } : null;
    })
    .filter((entry): entry is { context: EqContext; score: number; alias: string; reason: string } => entry !== null)
    .sort((a, b) => b.score - a.score || a.context.name.localeCompare(b.context.name));
  const uniqueScored = uniqueScoredContexts(scored);
  const strong = uniqueScored.filter((entry) => entry.score >= 0.99);
  const best = strong.length === 1 ? strong[0] : null;

  if (!best) {
    const likelyPlaceholder = /\(\s*S\s*\|\s*M\s*\|\s*L\s*\)|^(?:Fillets|Shaped Cookie Cutters|Reinforced Armor|.+ Armor Set)$/i.test(recipe.output.name);
    const bucket = likelyPlaceholder ? report.likelyPlaceholderOrSubcombine : uniqueScored.length > 1 ? report.stillAmbiguous : report.stillUnresolved;
    bucket.push({
      skill: recipe.skill,
      name: recipe.output.name,
      aliasesTried: candidateAliases(recipe),
      reason: likelyPlaceholder ? "Appears to be a generic family, placeholder, or subcombine label." : uniqueScored.length > 1 ? "EQTraders found multiple possible contexts." : "No matching EQTraders context found in early/current category pages.",
      candidates: uniqueScored.slice(0, 8).map((entry) => ({ name: entry.context.name, url: canonicalEqItemUrl(entry.context.url), pageUrl: entry.context.pageUrl, score: entry.score, reason: entry.reason })),
    });
    continue;
  }

  const existing = details[recipe.output.name] ?? { name: recipe.output.name };
  const eqNote = `EQTraders fallback confirmed ${best.context.contextType} context "${best.context.name}" via ${best.context.pageTitle}.`;
  details[recipe.output.name] = {
    ...existing,
    name: existing.name ?? recipe.output.name,
    sources: mergeSource(existing, "EQTraders", best.context.url),
    match_notes: mergeNote(existing, eqNote),
  };

  const variants = Array.from(new Set([best.context.name, best.alias, ...candidateAliases(recipe)]));
  const zamCandidates = new Map<string, ZamCandidate>();
  for (const variant of variants) {
    const html = await fetchCached(searchUrl(variant), `search:eqtraders-fallback:${variant}`, zamCacheDir);
    for (const candidate of parseZamCandidates(html, variant)) {
      const old = zamCandidates.get(candidate.url);
      if (!old || candidate.score > old.score) zamCandidates.set(candidate.url, candidate);
    }
  }
  const strongZam = Array.from(zamCandidates.values()).filter((candidate) => candidate.score >= 0.98).sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
  if (strongZam.length === 1) {
    const selected = strongZam[0];
    const html = await fetchCached(selected.url, `item:${selected.url}`, zamCacheDir);
    const parsed = parseZamItem(html, recipe.output.name, selected.url);
    const current = details[recipe.output.name] ?? { name: recipe.output.name };
    const zamNote = `Allakhazam match resolved after EQTraders context: "${selected.text}" using "${selected.variant}" (${selected.matchReason}).`;
    details[recipe.output.name] = {
      ...current,
      iconPath: current.iconPath ?? parsed.iconPath ?? recipe.output.imageUrl ?? null,
      stats: { ...parsed.stats, ...(current.stats ?? {}) },
      resists: { ...parsed.resists, ...(current.resists ?? {}) },
      sources: mergeSource(current, "Allakhazam", selected.url),
      match_notes: mergeNote(current, zamNote),
      missing_core_stats: false,
    };
    report.resolvedViaEqContext.push({
      skill: recipe.skill,
      name: recipe.output.name,
      eqtradersName: best.context.name,
      eqtradersUrl: best.context.url,
      allakhazamName: selected.text,
      allakhazamUrl: selected.url,
      variantUsed: selected.variant,
    });
  } else {
    report.eqContextOnly.push({
      skill: recipe.skill,
      name: recipe.output.name,
      eqtradersName: best.context.name,
      eqtradersUrl: best.context.url,
      eqtradersPageUrl: best.context.pageUrl,
      reason: strongZam.length > 1 ? "EQTraders confirmed context, but Allakhazam still has multiple strong matches." : "EQTraders confirmed context, but no safe Allakhazam match was found.",
      allakhazamCandidates: strongZam.slice(0, 8),
    });
  }
}

await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Checked ${report.checked} fuzzy-problem crafting outputs against EQTraders.`);
console.log(`Resolved via EQTraders + Allakhazam: ${report.resolvedViaEqContext.length}`);
console.log(`EQTraders context only: ${report.eqContextOnly.length}`);
console.log(`Still ambiguous: ${report.stillAmbiguous.length}`);
console.log(`Still unresolved: ${report.stillUnresolved.length}`);
console.log(`Likely placeholder/subcombine: ${report.likelyPlaceholderOrSubcombine.length}`);
console.log(`Wrote ${reportPath}`);
