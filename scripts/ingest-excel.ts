/**
 * ingest-excel.ts
 *
 * Reads EQ_Master_Database_temp.xlsx and emits per-sheet JSON files
 * to data/excel-imports/.
 *
 * Usage:
 *   node --experimental-strip-types scripts/ingest-excel.ts
 *   node --experimental-strip-types scripts/ingest-excel.ts --sheets=spell-vendors,zone-xp
 *   node --experimental-strip-types scripts/ingest-excel.ts --all
 *   node --experimental-strip-types scripts/ingest-excel.ts --max-rows=10 --dry-run
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import type {
  BisGearOutput,
  BisGearRow,
  CraftingOutput,
  CraftingRecipeRow,
  EpicQuestClass,
  EpicQuestsOutput,
  EpicQuestStep,
  FactionDetailRow,
  FactionSummaryRow,
  FactionsOutput,
  LevelingGuideOutput,
  LevelingGuideRow,
  NormalizationMatch,
  NormalizationReport,
  PopProgressionOutput,
  PopProgressionRow,
  SheetMeta,
  SpellVendorRow,
  SpellVendorsOutput,
  TradeableScheduleOutput,
  TradeableScheduleRow,
  ZoneXpOutput,
  ZoneXpRow,
} from "../lib/excel-types.ts";

// ─── CLI argument parsing ──────────────────────────────────────────────────

const args = process.argv.slice(2);

const dryRun = args.includes("--dry-run");
const allSheets = args.includes("--all");

const maxRowsArg = args.find((a) => a.startsWith("--max-rows="));
const maxRows = maxRowsArg ? Number(maxRowsArg.split("=")[1]) : 0;

const sheetsArg = args.find((a) => a.startsWith("--sheets="));
const requestedSheetKeys = sheetsArg
  ? sheetsArg.split("=")[1].split(",").map((s) => s.trim().toLowerCase())
  : [];

// ─── Paths ─────────────────────────────────────────────────────────────────

const root = process.cwd();
const excelPath = path.join("C:", "Users", "rontf", "EQ_Master_Database_temp.xlsx");
const outDir = path.join(root, "data", "excel-imports");
const itemDetailsPath = path.join(root, "data", "item-details.json");

// ─── Helpers ───────────────────────────────────────────────────────────────

function trimCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/** Strip emoji/decoration from section header cells (e.g. "▸ Kael Drakkel") */
function cleanSectionLabel(value: string): string {
  return value.replace(/^[▸•►\-\s]+/, "").trim();
}

/** Count stars in a Unicode star-rating string like "★★★★★" */
function countStars(value: string): number {
  return (value.match(/★/g) ?? []).length;
}

/** Split a comma-separated string, trimming each part, filtering blanks */
function splitCommaList(value: string): string[] {
  return value
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Determine if a row is a section-header row (non-empty first cell only, rest null/empty) */
function isSectionHeader(row: unknown[]): boolean {
  const firstCell = trimCell(row[0]);
  if (!firstCell) return false;
  const rest = row.slice(1);
  return rest.every((c) => c === null || c === undefined || trimCell(c) === "");
}

/** Whether every cell in the row is null/undefined/"" */
function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => c === null || c === undefined || trimCell(c) === "");
}

/**
 * Atomic write: write to .tmp, then fs.rename into final path.
 * On dry-run, only logs what would be written.
 */
async function atomicWrite(filePath: string, data: unknown, label: string): Promise<void> {
  const json = `${JSON.stringify(data, null, 2)}\n`;

  if (dryRun) {
    console.log(`[dry-run] Would write ${filePath} (${json.length} bytes)`);
    return;
  }

  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, json, "utf8");
  await rename(tmpPath, filePath);
  console.log(`Wrote ${label}: ${filePath}`);
}

/** Convert a SheetJS worksheet to a 2D array of raw values */
function worksheetToRows(ws: XLSX.WorkSheet): unknown[][] {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
  const rows: unknown[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellAddr];
      row.push(cell ? cell.v : null);
    }
    rows.push(row);
  }

  return rows;
}

