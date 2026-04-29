# EQ-random-loot Implementation Plan

This document is the build queue for the next phase of EQ-random-loot. It is written so that any specialized agent (frontend-developer, backend-developer, scraper, qa-expert) can pick up a single feature and execute against it without further architectural decisions.

## Hard Constraints (read first)

- **No styling frameworks.** No Tailwind, no CSS-in-JS, no ShadCN, no MUI, no Chakra, no Bootstrap, no styled-components, no emotion, no vanilla-extract. The custom CSS system in `app/globals.css` plus per-component `.css` files (e.g. `components/bucket-card.css`) is intentional and load-bearing. New features extend the existing tokens (`--bg`, `--surface`, `--accent`, `--exp-classic-*`, `--exp-kunark-*`, `--exp-velious-*`, `--bucket-*`) and reuse existing utility classes (`.page`, `.header`, `.eyebrow`, `.toolbar`, `.expansion-pill`, `.filter-button`, `.chip`, `.zone-link`, `.bucket-card`, `.expansion-tone-*`).
- **No new runtime dependencies** unless explicitly listed in a feature's "Dependencies" section. Current production deps are exactly: `next`, `react`, `react-dom`, `postcss`. Even the build pipeline relies on `node --experimental-strip-types` for TS scripts (no tsx, no esbuild, no bundler dev-deps for scripts).
- **Data is static JSON in `data/`** loaded with `import data from "@/data/foo.json"`. Buckets live in `classic-group-named.json`, `kunark-group-named.json`, `velious-group-named.json`. Item details are keyed by item name in `item-details.json`. New data sources follow the same convention.
- **Routing is App Router (Next.js 16)**. Pages are server components by default; client interactivity is opt-in with `"use client"` (see `app/page.tsx`, `app/raids/page.tsx`, `app/favorites/page.tsx`). Static export friendliness should be preserved (avoid runtime APIs, prefer `generateStaticParams` over dynamic SSR for SEO routes).
- **Persistence pattern is `window.localStorage`** with a `frostreaver-` key prefix and a head-injected boot script in `app/layout.tsx` to avoid hydration flashes (see the `frostreaver-theme` script). Any new persisted preference follows that pattern.
- **TypeScript strict mode is on** (`tsconfig.json`). New code must type-check under `next build`.

## Existing Architecture Snapshot

```
app/
  layout.tsx           Root shell, FavoritesProvider, ItemPreviewProvider, theme boot
  page.tsx             Group-named home (client component, holds ALL state today)
  raids/page.tsx       Raid tier viewer
  favorites/page.tsx   Favorites checklist
  globals.css          1,470-line design system (DO NOT REPLACE)
components/
  BucketCard, ZoneView, SearchBox, ItemDrawer, LevelRecommendations
  ItemPreviewProvider, FavoritesProvider, ThemeToggle, ItemPreviewToggle
  ItemIcon, FavoriteIndicator, EqItemInspect
  raid/RaidBossCard, raid/RaidTierCard
  *.css per-component (bucket-card.css, item-drawer.css, search-box.css)
lib/
  buckets.ts           bucketForLevel, bestZonesForBucket, bucketLevelRange
  zones.ts             getZoneView, getAllZones (currently lowercase-name resolver)
  search.ts            Bucket/Mob/ItemDetails types, filterBuckets
  universal-search.ts  Cross-entity ranked typeahead
  raidTiers.ts         Raid types
  favorites.ts, lootModes.ts, item-navigation.ts
data/
  *-group-named.json, *-raid.json, item-details.json, item-names.json
  enrichment review/error logs
scripts/
  enrich-items-from-zam.ts   Cached HTML scrape, slug-hashed cache, backoff
  import-item-icons.ts       Image candidate scoring, downloads to public/item-icons
  validate-item-details.ts, extract-item-names.ts, apply-*-corrections.ts
cache/zam-pages/            Slug-hashed HTML cache (keep this pattern)
public/item-icons/          Local icon mirror
```

Existing `--accent` is currently the Frostreaver green (`#2d6a4f` light / `#7fc59b` dark). Per-server theming (Feature A) needs to swap that token at the `:root[data-server="..."]` level rather than rewrite components.

---

## A. Server Selector (Mischief / Teek / Frostreaver)

### Goal
Toggle between the three Random Loot servers. Bucket data, raid data, and visual accent should swap based on selected server. This is foundational — it must land before B/C/D because those routes need the active server in their key.

### Architecture Decision
- New context: `components/ServerProvider.tsx` (client). Mirrors `FavoritesProvider`. Nested inside `FavoritesProvider` so favorites can be scoped per-server later (out of scope here, but server id should be readable from any consumer).
- Persistence: `localStorage["frostreaver-server"] = "frostreaver" | "mischief" | "teek"`. Head-injected boot script in `app/layout.tsx` writes `document.documentElement.dataset.server` before paint, exactly mirroring the theme pattern. Default: `frostreaver` (preserves current behavior).
- URL param: `?server=frostreaver|mischief|teek` overrides localStorage on first read; if present, persist the override. Use `useSearchParams()` in a tiny client wrapper inside `ServerProvider`. The URL is the source of truth for shareable links; localStorage is the fallback. Do not reflect server changes back to the URL on every toggle (would pollute history) — only when a user explicitly opens a "share this view" affordance (out of scope).
- Data gating: introduce `lib/datasets.ts` with `getBucketsForServer(server)` returning the correct dataset arrays. Today all three servers share `classic-group-named.json` etc., but the loader is the seam where Mischief/Teek-specific overrides can be merged later (e.g. `data/mischief-overrides.json`). Each server gets its own folder under `data/` long-term: `data/frostreaver/classic-group-named.json`, `data/mischief/...`, `data/teek/...`. For the first cut, symlink/copy the existing files; the import path is the abstraction.
- Toolbar UI: a third pill group in the `app-nav-controls` slot of `layout.tsx`, before `ItemPreviewToggle`. Reuse `.theme-toggle` markup pattern (`.server-toggle` class). Three buttons, one active.

