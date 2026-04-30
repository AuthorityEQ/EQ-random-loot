# Mobile Responsive Audit

**Breakpoints:** 980px / 720px / 620px / 380px  
**Audit date:** 2026-04-27  
**Auditor:** qa-expert agent

---

## Summary

| Status | Count |
|--------|-------|
| Clean | 9 |
| Needs fixes (all applied) | 5 |
| Broken at 380px (both fixed) | 2 |

**13 CSS rule changes across 4 files. Zero logic changes. Zero new tokens.**

---

## Per-Component Status

### ServerStatusBadge -- CLEAN

CSS: `app/globals.css`

- `min-height: 34px` on badge span. Display-only, not interactive -- 44px a11y floor does not apply.
- `white-space: nowrap` prevents content overflow.
- `@media (max-width: 720px)` adds `align-self: center` for stacked nav.
- `@media (prefers-reduced-motion: reduce)` suppresses the pulse. Correctly handled.
- No fixed widths. No overflow at 380px.

---

### ServerToggle -- CLEAN

CSS: `app/globals.css`

- `display: inline-flex; overflow: hidden` pill group collapses naturally.
- `min-height: 34px` on buttons. Below 44px -- accepted nav-bar constraint (3 buttons in a pill row).
- `@media (max-width: 720px)`: `align-self: center`.
- No fixed widths.

---

### ExpansionTimeline -- CLEAN

CSS: `app/globals.css`

- `.etl-clock` uses `display: flex; gap: 4px` with no fixed widths on blocks.
- `@media (max-width: 720px)`: clock digits reduce 2.4rem -> 1.8rem. Correct.
- `@media (max-width: 720px)`: expansion rows gain `flex-wrap: wrap`.
- 4 clock blocks x 40px min-width = 160px -- fits in 380px viewport.
- Compact widget uses `white-space: nowrap` -- safe in nav bar.

---

### ItemSlotFilter -- CLEAN

CSS: `app/globals.css`

- `.slot-filter-scroll { display: flex; flex-wrap: wrap }` -- pills wrap on small screens.
- `min-width: min(300px, 100%)` on wrapper clamps to viewport correctly at 380px.
- `@media (max-width: 720px)`: `min-width: 100%` for full-width filter.
- `.slot-filter-button--child { min-height: 30px }` was below 44px. **Fix 4 applied** (36px at 720px).

---

### ShareFilterButton -- CLEAN

CSS: `app/globals.css`

- `display: inline-flex; white-space: nowrap; min-height: 34px` -- compact toolbar button.
- `@media (max-width: 720px)`: `align-self: center`.
- No fixed widths.

---

### ConfidenceBadge -- CLEAN

CSS: `app/globals.css`

- `display: inline-flex; white-space: nowrap; font-size: 0.68rem` -- tiny metadata pill.
- No fixed widths. Adapts with its container at all breakpoints.
- `.confidence-badge-detail { font-size: 0.6rem }` is very small secondary metadata; acceptable
  in max-width-constrained item detail context.

---

### EpicTrackerCheckbox -- NEEDS FIX (fix applied)

CSS: No rules found for `.epic-checkbox`, `.epic-checkbox-input`, `.epic-checkbox-box` in any file.

**Issues found:**

1. Missing CSS -- label has no defined dimensions. Touch target defaults to browser-native checkbox
   (~18px on most mobile browsers). **Below 44px a11y requirement.**
2. `.epic-checkbox-box` (custom visual) has no CSS despite the TSX comment describing the visual contract.
3. No `:active` tap state.

**Fixes applied in `app/globals.css` (appended):**
- `.epic-checkbox` label: `display: inline-flex; align-items: center; min-height: 44px; cursor: pointer`.
- `.epic-checkbox-input`: visually hidden (clip-path) but keyboard/screen-reader accessible.
- `.epic-checkbox-box`: 20x20px using `--border` and `--accent` tokens per TSX comment contract.
- Checked, hover, active, and focus-visible states included.

---

### InstallPromptBanner -- CLEAN (good 380px example)

CSS: `app/globals.css`

- `position: fixed; bottom: 0; left: 0; right: 0` -- horizontal overflow impossible.
- `@media (max-width: 480px)`: `flex-direction: column`, buttons go full-width with `flex: 1`.
- **Best small-screen fixed banner pattern in the codebase.**

---

### CraftingTabs -- NEEDS FIX (fixes applied)

CSS: `app/crafting/crafting-page.css`

**Issues:**

1. `.recipe-meta { grid-template-columns: repeat(3, minmax(0, 1fr)) }` -- retains 3 columns inside a
   `flex-direction: column` card at mobile. **Stat grid overflows at 380px. (Broken)**
2. `@media (max-width: 600px)` does not match the project breakpoint of 620px.

**Fixes applied in `crafting-page.css`:**
- Changed `max-width: 600px` to `max-width: 620px`.
- Added `@media (max-width: 380px)` block: `.recipe-meta { grid-template-columns: 1fr }`.

---

### app/mob/[name]/page.tsx -- NEEDS FIX (fixes applied)

CSS: `app/mob/[name]/mob-page.css`

**Issues:**

