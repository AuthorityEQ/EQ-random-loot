import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Component = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: "foraged" | "unknown";
  sourceNotes?: string | null;
  sourceUrl?: string | null;
  componentType?: "ingredient";
};

type CraftingRecipe = {
  id?: string | number;
  expansion?: string | null;
  skill: string;
  name: string;
  trivial: number | null;
  components: Component[];
  container: string;
  output: { name: string; count: number; imageUrl?: string | null };
  notes?: string | null;
  sourceUrl?: string | null;
  sourceOutputCount?: number | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
};

type ItemDetails = Record<string, unknown>;

const root = process.cwd();
const p99BaseUrl = "https://wiki.project1999.com";
const p99BrewingUrl = `${p99BaseUrl}/Brewing`;
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-brewing-p99-import-report.json");

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
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

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tableRows(tableHtml: string) {
  return Array.from(tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((match) => match[0]);
}

function cells(rowHtml: string) {
  return Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) => match[1]);
}

function anchors(cellHtml: string) {
  return Array.from(cellHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      const href = decode(match[1]);
      const url = href.startsWith("http") ? href : `${p99BaseUrl}${href}`;
      const title = match[0].match(/\btitle=["']([^"']+)["']/i)?.[1];
      return {
        name: clean(title ? decode(title) : match[2]),
        url,
      };
    })
    .filter((anchor) => anchor.name && !/^(edit|source|\?)$/i.test(anchor.name));
}

function firstImage(cellHtml: string) {
  const images = Array.from(cellHtml.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/gi))
    .map((match) => decode(match[1]))
    .filter((src) => /\/images\/Item_\d+\.png$/i.test(src));
  const src = images[0];
  if (!src) return null;
  return src.startsWith("http") ? src : `${p99BaseUrl}${src}`;
}

function parseTrivial(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

function parseYield(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function countPrefix(value: string) {
  const match = value.match(/^\s*(\d+)x?\s+(.+)$/i);
  return match ? { count: Number(match[1]), name: match[2].trim() } : { count: 1, name: value.trim() };
}

function parseIngredients(cellHtml: string) {
  const components: Component[] = [];
  const anchorMatches = Array.from(cellHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));

  for (const match of anchorMatches) {
    const href = decode(match[1]);
    const url = href.startsWith("http") ? href : `${p99BaseUrl}${href}`;
    const title = match[0].match(/\btitle=["']([^"']+)["']/i)?.[1];
    const sourceName = clean(title ? decode(title) : match[2]);
    if (!sourceName || /^(edit|source|\?)$/i.test(sourceName)) continue;
    const start = match.index ?? 0;
    const previousComma = cellHtml.lastIndexOf(",", start);
    const prefix = clean(cellHtml.slice(Math.max(previousComma + 1, 0), start));
    const count = Number(prefix.match(/(\d+)\s*$/)?.[1] ?? 1);
    const nextComma = cellHtml.indexOf(",", start);
    const chunk = cellHtml.slice(start, nextComma >= 0 ? nextComma : cellHtml.length);
    const foraged = /\bforaged\b/i.test(clean(chunk));
    components.push({
      name: sourceName,
      count: Number.isFinite(count) ? count : 1,
      imageUrl: firstImage(match[0] + chunk),
      acquisitionType: foraged ? "foraged" : "unknown",
      sourceNotes: foraged ? "P99 marks this ingredient as foraged." : null,
      sourceUrl: url,
      componentType: "ingredient",
    });
  }

  if (components.length === 0) {
    for (const chunk of cellHtml.split(/,(?![^()]*\))/).map((entry) => entry.trim()).filter(Boolean)) {
      const text = clean(chunk);
      if (!text) continue;
      const parsed = countPrefix(text.replace(/\s*\(.+?\)\s*$/g, "").trim());
      const foraged = /\bforaged\b/i.test(text);
      components.push({
        name: parsed.name,
        count: parsed.count,
        imageUrl: null,
        acquisitionType: foraged ? "foraged" : "unknown",
        sourceNotes: foraged ? "P99 marks this ingredient as foraged." : null,
        sourceUrl: null,
        componentType: "ingredient",
      });
    }
  }

  const merged = new Map<string, Component>();
  for (const component of components.filter((component) => component.name && !/^(none|n\/a|\?)$/i.test(component.name))) {
    const key = component.name.toLowerCase();
    const existing = merged.get(key);
    if (existing) existing.count += component.count;
    else merged.set(key, component);
  }
  return Array.from(merged.values());
}

