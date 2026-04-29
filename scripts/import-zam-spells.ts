import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SpellExpansion = "Classic" | "Kunark" | "Velious";
type VendorStatus = "requires_manual_entry" | "no_vendor_data_found";

type SpellVendor = {
  zone: string;
  npc: string;
  price: string;
  sourceUrl: string;
};

type SpellRecord = {
  name: string;
  level: number;
  class: string;
  expansion: SpellExpansion;
  description: string;
  sourceUrl: string;
  vendors?: SpellVendor[];
  vendorStatus?: VendorStatus;
};

type SourceList = {
  class: string;
  expansion: SpellExpansion;
  cacheFile: string;
  url: string;
};

const classArg = getArg("class")?.toUpperCase() ?? "CLR";
const classType = classArg.toLowerCase();
const cacheDir = path.join(process.cwd(), "cache", "spell-pages");
const listCacheDir = path.join(process.cwd(), "cache");
const outputPath = path.join(process.cwd(), "data", "spells.json");
const userAgent = "FrostreaverRandomLoot/1.0 local spell vendor data indexing";
const excludedVendorZones = new Set([
  "Plane of Knowledge",
  "Abysmal Sea",
  "Crescent Reach",
  "Shar Vahl",
  "Shadow Haven",
  "The Mines of Gloomingdeep",
  "Katta Castellum",
]);

const sourceLists: SourceList[] = [
  {
    class: classArg,
    expansion: "Classic",
    cacheFile: `${classType}-classic-spells.html`,
    url: `https://everquest.allakhazam.com/db/spelllist.html?name=&type=${classType}&level=1&opt=And+Higher&expansion=original&action=search`,
  },
  {
    class: classArg,
    expansion: "Kunark",
    cacheFile: `${classType}-kunark-spells.html`,
    url: `https://everquest.allakhazam.com/db/spelllist.html?name=&type=${classType}&level=1&opt=And+Higher&expansion=kunark&action=search`,
  },
  {
    class: classArg,
    expansion: "Velious",
    cacheFile: `${classType}-velious-spells.html`,
    url: `https://everquest.allakhazam.com/db/spelllist.html?name=&type=${classType}&level=1&opt=And+Higher&expansion=velious&action=search`,
  },
];

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

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

function inlineText(value: string) {
  return htmlToPlainText(value).replace(/\s+/g, " ").trim();
}

function spellKey(spell: Pick<SpellRecord, "name" | "class" | "expansion" | "level">) {
  return `${spell.name}\u0000${spell.class}\u0000${spell.expansion}\u0000${spell.level}`;
}

function vendorKey(vendor: SpellVendor) {
  return `${vendor.zone}\u0000${vendor.npc}\u0000${vendor.price}\u0000${vendor.sourceUrl}`;
}

async function readOrFetch(url: string, cachePath: string) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  if (existsSync(cachePath)) {
    return readFile(cachePath, "utf8");
  }

  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
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

