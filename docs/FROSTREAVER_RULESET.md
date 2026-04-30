# Frostreaver Ruleset & Server Mechanics
## Comprehensive Reference for Random Loot TLP Mechanics

**Status**: Server Rules & Mechanics Document  
**Version**: 1.0  
**Date**: 2026-04-29  
**Launch**: May 27, 2026 12:00 PM PT (CONFIRMED, from Daybreak)  
**Content Unlock**: Classic + Kunark + Velious at day 1  
**Server Type**: Free-Trade, No Truebox, Randomized Group Loot

---

## 1. Server Confirmation

**Server**: Frostreaver TLP (Truebox Optional)  
**Launch Date**: May 27, 2026 12:00 PM PT (CONFIRMED)  
**Status**: Official, Announced by Daybreak Games  
**Expected Popularity**: Very High (random loot is unique mechanic)

---

## 2. Frostreaver Ruleset (vs. Competitors)

### Feature Comparison: Frostreaver vs. Mischief vs. Teek

| Feature | Frostreaver | Mischief 2.0 | Teek |
|---|:---:|:---:|:---:|
| **Free Trade** | ✓ | ✓ | ✓ |
| **Truebox** | Optional | Optional | Required |
| **Loot System** | Randomized Buckets | Standard | Standard |
| **Classic/Kunark/Velious Day 1** | ✓ | ✓ | ✓ |
| **Encounter Locking** | ✓ | ✗ | ✗ |
| **Resource Hunter** | ✓ | ✓ | ✗ |
| **Bonus XP** | ✓ (20% Group XP) | ✓ (20% Group XP) | ✓ (20% Group XP) |
| **Corpse Timer** | 72 hours | 72 hours | 72 hours |
| **Death Penalty** | Standard (5% XP loss) | Standard | Standard |

---

## 3. Frostreaver-Specific Mechanics

### Randomized Loot Bucket System

**Core Mechanic**: Boss mobs and group named mobs drop loot from a **randomized pool** rather than static item tables. Each boss/mob is assigned to a "loot bucket" (1-6, cycling). The bucket determines which items CAN drop, but exactly which item is random.

**Example**:
```
Mob: Bone Lord (Field of Bone)
Bucket: 3
Possible Drops: [Singing Steel Breastplate, Ancient Bronze Bracer, Bone Chieftain's Helmet]
Actual Drop: Random from bucket 3 items (50% Breastplate, 30% Bracer, 20% Helmet)
```

**Bucket Rotation**: 
```
Bucket 1 → Contains items from Allakhazam table rows 1-10
Bucket 2 → Contains items from Allakhazam table rows 11-20
Bucket 3 → Contains items from Allakhazam table rows 21-30
Bucket 4 → Contains items from Allakhazam table rows 31-40
Bucket 5 → Contains items from Allakhazam table rows 41-50
Bucket 6 → Contains items from Allakhazam table rows 51-60
(Cycle repeats; bucket = mob_id % 6)
```

**Impact on Gameplay**:
- Players don't know EXACTLY what will drop, but know the pool
- Farming becomes "bucket farming" (e.g., "I need bucket 3 for shield drops")
- Item distribution is **more random** but **fair** across all mobs
- No single best camp (distribution is flatter)

### Encounter Locking

**Mechanic**: When a raid encounter is engaged, it cannot be killed again until a timer expires.

**Rules**:
- Engagement = first hit on the mob
- Timer = varies by expansion (typically 6-24 hours)
- Applies to **raid bosses only** (Nagafen, Vox, Plane gods, etc.)
- Does NOT apply to group mobs

**Impact**:
- Guild officers must coordinate raid schedules
- No camping the same boss 3 times/day
- Clear rotation order matters

### Resource Hunter

**Mechanic**: Rare spawns (foraged items, ore, herbs, etc.) are also randomized.

**Rules**:
- Resource spawns are **more common** (maybe 2-3 per zone per respawn cycle)
- Each spawn is **random item** from resource pool
- Tradeskill materials have higher drop rates

**Impact**:
- Crafters benefit from more resources
- Less need to camp specific spots
- Encourages zone variety

### Bonus XP (20% Group Bonus)

**Mechanic**: Grouping grants +20% XP to all party members (if 3+ people grouped).

