import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type ItemEffectType = "focus" | "bardMod" | "worn" | "click" | "proc" | "unknown";

type ItemEffect = {
  name: string;
  type: ItemEffectType;
  description?: string;
};

type ItemDetails = {
  name: string;
  itemId?: string | null;
  sourceUrl?: string | null;
  slot: string | null;
  ac: number | null;
  damage: number | null;
  delay: number | null;
  skill?: string | number | null;
  damage_bonus?: string | number | null;
  weaponType?: "1H" | "2H" | "shield" | "ranged" | "other" | null;
  isTwoHanded?: boolean | null;
  stats: Record<string, number | string>;
  resists: Record<string, number | string>;
  hp_regen?: number | null;
  mana_regen?: number | null;
  manaRegen?: number | null;
  endurance_regen?: number | null;
  atk?: number | null;
  attack?: number | null;
  haste: string | null;
  charges?: number | string | null;
  worn_effects: string[];
  focus_effects: string[];
  click_effects: string[];
  proc_effects: string[];
  effects?: ItemEffect[];
  required_level: number | null;
  recommended_level: number | null;
  classes: string[];
  races: string[];
  weight: number | null;
  size: string | null;
  item_type?: string | null;
  itemType?: string | null;
  stackable?: boolean | null;
  weight_reduction?: string | null;
  capacity?: number | null;
  size_capacity?: string | null;
  lore: boolean | null;
  magic: boolean | null;
  no_drop: boolean | null;
  prestige: boolean | null;
  quest?: boolean | null;
  placeable?: boolean | null;
  augmentation?: Array<{ slot: number; type: number; description: string }>;
  aug_slots: string[];
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
  sources: Array<{ name: string; url: string }>;
  confidence: string;
  match_confidence?: string;
  match_notes?: string[];
  missing_core_stats?: boolean;
  duplicate_name_risk?: boolean;
  parsing_warnings?: string[];
  expansion: string;
  acquisitionType?: string;
  sourceCategory?: string;
  extraStats?: Record<string, string | number | boolean>;
  rawItemText?: string;
};

type ItemDetailsMap = Record<string, ItemDetails>;

type ImageCandidate = {
  absoluteUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  score: number;
};

const defaultTargetUrls = [
  "https://everquest.allakhazam.com/db/item.html?item=348",
  "https://everquest.allakhazam.com/db/item.html?item=152",
  "https://everquest.allakhazam.com/db/item.html?item=3571",
  "https://everquest.allakhazam.com/db/item.html?item=136",
  "https://everquest.allakhazam.com/db/item.html?item=3750",
  "https://everquest.allakhazam.com/db/item.html?item=2699",
  "https://everquest.allakhazam.com/db/item.html?item=2414",
  "https://everquest.allakhazam.com/db/item.html?item=3572",
  "https://everquest.allakhazam.com/db/item.html?item=3637",
  "https://everquest.allakhazam.com/db/item.html?item=3638",
  "https://everquest.allakhazam.com/db/item.html?item=4066",
  "https://everquest.allakhazam.com/db/item.html?item=3693",
  "https://everquest.allakhazam.com/db/item.html?item=748",
  "https://everquest.allakhazam.com/db/item.html?item=2631",
  "https://everquest.allakhazam.com/db/item.html?item=2630",
  "https://everquest.allakhazam.com/db/item.html?item=2629",
  "https://everquest.allakhazam.com/db/item.html?item=3719",
];

const targetUrls = (process.env.TARGET_URLS ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

if (targetUrls.length === 0) {
  targetUrls.push(...defaultTargetUrls);
}

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "targeted-zam-item-import-report.json");
const cacheDir = path.join(root, "cache", "targeted-zam-items");
const userAgent = "LootGoblinTargetedItemImport/0.1 (+local data maintenance)";
const requestDelayMs = Number(process.env.ZAM_REQUEST_DELAY_MS ?? 400);