/** Apply --max-rows cap to data rows (not header rows) */
function applyMaxRows<T>(rows: T[]): T[] {
  return maxRows > 0 ? rows.slice(0, maxRows) : rows;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Sheet emitters ────────────────────────────────────────────────────────

// ── Spell Vendors ──────────────────────────────────────────────────────────
function emitSpellVendors(ws: XLSX.WorkSheet): SpellVendorsOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const records: SpellVendorRow[] = [];

  // Header at row index 7 (0-based), data starts row 8 (PoK vendors)
  // Find the header row that has "Class" in first column
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (trimCell(allRows[i][0]).toLowerCase() === "class") {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    warnings.push("Could not find header row with 'Class' column");
    return { sheet_name: "Spell Vendors", row_count: 0, extracted_at: nowIso(), warnings, records: [] };
  }

  const dataRows = allRows.slice(headerRowIdx + 1);
  const capped = applyMaxRows(dataRows);

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = headerRowIdx + 2 + i; // 1-based
    if (isBlankRow(row)) continue;

    const classCell = trimCell(row[0]);
    // Skip pure section headers (e.g. "PLANE OF KNOWLEDGE LIBRARY")
    if (!classCell || isSectionHeader(row)) continue;
    // Skip rows that look like a note/paragraph (no class content in col 1)
    if (/^[A-Z\s]{6,}$/.test(classCell) && !row[1]) continue;

    records.push({
      _source_row: excelRow,
      class: classCell,
      vendor_npc_name: trimCell(row[1]),
      location: trimCell(row[2]),
      floor_area: trimCell(row[3]),
      levels: trimCell(row[4]),
    });
  }

  return {
    sheet_name: "Spell Vendors",
    row_count: records.length,
    extracted_at: nowIso(),
    warnings,
    records,
  };
}

// ── Tradeable Items & Schedule ─────────────────────────────────────────────
function emitTradeableSchedule(ws: XLSX.WorkSheet): TradeableScheduleOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const records: TradeableScheduleRow[] = [];

  // Row 0: title, Row 1: header ("Expansion" | "Tradeable Items / Keys" | ...)
  // Data starts row 2
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (trimCell(allRows[i][0]).toLowerCase() === "expansion") {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    warnings.push("Could not find header row with 'Expansion' column");
    return { sheet_name: "Tradeable Items & Schedule", row_count: 0, extracted_at: nowIso(), warnings, records: [] };
  }

  const dataRows = allRows.slice(headerRowIdx + 1);
  const capped = applyMaxRows(dataRows);

  // Track Epic Tradeables section
  let currentEpicClass = "";

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = headerRowIdx + 2 + i;
    if (isBlankRow(row)) continue;

    const expansion = trimCell(row[0]);
    const tradeablesRaw = trimCell(row[1]);
    const teekSchedule = trimCell(row[2]);
    const unlockDate = trimCell(row[3]);
    const epicRaw = trimCell(row[4]);

    // Detect the "--- EPIC TRADEABLES ---" divider line
    if (epicRaw.toLowerCase().includes("epic tradeables") || epicRaw.startsWith("---")) {
      continue;
    }

    // Rows where expansion is a class name in col 0 and col 4 has epic data
    if (!teekSchedule && !unlockDate && epicRaw) {
      currentEpicClass = expansion;
      // Store as an epic-tradeables sub-record under a special sentinel expansion
      records.push({
        _source_row: excelRow,
        expansion: `epic:${currentEpicClass}`,
        tradeable_items: [],
        teek_schedule: "",
        unlock_date: "",
        epic_tradeables: splitCommaList(epicRaw),
      });
      continue;
    }

    if (!expansion) continue;

    records.push({
      _source_row: excelRow,
      expansion,
      tradeable_items: splitCommaList(tradeablesRaw),
      teek_schedule: teekSchedule,
      unlock_date: unlockDate,
      epic_tradeables: splitCommaList(epicRaw),
    });
  }

  return {
    sheet_name: "Tradeable Items & Schedule",
    row_count: records.length,
    extracted_at: nowIso(),
    warnings,
    records,
  };
}

