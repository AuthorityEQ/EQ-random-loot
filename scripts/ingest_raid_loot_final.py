"""
PRODUCTION Raid Loot Ingest Script
Reads Classic/Kunark/Velious sheets from EQ_Master_Database_temp.xlsx,
matches raid bosses to the three raid JSON rosters, adds loot_pool arrays,
and writes a report plus missing-items list.
"""

import sys
import json
import re
import openpyxl
from pathlib import Path
from collections import defaultdict, OrderedDict

sys.stdout.reconfigure(encoding='utf-8')

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT       = Path("C:/Users/rontf/EQ-random-loot")
EXCEL_PATH = Path("C:/Users/rontf/EQ_Master_Database_temp.xlsx")
DATA_DIR   = ROOT / "data"

CLASSIC_JSON  = DATA_DIR / "classic-raid.json"
KUNARK_JSON   = DATA_DIR / "kunark-raid.json"
VELIOUS_JSON  = DATA_DIR / "velious-raid.json"
ITEMS_JSON    = DATA_DIR / "item-details.json"
REPORT_PATH   = DATA_DIR / "raid-loot-ingest-report.md"
MISSING_PATH  = DATA_DIR / "raid-loot-missing-items.json"

# ─── Load existing data ────────────────────────────────────────────────────────
with open(CLASSIC_JSON,  encoding="utf-8") as f: classic_data  = json.load(f)
with open(KUNARK_JSON,   encoding="utf-8") as f: kunark_data   = json.load(f)
with open(VELIOUS_JSON,  encoding="utf-8") as f: velious_data  = json.load(f)
with open(ITEMS_JSON,    encoding="utf-8") as f: item_details  = json.load(f)

known_items = set(item_details.keys())

# ─── Helpers ───────────────────────────────────────────────────────────────────
def normalize_name(s: str) -> str:
    return re.sub(r'\s+', ' ', str(s).strip()).lower()

def build_roster(data: dict) -> dict:
    """Map normalized boss name → boss dict reference."""
    roster = {}
    for tier in data["tiers"]:
        for boss in tier["bosses"]:
            roster[normalize_name(boss["name"])] = boss
    return roster

