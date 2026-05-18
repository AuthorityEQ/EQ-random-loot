import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CraftingRecipe = {
  id?: string;
  expansion?: string | null;
  skill: string;
  name: string;
  trivial: number | null;
  components: Array<{ name: string; count: number; imageUrl?: string | null; acquisitionType: "unknown"; componentType?: string; sizeVariants?: string[] }>;
  arrowMetadata?: {
    damage?: number | null;
    range?: number | null;
    cost?: string | null;
    point?: string | null;
    shaft?: string | null;
    fletch?: string | null;
    nockSize?: string | null;
    rangeOptions?: number[];
    unresolvedNockComponent?: boolean;
  };
  container: string;
  output: { name: string; count: number; imageUrl?: string | null };
  sizeVariants?: string[];
  notes?: string | null;
  sourceUrl?: string | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
};

type ItemDetails = Record<string, unknown>;

const root = process.cwd();
const p99BaseUrl = "https://wiki.project1999.com";
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-p99-import-report.json");
const badIngredientPattern = /\b(?:kiln\s+trivial|pottery\s+wheel\s+trivial|wheel\s+trivial|trivial)\b/i;
const sizeVariantPattern = /\(\s*S\s*\|\s*M\s*\|\s*L\s*\)/i;
const sizeVariantNames = ["Small", "Medium", "Large"];
const sizeVariantCodes = "S|M|L";
const targetSkills = [
  { skill: "baking", page: "Baking", defaultContainer: "Oven" },
  { skill: "smithing", page: "Blacksmithing", defaultContainer: "Forge" },
  { skill: "brewing", page: "Brewing", defaultContainer: "Brew Barrel" },
  { skill: "fletching", page: "Fletching", defaultContainer: "Fletching Kit" },
  { skill: "pottery", page: "Pottery", defaultContainer: "Pottery Wheel" },
  { skill: "tailoring", page: "Tailoring", defaultContainer: "Loom" },
  { skill: "tinkering", page: "Tinkering", defaultContainer: "Tinkering Kit" },
] as const;
const statKeys = new Set(["HP", "MP", "MANA", "AC", "STR", "STA", "DEX", "AGI", "INT", "WIS", "CHA", "MR", "DR", "PR", "FR", "CR"]);
const resistShorthand: Record<string, string> = {
  MR: "MR",
  DR: "DR",
  PR: "PR",
  FR: "FR",
  CR: "CR",
};
const slotShorthand: Record<string, string> = {
  P: "Primary",
  S: "Secondary",
  R: "Range",
};
const nockSizes = new Set(["small", "medium", "large"]);
const ignoredComponentHeaders = new Set([
  "item", "yield", "yields", "trivial", "p99 trivial", "classic trivial", "era", "use", "use/notes", "cost", "cost*", "cost to make",
  "hp", "mp", "mana", "ac", "str", "sta", "dex", "agi", "int", "wis", "cha", "mr", "dr", "pr", "fr", "cr", "slot",
  "resists", "slots",
  "s", "m", "l", "small", "medium", "large",
  "small wt", "medium wt", "large wt", "small weight", "medium weight", "large weight",
  "wt", "weight", "small", "medium", "large", "ratio", "range", "dmg", "damage", "delay", "cost(cp/20)", "cost (pp)", "class", "race", "rusty sell price*",
  "tarnished sell price*", "extra profit? * (not including stone)", "item stats", "description", "deity restriction",
  "creation spell", "spell caster class", "cultural tradeskills", "classes needed", "quest", "stackable",
]);
const containerHeaders = new Set(["container", "implements", "combine in", "created with"]);

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

function anchors(cellHtml: string) {
  return Array.from(cellHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      const href = decode(match[1]);
      return {
        name: clean(match[2]),
        url: href.startsWith("http") ? href : `${p99BaseUrl}${href}`,
      };
    })
    .filter((anchor) => anchor.name && !/^(S|M|L|\?)$/.test(anchor.name));
}

function firstImage(cellHtml: string) {
  const match = cellHtml.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
  if (!match) return null;
  const src = decode(match[1]);
  return src.startsWith("http") ? src : `${p99BaseUrl}${src}`;
}

function countPrefix(value: string) {
  const match = value.match(/^\s*(\d+)x?\s+(.+)$/i);
  return match ? { count: Number(match[1]), name: match[2].trim() } : { count: 1, name: value.trim() };
}

function parseSizeVariants(value: string) {
  return sizeVariantPattern.test(value) ? sizeVariantNames : [];
}

function stripSizeVariantShorthand(value: string) {
  return value.replace(sizeVariantPattern, "").replace(/\s+/g, " ").trim();
}

function normalizeSmithingSizeComponent(component: { name: string; count: number; imageUrl?: string | null; acquisitionType: "unknown"; componentType?: string; sizeVariants?: string[] }) {
  if (!parseSizeVariants(component.name).length) return component;
  return {
    ...component,
    name: stripSizeVariantShorthand(component.name),
    sizeVariants: sizeVariantNames,
    componentType: /mold|sectional|boot|gauntlet/i.test(component.name) ? "mold" : component.componentType ?? "ingredient",
  };
}

