# Frostreaver Scrape Strategy
## Data Enrichment Pipeline for Allakhazam & EQ Progression

**Status**: Strategy Document  
**Version**: 1.0  
**Date**: 2026-04-29  
**Author**: Data Engineering Team  
**Scope**: Zone/NPC/Item data scraping; pre-launch & post-launch phases  
**Target Launch**: May 27, 2026

---

## Overview

Three specialized scrapers will enrich the Frostreaver Loot Buckets site with data from authoritative external sources. This document defines the scope, patterns, and operational constraints for each scraper.

### Scrapers

1. **Allakhazam Zone Scraper** — Extract zone metadata, mob spawns, loot distributions
2. **Allakhazam NPC Scraper** — Extract detailed NPC stats, resistances, faction effects
3. **EQ Progression Scraper** — Extract items, zone guides, leveling recommendations

All scrapers respect `robots.txt`, implement rate limiting, cache aggressively, and identify themselves with a user-friendly User-Agent string.

---

## 1. Allakhazam Zone Scraper

### Purpose
Enrich zone-group-named.json with zone metadata: recommended level range, environment type, faction context, hazards, and spawn patterns.

### URL Patterns
```
https://everquest.allakhazam.com/db/zone.html?zone=<zone-slug>
  → zone-slug examples: "field-of-bone", "plane-of-fear", "crushbone"
  → Alternative: search query for ambiguous names

https://everquest.allakhazam.com/search.html?q=<zone-name>
  → Fallback if direct zone URL unknown; find zone link in results
```

### Cache & TTL
- **Cache directory**: `cache/zam-pages/zone-*.html` (slug-hashed)
- **Cache key**: `sha1("zone:" + zone-name)`
- **TTL**: 30 days (Allakhazam updates zone info monthly at most)
- **Invalidation**: On explicit `--force-refresh` flag or TTL expiry

### Output JSON Shape
```json
{
  "expansion": "Classic",
  "zone_name": "Field of Bone",
  "zone_slug": "field-of-bone",
  "recommended_levels": "45-55",
  "environment": "Outdoor, Desert",
  "hazards": ["Dragons", "High level mobs", "No safe zones"],
  "factions_touched": ["Kaladim", "Plane of Sky"],
  "spawn_types": {
    "undead": 12,
    "dragon": 3,
    "humanoid": 8
  },
  "estimated_mob_count": 23,
  "zem": 140,  // Zone Experience Modifier if available
  "difficulty_rating": 4,  // 1-5 scale
  "sources": ["allakhazam"],
  "last_scraped": "2026-05-15T10:30:00Z"
}
```

### robots.txt Observations
```
User-agent: *
Disallow: /private/
Disallow: /admin/
Allow: /db/
Allow: /search.html
Crawl-delay: 1
```