// ── Epic 1.0 Quests ────────────────────────────────────────────────────────
function emitEpicQuests(ws: XLSX.WorkSheet): EpicQuestsOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const classes: EpicQuestClass[] = [];

  // Find header row: Step | Phase | Action | NPC/Mob | Zone | Items | Notes
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (trimCell(allRows[i][0]).toLowerCase() === "step") {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    warnings.push("Could not find header row with 'Step' column");
    return { sheet_name: "Epic 1.0 Quests", row_count: 0, extracted_at: nowIso(), warnings, classes: [] };
  }

  let currentClass: EpicQuestClass | null = null;
  const dataRows = allRows.slice(headerRowIdx + 1);
  const capped = applyMaxRows(dataRows);

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = headerRowIdx + 2 + i;
    if (isBlankRow(row)) continue;

    const col0 = trimCell(row[0]);

    // Class header rows look like "BARD — SINGING SHORT SWORD" or "WARRIOR — ..."
    // They must use an em-dash (—) separator, not a plain hyphen, to distinguish from
    // section labels like "FINAL TURN-IN" or "BOTTLENECKS"
    if (isSectionHeader(row) && /^[A-Z][A-Z\s]+\s*—\s*/.test(col0)) {
      const parts = col0.split(/\s*—\s*/);
      const className = parts[0].trim();
      const weaponName = parts.slice(1).join(" — ").trim();
      currentClass = { class_name: className, weapon_name: weaponName, steps: [] };
      classes.push(currentClass);
      continue;
    }

    // Skip decorative separator lines (dashes only in col 0, or lines starting with "Type:" / "Starting NPC:")
    if (!col0 || /^[-\s]+$/.test(col0) || col0.startsWith("Type:") || col0.startsWith("Starting NPC:")) continue;

    const col1 = trimCell(row[1]);

    // Actual data row: step number in col 0
    const stepNum = col0;
    const phase = trimCell(row[1]);
    const action = trimCell(row[2]);
    const npcMob = trimCell(row[3]);
    const zone = trimCell(row[4]);
    const items = trimCell(row[5]);
    const notes = trimCell(row[6]);

    if (!action && !npcMob && !zone) continue;

    if (!currentClass) {
      warnings.push(`Row ${excelRow}: data row with no class context, skipping`);
      continue;
    }

    // Phase column in this sheet is filled with dashes "- ------" as decoration; normalize to ""
    const cleanPhase = /^[-\s]+$/.test(phase) ? "" : cleanSectionLabel(phase);

    const step: EpicQuestStep = {
      _source_row: excelRow,
      step: stepNum,
      phase: cleanPhase,
      action,
      npc_mob: npcMob,
      zone,
      items,
      notes,
    };
    currentClass.steps.push(step);
  }

  const totalSteps = classes.reduce((sum, c) => sum + c.steps.length, 0);

  return {
    sheet_name: "Epic 1.0 Quests",
    row_count: totalSteps,
    extracted_at: nowIso(),
    warnings,
    classes,
  };
}

// ── Leveling Guide ─────────────────────────────────────────────────────────
function emitLevelingGuide(ws: XLSX.WorkSheet): LevelingGuideOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const records: LevelingGuideRow[] = [];

  // The sheet has multiple sub-sections, each with their own header row
  // "Level Range | Zone | ZEM | Play Style | Why It's Good | Tips | Races Best For"
  // Section labels appear as merged single-cell rows

  let currentSection = "";

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const excelRow = i + 1;
    if (isBlankRow(row)) continue;

    const col0 = trimCell(row[0]);

    // Section label: single populated cell describing the race/region group
    if (isSectionHeader(row)) {
      if (/level range/i.test(col0)) continue; // this is a sub-header row
      currentSection = cleanSectionLabel(col0);
      continue;
    }

    // Skip the header row itself
    if (/^level range$/i.test(col0)) continue;

    // Data rows: col0 = level range like "1-4" or "8-17"
    if (!/^\d/.test(col0) && !/^[a-z]/i.test(col0)) continue;

    // Must have at least zone in col1
    const zone = trimCell(row[1]);
    if (!zone) continue;

    // Apply max-rows at collection time
    if (maxRows > 0 && records.length >= maxRows) break;

    const zemRaw = trimCell(row[2]);

    records.push({
      _source_row: excelRow,
      section: currentSection,
      level_range: col0,
      zone,
      zem: toNumber(zemRaw),
      play_style: trimCell(row[3]),
      why_its_good: trimCell(row[4]),
      tips: trimCell(row[5]),
      races_best_for: trimCell(row[6]),
    });
  }

  return {
    sheet_name: "Leveling Guide",
    row_count: records.length,
    extracted_at: nowIso(),
    warnings,
    records,
  };
}