### API / Function Signatures
```ts
// lib/servers.ts
export type ServerId = "frostreaver" | "mischief" | "teek";
export const SERVERS: { id: ServerId; label: string; accent: string }[];
export function isServerId(value: unknown): value is ServerId;

// components/ServerProvider.tsx
export function ServerProvider({ children }: { children: ReactNode }): JSX.Element;
export function useServer(): { server: ServerId; setServer: (s: ServerId) => void };

// lib/datasets.ts
export function getGroupNamedDatasets(server: ServerId): LootDataset[];
export function getRaidDatasets(server: ServerId): RaidDataset[];
export function getItemDetails(server: ServerId): ItemDetailsMap;
```

### Data File Additions
- `data/frostreaver/` (move existing files here, keep `data/*.json` re-exports as shims for one release).
- `data/mischief/` and `data/teek/` placeholder copies (identical to Frostreaver) so the loader has something to import. Per-server divergence is a follow-up data project; it does not block this feature.

### Component Additions / Modifications
- New: `components/ServerProvider.tsx`, `components/ServerToggle.tsx`, `lib/servers.ts`, `lib/datasets.ts`.
- Modify `app/layout.tsx`: add boot script for `data-server`, wrap children in `ServerProvider`, add `<ServerToggle />` to `app-nav-controls`.
- Modify `app/page.tsx`, `app/raids/page.tsx`, `app/favorites/page.tsx`: replace direct JSON imports with `getGroupNamedDatasets(server)` / `getItemDetails(server)`. The `useMemo` chains in `page.tsx` already key off `selectedExpansionSet`; add `server` to those dependency lists.
- Update page metadata: title becomes `"<Server> Loot Buckets"` based on segment-level metadata or a small client `<title>` mutation in each page (acceptable since pages are already client components).

### CSS Additions
- Extend `:root[data-server="frostreaver"]`, `:root[data-server="mischief"]`, `:root[data-server="teek"]` blocks in `globals.css`. Each only overrides `--accent`, `--accent-soft`, `--accent-contrast`, `--focus-ring`, `--filter-active-bg`, `--filter-active-border`, `--filter-active-shadow`. Suggested palettes:
  - Frostreaver: keep current green.
  - Mischief: warm amber `--accent: #c9802a` light / `#f0a958` dark.
  - Teek: cool indigo `--accent: #4a5dc7` light / `#8c9bf0` dark.
- New token group `--server-mischief-*`, `--server-teek-*`, `--server-frostreaver-*` for any cross-server UI (e.g. comparison rows in a future view).
- New `.server-toggle` and `.server-toggle-button` styles. Copy `.theme-toggle` selectors verbatim and rename. Roughly 30 lines.

### Scripts to Run
None. This is pure runtime work. (Long-term, a `scripts/migrate-data-by-server.ts` will split data per server; flagged in F.)

### Tests to Add
- Unit test (Node smoke under `node --experimental-strip-types`): `scripts/test-servers.ts` that round-trips localStorage, URL param override, and dataset loader for each `ServerId`.
- Manual QA checklist in PR description: load each server, confirm accent change without flash, verify deep link `?server=teek` wins over stored value.

### Risk to Existing Code
**Medium.** `app/page.tsx` currently constructs `buckets` as a module-level constant (`const buckets = datasets.flatMap(...)`). That has to move inside the component (or into a `useMemo` keyed on `server`). Any code that relied on the constant identity will break — only `app/favorites/page.tsx` does. Audit all `import classicData from "@/data/classic-group-named.json"` call sites and route them through the loader.

### Effort
**M** (1.5 days). Bulk of the time is the data loader migration and verifying no SSR/CSR mismatch on the boot script.

---

## B. Mob Detail Pages (`/mob/[name]`)

### Goal
Permalink + SEO landing for every named mob ("the bone golem"), showing the mob's zone, level, bucket, full bucket loot pool, and links to sibling mobs.

### Route Structure
```
app/mob/[name]/page.tsx       Server component (RSC), reads slug, looks up mob
app/mob/[name]/not-found.tsx  Custom 404 for unknown mob
```
- Slug: `safeMobSlug(name)` from a new `lib/slug.ts` helper. `"a corrupted minotaur"` -> `a-corrupted-minotaur`. Encoder/decoder round-trips losslessly because mob names are unique within a server (verify in unit test; if collision, suffix with bucket id).
- Use `generateStaticParams()` to pre-render every mob across all servers. Multi-server: the route is `/mob/[name]` with an optional `?server=` param; static params include each (server, mob) pair only if names collide between servers — first cut uses Frostreaver as the canonical and other servers fall back via redirect.

### Data Source
- Reuse `getGroupNamedDatasets(server).flatMap(d => d.buckets)`. Build a `mobIndex: Map<slug, { mob: Mob; bucket: Bucket }>` once at module load (cheap, the JSON is small).
- New helper in `lib/zones.ts` (or new `lib/mobs.ts`): `getMobView(buckets, slug): MobView | null` returning `{ mob, bucket, siblingsInZone, siblingsInBucket }`.

### Component Strategy
- **New** `components/MobView.tsx` (client component) reusing the visual language of `ZoneView`. It is NOT just a `BucketCard` — `BucketCard` shows the entire bucket; `MobView` highlights one mob and de-emphasizes others.
- Reuse `<EqItemInspect>` and `<ItemIcon>` for the loot list.
- Reuse `<ItemDrawer>` for click-to-inspect (same modal as home).
- Reuse `<FavoriteIndicator>` per item.

### API / Route Signatures
```ts
// app/mob/[name]/page.tsx
export async function generateStaticParams(): Promise<{ name: string }[]>;
export async function generateMetadata({ params }): Promise<Metadata>;
export default function MobPage({ params }: { params: Promise<{ name: string }> }): JSX.Element;

// lib/mobs.ts
export type MobView = { mob: Mob; bucket: Bucket; zoneSiblings: Mob[]; bucketSiblings: Mob[] };
export function getMobBySlug(buckets: Bucket[], slug: string): MobView | null;
export function mobSlug(name: string): string;
export function unmobSlug(slug: string): string;
```

### Data File Additions
None.

