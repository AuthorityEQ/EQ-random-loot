# EQ Random Loot — Public REST API

Base URL: `https://<your-domain>/api`

All endpoints return JSON wrapped in a standard envelope:

```json
{
  "data": { ... },
  "meta": {
    "version": "1.0",
    "timestamp": "2026-04-29T12:00:00.000Z",
    "source": "EQ-random-loot/0.2"
  }
}
```

Error responses replace `data` with `error`:

```json
{
  "error": "No item found for slug \"foo\"",
  "meta": { ... }
}
```

---

## Endpoints

### `GET /api/items`

Search items by name, slot, and/or expansion.

**Query parameters**

| Param  | Type   | Description |
|--------|--------|-------------|
| `q`    | string | Case-insensitive substring of item name |
| `slot` | string | Slot key: `primary`, `secondary`, `head`, `chest`, `arms`, `waist`, `legs`, `feet`, `wrist`, `hands`, `ear`, `face`, `neck`, `back`, `shoulders`, `finger`, `range`, `ammo` |
| `exp`  | string | Expansion: `classic`, `kunark`, `velious` |

**Response**

```json
{
  "data": {
    "items": [
      {
        "slug": "cloak-of-flames",
        "name": "Cloak of Flames",
        "slot": "BACK",
        "ac": 10,
        "damage": null,
        "delay": null,
        "stats": { "STR": 5, "STA": 5 },
        "resists": { "FIRE": 15 },
        "haste": null,
        "worn_effects": [],
        "focus_effects": [],
        "click_effects": [],
        "proc_effects": [],
        "required_level": null,
        "recommended_level": null,
        "classes": ["ALL"],
        "races": ["ALL"],
        "weight": 0.4,
        "size": "SMALL",
        "lore": true,
        "magic": true,
        "no_drop": false,
        "prestige": false,
        "aug_slots": [],
        "sources": [{ "name": "ZAM", "url": "https://..." }],
        "confidence": "high",
        "expansion": "Classic"
      }
    ],
    "total": 1
  },
  "meta": { ... }
}
```

**curl example**

```bash
curl "https://example.com/api/items?q=cloak&slot=back&exp=classic"
```

**JavaScript fetch example**

```js
const res = await fetch("https://example.com/api/items?q=cloak");
const { data } = await res.json();
console.log(data.items, data.total);
```

---

### `GET /api/items/[slug]`

Get a specific item by its URL slug (e.g. `cloak-of-flames`).

**Response**

```json
{
  "data": {
    "item": {
      "slug": "cloak-of-flames",
      "name": "Cloak of Flames",
      "foundInBuckets": [
        {
          "expansion": "Classic",
          "bucket": 8,
          "levelRange": "36-40",
          "zones": ["Lavastorm Mountains", "Nagafen's Lair"]
        }
      ],
      ...
    }
  }
}
```

**curl example**

```bash
curl "https://example.com/api/items/cloak-of-flames"
```

---

### `GET /api/mobs`

Search mobs by zone, name, level, and/or expansion. Includes both group-named mobs and raid bosses.

**Query parameters**

| Param       | Type    | Description |
|-------------|---------|-------------|
| `zone`      | string  | Case-insensitive zone name substring |
| `name`      | string  | Case-insensitive mob name substring |
| `level`     | integer | Exact level |
| `level_min` | integer | Minimum level (inclusive) |
| `level_max` | integer | Maximum level (inclusive) |
| `exp`       | string  | Expansion: `classic`, `kunark`, `velious` |

**Response**

```json
{
  "data": {
    "mobs": [
      {
        "name": "a ghoul",
        "slug": "a-ghoul",
        "level": 18,
        "zone": "Nektulos Forest",
        "expansion": "Classic",
        "type": "group-named",
        "lootPool": ["Bone Chips", "..."],
        "bucketNumber": 4,
        "bucketLevelRange": "16-20"
      }
    ],
    "total": 1
  }
}
```

**curl example**

```bash
curl "https://example.com/api/mobs?zone=nektulos&level_min=15&level_max=25"
```

---

### `GET /api/zones`

List all zones with summary metadata.

**Query parameters**

| Param | Type   | Description |
|-------|--------|-------------|
| `exp` | string | Filter by expansion: `classic`, `kunark`, `velious` |

**Response**

```json
{
  "data": {
    "zones": [
      {
        "name": "Nektulos Forest",
        "slug": "nektulos-forest",
        "expansions": ["Classic"],
        "mobCount": 12,
        "levelMin": 14,
        "levelMax": 22,
        "lootPoolSize": 48
      }
    ],
    "total": 1
  }
}
```

