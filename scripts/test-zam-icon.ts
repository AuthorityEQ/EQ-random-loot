import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ImageCandidate = {
  src: string;
  absoluteUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  nearbyText: string;
  score: number;
  reasons: string[];
};

const itemName = "Bo Stick";
const itemUrl = "https://everquest.allakhazam.com/db/item.html?item=500";
const outputPath = path.join(process.cwd(), "public", "test-icons", "bo-stick.png");
const userAgent = "FrostreaverLootReference/0.3 (+local one-item icon test)";

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

function absolutize(src: string) {
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return new URL(src, itemUrl).toString();
}

function scoreCandidate(candidate: Omit<ImageCandidate, "score" | "reasons">) {
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

function findImageCandidates(html: string) {
  const titleIndex = html.toLowerCase().indexOf(itemName.toLowerCase());
  const candidates: ImageCandidate[] = [];

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const index = match.index ?? 0;
    const src = readAttr(tag, "src");
    if (!src) continue;

    const nearbyStart = Math.max(0, index - 1200);
    const nearbyEnd = Math.min(html.length, index + 1200);
    const nearbyHtml = html.slice(nearbyStart, nearbyEnd);
    const candidate = {
      src,
      absoluteUrl: absolutize(src),
      alt: readAttr(tag, "alt"),
      width: readNumberAttr(tag, "width"),
      height: readNumberAttr(tag, "height"),
      nearbyText: stripTags(nearbyHtml).slice(0, 240),
    };
    const scored = scoreCandidate(candidate);
    const distanceFromTitle = titleIndex >= 0 ? Math.abs(index - titleIndex) : Number.POSITIVE_INFINITY;

    candidates.push({
      ...candidate,
      score: scored.score + (distanceFromTitle < 1800 ? 15 : 0),
      reasons: distanceFromTitle < 1800 ? [...scored.reasons, "near title in document"] : scored.reasons,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
}

async function downloadIcon(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "image/png,image/gif,image/jpeg,image/webp,*/*",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching image ${url}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Best candidate did not return an image content-type: ${contentType}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

console.log(`Fetching ${itemUrl}`);
const html = await fetchText(itemUrl);
const candidates = findImageCandidates(html);

console.log(`Found ${candidates.length} image candidate(s). Top candidates:`);
for (const candidate of candidates.slice(0, 10)) {
  console.log(JSON.stringify({
    score: candidate.score,
    url: candidate.absoluteUrl,
    alt: candidate.alt || null,
    width: candidate.width,
    height: candidate.height,
    reasons: candidate.reasons,
  }));
}

const best = candidates[0];
if (!best || best.score < 45) {
  console.log("Result: no reliable icon found");
  process.exit(0);
}

console.log(`Found icon URL: ${best.absoluteUrl}`);
await downloadIcon(best.absoluteUrl);
console.log(`Saved local path: ${outputPath}`);
