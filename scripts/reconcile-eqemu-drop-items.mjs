import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const dataDir = resolve("data");
const itemDetailsPath = resolve("data/item-details.json");
const reportPath = resolve("data/eqemu-item-reconciliation-report.json");
const realSpawnIndexPath = resolve("data/eqemu-real-spawn-zone-summaries.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
}

function compactDetails(details) {
  if (!details) return null;
  return {
    itemId: details.itemId ?? null,
    slot: details.slot ?? null,
    item_type: details.item_type ?? details.itemType ?? null,
    iconPath: details.iconPath ?? details.icon_url ?? details.icon ?? null,
    expansion: details.expansion ?? null,
    classes: details.classes ?? [],
    races: details.races ?? [],
    stats: details.stats ?? {},
    resists: details.resists ?? {},
    lore: details.lore ?? null,
    magic: details.magic ?? null,
    no_drop: details.no_drop ?? null,
  };
}

function eqemuCompact(item) {
  const raw = item.itemDetails ?? {};
  return {
    itemId: item.itemId ?? raw.id ?? null,
    slotBitmask: raw.slots ?? null,
    itemtype: raw.itemtype ?? null,
    icon: raw.icon ?? item.itemIcon ?? null,
    classesBitmask: raw.classes ?? null,
    racesBitmask: raw.races ?? null,
    magic: raw.magic ?? null,
    nodrop: raw.nodrop ?? null,
    lore: raw.lore ?? null,
  };
}

function valuesDiffer(a, b) {
  if (!hasValue(a) || !hasValue(b)) return false;
  return String(a).trim().toLowerCase() !== String(b).trim().toLowerCase();
}

function displayNameFor(details, fallback = "") {
  return String(details?.name ?? fallback);
}

