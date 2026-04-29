# Frostreaver Launch Roadmap
## EQ-random-loot Product Strategy & Execution Plan

**Status**: Pre-Launch Planning (2026-04-29)  
**Server**: Frostreaver TLP (free-trade, randomized loot)  
**Launch Date**: May 27, 2026 12:00 PM PT (CONFIRMED)
**Runway**: ~4 weeks until launch  
**Team Capacity**: Single developer  
**Design Constraints**: Custom CSS design system (no Tailwind), preserve existing site stability

---

## Executive Summary

Frostreaver is a next-generation EverQuest TLP server launching May 27, 2026 12:00 PM PT with randomized group-named loot mechanics. The EQ-random-loot site is the primary reference tool for players farming these buckets. This roadmap prioritizes ship-blocking features in the 4-week runway, then aggressive adoption features post-launch, followed by expansion content as the server progresses.

**Current Status**: Core Group Named pages exist (Classic, Kunark, Velious). Raid Bosses page informational only. Favorites system live. Search infrastructure in place.

**Critical Path**:
1. **Tier 0** (SHIP-BLOCKING): Fix data accuracy, launch indicator, server selector → Deploy by May 27
2. **Tier 1** (Week 1-2 post-launch, June 3-16): Zone population, basic faction context, Discord embeds → Attract first wave of farmers
3. **Tier 2** (Month 1-2 post-launch, June 17-July): Kunark/Velious verification, epic quest tracker, tradeskill → Support mid-game progression
4. **Tier 3** (Month 2+ post-launch): PoP progression, API, offline mode → Long-term ecosystem

---

## Tier 0: SHIP-BLOCKING (Launch Week Essentials)

**Goal**: Ensure the site is production-ready and helps players from day one.

### T0.1: Server & Launch Status Indicator
**Status**: CRITICAL PATH  
**Effort**: S (1 day)  
**Risk**: LOW  
**Dependencies**: None (data-driven, no external API required initially)  

- Add a prominent banner/badge showing server status:
  - "Frostreaver LIVE" with timestamp (May 27, 2026 12:00 PM PT)
  - Before launch: "Launching in X days" countdown
  - After launch: "Server is LIVE, launched X days ago"
  - Sticky nav position so visible when browsing (peek below h1)
- Update layout.tsx metadata to include launch date in description
- Add subtle visual indicator (green accent pulse) on nav to catch eyes
- Source: Hardcoded launch timestamp in layout.tsx + date.now() comparison

**Acceptance Criteria**:
- Launch status visible without scrolling
- Clearly indicates server is live or countdown (if early)
- Dark/light mode support works

---

### T0.2: Verify Classic Group Named Data (Critical Path)
**Status**: BLOCKING  
**Effort**: M (3-5 days, depends on audit scope)  
**Risk**: HIGH (correctness directly impacts player trust)  
**Dependencies**: None (data audit only)  
**Source**: classic-group-named.json vs. live Frostreaver database

- Audit classic-group-named.json against live server spawns:
  - Spot-check 10-15 zones for mob spawn accuracy
  - Verify loot pool distribution (are all buckets present?)
  - Check level ranges match live server data
  - Validate bucket assignments (which mobs → which buckets)
- Create data-audit checklist document (markdown) in /docs/
- If gaps found: prioritize high-traffic zones (Field of Bone, Qvic, Plane of Sky)
- Add metadata comment in JSON: `"last_verified": "2026-05-27"` per expansion
- Fallback: Ship with existing data but add "Unverified - Help us improve" notice

**Acceptance Criteria**:
- Classic expansion data matches 95%+ of live spawns (spot check)
- High-traffic zones confirmed accurate
- Audit trail documented for future patches

---

### T0.3: Mobile Responsiveness Audit
**Status**: BLOCKING  
**Effort**: M (2-4 days)  
**Risk**: MEDIUM (CSS breakpoints may conflict with custom design system)  
**Dependencies**: T0.2 (need stable data to test UX)  
**Source**: CSS inspection + mobile browser testing

- Test on iOS Safari, Android Chrome (14" tablet, 6.1" phone viewports)
- Audit:
  - Toolbar wrapping (searchbox, filters stack on narrow?)
  - Zone list readability (grid template columns work?)
  - Item drawer usability (full-screen on mobile?)
  - Bucket cards responsive (stack to 1 col below 640px?)