### Component Additions / Modifications
- New: `app/mob/[name]/page.tsx`, `app/mob/[name]/not-found.tsx`, `components/MobView.tsx`, `components/mob-view.css`, `lib/mobs.ts`, `lib/slug.ts`.
- Modify `components/BucketCard.tsx`: each `mob.name` `<strong>` becomes a `<Link href={"/mob/" + mobSlug(mob.name)}>` while preserving the zone-link click behavior on the zone column.
- Modify `components/ZoneView.tsx`: same — mob entries become links.
- Modify `lib/universal-search.ts`: results should optionally surface `href` so `SearchBox` can render an `<a>` for keyboard-shortcut linking; current callback flow is fine for in-page use, but mob results should also be deep-linkable. Add `href` to `UniversalSearchResult.type === "mob"` results.

### CSS Additions
- New `components/mob-view.css` (~150 lines), reusing `--bucket-*-row`, `--exp-*-bg`, `.expansion-pill`, `.zone-link`, `.loot-button`. New classes: `.mob-view`, `.mob-view-header`, `.mob-view-stats`, `.mob-loot-grid`, `.mob-siblings-strip`. No new tokens needed.

### Scripts to Run
- `npm run build` to confirm `generateStaticParams` doesn't time out (with ~1k mobs across three expansions this is well under Next.js limits).

### Tests to Add
- `scripts/test-mob-routing.ts`: assert every mob name in the datasets produces a unique slug and round-trips back to the canonical name.
- Snapshot test of `getMobBySlug` for one classic, one kunark, one velious mob.
- Lighthouse SEO check (manual) on built output for at least 3 mob pages.

### Risk to Existing Code
**Low.** Adds new routes; only modifies `BucketCard` and `ZoneView` to wrap the mob name in a `<Link>`. The `<Link>` must not swallow the existing zone button click — verify by inspection.

### Effort
**M** (2 days).

---

## C. Zone Detail Pages (`/zone/[name]`)

### Goal
Permalink for every zone, replacing the in-app `?selectedZone` state with a real URL. Zones are also a strong SEO target ("plane of fear loot").

### Architecture
- Mirrors B exactly: `app/zone/[name]/page.tsx`, `lib/zones.ts` already has `getZoneView`, just needs a slug-based version.
- Sibling navigation: bottom-of-page strip showing previous/next zones in the same expansion sorted by lowest level mob. Two `<Link>` components.
- Recommended level range: derive from `Math.min(...mobs.map(m => m.level))` and `Math.max(...)`. Render via existing `.zone-summary-line` pattern from `ZoneView`.

### Route Signatures
```ts
// app/zone/[name]/page.tsx
export async function generateStaticParams(): Promise<{ name: string }[]>;
export async function generateMetadata({ params }): Promise<Metadata>;
export default function ZonePage({ params }: { params: Promise<{ name: string }> }): JSX.Element;

// lib/zones.ts (additions)
export function zoneSlug(name: string): string;
export function getZoneViewBySlug(buckets: Bucket[], slug: string): ZoneView | null;
export function getZoneNeighbors(buckets: Bucket[], slug: string): { previous?: string; next?: string };
```

### Data File Additions
- Optional: `data/zone-metadata.json` (`{ "Plane of Fear": { recommendedLevels: "46-60", continent: "Plane", connections: [...] } }`). For first cut, synthesize from bucket data; the JSON file is the upgrade path when human-curated descriptions land.

### Component Additions / Modifications
- New: `app/zone/[name]/page.tsx`, `components/ZoneDetailView.tsx`, `components/zone-detail-view.css`. Reuses `<ZoneView>` as the body — `ZoneDetailView` is a thin wrapper that adds the breadcrumb header + sibling strip and forwards everything else to `ZoneView`.
- Modify `app/page.tsx`: zone chip clicks should `router.push("/zone/" + zoneSlug(name))` instead of mutating local state, OR keep current local-state behavior on home and only deep-link from new pages. **Recommendation:** keep both. Local in-page filter is fast; the chip can be a `<Link>` plus an `onClick={preventDefault}` that handles in-page when on home, and lets the link through everywhere else. Simpler: on pages other than home, render zone chips as `<Link>`; on home, keep the button.
- Modify `components/ZoneView.tsx`: accept an optional `permalinkHref` prop and render the zone name as a `<Link>` when on a non-home route.

### CSS Additions
- New `components/zone-detail-view.css` (~80 lines): `.zone-detail-breadcrumb`, `.zone-neighbors`, `.zone-neighbor-link`. Reuses `--bucket-*`, `.zone-view`, `.expansion-pill`. No new tokens.

### Scripts to Run
None.

### Tests to Add
- Slug round-trip for every zone in every expansion.
- `getZoneNeighbors` returns empty for the first/last zone, returns valid for middle zones.

### Risk to Existing Code
**Low-Medium.** The zone-link flow is touched in many components; the prop-toggle approach above keeps in-page behavior intact.

### Effort
**M** (1.5 days).

---

## D. Item Detail Pages (`/item/[id]`)

### Goal
Permalink for every item ("Cloak of Flames best in slot Frostreaver"). Modal stays for in-app inspection; pages are for SEO and deep linking.

### Slug Strategy
- `/item/[id]` where `id` is the Allakhazam item id (`14315`) when known, falling back to a name slug. Allakhazam id is in `item-details.json[itemName].sources[].url` — extract via the existing `exactItemUrlPattern` regex in `import-item-icons.ts`. Promote that to `lib/items.ts`.
- Routes: `/item/14315` or `/item/cloak-of-flames` both resolve. `generateMetadata` canonicalizes to `/item/14315` when id is known so duplicates don't dilute SEO.

### Data Source
- `item-details.json` is already the source. Build an `itemIndex: Map<id, ItemDetails>` and `nameIndex: Map<slug, id>` once at module load.
- For "drops from" data, reverse-index `getGroupNamedDatasets(server)` once: `Map<itemName, { bucket: Bucket; mobs: Mob[] }[]>`. Cache it in a module-level variable since the data is static. Move this index to `lib/item-drops.ts`.

### Reuse Strategy
- The body of `<ItemDrawer>` (everything inside `<aside>` minus the close button and backdrop) is extracted into a new `<ItemDetailBody>` component.
- `<ItemDrawer>` renders `<ItemDetailBody>` inside its modal chrome.
- `app/item/[id]/page.tsx` renders `<ItemDetailBody>` directly inside a `.page` layout with breadcrumb.
- This is a **mechanical refactor** — no logic changes. The diff is mostly moving JSX from `ItemDrawer.tsx` to a new file.

