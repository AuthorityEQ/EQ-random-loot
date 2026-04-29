"""Scan a wider range of rows in Classic/Kunark/Velious to understand raid section layout."""
import sys
import openpyxl
sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook(r"C:/Users/rontf/EQ_Master_Database_temp.xlsx", read_only=True, data_only=True)

for sheet_name in ["Classic", "Kunark", "Velious"]:
    ws = wb[sheet_name]
    print(f"\n\n{'='*60}")
    print(f"SHEET: {sheet_name}")
    print(f"{'='*60}")
    all_rows = list(ws.iter_rows(values_only=True))
    print(f"Total rows: {len(all_rows)}")

    in_raid = False
    for i, row in enumerate(all_rows, 1):
        if not any(c is not None for c in row):
            continue
        first = str(row[0]).strip() if row[0] else ""
        if "RAID" in first.upper():
            in_raid = True
        if in_raid:
            print(f"  [{i}] {[str(c)[:30] if c is not None else '' for c in row[:8]]}")

wb.close()