function namesCompatible(a, b) {
  const normalizedA = normalizeName(a);
  const normalizedB = normalizeName(b);
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

function findSafeMatch(item, itemName) {
  const idMatch = byItemId.get(String(item.itemId));
  if (idMatch) {
    if (namesCompatible(displayNameFor(idMatch.details, idMatch.name), itemName)) {
      return {
        match: idMatch,
        matchMethod: "item-id-and-name",
        rejectedIdMatch: null,
      };
    }
    return {
      match: null,
      matchMethod: null,
      rejectedIdMatch: {
        existingItemName: displayNameFor(idMatch.details, idMatch.name),
        existingItemId: idMatch.details.itemId ?? null,
        reason: "Item ID matched, but names are incompatible. Existing imported IDs and EQEmu IDs are not assumed to share a namespace.",
      },
    };
  }

  const normalized = normalizeName(itemName);
  const nameMatch = byNormalizedName.get(normalized);
  if (nameMatch && namesCompatible(displayNameFor(nameMatch.details, nameMatch.name), itemName)) {
    return {
      match: nameMatch,
      matchMethod: "normalized-name",
      rejectedIdMatch: null,
    };
  }

  return { match: null, matchMethod: null, rejectedIdMatch: null };
}

const itemDetails = readJson(itemDetailsPath);
const allowedShortNames = new Set(
  existsSync(realSpawnIndexPath)
    ? readJson(realSpawnIndexPath).map((summary) => summary.zoneShortName ?? summary.routeSlug).filter(Boolean)
    : [],
);
const byNormalizedName = new Map();
const byItemId = new Map();
for (const [name, details] of Object.entries(itemDetails)) {
  const normalized = normalizeName(name);
  if (normalized && !byNormalizedName.has(normalized)) byNormalizedName.set(normalized, { name, details });
  if (hasValue(details.itemId)) byItemId.set(String(details.itemId), { name, details });
}

const matchedItems = [];
const rejectedMatches = [];
const lowConfidenceMatches = [];
const fuzzyMatchesUsed = [];
const unmatchedItems = new Map();
const itemTypeMismatches = [];
const slotMismatches = [];
const expansionMismatches = [];
const iconMismatches = [];
const seenMatched = new Set();

for (const file of readdirSync(dataDir).filter((name) => /^eqemu-.+-loot-test\.json$/i.test(name))) {
  const shortName = file.match(/^eqemu-(.+)-loot-test\.json$/i)?.[1];
  if (allowedShortNames.size && (!shortName || !allowedShortNames.has(shortName))) continue;
  const loot = readJson(resolve(dataDir, file));
  for (const mob of loot.mobs ?? []) {
    for (const lootdrop of mob.lootdrops ?? []) {
      for (const item of lootdrop.items ?? []) {
        const itemName = item.itemName ?? `Item ${item.itemId}`;
        const { match, matchMethod, rejectedIdMatch } = findSafeMatch(item, itemName);
        const eqemu = eqemuCompact(item);

        if (!match) {
          if (rejectedIdMatch) {
            rejectedMatches.push({
              zoneShortName: loot.zoneShortName ?? null,
              eqemuItemId: item.itemId,
              eqemuItemName: itemName,
              eqemu,
              rejected: rejectedIdMatch,
            });
          }
          const existing = unmatchedItems.get(item.itemId) ?? {
            itemId: item.itemId,
            itemName,
            zones: new Set(),
            eqemu,
            reason: rejectedIdMatch
              ? "Rejected unsafe itemId match; falling back to local EQEmu item data."
              : "No existing item record matched by exact normalized name.",
          };
          existing.zones.add(loot.zoneShortName ?? file);
          unmatchedItems.set(item.itemId, existing);
          continue;
        }

        const matchKey = `${item.itemId}-${match.name}-${file}`;
        if (!seenMatched.has(matchKey)) {
          matchedItems.push({
            zoneShortName: loot.zoneShortName ?? null,
            eqemuItemId: item.itemId,
            eqemuItemName: itemName,
            existingItemName: match.name,
            matchMethod,
            existing: compactDetails(match.details),
            eqemu,
          });
          seenMatched.add(matchKey);
        }

        const existingType = match.details.item_type ?? match.details.itemType;
        if (valuesDiffer(existingType, eqemu.itemtype)) {
          itemTypeMismatches.push({
            zoneShortName: loot.zoneShortName ?? null,
            itemName,
            existingItemName: match.name,
            existingItemType: existingType ?? null,
            eqemuItemTypeValue: eqemu.itemtype,
          });
        }
        if (valuesDiffer(match.details.slot, eqemu.slotBitmask)) {
          slotMismatches.push({
            zoneShortName: loot.zoneShortName ?? null,
            itemName,
            existingItemName: match.name,
            existingSlot: match.details.slot ?? null,
            eqemuSlotBitmask: eqemu.slotBitmask,
          });
        }
        if (valuesDiffer(match.details.expansion, "Local EQEmu DB")) {
          expansionMismatches.push({
            zoneShortName: loot.zoneShortName ?? null,
            itemName,
            existingItemName: match.name,
            existingExpansion: match.details.expansion ?? null,
            eqemuSource: "Local EQEmu DB",
          });
        }
        const existingIcon = match.details.iconPath ?? match.details.icon_url ?? match.details.icon;
        const eqemuIcon = eqemu.icon ? `https://wiki.project1999.com/images/Item_${eqemu.icon}.png` : null;
        if (valuesDiffer(existingIcon, eqemuIcon)) {
          iconMismatches.push({
            zoneShortName: loot.zoneShortName ?? null,
            itemName,
            existingItemName: match.name,
            existingIcon: existingIcon ?? null,
            eqemuIcon,
          });
        }
      }
    }
  }
}

const unmatched = Array.from(unmatchedItems.values()).map((item) => ({
  ...item,
  zones: Array.from(item.zones).sort(),
}));

const report = {
  source: "EQEmu drop items reconciled against existing site item details",
  generatedAt: new Date().toISOString(),
  matchingRules: [
    "Prefer itemId only when the existing item name is also an exact normalized match.",
    "Fallback to exact normalized name matching.",
    "No loose fuzzy matches are auto-applied by this report.",
    "Rejected itemId-only collisions fall back to local EQEmu item data.",
  ],
  matchedItemCount: matchedItems.length,
  acceptedMatchCount: matchedItems.length,
  rejectedMatchCount: rejectedMatches.length,
  lowConfidenceMatchCount: lowConfidenceMatches.length,
  fuzzyMatchCount: fuzzyMatchesUsed.length,
  unmatchedItemCount: unmatched.length,
  itemTypeMismatchCount: itemTypeMismatches.length,
  slotMismatchCount: slotMismatches.length,
  expansionMismatchCount: expansionMismatches.length,
  iconMismatchCount: iconMismatches.length,
  matchedItems,
  acceptedMatches: matchedItems,
  rejectedMatches,
  lowConfidenceMatches,
  fuzzyMatchesUsed,
  unmatchedItems: unmatched,
  itemTypeMismatches,
  slotMismatches,
  expansionMismatches,
  iconMismatches,
  notes: [
    "The UI should prefer existing item records only when a safe exact name-compatible match exists.",
    "EQEmu-only items keep drop/source context, but low-confidence numeric enum labels should be hidden rather than over-stated.",
    "Crushbone Battle Beads is currently EQEmu-only in the local item detail set, so the UI suppresses its questionable itemtype=17 label.",
    "Rusty Short Sword is expected to reject unrelated imported itemId collisions such as Dazzling Trousers.",
  ],
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  report: reportPath,
  matchedItemCount: report.matchedItemCount,
  unmatchedItemCount: report.unmatchedItemCount,
  itemTypeMismatchCount: report.itemTypeMismatchCount,
  slotMismatchCount: report.slotMismatchCount,
}, null, 2));
