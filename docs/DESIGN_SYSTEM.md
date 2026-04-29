# Frostreaver Design System
## Reference for Components, Tokens, and Visual Language

**Status**: Design System Documentation  
**Version**: 1.0  
**Date**: 2026-04-29  
**Scope**: Custom CSS token system, component patterns, accessibility standards  
**Source**: `app/globals.css` (1,470 lines, load-bearing)

---

## Overview

The Frostreaver site uses a carefully engineered custom CSS system with no frameworks (Tailwind, ShadCN, Bootstrap, etc.). This document ensures consistency across existing components and guides safe extensions for new features.

### Core Principles
1. **Single source of truth**: All tokens live in `app/globals.css`
2. **No runtime framework dependencies**: Pure CSS + React, no styling libraries
3. **Dark/light mode support**: All tokens defined for both themes
4. **Accessibility first**: WCAG AA contrast ratios, keyboard navigation
5. **Mobile-first**: Responsive breakpoints at 980px, 720px, 620px, 380px

---

## 1. Token System

### Color Tokens (Light Theme)

**Semantic tokens** (light background):
```css
:root {
  --bg: #ffffff;              /* Page background */
  --surface: #f8f8f8;         /* Cards, surfaces */
  --surface-hover: #f0f0f0;   /* Hover state on surfaces */
  --text-primary: #1a1a1a;    /* Main text */
  --text-secondary: #666666;  /* Secondary text, labels */
  --accent: #2d6a4f;          /* Primary accent (Frostreaver green) */
  --accent-soft: #d4e8df;     /* Soft accent (transparent) */
  --accent-contrast: #ffffff; /* Text on accent bg */
  
  --border: #d0d0d0;          /* Standard border */
  --border-light: #e8e8e8;    /* Light border */
  --shadow: rgba(0, 0, 0, 0.08);
  --shadow-hover: rgba(0, 0, 0, 0.12);
  
  --focus-ring: #2d6a4f;      /* Keyboard focus outline */
}
```

**Dark theme overrides**:
```css
:root[data-theme="dark"] {
  --bg: #1a1a1a;
  --surface: #2d2d2d;
  --surface-hover: #3d3d3d;
  --text-primary: #e8e8e8;
  --text-secondary: #999999;
  --accent: #7fc59b;          /* Lighter green for contrast */
  --accent-soft: #2d5e42;     /* Darker soft accent */
  --accent-contrast: #1a1a1a;
  --border: #404040;
  --border-light: #3a3a3a;
  --shadow: rgba(0, 0, 0, 0.3);
  --shadow-hover: rgba(0, 0, 0, 0.5);
}
```

### Expansion Tone Tokens

Each expansion gets its own color palette:

**Light theme**:
```css
:root {
  /* Classic (blue) */
  --exp-classic-bg: #e6f0ff;
  --exp-classic-border: #4a90e2;
  --exp-classic-accent: #1a5fc0;
  
  /* Kunark (orange) */
  --exp-kunark-bg: #ffe6cc;
  --exp-kunark-border: #ff9500;
  --exp-kunark-accent: #cc6200;
  
  /* Velious (purple) */
  --exp-velious-bg: #f0e6ff;
  --exp-velious-border: #8b5cf6;
  --exp-velious-accent: #6d28d9;
}
```

**Dark theme equivalents** maintain contrast ratios ≥4.5:1.

### Bucket Color Tokens

Six bucket color variants (1-6 cycling):

```css
:root {
  /* Bucket 1 */
  --bucket-1-row: #e3f2fd;
  --bucket-1-border: #1976d2;
  
  /* Bucket 2 */
  --bucket-2-row: #f3e5f5;
  --bucket-2-border: #7b1fa2;
  
  /* Bucket 3 */
  --bucket-3-row: #ffe0b2;
  --bucket-3-border: #f57c00;
  
  /* Bucket 4 (green) */
  --bucket-4-row: #e8f5e9;
  --bucket-4-border: #388e3c;
  
  /* Bucket 5 (teal) */
  --bucket-5-row: #e0f2f1;
  --bucket-5-border: #00897b;
  
  /* Bucket 6 (rose) */
  --bucket-6-row: #fce4ec;
  --bucket-6-border: #c2185b;
}
```

Mapping rule: `bucket.bucket % 6` determines which color pair is applied.

---

## 2. Component Patterns

### BucketCard.tsx

**Purpose**: Display a loot bucket with summary info (mobs, buckets, levels).

**Key classes**:
- `.bucket-card` — root container
- `.bucket-card-header` — expansion pill + bucket number
- `.bucket-card-body` — loot pool summary
- `.bucket-card-footer` — mob count + level range
- `.loot-button` — clickable loot item link

