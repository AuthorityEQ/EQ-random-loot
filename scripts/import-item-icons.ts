import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExpansionArg = "classic" | "kunark" | "velious";
type ContentTypeArg = "group-named" | "raid" | "crafting" | "epic";

type ItemDetails = {
  name: string;
  sources?: Array<{ name: string; url: string }>;
  iconPath?: string | null;
  expansion?: string;
};

type Mob = {
  loot: string[];
};

type Bucket = {
  mobs: Mob[];
  loot_pool?: string[];
};

type Dataset = {
  buckets: Bucket[];
};

type RaidBoss = {
  name: string;
  loot_pool?: string[];
};

type RaidTier = {
  bosses: RaidBoss[];
};

type RaidDataset = {
  expansion: string;
  tiers: RaidTier[];
};

type CraftingComponent = {
  name: string;
  count: number;
};

type CraftingRecipe = {
  output: { name: string; count: number };
  components: CraftingComponent[];
};

type CraftingDataset = {
  recipes: CraftingRecipe[];
};

type EpicLinkedItem = {
  name: string;
};

type EpicStep = {
  items: string;
  required_items?: EpicLinkedItem[];
  drop_items?: EpicLinkedItem[];
};

type EpicClass = {
  class_name: string;
  weapon_name: string;
  steps: EpicStep[];
};

type EpicDataset = {
  classes: EpicClass[];
};

const CRAFTING_PSEUDO_CATEGORY = /\([^)]*,[^)]*\)/;
const EPIC_VERB_PREFIX = /^(Receive|Hand in|Give|Loot|Buy|Combine|Turn in|Reward):\s*/i;
const EPIC_TRAILING_PAREN = /\s*\([^)]*\)\s*$/;
const EPIC_STOP_WORDS = new Set(["the player", "this step", "unknown", "tba", "tbd"]);

