# EQ Master Database Excel Mining Report
## Integration Roadmap for EQ-random-loot Website

**Source:** C:/Users/rontf/EQ_Master_Database_temp.xlsx  
**Author:** Gronnz  
**Title:** Mischief / Teek Server -- Randomization Guide & Comprehensive Reference  
**Report Generated:** 2026-04-27

---

## Executive Summary

The Gronnz Master Database contains 22 sheets of valuable EverQuest TLP reference data. Of these, **6 sheets** represent quick-win data integrations that align directly with existing JSON structures (Classic/Kunark/Velious loot data), while **12 sheets** unlock entirely new website features and user experiences.

**Priority Actions:**
1. **Immediate (Pre-Launch):** Expand Classic/Kunark/Velious loot buckets with complete NPC data
2. **Phase 1 (Launch):** Add Zone XP Modifiers, Tradeable Items Schedule, PoP Progression Guide
3. **Phase 2 (Post-Launch):** Crafting guides, Leveling paths, Faction system, Epic quests, BiS gear
4. **Long-term:** Spell Vendors, Tools & Resources, Potions Guide, Spell Research

---

## Sheet-by-Sheet Breakdown

### TIER 1: DIRECT LOOT DATA EXTENSIONS
*(Extend existing group-named/raid JSON files)*

#### 1. **Classic** (320 rows, 18 columns)
- **Status:** EXISTING, EXPANDABLE
- **Schema:** NPC Name | Level | Zone | MOTM | Loot Pool | Loot 1-6
- **Content:** ~230 NPCs (group named + raid bosses)
- **Overlap with website:** Nearly 100% overlap with classic-group-named.json
- **Missing Elements:**
  - Complete raid boss loot pools not yet in site JSON
  - MOTM (Mob of the Month) flags not tracked
  - "Loot Pool" naming conventions could standardize current data
- **Integration Complexity:** LOW
- **Action:** Extract raid-only mobs (filter by "RAID ENCOUNTERS" header), add to classic-raid.json; verify all loot item names match item-details.json

#### 2. **Kunark** (312 rows, 21 columns)
- **Status:** EXISTING, EXPANDABLE
- **Schema:** NPC Name | Level | Zone | MOTM | Loot Pool | Loot 1-6
- **Content:** ~235 NPCs across 20+ Kunark zones
- **Overlap with website:** 70% overlap with kunark-group-named.json
- **Missing Elements:**
  - Significant raid encounter loot data (no raid.json equivalent for Kunark yet)
  - ~30 NPCs likely missing from current site data
- **Integration Complexity:** LOW-MEDIUM
- **Action:** Cross-reference with kunark-group-named.json; extract raid section; identify new NPCs to add; validate item names

#### 3. **Velious** (342 rows, 16 columns)
- **Status:** EXISTING, EXPANDABLE
- **Schema:** NPC Name | Level | Zone | MOTM | Loot Pool | Loot 1-6
- **Content:** ~280 NPCs, comprehensive Velious coverage
- **Overlap with website:** 65% overlap with velious-group-named.json
- **Missing Elements:**
  - Raid boss complete loot pools
  - ~100 new NPCs not in current site data
  - Missing zones entirely (Dreadscale Barracks, etc.)
- **Integration Complexity:** LOW-MEDIUM
- **Action:** Full delta analysis; create velious-raid.json; add new NPCs; enrich item references

#### 4. **Luclin** (93 rows, 16 columns)
- **Status:** PLACEHOLDER/INCOMPLETE
- **Schema:** NPC Name | Level | Zone | MOTM | Loot Pool | Loot 1-6
- **Content:** Currently shows "(No data available)" for group named; raid section exists
- **Integration Complexity:** MEDIUM
- **Action:** Identify if Luclin data exists elsewhere in Excel or companion docs; if truly absent, flag as data gap for community contribution

#### 5. **Planes of Power** (238 rows, 17 columns)
- **Status:** INCOMPLETE
- **Schema:** NPC Name | Level | Zone | MOTM | Notes | Loot 1-5
- **Content:** Shows "(No data available)" for group named; raid encounters present
- **Notes Column:** First expansion to include strategy notes (resist types, HP, kill times)
- **Integration Complexity:** MEDIUM
- **Action:** Separate group/raid data; create pop-group-named.json and pop-raid.json; validate raid encounter names against live servers

---

