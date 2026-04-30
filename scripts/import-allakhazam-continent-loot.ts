import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

type NpcType = "mob" | "vendor" | "quest" | "mob_vendor" | "unknown";

type SourceZone = {
  name: string;
  zoneId: string;
  url: string;
  note: string;
};

type CuratedNpcIndexEntry = {
  id: string;
  name: string;
  normalizedName: string;
  zone: string;
  normalizedZone: string;
  expansion: string;
  level: number | null;
  datasetPath: string;
  bucket: number | string | null;
  levelRange: string | null;
  tags: string[];
};

type NpcListEntry = {
  name: string;
  url: string;
  levelRange: string;
  listedType: string;
  zoneName: string;
  expansion: string | null;
  availability: string | null;
};

type CatalogItem = {
  name: string;
  url: string;
  expansion: string | null;
  availability: string | null;
};

type DroppedItem = CatalogItem & {
  dropRate: string;
  quantity: string;
  notes: string;
};

type VendorItem = CatalogItem & {
  price: string;
};

type CatalogNpc = {
  id: string;
  name: string;
  url: string;
  source: "allakhazam";
  sourceUrl: string;
  sourceNpcId: string | null;
  importedAt: string;
  isCurated: false;
  matchesCuratedNpc: boolean;
  curatedNpcId: string | null;
  curatedMatchKey: string | null;
  npcType: NpcType;
  expansion: string | null;
  availability: string | null;
  hasNormalLoot: boolean;
  levelRange: string;
  listedType: string;
  zone: string;
  zoneId: string;
  drops: DroppedItem[];
  vendorItems: VendorItem[];
  questRewards: CatalogItem[];
  questTurnIns: CatalogItem[];
  questItems: CatalogItem[];
};

type ZoneOutput = {
  zone: string;
  zoneId: string;
  zoneUrl: string;
  hasAnyNormalLoot: boolean;
  npcListUrlsProcessed: string[];
  mobs: CatalogNpc[];
  log: {
    npcListPagesProcessed: number;
    npcPagesFetched: number;
    itemPagesFetched: number;
    skippedNpcPages: Array<{ npc: string; url: string; reason: string }>;
    curatedMatches: Array<{ importedNpc: string; importedNpcId: string | null; curatedNpcId: string; matchKey: string }>;
    mergeConflicts: Array<{ importedNpc: string; importedNpcId: string | null; curatedNpcId: string; reason: string }>;
    warnings: string[];
  };
};

type SummaryOutput = {
  continentUrl: string;
  generatedAt: string;
  zonesDiscovered: SourceZone[];
  zonesProcessed: Array<{
    zone: string;
    zoneId: string;
    outputFile: string;
    npcCount: number;
    dropCount: number;
    vendorItemCount: number;
    questItemCount: number;
    npcListUrlsProcessed: string[];
  }>;
  skippedZones: Array<{ zone: string; zoneId: string; reason: string }>;
  errors: Array<{ scope: string; url?: string; message: string }>;
  mergeConflicts: Array<{ zone: string; importedNpc: string; importedNpcId: string | null; curatedNpcId: string; reason: string }>;
};

const root = process.cwd();
const outputDir = path.join(root, "data", "generated", "zone-loot");
const cacheDir = path.join(root, "cache", "allakhazam-continent-loot");
const baseUrl = "https://everquest.allakhazam.com";
const defaultContinentUrl = "https://everquest.allakhazam.com/db/zone.html?zcont=Odus";
const continentUrl = getArg("continent-url") ?? defaultContinentUrl;
const zoneNameFilter = getArg("zone-name")?.toLowerCase();
const zoneIdFilter = getArg("zone-id");
const zoneLimit = numberArg("zone-limit", 0);
const maxNpcPages = numberArg("max-npc-pages", 20);
const maxNpcs = numberArg("max-npcs", 0);
const requestDelayMs = numberArg("delay-ms", Number(process.env.ZAM_REQUEST_DELAY_MS ?? 1000));
const fetchItemExpansion = !hasFlag("skip-item-expansion");
const userAgent = "LootGoblin/0.1 local Allakhazam continent loot prototype";
const importedAt = new Date().toISOString();
const curatedNpcIndex = await loadCuratedNpcIndex();

