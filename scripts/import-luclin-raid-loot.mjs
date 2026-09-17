import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const raidPath = path.join(root, "data", "luclin-raid.json");
const detailsPath = path.join(root, "data", "item-details.json");
const npcCacheDir = path.join(root, "cache", "zam-npc-pages");
const requestedBucket = Number(process.argv.find((arg) => arg.startsWith("--bucket="))?.split("=")[1] ?? 1);
const namesPath = path.join(root, "data", `luclin-bucket-${requestedBucket}-item-names.json`);
const reportPath = path.join(root, "data", requestedBucket === 1
  ? "luclin-raid-loot-import-report.json"
  : `luclin-bucket-${requestedBucket}-loot-import-report.json`);

const bucketOneSources = [
  { boss: "Khati Sha the Twisted", npcId: "12554" },
  {
    boss: "Lord Inquisitor Seru",
    npcId: "7231",
    ignoredItems: ["Boots of Sad Exploitation", "Earring of Sad Exploitation"],
  },
  { boss: "Emperor Ssraeshza", npcId: "7898", ignoredItems: ["Shissar Blood"] },
  { boss: "Vyzh'Dra the Cursed", npcId: "7830" },
  { boss: "Va Xi Aten Ha Ra", npcId: "8786" },
  { boss: "Aten Ha Ra", npcId: "8815" },
  { boss: "Diabo Xi Xin Thall", npcId: "8787" },
  { boss: "Diabo Xi Va Temariel", npcId: "10400" },
];

const bucketTwoSources = [
  { boss: "Shei Vinitras", npcId: "8561" },
  { boss: "Xerkizh the Creator", npcId: "7355" },
  { boss: "High Priest of Ssraeszha", npcId: "7354" },
  { boss: "Arch Lich Rhag'Zadune", npcId: "7827" },
  { boss: "Blood of Ssraeszha", npcId: "8721" },
  { boss: "Vyzh'Dra the Exiled", npcId: "7604" },
  { boss: "a burrower parasite", npcId: "9436" },
  { boss: "Thall Xundraux Diabo", npcId: "8816" },
  { boss: "Kaas Thox Xi Aten ha Ra \"Dat\"", npcId: "52705" },
  { boss: "Kaas Thox Xi Aten ha Ra \"Set\"", npcId: "8818" },
  { boss: "Thall Va Xakra \"Dat\"", npcId: "8778" },
  { boss: "Thall Va Xakra \"Set\"", npcId: "8778" },
  { boss: "Thall Va Kelun", npcId: "8817" },
  { boss: "Kaas Thox Xi Ans Dyek", npcId: "8776" },
  { boss: "Diabo Xi Va", npcId: "8789" },
  { boss: "Diabo Xi Xin", npcId: "8788" },
];

const bucketThreeSources = [
  { boss: "An Evolved Burrower", npcId: "11711" },
  { boss: "The Itraer Vius", npcId: "7230" },
  { boss: "The Insanity Crawler", npcId: "7926" },
  { boss: "The Va'Dyn", npcId: "7907" },
  { boss: "Grieg Veneficus", npcId: "7627" },
  { boss: "Servitor of Luclin", npcId: "7791" },
  {
    boss: "Lcea Katta",
    npcId: "8082",
    ignoredItems: ["Star Ruby Earring", "Crystallized Sulfur", "Lcea's Jewel Box [container]"],
  },
  { boss: "a glyph covered serpent", npcId: "7601" },
  {
    boss: "Rhag'Zhezum (Rhag1)",
    npcId: "7828",
    ignoredItems: ["Sunshard Ore", "Undead Shissar Scales", "Undead Shissar Venom Sac"],
  },
  {
    boss: "Rhag'Mozdezh (Rhag2)",
    npcId: "7829",
    ignoredItems: ["Shissar Fangs", "Undead Shissar Scales"],
  },
  { boss: "Thought Horror Overfiend", npcId: "7327", ignoredItems: ["Thought Horror Fangs"] },
  { boss: "Doomshade", npcId: "7913", ignoredItems: ["Akuel xi ans Vius"] },
  { boss: "Rumblecrush", npcId: "7398", ignoredItems: ["Rhodocrosite"] },
];

