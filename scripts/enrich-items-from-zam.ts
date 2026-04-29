import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type MatchConfidence = "exact_match" | "possible_match" | "needs_review" | "not_found";

type Source = {
  name: "Allakhazam";
  url: string;
};

type QualityFlags = {
  missing_core_stats: boolean;
  duplicate_name_risk: boolean;
  parsing_warnings: string[];
  match_confidence: MatchConfidence;
};

type ItemDetails = {
  name: string;
  slot: string | null;
  ac: number | null;
  damage: number | null;
  delay: number | null;
  skill?: string | null;
  damage_bonus?: number | null;
  stats: Record<string, number | string>;
  resists: Record<string, number | string>;
  hp_regen?: number | null;
  mana_regen?: number | null;
  endurance_regen?: number | null;
  haste: string | null;
  charges?: number | string | null;
  worn_effects: string[];
  focus_effects: string[];
  click_effects: string[];
  proc_effects: string[];
  required_level: number | null;
  recommended_level: number | null;
  classes: string[];
  races: string[];
  weight: number | null;
  size: string | null;
  item_type?: string | null;
  stackable?: boolean | null;
  weight_reduction?: string | null;
  capacity?: number | null;
  size_capacity?: string | null;
  lore: boolean | null;
  magic: boolean | null;
  no_drop: boolean | null;
  prestige: boolean | null;
  aug_slots: string[];
  iconPath?: string | null;
  sources: Source[];
  confidence: MatchConfidence;
  match_confidence: MatchConfidence;
  match_notes: string[];
  missing_core_stats: boolean;
  duplicate_name_risk: boolean;
  parsing_warnings: string[];
  expansion: string;
};

type ErrorLog = {
  item: string;
  stage: "search" | "fetch" | "parse";
  message: string;
  url?: string;
};

type ReviewEntry = {
  item: string;
  reason: string;
  url?: string;
};

type ReviewOutput = {
  exact_match_clean: ReviewEntry[];
  needs_review: ReviewEntry[];
  not_found: ReviewEntry[];
  missing_stats: ReviewEntry[];
  duplicate_name_risk: ReviewEntry[];
};

type SearchCandidate = {
  url: string;
  text: string;
  exactName: boolean;
};

type ItemCandidate = SearchCandidate & {
  html: string;
  expansion: string | null;
  requiredLevel: number | null;
  recommendedLevel: number | null;
};

const root = process.cwd();
const namesPath = path.join(root, "data", "item-names.json");
const detailsPath = path.join(root, "data", "item-details.json");
const errorsPath = path.join(root, process.env.ERRORS_PATH ?? path.join("data", "item-enrichment-errors.json"));
const reviewPath = path.join(root, process.env.REVIEW_PATH ?? path.join("data", "item-enrichment-review.json"));
const cacheDir = path.join(root, "cache", "zam-pages");
const userAgent = "FrostreaverLootReference/0.2 (+local enrichment review; contact: local)";
const requestDelayMs = Number(process.env.ZAM_REQUEST_DELAY_MS ?? 1500);
const maxItems = Number(process.env.MAX_ITEMS ?? process.argv.find((arg) => arg.startsWith("--max-items="))?.split("=")[1] ?? 0);
const force = process.env.FORCE_REENRICH === "1" || process.argv.includes("--force");
const resolveBySearch = process.env.RESOLVE_BY_SEARCH === "1";
const onlyItems = (process.env.ITEM_NAMES ?? "")
  .split("|")
  .map((item) => item.trim())
  .filter(Boolean);
const itemNamesFile = process.env.ITEM_NAMES_FILE;
const removeItems = (process.env.REMOVE_ITEM_NAMES ?? "")
  .split("|")
  .map((item) => item.trim())
  .filter(Boolean);
const targetExpansion = process.env.TARGET_EXPANSION ?? "Classic";
const acceptedEraExpansions = (process.env.ACCEPTED_ZAM_EXPANSIONS ?? "Original|Ruins of Kunark|Scars of Velious")
  .split("|")
  .map((expansion) => normalizeName(expansion))
  .filter(Boolean);