- Breakpoints already exist (720px, 980px) — validate coverage
- Test form inputs (level picker, zone filter, search) on touch devices
- Priority: Ensure search + filter bar is usable on phone

**Acceptance Criteria**:
- All major pages load correctly on 375px viewport
- Touch targets ≥44px (WCAG)
- Search/filter toolbar accessible without horizontal scroll
- No layout shifts during interaction

---

### T0.4: Search Performance Under Load (Simulated)
**Status**: BLOCKING  
**Effort**: M (2-3 days)  
**Risk**: MEDIUM (search latency will frustrate early players)  
**Dependencies**: T0.2 (need final data size)  

- Measure universal-search query time (all expansions, all zones, all items)
- Profile JavaScript execution (React memos, useMemo hooks working?)
- Simulate 500+ concurrent searches via load test script or browser console
- Optimize if >300ms response time:
  - Check if typeahead is debouncing properly (currently 180ms — may need 250ms)
  - Verify useMemo dependencies are correct (check ZoneView, typeahead results)
  - Consider lazy-loading Kunark/Velious data on page init if Classic is only focus
- Document baseline metrics in /docs/PERFORMANCE.md

**Acceptance Criteria**:
- Typeahead response ≤300ms (human-imperceptible)
- No jank during rapid filter toggles
- Search results appear smooth (no layout flash)

---

### T0.5: Add Server Selector (Frostreaver vs. Mischief Mode)
**Status**: OPTIONAL BUT RECOMMENDED  
**Effort**: S (1-2 days)  
**Risk**: LOW  
**Dependencies**: T0.1 (need launch status context)  
**Source**: enum/config in lootModes.ts or new serverModes.ts

- Currently, site is Frostreaver-only (hardcoded "Frostreaver Random Loot" in h1)
- Add a server mode selector in navbar or toolbar:
  - Radio buttons: "Frostreaver (Random)", "Mischief (Normal)", "Teek (Normal)"
  - Toggle filters the entire site view (applies to Classic, Kunark, Velious)
  - Cache selection in localStorage as `frostreaver-server-mode`
- For now, "Mischief" and "Teek" can show placeholder: "Loot data not yet available"
- Prepares site for future TLP support without data rework

**Acceptance Criteria**:
- Selector visible in toolbar/nav
- Selection persists across page reloads
- Frostreaver mode shows all data, others show stub text
- Doesn't break existing CSS

---

## Tier 1: First Two Weeks Post-Launch

**Goal**: Capitalize on early-game momentum by adding features players actively need while farming.

### T1.1: Populate All Classic Zones (Extended Data)
**Status**: HIGH PRIORITY  
**Effort**: L (5-7 days for data curation + validation)  
**Risk**: MEDIUM (data sourcing risk — depends on Allakhazam scrape quality)  
**Dependencies**: T0.2 (need verified baseline)  
**Source**: Allakhazam scrape (scripts/enrich-items-from-zam.ts exists), manual curation from zone guides

- Current classic-group-named.json likely covers core zones but may be incomplete
- Action:
  1. Run item-name extraction across all Allakhazam zone pages (use existing script)
  2. Cross-reference with eqprogression.com zone lists
  3. Manually verify 3-5 zones per day (prioritize: Field of Bone, Qvic, PoSky, Unrest, Mistmoore)
  4. Fill gaps: missing mobs, missing loot, bucket assignments
  5. For ambiguous items (not in item-details.json), mark with `"is_placeholder": true`
- Target: **22+ zones with ≥80% mob coverage each**
- Update classic-group-named.json buckets, re-test search performance (T0.4)

**Acceptance Criteria**:
- All major Classic zones have ≥5 mobs with loot each
- No zone shows empty bucket (all buckets have ≥1 item)
- Spot-check 5 random items against Allakhazam — 100% match

---

### T1.2: Add Faction Context (Camping & Reputation Guide)
**Status**: MEDIUM PRIORITY  
**Effort**: L (6-8 days for research + data structure + UI)  
**Risk**: MEDIUM (faction data changes per expansion, needs curation)  
**Dependencies**: T1.1 (zones must be populated first)  
**Source**: eqprogression.com faction tables, manual EQ lore research

