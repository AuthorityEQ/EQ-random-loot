import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SizeName = "Small" | "Medium" | "Large";

type Component = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: string;
  componentType?: string;
  sizeVariants?: string[];
  sizeVariantDetails?: Record<string, VariantComponentDetail>;
};

type VariantComponentDetail = {
  name: string;
  sourceUrl?: string | null;
  allakhazamUrl?: string | null;
  imageUrl?: string | null;
};

type VariantRecipeDetail = {
  output: {
    name: string;
    sourceUrl?: string | null;
    allakhazamUrl?: string | null;
    imageUrl?: string | null;
    ac?: number | null;
    weight?: number | null;
  };
  components: Record<string, VariantComponentDetail>;
};

type Recipe = {
  id?: string;
  skill: string;
  name: string;
  trivial: number | null;
  components: Component[];
  output: { name: string; count: number; imageUrl?: string | null };
  sizeVariants?: string[];
  sizeVariantDetails?: Record<string, VariantRecipeDetail>;
  sourceMetadata?: Record<string, unknown>;
};

type ItemDetails = Record<string, unknown> & {
  name?: string;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
  iconPath?: string | null;
  sourceUrl?: string | null;
};

type LinkDetail = {
  code: "S" | "M" | "L";
  size: SizeName;
  name: string;
  url: string;
  imageUrl?: string | null;
};

type SizeRow = {
  tableIndex: number;
  row: number;
  output: LinkDetail[];
  mold: LinkDetail[];
  ac: number | null;
  weights: Record<SizeName, number | null>;
};

const root = process.cwd();
const p99BaseUrl = "https://wiki.project1999.com";
const blacksmithingUrl = `${p99BaseUrl}/Skill_Blacksmithing`;
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-smithing-size-variant-enrichment-report.json");
const sizeByCode: Record<"S" | "M" | "L", SizeName> = { S: "Small", M: "Medium", L: "Large" };

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

function nameFromP99Url(url: string) {
  const tail = decodeURIComponent(url.split("/").pop() ?? "").replace(/_/g, " ").trim();
  return tail.replace(/\s+/g, " ");
}

function linkedSizeVariants(cellHtml: string): LinkDetail[] {
  return Array.from(cellHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>\s*([SML])\s*<\/a>/gi))
    .map((match) => {
      const code = match[2].toUpperCase() as "S" | "M" | "L";
      const url = absoluteP99Url(match[1]);
      return {
        code,
        size: sizeByCode[code],
        name: nameFromP99Url(url),
        url,
      };
    });
}

function numberAt(cellHtml: string) {
  const value = Number(clean(cellHtml).match(/\d+(?:\.\d+)?/)?.[0] ?? NaN);
  return Number.isFinite(value) ? value : null;
}

function absoluteImageUrl(src: string) {
  const decoded = decode(src);
  return decoded.startsWith("http") ? decoded : `${p99BaseUrl}${decoded.startsWith("/") ? "" : "/"}${decoded}`;
}

function isRejectedIconUrl(url: unknown) {
  return typeof url === "string" && (
    /auctiontracker/i.test(url)
    || /\/skins\//i.test(url)
    || /\/images\/thumb\/(?!Item_\d+\.png\/)/i.test(url)
    || /(?:chart|graph|price|screenshot|poweredby|logo)/i.test(url)
  );
}

function normalizedP99ItemIconUrl(src: string) {
  const absolute = absoluteImageUrl(src);
  if (/^https?:\/\/wiki\.project1999\.com\/images\/Item_\d+\.png$/i.test(absolute)) return absolute;
  const thumb = absolute.match(/^https?:\/\/wiki\.project1999\.com\/images\/thumb\/(Item_\d+\.png)\/\d+px-\1$/i);
  return thumb ? `${p99BaseUrl}/images/${thumb[1]}` : null;
}

function itemIconFromPage(html: string, itemName: string, pageUrl: string, rejectedImages: Array<Record<string, unknown>>, genericIconItems: Array<Record<string, unknown>>) {
  const images = Array.from(html.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi))
    .map((match) => ({ rawSrc: match[1], url: absoluteImageUrl(match[1]) }));
  const icon = images.map((image) => normalizedP99ItemIconUrl(image.rawSrc)).find(Boolean) ?? null;
  for (const image of images) {
    if (normalizedP99ItemIconUrl(image.rawSrc)) continue;
    rejectedImages.push({
      itemName,
      pageUrl,
      imageUrl: image.url,
      reason: isRejectedIconUrl(image.url)
        ? "Rejected non-item image from P99 page."
        : "Rejected image because it does not match the P99 Item_####.png icon pattern.",
    });
  }
  if (!icon) genericIconItems.push({ itemName, pageUrl, reason: "No reliable P99 item icon was found; UI should use generic placeholder." });
  return icon;
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "FrostreaverLootReference/0.2 (+local P99 smithing size enrichment)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
  return response.text();
}