**Styling**:
```css
.bucket-card {
  border-left: 4px solid var(--bucket-N-border);
  background-color: var(--bucket-N-row);
  padding: 16px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.bucket-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}

.loot-button {
  color: var(--accent);
  cursor: pointer;
  border: none;
  background: transparent;
  font-weight: 500;
}

.loot-button:hover {
  text-decoration: underline;
}
```

**Expansion color integration**:
```css
.bucket-card.expansion-tone-classic {
  border-left-color: var(--exp-classic-border);
  background-color: var(--exp-classic-bg);
}
```

### ItemDrawer.tsx

**Purpose**: Modal panel showing full item details (stats, sources, links).

**Key classes**:
- `.item-drawer` — modal wrapper
- `.item-detail-backdrop` — semi-transparent overlay
- `.item-detail-body` — scrollable content area
- `.sources` — list of drop locations
- `.item-icon` — icon container

**CSS Constraints** (MUST preserve):
```css
.item-drawer {
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1000;
  max-width: 480px;
  height: 100vh;
  overflow-y: auto;
  background: var(--surface);
  box-shadow: -2px 0 8px var(--shadow);
}

@media (max-width: 720px) {
  .item-drawer {
    max-width: 100%;
    width: 100%;
  }
}
```

### ZoneView.tsx

**Purpose**: Display all mobs and loot in a zone, organized by bucket.

**Key classes**:
- `.zone-view` — root container
- `.zone-summary-line` — level range + mob count
- `.zone-mob-list` — list of mobs with loot
- `.zone-link` — clickable zone name (navigates to zone page)
- `.expansion-pill` — badge showing expansion (Classic/Kunark/Velious)

**Pattern**: Reused by multiple routes (home page `/`, zone detail pages `/zone/[name]`, mob detail pages `/mob/[name]`).

### SearchBox.tsx

**Purpose**: Universal search input with typeahead results.

**Key classes**:
- `.search-box` — input container
- `.search-input` — text input
- `.search-results` — dropdown results panel
- `.search-result-item` — one result entry

**Debounce behavior**:
```typescript
const timeoutId = setTimeout(() => {
  setDebouncedQuery(query);
}, 180); // milliseconds
```

**Performance**: Search response must be <300ms for smooth typeahead.

---

## 3. Bucket Color Mapping Rules

### Rule: `bucket.bucket % 6 = color_index`

```typescript
function bucketColorClass(bucketNum: number): string {
  const colorIndex = ((bucketNum - 1) % 6) + 1; // 1-6
  return `bucket-${colorIndex}`;
}
```

**Example**:
- Bucket 1 → color 1 (blue)
- Bucket 2 → color 2 (purple)
- Bucket 7 → color 1 (blue, wraps)
- Bucket 8 → color 2 (purple, wraps)

**CSS application**:
```css
.bucket-1 {
  border-left-color: var(--bucket-1-border);
  background-color: var(--bucket-1-row);
}
```

---

## 4. Expansion Tone Rules

### Rule: `.expansion-tone-<expansion>` aliasing

**Class naming**:
```css
.expansion-tone-classic { /* ... */ }
.expansion-tone-kunark { /* ... */ }
.expansion-tone-velious { /* ... */ }
```

**Applied to**:
- Card headers showing expansion
- Pills in filters
- Zone/item metadata sections
- Breadcrumb trails

**Safe to extend**: Can add `.expansion-tone-luclin`, `.expansion-tone-pop` when those expansions unlock, no component changes needed.

---

## 5. Hard Constraints (DO NOT CHANGE)

### Inline Theme Script
```html
<!-- In app/layout.tsx, head section -->
<script dangerouslySetInnerHTML={{__html: `
  (function() {
    const theme = localStorage.getItem('frostreaver-theme') || 'light';
    document.documentElement.dataset.theme = theme;
  })();
`}} />
```

**Why**: Prevents flash of unstyled content (FOUC) on page load. Must run before CSS is applied.

**Constraint**: Never move this script or defer its execution.

### EQ Inspect Palette
The site integrates with the EQ Inspect browser extension. The extension expects specific CSS classes and color patterns:
```css
.eq-item-inspectable {
  /* Allows EQ Inspect to hook into item links */
  cursor: pointer;
  position: relative;
}
```

**Constraint**: Don't rename or remove this class.

### Bucket Grid Layout
```css
.bucket-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-width: 1180px;
}

@media (max-width: 980px) {
  .bucket-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 720px) {
  .bucket-grid {
    grid-template-columns: 1fr;
  }
}
```

**Constraint**: These breakpoints are tied to component usability. Don't change column counts or gaps without UX review.

---

## 6. Safe Extensions

### Adding New Bucket Colors
If randomization adds a 7th bucket, extend the system:

```css
:root {
  /* New bucket 7 (gray) */
  --bucket-7-row: #f5f5f5;
  --bucket-7-border: #757575;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bucket-7-row: #424242;
    --bucket-7-border: #bdbdbd;
  }
}

.bucket-7 {
  border-left-color: var(--bucket-7-border);
  background-color: var(--bucket-7-row);
}
```