function parseTrivial(value: string) {
  const normalized = decode(value).replace(/\s+/g, " ").trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return null;
}

function parseSlotUsage(value: string) {
  const normalized = clean(value).toUpperCase();
  if (!/^[PSR](?:\/[PSR])*$/.test(normalized)) return [];
  return normalized.split("/").map((token) => slotShorthand[token]).filter(Boolean);
}

function parseResistShorthand(value: string) {
  const stats: Record<string, number> = {};
  for (const match of clean(value).matchAll(/([+-]?\d+)\s*(MR|DR|PR|FR|CR)\b/gi)) {
    stats[resistShorthand[match[2].toUpperCase()]] = Number(match[1]);
  }
  return stats;
}

function parseItemBlockStats(itemCell: string) {
  const text = clean(itemCell);
  const stats: Record<string, number> = {};
  const resists: Record<string, number> = {};
  for (const match of text.matchAll(/\b(STR|STA|DEX|AGI|INT|WIS|CHA|HP|MANA|AC|MR|DR|PR|FR|CR|SV FIRE|SV COLD|SV MAGIC|SV POISON|SV DISEASE)\s*:?\s*([+-]?\d+)/gi)) {
    const key = match[1].toUpperCase();
    const value = Number(match[2]);
    const mapped = key === "SV FIRE" ? "FR"
      : key === "SV COLD" ? "CR"
      : key === "SV MAGIC" ? "MR"
      : key === "SV POISON" ? "PR"
      : key === "SV DISEASE" ? "DR"
      : key;
    if (["MR", "DR", "PR", "FR", "CR"].includes(mapped)) resists[mapped] = value;
    else stats[mapped] = value;
  }
  return { stats, resists };
}

function formatStatSummary(stats: Record<string, number>) {
  return Object.entries(stats)
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => `${key} ${value >= 0 ? "+" : ""}${value}`)
    .join("|");
}

