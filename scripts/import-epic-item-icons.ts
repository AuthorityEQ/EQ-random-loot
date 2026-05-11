import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type EpicLinkedItem = {
  name: string;
  url?: string;
};

type EpicStep = {
  required_items?: EpicLinkedItem[];
  drop_items?: EpicLinkedItem[];
  reward_items?: EpicLinkedItem[];
  create_items?: EpicLinkedItem[];
};

type EpicClass = {
  class_name: string;
  steps: EpicStep[];
};

type EpicDataset = {
  classes: EpicClass[];
};

type ItemDetails = {
  name?: string;
  itemId?: string | null;
  sourceUrl?: string | null;
  slot?: string | null;
  ac?: number | null;
  damage?: number | null;
  delay?: number | null;
  stats?: Record<string, number | string>;
  resists?: Record<string, number | string>;
  haste?: string | null;
  worn_effects?: string[];
  focus_effects?: string[];
  click_effects?: string[];
  proc_effects?: string[];
  required_level?: number | null;
  recommended_level?: number | null;
  classes?: string[];
  races?: string[];
  weight?: number | null;
  size?: string | null;
  lore?: boolean | null;
  magic?: boolean | null;
  no_drop?: boolean | null;
  prestige?: boolean | null;
  aug_slots?: string[];
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
  sources?: Array<{ name: string; url: string }>;
  confidence?: string;
  match_confidence?: string;
  match_notes?: string[];
  missing_core_stats?: boolean;
  duplicate_name_risk?: boolean;
  parsing_warnings?: string[];
  expansion?: string;
  acquisitionType?: string;
  sourceCategory?: string;
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
const epicPath = path.join(root, "data", "excel-imports", "epic-quests.json");
const detailsPath = path.join(root, "data", "item-details.json");
const outputDir = path.join(root, "public", "item-icons");
const cacheDir = path.join(root, "cache", "epic-item-icons");
const logPath = path.join(root, "data", "epic-item-icon-import-report.json");
const userAgent = "FrostreaverEpicIconImport/0.1 (+local epic quest item icon maintenance)";
const requestDelayMs = Number(process.env.ZAM_REQUEST_DELAY_MS ?? 250);
const exactItemUrlPattern = /^https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=(\d+)(?:$|[&#])/i;
const pseudoItemPattern = /^\d+pp$/i;

await main();

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  const epic = JSON.parse(await readFile(epicPath, "utf8")) as EpicDataset;
  const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
  const byNorm = buildNormalizedIndex(details);
  const epicItems = collectEpicItems(epic);

  const log = {
    totalEpicItems: epicItems.size,
    alreadyHadIcon: 0,
    imported: [] as Array<{ item: string; key: string; itemId: string; iconPath: string; sourceUrl: string }>,
    linkedExistingFile: [] as Array<{ item: string; key: string; iconPath: string }>,
    skipped: [] as Array<{ item: string; reason: string }>,
    unresolved: [] as Array<{ item: string; reason: string }>,
    failed: [] as Array<{ item: string; reason: string }>,
  };

  for (const [itemName, sourceUrls] of epicItems) {
    if (pseudoItemPattern.test(itemName)) {
      log.skipped.push({ item: itemName, reason: "Currency/count/common-text entry, not an item icon target." });
      continue;
    }

    const existing = findExisting(details, byNorm, itemName);
    if (existing?.item && hasIcon(existing.item)) {
      log.alreadyHadIcon += 1;
      continue;
    }

    try {
      const sourceUrl = getExactUrl(sourceUrls, existing?.item) ?? await resolveExactAllakhazamUrl(itemName);
      if (!sourceUrl) {
        log.unresolved.push({ item: itemName, reason: "No exact Allakhazam item page found by quest URL, item-details URL, or exact autocomplete match." });
        continue;
      }

      const itemId = sourceUrl.match(exactItemUrlPattern)?.[1];
      if (!itemId) {
        log.unresolved.push({ item: itemName, reason: `Resolved URL was not an exact item page: ${sourceUrl}` });
        continue;
      }

      const key = existing?.key ?? itemName;
      const item = existing?.item ?? createMinimalEpicItem(itemName, itemId, sourceUrl);
      details[key] = item;
      item.name = item.name ?? itemName;
      item.itemId = item.itemId ?? itemId;
      item.sourceUrl = item.sourceUrl ?? sourceUrl;
      item.sources = upsertAllakhazamSource(item.sources, sourceUrl);

      const outputFileName = `${safeFileName(itemName)}-${itemId}.png`;
      const absoluteOutputPath = path.join(outputDir, outputFileName);
      const publicIconPath = `/item-icons/${outputFileName}`;

      if (existsSync(absoluteOutputPath)) {
        item.iconPath = publicIconPath;
        log.linkedExistingFile.push({ item: itemName, key, iconPath: publicIconPath });
        continue;
      }

      const html = await fetchCached(sourceUrl, `item:${sourceUrl}`, "text/html,application/xhtml+xml");
      const candidates = findImageCandidates(html, sourceUrl, itemName);
      const best = candidates[0];
      if (!best || best.score < 60) {
        log.unresolved.push({
          item: itemName,
          reason: best
            ? `No reliable icon candidate. Best score ${best.score}: ${best.absoluteUrl}`
            : "No image candidates found on exact item page.",
        });
        continue;
      }

      await downloadImage(best.absoluteUrl, absoluteOutputPath);
      item.iconPath = publicIconPath;
      log.imported.push({ item: itemName, key, itemId, iconPath: publicIconPath, sourceUrl });
    } catch (error) {
      log.failed.push({ item: itemName, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  await writeFile(detailsPath, `${JSON.stringify(sortItemMap(details), null, 2)}\n`);
  await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`);

  console.log(`Epic items: ${log.totalEpicItems}`);
  console.log(`Already had icon: ${log.alreadyHadIcon}`);
  console.log(`Imported: ${log.imported.length}`);
  console.log(`Linked existing files: ${log.linkedExistingFile.length}`);
  console.log(`Skipped: ${log.skipped.length}`);
  console.log(`Unresolved: ${log.unresolved.length}`);
  console.log(`Failed: ${log.failed.length}`);
  console.log(`Wrote ${logPath}`);
}

function collectEpicItems(epic: EpicDataset) {
  const names = new Map<string, Set<string>>();
  for (const cls of epic.classes) {
    for (const step of cls.steps) {
      for (const field of ["required_items", "drop_items", "reward_items", "create_items"] as const) {
        for (const item of step[field] ?? []) {
          const name = item.name?.trim();
          if (!name) continue;
          if (!names.has(name)) names.set(name, new Set());
          if (item.url) names.get(name)?.add(item.url);
        }
      }
    }
  }
  return new Map([...names.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function buildNormalizedIndex(details: Record<string, ItemDetails>) {
  const byNorm = new Map<string, { key: string; item: ItemDetails }>();
  for (const [key, item] of Object.entries(details)) {
    byNorm.set(normalizeName(key), { key, item });
    if (item.name) byNorm.set(normalizeName(item.name), { key, item });
  }
  return byNorm;
}

function findExisting(details: Record<string, ItemDetails>, byNorm: Map<string, { key: string; item: ItemDetails }>, itemName: string) {
  if (details[itemName]) return { key: itemName, item: details[itemName] };
  return byNorm.get(normalizeName(itemName));
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasIcon(item: ItemDetails) {
  return Boolean(item.iconPath || item.icon || item.icon_url);
}

function getExactUrl(sourceUrls: Set<string>, item?: ItemDetails) {
  for (const url of sourceUrls) {
    const exact = canonicalItemUrl(url);
    if (exact) return exact;
  }

  const detailUrls = [
    item?.sourceUrl,
    ...(item?.sources ?? []).filter((source) => source.name === "Allakhazam").map((source) => source.url),
  ].filter(Boolean) as string[];

  for (const url of detailUrls) {
    const exact = canonicalItemUrl(url);
    if (exact) return exact;
  }

  return null;
}

function canonicalItemUrl(url: string) {
  const match = url.match(exactItemUrlPattern);
  return match ? `https://everquest.allakhazam.com/db/item.html?item=${match[1]}` : null;
}

async function resolveExactAllakhazamUrl(itemName: string) {
  const html = await fetchCached(
    `https://everquest.allakhazam.com/cluster/autocomp.pl?q=${encodeURIComponent(itemName)}`,
    `autocomplete:${itemName}`,
    "text/html,*/*",
  );
  const normalizedTarget = normalizeName(itemName);
  const matches = [...html.matchAll(/<a\s+href=["']([^"']*\/db\/item\.html\?item=(\d+)[^"']*)["'][^>]*>(.*?)<span>Item<\/span><\/a>/gi)]
    .map((match) => {
      const href = htmlDecode(match[1]);
      const id = match[2];
      const label = stripTags(match[3]);
      return { href, id, label };
    })
    .filter((match) => normalizeName(match.label) === normalizedTarget);

  if (matches.length !== 1) return null;
  return `https://everquest.allakhazam.com/db/item.html?item=${matches[0].id}`;
}

function createMinimalEpicItem(itemName: string, itemId: string, sourceUrl: string): ItemDetails {
  return {
    name: itemName,
    itemId,
    sourceUrl,
    slot: null,
    ac: null,
    damage: null,
    delay: null,
    stats: {},
    resists: {},
    haste: null,
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
    lore: null,
    magic: null,
    no_drop: null,
    prestige: null,
    aug_slots: [],
    sources: [{ name: "Allakhazam", url: sourceUrl }],
    confidence: "icon-only epic quest item record",
    match_confidence: "icon-only",
    match_notes: ["Created by epic item icon backfill from an exact Allakhazam item page match."],
    missing_core_stats: true,
    duplicate_name_risk: false,
    parsing_warnings: ["Icon-only record; item stats were not imported."],
    expansion: "Unknown",
    acquisitionType: "epic quest",
    sourceCategory: "Epic quest",
  };
}

function upsertAllakhazamSource(sources: ItemDetails["sources"], sourceUrl: string) {
  const next = [...(sources ?? [])];
  const existing = next.find((source) => source.name === "Allakhazam");
  if (existing) existing.url = sourceUrl;
  else next.push({ name: "Allakhazam", url: sourceUrl });
  return next;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

async function fetchCached(url: string, label: string, accept: string) {
  const filePath = path.join(cacheDir, `${cacheKey(label)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");

  await sleep(requestDelayMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
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

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

function sortItemMap(items: Record<string, ItemDetails>) {
  return Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b)));
}
