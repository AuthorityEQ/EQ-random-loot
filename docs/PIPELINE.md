# EQ Random-Loot Data Pipeline

This document describes the canonical execution order of the data pipeline,
what each step does, expected runtime, and troubleshooting guidance.

---

## Quick Start

```bash
# Run everything (corrections + enrichment + icons)
npm run pipeline:full

# Corrections and validation only — no network calls (fast, safe to re-run)
npm run pipeline:fast

# Preview what would run without doing anything
node --experimental-strip-types scripts/run-pipeline.ts --mode=fast --dry-run

# Keep going even if a step fails
npm run pipeline:full -- --continue-on-error
```

Run logs are written to `data/pipeline-runs/<timestamp>.log` after every run.

---

## Pipeline Modes

| Mode     | npm script         | Steps included                                    |
|----------|--------------------|---------------------------------------------------|
| `fast`   | `pipeline:fast`    | Corrections + validation. No network calls.       |
| `full`   | `pipeline:full`    | Corrections + ZAM enrichment + icons + validation |
| `excel`  | `pipeline:excel`   | Excel ingest + schema migration + validation      |
| `scrape` | `pipeline:scrape`  | Optional ZAM zone/NPC + EQ Progression scrapers   |

---

## Canonical Step Order (`full` mode)

### Step 1 — extract:item-names (Classic)

**Script:** `scripts/extract-item-names.ts`
**Estimated runtime:** ~2 seconds

Reads `data/classic-group-named.json`, extracts every unique item name from
all bucket loot pools, deduplicates and sorts them, then writes
`data/item-names.json`.  This is the seed list that `enrich:zam` iterates over.

### Step 2 — extract:item-names (--all)

**Script:** `scripts/extract-item-names.ts --all`
**Estimated runtime:** ~2 seconds

Re-runs extraction with `--all` to include Kunark and Velious expansion names
alongside Classic.  Overwrites `data/item-names.json` with the combined list.

### Step 3 — apply:missing-corrections

**Script:** `scripts/apply-missing-item-corrections.ts`
**Estimated runtime:** ~3 seconds

Fixes missing/placeholder items.  Applies set expansions for known items,
inserts new item entries from group replacements (spinflint drops, LarkTwitter
arrows, Decayed/Totemic armor sets), applies deletes for meta-entries
("BUGGED", "No Unique Drop", etc.), and renames typos.  Writes
`data/classic-group-named.json`, `classic-group-named.json` (root copy),
`data/item-names.json`, `data/item-details.json`, and
`data/item-enrichment-review.json`.

### Step 4 — apply:small-corrections

**Script:** `scripts/apply-small-item-corrections.ts`
**Estimated runtime:** ~3 seconds

A focused typo-rename pass for a small set of items (e.g. Sepentskin -> Serpentskin,
Mystical Claws of Jo Jo -> Jojo, Obsidian Scimatar -> Scimitar).  Also applies known
Allakhazam direct item URLs.  Writes the same four output files as Step 3.

### Step 5 — apply:manual-corrections

**Script:** `scripts/apply-manual-item-corrections.ts`
**Estimated runtime:** ~3 seconds

Applies curated manual overrides: removes permanently bad items, resolves
Ball-of-Golem-Clay / Rubicite Greaves renames, and marks a large list of
items as `exact_match` clean.  This is the main human-curated checkpoint.

### Step 6 — enrich:zam (with cache)

**Script:** `scripts/enrich-items-from-zam.ts`
**Estimated runtime:** 2–3 minutes (warm cache) / 1–3 hours (cold cache)

Iterates `data/item-names.json` and for each item:

1. Checks whether a complete, versioned schema entry already exists in
   `data/item-details.json` (and skips if so).
2. If an exact Allakhazam item URL is already stored, re-fetches and re-parses
   that page only.
3. Otherwise fetches the Allakhazam search page and selects the best candidate
   by expansion era and exact-name matching.

All pages are cached to `cache/zam-pages/<sha1>.html`.  On cold cache, expect
~1 500 ms per unique request due to rate-limiting.  Output files:
`data/item-details.json`, `data/item-enrichment-errors.json`,
`data/item-enrichment-review.json`.

**Environment variables:**

| Variable               | Default        | Purpose                                      |
|------------------------|----------------|----------------------------------------------|
| `TARGET_EXPANSION`     | `Classic`      | Expansion label written to each item record  |
| `ZAM_REQUEST_DELAY_MS` | `1500`         | Milliseconds between uncached requests       |
| `MAX_ITEMS`            | `0` (all)      | Limit items for testing                      |
| `FORCE_REENRICH`       | unset          | Set `1` to re-fetch even cached entries      |
| `ITEM_NAMES`           | unset          | Pipe-separated list to restrict items        |

### Step 7 — apply:kunark-velious-corrections

**Script:** `scripts/apply-kunark-velious-corrections.ts`
**Estimated runtime:** ~3 seconds

Post-enrichment pass for Kunark and Velious datasets.  Replaces placeholder
names (Fingerssssss -> four Withered Finger items, Crystallized Shadow Armor ->
individual piece names), removes junk entries (Ringmail Armor, Crushed Gems),
applies direct Allakhazam item URL fixes, and marks all Kunark/Velious items
clean.  Writes both expansion dataset files, `data/item-details.json`,
`data/item-enrichment-errors.json`, and the Velious-specific review.

### Step 8 — mark:duplicates-clean

**Script:** `scripts/mark-duplicate-items-clean.ts`
**Estimated runtime:** ~2 seconds

Sweeps `data/item-details.json` for any entry still flagged
`duplicate_name_risk: true` and marks it `exact_match` / Classic.  This step
should be run after `enrich:zam` resolves ambiguous entries so that the review
file reflects the final clean state.

