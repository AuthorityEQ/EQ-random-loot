import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CraftingComponent = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: "dropped" | "vendor" | "crafted" | "foraged" | "ground spawn" | "quest" | "unknown";
};

type CraftingRecipe = {
  id?: number | string;
  expansion?: string | null;
  skill: string;
  name: string;
  trivial: number | null;
  components: CraftingComponent[];
  container: string;
  output: {
    name: string;
    count: number;
    imageUrl?: string | null;
  };
  notes?: string | null;
  sourceUrl?: string | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
};

type CraftingEnvelope = {
  recipes: CraftingRecipe[];
  [key: string]: unknown;
};

type ItemDetails = Record<string, unknown>;

type ParsedRow = {
  recipe: CraftingRecipe;
  itemDetails: ItemDetails;
};

const root = process.cwd();
const sourceUrl = "https://wiki.project1999.com/Jewelcrafting";
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-jewelcrafting-p99-import-report.json");
const p99BaseUrl = "https://wiki.project1999.com";
const normalBarNote = "Stat jewelry requires enchanted metal bars; normal bars create non-stat versions with no bonus stats.";
const metalTier = new Map([
  ["Silver", 1],
  ["Electrum", 2],
  ["Gold", 3],
  ["Platinum", 4],
  ["Velium", 5],
]);
const statHeaders = ["HP", "MP", "AC", "STR", "STA", "DEX", "AGI", "INT", "WIS", "CHA", "MR", "DR", "PR", "FR", "CR"];

function htmlDecode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<");
}

function stripTags(html: string) {
  return htmlDecode(
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

function tableCells(rowHtml: string) {
  return Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) => match[1]);
}

function cleanCell(cellHtml: string) {
  return stripTags(cellHtml).replace(/\s+/g, " ").trim();
}

function firstAnchor(cellHtml: string) {
  const match = cellHtml.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const href = htmlDecode(match[1]);
  return {
    name: cleanCell(match[2]),
    url: href.startsWith("http") ? href : `${p99BaseUrl}${href}`,
  };
}

function firstImage(cellHtml: string) {
  const match = cellHtml.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
  if (!match) return null;
  const src = htmlDecode(match[1]);
  return src.startsWith("http") ? src : `${p99BaseUrl}${src}`;
}

function parseNumberCell(value: string) {
  const normalized = htmlDecode(value).replace(/\s+/g, " ").trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return null;
}

function parseSignedNumberCell(value: string) {
  const normalized = htmlDecode(value).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/^-\s*\d+$/.test(normalized)) return -Number(normalized.replace(/[^0-9]/g, ""));
  if (/^\+?\d+$/.test(normalized)) return Number(normalized.replace("+", ""));
  return null;
}

function statCategory(stats: Record<string, number>) {
  const keys = Object.keys(stats);
  if (keys.length === 0) return "Unknown";
  const primary = ["STR", "STA", "DEX", "AGI", "INT", "WIS", "CHA"];
  const resists = ["MR", "DR", "PR", "FR", "CR"];
  if (keys.every((key) => resists.includes(key))) return keys.length === resists.length ? "All Resists" : "Resists";
  if (keys.includes("AC") && keys.some((key) => resists.includes(key))) return "AC and Resists";
  if (keys.includes("HP") || keys.includes("MP") || keys.includes("AC")) return "HP/MP/AC";
  if (keys.every((key) => primary.includes(key))) return keys.length === 1 ? keys[0] : "Stats";
  return "Mixed";
}

function enchantedBarName(metal: string) {
  return `Enchanted ${metal} Bar`;
}

function parseItemDetails(name: string, itemCell: string, itemUrl: string, imageUrl: string | null, stats: Record<string, number>, slot: string) {
  const itemText = cleanCell(itemCell);
  return {
    name,
    slot: slot.toUpperCase() === "EAR" ? "EAR" : slot.toUpperCase(),
    ac: stats.AC ?? null,
    damage: null,
    delay: null,
    skill: null,
    damage_bonus: null,
    stats: Object.fromEntries(Object.entries(stats).filter(([key]) => !["MR", "DR", "PR", "FR", "CR", "AC"].includes(key))),
    resists: Object.fromEntries(Object.entries(stats).filter(([key]) => ["MR", "DR", "PR", "FR", "CR"].includes(key))),
    hp_regen: null,
    mana_regen: null,
    endurance_regen: null,
    haste: null,
    worn_effects: [],
    focus_effects: [],
    click_effects: [],
    proc_effects: [],
    required_level: null,
    recommended_level: null,
    classes: itemText.match(/\bClass:\s*ALL\b/i) ? ["ALL"] : [],
    races: itemText.match(/\bRace:\s*ALL\b/i) ? ["ALL"] : [],
    weight: Number(itemText.match(/\bWT:\s*(\d+(?:\.\d+)?)/i)?.[1] ?? 0.1),
    size: itemText.match(/\bSize:\s*([A-Z]+)/i)?.[1] ?? "TINY",
    item_type: "Jewelry",
    stackable: false,
    weight_reduction: null,
    capacity: null,
    size_capacity: null,
    lore: /\bLORE ITEM\b/i.test(itemText),
    magic: /\bMAGIC ITEM\b/i.test(itemText),
    no_drop: /\bNO DROP\b/i.test(itemText),
    prestige: null,
    aug_slots: [],
    iconPath: imageUrl,
    sources: [{ name: "Project1999 Wiki", url: itemUrl }],
    expansion: "Project 1999",
    confidence: "exact_match",
    match_notes: ["Imported from the Project1999 Jewelcrafting crafters item table."],
    missing_core_stats: Object.keys(stats).length === 0,
    duplicate_name_risk: false,
    parsing_warnings: [],
    match_confidence: "exact_match",
  };
}

