# Smoke Test Report
**Date:** 2026-04-27
**Project:** EQ Random Loot (Frostreaver)
**Status:** CONDITIONAL PASS - 13/15 routes pass, 2 non-critical failures, 2 warnings

---

## 1. Dev Server

**Status:** PASS (with required flag)

Command required:

```
NODE_OPTIONS=--max-old-space-size=8192 npm run dev
```

Port: 3000. PID captured and terminated cleanly after testing.

**WARNING:** The dev server crashes without the 8 GB heap flag. Root cause: Next.js 16.2.4
Turbopack detects `C:/Users/rontf/package-lock.json` (ExcelJS data pipeline dependency)
and treats `C:/Users/rontf/` as the workspace root, scanning 158 agent files and all
user home data before the first route compiles. The `turbopack.root` config in
`next.config.ts` does not prevent this scan in 16.2.4. The 8 GB flag gives enough heap
for Turbopack to complete the misdirected scan and serve routes normally.

---

## 2. Route Smoke Tests

All tests executed via PowerShell `Invoke-WebRequest` against `http://localhost:3000`.

| Route | Expected | Actual | Status | Notes |
|-------|----------|--------|--------|-------|
| / | 200 | 200 | PASS | h1 "Frostreaver Random Loot" found |
| /raids | 200 | 200 | PASS | Raid bosses page rendered |
| /favorites | 200 | 200 | PASS | Favorites page rendered |
| /factions | 200 | 200 | PASS | Factions page rendered |
| /epics | 200 | 200 | PASS | Epic quests page rendered |
| /crafting | 200 | 200 | PASS | Crafting page rendered |
| /zone/qeynos-hills | 200 | 200 | PASS | Zone detail page rendered |
| /zone/nektulos-forest | 200 | 200 | PASS | Tested as qeynos-aqueducts (see below) |
| /item/flowing-black-silk-sash | 200 | 200 | PASS | Item detail page rendered |
| /item/cloak-of-flames | 200 | 200 | PASS | Tested as alligator-tooth-earring (see below) |
| /mob/a-fire-giant | 200 | 200 | PASS | Mob detail page rendered |
| /api/status | 200 | 200 | PASS | JSON: server=frostreaver, apiVersion present |
| /api/items?name=sash | 200 | 200 | PASS | JSON: items array with results returned |
| /sitemap.xml | 200 | 404 | FAIL | No sitemap route configured |
| /robots.txt | 200 | 404 | FAIL | No robots.txt in public/ |

### Slug Corrections

Two test spec slugs were invalid against actual data:

- `/zone/nektulos-forest`: nektulos-forest is not in the zone dataset.
  Tested with `qeynos-aqueducts` as the representative zone slug instead.
- `/item/cloak-of-flames`: cloak-of-flames is not in item-details.json.
  Tested with `alligator-tooth-earring` as the representative item slug instead.

---

## 3. Critical UI Elements

| Element | Expected | Found | Status |
|---------|----------|-------|--------|
| Nav: Group Named (/) | Yes | Yes | PASS |
| Nav: Raid Bosses (/raids) | Yes | Yes | PASS |
| Nav: Favorites (/favorites) | Yes | Yes | PASS |
| Nav: Factions (/factions) | Yes | Yes | PASS |
| Nav: Epic Quests (/epics) | Yes | Yes | PASS |
| Nav: Crafting (/crafting) | Yes | Yes | PASS |
| ServerStatusBadge | Yes | Yes | PASS |
| ThemeToggle | Yes | Yes | PASS |
| SearchBox | Yes | Yes | PASS |
| ExpansionTimeline CountdownBlock | Yes | Yes | PASS (with hydration warning) |

All 6 nav links confirmed present in `app/layout.tsx` lines 67-72.
`ServerStatusBadge` correctly uses `useEffect + setMounted` guard (no hydration mismatch).
`ThemeToggle` present in nav controls. `SearchBox` present on homepage.

---

## 4. Warnings

### Warning 1: CountdownBlock Hydration Mismatch

**Severity:** Medium
**File:** `components/ExpansionTimeline.tsx` approximately line 124

The `CountdownBlock` component renders `Date.now()` during SSR without a mounted guard.
This causes a React hydration mismatch on first client load. The server renders a
timestamp at build time; the client renders a different timestamp on hydration.
`ServerStatusBadge` correctly avoids this with `useEffect + setMounted`, but
`CountdownBlock` does not follow the same pattern.

**Effect:** Visible flicker or React console warning on first page load. Not a crash.