def clean_item(raw) -> str | None:
    """Return a clean item name or None if it's not a real item."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    sl = s.lower()
    # Skip wiki link column value
    if sl in ('alla', 'wiki link', 'allakhazam'):
        return None
    # Skip clearly non-item strings
    skip_patterns = [
        'pool', 'npc name', 'loot 1', 'loot 2', 'loot 3', 'loot 4', 'loot 5',
        'loot 6', 'loot 7', 'loot 8', 'loot 9', 'loot 10', 'loot 11', 'loot 12',
        'loot 13', 'loot 14', 'loot 15', 'motm', 'lvl', 'zone',
        'no unique drops', 'no loot', 'not randomed', 'unconfirmed', 'nerfed',
        'sky quest stuff',  # placeholder
        'various', 'typical', 'probable', 'potentially', 'probably',
        'didnt seem', 'no unique', 'class bps', 'class legs', 'class vambraces',
        'class bp', 'random growth loot', 'spells', 'spell:',
        'vulak loot table',
        'teir\'dal', 'various insidious', 'various apothic', 'various ethereal',
        'various rune etched', 'various woven shadow', 'various decayed',
        'dragonhide bps', 'dragonhide legs', 'exquisite velium weapons',
        'dragonskull helms', 'black dragon quest', 'gold dragon quest',
        'storm dragon quest', 'silver dragon quest',
        'various armor of fire', 'various rubicite armor',
        'pool 1', 'pool 2', 'pool 3', 'pool 4', 'pool 5',
        'pool 6', 'pool 7', 'pool 8', 'pool 9', 'pool 10', 'pool 11',
        '"', "`", "'",
    ]
    for sp in skip_patterns:
        if sl.startswith(sp) or sl == sp:
            return None
    # Skip pure separators/labels
    if s in ('', '`', "'"):
        return None
    # Must be at least 3 chars
    if len(s) < 3:
        return None
    # Skip strings that are entirely special chars or look like CSV header artefacts
    if re.match(r'^[,\s"\'`]+$', s):
        return None
    # Skip (OOE) notes in parentheses that are just annotations, but keep full names with them
    # e.g., "Acid Etched Girdle (OOE)" is valid
    return s

# ─── Manual name mappings for Excel typos / aliases ───────────────────────────
# Key: normalized Excel name → normalized roster name
MANUAL_MAPPINGS = {
    # Kunark
    "silvering": "silverwing",                # typo in spreadsheet
    "coercer q'ioul": "coercer q'ioul",       # already normalised identically
    # Classic – Sky bosses are aggregated into "Plane of Sky bosses" roster entry
    "thunder spirit princess": "plane of sky bosses",
    "protector of sky":        "plane of sky bosses",
    "gorgalosk":               "plane of sky bosses",
    "keeper of souls":         "plane of sky bosses",
    "spiroc lord":             "plane of sky bosses",
    "noble dojorn":            "plane of sky bosses",
    "overseer of air":         "plane of sky bosses",
    "the hand of veeshan":     "plane of sky bosses",
    "bazzt zzzt":              "plane of sky bosses",
    "sister of the spire":     "plane of sky bosses",
    "eye of veeshan":          "plane of sky bosses",
}

def parse_sheet(sheet_name: str, roster: dict, loot_col_start: int = 5):
    """
    Parse a sheet, return:
      matched_loot: {normalized_roster_name: [item_str, ...]}
      unmatched:    [(raw_name, norm_name, [items])]  — bosses not in roster and not in manual map
      dq_issues:    list of data quality strings
    """
    ws = wb[sheet_name]
    all_rows = list(ws.iter_rows(values_only=True))

    in_raid_section = False
    matched_loot = defaultdict(list)
    unmatched = []
    dq_issues = []
    RAID_MARKERS = ("raid encounters", "raid bosses")

    for row in all_rows:
        if not any(c is not None for c in row):
            continue

        first_raw = row[0]
        first = str(first_raw).strip().lower() if first_raw is not None else ""

        # Detect RAID ENCOUNTERS section header
        if any(first.startswith(m) for m in RAID_MARKERS):
            in_raid_section = True
            continue

        if not in_raid_section:
            continue

        # Skip zone section headers (non-null name, null level)
        raw_level = row[1] if len(row) > 1 else None
        if raw_level is None:
            continue

        # Skip spreadsheet header row
        if first in ('npc name',):
            continue

        # Skip the garbage CSV-header artefact row found in Velious
        if first.startswith('pool,loot 1') or first.startswith('"pool'):
            continue

        # Skip legend rows at bottom
        if 'loot pool legend' in first:
            break

        boss_name_raw = str(row[0]).strip() if row[0] else None
        if not boss_name_raw:
            continue

        boss_norm = normalize_name(boss_name_raw)

        # Apply manual mapping
        resolved_norm = MANUAL_MAPPINGS.get(boss_norm, boss_norm)

        # Collect loot items
        items = []
        for cell in row[loot_col_start:]:
            item = clean_item(cell)
            if item:
                items.append(item)

        if resolved_norm in roster:
            matched_loot[resolved_norm].extend(items)
        else:
            unmatched.append((boss_name_raw, boss_norm, items))

    # Deduplicate items per boss while preserving order
    deduped = {}
    for boss_norm, items in matched_loot.items():
        seen = set()
        deduped[boss_norm] = []
        for item in items:
            if item not in seen:
                seen.add(item)
                deduped[boss_norm].append(item)

    return deduped, unmatched, dq_issues


# ─── Open Excel ────────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(str(EXCEL_PATH), read_only=True, data_only=True)

classic_loot, classic_unmatched, classic_dq  = parse_sheet("Classic", build_roster(classic_data),  5)
kunark_loot,  kunark_unmatched,  kunark_dq   = parse_sheet("Kunark",  build_roster(kunark_data),   5)
velious_loot, velious_unmatched, velious_dq  = parse_sheet("Velious", build_roster(velious_data),  5)

wb.close()

# ─── Apply loot_pool to boss dicts ─────────────────────────────────────────────
def apply_loot(data: dict, loot_map: dict) -> dict:
    """Add loot_pool field to each boss. Empty array if no loot found."""
    roster = build_roster(data)
    for tier in data["tiers"]:
        for boss in tier["bosses"]:
            bnorm = normalize_name(boss["name"])
            boss["loot_pool"] = loot_map.get(bnorm, [])
    return data

classic_data  = apply_loot(classic_data,  classic_loot)
kunark_data   = apply_loot(kunark_data,   kunark_loot)
velious_data  = apply_loot(velious_data,  velious_loot)

# ─── Cross-reference items against item-details.json ──────────────────────────
def collect_all_items(data: dict) -> list[str]:
    items = []
    for tier in data["tiers"]:
        for boss in tier["bosses"]:
            items.extend(boss.get("loot_pool", []))
    return items

all_classic_items  = collect_all_items(classic_data)
all_kunark_items   = collect_all_items(kunark_data)
all_velious_items  = collect_all_items(velious_data)

def find_missing(items: list[str], expansion: str) -> list[dict]:
    missing = []
    seen = set()
    for item in items:
        if item not in known_items and item not in seen:
            seen.add(item)
            missing.append({"item": item, "expansion": expansion})
    return missing

missing_classic  = find_missing(all_classic_items,  "Classic")
missing_kunark   = find_missing(all_kunark_items,   "Kunark")
missing_velious  = find_missing(all_velious_items,  "Velious")
all_missing      = missing_classic + missing_kunark + missing_velious

# ─── Coverage stats ────────────────────────────────────────────────────────────
def coverage_stats(data: dict) -> tuple[int, int]:
    total = sum(len(t["bosses"]) for t in data["tiers"])
    with_loot = sum(
        1 for t in data["tiers"]
        for b in t["bosses"]
        if b.get("loot_pool")
    )
    return total, with_loot

classic_total,  classic_with  = coverage_stats(classic_data)
kunark_total,   kunark_with   = coverage_stats(kunark_data)
velious_total,  velious_with  = coverage_stats(velious_data)
grand_total = classic_total + kunark_total + velious_total
grand_with  = classic_with  + kunark_with  + velious_with

# ─── Build data quality issues list ───────────────────────────────────────────
def format_unmatched(unmatched: list, expansion: str) -> list[str]:
    issues = []
    for raw, norm, items in unmatched:
        if items:
            issues.append(f"[{expansion}] Boss in sheet but not in roster: \"{raw}\" "
                          f"(had {len(items)} item(s): {', '.join(items[:3])}{'...' if len(items)>3 else ''})")
        else:
            issues.append(f"[{expansion}] Boss in sheet but not in roster (no items): \"{raw}\"")
    return issues

dq_all = (
    format_unmatched(classic_unmatched, "Classic") +
    format_unmatched(kunark_unmatched,  "Kunark") +
    format_unmatched(velious_unmatched, "Velious")
)

# Separate into "has items" vs "no items" for report
dq_with_items    = [d for d in dq_all if "had " in d]
dq_without_items = [d for d in dq_all if "had " not in d]

# ─── Write JSON files ──────────────────────────────────────────────────────────
def write_json(path: Path, data: dict):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

write_json(CLASSIC_JSON,  classic_data)
write_json(KUNARK_JSON,   kunark_data)
write_json(VELIOUS_JSON,  velious_data)

# ─── Write missing items JSON ──────────────────────────────────────────────────
with open(MISSING_PATH, "w", encoding="utf-8", newline="\n") as f:
    json.dump(all_missing, f, indent=2, ensure_ascii=False)
    f.write("\n")

# ─── Build per-expansion item counts ──────────────────────────────────────────
classic_item_count  = len(set(all_classic_items))
kunark_item_count   = len(set(all_kunark_items))
velious_item_count  = len(set(all_velious_items))

# ─── Print summary to stdout for verification ──────────────────────────────────
print(f"Classic:  {classic_with}/{classic_total} bosses now have loot, "
      f"{classic_item_count} unique items, {len(missing_classic)} missing from item-details")
print(f"Kunark:   {kunark_with}/{kunark_total} bosses now have loot, "
      f"{kunark_item_count} unique items, {len(missing_kunark)} missing from item-details")
print(f"Velious:  {velious_with}/{velious_total} bosses now have loot, "
      f"{velious_item_count} unique items, {len(missing_velious)} missing from item-details")
print(f"TOTAL:    {grand_with}/{grand_total} bosses covered")
print(f"Missing items total: {len(all_missing)}")
print()
print("=== DATA QUALITY ISSUES (in sheet but not in roster, WITH loot) ===")
for dq in dq_with_items:
    print(f"  {dq}")
print()
print(f"({len(dq_without_items)} bosses in sheet but not in roster with no loot - see report)")

print("\nDone. Files written.")