// ── Zone XP Modifiers ──────────────────────────────────────────────────────
function emitZoneXp(ws: XLSX.WorkSheet): ZoneXpOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const records: ZoneXpRow[] = [];

  // Find header: Zone | ZEM Value | Bonus % | Expansion | Level Range | Type | Star Rating
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (trimCell(allRows[i][0]).toLowerCase() === "zone") {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    warnings.push("Could not find header row with 'Zone' column");
    return { sheet_name: "Zone XP Modifiers", row_count: 0, extracted_at: nowIso(), warnings, records: [] };
  }

  const dataRows = allRows.slice(headerRowIdx + 1);
  const capped = applyMaxRows(dataRows);

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = headerRowIdx + 2 + i;
    if (isBlankRow(row)) continue;

    const zoneName = trimCell(row[0]);
    if (!zoneName) continue;
    // Skip section headers like "Classic Zones", "Kunark Zones"
    if (isSectionHeader(row)) continue;

    const zemRaw = toNumber(row[1]);
    if (zemRaw === null) {
      warnings.push(`Row ${excelRow}: ZEM value missing or non-numeric for zone "${zoneName}", skipping`);
      continue;
    }

    const starRaw = trimCell(row[6]);

    records.push({
      _source_row: excelRow,
      zone: zoneName,
      zem_value: zemRaw,
      bonus_pct: trimCell(row[2]),
      expansion: trimCell(row[3]),
      level_range: trimCell(row[4]),
      type: trimCell(row[5]),
      star_rating: starRaw,
      star_count: countStars(starRaw),
    });
  }

  return {
    sheet_name: "Zone XP Modifiers",
    row_count: records.length,
    extracted_at: nowIso(),
    warnings,
    records,
  };
}

// ── Best in Slot Gear ──────────────────────────────────────────────────────
function emitBisGear(ws: XLSX.WorkSheet): BisGearOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const records: BisGearRow[] = [];

  // Header row: "Item Name | Haste% | Slot | Source | Notes"
  // There are multiple sub-sections (haste era, class-based gear, etc.)
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    const col0 = trimCell(allRows[i][0]).toLowerCase();
    if (col0 === "item name" || col0 === "item") {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    warnings.push("Could not find header row with 'Item Name' column");
    return { sheet_name: "Best in Slot Gear", row_count: 0, extracted_at: nowIso(), warnings, records: [] };
  }

  let currentSection = "";

  const dataRows = allRows.slice(headerRowIdx + 1);
  const capped = applyMaxRows(dataRows);

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = headerRowIdx + 2 + i;
    if (isBlankRow(row)) continue;

    const col0 = trimCell(row[0]);

    // Section header rows (e.g. "Classic Era Haste Items", "CLASS: WARRIOR")
    if (isSectionHeader(row)) {
      currentSection = cleanSectionLabel(col0);
      continue;
    }

    // Skip sub-header rows that repeat the column headers
    if (/^item\s*name$/i.test(col0)) {
      // Re-detect if there's a new column layout by updating headerRowIdx
      headerRowIdx = headerRowIdx + 1 + i;
      continue;
    }

    const itemName = col0;
    if (!itemName) continue;

    records.push({
      _source_row: excelRow,
      section: currentSection,
      item_name: itemName,
      haste_pct: trimCell(row[1]) || null,
      slot: trimCell(row[2]),
      source: trimCell(row[3]),
      notes: trimCell(row[4]),
    });
  }

  return {
    sheet_name: "Best in Slot Gear",
    row_count: records.length,
    extracted_at: nowIso(),
    warnings,
    records,
  };
}

// ── Faction Guide ──────────────────────────────────────────────────────────
function emitFactions(ws: XLSX.WorkSheet): FactionsOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const summary: FactionSummaryRow[] = [];
  const details: FactionDetailRow[] = [];

  // Find the summary table header: "Faction | Leader | City | Territory | Armor Tier | Armor Quality"
  let summaryHeaderIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (trimCell(allRows[i][0]).toLowerCase() === "faction") {
      summaryHeaderIdx = i;
      break;
    }
  }
  if (summaryHeaderIdx === -1) {
    warnings.push("Could not find summary header row with 'Faction' column");
  } else {
    // Read 3 summary rows (Coldain, Kromzek, CoV)
    for (let i = summaryHeaderIdx + 1; i < Math.min(summaryHeaderIdx + 6, allRows.length); i++) {
      const row = allRows[i];
      if (isBlankRow(row)) continue;
      const faction = trimCell(row[0]);
      if (!faction || isSectionHeader(row)) break;

      summary.push({
        _source_row: i + 1,
        faction,
        leader: trimCell(row[1]),
        city: trimCell(row[2]),
        territory: trimCell(row[3]),
        armor_tier: trimCell(row[4]),
        armor_quality: trimCell(row[5]),
      });
    }
  }

  // Collect all remaining content as detail rows (section + free-text content)
  let currentSection = "";
  const detailStartIdx = summaryHeaderIdx !== -1 ? summaryHeaderIdx + summary.length + 1 : 0;
  const detailRows = allRows.slice(detailStartIdx);
  const capped = applyMaxRows(detailRows);

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = detailStartIdx + i + 1;
    if (isBlankRow(row)) continue;

    const col0 = trimCell(row[0]);
    if (!col0) continue;

    if (isSectionHeader(row)) {
      currentSection = cleanSectionLabel(col0);
      continue;
    }

    // Skip re-encountered summary header
    if (/^faction$/i.test(col0)) continue;

    details.push({
      _source_row: excelRow,
      section: currentSection,
      content: col0,
    });
  }

  return {
    sheet_name: "Faction Guide",
    row_count: summary.length + details.length,
    extracted_at: nowIso(),
    warnings,
    summary,
    details,
  };
}