function parseItemBlockDeity(itemCell: string) {
  const text = clean(itemCell);
  return text.match(/\bDeity:\s*([A-Za-z' -]+?)(?:\s+(?:Slot|STR|STA|DEX|AGI|INT|WIS|CHA|HP|MANA|AC|WT|Class|Race):|$)/i)?.[1]?.trim() ?? "";
}

function inferExpansion(skill: string, rowText: string, tableText: string) {
  const haystack = `${rowText} ${tableText}`.toLowerCase();
  if (/\bvelium\b|\bvelious\b|\bcrystalline\b|\bice silk\b|\bothmir\b|\bwyvern\b|\bcobalt drake\b|\bhaze panther\b|\btigeraptor\b/.test(haystack)) return "Scars of Velious";
  if (/\biksar\b|\bcabilis\b|\bkunark\b/.test(haystack)) return "Ruins of Kunark";
  if (/\bluclin\b|\bacryl ia\b|\bshadeling\b|\bshade silk\b|\bgrimling\b/.test(haystack)) return "Shadows of Luclin";
  return "Classic";
}

function normalizeExpansionLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (/^(cla|classic)/i.test(normalized) || /^other$/i.test(normalized)) return "Classic";
  if (/^(vel|velious|scars of velious)/i.test(normalized)) return "Scars of Velious";
  if (/^(kun|kunark|ruins of kunark)/i.test(normalized)) return "Ruins of Kunark";
  if (/^(luc|luclin|shadows of luclin)/i.test(normalized)) return "Shadows of Luclin";
  return normalized;
}

function isPostLuclin(expansion: string) {
  return !["Classic", "Ruins of Kunark", "Scars of Velious", "Shadows of Luclin"].includes(expansion);
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueComponents(components: Array<{ name: string; count: number; imageUrl?: string | null; acquisitionType: "unknown"; componentType?: string }>) {
  const map = new Map<string, { name: string; count: number; imageUrl?: string | null; acquisitionType: "unknown"; componentType?: string }>();
  for (const component of components) {
    const key = component.name.toLowerCase();
    const existing = map.get(key);
    if (existing) existing.count += component.count;
    else map.set(key, component);
  }
  return Array.from(map.values());
}

function parseComponentsFromCell(cellHtml: string) {
  const found = anchors(cellHtml).map((anchor) => ({ name: anchor.name, count: 1, imageUrl: null, acquisitionType: "unknown" as const }));
  if (found.length > 0) {
    const cellText = clean(cellHtml);
    return found.map((component) => {
      const escaped = component.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const before = cellText.match(new RegExp(`(\\d+)x?\\s+${escaped}`, "i"));
      return { ...component, count: before ? Number(before[1]) : 1 };
    });
  }
  return clean(cellHtml)
    .split(/,|\+/)
    .map((part) => countPrefix(part))
    .filter((part) => part.name && !/^(none|n\/a|\?)$/i.test(part.name))
    .map((part) => ({ ...part, imageUrl: null, acquisitionType: "unknown" as const }));
}

function buildUnfiredName(name: string) {
  return /^unfired\b/i.test(name) || /^(clay\/water mixture|small block|block|large block)/i.test(name)
    ? name
    : `Unfired ${name}`;
}

function parsePotteryStageTable(page: string, tableHtml: string, tableIndex: number) {
  const rows = tableRows(tableHtml);
  const headerRowIndex = rows.findIndex((row) => {
    const headers = cells(row).map(clean).map(normalizeHeader);
    return headers.includes("wheel trivial") && headers.includes("kiln trivial");
  });
  if (headerRowIndex < 0) return null;
  const headerCells = cells(rows[headerRowIndex]).map(clean);
  const headers = headerCells.map(normalizeHeader);
  const itemIndex = headers.indexOf("item");
  const firingIndex = headers.indexOf("firing sheet");
  const wheelTrivialIndex = headers.indexOf("wheel trivial");
  const kilnTrivialIndex = headers.indexOf("kiln trivial");
  const wheelComponentIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => index !== itemIndex && index !== firingIndex && index !== wheelTrivialIndex && index !== kilnTrivialIndex && ["clay", "sketch", "water", "other"].includes(header));
  const recipes: CraftingRecipe[] = [];
  const itemDetails: Array<[string, ItemDetails]> = [];
  const skipped: Record<string, unknown>[] = [];
  const correctedMalformedComponents: Record<string, unknown>[] = [];

  for (const [rowOffset, rowHtml] of rows.slice(headerRowIndex + 1).entries()) {
    const rowCells = cells(rowHtml);
    if (rowCells.length !== headerCells.length) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, reason: `Header/cell mismatch: ${headerCells.length}/${rowCells.length}` });
      continue;
    }
    const itemAnchor = anchors(rowCells[itemIndex])[0];
    const itemName = itemAnchor?.name ?? clean(rowCells[itemIndex]).replace(/\s*\(Conversion\)\s*/i, "").trim();
    if (!itemName) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, reason: "Missing pottery item name." });
      continue;
    }
    const wheelTrivialText = clean(rowCells[wheelTrivialIndex]);
    const kilnTrivialText = clean(rowCells[kilnTrivialIndex]);
    const wheelTrivial = parseTrivial(wheelTrivialText);
    const kilnTrivial = parseTrivial(kilnTrivialText);
    const firingSheetComponents = parseComponentsFromCell(rowCells[firingIndex]);
    const wheelIngredients = uniqueComponents(wheelComponentIndexes.flatMap(({ index }) => parseComponentsFromCell(rowCells[index])))
      .filter((component) => !badIngredientPattern.test(component.name));
    const kilnIngredients = uniqueComponents([
      ...(kilnTrivial !== null && firingSheetComponents.length > 0 ? [{ name: buildUnfiredName(itemName), count: 1, imageUrl: null, acquisitionType: "unknown" as const }] : []),
      ...firingSheetComponents,
    ]).filter((component) => !badIngredientPattern.test(component.name));
    const components = uniqueComponents([...wheelIngredients, ...firingSheetComponents]).filter((component) => !badIngredientPattern.test(component.name));
    if (components.length === 0) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, itemName, reason: "No pottery components could be parsed safely." });
      continue;
    }
    if (kilnTrivial !== null && firingSheetComponents.length > 0) {
      correctedMalformedComponents.push({
        recipe: itemName,
        badParsedText: `${kilnTrivial}x Kiln Trivial`,
        corrected: "Moved Kiln Trivial into sourceMetadata.kilnTrivial and kept firing sheet as the kiln ingredient.",
      });
    }
    const finalTrivial = kilnTrivial ?? wheelTrivial;
    const sourceUrl = itemAnchor?.url ?? `${p99BaseUrl}/${encodeURIComponent(itemName.replace(/\s+/g, "_"))}`;
    const outputImage = firstImage(rowCells[itemIndex]);
    const recipe: CraftingRecipe = {
      id: `p99-pottery-stage-${tableIndex}-${rowOffset + 1}`,
      expansion: inferExpansion("pottery", clean(rowHtml), clean(tableHtml)),
      skill: "pottery",
      name: itemName,
      trivial: finalTrivial,
      components,
      container: kilnTrivial !== null ? "Pottery Wheel / Kiln" : "Pottery Wheel",
      output: { name: itemName, count: 1, imageUrl: outputImage },
      notes: kilnTrivial !== null ? "Two-stage pottery combine: create the unfired item on a pottery wheel, then fire it in a kiln." : null,
      sourceUrl,
      sourceMetadata: {
        source: "Project1999 Wiki",
        p99Page: page,
        p99ItemUrl: sourceUrl,
        tableIndex,
        row: rowOffset + 1,
        potteryTwoStage: kilnTrivial !== null,
        potteryWheelTrivial: wheelTrivial,
        kilnTrivial,
        finalTrivial,
        potteryWheelIngredients: wheelIngredients.map((component) => `${component.count}x ${component.name}`).join("|"),
        kilnIngredients: kilnIngredients.map((component) => `${component.count}x ${component.name}`).join("|"),
        station: kilnTrivial !== null ? "Pottery Wheel / Kiln" : "Pottery Wheel",
        trivialText: wheelTrivialText,
        kilnTrivialText,
        postLuclin: false,
      },
    };
    recipes.push(recipe);
    itemDetails.push([itemName, {
      name: itemName,
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
      iconPath: outputImage,
      sources: [{ name: "Project1999 Wiki", url: sourceUrl }],
      expansion: recipe.expansion,
      confidence: "exact_match",
      match_confidence: "exact_match",
      match_notes: [`Imported from Project1999 ${page} two-stage pottery table.`],
      missing_core_stats: false,
      duplicate_name_risk: false,
      parsing_warnings: [],
    }]);
  }

  return { recipes, itemDetails, skipped, correctedMalformedComponents };
}