### Route Signatures
```ts
// app/item/[id]/page.tsx
export async function generateStaticParams(): Promise<{ id: string }[]>;
export async function generateMetadata({ params }): Promise<Metadata>;
export default function ItemPage({ params }: { params: Promise<{ id: string }> }): JSX.Element;

// lib/items.ts
export function itemIdFromDetails(details: ItemDetails | undefined): string | null;
export function itemSlug(name: string): string;
export function getItemPath(itemName: string, details?: ItemDetails): string;

// lib/item-drops.ts
export type ItemDropLocation = { bucket: Bucket; mobs: Mob[]; expansion: string };
export function getItemDrops(buckets: Bucket[], itemName: string): ItemDropLocation[];
```

### Data File Additions
None. (Optional follow-up: pre-compute the reverse index at build time and ship it as `data/item-drops.json` if the runtime cost ever shows up in Lighthouse — currently not needed.)

### Component Additions / Modifications
- New: `app/item/[id]/page.tsx`, `app/item/[id]/not-found.tsx`, `components/ItemDetailBody.tsx`, `lib/items.ts`, `lib/item-drops.ts`.
- Modify: `components/ItemDrawer.tsx` (extract body, keep wrapper), `components/BucketCard.tsx`, `components/ZoneView.tsx`, `app/favorites/page.tsx` — `loot-button` becomes a `<Link>` that opens the page on Cmd/Ctrl-click and middle-click, but defaults to opening the in-app drawer on plain click. Implementation: render as `<Link href={getItemPath(name)}>` with `onClick={(e) => { if (!e.metaKey && !e.ctrlKey && e.button === 0) { e.preventDefault(); onSelectLoot(...); } }}`.
- Modify `components/ItemPreviewProvider.tsx`: tooltip already shows on hover; ensure the wrapping `<Link>` doesn't break the existing `previewProps` spread.

### CSS Additions
- Reuse `components/item-drawer.css`. Wrap the existing rules under `.item-drawer .item-detail-body` and add a new sibling block `.page .item-detail-body` that strips the modal-only spacing (drawer padding, scroll behavior). About 40 net new lines, all under existing tokens.
- No new tokens.

### Scripts to Run
- `npm run build` and check that `generateStaticParams` produces ~3000 routes (one per item). If the count is too high for the build budget, switch to ISR or only pre-render the top N by drop frequency.

### Tests to Add
- Round-trip: `itemIdFromDetails` then `getItemPath` then route-match for every item.
- `getItemDrops` snapshot for "Cloak of Flames", "Bo Stick", a Velious-only item, and an item that drops nowhere.
- Visual regression: drawer body and page body render identically at desktop width.

### Risk to Existing Code
**Medium.** Extracting `ItemDetailBody` touches `ItemDrawer` which is rendered from three pages. The CSS scoping change requires care — verify that `:where(.item-drawer)` selectors are not over-specific.

### Effort
**M** (2 days).

---

## E. eqprogression.com Scrape Pipeline

### Goal
Add eqprogression.com as a second authoritative source for items (and potentially mobs/zones/quests). Used to fill gaps in the ZAM scrape (focus effects, recommended camps, lore, raid loot tables) and to cross-validate.

### Pattern
Pattern after `scripts/enrich-items-from-zam.ts` exactly:
- Cache directory: `cache/eqprogression-pages/` (slug-hashed file names via the same `slug()` SHA1 hash).
- User-Agent string: `FrostreaverLootReference/0.x (+local enrichment review; contact: local)`.
- Request delay: 1500ms default (env override `EQP_REQUEST_DELAY_MS`).
- Output: `data/item-details.json` is **not** overwritten; instead emit a parallel file `data/item-details-eqp.json` keyed by item name with the same `ItemDetails` shape PLUS eqp-only fields. A separate merge script (`scripts/merge-item-sources.ts`) reconciles ZAM + EQP into a single `data/item-details-merged.json` that the app actually consumes (rename `item-details.json` to that path in a follow-up; for now write a 5-line `data/item-details.json` shim that re-exports the merged file). Field-level merge precedence: ZAM exact_match wins for combat stats; EQP wins for `worn_effects`/`focus_effects` text and quest-source flag; conflicts go to a review log.

### Field Targets (TBD by competitive-analyst agent)
The competitive analyst agent should produce a delta report comparing ZAM and EQP for 20 sample items and pick fields per source. Initial guesses to bootstrap:
- `eqp_url`, `eqp_quest_source` (string|null), `eqp_camp_notes` (string|null), `eqp_drop_rate` (string|null).
- Mobs: `eqp_faction`, `eqp_resists`, `eqp_summary`.
- Zones: `eqp_recommended_levels`, `eqp_overview`.

### API / Function Signatures
```ts
// scripts/enrich-items-from-eqp.ts (mirrors ZAM script)
type EqpItemDetails = ItemDetails & {
  eqp_url: string;
  eqp_quest_source: string | null;
  eqp_camp_notes: string | null;
  eqp_drop_rate: string | null;
};

// scripts/merge-item-sources.ts
type MergedItemDetails = ItemDetails & Pick<EqpItemDetails, "eqp_url" | "eqp_quest_source" | "eqp_camp_notes" | "eqp_drop_rate">;
```

### Data File Additions
- `data/item-details-eqp.json` (output of EQP scrape).
- `data/item-details-eqp-errors.json`, `data/item-details-eqp-review.json` (mirrors ZAM error/review logs).
- `data/item-details-merged.json` (output of merge script).
- `cache/eqprogression-pages/*.html`.

### Component Additions / Modifications
- Modify `components/EqItemInspect.tsx` to render `eqp_camp_notes` and `eqp_quest_source` blocks when present.
- Modify `lib/search.ts` `ItemDetails` type to include the new optional fields.

### CSS Additions
- One new section block in `components/item-drawer.css`: `.eqp-notes` styled like the existing `.sources` block. ~15 lines.

### Scripts to Run
- `npm run enrich:eqp:test` (new package.json entry, `EQP_MAX_ITEMS=5`).
- `npm run enrich:eqp` (full run).
- `npm run merge:item-sources`.

### Tests to Add
- Cache hit/miss test: re-run the script with cached files and verify zero network calls.
- Field-extraction unit test: feed three saved HTML fixtures (`tests/fixtures/eqp/*.html`) into the parser and snapshot the output.
- Merge precedence test: ZAM `exact_match` + EQP `needs_review` -> ZAM wins for combat stats.