function mergeItemDetails(existing: ItemDetails | undefined, imported: ItemDetails) {
  if (!existing) return imported;
  const existingSources = Array.isArray(existing.sources) ? existing.sources : [];
  const importedSources = Array.isArray(imported.sources) ? imported.sources : [];
  const sourceUrls = new Set(existingSources.map((source) => typeof source === "object" && source ? (source as { url?: string }).url : ""));
  return {
    ...imported,
    ...existing,
    iconPath: existing.iconPath ?? imported.iconPath ?? null,
    imageUrl: existing.imageUrl ?? imported.imageUrl ?? null,
    sources: [
      ...existingSources,
      ...importedSources.filter((source) => typeof source === "object" && source && !sourceUrls.has((source as { url?: string }).url)),
    ],
    match_notes: Array.from(new Set([
      ...(Array.isArray(existing.match_notes) ? existing.match_notes as string[] : []),
      ...(Array.isArray(imported.match_notes) ? imported.match_notes as string[] : []),
    ])),
  };
}

function makeItemDetails(name: string, imageUrl: string | null, sourceUrl: string): ItemDetails {
  return {
    name,
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
    item_type: null,
    stackable: null,
    weight_reduction: null,
    capacity: null,
    size_capacity: null,
    lore: false,
    magic: false,
    no_drop: false,
    prestige: null,
    aug_slots: [],
    iconPath: imageUrl,
    sources: [{ name: "Project1999 Wiki", url: sourceUrl }],
    expansion: "Classic",
    confidence: "exact_match",
    match_confidence: "exact_match",
    match_notes: ["Imported from Project1999 Brewing Recipe List table."],
    missing_core_stats: false,
    duplicate_name_risk: false,
    parsing_warnings: [],
  };
}

function parseRecipeList(html: string) {
  const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => match[0]);
  const recipes: CraftingRecipe[] = [];
  const details: Array<[string, ItemDetails]> = [];
  const skipped: Record<string, unknown>[] = [];
  const ambiguous: Record<string, unknown>[] = [];

  for (const [tableIndex, tableHtml] of tables.entries()) {
    const rows = tableRows(tableHtml);
    const headerRowIndex = rows.findIndex((row) => {
      const headers = cells(row).map(clean).map(normalizeHeader);
      return headers.includes("item")
        && headers.includes("yield")
        && headers.includes("ingredients")
        && headers.includes("container")
        && headers.includes("trivial")
        && headers.includes("use");
    });
    if (headerRowIndex < 0) continue;

    const headerCells = cells(rows[headerRowIndex]).map(clean);
    const headers = headerCells.map(normalizeHeader);
    const indexes = {
      item: headers.indexOf("item"),
      yield: headers.indexOf("yield"),
      ingredients: headers.indexOf("ingredients"),
      container: headers.indexOf("container"),
      trivial: headers.indexOf("trivial"),
      use: headers.indexOf("use"),
    };

    for (const [rowOffset, rowHtml] of rows.slice(headerRowIndex + 1).entries()) {
      const rowCells = cells(rowHtml);
      if (rowCells.length !== headerCells.length) {
        skipped.push({ tableIndex, row: rowOffset + 1, reason: `Header/cell mismatch: ${headerCells.length}/${rowCells.length}` });
        continue;
      }

      const itemAnchor = anchors(rowCells[indexes.item])[0];
      const itemName = itemAnchor?.name ?? clean(rowCells[indexes.item]);
      if (!itemName || /^(item|total|notes?)$/i.test(itemName)) {
        skipped.push({ tableIndex, row: rowOffset + 1, itemName, reason: "Skipped non-recipe row." });
        continue;
      }

      const components = parseIngredients(rowCells[indexes.ingredients]);
      if (components.length === 0) {
        skipped.push({ tableIndex, row: rowOffset + 1, itemName, reason: "No ingredients parsed." });
        continue;
      }

      const sourceUrl = itemAnchor?.url ?? `${p99BaseUrl}/${encodeURIComponent(itemName.replace(/\s+/g, "_"))}`;
      const imageUrl = firstImage(rowCells[indexes.item]);
      const yieldText = clean(rowCells[indexes.yield]);
      const yieldCount = parseYield(yieldText);
      const containerText = clean(rowCells[indexes.container]);
      const containerAnchor = anchors(rowCells[indexes.container])[0];
      const container = containerAnchor?.name ?? (/^none$/i.test(containerText) ? "None" : containerText || "Brew Barrel");
      const trivialText = clean(rowCells[indexes.trivial]);
      const trivial = parseTrivial(trivialText);
      const use = clean(rowCells[indexes.use]);

      recipes.push({
        id: `p99-brewing-${tableIndex}-${rowOffset + 1}`,
        expansion: "Classic",
        skill: "brewing",
        name: itemName,
        trivial,
        components,
        container,
        output: { name: itemName, count: yieldCount ?? 1, imageUrl },
        notes: trivial === null && trivialText ? `P99 trivial listed as "${trivialText}"; exact value not inferred.` : null,
        sourceUrl,
        sourceOutputCount: yieldCount,
        sourceMetadata: {
          source: "Project1999 Wiki",
          p99Page: "Brewing",
          p99ItemUrl: sourceUrl,
          tableIndex,
          row: rowOffset + 1,
          brewingRecipeList: true,
          brewingYield: yieldText || null,
          brewingUse: use || null,
          brewingContainer: containerText || null,
          trivialText,
          postLuclin: false,
        },
      });
      details.push([itemName, makeItemDetails(itemName, imageUrl, sourceUrl)]);
    }
  }

  if (recipes.length === 0) ambiguous.push({ reason: "No P99 Brewing Recipe List table found." });
  return { recipes, details, skipped, ambiguous };
}

