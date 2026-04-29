"""
Frostreaver Loot Buckets — Discord Bot (Python)

Listens for "!loot <item name>" commands in Discord and responds with
a rich embed pulled from the Frostreaver payload API.

Requirements:
    pip install discord.py requests python-dotenv

Environment variables (store in a .env file, never commit):
    DISCORD_BOT_TOKEN    — your Discord application bot token
    DISCORD_WEBHOOK_URL  — optional: a webhook URL for push-style posts
    FROSTREAVER_BASE_URL — defaults to https://frostreaver-loot-buckets.app

Usage:
    python discord-bot.py
"""

import os
import re
import logging

import requests
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BOT_TOKEN = os.environ["DISCORD_BOT_TOKEN"]
WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
BASE_URL = os.getenv("FROSTREAVER_BASE_URL", "https://frostreaver-loot-buckets.app")
PAYLOAD_ENDPOINT = f"{BASE_URL}/api/discord/payload"

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("frostreaver-bot")

# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------

def name_to_slug(name: str) -> str:
    """
    Convert an item/mob name to a URL-safe kebab-case slug.

    Mirrors the TypeScript itemToSlug() implementation in lib/item-slug.ts:
      - Lowercase
      - Strip apostrophes / smart quotes before removing non-alnum chars
      - Replace runs of non-alphanumeric characters with a single hyphen
      - Strip leading/trailing hyphens
    """
    slug = name.lower()
    slug = re.sub(r"[''`]", "", slug)       # strip apostrophes
    slug = re.sub(r"[^a-z0-9]+", "-", slug) # replace non-alnum with hyphen
    slug = slug.strip("-")
    return slug


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def fetch_payload(entity_type: str, entity_id: str) -> dict | None:
    """
    Fetch a Discord webhook payload from the Frostreaver API.

    Returns the parsed JSON dict on success, or None when the entity is
    not found. Raises requests.HTTPError for unexpected server errors.
    """
    resp = requests.get(
        PAYLOAD_ENDPOINT,
        params={"type": entity_type, "id": entity_id},
        timeout=8,
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def post_to_webhook(payload: dict) -> None:
    """Forward a Discord payload to the configured webhook URL."""
    if not WEBHOOK_URL:
        raise RuntimeError("DISCORD_WEBHOOK_URL is not set")
    resp = requests.post(WEBHOOK_URL, json=payload, timeout=8)
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Bot setup
# ---------------------------------------------------------------------------

intents = discord.Intents.default()
intents.message_content = True  # required for reading message text

bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    log.info("Logged in as %s (id=%s)", bot.user, bot.user.id)
    log.info("Frostreaver payload endpoint: %s", PAYLOAD_ENDPOINT)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

@bot.command(name="loot", help="Look up an EQ item. Usage: !loot Cloak of Flames")
async def loot_command(ctx: commands.Context, *, item_name: str):
    """
    Respond to "!loot <item name>" with a Frostreaver embed.

    Example:
        !loot Cloak of Flames
        !loot Manastone
    """
    slug = name_to_slug(item_name)
    log.info("loot command: name=%r slug=%r", item_name, slug)

    async with ctx.typing():
        payload = fetch_payload("item", slug)

    if payload is None:
        await ctx.send(
            f"Item **{item_name}** not found. "
            f"Check spelling or browse items at {BASE_URL}"
        )
        return

    # discord.py does not consume webhook-style payloads directly.
    # Reconstruct a discord.Embed from the first embed in the payload.
    raw_embed = payload["embeds"][0]

    embed = discord.Embed(
        title=raw_embed["title"],
        url=raw_embed.get("url"),
        description=raw_embed.get("description"),
        color=raw_embed.get("color", 0x2D6A4F),
    )

    for field in raw_embed.get("fields", []):
        embed.add_field(
            name=field["name"],
            value=field["value"],
            inline=field.get("inline", False),
        )

    if "thumbnail" in raw_embed:
        embed.set_thumbnail(url=raw_embed["thumbnail"]["url"])

    if "footer" in raw_embed:
        embed.set_footer(text=raw_embed["footer"]["text"])

    await ctx.send(content=payload.get("content", ""), embed=embed)


@bot.command(name="mob", help="Look up a named mob. Usage: !mob Lord Nagafen")
async def mob_command(ctx: commands.Context, *, mob_name: str):
    """
    Respond to "!mob <mob name>" with a Frostreaver embed.

    Example:
        !mob Lord Nagafen
        !mob Lava Duct Crawler
    """
    slug = name_to_slug(mob_name)
    log.info("mob command: name=%r slug=%r", mob_name, slug)

    async with ctx.typing():
        payload = fetch_payload("mob", slug)

    if payload is None:
        await ctx.send(
            f"Mob **{mob_name}** not found. "
            f"Browse mobs at {BASE_URL}"
        )
        return

    raw_embed = payload["embeds"][0]
    embed = discord.Embed(
        title=raw_embed["title"],
        url=raw_embed.get("url"),
        description=raw_embed.get("description"),
        color=raw_embed.get("color", 0x2D6A4F),
    )
    for field in raw_embed.get("fields", []):
        embed.add_field(
            name=field["name"],
            value=field["value"],
            inline=field.get("inline", False),
        )
    if "footer" in raw_embed:
        embed.set_footer(text=raw_embed["footer"]["text"])

    await ctx.send(content=payload.get("content", ""), embed=embed)


@bot.command(name="bucket", help="Look up a loot bucket. Usage: !bucket classic 9")
async def bucket_command(ctx: commands.Context, expansion: str, bucket_number: int):
    """
    Respond to "!bucket <expansion> <number>" with a Frostreaver embed.

    Example:
        !bucket classic 9
        !bucket kunark 13
    """
    slug = f"{expansion.lower()}-{bucket_number}"
    log.info("bucket command: slug=%r", slug)

    async with ctx.typing():
        payload = fetch_payload("bucket", slug)

    if payload is None:
        await ctx.send(
            f"Bucket **{expansion} {bucket_number}** not found. "
            f"Valid expansions: classic, kunark, velious."
        )
        return

    raw_embed = payload["embeds"][0]
    embed = discord.Embed(
        title=raw_embed["title"],
        url=raw_embed.get("url"),
        description=raw_embed.get("description"),
        color=raw_embed.get("color", 0x2D6A4F),
    )
    for field in raw_embed.get("fields", []):
        embed.add_field(
            name=field["name"],
            value=field["value"],
            inline=field.get("inline", False),
        )
    if "footer" in raw_embed:
        embed.set_footer(text=raw_embed["footer"]["text"])

    await ctx.send(content=payload.get("content", ""), embed=embed)


# ---------------------------------------------------------------------------
# Standalone webhook push (no bot token needed)
# ---------------------------------------------------------------------------

def push_item_to_webhook(item_name: str) -> None:
    """
    Standalone function: fetch payload for an item and push it to the
    configured Discord webhook.

    Call this from a script (no bot running) when you want to post a
    one-off item embed to a channel via webhook.

    Example:
        DISCORD_WEBHOOK_URL=https://discord.com/.../webhooks/...
        python -c "from discord_bot import push_item_to_webhook; push_item_to_webhook('Cloak of Flames')"
    """
    slug = name_to_slug(item_name)
    payload = fetch_payload("item", slug)
    if payload is None:
        raise ValueError(f"Item not found: {item_name!r} (slug={slug!r})")
    post_to_webhook(payload)
    log.info("Pushed %r to webhook", item_name)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    bot.run(BOT_TOKEN)