function parsePotteryIdolTable(page: string, tableHtml: string, tableIndex: number) {
  const rows = tableRows(tableHtml);
  const headerRowIndex = rows.findIndex((row) => {
    const headers = cells(row).map(clean).map(normalizeHeader);
    return headers.includes("imbued gem") && headers.includes("resists") && headers.includes("slots");
  });
  if (headerRowIndex < 0) return null;

  const headerCells = cells(rows[headerRowIndex]).map(clean);
  const headers = headerCells.map(normalizeHeader);
  const itemIndex = headers.indexOf("item");
  const gemIndex = headers.indexOf("imbued gem");
  const trivialIndex = headers.findIndex((header) => header === "triv" || header.includes("trivial"));
  const resistsIndex = headers.indexOf("resists");
  const slotsIndex = headers.indexOf("slots");
  const statColumnIndexes = headers
    .map((header, index) => ({ header: header.toUpperCase(), index }))
    .filter(({ header }) => ["STR", "STA", "DEX", "AGI", "INT", "WIS", "CHA"].includes(header));

  if (itemIndex < 0 || gemIndex < 0 || trivialIndex < 0 || resistsIndex < 0 || slotsIndex < 0) return null;

  const recipes: CraftingRecipe[] = [];
  const itemDetails: Array<[string, ItemDetails]> = [];
  const skipped: Record<string, unknown>[] = [];
  const correctedMalformedComponents: Record<string, unknown>[] = [];

  for (const [rowOffset, rowHtml] of rows.slice(headerRowIndex + 1).entries()) {
    const rowCells = cells(rowHtml);
    if (rowCells.length !== headerCells.length) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, reason: `Header/cell mismatch: ${headerCells.length}/${rowCells.length}` });
      continue;
    }

    const itemAnchor = anchors(rowCells[itemIndex])[0];
    const itemName = itemAnchor?.name ?? clean(rowCells[itemIndex]).trim();
    const gemAnchor = anchors(rowCells[gemIndex])[0];
    const gemName = gemAnchor?.name ?? clean(rowCells[gemIndex]);
    if (!itemName || !gemName) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, itemName, reason: "Missing idol item name or imbued gem." });
      continue;
    }

    const trivialText = clean(rowCells[trivialIndex]);
    const trivial = parseTrivial(trivialText);
    const slotText = clean(rowCells[slotsIndex]);
    const slotUsage = parseSlotUsage(slotText);
    const resistText = clean(rowCells[resistsIndex]);
    const resists = parseResistShorthand(resistText);
    const itemBlockStats = parseItemBlockStats(rowCells[itemIndex]);
    const stats: Record<string, number> = { ...itemBlockStats.stats };
    for (const { header, index } of statColumnIndexes) {
      const value = Number(clean(rowCells[index]));
      if (Number.isFinite(value) && value !== 0) stats[header] = value;
    }
    const deity = parseItemBlockDeity(rowCells[itemIndex]);
    const sourceUrl = itemAnchor?.url ?? `${p99BaseUrl}/${encodeURIComponent(itemName.replace(/\s+/g, "_"))}`;
    const outputImage = firstImage(rowCells[itemIndex]);

    if (slotText) {
      correctedMalformedComponents.push({
        recipe: itemName,
        badParsedText: slotText,
        corrected: "Moved Pottery idol slot shorthand into sourceMetadata.slotUsage.",
      });
    }
    if (resistText) {
      correctedMalformedComponents.push({
        recipe: itemName,
        badParsedText: resistText,
        corrected: "Moved Pottery idol resist shorthand into sourceMetadata.p99ResistSummary.",
      });
    }

    const recipe: CraftingRecipe = {
      id: `p99-pottery-idol-${tableIndex}-${rowOffset + 1}`,
      expansion: "Classic",
      skill: "pottery",
      name: itemName,
      trivial,
      components: [{ name: gemName, count: 1, imageUrl: null, acquisitionType: "unknown", componentType: "ingredient" }],
      container: "Pottery Wheel",
      output: { name: itemName, count: 1, imageUrl: outputImage },
      notes: null,
      sourceUrl,
      sourceMetadata: {
        source: "Project1999 Wiki",
        p99Page: page,
        p99ItemUrl: sourceUrl,
        tableIndex,
        row: rowOffset + 1,
        potteryIdol: true,
        gem: gemName,
        deity: deity || null,
        slotUsage: slotUsage.join("|"),
        slotUsageText: slotText,
        p99StatSummary: formatStatSummary(stats),
        p99ResistSummary: formatStatSummary(resists),
        resistText,
        trivialText,
        postLuclin: false,
      },
    };

    recipes.push(recipe);
    itemDetails.push([itemName, {
      name: itemName,
      slot: slotUsage.join(" ") || null,
      ac: itemBlockStats.stats.AC ?? null,
      damage: null,
      delay: null,
      stats,
      resists,
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
      item_type: "Pottery Idol",
      stackable: null,
      weight_reduction: null,
      capacity: null,
      size_capacity: null,
      lore: /\bLORE ITEM\b/i.test(clean(rowCells[itemIndex])),
      magic: /\bMAGIC ITEM\b/i.test(clean(rowCells[itemIndex])),
      no_drop: /\bNO DROP\b/i.test(clean(rowCells[itemIndex])),
      prestige: null,
      aug_slots: [],
      iconPath: outputImage,
      sources: [{ name: "Project1999 Wiki", url: sourceUrl }],
      expansion: recipe.expansion,
      confidence: "exact_match",
      match_confidence: "exact_match",
      match_notes: ["Imported from Project1999 Pottery idol table; P99 slot/stat shorthand is used instead of live-era Allakhazam stats."],
      missing_core_stats: false,
      duplicate_name_risk: false,
      parsing_warnings: [],
    }]);
  }

  return { recipes, itemDetails, skipped, correctedMalformedComponents };
}

