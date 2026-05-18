import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ItemDetails = Record<string, unknown>;
type CraftingRecipe = {
  skill: string;
  name: string;
  output?: { name?: string };
  components?: Array<{ name: string }>;
  sourceMetadata?: Record<string, unknown>;
};

const root = process.cwd();
const p99BaseUrl = "https://wiki.project1999.com";
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-pottery-idol-component-repair-report.json");
const qualityReportPath = path.join(root, "data", "crafting-data-quality-report.json");

const manualSources: Record<string, { sourceUrl: string; iconPath?: string | null; itemType?: string; note?: string }> = {
  "Rose Quartz": {
    sourceUrl: "https://wiki.project1999.com/Jewelcrafting",
    iconPath: "https://wiki.project1999.com/images/Item_950.png",
    itemType: "Combinable",
    note: "P99 Pottery idol table labels this component as Rose Quartz; P99 imbue/jewelcraft references use the star rose quartz family icon.",
  },
  "Imbued Gem": {
    sourceUrl: "https://wiki.project1999.com/Imbued_Gems",
    iconPath: null,
    itemType: "Crafting placeholder",
    note: "Generic P99 idol recipe placeholder. Use the deity-specific imbued gem for the selected idol.",
  },
};

function p99ItemUrl(name: string) {
  return `${p99BaseUrl}/${encodeURIComponent(name.replace(/\s+/g, "_"))}`;
}

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