### Risk to Existing Code
**Low.** Additive. The merge script is the only thing touching the production `item-details.json` file path.

### Effort
**L** (3-4 days). Most of that is the parser + a robust merge precedence rule with a review log.

### Dependencies
None new. Uses built-in `fetch`, `node:fs`, `node:crypto` exactly like the ZAM script.

---

## F. Excel Data Ingest Pipeline

### Goal
One-shot extraction of `EQ_Master_Database_temp.xlsx` (`C:/Users/rontf/EQ_Master_Database_temp.xlsx`) into per-sheet JSON files that the app and downstream features (G, H, I) consume.

### Architecture
- Single CLI script: `scripts/import-excel-master.ts`. Takes a `--input=<path>` arg (defaults to `C:/Users/rontf/EQ_Master_Database_temp.xlsx`) and `--out=data/excel-import-`.
- Per-sheet emitter functions, registered by sheet name. Unknown sheets log a warning and dump raw rows for human review.
- Each emitter outputs `data/excel-import-<sheet-slug>.json` with shape `{ source: string; importedAt: string; rows: T[] }` where `T` is sheet-specific.
- Validation step: after import, run `validate:excel-against-item-details` which cross-references item names in the Excel against `item-details.json` keys and emits `data/excel-import-validation.json` with `{ matched: [], unmatched: [], orphan_in_details: [] }`.

### Dependency Decision
**Adds one runtime-script dependency:** `xlsx` (SheetJS, MIT, dependency-free). It is the only viable path to read .xlsx without writing a parser. Add as a `devDependency` only — it is not loaded by the Next app. If the user wants to avoid `xlsx` for any reason, the fallback is converting to CSV manually with `Read-ExcelHardeningChecklist.ps1`-style PowerShell and then parsing CSVs with a hand-rolled splitter; flag this as the alternative if the dependency is rejected.

### Per-Sheet Emitters (initial set — adjust based on actual sheets)
```ts
// scripts/import-excel-master.ts
type Emitter<T> = {
  sheet: string;
  outFile: string;
  parseRow: (row: Record<string, unknown>) => T | null;
  validate?: (rows: T[]) => string[];
};

const emitters: Emitter<unknown>[] = [
  emitTailoring,         // sheet: "Tailoring"        out: data/excel-import-tailoring.json
  emitFletching,         // sheet: "Fletching"
  emitBlacksmithing,     // sheet: "Blacksmithing"
  emitJewelcraft,        // sheet: "Jewelcraft"
  emitSpellResearch,     // sheet: "Spell Research"
  emitFactionGuide,      // sheet: "Faction Guide"
  emitEpicQuests,        // sheet: "Epic 1.0 Quests"
  emitItemNotes,         // sheet: "Items" / "Loot"   merged into item-details on validation
];
```

### API / Function Signatures
```ts
// scripts/import-excel-master.ts
type RecipeRow = {
  item: string;
  components: string[];
  trivial: number | null;
  containers: string[];
  notes: string | null;
};
type FactionRow = { faction: string; allies: string[]; enemies: string[]; mobs: string[]; quests: string[] };
type EpicQuestStep = { step: number; description: string; mob?: string; zone?: string; itemRequired?: string };
type EpicQuest = { class: string; name: string; reward: string; steps: EpicQuestStep[] };
```

### Data File Additions
- `data/excel-import-tailoring.json`, `-fletching.json`, `-blacksmithing.json`, `-jewelcraft.json`, `-spell-research.json`, `-faction-guide.json`, `-epic-quests.json`, `-validation.json`.
- `data/excel-import-raw-<sheet>.json` for any unrecognized sheet.

### Component Additions / Modifications
None directly. The output JSON is consumed by features G, H, I.

### CSS Additions
None.

### Scripts to Run
- `npm run import:excel` (new entry: `node --experimental-strip-types scripts/import-excel-master.ts`).
- `npm run validate:excel` (new entry: `node --experimental-strip-types scripts/validate-excel-against-item-details.ts`).