type ImageCandidate = {
  absoluteUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  score: number;
  reasons: string[];
};

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const outputDir = path.join(root, "public", "item-icons");
const userAgent = "FrostreaverLootReference/0.4 (+controlled batch item icon import)";
const exactItemUrlPattern = /^https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=(\d+)(?:$|[&#])/i;

const args = parseArgs(process.argv.slice(2));

if (!args) {
  printUsage();
  process.exit(1);
}

const datasetPath = args.contentType === "raid"
  ? path.join(root, "data", `${args.expansion}-raid.json`)
  : args.contentType === "crafting"
    ? path.join(root, "data", "excel-imports", "crafting-normalized.json")
    : args.contentType === "epic"
      ? path.join(root, "data", "excel-imports", "epic-quests.json")
      : path.join(root, "data", `${args.expansion}-group-named.json`);
const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
const datasetRaw = JSON.parse(await readFile(datasetPath, "utf8")) as Dataset | RaidDataset | CraftingDataset | EpicDataset;
const selectedItemNames = getSelectedItemNames();
const allItemNames = args.contentType === "raid"
  ? getRaidItemNames(datasetRaw as RaidDataset)
  : args.contentType === "crafting"
    ? getCraftingItemNames(datasetRaw as CraftingDataset)
    : args.contentType === "epic"
      ? getEpicItemNames(datasetRaw as EpicDataset)
      : getBatchItemNames(datasetRaw as Dataset);
const itemNames = allItemNames
  .filter((itemName) => selectedItemNames.length === 0 || selectedItemNames.includes(itemName))
  .slice(0, args.limit ?? undefined);
const log = {
  expansion: args.expansion,
  contentType: args.contentType,
  totalCandidates: itemNames.length,
  imported: [] as Array<{ item: string; iconUrl: string; iconPath: string }>,
  skipped: [] as Array<{ item: string; reason: string }>,
  failed: [] as Array<{ item: string; reason: string }>,
};

await mkdir(outputDir, { recursive: true });

for (const itemName of itemNames) {
  const item = details[itemName];

  if (!item) {
    log.skipped.push({ item: itemName, reason: "No item-details entry exists." });
    continue;
  }

  if (item.iconPath) {
    log.skipped.push({ item: itemName, reason: `Already has iconPath: ${item.iconPath}` });
    continue;
  }

  const sourceUrl = item.sources?.find((source) => source.name === "Allakhazam")?.url;
  const itemId = sourceUrl?.match(exactItemUrlPattern)?.[1];

  if (!sourceUrl || !itemId) {
    log.skipped.push({ item: itemName, reason: "No exact Allakhazam /db/item.html?item=ID URL." });
    continue;
  }

  const outputFileName = `${safeFileName(itemName)}-${itemId}.png`;
  const absoluteOutputPath = path.join(outputDir, outputFileName);
  const publicIconPath = `/item-icons/${outputFileName}`;

  if (existsSync(absoluteOutputPath)) {
    item.iconPath = publicIconPath;
    log.skipped.push({ item: itemName, reason: `Icon file already exists; linked existing file ${publicIconPath}.` });
    continue;
  }

  try {
    console.log(`Fetching item page: ${itemName} (${sourceUrl})`);
    const html = await fetchText(sourceUrl, "text/html,application/xhtml+xml");
    const candidates = findImageCandidates(html, sourceUrl, itemName);
    const best = candidates[0];

    if (!best || best.score < 60) {
      log.skipped.push({
        item: itemName,
        reason: best
          ? `No reliable icon candidate. Best score ${best.score}: ${best.absoluteUrl}`
          : "No image candidates found.",
      });
      continue;
    }

    await downloadImage(best.absoluteUrl, absoluteOutputPath);
    item.iconPath = publicIconPath;
    log.imported.push({ item: itemName, iconUrl: best.absoluteUrl, iconPath: publicIconPath });
  } catch (error) {
    log.failed.push({
      item: itemName,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);

const logSuffix = selectedItemNames.length > 0 ? "-selected" : "";
const logPath = path.join(root, "data", `item-icon-import-${args.expansion}-${args.contentType}${logSuffix}.json`);
await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`);

console.log(`Imported ${log.imported.length} icon(s).`);
console.log(`Skipped ${log.skipped.length} item(s).`);
console.log(`Failed ${log.failed.length} item(s).`);
console.log(`Wrote log: ${logPath}`);
console.log(`Bo Stick iconPath: ${details["Bo Stick"]?.iconPath ?? "missing"}`);

function parseArgs(rawArgs: string[]) {
  const [expansion, contentType, maybeLimit] = rawArgs;
  if (!isExpansion(expansion) || !isContentType(contentType)) return null;

  let limit: number | undefined;
  if (maybeLimit !== undefined) {
    const parsedLimit = Number(maybeLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) return null;
    limit = parsedLimit;
  }

  return { expansion, contentType, limit };
}

function printUsage() {
  console.log("Usage: node --experimental-strip-types scripts/import-item-icons.ts <classic|kunark|velious> <group-named|raid|crafting|epic> [limit]");
  console.log("Example: node --experimental-strip-types scripts/import-item-icons.ts classic group-named 10");
  console.log("Example: node --experimental-strip-types scripts/import-item-icons.ts classic raid");
  console.log("Note: for crafting and epic the expansion arg is accepted but ignored (data is not per-expansion).");
}

function isExpansion(value: string | undefined): value is ExpansionArg {
  return value === "classic" || value === "kunark" || value === "velious";
}

function isContentType(value: string | undefined): value is ContentTypeArg {
  return value === "group-named" || value === "raid" || value === "crafting" || value === "epic";
}

function getBatchItemNames(dataset: Dataset) {
  return Array.from(
    new Set(
      dataset.buckets.flatMap((bucket) => bucket.loot_pool ?? bucket.mobs.flatMap((mob) => mob.loot)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function getRaidItemNames(dataset: RaidDataset) {
  return Array.from(
    new Set(
      dataset.tiers.flatMap((tier) => tier.bosses.flatMap((boss) => boss.loot_pool ?? [])),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function getCraftingItemNames(dataset: CraftingDataset) {
  const names = new Set<string>();
  for (const recipe of dataset.recipes) {
    names.add(recipe.output.name);
    for (const component of recipe.components) {
      names.add(component.name);
    }
  }
  return Array.from(names)
    .filter((name) => !CRAFTING_PSEUDO_CATEGORY.test(name))
    .sort((a, b) => a.localeCompare(b));
}

function getEpicItemNames(dataset: EpicDataset) {
  const names = new Set<string>();
  for (const cls of dataset.classes) {
    for (const step of cls.steps) {
      for (const item of step.required_items ?? []) {
        const trimmed = item.name?.trim();
        if (trimmed) names.add(trimmed);
      }
      for (const item of step.drop_items ?? []) {
        const trimmed = item.name?.trim();
        if (trimmed) names.add(trimmed);
      }

      const raw = (step.items ?? "").trim();
      if (!raw) continue;
      const stripped = raw.replace(EPIC_VERB_PREFIX, "").replace(EPIC_TRAILING_PAREN, "");
      const fragments = stripped.split(/ and | & |, /);
      for (const fragment of fragments) {
        const trimmed = fragment.trim();
        if (trimmed.length < 3) continue;
        if (/^[a-z]/.test(trimmed)) continue;
        if (EPIC_STOP_WORDS.has(trimmed.toLowerCase())) continue;
        names.add(trimmed);
      }
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function getSelectedItemNames() {
  return (process.env.ITEM_NAMES ?? "")
    .split("|")
    .map((itemName) => itemName.trim())
    .filter(Boolean);
}

function htmlDecode(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(html: string) {
  return htmlDecode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function readAttr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? htmlDecode(match[1]) : "";
}

function readNumberAttr(tag: string, name: string) {
  const value = readAttr(tag, name);
  return /^\d+$/.test(value) ? Number(value) : null;
}

function absolutize(src: string, baseUrl: string) {
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return new URL(src, baseUrl).toString();
}

function findImageCandidates(html: string, baseUrl: string, itemName: string) {
  const titleIndex = html.toLowerCase().indexOf(itemName.toLowerCase());
  const candidates: ImageCandidate[] = [];

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const index = match.index ?? 0;
    const src = readAttr(tag, "src");
    if (!src) continue;

    const nearbyStart = Math.max(0, index - 1200);
    const nearbyEnd = Math.min(html.length, index + 1200);
    const candidate = {
      absoluteUrl: absolutize(src, baseUrl),
      alt: readAttr(tag, "alt"),
      width: readNumberAttr(tag, "width"),
      height: readNumberAttr(tag, "height"),
      nearbyText: stripTags(html.slice(nearbyStart, nearbyEnd)).slice(0, 240),
    };
    const scored = scoreCandidate(candidate, itemName);
    const distanceFromTitle = titleIndex >= 0 ? Math.abs(index - titleIndex) : Number.POSITIVE_INFINITY;

    candidates.push({
      absoluteUrl: candidate.absoluteUrl,
      alt: candidate.alt,
      width: candidate.width,
      height: candidate.height,
      score: scored.score + (distanceFromTitle < 1800 ? 15 : 0),
      reasons: distanceFromTitle < 1800 ? [...scored.reasons, "near title in document"] : scored.reasons,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreCandidate(
  candidate: { absoluteUrl: string; alt: string; width: number | null; height: number | null; nearbyText: string },
  itemName: string,
) {
  let score = 0;
  const reasons: string[] = [];
  const url = candidate.absoluteUrl.toLowerCase();
  const nearbyText = candidate.nearbyText.toLowerCase();
  const alt = candidate.alt.toLowerCase();
  const smallDimensions = candidate.width !== null
    && candidate.height !== null
    && candidate.width <= 80
    && candidate.height <= 80;

  if (smallDimensions) {
    score += 35;
    reasons.push(`small dimensions ${candidate.width}x${candidate.height}`);
  }

  if (/\/pgfx\/item_\d+\.png$/i.test(url)) {
    score += 75;
    reasons.push("Allakhazam pgfx item icon asset");
  } else if (/\/(icons?|items?|itemicons?)\//i.test(url) || /item.*\.(gif|png|jpg|webp)$/i.test(url)) {
    score += 20;
    reasons.push("URL loosely looks like an item/icon asset");
  }

  if (nearbyText.includes(itemName.toLowerCase()) || alt.includes(itemName.toLowerCase())) {
    score += 20;
    reasons.push("near item name/title");
  }

  if (candidate.width !== null && candidate.height !== null && candidate.width > 120 && candidate.height > 120) {
    score -= 45;
    reasons.push("large image, likely screenshot or ad");
  }

  if (/quantserve|scorecardresearch|pixel|\/equipment\/|original\.gif|kunark|velious|logo|banner|ad|avatar|screenshot|mediabox|star|button|facebook|twitter|youtube|rss\.gif|helpdoc/i.test(url)) {
    score -= 60;
    reasons.push("URL looks like expansion badge/site chrome/ad/social asset");
  }

  if (candidate.width !== null && candidate.height !== null && candidate.width <= 2 && candidate.height <= 2) {
    score -= 80;
    reasons.push("tracking pixel dimensions");
  }

  if (/screenshot|posted|rating|comment|advert/i.test(nearbyText)) {
    score -= 25;
    reasons.push("near comments/ad/screenshot text");
  }

  return { score, reasons };
}

async function fetchText(url: string, accept: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
}

async function downloadImage(url: string, outputPath: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "image/png,image/gif,image/jpeg,image/webp,*/*",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching image ${url}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Candidate did not return an image content-type: ${contentType}`);
  }

  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}