const summary: SummaryOutput = {
  continentUrl,
  generatedAt: importedAt,
  zonesDiscovered: [],
  zonesProcessed: [],
  skippedZones: [],
  errors: [],
  mergeConflicts: [],
};

const itemMetadataCache = new Map<string, { expansion: string | null; availability: string | null }>();
let itemPagesFetched = 0;
let skippedExistingNpcCount = 0;

await mkdir(outputDir, { recursive: true });
await mkdir(cacheDir, { recursive: true });

try {
  const continentHtml = await fetchCached(continentUrl, "continent");
  const zones = parseContinentZones(continentHtml);
  summary.zonesDiscovered = zones;

  const selectedZones = selectZones(zones);
  for (const zone of zones) {
    if (!selectedZones.some((selected) => selected.zoneId === zone.zoneId)) {
      summary.skippedZones.push({ zone: zone.name, zoneId: zone.zoneId, reason: "Not selected for this run." });
    }
  }

  for (const zone of selectedZones) {
    try {
      const outputFileName = `${safeSlug(zone.name)}.json`;
      const outputPath = path.join(outputDir, outputFileName);
      const existingOutputPath = findExistingZoneOutputPath(zone);
      if (existingOutputPath) {
        console.log(`Skipping ${zone.name} (already exists)`);
        skippedExistingNpcCount += await readExistingNpcCount(existingOutputPath);
        summary.skippedZones.push({
          zone: zone.name,
          zoneId: zone.zoneId,
          reason: `Already exists: ${path.relative(root, existingOutputPath)}`,
        });
        continue;
      }

      const zoneOutput = await importZone(zone);
      await writeFile(outputPath, `${JSON.stringify(zoneOutput, null, 2)}\n`);
      summary.zonesProcessed.push({
        zone: zoneOutput.zone,
        zoneId: zoneOutput.zoneId,
        outputFile: path.relative(root, outputPath),
        npcCount: zoneOutput.mobs.length,
        dropCount: zoneOutput.mobs.reduce((sum, npc) => sum + npc.drops.length, 0),
        vendorItemCount: zoneOutput.mobs.reduce((sum, npc) => sum + npc.vendorItems.length, 0),
        questItemCount: zoneOutput.mobs.reduce(
          (sum, npc) => sum + npc.questRewards.length + npc.questTurnIns.length + npc.questItems.length,
          0,
        ),
        npcListUrlsProcessed: zoneOutput.npcListUrlsProcessed,
      });
      console.log(`Wrote ${outputPath}`);
    } catch (error) {
      summary.errors.push({
        scope: `zone:${zone.name}`,
        url: zone.url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
} finally {
  const summaryPath = path.join(outputDir, "odus-summary.json");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Wrote ${summaryPath}`);
  const totalNpcs = summary.zonesProcessed.reduce((sum, zone) => sum + zone.npcCount, 0) + skippedExistingNpcCount;
  console.log(`Summary: zones processed=${summary.zonesProcessed.length}, zones skipped=${summary.skippedZones.length}, total NPCs=${totalNpcs}`);
}

process.exit(summary.zonesProcessed.length === 0 && summary.errors.length > 0 ? 1 : 0);

async function importZone(zone: SourceZone): Promise<ZoneOutput> {
  console.log(`Processing ${zone.name}...`);
  const npcListPages = await getNpcListEntries(zone.zoneId);
  const entries = dedupeNpcEntries(npcListPages.entries).slice(0, maxNpcs || undefined);
  const zoneOutput: ZoneOutput = {
    zone: zone.name,
    zoneId: zone.zoneId,
    zoneUrl: zone.url,
    hasAnyNormalLoot: false,
    npcListUrlsProcessed: npcListPages.urlsProcessed,
    mobs: [],
    log: {
      npcListPagesProcessed: npcListPages.urlsProcessed.length,
      npcPagesFetched: 0,
      itemPagesFetched: 0,
      skippedNpcPages: [],
      curatedMatches: [],
      mergeConflicts: [],
      warnings: [...npcListPages.warnings],
    },
  };

  for (const entry of entries) {
    try {
      const html = await fetchCached(entry.url, `npc:${entry.url}`);
      zoneOutput.log.npcPagesFetched += 1;
      const npc = await parseNpcPage(html, entry, zone);
      const curatedMatch = findCuratedNpcMatch(npc.name, zone.name);
      if (curatedMatch) {
        const matchKey = curatedMatchKey(curatedMatch.normalizedName, curatedMatch.normalizedZone);
        npc.matchesCuratedNpc = true;
        npc.curatedNpcId = curatedMatch.id;
        npc.curatedMatchKey = matchKey;
        zoneOutput.log.curatedMatches.push({
          importedNpc: npc.name,
          importedNpcId: npc.sourceNpcId,
          curatedNpcId: curatedMatch.id,
          matchKey,
        });

        for (const reason of getCuratedConflictReasons(npc, curatedMatch)) {
          const conflict = {
            importedNpc: npc.name,
            importedNpcId: npc.sourceNpcId,
            curatedNpcId: curatedMatch.id,
            reason,
          };
          zoneOutput.log.mergeConflicts.push(conflict);
          summary.mergeConflicts.push({ zone: zone.name, ...conflict });
        }
      }
      if (npc.hasNormalLoot) zoneOutput.hasAnyNormalLoot = true;
      zoneOutput.mobs.push(npc);
    } catch (error) {
      zoneOutput.log.skippedNpcPages.push({
        npc: entry.name,
        url: entry.url,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  zoneOutput.log.itemPagesFetched = itemPagesFetched;
  zoneOutput.mobs.sort((a, b) => a.name.localeCompare(b.name));
  return zoneOutput;
}

async function getNpcListEntries(zoneId: string) {
  const entries: NpcListEntry[] = [];
  const urlsProcessed: string[] = [];
  const warnings: string[] = [];
  const seenPageSignatures = new Set<string>();

  for (let page = 1; page <= maxNpcPages; page += 1) {
    const url = npcListUrl(zoneId, page);
    const html = await fetchCached(url, `npclist:${zoneId}:${page}`);
    const pageEntries = parseNpcListPage(html);
    const signature = pageEntries.map((entry) => entry.url).join("|");

    if (page > 1 && (!pageEntries.length || seenPageSignatures.has(signature))) {
      warnings.push(`Stopped NPC pagination at page ${page}; no new NPC rows were found.`);
      break;
    }

    urlsProcessed.push(url);
    entries.push(...pageEntries);
    seenPageSignatures.add(signature);

    const summaryRange = parsePagerSummary(html);
    if (summaryRange && summaryRange.end >= summaryRange.total) break;
    if (!summaryRange && pageEntries.length === 0) break;
  }

  return { entries, urlsProcessed, warnings };
}

function parseContinentZones(html: string): SourceZone[] {
  const zones = new Map<string, SourceZone>();
  const listStart = html.search(/<h1>\s*Zones in/i);
  const listHtml = listStart >= 0 ? html.slice(listStart, html.indexOf("</ul>", listStart) + 5) : html;
  const zonePattern = /<li\b[^>]*>\s*<a\b[^>]*href=["']([^"']*\/db\/zone\.html\?zstrat=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = zonePattern.exec(listHtml)) !== null) {
    const zoneId = match[2];
    const name = inlineText(match[3]);
    const note = inlineText(match[4] ?? "");
    if (!name || zones.has(zoneId)) continue;
    zones.set(zoneId, {
      name,
      zoneId,
      url: absoluteUrl(match[1]),
      note,
    });
  }

  return [...zones.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function selectZones(zones: SourceZone[]) {
  let selected = zones;
  if (zoneIdFilter) selected = selected.filter((zone) => zone.zoneId === zoneIdFilter);
  if (zoneNameFilter) selected = selected.filter((zone) => zone.name.toLowerCase() === zoneNameFilter);
  if (zoneLimit > 0) selected = selected.slice(0, zoneLimit);
  return selected;
}

function parseNpcListPage(html: string): NpcListEntry[] {
  const entries: NpcListEntry[] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[1];
    if (!/\/db\/npc\.html\?id=\d+/i.test(row)) continue;

    const cells = extractCells(row);
    if (cells.length < 6) continue;

    const nameCell = cells[1];
    const linkMatch = nameCell.match(/<a\b[^>]*href=["']([^"']*\/db\/npc\.html\?id=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    entries.push({
      name: decodeHtml(nameCell.match(/standardistatablesortinginnertext=["']([^"']+)["']/i)?.[1] ?? inlineText(linkMatch[2])),
      url: absoluteUrl(linkMatch[1]),
      levelRange: inlineText(cells[2]),
      listedType: inlineText(cells[3]),
      zoneName: inlineText(cells[4]),
      ...parseExpansionCell(cells[5]),
    });
  }

  return entries;
}

function parsePagerSummary(html: string) {
  const text = inlineText(html);
  const match = text.match(/Viewing\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)\s+entries/i);
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  };
}

async function parseNpcPage(html: string, entry: NpcListEntry, zone: SourceZone): Promise<CatalogNpc> {
  const pageName = extractNpcName(html) ?? entry.name;
  const sourceNpcId = npcIdFromUrl(entry.url);
  const pageExpansion = extractPageExpansion(html);
  const availability = extractAvailabilityNote(html) || entry.availability;
  const drops = await hydrateItems(parseKnownLoot(html), "drop");
  const vendorItems = await hydrateItems(parseGoodsSold(html), "vendor");
  const questBuckets = await parseQuestItems(html, entry);
  const npcType = detectNpcType(entry.listedType, html, drops.length, vendorItems.length, questBuckets.totalCount);
  const hasNormalLoot = isNormalLootNpcType(npcType) && drops.length > 0;

  return {
    id: importedNpcId(zone.zoneId, sourceNpcId, pageName),
    name: pageName,
    url: entry.url,
    source: "allakhazam",
    sourceUrl: entry.url,
    sourceNpcId,
    importedAt,
    isCurated: false,
    matchesCuratedNpc: false,
    curatedNpcId: null,
    curatedMatchKey: null,
    npcType,
    expansion: pageExpansion.expansion ?? entry.expansion,
    availability: pageExpansion.availability || availability || null,
    hasNormalLoot,
    levelRange: entry.levelRange,
    listedType: entry.listedType,
    zone: zone.name,
    zoneId: zone.zoneId,
    drops,
    vendorItems,
    questRewards: questBuckets.questRewards,
    questTurnIns: questBuckets.questTurnIns,
    questItems: questBuckets.questItems,
  };
}

function parseKnownLoot(html: string): DroppedItem[] {
  const start = html.search(/Known Loot:/i);
  if (start < 0) return [];

  const endCandidates = [
    html.indexOf('<div class="mobzones"', start),
    html.indexOf('<div class="mobfac', start),
    html.indexOf("<p><a href=\"mailto:", start),
    html.indexOf('<div class="forums"', start),
  ].filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : Math.min(html.length, start + 12000);
  const section = html.slice(start, end);
  const items: DroppedItem[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...section.matchAll(linkPattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextIndex = matches[index + 1]?.index ?? section.length;
    const surrounding = stripTags(section.slice(match.index ?? 0, nextIndex));
    const name = cleanItemName(match[2]);
    if (!name) continue;
    items.push({
      name,
      url: absoluteUrl(match[1]),
      dropRate: surrounding.match(/(\d+(?:\.\d+)?)\s*%/)?.[0] ?? "",
      quantity: surrounding.match(/\b(?:qty|quantity|count)\s*:?\s*([0-9xX -]+)/i)?.[1]?.trim() ?? "",
      notes: cleanLooseNote(surrounding.replace(name, "")),
      expansion: null,
      availability: null,
    });
  }

  return dedupeCatalogItems(items);
}

function parseGoodsSold(html: string): VendorItem[] {
  const items: VendorItem[] = [];
  const goodsPattern = /Goods sold\s*\(\d+\):[\s\S]*?<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let goodsMatch: RegExpExecArray | null;

  while ((goodsMatch = goodsPattern.exec(html)) !== null) {
    const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowPattern.exec(goodsMatch[1])) !== null) {
      const cells = extractCells(rowMatch[1]);
      if (cells.length < 2) continue;
      const linkMatch = cells[0].match(/<a\b[^>]*href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      const name = cleanItemName(linkMatch[2]);
      if (!name) continue;
      const expansionInfo = parseExpansionCell(cells[2] ?? "");
      items.push({
        name,
        url: absoluteUrl(linkMatch[1]),
        price: inlineText(cells[1]),
        expansion: expansionInfo.expansion,
        availability: expansionInfo.availability,
      });
    }
  }

  return dedupeVendorItems(items);
}

async function parseQuestItems(html: string, entry: NpcListEntry) {
  if (!/quest/i.test(entry.listedType)) {
    return { questRewards: [] as CatalogItem[], questTurnIns: [] as CatalogItem[], questItems: [] as CatalogItem[], totalCount: 0 };
  }

  const wikiStart = html.indexOf('<div class="wiki-cont"');
  const wikiEnd = html.indexOf('<div class="moblevel"', wikiStart);
  const wikiHtml = wikiStart >= 0 && wikiEnd > wikiStart ? html.slice(wikiStart, wikiEnd) : "";
  const allWikiItems = parseItemLinks(wikiHtml);
  const questRewards = await hydrateItems(parseLabeledQuestItems(wikiHtml, /reward|receive|give/i), "quest");
  const questTurnIns = await hydrateItems(parseLabeledQuestItems(wikiHtml, /turn.?in|hand.?in|requires|need/i), "quest");
  const knownKeys = new Set([...questRewards, ...questTurnIns].map((item) => item.url));
  const questItems = await hydrateItems(allWikiItems.filter((item) => !knownKeys.has(item.url)), "quest");

  return {
    questRewards,
    questTurnIns,
    questItems,
    totalCount: questRewards.length + questTurnIns.length + questItems.length,
  };
}

function parseLabeledQuestItems(html: string, headingPattern: RegExp): CatalogItem[] {
  const items: CatalogItem[] = [];
  const markerPattern = /<(?:h2|h3|strong|b)\b[^>]*>([\s\S]*?)<\/(?:h2|h3|strong|b)>/gi;
  const markers = [...html.matchAll(markerPattern)];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    if (!headingPattern.test(inlineText(marker[1]))) continue;
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[index + 1]?.index ?? Math.min(html.length, start + 4000);
    items.push(...parseItemLinks(html.slice(start, end)));
  }
  return dedupeCatalogItems(items);
}

function parseItemLinks(html: string): CatalogItem[] {
  const items: CatalogItem[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']*\/db\/item\.html\?item=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const name = cleanItemName(match[2]);
    if (!name) continue;
    items.push({ name, url: absoluteUrl(match[1]), expansion: null, availability: null });
  }
  return dedupeCatalogItems(items);
}

async function hydrateItems<T extends CatalogItem>(items: T[], _kind: "drop" | "vendor" | "quest"): Promise<T[]> {
  if (!fetchItemExpansion) return items;

  for (const item of items) {
    if (item.expansion && item.availability) continue;
    try {
      const metadata = await getItemMetadata(item.url);
      item.expansion = item.expansion ?? metadata.expansion;
      item.availability = item.availability || metadata.availability || null;
    } catch (error) {
      summary.errors.push({
        scope: "item-expansion",
        url: item.url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return items;
}

async function getItemMetadata(url: string) {
  const canonical = canonicalItemUrl(url);
  const cached = itemMetadataCache.get(canonical);
  if (cached) return cached;

  const html = await fetchCached(canonical, `item:${canonical}`);
  itemPagesFetched += 1;
  const metadata = extractPageExpansion(html);
  itemMetadataCache.set(canonical, metadata);
  return metadata;
}

function extractNpcName(html: string) {
  const h1 = html.match(/<div class=["']mobDisplay["'][\s\S]*?<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (!h1) return null;
  return inlineText(h1.replace(/<div class=["']post-share[\s\S]*$/i, "")).replace(/\[\s+/g, "[").replace(/\s+\]/g, "]");
}

function detectNpcType(listedType: string, html: string, dropCount: number, vendorCount: number, questItemCount: number): NpcType {
  const typeText = `${listedType} ${inlineText(html.match(/<div class=["']mobtype["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")}`.toLowerCase();
  const isVendor = /merchant|vendor/.test(typeText) || vendorCount > 0;
  const isQuest = /quest/.test(typeText) || questItemCount > 0;
  const isMob = dropCount > 0 || (!isVendor && !isQuest && !/guildmaster/.test(typeText));

  if (isMob && isVendor) return "mob_vendor";
  if (isVendor) return "vendor";
  if (isQuest) return "quest";
  if (isMob) return "mob";
  return "unknown";
}

function isNormalLootNpcType(npcType: NpcType) {
  return npcType === "mob" || npcType === "mob_vendor";
}

async function loadCuratedNpcIndex() {
  const datasetFiles = ["classic-group-named.json", "kunark-group-named.json", "velious-group-named.json"];
  const index = new Map<string, CuratedNpcIndexEntry>();

  for (const datasetFile of datasetFiles) {
    const datasetPath = path.join(root, "data", datasetFile);
    if (!existsSync(datasetPath)) continue;

    const dataset = JSON.parse(await readFile(datasetPath, "utf8")) as {
      metadata?: { expansion?: string };
      buckets?: Array<{
        bucket?: number | string;
        level_range?: string;
        mobs?: Array<{ name?: string; zone?: string; level?: number; expansion?: string }>;
      }>;
    };
    const datasetExpansion = dataset.metadata?.expansion ?? expansionFromDatasetFile(datasetFile);

    for (const bucket of dataset.buckets ?? []) {
      for (const mob of bucket.mobs ?? []) {
        if (!mob.name || !mob.zone) continue;
        const normalizedName = normalizeKey(mob.name);
        const normalizedZone = normalizeKey(mob.zone);
        const entry: CuratedNpcIndexEntry = {
          id: `curated:${normalizeKey(datasetExpansion)}:${normalizedZone}:${normalizedName}`,
          name: mob.name,
          normalizedName,
          zone: mob.zone,
          normalizedZone,
          expansion: mob.expansion ?? datasetExpansion,
          level: typeof mob.level === "number" ? mob.level : null,
          datasetPath: path.relative(root, datasetPath),
          bucket: bucket.bucket ?? null,
          levelRange: bucket.level_range ?? null,
          tags: ["rare", "named", "randomLoot", "curated"],
        };
        index.set(curatedMatchKey(normalizedName, normalizedZone), entry);
      }
    }
  }

  return index;
}

function findCuratedNpcMatch(importedName: string, zoneName: string) {
  return curatedNpcIndex.get(curatedMatchKey(normalizeKey(importedName), normalizeKey(zoneName))) ?? null;
}

function getCuratedConflictReasons(importedNpc: CatalogNpc, curatedNpc: CuratedNpcIndexEntry) {
  const reasons: string[] = [];
  if (importedNpc.expansion && curatedNpc.expansion && normalizeKey(importedNpc.expansion) !== normalizeKey(curatedNpc.expansion)) {
    reasons.push(`Expansion differs: imported=${importedNpc.expansion}, curated=${curatedNpc.expansion}.`);
  }
  if (importedNpc.levelRange && curatedNpc.level !== null && !levelRangeContains(importedNpc.levelRange, curatedNpc.level)) {
    reasons.push(`Level differs: imported range=${importedNpc.levelRange}, curated level=${curatedNpc.level}.`);
  }
  if (importedNpc.drops.length > 0) {
    reasons.push("Imported normal loot exists for a curated random-loot NPC; keep imported data supplemental only.");
  }
  return reasons;
}

function curatedMatchKey(normalizedName: string, normalizedZone: string) {
  return `${normalizedZone}\u0000${normalizedName}`;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expansionFromDatasetFile(datasetFile: string) {
  if (datasetFile.startsWith("kunark")) return "Kunark";
  if (datasetFile.startsWith("velious")) return "Velious";
  return "Classic";
}

function importedNpcId(zoneId: string, sourceNpcId: string | null, name: string) {
  return `allakhazam:${zoneId}:${sourceNpcId ?? safeSlug(name)}`;
}

function findExistingZoneOutputPath(zone: SourceZone) {
  const candidates = [
    path.join(outputDir, `${safeSlug(zone.name)}.json`),
    path.join(outputDir, `${zone.zoneId}.json`),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function readExistingNpcCount(filePath: string) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as { mobs?: unknown[] };
    return Array.isArray(parsed.mobs) ? parsed.mobs.length : 0;
  } catch (error) {
    summary.errors.push({
      scope: `existing-zone:${path.basename(filePath)}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

function npcIdFromUrl(url: string) {
  return new URL(url).searchParams.get("id");
}

function levelRangeContains(range: string, level: number) {
  const numbers = range.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return true;
  if (numbers.length === 1) return level === numbers[0];
  return level >= numbers[0] && level <= numbers[1];
}

function extractPageExpansion(html: string) {
  const titleMatch = html.match(/<strong\b([^>]*)>\s*Expansion:?\s*<\/strong>\s*:?\s*([\s\S]{0,400})/i);
  const attrs = titleMatch?.[1] ?? "";
  const block = titleMatch?.[2] ?? "";
  const title = attrs.match(/title=["']([^"']+)["']/i)?.[1] ?? "";
  const alt = block.match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1] ?? "";
  const text = inlineText(block);
  const rawExpansion = alt || text.match(/\b(Original|Ruins of Kunark|Scars of Velious|Planes of Power|Shadows of Luclin|Legacy of Ykesha|Lost Dungeons of Norrath)\b/i)?.[1] || "";
  return {
    expansion: normalizeExpansion(rawExpansion),
    availability: title ? normalizeAvailability(title) : extractAvailabilityNote(html),
  };
}

function parseExpansionCell(cellHtml: string): { expansion: string | null; availability: string | null } {
  const title = cellHtml.match(/title=["']([^"']+)["']/i)?.[1] ?? "";
  const alt = cellHtml.match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1] ?? "";
  const text = inlineText(cellHtml);
  const rawExpansion = alt || text;
  return {
    expansion: normalizeExpansion(rawExpansion),
    availability: title ? normalizeAvailability(title) : null,
  };
}

function normalizeExpansion(value: string) {
  const clean = inlineText(value);
  if (!clean) return null;
  const lower = clean.toLowerCase();
  if (lower.includes("original")) return "Classic";
  if (lower.includes("kunark")) return "Kunark";
  if (lower.includes("velious")) return "Velious";
  return clean;
}

function normalizeAvailability(value: string) {
  const clean = decodeHtml(value).replace(/\s+/g, " ").trim();
  return clean || null;
}

function extractAvailabilityNote(html: string) {
  return normalizeAvailability(inlineText(html.match(/Available on progression servers[^<.]*\./i)?.[0] ?? ""));
}

function extractCells(rowHtml: string) {
  const cells: string[] = [];
  const cellPattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellPattern.exec(rowHtml)) !== null) cells.push(match[1]);
  return cells;
}

function dedupeNpcEntries(entries: NpcListEntry[]) {
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}

function dedupeCatalogItems<T extends CatalogItem>(items: T[]): T[] {
  return [...new Map(items.filter((item) => item.name && item.url).map((item) => [item.url, item])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
}

function dedupeVendorItems(items: VendorItem[]): VendorItem[] {
  return [
    ...new Map(
      items
        .filter((item) => item.name && item.url)
        .map((item) => [`${item.name.toLowerCase()}\u0000${item.price.toLowerCase()}`, item]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.price.localeCompare(b.price));
}

function cleanItemName(html: string) {
  return inlineText(html).replace(/^icon\s*/i, "").trim();
}

function cleanLooseNote(value: string) {
  return value
    .replace(/Known Loot:/i, "")
    .replace(/\d+(?:\.\d+)?\s*%/g, "")
    .replace(/\b(?:qty|quantity|count)\s*:?\s*[0-9xX -]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCached(url: string, label: string) {
  const filePath = path.join(cacheDir, `${safeSlug(label)}-${sha1(url)}.html`);
  if (existsSync(filePath)) return readFile(filePath, "utf8");

  await sleep(requestDelayMs);
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const html = await response.text();
  await writeFile(filePath, html);
  return html;
}

function npcListUrl(zoneId: string, page: number) {
  const url = new URL("/db/npclist.html", baseUrl);
  url.searchParams.set("zone", zoneId);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}

function canonicalItemUrl(url: string) {
  const parsed = new URL(url, baseUrl);
  const itemId = parsed.searchParams.get("item");
  return itemId ? `${baseUrl}/db/item.html?item=${itemId}` : parsed.toString();
}

function absoluteUrl(url: string) {
  return new URL(decodeHtml(url), baseUrl).toString();
}

function inlineText(value: string) {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function stripTags(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|td|li|h1|h2|h3|strong|table)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
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

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function sha1(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function numberArg(name: string, fallback: number) {
  const raw = getArg(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