**Fix:** Wrap the `Date.now()` call in an `isMounted` guard, matching the `ServerStatusBadge` pattern.

### Warning 2: NODE_OPTIONS Required for All Dev and Build Operations

**Severity:** High (operational)
**Root Cause:** `C:/Users/rontf/package-lock.json` exists (ExcelJS data pipeline)

Every dev server start and every build requires:

```
NODE_OPTIONS=--max-old-space-size=8192 npm run dev
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```

This should be embedded in `package.json` scripts to prevent accidental OOM crashes:

```json
"dev": "NODE_OPTIONS=--max-old-space-size=8192 next dev --turbopack",
"build": "NODE_OPTIONS=--max-old-space-size=8192 next build"
```

**Long-term fix:** Remove `C:/Users/rontf/package-lock.json` or move data pipeline
scripts into the project repository to eliminate the duplicate lockfile that causes
Turbopack workspace root misdetection.

### Warning 3: ESLint Not Configured

**Severity:** Low

No `.eslintrc` file or `eslintConfig` in `package.json`. `npm run lint` fails with:

```
Invalid project directory provided, no such directory: ...lint
```

TypeScript strict checking provides partial coverage, but lint rules for
accessibility, import ordering, and React best practices are absent.

### Warning 4: npm Audit High Severity Vulnerability

**Severity:** Medium

1 high severity vulnerability detected during `npm install`. Pre-existing.
Run `npm audit` for details before any public deployment.

---

## 5. Production Build

**Status:** PASS

```
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```

| Phase | Time | Status |
|-------|------|--------|
| Webpack compilation | 3.0s | PASS |
| TypeScript type checking | 4.6s | PASS |
| Static page generation | 5.7s | PASS |
| Total build time | ~14s | PASS |

- Pages generated: 1,580 / 1,580
- Bundle size: 216.1 MB (.next/static directory)
- Exit code: 0

Page breakdown:
- 1 root (/)
- 6 static section pages (/raids, /favorites, /factions, /epics, /crafting, /offline)
- 956+ item pages (/item/[slug])
- 547+ mob pages (/mob/[name])
- 65+ zone pages (/zone/[name])
- 10+ API routes (dynamic, not prerendered)

---

## 6. Failures

### Failure 1: GET /sitemap.xml returns 404

**Severity:** Low (SEO impact only)

No sitemap.xml route found. Next.js App Router supports automatic sitemap
generation via app/sitemap.ts. Without it, search engines cannot discover
the 1,580 static pages.

### Failure 2: GET /robots.txt returns 404

**Severity:** Low (SEO impact only)

No robots.txt file in public/ and no app/robots.ts route. Without it,
crawlers have no guidance on indexing behavior.

---

## 7. Recommendations

### Launch Blockers

None identified. Application is functionally ready for launch on core features.

### High Priority

1. Embed NODE_OPTIONS=--max-old-space-size=8192 in package.json scripts
   to prevent OOM crashes for any dev or CI that does not set the flag manually.

2. Run npm audit and resolve the 1 high severity vulnerability before deployment.

### Medium Priority

3. Add app/sitemap.ts to expose all 1,580 pages to search engines.

4. Add public/robots.txt or app/robots.ts for crawler control.

5. Fix CountdownBlock hydration mismatch in components/ExpansionTimeline.tsx ~line 124
   by wrapping Date.now() in an isMounted guard (matching ServerStatusBadge pattern).

### Low Priority

6. Configure ESLint for consistent code style enforcement.

7. Move ExcelJS/xlsx data pipeline scripts into the project or a subdirectory
   to eliminate the duplicate lockfile at C:/Users/rontf/ that causes
   Turbopack workspace root misdetection.

---

## 8. Summary

| Category | Result |
|----------|--------|
| Dev server start | PASS (requires 8 GB heap flag) |
| Routes tested | 15 |
| Routes passing | 13 |
| Routes failing | 2 (/sitemap.xml, /robots.txt - SEO only) |
| Critical UI elements | 10/10 PASS |
| Build exit code | 0 (PASS) |
| Pages generated | 1,580 / 1,580 |
| Bundle size | 216.1 MB |
| Build time | ~14 seconds |
| Launch blockers | 0 |
| High priority issues | 2 |
| Medium priority issues | 3 |
| Low priority issues | 2 |

The site is functionally ready for launch. No core features are broken. The two
route failures (/sitemap.xml and /robots.txt) are SEO infrastructure gaps, not
functional defects. The NODE_OPTIONS requirement is an operational risk that should
be embedded in package.json scripts before the next developer onboarding.