function parseFletchingArrowTable(page: string, tableHtml: string, tableIndex: number) {
  const rows = tableRows(tableHtml);
  const headerRowIndex = rows.findIndex((row) => {
    const headers = cells(row).map(clean).map(normalizeHeader);
    return headers.includes("point")
      && headers.includes("shaft")
      && headers.includes("fletch")
      && headers.includes("nock")
      && headers.some((header) => header === "dmg" || header === "damage")
      && headers.includes("range");
  });
  if (headerRowIndex < 0) return null;
  const headerCells = cells(rows[headerRowIndex]).map(clean);
  const headers = headerCells.map(normalizeHeader);
  const itemIndex = headers.findIndex((header) => /\bitem\b|\barrow recipes\b/.test(header));
  const damageIndex = headers.findIndex((header) => header === "dmg" || header === "damage");
  const rangeIndex = headers.indexOf("range");
  const trivialIndex = headers.findIndex((header) => header.includes("trivial") || header === "triv");
  const costIndex = headers.indexOf("cost");
  const pointIndex = headers.indexOf("point");
  const shaftIndex = headers.indexOf("shaft");
  const fletchIndex = headers.indexOf("fletch");
  const nockIndex = headers.indexOf("nock");
  if ([itemIndex, pointIndex, shaftIndex, fletchIndex, nockIndex].some((index) => index < 0)) return null;

  const recipes: CraftingRecipe[] = [];
  const details: Array<[string, ItemDetails]> = [];
  const skipped: Record<string, unknown>[] = [];
  const correctedMalformedComponents: Record<string, unknown>[] = [];
  const tableText = clean(tableHtml);

  for (const [rowOffset, rowHtml] of rows.slice(headerRowIndex + 1).entries()) {
    const rowCells = cells(rowHtml);
    if (rowCells.length !== headerCells.length) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, reason: `Header/cell mismatch: ${headerCells.length}/${rowCells.length}` });
      continue;
    }
    const itemAnchor = anchors(rowCells[itemIndex])[0];
    const itemName = itemAnchor?.name ?? clean(rowCells[itemIndex]).trim();
    if (!itemName || itemName.length > 90) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, itemName, reason: "Missing or suspicious arrow item name." });
      continue;
    }
    const point = clean(rowCells[pointIndex]);
    const shaft = clean(rowCells[shaftIndex]);
    const fletch = clean(rowCells[fletchIndex]);
    const nockSize = clean(rowCells[nockIndex]);
    const components = [point, shaft, fletch]
      .filter((name) => name && !/^(0|none|n\/a|\?)$/i.test(name))
      .map((name) => ({ name, count: 1, imageUrl: null, acquisitionType: "unknown" as const, componentType: "ingredient" }));
    if (components.length === 0) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, itemName, reason: "No arrow point/shaft/fletch components could be parsed safely." });
      continue;
    }
    if (nockSizes.has(nockSize.toLowerCase())) {
      correctedMalformedComponents.push({
        page,
        tableIndex,
        row: rowOffset + 1,
        itemName,
        badParsedText: nockSize,
        corrected: "Moved P99 Fletching Nock column into arrowMetadata.nockSize instead of treating it as an ingredient.",
      });
    }
    const trivialText = trivialIndex >= 0 ? clean(rowCells[trivialIndex]) : "";
    const damage = damageIndex >= 0 ? Number(clean(rowCells[damageIndex]).match(/\d+/)?.[0] ?? NaN) : NaN;
    const range = rangeIndex >= 0 ? Number(clean(rowCells[rangeIndex]).match(/\d+/)?.[0] ?? NaN) : NaN;
    const cost = costIndex >= 0 ? clean(rowCells[costIndex]) : "";
    const expansion = inferExpansion("fletching", clean(rowHtml), tableText);
    const itemUrl = itemAnchor?.url ?? `${p99BaseUrl}/${encodeURIComponent(itemName.replace(/\s+/g, "_"))}`;
    const outputImage = firstImage(rowCells[itemIndex]);
    const recipe: CraftingRecipe = {
      id: `p99-fletching-${tableIndex}-${rowOffset + 1}`,
      expansion,
      skill: "fletching",
      name: itemName,
      trivial: parseTrivial(trivialText),
      components,
      container: "Fletching Kit",
      output: { name: itemName, count: 1, imageUrl: outputImage },
      arrowMetadata: {
        damage: Number.isFinite(damage) ? damage : null,
        range: Number.isFinite(range) ? range : null,
        cost: cost || null,
        point,
        shaft,
        fletch,
        nockSize: nockSize || null,
        unresolvedNockComponent: Boolean(nockSize),
      },
      notes: null,
      sourceUrl: itemUrl,
      sourceMetadata: {
        source: "Project1999 Wiki",
        p99Page: page,
        p99ItemUrl: itemUrl,
        tableIndex,
        row: rowOffset + 1,
        trivialText,
        arrowTable: true,
        arrowPoint: point,
        arrowShaft: shaft,
        arrowFletch: fletch,
        arrowNockSize: nockSize,
        arrowDamage: Number.isFinite(damage) ? damage : null,
        arrowRange: Number.isFinite(range) ? range : null,
        arrowCost: cost || null,
        unresolvedNockComponent: Boolean(nockSize),
        postLuclin: isPostLuclin(expansion),
      },
    };
    recipes.push(recipe);
    details.push([itemName, {
      name: itemName,
      slot: clean(rowCells[itemIndex]).match(/\bSlot:\s*([^\n]+)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "AMMO",
      ac: null,
      damage: recipe.arrowMetadata?.damage ?? null,
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
      size: "SMALL",
      item_type: "Arrow",
      stackable: null,
      weight_reduction: null,
      capacity: null,
      size_capacity: null,
      lore: false,
      magic: false,
      no_drop: false,
      prestige: null,
      aug_slots: [],
      iconPath: outputImage,
      sources: [{ name: "Project1999 Wiki", url: itemUrl }],
      expansion,
      confidence: "exact_match",
      match_confidence: "exact_match",
      match_notes: ["Imported from Project1999 Fletching arrow table; nock column is metadata, not a standalone ingredient."],
      missing_core_stats: false,
      duplicate_name_risk: false,
      parsing_warnings: [],
    }]);
  }

  return { recipes, itemDetails: details, skipped, correctedMalformedComponents };
}

