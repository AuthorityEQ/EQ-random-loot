// Canonical class list (14 classes with 1.0 epics)

/** Display-name list; order determines pill order in the selector bar. */
export const EPIC_CLASSES = [
  "Bard",
  "Cleric",
  "Druid",
  "Enchanter",
  "Magician",
  "Monk",
  "Necromancer",
  "Paladin",
  "Ranger",
  "Rogue",
  "Shadowknight",
  "Shaman",
  "Warrior",
  "Wizard",
] as const;

export type EpicClassName = (typeof EPIC_CLASSES)[number];

/**
 * Maps the uppercase ingest class name to the canonical display name used
 * across the UI and localStorage keys.
 */
export const CLASS_NAME_MAP: Record<string, EpicClassName> = {
  BARD: "Bard",
  CLERIC: "Cleric",
  DRUID: "Druid",
  ENCHANTER: "Enchanter",
  MAGICIAN: "Magician",
  MONK: "Monk",
  NECROMANCER: "Necromancer",
  PALADIN: "Paladin",
  RANGER: "Ranger",
  ROGUE: "Rogue",
  "SHADOW KNIGHT": "Shadowknight",
  SHADOWKNIGHT: "Shadowknight",
  SHAMAN: "Shaman",
  WARRIOR: "Warrior",
  WIZARD: "Wizard",
};

// Normalized types — what the client component receives

export type NormalizedStep = {
  /** 1-based step number (parsed from the raw string). */
  stepNumber: number;
  /** Raw string value from the sheet (kept for display). */
  stepRaw: string;
  phase: string;
  action: string;
  npcMob: string | null;
  zone: string | null;
  items: string | null;
  notes: string | null;
  sourceRow: number;
};

export type NormalizedClassEpic = {
  className: EpicClassName;
  weaponName: string;
  steps: NormalizedStep[];
};

// Data contract — shared with the Excel ingest agent

/**
 * Shape produced by the Excel ingest pipeline at
 * data/excel-imports/epic-quests.json.
 *
 * TOP-LEVEL FIELDS
 *   sheet_name   — Source sheet name from the workbook (informational).
 *   row_count    — Raw number of rows read (informational).
 *   extracted_at — ISO timestamp of the last ingest run.
 *   warnings     — Array of non-fatal ingest warnings.
 *   classes      — One entry per EQ class that has a 1.0 epic quest.
 *   _status      — Optional. Present only on the stub file;
 *                  value "pending_excel_ingest" signals "no real data yet".
 *
 * RawClassEpic (per-class object)
 *   class_name   — Uppercase class name e.g. "PALADIN", "SHADOW KNIGHT".
 *   weapon_name  — Uppercase weapon name e.g. "SINGING SHORT SWORD".
 *   steps        — Ordered array of RawEpicStep objects.
 *
 * RawEpicStep (per-step object)
 *   _source_row  — Row index in the source sheet (debugging aid).
 *   step         — Step number as a string (e.g. "1", "2").
 *   phase        — Optional phase label (empty string when unused).
 *   action       — Human-readable instruction text for this step.
 *   npc_mob      — NPC or mob name involved in the step; may be empty string.
 *   zone         — Zone name where the step occurs; may be empty string.
 *   items        — Item(s) received or consumed; free-text; may be empty.
 *   notes        — Additional notes; may be empty string.
 */
export type RawEpicStep = {
  _source_row: number;
  step: string;
  phase: string;
  action: string;
  npc_mob: string;
  zone: string;
  items: string;
  notes: string;
};

export type RawClassEpic = {
  class_name: string;
  weapon_name: string;
  steps: RawEpicStep[];
};

export type EpicQuestsFile = {
  sheet_name?: string;
  row_count?: number;
  extracted_at?: string;
  warnings?: string[];
  _status?: string;
  classes: RawClassEpic[];
};