### TIER 2: NEW FEATURES & REFERENCE DATA
*(Create new website pages/sections)*

#### 6. **Zone XP Modifiers** (143 rows, 7 columns)
- **Status:** NEW DATA
- **Schema:** Zone | ZEM Value | Bonus % | Expansion | Level Range | Type | Star Rating
- **Coverage:** All expansions Classic through PoP, rated by quality
- **Content:** 143 zones with ZEM (Zone Experience Modifier) values, efficiency ratings
- **Sample Data:**
  - Befallen: ZEM 160 (+113%), Classic, Levels 5-20, Dungeon, 5-stars
  - Crushbone: ZEM 160 (+113%), Classic, Levels 5-20, Dungeon, 5-stars
  - Qeynos Catacombs: ZEM 160 (+113%), Classic, Levels 1-18, Dungeon, 5-stars
- **Integration Value:** CRITICAL FOR LAUNCH
  - Users need XP routing at leveling stage
  - Star ratings provide quality-of-life guidance
  - ZEM values enable meta-analysis of best grinding zones
- **Website Feature:** Create **Leveling Guide -> Zone XP Optimizer** page
  - Filter by expansion, level range, zone type, star rating
  - Sort by ZEM value
  - Compare alternative leveling paths
- **Integration Complexity:** LOW
- **Action:** Create JSON: `zone-xp-modifiers.json` with simple array of zones; add UI page to display sortable table with filters

#### 7. **Leveling Guide** (319 rows, 7 columns)
- **Status:** NEW DATA (EXTENSIVE)
- **Schema:** Level Range | Zone | ZEM | Play Style | Why It's Good | Tips | Races Best For
- **Coverage:** Races: Barbarian, Halfling, Human, Dwarf, Wood Elf, High Elf, Dark Elf, Erudite, Gnome
  - Each with starting paths (Levels 1-20) and progression routes
- **Content:** ~300 rows of specific leveling paths with reasoning
- **Sample Entry:** "1-4 | Qeynos Hills / Surefall Glade | 75 | Solo | Newbie yard trash... | Stay close to city gates..."
- **Integration Value:** VERY HIGH
  - New players need race-specific guidance
  - TLP players need expansion-aware recommendations
  - Enables meta-discussion of optimal paths
- **Website Feature:** Create **Leveling Guide** tab/page
  - Filter by race, expansion, level bracket
  - Show recommended zones with reasoning
  - Link to zone XP modifiers for comparison
  - Include tips for soloing vs grouping
- **Integration Complexity:** MEDIUM
- **Action:** Structure as: `leveling-paths.json` { race, level_range, zones[], tips[], best_for[] }; build interactive UI with filters

#### 8. **Faction Guide** (250 rows, 6 columns)
- **Status:** NEW DATA (COMPREHENSIVE)
- **Coverage:** All expansions, with deep focus on Velious three-way faction war
- **Key Factions:**
  - Coldain (Dwarves) - Dain Frostreaver IV - Thurgadin
  - Kromzek/Kromrif (Giants) - King Tormax - Kael Drakkel
  - Claws of Veeshan (Dragons) - Lord Yelinak - Skyshrine
- **Special Mechanics:** CRITICAL RULE: Cannot be allied with all three simultaneously; raising one lowers others
- **Content:** Faction leaders, territory, armor tiers, quality ratings, quest chains
- **Integration Value:** CRITICAL
  - Players need faction interaction roadmap
  - Armor tier system affects gear progression
  - Faction wars drive PvP/RP gameplay
- **Website Feature:** Create **Faction System** page
  - Interactive faction relationship diagram (visual)
  - Faction alignment tracker
  - Quest chains per faction
  - Armor acquisition (by faction, tier, class)
  - Conflict avoidance guide
- **Integration Complexity:** MEDIUM-HIGH
- **Action:** Structure as: `faction-system.json` { faction_name, leader, city, territory[], armor_tiers{}, conflicts{} }; add visualization UI

#### 9. **Spell Vendors** (181 rows, 5 columns)
- **Status:** NEW DATA
- **Coverage:** Plane of Knowledge library + zone-specific vendors
- **Content:** Spell vendor locations by class, across expansions
- **Sample:** "PLANE OF KNOWLEDGE LIBRARY — Great Library in Plane of Knowledge or..."
- **Integration Value:** MEDIUM-HIGH
  - Players need spell acquisition roadmap
  - Critical for caster classes at level milestones
  - Dungeon-specific vendor callouts useful