const primaryStatKeys = new Set(["str", "sta", "agi", "dex", "wis", "int", "cha"]);
const otherStatMap = new Map([
  ["hp", "HP"],
  ["mana", "MANA"],
  ["end", "END"],
  ["endur", "END"],
  ["endurance", "END"],
]);
const resistMap = new Map([
  ["mr", "MR"],
  ["fr", "FR"],
  ["cr", "CR"],
  ["dr", "DR"],
  ["pr", "PR"],
  ["sv magic", "MR"],
  ["sv fire", "FR"],
  ["sv cold", "CR"],
  ["sv disease", "DR"],
  ["sv poison", "PR"],
]);
const classTokenAliases = new Map([
  ["BERSERKER", "BER"],
  ["BEASTLORD", "BST"],
  ["MAGICIAN", "MAG"],
  ["NECROMANCER", "NEC"],
  ["ENCHANTER", "ENC"],
  ["WARRIOR", "WAR"],
  ["CLERIC", "CLR"],
  ["PALADIN", "PAL"],
  ["RANGER", "RNG"],
  ["SHADOWKNIGHT", "SHD"],
  ["SHADOW", "SHD"],
  ["DRUID", "DRU"],
  ["MONK", "MNK"],
  ["BARD", "BRD"],
  ["ROGUE", "ROG"],
  ["SHAMAN", "SHM"],
  ["WIZARD", "WIZ"],
]);

await main();