**Interpretation**: Zone and search pages are crawlable. Implement 1-second delay minimum (we'll use 1.5s to be conservative).

### Rate Limiting
- **Minimum delay**: 1.5 seconds between requests
- **Backoff**: Exponential backoff on 429 (Too Many Requests)
- **Max retries**: 3 with 5s backoff after each
- **Timeout**: 10 seconds per request
- **Concurrent requests**: 1 (serial only, respects rate limits)

### User-Agent String
```
EQ-random-loot/0.2 (+enrichment; contact: eq2platsales@gmail.com)
```

This clearly identifies the client, provides contact info, and discloses enrichment intent.

### Parsing Strategy
1. Fetch zone page via cache-first lookup
2. Extract zone metadata from header:
   - Zone name, level range (often in subtitle)
   - Environment type (from description)
3. Extract mob table (if present):
   - Mob names, levels, types
   - Count total mob entries
4. Extract faction info (from sidebar or body text)
5. Infer ZEM from descriptions (e.g., "140% XP bonus")

### Error Handling
- **404 Not Found**: Zone doesn't exist or name is ambiguous; fall back to search
- **403 Forbidden**: IP rate-limited; back off exponentially
- **Timeout**: Retry after 10 seconds, up to 3 times
- **Parsing failure**: Log to `data/scrape-errors-zone.json`, skip zone, continue

### Post-Processing
1. Validate zone_name matches one of our known zones
2. Cross-check recommended_levels against mob data (sanity check)
3. Merge with existing `zone-metadata.json` (if exists)
4. Emit `data/zone-enrichment-allakhazam.json` with scraped data
5. Log summary to `data/scrape-log-zones.json`

---

## 2. Allakhazam NPC Scraper

### Purpose
Enrich mob spawns with detailed stats: resistances, faction effects, special abilities, special loot triggers.

### URL Patterns
```
https://everquest.allakhazam.com/db/npc.html?id=<mob-id>
  → Requires mob ID; sourced from zone pages or prior enrichment

https://everquest.allakhazam.com/search.html?q=<mob-name>
  → Fallback if mob ID unknown; find mob link in results, extract ID
```

### Cache & TTL
- **Cache directory**: `cache/zam-pages/npc-*.html` (ID-hashed)
- **Cache key**: `sha1("npc:" + mob_id OR "npc-search:" + mob_name)`
- **TTL**: 60 days (NPC stats rarely change mid-expansion)

### Output JSON Shape
```json
{
  "mob_name": "a bone lord",
  "zone": "Field of Bone",
  "level": 52,
  "class": "Wizard",
  "resistances": {
    "magic": -50,
    "fire": 10,
    "cold": 10,
    "disease": 5,
    "poison": 5
  },
  "faction_effects": [
    {
      "faction": "Kaladim",
      "delta": -5,
      "when": "on kill"
    }
  ],
  "special_abilities": ["Summon", "Magic"],
  "immunities": ["Charm", "Fear"],
  "max_hp": 2500,
  "sources": ["allakhazam"],
  "last_scraped": "2026-05-15T10:35:00Z"
}
```

### Parsing Strategy
1. Fetch NPC page via cache-first lookup
2. Extract stats from info box:
   - Level, class, race
   - Resistances (if listed)
3. Extract faction effects from description
4. Parse special abilities/immunities (often in bolded text)
5. Extract HP from combat data (if available)

### Rate Limiting
- Same as Zone Scraper: 1.5s minimum delay, exponential backoff on 429

### Error Handling
- Same as Zone Scraper
- **Parsing failure**: Log to `data/scrape-errors-npc.json`, skip NPC, continue

### Post-Processing
1. Validate mob_name matches a known mob in our bucket data
2. Merge with existing `mob-details.json` (if exists)
3. Emit `data/npc-enrichment-allakhazam.json`
4. Log summary to `data/scrape-log-npcs.json`

---

## 3. EQ Progression Scraper

### Purpose
Enrich items with context: quest sources, farming tips, build recommendations, market price trends.

### URL Patterns
```
https://www.eqprogression.com/item-database/
  → Base database page

https://www.eqprogression.com/item-database/?item=<item-name>
  → Direct item query (if supported)

https://www.eqprogression.com/zone-guide/<zone-slug>/
  → Zone guides with item drops and strategies
```

### Cache & TTL
- **Cache directory**: `cache/eqprogression-pages/item-*.html` (name-hashed)
- **Cache key**: `sha1("eqp:" + item_name OR "eqp-zone:" + zone_name)`
- **TTL**: 14 days (EQP updates weekly with patch notes)

### Output JSON Shape
```json
{
  "item_name": "Cloak of Flames",
  "eqp_url": "https://www.eqprogression.com/item-database/?item=cloak-of-flames",
  "eqp_quest_source": null,
  "eqp_camp_notes": "Drops from Lord Nagafen in Solusek's Eye. Rare drop, expect camping.",
  "eqp_drop_rate": "Rare (estimated <5% per kill)",
  "eqp_farming_tips": "Best camped during off-peak hours. Kite to zone line to reset if needed.",
  "sources": ["eqprogression"],
  "last_scraped": "2026-05-15T10:40:00Z"
}
```

### robots.txt Observations
```
User-agent: *
Disallow: /private/
Allow: /item-database/
Allow: /zone-guide/
Crawl-delay: 2
```

**Interpretation**: Item and zone pages are crawlable. Implement 2.0 second minimum delay.

### Rate Limiting
- **Minimum delay**: 2.0 seconds between requests
- **Backoff**: Exponential backoff on 429
- **Max retries**: 3 with 5s backoff
- **Timeout**: 15 seconds per request (EQP can be slow)
- **Concurrent requests**: 1 (serial only)

### User-Agent String
```
EQ-random-loot/0.2 (+enrichment; contact: eq2platsales@gmail.com)
```

### Parsing Strategy
1. Fetch item page via cache-first lookup
2. Extract item metadata from header
3. Extract drop location info (zone, mob, drop rate)
4. Extract farming tips from description
5. Extract quest source flag (if present)

### Error Handling
- **404 Not Found**: Item doesn't exist on EQP; skip, continue
- **Timeout**: EQP is slow; retry with longer delay (5s backoff)
- **Parsing failure**: Log to `data/scrape-errors-eqp.json`, skip item, continue

### Post-Processing
1. Validate item_name against item-details.json keys
2. Merge with existing item-details.json EQP fields
3. Emit `data/item-enrichment-eqprogression.json`
4. Log summary to `data/scrape-log-eqp.json`

---

## 4. Cross-Source Validation & Conflict Resolution

### Data Conflicts
When Allakhazam and EQ Progression disagree on item drops, drop rates, or zone info:

**Precedence Order**:
1. **Allakhazam** for item stats (primary official source)
2. **EQ Progression** for context (tips, market data)
3. **Manual overrides** from `data/manual-corrections.json` (community-vetted fixes)

### Validation Rules
1. **Item names**: Case-insensitive matching after normalization
2. **Drop rates**: If sources differ >50%, flag for manual review in `data/scrape-conflicts.json`
3. **Zone names**: Normalize to lowercase slug; handle aliases (e.g., "PoF" → "plane-of-fear")
4. **Faction deltas**: Validate against known factions in faction-system.json

### Conflict Resolution Script
```bash
npm run scrape:validate:conflicts
```

Output: `data/scrape-conflicts.json` with human-readable conflict report.

---

## 5. Legal & Ethical Considerations

### robots.txt Compliance
- Allakhazam: Crawl-delay 1s → we use 1.5s ✓
- EQ Progression: Crawl-delay 2s → we use 2.0s ✓
- We respect `/private/`, `/admin/` disallows ✓

### User-Agent Transparency
```
EQ-random-loot/0.2 (+enrichment; contact: eq2platsales@gmail.com)
```

Clearly identifies:
- Service name and version
- Intent (enrichment)
- Contact email for takedown/questions

### Caching Strategy
**Aggressive caching minimizes external requests**:
- Zone metadata: 30-day TTL (update monthly)
- NPC stats: 60-day TTL (stable across patches)
- Items: 14-day TTL (weekly updates)
- Manual cache invalidation via flag: `--force-refresh`

This approach:
- Reduces load on external services ✓
- Saves bandwidth (cache hits ~95% after first run) ✓
- Enables offline operation (cache-first) ✓
- Respects robots.txt crawl delays ✓

### Acceptable Use
- Non-commercial enrichment for fan site ✓
- Attribution via User-Agent + source field in JSON ✓
- No resale or competitive repackaging ✓
- Caching enables low-frequency hits ✓

---

## 6. Implementation Roadmap (4 Phases)

### Phase 1: Zone Scraper (Week 1, May-1-5)
**Goal**: Extract all zone metadata from Allakhazam  
**Deliverable**: `data/zone-enrichment-allakhazam.json`  
**Effort**: ~8 hours (parser design + testing)

1. Design zone parser (identify selector patterns)
2. Implement `scripts/scrape-zones-from-allakhazam.ts`
3. Build cache management utilities
4. Test on 5 sample zones (Field of Bone, Qvic, PoSky, Kunark sample, Velious sample)
5. Run full scrape on all 60+ zones
6. Validate output, log errors
7. Merge into zone-metadata.json

### Phase 2: NPC Scraper (Week 2, May 6-12)
**Goal**: Extract mob stats for all known NPCs  
**Deliverable**: `data/npc-enrichment-allakhazam.json`  
**Effort**: ~10 hours (complex parsing, resistances are detailed)

1. Design NPC parser (identify stat box selectors)
2. Implement `scripts/scrape-npcs-from-allakhazam.ts`
3. Build NPC ID lookup (from zone pages or manual mapping)
4. Test on 10 sample NPCs across expansions
5. Run scrape on all NPCs in bucket data (~300-500 NPCs)
6. Validate output, resolve parsing failures
7. Merge into mob-details.json

### Phase 3: EQ Progression Scraper (Week 3, May 13-19)
**Goal**: Extract item tips, drop rates, quest sources  
**Deliverable**: `data/item-enrichment-eqprogression.json`  
**Effort**: ~10 hours (different site structure, slower)

1. Design item parser (EQP structure differs from ZAM)
2. Implement `scripts/scrape-items-from-eqprogression.ts`
3. Test on 10 sample items
4. Run scrape on all unique items in loot pools (~500-700 items)
5. Handle timeouts gracefully
6. Validate output
7. Merge into item-details.json via conflict resolution script

### Phase 4: Validation & Merge (Week 4, May 20-26)
**Goal**: Cross-validate sources, resolve conflicts, finalize merged data  
**Deliverable**: `data/zone-enriched.json`, `data/npc-enriched.json`, validated item-details.json  
**Effort**: ~6 hours (validation + manual conflict review)

1. Run `npm run scrape:validate:conflicts` to identify discrepancies
2. Manual review of high-priority conflicts (drop rates >50% diff)
3. Update `data/manual-corrections.json` with resolutions
4. Re-merge with corrected data
5. Final validation pass (schema, required fields)
6. Prepare pre-launch dataset freeze

---

## 7. Operational Commands

### Run Scrapers
```bash
# Dry run (show what would be scraped, no writes)
npm run scrape:zones -- --dry-run
npm run scrape:npcs -- --dry-run
npm run scrape:eqp -- --dry-run

# Live runs (with cache)
npm run scrape:zones
npm run scrape:npcs
npm run scrape:eqp

# Force refresh (bypass cache)
npm run scrape:zones -- --force-refresh
npm run scrape:npcs -- --force-refresh
npm run scrape:eqp -- --force-refresh

# Run all in sequence
npm run scrape:all
```

### Cache Management
```bash
# List cache stats
npm run cache:list

# Prune cache (older than 30 days)
npm run cache:prune -- --older-than=30

# Rebuild manifest
npm run cache:rebuild-manifest

# Invalidate one entry
npm run cache:invalidate -- zone:field-of-bone
```

### Validation & Merging
```bash
# Find conflicts between sources
npm run scrape:validate:conflicts

# Merge sources with conflict resolution
npm run scrape:merge

# Final schema validation
npm run scrape:validate:schema
```

---

## 8. Pre-Launch Checklist

- [ ] All three scrapers implemented and tested
- [ ] Cache seeded with zone, NPC, item data (warm cache)
- [ ] Conflicts resolved and documented
- [ ] Manual corrections applied
- [ ] Final schema validation passes
- [ ] Offline mode functional (cache-first serving)
- [ ] User-Agent string matches brand guidelines
- [ ] robots.txt compliance verified
- [ ] Rate limiting limits tested under load
- [ ] Error logs reviewed and cleaned
- [ ] Production dataset frozen and version-tagged

---

## 9. Post-Launch Maintenance

### Weekly Tasks
- Monitor scrape error logs
- Re-run zones/NPCs scraper if patches detected
- Review community corrections (Discord #data-issues)

### Monthly Tasks
- Invalidate and refresh zone metadata (30-day TTL)
- Update EQP data (14-day TTL)
- Review cache hit/miss ratios
- Plan updates for upcoming expansions

---

**Last Updated**: 2026-04-29  
**Next Review**: After Phase 1 completion (May 5)  
**Owner**: Data Engineering Team
