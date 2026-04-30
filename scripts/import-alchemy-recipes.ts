/**
 * import-alchemy-recipes.ts
 *
 * Scrapes Shaman Alchemy recipes from the Project 1999 wiki (Skill_Alchemy page)
 * and merges them into data/excel-imports/crafting-normalized.json with
 * skill: "alchemy".
 *
 * Source: https://wiki.project1999.com/Alchemy
 * Era filter: trivial <= 200 (Classic / Kunark / Velious era)
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-alchemy-recipes.ts
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlchemyRecipe {
  skill: "alchemy";
  name: string;
  trivial: number | null;
  components: Array<{ name: string; count: number }>;
  container: string;
  output: { name: string; count: number };
  notes: string | null;
}

interface NormalizedCrafting {
  recipes: Array<{
    skill: string;
    name: string;
    trivial: number | null;
    components: Array<{ name: string; count: number }>;
    container: string;
    output: { name: string; count: number };
    notes?: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, "cache", "alchemy-pages");
const OUTPUT_PATH = path.join(ROOT, "data", "excel-imports", "crafting-normalized.json");
const ALCHEMY_CACHE_FILE = path.join(CACHE_DIR, "p99-alchemy.html");

const P99_URL = "https://wiki.project1999.com/Alchemy";
const USER_AGENT = "FrostreaverRandomLoot/1.0 alchemy recipe import";
const FETCH_DELAY_MS = 1500;
const ERA_TRIVIAL_CAP = 200;
const CONTAINER = "Medicine Bag";

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readOrFetch(url: string, cachePath: string): Promise<string> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  if (existsSync(cachePath)) {
    console.log(`  [cache] Using cached: ${path.basename(cachePath)}`);
    return readFile(cachePath, "utf8");
  }
  console.log(`  [fetch] Downloading: ${url}`);
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
  }
  const html = await response.text();
  await writeFile(cachePath, html, "utf8");
  await delay(FETCH_DELAY_MS);
  return html;
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/**
 * Extract link text from an <a href=...>text</a> pattern, falling back to
 * plain text if no link present.
 */
function extractLinkText(cellHtml: string): string {
  const linkMatch = cellHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  if (linkMatch) return stripTags(linkMatch[1]);
  return stripTags(cellHtml);
}

/**
 * Extract all link texts from a cell containing multiple <a> tags (components).
 */
function extractAllLinkTexts(cellHtml: string): string[] {
  const results: string[] = [];
  const pattern = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cellHtml)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text) results.push(text);
  }
  // Fall back to plain text if no links
  if (results.length === 0) {
    const plain = stripTags(cellHtml).trim();
    if (plain) results.push(plain);
  }
  return results;
}

/**
 * Extract <td> cell contents from a <tr> block.
 */
