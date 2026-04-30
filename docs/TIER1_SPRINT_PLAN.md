# Tier 1 Sprint Plan: Week 1-2 Post-Launch
## Frostreaver Launch Plus (June 3-16, 2026)

**Launch Date**: May 27, 2026 12:00 PM PT  
**Sprint Window**: Week 1-2 post-launch (June 3-16)  
**Goal**: Deploy 4-5 major features that drive engagement and support active farming  
**Capacity**: ~50-60 hours over 2 weeks (~4-5 hrs/day, 5 days/week)  
**Deploy Cadence**: 1 feature per 2-3 days (6 working days per week if sustainable)  
**Success Metric**: ≥50% player adoption of new features by June 16

---

## Sprint Overview

| Feature | Owner | Est. Effort | Risk | Priority | Target Date |
|---------|-------|------------|------|----------|-------------|
| T1.1: Zone Population (Extended Data) | Dev | L (5-7d) | MEDIUM | P0 | May 10 |
| T1.2: Faction Context | Dev | L (6-8d) | MEDIUM | P1 | May 13 |
| T1.3: Quests Page | Dev | M (4-5d) | LOW | P1 | May 17 |
| T1.4: Discord Embeds | Dev | M (3-4d) | LOW | P2 | May 19 |
| T1.5: Raid Loot (Optional) | Dev | L (5-7d) | MEDIUM | P3 | Defer if needed |

**Total effort**: 25-35 days (compresses to 14 days with parallel work)

---

## Week 1: June 3-9 (Post-Launch Consolidation)

**Theme**: "Expand Classic Coverage + Community Tools"
**Note**: Server has been live for 7 days; monitor stability and player feedback before major features

### Daily Standup Format
**Time**: 9 AM (async Discord post)
**Format**:
```
Monday, May 6:
- Yesterday: [yesterday work]
- Today: [today focus]
- Blockers: [if any]
- ETA for next ship: [date]
```

### Monday, June 3 (Start T1.1)

**Goal**: Begin Classic zone population audit; plan faction data structure

#### T1.1.1: Zone Expansion Audit (Day 1 of 5-7)
**Time commitment**: 5-6 hours

**Tasks**:
- [ ] Review current classic-group-named.json zone count
  - Count how many zones currently populated
  - Goal: Expand to 22+ zones by May 10
- [ ] Identify gaps:
  - [ ] Create list of "missing zones" vs. Allakhazam
  - [ ] Prioritize: high-traffic zones first (Qvic, Highpass Hold, Mistmoore, Upper Guk)
  - [ ] Assign effort estimate per zone (S/M/L)
- [ ] Run item-name extraction script on ~5 zones:
  ```bash
  npm run extract:item-names -- --zones=["Qvic", "Highpass Hold", "Mistmoore"]
  ```
- [ ] Manually spot-check Allakhazam pages for those zones
  - Count mobs
  - Verify bucket assignments
  - Check loot drops
- [ ] Begin updating classic-group-named.json with new zones

**Deliverable**: +3 zones added to JSON, audit checklist started

---

#### T1.2.1: Faction Data Structure Planning (Day 1 of 6-8)
**Time commitment**: 2-3 hours (parallel)

**Tasks**:
- [ ] Design faction-context.json schema:
  ```json
  {
    "expansion": "Classic",
    "zones": [
      {
        "zone": "Field of Bone",
        "regionName": "Kunark",
        "level_range": "45-55",
        "factions_touched": [
          {
            "faction_name": "Kaladim Dwarves",
            "relationship": "ally",
            "notes": "Quest hub for epic/paladin upgrades",
            "quest_items": ["Singing Steel Breastplate", "Ancient Bronze Bracer"],
            "impact": "high"
          }
        ],
        "hazards": "Dragons, evil mobs, tough spawns",
        "best_for": ["Warriors", "Paladins", "Clerics"]
      }
    ]
  }
  ```
- [ ] Research 3-5 Classic zones' faction implications:
  - Field of Bone (Kaladim, Sky)
  - Qvic (Kunark access)
  - Mistmoore (evil faction, newbie quest)
  - Plane of Sky (faction quest hub)
  - Temple of Solusek Ro (Fire giants, epic quests)
- [ ] Sources to research:
  - eqprogression.com faction pages
  - EQWiki: [Zone Name] faction requirements
  - GameplayQuest database
