# Frostreaver Pre-Launch Week Execution Checklist
## Tier 0 (Ship-Blocking) Daily Breakdown

**Week**: April 29 - May 26, 2026 (4 weeks until launch)  
**Launch**: May 27, 2026 12:00 PM PT (CONFIRMED)
**Cadence**: Daily standup, 1-2 features shipped per day  
**Deployment**: After each feature completes (continuous deploy to Vercel)  
**Comms**: Discord #frostreaver-dev updates

---

## Week 1: April 29 - May 5 (Tier 0 Primary Build Sprint)

### Monday, April 29 (Today - Tier 0 Kickoff)

### Goal: Start Tier 0 features, verify Classic data, establish launch readiness timeline

#### T0.1: Server & Launch Status Indicator (1 day)
**Start**: 8 AM | **Deploy**: 4 PM | **Status**: CRITICAL PATH

**Checklist**:
- [ ] Add launch timestamp constant to `app/layout.tsx`
  ```typescript
  const FROSTREAVER_LAUNCH_DATE = new Date('2026-05-27T12:00:00-07:00'); // PT timezone
  ```
- [ ] Update metadata description: "Frostreaver TLP (free-trade randomized loot) launching May 27, 2026"
- [ ] Create `components/LaunchStatusBadge.tsx`
  - [ ] Show "LIVE" badge with green accent
  - [ ] Display "Launched X days/hours ago"
  - [ ] Sticky position in nav (below h1)
  - [ ] Responsive: stack on mobile
- [ ] Test dark/light mode rendering
- [ ] Add unit test for date logic
- [ ] Deploy to prod via Vercel
- [ ] Verify live on frostreaver-loot.vercel.app

**Success**: Server status visible on every page, no console errors

---

#### T0.2: Verify Classic Group Named Data (3-5 days, start TODAY)
**Start**: 9 AM (in parallel) | **Target completion**: Wed EOD | **Status**: BLOCKING

**Today's tasks**:
- [ ] Create `/docs/CLASSIC_DATA_AUDIT.md` checklist  
- [ ] Audit 3 high-traffic zones THIS WEEK:
  - [ ] Field of Bone (start with this — highest traffic)
    - [ ] Count total mobs: expected ~40-50 spawns
    - [ ] Check bucket distribution: verify top 3 buckets have loot
    - [ ] Spot check 5 items vs. Allakhazam
  - [ ] Qvic
    - [ ] Verify iksar mobs present
    - [ ] Check loot distribution
  - [ ] Plane of Sky
    - [ ] Sky classic spawns (not PoP version)
    - [ ] Check access/key items in loot
- [ ] Document findings in CLASSIC_DATA_AUDIT.md
- [ ] If major issues found (>10% discrepancy): flag for Tue-Wed deep dive
- [ ] If clean: mark as "VERIFIED: Field of Bone, Qvic, PoSky"

**Resources**:
- Allakhazam zone pages (already cached in `/cache/zam-pages/`)
- eqprogression.com zone guides
- Live server database (if accessible) or community Discord reports

**Success**: 3 zones verified, audit doc started, confidence level recorded

---

## Tuesday, April 30

### Goal: Complete Classic audit + begin perf testing

#### T0.2 (Continued): Classic Audit — 7 More Zones
**Start**: 8 AM | **Target**: 4 PM | **Status**: BLOCKING

**Audit checklist** (rotate through zones):
- [ ] Mistmoore Catacombs (classic dungeons, popular group zone)
- [ ] Upper Guk (classic, undead guards)
- [ ] Lower Guk (classic, frogloks)
- [ ] Unrest (classic, haunted castle)
- [ ] Temple of Solusek Ro (classic, fire theme)
- [ ] Nagafen's Lair (classic, raid adjacent)
- [ ] Sky (second pass, verify respawn times if noted)

**Per-zone audit**:
1. Cross-reference Allakhazam mob list vs. classic-group-named.json
2. Spot check 3-5 items per zone against item-details.json
3. Count mobs: compare expected vs. JSON
4. Note any discrepancies (missing mobs, wrong levels, missing loot)
5. Mark zone as "VERIFIED", "MINOR_GAPS", or "NEEDS_REVIEW"

**Update JSON**:
- [ ] Add metadata to classic-group-named.json:
  ```json
  {
    "expansion": "Classic",
    "last_verified": "2026-04-30",
    "verification_status": "classic_launch_audit",
    "zones_verified": 10,
    "zones_total": 25,
    "buckets": [...]
  }
  ```

**Success**: 10/25 zones audited, status updated in JSON