function parseBasicRow(rowHtml: string, index: number): ParsedRow | { skipped: Record<string, unknown> } {
  const cells = tableCells(rowHtml);
  if (cells.length !== 21) return { skipped: { index, reason: `Expected 21 cells, got ${cells.length}` } };
  const itemAnchor = firstAnchor(cells[0]);
  const gemAnchor = firstAnchor(cells[20]);
  const metalAnchor = firstAnchor(cells[19]);
  const itemName = itemAnchor?.name;
  const metal = cleanCell(cells[19]).replace(/\s+Bar\b/i, "").trim();
  const gem = gemAnchor?.name ?? cleanCell(cells[20]).replace(/\s+WT:.+$/i, "").trim();
  const slot = cleanCell(cells[18]);
  const trivialText = cleanCell(cells[1]);
  const trivial = parseNumberCell(trivialText);
  const imageUrl = firstImage(cells[0]);
  if (!itemName || !itemAnchor || !metalTier.has(metal) || !gem || !slot) {
    return { skipped: { index, itemName, metal, gem, slot, reason: "Missing required item, metal, gem, or slot data." } };
  }
  const stats = Object.fromEntries(
    statHeaders
      .map((header, statIndex) => [header, parseSignedNumberCell(cleanCell(cells[3 + statIndex]))] as const)
      .filter((entry): entry is [string, number] => entry[1] !== null),
  );
  const componentMetal = enchantedBarName(metal);
  const statKind = statCategory(stats);
  return {
    recipe: {
      id: `p99-jewelcraft-basic-${index}`,
      expansion: metal === "Velium" ? "Scars of Velious" : "Classic",
      skill: "jewelcraft",
      name: itemName,
      trivial,
      components: [
        { name: componentMetal, count: 1, acquisitionType: "crafted" },
        { name: gem, count: 1, imageUrl: firstImage(cells[20]), acquisitionType: "unknown" },
      ],
      container: "Jeweler's Kit",
      output: { name: itemName, count: 1, imageUrl },
      notes: normalBarNote,
      sourceUrl: itemAnchor.url,
      sourceMetadata: {
        source: "Project1999 Jewelcrafting",
        p99ItemUrl: itemAnchor.url,
        p99GemUrl: gemAnchor?.url ?? null,
        p99MetalUrl: metalAnchor?.url ?? null,
        jewelcraftType: "Basic",
        metal,
        metalTier: metalTier.get(metal) ?? null,
        gem,
        slot,
        statCategory: statKind,
        trivialText,
        enchantedBar: componentMetal,
        normalBar: `${metal} Bar`,
      },
    },
    itemDetails: parseItemDetails(itemName, cells[0], itemAnchor.url, imageUrl, stats, slot),
  };
}