- Players camp mobs for hours; faction context helps them decide *which* zones to prioritize
- Create new data structure: `faction-context.json`
  ```json
  {
    "expansion": "Classic",
    "zones": [
      {
        "zone": "Field of Bone",
        "factions": [
          {"name": "Plane of Sky (Ally)", "description": "PoS faction quest hub" },
          {"name": "Kaladim", "description": "Dwarf paladins, holy necro quest"}
        ],
        "quest_items": ["bone chips", "karnor's tooth"],
        "notes": "Heavy camping; respawn ~10 min per spawn point"
      }
    ]
  }
  ```
- Add new page `/factions` or sidebar panel on zone view showing context
- UI: Show 2-3 related factions per zone, brief description, link to quest item if available
- Data source: eqprogression zone info + EQWiki faction pages (manual curation)
- Start with Classic only; expand to Kunark/Velious in Tier 2

**Acceptance Criteria**:
- Every Classic zone has ≥2 faction context entries
- Players can see related quest items from zone view
- Faction panel doesn't break mobile layout (sidebar collapses)

---

### T1.3: Quest Items Page (Dedicated `/quests`)
**Status**: MEDIUM PRIORITY  
**Effort**: M (4-5 days for data + component)  
**Risk**: LOW (new page, isolated scope)  
**Dependencies**: T1.1 (need zone data), T1.2 (need faction context)  

- New route: `/quests` showing quest-line items per expansion
- Data structure: `quest-items.json`
  ```json
  {
    "expansion": "Classic",
    "quest_lines": [
      {
        "questName": "Fire Giant Kunark",
        "steps": [
          {"item": "Singing Steel Breastplate", "zone": "Field of Bone", "description": "Dropped by Bone Lord", "bucket": 3 },
          {"item": "Ancient Bronze Bracer", "zone": "Dreadlands", "description": "Camp Karnor's Castle guards" }
        ]
      }
    ]
  }
  ```
- UI: Accordion-style quest cards, show item loot location (zone + mob), collect-path
- Allow filtering by quest type (class epic, tradeskill, prestige)
- Link to item details drawer on click
- Prioritize Classic Fire Giant quests, Kunark epics (1.0) for Tier 2

**Acceptance Criteria**:
- ≥15 quest chains discoverable on page
- Each quest step has zone + item source
- Mobile accordion collapses properly

---

### T1.4: Discord Rich Embeds (Shareable Preview Cards)
**Status**: MEDIUM PRIORITY  
**Effort**: M (3-4 days for metadata + Open Graph setup)  
**Risk**: LOW (standard Next.js metadata pattern)  
**Dependencies**: None (no data dependency)  

- When a player shares a link to an item or zone, Discord shows rich preview:
  - Zone view link → image preview of zone loot, mobs count, bucket summary
  - Item search result → item icon, bucket info, drop rate estimate
  - Favorites page → "Check out my favorites" card with bucket icons
- Implementation:
  - Update layout.tsx and page routes to set dynamic `og:image`, `og:description`
  - Use API route `/api/og` to generate simple metadata (or static images)
  - Add Twitter card metadata for X.com shares
- Start simple: reuse bucket-color badges, item icons (already have icon pipeline)

**Acceptance Criteria**:
- Share zone link → Discord shows zone name, mob count, expansion color
- Share item → Discord shows item name, icon (if available), bucket affinity
- Twitter card metadata present

---

### T1.5: Raid Bosses Loot Integration (Optional, High-Value)
**Status**: LOW PRIORITY (nice-to-have)  
**Effort**: L (5-7 days for data + UI)  
**Risk**: MEDIUM (raid loot data sparse, manual curation required)  
**Dependencies**: T1.1 (zones must be stable first)  

- Current `/raids` page is informational only (shows boss names, tiers, zones)
- Extend to show raid loot drops:
  - For each raid boss, list possible loot buckets (currently in classic-raid.json, kunark-raid.json)
  - Show item list per boss (cross-reference item-details.json)
  - Add "Best For" selector (show me raid loot for my class/archetype)
- This is *secondary* to group named — defer if T1.1-T1.4 not complete by week 2
- If skipped: add note to `/raids` page: "Raid loot details coming soon"

**Acceptance Criteria**:
- Raid boss cards show ≥5 possible loot items each
- Item source is traceable (boss → loot bucket)
- Doesn't break raid tier view

---

## Tier 2: First Month Post-Launch