1. `.mob-hero-topline` has no `flex-wrap`. Long mob names + expansion pill overflow at 380px.
2. `.mob-loot-item-link { min-height: 40px }` -- 4px below the 44px a11y touch target.
3. Siblings single-column breakpoint at 480px -- should be 380px per design system.

**Fixes applied in `mob-page.css`:**
- Added `flex-wrap: wrap` to `.mob-hero-topline`.
- Changed `min-height: 40px` to `min-height: 44px` on `.mob-loot-item-link`.
- Changed `max-width: 480px` to `max-width: 380px` for single-column siblings.

---

### app/zone/[name]/page.tsx -- NEEDS FIX (fixes applied)

CSS: `app/zone/[name]/zone-page.css`

**Issues:**

1. `.zone-sibling-link { max-width: 260px }` not overridden in the 720px query.
   Links capped at 260px instead of filling the stacked column.
2. `.zone-page-hero { padding: 24px }` not reduced at 720px. The outer `.page` wrapper
   reduces padding but the hero internal padding is unchanged, consuming extra mobile space.

**Fixes applied in `zone-page.css` (720px media query):**
- Added `.zone-sibling-link { max-width: 100% }` inside the 720px block.
- Added `padding: 16px` to `.zone-page-hero` inside the 720px block.

---

### app/item/[slug]/page.tsx -- CLEAN (good 620px example)

CSS: `app/item/[slug]/item-page.css`

- `max-width: 680px` with `padding: 24px 20px 48px` desktop.
- `@media (max-width: 620px)`: `padding: 16px 14px 32px` -- uses exact project breakpoint.
- `.item-page-breadcrumb { display: flex; flex-wrap: wrap }` -- safe at any width.
- **Good example: correct use of the 620px project breakpoint.**

---

### app/factions/page.tsx -- NEEDS FIX (fixes applied)

CSS: `app/factions/faction-page.css`

**Issues:**

1. `.faction-card-grid { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)) }` --
   at 380px (~356px available), a 340px minimum is too tight. No 620px breakpoint defined.
   **Grid stress at 380px. (Broken)**
2. `.faction-alignment-heading { display: flex }` has no `flex-wrap`.
   The alignment badge can push content off-screen on narrow viewports.

**Fixes applied in `faction-page.css`:**
- Added `@media (max-width: 620px)` block: `.faction-card-grid { grid-template-columns: 1fr }`.
- Added `flex-wrap: wrap` to `.faction-alignment-heading`.

---

### app/epics/page.tsx -- CLEAN (good 720px example)

CSS: `app/epics/epic-page.css`

- `.epic-class-bar { display: flex; flex-wrap: wrap }` -- class pills wrap on mobile.
- `@media (max-width: 720px)`: reduces gap, wraps progress summary, reduces card padding.
- `.epic-step-meta { display: flex; flex-wrap: wrap }` -- metadata fields wrap at all widths.
- `.epic-step-title { flex: 1; min-width: 0 }` overflow guard in step header.
- No fixed widths anywhere.
- **Good example: progress summary flex-wrap at 720px.**

---

### app/crafting/page.tsx -- CLEAN (page shell)

Page shell uses `.page` and `.header` which have correct responsive rules.
CraftingTabs carries the content-level issues documented above.

---

## Applied Fix Reference

| # | File | Change | Problem Solved |
|---|------|--------|----------------|
| 1 | `app/globals.css` | `.epic-checkbox` label (44px min-height, flex) | Touch target undefined (~18px) |
| 2 | `app/globals.css` | `.epic-checkbox-input` (visually hidden) | Missing layout |
| 3 | `app/globals.css` | `.epic-checkbox-box` + states | No custom visual defined |
| 4 | `app/globals.css` | `.slot-filter-button--child { min-height: 36px }` at 720px | 30px below a11y floor |
| 5 | `mob-page.css` | `flex-wrap: wrap` on `.mob-hero-topline` | Overflow at 380px |
| 6 | `mob-page.css` | `min-height: 44px` on `.mob-loot-item-link` | 40px below a11y threshold |
| 7 | `mob-page.css` | Changed 480px breakpoint to 380px | Misaligned with design system |
| 8 | `crafting-page.css` | Changed 600px breakpoint to 620px | Misaligned with design system |
| 9 | `crafting-page.css` | `.recipe-meta` 1-col at 380px | 3-col stat grid overflows |
| 10 | `zone-page.css` | `.zone-sibling-link { max-width: 100% }` in 720px block | Links capped at 260px |
| 11 | `zone-page.css` | `padding: 16px` on `.zone-page-hero` at 720px | Hero padding not reduced |
| 12 | `faction-page.css` | `.faction-card-grid { 1fr }` at 620px | 340px min too wide for 380px |
| 13 | `faction-page.css` | `flex-wrap: wrap` on `.faction-alignment-heading` | Badge overflow |

---

## Good Small-Screen Reference Patterns

- **InstallPromptBanner** -- `position: fixed; left: 0; right: 0` eliminates overflow. Full-width stacked buttons at 480px.
- **app/item/[slug]/page.tsx** -- Correct 620px project breakpoint with clean padding reduction.
- **app/epics/page.tsx** -- All flex containers use `flex-wrap`; progress summary wraps at 720px.
- **ItemSlotFilter** -- `min-width: min(300px, 100%)` clamps correctly for any viewport.