### Step 9 — validate:item-details

**Script:** `scripts/validate-item-details.ts`
**Estimated runtime:** ~3 seconds

Strict schema validation over every record in `data/item-details.json`.
Checks: `name` is a non-empty string, `sources` is an array, `confidence` and
`match_confidence` are non-empty strings, `match_notes` is an array,
`missing_core_stats` and `duplicate_name_risk` are booleans,
`parsing_warnings` is an array, and none of the forbidden scraped-content
fields are present.  Exits non-zero with a list of violations if any check
fails.

### Step 10–12 — import:item-icons (classic / kunark / velious)

**Script:** `scripts/import-item-icons.ts <expansion> group-named`
**Estimated runtime:** ~20–30 minutes per expansion (warm ZAM cache)

For each item in the named expansion dataset that has an exact Allakhazam item
URL and no `iconPath` yet, fetches the item page, scores all `<img>` tags by
URL pattern and proximity to the item title, downloads the best candidate if
its score exceeds 60, and writes the PNG to `public/item-icons/`.  Updates
`iconPath` in `data/item-details.json`.

This step is marked optional (`required: false`) — a failed icon import does
not abort the pipeline.

---

## `excel` Mode Steps

### ingest:excel:tier1

**Script:** `scripts/ingest-excel.ts --all`
**Estimated runtime:** ~30 seconds

Reads `EQ_Master_Database_temp.xlsx` from the project root and emits
per-sheet JSON files to `data/excel-imports/`.

### migrate:item-schema

**Script:** `scripts/migrate-item-schema.ts`
**Estimated runtime:** ~5 seconds

Migrates `data/item-details.json` to the current schema version, backfilling
any new fields introduced since the last migration.

### validate:item-details

Same as Step 9 above.

---

## `scrape` Mode Steps

These steps are all optional and use scripts that are not yet implemented.
They will be silently skipped until the scripts exist on disk.

| Step                     | Purpose                                          |
|--------------------------|--------------------------------------------------|
| enrich:zones-from-zam    | Scrape zone metadata from Allakhazam             |
| enrich:npcs-from-zam     | Scrape NPC drop data from Allakhazam             |
| enrich:from-eqprogression| Enrich item data from EQ Progression wiki        |

---

## Cache Management

All Allakhazam page fetches are cached to `cache/zam-pages/`.  File names are
SHA-1 hashes of the cache key (e.g. `search:Ancient Wyvern` or
`item:https://...`).  A central manifest is tracked at `cache/manifest.json`.

```bash
# Show cache directory sizes
npm run cache:list

# Remove files not modified in 30 days
npm run cache:prune

# Remove files older than 7 days (dry run)
node --experimental-strip-types scripts/cache-utility.ts --prune --older-than=7 --dry-run

# Invalidate one specific cache entry by slug
node --experimental-strip-types scripts/cache-utility.ts --invalidate a3f2c1b4...

# Rebuild manifest from scratch
node --experimental-strip-types scripts/cache-utility.ts --rebuild-manifest
```

---

## Troubleshooting

### "Required step failed. Aborting pipeline."

One of the core correction or validation scripts exited non-zero.  Check the
run log in `data/pipeline-runs/<timestamp>.log` — every stdout/stderr line is
captured there.  You can also re-run the individual script directly:

```bash
node --experimental-strip-types scripts/validate-item-details.ts
```

To proceed past failures (useful for debugging later steps):

```bash
npm run pipeline:full -- --continue-on-error
```

### enrich:zam runs for hours

On a cold cache the rate-limit delay is 1 500 ms per request and each item
requires at least one search + one item page fetch.  With ~500 items that is
roughly 25–30 minutes minimum.  If you only need to refresh a few items, use
environment variables:

```bash
ITEM_NAMES="Ghoulbane|Jambiya" npm run enrich:zam
```

To force re-enrichment of already-cached items:

```bash
FORCE_REENRICH=1 npm run enrich:zam
```

### Validation fails after corrections

The three correction scripts write to `data/item-details.json` directly.  If
they introduce a record with missing required fields, `validate:item-details`
will catch it.  Read the validation error output — it includes the item name
and the failing field name.

### import:item-icons skips everything

Icons are only imported for items that have an exact Allakhazam URL
(`/db/item.html?item=<id>`).  Items with only a search URL will always be
skipped.  Run `enrich:zam` first to resolve search URLs to direct item pages,
then re-run the icon importer.

### Pipeline log location

Every run writes a timestamped log to `data/pipeline-runs/YYYY-MM-DDTHH-MM-SS.log`.
These files are git-ignored.  The log contains the full stdout and stderr of
every child process, step timing, and exit codes.

---

## Data Flow Diagram

```
classic-group-named.json
kunark-group-named.json        extract:item-names
velious-group-named.json  ───────────────────────► data/item-names.json
                                                           │
                          apply:missing-corrections        │
                          apply:small-corrections    ◄─────┘
                          apply:manual-corrections         │
                                  │                        │
                                  ▼                        ▼
                          data/classic-group-named.json    enrich:zam ──► data/item-details.json
                          data/item-names.json (updated)        │              │
                                                                │              ▼
                                  apply:kunark-velious-corrections    mark:duplicates-clean
                                          │                                    │
                                          └──────────────────┬─────────────────┘
                                                             ▼
                                                   validate:item-details
                                                             │
                                                             ▼
                                             import:item-icons (classic/kunark/velious)
                                                             │
                                                             ▼
                                                  public/item-icons/*.png
                                                  data/item-details.json (iconPath)
```