**curl example**

```bash
curl "https://example.com/api/zones?exp=classic"
```

---

### `GET /api/zones/[slug]`

Get a specific zone with full mob list, bucket breakdown, and aggregate loot pool.

**Response**

```json
{
  "data": {
    "zone": {
      "name": "Nektulos Forest",
      "slug": "nektulos-forest",
      "primaryExpansion": "Classic",
      "expansions": ["Classic"],
      "totalMobs": 12,
      "aggregateLootPool": ["Bat Wing", "..."],
      "aggregateLootPoolSize": 48,
      "bucketGroups": [
        {
          "bucket": 4,
          "levelRange": "16-20",
          "expansion": "Classic",
          "lootPool": ["Bat Wing", "..."],
          "mobs": [
            { "name": "a ghoul", "slug": "a-ghoul", "level": 18, "expansion": "Classic" }
          ]
        }
      ]
    }
  }
}
```

**curl example**

```bash
curl "https://example.com/api/zones/nektulos-forest"
```

---

### `GET /api/buckets`

List all loot buckets across expansions with full stats.

**Query parameters**

| Param    | Type    | Description |
|----------|---------|-------------|
| `exp`    | string  | Filter by expansion: `classic`, `kunark`, `velious` |
| `bucket` | integer | Filter by bucket number |

**Response**

```json
{
  "data": {
    "buckets": [
      {
        "bucket": 4,
        "expansion": "Classic",
        "levelRange": "16-20",
        "mobCount": 18,
        "zoneCount": 4,
        "lootPoolSize": 52,
        "zones": [
          { "name": "Nektulos Forest", "slug": "nektulos-forest", "mobCount": 12 }
        ],
        "lootPool": ["Bat Wing", "..."]
      }
    ],
    "total": 1
  }
}
```

**curl example**

```bash
curl "https://example.com/api/buckets?exp=classic&bucket=4"
```

---

### `GET /api/status`

Plugin/server status: server name, version, launch date, expansion timeline, and dataset stats.

This endpoint is not cached — it always returns a fresh timestamp and live/not-live status.

**Response**

```json
{
  "data": {
    "server": "frostreaver",
    "apiVersion": "1.0",
    "apiSource": "EQ-random-loot/0.2",
    "launchIso": "2026-05-27T19:00:00Z",
    "launchHuman": "May 27, 2026 12:00 PM PT",
    "isLaunched": false,
    "expansions": [
      {
        "name": "Classic",
        "unlockIso": "2026-05-27T19:00:00Z",
        "isLive": false,
        "tentative": false,
        "tone": "classic"
      }
    ],
    "dataStats": {
      "groupNamedBuckets": 39,
      "groupNamedMobs": 420,
      "groupNamedLootPool": 600,
      "raidBosses": 45,
      "uniqueZones": 58,
      "enrichedItems": 612
    }
  },
  "meta": { ... }
}
```

**curl example**

```bash
curl "https://example.com/api/status"
```

---

## CORS

All endpoints respond with:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

This means you can call the API from any browser extension, Discord bot, or MQ plugin without needing a proxy.

---

## Caching

Most endpoints set a 24-hour `Cache-Control` with `stale-while-revalidate`:

```
Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600
```

`/api/status` is not cached and returns a fresh response on every request.

---

## Rate Limiting

There is no enforced rate limit at this time.

**Please be considerate:** do not hammer the API with high-frequency polling. If you are building a bot or plugin, cache responses locally for at least 15 minutes. A future version will enforce a per-IP limit of ~60 requests/minute.

---

## Versioning

The current version is `1.0`, returned in every `meta.version` field.

Breaking changes (removed fields, changed types) will be introduced with a new version prefix (`/api/v2/...`). The current unversioned paths will remain available throughout the v1 lifecycle.

Non-breaking additions (new optional fields) may be deployed without a version bump.

---

## Slug format

Slugs are kebab-case, lowercase, with apostrophes stripped:

- `"Cloak of Flames"` → `cloak-of-flames`
- `"Tolan's Darkwood Fists"` → `tolans-darkwood-fists`
- `"Nektulos Forest"` → `nektulos-forest`

When two items produce the same base slug, the second gets a numeric suffix: `foo-bar`, `foo-bar-2`.

When two mobs share the same name in different zones, the slug gets a zone suffix: `a-ghoul--nektulos-forest`.
