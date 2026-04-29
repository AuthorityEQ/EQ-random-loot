# Contributing to EQ-Random-Loot

Welcome! This document explains how to contribute to the Frostreaver Loot Reference project.

---

## Code of Conduct

We're building a friendly, inclusive community. Please:

- Be respectful in all interactions
- Welcome diverse perspectives
- Assume good intent
- Report harassment to the project maintainers
- Keep discussions focused on the project

---

## How to Contribute

### Report a Bug

Found a loot error or broken feature?

1. Check existing issues: [GitHub Issues](https://github.com/yourrepo/issues)
2. Create a new issue with:
   - **Title**: Short, specific description
   - **Steps to reproduce**: Exactly what you did
   - **Expected behavior**: What should happen
   - **Actual behavior**: What happened instead
   - **Screenshots**: If UI-related
   - **Environment**: Browser, OS, device type
3. Example:

```
Title: Mage epic quest step 3 links to wrong mob

Steps:
1. Click "Epics" → select "Mage"
2. Click "Step 3" expand
3. Click "ancient golem" link

Expected: Navigate to /mob/ancient-golem (Plane of Fear)
Actual: Navigate to /mob/ancient-golem (Kunark, wrong zone)

Screenshot: [...]
```

### Request a Feature

Want a new loot lookup, missing data, or UX improvement?

1. Start a discussion in Discord #feedback or open a GitHub issue
2. Describe:
   - **What**: Feature name and description
   - **Why**: User benefit or use case
   - **How**: Proposed implementation (optional)
3. Maintainers will prioritize and tag with `feature-request`

### Submit Data Corrections

Found incorrect loot or missing zone?

**For small corrections (1-3 items):**

1. Post in Discord #data-issues with:
   - Mob name + zone
   - Incorrect item / missing item
   - Correct information + source (eqprogression link, live server screenshot)
2. Maintainers will verify and fix

**For large corrections (zone audit, expansion cleanup):**

1. Create a GitHub issue titled: "data: Audit [zone] or [expansion]"
2. Include a formatted table:

```
| Mob | Current Loot | Correct Loot | Source |
| --- | --- | --- | --- |
| a goblin warrior | Leather Helm | Missing | eqprogression.com |
| ... | ... | ... | ... |
```

3. Maintainers will merge verified corrections

### Add Code

Want to implement a feature or fix?

1. **Check the roadmap first**: [FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md)
   - Is it already planned? (May already be in-flight)
   - Is it Tier 0-2 (prioritized) or Tier 3+ (backlog)?

2. **For Tier 0-2 features**, coordinate in Discord #frostreaver-dev:
   - Say you're working on it
   - Ask if anyone else is already assigned
   - Get architecture feedback before starting

3. **For Tier 3+ features** or bugs:
   - Create a GitHub issue or PR directly
   - Follow the coding standards below

4. **Implement**:
   - Follow [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) hard constraints
   - Test locally: `npm run dev`
   - Verify build: `npm run build`
   - Check TypeScript: `npx tsc --noEmit`
   - Test both dark/light themes
   - Test on mobile (real device if possible)

5. **Commit**:
   - Follow commit message format (see below)
   - One feature per commit where possible

6. **Create a PR**:
   - Title: `feat(Area): Short description` or `fix(Area): ...`
   - Description: What changed and why
   - Screenshots: If UI changes
   - QA checklist: "Tested in dev, tested on mobile, tested dark/light modes"

7. **Merge**:
   - Self-review (you're likely the only dev)
   - Merge to main
   - Vercel auto-deploys
   - Verify on production: frostreaver-loot.vercel.app
   - Post to Discord #announcements with a short feature summary

---

## Coding Standards

### Hard Constraints (Non-Negotiable)

From [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md):

- **No styling frameworks**: No Tailwind, CSS-in-JS, ShadCN, MUI, Chakra, Bootstrap
- **No new runtime dependencies**: Only next, react, react-dom, postcss
- **Static JSON data**: Use `import data from "@/data/foo.json"`
- **App Router + TypeScript strict mode**: NextJS 16, server components by default
- **localStorage for persistence**: With `frostreaver-` key prefix
- **Custom CSS**: Extend globals.css + component .css files using existing tokens

### File Structure

```
New feature should follow this structure:

Feature Implementation (e.g., Feature T1.2 - Faction Guide):
├── /app/faction/
│   ├── page.tsx              ← Server component, RSC
│   ├── [name]/page.tsx       ← Dynamic route with generateStaticParams
│   └── [name]/not-found.tsx  ← Custom 404
├── /components/
│   ├── FactionCard.tsx       ← Reusable display component
│   ├── FactionDetailView.tsx ← Page composition component
│   └── faction.css           ← Component-scoped styles
├── /lib/
│   ├── factions.ts           ← Data access + helpers
│   └── slug.ts               ← (If using slugs for routing)
└── /data/
    └── faction-guide.json    ← (If new data source)
```

### Component Patterns

**Good: Reuse existing components**
```tsx
import BucketCard from '@/components/BucketCard';
import ItemDrawer from '@/components/ItemDrawer';

export default function NewFeature() {
  return (
    <div className="page">
      <BucketCard bucket={...} />
      <ItemDrawer item={...} />
    </div>
  );
}
```

**Bad: Create new components from scratch**
```tsx
// Don't reinvent the wheel
function MyCustomCard({ data }) {
  return <div style={{ /* inline styles */ }}>...</div>;
}
```

### CSS Patterns

**Good: Use design system tokens**
```css
.my-card {
  background: var(--surface);
  border: 1px solid var(--bucket-rose-border);
  color: var(--accent);
  font-size: var(--text-sm);
}
```

**Bad: Hardcode colors or use frameworks**
```css
/* DON'T DO THIS */
.my-card {
  @apply bg-slate-100 border-red-300; /* Tailwind */
  background: #f5f5f5; /* Hardcoded */
}
```

### Type Safety

- All functions must have parameter types
- All React components must have return type `JSX.Element` or `ReactNode`
- Use `type` not `interface` for data shapes
- Export public types from lib files

Example:
```tsx
// lib/factions.ts
export type Faction = {
  id: string;
  name: string;
  allies: string[];
  enemies: string[];
};

export function getFactionBySlug(slug: string): Faction | null {
  // ...
}

// components/FactionCard.tsx
interface Props {
  faction: Faction;
  onSelect?: (id: string) => void;
}

export default function FactionCard({ faction, onSelect }: Props): JSX.Element {
  // ...
}
```

### Performance

- Lazy-load heavy components with `React.lazy()` if >50KB
- Use `useMemo` for expensive calculations
- Memoize search results in universal-search.ts
- Keep search response time <300ms
- Test with DevTools Profiler before submitting

### Accessibility

- All interactive elements must be keyboard accessible
- Images + icons must have alt text
- Color not the only visual indicator (use patterns, text)
- Headings must be semantic (h1 > h2 > h3, no skipping levels)
- ARIA labels for complex UI
- Test with screen reader (NVDA, JAWS, or Voice Over)
- Target WCAG 2.1 AA or better

### Mobile-First

- Test on real mobile devices (not just responsive design mode)
- Primary breakpoint: 720px (mobile), 980px (tablet), 1200px (desktop)
- Touch targets minimum 44x44px
- Avoid hover-only interactions (use click + focus states)
- Test on 4G throttle: DevTools → Network → Slow 4G

---

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

Closes #<issue-number>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `refactor`: Code cleanup (no behavior change)
- `docs`: Documentation only
- `data`: Data import or correction
- `chore`: Build, dependency, config changes

Scope:
- `A`, `B`, `C`, etc. (Feature letter from IMPLEMENTATION_PLAN.md)
- `data`, `perf`, `docs`, `build`, etc.
- Or feature name: `faction`, `epic`, `pwa`, `search`

Subject:
- Imperative mood ("add" not "added" or "adds")
- No period at the end
- <50 characters preferred

Body (optional):
- Explain what and why, not how
- Bullet points for multiple changes
- Reference issues: "Fixes #123"

Examples:
```
feat(A): Add server selector to nav

- New ServerProvider context for multi-server support
- ServerToggle component with three radio buttons
- URL param override: ?server=teek
- Reuse existing theme toggle styling

Closes #45

---

fix(D): Correct item drop location for Cloak of Flames

Verified on live server spawn + eqprogression.com.
Was showing Plane of Fear; moved to Tower of Frozen Shadow.

Fixes #89

---

data: Import Excel faction guide and epic quests

- scripts/import-excel-master.ts with per-sheet emitters
- data/excel-import-faction-guide.json
- data/excel-import-epic-quests.json
- Validation against item-details.json keys

---

docs: Update API.md with new route signatures

Added ItemDetailBody and MobView type definitions.
```

---

## Testing Checklist

Before submitting a PR:

- [ ] Runs locally: `npm run dev` → http://localhost:3000
- [ ] Builds: `npm run build` (zero TypeScript errors)
- [ ] Lints: `npx next lint` (if eslint configured)
- [ ] Mobile: Tested on real device or DevTools responsive mode
- [ ] Dark mode: Tested light + dark themes (DevTools → Appearance)
- [ ] Cross-browser: Chrome, Firefox, Safari (if available)
- [ ] Accessibility: Tab navigation works, screen reader compatible
- [ ] Performance: Search <300ms, page load <3s (Lighthouse ≥90)
- [ ] No console errors: DevTools → Console (warnings OK)
- [ ] Updated docs: Added references to README.md, IMPLEMENTATION_PLAN.md, etc.

---

## Documentation Standards

When you add a feature:

1. **Update docs/README.md**: Add the feature to the index table
2. **Update docs/IMPLEMENTATION_PLAN.md**: Mark feature as Complete (or move to post-launch backlog)
3. **Update docs/CHANGELOG.md**: Add to "Unreleased" section
4. **Code comments**: For complex logic, explain the "why" not the "what"
5. **Cross-links**: Link from related pages (e.g., "See also: [Mob Pages](IMPLEMENTATION_PLAN.md#b-mob-detail-pages)")
6. **Keep docs accurate**: Outdated docs are worse than no docs

---

## Directory Structure Rules

- Don't create new top-level directories without discussion
- Keep /lib files focused (one topic per file)
- /data files are version-controlled JSON (no .gitignore)
- /scripts are build-time only (use node --experimental-strip-types)
- /public is for static assets (CSS, images, manifest)
- Component dependencies: components → lib → data (no cycles)

---

## Reporting Issues

### Security Issues

Do NOT open a public issue. Email eq2platsales@gmail.com with:
- Description of the vulnerability
- Impact assessment
- Reproduction steps (if safe)

We'll work with you privately before public disclosure.

### Bug Reports

Use the Bug template (see "Report a Bug" above).

### Performance Regressions

If you notice slow search or page load:

1. Profile with DevTools → Performance tab
2. Note which component/function is slow
3. Create issue: "perf: [Component] taking X ms"
4. Include a profile screenshot or .json file

---

## Getting Help

- **Discord #frostreaver-dev**: Ask questions, coordinate work
- **GitHub Discussions**: Feature brainstorming
- **Existing docs**: Check [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- **Code comments**: Look for similar patterns in existing features

---

## Team Credits

**Frostreaver v0.2.0 (April 2026)**

**Original Creator & Authority**
- Authority Games — Project vision, repository owner

**Data & Excel Leadership**
- Gronnz — Data validation, Excel import, EQ knowledge

**Build Session AI Agents (April 29, 2026)**
- 20 Planning Agents → 20 Build Agents → 20 Consolidation Agents
- Total effort: ~60 agent-days across 10 features (A-J)

**Data Sources & Community**
- Daybreak Games (EverQuest)
- Allakhazam (loot database)
- EQProgression.com (quest + loot info)
- EverQuestMacros community (item research)

**Special Thanks**
- Players who reported loot corrections in #data-issues
- Streamers who featured the site early (June 2026)
- Community members who tested pre-launch builds

---

## Questions?

- Check [FAQ.md](README.md#faq) first
- Join Discord #frostreaver-dev
- Create a GitHub Discussion
- Email eq2platsales@gmail.com

---

**Last Updated**: April 29, 2026  
**Maintained By**: Project Maintainers