const bucketFourSources = [
  {
    boss: "Sheleric Vis",
    npcId: "9389",
    ignoredItems: ["Akhevan Brain Stem", "Bonded Loam", "Stale Oleander", "Sunshard Ore"],
  },
  { boss: "General Jared Blaystich", npcId: "9265" },
  {
    boss: "Praetorian Myral",
    npcId: "7586",
    ignoredItems: [
      "Crysotherium",
      "Stralagite",
      "Stratolite",
      "Small Brick of Yttrium Ore",
      "Faded Logs [Study in Yttrium Weaponry]",
      "Faded Logs [Study in Yttrium Armor]",
    ],
  },
  { boss: "Nathyn Illuminious", npcId: "8070" },
  { boss: "Praesertum Bikun", npcId: "11738" },
  { boss: "Praesertum Matpa", npcId: "11652" },
  { boss: "Praesertum Rhugol", npcId: "9056" },
  { boss: "Praesertum Vantorus", npcId: "11737" },
  { boss: "Spirit of Radir", npcId: "7909" },
  { boss: "Spirit of Tawro", npcId: "8556", ignoredItems: ["Frost Shadowstone"] },
  { boss: "Zelnithak", npcId: "7786", ignoredItems: ["Large Zelniak Tooth"] },
  { boss: "Netherbian Swarmlord", npcId: "8643" },
];

const sourcesByBucket = new Map([
  [1, bucketOneSources],
  [2, bucketTwoSources],
  [3, bucketThreeSources],
  [4, bucketFourSources],
]);
const requestedSources = sourcesByBucket.get(requestedBucket);
if (!requestedSources) throw new Error(`No curated Luclin raid source mapping exists for Bucket ${requestedBucket}.`);

const ignoredLootPattern = /^(?:Ancient:|Spell:|Song:)/i;
const userAgent = "FrostreaverLootReference/0.5 (+curated Luclin raid import)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function blankItem(name, itemUrl) {
  return {
    name,
    slot: null,
    ac: null,
    damage: null,
    delay: null,
    skill: null,
    damage_bonus: null,
    stats: {},
    resists: {},
    hp_regen: null,
    mana_regen: null,
    manaRegen: null,
    endurance_regen: null,
    attack: null,
    haste: null,
    charges: null,
    worn_effects: [],
    focus_effects: [],
    click_effects: [],
    proc_effects: [],
    required_level: null,
    recommended_level: null,
    classes: [],
    races: [],
    weight: null,
    size: null,
    item_type: null,
    stackable: null,
    weight_reduction: null,
    capacity: null,
    size_capacity: null,
    lore: null,
    magic: null,
    no_drop: null,
    prestige: null,
    aug_slots: [],
    iconPath: null,
    sources: [{ name: "Allakhazam", url: itemUrl }],
    expansion: "Luclin",
    confidence: "needs_review",
    match_confidence: "needs_review",
    match_notes: ["Imported from an exact Allakhazam Luclin raid NPC loot link."],
    missing_core_stats: true,
    duplicate_name_risk: false,
    parsing_warnings: [],
  };
}