---

#### T0.4: Search Performance Baseline (Start early, parallel)
**Start**: 9 AM | **Target**: 6 PM | **Status**: BLOCKING

**Performance audit checklist**:
- [ ] Install lighthouse-ci (`npm install -D lighthouse-ci`)
- [ ] Create `/docs/PERFORMANCE.md` template:
  ```markdown
  # Performance Baseline (2026-04-30)
  
  ## Metrics
  - Search response time (typeahead): ___ ms
  - Page load time (homepage): ___ ms
  - Lighthouse score: ___ / 100
  - Mobile performance: ___ / 100
  
  ## Test Environment
  - Device: MacBook (throttle to 4G sim)
  - Expansions: Classic, Kunark, Velious loaded
  - Data size: [calc MB]
  ```
- [ ] Measure search latency:
  - Open Chrome DevTools → Console
  - Run: `performance.mark('search-start'); /* type in search */'performance.mark('search-end');`
  - Repeat 10 queries, average response time
  - Target: <300ms
- [ ] Profile React rendering:
  - React DevTools → Profiler
  - Search + filter interactions
  - Check for unnecessary re-renders (useMemo working?)
- [ ] Load test simulation:
  - Open 5 tabs, rapid searches in parallel
  - Observe CPU/memory usage
  - Check for jank/lag
- [ ] Document baseline in /docs/PERFORMANCE.md
- [ ] If >300ms: investigate useMemo dependencies (check search.ts, universal-search.ts)

**Optimization checklist** (if needed):
- [ ] Verify typeahead debounce is 180ms (in page.tsx)
  ```typescript
  const timeout = window.setTimeout(() => {
    setDebouncedQuery(query);
  }, 180); // Check this value
  ```
- [ ] If still slow: increase to 250ms
- [ ] Check if Kunark/Velious data can be lazy-loaded on tab click

**Success**: Baseline performance documented, <300ms search response

---

## Wednesday, May 1

### Goal: Complete Classic audit + mobile responsiveness

#### T0.2 (Continued): Final Classic Audit Pass
**Start**: 8 AM | **Target**: 12 PM | **Status**: BLOCKING

**Audit remaining zones** (quick pass, 8 zones):
- [ ] Kaladim
- [ ] Paineel
- [ ] Felwithe
- [ ] High Keep
- [ ] Oasis of Marr
- [ ] Gorge of King Xorbb
- [ ] Befallen
- [ ] Crypt of Decay

**Final validation**:
- [ ] Spot-check 5 random items across all 18 audited zones → 100% match with Allakhazam?
- [ ] All zones have >0 mobs + loot?
- [ ] Update JSON: `zones_verified: 18, zones_total: 25`
- [ ] PUBLISH audit results to Discord: "Classic audit 72% complete, X zones verified"

**Decision point**:
- [ ] If **CLEAN**: mark Classic as "LAUNCH READY"
- [ ] If **MINOR GAPS** (≤5%): deploy with note "Unverified zones: [list 7], help us improve!"
- [ ] If **MAJOR ISSUES** (>5%): **ESCALATE** — delay launch or limit to 18 verified zones only

**Success**: 18/25 zones audited OR decision made to launch with partial data

---

#### T0.3: Mobile Responsiveness Audit (2-4 days, START TODAY)
**Start**: 12 PM | **Target completion**: Thu EOD | **Status**: BLOCKING

**Test devices**:
- [ ] iPhone 13 (375px width, Safari)
- [ ] Android phone (360px, Chrome)
- [ ] iPad mini (768px, Safari)
- [ ] Test browser: Browserstack or local phone + USB

**Audit checklist**:
- [ ] Homepage (/) loads correctly
  - [ ] No horizontal scroll
  - [ ] Toolbar wraps gracefully: search box stacks above filters
  - [ ] Bucket cards: 1 column on mobile, 2 on tablet, 3 on desktop
  - [ ] Text readable (16px+ font)
- [ ] Zone view page loads correctly
  - [ ] Mobs list stacks vertically
  - [ ] Loot list stacks vertically
  - [ ] Item drawer opens full-screen (no side panel on mobile)
- [ ] Favorites page loads correctly
  - [ ] Favorites grid: 1 column on mobile
- [ ] Raids page loads correctly
  - [ ] Boss grid: 1 column on mobile
  - [ ] Accordion expand/collapse works
- [ ] Navigation
  - [ ] Nav bar stacks on phone (check breakpoint @720px)
  - [ ] Links touch-friendly (44px+ tap target)
  - [ ] Theme toggle accessible