const craftingData = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: CraftingRecipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const previousBrewing = craftingData.recipes.filter((recipe) => recipe.skill === "brewing");
const previousRecipeList = previousBrewing.filter((recipe) => recipe.sourceMetadata?.brewingRecipeList === true || Number(recipe.sourceMetadata?.tableIndex ?? -1) === 1);
const previousSupplemental = previousBrewing.filter((recipe) => !(recipe.sourceMetadata?.brewingRecipeList === true || Number(recipe.sourceMetadata?.tableIndex ?? -1) === 1));

const html = await fetch(p99BrewingUrl).then((response) => {
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${p99BrewingUrl}`);
  return response.text();
});
const parsed = parseRecipeList(html);
const previousById = new Map(previousRecipeList.map((recipe) => [String(recipe.id), recipe]));
const previousByNameTrivial = new Map(previousRecipeList.map((recipe) => [`${recipe.name.toLowerCase()}:${recipe.trivial ?? "unknown"}`, recipe]));
const imported = parsed.recipes.map((recipe) => {
  const existing = previousById.get(String(recipe.id))
    ?? previousByNameTrivial.get(`${recipe.name.toLowerCase()}:${recipe.trivial ?? "unknown"}`);
  return {
    ...recipe,
    output: {
      ...recipe.output,
      imageUrl: existing?.output.imageUrl ?? recipe.output.imageUrl ?? null,
    },
    notes: recipe.notes ?? existing?.notes ?? null,
    sourceMetadata: {
      ...(existing?.sourceMetadata ?? {}),
      ...recipe.sourceMetadata,
    },
  };
});

for (const [name, details] of parsed.details) {
  itemDetails[name] = mergeItemDetails(itemDetails[name], details);
}

craftingData.recipes = [
  ...craftingData.recipes.filter((recipe) => recipe.skill !== "brewing"),
  ...imported,
  ...previousSupplemental,
];

const newBrewing = craftingData.recipes.filter((recipe) => recipe.skill === "brewing");
const examples = ["Bog Juice", "Flask of Berry Juice", "Othmir Algae Ale", "Cod Oil", "Drake Egg Oil", "Gypsy Wine"]
  .map((name) => ({
    name,
    matches: newBrewing
      .filter((recipe) => recipe.name.toLowerCase() === name.toLowerCase() || recipe.output.name.toLowerCase() === name.toLowerCase())
      .map((recipe) => ({ id: recipe.id, trivial: recipe.trivial, yield: recipe.sourceMetadata?.brewingYield ?? recipe.output.count, use: recipe.sourceMetadata?.brewingUse ?? null })),
  }));

const report = {
  source: p99BrewingUrl,
  previousBrewingCount: previousBrewing.length,
  previousRecipeListCount: previousRecipeList.length,
  importedRecipeListCount: imported.length,
  preservedSupplementalBrewingCount: previousSupplemental.length,
  newBrewingCount: newBrewing.length,
  skipped: parsed.skipped,
  ambiguous: parsed.ambiguous,
  examples,
};

await writeFile(craftingPath, `${JSON.stringify(craftingData, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));
