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
  expansion?: string | null;
  skill: string;
  name: string;
  trivial: number | null;
  components: Component[];
  container: string;
  output: { name: string; count: number; imageUrl?: string | null };
  notes?: string | null;
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

const root = process.cwd();
const p99BaseUrl = "https://wiki.project1999.com";
const sourceUrl = `${p99BaseUrl}/Tailoring`;
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-tailoring-velious-set-import-report.json");

const tableConfigs: Record<number, {
  setName: string;
  materialName?: string;
  materialHeader?: string;
  materialCount?: number;
  boningHeader?: string;
  boningName?: string;
  studHeader?: string;
  studName?: string;
  oilHeader?: string;
  oilName?: string;
  tanninHeader?: string;
  tanninName?: string;
  threadHeader?: string;
  manaHeader?: string;
}> = {
  14: { setName: "Velious Fur Armor", threadHeader: "thread", manaHeader: "mana vial", materialHeader: "furs" },
  15: { setName: "Cobalt Drake", materialName: "Cobalt Drake Hide", materialCount: 1, boningHeader: "boning", boningName: "Velium Boning" },
  16: { setName: "Black Pantherskin", materialName: "Black Panther Skin", materialCount: 1, boningHeader: "velium boning", boningName: "Velium Boning" },
  17: { setName: "Tigeraptor", materialHeader: "hides", oilHeader: "drake egg oil", oilName: "Drake Egg Oil", studHeader: "velium studs", studName: "Velium Studs" },
  18: { setName: "Haze Panther", materialHeader: "skins", tanninHeader: "yew leaf tannin", tanninName: "Yew Leaf Tannin", boningHeader: "velium bonings", boningName: "Velium Boning" },
  19: { setName: "Arctic Wyvern", materialHeader: "hides", oilHeader: "cod oil", oilName: "Cod Oil", studHeader: "velium studs", studName: "Velium Studs" },
};

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
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim());
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

function absoluteP99Url(href: string) {
  const decoded = decode(href);
  return decoded.startsWith("http") ? decoded : `${p99BaseUrl}${decoded.startsWith("/") ? "" : "/"}${decoded}`;
}

function p99ItemUrl(name: string) {
  return `${p99BaseUrl}/${encodeURIComponent(name.replace(/\s+/g, "_")).replace(/%27/g, "'")}`;
}

function normalizeItemName(name: string) {
  return name.replace(/\bOf\b/g, "of").replace(/\s+/g, " ").trim();
}

function firstAnchor(cellHtml: string) {
  const match = cellHtml.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const title = match[0].match(/\btitle=["']([^"']+)["']/i)?.[1];
  return {
    name: normalizeItemName(clean(title ? decode(title) : match[2])),
    url: absoluteP99Url(match[1]),
  };
}

