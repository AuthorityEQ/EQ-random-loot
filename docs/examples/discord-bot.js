/**
 * Frostreaver Loot Buckets — Discord Bot (Node.js)
 *
 * Listens for "!loot <item name>" commands and responds with a rich embed
 * pulled from the Frostreaver payload API.
 *
 * Requirements:
 *   npm install discord.js node-fetch dotenv
 *   Node.js 18+ (native fetch available; node-fetch is an optional polyfill)
 *
 * Environment variables (store in .env, never commit):
 *   DISCORD_BOT_TOKEN    — your Discord application bot token
 *   DISCORD_WEBHOOK_URL  — optional: webhook URL for push-style posts
 *   FROSTREAVER_BASE_URL — defaults to https://frostreaver-loot-buckets.app
 *
 * Usage:
 *   node discord-bot.js
 */

import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
} from "discord.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BOT_TOKEN  = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? null;
const BASE_URL   = process.env.FROSTREAVER_BASE_URL ?? "https://frostreaver-loot-buckets.app";
const PAYLOAD_ENDPOINT = `${BASE_URL}/api/discord/payload`;

if (!BOT_TOKEN) {
  console.error("Error: DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

/**
 * Convert an item/mob name to a URL-safe kebab-case slug.
 * Mirrors itemToSlug() in lib/item-slug.ts.
 *
 * @param {string} name
 * @returns {string}
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a Discord webhook payload from the Frostreaver API.
 *
 * @param {"item"|"mob"|"bucket"} type
 * @param {string} id  URL slug
 * @returns {Promise<object|null>} payload JSON, or null when not found
 */
async function fetchPayload(type, id) {
  const url = new URL(PAYLOAD_ENDPOINT);
  url.searchParams.set("type", type);
  url.searchParams.set("id", id);

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "frostreaver-discord-bot/1.0" },
    signal: AbortSignal.timeout(8000),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Frostreaver API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * POST a Discord payload JSON object to the configured webhook URL.
 *
 * @param {object} payload
 * @returns {Promise<void>}
 */
async function postToWebhook(payload) {
  if (!WEBHOOK_URL) throw new Error("DISCORD_WEBHOOK_URL is not set");

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook error: ${response.status} ${response.statusText}`);
  }
}

// ---------------------------------------------------------------------------
// Embed builder helper
// ---------------------------------------------------------------------------

/**
 * Convert a raw Frostreaver embed object into a discord.js EmbedBuilder.
 *
 * @param {object} rawEmbed
 * @returns {EmbedBuilder}
 */
function buildEmbed(rawEmbed) {
  const embed = new EmbedBuilder()
    .setTitle(rawEmbed.title)
    .setURL(rawEmbed.url ?? null)
    .setDescription(rawEmbed.description ?? null)
    .setColor(rawEmbed.color ?? 0x2D6A4F);

  for (const field of rawEmbed.fields ?? []) {
    embed.addFields({ name: field.name, value: field.value, inline: field.inline ?? false });
  }

  if (rawEmbed.thumbnail?.url) {
    embed.setThumbnail(rawEmbed.thumbnail.url);
  }

  if (rawEmbed.footer?.text) {
    embed.setFooter({ text: rawEmbed.footer.text });
  }

  return embed;
}

// ---------------------------------------------------------------------------
// Bot setup
// ---------------------------------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Frostreaver payload endpoint: ${PAYLOAD_ENDPOINT}`);
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  const content = message.content.trim();

  // ---- !loot <item name> ------------------------------------------------
  const lootMatch = content.match(/^!loot\s+(.+)/i);
  if (lootMatch) {
    const itemName = lootMatch[1].trim();
    const slug = nameToSlug(itemName);
    console.log(`[loot] name="${itemName}" slug="${slug}"`);

    try {
      const payload = await fetchPayload("item", slug);
      if (!payload) {
        await message.reply(
          `Item **${itemName}** not found. Check spelling or browse at ${BASE_URL}`
        );
        return;
      }
      const embed = buildEmbed(payload.embeds[0]);
      await message.reply({ content: payload.content ?? "", embeds: [embed] });
    } catch (err) {
      console.error("[loot] error:", err);
      await message.reply("Frostreaver API error. Try again shortly.");
    }
    return;
  }

  // ---- !mob <mob name> --------------------------------------------------
  const mobMatch = content.match(/^!mob\s+(.+)/i);
  if (mobMatch) {
    const mobName = mobMatch[1].trim();
    const slug = nameToSlug(mobName);
    console.log(`[mob] name="${mobName}" slug="${slug}"`);

    try {
      const payload = await fetchPayload("mob", slug);
      if (!payload) {
        await message.reply(
          `Mob **${mobName}** not found. Browse mobs at ${BASE_URL}`
        );
        return;
      }
      const embed = buildEmbed(payload.embeds[0]);
      await message.reply({ content: payload.content ?? "", embeds: [embed] });
    } catch (err) {
      console.error("[mob] error:", err);
      await message.reply("Frostreaver API error. Try again shortly.");
    }
    return;
  }

  // ---- !bucket <expansion> <number> ------------------------------------
  const bucketMatch = content.match(/^!bucket\s+(classic|kunark|velious)\s+(\d+)/i);
  if (bucketMatch) {
    const expansion = bucketMatch[1].toLowerCase();
    const bucketNumber = bucketMatch[2];
    const slug = `${expansion}-${bucketNumber}`;
    console.log(`[bucket] slug="${slug}"`);

    try {
      const payload = await fetchPayload("bucket", slug);
      if (!payload) {
        await message.reply(
          `Bucket **${expansion} ${bucketNumber}** not found. Valid expansions: classic, kunark, velious.`
        );
        return;
      }
      const embed = buildEmbed(payload.embeds[0]);
      await message.reply({ content: payload.content ?? "", embeds: [embed] });
    } catch (err) {
      console.error("[bucket] error:", err);
      await message.reply("Frostreaver API error. Try again shortly.");
    }
    return;
  }
});

// ---------------------------------------------------------------------------
// Standalone webhook push utility (no bot needed)
// ---------------------------------------------------------------------------

/**
 * Push an item embed to the configured webhook without running the bot.
 * Import this function from another script for one-shot posts.
 *
 * @param {string} itemName  Human-readable item name
 * @returns {Promise<void>}
 *
 * @example
 * // From a script:
 * import { pushItemToWebhook } from "./discord-bot.js";
 * await pushItemToWebhook("Cloak of Flames");
 */
export async function pushItemToWebhook(itemName) {
  const slug = nameToSlug(itemName);
  const payload = await fetchPayload("item", slug);
  if (!payload) throw new Error(`Item not found: ${itemName} (slug=${slug})`);
  await postToWebhook(payload);
  console.log(`Pushed "${itemName}" to webhook`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

client.login(BOT_TOKEN);
