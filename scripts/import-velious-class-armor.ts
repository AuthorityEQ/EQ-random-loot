import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type ArmorSet = "Thurgadin" | "Kael" | "Skyshrine";

type Source = {
  name: "Allakhazam";
  url: string;
};

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
  skill?: string | null;
  damage_bonus?: number | null;
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
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
  aug_slots: string[];
  sources: Source[];
  confidence: string;
  match_confidence?: string;
  match_notes?: string[];
  missing_core_stats?: boolean;
  duplicate_name_risk?: boolean;
  parsing_warnings?: string[];
  expansion: string;
  acquisitionType?: string;
  sourceCategory?: string;
  armorSet?: ArmorSet;
  sourceNpcName?: string;
  sourceNpcId?: string;
  sourceItemName?: string;
  sourceItemId?: string;
  questId?: string;
  questName?: string;
  turnInNpcName?: string;
  questSources?: Array<{
    sourceNpcName?: string;
    sourceNpcId?: string;
    sourceItemName: string;
    sourceItemId?: string;
    questId?: string;
    questName?: string;
    turnInNpcName?: string;
  }>;
};

type ItemDetailsMap = Record<string, ItemDetails>;

type ArmorPage = {
  classCode: string;
  className: string;
  armorSet: ArmorSet;
  url: string;
  pageName: string;
};

type ArmorRewardSeed = {
  classCode: string;
  className: string;
  armorSet: ArmorSet;
  rewardItemName: string;
  p99RewardUrl: string;
  questName?: string;
  turnInNpcName?: string;
  sourceItemName?: string;
  sourcePageUrl: string;
};

type QuestRewardMapping = {
  questId?: string;
  sourceItemName?: string;
  sourceItemId?: string;
  sourceNpcName?: string;
  sourceNpcId?: string;
  questName?: string;
  turnInNpcName?: string;
  rewardItemName: string;
  rewardItemId?: string;
  rewardSlot?: string;
  rewardClasses?: string[];
  notes?: string;
};

type ImageCandidate = {
  absoluteUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  score: number;
  reasons: string[];
};

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const generatedMappingPath = path.join(root, "data", "veliousClassArmorQuestMappings.ts");
const reportPath = path.join(root, "data", "velious-class-armor-import-report.json");
const cacheDir = path.join(root, "cache", "velious-class-armor");
const p99VeliousArmorUrl = "https://wiki.project1999.com/Velious_Class_Armor";
const userAgent = "LootGoblinVeliousArmorImport/0.1 (+targeted local data maintenance)";
const requestDelayMs = Number(process.env.ZAM_REQUEST_DELAY_MS ?? 250);
const dryRun = process.argv.includes("--dry-run");
const maxItems = Number(process.env.MAX_ITEMS ?? process.argv.find((arg) => arg.startsWith("--max-items="))?.split("=")[1] ?? 0);

