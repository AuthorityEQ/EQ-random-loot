import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types (subset of enrich-items-from-zam.ts)
// ---------------------------------------------------------------------------

type MatchConfidence = "exact_match" | "possible_match" | "needs_review" | "not_found";

type ItemDetails = {
  name: string;
  slot: string | null;
  ac: number | null;
  damage: number | null;
  delay: number | null;
  skill?: string | null;
  damage_bonus?: number | null;
  stats: Record<string, number | string>;
  resists: Record<string, number | string>;
  hp_regen?: number | null;
  mana_regen?: number | null;
  endurance_regen?: number | null;
  haste: string | null;
  worn_effects: string[];
  focus_effects: string[];
  click_effects: string[];
  proc_effects: string[];
  required_level: number | null;
  recommended_level: number | null;
  classes: string[];
  races: string[];
  weight: number | null;
  size: string | null;
  item_type?: string | null;
  stackable?: boolean | null;
  weight_reduction?: string | null;
  capacity?: number | null;
  size_capacity?: string | null;
  lore: boolean | null;
  magic: boolean | null;
  no_drop: boolean | null;
  prestige: boolean | null;
  aug_slots: string[];
  iconPath?: string | null;
  sources: Array<{ name: string; url: string }>;
  confidence: MatchConfidence;
  match_confidence: MatchConfidence;
  match_notes: string[];
  missing_core_stats: boolean;
  duplicate_name_risk: boolean;
  parsing_warnings: string[];
  expansion: string;
};

type ItemMigrationResult = {
  item: string;
  cacheHit: boolean;
  fieldsAdded: string[];
  error?: string;
};

type MigrationReport = {
  generatedAt: string;
  totalItems: number;
  itemsMigrated: number;
  itemsAlreadyComplete: number;
  itemsCacheMiss: number;
  itemsParseError: number;
  fieldAddedCounts: Record<string, number>;
  cacheMissItems: string[];
  parseErrorItems: Array<{ item: string; error: string }>;
  perItem: ItemMigrationResult[];
};

// ---------------------------------------------------------------------------
// Parser utilities — duplicated from enrich-items-from-zam.ts so this script
// is self-contained and immune to future upstream changes.
// ---------------------------------------------------------------------------

const PARTIAL_SCHEMA_FIELDS = [
  "hp_regen",
  "mana_regen",
  "endurance_regen",
  "item_type",
  "stackable",
  "weight_reduction",
  "capacity",
  "size_capacity",
  "skill",
  "damage_bonus",
] as const;

type PartialSchemaField = (typeof PARTIAL_SCHEMA_FIELDS)[number];

function htmlDecode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
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

function readNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function readString(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function readTableValue(label: string, html: string) {
  const pattern = new RegExp(
    `<tr><th[^>]*>[\\s\\S]*?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?<\\/th><td[^>]*>([\\s\\S]*?)<\\/td><\\/tr>`,
    "i",
  );
  const match = html.match(pattern);
  return match ? stripTags(match[1]).replace(/\s+/g, " ").trim() : null;
}

function readRegen(label: "HP" | "Mana" | "Endurance", text: string) {
  return readNumber(new RegExp(`\\b${label}\\s+Regen\\s*:?\\s*([+-]?\\d+)`, "i"), text);
}

/**
 * Extract the partial-schema fields from a cached HTML page.
 * Returns only the fields explicitly listed in PARTIAL_SCHEMA_FIELDS.
 */
function extractPartialFields(html: string): Record<PartialSchemaField, unknown> {
  const itemBlockHtml =
    html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlockHtml);

  return {
    hp_regen: readRegen("HP", text),
    mana_regen: readRegen("Mana", text),
    endurance_regen: readRegen("Endurance", text),
    item_type: readTableValue("Item Type", html),
    stackable: (() => {
      const value = readTableValue("Stackable", html);
      return value ? /^yes$/i.test(value) : null;
    })(),
    weight_reduction: readString(/\bWeight Reduction:\s*([+-]?\d+%)/i, text),
    capacity: readNumber(/\bCapacity:\s*(\d+)/i, text),
    size_capacity: readString(/\bSize Capacity:\s*([^\n]+)/i, text),
    skill: readString(/\bSkill:\s*([^\n]*?)(?:\s+Atk Delay:|$)/i, text),
    damage_bonus: readNumber(/\b(?:Dmg Bon|Damage Bonus):\s*(\d+)/i, text),
  };
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "schema-migration-report.json");
const cacheDir = path.join(root, "cache", "zam-pages");

function cacheKey(url: string) {
  return crypto.createHash("sha1").update(`item:${url}`).digest("hex");
}

