import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ResearchClassName =
  | "Bard"
  | "Beastlord"
  | "Cleric"
  | "Druid"
  | "Enchanter"
  | "Magician"
  | "Necromancer"
  | "Paladin"
  | "Ranger"
  | "Shadowknight"
  | "Shaman"
  | "Wizard";

type Recipe = {
  id: number;
  expansion: string;
  name: string;
  trivial: number | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
};

type RecipePayload = {
  recipes: Recipe[];
  parserNotes?: string[];
};

type SpellRecord = {
  name: string;
  level: number;
  class: string;
  expansion?: string;
  sourceUrl?: string;
};

type LevelMatch = {
  spellName: string;
  className: ResearchClassName;
  level: number;
  source: string;
  sourceUrl?: string;
};

const recipePath = resolve("data/crafting-spell-research-recipes.json");
const reportPath = resolve("data/research-spell-level-enrichment-report.json");
const localSpellPaths = [
  { path: resolve("data/spells.json"), source: "data/spells.json" },
  { path: resolve("data/dropped-spells.json"), source: "data/dropped-spells.json" },
];

const earlyExpansions = new Set([
  "Original",
  "Ruins of Kunark",
  "Scars of Velious",
  "Shadows of Luclin",
]);

const classCodeMap = new Map<string, ResearchClassName>([
  ["BRD", "Bard"],
  ["BST", "Beastlord"],
  ["CLR", "Cleric"],
  ["DRU", "Druid"],
  ["ENC", "Enchanter"],
  ["MAG", "Magician"],
  ["NEC", "Necromancer"],
  ["PAL", "Paladin"],
  ["RNG", "Ranger"],
  ["SHD", "Shadowknight"],
  ["SHM", "Shaman"],
  ["WIZ", "Wizard"],
]);

const lucyClassPages: Array<{ className: ResearchClassName; fileName: string; url: string }> = [
  { className: "Bard", fileName: "Bard.html", url: "https://lucy.alkabor.com/index_Bard.html" },
  { className: "Beastlord", fileName: "Beastlord.html", url: "https://lucy.alkabor.com/index_Beastlord.html" },
  { className: "Cleric", fileName: "Cleric.html", url: "https://lucy.alkabor.com/index_Cleric.html" },
  { className: "Druid", fileName: "Druid.html", url: "https://lucy.alkabor.com/index_Druid.html" },
  { className: "Enchanter", fileName: "Enchanter.html", url: "https://lucy.alkabor.com/index_Enchanter.html" },
  { className: "Magician", fileName: "Magician.html", url: "https://lucy.alkabor.com/index_Magician.html" },
  { className: "Necromancer", fileName: "Necromancer.html", url: "https://lucy.alkabor.com/index_Necromancer.html" },
  { className: "Paladin", fileName: "Paladin.html", url: "https://lucy.alkabor.com/index_Paladin.html" },
  { className: "Ranger", fileName: "Ranger.html", url: "https://lucy.alkabor.com/index_Ranger.html" },
  { className: "Shadowknight", fileName: "ShadowKnight.html", url: "https://lucy.alkabor.com/index_ShadowKnight.html" },
  { className: "Shaman", fileName: "Shaman.html", url: "https://lucy.alkabor.com/index_Shaman.html" },
  { className: "Wizard", fileName: "Wizard.html", url: "https://lucy.alkabor.com/index_Wizard.html" },
];