function reliableP99Icon(html: string) {
  for (const match of html.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const src = decode(match[1]);
    const absolute = src.startsWith("http") ? src : `${p99BaseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
    if (/^https?:\/\/wiki\.project1999\.com\/images\/Item_\d+\.png$/i.test(absolute)) return absolute;
    const thumb = absolute.match(/^https?:\/\/wiki\.project1999\.com\/images\/thumb\/(Item_\d+\.png)\/\d+px-\1$/i);
    if (thumb) return `${p99BaseUrl}/images/${thumb[1]}`;
  }
  return null;
}

function countFromCell(cellHtml: string) {
  const value = Number(clean(cellHtml).match(/^\d+/)?.[0] ?? NaN);
  return Number.isFinite(value) ? value : 1;
}

function component(name: string, count: number, sourceName = name): Component | null {
  if (!name || count <= 0) return null;
  return {
    name,
    count,
    imageUrl: null,
    acquisitionType: "unknown",
    componentType: "ingredient",
    sourceUrl: p99ItemUrl(sourceName),
    sourceName,
  };
}

function linkedComponent(cellHtml: string) {
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
  } satisfies Component;
}

function table14NamedComponent(header: string, cellHtml: string) {
  const linked = linkedComponent(cellHtml);
  if (linked) return linked;
  const normalized = normalizeHeader(header);
  const text = clean(cellHtml).replace(/^\d+\s*/, "").trim();
  const count = countFromCell(cellHtml);
  const name = normalized === "thread" ? `${text} Thread`
    : normalized === "mana vial" ? `Vial of ${text} Mana`
    : normalized === "furs" ? `${text} Fur`
    : "";
  return component(normalizeItemName(name), count);
}

function parseStatsSummary(value: string) {
  const stats: Record<string, number> = {};
  const resists: Record<string, number> = {};
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(AC|STR|STA|DEX|AGI|WIS|INT|CHA|HP|Mana|SvCold|SvMagic|SvDisease|SvFire|MR|CR|DR|FR)\s*([+-]?\d+(?:\.\d+)?)$/i);
    if (!match) continue;
    const rawKey = match[1].toLowerCase();
    const amount = Number(match[2]);
    const key = rawKey === "mana" ? "MANA"
      : rawKey === "svcold" || rawKey === "cr" ? "CR"
      : rawKey === "svmagic" || rawKey === "mr" ? "MR"
      : rawKey === "svdisease" || rawKey === "dr" ? "DR"
      : rawKey === "svfire" || rawKey === "fr" ? "FR"
      : match[1].toUpperCase();
    if (["CR", "MR", "DR", "FR"].includes(key)) resists[key] = amount;
    else if (key !== "AC") stats[key] = amount;
  }
  return { stats, resists };
}

function numberFromStats(value: string, key: string) {
  const match = value.match(new RegExp(`\\b${key}\\s*([+-]?\\d+(?:\\.\\d+)?)`, "i"));
  const parsed = Number(match?.[1] ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchPage(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "FrostreaverLootReference/0.2 (+local P99 tailoring Velious set import)", accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
  return response.text();
}

function mergeSource(details: ItemDetails, url: string) {
  const sources = details.sources ?? [];
  return sources.some((source) => source.url === url) ? sources : [...sources, { name: "Project1999 Wiki", url }];
}

function mergeNote(details: ItemDetails, note: string) {
  const notes = details.match_notes ?? [];
  return notes.includes(note) ? notes : [...notes, note];
}

function withItemDefaults(name: string, existing: ItemDetails, itemUrl: string, iconPath: string | null, statsText: string): ItemDetails {
  const parsed = parseStatsSummary(statsText);
  return {
    name: existing.name ?? name,
    itemId: existing.itemId ?? null,
    sourceUrl: existing.sourceUrl ?? itemUrl,
    slot: existing.slot ?? clean(statsText).match(/\bSlot:\s*([^\n]+)/i)?.[1] ?? null,
    ac: existing.ac ?? numberFromStats(statsText, "AC"),
    damage: existing.damage ?? null,
    delay: existing.delay ?? null,
    skill: existing.skill ?? null,
    damage_bonus: existing.damage_bonus ?? null,
    stats: { ...(existing.stats as Record<string, number | string> ?? {}), ...parsed.stats },
    resists: { ...(existing.resists as Record<string, number | string> ?? {}), ...parsed.resists },
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
    weight: existing.weight ?? numberFromStats(statsText, "Wt"),
    size: existing.size ?? null,
    item_type: existing.item_type ?? "Armor",
    itemType: existing.itemType ?? "Armor",
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
    sources: mergeSource(existing, itemUrl),
    confidence: existing.confidence ?? "exact_match",
    match_confidence: existing.match_confidence ?? "exact_match",
    match_notes: mergeNote(existing, "Imported from P99 Tailoring Velious armor set table."),
    missing_core_stats: existing.missing_core_stats ?? false,
    duplicate_name_risk: existing.duplicate_name_risk ?? false,
    parsing_warnings: existing.parsing_warnings ?? [],
    expansion: existing.expansion ?? "Scars of Velious",
  };
}

const data = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const html = await fetchPage(sourceUrl);
const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => match[0]);
const imported: Recipe[] = [];
const skipped: Array<Record<string, unknown>> = [];
const missingTrivial: Array<Record<string, unknown>> = [];
const repairedBySet: Record<string, number> = {};

for (const [tableIndexText, config] of Object.entries(tableConfigs)) {
  const tableIndex = Number(tableIndexText);
  const rows = tableRows(tables[tableIndex] ?? "");
  if (rows.length < 2) continue;
  const headerCells = cells(rows[0]).map(clean);
  const headers = headerCells.map(normalizeHeader);
  const itemIndex = headers.indexOf("item");
  const patternIndex = headers.indexOf("pattern");
  const trivialIndex = headers.findIndex((header) => header.includes("trivial"));
  const statsIndex = headers.findIndex((header) => header === "item stats");
  const indexOf = (headerName?: string) => headerName ? headers.indexOf(headerName) : -1;

  for (const [rowOffset, rowHtml] of rows.slice(1).entries()) {
    const row = rowOffset + 1;
    const rowCells = cells(rowHtml);
    if (rowCells.length !== headerCells.length) {
      skipped.push({ tableIndex, row, reason: "Header/cell mismatch." });
      continue;
    }
    const output = firstAnchor(rowCells[itemIndex]);
    if (!output) {
      skipped.push({ tableIndex, row, reason: "Missing output item link." });
      continue;
    }
    const pattern = linkedComponent(rowCells[patternIndex]);
    const summary = /set total/i.test(clean(rowCells[patternIndex])) || / armor$/i.test(output.name);
    if (summary) {
      skipped.push({ tableIndex, row, name: output.name, reason: "Skipped set-total summary row." });
      continue;
    }
    const components: Component[] = [];
    if (pattern) components.push(pattern);
    if (tableIndex === 14) {
      for (const header of [config.threadHeader, config.manaHeader, config.materialHeader]) {
        const index = indexOf(header);
        const parsed = index >= 0 ? table14NamedComponent(header ?? "", rowCells[index]) : null;
        if (parsed) components.push(parsed);
      }
    } else {
      const materialHeader = indexOf(config.materialHeader);
      const materialCount = materialHeader >= 0 ? countFromCell(rowCells[materialHeader]) : config.materialCount ?? 0;
      const materialName = config.materialName
        ?? (config.setName === "Tigeraptor" ? "Tigeraptor Hide"
          : config.setName === "Haze Panther" ? "Haze Panther Skin"
          : config.setName === "Arctic Wyvern" ? "Arctic Wyvern Hide"
          : "");
      const material = component(materialName, materialCount);
      if (material) components.push(material);
      const oilIndex = indexOf(config.oilHeader);
      const oil = oilIndex >= 0 ? component(config.oilName ?? "", countFromCell(rowCells[oilIndex])) : null;
      if (oil) components.push(oil);
      const tanninIndex = indexOf(config.tanninHeader);
      const tannin = tanninIndex >= 0 ? component(config.tanninName ?? "", countFromCell(rowCells[tanninIndex])) : null;
      if (tannin) components.push(tannin);
      const boningIndex = indexOf(config.boningHeader);
      const boning = boningIndex >= 0 ? component(config.boningName ?? "", countFromCell(rowCells[boningIndex])) : null;
      if (boning) components.push(boning);
      const studIndex = indexOf(config.studHeader);
      const stud = studIndex >= 0 ? component(config.studName ?? "", countFromCell(rowCells[studIndex])) : null;
      if (stud) components.push(stud);
    }
    if (components.length === 0) {
      skipped.push({ tableIndex, row, name: output.name, reason: "No components parsed." });
      continue;
    }
    const statsText = statsIndex >= 0 ? clean(rowCells[statsIndex]) : clean(rowCells[itemIndex]);
    const trivial = trivialIndex >= 0 ? Number(clean(rowCells[trivialIndex]).match(/^\d+$/)?.[0] ?? NaN) : NaN;
    const iconPath = reliableP99Icon(rowCells[itemIndex]);
    const recipe: Recipe = {
      id: `p99-tailoring-velious-set-${tableIndex}-${row}`,
      expansion: "Scars of Velious",
      skill: "tailoring",
      name: output.name,
      trivial: Number.isFinite(trivial) ? trivial : null,
      components,
      container: "Coldain Tanners Kit",
      output: { name: output.name, count: 1, imageUrl: iconPath },
      notes: Number.isFinite(trivial) ? null : "P99 Tailoring set table does not list an exact trivial for this row.",
      sourceUrl: output.url,
      sourceMetadata: {
        source: "Project1999 Wiki",
        p99Page: "Tailoring",
        p99ItemUrl: output.url,
        tableIndex,
        row,
        veliousArmorSet: config.setName,
        postLuclin: false,
      },
    };
    if (recipe.trivial === null) missingTrivial.push({ setName: config.setName, recipe: recipe.name, sourceUrl: recipe.sourceUrl });
    imported.push(recipe);
    itemDetails[output.name] = withItemDefaults(output.name, itemDetails[output.name] ?? {}, output.url, iconPath, statsText);
    for (const entry of components) itemDetails[entry.name] = withItemDefaults(entry.name, itemDetails[entry.name] ?? {}, entry.sourceUrl ?? p99ItemUrl(entry.name), null, "");
    repairedBySet[config.setName] = (repairedBySet[config.setName] ?? 0) + 1;
  }
}

const importedNames = new Set(imported.map((recipe) => recipe.name.toLowerCase()));
const targetTables = new Set(Object.keys(tableConfigs).map(Number));
const beforeCount = data.recipes.length;
data.recipes = [
  ...data.recipes.filter((recipe) => {
    if (recipe.skill !== "tailoring") return true;
    const tableIndex = Number(recipe.sourceMetadata?.tableIndex ?? -1);
    return !targetTables.has(tableIndex) && !importedNames.has(recipe.name.toLowerCase());
  }),
  ...imported,
];

const report = {
  source: sourceUrl,
  beforeCount,
  afterCount: data.recipes.length,
  importedCount: imported.length,
  repairedBySet,
  skipped,
  missingTrivial,
  importedRecipes: imported.map((recipe) => ({
    setName: recipe.sourceMetadata?.veliousArmorSet,
    name: recipe.name,
    trivial: recipe.trivial,
    components: recipe.components.map((entry) => `${entry.count}x ${entry.name}`),
    sourceUrl: recipe.sourceUrl,
  })),
};

await writeFile(craftingPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Imported ${imported.length} Velious Tailoring armor recipes.`);
for (const [setName, count] of Object.entries(repairedBySet)) console.log(`${setName}: ${count}`);
console.log(`Skipped rows: ${skipped.length}`);
console.log(`Missing trivial rows: ${missingTrivial.length}`);
console.log(`Wrote ${reportPath}`);