function parseSpellList(html: string, source: SourceList) {
  const records: SpellRecord[] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];
    const cells = extractCells(row);
    if (cells.length < 4 || /class=["']?menuh/i.test(row)) continue;

    const nameCell = cells[1] ?? "";
    const spellLinkMatch = nameCell.match(/href=["']([^"']*\/db\/spell\.html\?spell=\d+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!spellLinkMatch) continue;

    const classLevel = inlineText(cells[2] ?? "");
    const classLevelMatch = classLevel.match(/^([A-Z]{3})\/(\d+)$/);
    if (!classLevelMatch || classLevelMatch[1] !== source.class) continue;

    const name = htmlToPlainText(spellLinkMatch[2]);
    const level = Number(classLevelMatch[2]);
    const description = htmlToPlainText(cells[3] ?? "");
    const sourceUrl = new URL(spellLinkMatch[1], "https://everquest.allakhazam.com").toString();

    if (!name || !Number.isFinite(level)) continue;
    records.push({ name, level, class: source.class, expansion: source.expansion, description, sourceUrl });
  }

  return records;
}

function extractSoldByBlocks(html: string) {
  const starts = Array.from(html.matchAll(/<div\s+id=["'][^"']*Sold_By_t["'][^>]*>/gi)).map((match) => match.index ?? -1).filter((index) => index >= 0);
  const blocks: string[] = [];

  for (const start of starts) {
    const nextTabMatch = html.slice(start + 1).match(/<div\s+id=["'][^"']+_t["'][^>]*>/i);
    const end = nextTabMatch?.index === undefined ? html.length : start + 1 + nextTabMatch.index;
    blocks.push(html.slice(start, end));
  }

  return blocks;
}

function normalizeZone(zone: string) {
  const clean = inlineText(zone);
  if (clean === "The Plane of Knowledge") return "Plane of Knowledge";
  return clean;
}

function parseVendors(html: string, spellUrl: string) {
  const vendors: SpellVendor[] = [];
  const sourceUrl = `${spellUrl.split("#")[0]}#Sold_By`;

  for (const block of extractSoldByBlocks(html)) {
    const zonePattern = /<strong>\s*<a\b[^>]*>([\s\S]*?)<\/a>\s*<\/strong>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/gi;
    let zoneMatch: RegExpExecArray | null;
    while ((zoneMatch = zonePattern.exec(block)) !== null) {
      const zone = normalizeZone(zoneMatch[1]);
      if (excludedVendorZones.has(zone)) continue;
      const list = zoneMatch[2];
      const vendorPattern = /<li>\s*<a\b[^>]*>([\s\S]*?)<\/a>\s*(?:-\s*<i>([\s\S]*?)<\/i>)?/gi;
      let vendorMatch: RegExpExecArray | null;
      while ((vendorMatch = vendorPattern.exec(list)) !== null) {
        const npc = inlineText(vendorMatch[1]);
        if (!zone || !npc) continue;
        vendors.push({ zone, npc, price: inlineText(vendorMatch[2] ?? ""), sourceUrl });
      }
    }
  }

  return Array.from(new Map(vendors.map((vendor) => [vendorKey(vendor), vendor])).values())
    .sort((a, b) => a.zone.localeCompare(b.zone) || a.npc.localeCompare(b.npc) || a.price.localeCompare(b.price));
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const existing: SpellRecord[] = existsSync(outputPath) ? JSON.parse(await readFile(outputPath, "utf8")) : [];
  const byKey = new Map(existing.map((spell) => [spellKey(spell), spell]));
  const listCounts: Record<string, number> = {};

  for (const source of sourceLists) {
    const listHtml = await readOrFetch(source.url, path.join(listCacheDir, source.cacheFile));
    const parsed = parseSpellList(listHtml, source);
    listCounts[source.expansion] = parsed.length;
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

  let fetched = 0;
  let spellsWithVendors = 0;
  let vendorEntriesAdded = 0;
  const failures: { name: string; sourceUrl: string; error: string }[] = [];
  const classSpells = Array.from(byKey.values()).filter((spell) => spell.class === classArg);

  for (const spell of classSpells) {
    try {
      const spellId = spell.sourceUrl.match(/spell=(\d+)/)?.[1] ?? encodeURIComponent(spell.name);
      const html = await readOrFetch(spell.sourceUrl, path.join(cacheDir, `${classType}-${spellId}.html`));
      fetched += 1;
      const parsedVendors = parseVendors(html, spell.sourceUrl);
      if (parsedVendors.length === 0) {
        if (!spell.vendors?.length) spell.vendorStatus = "no_vendor_data_found";
        await delay(220);
        continue;
      }

      const existingVendors = Array.isArray(spell.vendors) ? spell.vendors : [];
      const seen = new Set(existingVendors.map(vendorKey));
      const merged = [...existingVendors];
      for (const vendor of parsedVendors) {
        const key = vendorKey(vendor);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(vendor);
        vendorEntriesAdded += 1;
      }
      spell.vendors = merged.sort((a, b) => a.zone.localeCompare(b.zone) || a.npc.localeCompare(b.npc) || a.price.localeCompare(b.price));
      delete spell.vendorStatus;
      spellsWithVendors += 1;
    } catch (error) {
      spell.vendorStatus = "requires_manual_entry";
      failures.push({ name: spell.name, sourceUrl: spell.sourceUrl, error: error instanceof Error ? error.message : String(error) });
    }
    await delay(220);
  }

  const output = Array.from(byKey.values()).sort((a, b) =>
    a.expansion.localeCompare(b.expansion)
    || a.class.localeCompare(b.class)
    || a.level - b.level
    || a.name.localeCompare(b.name),
  );
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(JSON.stringify({
    class: classArg,
    listCounts,
    fetched,
    totalClassSpells: classSpells.length,
    spellsWithVendors,
    vendorEntriesAdded,
    noVendorData: classSpells.filter((spell) => spell.vendorStatus === "no_vendor_data_found").length,
    requiresManualEntry: classSpells.filter((spell) => spell.vendorStatus === "requires_manual_entry").length,
    failures,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