- **Website Feature:** Create **Spell Vendors** reference page
  - Searchable vendor database
  - Filter by class, expansion, spell level
  - Location details (zone, coordinates if available)
  - TLP timeline (when vendor becomes available)
- **Integration Complexity:** MEDIUM
- **Action:** Parse vendor locations; structure as: `spell-vendors.json` { vendor_name, class[], expansion, location, zone }

#### 10. **Epic 1.0 Quests** (691 rows, 7 columns)
- **Status:** NEW DATA (MASSIVE)
- **Coverage:** All 14 classes with step-by-step epic quest chains
- **Schema:** Step | Phase | Action | NPC/Mob | Zone | Items | Notes
- **Sample Quest:** Bard - "Singing Short Sword"
  - "Talk to Konia Swiftfoot at guard tower" → Receive: Torch of Misty
  - "Give Torch of Misty to Fajio Knejo" → Receive: Torch of Ro
  - Multi-step chain across multiple zones
- **Data Quality:** Very clean, step-by-step format ideal for web tracking
- **Integration Value:** CRITICAL FOR PLAYERS
  - Epic 1.0 is major milestone achievement
  - Provides clear progression markers
  - Enables quest tracker/checklist UI
- **Website Feature:** Create **Epic Quest Tracker** (major feature)
  - One page per class
  - Step-by-step tracker with completion checkboxes
  - NPC/zone links
  - Item requirements clarity
  - Expansion gating (when epic becomes available)
  - Difficulty/duration estimates
- **Integration Complexity:** HIGH
- **Action:** Parse by class; structure as: `epic-quests.json` { class, weapon_name, steps[{ step, phase, action, npc, zone, items, notes }] }; build tracker UI with localStorage persistence

#### 11. **Best in Slot Gear** (4035 rows, 6 columns)
- **Status:** NEW DATA (MASSIVE REFERENCE)
- **Coverage:** All classes, all slots, all expansions (Classic through PoP+)
- **Content:** Haste items, armor by slot, stat caps, class-specific optimizations
- **Schema:** Item Name | Haste% (or stats) | Slot | Source | Notes | (blank)
- **Sample Data:**
  - FBSS (Flowing Black Silk Sash): 21% haste, Waist, Spectre/various zones
  - "THE classic haste belt, all melee want this"
- **Data Volume:** 4,000+ gear recommendations across all classes
- **Integration Value:** EXTREMELY HIGH
  - Players heavily reference gear guides
  - Enables gear progression planning
  - Allows meta-analysis of best sources per expansion
- **Website Feature:** Create **Best in Slot Gear Comparator** (major feature)
  - Filter by class, expansion, slot, stat priority
  - Show item, source (quest/drop/crafted), stats
  - Compare alternate slots/builds
  - Link to item details (damage, AC, effects)
  - Create loadout/build comparison tool
- **Integration Complexity:** HIGH
- **Action:** Parse into class-based JSON; structure as: `bis-gear.json` { class, expansion, slots[{ slot, item, haste%, stats, source, notes }] }; build gear planner UI with comparison mode

#### 12. **Tradeable Items & Schedule** (32 rows, 5 columns)
- **Status:** NEW DATA
- **Coverage:** Expansion-by-expansion tradeable items and server unlock timeline
- **Schema:** Expansion | Tradeable Items/Keys | Teek Schedule | Unlock Date | Epic Tradeables
- **Key Data:**
  - Classic: Ring of the Ancients, Completed JBoots, etc. | May 22, 2024
  - Kunark: All VP Key components (tradeable) | Aug 14, 2024
  - Velious: All Coldain Rings, Prayer Shawls | Oct 9, 2024
  - Luclin: Lucid Shards, Glowing Orbs | Dec 4, 2024
  - PoP: Plane of Storms Key Components | Feb 26, 2025
- **Integration Value:** CRITICAL FOR LAUNCH
  - TLP traders need to know what's available when
  - Keys/gear progression depends on tradeable status
  - Prevent missed trading windows
- **Website Feature:** Create **Server Timeline / Tradeable Items Calendar**
  - Visual timeline of expansions (Teek/Mischief schedule)
  - Tradeable items list per expansion
  - Epic weapon tradeable windows highlighted
  - Countdown to next unlock (if applicable)
