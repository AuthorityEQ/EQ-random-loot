/**
 * GET /api/discord/payload
 *
 * Returns a Discord-ready JSON payload (suitable for POST to a Discord
 * webhook URL) for the requested entity type and id.
 *
 * Query params:
 *   type — "item" | "mob" | "bucket"
 *   id   — URL slug of the entity
 *
 * Examples:
 *   GET /api/discord/payload?type=item&id=cloak-of-flames
 *   GET /api/discord/payload?type=mob&id=lord-nagafen
 *   GET /api/discord/payload?type=bucket&id=classic-9
 *
 * The response shape mirrors a Discord webhook execute payload:
 *   { content: string, embeds: DiscordEmbed[] }
 *
 * Third-party tools (bots, scripts) can fetch this endpoint and forward
 * the response body directly to a Discord webhook without implementing
 * any formatting logic themselves.
 */

export const revalidate = 86400;

import itemDetailsData from "@/data/item-details.json";
import classicData from "@/data/classic-group-named.json";
import kunarkData from "@/data/kunark-group-named.json";
import veliousData from "@/data/velious-group-named.json";
import type { ItemDetailsMap, LootDataset } from "@/lib/search";
import { buildItemSlugMap } from "@/lib/item-slug";
import { mobToSlug } from "@/lib/mob-slug";
import { jsonBadRequest, jsonNotFound, corsOptions, strParam } from "@/lib/api-helpers";

const FOOTER_TEXT = "loot-goblin";

function resolveBaseUrl(request: Request): string {
  // Prefer the actual request origin so the URL matches whatever host the
  // request came in on (Vercel preview, prod custom domain, localhost).
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

/** Discord embed colour — EQ green */
const EMBED_COLOR = 0x2d6a4f;

// ---------------------------------------------------------------------------
// Type definitions (Discord webhook payload subset)
// ---------------------------------------------------------------------------

type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title: string;
  url: string;
  description: string;
  color: number;
  fields: DiscordField[];
  thumbnail?: { url: string };
  footer?: { text: string };
};

type DiscordPayload = {
  content: string;
  embeds: DiscordEmbed[];
};

// ---------------------------------------------------------------------------
// Data setup — loaded once at module level
// ---------------------------------------------------------------------------

const itemDetails = itemDetailsData as ItemDetailsMap;
const allDatasets = [classicData, kunarkData, veliousData] as LootDataset[];

const { slugToName, nameToSlug } = buildItemSlugMap(itemDetails);

// Flat list of all buckets across all datasets
const allBuckets = allDatasets.flatMap((ds) =>
  ds.buckets.map((b) => ({ ...b, datasetExpansion: ds.metadata.expansion })),
);