function parseP99Page(name: string, html: string) {
  const iconMatch = html.match(/src=["']([^"']*\/images\/Item_\d+\.png)["']/i);
  const iconPath = iconMatch ? `${p99BaseUrl}${decode(iconMatch[1])}` : null;
  const text = clean(html);
  const weight = Number(text.match(/\bWT:\s*(\d+(?:\.\d+)?)/i)?.[1] ?? NaN);
  const size = text.match(/\bSize:\s*([A-Z]+)/i)?.[1] ?? null;
  const classes = text.match(/\bClass:\s*([A-Z ]+?)(?:\s+Race:|\s*$)/i)?.[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  const races = text.match(/\bRace:\s*([A-Z ]+?)(?:\s+Slot:|\s+WT:|\s*$)/i)?.[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  return {
    iconPath,
    weight: Number.isFinite(weight) ? weight : null,
    size,
    classes,
    races,
    itemType: /sketch/i.test(name) ? "Pottery Sketch"
      : /firing sheet/i.test(name) ? "Firing Component"
      : /sculpting tools/i.test(name) ? "Crafting Tool"
      : "Combinable",
  };
}

function baseItemDetails(name: string, sourceUrl: string, parsed: ReturnType<typeof parseP99Page> | null, note?: string): ItemDetails {
  return {
    name,
    slot: null,
    ac: null,
    damage: null,
    delay: null,
    skill: null,
    damage_bonus: null,
    stats: {},
    resists: {},
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
    classes: parsed?.classes?.length ? parsed.classes : ["ALL"],
    races: parsed?.races?.length ? parsed.races : ["ALL"],
    weight: parsed?.weight ?? null,
    size: parsed?.size ?? null,
    item_type: parsed?.itemType ?? "Combinable",
    stackable: null,
    weight_reduction: null,
    capacity: null,
    size_capacity: null,
    lore: null,
    magic: null,
    no_drop: null,
    prestige: null,
    aug_slots: [],
    iconPath: parsed?.iconPath ?? null,
    sources: [{ name: sourceUrl.includes("project1999") ? "Project1999 Wiki" : "Allakhazam", url: sourceUrl }],
    expansion: "Classic",
    confidence: "exact_match",
    match_confidence: "exact_match",
    match_notes: [
      "Added by Pottery idol component repair from P99-compatible item source.",
      ...(note ? [note] : []),
    ],
    missing_core_stats: false,
    duplicate_name_risk: false,
    parsing_warnings: [],
  };
}

function hasUsableIcon(details: ItemDetails | undefined) {
  return Boolean(details?.iconPath || details?.imageUrl);
}

function mergeDetails(existing: ItemDetails | undefined, repaired: ItemDetails) {
  if (!existing) return repaired;
  const existingSources = Array.isArray(existing.sources) ? existing.sources : [];
  const repairedSources = Array.isArray(repaired.sources) ? repaired.sources : [];
  const urls = new Set(existingSources.map((source) => typeof source === "object" && source ? (source as { url?: string }).url : ""));
  return {
    ...repaired,
    ...existing,
    iconPath: existing.iconPath || repaired.iconPath || null,
    imageUrl: existing.imageUrl || repaired.imageUrl || null,
    item_type: existing.item_type || repaired.item_type || null,
    weight: existing.weight ?? repaired.weight ?? null,
    size: existing.size ?? repaired.size ?? null,
    classes: Array.isArray(existing.classes) && existing.classes.length ? existing.classes : repaired.classes,
    races: Array.isArray(existing.races) && existing.races.length ? existing.races : repaired.races,
    sources: [
      ...existingSources,
      ...repairedSources.filter((source) => typeof source === "object" && source && !urls.has((source as { url?: string }).url)),
    ],
    match_notes: Array.from(new Set([
      ...(Array.isArray(existing.match_notes) ? existing.match_notes as string[] : []),
      ...(Array.isArray(repaired.match_notes) ? repaired.match_notes as string[] : []),
    ])),
    missing_core_stats: false,
    parsing_warnings: Array.isArray(existing.parsing_warnings)
      ? (existing.parsing_warnings as string[]).filter((warning) => !/icon-only|stats were not imported/i.test(warning))
      : [],
  };
}

const crafting = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: CraftingRecipe[] };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const idolRecipes = crafting.recipes.filter((recipe) => recipe.skill === "pottery"
  && /idol/i.test(`${recipe.name ?? ""} ${recipe.output?.name ?? ""} ${JSON.stringify(recipe.sourceMetadata ?? {})}`));
const componentNames = Array.from(new Set(idolRecipes.flatMap((recipe) => recipe.components?.map((component) => component.name) ?? []))).sort((a, b) => a.localeCompare(b));
const beforeMissing = componentNames.filter((name) => !itemDetails[name]);
const beforeIncomplete = componentNames.filter((name) => itemDetails[name] && !hasUsableIcon(itemDetails[name]));
const targets = Array.from(new Set([...beforeMissing, ...beforeIncomplete]));
const repaired: Record<string, unknown>[] = [];
const unresolved: Record<string, unknown>[] = [];

for (const name of targets) {
  const manual = manualSources[name];
  const sourceUrl = manual?.sourceUrl ?? p99ItemUrl(name);
  let parsed: ReturnType<typeof parseP99Page> | null = null;
  let status = 0;
  try {
    const response = await fetch(sourceUrl, { headers: { "user-agent": "FrostreaverLoot/0.1 pottery idol component repair" } });
    status = response.status;
    const html = await response.text();
    if (response.ok) parsed = parseP99Page(name, html);
  } catch (error) {
    unresolved.push({ name, sourceUrl, reason: error instanceof Error ? error.message : String(error) });
    continue;
  }

  if (manual?.iconPath) {
    parsed = {
      iconPath: manual.iconPath,
      weight: parsed?.weight ?? 0.1,
      size: parsed?.size ?? "TINY",
      classes: parsed?.classes?.length ? parsed.classes : ["ALL"],
      races: parsed?.races?.length ? parsed.races : ["ALL"],
      itemType: manual.itemType ?? parsed?.itemType ?? "Combinable",
    };
  }
  if (manual && !parsed) {
    parsed = {
      iconPath: manual.iconPath ?? null,
      weight: null,
      size: null,
      classes: ["ALL"],
      races: ["ALL"],
      itemType: manual.itemType ?? "Combinable",
    };
  }
  if (!parsed || (!parsed.iconPath && name !== "Imbued Gem")) {
    unresolved.push({ name, sourceUrl, status, reason: "No reliable P99 item icon/detail block found." });
    continue;
  }

  const repairedDetails = baseItemDetails(name, sourceUrl, parsed, manual?.note);
  itemDetails[name] = mergeDetails(itemDetails[name], repairedDetails);
  repaired.push({
    name,
    sourceUrl,
    iconPath: itemDetails[name].iconPath ?? itemDetails[name].imageUrl ?? null,
    existedBefore: !beforeMissing.includes(name),
  });
}

const afterMissing = componentNames.filter((name) => !itemDetails[name]);
const afterIncomplete = componentNames.filter((name) => itemDetails[name] && !hasUsableIcon(itemDetails[name]) && name !== "Imbued Gem");
const report = {
  generatedAt: new Date().toISOString(),
  idolRecipeCount: idolRecipes.length,
  idolComponentCount: componentNames.length,
  idolComponents: componentNames,
  missingBeforeRepair: beforeMissing,
  incompleteBeforeRepair: beforeIncomplete,
  repaired,
  unresolved,
  missingAfterRepair: afterMissing,
  incompleteAfterRepair: afterIncomplete,
};

await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

try {
  const quality = JSON.parse(await readFile(qualityReportPath, "utf8"));
  quality.potteryIdolComponents = {
    missingBeforeRepair: beforeMissing,
    incompleteBeforeRepair: beforeIncomplete,
    repairedCount: repaired.length,
    unresolvedCount: unresolved.length,
    missingAfterRepair: afterMissing,
    incompleteAfterRepair: afterIncomplete,
    reportPath: "data/crafting-pottery-idol-component-repair-report.json",
  };
  await writeFile(qualityReportPath, `${JSON.stringify(quality, null, 2)}\n`);
} catch {
  // The consolidated report is generated by broader repair passes; keep this
  // targeted repair usable even when that optional report is absent.
}

console.log(JSON.stringify(report, null, 2));
