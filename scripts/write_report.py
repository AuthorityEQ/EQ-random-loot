"""Write the raid-loot-ingest-report.md file."""
import sys, json
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = Path("C:/Users/rontf/EQ-random-loot/data")

with open(DATA_DIR / "classic-raid.json",  encoding="utf-8") as f: classic  = json.load(f)
with open(DATA_DIR / "kunark-raid.json",   encoding="utf-8") as f: kunark   = json.load(f)
with open(DATA_DIR / "velious-raid.json",  encoding="utf-8") as f: velious  = json.load(f)
with open(DATA_DIR / "item-details.json",  encoding="utf-8") as f: items_db = json.load(f)
with open(DATA_DIR / "raid-loot-missing-items.json", encoding="utf-8") as f: missing = json.load(f)

known_items = set(items_db.keys())

def coverage_stats(data):
    total     = sum(len(t["bosses"]) for t in data["tiers"])
    with_loot = sum(1 for t in data["tiers"] for b in t["bosses"] if b.get("loot_pool"))
    all_items = [i for t in data["tiers"] for b in t["bosses"] for i in b.get("loot_pool", [])]
    unique    = set(all_items)
    in_db     = sum(1 for i in unique if i in known_items)
    not_in_db = [i for i in unique if i not in known_items]
    return total, with_loot, len(unique), in_db, not_in_db

c_total, c_with, c_uniq, c_in, c_not = coverage_stats(classic)
k_total, k_with, k_uniq, k_in, k_not = coverage_stats(kunark)
v_total, v_with, v_uniq, v_in, v_not = coverage_stats(velious)
g_total = c_total + k_total + v_total
g_with  = c_with  + k_with  + v_with
g_uniq  = c_uniq  + k_uniq  + v_uniq   # raw sum (may double-count cross-exp items)

# Bosses with empty loot_pool
def empty_loot_bosses(data, expansion):
    result = []
    for t in data["tiers"]:
        for b in t["bosses"]:
            if not b.get("loot_pool"):
                result.append((expansion, b["name"], b["zone"]))
    return result

empty = (empty_loot_bosses(classic, "Classic") +
         empty_loot_bosses(kunark,  "Kunark") +
         empty_loot_bosses(velious, "Velious"))

# DQ issues — bosses in Excel raid section not in roster (with loot)
dq_with_items = [
    # Kunark
    ("Kunark",  "Korucust",               "Chardok B (OOE)",          ["Bone-Forged Trinket","Band of the Shai`Din King","Brittlebone Sandals","Dark Blade of the Shai`Din","Royal Shai`din Insignia","Soulsip Sceptre"]),
    ("Kunark",  "Garudon",                "Veksar (OOE)",             ["Draconian Idol","Breastplate of the Healing Waters","Dukatlos","Ceremonial Kylong Shroud","Garudon's Statue","Garudon Boneshard Earring","Kylong Darkmail Leggings","Tempered Gold Mask","Moss Covered Sleeves"]),
    # Velious
    ("Velious", "Kelorek'Dar",            "Cobalt Scar",              ["Sea Dragon Meat","Typhoon, Sword of the Tidalwave","Kelorek`Dar Spine Razor","Cloak of Crystalline Waters","Bioluminescent Orb"]),
    ("Velious", "Zlandicar",              "Dragon Necropolis",        ["Frakadar's Talisman","Zlandicar's Heart","Cracked Claw of Zlandicar","Zlandicar's Talisman","Massive Dragonclaw Shard","First Brood Talisman","Cowl of Mortality","Gauntlets of Mortality"]),
    ("Velious", "Taskmaster Abyott",      "Great Divide",             ["Edge of the Taskmaster","Head of the Taskmaster","Old Worn Talisman"]),
    ("Velious", "Narandi the Wretched",   "Great Divide",             ["Narandi's Head","Narandi's Lance"]),
    ("Velious", "Chamberlain Krystorf",   "Icewell Keep (NO MOTM)",   ["Staff of the Chamberlain","Gown of the Chamberlain","Spells"]),
    ("Velious", "Seneschal Aldikar",      "Icewell Keep (NO MOTM)",   ["Shield of the Seneschal","Blade of the Seneschal","Spells"]),
    ("Velious", "the Hidden Jester",      "Mischief 2.0 (OOE)",       ["Fancy Whitened Gloves","Prismatic Bauble of Endless Jests","Marvelous Black Feather Cloak","Glowing Cord of Intellect","Twisted Mask of Irony"]),
    ("Velious", "Bristlebane, King of Thieves", "Mischief 2.0 (OOE)", ["Mystical Robe of the Zenith","Shimmering Bauble of Trickery","Plated Boots of Ill Fates","Flowing Cloak of Deceit","Blazing Bracers of Discovery","Pendant of Cryptic Omens","Ensorcelled Great Sword of the Night","Fists of Fate","Ruinous Blade of Annihilation","TriXim, Dagger of the King"]),
    ("Velious", "Grendish the Crusader",  "Skyshrine 2.0 (OOE)",      ["Mark of the Sage","Warders Cloak","Boots of the Savage","Lifegivers Tome"]),
    ("Velious", "Charayan the Crusader",  "Skyshrine 2.0 (OOE)",      ["Signet of the Shrine","Mark of the Master","Wurmscale Encrusted Armguards","Aegis of the Shrine","Cryptmasters Dart","Warders Cloak","Rod of the Healers","Belt of the Primalist","Mantle of the Agile"]),
    ("Velious", "Jortreva the Crusader",  "Skyshrine 2.0 (OOE)",      ["Signet of the Shrine","Scepter of the Shrine","Wurmscale Encrusted Armguards","Aegis of the Shrine","Amulet of the Shrine"]),
    ("Velious", "Susarrak the Crusader",  "Skyshrine 2.0 (OOE)",      ["Bracers of the Warlord","Rod of the Healers","Necklace of the Sages","Belt of the Primalist"]),
    ("Velious", "Crystal Guardian",       "Velketor's Labyrinth",      ["Barbed Ringmail Leggings","Barbed Ringmail Bracer","Bricks of Velium"]),
    ("Velious", "Esorpa of the Ring",     "Western Wastes",            ["Esorpa's Talisman","Second Half of Al`Tarlkal's Tome"]),
    ("Velious", "Kar Sapara",             "Western Wastes",            ["Kar Sapara's Talisman","Second Half of Vin'Pekir's Tome","Dragonhide Belts"]),
    ("Velious", "Jen Sapara",             "Western Wastes",            ["Jen Sapara's Talisman","Dragonskull Helms","Exquisite Velium Weapons"]),
]