function normalizeSpellName(value: string) {
  return value
    .replace(/^spell:\s*/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[\u2018\u2019'`]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function keyFor(spellName: string, className: ResearchClassName) {
  return `${normalizeSpellName(spellName)}|${className}`;
}

function addMatch(matches: Map<string, LevelMatch[]>, match: LevelMatch) {
  const key = keyFor(match.spellName, match.className);
  matches.set(key, [...(matches.get(key) ?? []), match]);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function loadLocalSpellMatches() {
  const matches = new Map<string, LevelMatch[]>();
  for (const sourceFile of localSpellPaths) {
    const spells = JSON.parse(readFileSync(sourceFile.path, "utf8")) as SpellRecord[];
    for (const spell of spells) {
      const className = classCodeMap.get(spell.class);
      if (!className || !Number.isFinite(spell.level)) continue;
      addMatch(matches, {
        spellName: spell.name,
        className,
        level: spell.level,
        source: sourceFile.source,
        sourceUrl: spell.sourceUrl,
      });
    }
  }
  return matches;
}

function loadLucySpellMatches() {
  const matches = new Map<string, LevelMatch[]>();
  for (const page of lucyClassPages) {
    const html = readFileSync(resolve(".codex-work/lucy-spell-pages", page.fileName), "utf8");
    let currentLevel: number | null = null;
    const linePattern = /(?:Level\s+(\d+)|<a\s+href="spell_(\d+)\.html">([^<]+)<\/a>)/g;
    let match: RegExpExecArray | null;
    while ((match = linePattern.exec(html)) !== null) {
      if (match[1]) {
        currentLevel = Number(match[1]);
        continue;
      }
      if (currentLevel === null || !match[3]) continue;
      addMatch(matches, {
        spellName: decodeHtmlEntities(match[3]),
        className: page.className,
        level: currentLevel,
        source: "Lucy Al`Kabor class spell index",
        sourceUrl: page.url,
      });
    }
  }
  return matches;
}

function resolveLevel(matches: Map<string, LevelMatch[]>, recipe: Recipe, className: ResearchClassName) {
  const candidates = matches.get(keyFor(recipe.name, className)) ?? [];
  if (candidates.length === 0) return { status: "missing" as const, candidates };
  const localCandidates = candidates.filter((candidate) => candidate.source.startsWith("data/"));
  const preferredCandidates = localCandidates.length > 0 ? localCandidates : candidates;
  const levels = Array.from(new Set(preferredCandidates.map((candidate) => candidate.level)));
  if (levels.length > 1) return { status: "ambiguous" as const, candidates: preferredCandidates };
  return { status: "matched" as const, candidates: preferredCandidates };
}

const payload = JSON.parse(readFileSync(recipePath, "utf8")) as RecipePayload;
const matches = loadLocalSpellMatches();
for (const [key, lucyMatches] of loadLucySpellMatches()) {
  matches.set(key, [...(matches.get(key) ?? []), ...lucyMatches]);
}

const updated: Array<Record<string, unknown>> = [];
const alreadyKnown: Array<Record<string, unknown>> = [];
const missing: Array<Record<string, unknown>> = [];
const ambiguous: Array<Record<string, unknown>> = [];

for (const recipe of payload.recipes) {
  const className = recipe.sourceMetadata?.researchClass;
  if (
    !earlyExpansions.has(recipe.expansion)
    || typeof className !== "string"
    || !lucyClassPages.some((page) => page.className === className)
    || !/^Spell:/i.test(recipe.name)
  ) {
    continue;
  }

  const researchClass = className as ResearchClassName;
  const existingLevel = recipe.sourceMetadata?.researchSpellLevel;
  const result = resolveLevel(matches, recipe, researchClass);

  if (result.status === "matched") {
    const [first] = result.candidates;
    if (existingLevel === first.level) {
      alreadyKnown.push({ id: recipe.id, name: recipe.name, className: researchClass, level: first.level });
      continue;
    }
    recipe.sourceMetadata = {
      ...(recipe.sourceMetadata ?? {}),
      researchSpellLevel: first.level,
      researchSpellLevelMatchedName: first.spellName,
      researchSpellLevelSource: Array.from(new Set(result.candidates.map((candidate) => candidate.source))).join("; "),
      researchSpellLevelSourceUrl: first.sourceUrl ?? null,
    };
    updated.push({
      id: recipe.id,
      name: recipe.name,
      className: researchClass,
      expansion: recipe.expansion,
      trivial: recipe.trivial,
      level: first.level,
      sources: Array.from(new Set(result.candidates.map((candidate) => candidate.source))),
    });
  } else if (result.status === "ambiguous") {
    ambiguous.push({
      id: recipe.id,
      name: recipe.name,
      className: researchClass,
      expansion: recipe.expansion,
      candidates: result.candidates,
    });
  } else {
    missing.push({
      id: recipe.id,
      name: recipe.name,
      className: researchClass,
      expansion: recipe.expansion,
      trivial: recipe.trivial,
    });
  }
}

payload.parserNotes = Array.from(new Set([
  ...(payload.parserNotes ?? []),
  "Early-era Research spell levels are enriched from local spell JSON first, then cached Lucy Al`Kabor class spell indexes when a clear class/name match exists.",
]));

const report = {
  generatedAt: new Date().toISOString(),
  sources: [
    "data/spells.json",
    "data/dropped-spells.json",
    ...lucyClassPages.map((page) => page.url),
  ],
  summary: {
    updated: updated.length,
    alreadyKnown: alreadyKnown.length,
    missing: missing.length,
    ambiguous: ambiguous.length,
  },
  updated,
  alreadyKnown,
  missing,
  ambiguous,
};

writeFileSync(recipePath, `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