function parseGenericTable(skill: string, page: string, tableHtml: string, tableIndex: number, defaultContainer: string) {
  if (skill === "pottery") {
    const staged = parsePotteryStageTable(page, tableHtml, tableIndex);
    if (staged) return staged;
    const idol = parsePotteryIdolTable(page, tableHtml, tableIndex);
    if (idol) return idol;
  }
  if (skill === "fletching") {
    const arrows = parseFletchingArrowTable(page, tableHtml, tableIndex);
    if (arrows) return arrows;
  }
  const rows = tableRows(tableHtml);
  if (rows.length < 2) return { recipes: [] as CraftingRecipe[], itemDetails: [] as Array<[string, ItemDetails]>, skipped: [] as Record<string, unknown>[], correctedMalformedComponents: [] as Record<string, unknown>[] };
  const headerRowIndex = rows.findIndex((row) => {
    const rowHeaders = cells(row).map(clean).map(normalizeHeader);
    return rowHeaders.some((header) => /\bitem\b|\brecipe\b|bow recipes|arrow recipes|miscellaneous|bags/.test(header))
      && (rowHeaders.some((header) => header.includes("trivial") || header === "triv") || rowHeaders.some((header) => header.includes("ingredient") || header.includes("component")));
  });
  if (headerRowIndex < 0) return { recipes: [] as CraftingRecipe[], itemDetails: [], skipped: [], correctedMalformedComponents: [] };
  const headerCells = cells(rows[headerRowIndex]).map(clean);
  const headers = headerCells.map(normalizeHeader);
  const itemIndex = headers.findIndex((header) => /\bitem\b|\brecipe\b|bow recipes|arrow recipes|miscellaneous|bags/.test(header));
  if (itemIndex < 0) return { recipes: [] as CraftingRecipe[], itemDetails: [], skipped: [], correctedMalformedComponents: [] };
  const trivialIndex = headers.findIndex((header) => header.includes("trivial") || header === "triv" || header.includes("wheel trivial"));
  const classicTrivialIndex = headers.findIndex((header) => header.includes("classic trivial"));
  const eraIndex = headers.findIndex((header) => header === "era");
  const containerIndex = headers.findIndex((header) => containerHeaders.has(header));
  const componentColumns = headers
    .map((header, index) => ({ header, index, label: headerCells[index] }))
    .filter(({ header, index }) => index !== itemIndex && index !== trivialIndex && index !== classicTrivialIndex && index !== eraIndex && index !== containerIndex && !ignoredComponentHeaders.has(header))
    .filter(({ header }) => header.includes("ingredient") || header.includes("component") || !statKeys.has(header.toUpperCase()));
  const explicitComponentIndex = headers.findIndex((header) => header.includes("ingredient") || header.includes("component"));
  const recipes: CraftingRecipe[] = [];
  const details: Array<[string, ItemDetails]> = [];
  const skipped: Record<string, unknown>[] = [];
  const tableText = clean(tableHtml);

  for (const [rowOffset, rowHtml] of rows.slice(headerRowIndex + 1).entries()) {
    const rowCells = cells(rowHtml);
    if (rowCells.length !== headerCells.length) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, reason: `Header/cell mismatch: ${headerCells.length}/${rowCells.length}` });
      continue;
    }
    const itemAnchor = anchors(rowCells[itemIndex])[0];
    const rawItemName = itemAnchor?.name ?? clean(rowCells[itemIndex]).replace(/\s+Slot:.+$/i, "").trim();
    const sizeVariants = skill === "smithing" ? parseSizeVariants(rawItemName) : [];
    const itemName = sizeVariants.length ? stripSizeVariantShorthand(rawItemName) : rawItemName;
    if (!itemName || itemName.length > 90) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, reason: "Missing or suspicious item name.", itemName });
      continue;
    }
    if (/^(total|both\s+|visible set)/i.test(itemName)) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, itemName, reason: "Skipped aggregate summary row." });
      continue;
    }
    const itemUrl = itemAnchor?.url ?? `${p99BaseUrl}/${encodeURIComponent((rawItemName || itemName).replace(/\s+/g, "_"))}`;
    const outputImage = firstImage(rowCells[itemIndex]);
    const trivialText = trivialIndex >= 0 ? clean(rowCells[trivialIndex]) : "";
    const classicTrivialText = classicTrivialIndex >= 0 ? clean(rowCells[classicTrivialIndex]) : "";
    const trivial = parseTrivial(trivialText) ?? parseTrivial(classicTrivialText);
    const expansion = eraIndex >= 0 && clean(rowCells[eraIndex])
      ? normalizeExpansionLabel(clean(rowCells[eraIndex]))
      : inferExpansion(skill, clean(rowHtml), tableText);
    const container = containerIndex >= 0 && clean(rowCells[containerIndex])
      ? clean(rowCells[containerIndex]).replace(/\s*,\s*/g, " / ")
      : defaultContainer;
    let components = explicitComponentIndex >= 0
      ? parseComponentsFromCell(rowCells[explicitComponentIndex])
      : [];
    if (components.length === 0) {
      for (const column of componentColumns) {
        const cellText = clean(rowCells[column.index]);
        if (!cellText || /^(0|none|n\/a|\?)$/i.test(cellText)) continue;
        const linked = parseComponentsFromCell(rowCells[column.index]);
        if (linked.length > 0 && anchors(rowCells[column.index]).length > 0) components.push(...linked);
        else if (/^\d+$/.test(cellText)) components.push({ name: column.label, count: Number(cellText), imageUrl: null, acquisitionType: "unknown" });
        else components.push(...parseComponentsFromCell(rowCells[column.index]));
      }
    }
    components = uniqueComponents(components)
      .map((component) => skill === "smithing" ? normalizeSmithingSizeComponent(component) : component)
      .filter((component) => component.name !== itemName)
      .filter((component) => !(skill === "smithing" && sizeVariants.length > 0 && /^\d+(?:\.\d+)?$/.test(component.name)))
      .filter((component) => !sizeVariantPattern.test(component.name));
    if (components.length === 0) {
      skipped.push({ page, tableIndex, row: rowOffset + 1, itemName, reason: "No components could be parsed safely." });
      continue;
    }
    const notes = [
      isPostLuclin(expansion) ? "Post-Luclin recipe; verify era availability before using on early progression." : null,
      !trivial && (trivialText || classicTrivialText) ? `P99 trivial listed as "${trivialText || classicTrivialText}"; exact value not inferred.` : null,
    ].filter(Boolean).join(" ");
    const recipe: CraftingRecipe = {
      id: `p99-${skill}-${tableIndex}-${rowOffset + 1}`,
      expansion,
      skill,
      name: itemName,
      trivial,
      components,
      container,
      output: { name: itemName, count: 1, imageUrl: outputImage },
      sizeVariants: sizeVariants.length ? sizeVariants : undefined,
      notes: notes || null,
      sourceUrl: itemUrl,
      sourceMetadata: {
        source: "Project1999 Wiki",
        p99Page: page,
        p99ItemUrl: itemUrl,
        rawP99Name: sizeVariants.length ? rawItemName : null,
        sizeVariantCodes: sizeVariants.length ? sizeVariantCodes : null,
        sizeVariants: sizeVariants.length ? sizeVariants.join("|") : null,
        // TODO: Future Smithing enrichment can split size-specific molds/items,
        // add race-size compatibility, and attach exact mold links per size.
        tableIndex,
        row: rowOffset + 1,
        trivialText,
        classicTrivialText,
        postLuclin: isPostLuclin(expansion),
      },
    };
    recipes.push(recipe);
    details.push([itemName, {
      name: itemName,
      slot: clean(rowCells[itemIndex]).match(/\bSlot:\s*([^\n]+)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null,
      ac: Number(clean(rowCells[itemIndex]).match(/\bAC:\s*(\d+)/i)?.[1] ?? NaN) || null,
      damage: Number(clean(rowCells[itemIndex]).match(/\b(?:DMG|Damage):\s*(\d+)/i)?.[1] ?? NaN) || null,
      delay: Number(clean(rowCells[itemIndex]).match(/\bDelay:\s*(\d+)/i)?.[1] ?? NaN) || null,
      stats: {},
      resists: {},
      haste: null,
      worn_effects: [],
      focus_effects: [],
      click_effects: [],
      proc_effects: [],
      required_level: null,
      recommended_level: null,
      classes: clean(rowCells[itemIndex]).match(/\bClass:\s*ALL\b/i) ? ["ALL"] : [],
      races: clean(rowCells[itemIndex]).match(/\bRace:\s*ALL\b/i) ? ["ALL"] : [],
      weight: Number(clean(rowCells[itemIndex]).match(/\bWT:\s*(\d+(?:\.\d+)?)/i)?.[1] ?? NaN) || null,
      size: clean(rowCells[itemIndex]).match(/\bSize:\s*([A-Z]+)/i)?.[1] ?? null,
      item_type: null,
      stackable: null,
      weight_reduction: null,
      capacity: null,
      size_capacity: null,
      lore: /\bLORE ITEM\b/i.test(clean(rowCells[itemIndex])),
      magic: /\bMAGIC ITEM\b/i.test(clean(rowCells[itemIndex])),
      no_drop: /\bNO DROP\b/i.test(clean(rowCells[itemIndex])),
      prestige: null,
      aug_slots: [],
      iconPath: outputImage,
      sources: [{ name: "Project1999 Wiki", url: itemUrl }],
      expansion,
      confidence: "exact_match",
      match_confidence: "exact_match",
      match_notes: [`Imported from Project1999 ${page}.`],
      missing_core_stats: false,
      duplicate_name_risk: false,
      parsing_warnings: [],
    }]);
  }

  return { recipes, itemDetails: details, skipped, correctedMalformedComponents: [] };
}

