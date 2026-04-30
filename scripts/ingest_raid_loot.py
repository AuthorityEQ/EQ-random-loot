"""
Raid Loot Ingest Script
- Reads Classic/Kunark/Velious sheets from EQ_Master_Database_temp.xlsx
- Identifies RAID BOSS entries (those in RAID ENCOUNTERS section with high loot)
- Maps loot to existing boss rosters in the three raid JSON files
- Flags items missing from item-details.json
- Writes enriched JSON files and report
"""

import sys
import json
import re
import openpyxl
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT       = Path("C:/Users/rontf/EQ-random-loot")
EXCEL_PATH = Path("C:/Users/rontf/EQ_Master_Database_temp.xlsx")
DATA_DIR   = ROOT / "data"

CLASSIC_JSON  = DATA_DIR / "classic-raid.json"
KUNARK_JSON   = DATA_DIR / "kunark-raid.json"
VELIOUS_JSON  = DATA_DIR / "velious-raid.json"
ITEMS_JSON    = DATA_DIR / "item-details.json"

# ─── Load existing data ────────────────────────────────────────────────────────
with open(CLASSIC_JSON,  encoding="utf-8") as f: classic_data  = json.load(f)
with open(KUNARK_JSON,   encoding="utf-8") as f: kunark_data   = json.load(f)
with open(VELIOUS_JSON,  encoding="utf-8") as f: velious_data  = json.load(f)
with open(ITEMS_JSON,    encoding="utf-8") as f: item_details  = json.load(f)

known_items = set(item_details.keys())

# ─── Build roster lookup: normalised name → boss dict ─────────────────────────
def normalize_name(s: str) -> str:
    """Lowercase, strip leading/trailing whitespace, collapse internal spaces."""
    return re.sub(r'\s+', ' ', str(s).strip()).lower()

def build_roster(data: dict) -> dict:
    roster = {}
    for tier in data["tiers"]:
        for boss in tier["bosses"]:
            roster[normalize_name(boss["name"])] = boss
    return roster

classic_roster  = build_roster(classic_data)
kunark_roster   = build_roster(kunark_data)
velious_roster  = build_roster(velious_data)

# Print all roster names for debugging
print("=== CLASSIC ROSTER ===")
for n in sorted(classic_roster.keys()):
    print(f"  {n!r}")
print()
print("=== KUNARK ROSTER ===")
for n in sorted(kunark_roster.keys()):
    print(f"  {n!r}")
print()
print("=== VELIOUS ROSTER ===")
for n in sorted(velious_roster.keys()):
    print(f"  {n!r}")
print()

# ─── Excel parsing ─────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(str(EXCEL_PATH), read_only=True, data_only=True)

def clean_item(raw) -> str | None:
    """Return a clean item name or None if empty/junk."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in ('', 'alla', 'wiki link'):
        return None
    # Skip obvious non-items
    skip_prefixes = ('pool', 'motm', 'npc', 'lvl', 'zone', 'loot', 'alla',
                     'group named', 'raid encounters', '  ', '🛡', '⚔', '🌿', '❄',
                     'yes', 'no', 'n/a', '?', 'nerfed', 'not randomed',
                     'unconfirmed', 'varies', 'various')
    sl = s.lower()
    for sp in skip_prefixes:
        if sl.startswith(sp):
            return None
    if s.startswith('▸') or s.startswith('  ') and not s.strip():
        return None
    # Check it looks like an item name (has at least 3 chars, not purely numeric)
    if len(s) < 3:
        return None
    return s

def parse_sheet(sheet_name: str, roster: dict, loot_col_start: int = 5) -> dict:
    """
    Parse a sheet and return {normalized_boss_name: [item1, item2, ...]}
    loot_col_start: 0-indexed column where loot items begin (Loot 1)
    """
    ws = wb[sheet_name]
    all_rows = list(ws.iter_rows(values_only=True))

    in_raid_section = False
    boss_loot = defaultdict(list)   # normalized boss name → items
    unmatched_bosses = []           # boss names found in raid section but not in roster

    RAID_SECTION_MARKERS = ("raid encounters", "raid bosses", "raid encounter")

    for row in all_rows:
        if not any(c is not None for c in row):
            continue

        first = str(row[0]).strip().lower() if row[0] is not None else ""

        # Detect entering raid section
        if any(m in first for m in RAID_SECTION_MARKERS):
            in_raid_section = True
            continue

        if not in_raid_section:
            continue

        # Skip section header rows (zone labels like "  Plane of Fear")
        # These have None for level (col 1) and no loot
        raw_level = row[1] if len(row) > 1 else None
        if raw_level is None:
            continue

        # Skip header row (NPC Name, LVL, Zone, ...)
        if str(row[0]).strip().lower() == 'npc name':
            continue

        boss_name_raw = str(row[0]).strip() if row[0] else None
        if not boss_name_raw:
            continue

        # Remove leading whitespace/indent
        boss_name_raw = boss_name_raw.strip()
        boss_norm = normalize_name(boss_name_raw)

        # Collect loot items (all columns from loot_col_start onward)
        items = []
        for cell in row[loot_col_start:]:
            item = clean_item(cell)
            if item:
                items.append(item)

        if boss_norm in roster:
            boss_loot[boss_norm].extend(items)
        else:
            unmatched_bosses.append((boss_name_raw, boss_norm, items))

    return dict(boss_loot), unmatched_bosses

# Classic sheet: loot columns start at index 5 (0-based: NPC,LVL,Zone,MOTM,Pool,Loot1...)
# Header: NPC Name | LVL | Zone | MOTM | Loot Pool | Loot 1 | Loot 2 ... | Wiki Link
# So loot starts at col index 5
classic_loot, classic_unmatched   = parse_sheet("Classic", classic_roster,  loot_col_start=5)
kunark_loot,  kunark_unmatched    = parse_sheet("Kunark",  kunark_roster,   loot_col_start=5)
velious_loot, velious_unmatched   = parse_sheet("Velious", velious_roster,  loot_col_start=5)

print("=== CLASSIC LOOT MATCHES ===")
for k,v in classic_loot.items():
    print(f"  {k!r}: {v}")
print()
print("=== KUNARK LOOT MATCHES ===")
for k,v in kunark_loot.items():
    print(f"  {k!r}: {v}")
print()
print("=== VELIOUS LOOT MATCHES ===")
for k,v in velious_loot.items():
    print(f"  {k!r}: {v}")
print()

print("=== CLASSIC UNMATCHED (in raid section but not in roster) ===")
for raw, norm, items in classic_unmatched:
    print(f"  raw={raw!r} | items={items}")
print()
print("=== KUNARK UNMATCHED ===")
for raw, norm, items in kunark_unmatched:
    print(f"  raw={raw!r} | items={items}")
print()
print("=== VELIOUS UNMATCHED ===")
for raw, norm, items in velious_unmatched:
    print(f"  raw={raw!r} | items={items}")

wb.close()
