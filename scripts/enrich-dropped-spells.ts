import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SpellExpansion = "Classic" | "Kunark" | "Velious";

type DropSource = {
  mob: string;
  zone: string;
  sourceUrl: string;
};

type QuestSource = {
  name: string;
  npc?: string;
  zone?: string;
};

type EnrichmentStatus = "ok" | "no_source_data" | "fetch_error";

type DroppedSpell = {
  name: string;
  level: number;
  class: string;
  expansion: SpellExpansion;
  description: string;
  sourceUrl: string;
  sourceType: string;
  dropSources?: DropSource[];
  questSource?: QuestSource;
  enrichmentStatus?: EnrichmentStatus;
};

// ---------------------------------------------------------------------------
// Config / flags
// ---------------------------------------------------------------------------

const root = process.cwd();
const inputPath = path.join(root, "data", "dropped-spells.json");
const cacheDir = path.join(root, "cache", "spell-pages");
const userAgent = "FrostreaverRandomLoot/1.0 local spell vendor data indexing";
const fetchDelayMs = 1500;

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const maxArg = Number(getFlag("max") ?? 0);
const dryRun = hasFlag("dry");
const forceRefetch = hasFlag("force");

// ---------------------------------------------------------------------------
// Shared helpers (same conventions as import-zam-spells.ts)
// ---------------------------------------------------------------------------

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function inlineText(value: string): string {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function spellIdFromUrl(sourceUrl: string): string | null {
  return sourceUrl.match(/[?&]spell=(\d+)/)?.[1] ?? null;
}

function cachePath(spellClass: string, spellId: string): string {
  return path.join(cacheDir, `${spellClass.toLowerCase()}-${spellId}.html`);
}

async function readOrFetch(url: string, filePath: string): Promise<string> {
  await mkdir(path.dirname(filePath), { recursive: true });
  if (!forceRefetch && existsSync(filePath)) {
    return readFile(filePath, "utf8");
  }
  await delay(fetchDelayMs);
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

// ---------------------------------------------------------------------------
// Drop source parser
//
// Allakhazam spell pages expose drop data in tab content divs whose IDs
// match these patterns:
//   - Dropped_By_t
//   - Scroll_1_Dropped_By_t  (when the spell has multiple scroll items)
//   - Scroll_2_Dropped_By_t
//   - Scroll_N_Dropped_By_t  (any numeric prefix)
//
// HTML structure inside each block:
//   <h3>Found as loot</h3>
//   <br><strong>ZoneName</strong>
//   <br> &nbsp; &nbsp; <a href="/db/npc.html?id=NNN">MobName</a>
//   ...repeated per mob, new <strong> for each zone group...
//
// Zone names appear as plain <strong> text (not links) in the drop block.
// ---------------------------------------------------------------------------

function extractDropBlocks(html: string): string[] {
  // Match all div IDs ending in _Dropped_By_t (covers both plain and Scroll_N_ variants)
  const starts = Array.from(
    html.matchAll(/(<div\s+id=["'](?:[^"']*_)?Dropped_By_t["'][^>]*>)/gi),
  ).map((m) => ({ index: m.index ?? -1, length: m[0].length })).filter((e) => e.index >= 0);

  const blocks: string[] = [];
  for (const { index, length } of starts) {
    // Find the closing boundary: next sibling tab div or end of string
    const after = html.slice(index + length);
    // Next tab content div starts a new section
    const nextTab = after.match(/<div\s+id=["'][^"']+"_t["'][^>]*>/i);
    const end = nextTab?.index === undefined ? after.length : nextTab.index;
    blocks.push(html.slice(index, index + length + end));
  }
  return blocks;
}

function parseDropBlock(
  block: string,
  spellUrl: string,
): DropSource[] {
  const sources: DropSource[] = [];
  const base = spellUrl.split("#")[0];
  const anchor = `${base}#Dropped_By`;

  // Walk through <strong>...</strong> zone groups and collect <a href="/db/npc.html?..."> links
  // Pattern: <strong>ZoneName</strong> ... list of npc anchors until next <strong>
  const zoneGroupPattern = /<strong>([\s\S]*?)<\/strong>([\s\S]*?)(?=<strong>|$)/gi;
  let zoneMatch: RegExpExecArray | null;

  while ((zoneMatch = zoneGroupPattern.exec(block)) !== null) {
    const rawZone = zoneMatch[1];
    // Zone group headers may themselves contain an anchor (zone link) or just text
    const zone = inlineText(rawZone);
    if (!zone || zone.toLowerCase() === "found as loot") continue;

    const mobSection = zoneMatch[2];
    const npcPattern = /<a\s+href=["']\/db\/npc\.html\?[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    let npcMatch: RegExpExecArray | null;

    while ((npcMatch = npcPattern.exec(mobSection)) !== null) {
      const mob = inlineText(npcMatch[1]);
      if (!mob) continue;
      sources.push({ mob, zone, sourceUrl: anchor });
    }
  }

  return sources;
}

function parseDropSources(html: string, spellUrl: string): DropSource[] {
  const blocks = extractDropBlocks(html);
  if (blocks.length === 0) return [];

  const seen = new Set<string>();
  const all: DropSource[] = [];

  for (const block of blocks) {
    for (const source of parseDropBlock(block, spellUrl)) {
      const key = `${source.zone}\x00${source.mob}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(source);
    }
  }

  return all.sort((a, b) => a.zone.localeCompare(b.zone) || a.mob.localeCompare(b.mob));
}

// ---------------------------------------------------------------------------
// Quest source parser
//
// Allakhazam spell pages with quest rewards use:
//   id="Quested_t"  (plain)
//   id="Scroll_N_Quested_t"  (scroll variant — not observed yet but defensive)
//
// HTML structure:
//   <ul>
//     <li><a href="/db/quest.html?quest=NNN">QuestName</a></li>
//     ...
//   </ul>
//
// The page does not surface the quest NPC or zone inline in the Quested block;
// those would require fetching the quest page itself (out of scope here).
// We capture the first quest name only (most spells have one quest source).
// ---------------------------------------------------------------------------

function parseQuestSource(html: string): QuestSource | undefined {
  // Find Quested_t or Scroll_N_Quested_t div
  const questedMatch = html.match(
    /<div\s+id=["'](?:[^"']*_)?Quested_t["'][^>]*>([\s\S]*?)(?=<div\s+id=["'][^"']+_t["']|$)/i,
  );
  if (!questedMatch) return undefined;

  const block = questedMatch[1];
  const questLinkPattern = /<a\s+href=["']\/db\/quest\.html\?[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  const quests: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = questLinkPattern.exec(block)) !== null) {
    const name = inlineText(m[1]);
    if (name) quests.push(name);
  }

  if (quests.length === 0) return undefined;

  // Return the first quest; note additional quests if more than one exist
  return { name: quests[0] };
}

// ---------------------------------------------------------------------------
// Main enrichment loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const spells: DroppedSpell[] = JSON.parse(await readFile(inputPath, "utf8"));
  const subset = maxArg > 0 ? spells.slice(0, maxArg) : spells;

  let enriched = 0;
  let noSourceData = 0;
  let fetchError = 0;

  // Track ambiguous parses for reporting
  const ambiguous: { name: string; spellId: string; issue: string }[] = [];

  for (const [idx, spell] of subset.entries()) {
    const spellId = spellIdFromUrl(spell.sourceUrl);
    if (!spellId) {
      console.log(`[${idx + 1}/${subset.length}] Skipping — no spell ID in URL: ${spell.sourceUrl}`);
      spell.enrichmentStatus = "fetch_error";
      fetchError++;
      continue;
    }

    const file = cachePath(spell.class, spellId);
    const label = `${spell.class.toLowerCase()}-${spellId}`;
    console.log(`[${idx + 1}/${subset.length}] ${spell.name} (${label})`);

    let html: string;
    try {
      html = await readOrFetch(spell.sourceUrl, file);
    } catch (err) {
      console.error(`  fetch error: ${err instanceof Error ? err.message : String(err)}`);
      spell.enrichmentStatus = "fetch_error";
      fetchError++;
      continue;
    }

    const drops = parseDropSources(html, spell.sourceUrl);
    const quest = parseQuestSource(html);

    // Ambiguity detection: dropped-spells should have drops OR quest sources,
    // but some pages may legitimately have neither (data not yet indexed on ZAM).
    if (drops.length === 0 && !quest) {
      // Check whether the page has any Dropped_By tab at all (even if empty)
      const hasDropTab = /id=["'][^"']*Dropped_By_tab["']/i.test(html);
      const hasQuestedTab = /id=["'][^"']*Quested_tab["']/i.test(html);
      if (hasDropTab || hasQuestedTab) {
        ambiguous.push({
          name: spell.name,
          spellId,
          issue: `Tab exists (Dropped_By:${hasDropTab}, Quested:${hasQuestedTab}) but no mobs/quests parsed — selector may need refinement`,
        });
      }
      spell.enrichmentStatus = "no_source_data";
      delete spell.dropSources;
      delete spell.questSource;
      noSourceData++;
      continue;
    }

    if (drops.length > 0) {
      spell.dropSources = drops;
    } else {
      delete spell.dropSources;
    }

    if (quest) {
      spell.questSource = quest;
    } else {
      delete spell.questSource;
    }

    spell.enrichmentStatus = "ok";
    enriched++;
  }

  // Write back (full array, not just subset — untouched spells stay as-is)
  if (!dryRun) {
    await writeFile(inputPath, `${JSON.stringify(spells, null, 2)}\n`);
    console.log(`\nWrote enriched data to ${inputPath}`);
  } else {
    console.log("\n[dry run] Skipped writing to disk.");
  }

  const stats = {
    enriched,
    no_source_data: noSourceData,
    fetch_error: fetchError,
    total: subset.length,
  };
  console.log("\nStats:", JSON.stringify(stats, null, 2));

  if (ambiguous.length > 0) {
    console.log("\nAmbiguous parses (selector review recommended):");
    for (const entry of ambiguous) {
      console.log(`  [${entry.spellId}] ${entry.name}: ${entry.issue}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