function parseDeityRow(rowHtml: string, index: number): ParsedRow | { skipped: Record<string, unknown> } {
  const cells = tableCells(rowHtml);
  if (cells.length !== 22) return { skipped: { index, reason: `Expected 22 cells, got ${cells.length}` } };
  const itemAnchor = firstAnchor(cells[0]);
  const gemAnchor = firstAnchor(cells[20]);
  const metalAnchor = firstAnchor(cells[19]);
  const itemName = itemAnchor?.name;
  const metalText = metalAnchor?.name ?? cleanCell(cells[19]);
  const metal = metalText.replace(/\s+Bar\b/i, "").trim();
  const gem = gemAnchor?.name ?? cleanCell(cells[20]).replace(/\s+WT:.+$/i, "").trim();
  const slot = cleanCell(cells[18]);
  const deity = cleanCell(cells[21]);
  const trivialText = cleanCell(cells[1]);
  const trivial = parseNumberCell(trivialText);
  const imageUrl = firstImage(cells[0]);
  if (!itemName || !itemAnchor || !metalTier.has(metal) || !gem || !slot || !deity) {
    return { skipped: { index, itemName, metal, gem, slot, deity, reason: "Missing required item, metal, gem, slot, or deity data." } };
  }
  const stats = Object.fromEntries(
    statHeaders
      .map((header, statIndex) => [header, parseSignedNumberCell(cleanCell(cells[3 + statIndex]))] as const)
      .filter((entry): entry is [string, number] => entry[1] !== null),
  );
  const componentMetal = enchantedBarName(metal);
  const statKind = statCategory(stats);
  return {
    recipe: {
      id: `p99-jewelcraft-imbued-${index}`,
      expansion: "Classic",
      skill: "jewelcraft",
      name: itemName,
      trivial,
      components: [
        { name: componentMetal, count: 1, acquisitionType: "crafted" },
        { name: gem, count: 1, imageUrl: firstImage(cells[20]), acquisitionType: "quest" },
      ],
      container: "Jeweler's Kit",
      output: { name: itemName, count: 1, imageUrl },
      notes: `${normalBarNote} Requires the matching imbued gem for ${deity}.`,
      sourceUrl: itemAnchor.url,
      sourceMetadata: {
        source: "Project1999 Jewelcrafting",
        p99ItemUrl: itemAnchor.url,
        p99GemUrl: gemAnchor?.url ?? null,
        p99MetalUrl: metalAnchor?.url ?? null,
        jewelcraftType: "Deity/Imbued",
        metal,
        metalTier: metalTier.get(metal) ?? null,
        gem,
        deity,
        slot,
        statCategory: statKind,
        trivialText,
        enchantedBar: componentMetal,
        normalBar: `${metal} Bar`,
      },
    },
    itemDetails: parseItemDetails(itemName, cells[0], itemAnchor.url, imageUrl, stats, slot),
  };
}

const sourceHtml = await fetch(sourceUrl).then((response) => {
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${sourceUrl}`);
  return response.text();
});
const tables = Array.from(sourceHtml.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => match[0]);
const basicRows = Array.from(tables[5].matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((match) => match[0]).slice(1);
const deityRows = Array.from(tables[6].matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((match) => match[0]).slice(1);
const parsed: ParsedRow[] = [];
const skipped: Record<string, unknown>[] = [];

for (const [index, row] of basicRows.entries()) {
  const result = parseBasicRow(row, index + 1);
  if ("skipped" in result) skipped.push({ table: "Basic", ...result.skipped });
  else parsed.push(result);
}

for (const [index, row] of deityRows.entries()) {
  const result = parseDeityRow(row, index + 1);
  if ("skipped" in result) skipped.push({ table: "Deity/Imbued", ...result.skipped });
  else parsed.push(result);
}

const craftingData = JSON.parse(await readFile(craftingPath, "utf8")) as CraftingEnvelope;
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const previousJewelcraft = craftingData.recipes.filter((recipe) => recipe.skill === "jewelcraft");
craftingData.recipes = [
  ...craftingData.recipes.filter((recipe) => recipe.skill !== "jewelcraft"),
  ...parsed.map((entry) => entry.recipe),
];

for (const entry of parsed) {
  itemDetails[entry.recipe.output.name] = entry.itemDetails;
}

const report = {
  sourceUrl,
  imported: parsed.length,
  basicImported: parsed.filter((entry) => entry.recipe.sourceMetadata?.jewelcraftType === "Basic").length,
  deityImported: parsed.filter((entry) => entry.recipe.sourceMetadata?.jewelcraftType === "Deity/Imbued").length,
  previousJewelcraftRecipesReplaced: previousJewelcraft.length,
  skipped,
  missingExactTrivial: parsed
    .filter((entry) => entry.recipe.trivial === null)
    .map((entry) => ({
      name: entry.recipe.name,
      trivialText: entry.recipe.sourceMetadata?.trivialText ?? null,
      type: entry.recipe.sourceMetadata?.jewelcraftType ?? null,
    })),
};

await writeFile(craftingPath, `${JSON.stringify(craftingData, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Imported ${report.imported} P99 Jewelcraft recipes (${report.basicImported} basic, ${report.deityImported} deity/imbued).`);
console.log(`Replaced ${report.previousJewelcraftRecipesReplaced} previous Jewelcraft recipes.`);
console.log(`Skipped ${skipped.length} rows.`);
console.log(`Rows without exact trivial: ${report.missingExactTrivial.length}.`);
console.log(`Wrote ${reportPath}`);