- [ ] Forms
  - [ ] Search input: full width, 44px min height
  - [ ] Zone select: full width, 44px min height
  - [ ] Level input: 44px min height
  - [ ] Filter buttons: 36px min height, 12px padding minimum
- [ ] Dark mode on mobile
  - [ ] Colors contrast ≥4.5:1 (WCAG AA)
  - [ ] No brightness issues

**CSS fixes** (if needed, edit globals.css):
- [ ] Verify @media (max-width: 720px) covers all breakpoints
- [ ] Check grid-template-columns: repeat(3, ...) → repeat(1, ...) on mobile
- [ ] Ensure max-width: 1180px on .page doesn't cause overflow

**Testing tools**:
- [ ] Lighthouse (Chrome DevTools) → Accessibility score ≥90
- [ ] axe DevTools extension → No violations
- [ ] Manual touch testing (iOS + Android)

**Document results**:
- [ ] Create `MOBILE_AUDIT.md`: issues found + fixes applied
- [ ] Screenshot breakpoints (375px, 768px, 1024px)

**Success**: All pages load without horizontal scroll, <44px touch targets, ≥90 Lighthouse score

---

## Thursday, May 2

### Goal: Complete perf testing + mobile audit finish

#### T0.3 (Continued): Mobile Audit Finish
**Start**: 8 AM | **Target**: 12 PM

**Final mobile checks**:
- [ ] Test all 4 pages (/, /raids, /favorites, /quests if T1.3 started)
- [ ] Test full search flow (type, results appear, click result)
- [ ] Test filter interactions (click expansion, zone, level changes)
- [ ] Dark mode toggle works on mobile
- [ ] No console errors on mobile browsers
- [ ] Deploy changes to Vercel
- [ ] Test live on real mobile device

**Success**: Mobile audit complete, all breakpoints working, zero console errors

---

#### T0.4: Search Performance Finalization
**Start**: 12 PM | **Target**: 4 PM

**Performance validation**:
- [ ] Run baseline tests again (search response time, page load)
- [ ] Compare to baseline from Tue
- [ ] If still >300ms: apply optimization (debounce, lazy-load)
- [ ] Document final metrics in /docs/PERFORMANCE.md
- [ ] Publish summary to Discord: "Search optimized to XXms average"

**Regression testing**:
- [ ] Search + filter: 5 queries
- [ ] Rapid zone switches: 3 transitions
- [ ] Expand/collapse items: 5 toggles
- [ ] Check for UI jank or lag

**Success**: <300ms search response confirmed, zero regressions

---

#### T0.5: Server Selector Setup (START, optional but recommended)
**Start**: 2 PM | **Target completion**: Fri EOD | **Status**: OPTIONAL

**Prep work**:
- [ ] Create `/lib/serverModes.ts`:
  ```typescript
  export type ServerMode = 'frostreaver' | 'mischief' | 'teek';
  
  export const serverModes = [
    { value: 'frostreaver' as const, label: 'Frostreaver (Random)', enabled: true },
    { value: 'mischief' as const, label: 'Mischief (Normal)', enabled: false },
    { value: 'teek' as const, label: 'Teek (Normal)', enabled: false },
  ];
  ```
- [ ] Update app/page.tsx to accept server mode (useState)
- [ ] Add server selector buttons to toolbar (after expansion toggle)
- [ ] Save selection to localStorage: `frostreaver-server-mode`
- [ ] Load on mount: check localStorage, otherwise default to 'frostreaver'

**Stub messaging** (for disabled modes):
- Mischief/Teek modes show: "Loot data coming soon for this server"

**Success**: Server selector visible, Frostreaver is default, selection persists

---

## Friday, May 3

### Goal: Final QA, deployment readiness

#### T0.5 (Continued): Server Selector Testing
**Start**: 8 AM | **Target**: 11 AM

**Testing checklist**:
- [ ] Click "Frostreaver" → page shows all data
- [ ] Click "Mischief" → shows stub message
- [ ] Reload page → selection persists (localStorage working)
- [ ] Dark/light mode + server selector work together
- [ ] Mobile: selector wraps nicely on narrow viewport

**Success**: Server selector complete, persists, mobile-friendly

---

#### Final Launch Readiness Checklist
**Start**: 11 AM | **Target**: 2 PM

**Pre-deployment QA**:
- [ ] **Tier 0 features verified**:
  - [ ] T0.1: Launch status badge visible ✓
  - [ ] T0.2: Classic data audit complete (18/25 zones) ✓
  - [ ] T0.3: Mobile responsiveness verified ✓
  - [ ] T0.4: Search performance <300ms ✓
  - [ ] T0.5: Server selector functional ✓
  
