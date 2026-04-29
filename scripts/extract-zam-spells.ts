import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

type SpellRecord = {
  name: string;
  level: number;
  class: string;
  expansion: "Classic" | "Kunark" | "Velious";
  description: string;
  sourceUrl: string;
};

const sourceLists = [
  {
    cacheFile: "bard-classic-spells.html",
    class: "BRD",
    expansion: "Classic",
    url: "https://everquest.allakhazam.com/db/spelllist.html?name=&type=brd&level=1&opt=And+Higher&expansion=original&action=search",
  },
  {
    cacheFile: "bard-kunark-spells.html",
    class: "BRD",
    expansion: "Kunark",
    url: "https://everquest.allakhazam.com/db/spelllist.html?name=&type=brd&level=1&opt=And+Higher&expansion=kunark&action=search",
  },
  {
    cacheFile: "bard-velious-spells.html",
    class: "BRD",
    expansion: "Velious",
    url: "https://everquest.allakhazam.com/db/spelllist.html?name=&type=brd&level=1&opt=And+Higher&expansion=velious&action=search",
  },
] as const;

const cacheDir = path.join(process.cwd(), "cache");
const outputPath = path.join(process.cwd(), "data", "spells.json");
const userAgent = "FrostreaverRandomLoot/1.0 local spell data indexing (review workflow)";

function decodeHtml(value: string) {
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

function htmlToPlainText(value: string) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

async function readOrFetch(source: (typeof sourceLists)[number]) {
  await mkdir(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, source.cacheFile);
  if (existsSync(cachePath)) {
    return readFile(cachePath, "utf8");
  }

  const response = await fetch(source.url, { headers: { "user-agent": userAgent } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  await writeFile(cachePath, html);
  return html;
}

function extractCells(rowHtml: string) {
  const cells: string[] = [];
  const cellPattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellPattern.exec(rowHtml)) !== null) {
    cells.push(match[1]);
  }
  return cells;
}

function parseSpellList(html: string, source: (typeof sourceLists)[number]) {
  const records: SpellRecord[] = [];
  let currentLevel: number | null = null;
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];
    const levelMatch = row.match(/Level:\s*(\d+)/i);
    if (levelMatch) {
      currentLevel = Number(levelMatch[1]);
      continue;
    }

    const cells = extractCells(row);
    if (cells.length < 4 || /class=["']?menuh/i.test(row)) continue;

    const nameCell = cells[1] ?? "";
    const spellLinkMatch = nameCell.match(/href=["']([^"']*\/db\/spell\.html\?spell=\d+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!spellLinkMatch) continue;

    const classLevel = htmlToPlainText(cells[2] ?? "");
    const classLevelMatch = classLevel.match(/^([A-Z]{3})\/(\d+)$/);
    if (!classLevelMatch || classLevelMatch[1] !== source.class) continue;

    const name = htmlToPlainText(spellLinkMatch[2]);
    const level = Number(classLevelMatch[2] || currentLevel);
    const description = htmlToPlainText(cells[3] ?? "");
    const sourceUrl = new URL(spellLinkMatch[1], "https://everquest.allakhazam.com").toString();

    if (!name || !Number.isFinite(level)) continue;

    records.push({
      name,
      level,
      class: source.class,
      expansion: source.expansion,
      description,
      sourceUrl,
    });
  }

  return records;
}

function spellKey(spell: Pick<SpellRecord, "name" | "class" | "expansion" | "level">) {
  return `${spell.name}\u0000${spell.class}\u0000${spell.expansion}\u0000${spell.level}`;
}

async function main() {
  const existing: SpellRecord[] = existsSync(outputPath)
    ? JSON.parse(await readFile(outputPath, "utf8"))
    : [];
  const byKey = new Map(existing.map((spell) => [spellKey(spell), spell]));
  const counts: Record<string, number> = {};

  for (const source of sourceLists) {
    const html = await readOrFetch(source);
    const parsed = parseSpellList(html, source);
    counts[source.expansion] = parsed.length;

    for (const spell of parsed) {
      const key = spellKey(spell);
      const current = byKey.get(key);
      if (!current) {
        byKey.set(key, spell);
        continue;
      }

      byKey.set(key, {
        ...current,
        description: current.description || spell.description,
        sourceUrl: current.sourceUrl || spell.sourceUrl,
      });
    }
  }

  const output = Array.from(byKey.values()).sort((a, b) =>
    a.expansion.localeCompare(b.expansion)
    || a.class.localeCompare(b.class)
    || a.level - b.level
    || a.name.localeCompare(b.name),
  );

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(`Wrote ${output.length} spell records to ${path.relative(process.cwd(), outputPath)}`);
  for (const [expansion, count] of Object.entries(counts)) {
    console.log(`${expansion}: parsed ${count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