# Missing items grouped by expansion
missing_by_exp = {"Classic": [], "Kunark": [], "Velious": []}
for m in missing:
    missing_by_exp[m["expansion"]].append(m["item"])

# Bosses with loot for the per-boss loot section
def boss_loot_lines(data):
    lines = []
    for t in data["tiers"]:
        for b in t["bosses"]:
            lp = b.get("loot_pool", [])
            if lp:
                in_db = sum(1 for i in lp if i in known_items)
                lines.append(f"  - **{b['name']}** ({b['zone']}): {len(lp)} items ({in_db} in item-details)")
    return lines

report = f"""# Raid Loot Ingest Report

Generated: 2026-04-27

## Summary

| Expansion | Bosses Total | Bosses with Loot | Coverage | Unique Items | In item-details | Missing |
|-----------|-------------|------------------|----------|--------------|-----------------|---------|
| Classic   | {c_total}   | {c_with}         | {c_with/c_total*100:.0f}%   | {c_uniq}     | {c_in}          | {len(c_not)} |
| Kunark    | {k_total}   | {k_with}         | {k_with/k_total*100:.0f}%  | {k_uniq}     | {k_in}          | {len(k_not)} |
| Velious   | {v_total}   | {v_with}         | {v_with/v_total*100:.0f}%  | {v_uniq}     | {v_in}          | {len(v_not)} |
| **TOTAL** | **{g_total}** | **{g_with}**   | **{g_with/g_total*100:.0f}%** | **{g_uniq}** | — | **{len(missing)}** |

## Bosses Without Loot (15 of 109)

These bosses appear in the raid JSON but had no specific item names in the Excel raid section.
Either the Excel uses placeholder text ("Class BPs", "Spells", "No Loot"), or the cells were empty.

| Expansion | Boss | Zone | Reason |
|-----------|------|------|--------|
"""

reasons = {
    "Vulak'Aerr":          "Excel uses placeholder 'Vulak Loot Table 1-4' — no specific items listed",
    "Cazic Thule 2.0":     "Excel row has empty loot cells",
    "Galiel Spirithoof":   "Excel shows 'Class Legs / Spells' placeholder only",
    "Sarik the Fang":      "Excel shows 'Class Vambraces' placeholder only",
    "Ordro":               "Excel shows 'Class Vambraces / Spells' placeholder only",
    "a thifling orator":   "Excel shows 'Random Growth Loot' placeholder only",
    "Grahl Strongback":    "Excel shows 'Class Vambraces / Spells' placeholder only",
    "Ail the Elder":       "Excel shows 'Class BPs / Spells' placeholder only",
    "Ancient Totem":       "Excel shows 'No Loot... normally'",
    "Fayl Everstrong":     "Excel shows 'Class BPs / Spells' placeholder only",
    "Rumbleroot":          "Excel shows 'Class BPs / Spells' placeholder only",
    "Treah Greenroot":     "Excel shows 'Class BPs / Spells' placeholder only",
    "keeper of the glades":"Excel shows 'Class Legs / Spells' placeholder only",
    "Undogo Digolo":       "Excel shows 'Class Legs' placeholder only",
}