// Flat mob list with parent-bucket context
const allMobsWithContext = allDatasets.flatMap((ds) =>
  ds.buckets.flatMap((bucket) =>
    bucket.mobs.map((mob) => ({ mob, bucket })),
  ),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function itemUrl(baseUrl: string, slug: string): string {
  return `${baseUrl}/item/${slug}`;
}

function mobUrl(baseUrl: string, slug: string): string {
  return `${baseUrl}/mob/${slug}`;
}

function bucketUrl(baseUrl: string, expansion: string, bucketNumber: number): string {
  const expSlug = expansion.toLowerCase();
  return `${baseUrl}/buckets/${expSlug}-${bucketNumber}`;
}

/** Trim an array to `max` entries and append a "…and N more" note. */
function truncateList(items: string[], max: number): string {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} … and ${items.length - max} more`;
}

/** Return the item's best thumbnail URL from its iconPath/icon URL, or undefined. */
function itemThumbnail(baseUrl: string, details: ItemDetailsMap[string] | undefined): string | undefined {
  const iconUrl = details?.iconPath ?? details?.icon ?? details?.icon_url;
  if (!iconUrl) return undefined;
  // iconPath is relative like "/icons/foo.png"; make it absolute.
  if (iconUrl.startsWith("http")) return iconUrl;
  return `${baseUrl}${iconUrl}`;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function buildItemPayload(baseUrl: string, slug: string): DiscordPayload | null {
  const itemName = slugToName.get(slug);
  if (!itemName) return null;

  const details = itemDetails[itemName];
  if (!details) return null;

  const pageUrl = itemUrl(baseUrl, slug);

  // Collect the buckets this item appears in
  const buckets = allBuckets.filter((b) => b.loot_pool.includes(itemName));

  // Drop locations — unique zones across all containing buckets
  const dropZones = Array.from(
    new Set(buckets.flatMap((b) => b.mobs.filter((m) => m.loot.includes(itemName)).map((m) => m.zone))),
  );

  // Fallback to bucket zones if no mob-specific zone data
  const locationList =
    dropZones.length > 0
      ? dropZones
      : Array.from(new Set(buckets.flatMap((b) => b.zones)));

  const bucketLabels = buckets
    .map((b) => `${b.expansion} Bucket ${b.bucket} (${b.level_range})`)
    .join(", ");

  const fields: DiscordField[] = [];

  if (details.slot) {
    fields.push({ name: "Slot", value: details.slot, inline: true });
  }
  if (details.ac !== null && details.ac !== undefined) {
    fields.push({ name: "AC", value: String(details.ac), inline: true });
  }
  if (details.damage !== null && details.damage !== undefined && details.delay !== null && details.delay !== undefined) {
    fields.push({ name: "Dmg/Dly", value: `${details.damage}/${details.delay}`, inline: true });
  }
  if (details.classes.length > 0) {
    fields.push({ name: "Classes", value: truncateList(details.classes, 6), inline: false });
  }
  if (locationList.length > 0) {
    fields.push({ name: "Drop Locations", value: truncateList(locationList, 5), inline: false });
  }
  if (bucketLabels) {
    fields.push({ name: "Loot Bucket", value: bucketLabels, inline: false });
  }

  const statBits: string[] = [];
  if (details.stats) {
    for (const [k, v] of Object.entries(details.stats)) {
      if (v !== 0 && v !== null && v !== undefined) {
        statBits.push(`${k} ${v}`);
      }
    }
  }
  const statLine = statBits.length > 0 ? statBits.slice(0, 6).join(" | ") : "";

  const descParts: string[] = [];
  if (details.magic) descParts.push("Magic");
  if (details.lore) descParts.push("Lore");
  if (details.no_drop) descParts.push("No Drop");
  if (details.required_level) descParts.push(`Req Level: ${details.required_level}`);
  if (statLine) descParts.push(statLine);

  const description = descParts.length > 0 ? descParts.join(" · ") : "Classic EQ loot item";

  const embed: DiscordEmbed = {
    title: itemName,
    url: pageUrl,
    description,
    color: EMBED_COLOR,
    fields,
    footer: { text: FOOTER_TEXT },
  };

  const thumb = itemThumbnail(baseUrl, details as Parameters<typeof itemThumbnail>[1]);
  if (thumb) {
    embed.thumbnail = { url: thumb };
  }

  const content = `**${itemName}** — [View on Loot Goblin](${pageUrl})`;

  return { content, embeds: [embed] };
}

function buildMobPayload(baseUrl: string, slug: string): DiscordPayload | null {
  // Find the mob by base slug match
  const match = allMobsWithContext.find(({ mob }) => mobToSlug(mob.name) === slug);
  if (!match) return null;

  const { mob, bucket } = match;
  const mobSlug = mobToSlug(mob.name);
  const pageUrl = mobUrl(baseUrl, mobSlug);

  const lootSample = bucket.loot_pool.slice(0, 8).map((name) => {
    const s = nameToSlug.get(name);
    return s ? `[${name}](${itemUrl(baseUrl, s)})` : name;
  });

  const fields: DiscordField[] = [
    { name: "Zone", value: mob.zone, inline: true },
    { name: "Level", value: String(mob.level), inline: true },
    { name: "Expansion", value: mob.expansion, inline: true },
    { name: "Bucket", value: `${bucket.bucket} (${bucket.level_range})`, inline: true },
    { name: "Loot Pool (sample)", value: truncateList(lootSample, 8), inline: false },
  ];

  const embed: DiscordEmbed = {
    title: mob.name,
    url: pageUrl,
    description: `Named mob in ${mob.zone} — drops from Bucket ${bucket.bucket} (${bucket.level_range})`,
    color: EMBED_COLOR,
    fields,
    footer: { text: FOOTER_TEXT },
  };

  const content = `**${mob.name}** — [View on Loot Goblin](${pageUrl})`;

  return { content, embeds: [embed] };
}

function buildBucketPayload(baseUrl: string, id: string): DiscordPayload | null {
  // id format: "classic-9" | "kunark-3" | "velious-13"
  const parts = id.match(/^(classic|kunark|velious)-(\d+)$/i);
  if (!parts) return null;

  const expansion = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
  const bucketNumber = Number.parseInt(parts[2], 10);

  const bucket = allBuckets.find(
    (b) =>
      b.expansion.toLowerCase() === expansion.toLowerCase() &&
      b.bucket === bucketNumber,
  );
  if (!bucket) return null;

  const pageUrl = bucketUrl(baseUrl, expansion, bucketNumber);

  const topZones = Array.from(
    new Map(
      bucket.mobs.map((m) => [m.zone, (bucket.mobs.filter((x) => x.zone === m.zone).length)]),
    ).entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zone, count]) => `${zone} (${count} mobs)`);

  const lootSample = bucket.loot_pool.slice(0, 6).map((name) => {
    const s = nameToSlug.get(name);
    return s ? `[${name}](${itemUrl(baseUrl, s)})` : name;
  });

  const fields: DiscordField[] = [
    { name: "Level Range", value: bucket.level_range, inline: true },
    { name: "Expansion", value: bucket.expansion, inline: true },
    { name: "Mob Count", value: String(bucket.mob_count ?? bucket.mobs.length), inline: true },
    { name: "Loot Pool Size", value: String(bucket.loot_count ?? bucket.loot_pool.length), inline: true },
  ];

  if (topZones.length > 0) {
    fields.push({ name: "Top Farm Zones", value: topZones.join("\n"), inline: false });
  }
  if (lootSample.length > 0) {
    fields.push({ name: "Sample Loot", value: truncateList(lootSample, 6), inline: false });
  }

  const embed: DiscordEmbed = {
    title: `${expansion} Bucket ${bucketNumber} (${bucket.level_range})`,
    url: pageUrl,
    description: `${bucket.expansion} group-named loot bucket for levels ${bucket.level_range}. ${bucket.mobs.length} named mobs across ${bucket.zones.length} zones.`,
    color: EMBED_COLOR,
    fields,
    footer: { text: FOOTER_TEXT },
  };

  const content = `**${expansion} Bucket ${bucketNumber}** (${bucket.level_range}) — [View on Loot Goblin](${pageUrl})`;

  return { content, embeds: [embed] };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = strParam(url, "type");
  const id   = url.searchParams.get("id")?.trim() ?? null;

  if (!type) {
    return jsonBadRequest('Missing required param "type". Valid values: item, mob, bucket');
  }
  if (!id) {
    return jsonBadRequest('Missing required param "id". Provide a URL slug, e.g. id=cloak-of-flames');
  }

  const validTypes = ["item", "mob", "bucket"];
  if (!validTypes.includes(type)) {
    return jsonBadRequest(`Unknown type "${type}". Valid values: ${validTypes.join(", ")}`);
  }

  const baseUrl = resolveBaseUrl(request);

  let payload: DiscordPayload | null = null;

  if (type === "item") {
    payload = buildItemPayload(baseUrl, id);
  } else if (type === "mob") {
    payload = buildMobPayload(baseUrl, id);
  } else if (type === "bucket") {
    payload = buildBucketPayload(baseUrl, id);
  }

  if (!payload) {
    return jsonNotFound(`No ${type} found for id "${id}"`);
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