const craftingData = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: CraftingRecipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const allImported: CraftingRecipe[] = [];
const allSkipped: Record<string, unknown>[] = [];
const report = {
  source: "Project1999 Wiki tradeskill pages",
  importedBySkill: {} as Record<string, number>,
  replacedBySkill: {} as Record<string, number>,
  missingExactTrivial: [] as Record<string, unknown>[],
  skipped: allSkipped,
  correctedMalformedComponents: [] as Record<string, unknown>[],
  postLuclinVisible: [] as Record<string, unknown>[],
};

for (const config of targetSkills) {
  const url = `${p99BaseUrl}/${config.page}`;
  const html = await fetch(url).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
    return response.text();
  });
  const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => match[0]);
  const skillRecipes: CraftingRecipe[] = [];
  const before = craftingData.recipes.filter((recipe) => recipe.skill === config.skill).length;
  for (const [tableIndex, tableHtml] of tables.entries()) {
    if (config.skill === "fletching" && ![3, 5].includes(tableIndex)) continue;
    const parsed = parseGenericTable(config.skill, config.page, tableHtml, tableIndex, config.defaultContainer);
    skillRecipes.push(...parsed.recipes);
    allSkipped.push(...parsed.skipped);
    report.correctedMalformedComponents.push(...parsed.correctedMalformedComponents);
    for (const [name, details] of parsed.itemDetails) {
      itemDetails[name] = { ...(itemDetails[name] ?? {}), ...details };
    }
  }
  report.importedBySkill[config.skill] = skillRecipes.length;
  report.replacedBySkill[config.skill] = before;
  allImported.push(...skillRecipes);
}

craftingData.recipes = [
  ...craftingData.recipes.filter((recipe) => !targetSkills.some((config) => config.skill === recipe.skill)),
  ...allImported,
];
report.missingExactTrivial = allImported
  .filter((recipe) => recipe.trivial === null)
  .map((recipe) => ({
    skill: recipe.skill,
    name: recipe.name,
    trivialText: recipe.sourceMetadata?.trivialText ?? null,
    sourceUrl: recipe.sourceUrl ?? null,
  }));
report.postLuclinVisible = allImported
  .filter((recipe) => Boolean(recipe.sourceMetadata?.postLuclin))
  .map((recipe) => ({ skill: recipe.skill, name: recipe.name, expansion: recipe.expansion, sourceUrl: recipe.sourceUrl }));

await writeFile(craftingPath, `${JSON.stringify(craftingData, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Imported ${allImported.length} recipes from P99.`);
for (const [skill, count] of Object.entries(report.importedBySkill)) console.log(`${skill}: ${count}`);
console.log(`Skipped ${allSkipped.length} rows.`);
console.log(`Missing exact trivial: ${report.missingExactTrivial.length}`);
console.log(`Post-Luclin visible: ${report.postLuclinVisible.length}`);
console.log(`Wrote ${reportPath}`);
