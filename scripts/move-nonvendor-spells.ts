import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SpellRecord = {
  name: string;
  level: number;
  class: string;
  expansion: string;
  description: string;
  sourceUrl: string;
  vendorStatus?: string;
  sourceType?: string;
};

const spellsPath = path.join(process.cwd(), "data", "spells.json");
const droppedPath = path.join(process.cwd(), "data", "dropped-spells.json");
const spellCacheDir = path.join(process.cwd(), "cache", "spell-pages");

const previouslyRemovedNames = new Set([
  "Ancient Lcea's Lament",
  "Ancient Gift of Aegolism",
  "Ancient High Priest's Bulwark",
  "Ancient Legacy of Blades",
  "Ancient Starfire of Ro",
  "Ancient Chaotic Visions",
  "Ancient Eternal Rapture",
  "Ancient Lifebane",
  "Ancient Master of Death",
  "Ancient Feral Avatar",
  "Ancient Scourge of Nife",
  "Ancient Destruction of Ice",
  "Ancient Greater Concussion",
]);

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

function text(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim());
}

function spellKey(spell: Pick<SpellRecord, "name" | "class" | "expansion" | "level">) {
  return `${spell.name}\u0000${spell.class}\u0000${spell.expansion}\u0000${spell.level}`;
}

function parseCachedSpellPage(html: string, className: string): SpellRecord | null {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const name = titleMatch ? text(titleMatch[1]).replace(/\s+-\s+Project 1999 Wiki$/i, "") : "";
  if (!name || !previouslyRemovedNames.has(name)) return null;

  const levelMatch = html.match(/<strong>\s*Class\s*<\/strong>[\s\S]*?<strong>\s*Level\s*<\/strong>[\s\S]*?<strong>\s*([A-Z]{3})\s*<\/strong>[\s\S]*?<td[^>]*>\s*(\d+)\s*<\/td>/i);
  if (!levelMatch || levelMatch[1] !== className) return null;

  const expansionAlt = html.match(/Quick Facts[\s\S]*?<strong>\s*Expansion:\s*<\/strong>[\s\S]*?<img[^>]*alt=["']([^"']+)["']/i)?.[1] ?? "";
  const expansion = /Kunark/i.test(expansionAlt)
    ? "Kunark"
    : /Velious/i.test(expansionAlt)
      ? "Velious"
      : "Classic";
  const spellId = html.match(/catid["']?\s+value=["']spell:(\d+)/i)?.[1] ?? html.match(/\/db\/spell\.html\?spell=(\d+)/i)?.[1];
  const descriptionMatch = html.match(/<td[^>]*>\s*<small>([\s\S]*?)<\/small>\s*<\/td>/i);

  return {
    name,
    level: Number(levelMatch[2]),
    class: className,
    expansion,
    description: descriptionMatch ? text(descriptionMatch[1]) : "",
    sourceUrl: spellId ? `https://everquest.allakhazam.com/db/spell.html?spell=${spellId}` : "",
    sourceType: name.startsWith("Ancient ") ? "dropped" : "dropped_or_quested",
  };
}

async function findPreviouslyRemovedSpells() {
  if (!existsSync(spellCacheDir)) return [];
  const records: SpellRecord[] = [];
  const files = await readdir(spellCacheDir);

  for (const file of files) {
    if (!file.endsWith(".html")) continue;
    const className = file.split("-")[0]?.toUpperCase();
    if (!className) continue;
    const html = await readFile(path.join(spellCacheDir, file), "utf8");
    const record = parseCachedSpellPage(html, className);
    if (record) records.push(record);
  }

  return records;
}

const spells = JSON.parse(await readFile(spellsPath, "utf8")) as SpellRecord[];
const existingDropped = existsSync(droppedPath) ? JSON.parse(await readFile(droppedPath, "utf8")) as SpellRecord[] : [];
const toMove = spells
  .filter((spell) => spell.vendorStatus === "no_vendor_data_found_after_filter")
  .map((spell) => {
    const { vendorStatus: _vendorStatus, ...rest } = spell;
    return {
      ...rest,
      sourceType: spell.name.startsWith("Ancient ") ? "dropped" : "dropped_or_quested",
    };
  });
const recovered = await findPreviouslyRemovedSpells();
const droppedByKey = new Map(existingDropped.map((spell) => [spellKey(spell), spell]));

for (const spell of [...toMove, ...recovered]) {
  const key = spellKey(spell);
  droppedByKey.set(key, { ...droppedByKey.get(key), ...spell });
}

const remainingSpells = spells
  .filter((spell) => spell.vendorStatus !== "no_vendor_data_found_after_filter")
  .sort((a, b) => a.expansion.localeCompare(b.expansion) || a.class.localeCompare(b.class) || a.level - b.level || a.name.localeCompare(b.name));
const droppedSpells = Array.from(droppedByKey.values())
  .sort((a, b) => a.expansion.localeCompare(b.expansion) || a.class.localeCompare(b.class) || a.level - b.level || a.name.localeCompare(b.name));

await writeFile(spellsPath, `${JSON.stringify(remainingSpells, null, 2)}\n`);
await writeFile(droppedPath, `${JSON.stringify(droppedSpells, null, 2)}\n`);

console.log(JSON.stringify({
  movedFromVendorSpells: toMove.length,
  recoveredPreviouslyRemoved: recovered.length,
  remainingVendorSpells: remainingSpells.length,
  droppedSpells: droppedSpells.length,
}, null, 2));
