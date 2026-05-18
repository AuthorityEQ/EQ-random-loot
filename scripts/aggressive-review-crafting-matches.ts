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

type ReportEntry = {
  skill: string;
  name: string;
  eqtradersName?: string;
  eqtradersUrl?: string;
  eqtradersPageUrl?: string;
  candidates?: Array<Record<string, unknown>>;
  allakhazamCandidates?: Candidate[];
};

type Candidate = {
  url: string;
  text: string;
  variant: string;
  score: number;
  matchReason: string;
  source: string;
};

type ProposedMatch = {
  skill: string;
  originalItemName: string;
  proposedMatchedName: string;
  proposedAllakhazamUrl: string;
  confidence: "high" | "medium" | "low";
  score: number;
  reason: string;
  risksNotes: string[];
  variantsTried: string[];
  candidateSource: string;
  eqtradersName?: string;
  eqtradersUrl?: string;
  p99SourceUrl?: string | null;
  alternateCandidates: Candidate[];
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const eqReportPath = path.join(root, "data", "crafting-eqtraders-fallback-report.json");
const fuzzyReportPath = path.join(root, "data", "crafting-zam-fuzzy-enrichment-report.json");
const reviewPath = path.join(root, "data", "crafting-aggressive-match-review.json");
const cacheDir = path.join(root, "cache", "zam-pages");
const prioritySkills = ["tinkering", "smithing", "pottery", "tailoring", "baking", "brewing", "fletching"];
const priorityRank = new Map(prioritySkills.map((skill, index) => [skill, index]));

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
  const response = await fetch(url, { headers: { "user-agent": "FrostreaverLootReference/0.2 (+local aggressive crafting match review)", accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

function normalize(value: string) {
  return value
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[â€˜â€™`']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\b(?:a|an|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokens(value: string) {
  return normalize(value).split(" ").filter(Boolean);
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
  return tokens(value).map(singularToken).join(" ");
}

function sourceAlias(recipe: Recipe) {
  const url = recipe.sourceUrl ?? "";
  const last = decodeURIComponent(url.split("/").pop() ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return last && !/^https?:/i.test(last) ? last : "";
}

function variantsFor(name: string) {
  const normalizedSpacing = name.replace(/[â€˜â€™`]/g, "'").replace(/\s+/g, " ").trim();
  const noArticle = normalizedSpacing.replace(/^(?:a|an|the)\s+/i, "");
  const withoutSizeHint = noArticle.replace(/\s*\(\s*S\s*\|\s*M\s*\|\s*L\s*\)\s*/gi, "").trim();
  const punctuationAsSpaces = noArticle.replace(/[,/_:-]+/g, " ").replace(/\s+/g, " ").trim();
  const singular = singularNormalized(noArticle);
  const sortedWords = tokens(noArticle).sort().join(" ");
  return [
    normalizedSpacing,
    noArticle,
    `a ${noArticle}`,
    `an ${noArticle}`,
    `the ${noArticle}`,
    punctuationAsSpaces,
    withoutSizeHint,
    singular,
    sortedWords,
  ];
}

function allVariants(recipe: Recipe, reportEntry?: ReportEntry) {
  const sourceNames = [
    recipe.output.name,
    recipe.name,
    sourceAlias(recipe),
    reportEntry?.eqtradersName,
    ...(reportEntry?.candidates ?? []).map((candidate) => String(candidate.name ?? "")),
  ].filter(Boolean);
  return Array.from(new Set(sourceNames.flatMap(variantsFor).map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean)));
}

function tokenOverlapScore(left: string, right: string) {
  const leftTokens = new Set(tokens(left).map(singularToken));
  const rightTokens = new Set(tokens(right).map(singularToken));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
  return (2 * shared) / (leftTokens.size + rightTokens.size);
}

function scoreCandidate(text: string, variant: string): Pick<Candidate, "score" | "matchReason"> | null {
  const candidateNorm = normalize(text);
  const variantNorm = normalize(variant);
  if (!candidateNorm || !variantNorm) return null;
  if (candidateNorm === variantNorm) return { score: 1, matchReason: "normalized exact match" };
  if (compact(text) === compact(variant)) return { score: 0.99, matchReason: "punctuation/spacing normalized match" };
  if (singularNormalized(text) === singularNormalized(variant)) return { score: 0.98, matchReason: "singular/plural normalized match" };
  if (tokens(text).map(singularToken).sort().join(" ") === tokens(variant).map(singularToken).sort().join(" ")) {
    return { score: 0.93, matchReason: "same words in alternate order" };
  }
  if (candidateNorm.includes(variantNorm) || variantNorm.includes(candidateNorm)) {
    const shorter = Math.min(candidateNorm.length, variantNorm.length);
    const longer = Math.max(candidateNorm.length, variantNorm.length);
    const score = shorter / longer;
    if (score >= 0.72) return { score: Math.min(0.9, score), matchReason: "contained normalized match" };
  }
  const overlap = tokenOverlapScore(text, variant);
  if (overlap >= 0.58) return { score: Math.min(0.86, overlap), matchReason: "loose token overlap match" };
  return null;
}

function searchCandidates(searchHtml: string, variant: string, source: string): Candidate[] {
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
      return scored ? { ...candidate, variant, source, ...scored } : null;
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

function parseItem(html: string, url: string) {
  const itemBlock = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlock);
  const iconRaw = html.match(/<img[^>]+class=["'][^"']*\bitemicon\b[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bitemicon\b/i)?.[1]
    ?? null;
  const iconPath = iconRaw?.startsWith("//") ? `https:${iconRaw}` : iconRaw;
  const { stats, resists } = parseStats(text);
  return { url, iconPath, stats, resists };
}

function mergeSource(details: ItemDetails, name: string, url: string) {
  const sources = details.sources ?? [];
  return sources.some((source) => source.url === url) ? sources : [...sources, { name, url }];
}

function mergeNote(details: ItemDetails, note: string) {
  const notes = details.match_notes ?? [];
  return notes.includes(note) ? notes : [...notes, note];
}

function hasDirectZam(details: ItemDetails | undefined) {
  const urls = [details?.sourceUrl, ...(details?.sources ?? []).map((source) => source.url)].filter(Boolean);
  return urls.some((url) => /everquest\.allakhazam\.com\/db\/item\.html\?item=/i.test(String(url)));
}

function confidenceFor(best: Candidate, alternates: Candidate[], reportEntry?: ReportEntry): ProposedMatch["confidence"] {
  const second = alternates[1];
  const margin = second ? best.score - second.score : 1;
  if (best.score >= 0.98 && margin >= 0.02) return "high";
  if (best.score >= 0.93 && !second) return "high";
  if (best.score >= 0.84) return "medium";
  if (best.score >= 0.78 && reportEntry?.eqtradersName && normalize(best.text) === normalize(reportEntry.eqtradersName)) return "medium";
  return "low";
}

function riskNotes(best: Candidate, alternates: Candidate[], recipe: Recipe, reportEntry?: ReportEntry) {
  const notes: string[] = [];
  if (alternates.length > 1) notes.push(`Other plausible candidates exist; next best is "${alternates[1].text}" at ${alternates[1].score.toFixed(2)}.`);
  if (best.score < 0.98) notes.push("Match is not an exact normalized name match.");
  if (/\(\s*S\s*\|\s*M\s*\|\s*L\s*\)|set$/i.test(recipe.output.name)) notes.push("Original output looks like a generic family/size placeholder.");
  if (reportEntry?.eqtradersName && normalize(best.text) !== normalize(reportEntry.eqtradersName)) notes.push(`EQTraders context name is "${reportEntry.eqtradersName}", not the proposed Allakhazam text.`);
  if (!reportEntry?.eqtradersName) notes.push("No EQTraders context was available for this proposal.");
  return notes;
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[] };
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const eqReport = JSON.parse(await readFile(eqReportPath, "utf8")) as {
  eqContextOnly?: ReportEntry[];
  stillAmbiguous?: ReportEntry[];
  stillUnresolved?: ReportEntry[];
  likelyPlaceholderOrSubcombine?: ReportEntry[];
};
const fuzzyReport = existsSync(fuzzyReportPath)
  ? JSON.parse(await readFile(fuzzyReportPath, "utf8")) as { ambiguous?: ReportEntry[]; unresolved?: ReportEntry[] }
  : {};

const reportEntries = new Map<string, ReportEntry>();
for (const entry of [
  ...(eqReport.eqContextOnly ?? []),
  ...(eqReport.stillAmbiguous ?? []),
  ...(eqReport.stillUnresolved ?? []),
  ...(fuzzyReport.ambiguous ?? []),
  ...(fuzzyReport.unresolved ?? []),
]) {
  reportEntries.set(`${entry.skill}:${entry.name}`, { ...reportEntries.get(`${entry.skill}:${entry.name}`), ...entry });
}

const targets = Array.from(new Map(
  crafting.recipes
    .filter((recipe) => prioritySkills.includes(recipe.skill))
    .filter((recipe) => {
      const key = `${recipe.skill}:${recipe.output.name}`;
      const existing = details[recipe.output.name];
      return reportEntries.has(key) || !existing?.iconPath || !hasDirectZam(existing);
    })
    .map((recipe) => [`${recipe.skill}:${recipe.output.name}`, recipe]),
).values())
  .sort((a, b) => (priorityRank.get(a.skill) ?? 999) - (priorityRank.get(b.skill) ?? 999) || a.output.name.localeCompare(b.output.name));

const review = {
  generatedAt: new Date().toISOString(),
  checked: targets.length,
  checkedBySkill: {} as Record<string, number>,
  autoAppliedHighConfidence: [] as ProposedMatch[],
  proposedMediumConfidence: [] as ProposedMatch[],
  proposedLowConfidence: [] as ProposedMatch[],
  stillUnresolved: [] as Array<Record<string, unknown>>,
};

for (const target of targets) review.checkedBySkill[target.skill] = (review.checkedBySkill[target.skill] ?? 0) + 1;

async function gatherCandidates(recipe: Recipe, reportEntry?: ReportEntry) {
  const candidateMap = new Map<string, Candidate>();
  for (const candidate of reportEntry?.allakhazamCandidates ?? []) {
    const scored = scoreCandidate(candidate.text, candidate.variant || reportEntry?.eqtradersName || recipe.output.name);
    const hydrated = { ...candidate, url: canonicalItemUrl(candidate.url), source: "prior EQTraders fallback report", score: Math.max(candidate.score ?? 0, scored?.score ?? 0), matchReason: scored?.matchReason ?? candidate.matchReason ?? "prior candidate" };
    const old = candidateMap.get(hydrated.url);
    if (!old || hydrated.score > old.score) candidateMap.set(hydrated.url, hydrated);
  }
  const variants = allVariants(recipe, reportEntry);
  for (const variant of variants) {
    const html = await fetchCached(searchUrl(variant), `search:aggressive-crafting:${variant}`);
    for (const candidate of searchCandidates(html, variant, "Allakhazam search")) {
      const old = candidateMap.get(candidate.url);
      if (!old || candidate.score > old.score) candidateMap.set(candidate.url, candidate);
    }
  }
  return { variants, candidates: Array.from(candidateMap.values()).sort((a, b) => b.score - a.score || a.text.localeCompare(b.text)) };
}

for (const recipe of targets) {
  const reportEntry = reportEntries.get(`${recipe.skill}:${recipe.output.name}`);
  try {
    const { variants, candidates } = await gatherCandidates(recipe, reportEntry);
    const best = candidates[0];
    if (!best) {
      review.stillUnresolved.push({
        skill: recipe.skill,
        originalItemName: recipe.output.name,
        variantsTried: variants,
        reason: "No Allakhazam item candidate found even with aggressive variants.",
        eqtradersName: reportEntry?.eqtradersName,
        eqtradersUrl: reportEntry?.eqtradersUrl,
      });
      continue;
    }
    const confidence = confidenceFor(best, candidates, reportEntry);
    const proposal: ProposedMatch = {
      skill: recipe.skill,
      originalItemName: recipe.output.name,
      proposedMatchedName: best.text,
      proposedAllakhazamUrl: best.url,
      confidence,
      score: Number(best.score.toFixed(4)),
      reason: `${best.matchReason} using "${best.variant}" from ${best.source}.`,
      risksNotes: riskNotes(best, candidates, recipe, reportEntry),
      variantsTried: variants,
      candidateSource: best.source,
      eqtradersName: reportEntry?.eqtradersName,
      eqtradersUrl: reportEntry?.eqtradersUrl,
      p99SourceUrl: recipe.sourceUrl ?? null,
      alternateCandidates: candidates.slice(1, 8).map((candidate) => ({ ...candidate, score: Number(candidate.score.toFixed(4)) })),
    };

    if (confidence === "high" && proposal.risksNotes.length === 0) {
      const html = await fetchCached(best.url, `item:${best.url}`);
      const parsed = parseItem(html, best.url);
      const existing = details[recipe.output.name] ?? { name: recipe.output.name };
      const note = `Aggressive crafting review auto-applied high-confidence Allakhazam match "${best.text}" using "${best.variant}" (${best.matchReason}).`;
      details[recipe.output.name] = {
        ...existing,
        name: existing.name ?? recipe.output.name,
        iconPath: existing.iconPath ?? parsed.iconPath ?? recipe.output.imageUrl ?? null,
        stats: { ...parsed.stats, ...(existing.stats ?? {}) },
        resists: { ...parsed.resists, ...(existing.resists ?? {}) },
        sources: mergeSource(existing, "Allakhazam", best.url),
        match_notes: mergeNote(existing, note),
        missing_core_stats: false,
      };
      review.autoAppliedHighConfidence.push(proposal);
    } else if (confidence === "medium") {
      review.proposedMediumConfidence.push(proposal);
    } else if (confidence === "high") {
      review.proposedMediumConfidence.push({ ...proposal, confidence: "medium", risksNotes: [...proposal.risksNotes, "Downgraded from high because a risk note requires human review."] });
    } else {
      review.proposedLowConfidence.push(proposal);
    }
  } catch (error) {
    review.stillUnresolved.push({
      skill: recipe.skill,
      originalItemName: recipe.output.name,
      reason: error instanceof Error ? error.message : String(error),
      eqtradersName: reportEntry?.eqtradersName,
      eqtradersUrl: reportEntry?.eqtradersUrl,
    });
  }
}

await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`);

console.log(`Aggressive checked ${review.checked} crafting enrichment targets.`);
console.log(`Auto-applied high confidence: ${review.autoAppliedHighConfidence.length}`);
console.log(`Medium review proposals: ${review.proposedMediumConfidence.length}`);
console.log(`Low review proposals: ${review.proposedLowConfidence.length}`);
console.log(`Still unresolved: ${review.stillUnresolved.length}`);
console.log(`Wrote ${reviewPath}`);