const primaryStatKeys = new Set(["str", "sta", "agi", "dex", "wis", "int", "cha"]);
const otherStatMap = new Map([
  ["hp", "HP"],
  ["mana", "MANA"],
  ["end", "END"],
  ["endur", "END"],
  ["endurance", "END"],
]);
const resistMap = new Map([
  ["mr", "MR"],
  ["fr", "FR"],
  ["cr", "CR"],
  ["dr", "DR"],
  ["pr", "PR"],
  ["sv magic", "MR"],
  ["sv fire", "FR"],
  ["sv cold", "CR"],
  ["sv disease", "DR"],
  ["sv poison", "PR"],
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeComparableItemName(value: string) {
  return normalizeName(value.replace(/\s*\[[^\]]+\]\s*$/g, "").replace(/['`’]/g, ""));
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

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

async function fetchCached(url: string, label: string) {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${slug(label)}.html`);

  if (existsSync(filePath)) {
    return readFile(filePath, "utf8");
  }

  await sleep(requestDelayMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

function searchUrl(itemName: string) {
  return `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(itemName)}`;
}

function isExactItemUrl(url: string | undefined) {
  return Boolean(url && /^https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+(?:$|[&#])/i.test(url));
}

function canonicalItemUrl(url: string) {
  const match = url.match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i);
  return match?.[1] ?? url;
}

function readNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function readString(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function readCharges(text: string) {
  const value = readString(/\bCharges:\s*([^\n]+)/i, text);
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function readList(pattern: RegExp, text: string) {
  const value = readString(pattern, text);
  if (!value) return [];
  return value
    .split(/[,/ ]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readTableValue(label: string, html: string) {
  const pattern = new RegExp(`<tr><th[^>]*>[\\s\\S]*?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?<\\/th><td[^>]*>([\\s\\S]*?)<\\/td><\\/tr>`, "i");
  const match = html.match(pattern);
  return match ? stripTags(match[1]).replace(/\s+/g, " ").trim() : null;
}

function extractExpansion(html: string) {
  const expansionHtml = html.match(/<strong>\s*Expansion:\s*<\/strong>([\s\S]*?)<br/i)?.[1];
  if (!expansionHtml) return null;
  const alt = expansionHtml.match(/alt=["']([^"']+)["']/i)?.[1];
  return (alt ?? stripTags(expansionHtml)).replace(/\s+/g, " ").trim() || null;
}

function getSearchCandidates(searchHtml: string, itemName: string) {
  const candidates = new Map<string, SearchCandidate>();

  for (const match of searchHtml.matchAll(/href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].startsWith("http")
      ? match[1]
      : `https://everquest.allakhazam.com${match[1].startsWith("/") ? "" : "/"}${match[1]}`;
    const url = href.replace(/&amp;/g, "&");
    const text = stripTags(match[2]);
    const existing = candidates.get(url);
    const exactName = normalizeName(text) === normalizeName(itemName);

    if (!existing || (text.length > existing.text.length) || (exactName && !existing.exactName)) {
      candidates.set(url, { url, text, exactName });
    }
  }

  return Array.from(candidates.values());
}

function parseStatBlock(text: string) {
  const stats: Record<string, number | string> = {};
  const resists: Record<string, number | string> = {};
  const statPattern = /\b(STR|STA|AGI|DEX|WIS|INT|CHA|HP|MANA|END|ENDUR|ENDURANCE|MR|FR|CR|DR|PR|SV FIRE|SV COLD|SV MAGIC|SV POISON|SV DISEASE)\s*:?\s*([+-]?\d+%?)\b/gi;

  for (const match of text.matchAll(statPattern)) {
    const rawKey = match[1].toLowerCase();
    const value = match[2].includes("%") ? match[2] : Number(match[2]);

    if (primaryStatKeys.has(rawKey)) {
      stats[rawKey.toUpperCase()] = value;
      continue;
    }

    const otherKey = otherStatMap.get(rawKey);
    if (otherKey) {
      stats[otherKey] = value;
      continue;
    }

    const resistKey = resistMap.get(rawKey);
    if (resistKey) {
      resists[resistKey] = value;
    }
  }

  return { stats, resists };
}

function readRegen(label: "HP" | "Mana" | "Endurance", text: string) {
  return readNumber(new RegExp(`\\b${label}\\s+Regen\\s*:?\\s*([+-]?\\d+)`, "i"), text);
}

function readEffects(label: string, text: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}:\\s*([^\\n]+)`, "gi");
  return Array.from(
    new Set(
      Array.from(text.matchAll(pattern))
        .map((match) => match[1].replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  );
}

function hasAnyCoreStats(item: Pick<ItemDetails, "slot" | "ac" | "damage" | "delay" | "stats" | "resists" | "haste" | "worn_effects" | "focus_effects" | "click_effects" | "proc_effects" | "classes" | "races" | "weight" | "size" | "item_type" | "weight_reduction" | "capacity" | "size_capacity">) {
  return Boolean(
    item.slot
      || item.ac !== null
      || item.damage !== null
      || item.delay !== null
      || Object.keys(item.stats).length
      || Object.keys(item.resists).length
      || item.haste
      || item.worn_effects.length
      || item.focus_effects.length
      || item.click_effects.length
      || item.proc_effects.length
      || item.classes.length
      || item.races.length
      || item.weight !== null
      || item.size
      || item.item_type
      || item.weight_reduction
      || item.capacity !== null
      || item.size_capacity,
  );
}

function isAcceptedEra(expansion: string | null) {
  return expansion ? acceptedEraExpansions.includes(normalizeName(expansion)) : false;
}

function makeQualityFlags(
  item: Omit<ItemDetails, keyof QualityFlags | "confidence" | "match_notes">,
  matchConfidence: MatchConfidence,
  duplicateNameRisk: boolean,
  warnings: string[],
) {
  return {
    missing_core_stats: !hasAnyCoreStats(item),
    duplicate_name_risk: duplicateNameRisk,
    parsing_warnings: warnings,
    match_confidence: matchConfidence,
  };
}

function parseItemPage(
  html: string,
  itemName: string,
  url: string,
  duplicateNameRisk: boolean,
  matchNotes: string[],
  matchConfidence: MatchConfidence,
): ItemDetails {
  const pageText = stripTags(html);
  const itemBlockHtml = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlockHtml);
  const warnings: string[] = [];

  if (itemBlockHtml === html) {
    warnings.push("Could not isolate the ZAM item stat block; parsed the full page.");
  }

  const titleName = readString(/<meta property=["']og:title["'] content=["']([^"']+)["']/i, html)
    ?? readString(/^\s*([^\n]+?)\s*-\s*Project 1999/i, pageText)
    ?? itemName;
  const parsedName = titleName.replace(/^Item\s*:\s*/i, "").trim();
  const { stats, resists } = parseStatBlock(text);
  const haste = readString(/\bHaste:\s*([+-]?\d+%)/i, text) ?? readString(/\b(\d+%)\s*Haste\b/i, text);
  const baseItem = {
    name: parsedName || itemName,
    slot: readString(/\bSlot:\s*([^\n]+)/i, text),
    ac: readNumber(/\bAC:\s*(\d+)/i, text),
    damage: readNumber(/\b(?:DMG|Damage):\s*(\d+)/i, text),
    delay: readNumber(/\bDelay:\s*(\d+)/i, text),
    skill: readString(/\bSkill:\s*([^\n]*?)(?:\s+Atk Delay:|$)/i, text),
    damage_bonus: readNumber(/\b(?:Dmg Bon|Damage Bonus):\s*(\d+)/i, text),
    stats,
    resists,
    hp_regen: readRegen("HP", text),
    mana_regen: readRegen("Mana", text),
    endurance_regen: readRegen("Endurance", text),
    haste,
    charges: readCharges(text),
    worn_effects: readEffects("Worn", text),
    focus_effects: readEffects("Focus", text),
    click_effects: readEffects("Effect", text).filter((effect) => /click|casting time|must equip|can equip/i.test(effect)),
    proc_effects: Array.from(new Set(readEffects("Combat Effects", text).concat(readEffects("Proc", text)))),
    required_level: readNumber(/\bRequired level(?: of)?:\s*(\d+)/i, text),
    recommended_level: readNumber(/\bRecommended level(?: of)?:\s*(\d+)/i, text),
    classes: readList(/\bClass(?:es)?:\s*([^\n]+)/i, text),
    races: readList(/\bRace(?:s)?:\s*([^\n]+)/i, text),
    weight: readNumber(/\bWT:\s*(\d+(?:\.\d+)?)/i, text),
    size: readString(/\bSize:\s*([^\n]+)/i, text),
    item_type: readTableValue("Item Type", html),
    stackable: (() => {
      const value = readTableValue("Stackable", html);
      return value ? /^yes$/i.test(value) : null;
    })(),
    weight_reduction: readString(/\bWeight Reduction:\s*([+-]?\d+%)/i, text),
    capacity: readNumber(/\bCapacity:\s*(\d+)/i, text),
    size_capacity: readString(/\bSize Capacity:\s*([^\n]+)/i, text),
    lore: /\bLORE ITEM\b/i.test(text) ? true : null,
    magic: /\bMAGIC ITEM\b/i.test(text) ? true : null,
    no_drop: /\bNO DROP\b/i.test(text) ? true : null,
    prestige: /\bPRESTIGE\b/i.test(text) ? true : null,
    aug_slots: [],
    iconPath: null,
    sources: [{ name: "Allakhazam" as const, url }],
    expansion: targetExpansion,
  };
  const qualityFlags = makeQualityFlags(baseItem, matchConfidence, duplicateNameRisk, warnings);
  const finalConfidence: MatchConfidence = qualityFlags.missing_core_stats || duplicateNameRisk || warnings.length || matchConfidence !== "exact_match"
    ? matchConfidence === "not_found" ? "not_found" : "needs_review"
    : "exact_match";

  return {
    ...baseItem,
    confidence: finalConfidence,
    match_notes: matchNotes,
    ...qualityFlags,
    match_confidence: finalConfidence,
  };
}

function notFoundItem(itemName: string, notes: string[]): ItemDetails {
  const baseItem = {
    name: itemName,
    slot: null,
    ac: null,
    damage: null,
    delay: null,
    skill: null,
    damage_bonus: null,
    stats: {},
    resists: {},
    hp_regen: null,
    mana_regen: null,
    endurance_regen: null,
    haste: null,
    charges: null,
    worn_effects: [],
    focus_effects: [],
    click_effects: [],
    proc_effects: [],
    required_level: null,
    recommended_level: null,
    classes: [],
    races: [],
    weight: null,
    size: null,
    item_type: null,
    stackable: null,
    weight_reduction: null,
    capacity: null,
    size_capacity: null,
    lore: null,
    magic: null,
    no_drop: null,
    prestige: null,
    aug_slots: [],
    iconPath: null,
    sources: [{ name: "Allakhazam" as const, url: searchUrl(itemName) }],
    expansion: targetExpansion,
  };
  const qualityFlags = makeQualityFlags(baseItem, "not_found", false, []);

  return {
    ...baseItem,
    confidence: "not_found",
    match_notes: notes,
    ...qualityFlags,
  };
}

function isCompleteSchema(item: ItemDetails | undefined) {
  return Boolean(
    item
      && Array.isArray(item.match_notes)
      && typeof item.missing_core_stats === "boolean"
      && typeof item.duplicate_name_risk === "boolean"
      && Array.isArray(item.parsing_warnings)
      && typeof item.match_confidence === "string",
  );
}

function hasParserCoverageSchema(item: ItemDetails | undefined) {
  return Boolean(
    item
      && "hp_regen" in item
      && "mana_regen" in item
      && "endurance_regen" in item
      && "item_type" in item
      && "stackable" in item
      && "weight_reduction" in item
      && "capacity" in item
      && "size_capacity" in item,
  );
}

function candidateScore(candidate: ItemCandidate) {
  let score = 0;
  if (candidate.exactName) score += 100;
  if (isAcceptedEra(candidate.expansion)) score += 50;
  if (candidate.requiredLevel === null || candidate.requiredLevel <= 60) score += 10;
  if (candidate.recommendedLevel === null || candidate.recommendedLevel <= 60) score += 5;
  return score;
}

async function inspectCandidates(searchHtml: string, itemName: string) {
  const searchCandidates = getSearchCandidates(searchHtml, itemName);
  const exactCandidates = searchCandidates.filter((candidate) => candidate.exactName);
  const candidatesToCheck = exactCandidates.length > 0 ? exactCandidates : searchCandidates.slice(0, 3);
  const inspected: ItemCandidate[] = [];
  const errors: ErrorLog[] = [];

  for (const candidate of candidatesToCheck) {
    try {
      const html = await fetchCached(candidate.url, `item:${candidate.url}`);
      const text = stripTags(html);
      inspected.push({
        ...candidate,
        html,
        expansion: extractExpansion(html),
        requiredLevel: readNumber(/\bRequired level(?: of)?:\s*(\d+)/i, text),
        recommendedLevel: readNumber(/\bRecommended level(?: of)?:\s*(\d+)/i, text),
      });
    } catch (error) {
      errors.push({
        item: itemName,
        stage: "fetch",
        message: error instanceof Error ? error.message : String(error),
        url: candidate.url,
      });
    }
  }

  return { searchCandidates, inspected, errors };
}

function chooseCandidate(itemName: string, candidates: ItemCandidate[]) {
  const exactCandidates = candidates.filter((candidate) => candidate.exactName);
  const exactEraCandidates = exactCandidates.filter((candidate) => isAcceptedEra(candidate.expansion));
  const duplicateNameRisk = exactCandidates.length > 1;
  const matchNotes: string[] = [];

  if (duplicateNameRisk) {
    matchNotes.push(`Multiple exact-name ZAM item pages found: ${exactCandidates.map((candidate) => `${candidate.url}${candidate.expansion ? ` (${candidate.expansion})` : ""}`).join("; ")}`);
  }

  let selected: ItemCandidate | null = null;
  let confidence: MatchConfidence = "not_found";

  if (exactEraCandidates.length === 1) {
    selected = exactEraCandidates[0];
    confidence = duplicateNameRisk ? "needs_review" : "exact_match";
    matchNotes.push(`Selected the exact-name candidate tagged as Expansion: ${selected.expansion}.`);
  } else if (exactEraCandidates.length > 1) {
    selected = exactEraCandidates.sort((a, b) => candidateScore(b) - candidateScore(a))[0];
    confidence = "needs_review";
    matchNotes.push("Multiple exact-name accepted-era candidates exist; selected the highest-scoring candidate and flagged for review.");
  } else if (exactCandidates.length === 1) {
    selected = exactCandidates[0];
    confidence = isAcceptedEra(selected.expansion) ? "exact_match" : "needs_review";
    matchNotes.push(selected.expansion ? `Exact-name candidate is tagged as Expansion: ${selected.expansion}.` : "Exact-name candidate has no parsed expansion tag.");
    if ((selected.requiredLevel !== null && selected.requiredLevel > 60) || (selected.recommendedLevel !== null && selected.recommendedLevel > 60)) {
      confidence = "needs_review";
      matchNotes.push("Candidate has required/recommended level above 60, which is suspicious for Classic Group Named.");
    }
  } else if (candidates.length > 0) {
    selected = candidates.sort((a, b) => candidateScore(b) - candidateScore(a))[0];
    confidence = "possible_match";
    matchNotes.push(`No exact-name ZAM candidate found for "${itemName}"; selected the highest-scoring possible match.`);
  }

  return { selected, confidence, duplicateNameRisk, matchNotes };
}

function buildReview(details: Record<string, ItemDetails>): ReviewOutput {
  const review: ReviewOutput = {
    exact_match_clean: [],
    needs_review: [],
    not_found: [],
    missing_stats: [],
    duplicate_name_risk: [],
  };

  for (const [itemName, item] of Object.entries(details).sort(([a], [b]) => a.localeCompare(b))) {
    const url = item.sources[0]?.url;
    const reason = item.match_notes.join(" ") || item.match_confidence;
    if (item.match_confidence === "exact_match" && !item.missing_core_stats && !item.duplicate_name_risk && item.parsing_warnings.length === 0) {
      review.exact_match_clean.push({ item: itemName, reason: "Exact name, Original-era candidate, parsed without quality flags.", url });
    }
    if (item.match_confidence === "needs_review" || item.confidence === "needs_review") {
      review.needs_review.push({ item: itemName, reason, url });
    }
    if (item.match_confidence === "not_found") {
      review.not_found.push({ item: itemName, reason, url });
    }
    if (item.missing_core_stats) {
      review.missing_stats.push({ item: itemName, reason: "No slot, combat stats, attributes, resists, effects, classes, or races were parsed.", url });
    }
    if (item.duplicate_name_risk) {
      review.duplicate_name_risk.push({ item: itemName, reason, url });
    }
  }

  return review;
}

await mkdir(path.dirname(detailsPath), { recursive: true });
await mkdir(cacheDir, { recursive: true });

const itemNames = JSON.parse(await readFile(itemNamesFile ? path.join(root, itemNamesFile) : namesPath, "utf8")) as string[];
const baseNames = onlyItems.length > 0 ? onlyItems : itemNames;
const selectedNames = maxItems > 0 ? baseNames.slice(0, maxItems) : baseNames;
const existing = existsSync(detailsPath)
  ? (JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>)
  : {};
const errors: ErrorLog[] = [];
const details: Record<string, ItemDetails> = { ...existing };

for (const [index, itemName] of selectedNames.entries()) {
  try {
    if (!force && isCompleteSchema(details[itemName]) && hasParserCoverageSchema(details[itemName])) {
      console.log(`[${index + 1}/${selectedNames.length}] Skipping processed item: ${itemName}`);
      continue;
    }

    const existingUrl = details[itemName]?.sources?.find((source) => source.name === "Allakhazam")?.url;

    if (existingUrl && isExactItemUrl(existingUrl) && !resolveBySearch) {
      const exactUrl = canonicalItemUrl(existingUrl);
      console.log(`[${index + 1}/${selectedNames.length}] Fetching exact item page ${exactUrl}`);
      const exactHtml = await fetchCached(exactUrl, `item:${exactUrl}`);
      const exactText = stripTags(exactHtml);
      const parsedTitle = readString(/<meta property=["']og:title["'] content=["']([^"']+)["']/i, exactHtml)?.replace(/^Item\s*:\s*/i, "").trim();
      const exactName = parsedTitle ? normalizeComparableItemName(parsedTitle) === normalizeComparableItemName(itemName) : true;
      const expansion = extractExpansion(exactHtml);
      const matchNotes = [
        `Reprocessed exact Allakhazam item URL: ${exactUrl}.`,
        expansion ? `Exact URL page is tagged as Expansion: ${expansion}.` : "Exact URL page has no parsed expansion tag.",
      ];
      const confidence: MatchConfidence = exactName ? "exact_match" : "needs_review";
      if (!exactName && parsedTitle) {
        matchNotes.push(`Exact URL title "${parsedTitle}" does not match requested item name "${itemName}".`);
      }
      const parsed = parseItemPage(exactHtml, itemName, exactUrl, details[itemName]?.duplicate_name_risk ?? false, matchNotes, confidence);
      parsed.name = details[itemName]?.name ?? itemName;
      parsed.iconPath = details[itemName]?.iconPath ?? parsed.iconPath ?? null;
      parsed.expansion = details[itemName]?.expansion ?? targetExpansion;

      if (details[itemName]?.confidence === "exact_match" && parsed.confidence !== "not_found") {
        parsed.confidence = exactName ? "exact_match" : "needs_review";
        parsed.match_confidence = parsed.confidence;
        parsed.missing_core_stats = false;
        parsed.duplicate_name_risk = details[itemName]?.duplicate_name_risk ?? false;
      }

      details[itemName] = parsed;
      continue;
    }

    if (existingUrl && !isExactItemUrl(existingUrl)) {
      console.log(`[${index + 1}/${selectedNames.length}] Stored Allakhazam URL is not an exact item page; resolving by search: ${itemName}`);
    }

    console.log(`[${index + 1}/${selectedNames.length}] Searching ${itemName}`);
    const searchHtml = await fetchCached(searchUrl(itemName), `search:${itemName}`);
    const { searchCandidates, inspected, errors: candidateErrors } = await inspectCandidates(searchHtml, itemName);
    errors.push(...candidateErrors);

    if (searchCandidates.length === 0 || inspected.length === 0) {
      details[itemName] = notFoundItem(itemName, ["No Allakhazam item page candidate was found in search results."]);
      continue;
    }

    const { selected, confidence, duplicateNameRisk, matchNotes } = chooseCandidate(itemName, inspected);

    if (!selected) {
      details[itemName] = notFoundItem(itemName, ["Allakhazam candidates were found, but none could be selected safely."]);
      continue;
    }

    console.log(`[${index + 1}/${selectedNames.length}] Selected ${selected.url}`);
    const parsed = parseItemPage(selected.html, itemName, selected.url, duplicateNameRisk, matchNotes, confidence);
    parsed.expansion = details[itemName]?.expansion ?? targetExpansion;
    details[itemName] = parsed;
  } catch (error) {
    errors.push({
      item: itemName,
      stage: "parse",
      message: error instanceof Error ? error.message : String(error),
    });
    details[itemName] = notFoundItem(itemName, ["Enrichment failed; see item-enrichment-errors.json."]);
  }
}

for (const itemName of removeItems) {
  delete details[itemName];
}

const finalReview = buildReview(details);

await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(errorsPath, `${JSON.stringify(errors, null, 2)}\n`);
await writeFile(reviewPath, `${JSON.stringify(finalReview, null, 2)}\n`);

console.log(`Wrote ${Object.keys(details).length} item detail records to ${detailsPath}`);
console.log(`Logged ${errors.length} failures to ${errorsPath}`);
console.log(`Wrote review summary to ${reviewPath}`);