function mergeSource(details: ItemDetails, source: { name: string; url: string }) {
  const sources = details.sources ?? [];
  return sources.some((entry) => entry.url === source.url) ? sources : [...sources, source];
}

function mergeNote(details: ItemDetails, note: string) {
  const notes = details.match_notes ?? [];
  return notes.includes(note) ? notes : [...notes, note];
}

function allakhazamUrlFromDetails(details: ItemDetails) {
  if (typeof details.sourceUrl === "string" && /everquest\.allakhazam\.com/i.test(details.sourceUrl)) return details.sourceUrl;
  return details.sources?.find((source) => /everquest\.allakhazam\.com/i.test(source.url))?.url ?? null;
}

function withItemDetailDefaults(name: string, existing: ItemDetails, sourceUrl: string, imageUrl: string | null, ac: number | null, weight: number | null, size: SizeName | null, itemType: string): ItemDetails {
  return {
    name: existing.name ?? name,
    itemId: existing.itemId ?? null,
    sourceUrl: existing.sourceUrl ?? sourceUrl,
    slot: existing.slot ?? null,
    ac: existing.ac ?? ac,
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
    weight: existing.weight ?? weight,
    size: existing.size ?? (size ? size.toUpperCase() : null),
    item_type: existing.item_type ?? itemType,
    itemType: existing.itemType ?? itemType,
    stackable: existing.stackable ?? null,
    weight_reduction: existing.weight_reduction ?? null,
    capacity: existing.capacity ?? null,
    size_capacity: existing.size_capacity ?? null,
    lore: existing.lore ?? false,
    magic: existing.magic ?? false,
    no_drop: existing.no_drop ?? false,
    prestige: existing.prestige ?? null,
    aug_slots: existing.aug_slots ?? [],
    iconPath: isRejectedIconUrl(existing.iconPath) ? imageUrl : existing.iconPath ?? imageUrl,
    icon: existing.icon ?? null,
    icon_url: existing.icon_url ?? null,
    sources: mergeSource(existing, { name: "Project1999 Wiki", url: sourceUrl }),
    confidence: existing.confidence ?? "exact_match",
    match_confidence: existing.match_confidence ?? "exact_match",
    match_notes: mergeNote(existing, "Smithing size-specific item details linked from the P99 Blacksmithing S/M/L table."),
    missing_core_stats: existing.missing_core_stats ?? false,
    duplicate_name_risk: existing.duplicate_name_risk ?? false,
    parsing_warnings: existing.parsing_warnings ?? [],
    expansion: existing.expansion ?? "Classic",
  };
}

function parseSizeRows(html: string) {
  const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => match[0]);
  const rowsByKey = new Map<string, SizeRow>();
  for (const [tableIndex, tableHtml] of tables.entries()) {
    const rows = tableRows(tableHtml);
    const headerRowIndex = rows.findIndex((row) => {
      const headers = cells(row).map(clean).map(normalizeHeader);
      return headers.some((header) => header.includes("wt. small") || header === "wt small" || header === "wt. s" || header === "wt s")
        || (headers.includes("wt") && headers.includes("small") && headers.includes("medium") && headers.includes("large"));
    });
    if (headerRowIndex < 0) continue;
    const headerCells = cells(rows[headerRowIndex]).map(clean);
    const headers = headerCells.map(normalizeHeader);
    const itemIndex = headers.findIndex((header) => header.includes("item"));
    const moldIndex = headers.findIndex((header) => header === "mold" || header.includes("pattern"));
    const acIndex = headers.indexOf("ac");
    const smallWeightIndex = headers.findIndex((header) => header.includes("wt. small") || header === "wt small" || header === "wt. s" || header === "wt s" || header === "small");
    const mediumWeightIndex = headers.findIndex((header) => header.includes("wt. medium") || header === "wt medium" || header === "wt. m" || header === "wt m" || header === "medium");
    const largeWeightIndex = headers.findIndex((header) => header.includes("wt. large") || header === "wt large" || header === "wt. l" || header === "wt l" || header === "large");
    if (itemIndex < 0 || moldIndex < 0) continue;
    for (const [rowOffset, rowHtml] of rows.slice(headerRowIndex + 1).entries()) {
      const rowCells = cells(rowHtml);
      if (rowCells.length !== headerCells.length) continue;
      const output = linkedSizeVariants(rowCells[itemIndex]);
      const mold = linkedSizeVariants(rowCells[moldIndex]);
      if (output.length !== 3) continue;
      rowsByKey.set(`${tableIndex}:${rowOffset + 1}`, {
        tableIndex,
        row: rowOffset + 1,
        output,
        mold,
        ac: acIndex >= 0 ? numberAt(rowCells[acIndex]) : null,
        weights: {
          Small: smallWeightIndex >= 0 ? numberAt(rowCells[smallWeightIndex]) : null,
          Medium: mediumWeightIndex >= 0 ? numberAt(rowCells[mediumWeightIndex]) : null,
          Large: largeWeightIndex >= 0 ? numberAt(rowCells[largeWeightIndex]) : null,
        },
      });
    }
  }
  return rowsByKey;
}