function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const pattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rowHtml)) !== null) {
    cells.push(match[1]);
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Parse P99 wiki alchemy page
//
// The "Production Costs & Effects" table (eoTable3) has these columns (0-indexed):
//   0  Potion name (linked)
//   1  PP
//   2  GP
//   3  SP
//   4  CP
//   5  x10 Stack cost
//   6  Approx Recharge Cost
//   7  Description / effect text
//   8  Components (comma-separated links)
//   9  Trivial
//   10 Effect (spell name)
//   11 Duration
//   12 EC Demand
// ---------------------------------------------------------------------------

function parseAlchemyPage(html: string): AlchemyRecipe[] {
  // Find the eoTable3 block
  const tableStart = html.indexOf('<table class="eoTable3');
  if (tableStart === -1) {
    console.warn("  [warn] Could not find eoTable3 in page HTML");
    return [];
  }
  // Find table end
  const tableEnd = html.indexOf("</table>", tableStart);
  const tableHtml = tableEnd === -1 ? html.slice(tableStart) : html.slice(tableStart, tableEnd + 8);

  const recipes: AlchemyRecipe[] = [];

  // Split into rows
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1];
    // Skip header rows (contain <th>)
    if (/<th\b/i.test(rowHtml)) continue;

    const cells = extractCells(rowHtml);
    if (cells.length < 10) continue;

    // Column 0: potion name
    const name = extractLinkText(cells[0] ?? "").trim();
    if (!name) continue;

    // Column 8: components (comma-separated links)
    const componentNames = extractAllLinkTexts(cells[8] ?? "");

    // Column 9: trivial
    const trivialRaw = stripTags(cells[9] ?? "").trim();
    const trivialNum = Number(trivialRaw);
    const trivial: number | null = Number.isFinite(trivialNum) && trivialNum > 0 ? trivialNum : null;

    // Column 7: description as notes
    const descText = stripTags(cells[7] ?? "").trim();
    const notes = descText.length > 0 ? descText : null;

    const components = componentNames
      .filter((n) => n.length > 0)
      .map((n) => ({ name: n, count: 1 }));

    recipes.push({
      skill: "alchemy",
      name,
      trivial,
      components,
      container: CONTAINER,
      output: { name, count: 1 },
      notes,
    });
  }

  return recipes;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicateByName(recipes: AlchemyRecipe[]): AlchemyRecipe[] {
  const seen = new Set<string>();
  const result: AlchemyRecipe[] = [];
  for (const r of recipes) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(r);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Merge into crafting-normalized.json
// ---------------------------------------------------------------------------

async function loadNormalized(): Promise<NormalizedCrafting> {
  if (!existsSync(OUTPUT_PATH)) {
    return { recipes: [] };
  }
  const raw = await readFile(OUTPUT_PATH, "utf8");
  return JSON.parse(raw) as NormalizedCrafting;
}

async function mergeAndSave(alchemyRecipes: AlchemyRecipe[]): Promise<void> {
  const normalized = await loadNormalized();

  // Remove any existing alchemy recipes (idempotent re-run)
  const nonAlchemy = normalized.recipes.filter((r) => r.skill !== "alchemy");

  // Sort alchemy by trivial asc (null last)
  const sorted = [...alchemyRecipes].sort((a, b) => {
    if (a.trivial === null && b.trivial === null) return a.name.localeCompare(b.name);
    if (a.trivial === null) return 1;
    if (b.trivial === null) return -1;
    return a.trivial - b.trivial || a.name.localeCompare(b.name);
  });

  normalized.recipes = [...nonAlchemy, ...sorted];

  await writeFile(OUTPUT_PATH, JSON.stringify(normalized, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("import-alchemy-recipes: starting");
  console.log(`  Source: ${P99_URL}`);
  console.log(`  Cache:  ${ALCHEMY_CACHE_FILE}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
  console.log(`  Era filter: trivial <= ${ERA_TRIVIAL_CAP}`);

  // 1. Fetch P99 wiki page (or use cache)
  const html = await readOrFetch(P99_URL, ALCHEMY_CACHE_FILE);
  console.log(`  Page size: ${html.length} bytes`);

  // 2. Parse recipes
  const rawRecipes = parseAlchemyPage(html);
  console.log(`  Parsed: ${rawRecipes.length} raw recipes`);

  // 3. Deduplicate
  const unique = deduplicateByName(rawRecipes);
  console.log(`  After dedup: ${unique.length} recipes`);

  // 4. Era filter
  const eraFiltered = unique.filter(
    (r) => r.trivial === null || r.trivial <= ERA_TRIVIAL_CAP,
  );
  const filteredOut = unique.length - eraFiltered.length;
  console.log(`  After era filter (trivial <= ${ERA_TRIVIAL_CAP}): ${eraFiltered.length} recipes`);
  if (filteredOut > 0) {
    console.log(`  Filtered out ${filteredOut} recipes with trivial > ${ERA_TRIVIAL_CAP}`);
    for (const r of unique.filter((r) => r.trivial !== null && r.trivial > ERA_TRIVIAL_CAP)) {
      console.log(`    - ${r.name} (trivial: ${r.trivial})`);
    }
  }

  // 5. Log results
  if (eraFiltered.length === 0) {
    console.warn(
      "  [warn] No alchemy recipes scraped. Adding skill with empty array (UI will show empty tab).",
    );
  } else {
    const byTrivial = [...eraFiltered].sort(
      (a, b) => (a.trivial ?? 999) - (b.trivial ?? 999),
    );
    console.log("  Trivial range:",
      byTrivial[0]?.trivial ?? "null",
      "–",
      byTrivial[byTrivial.length - 1]?.trivial ?? "null",
    );
    console.log("  Sample recipes:");
    for (const r of byTrivial.slice(0, 5)) {
      console.log(
        `    trivial=${r.trivial ?? "null"} | ${r.name} | components: ${r.components.map((c) => c.name).join(", ")}`,
      );
    }
  }

  // 6. Merge into crafting-normalized.json
  await mergeAndSave(eraFiltered);
  console.log(`  Wrote ${eraFiltered.length} alchemy recipes to ${OUTPUT_PATH}`);

  // 7. Summary JSON
  console.log(
    JSON.stringify(
      {
        source: "P99 wiki (wiki.project1999.com/Alchemy)",
        rawParsed: rawRecipes.length,
        afterDedup: unique.length,
        afterEraFilter: eraFiltered.length,
        filteredOutHighTrivial: filteredOut,
        eraCap: ERA_TRIVIAL_CAP,
        outputFile: OUTPUT_PATH,
      },
      null,
      2,
    ),
  );

  console.log("import-alchemy-recipes: done");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
