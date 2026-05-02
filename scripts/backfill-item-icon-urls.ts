import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type ItemDetails = {
  name?: string;
  sources?: Array<{ name: string; url: string }>;
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
};

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
const logPath = path.join(root, "data", "item-icon-url-backfill.json");
const cacheDir = path.join(root, "cache", "zam-pages");
const exactItemUrlPattern = /^https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=(\d+)(?:$|[&#])/i;
const requestDelayMs = Number(process.env.ZAM_REQUEST_DELAY_MS ?? 250);
const maxItems = Number(process.env.MAX_ITEMS ?? 0);
const userAgent = "LootGoblinIconBackfill/0.1 (+local data maintenance)";

const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
const missingIconEntries = Object.entries(details)
  .filter(([, item]) => !hasExistingIcon(item))
  .sort(([a], [b]) => a.localeCompare(b));
const skippedWithoutExactUrl = missingIconEntries
  .filter(([, item]) => !getExactAllakhazamUrl(item))
  .map(([item]) => ({ item, reason: "No exact Allakhazam /db/item.html?item=ID source URL." }));
const entries = missingIconEntries.filter(([, item]) => Boolean(getExactAllakhazamUrl(item)));
const selectedEntries = maxItems > 0 ? entries.slice(0, maxItems) : entries;
const log = {
  totalItems: Object.keys(details).length,
  missingIcons: missingIconEntries.length,
  missingIconCandidatesWithExactUrl: entries.length,
  processed: selectedEntries.length,
  updated: [] as Array<{ item: string; icon: string; score: number; reasons: string[] }>,
  skipped: skippedWithoutExactUrl as Array<{ item: string; reason: string; candidate?: string; score?: number }>,
  failed: [] as Array<{ item: string; reason: string }>,
};

await mkdir(cacheDir, { recursive: true });

for (const [index, [itemName, item]] of selectedEntries.entries()) {
  const sourceUrl = getExactAllakhazamUrl(item);
  if (!sourceUrl) continue;

  try {
    console.log(`[${index + 1}/${selectedEntries.length}] Inspecting ${itemName}`);
    const html = await fetchCached(sourceUrl, `item:${sourceUrl}`);
    const candidates = findImageCandidates(html, sourceUrl, itemName);
    const best = candidates[0];

    if (!best || best.score < 60) {
      log.skipped.push({
        item: itemName,
        reason: best ? "No reliable icon candidate met the confidence threshold." : "No image candidates found.",
        candidate: best?.absoluteUrl,
        score: best?.score,
      });
      continue;
    }

    item.icon = best.absoluteUrl;
    log.updated.push({
      item: itemName,
      icon: best.absoluteUrl,
      score: best.score,
      reasons: best.reasons,
    });
  } catch (error) {
    log.failed.push({
      item: itemName,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`);

console.log(`Updated ${log.updated.length} item icon URL(s).`);
console.log(`Skipped ${log.skipped.length} item(s).`);
console.log(`Failed ${log.failed.length} item(s).`);
console.log(`Wrote ${logPath}`);

function hasExistingIcon(item: ItemDetails) {
  return Boolean(item.iconPath || item.icon || item.icon_url);
}

function getExactAllakhazamUrl(item: ItemDetails) {
  const url = item.sources?.find((source) => source.name === "Allakhazam")?.url;
  if (!url || !exactItemUrlPattern.test(url)) return null;
  return canonicalItemUrl(url);
}

function canonicalItemUrl(url: string) {
  return url.match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? url;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

async function fetchCached(url: string, label: string) {
  const filePath = path.join(cacheDir, `${cacheKey(label)}.html`);

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

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
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
  if (/^https?:\/\//i.test(src)) return src;
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

  if (/\/pgfx\/item_\d+\.(png|gif)$/i.test(url)) {
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