- [ ] Create `/data/faction-context.json` stub (empty zones array)
- [ ] Document research findings in notes

**Deliverable**: faction-context.json schema designed, 3-5 zones researched

---

### Tuesday, June 4 (Continue T1.1 + T1.2)

**Goal**: Accelerate zone population; begin faction context component

#### T1.1.2: Zone Expansion (Day 2 of 5-7)
**Time commitment**: 5-6 hours

**Tasks**:
- [ ] Continue adding zones to classic-group-named.json
  - Target: +5 more zones today (Kaladim, Paineel, High Keep, Oasis, Befallen)
  - Reuse research from weekend
  - Validate each zone: ≥5 mobs, ≥2 loot items per mob
- [ ] Run enrich:zam script on new zones:
  ```bash
  npm run enrich:zam -- --zones=["Kaladim", "Paineel", "High Keep", "Oasis of Marr", "Befallen"]
  ```
- [ ] Manually verify items exist in item-details.json
  - If missing: mark as `"is_placeholder": true` (for T1 scope, don't block)
- [ ] Update JSON: `zones_covered: 15/25`

**Deliverable**: +5 zones added, total 8/25 zones audited

---

#### T1.2.2: Faction Context UI Component (Day 1 of 2-3)
**Time commitment**: 4-5 hours

**Tasks**:
- [ ] Create component: `/components/ZoneFactionContext.tsx`
  - Display faction info in sidebar or expandable panel
  - Show faction name, impact level, related quest items
  - Responsive: stack on mobile
- [ ] Add to ZoneView component (import + render)
  - Place below zone header, above mob list
  - Only show if factions exist for zone
- [ ] Style with globals.css (reuse expansion-tone colors):
  - Faction panels: light background, left border
  - Icons/badges: faction affinity color
- [ ] Dark mode support (check CSS variables)

**Deliverable**: ZoneFactionContext component functional

---

### Wednesday, June 5 (Finish T1.1, continue T1.2)

**Goal**: Complete Classic zone population; faction data halfway done

#### T1.1.3: Zone Expansion Final Pass (Day 3-4 of 5-7)
**Time commitment**: 5-6 hours

**Tasks**:
- [ ] Add 5-7 more zones (Crypt of Decay, Gorge, Hate, Fear, Cazic, Permafrost, Solusek)
- [ ] Total zones by EOD: 15-20
- [ ] Quality check:
  - [ ] All zones have ≥3 buckets
  - [ ] All buckets have ≥1 item
  - [ ] No duplicate mobs in same zone
  - [ ] Level ranges sensible (increasing with zone difficulty)
- [ ] Run performance baseline again: does search still <300ms with more data?
  - If slow: profile and optimize
- [ ] Test search for items across zones:
  - Search "boots", verify results show multiple zones
  - Search zone name, verify mobs appear

**Deliverable**: 15-20 zones populated, search perf verified

---

#### T1.2.3: Faction Context Data Population (Day 2 of 6-8)
**Time commitment**: 4-5 hours

**Tasks**:
- [ ] Populate faction-context.json with 10-15 zones:
  - Field of Bone, Qvic, Mistmoore, Plane of Sky, Kaladim, Paineel, High Keep, Oasis, Befallen, Crypt, Gorge, Hate, Fear, Cazic, Permafrost
- [ ] Research + document faction implications per zone
- [ ] Add quest items for each faction (link to item-details.json)
- [ ] Save to `/data/faction-context.json`
- [ ] Verify JSON syntax (no parse errors)

**Deliverable**: 10-15 zones with faction context, faction-context.json complete (classic only)

---

### Thursday, June 6

**Goal**: Launch T1.1 + T1.2 features

#### T1.1.4: Zone Population Final QA (Day 4-5 of 5-7)
**Time commitment**: 3-4 hours

**Tasks**:
- [ ] Spot-check all 18-20 zones:
  - 2-3 items per zone, verify vs. Allakhazam
  - 95%+ match rate acceptable
- [ ] Update metadata in classic-group-named.json:
  ```json
  {
    "expansion": "Classic",
    "last_updated": "2026-05-09",
    "zones_populated": 20,
    "zones_total": 25,
    "completeness": "80% coverage, 5 zones pending"
  }
  ```
- [ ] Run full test suite:
  - [ ] Search all zones, verify results
  - [ ] Zone view loads for 5 random zones
  - [ ] Filter by expansion works
  - [ ] No console errors
- [ ] Deploy to prod (git commit + Vercel auto-deploy)

**Deliverable**: T1.1 shipped, 18-20 classic zones fully populated

---

#### T1.2.4: Faction Context Component Launch (Day 3 of 6-8)
**Time commitment**: 3-4 hours

**Tasks**:
- [ ] Integrate ZoneFactionContext into ZoneView page
  - Render after zone header, before mob list
  - Only show if factions exist for zone
  - Responsive on mobile (collapse to accordion)
- [ ] Test on all 15 zones with faction data:
  - [ ] Field of Bone → shows Kaladim, Sky factions
  - [ ] Qvic → shows Kunark access info
  - [ ] Plane of Sky → shows quest hub context
- [ ] Dark mode + light mode rendering
- [ ] Mobile responsive check
- [ ] No layout shift or jank
- [ ] Deploy to prod

**Deliverable**: T1.2 shipped, faction context live for 15 classic zones

---

#### Communication
**Post to Discord**:
```
🚀 TIER 1 FEATURES LIVE!

This week we shipped:
1. Zone Population Expansion: 20 Classic zones now fully mapped (up from 18)
2. Faction Context: See which quest hubs & faction requirements apply to each zone

Next up (Week 2): Quests page, Discord embeds, Raid loot detail

Feedback? Reply here or DM AuthorityGames
```

---

### Friday, June 7 (Start T1.3)

**Goal**: Begin Quests page development

#### T1.3.1: Quest Data Structure Design (Day 1 of 4-5)
**Time commitment**: 4-5 hours

**Tasks**:
- [ ] Design quest-items.json schema:
  ```json
  {
    "expansion": "Classic",
    "questLines": [
      {
        "id": "firegiants_1_0",
        "questName": "Fire Giant Quest (Kunark Epic 1.0)",
        "class": "Multiple",
        "difficulty": "hard",
        "steps": [
          {
            "stepNum": 1,
            "itemNeeded": "Singing Steel Breastplate",
            "zone": "Field of Bone",
            "dropFrom": "Karnor's Castle guards",
            "bucket": 3,
            "notes": "Rare drop, high competition"
          }
        ]
      }
    ]
  }
  ```
- [ ] Identify "evergreen" quests for Classic:
  - Fire Giant quest (multi-class)
  - Sleeper quests
  - Kunark attunement
  - Lord Nagafen loot quest
  - Elemental planes key quests
- [ ] Research 3-5 main quest chains via EQWiki, eqprogression
- [ ] Create `/data/quest-items-classic.json` (stub, empty questLines)

**Deliverable**: quest-items.json schema designed

---

#### T1.3.2: Create Quests Page Component (Day 1-2 of 4-5)
**Time commitment**: 3-4 hours

**Tasks**:
- [ ] Create `/app/quests/page.tsx`:
  - Import quest data
  - Show quest selector dropdown
  - Display quest steps in order
  - Link each item to zone view + loot bucket
- [ ] Create `/components/QuestTracker.tsx`:
  - Accept questLine prop
  - Render steps as cards/list
  - Show item name, zone, dropFrom mob
  - Add progress indicator (step X of Y)
  - Clickable items → open ItemDrawer
- [ ] Style with globals.css:
  - Quest cards: light background, left border (expansion tone)
  - Step counter: muted text
  - Item links: accent color on hover

**Deliverable**: Quests page & tracker component functional (no data yet)

---

### Saturday, June 8 (Weekend, light work)

**Optional catch-up**:
- [ ] Populate 5-10 quests into quest-items-classic.json
- [ ] Test Quests page with sample data
- [ ] Create usage documentation

---

## Week 2: June 10-16 (Feature Completion)

**Theme**: "Player Engagement Tools + Expansion Data"

### Monday, June 10 (Finish T1.3, start T1.4)

**Goal**: Complete Quests page; begin Discord embeds

#### T1.3.3: Quest Data Population (Day 2-3 of 4-5)
**Time commitment**: 5-6 hours

**Tasks**:
- [ ] Populate 15-20 quest chains into quest-items-classic.json:
  - Fire Giant (multi-class epic)
  - Ranger epics (3 chains)
  - Paladin epics (3 chains)
  - Cleric epics (2 chains)
  - Sleeper quest chain
  - Kunark attunement quest
  - Velious attunement prep
- [ ] Cross-reference each item with classic-group-named.json + item-details.json
  - Link item → zone → bucket
  - Verify mob names match
- [ ] Validate JSON structure (no parse errors)

**Deliverable**: 15-20 quests populated, tested

---

#### T1.3.4: Quests Page Launch (Day 3-4 of 4-5)
**Time commitment**: 3-4 hours

**Tasks**:
- [ ] Final QA:
  - [ ] Load page, quest dropdown populates
  - [ ] Select quest → steps display in order
  - [ ] Click item → ItemDrawer opens
  - [ ] Click zone → navigates to zone view
  - [ ] Mobile responsive (accordion on narrow)
  - [ ] No console errors
- [ ] Update nav to include Quests link:
  - [ ] Add `/quests` to app-nav-links in layout.tsx
- [ ] Deploy to prod

**Deliverable**: T1.3 shipped, Quests page live with 15-20 quest chains

---

#### T1.4.1: Discord Embed Setup (Day 1 of 3-4)
**Time commitment**: 4-5 hours

**Tasks**:
- [ ] Add Open Graph metadata generation:
  - [ ] Update `app/layout.tsx`:
    ```typescript
    export const metadata: Metadata = {
      title: "Frostreaver Loot Buckets",
      description: "...",
      openGraph: {
        title: "Frostreaver Loot Buckets",
        description: "Random loot bucket analysis for EverQuest Frostreaver TLP",
        type: "website",
        locale: "en_US",
      },
    };
    ```
- [ ] Create API route `/app/api/og/route.ts` (optional, for dynamic images):
  - Accept query params: type (zone/item/bucket), id
  - Generate simple metadata response (JSON)
  - Example: `/api/og?type=zone&zone=Field%20of%20Bone` → returns zone summary
- [ ] Add Twitter card metadata:
  ```typescript
  twitter: {
    card: "summary",
    site: "@AuthorityGames",
    creator: "@AuthorityGames",
  },
  ```
- [ ] Test on Discord by sharing a zone link:
  - Post link in test Discord server
  - Verify embed preview appears

**Deliverable**: Open Graph + Twitter metadata functional

---

### Tuesday-Wednesday, June 11-12

**Goal**: Complete Discord embeds; catch up on optional work

#### T1.4.2: Zone-Specific Embeds (Day 2 of 3-4)
**Time commitment**: 3-4 hours

**Tasks**:
- [ ] Create dynamic metadata for zone pages:
  - [ ] Extend ZoneView page to export dynamic metadata:
    ```typescript
    export async function generateMetadata({ params }, parent) {
      const zone = params.zone;
      return {
        title: `${zone} Loot | Frostreaver`,
        description: `${zone} mob spawns and loot buckets. Bucket analysis for group named farming.`,
        openGraph: {
          title: `${zone} Group Named Loot`,
          description: `Loot bucket breakdown for ${zone} on Frostreaver TLP`,
          images: [{ url: "/og-zone.png" }], // Static image for now
        },
      };
    }
    ```
  - Caveat: Zone pages don't have dynamic routes yet (would require `/zones/[name]` route)
  - Fallback: Use homepage metadata for zone links (Discord preview is still good)
- [ ] Item search results sharing:
  - [ ] When user searches item, add metadata about the item
  - [ ] Share link like `/items/Singing Steel Breastplate`
  - [ ] Requires new route: `/app/items/[itemName]/page.tsx`
  - [ ] Scope: If time; else defer to post-launch
- [ ] Test sharing links on Discord/X

**Deliverable**: Zone/item embeds sharable, preview working

---

#### T1.5 (Optional): Raid Loot Integration (Day 1 of 5-7)
**Time commitment**: 3-4 hours (if starting)

**Tasks**:
- [ ] Review current `/raids` page
  - What data already exists (raid-boss-cards)?
  - What's missing (item loot)?
- [ ] Design raid-loot-mapping.json:
  ```json
  {
    "expansion": "Classic",
    "raids": [
      {
        "tier": "Dragons",
        "bosses": [
          {
            "name": "Nagafen",
            "zone": "Solusek's Eye",
            "loot_buckets": [1, 3, 5],
            "loot_items": ["Breath of Nagafen", "Dragon Scale Aegis", ...]
          }
        ]
      }
    ]
  }
  ```
- [ ] Decide: High priority for Week 2 or defer to T3?
  - If defer: Add note to `/raids` page: "Raid loot details coming June 2026"

---

### Thursday-Friday, June 13-14

**Goal**: Final T1 launch + prepare for Kunark transition

#### T1.4.3: Discord Embeds Final Polish (Day 3 of 3-4)
**Time commitment**: 2-3 hours

**Tasks**:
- [ ] Share test links on Discord + X:
  - [ ] Zone link: `/` with zone filter
  - [ ] Item search: `/` with search query
  - [ ] Favorites page: `/favorites`
- [ ] Verify embed previews show:
  - [ ] Title + description
  - [ ] Image (if applicable)
  - [ ] Expansion color/tone
- [ ] Fix any metadata rendering issues
- [ ] Deploy to prod

**Deliverable**: T1.4 shipped, Discord/X embeds live

---

#### End-of-Week 2 Communication
**Post to Discord**:
```
✨ WEEK 2 FEATURES LIVE!

Shipped this week:
1. Quests Page: Track 20+ quest chains (epics, attuning, key quests)
2. Discord Rich Embeds: Share zone/item links and see beautiful previews

By the numbers:
- Zone Population: 20/25 Classic zones mapped
- Faction Context: 15 zones with quest hub info
- Quest Chains: 20 trackable multi-step quests
- Mobile: 100% responsive across all features

Next priorities (based on your feedback):
- Kunark/Velious data verification (starting May 20)
- Raid loot details (targeting June)
- Tradeskill recipes (targeting late June)

Got feedback? DM AuthorityGames or check #feedback channel
```

---

## Data Pipeline Tasks (Parallel to Development)

### Daily Data Maintenance
- [ ] Monitor player feedback on incorrect loot locations (Discord)
- [ ] Test 2-3 items per day in live game
- [ ] If errors found: create GitHub issue for fix priority
- [ ] Update `/docs/DATA_ISSUES.md` with known bugs

### Weekly Data Sync
- [ ] Run `npm run validate:item-details` (Fri)
- [ ] Check for missing items in buckets
- [ ] Spot-check 5-10 items vs. live server
- [ ] Document findings

### Kunark Prep (Week 2 evening)
- [ ] Start Kunark data audit (for T2.1 in week 4)
- [ ] Run extraction scripts on Kunark zones
- [ ] Begin spot-checking vs. live server
- [ ] Prepare for transition when Kunark unlocks

---

## Resource Estimates

| Resource | Usage |
|----------|-------|
| **Development time** | 50-60 hours (25-35 days compressed to 14) |
| **Testing time** | 8-10 hours (mobile + live server validation) |
| **Data curation** | 15-20 hours (quest research, faction lookup, zone audits) |
| **Documentation** | 3-5 hours (inline code comments, /docs updates) |
| **Total** | ~80-95 hours over 2 weeks |

**Daily commitment**: 4-5 hours per day (focus time, no interruptions)

---

## Success Criteria (By May 19)

- [ ] T1.1 shipped: 20+ Classic zones populated ✓
- [ ] T1.2 shipped: Faction context for 15 zones ✓
- [ ] T1.3 shipped: Quests page with 15-20 quest chains ✓
- [ ] T1.4 shipped: Discord rich embeds functional ✓
- [ ] Zero critical bugs on production
- [ ] Player feedback sentiment: >80% positive (Discord polls)
- [ ] Mobile responsiveness: 100% of features accessible on mobile
- [ ] Performance: Search <300ms, page load <3 sec
- [ ] Data accuracy: 95%+ match vs. live server (spot check)

---

## Notes for Next Sprint (Week 3+)

### Immediate Priorities (Week 3)
- T2.1: Kunark/Velious audit (no new features, just data verification)
- T1.5: Raid loot if time allows

### Week 4 Target
- T2.2: Epic 1.0 tracker
- T2.3: Recipes page (start data research)

### Monitor for
- Player feature requests (weight by vote count)
- Data bugs (prioritize high-traffic zones)
- Performance degradation (as data grows)
- Mobile edge cases (report via Discord)

---

**Last Updated**: 2026-04-29 (Updated for May 27 Launch)
**Launch Date**: May 27, 2026 12:00 PM PT  
**Sprint Duration**: June 3-16, 2026 (2 weeks post-launch)  
**Owner**: AuthorityGames (Single Dev)  
**Status**: Ready for execution post-launch