// ── PoP Progression Guide ──────────────────────────────────────────────────
function emitPopProgression(ws: XLSX.WorkSheet): PopProgressionOutput {
  const allRows = worksheetToRows(ws);
  const warnings: string[] = [];
  const records: PopProgressionRow[] = [];

  // Header: Step | Zone / Target | Action | Unlocks | Notes
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (trimCell(allRows[i][0]).toLowerCase() === "step") {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    warnings.push("Could not find header row with 'Step' column");
    return { sheet_name: "PoP Progression Guide", row_count: 0, extracted_at: nowIso(), warnings, records: [] };
  }

  const dataRows = allRows.slice(headerRowIdx + 1);
  const capped = applyMaxRows(dataRows);

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = headerRowIdx + 2 + i;
    if (isBlankRow(row)) continue;

    const stepRaw = row[0];
    const stepNum = toNumber(stepRaw);
    if (stepNum === null) continue; // skip non-numeric step rows

    const unlocksRaw = trimCell(row[3]);

    records.push({
      _source_row: excelRow,
      step: stepNum,
      zone_target: trimCell(row[1]),
      action: trimCell(row[2]),
      unlocks: unlocksRaw ? splitCommaList(unlocksRaw) : [],
      notes: trimCell(row[4]),
    });
  }

  return {
    sheet_name: "PoP Progression Guide",
    row_count: records.length,
    extracted_at: nowIso(),
    warnings,
    records,
  };
}

// ── Generic crafting sheet emitter ─────────────────────────────────────────
type CraftSheetConfig = {
  sheetName: string;
  craftType: string;
  /** Column index overrides if schema differs from default */
  colMap?: {
    name?: number;
    trivial?: number;
    ingredients?: number;
    category?: number;
    notes?: number;
    // Jewelcraft extras
    metalBar?: number;
    gem?: number;
    stats?: number;
  };
};

function emitCraftingSheet(ws: XLSX.WorkSheet, cfg: CraftSheetConfig): CraftingRecipeRow[] {
  const allRows = worksheetToRows(ws);
  const records: CraftingRecipeRow[] = [];
  const cols = cfg.colMap ?? {};

  // Determine column indices by inspecting header row
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    const first = trimCell(allRows[i][0]).toLowerCase();
    // Tailoring/Fletching/Blacksmithing/Spell Research: "Recipe Name" / "Spell Name"
    // Jewelcraft: "Item Name"
    if (first === "recipe name" || first === "spell name" || first === "item name") {
      headerRowIdx = i;
      break;
    }
  }

  // Default column positions based on header detection
  const nameCol = cols.name ?? 0;
  const trivialCol = cols.trivial ?? 1;
  const col2 = cols.ingredients ?? cols.metalBar ?? 2;
  const col3 = cols.gem ?? cols.category ?? 3;
  const col4 = cols.stats ?? cols.notes ?? 4;
  const col5 = cols.notes ?? 5;

  const isJewelcraft = cfg.craftType === "Jewelcraft";
  const isSpellResearch = cfg.craftType === "Spell Research";

  const dataStart = headerRowIdx !== -1 ? headerRowIdx + 1 : 2;
  const dataRows = allRows.slice(dataStart);
  const capped = applyMaxRows(dataRows);

  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    const excelRow = dataStart + i + 1;
    if (isBlankRow(row)) continue;

    const name = trimCell(row[nameCol]);
    if (!name || isSectionHeader(row)) continue;
    // Skip section labels that are clearly not recipes
    if (/^[A-Z\s]{4,}$/.test(name) && !row[trivialCol]) continue;

    const trivialRaw = trimCell(row[trivialCol]);
    const trivial = toNumber(trivialRaw);

    if (isJewelcraft) {
      const metal = trimCell(row[col2]);
      const gem = trimCell(row[col3]);
      const stats = trimCell(row[col4]);
      const notes = trimCell(row[col5]);

      records.push({
        _source_row: excelRow,
        craft_type: cfg.craftType,
        recipe_name: name,
        trivial,
        ingredients: [metal, gem].filter(Boolean).join(", "),
        category: "Jewelry",
        notes,
        metal_bar: metal,
        gem,
        stats,
      });
    } else if (isSpellResearch) {
      // Spell Name | Level | Class | Ingredients | Notes
      const level = trimCell(row[1]);
      const spellClass = trimCell(row[2]);
      const ingredients = trimCell(row[3]);
      const notes = trimCell(row[4]);

      records.push({
        _source_row: excelRow,
        craft_type: cfg.craftType,
        recipe_name: name,
        trivial: toNumber(level), // level used as "trivial" proxy
        ingredients,
        category: spellClass,
        notes,
      });
    } else {
      // Standard: Recipe Name | Trivial | Ingredients | Category | Notes
      records.push({
        _source_row: excelRow,
        craft_type: cfg.craftType,
        recipe_name: name,
        trivial,
        ingredients: trimCell(row[col2]),
        category: trimCell(row[col3]),
        notes: trimCell(row[col4]),
      });
    }
  }

  return records;
}