const armorSetColumns: ArmorSet[] = ["Thurgadin", "Kael", "Skyshrine"];
const classNameToCode = new Map([
  ["bard", "BRD"],
  ["beastlord", "BST"],
  ["berserker", "BER"],
  ["cleric", "CLR"],
  ["druid", "DRU"],
  ["enchanter", "ENC"],
  ["magician", "MAG"],
  ["monk", "MNK"],
  ["necromancer", "NEC"],
  ["paladin", "PAL"],
  ["ranger", "RNG"],
  ["rogue", "ROG"],
  ["shadow knight", "SHD"],
  ["shaman", "SHM"],
  ["warrior", "WAR"],
  ["wizard", "WIZ"],
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

await main();

async function main() {
  await mkdir(cacheDir, { recursive: true });

  const details = JSON.parse(await readFile(detailsPath, "utf8")) as ItemDetailsMap;
  const pages = await discoverArmorPages();
  const seeds = dedupeSeeds([
    ...(await Promise.all(pages.map(readArmorPageRewards))).flat(),
    ...manualModernClassSeeds(),
  ]);
  const selectedSeeds = maxItems > 0 ? seeds.slice(0, maxItems) : seeds;
  const existingNameIndex = buildExistingNameIndex(details);
  const report = {
    source: p99VeliousArmorUrl,
    armorPages: pages.length,
    discoveredRewards: seeds.length,
    processedRewards: selectedSeeds.length,
    imported: [] as Array<{ item: string; itemId?: string; armorSet: ArmorSet; classCode: string; sourceUrl?: string; icon?: string | null }>,
    mergedExisting: [] as Array<{ item: string; key: string; itemId?: string; armorSet: ArmorSet; classCode: string }>,
    failed: [] as Array<{ item: string; armorSet: ArmorSet; classCode: string; reason: string }>,
    skippedClasses: [] as Array<{ classCode: string; reason: string }>,
    staleImportedRecordsRemoved: [] as string[],
  };
  const mappings: QuestRewardMapping[] = [];

  report.staleImportedRecordsRemoved = cleanupStaleVeliousArmorImports(details, selectedSeeds);

  for (const [index, seed] of selectedSeeds.entries()) {
    console.log(`[${index + 1}/${selectedSeeds.length}] ${seed.armorSet} ${seed.classCode}: ${seed.rewardItemName}`);

    try {
      const resolved = await resolveAllakhazamItem(seed.rewardItemName);
      if (!resolved) {
        report.failed.push({
          item: seed.rewardItemName,
          armorSet: seed.armorSet,
          classCode: seed.classCode,
          reason: "No exact Allakhazam item page found.",
        });
        continue;
      }

      const parsed = parseAllakhazamItemPage(resolved.html, seed.rewardItemName, resolved.url, seed);
      const icon = findImageCandidates(resolved.html, resolved.url, parsed.name)[0];
      if (icon && icon.score >= 60) {
        parsed.icon = icon.absoluteUrl;
      }

      const existingKey = existingNameIndex.get(normalizeComparableItemName(parsed.name))
        ?? existingNameIndex.get(normalizeComparableItemName(seed.rewardItemName));
      const key = existingKey ?? parsed.name;
      const existing = details[key];
      const mapping = makeQuestMapping(seed, parsed);
      mappings.push(mapping);

      if (existing) {
        mergeMissingItemDetails(existing, parsed, seed, mapping);
        report.mergedExisting.push({
          item: parsed.name,
          key,
          itemId: parsed.itemId ?? undefined,
          armorSet: seed.armorSet,
          classCode: seed.classCode,
        });
      } else {
        parsed.questSources = [questSourceFromSeed(seed)];
        details[key] = parsed;
        existingNameIndex.set(normalizeComparableItemName(parsed.name), key);
        report.imported.push({
          item: parsed.name,
          itemId: parsed.itemId ?? undefined,
          armorSet: seed.armorSet,
          classCode: seed.classCode,
          sourceUrl: parsed.sourceUrl ?? undefined,
          icon: parsed.icon ?? null,
        });
      }
    } catch (error) {
      report.failed.push({
        item: seed.rewardItemName,
        armorSet: seed.armorSet,
        classCode: seed.classCode,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const classesWithRewards = new Set(seeds.map((seed) => seed.classCode));
  for (const expectedClass of ["WAR", "CLR", "PAL", "RNG", "SHD", "DRU", "MNK", "BRD", "ROG", "SHM", "NEC", "WIZ", "MAG", "ENC", "BST", "BER"]) {
    if (!classesWithRewards.has(expectedClass)) {
      report.skippedClasses.push({
        classCode: expectedClass,
        reason: "No Thurgadin/Kael/Skyshrine quest armor page was discovered from the targeted Velious class armor source.",
      });
    }
  }

  const uniqueMappings = dedupeQuestMappings(mappings);

  if (!dryRun) {
    await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
    await writeFile(generatedMappingPath, renderGeneratedMappings(uniqueMappings));
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(`Armor pages discovered: ${pages.length}`);
  console.log(`Rewards discovered: ${seeds.length}`);
  console.log(`Imported new item records: ${report.imported.length}`);
  console.log(`Merged existing records: ${report.mergedExisting.length}`);
  console.log(`Failed: ${report.failed.length}`);
  if (report.failed.length) {
    for (const failed of report.failed.slice(0, 20)) {
      console.log(`  Failed: ${failed.classCode} ${failed.armorSet} ${failed.item} - ${failed.reason}`);
    }
  }
  console.log(`Quest mappings generated: ${uniqueMappings.length}`);
  if (dryRun) console.log("Dry run only; no files written.");
}

function manualModernClassSeeds(): ArmorRewardSeed[] {
  // Beastlord and Berserker were added after Velious, so the P99 Velious armor
  // index does not list them. These seed names come from EQProgression's Velious
  // armor tables, while stats and icons still resolve through Allakhazam pages.
  const sourcePageUrl = "https://www.eqprogression.com/velious-class-armor-quests/";
  const pieces: Array<{
    classCode: string;
    className: string;
    armorSet: ArmorSet;
    questName: string;
    rewardItemName: string;
    sourceItemName: string;
  }> = [
    { classCode: "BST", className: "Beastlord", armorSet: "Kael", questName: "Beastlord Kael Armor Quests", rewardItemName: "Chestguard of Beast Mastery", sourceItemName: "Ancient Leather Tunic" },
    { classCode: "BST", className: "Beastlord", armorSet: "Kael", questName: "Beastlord Kael Armor Quests", rewardItemName: "Leggings of Beast Mastery", sourceItemName: "Ancient Leather Leggings" },
    { classCode: "BST", className: "Beastlord", armorSet: "Kael", questName: "Beastlord Kael Armor Quests", rewardItemName: "Armband of Beast Mastery", sourceItemName: "Ancient Leather Sleeves" },
    { classCode: "BST", className: "Beastlord", armorSet: "Kael", questName: "Beastlord Kael Armor Quests", rewardItemName: "Crown of Beast Mastery", sourceItemName: "Ancient Leather Cap" },
    { classCode: "BST", className: "Beastlord", armorSet: "Kael", questName: "Beastlord Kael Armor Quests", rewardItemName: "Boots of Beast Mastery", sourceItemName: "Ancient Leather Boots" },
    { classCode: "BST", className: "Beastlord", armorSet: "Kael", questName: "Beastlord Kael Armor Quests", rewardItemName: "Gloves of Beast Mastery", sourceItemName: "Ancient Leather Gloves" },
    { classCode: "BST", className: "Beastlord", armorSet: "Kael", questName: "Beastlord Kael Armor Quests", rewardItemName: "Bracer of Beast Mastery", sourceItemName: "Ancient Leather Bracelet" },
    { classCode: "BST", className: "Beastlord", armorSet: "Skyshrine", questName: "Beastlord Skyshrine Armor Quests", rewardItemName: "Savage Chestguard", sourceItemName: "Unadorned Leather Tunic" },
    { classCode: "BST", className: "Beastlord", armorSet: "Skyshrine", questName: "Beastlord Skyshrine Armor Quests", rewardItemName: "Savage Leggings", sourceItemName: "Unadorned Leather Leggings" },
    { classCode: "BST", className: "Beastlord", armorSet: "Skyshrine", questName: "Beastlord Skyshrine Armor Quests", rewardItemName: "Savage Armband", sourceItemName: "Unadorned Leather Sleeves" },
    { classCode: "BST", className: "Beastlord", armorSet: "Skyshrine", questName: "Beastlord Skyshrine Armor Quests", rewardItemName: "Savage Helm", sourceItemName: "Unadorned Leather Cap" },
    { classCode: "BST", className: "Beastlord", armorSet: "Skyshrine", questName: "Beastlord Skyshrine Armor Quests", rewardItemName: "Savage Boots", sourceItemName: "Unadorned Leather Boots" },
    { classCode: "BST", className: "Beastlord", armorSet: "Skyshrine", questName: "Beastlord Skyshrine Armor Quests", rewardItemName: "Savage Gloves", sourceItemName: "Unadorned Leather Gloves" },
    { classCode: "BST", className: "Beastlord", armorSet: "Skyshrine", questName: "Beastlord Skyshrine Armor Quests", rewardItemName: "Savage Bracer", sourceItemName: "Unadorned Leather Bracelet" },
    { classCode: "BST", className: "Beastlord", armorSet: "Thurgadin", questName: "Beastlord Thurgadin Armor Quests", rewardItemName: "Chestguard of the Beastlord", sourceItemName: "Eroded Leather Tunic" },
    { classCode: "BST", className: "Beastlord", armorSet: "Thurgadin", questName: "Beastlord Thurgadin Armor Quests", rewardItemName: "Leggings of the Beastlord", sourceItemName: "Eroded Leather Leggings" },
    { classCode: "BST", className: "Beastlord", armorSet: "Thurgadin", questName: "Beastlord Thurgadin Armor Quests", rewardItemName: "Armband of the Beastlord", sourceItemName: "Eroded Leather Sleeves" },
    { classCode: "BST", className: "Beastlord", armorSet: "Thurgadin", questName: "Beastlord Thurgadin Armor Quests", rewardItemName: "Crown of the Beastlord", sourceItemName: "Eroded Leather Cap" },
    { classCode: "BST", className: "Beastlord", armorSet: "Thurgadin", questName: "Beastlord Thurgadin Armor Quests", rewardItemName: "Boots of the Beastlord", sourceItemName: "Eroded Leather Boots" },
    { classCode: "BST", className: "Beastlord", armorSet: "Thurgadin", questName: "Beastlord Thurgadin Armor Quests", rewardItemName: "Gloves of the Beastlord", sourceItemName: "Eroded Leather Gloves" },
    { classCode: "BST", className: "Beastlord", armorSet: "Thurgadin", questName: "Beastlord Thurgadin Armor Quests", rewardItemName: "Bracer of the Beastlord", sourceItemName: "Eroded Leather Bracelet" },
    { classCode: "BER", className: "Berserker", armorSet: "Kael", questName: "Berserker Kael Armor Quests", rewardItemName: "Firebrand's Tunic", sourceItemName: "Ancient Tarnished Chain Tunic" },
    { classCode: "BER", className: "Berserker", armorSet: "Kael", questName: "Berserker Kael Armor Quests", rewardItemName: "Firebrand's Leggings", sourceItemName: "Ancient Tarnished Chain Leggings" },
    { classCode: "BER", className: "Berserker", armorSet: "Kael", questName: "Berserker Kael Armor Quests", rewardItemName: "Firebrand's Sleeves", sourceItemName: "Ancient Tarnished Chain Sleeves" },
    { classCode: "BER", className: "Berserker", armorSet: "Kael", questName: "Berserker Kael Armor Quests", rewardItemName: "Firebrand's Coif", sourceItemName: "Ancient Tarnished Chain Coif" },
    { classCode: "BER", className: "Berserker", armorSet: "Kael", questName: "Berserker Kael Armor Quests", rewardItemName: "Firebrand's Boots", sourceItemName: "Ancient Tarnished Chain Boots" },
    { classCode: "BER", className: "Berserker", armorSet: "Kael", questName: "Berserker Kael Armor Quests", rewardItemName: "Firebrand's Gauntlets", sourceItemName: "Ancient Tarnished Chain Gauntlets" },
    { classCode: "BER", className: "Berserker", armorSet: "Kael", questName: "Berserker Kael Armor Quests", rewardItemName: "Firebrand's Bracer", sourceItemName: "Ancient Tarnished Chain Bracer" },
    { classCode: "BER", className: "Berserker", armorSet: "Skyshrine", questName: "Berserker Skyshrine Armor Quests", rewardItemName: "Tunic of Fire's Fury", sourceItemName: "Unadorned Chain Tunic" },
    { classCode: "BER", className: "Berserker", armorSet: "Skyshrine", questName: "Berserker Skyshrine Armor Quests", rewardItemName: "Leggings of Fire's Fury", sourceItemName: "Unadorned Chain Leggings" },
    { classCode: "BER", className: "Berserker", armorSet: "Skyshrine", questName: "Berserker Skyshrine Armor Quests", rewardItemName: "Sleeves of Fire's Fury", sourceItemName: "Unadorned Chain Sleeves" },
    { classCode: "BER", className: "Berserker", armorSet: "Skyshrine", questName: "Berserker Skyshrine Armor Quests", rewardItemName: "Coif of Fire's Fury", sourceItemName: "Unadorned Chain Coif" },
    { classCode: "BER", className: "Berserker", armorSet: "Skyshrine", questName: "Berserker Skyshrine Armor Quests", rewardItemName: "Boots of Fire's Fury", sourceItemName: "Unadorned Chain Boots" },
    { classCode: "BER", className: "Berserker", armorSet: "Skyshrine", questName: "Berserker Skyshrine Armor Quests", rewardItemName: "Gauntlets of Fire's Fury", sourceItemName: "Unadorned Chain Gauntlets" },
    { classCode: "BER", className: "Berserker", armorSet: "Skyshrine", questName: "Berserker Skyshrine Armor Quests", rewardItemName: "Bracer of Fire's Fury", sourceItemName: "Unadorned Chain Bracer" },
    { classCode: "BER", className: "Berserker", armorSet: "Thurgadin", questName: "Berserker Thurgadin Armor Quests", rewardItemName: "Icefury Tunic", sourceItemName: "Corroded Chain Tunic" },
    { classCode: "BER", className: "Berserker", armorSet: "Thurgadin", questName: "Berserker Thurgadin Armor Quests", rewardItemName: "Icefury Greaves", sourceItemName: "Corroded Chain Leggings" },
    { classCode: "BER", className: "Berserker", armorSet: "Thurgadin", questName: "Berserker Thurgadin Armor Quests", rewardItemName: "Icefury Sleeves", sourceItemName: "Corroded Chain Sleeves" },
    { classCode: "BER", className: "Berserker", armorSet: "Thurgadin", questName: "Berserker Thurgadin Armor Quests", rewardItemName: "Icefury Coif", sourceItemName: "Corroded Chain Coif" },
    { classCode: "BER", className: "Berserker", armorSet: "Thurgadin", questName: "Berserker Thurgadin Armor Quests", rewardItemName: "Icefury Boots", sourceItemName: "Corroded Chain Boots" },
    { classCode: "BER", className: "Berserker", armorSet: "Thurgadin", questName: "Berserker Thurgadin Armor Quests", rewardItemName: "Icefury Gauntlets", sourceItemName: "Corroded Chain Gauntlets" },
    { classCode: "BER", className: "Berserker", armorSet: "Thurgadin", questName: "Berserker Thurgadin Armor Quests", rewardItemName: "Icefury Bracer", sourceItemName: "Corroded Chain Bracer" },
  ];

  return pieces.map((piece) => ({
    ...piece,
    sourcePageUrl,
    p99RewardUrl: `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(piece.rewardItemName)}`,
  }));
}

async function discoverArmorPages() {
  const html = await fetchCached(p99VeliousArmorUrl, "p99:velious-class-armor");
  const pages: ArmorPage[] = [];

  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) => match[1]);
    if (cells.length < 4) continue;

    const className = stripTags(cells[0]).replace(/\s+/g, " ").trim();
    const classCode = classNameToCode.get(className.toLowerCase());
    if (!classCode) continue;

    for (let index = 0; index < armorSetColumns.length; index += 1) {
      const link = firstLink(cells[index + 1]);
      if (!link) continue;
      pages.push({
        classCode,
        className,
        armorSet: armorSetColumns[index],
        url: absolutize(link.href, p99VeliousArmorUrl),
        pageName: link.text,
      });
    }
  }

  return uniqueBy(pages, (page) => `${page.classCode}\u0000${page.armorSet}\u0000${page.url}`);
}

async function readArmorPageRewards(page: ArmorPage) {
  const html = await fetchCached(page.url, `p99:set:${page.url}`);
  const pageTitle = stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? page.pageName)
    .replace(/\s*-\s*Project 1999 Wiki\s*$/i, "")
    .trim();
  const rewardSection = sliceBetween(html, /id=["']Rewards?["'][\s\S]*?<\/h2>/i, /id=["']Checklist["']/i);
  const checklistSection = sliceBetween(html, /id=["']Checklist["'][\s\S]*?<\/h2>/i, /id=["']Walkthrough["']/i);
  const rewardLinks = Array.from(rewardSection.matchAll(/<li>\s*<div class=["']hbdiv["']>\s*<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({
      name: stripTags(match[2]),
      url: absolutize(match[1], page.url),
    }))
    .filter((entry) => entry.name);
  const checklistMap = parseChecklistMap(checklistSection);
  const turnInNpcName = stripTags(checklistSection.match(/Turn-ins?\s+to\s+<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "").trim() || undefined;

  return rewardLinks.map((reward): ArmorRewardSeed => ({
    ...page,
    rewardItemName: reward.name,
    p99RewardUrl: reward.url,
    questName: pageTitle,
    turnInNpcName,
    sourceItemName: checklistMap.get(normalizeComparableItemName(reward.name)),
    sourcePageUrl: page.url,
  }));
}

function parseChecklistMap(html: string) {
  const map = new Map<string, string>();
  const pattern = /<ul>\s*<li>\s*<a\s+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>\s*<\/li>\s*<\/ul>\s*<dl>\s*<dd>\s*<ul>([\s\S]*?)<\/ul>/gi;

  for (const match of html.matchAll(pattern)) {
    const rewardName = stripTags(match[1]);
    const sourceLink = firstLink(match[2]);
    if (!rewardName || !sourceLink?.text) continue;
    map.set(normalizeComparableItemName(rewardName), sourceLink.text);
  }

  return map;
}

function cleanupStaleVeliousArmorImports(details: ItemDetailsMap, seeds: ArmorRewardSeed[]) {
  const allowedNames = new Set(seeds.map((seed) => normalizeComparableItemName(seed.rewardItemName)));
  const removed: string[] = [];

  for (const [key, item] of Object.entries(details)) {
    if (item?.sourceCategory !== "Velious class armor") continue;
    if (allowedNames.has(normalizeComparableItemName(item.name ?? key))) continue;
    removed.push(key);
    delete details[key];
  }

  return removed;
}

async function resolveAllakhazamItem(itemName: string) {
  const searchHtml = await fetchCached(searchUrl(itemName), `zam:search:${itemName}`);
  const candidates = getSearchCandidates(searchHtml, itemName);
  const exactCandidates = candidates.filter((candidate) => candidate.exactName);
  const candidatesToInspect = exactCandidates.length ? exactCandidates : candidates.slice(0, 5);
  const inspected: Array<{ url: string; html: string; score: number; exactName: boolean }> = [];

  for (const candidate of candidatesToInspect) {
    const url = canonicalItemUrl(candidate.url);
    const html = await fetchCached(url, `zam:item:${url}`);
    const text = stripTags(html);
    const expansion = extractExpansion(html);
    let score = 0;
    if (candidate.exactName) score += 100;
    if (normalizeComparableItemName(readItemTitle(html, text) ?? "") === normalizeComparableItemName(itemName)) score += 80;
    if (expansion && /Velious/i.test(expansion)) score += 35;
    if (/Class:/i.test(text) && /Slot:/i.test(text)) score += 15;
    inspected.push({ url, html, score, exactName: candidate.exactName });
  }

  inspected.sort((a, b) => b.score - a.score);
  const best = inspected[0];
  if (!best || best.score < 90) return null;
  return best;
}

function getSearchCandidates(searchHtml: string, itemName: string) {
  const candidates = new Map<string, { url: string; text: string; exactName: boolean }>();

  for (const match of searchHtml.matchAll(/href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].startsWith("http")
      ? match[1]
      : `https://everquest.allakhazam.com${match[1].startsWith("/") ? "" : "/"}${match[1]}`;
    const url = href.replace(/&amp;/g, "&");
    const text = stripTags(match[2]);
    const exactName = normalizeComparableItemName(text) === normalizeComparableItemName(itemName);
    const existing = candidates.get(url);

    if (!existing || (exactName && !existing.exactName) || text.length > existing.text.length) {
      candidates.set(url, { url, text, exactName });
    }
  }

  return Array.from(candidates.values());
}

function parseAllakhazamItemPage(html: string, itemName: string, url: string, seed: ArmorRewardSeed): ItemDetails {
  const pageText = stripTags(html);
  const itemBlockHtml = html.match(/<div class=["']nobgrd["'][^>]*>([\s\S]*?)<\/div>\s*<div id=/i)?.[1] ?? html;
  const text = stripTags(itemBlockHtml);
  const titleName = readItemTitle(html, pageText) ?? itemName;
  const parsedName = titleName.replace(/^Item\s*:\s*/i, "").trim();
  const { stats, resists } = parseStatBlock(text);
  const worn_effects = readEffects("Worn", text);
  const focus_effects = readEffects("Focus", text);
  const click_effects = readEffects("Effect", text).filter((effect) => /click|casting time|must equip|can equip/i.test(effect));
  const proc_effects = Array.from(new Set(readEffects("Combat Effects", text).concat(readEffects("Proc", text))));
  const baseItem = {
    name: parsedName || itemName,
    itemId: extractItemId(url),
    sourceUrl: url,
    slot: readString(/\bSlot:\s*([^\n]+)/i, text),
    ac: readNumber(/\bAC:\s*([+-]?\d+)/i, text),
    damage: readNumber(/\b(?:DMG|Damage):\s*(\d+)/i, text),
    delay: readNumber(/\bDelay:\s*(\d+)/i, text),
    skill: readString(/\bSkill:\s*([^\n]*?)(?:\s+Atk Delay:|$)/i, text),
    damage_bonus: readNumber(/\b(?:Dmg Bon|Damage Bonus):\s*([+-]?\d+)/i, text),
    stats,
    resists,
    hp_regen: readRegen("HP", text),
    mana_regen: readRegen("Mana", text),
    manaRegen: readRegen("Mana", text),
    endurance_regen: readRegen("Endurance", text),
    attack: readNumber(/\bAttack:\s*([+-]?\d+)/i, text),
    haste: readString(/\bHaste:\s*([+-]?\d+%)/i, text) ?? readString(/\b(\d+%)\s*Haste\b/i, text),
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
    item_type: readTableValue("Item Type", html),
    stackable: (() => {
      const value = readTableValue("Stackable", html);
      return value ? /^yes$/i.test(value) : null;
    })(),
    weight_reduction: readString(/\bWeight Reduction:\s*([+-]?\d+%)/i, text),
    capacity: readNumber(/\bCapacity:\s*(\d+)/i, text),
    size_capacity: readString(/\bSize Capacity:\s*([^\n]+)/i, text),
    lore: /\bLORE(?:\s+ITEM)?\b/i.test(text) ? true : null,
    magic: /\bMAGIC(?:\s+ITEM)?\b/i.test(text) ? true : null,
    no_drop: /\b(?:NO\s+DROP|NO\s+TRADE|NO\s+TRADE|NO\s+TRADE|NO\s+DROP|No Trade)\b/i.test(text) ? true : null,
    prestige: /\bPRESTIGE\b/i.test(text) ? true : null,
    quest: true,
    aug_slots: [],
    iconPath: null,
    sources: [{ name: "Allakhazam" as const, url }],
    confidence: "exact_match",
    match_confidence: "exact_match",
    match_notes: [`Imported as ${seed.armorSet} Velious class armor from ${seed.sourcePageUrl}.`],
    missing_core_stats: false,
    duplicate_name_risk: false,
    parsing_warnings: itemBlockHtml === html ? ["Could not isolate the ZAM item stat block; parsed the full page."] : [],
    expansion: "Velious",
    acquisitionType: "quest",
    sourceCategory: "Velious class armor",
    armorSet: seed.armorSet,
    sourceItemName: seed.sourceItemName,
    questName: seed.questName,
    turnInNpcName: seed.turnInNpcName,
  };
  const weaponType = inferWeaponType(baseItem);
  const itemType = weaponType === "shield" ? "shield" : null;

  return {
    ...baseItem,
    itemType,
    weaponType,
    isTwoHanded: weaponType === "2H" ? true : null,
  };
}

function mergeMissingItemDetails(existing: ItemDetails, imported: ItemDetails, seed: ArmorRewardSeed, mapping: QuestRewardMapping) {
  setIfMissing(existing, "itemId", imported.itemId);
  setIfMissing(existing, "sourceUrl", imported.sourceUrl);
  setIfMissing(existing, "slot", imported.slot);
  setIfMissing(existing, "ac", imported.ac);
  setIfMissing(existing, "damage", imported.damage);
  setIfMissing(existing, "delay", imported.delay);
  setIfMissing(existing, "skill", imported.skill);
  setIfMissing(existing, "damage_bonus", imported.damage_bonus);
  setIfEmptyObject(existing, "stats", imported.stats);
  setIfEmptyObject(existing, "resists", imported.resists);
  setIfMissing(existing, "hp_regen", imported.hp_regen);
  setIfMissing(existing, "mana_regen", imported.mana_regen);
  setIfMissing(existing, "manaRegen", imported.manaRegen);
  setIfMissing(existing, "endurance_regen", imported.endurance_regen);
  setIfMissing(existing, "attack", imported.attack);
  setIfMissing(existing, "atk", imported.attack);
  setIfMissing(existing, "haste", imported.haste);
  setIfMissing(existing, "charges", imported.charges);
  setIfEmptyArray(existing, "worn_effects", imported.worn_effects);
  setIfEmptyArray(existing, "focus_effects", imported.focus_effects);
  setIfEmptyArray(existing, "click_effects", imported.click_effects);
  setIfEmptyArray(existing, "proc_effects", imported.proc_effects);
  setIfEmptyArray(existing, "effects", imported.effects ?? []);
  setIfMissing(existing, "required_level", imported.required_level);
  setIfMissing(existing, "recommended_level", imported.recommended_level);
  setIfEmptyArray(existing, "classes", imported.classes);
  setIfEmptyArray(existing, "races", imported.races);
  setIfMissing(existing, "weight", imported.weight);
  setIfMissing(existing, "size", imported.size);
  setIfMissing(existing, "item_type", imported.item_type);
  setIfMissing(existing, "itemType", imported.itemType);
  setIfMissing(existing, "weaponType", imported.weaponType);
  setIfMissing(existing, "isTwoHanded", imported.isTwoHanded);
  setIfMissing(existing, "stackable", imported.stackable);
  setIfMissing(existing, "weight_reduction", imported.weight_reduction);
  setIfMissing(existing, "capacity", imported.capacity);
  setIfMissing(existing, "size_capacity", imported.size_capacity);
  setIfMissing(existing, "lore", imported.lore);
  setIfMissing(existing, "magic", imported.magic);
  setIfMissing(existing, "no_drop", imported.no_drop);
  setIfMissing(existing, "prestige", imported.prestige);
  setIfEmptyArray(existing, "aug_slots", imported.aug_slots);

  existing.quest = true;
  existing.expansion = existing.expansion || "Velious";
  existing.acquisitionType = existing.acquisitionType || "quest";
  existing.sourceCategory = existing.sourceCategory || "Velious class armor";
  existing.armorSet = existing.armorSet || seed.armorSet;
  existing.sourceItemName = seed.sourceItemName || existing.sourceItemName;
  existing.questName = existing.questName || seed.questName;
  existing.turnInNpcName = existing.turnInNpcName || seed.turnInNpcName;

  if (!existing.iconPath && !existing.icon && !existing.icon_url && imported.icon) {
    existing.icon = imported.icon;
  }

  addSource(existing, imported.sources[0]);
  addQuestSource(existing, questSourceFromSeed(seed));
  addMappingMetadata(existing, mapping);
}

function makeQuestMapping(seed: ArmorRewardSeed, parsed: ItemDetails): QuestRewardMapping {
  return {
    questName: seed.questName,
    sourceItemName: seed.sourceItemName,
    turnInNpcName: seed.turnInNpcName,
    rewardItemName: parsed.name,
    rewardItemId: parsed.itemId ?? undefined,
    rewardSlot: parsed.slot ?? undefined,
    rewardClasses: parsed.classes?.length ? parsed.classes : [seed.classCode],
    notes: `${seed.armorSet} Velious class armor reward.`,
  };
}

function addMappingMetadata(existing: ItemDetails, mapping: QuestRewardMapping) {
  existing.questId = existing.questId || mapping.questId;
  existing.questName = existing.questName || mapping.questName;
  existing.turnInNpcName = existing.turnInNpcName || mapping.turnInNpcName;
}

function renderGeneratedMappings(mappings: QuestRewardMapping[]) {
  return `import type { QuestRewardMapping } from "./questRewardMappings";\n\n`
    + `// Generated by scripts/import-velious-class-armor.ts.\n`
    + `// Lightweight Velious class armor source-item to reward mappings only; no quest walkthrough text.\n`
    + `export const veliousClassArmorQuestMappings: QuestRewardMapping[] = ${JSON.stringify(mappings, null, 2)};\n`;
}

function dedupeQuestMappings(mappings: QuestRewardMapping[]) {
  return uniqueBy(mappings, (mapping) => [
    mapping.questName ?? "",
    mapping.turnInNpcName ?? "",
    mapping.sourceItemName ?? "",
    mapping.rewardItemName,
    mapping.rewardItemId ?? "",
  ].join("\u0000")).sort((a, b) =>
    String(a.questName ?? "").localeCompare(String(b.questName ?? ""))
      || String(a.rewardItemName).localeCompare(String(b.rewardItemName)),
  );
}

function questSourceFromSeed(seed: ArmorRewardSeed) {
  return {
    sourceItemName: seed.sourceItemName ?? "Velious armor turn-in",
    questName: seed.questName,
    turnInNpcName: seed.turnInNpcName,
  };
}

function setIfMissing<K extends keyof ItemDetails>(target: ItemDetails, key: K, value: ItemDetails[K] | undefined) {
  if (value === undefined || value === null || value === "") return;
  const current = target[key];
  if (current === undefined || current === null || current === "") {
    target[key] = value as ItemDetails[K];
  }
}

function setIfEmptyArray<K extends keyof ItemDetails>(target: ItemDetails, key: K, value: unknown[]) {
  const current = target[key];
  if (Array.isArray(current) && current.length > 0) return;
  if (!value.length) return;
  target[key] = value as ItemDetails[K];
}

function setIfEmptyObject<K extends keyof ItemDetails>(target: ItemDetails, key: K, value: Record<string, unknown>) {
  const current = target[key];
  if (current && typeof current === "object" && !Array.isArray(current) && Object.keys(current).length > 0) return;
  if (!Object.keys(value).length) return;
  target[key] = value as ItemDetails[K];
}

function addSource(item: ItemDetails, source: Source | undefined) {
  if (!source) return;
  item.sources = Array.isArray(item.sources) ? item.sources : [];
  if (!item.sources.some((existing) => existing.name === source.name && canonicalItemUrl(existing.url) === canonicalItemUrl(source.url))) {
    item.sources.push(source);
  }
}

function addQuestSource(item: ItemDetails, source: NonNullable<ItemDetails["questSources"]>[number]) {
  item.questSources = Array.isArray(item.questSources) ? item.questSources : [];
  const key = [source.sourceItemName, source.questName, source.turnInNpcName].join("\u0000").toLowerCase();
  if (!item.questSources.some((existing) => [existing.sourceItemName, existing.questName, existing.turnInNpcName].join("\u0000").toLowerCase() === key)) {
    item.questSources.push(source);
  }
}

function buildExistingNameIndex(details: ItemDetailsMap) {
  const index = new Map<string, string>();
  for (const [key, value] of Object.entries(details)) {
    index.set(normalizeComparableItemName(key), key);
    if (value?.name) index.set(normalizeComparableItemName(value.name), key);
  }
  return index;
}

function dedupeSeeds(seeds: ArmorRewardSeed[]) {
  return uniqueBy(seeds, (seed) => [
    normalizeComparableItemName(seed.rewardItemName),
    seed.classCode,
    seed.armorSet,
  ].join("\u0000")).sort((a, b) =>
    a.classCode.localeCompare(b.classCode)
      || a.armorSet.localeCompare(b.armorSet)
      || a.rewardItemName.localeCompare(b.rewardItemName),
  );
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
    if (resistKey) {
      resists[resistKey] = value;
    }
  }

  return { stats, resists };
}

function buildEffects(values: { worn_effects: string[]; focus_effects: string[]; click_effects: string[]; proc_effects: string[] }) {
  const effects: ItemEffect[] = [];
  for (const name of values.worn_effects) effects.push({ name, type: "worn" });
  for (const name of values.focus_effects) effects.push({ name, type: isBardMod(name) ? "bardMod" : "focus" });
  for (const name of values.click_effects) effects.push({ name, type: "click" });
  for (const name of values.proc_effects) effects.push({ name, type: "proc" });
  return effects;
}

function isBardMod(name: string) {
  return /^(Brass|Percussion|Singing|String|Stringed|Wind)\s+Resonance\b/i.test(name.trim());
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
  return values.map((value) => classTokenAliases.get(value.toUpperCase()) ?? value);
}

function readRegen(label: "HP" | "Mana" | "Endurance", text: string) {
  return readNumber(new RegExp(`\\b${label}\\s+(?:Regen|Regeneration)\\s*:?\\s*([+-]?\\d+)`, "i"), text);
}

function readEffects(label: string, text: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}:\\s*([^\\n]+)`, "gi");
  return Array.from(
    new Set(
      Array.from(text.matchAll(pattern))
        .map((match) => match[1].replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  );
}

function readTableValue(label: string, html: string) {
  const pattern = new RegExp(`<tr><th[^>]*>[\\s\\S]*?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?<\\/th><td[^>]*>([\\s\\S]*?)<\\/td><\\/tr>`, "i");
  const match = html.match(pattern);
  return match ? stripTags(match[1]).replace(/\s+/g, " ").trim() : null;
}

function inferWeaponType(item: Pick<ItemDetails, "name" | "slot" | "skill" | "item_type" | "itemType">): ItemDetails["weaponType"] {
  if (/\bbuckler\b/i.test(item.name ?? "")) return "shield";
  const slot = String(item.slot ?? "").toUpperCase();
  const combined = `${item.skill ?? ""} ${item.item_type ?? ""} ${item.itemType ?? ""}`.replace(/\s+/g, " ");

  if (/\bshield\b/i.test(combined)) return "shield";
  if (/\b(?:2H|2HB|2HS|2HP|2\s*H|two[-\s]?hand(?:ed)?)\b/i.test(combined)) return "2H";
  if (/\b(?:1H|1HB|1HS|1HP|1\s*H|one[-\s]?hand(?:ed)?)\b/i.test(combined)) return "1H";
  if (slot.includes("RANGE") || slot.includes("RANGED")) return "ranged";
  if (slot.includes("PRIMARY")) return "other";
  return null;
}

function extractExpansion(html: string) {
  const expansionHtml = html.match(/<strong>\s*Expansion:\s*<\/strong>([\s\S]*?)<br/i)?.[1];
  if (!expansionHtml) return null;
  const alt = expansionHtml.match(/alt=["']([^"']+)["']/i)?.[1];
  return (alt ?? stripTags(expansionHtml)).replace(/\s+/g, " ").trim() || null;
}

function readItemTitle(html: string, pageText: string) {
  const meta = html.match(/<meta\s+[^>]*property=(["'])og:title\1[^>]*content=(["'])([\s\S]*?)\2/i)?.[3]
    ?? html.match(/<meta\s+[^>]*content=(["'])([\s\S]*?)\1[^>]*property=(["'])og:title\3/i)?.[2];
  const title = meta
    ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
    ?? readString(/^\s*([^\n]+?)\s*-\s*Project 1999/i, pageText);

  return title
    ? stripTags(title)
      .replace(/\s*::\s*Items?\s*::\s*EverQuest\s*::\s*ZAM\s*$/i, "")
      .replace(/\s*::\s*EverQuest\s*::\s*ZAM\s*$/i, "")
      .replace(/\s*-\s*Project 1999 Wiki\s*$/i, "")
      .trim()
    : null;
}

function searchUrl(itemName: string) {
  return `https://everquest.allakhazam.com/search.html?q=${encodeURIComponent(itemName)}`;
}

function canonicalItemUrl(url: string) {
  return url.match(/^(https?:\/\/everquest\.allakhazam\.com\/db\/item\.html\?item=\d+)/i)?.[1] ?? url;
}

function extractItemId(url: string) {
  return url.match(/[?&]item=(\d+)/i)?.[1] ?? null;
}

async function fetchCached(url: string, label: string) {
  const filePath = path.join(cacheDir, `${cacheKey(label)}.html`);

  if (existsSync(filePath)) {
    return readFile(filePath, "utf8");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await sleep(requestDelayMs * attempt);
      const response = await fetch(url, {
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
      const html = await response.text();
      await writeFile(filePath, html);
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.log(`Retrying ${url} after ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

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
      .replace(/<\/(div|p|tr|td|li|h1|h2|h3|dd|dl|ul)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim(),
  );
}

function readAttr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? htmlDecode(match[1]) : "";
}

function readNumberAttr(tag: string, name: string) {
  const value = readAttr(tag, name);
  return /^\d+$/.test(value) ? Number(value) : null;
}

function absolutize(src: string, baseUrl: string) {
  if (src.startsWith("//")) return `https:${src}`;
  if (/^https?:\/\//i.test(src)) return src;
  return new URL(src, baseUrl).toString();
}

function firstLink(html: string) {
  const match = html.match(/<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  return match ? { href: htmlDecode(match[1]), text: stripTags(match[2]) } : null;
}

function sliceBetween(html: string, startPattern: RegExp, endPattern: RegExp) {
  const start = html.search(startPattern);
  if (start < 0) return "";
  const sliced = html.slice(start);
  const end = sliced.search(endPattern);
  return end < 0 ? sliced : sliced.slice(0, end);
}

function uniqueBy<T>(values: T[], keyFn: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFn(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeComparableItemName(value: string) {
  return normalizeName(value.replace(/\s*\[[^\]]+\]\s*$/g, "").replace(/['`â€™]/g, ""));
}

function findImageCandidates(html: string, baseUrl: string, itemName: string) {
  const titleIndex = html.toLowerCase().indexOf(itemName.toLowerCase());
  const candidates: ImageCandidate[] = [];

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const index = match.index ?? 0;
    const src = readAttr(tag, "src");
    if (!src) continue;

    const nearbyStart = Math.max(0, index - 1200);
    const nearbyEnd = Math.min(html.length, index + 1200);
    const candidate = {
      absoluteUrl: absolutize(src, baseUrl),
      alt: readAttr(tag, "alt"),
      width: readNumberAttr(tag, "width"),
      height: readNumberAttr(tag, "height"),
      nearbyText: stripTags(html.slice(nearbyStart, nearbyEnd)).slice(0, 240),
    };
    const scored = scoreImageCandidate(candidate, itemName);
    const distanceFromTitle = titleIndex >= 0 ? Math.abs(index - titleIndex) : Number.POSITIVE_INFINITY;

    candidates.push({
      absoluteUrl: candidate.absoluteUrl,
      alt: candidate.alt,
      width: candidate.width,
      height: candidate.height,
      score: scored.score + (distanceFromTitle < 1800 ? 15 : 0),
      reasons: distanceFromTitle < 1800 ? [...scored.reasons, "near title in document"] : scored.reasons,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreImageCandidate(
  candidate: { absoluteUrl: string; alt: string; width: number | null; height: number | null; nearbyText: string },
  itemName: string,
) {
  let score = 0;
  const reasons: string[] = [];
  const url = candidate.absoluteUrl.toLowerCase();
  const nearbyText = candidate.nearbyText.toLowerCase();
  const alt = candidate.alt.toLowerCase();
  const smallDimensions = candidate.width !== null
    && candidate.height !== null
    && candidate.width <= 80
    && candidate.height <= 80;

  if (smallDimensions) {
    score += 35;
    reasons.push(`small dimensions ${candidate.width}x${candidate.height}`);
  }

  if (/\/pgfx\/item_\d+\.(png|gif)$/i.test(url)) {
    score += 75;
    reasons.push("Allakhazam pgfx item icon asset");
  } else if (/\/(icons?|items?|itemicons?)\//i.test(url) || /item.*\.(gif|png|jpg|webp)$/i.test(url)) {
    score += 20;
    reasons.push("URL loosely looks like an item/icon asset");
  }

  if (nearbyText.includes(itemName.toLowerCase()) || alt.includes(itemName.toLowerCase())) {
    score += 20;
    reasons.push("near item name/title");
  }

  if (candidate.width !== null && candidate.height !== null && candidate.width > 120 && candidate.height > 120) {
    score -= 45;
    reasons.push("large image, likely screenshot or ad");
  }

  if (/quantserve|scorecardresearch|pixel|\/equipment\/|original\.gif|kunark|velious|logo|banner|ad|avatar|screenshot|mediabox|star|button|facebook|twitter|youtube|rss\.gif|helpdoc/i.test(url)) {
    score -= 60;
    reasons.push("URL looks like expansion badge/site chrome/ad/social asset");
  }

  if (candidate.width !== null && candidate.height !== null && candidate.width <= 2 && candidate.height <= 2) {
    score -= 80;
    reasons.push("tracking pixel dimensions");
  }

  if (/screenshot|posted|rating|comment|advert/i.test(nearbyText)) {
    score -= 25;
    reasons.push("near comments/ad/screenshot text");
  }

  return { score, reasons };
}