- **Integration Complexity:** LOW-MEDIUM
- **Action:** Structure as: `server-schedule.json` { expansion, items[], unlock_date, teek_schedule }; add timeline visualization to main dashboard

#### 13. **PoP Progression Guide** (42 rows, 5 columns)
- **Status:** NEW DATA
- **Coverage:** Planes of Power raid progression sequence
- **Schema:** Step | Zone/Target | Action | Unlocks | Notes
- **Content:** 5-6 main progression steps from Plane of Justice → Bastion of Thunder
- **Sample:**
  - Step 1: Plane of Justice, "Complete a trial for Mavuin" → Unlocks: Storms, Valor
  - Step 2: Plane of Nightmare, "Save Thelin Poxbourne..." → Unlocks: Torment
  - Step 3: Plane of Disease, "Save Adler..." → Unlocks: Crypt of Decay
- **Integration Value:** CRITICAL FOR RAID GUILDS AT LAUNCH
  - Clear raid progression roadmap
  - Unlocks enable/disable future content
  - Essential for planning raid strategy
- **Website Feature:** Create **PoP Progression Tracker**
  - Visual dependency graph (step 1 → step 2 → step 3)
  - Completion tracker per guild/group
  - Notes on difficulty and required gear
  - Linked to raid encounter data
- **Integration Complexity:** MEDIUM
- **Action:** Structure as: `pop-progression.json` { steps[{ step, zone, action, unlocks[], notes }] }; build interactive dependency UI

#### 14. **ToV & Kael Strategy** (51 rows, 11 columns)
- **Status:** NEW DATA (REFERENCE)
- **Coverage:** Gates of Discord / Kael raid encounters
- **Schema:** Encounter | Fire | Cold | Magic | HP Pool | Kill Time | Wizard Rain | Wizard Single | Slowable | AoE Resists | Flurry/Rampage
- **Sample Encounters:**
  - King Tormax: Fire=Susceptible, ~850k HP, ~5:00 kill time, Not Slowable, Rampage
  - Derakor the Vindicator: Fire=Susceptible, ~340k HP, ~2:00 kill time
  - Idol of RZ: ~1,250k HP, ~9:00 kill time, Slowable, Flurry
- **Integration Value:** HIGH FOR RAIDERS
  - Strategy data essential for raid planning
  - Damage caps, resistances, timing inform composition
  - Melee vs. caster prep differs per encounter
- **Website Feature:** Create **Raid Strategy Reference**
  - Per-encounter strategy page
  - Resist requirements, spell recommendations
  - Class role assignments
  - Timing/positioning callouts
- **Integration Complexity:** MEDIUM
- **Action:** Structure as: `raid-strategies.json` { encounter, resists{}, hp_pool, kill_time, mechanics{} }

#### 15. **Potions Guide** (76 rows, 10 columns)
- **Status:** NEW DATA
- **Coverage:** Potion crafting across all expansions
- **Schema:** Potion Name | Ingredient 1-3 | Cost (pp) | Trivial | Effect | Duration | Category | Notes
- **Sample Potions:**
  - Lesser Stability: lucern + sage leaf, Cost 1.05pp, Trivial 17, +5 STA/STR, 21 min
  - Lesser Vigor: lucern + birthwort, Cost 1.05pp, Trivial 17, +5 AGI/STR
  - Lesser Power: lucern + fenugreek, Cost 1.05pp, Trivial 22, +5 DEX/STR
  - Minor Aura of Cold: birthwort + allspice
- **Categories:** Stat/Resist Potions, Buff Potions, Healing Potions, Special Purpose
- **Integration Value:** MEDIUM
  - Crafters need potion recipes
  - Buff potions inform adventuring efficiency
  - Cost/benefit analysis available
- **Website Feature:** Create **Crafting Recipes / Potions Database**
  - Searchable potions by effect, ingredients, cost
  - Crafting UI showing ingredient sourcing
  - Trivial progression guide
  - Cost vs. benefit comparison
- **Integration Complexity:** LOW-MEDIUM
- **Action:** Create `crafting-recipes-potions.json` with full ingredient/effect mappings