function emitCrafting(workbook: XLSX.WorkBook): CraftingOutput {
  const craftSheets: CraftSheetConfig[] = [
    { sheetName: "Tailoring", craftType: "Tailoring" },
    { sheetName: "Fletching", craftType: "Fletching" },
    { sheetName: "Blacksmithing", craftType: "Blacksmithing" },
    { sheetName: "Jewelcraft", craftType: "Jewelcraft" },
    { sheetName: "Spell Research", craftType: "Spell Research" },
  ];

  const warnings: string[] = [];
  const allRecords: CraftingRecipeRow[] = [];
  const craftTypes: string[] = [];

  for (const cfg of craftSheets) {
    const ws = workbook.Sheets[cfg.sheetName];
    if (!ws) {
      warnings.push(`Sheet "${cfg.sheetName}" not found in workbook`);
      continue;
    }
    craftTypes.push(cfg.craftType);
    const rows = emitCraftingSheet(ws, cfg);
    allRecords.push(...rows);
  }

  return {
    sheet_name: "Crafting (combined)",
    row_count: allRecords.length,
    extracted_at: nowIso(),
    warnings,
    craft_types: craftTypes,
    records: allRecords,
  };
}

// ─── Normalization step ────────────────────────────────────────────────────

type ItemDetailsMap = Record<string, { name: string }>;

/**
 * Cross-references item names found in Excel imports against item-details.json.
 * Collects item names from BIS gear and Epic quests (the two main item-heavy sheets).
 */
