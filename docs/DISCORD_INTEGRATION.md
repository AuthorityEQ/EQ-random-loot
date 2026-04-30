# Discord Integration Guide

## Why Discord Matters for EQ TLP Communities

EverQuest TLP servers live on Discord. Loot disputes, upgrade decisions, and raid
prep discussions all happen in guild channels. Making it trivial to drop an item
link into Discord — complete with stats, drop zones, and bucket info — reduces the
friction between "I found an upgrade" and "everyone in my guild knows about it."

Frostreaver Loot Buckets ships with:

1. A **Share to Discord** button in the item drawer that copies a formatted message
   to your clipboard — paste it anywhere in Discord.
2. A public **`/api/discord/payload`** endpoint that returns a ready-to-POST Discord
   webhook payload, so bots and scripts can pull formatted embeds without
   implementing any display logic.


## 1. Share to Discord Button (Browser UI)

Open any item in the drawer and click **Share to Discord**. Your clipboard will
contain a message like:

```
**Cloak of Flames** — [click to view](https://frostreaver-loot-buckets.app/item/cloak-of-flames)
Drop locations: Nagafen's Lair, Permafrost
Bucket: 9 (45-49)
```

Paste it into any Discord channel. Discord will render the bold name as a
hyperlink and auto-preview the URL.


## 2. Webhook Payload Endpoint

```
GET https://frostreaver-loot-buckets.app/api/discord/payload
```

### Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `type` | yes | `item`, `mob`, or `bucket` |
| `id`   | yes | URL slug of the entity |

### Examples

```
GET /api/discord/payload?type=item&id=cloak-of-flames
GET /api/discord/payload?type=mob&id=lord-nagafen
GET /api/discord/payload?type=bucket&id=classic-9
```

### Response shape

The endpoint returns a Discord webhook execute payload. POST it directly to any
webhook URL:

```json
{
  "content": "**Cloak of Flames** — [View on Frostreaver Loot Buckets](...)",
  "embeds": [
    {
      "title": "Cloak of Flames",
      "url": "https://frostreaver-loot-buckets.app/item/cloak-of-flames",
      "description": "Magic · Lore · No Drop · AC 10 | HP 60 | INT 10",
      "color": 2976847,
      "fields": [
        { "name": "Slot",          "value": "BACK",              "inline": true },
        { "name": "AC",            "value": "10",                "inline": true },
        { "name": "Classes",       "value": "ALL",               "inline": false },
        { "name": "Drop Locations","value": "Nagafen's Lair",    "inline": false },
        { "name": "Loot Bucket",   "value": "Classic Bucket 9 (45-49)", "inline": false }
      ],
      "footer": { "text": "frostreaver-loot-buckets.app" }
    }
  ]
}
```

CORS is open (`Access-Control-Allow-Origin: *`), so the endpoint is safe to
call from browser extensions and single-page apps as well as server-side scripts.

### Setting up a Discord webhook

1. Open the Discord channel you want posts to appear in.
2. Click the gear icon (Edit Channel) → Integrations → Webhooks.
3. Click **New Webhook**, give it a name (e.g. "Frostreaver Loot"), and copy the
   webhook URL. It looks like:
   `https://discord.com/api/webhooks/1234567890/ABCDEF...`
4. Store that URL as an environment variable (`DISCORD_WEBHOOK_URL`) — never
   commit it to source control.

To test manually:

```bash
PAYLOAD=$(curl -s "https://frostreaver-loot-buckets.app/api/discord/payload?type=item&id=cloak-of-flames")
curl -X POST "$DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```


## 3. Sample Bot — Python

See `docs/examples/discord-bot.py` for a full script. Quick summary:

```python
import requests, os

WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
BASE = "https://frostreaver-loot-buckets.app"

def post_item(item_slug: str):
    payload = requests.get(f"{BASE}/api/discord/payload?type=item&id={item_slug}").json()
    requests.post(WEBHOOK_URL, json=payload).raise_for_status()
```

The Python script integrates with `discord.py` so guild members can type
`!loot Cloak of Flames` and have the bot respond with the embed in the channel.


## 4. Sample Bot — Node.js / JavaScript

See `docs/examples/discord-bot.js` for the equivalent Node.js script using the
`discord.js` library.


## 5. Future: Ingest Endpoint (Post-MVP)

A planned Tier 3 feature will expose a write endpoint:

```
POST /api/ingest/loot-report
```

This will let bots watch a Discord channel for "I just looted X" messages and
submit them back to Frostreaver for community-sourced drop confirmation. The
workflow would be:

1. Bot monitors a guild's `#loot-reports` channel.
2. Player types: `I just looted a Cloak of Flames from Lava Duct Crawler in SolB`
3. Bot parses the message (LLM or regex), calls `POST /api/ingest/loot-report`
   with the item name, mob name, zone, and server.
4. Frostreaver increments confidence scores for that drop.

This feature is not yet live. The ingest endpoint contract will be documented
here when it ships.


## 6. Webhook Security

**Keep your webhook URL secret.** Anyone who has it can post to your channel.

Best practices:

- Store the URL in an environment variable (`DISCORD_WEBHOOK_URL`), not in code.
- Rotate compromised webhooks immediately: Discord channel settings → Integrations
  → Webhooks → delete the old webhook, create a new one, update your env variable.
- Do not log the webhook URL — structured log redaction should treat it as a secret.
- If you are running a public bot, implement a per-guild database row for the
  webhook URL and scope API key access so one guild cannot read another's webhook.
- Rate limit your bot: Discord allows 30 requests per minute per webhook. Build in
  a queue or cooldown if multiple players trigger the bot simultaneously.
- Validate item slugs before forwarding to our API — reject any `id` param that
  does not match `^[a-z0-9-]+$` to prevent SSRF/injection.
