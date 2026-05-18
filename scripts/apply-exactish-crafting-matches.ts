import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type Recipe = {
  skill: string;
  name: string;
  expansion?: string | null;
  output: { name: string; imageUrl?: string | null };
  sourceUrl?: string | null;
  sourceMetadata?: Record<string, unknown>;
};

type ItemDetails = Record<string, unknown> & {
  iconPath?: string | null;
  stats?: Record<string, number | string>;
  resists?: Record<string, number | string>;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
};

type Candidate = {
  url: string;
  text: string;
  variant: string;
  source: string;
  score: number;
  matchReason: string;
};

type Proposal = {
  skill: string;
  originalItemName: string;
  proposedMatchedName: string;
  proposedAllakhazamUrl: string;
  confidence: string;
  score: number;
  reason: string;
  risksNotes?: string[];
  eqtradersName?: string;
  eqtradersUrl?: string;
  p99SourceUrl?: string | null;
  alternateCandidates?: Candidate[];
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reviewPath = path.join(root, "data", "crafting-aggressive-match-review.json");
const reportPath = path.join(root, "data", "crafting-exactish-match-apply-report.json");
const cacheDir = path.join(root, "cache", "zam-pages");
const earlyExpansions = new Set(["Classic", "Ruins of Kunark", "Scars of Velious", "Shadows of Luclin"]);

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

function compact(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

function canonicalItemUrl(url: string) {
  const href = url.startsWith("http") ? url : `https://everquest.allakhazam.com${url.startsWith("/") ? "" : "/"}${url}`;
  return href.replace(/&amp;/g, "&").match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? href;
}

async function fetchCached(url: string, label: string) {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${slug(label)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");
  const response = await fetch(url, { headers: { "user-agent": "FrostreaverLootReference/0.2 (+local exact-ish crafting match applier)", accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
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

function parseItem(html: string) {
  const itemBlock = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlock);
  const iconRaw = html.match(/<img[^>]+class=["'][^"']*\bitemicon\b[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bitemicon\b/i)?.[1]
    ?? null;
  const iconPath = iconRaw?.startsWith("//") ? `https:${iconRaw}` : iconRaw;
  const { stats, resists } = parseStats(text);
  return { iconPath, stats, resists };
}

function mergeSource(details: ItemDetails, name: string, url: string) {
  const sources = details.sources ?? [];
  return sources.some((source) => source.url === url) ? sources : [...sources, { name, url }];
}

function mergeNote(details: ItemDetails, note: string) {
  const notes = details.match_notes ?? [];
  return notes.includes(note) ? notes : [...notes, note];
}

function cleanedOriginalName(name: string) {
  return name.replace(/\s*\(\s*S\s*\|\s*M\s*\|\s*L\s*\)\s*/gi, "").replace(/\s+/g, " ").trim();
}

function exactishCandidateCount(proposal: Proposal) {
  return 1 + (proposal.alternateCandidates ?? []).filter((candidate) => candidate.score >= 0.98).length;
}

function findRecipe(recipes: Recipe[], proposal: Proposal) {
  const cleaned = cleanedOriginalName(proposal.originalItemName);
  return recipes.find((recipe) => recipe.skill === proposal.skill && recipe.output.name === proposal.originalItemName)
    ?? recipes.find((recipe) => recipe.skill === proposal.skill && recipe.output.name === cleaned)
    ?? null;
}

function skipReason(proposal: Proposal, recipe: Recipe | null) {
  const exactCount = exactishCandidateCount(proposal);
  if (proposal.confidence !== "medium") return "Only medium-confidence ambiguous proposals are in scope.";
  if (proposal.score < 0.98) return "Name score is below exact-ish threshold.";
  if (exactCount < 2 || exactCount > 3) return `Expected 2-3 exact-ish candidates; found ${exactCount}.`;
  if (!recipe) return "No current P99 recipe was found for this proposal.";
  if (recipe.sourceMetadata?.postLuclin === true || (recipe.expansion && !earlyExpansions.has(recipe.expansion))) return "Recipe is post-Luclin or not in the early-era set.";
  if (/\[[^\]]+\]/.test(proposal.proposedMatchedName)) return "Proposed Allakhazam match is variant-specific.";
  if (/\(\s*S\s*\|\s*M\s*\|\s*L\s*\)/i.test(proposal.originalItemName)) return "Original proposal refers to a raw Smithing size shorthand placeholder.";
  if (/unfired idol/i.test(proposal.originalItemName)) return "Generic pottery intermediate, not a finished item match.";
  const original = recipe.output.name || cleanedOriginalName(proposal.originalItemName);
  if (normalize(original) !== normalize(proposal.proposedMatchedName) && compact(original) !== compact(proposal.proposedMatchedName)) {
    return "Proposed name is not an exact or punctuation-only normalized match to the current recipe output.";
  }
  if (!proposal.p99SourceUrl && !proposal.eqtradersUrl && !recipe.sourceUrl) return "No P99 or EQTraders context source is available.";
  return "";
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[] };
const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const review = JSON.parse(await readFile(reviewPath, "utf8")) as { proposedMediumConfidence: Proposal[] };

const exactish = review.proposedMediumConfidence
  .filter((proposal) => proposal.score >= 0.98)
  .filter((proposal) => {
    const count = exactishCandidateCount(proposal);
    return count >= 2 && count <= 3;
  });

const report = {
  sourceReview: reviewPath,
  checked: exactish.length,
  applied: [] as Array<Record<string, unknown>>,
  skipped: [] as Array<Record<string, unknown>>,
};

for (const proposal of exactish) {
  const recipe = findRecipe(crafting.recipes, proposal);
  const reason = skipReason(proposal, recipe);
  if (reason) {
    report.skipped.push({
      skill: proposal.skill,
      originalItemName: proposal.originalItemName,
      proposedMatchedName: proposal.proposedMatchedName,
      proposedAllakhazamUrl: proposal.proposedAllakhazamUrl,
      exactishCandidateCount: exactishCandidateCount(proposal),
      reason,
    });
    continue;
  }

  try {
    const targetName = recipe!.output.name;
    const url = canonicalItemUrl(proposal.proposedAllakhazamUrl);
    const html = await fetchCached(url, `item:${url}`);
    const parsed = parseItem(html);
    const existing = details[targetName] ?? { name: targetName };
    const note = `Applied exact-ish ambiguous crafting match "${proposal.proposedMatchedName}" from Allakhazam after review; ${exactishCandidateCount(proposal)} exact-ish candidates existed, P99/EQ context kept recipe data unchanged.`;
    details[targetName] = {
      ...existing,
      name: existing.name ?? targetName,
      iconPath: existing.iconPath ?? parsed.iconPath ?? recipe!.output.imageUrl ?? null,
      stats: { ...parsed.stats, ...(existing.stats ?? {}) },
      resists: { ...parsed.resists, ...(existing.resists ?? {}) },
      sources: mergeSource(existing, "Allakhazam", url),
      match_notes: mergeNote(existing, note),
      missing_core_stats: false,
    };
    report.applied.push({
      skill: proposal.skill,
      originalItemName: proposal.originalItemName,
      targetItemName: targetName,
      proposedMatchedName: proposal.proposedMatchedName,
      allakhazamUrl: url,
      exactishCandidateCount: exactishCandidateCount(proposal),
      addedIcon: Boolean(!existing.iconPath && parsed.iconPath),
      preservedRecipeSource: recipe!.sourceUrl ?? null,
    });
  } catch (error) {
    report.skipped.push({
      skill: proposal.skill,
      originalItemName: proposal.originalItemName,
      proposedMatchedName: proposal.proposedMatchedName,
      proposedAllakhazamUrl: proposal.proposedAllakhazamUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Checked ${report.checked} exact-ish ambiguous proposals.`);
console.log(`Applied ${report.applied.length}.`);
console.log(`Skipped ${report.skipped.length}.`);
console.log(`Wrote ${reportPath}`);