const data = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const html = await fetchPage(blacksmithingUrl);
const sizeRows = parseSizeRows(html);
const pageCache = new Map<string, string>();
const unresolved: Array<Record<string, unknown>> = [];
const resolved: Array<Record<string, unknown>> = [];
const rejectedImages: Array<Record<string, unknown>> = [];
const genericIconItems: Array<Record<string, unknown>> = [];
let resolvedOutputVariants = 0;
let resolvedComponentVariants = 0;

async function imageFor(link: LinkDetail) {
  if (link.imageUrl !== undefined) return link.imageUrl;
  try {
    const cached = pageCache.get(link.url) ?? await fetchPage(link.url);
    pageCache.set(link.url, cached);
    link.imageUrl = itemIconFromPage(cached, link.name, link.url, rejectedImages, genericIconItems);
  } catch {
    link.imageUrl = null;
    genericIconItems.push({ itemName: link.name, pageUrl: link.url, reason: "Could not load page to resolve a reliable item icon." });
  }
  return link.imageUrl ?? null;
}

for (const recipe of data.recipes) {
  if (recipe.skill !== "smithing" || !recipe.sizeVariants?.length) continue;
  const tableIndex = Number(recipe.sourceMetadata?.tableIndex ?? -1);
  const row = Number(recipe.sourceMetadata?.row ?? -1);
  const sizeRow = sizeRows.get(`${tableIndex}:${row}`) ?? sizeRows.get(`${tableIndex}:${row + 1}`);
  if (!sizeRow) {
    for (const size of recipe.sizeVariants) unresolved.push({ recipe: recipe.name, size, missing: "row", reason: "No matching P99 size-variant row was found." });
    continue;
  }

  recipe.sizeVariantDetails = {};
  for (const output of sizeRow.output) {
    const outputImage = await imageFor(output);
    const existing = itemDetails[output.name] ?? {};
    const allakhazamUrl = allakhazamUrlFromDetails(existing);
    recipe.sizeVariantDetails[output.size] = {
      output: {
        name: output.name,
        sourceUrl: output.url,
        allakhazamUrl,
        imageUrl: outputImage,
        ac: sizeRow.ac,
        weight: sizeRow.weights[output.size],
      },
      components: {},
    };
    itemDetails[output.name] = withItemDetailDefaults(output.name, existing, output.url, outputImage, sizeRow.ac, sizeRow.weights[output.size], output.size, "Armor");
    resolvedOutputVariants += 1;
  }

  for (const component of recipe.components) {
    if (!component.sizeVariants?.length) continue;
    component.sizeVariantDetails = {};
    for (const mold of sizeRow.mold) {
      const moldImage = await imageFor(mold);
      const existing = itemDetails[mold.name] ?? {};
      const allakhazamUrl = allakhazamUrlFromDetails(existing);
      const detail = {
        name: mold.name,
        sourceUrl: mold.url,
        allakhazamUrl,
        imageUrl: moldImage,
      };
      component.sizeVariantDetails[mold.size] = detail;
      recipe.sizeVariantDetails[mold.size].components[component.name] = detail;
      itemDetails[mold.name] = withItemDetailDefaults(mold.name, existing, mold.url, moldImage, null, null, null, "Smithing Mold");
      resolvedComponentVariants += 1;
    }
  }

  resolved.push({
    recipe: recipe.name,
    tableIndex,
    row,
    outputs: Object.fromEntries(Object.entries(recipe.sizeVariantDetails).map(([size, detail]) => [size, detail.output.name])),
    components: recipe.components
      .filter((component) => component.sizeVariantDetails)
      .map((component) => ({
        base: component.name,
        variants: Object.fromEntries(Object.entries(component.sizeVariantDetails ?? {}).map(([size, detail]) => [size, detail.name])),
      })),
  });
}

const report = {
  source: blacksmithingUrl,
  resolvedRecipeCount: resolved.length,
  resolvedOutputVariants,
  resolvedComponentVariants,
  unresolved,
  rejectedImages,
  genericIconItems,
  resolved,
  notes: [
    "P99 Blacksmithing S/M/L links are preserved as direct size-specific source URLs.",
    "Allakhazam direct URLs are attached only when an exact existing item-details record already had one.",
    "Shared ingredients such as Sheet Metal and folded sheet metal are left unchanged.",
  ],
};

await writeFile(craftingPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Resolved ${resolved.length} Smithing size-variant recipes.`);
console.log(`Resolved output variants: ${resolvedOutputVariants}`);
console.log(`Resolved component variants: ${resolvedComponentVariants}`);
console.log(`Unresolved size variant records: ${unresolved.length}`);
console.log(`Wrote ${reportPath}`);