async function fetchNpcLoot(source) {
  const npcUrl = `https://everquest.allakhazam.com/db/npc.html?id=${source.npcId}`;
  const cachePath = path.join(npcCacheDir, `npc-${source.npcId}.html`);
  let html = existsSync(cachePath) ? await readFile(cachePath, "utf8") : null;
  if (!html) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const requestUrl = attempt === 1 ? npcUrl : `${npcUrl}&frostreaver_retry=${attempt}`;
      const response = await fetch(requestUrl, {
        headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
      });
      if (response.ok) {
        html = await response.text();
        await mkdir(npcCacheDir, { recursive: true });
        await writeFile(cachePath, html);
        break;
      }
      if (response.status !== 403 || attempt === 3) {
        throw new Error(`${source.boss}: HTTP ${response.status}`);
      }
      await sleep(5000 * attempt);
    }
  }

  const pageName = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const lootSection = html.match(
    /Known Loot:(?:<\/strong>)?\s*([\s\S]*?)(?:<div class=["']mobzones["']|Known Habitats:|Factions Increased:|Quests:)/i,
  )?.[1];
  if (!lootSection && !source.allowEmptyLoot) throw new Error(`${source.boss}: Known Loot section was not found.`);

  const drops = new Map();
  const ignoredItems = new Set((source.ignoredItems ?? []).map((name) => name.toLowerCase()));
  for (const match of (lootSection ?? "").matchAll(/href=["']([^"']*\/db\/item\.html\?item=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = stripTags(match[3]);
    if (!name || ignoredLootPattern.test(name) || ignoredItems.has(name.toLowerCase())) continue;
    drops.set(name, {
      name,
      itemId: match[2],
      itemUrl: `https://everquest.allakhazam.com/db/item.html?item=${match[2]}`,
    });
  }

  return { ...source, npcUrl, pageName, drops: [...drops.values()] };
}

const raid = JSON.parse(await readFile(raidPath, "utf8"));
const details = JSON.parse(await readFile(detailsPath, "utf8"));
const initialItemNames = new Set(Object.keys(details));
const requestedTier = raid.tiers.find((tier) => tier.tier === requestedBucket);
if (!requestedTier) throw new Error(`Luclin Bucket ${requestedBucket} was not found.`);

const imported = [];
const failures = [];
const itemNames = new Set();
const createdItemNames = new Set();
const existingItemNames = new Set();

for (const source of requestedSources) {
  try {
    const result = await fetchNpcLoot(source);
    const boss = requestedTier.bosses.find((entry) => entry.name === source.boss);
    if (!boss) throw new Error(`${source.boss}: matching Bucket ${requestedBucket} boss was not found.`);

    boss.loot_pool = result.drops.map((drop) => drop.name);
    for (const drop of result.drops) {
      itemNames.add(drop.name);
      if (!details[drop.name]) {
        details[drop.name] = blankItem(drop.name, drop.itemUrl);
        createdItemNames.add(drop.name);
      } else {
        if (initialItemNames.has(drop.name)) existingItemNames.add(drop.name);
        details[drop.name].sources ??= [];
        const zamSource = details[drop.name].sources.find((entry) => entry.name === "Allakhazam");
        if (zamSource) zamSource.url = drop.itemUrl;
        else details[drop.name].sources.unshift({ name: "Allakhazam", url: drop.itemUrl });
        details[drop.name].expansion ||= "Luclin";
      }
    }

    imported.push({
      boss: source.boss,
      allakhazamPageName: result.pageName,
      npcId: source.npcId,
      npcUrl: result.npcUrl,
      itemCount: result.drops.length,
      items: result.drops,
    });
    console.log(`${source.boss}: ${result.drops.length} non-spell drops`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ boss: source.boss, npcId: source.npcId, message });
    console.error(message);
  }
}

if (failures.length > 0) {
  throw new Error(`Luclin import stopped with ${failures.length} NPC failure(s); no files were changed.`);
}

const sortedNames = [...itemNames].sort((a, b) => a.localeCompare(b));
const report = {
  generatedAt: new Date().toISOString(),
  expansion: "Luclin",
  bucket: requestedBucket,
  ignoredLootPrefixes: ["Ancient:", "Spell:", "Song:"],
  bossesImported: imported.length,
  uniqueItems: sortedNames.length,
  createdItems: createdItemNames.size,
  existingItemsUpdated: existingItemNames.size,
  bosses: imported,
  failures,
};

await writeFile(raidPath, `${JSON.stringify(raid, null, 2)}\n`);
await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(namesPath, `${JSON.stringify(sortedNames, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Imported ${imported.length} Luclin Bucket ${requestedBucket} bosses and ${sortedNames.length} unique non-spell items.`);
console.log(`Wrote ${reportPath}`);