**Goal**: Support mid-game progression and expand from Classic to multi-expansion gameplay.

### T2.1: Verify Kunark & Velious Data
**Status**: CRITICAL PATH  
**Effort**: L (7-10 days for audit)  
**Risk**: HIGH (Kunark/Velious zones are complex, more mobs, harder to verify)  
**Dependencies**: T0.2 (Classic verification methodology)  

- Mirror T0.2 process but for Kunark + Velious expansions
- Audit kunark-group-named.json and velious-group-named.json:
  - Check 15-20 zones per expansion (more zones than Classic)
  - Verify bucket assignments (loot should shift between expansions)
  - Validate level ranges (Kunark mobs 20-65, Velious 40-65)
  - Cross-check with eqprogression zone guides
- Data sources: Allakhazam (already have scrape cache), eqprogression.com
- **Timeline assumption**: Kunark unlocks ~week 8-10 of server (June 2026). Start verification in week 4.
- Document audit results per zone in /docs/KUNARK_AUDIT.md, /docs/VELIOUS_AUDIT.md

**Acceptance Criteria**:
- Kunark & Velious data ≥90% accurate vs. live server
- All high-traffic zones verified (Veeshan's Peak, Sky, Sarnaks, etc.)
- Audit trail published

---

### T2.2: Epic 1.0 Quest Tracker
**Status**: MEDIUM PRIORITY  
**Effort**: M (4-6 days for data + component)  
**Risk**: MEDIUM (epic quests are faction-gated, complex progression)  
**Dependencies**: T1.3 (reuse quest structure), T2.1 (need Kunark data)  

- Dedicated tracker for Classic epic 1.0 quests (per class)
- Data structure: `epic-quests-classic.json`
  ```json
  {
    "expansion": "Classic",
    "epics": [
      {
        "class": "Paladin",
        "questName": "Holy Avenger",
        "phases": [
          {
            "phaseNum": 1,
            "steps": [
              {"item": "Boots of the Prophet", "zone": "Gukta", "dropFrom": "Guk Lord", "bucket": 5 },
              {"item": "Temple Plate Helmet", "location": "Quest give (Sir Jarlax)", "notes": "Faction requirement: Kaladim ally" }
            ]
          }
        ]
      }
    ]
  }
  ```
- UI: Epic selection dropdown, progress tracker, location map
- Link to loot sources (zone view, mob spawns)
- Prioritize Warrior, Paladin, Ranger, Cleric epics (high population classes)

**Acceptance Criteria**:
- ≥6 class epics trackable
- Each epic has ≥5 quest items with source locations
- Progress bar shows quest completion steps

---

### T2.3: Tradeskill & Recipes Page
**Status**: MEDIUM PRIORITY  
**Effort**: L (6-8 days for data + UI)  
**Risk**: MEDIUM (tradeskill data is dense, many items, complex sourcing)  
**Dependencies**: T1.1 (need loot data first)  
**Source**: eqprogression.com tradeskill guides, EQWiki recipe lists

- New page: `/recipes` (or `/tradeskills`)
- Data structure: `recipe-index.json`
  ```json
  {
    "expansion": "Classic",
    "tradeskills": [
      {
        "name": "Smithing",
        "recipes": [
          {
            "name": "Mithril Plate Armor",
            "level": 180,
            "components": [
              {"item": "Mithril Bar", "zone": "Field of Bone", "sourceNote": "Ore + High Quality Ore from ground spawns" }
            ],
            "produces": "Mithril Plate Armor"
          }
        ]
      }
    ]
  }
  ```
- Prioritize "TS leveling guides" (which recipes to make per level range)
- Link component sources to loot buckets if available
- Start with Smithing + Jewelry (most loot-dependent)

**Acceptance Criteria**:
- ≥50 recipes per expansion
- Each component has source location (zone, mob, ore spawn, etc.)
- Leveling path visible (recipe 1 → 10 → 20...)

---

### T2.4: Best-in-Slot Gear Comparator (By Class)
**Status**: MEDIUM PRIORITY  
**Effort**: L (7-9 days for data structure + UI)  
**Risk**: MEDIUM (requires EQ meta knowledge, class-specific optimization)  
**Dependencies**: T2.1 (need all expansion data)  

- New page: `/gear` or tab in zone view
- Compare loot across expansions to show "best available at level X"
- Data structure: `best-in-slot-by-class.json`
  ```json
  {
    "class": "Warrior",
    "BiS_at_level": [
      {
        "level": 50,
        "slots": {
          "head": { "item": "Helm of the Warlord", "bucket": 7, "zone": "Upper Guk", "ac": -25 },
          "chest": { "item": "Breastplate of Power", "bucket": 3, "zone": "Veeshan's Peak", "ac": -30 }
        }
      }
    ]
  }
  ```
- UI: Class selector, level slider, show current + BiS comparison
- Prioritize tank + DPS classes (Warrior, Ranger, SK, Monk)

**Acceptance Criteria**:
- BiS available for 4+ classes
- Gear recommendations show source zone + bucket
- Level slider works (shows gear for level 1-65+)

---

### T2.5: Leveling Guide Page
**Status**: MEDIUM PRIORITY  
**Effort**: M (5-6 days for content + component)  
**Risk**: LOW (informational page, no tight data dependencies)  
**Dependencies**: T1.1 (zone data helpful), T2.4 (BiS data)  

- New page: `/guides/leveling`
- Content structure: per-level-range recommendations
  ```
  Level 1-10: Newbie zones (Greater Faydark, Qeynos Hills)
  Level 11-20: Green cons (Oasis of Marr, Mistmoore Catacombs)
  Level 21-30: Blues (Qvic, Guk, PoMechanicus)
  ...
  Level 55-65: Raid prep (Veeshan's Peak, Planes)
  ```
- Add note: "Recommended loot buckets at each level" with links to zone view
- Include xp rate estimates (if sourced from EQWiki or eqprogression)
- No strict data dependency — can be written as markdown + UI component

**Acceptance Criteria**:
- All level ranges 1-65 covered
- Each range has zone recommendations + bucket links
- Includes XP/time estimates if available

---

## Tier 3: Long-Term Roadmap (Month 2+)

**Goal**: Build ecosystem features and prepare for future TLP servers and expansions.

### T3.1: Planes of Power (PoP) Progression Module
**Status**: LOW PRIORITY (Nice-to-have for mid-server)  
**Effort**: L (8-10 days for data)  
**Risk**: MEDIUM (PoP loot is complex, many keys/quest items)  
**Dependencies**: T2.1 (stable expansion data), T2.2 (epic quests established)  

- Dedicated PoP progression tracker (when server unlocks PoP, ~week 16-20)
- Data: PoP zone access quests, key requirements, raid progression order
- Focus: Keying quests, clear order, alternate farm strategies
- Skip raid loot for now (covered in T2.5), focus on access/keying

**Acceptance Criteria**:
- PoP zone access tree visible
- Key item sources documented
- Quest steps linked to item drops

---

### T3.2: Luclin/PoP Randomization Rules Documentation
**Status**: LOW PRIORITY  
**Effort**: M (3-4 days for research + documentation)  
**Risk**: LOW (informational, no code changes)  
**Dependencies**: None (async to development)  

- Research & document how loot randomization changes in Luclin/PoP
- Do bucket assignments shift? Are new buckets added?
- Publish findings in `/docs/RANDOMIZATION_RULES.md`
- Update site messaging if needed ("Kunark uses different bucket logic...")

**Acceptance Criteria**:
- Randomization rules documented for all expansions
- Site messaging updated to reflect changes

---

### T3.3: Public API / Data Export
**Status**: LOW PRIORITY (Nice-to-have for ecosystem)  
**Effort**: L (7-10 days for API design + routes)  
**Risk**: MEDIUM (need to manage API quota, caching, versioning)  
**Dependencies**: T2.1 (data must be stable)  

- Create REST API endpoints for external tools:
  - `GET /api/buckets` → all buckets + loot per expansion
  - `GET /api/zones/:zoneName` → zone mobs + loot
  - `GET /api/items/:itemName` → item details + all sources
  - `GET /api/quests/:expansion` → quest chains
- Add API documentation page: `/docs/api`
- Start with rate limiting (100 req/day free tier)
- Use Next.js API routes (/app/api/)

**Acceptance Criteria**:
- 3-5 key endpoints available
- API docs page published
- Examples for Discord bot developers

---

### T3.4: Progressive Web App (PWA) / Offline Mode
**Status**: LOW PRIORITY (Nice-to-have for mobile)  
**Effort**: L (6-8 days for service worker setup)  
**Risk**: MEDIUM (PWA caching can cause stale data issues)  
**Dependencies**: T2.1 (data must be stable)  

- Add service worker to cache site data
- Players can load `/` + zones offline on mobile
- Cache strategy: network-first for live data, cache fallback for historical
- Implement: `next-pwa` package or custom service worker
- Include manifest.json for installability (iOS + Android)

**Acceptance Criteria**:
- Site loads offline (cached data)
- Install prompt appears on mobile
- No stale data conflicts with live updates

---

### T3.5: Competitive Intelligence Dashboard (Optional)
**Status**: RESEARCH PHASE  
**Effort**: L (5-7 days for research + visualization)  
**Risk**: MEDIUM (depends on other TLP tools existing, may be feature creep)  

- Add `/compete` page showing how Frostreaver tool compares to:
  - eqprogression.com (zone guides, faction tracking)
  - Allakhazam (item database, comments)
  - EQWiki (quest chains, lore)
- Show feature matrix: "We have loot buckets, they don't" etc.
- Link to other tools where we're weak
- **Defer unless time permits in month 2+**

---

## Data Pipeline & Maintenance

### Ongoing Scripts & Automation

| Script | Purpose | Frequency | Owner |
|--------|---------|-----------|-------|
| `extract:item-names` | Pull item names from zone data | Ad-hoc | Dev |
| `enrich:zam` | Enrich items with Allakhazam stats | Weekly (or on-demand) | Dev |
| `validate:item-details` | Audit item-details.json for gaps | Weekly | QA |
| `rebucket:classic-group-named` | Rebucket mobs if server changes | As-needed | Dev |
| `apply:manual-corrections` | Apply community corrections | Weekly | Dev |
| `import:item-icons` | Fetch icons from ZAM/EQ | Monthly | Dev |

### Git Workflow for Tier 0-1 Timeline

```
main (deploy to prod after each commit)
  ├─ feature/T0-server-indicator
  ├─ feature/T0-classic-verification
  ├─ feature/T0-mobile-audit
  ├─ feature/T0-search-perf
  ├─ feature/T0-server-selector
  ├─ feature/T1-zone-population
  ├─ feature/T1-faction-context
  ├─ feature/T1-quests-page
  └─ feature/T1-discord-embeds

Deploy cadence: 1-2 features per day during Tier 0/1
```

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Inaccurate loot data** | Players lose trust, abandon site | T0.2 audit + community feedback channel (Discord) |
| **Performance degrades under load** | Site unusable at launch | T0.4 load testing, optimize search debounce, lazy-load expansions |
| **Mobile broken on launch** | Mobile players can't use site | T0.3 responsive audit + test on real devices |
| **Data becomes stale (patches, hot-fixes)** | Site misleads players on drop locations | Update scripts ready, Discord community channel for reports |
| **Kunark/Velious loot differs from live** | Mid-game confusion, lost confidence | T2.1 comprehensive audit, delay Kunark page until verified |
| **Feature scope creep (PRs, feature requests)** | Misses launch window | Strict prioritization: only Tier 0 + T1.1-T1.4 before Kunark unlock |

---

## Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| **Site Availability** | 99.5% uptime | Continuous |
| **Search Response Time** | <300ms average | Day 1 |
| **Mobile Usability Score** | ≥90 on Lighthouse | Day 1 |
| **Data Accuracy** | ≥95% match vs. live spawns (audit) | Day 1 (Classic), Week 4 (Kunark/Velious) |
| **Player NPS** | >8.0 (estimated via Discord polls) | End of Week 2 |
| **Favorites Adoption** | ≥40% of users have favorites list | End of Month 1 |
| **Page Views** | ≥10K daily by week 2 | Week 2 |
| **Return Visitor Rate** | ≥60% | Week 2 |
| **Zero Critical Bugs** | 0 production incidents blocking site | Continuous |

---

## Estimated Timeline

```
Weeks 1-2 (April 29 - May 12, ~2 weeks runway):
  Week 1 (Apr 29-May 5):
    Mon-Tue:  T0.1, T0.2 audit, T0.3 mobile test
    Wed-Thu:  T0.4 perf test, T0.5 server selector
    Fri-Sun:  Final QA, polish, prepare for launch
  
  Week 2 (May 6-12):
    Mon-Fri:  Buffer week, final verification, edge case testing
    Weekend:  Staging environment full deployment test

Week 3 (May 13-19, Launch Prep):
  Mon-Tue:  Final launch checklist, standby mode setup
  Wed-Thu:  Monitor for Daybreak announcements, prepare launch comms
  Fri-Sun:  Launch support standby

Week 4 (May 20-26, Launch Eve):
  Mon-Fri:  Launch-day readiness, incident response plan
  Weekend:  Final checklist verification

LAUNCH: May 27, 2026 12:00 PM PT

Week 1 Post-Launch (May 27 - June 2, Week 1):
  Mon-Fri:  T1.1 zone population, T1.2 faction context
  Weekend:  Iterate based on player feedback, handle hotfixes

Week 2 Post-Launch (June 3-9, Week 2):
  Mon-Wed:  T1.3 quests page, T1.4 Discord embeds
  Thu-Fri:  T1.5 optional raid loot (if bandwidth)
  Weekend:  QA + patch bugs

Weeks 3-4 (June 10-23):
  Parallel: T2.1 Kunark/Velious audit, T2.2 Epic quest tracker setup
  End of month: Deploy T2.x features as audits complete

Weeks 5+ (June 24+):
  T3.x features as time permits, monitor for patch impacts
```

---

## Technical Notes

### Architecture Constraints
- **No external APIs at launch**: All data is static JSON in `/data/` directory
- **Build-time optimization**: Next.js static generation (ISR) for all pages
- **CSS-only styling**: No Tailwind, no JS-driven layout (globals.css is source of truth)
- **Component reuse**: Maximize BucketCard, ItemDrawer, ZoneView components

### Component Dependencies (Existing)
- `SearchBox`: Powers universal-search (items + mobs + zones)
- `ZoneView`: Displays zone loot, mobs, buckets — reuse for T1.2-T1.4
- `ItemDrawer`: Item details panel — extend with faction/quest context
- `BucketCard`: Summary card — use in new pages (Quests, Recipes)
- `FavoritesProvider`: Persist user lists — leverage for progress tracking (epics, quests)

### Data Files to Create/Update
- ✏️ **classic-group-named.json** — Add metadata + verify
- ✏️ **kunark-group-named.json** — Audit + verify (T2.1)
- ✏️ **velious-group-named.json** — Audit + verify (T2.1)
- **faction-context.json** (T1.2) — NEW
- **quest-items.json** (T1.3) — NEW
- **epic-quests-classic.json** (T2.2) — NEW
- **best-in-slot-by-class.json** (T2.4) — NEW
- **recipe-index.json** (T2.3) — NEW

### Deployment Strategy
- **Host**: Vercel (auto-deploy from main branch, ~2 min)
- **CDN**: Vercel Edge Network (default)
- **Monitoring**: Vercel Analytics + Sentry (error tracking)
- **Failover**: Have ReadtheFAQ domain alias ready (fallback for DNS issues)

---

## Rollback Plan

If critical bug found post-launch:

1. **Immediate** (0-5 min): Disable affected feature via feature flag (add `if (NEXT_PUBLIC_FEATURE_X_DISABLED)`)
2. **Short-term** (5-30 min): Revert last commit to main, deploy
3. **Medium-term** (30-120 min): Hotfix branch, test locally, deploy
4. **Long-term**: Post-mortem + add to pre-launch checklist

Example: If T0.2 audit finds bad data → mark expansion as "Unverified" with notice

---

## Sign-Off & Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| Product Manager | (This document) | ⏳ Pending | 2026-04-29 |
| Dev Lead | Single Dev | ⏳ Pending | 2026-04-29 |
| QA | Community | ⏳ Pending | Day 1 (Discord) |

---

## Appendix: Related Documentation

- `/docs/PERFORMANCE.md` — Performance baseline metrics
- `/docs/KUNARK_AUDIT.md` — Kunark data verification checklist (T2.1)
- `/docs/VELIOUS_AUDIT.md` — Velious data verification checklist (T2.1)
- `/docs/RANDOMIZATION_RULES.md` — Loot randomization mechanics by expansion (T3.2)
- `/docs/API_DESIGN.md` — REST API spec (T3.3)

---

**Last Updated**: 2026-04-29  
**Launch Date**: May 27, 2026 12:00 PM PT  
**Next Review**: 2026-05-27 (Launch day)