function cachedHtmlPath(url: string) {
  return path.join(cacheDir, `${cacheKey(url)}.html`);
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

console.log("Loading item-details.json …");
const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;

const totalItems = Object.keys(details).length;
const perItem: ItemMigrationResult[] = [];
let itemsMigrated = 0;
let itemsAlreadyComplete = 0;
let itemsCacheMiss = 0;
let itemsParseError = 0;
const cacheMissItems: string[] = [];
const parseErrorItems: Array<{ item: string; error: string }> = [];
const fieldAddedCounts: Record<string, number> = {};

for (const field of PARTIAL_SCHEMA_FIELDS) {
  fieldAddedCounts[field] = 0;
}

const entries = Object.entries(details);
console.log(`Processing ${totalItems} items …`);

for (const [itemName, item] of entries) {
  const missingFields = PARTIAL_SCHEMA_FIELDS.filter((f) => !(f in item));

  if (missingFields.length === 0) {
    itemsAlreadyComplete++;
    continue;
  }

  const url = item.sources?.find((s) => s.name === "Allakhazam")?.url ?? item.sources?.[0]?.url;

  if (!url) {
    itemsCacheMiss++;
    cacheMissItems.push(itemName);
    perItem.push({ item: itemName, cacheHit: false, fieldsAdded: [], error: "No source URL" });
    continue;
  }

  const htmlPath = cachedHtmlPath(url);

  if (!existsSync(htmlPath)) {
    itemsCacheMiss++;
    cacheMissItems.push(itemName);
    perItem.push({ item: itemName, cacheHit: false, fieldsAdded: [], error: "Cache miss" });
    continue;
  }

  let html: string;
  try {
    html = await readFile(htmlPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    itemsParseError++;
    parseErrorItems.push({ item: itemName, error: `Read error: ${message}` });
    perItem.push({ item: itemName, cacheHit: true, fieldsAdded: [], error: `Read error: ${message}` });
    continue;
  }

  let extracted: Record<PartialSchemaField, unknown>;
  try {
    extracted = extractPartialFields(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    itemsParseError++;
    parseErrorItems.push({ item: itemName, error: `Parse error: ${message}` });
    perItem.push({ item: itemName, cacheHit: true, fieldsAdded: [], error: `Parse error: ${message}` });
    continue;
  }

  const fieldsAdded: string[] = [];

  for (const field of missingFields) {
    // Only add fields that were genuinely absent — never overwrite existing keys.
    if (!(field in item)) {
      (item as Record<string, unknown>)[field] = extracted[field];
      fieldsAdded.push(field);
      fieldAddedCounts[field]++;
    }
  }

  if (fieldsAdded.length > 0) {
    itemsMigrated++;
    perItem.push({ item: itemName, cacheHit: true, fieldsAdded });
  } else {
    itemsAlreadyComplete++;
    perItem.push({ item: itemName, cacheHit: true, fieldsAdded: [] });
  }
}

// ---------------------------------------------------------------------------
// Atomic write — write to a temp file then rename
// ---------------------------------------------------------------------------

console.log("Writing migrated item-details.json …");
const tmpPath = detailsPath + ".tmp";
await writeFile(tmpPath, `${JSON.stringify(details, null, 2)}\n`);
// On Windows rename is not atomic across volumes but both are the same file so
// this is as safe as we can get without a native atomic-rename library.
const { rename } = await import("node:fs/promises");
await rename(tmpPath, detailsPath);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const report: MigrationReport = {
  generatedAt: new Date().toISOString(),
  totalItems,
  itemsMigrated,
  itemsAlreadyComplete,
  itemsCacheMiss,
  itemsParseError,
  fieldAddedCounts,
  cacheMissItems,
  parseErrorItems,
  perItem,
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("");
console.log("=== Schema Migration Complete ===");
console.log(`  Total items:         ${totalItems}`);
console.log(`  Already complete:    ${itemsAlreadyComplete}`);
console.log(`  Migrated:            ${itemsMigrated}`);
console.log(`  Cache misses:        ${itemsCacheMiss}`);
console.log(`  Parse errors:        ${itemsParseError}`);
console.log("");
console.log("Fields added:");
for (const [field, count] of Object.entries(fieldAddedCounts).sort(([, a], [, b]) => b - a)) {
  if (count > 0) console.log(`  ${field.padEnd(20)} ${count}`);
}
if (cacheMissItems.length > 0) {
  console.log("");
  console.log("Cache-miss items (not migrated):");
  for (const name of cacheMissItems) console.log(`  - ${name}`);
}
if (parseErrorItems.length > 0) {
  console.log("");
  console.log("Parse error items:");
  for (const { item, error } of parseErrorItems) console.log(`  - ${item}: ${error}`);
}
console.log("");
console.log(`Wrote ${reportPath}`);