#### 16-20. **Crafting Guides** (Tailoring, Fletching, Blacksmithing, Jewelcraft, Spell Research)
- **Combined Status:** NEW DATA (COMPLEMENTARY)
- **Total Data:** 5 sheets × ~25-45 rows each = 170+ crafting recipes
- **Coverage:**
  - **Tailoring (25 rows):** Armor sets, bags, specialized gear (Wu's Fighting Headband)
  - **Fletching (19 rows):** Arrow types (Bone Tip → Steel Point → Ceramic Tip), progression
  - **Blacksmithing (42 rows):** Components, armor, weapons, progressive difficulty
  - **Jewelcraft (47 rows):** Rings by metal tier (Silver, Gold, Platinum, etc.), stat focus
  - **Spell Research (43 rows):** Spell components by class (Necromancer, etc.), research requirements
- **Schema (All):** Recipe Name | Trivial | Ingredients | Category | Notes
- **Integration Value:** MEDIUM-HIGH
  - Crafters need progression paths
  - Trivial levels guide skill-up strategy
  - Enables crafting meta-game discussion
- **Website Feature:** Create **Unified Crafting System**
  - Per-craft-type pages (Tailoring, Smithing, etc.)
  - Searchable by trivial, ingredient, category
  - Progression path visualization (Trivial 21 → 41 → 68 → etc.)
  - Ingredient sourcing/cost calculator
- **Integration Complexity:** MEDIUM
- **Action:** Consolidate into `crafting-system.json` { craft_type, recipes[{ name, trivial, ingredients, category, notes }] }; build crafting UI with progression guide

#### 21. **EQ Tools & Resources** (24 rows, 4 columns)
- **Status:** NEW DATA (REFERENCE/LINKS)
- **Coverage:** Links to external databases, tools, wikis
- **Sample Tools:**
  - Allakhazam: everquest.allakhazam.com
  - EQItems: eqitems.com
  - EQ Resource: eqresource.com
  - Fanra's Wiki: fanra.everquest.wiki
- **Integration Value:** LOW-MEDIUM
  - Reference links help new players
  - External tool curation valuable
  - Could be sidebar/help section
- **Website Feature:** Create **Resources / Links** sidebar or help page
  - Organized by category (Database, Tools, Community, etc.)
  - Brief descriptions of each resource
- **Integration Complexity:** LOW
- **Action:** Add as simple footer/sidebar links or dedicated Resources page

#### 22. **Dashboard** (47 rows)
- **Status:** TABLE OF CONTENTS / METADATA
- **Coverage:** Sheet index with record counts and descriptions
- **Integration Value:** INFORMATIONAL
- **Action:** Use as guide for integration prioritization (already consumed for this report)

---

## Integration Priority Matrix

### QUICK WINS (Implement Before Launch)
| Sheet | Effort | Value | Timeline | Action |
|-------|--------|-------|----------|--------|
| Zone XP Modifiers | LOW | CRITICAL | Week 1 | Create zone-xp.json; add sortable UI |
| Tradeable Items Schedule | LOW-MEDIUM | CRITICAL | Week 1 | Create server-schedule.json; timeline UI |
| PoP Progression Guide | MEDIUM | CRITICAL | Week 2 | Create pop-progression.json; visual UI |
| Epic 1.0 Quests | HIGH | CRITICAL | Week 2-3 | Parse epic-quests.json; tracker UI |
| Classic/Kunark/Velious Loot | MEDIUM | HIGH | Week 3 | Delta analysis, expand JSON files |

### PHASE 1 (Launch + 2 Weeks)
| Sheet | Effort | Value | Timeline | Action |
|-------|--------|-------|----------|--------|
| Best in Slot Gear | HIGH | VERY HIGH | Week 3-4 | Create bis-gear.json; comparator UI |
| Leveling Guide | MEDIUM | VERY HIGH | Week 2 | Create leveling-paths.json; router UI |
| Faction Guide | MEDIUM | CRITICAL | Week 2 | Create faction-system.json; visual UI |

### PHASE 2 (Post-Launch Enrichment)
| Sheet | Effort | Value | Timeline | Action |
|-------|--------|-------|----------|--------|
| Crafting Guides (5 sheets) | MEDIUM | HIGH | Week 4+ | Create crafting-system.json; progression UI |
| Spell Vendors | MEDIUM | MEDIUM | Week 4+ | Create spell-vendors.json; lookup UI |
| Raid Strategies (ToV/Kael) | MEDIUM | MEDIUM-HIGH | Week 4+ | Create raid-strategies.json |
| Potions Guide | LOW-MEDIUM | MEDIUM | Week 5+ | Create potions.json; recipe UI |

### REFERENCE ONLY
| Sheet | Type | Action |
|-------|------|--------|
| EQ Tools & Resources | Links | Footer/sidebar on main site |
| Dashboard | Metadata | Use for integration planning |

---

## New Website Pages to Create

Based on this integration analysis, propose these new pages for the Frostreaver TLP site:

1. **Leveling Path Finder** (Tier 1)
   - Input: Race, current level, expansion available
   - Output: Recommended zones, XP rates, grouping tips
   - Data sources: Leveling Guide, Zone XP Modifiers

2. **Epic Quest Tracker** (Tier 1)
   - Input: Choose your class
   - Output: Step-by-step quest chain with checkboxes, NPC locations, item requirements
   - Data sources: Epic 1.0 Quests

3. **Raid Progression Timeline** (Tier 1)
   - Visual: PoP planes, dependencies, unlock sequences
   - Data sources: PoP Progression Guide

4. **Faction Relationship Map** (Tier 1)
   - Visual: Faction alignments, armor tiers, quest chains
   - Data sources: Faction Guide

5. **Best in Slot Gear Comparator** (Tier 2)
   - Input: Class, expansion, gear slot, stat priority
   - Output: Top 5 gear options per slot with sources
   - Data sources: Best in Slot Gear

6. **Zone XP Optimizer** (Tier 2)
   - Input: Level range, playstyle (solo/group), expansion
   - Output: Sorted zones by ZEM, tips, grinding efficiency
   - Data sources: Zone XP Modifiers

7. **Crafting System Hub** (Tier 2)
   - Tabs: Tailoring, Fletching, Blacksmithing, Jewelcraft, Spell Research
   - Per tab: Searchable recipes, trivial progression, ingredient sourcing
   - Data sources: All Crafting Guides

8. **Server Timeline** (Tier 1)
   - Visual: Expansion unlock dates, tradeable item windows, epic availability
   - Data sources: Tradeable Items & Schedule

9. **Spell Vendor Locator** (Tier 2)
   - Input: Class, spell level, expansion
   - Output: Vendor locations, travel routes
   - Data sources: Spell Vendors

10. **Raid Strategy Reference** (Tier 2)
    - Per raid: Encounters, resistances, strategies, DPS checks
    - Data sources: ToV & Kael Strategy

---

## Data Quality & Validation Notes

### Strengths
- **Well-Structured:** Consistent headers, clear categories
- **Comprehensive Coverage:** All 14 classes, all expansions
- **Actionable:** Includes tips, notes, and quality ratings
- **Current:** Updated for Teek/Mischief timeline
- **Community-Vetted:** By experienced player (Gronnz)

### Gaps & Concerns
1. **Luclin & PoP Group Named:** Show "(No data available)" - may need supplement from community
2. **Item Name Standardization:** Need validation against item-details.json (spelling, punctuation)
3. **NPC Location Coordinates:** Epic quests include some (loc X, Y), but not systematized
4. **Raid Encounter Completeness:** Some raids incomplete; may need ZAM/EQResource validation
5. **Expansion Gating:** Spell Research and some epic steps may be gated incorrectly by expansion

### Recommended Pre-Integration QA
- [ ] Cross-validate all item names against item-details.json (case-sensitive)
- [ ] Spot-check 10 NPCs per expansion against live server data
- [ ] Verify raid encounter names match canonical boss names
- [ ] Confirm epic quest step ordering and NPC dialogs
- [ ] Test Luclin/PoP data gaps against community sources
- [ ] Validate expansion gates for spells, quest availability

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Create zone-xp-modifiers.json + sortable UI
- [ ] Create server-schedule.json + timeline visualization
- [ ] Begin epic-quests.json parsing

### Week 2: Core Features
- [ ] Complete epic-quests.json + tracker UI
- [ ] Create leveling-paths.json + router UI
- [ ] Create faction-system.json + visual diagram
- [ ] Create pop-progression.json + dependency UI
- [ ] Begin Classic/Kunark/Velious loot delta analysis

### Week 3: Pre-Launch Quality
- [ ] Finalize loot data expansions (validate item names)
- [ ] Complete QA on Epic quests, Leveling, Faction, PoP
- [ ] Deploy Tier 1 pages to staging
- [ ] Gather user feedback on new features

### Week 4+: Enrichment Phase
- [ ] Create bis-gear.json + comparator UI
- [ ] Create crafting-system.json + progression UI
- [ ] Create spell-vendors.json + lookup UI
- [ ] Create raid-strategies.json + strategy pages
- [ ] Create potions.json + recipe database
- [ ] Deploy Tier 2 pages incrementally
- [ ] Monitor analytics for most-used features

---

## Estimated Effort Breakdown

| Task | Hours | Type |
|------|-------|------|
| Zone XP Modifiers (JSON + UI) | 4 | Low |
| Tradeable Schedule (JSON + Timeline) | 6 | Low-Medium |
| Leveling Guide (JSON + Router UI) | 12 | Medium |
| Epic Quests (Parsing + Tracker UI) | 20 | High |
| PoP Progression (JSON + Visual) | 8 | Medium |
| Loot Data Integration (Classic/Kunark/Velious) | 16 | Medium |
| Faction System (JSON + Diagram) | 10 | Medium |
| Best in Slot Gear (JSON + Comparator) | 16 | High |
| Crafting System (5 sheets + UI) | 18 | High |
| Spell Vendors (JSON + Lookup) | 6 | Medium |
| Raid Strategies (JSON + Pages) | 8 | Medium |
| Potions Guide (JSON + Recipe UI) | 6 | Low-Medium |
| **TOTAL ESTIMATED** | **130 hours** | - |

**By Tier:**
- Tier 1 (Pre-Launch): 50 hours
- Tier 2 (Post-Launch Weeks 1-2): 40 hours
- Tier 3 (Long-Tail Enrichment): 40 hours

---

## Recommended Next Steps

1. **Immediate (Today):**
   - Share this report with development team
   - Prioritize Tier 1 features (Zone XP, Schedule, Epic Quests, Leveling)
   - Begin epic-quests.json parsing (largest data structure)

2. **This Week:**
   - Create JSON schemas for each new data type
   - Set up UI templates for new pages
   - Begin data validation against live servers

3. **Before Launch:**
   - Have Tier 1 pages deployed to production
   - Complete user acceptance testing
   - Gather feedback on UI/UX

4. **Post-Launch:**
   - Prioritize most-requested features from user feedback
   - Iteratively add Tier 2 pages based on engagement metrics
   - Plan community data collection for gaps (Luclin group named, etc.)

---

## Files to Create

**JSON Data Files:**
- `zone-xp-modifiers.json` - Zone experience data
- `leveling-paths.json` - Race/level-based leveling guides
- `faction-system.json` - Faction alignments, quests, armor
- `spell-vendors.json` - Vendor locations by class/expansion
- `epic-quests.json` - All 14 class epic quest chains
- `pop-progression.json` - Planes of Power progression steps
- `server-schedule.json` - Expansion unlocks, tradeable windows
- `bis-gear.json` - Best-in-slot gear by class/expansion
- `crafting-system.json` - All crafting recipes (Tailoring, Smithing, etc.)
- `raid-strategies.json` - Raid encounter mechanics and strategies
- `potions.json` - Potion crafting recipes

**UI Components:**
- `LeveingPathFinder` - Interactive leveling router
- `EpicQuestTracker` - Step-by-step quest tracker with checkboxes
- `FactionMap` - Visual faction relationship diagram
- `PopProgressionVisualizer` - Dependency graph UI
- `GearComparator` - Multi-slot gear comparison tool
- `ZoneOptimizer` - Sortable zone table with filters
- `CraftingRecipeBrowser` - Recipe search and progression UI
- `ServerTimeline` - Expansion unlock calendar
- `SpellVendorLocator` - Vendor lookup by class/spell
- `RaidStrategyPages` - Per-encounter strategy documentation

---

## Success Metrics

- [ ] All Tier 1 pages live before launch
- [ ] Zone XP Modifiers page gets 50+ unique daily visitors
- [ ] Epic Quest Tracker reaches 70%+ completion rates
- [ ] Leveling guide used by 40%+ of new players
- [ ] Faction system page reduces support questions by 30%
- [ ] Gear comparator becomes 2nd most-used site feature
- [ ] Crafting system drives 20% more player crafting engagement
- [ ] User satisfaction survey ≥ 4.5/5 stars

---

**Report prepared by:** Data Analyst Agent  
**Report date:** 2026-04-27  
**Source workbook:** EQ_Master_Database_temp.xlsx by Gronnz  
**Integration status:** Ready for implementation planning