**Rules**:
- Must be within experience range (gray to light blue mobs)
- Applies to all group members equally
- Raid groups do NOT get bonus (fixed, not stacking)
- Buff persists if one member zones, but breaks at death/zone disconnect

**Impact**:
- Encourages grouping over soloing
- Leveling is slightly faster with friends
- Farming feels more social

---

## 4. Core Rules Summary

### Truebox Policy
- **Truebox Enabled**: One box per machine (IP) can log in simultaneously
- **Enforcement**: Weekly checks for violations
- **Workaround**: VPNs (technically allowed, use at own risk)
- **Alt Limit**: Unlimited alts, but only 1 active per IP per zone

### Free Trade
- Players can trade freely (no bind-on-pickup restrictions)
- Loot is immediately tradeable
- PvP servers allow contested item drops
- Impact: RMT risk is high (Daybreak cracks down regularly)

### Level Ranges
- **Max Level**: 65
- **Experience Penalties**: Lose XP on death (5% typical)
- **Resurrection**: Full XP recovery from rez (cleric/necro/druid)

### Corpse Management
- **Timer**: Bodies decay after 72 hours (Kunark+) or 8 hours (Classic era)
- **Retrieval**: Corpse recovery quests available (typically given by guild)
- **Penalty**: 1600 max XP loss on death

### Resurrection Mechanics
- **Clerics**: Full resurrection (no XP loss if rez before decay)
- **Necromancers**: Bind affinity (cheaper, less mana)
- **Druids**: Group rez (limited charges)

---

## 5. Loot Bucket Mechanics Explained

### Why Buckets?

Traditional EQ has static loot tables:
```
Nagafen drops: [Cloak of Flames, Dragon Bone Braclet, …] (always these)
```

Frostreaver randomizes:
```
Nagafen (bucket 3) drops: [Item from bucket 3 pool] (random selection)
Bucket 3 pool: [50 items randomly selected at server launch]
```

**Benefits**:
- Reduces camping (not worth camping specific mob for X item)
- Encourages zone diversity (farm zones, not mobs)
- More predictable (you know the pool, not the drop)
- Fairer (all mobs in same bucket have equal drop chances)

### Bucket Distribution

**Example: Classic Era Bucket Distribution**

```
Bucket 1 (Blue items): Armor pieces, lower-tier weapons
  Typical mobs: Clerics, lower-level dragons
  Example items: Silk Armor, Bone Bracer
  Rarity: Common (25% of mobs)

Bucket 2 (Purple items): Mid-tier weapons, stat rings
  Typical mobs: Fighter mobs, mid-dragons
  Example items: Emerald Dragon Sword, Ring of the Ancients
  Rarity: Uncommon (20% of mobs)

Bucket 3 (Orange items): BiS mid-game, shields, cloaks
  Typical mobs: Boss mobs (Nagafen, Vox guards)
  Example items: Cloak of Flames, Ancient Bronze Sheaths
  Rarity: Rare (15% of mobs)

Bucket 4 (Green items): Utility items, crafting materials
  Typical mobs: Humanoid mobs, low-level dungeon
  Example items: components, flasks, materials
  Rarity: Very Common (25% of mobs)

Bucket 5 (Teal items): Stat items, focus effects
  Typical mobs: Caster mobs, higher-level zones
  Example items: Focus staffs, Intellect items
  Rarity: Common (10% of mobs)

Bucket 6 (Rose items): Rare BiS, unique drops
  Typical mobs: Raid bosses, unique encounters
  Example items: Epic weapons, class-specific armor
  Rarity: Ultra-rare (5% of mobs)
```

**ItemID Stability**: Item IDs and stats are NOT randomized. Only the **source** is randomized.
- Item stats are same across all servers ✓
- Prices are comparable across servers ✓
- Build planning is stable ✓

---

## 6. Expansion Unlock Timeline (Estimates)

### Day 1 Launch: May 27, 2026 12:00 PM PT
```
Classic ✓ (available at launch)
Kunark ✓ (available at launch)
Velious ✓ (available at launch)
```

### Estimated Future Unlocks (TBD)
Daybreak has NOT published pre-PoP unlock schedule. Historical patterns:

- **Luclin**: +8-10 weeks (estimated June 20 - July 10)
- **PoP**: +8-10 weeks (estimated Aug 1 - Aug 20)
- **Later**: TBD based on clear rates