async function runNormalization(
  bisGear: BisGearOutput,
  epicQuests: EpicQuestsOutput,
): Promise<NormalizationReport> {
  const generatedAt = nowIso();

  if (!existsSync(itemDetailsPath)) {
    console.warn(`[normalization] item-details.json not found at ${itemDetailsPath}, skipping cross-reference`);
    return {
      generated_at: generatedAt,
      item_details_count: 0,
      excel_items_checked: 0,
      matched: 0,
      not_found: 0,
      partial: 0,
      matches: [],
    };
  }

  const rawDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as ItemDetailsMap;
  const itemDetailsCount = Object.keys(rawDetails).length;

  // Build a normalized lookup map: lowercase-trimmed name → canonical name
  const detailsLower = new Map<string, string>();
  for (const key of Object.keys(rawDetails)) {
    detailsLower.set(key.toLowerCase().trim(), key);
  }

  // Collect candidate item names from BIS gear sheet
  const candidates: Array<{ name: string; sheet: string; row: number }> = [];

  for (const row of bisGear.records) {
    if (row.item_name) {
      candidates.push({ name: row.item_name, sheet: "Best in Slot Gear", row: row._source_row });
    }
  }

  // Collect item names from Epic quests (from the "items" field)
  for (const cls of epicQuests.classes) {
    for (const step of cls.steps) {
      if (step.items) {
        // Items field may contain "Receive: ItemName" or "Loot: ItemName"
        const itemMatch = step.items.match(/(?:Receive|Loot|Give):\s*(.+)/i);
        const itemName = itemMatch ? itemMatch[1].trim() : step.items.trim();
        if (itemName && !itemName.startsWith("(") && itemName.length > 3) {
          candidates.push({ name: itemName, sheet: "Epic 1.0 Quests", row: step._source_row });
        }
      }
    }
  }

  const matches: NormalizationMatch[] = [];
  let matched = 0;
  let notFound = 0;
  let partial = 0;

  for (const candidate of candidates) {
    const normalized = candidate.name.toLowerCase().trim();

    if (detailsLower.has(normalized)) {
      matched++;
      matches.push({
        excel_name: candidate.name,
        source_sheet: candidate.sheet,
        source_row: candidate.row,
        status: "matched",
        matched_name: detailsLower.get(normalized),
      });
    } else {
      // Try partial/fuzzy: check if any known item name contains the candidate as substring
      let partialMatch: string | undefined;
      for (const [lowerKey, canonKey] of detailsLower) {
        if (lowerKey.includes(normalized) || normalized.includes(lowerKey)) {
          partialMatch = canonKey;
          break;
        }
      }
      if (partialMatch) {
        partial++;
        matches.push({
          excel_name: candidate.name,
          source_sheet: candidate.sheet,
          source_row: candidate.row,
          status: "partial",
          matched_name: partialMatch,
          note: `Partial match — verify canonical name`,
        });
      } else {
        notFound++;
        matches.push({
          excel_name: candidate.name,
          source_sheet: candidate.sheet,
          source_row: candidate.row,
          status: "not_found",
          note: "No matching item found in item-details.json",
        });
      }
    }
  }

  return {
    generated_at: generatedAt,
    item_details_count: itemDetailsCount,
    excel_items_checked: candidates.length,
    matched,
    not_found: notFound,
    partial,
    matches,
  };
}

// ─── Sheet registry ────────────────────────────────────────────────────────

type SheetEntry = {
  key: string;          // CLI key (e.g. "spell-vendors")
  sheetName: string;    // Exact Excel sheet name
  outFile: string;      // Output filename under outDir
  tier: 1 | 2;
};

