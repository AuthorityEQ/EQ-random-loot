import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Component = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: string;
  componentType?: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
};

type Recipe = {
  id?: string;
  skill: string;
  name: string;
  components: Component[];
  output: { name: string; count: number; imageUrl?: string | null };
  trivial: number | null;
  sourceUrl?: string | null;
  sourceMetadata?: Record<string, unknown>;
};

type ItemDetails = Record<string, unknown> & {
  name?: string;
  sourceUrl?: string | null;
  iconPath?: string | null;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
};

type ParsedComponent = Component & {
  sourceUrl?: string | null;
};

const root = process.cwd();
const p99BaseUrl = "https://wiki.project1999.com";
const tailoringUrl = `${p99BaseUrl}/Tailoring`;
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-tailoring-set-cleanup-report.json");
const setTables = new Set([11, 12, 13, 14]);

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

function tableRows(tableHtml: string) {
  return Array.from(tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((match) => match[0]);
}

function cells(rowHtml: string) {
  return Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) => match[1]);
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function absoluteP99Url(href: string) {
  const decoded = decode(href);
  return decoded.startsWith("http") ? decoded : `${p99BaseUrl}${decoded.startsWith("/") ? "" : "/"}${decoded}`;
}

function firstAnchor(cellHtml: string) {
  const match = cellHtml.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const tag = match[0];
  const title = tag.match(/\btitle=["']([^"']+)["']/i)?.[1];
  return {
    name: normalizeItemName(clean(title ? decode(title) : match[2])),
    url: absoluteP99Url(match[1]),
  };
}

function p99ItemUrl(name: string) {
  return `${p99BaseUrl}/${encodeURIComponent(name.replace(/\s+/g, "_")).replace(/%27/g, "'")}`;
}

function normalizeItemName(name: string) {
  return name.replace(/\bOf\b/g, "of").replace(/\s+/g, " ").trim();
}

function countFromCell(cellHtml: string) {
  const value = Number(clean(cellHtml).match(/^\d+/)?.[0] ?? NaN);
  return Number.isFinite(value) ? value : 1;
}

function componentFromLinkedCell(cellHtml: string) {
  const anchor = firstAnchor(cellHtml);
  if (!anchor) return null;
  return {
    name: anchor.name,
    count: countFromCell(cellHtml),
    imageUrl: null,
    acquisitionType: "unknown",
    componentType: "ingredient",
    sourceUrl: anchor.url,
    sourceName: anchor.name,
  } satisfies ParsedComponent;
}

function numericComponent(header: string, tableIndex: number, count: number) {
  const normalized = normalizeHeader(header);
  const name = normalized === "viscous mana" ? "Vial of Viscous Mana"
    : normalized === "heady kiolas" ? "Heady Kiola"
    : normalized === "silver thread" ? "Silver Thread"
    : normalized === "swatches" && tableIndex === 11 ? "Silk Swatch"
    : normalized === "swatches" && tableIndex === 12 ? "Crystalline Silk Swatch"
    : normalized === "swatches" && tableIndex === 13 ? "Ice Silk Swatch"
    : normalized === "mana" && tableIndex === 13 ? "Vial of Purified Mana"
    : normalized === "thread" && tableIndex === 13 ? "Platinum Thread"
    : "";
  if (!name || count <= 0) return null;
  return { name, count, imageUrl: null, acquisitionType: "unknown", componentType: "ingredient", sourceUrl: p99ItemUrl(name), sourceName: name } satisfies ParsedComponent;
}