- [ ] **No console errors** across all pages
  - [ ] Run through each page, open DevTools, check Console tab
  
- [ ] **No broken links**
  - [ ] Test nav links (/, /raids, /favorites)
  - [ ] Test zone/item internal links
  
- [ ] **Metadata correct**:
  - [ ] og:title, og:description, og:image set
  - [ ] Favicon loads
  - [ ] Title tag shows "Frostreaver Loot Buckets"
  
- [ ] **Dark mode works**:
  - [ ] Toggle theme, reload page → theme persists
  - [ ] Colors contrast properly (WCAG)
  
- [ ] **Performance acceptable**:
  - [ ] Lighthouse Mobile score ≥80
  - [ ] Page load <3 seconds on 4G
  
- [ ] **Data integrity**:
  - [ ] No NaN or undefined values in JSON
  - [ ] Item counts match bucket loot pools
  - [ ] Zones link to valid buckets

**Deployment**:
- [ ] All features merged to `main` branch
- [ ] Vercel auto-deploy triggered
- [ ] Deployment completes (check dashboard, ~2 min)
- [ ] Test live site: https://frostreaver-loot.vercel.app/
- [ ] Sanity checks on production:
  - [ ] Load homepage
  - [ ] Search for item (e.g., "boots")
  - [ ] Click zone, verify zone view
  - [ ] Click favorite, verify list

**Communication**:
- [ ] Post to Discord: "Frostreaver Random Loot site LIVE! https://frostreaver-loot.vercel.app"
- [ ] Include message: "Finding issues? DM AuthorityGames or report in #feedback"
- [ ] Link to roadmap doc: "Next features coming Week 1..."

**Success**: Site deployed, live, zero critical bugs, players can access

---

## Weekend Support (May 4-5)

**Standby mode** (check Discord 2x per day):
- [ ] Monitor for critical bug reports
- [ ] If crash found: apply hotfix, redeploy immediately
- [ ] If data issue found: escalate to data audit team for Week 1
- [ ] Respond to feedback: "Thanks for reporting, we'll fix in Week 1"

**Preparation for Week 1**:
- [ ] Review feedback from Discord
- [ ] Prioritize T1 features based on player requests
- [ ] Prepare T1.1 (Zone Population) work plan

---

## Definition of Done (Per Feature)

Each feature must satisfy:

- [ ] **Functionality**: Feature works as specified (happy path + error cases)
- [ ] **Code**: No console errors, no TypeScript warnings
- [ ] **CSS**: Works in light + dark mode, responsive, no layout shift
- [ ] **Performance**: <300ms response time (if applicable)
- [ ] **Testing**: Manual testing on Chrome, Safari, mobile device
- [ ] **Documentation**: Code comments for complex logic, /docs/ updated
- [ ] **Deployment**: Merged to main, auto-deployed to Vercel, tested live
- [ ] **Communication**: Update Discord #frostreaver-dev channel

---

## Escalation Matrix

| Severity | Response Time | Action |
|----------|---------------|--------|
| 🔴 **CRITICAL** (site down, crash) | 0-15 min | Hotfix + redeploy immediately |
| 🟠 **HIGH** (broken feature, bad data) | 15-60 min | Triage, decide: fix now or defer to Week 1 |
| 🟡 **MEDIUM** (UI issue, minor data gap) | 1-4 hours | Schedule for Week 1 sprint |
| 🟢 **LOW** (typo, nice-to-have) | 1+ day | Add to Week 1 backlog |

---

## Notes for Dev

**Time estimates**: T0.1-T0.5 total ~14-16 hours of focused work over 5 days (2.8-3.2 hrs/day). Leave buffer for unknowns.

**Single-developer pace**: No code reviews, self-QA, quick deploy cycles. Keep PRs small (1 feature per PR).

**Data audit**: Most time-intensive. Prepare a checklist of 25 zones, work through methodically. Spot-check 3-5 items per zone to build confidence.

**Breakpoint testing**: Save real device testing for last (Thu-Fri). Browserstack is faster but real device verification is mandatory for mobile.

**CSS changes**: Minimal. Mostly verification that existing breakpoints work. Don't redesign anything.

---

**Last Updated**: 2026-04-29  
**Version**: 1.0 (Updated for May 27 Launch)
**Owner**: Single Dev (AuthorityGames)
**Launch Date**: May 27, 2026 12:00 PM PT