const SHEET_REGISTRY: SheetEntry[] = [
  { key: "spell-vendors",       sheetName: "Spell Vendors",            outFile: "spell-vendors.json",      tier: 1 },
  { key: "tradeable-schedule",  sheetName: "Tradeable Items & Schedule", outFile: "tradeable-schedule.json", tier: 1 },
  { key: "epic-quests",         sheetName: "Epic 1.0 Quests",          outFile: "epic-quests.json",        tier: 1 },
  { key: "leveling-guide",      sheetName: "Leveling Guide",           outFile: "leveling-guide.json",     tier: 1 },
  { key: "zone-xp",             sheetName: "Zone XP Modifiers",        outFile: "zone-xp.json",            tier: 1 },
  { key: "bis-gear",            sheetName: "Best in Slot Gear",        outFile: "bis-gear.json",           tier: 1 },
  { key: "factions",            sheetName: "Faction Guide",            outFile: "factions.json",           tier: 1 },
  { key: "pop-progression",     sheetName: "PoP Progression Guide",    outFile: "pop-progression.json",    tier: 1 },
  { key: "crafting",            sheetName: "(combined)",               outFile: "crafting.json",           tier: 1 },
];

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[ingest-excel] Starting. dry-run=${dryRun}, max-rows=${maxRows || "unlimited"}, all=${allSheets}`);

  if (!existsSync(excelPath)) {
    console.error(`Excel file not found: ${excelPath}`);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  // Determine which sheets to process
  let sheetsToRun: SheetEntry[];
  if (allSheets) {
    sheetsToRun = SHEET_REGISTRY;
  } else if (requestedSheetKeys.length > 0) {
    sheetsToRun = SHEET_REGISTRY.filter((s) => requestedSheetKeys.includes(s.key));
    const unknown = requestedSheetKeys.filter((k) => !SHEET_REGISTRY.find((s) => s.key === k));
    if (unknown.length) {
      console.warn(`Unknown sheet keys (ignored): ${unknown.join(", ")}`);
      console.warn(`Valid keys: ${SHEET_REGISTRY.map((s) => s.key).join(", ")}`);
    }
  } else {
    // Default: all Tier 1 sheets
    sheetsToRun = SHEET_REGISTRY.filter((s) => s.tier === 1);
  }

  console.log(`Processing ${sheetsToRun.length} sheet(s): ${sheetsToRun.map((s) => s.key).join(", ")}`);

  // Load workbook once
  console.log(`Loading workbook: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);
  console.log(`Workbook loaded. Available sheets: ${workbook.SheetNames.join(", ")}`);

  // Results tracking
  const results: Array<{ key: string; status: "ok" | "warn" | "fail"; rowCount: number; warnings: string[]; error?: string }> = [];

  // Helper: emit and write a single sheet
  async function processSheet(entry: SheetEntry) {
    const outPath = path.join(outDir, entry.outFile);

    try {
      let output: SheetMeta & Record<string, unknown>;

      if (entry.key === "crafting") {
        output = emitCrafting(workbook);
      } else {
        const ws = workbook.Sheets[entry.sheetName];
        if (!ws) {
          results.push({ key: entry.key, status: "fail", rowCount: 0, warnings: [], error: `Sheet "${entry.sheetName}" not found in workbook` });
          console.error(`[${entry.key}] FAIL: sheet not found`);
          return;
        }

        switch (entry.key) {
          case "spell-vendors":       output = emitSpellVendors(ws); break;
          case "tradeable-schedule":  output = emitTradeableSchedule(ws); break;
          case "epic-quests":         output = emitEpicQuests(ws); break;
          case "leveling-guide":      output = emitLevelingGuide(ws); break;
          case "zone-xp":             output = emitZoneXp(ws); break;
          case "bis-gear":            output = emitBisGear(ws); break;
          case "factions":            output = emitFactions(ws); break;
          case "pop-progression":     output = emitPopProgression(ws); break;
          default:
            results.push({ key: entry.key, status: "fail", rowCount: 0, warnings: [], error: `No emitter defined for key "${entry.key}"` });
            return;
        }
      }

      await atomicWrite(outPath, output, entry.key);
      const status = output.warnings.length > 0 ? "warn" : "ok";
      results.push({ key: entry.key, status, rowCount: output.row_count, warnings: output.warnings });

      if (output.warnings.length) {
        for (const w of output.warnings) {
          console.warn(`  [${entry.key}] warning: ${w}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ key: entry.key, status: "fail", rowCount: 0, warnings: [], error: msg });
      console.error(`[${entry.key}] FAIL: ${msg}`);
    }
  }

  for (const entry of sheetsToRun) {
    await processSheet(entry);
  }

  // Run normalization if BIS gear and epic quests were processed
  const bisEntry = results.find((r) => r.key === "bis-gear");
  const epicEntry = results.find((r) => r.key === "epic-quests");

  if (bisEntry?.status !== "fail" && epicEntry?.status !== "fail") {
    try {
      // Re-read the written files (or re-run emitters) for normalization
      const bisWs = workbook.Sheets["Best in Slot Gear"];
      const epicWs = workbook.Sheets["Epic 1.0 Quests"];

      if (bisWs && epicWs) {
        const bisOutput = emitBisGear(bisWs);
        const epicOutput = emitEpicQuests(epicWs);
        const normReport = await runNormalization(bisOutput, epicOutput);
        const normPath = path.join(outDir, "_normalization-report.json");
        await atomicWrite(normPath, normReport, "normalization-report");
        console.log(`Normalization: ${normReport.excel_items_checked} items checked, ${normReport.matched} matched, ${normReport.partial} partial, ${normReport.not_found} not found`);
      }
    } catch (err) {
      console.warn(`Normalization step failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Summary report
  console.log("\n─── Ingest Summary ───────────────────────────────────────");
  for (const r of results) {
    const icon = r.status === "ok" ? "OK" : r.status === "warn" ? "WARN" : "FAIL";
    const detail = r.status === "fail" ? ` — ${r.error}` : ` (${r.rowCount} rows, ${r.warnings.length} warnings)`;
    console.log(`  [${icon}] ${r.key}${detail}`);
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const totalRows = results.reduce((sum, r) => sum + r.rowCount, 0);

  console.log(`\n  Total: ${ok} ok, ${warn} with warnings, ${fail} failed`);
  console.log(`  Total rows emitted: ${totalRows}`);
  if (dryRun) console.log("  (dry-run: no files written)");
  console.log("──────────────────────────────────────────────────────────\n");

  if (fail > 0) process.exit(1);
}

await main();