Then update the mapping function:
```typescript
function bucketColorClass(bucketNum: number): string {
  const colorIndex = ((bucketNum - 1) % 7) + 1; // Now 1-7
  return `bucket-${colorIndex}`;
}
```

### Adding New Expansions
When Luclin/PoP unlock:

```css
:root {
  --exp-luclin-bg: #fff3e0;
  --exp-luclin-border: #e65100;
  --exp-luclin-accent: #bf360c;
  
  --exp-pop-bg: #fcf3ff;
  --exp-pop-border: #6a1b9a;
  --exp-pop-accent: #38006b;
}

.expansion-tone-luclin { /* ... */ }
.expansion-tone-pop { /* ... */ }
```

Add to expansion toggles in `SearchBox`, `page.tsx` filter logic. No component rewrites needed.

### Adding New Components
New components should:
1. Use existing tokens (`--bg`, `--text-primary`, `--accent`, etc.)
2. Implement WCAG AA contrast (≥4.5:1 for text)
3. Support light/light dark mode via `:root[data-theme="dark"]` selectors
4. Reuse `.expansion-pill`, `.zone-link`, `.loot-button` patterns where applicable
5. Add CSS to a per-component file (e.g., `components/my-component.css`)
6. Document the component in this file's **Component Patterns** section

Example new component file:
```css
/* components/my-new-component.css */

.my-new-component {
  background-color: var(--surface);
  border: 1px solid var(--border);
  padding: 16px;
  border-radius: 4px;
}

.my-new-component:hover {
  background-color: var(--surface-hover);
  box-shadow: var(--shadow-hover);
}

.my-new-component.expansion-tone-classic {
  border-color: var(--exp-classic-border);
}
```

---

## 7. Accessibility Patterns

### Keyboard Navigation
All interactive elements must be keyboard-accessible:

```css
.loot-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.zone-link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

**Testing**: Navigate with Tab/Shift+Tab. All buttons, links, and form inputs should have visible focus indicators.

### ARIA Attributes
Modal components (ItemDrawer):
```jsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="item-title"
  aria-hidden={!isOpen}
>
  <h2 id="item-title">{itemName}</h2>
  {/* content */}
</div>
```

Dropdown/combobox (SearchBox):
```jsx
<input
  role="combobox"
  aria-owns="search-results"
  aria-expanded={isOpen}
  aria-autocomplete="list"
/>
<ul id="search-results" role="listbox">
  {/* options */}
</ul>
```

### Contrast Requirements
All text must meet WCAG AA (4.5:1 for normal text, 3:1 for large text):

**Light theme**:
- `--text-primary` (#1a1a1a) on `--bg` (#ffffff): 18:1 ✓
- `--text-secondary` (#666666) on `--surface` (#f8f8f8): 7:1 ✓

**Dark theme**:
- `--text-primary` (#e8e8e8) on `--bg` (#1a1a1a): 15:1 ✓
- `--text-secondary` (#999999) on `--surface` (#2d2d2d): 5:1 ✓

Run contrast checks when modifying any color token.

---

## 8. Mobile Breakpoints

### Standard breakpoints
```css
/* Desktop (default) */
/* No media query; largest layout */

@media (max-width: 980px) {
  /* Tablet & smaller desktops */
  /* 2-column grid, adjusted spacing */
}

@media (max-width: 720px) {
  /* Mobile (large phone, small tablet) */
  /* 1-column grid, stacked layout */
}

@media (max-width: 620px) {
  /* Mobile (medium phone) */
  /* Extra-tight spacing, full-width elements */
}

@media (max-width: 380px) {
  /* Mobile (small phone, SE-sized) */
  /* Minimal spacing, extra-large touch targets */
}
```

### Touch Target Sizing
All clickable elements must be ≥44px × 44px (mobile):

```css
.loot-button {
  min-height: 44px;
  padding: 12px 16px;
  min-width: 44px;
}

.zone-link {
  padding: 8px;
  min-height: 44px;
}
```

---

## 9. Pre-Launch Validation Checklist

- [ ] All color tokens defined for light + dark theme
- [ ] Contrast ratios verified (WCAG AA, ≥4.5:1)
- [ ] Breakpoints tested on real devices (not just responsive mode)
- [ ] Touch targets ≥44px on mobile
- [ ] Focus indicators visible on all interactive elements
- [ ] Dark mode toggle works without flash
- [ ] No Tailwind or CSS-in-JS dependencies
- [ ] All new components documented in this file
- [ ] globals.css passes linting (no unused rules)
- [ ] Lighthouse Accessibility score ≥90

---

**Last Updated**: 2026-04-29  
**Next Review**: After launch (July 2026) to assess color performance  
**Owner**: Design & Frontend Team