async function main() {
  await mkdir(cacheDir, { recursive: true });
  const details = JSON.parse(await readFile(detailsPath, "utf8")) as ItemDetailsMap;
  const report = {
    requested: targetUrls.length,
    imported: [] as Array<{ itemId: string; name: string; action: "created" | "updated"; icon: boolean; extraStats: number }>,
    failed: [] as Array<{ url: string; reason: string }>,
  };

  for (const [index, url] of targetUrls.entries()) {
    console.log(`[${index + 1}/${targetUrls.length}] ${url}`);
    try {
      const html = await fetchCached(url);
      const parsed = parseItemPage(html, url);
      const icon = findImageCandidates(html, url, parsed.name)[0];
      if (icon && icon.score >= 60) parsed.icon = icon.absoluteUrl;

      const existingKey = findExistingItemKey(details, parsed);
      if (existingKey) {
        const previousKey = existingKey;
        const nextKey = previousKey === parsed.name ? previousKey : parsed.name;
        mergeItem(details[previousKey], parsed);
        if (nextKey !== previousKey && !details[nextKey]) {
          details[nextKey] = details[previousKey];
          delete details[previousKey];
        }
        report.imported.push({
          itemId: parsed.itemId ?? "",
          name: parsed.name,
          action: "updated",
          icon: Boolean(details[nextKey]?.icon ?? details[nextKey]?.iconPath ?? details[nextKey]?.icon_url),
          extraStats: Object.keys(details[nextKey]?.extraStats ?? {}).length,
        });
      } else {
        details[parsed.name] = parsed;
        report.imported.push({
          itemId: parsed.itemId ?? "",
          name: parsed.name,
          action: "created",
          icon: Boolean(parsed.icon ?? parsed.iconPath ?? parsed.icon_url),
          extraStats: Object.keys(parsed.extraStats ?? {}).length,
        });
      }
    } catch (error) {
      report.failed.push({
        url,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeFile(detailsPath, `${JSON.stringify(sortItemMap(details), null, 2)}\n`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Imported/updated: ${report.imported.length}`);
  console.log(`Failed: ${report.failed.length}`);
  for (const failure of report.failed) {
    console.log(`  Failed ${failure.url}: ${failure.reason}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

async function fetchCached(url: string) {
  const filePath = path.join(cacheDir, `${slug(url)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");

  await sleep(requestDelayMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

function htmlDecode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
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

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeComparableItemName(value: string) {
  return normalizeName(value.replace(/\s*\[[^\]]+\]\s*$/g, "").replace(/['`’]/g, ""));
}

function canonicalItemUrl(url: string) {
  return url.match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? url;
}

function extractItemId(url: string) {
  return url.match(/[?&]item=(\d+)/i)?.[1] ?? null;
}

function parseItemPage(html: string, url: string): ItemDetails {
  const pageText = stripTags(html);
  const itemBlockHtml = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlockHtml);
  const titleName = readItemTitle(html, pageText) ?? `Item ${extractItemId(url) ?? ""}`.trim();
  const parsedName = titleName.replace(/^Item\s*:\s*/i, "").trim();
  const { stats, resists } = parseStatBlock(text);
  const worn_effects = readEffects("Worn", text);
  const focus_effects = readEffects("Focus", text);
  const click_effects = readEffects("Effect", text).filter((effect) => /click|casting time|must equip|can equip/i.test(effect));
  const proc_effects = Array.from(new Set(readEffects("Combat Effects", text).concat(readEffects("Proc", text))));
  const augmentation = parseAugmentation(text);
  const aug_slots = augmentation.map((aug) => `Slot ${aug.slot}, Type ${aug.type}${aug.description ? ` (${aug.description})` : ""}`);

  const baseItem: ItemDetails = {
    name: parsedName,
    itemId: extractItemId(url),
    sourceUrl: canonicalItemUrl(url),
    slot: readString(/\bSlot:\s*([^\n]+)/i, text),
    ac: readNumber(/\bAC:\s*([+-]?\d+)/i, text),
    damage: readNumber(/\b(?:DMG|Damage):\s*([+-]?\d+)/i, text),
    delay: readNumber(/\bDelay:\s*([+-]?\d+)/i, text),
    skill: readString(/\bSkill:\s*([^\n]*?)(?:\s+Atk Delay:|$)/i, text),
    damage_bonus: readNumber(/\b(?:Dmg Bon|Damage Bonus):\s*([+-]?\d+)/i, text),
    stats,
    resists,
    hp_regen: readRegen("HP", text),
    mana_regen: readRegen("Mana", text),
    manaRegen: readRegen("Mana", text),
    endurance_regen: readRegen("Endurance", text),
    attack: readNumber(/\bAttack:\s*([+-]?\d+)/i, text),
    atk: readNumber(/\bAttack:\s*([+-]?\d+)/i, text),
    haste: readString(/\bHaste:\s*([+-]?\d+%)/i, text) ?? readString(/\b([+-]?\d+%)\s*Haste\b/i, text),
    charges: readCharges(text),
    worn_effects,
    focus_effects,
    click_effects,
    proc_effects,
    effects: buildEffects({ worn_effects, focus_effects, click_effects, proc_effects }),
    required_level: readNumber(/\bRequired level(?: of)?:\s*(\d+)/i, text),
    recommended_level: readNumber(/\bRecommended level(?: of)?:\s*(\d+)/i, text),
    classes: normalizeClassList(readList(/\bClass(?:es)?:\s*([^\n]+)/i, text)),
    races: readList(/\bRace(?:s)?:\s*([^\n]+)/i, text),
    weight: readNumber(/\bWT:\s*(\d+(?:\.\d+)?)/i, text),
    size: readString(/\bSize:\s*([^\n]+)/i, text),
    item_type: readTableValue("Item Type", html) ?? readString(/\bItem Type:\s*([^\n]+)/i, text),
    itemType: null,
    stackable: readBooleanTableValue("Stackable", html),
    weight_reduction: readString(/\bWeight Reduction:\s*([+-]?\d+%)/i, text),
    capacity: readNumber(/\bCapacity:\s*(\d+)/i, text),
    size_capacity: readString(/\bSize Capacity:\s*([^\n]+)/i, text),
    lore: /\bLORE(?:\s+ITEM)?\b/i.test(text) ? true : null,
    magic: /\bMAGIC(?:\s+ITEM)?\b/i.test(text) ? true : null,
    no_drop: /\b(?:NO\s+DROP|NO\s+TRADE|No Trade)\b/i.test(text) ? true : null,
    prestige: /\bPRESTIGE\b/i.test(text) ? true : null,
    quest: /\bQUEST(?:\s+ITEM)?\b/i.test(text) ? true : null,
    placeable: /\bPLACEABLE\b/i.test(text) ? true : null,
    augmentation: augmentation.length ? augmentation : undefined,
    aug_slots,
    iconPath: null,
    sources: [{ name: "Allakhazam", url: canonicalItemUrl(url) }],
    confidence: "exact_match",
    match_confidence: "exact_match",
    match_notes: [`Targeted exact Allakhazam import from ${canonicalItemUrl(url)}.`],
    missing_core_stats: false,
    duplicate_name_risk: false,
    parsing_warnings: itemBlockHtml === html ? ["Could not isolate the ZAM item stat block; parsed the full page."] : [],
    expansion: normalizeExpansion(extractExpansion(html)),
    acquisitionType: "imported",
    sourceCategory: "Targeted Allakhazam item import",
    rawItemText: text,
    extraStats: parseExtraStats(text),
  };

  const weaponType = inferWeaponType(baseItem);
  return {
    ...baseItem,
    itemType: weaponType === "shield" ? "shield" : baseItem.itemType,
    weaponType,
    isTwoHanded: weaponType === "2H" ? true : null,
  };
}

function readNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function readString(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function readCharges(text: string) {
  const value = readString(/\bCharges:\s*([^\n]+)/i, text);
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function readList(pattern: RegExp, text: string) {
  const value = readString(pattern, text);
  if (!value) return [];
  return value
    .split(/[,/ ]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeClassList(values: string[]) {
  return values
    .map((value) => classTokenAliases.get(value.toUpperCase()) ?? value.toUpperCase())
    .filter(Boolean);
}

function parseStatBlock(text: string) {
  const stats: Record<string, number | string> = {};
  const resists: Record<string, number | string> = {};
  const statPattern = /\b(STR|STA|AGI|DEX|WIS|INT|CHA|HP|MANA|END|ENDUR|ENDURANCE|MR|FR|CR|DR|PR|SV FIRE|SV COLD|SV MAGIC|SV POISON|SV DISEASE)\s*:?\s*([+-]?\d+%?)\b/gi;

  for (const match of text.matchAll(statPattern)) {
    const rawKey = match[1].toLowerCase();
    const value = match[2].includes("%") ? match[2] : Number(match[2]);
    if (primaryStatKeys.has(rawKey)) {
      stats[rawKey.toUpperCase()] = value;
      continue;
    }
    const otherKey = otherStatMap.get(rawKey);
    if (otherKey) {
      stats[otherKey] = value;
      continue;
    }
    const resistKey = resistMap.get(rawKey);
    if (resistKey) resists[resistKey] = value;
  }

  return { stats, resists };
}

function readRegen(label: string, text: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return readNumber(new RegExp(`\\b${escaped}\\s+Regeneration:\\s*([+-]?\\d+)`, "i"), text)
    ?? readNumber(new RegExp(`\\b${escaped}\\s+Regen:\\s*([+-]?\\d+)`, "i"), text);
}

function readEffects(label: string, text: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}:\\s*([^\\n]+)`, "gi");
  return Array.from(new Set(Array.from(text.matchAll(pattern)).map((match) => match[1].replace(/\s+/g, " ").trim()).filter(Boolean)));
}

function buildEffects(effects: { worn_effects: string[]; focus_effects: string[]; click_effects: string[]; proc_effects: string[] }) {
  const structured: ItemEffect[] = [];
  for (const name of effects.focus_effects) structured.push({ name, type: classifyFocusEffect(name) });
  for (const name of effects.worn_effects) structured.push({ name, type: "worn" });
  for (const name of effects.click_effects) structured.push({ name, type: "click" });
  for (const name of effects.proc_effects) structured.push({ name, type: "proc" });
  return structured;
}

function classifyFocusEffect(name: string): ItemEffectType {
  return /^(Brass|Percussion|Singing|String|Stringed|Wind)\s+Resonance\b/i.test(name) ? "bardMod" : "focus";
}

function parseAugmentation(text: string) {
  const augmentation: Array<{ slot: number; type: number; description: string }> = [];
  const pattern = /Slot\s+(\d+),\s*Type\s+(\d+)(?:\s*\(([^)]*)\))?/gi;
  for (const match of text.matchAll(pattern)) {
    augmentation.push({
      slot: Number(match[1]),
      type: Number(match[2]),
      description: match[3]?.replace(/\s+/g, " ").trim() ?? "",
    });
  }
  return augmentation;
}

function parseExtraStats(text: string) {
  const knownLabels = new Set([
    "slot", "ac", "dmg", "damage", "delay", "skill", "dmg bon", "damage bonus",
    "str", "sta", "agi", "dex", "wis", "int", "cha", "hp", "mana", "end", "endur", "endurance",
    "mr", "fr", "cr", "dr", "pr", "sv fire", "sv cold", "sv magic", "sv poison", "sv disease",
    "class", "classes", "race", "races", "wt", "size", "haste", "effect", "worn", "focus",
    "proc", "combat effects", "required level", "recommended level", "item type", "stackable",
    "charges", "attack", "hp regeneration", "mana regeneration", "endurance regeneration",
    "weight reduction", "capacity", "size capacity",
  ]);
  const extra: Record<string, string | number | boolean> = {};
  for (const line of text.split("\n").map((entry) => entry.replace(/\s+/g, " ").trim()).filter(Boolean)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 /+.'-]{1,45}):\s*(.+)$/);
    if (!match) continue;
    const rawLabel = match[1].replace(/\s+/g, " ").trim();
    const labelKey = rawLabel.toLowerCase();
    if (knownLabels.has(labelKey)) continue;
    const key = normalizeExtraStatKey(rawLabel);
    if (!key || key in extra) continue;
    extra[key] = coerceExtraValue(match[2].trim());
  }
  return extra;
}

function normalizeExtraStatKey(label: string) {
  const cleaned = label
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return "";
  return cleaned.replace(/\s+([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function coerceExtraValue(value: string): string | number | boolean {
  if (/^(yes|true)$/i.test(value)) return true;
  if (/^(no|false)$/i.test(value)) return false;
  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value.replace(/\s+/g, " ").trim();
}

function readTableValue(label: string, html: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<td[^>]*>\\s*${escaped}\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const value = html.match(pattern)?.[1];
  return value ? stripTags(value).replace(/\s+/g, " ").trim() : null;
}

function readBooleanTableValue(label: string, html: string) {
  const value = readTableValue(label, html);
  return value ? /^yes$/i.test(value) : null;
}

function readItemTitle(html: string, pageText: string) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (title) {
    return htmlDecode(title)
      .replace(/\s*::\s*Items\s*::.*$/i, "")
      .trim();
  }
  const ogTitle = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i)?.[1];
  if (ogTitle) return htmlDecode(ogTitle).replace(/\s*::.*$/g, "").trim();
  return pageText.match(/\bItem\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
}

function extractExpansion(html: string) {
  const expansionHtml = html.match(/<strong>\s*Expansion:\s*<\/strong>([\s\S]*?)<br/i)?.[1];
  if (!expansionHtml) return null;
  const alt = expansionHtml.match(/alt=["']([^"']+)["']/i)?.[1];
  return (alt ?? stripTags(expansionHtml)).replace(/\s+/g, " ").trim() || null;
}

function normalizeExpansion(expansion: string | null) {
  if (!expansion) return "Unknown";
  if (/original/i.test(expansion)) return "Classic";
  if (/kunark/i.test(expansion)) return "Kunark";
  if (/velious/i.test(expansion)) return "Velious";
  return expansion;
}

function inferWeaponType(item: Pick<ItemDetails, "name" | "slot" | "skill" | "item_type" | "itemType">): ItemDetails["weaponType"] {
  if (/\bbuckler\b/i.test(item.name ?? "")) return "shield";
  const slot = String(item.slot ?? "").toUpperCase();
  const combined = `${item.skill ?? ""} ${item.item_type ?? ""} ${item.itemType ?? ""}`.replace(/\s+/g, " ");
  if (/\bshield\b/i.test(combined)) return "shield";
  if (/\brange\b/i.test(slot) || /\bthrowing|archery\b/i.test(combined)) return "ranged";
  if (!/\bPRIMARY\b/i.test(slot)) return null;
  if (/\b(2H|2HS|2HB|2HP|two[-\s]?hand|two handed|2 hand|2-h)\b/i.test(combined)) return "2H";
  if (/\b(1H|1HS|1HB|piercing|hand to hand|h2h)\b/i.test(combined)) return "1H";
  return "other";
}

function findImageCandidates(html: string, baseUrl: string, itemName: string): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  for (const match of html.matchAll(/<img\b([^>]+)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const src = attrs.src;
    if (!src) continue;
    const absoluteUrl = absolutize(src, baseUrl);
    const alt = attrs.alt ?? "";
    const width = attrs.width ? Number(attrs.width) : null;
    const height = attrs.height ? Number(attrs.height) : null;
    let score = 0;
    if (/\/pgfx\/item_\d+\.(png|gif)$/i.test(absoluteUrl)) score += 75;
    if (width && height && width <= 80 && height <= 80) score += 20;
    if (alt && normalizeComparableItemName(alt) === normalizeComparableItemName(itemName)) score += 25;
    if (/ad|logo|banner|avatar/i.test(absoluteUrl)) score -= 50;
    candidates.push({ absoluteUrl, alt, width, height, score });
  }
  return candidates.sort((a, b) => b.score - a.score || a.absoluteUrl.localeCompare(b.absoluteUrl));
}

function parseAttributes(source: string) {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attrs[match[1].toLowerCase()] = htmlDecode(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function absolutize(url: string, baseUrl: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return new URL(url, baseUrl).toString();
}

function findExistingItemKey(details: ItemDetailsMap, parsed: ItemDetails) {
  const targetItemId = parsed.itemId;
  const targetUrl = parsed.sourceUrl ? canonicalItemUrl(parsed.sourceUrl) : null;
  for (const [key, item] of Object.entries(details)) {
    if (targetItemId && item.itemId === targetItemId) return key;
    if (targetUrl && item.sourceUrl && canonicalItemUrl(item.sourceUrl) === targetUrl) return key;
    if (targetUrl && item.sources?.some((source) => canonicalItemUrl(source.url) === targetUrl)) return key;
  }
  const comparable = normalizeComparableItemName(parsed.name);
  return Object.keys(details).find((key) => normalizeComparableItemName(details[key].name ?? key) === comparable) ?? null;
}

function mergeItem(existing: ItemDetails, imported: ItemDetails) {
  existing.name = imported.name || existing.name;
  setField(existing, "itemId", imported.itemId);
  setField(existing, "sourceUrl", imported.sourceUrl);
  setField(existing, "slot", imported.slot);
  setField(existing, "ac", imported.ac);
  setField(existing, "damage", imported.damage);
  setField(existing, "delay", imported.delay);
  setField(existing, "skill", imported.skill);
  setField(existing, "damage_bonus", imported.damage_bonus);
  existing.stats = { ...(existing.stats ?? {}), ...imported.stats };
  existing.resists = { ...(existing.resists ?? {}), ...imported.resists };
  setField(existing, "hp_regen", imported.hp_regen);
  setField(existing, "mana_regen", imported.mana_regen);
  setField(existing, "manaRegen", imported.manaRegen);
  setField(existing, "endurance_regen", imported.endurance_regen);
  setField(existing, "attack", imported.attack);
  setField(existing, "atk", imported.atk ?? imported.attack);
  setField(existing, "haste", imported.haste);
  setField(existing, "charges", imported.charges);
  setArray(existing, "worn_effects", imported.worn_effects);
  setArray(existing, "focus_effects", imported.focus_effects);
  setArray(existing, "click_effects", imported.click_effects);
  setArray(existing, "proc_effects", imported.proc_effects);
  setArray(existing, "effects", imported.effects ?? []);
  setField(existing, "required_level", imported.required_level);
  setField(existing, "recommended_level", imported.recommended_level);
  setArray(existing, "classes", imported.classes);
  setArray(existing, "races", imported.races);
  setField(existing, "weight", imported.weight);
  setField(existing, "size", imported.size);
  setField(existing, "item_type", imported.item_type);
  setField(existing, "itemType", imported.itemType);
  setField(existing, "weaponType", imported.weaponType);
  setField(existing, "isTwoHanded", imported.isTwoHanded);
  setField(existing, "stackable", imported.stackable);
  setField(existing, "weight_reduction", imported.weight_reduction);
  setField(existing, "capacity", imported.capacity);
  setField(existing, "size_capacity", imported.size_capacity);
  setField(existing, "lore", imported.lore);
  setField(existing, "magic", imported.magic);
  setField(existing, "no_drop", imported.no_drop);
  setField(existing, "prestige", imported.prestige);
  setField(existing, "quest", imported.quest);
  setField(existing, "placeable", imported.placeable);
  setArray(existing, "aug_slots", imported.aug_slots);
  setArray(existing, "augmentation", imported.augmentation ?? []);
  existing.expansion = imported.expansion !== "Unknown" ? imported.expansion : existing.expansion || imported.expansion;
  existing.acquisitionType = existing.acquisitionType || imported.acquisitionType;
  existing.sourceCategory = existing.sourceCategory || imported.sourceCategory;
  existing.confidence = "exact_match";
  existing.match_confidence = "exact_match";
  existing.missing_core_stats = false;
  existing.duplicate_name_risk = false;
  existing.rawItemText = imported.rawItemText;
  existing.extraStats = { ...(existing.extraStats ?? {}), ...(imported.extraStats ?? {}) };
  existing.match_notes = Array.from(new Set([...(existing.match_notes ?? []), ...(imported.match_notes ?? [])]));
  existing.parsing_warnings = Array.from(new Set([...(existing.parsing_warnings ?? []), ...(imported.parsing_warnings ?? [])]));
  if (!existing.iconPath && !existing.icon && !existing.icon_url && imported.icon) existing.icon = imported.icon;
  addSource(existing, imported.sources[0]);
}

function setField<K extends keyof ItemDetails>(target: ItemDetails, key: K, value: ItemDetails[K] | undefined) {
  if (value === undefined || value === null || value === "") return;
  target[key] = value;
}

function setArray<K extends keyof ItemDetails>(target: ItemDetails, key: K, value: unknown[]) {
  if (!value.length) return;
  target[key] = value as ItemDetails[K];
}

function addSource(item: ItemDetails, source: ItemDetails["sources"][number] | undefined) {
  if (!source) return;
  item.sources = Array.isArray(item.sources) ? item.sources : [];
  if (!item.sources.some((existing) => existing.name === source.name && canonicalItemUrl(existing.url) === canonicalItemUrl(source.url))) {
    item.sources.unshift(source);
  }
}

function sortItemMap(details: ItemDetailsMap) {
  return Object.fromEntries(Object.entries(details).sort(([a], [b]) => a.localeCompare(b)));
}