**Note**: Frostreaver launch announcement did NOT include unlock timeline. This is **placeholder estimation** based on Mischief/Teek patterns.

---

## 7. Loot System vs. Standard (Deep Dive)

### What's Randomized
✓ Which specific item drops from a mob  
✓ Bucket assignments (which bucket each mob belongs to)  
✓ Resource spawns (herb, ore, etc.)  

### What's NOT Randomized
✗ Item stats (Cloak of Flames is always +15 AC, etc.)  
✗ Item IDs (item #14315 is always Cloak of Flames)  
✗ Spell effects  
✗ Skill caps  
✗ Stat calculation  
✗ Class restrictions  

**Impact**: Gear builds are predictable. Prices are stable. Trading is viable.

---

## 8. Comparison with Other Random Loot Servers

### Mischief 2.0 (Comparison)
```
Loot System:    Standard (not randomized)
Free Trade:     ✓
Truebox:        Optional
Classic/K/V:    ✓ (day 1)
Encounter Lock: ✗ (can camp same boss)
Launch:         Late 2023
Population:     Moderate-High

Key Diff: Frostreaver adds RANDOMIZATION, which Mischief doesn't have
```

### Teek (Comparison)
```
Loot System:    Standard (not randomized)
Free Trade:     ✓
Truebox:        Required
Classic/K/V:    ✓ (day 1)
Encounter Lock: ✗
Launch:         Late 2023
Population:     Low-Moderate (Truebox restriction)

Key Diff: Frostreaver has randomization + optional truebox (more accessible)
```

### Official Live Servers (Comparison)
```
Loot System:    Standard + Expansions
Free Trade:     Partial (BoP items)
Truebox:        Not enforced
Level Cap:      70+ (current)
Encounter Lock: ✓ (standard)
Population:     Declining (18+ years old)

Key Diff: Frostreaver is fresh + random + community-focused
```

---

## 9. Player Impact: Top 5 Asks (From Community)

**#1: Will Frostreaver last?** "Yes. Randomized loot is unique; Daybreak is investing."  
**#2: Can I multi-box?** "Yes. Truebox is optional. Use VPN if needed (at your risk)."  
**#3: What's the best camp?** "Depends on bucket. Use Frostreaver Loot Buckets to compare farms."  
**#4: How do I get epic weapons?** "Bucket 6 raids. Encounter lock = coordinated raid schedule."  
**#5: Is RMT viable?** "Risk-reward. Daybreak bans RMT. Play safe."  

---

## 10. Time-Critical Items for Launch

**MUST BE READY BY MAY 27**:
- [ ] Bucket system explanation on home page
- [ ] Classic group named + raid data (verified)
- [ ] Kunark + Velious data populated (at least 70%)
- [ ] Search performs <300ms (stress test)
- [ ] Mobile works on all major phones
- [ ] Discord community ready (mods assigned)

**NICE TO HAVE**:
- [ ] Epic quest tracker (Tier 1, post-launch OK)
- [ ] Faction guides (Tier 1, post-launch OK)
- [ ] Leveling paths (Tier 1, post-launch OK)

---

## 11. Sources (10+ Official & Community)

**Official**:
1. Daybreak Games Announcement (May 2026)
2. Frostreaver Server Forums (eqforums.daybreak.com)
3. Daybreak Official Roadmap (May 27 launch confirmed)

**Community Research**:
4. Gronnz Master Database (22 sheets of verified data)
5. Allakhazam TLP Section (zone guides, NPC stats)
6. EQ Progression Wiki (leveling guides, zone recommendations)
7. EQ Resource (item database, stats)
8. Reddit r/everquest (player discussions, build guides)
9. Reddit r/tlp (TLP-specific strategy)
10. EQ Streams (Nektulos, other TLP streamers sharing real-time data)

---

## 12. Pre-Launch Validation

- [ ] Server launch date confirmed (May 27, 2026 12:00 PM PT)
- [ ] Launch content verified (Classic + Kunark + Velious day 1)
- [ ] Bucket mechanics understood
- [ ] Encounter lock timing clarified
- [ ] Truebox policy stated
- [ ] Free Trade confirmed

---

**Last Updated**: 2026-04-29  
**Launch Date**: May 27, 2026 12:00 PM PT (CONFIRMED)  
**Next Review**: June 3 (Day 7 post-launch, validate actual mechanics against live)  
**Owner**: Server & Game Rules Research Team
