import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ItemDetails = {
  name: string;
  charges?: number | string | null;
  worn_effects?: string[];
  focus_effects?: string[];
  click_effects?: string[];
  proc_effects?: string[];
  sources?: Array<{ name: string; url: string }>;
};

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "item-charges-audit.json");
const cacheDir = path.join(root, "cache", "zam-pages");

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function canonicalItemUrl(url: string) {
  const match = url.match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i);
  return match?.[1] ?? url;
}

function htmlDecode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
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

function hasStoredEffects(item: ItemDetails) {
  return Boolean(
    item.worn_effects?.length
      || item.focus_effects?.length
      || item.click_effects?.length
      || item.proc_effects?.length,
  );
}

function cachedPageForUrl(url: string) {
  const exactUrl = canonicalItemUrl(url);
  const filePath = path.join(cacheDir, `${slug(`item:${exactUrl}`)}.html`);
  return existsSync(filePath) ? filePath : null;
}

const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
const scanned: string[] = [];
const updated: Array<{ item: string; charges: number | string; url: string }> = [];
const effectItemsNoCharges: string[] = [];
const missingCachedPages: string[] = [];

for (const [itemName, item] of Object.entries(details)) {
  const sourceUrl = item.sources?.find((source) => /allakhazam/i.test(source.name) && /\/db\/item\.html\?item=\d+/i.test(source.url))?.url;
  if (!sourceUrl) continue;

  const cachedPage = cachedPageForUrl(sourceUrl);
  if (!cachedPage) {
    if (hasStoredEffects(item)) missingCachedPages.push(itemName);
    continue;
  }

  const html = await readFile(cachedPage, "utf8");
  const text = stripTags(html);
  const pageHasEffect = /\b(?:Effect|Worn|Focus|Proc|Combat Effects):/i.test(text);
  if (!hasStoredEffects(item) && !pageHasEffect) continue;

  scanned.push(itemName);
  const charges = readCharges(text);
  if (charges !== null) {
    item.charges = charges;
    updated.push({ item: itemName, charges, url: canonicalItemUrl(sourceUrl) });
  } else {
    effectItemsNoCharges.push(itemName);
    if (!("charges" in item)) item.charges = null;
  }
}

await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  items_scanned: scanned.length,
  items_updated_with_charges: updated.length,
  items_with_effects_but_no_charges_found: effectItemsNoCharges.length,
  missing_cached_pages: missingCachedPages.length,
  updated,
  effectItemsNoCharges,
  missingCachedPages,
}, null, 2)}\n`);

console.log(JSON.stringify({
  items_scanned: scanned.length,
  items_updated_with_charges: updated.length,
  items_with_effects_but_no_charges_found: effectItemsNoCharges.length,
  missing_cached_pages: missingCachedPages.length,
  report: path.relative(root, reportPath),
}, null, 2));