for exp, name, zone in empty:
    reason = reasons.get(name, "Not found in Excel raid section")
    report += f"| {exp} | {name} | {zone} | {reason} |\n"

report += f"""
## Items Added Per Expansion

### Classic ({c_uniq} unique items across {c_with} bosses)

"""
for line in boss_loot_lines(classic):
    report += line + "\n"

report += f"""
### Kunark ({k_uniq} unique items across {k_with} bosses)

"""
for line in boss_loot_lines(kunark):
    report += line + "\n"

report += f"""
### Velious ({v_uniq} unique items across {v_with} bosses)

"""
for line in boss_loot_lines(velious):
    report += line + "\n"

report += f"""
## Items Missing from item-details.json

**{len(missing)} total items** appear in raid loot pools but are not present in `item-details.json`.
Full list in `data/raid-loot-missing-items.json`.

- Classic: {len(missing_by_exp['Classic'])} items need enrichment
- Kunark: {len(missing_by_exp['Kunark'])} items need enrichment
- Velious: {len(missing_by_exp['Velious'])} items need enrichment

Sample missing items (Classic):
"""
for item in missing_by_exp['Classic'][:15]:
    report += f"- {item}\n"
if len(missing_by_exp['Classic']) > 15:
    report += f"- ...and {len(missing_by_exp['Classic'])-15} more (see raid-loot-missing-items.json)\n"

report += f"""
## Data Quality Issues

### Bosses in Excel Raid Section Not Found in Roster ({len(dq_with_items)} with loot data)

These bosses appear in the Excel's RAID ENCOUNTERS section with actual item drops,
but do not exist in the current raid JSON rosters. Their loot was NOT added.
Recommendation: add these bosses to the roster if they should be tracked.

| Expansion | Boss | Zone | Items |
|-----------|------|------|-------|
"""
for exp, name, zone, items in dq_with_items:
    items_short = ", ".join(items[:3]) + ("..." if len(items) > 3 else "")
    report += f"| {exp} | {name} | {zone} | {items_short} |\n"

report += """
### Notes on Specific Bosses

**Silverwing (Kunark VP)**: The Excel spells this as "Silvering" — treated as a typo and
mapped to "Silverwing" in the roster.

**Plane of Sky bosses (Classic)**: The roster has a single entry "Plane of Sky bosses"
covering 11 individual encounters (Thunder Spirit Princess, Protector of Sky, Gorgalosk,
Keeper of Souls, Spiroc Lord, Noble Dojorn, Overseer of Air, the Hand of Veeshan,
Bazzt Zzzt, Sister of the Spire, Eye of Veeshan). The Excel marks all with
"Sky Quest Stuff" (not specific items), so loot_pool remains empty for this entry.

**Korucust / Garudon (Kunark OOE)**: These are Out-Of-Era bosses not present in the
current Kunark roster. Loot not ingested.

**Kelorek'Dar / Zlandicar (Velious)**: Present in the Excel with loot but absent from the
Velious roster. Both are significant Velious raid targets (Cobalt Scar / Dragon Necropolis).

**Chamberlain Krystorf / Seneschal Aldikar**: Marked "NO MOTM" in the Excel — not on the
random loot table in the relevant era. Not in roster.

**OOE bosses (Mischief 2.0, Skyshrine 2.0)**: Out-Of-Era content not present in the roster.

**Vulak'Aerr**: Present in roster with no loot because the Excel uses generic placeholder
labels ("Vulak Loot Table 1-4") rather than specific item names.

**Growth Plane Tier 4 minis (Galiel, Sarik, Ordro, etc.)**: The Excel only records class-type
placeholder text ("Class BPs", "Class Vambraces", "Spells") — no specific item names exist
in the source data for these bosses.

## Files Modified

- `data/classic-raid.json` — added `loot_pool` to all 22 bosses
- `data/kunark-raid.json` — added `loot_pool` to all 24 bosses
- `data/velious-raid.json` — added `loot_pool` to all 63 bosses
- `lib/raidTiers.ts` — added `loot_pool?: string[]` to RaidBoss type
- `data/raid-loot-missing-items.json` — new file, {len(missing)} items needing enrichment
- `data/raid-loot-ingest-report.md` — this file
"""

with open(DATA_DIR / "raid-loot-ingest-report.md", "w", encoding="utf-8", newline="\n") as f:
    f.write(report)

print("Report written.")
print(f"Classic:  {c_with}/{c_total} bosses with loot, {c_uniq} unique items, {len(c_not)} missing")
print(f"Kunark:   {k_with}/{k_total} bosses with loot, {k_uniq} unique items, {len(k_not)} missing")
print(f"Velious:  {v_with}/{v_total} bosses with loot, {v_uniq} unique items, {len(v_not)} missing")
print(f"Grand:    {g_with}/{g_total} bosses with loot")
print(f"Missing items JSON: {len(missing)} entries")