function parseTrivial(value: string) {
  const parsed = Number(clean(value).match(/^\d+$/)?.[0] ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "FrostreaverLootReference/0.2 (+local P99 tailoring cleanup)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
  return response.text();
}

function reliableP99Icon(html: string) {
  for (const match of html.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const src = decode(match[1]);
    const absolute = src.startsWith("http") ? src : `${p99BaseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
    const icon = absolute.match(/^https?:\/\/wiki\.project1999\.com\/images\/Item_\d+\.png$/i)?.[0]
      ?? absolute.match(/^https?:\/\/wiki\.project1999\.com\/images\/thumb\/(Item_\d+\.png)\/\d+px-\1$/i)?.[1];
    if (icon) return icon.startsWith("http") ? icon : `${p99BaseUrl}/images/${icon}`;
  }
  return null;
}

function mergeSource(details: ItemDetails, url: string) {
  const sources = details.sources ?? [];
  return sources.some((source) => source.url === url) ? sources : [...sources, { name: "Project1999 Wiki", url }];
}

function mergeNote(details: ItemDetails, note: string) {
  const notes = details.match_notes ?? [];
  return notes.includes(note) ? notes : [...notes, note];
}

function withItemDefaults(name: string, existing: ItemDetails, sourceUrl: string | null, iconPath: string | null): ItemDetails {
  return {
    name: existing.name ?? name,
    itemId: existing.itemId ?? null,
    sourceUrl: existing.sourceUrl ?? sourceUrl,
    slot: existing.slot ?? null,
    ac: existing.ac ?? null,
    damage: existing.damage ?? null,
    delay: existing.delay ?? null,
    skill: existing.skill ?? null,
    damage_bonus: existing.damage_bonus ?? null,
    stats: existing.stats ?? {},
    resists: existing.resists ?? {},
    hp_regen: existing.hp_regen ?? null,
    mana_regen: existing.mana_regen ?? null,
    endurance_regen: existing.endurance_regen ?? null,
    atk: existing.atk ?? null,
    haste: existing.haste ?? null,
    worn_effects: existing.worn_effects ?? [],
    focus_effects: existing.focus_effects ?? [],
    click_effects: existing.click_effects ?? [],
    proc_effects: existing.proc_effects ?? [],
    required_level: existing.required_level ?? null,
    recommended_level: existing.recommended_level ?? null,
    classes: existing.classes ?? [],
    races: existing.races ?? [],
    weight: existing.weight ?? null,
    size: existing.size ?? null,
    item_type: existing.item_type ?? "Tailoring Component",
    itemType: existing.itemType ?? "Tailoring Component",
    stackable: existing.stackable ?? null,
    weight_reduction: existing.weight_reduction ?? null,
    capacity: existing.capacity ?? null,
    size_capacity: existing.size_capacity ?? null,
    lore: existing.lore ?? false,
    magic: existing.magic ?? false,
    no_drop: existing.no_drop ?? false,
    prestige: existing.prestige ?? null,
    aug_slots: existing.aug_slots ?? [],
    iconPath: existing.iconPath ?? iconPath,
    icon: existing.icon ?? null,
    icon_url: existing.icon_url ?? null,
    sources: sourceUrl ? mergeSource(existing, sourceUrl) : existing.sources ?? [],
    confidence: existing.confidence ?? "exact_match",
    match_confidence: existing.match_confidence ?? "exact_match",
    match_notes: mergeNote(existing, "Tailoring set component name/link cleaned from P99 source table semantics."),
    missing_core_stats: existing.missing_core_stats ?? false,
    duplicate_name_risk: existing.duplicate_name_risk ?? false,
    parsing_warnings: existing.parsing_warnings ?? [],
    expansion: existing.expansion ?? "Scars of Velious",
  };
}

const data = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const html = await fetchPage(tailoringUrl);
const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => match[0]);
const rowComponents = new Map<string, { components: ParsedComponent[]; trivial: number | null; summary: boolean }>();
const sourceSummaryRows: Array<Record<string, unknown>> = [];

for (const tableIndex of setTables) {
  const rows = tableRows(tables[tableIndex] ?? "");
  if (rows.length < 2) continue;
  const headerCells = cells(rows[0]).map(clean);
  const headers = headerCells.map(normalizeHeader);
  const itemIndex = headers.indexOf("item");
  const trivialIndex = headers.findIndex((header) => header.includes("trivial"));
  const componentIndexes = headers
    .map((header, index) => ({ header, index, label: headerCells[index] }))
    .filter(({ header, index }) => index !== itemIndex && index !== trivialIndex && !["ac", "agi", "weight", "era", "item stats"].includes(header));
  for (const [rowOffset, rowHtml] of rows.slice(1).entries()) {
    const rowCells = cells(rowHtml);
    if (rowCells.length !== headerCells.length) continue;
    const outputName = firstAnchor(rowCells[itemIndex])?.name ?? clean(rowCells[itemIndex]).replace(/\s+MAGIC ITEM.+$/i, "").trim();
    const summary = /set total/i.test(clean(rowCells[componentIndexes[0]?.index ?? 1])) || / armor$/i.test(outputName) && !parseTrivial(rowCells[trivialIndex] ?? "");
    const components: ParsedComponent[] = [];
    for (const column of componentIndexes) {
      const count = countFromCell(rowCells[column.index]);
      const linked = componentFromLinkedCell(rowCells[column.index]);
      const component = linked ?? numericComponent(column.label, tableIndex, count);
      if (component) components.push(component);
    }
    rowComponents.set(`${tableIndex}:${rowOffset + 1}`, {
      components,
      trivial: trivialIndex >= 0 ? parseTrivial(rowCells[trivialIndex]) : null,
      summary,
    });
    if (summary) sourceSummaryRows.push({ recipe: outputName, tableIndex, row: rowOffset + 1, reason: "Set-total summary row from P99 source table, not an individual recipe." });
  }
}

const expandedComponents: Array<Record<string, unknown>> = [];
const removedSummaryRows: Array<Record<string, unknown>> = [];
const missingRows: Array<Record<string, unknown>> = [];
const componentNames = new Map<string, string | null>();
const nextRecipes: Recipe[] = [];

for (const recipe of data.recipes) {
  if (recipe.skill !== "tailoring" || !setTables.has(Number(recipe.sourceMetadata?.tableIndex ?? -1))) {
    nextRecipes.push(recipe);
    continue;
  }
  const tableIndex = Number(recipe.sourceMetadata?.tableIndex ?? -1);
  const row = Number(recipe.sourceMetadata?.row ?? -1);
  const parsed = rowComponents.get(`${tableIndex}:${row}`);
  if (!parsed) {
    missingRows.push({ recipe: recipe.name, tableIndex, row, reason: "Could not find matching P99 tailoring set row." });
    nextRecipes.push(recipe);
    continue;
  }
  if (parsed.summary) {
    removedSummaryRows.push({ recipe: recipe.name, tableIndex, row, reason: "Removed set-total summary row from recipe list." });
    continue;
  }
  const before = recipe.components.map((component) => `${component.count}x ${component.name}`);
  recipe.components = parsed.components;
  if (parsed.trivial !== null) recipe.trivial = parsed.trivial;
  recipe.sourceMetadata = {
    ...(recipe.sourceMetadata ?? {}),
    tailoringSetComponentsCleaned: true,
  };
  const after = recipe.components.map((component) => `${component.count}x ${component.name}`);
  if (before.join("|") !== after.join("|")) expandedComponents.push({ recipe: recipe.name, tableIndex, row, before, after });
  for (const component of recipe.components) componentNames.set(component.name, component.sourceUrl ?? null);
  nextRecipes.push(recipe);
}

data.recipes = nextRecipes;

const pageCache = new Map<string, string>();
for (const [name, sourceUrl] of componentNames) {
  if (!sourceUrl) continue;
  let iconPath: string | null = null;
  try {
    const componentHtml = pageCache.get(sourceUrl) ?? await fetchPage(sourceUrl);
    pageCache.set(sourceUrl, componentHtml);
    iconPath = reliableP99Icon(componentHtml);
  } catch {
    iconPath = null;
  }
  itemDetails[name] = withItemDefaults(name, itemDetails[name] ?? {}, sourceUrl, iconPath);
}

const report = {
  source: tailoringUrl,
  fixedRecipeCount: expandedComponents.length,
  removedSummaryRowCount: removedSummaryRows.length,
  sourceSummaryRowCount: sourceSummaryRows.length,
  expandedComponents,
  removedSummaryRows,
  sourceSummaryRows,
  missingRows,
  cleanedTables: Array.from(setTables).sort(),
};

await writeFile(craftingPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Cleaned ${expandedComponents.length} Tailoring set recipes.`);
console.log(`Removed ${removedSummaryRows.length} set summary rows.`);
console.log(`Missing matching rows: ${missingRows.length}`);
console.log(`Wrote ${reportPath}`);