### Tests to Add
- Snapshot test on a 3-row fixture per sheet. Fixtures live in `tests/fixtures/excel/*.json` (committed; the .xlsx itself is not committed because it's outside the repo).
- Validation script asserts every recipe component name resolves to a known item OR is in a curated `data/excel-import-component-allowlist.json` (raw materials, NPC-supplied components).

### Risk to Existing Code
**Low.** Pure additive script. The validation step is read-only against `item-details.json`.

### Effort
**L** (3 days). The emitters are individually small; the time sink is per-sheet schema discovery and the validation pass.

### Dependencies
- `xlsx` (devDependency, ~600KB unpacked). Only the import script imports it; no production runtime impact.

---

## G. Crafting / Recipes Page (`/crafting`)

### Goal
Browse craftable items grouped by skill, with components, trivial level, containers, and "where to farm components" links back into the bucket data.

### Route Structure
```
app/crafting/page.tsx           Tabs: All / Tailoring / Fletching / Blacksmithing / Jewelcraft / Spell Research
app/crafting/[skill]/page.tsx   Direct deep link to a skill tab
```

### Data Shape
```ts
// lib/crafting.ts
export type Recipe = {
  id: string;                  // slug of "<skill>-<item>"
  skill: "Tailoring" | "Fletching" | "Blacksmithing" | "Jewelcraft" | "Spell Research";
  item: string;                // resolves to item-details.json key
  components: { name: string; quantity: number; isRawMaterial: boolean }[];
  containers: string[];        // e.g. ["Loom", "Sewing Kit"]
  trivial: number | null;
  notes: string | null;
  source: "Excel";
};

export function getRecipesBySkill(skill: string): Recipe[];
export function getRecipesForItem(itemName: string): Recipe[];   // for ItemDetailBody
export function getRecipesUsingComponent(componentName: string): Recipe[];
```
Loaded from `data/excel-import-tailoring.json` + siblings via a small barrel `lib/crafting.ts` that concatenates them.

### Component Approach
- New `components/RecipeCard.tsx` mirroring `BucketCard` visually: kicker (skill), title (item), stats row (trivial, container count, component count), expandable component list, expandable "where to farm components" panel (uses `getItemDrops` from D for each component).
- New `components/RecipeGrid.tsx` (the `crafting-grid` analog of `bucket-grid`).
- New `components/CraftingTabs.tsx` for the skill switcher (reuses `.expansion-toggle-group` styles).

### Cross-Feature Hooks
- In `<ItemDetailBody>` (from D), add a "Recipes that use this" section if `getRecipesUsingComponent(itemName).length > 0`, and a "Crafted by" section if `getRecipesForItem(itemName).length > 0`.

### Route Signatures
```ts
// app/crafting/page.tsx
export const metadata: Metadata;
export default function CraftingPage(): JSX.Element;

// app/crafting/[skill]/page.tsx
export async function generateStaticParams(): Promise<{ skill: string }[]>;
export async function generateMetadata({ params }): Promise<Metadata>;
export default function CraftingSkillPage({ params }): JSX.Element;
```

### Data File Additions
None beyond F.

### Component Additions / Modifications
- New: `app/crafting/page.tsx`, `app/crafting/[skill]/page.tsx`, `components/RecipeCard.tsx`, `components/RecipeGrid.tsx`, `components/CraftingTabs.tsx`, `components/recipe-card.css`, `lib/crafting.ts`.
- Modify `components/ItemDetailBody.tsx` (cross-link sections).
- Modify `app/layout.tsx`: add a `Crafting` link to the nav.

### CSS Additions
- `components/recipe-card.css` (~180 lines), follows `bucket-card.css`. Reuses `--card`, `--bucket-border-*`, `--exp-*-*`. New tokens:
  - `--skill-tailoring-bg`, `--skill-tailoring-border`, `--skill-tailoring-text`
  - `--skill-fletching-*`, `--skill-blacksmithing-*`, `--skill-jewelcraft-*`, `--skill-spell-research-*`
- Each skill gets a tone class on the card root, mirroring `expansion-tone-*`. Add `.skill-tone-tailoring`, `.skill-tone-fletching`, etc., in `globals.css` (~40 lines).

### Scripts to Run
- F prerequisites: `npm run import:excel` and `npm run validate:excel`.

### Tests to Add
- `getRecipesForItem("Cloak of Flames")` returns expected recipes (or empty).
- `generateStaticParams` produces exactly 5 skill slugs.

### Risk to Existing Code
**Low.** New routes, new components, only `ItemDetailBody` gains optional sections.

### Effort
**M** (2 days). Depends on F.

---

## H. Faction Guide Page (`/faction`)

### Goal
Browse factions, see allies/enemies, see which mobs grant or remove faction, see related quests.

### Route Structure
```
app/faction/page.tsx              Index of all factions
app/faction/[name]/page.tsx       One faction with full bucket-by-faction view
```

### Data Sources
1. Excel `Faction Guide` sheet (via F) — primary.
2. Per-mob faction extracted from existing scraped Allakhazam HTML in `cache/zam-pages/`. Add a faction parser to `enrich-items-from-zam.ts` (or a sibling `enrich-mobs-from-zam.ts`) that emits `data/mob-factions.json` keyed by mob name.
3. EQP (E) optional augmentation.

### Data Shape
```ts
// lib/factions.ts
export type FactionRecord = {
  id: string;            // slug of name
  name: string;
  allies: string[];
  enemies: string[];
  mobs: { name: string; delta: number; zone: string }[];   // who grants / removes faction
  quests: string[];
};
export function getFactionBySlug(slug: string): FactionRecord | null;
export function getFactionsForMob(mobName: string): { faction: string; delta: number }[];
```

### Component Approach
- `components/FactionCard.tsx` for the index grid.
- `components/FactionDetailView.tsx` for `[name]/page.tsx`. Two columns: allies/enemies on the left, faction-granting mobs as a `bucket-style` list on the right (reuses `.zone-mob-list` from `ZoneView.tsx`).
- Cross-link from `<MobView>` (B): show "Faction" row listing `getFactionsForMob(mob.name)`.

### Route Signatures
```ts
// app/faction/[name]/page.tsx
export async function generateStaticParams(): Promise<{ name: string }[]>;
export async function generateMetadata({ params }): Promise<Metadata>;
export default function FactionPage({ params }): JSX.Element;

// scripts/enrich-mobs-from-zam.ts (new)
// Reuses cache/zam-pages, parses faction sections, writes data/mob-factions.json
```

### Data File Additions
- `data/excel-import-faction-guide.json` (from F).
- `data/mob-factions.json` (from new mob-faction scraper).
- `data/factions-merged.json` (output of a small merge script that joins Excel + scraped).

### Component Additions / Modifications
- New: `app/faction/page.tsx`, `app/faction/[name]/page.tsx`, `components/FactionCard.tsx`, `components/FactionDetailView.tsx`, `components/faction.css`, `lib/factions.ts`, `scripts/enrich-mobs-from-zam.ts`, `scripts/merge-factions.ts`.
- Modify `components/MobView.tsx` (cross-link), `app/layout.tsx` (nav link).

### CSS Additions
- `components/faction.css` (~120 lines). Reuses `--bucket-rose-*` for "enemy" rows, `--bucket-green-*` for "ally" rows, `--exp-*` tokens for the mob delta strip. No new tokens needed.

### Scripts to Run
- `npm run enrich:mobs:zam` (new entry).
- `npm run merge:factions` (new entry).

### Tests to Add
- Slug round-trip per faction.
- `getFactionsForMob("a froglok knight")` returns expected entries from a fixture.

### Risk to Existing Code
**Low.** Additive routes. Mob-faction scraper reuses the cached HTML, so it does not re-hit Allakhazam.

### Effort
**L** (3 days). The faction parser against ZAM HTML is the unknown — those pages are inconsistently formatted.

---

## I. Epic 1.0 Quest Tracker (`/epics`)

### Goal
Per-class Epic 1.0 walkthrough with step-by-step progression, step-completion checkboxes (localStorage), and links from each step's drop locations into bucket data.

### Route Structure
```
app/epics/page.tsx                Class picker grid
app/epics/[class]/page.tsx        One class's Epic 1.0 with steps
```
14 classes (or whichever the Excel sheet enumerates) -> `generateStaticParams`.

### Data Source
- `data/excel-import-epic-quests.json` (from F).

### Per-Class Progression Flow
- Each step is a row with `description`, optional `mob`, optional `zone`, optional `itemRequired`. Render as an ordered list of expandable cards.
- For any step with `mob` set, link to `/mob/<slug>` (B).
- For any step with `itemRequired`, link to `/item/<id>` (D).
- For any step with `zone`, link to `/zone/<slug>` (C).
- Step-complete state persisted to `localStorage["frostreaver-epic-progress"] = { [className]: number[] }` (array of completed step indices). Mirrors the favorites pattern.

### Data Shape
```ts
// lib/epics.ts
export type EpicStep = {
  step: number;
  description: string;
  mob: string | null;
  zone: string | null;
  itemRequired: string | null;
  notes: string | null;
};
export type EpicQuest = {
  class: string;          // slug
  className: string;      // display name
  questName: string;
  finalReward: string;
  steps: EpicStep[];
};
export function getEpicForClass(slug: string): EpicQuest | null;
export function getAllEpics(): EpicQuest[];
```

### Component Approach
- `components/EpicProgressProvider.tsx` (new, mirrors FavoritesProvider) for completion state.
- `components/EpicStepCard.tsx` — checkbox + collapsed step header + expanded body with cross-links.
- `components/EpicProgressBar.tsx` — small visual indicator at the top of each class's page (`<progress max={steps} value={completed}>` styled per `globals.css`).
- `components/EpicClassPicker.tsx` — grid of class cards on the index page.

### Route Signatures
```ts
// app/epics/[class]/page.tsx
export async function generateStaticParams(): Promise<{ class: string }[]>;
export async function generateMetadata({ params }): Promise<Metadata>;
export default function EpicPage({ params }): JSX.Element;
```

### Data File Additions
- None beyond F.

### Component Additions / Modifications
- New: `app/epics/page.tsx`, `app/epics/[class]/page.tsx`, `components/EpicProgressProvider.tsx`, `components/EpicStepCard.tsx`, `components/EpicProgressBar.tsx`, `components/EpicClassPicker.tsx`, `components/epics.css`, `lib/epics.ts`.
- Modify `app/layout.tsx`: nav link, wrap children in `EpicProgressProvider`.

### CSS Additions
- `components/epics.css` (~200 lines). New per-class tone tokens (14 of them) — but to keep token count down, reuse existing `--bucket-blue/purple/amber/green/teal/rose` and assign them to class clusters (caster / melee / hybrid / priest). Add four cluster tokens: `--class-caster-*`, `--class-melee-*`, `--class-priest-*`, `--class-hybrid-*` aliasing existing buckets. ~30 net new token lines.
- New utility `.checkbox-step` styled to match `.filter-button`.

### Scripts to Run
- F prerequisites.

### Tests to Add
- `localStorage` round-trip for `epic-progress`.
- `getEpicForClass("warrior")` returns the expected step count.
- Static params produce exactly the class list from the Excel sheet.

### Risk to Existing Code
**Low.** Additive. New context provider sits next to FavoritesProvider in `layout.tsx`.

### Effort
**M** (2 days). Depends on F.

---

## J. PWA / Offline Support

### Goal
Installable app on mobile/desktop, full offline browse of static JSON + scraped item icons. The data is small (~10 MB total of JSON + icons), so an aggressive cache-first strategy is fine.

### Architecture Decision
**Manual service worker, no `next-pwa`.** Reasons:
1. `next-pwa` is unmaintained for Next 15+ and has known incompatibilities with Next 16 / React 19.
2. The app's dependency surface is intentionally small (4 prod deps). Adding a build-time SW generator violates that constraint.
3. The cacheable surface is well-defined and small — a hand-written SW is ~120 lines.

### Caching Strategy
- **App shell** (`/`, `/raids`, `/favorites`, `/mob/*`, `/zone/*`, `/item/*`, `/crafting`, `/faction`, `/epics`, `/_next/static/*`): cache-first with stale-while-revalidate.
- **Static JSON** (`/_next/data/*`, the JSON imports get bundled into JS so they're already covered by the static cache): no special handling.
- **Scraped icons** (`/item-icons/*`): cache-first, never expire (filenames are content-addressed by item id).
- **HTML routes**: network-first with 3s timeout, falling back to cache.
- Cache version key: `frostreaver-cache-v<n>` where `<n>` bumps on every deploy. Old caches purged on `activate`.

### File Layout
```
public/sw.js                      Service worker (~120 lines)
public/manifest.webmanifest       PWA manifest
components/InstallPrompt.tsx      "Install app" UX
lib/pwa.ts                        registerServiceWorker(), beforeInstallPrompt handling
app/layout.tsx                    register SW on load (client effect), include manifest <link>
```

### Install Prompt UX
- `<InstallPrompt />` is a small client component mounted in `layout.tsx` body footer.
- Listens to `beforeinstallprompt`. When fired, stashes the event and reveals a dismissible chip in the footer of the page (not blocking). The chip uses `.filter-button` styles.
- Dismissal persisted to `localStorage["frostreaver-install-dismissed"] = "<timestamp>"` and respected for 30 days.
- iOS has no `beforeinstallprompt`; provide a one-time hint via `/* @media (display-mode: browser) and (max-width: 768px) */` instructions in a help drawer (out of scope for the first cut — flag as a follow-up).

### API / Function Signatures
```ts
// lib/pwa.ts
export function registerServiceWorker(): Promise<void>;
export function getInstallPromptHandle(): Promise<BeforeInstallPromptEvent | null>;

// public/sw.js
const CACHE_VERSION = "frostreaver-cache-v1";
const APP_SHELL = ["/", "/raids", "/favorites", "/manifest.webmanifest", "/icons/icon-192.png", ...];
self.addEventListener("install", ...);
self.addEventListener("activate", ...);
self.addEventListener("fetch", ...);
```

### Data File Additions
- `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`.

### Component Additions / Modifications
- New: `public/sw.js`, `public/manifest.webmanifest`, `components/InstallPrompt.tsx`, `lib/pwa.ts`.
- Modify `app/layout.tsx`: `<link rel="manifest" href="/manifest.webmanifest" />`, `<meta name="theme-color">`, mount `<InstallPrompt />` in body, register SW from a small client effect.

### CSS Additions
- `.install-prompt`, `.install-prompt-button`, `.install-prompt-dismiss` (~40 lines in `globals.css` or a new `components/install-prompt.css`). Reuses `--surface`, `--accent`, `--shadow`, `.filter-button`. No new tokens.

### Scripts to Run
- New `scripts/build-sw-precache-manifest.ts`: scans `.next/static/` after a `next build` and writes the precache list into `public/sw.js`. Wired into a `prebuild`/`postbuild` step.
- New package.json scripts: `build:sw` and update `build` to chain it.

### Tests to Add
- Lighthouse PWA score >= 90 in CI (manual check first).
- Manual: airplane-mode test — load home, navigate to mob/zone/item pages, verify all render from cache.
- Cache-version bump test: deploy a new version, confirm old cache is purged on next reload.

### Risk to Existing Code
**Medium.** Service workers are sticky. A buggy SW can brick the site on every device that ever loaded it. Mitigations:
- Ship a kill-switch SW (a no-op SW that calls `self.registration.unregister()`) ready to deploy if the cache strategy goes wrong.
- Version the cache aggressively; never reuse a cache name across breaking changes.
- Only register the SW in production (`if (process.env.NODE_ENV === "production")`).

### Effort
**M** (2 days). Build manifest generation is the time sink.

### Dependencies
None new.

---

## Ordering & Dependencies

```
A (Server selector)            ----+
                                   |
B (Mob pages)         <--- A ------+----> D (Item pages) <--- A
C (Zone pages)        <--- A      /                          |
                                  |                          |
F (Excel ingest) -------+         |                          |
                        +--> G (Crafting)  <----- D + F      |
                        +--> H (Faction)   <----- B + F + E (E optional)
                        +--> I (Epics)     <----- B + C + D + F
                                                              |
E (eqprogression scrape)  (parallel; merges into D's body)----+
                                                              |
J (PWA)                                  <-- everything else --+
```

### Recommended Execution Order
1. **A — Server selector** (foundational; everything else uses `useServer()`).
2. **B — Mob pages** + **C — Zone pages** in parallel (independent agents).
3. **D — Item pages** (after B/C land so cross-links exist).
4. **F — Excel ingest** (parallel with D; no overlap).
5. **E — eqprogression scrape** (parallel with F; merges into D's body once both ship).
6. **G — Crafting**, **H — Faction**, **I — Epics** in parallel after F.
7. **J — PWA** last, after the route surface is final (otherwise the SW manifest churns every build).

### Total Effort Roll-Up

| Feature | Effort | Days |
|---|---|---|
| A. Server selector | M | 1.5 |
| B. Mob pages | M | 2 |
| C. Zone pages | M | 1.5 |
| D. Item pages | M | 2 |
| E. eqprogression scrape | L | 3.5 |
| F. Excel ingest | L | 3 |
| G. Crafting | M | 2 |
| H. Faction | L | 3 |
| I. Epics | M | 2 |
| J. PWA | M | 2 |
| **Total** | | **~22.5 dev-days** |

Parallelism brings calendar time to roughly **3 weeks** with two engineers, **5 weeks** with one.

---

## CSS Token Additions Summary (consolidated)

All new tokens declared in **both** light (`:root`) and dark (`:root[data-theme="dark"]`) blocks of `app/globals.css`:

| Token | Feature | Purpose |
|---|---|---|
| `--server-frostreaver-*` (4 vars) | A | Server-scoped accents |
| `--server-mischief-*` (4 vars) | A | Server-scoped accents |
| `--server-teek-*` (4 vars) | A | Server-scoped accents |
| `--skill-tailoring-*` (3 vars) | G | Recipe card tone |
| `--skill-fletching-*` (3 vars) | G | Recipe card tone |
| `--skill-blacksmithing-*` (3 vars) | G | Recipe card tone |
| `--skill-jewelcraft-*` (3 vars) | G | Recipe card tone |
| `--skill-spell-research-*` (3 vars) | G | Recipe card tone |
| `--class-caster-*` (3 vars) | I | Epic class cluster (alias `--bucket-purple-*`) |
| `--class-melee-*` (3 vars) | I | Epic class cluster (alias `--bucket-rose-*`) |
| `--class-priest-*` (3 vars) | I | Epic class cluster (alias `--bucket-blue-*`) |
| `--class-hybrid-*` (3 vars) | I | Epic class cluster (alias `--bucket-amber-*`) |

Total: ~50 new tokens across both themes. **No existing tokens are renamed or removed.**

---

## Open Questions for the User

1. **Server scope of favorites.** Should favorites be global (current behavior) or per-server? If per-server, the storage key becomes `frostreaver-favorites-<serverId>` and migration is needed.
2. **Item id canonicalization in URLs.** D defaults to `/item/<allakhazam-id>`. If the user prefers human-readable URLs (`/item/cloak-of-flames`), we lose the duplicate-name disambiguation that ZAM ids give us; flag duplicates in the route 404 page instead.
3. **eqprogression.com terms of use.** Confirm scraping is acceptable. ZAM is already being scraped under "local research" rationale; EQP may have stricter terms. The competitive-analyst agent should validate this in feature E's design phase.
4. **Excel sheet names.** This plan assumes sheet names "Tailoring", "Fletching", etc. The actual sheets in `EQ_Master_Database_temp.xlsx` need to be confirmed; the F emitters list is provisional.
5. **Static export vs Node runtime.** If `next export` (fully static) is the deploy target, every dynamic route must have complete `generateStaticParams`. With ~3000 items, build time should still be under 2 minutes; confirm before committing to the route shape in D.

---

## Definition of Done (per feature)

A feature is done when:
1. `npm run build` succeeds with zero TypeScript errors.
2. `npm run lint` passes (assuming `eslint` is added; currently not in devDeps — flagged as a tooling gap to fix in feature A's PR).
3. Every new route renders in dev (`npm run dev`) and in a production build.
4. Every new route has metadata (`generateMetadata`) with title and description.
5. Light + dark theme both render without contrast regressions on the new routes.
6. Server toggle (after A lands) swaps accent without flash on every new route.
7. The PR description includes a manual QA checklist and screenshots for both themes.
8. No new runtime dependency was added unless explicitly listed in this doc.
9. No Tailwind / CSS-in-JS / framework was introduced.
10. Existing routes (home, raids, favorites) still pass smoke testing.
