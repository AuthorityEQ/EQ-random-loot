# Frostreaver Launch: Quick Start Guide
## For the Single Developer (You!)

**TL;DR**: 4-tier roadmap, 8 days to launch, ~50 hours work. Start with Tier 0 ASAP.

---

## This Week (April 29 - May 5, 2026)

~4 weeks until launch (May 27). You have 5 blocking tasks. Pick one and start:

1. **T0.1: Server Status Badge** (1 day) — ADD "LIVE" indicator to site
   - Add `FROSTREAVER_LAUNCH_DATE` constant to `app/layout.tsx`
   - Create `components/LaunchStatusBadge.tsx`
   - Test dark/light mode
   - Deploy to prod

2. **T0.2: Classic Data Audit** (3-5 days, start in parallel) — VERIFY loot is accurate
   - Audit 3-5 Classic zones vs. Allakhazam (Field of Bone, Qvic, PoSky)
   - Create `/docs/CLASSIC_DATA_AUDIT.md` checklist
   - Spot-check 5 items per zone: 100% match required

3. **T0.3: Mobile Test** (2-4 days) — ENSURE site works on phones
   - Test on iPhone + Android (or use BrowserStack)
   - Check all pages load without horizontal scroll
   - Touch targets ≥44px, Lighthouse ≥90

4. **T0.4: Search Performance** (2-3 days) — MEASURE speed
   - Baseline search response time (target: <300ms)
   - Profile with Chrome DevTools
   - Document in `/docs/PERFORMANCE.md`

5. **T0.5: Server Selector** (1-2 days, optional) — ADD dropdown for future TLPs
   - Create server mode toggle (Frostreaver / Mischief / Teek stubs)
   - Save to localStorage
   - Test persistence across reloads

**Choose order based on confidence**:
- Easy first? → T0.1, T0.5
- Data critical? → T0.2 (do first!)
- Worried about mobile? → T0.3
- Performance-focused? → T0.4

---

## Weeks 1-2 (April 29 - May 12)

**Ship-blocking features only. No feature creep.**

Week 1 (Apr 29-May 5):
- Mon-Tue: T0.1, start T0.2 + T0.4 (parallel)
- Wed: Continue audit, finish mobile test
- Thu: Performance baseline, server selector
- Fri: Final QA, polish, prepare for launch

Week 2 (May 6-12):
- Mon-Fri: Buffer/final verification week
- Weekend: Full deployment test to staging

**Goal**: All Tier-0 features complete and verified by May 12.

---

## Week 3-4 (May 13-26, Launch Prep & Standby)

Wait for launch day. Monitor Daybreak for announcements. Final checklist prep.

**Goal**: Launch readiness checklist complete.

---

## LAUNCH (May 27, 2026 12:00 PM PT)

Server goes live. You transition to operations mode.

---

## Weeks 1-2 Post-Launch (June 3-16)

Start **Tier 1: Engagement Features** (Week 1-2 post-launch)

High-value features players need:
- **T1.1**: Populate all Classic zones (20+ zones, not just 18)
- **T1.2**: Add faction context (quest hub info per zone)
- **T1.3**: Quests page (track epic quest chains)
- **T1.4**: Discord embeds (shareable preview cards)

---

## Month 1+ (June 17 onwards)

**Tier 2: Mid-Game Support** (targeting late June)

- **T2.1**: Audit Kunark + Velious data (before they unlock)
- **T2.2**: Epic 1.0 quest tracker
- **T2.3**: Tradeskill recipes page
- **T2.4**: Best-in-slot gear comparator

---

## Month 2+ (Late June+)

**Tier 3: Long-Term Features**

- PoP progression module
- Public REST API
- PWA / offline mode

---

## Most Important Files

| File | When to Read |
|------|---|
| [FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md) | Strategic overview (read now) |
| [LAUNCH_WEEK_CHECKLIST.md](LAUNCH_WEEK_CHECKLIST.md) | Daily tasks (read now!) |
| [TIER1_SPRINT_PLAN.md](TIER1_SPRINT_PLAN.md) | May 6-19 sprint (read May 6) |
| [README.md](README.md) | Navigation & reference (bookmark) |

---

## Deployment

```bash
# Make changes locally
npm run dev

# Test locally
# - Homepage: http://localhost:3000
# - Try search, filters, zone view
# - Check dark mode (toggle in nav)
# - Test on mobile view (DevTools F12, Cmd+Shift+M)

# Commit when ready
git add .
git commit -m "feat(T0.1): Add server status badge"
git push origin feature/T0-server-indicator

# Merge to main (auto-deploys)
git checkout main
git merge feature/T0-server-indicator
git push origin main

# Vercel auto-deploys (~2 min)
# Verify live: https://frostreaver-loot.vercel.app/

# Post to Discord #frostreaver-dev
# "T0.1 SHIPPED: Server status badge live!"
```

---

## Common Commands

```bash
# Install (first time)
npm install

# Development server
npm run dev

# Run validators
npm run validate:item-details

# Extract item names from zones
npm run extract:item-names

# Enrich items from Allakhazam
npm run enrich:zam:test     # Test on 5 items
npm run enrich:zam          # Full run

# Build for production
npm run build

# Lint code
npm run lint
```

---

## Git Workflow (Simple Version)

1. Create feature branch:
   ```bash
   git checkout -b feature/T0-server-indicator
   ```

2. Make changes, test locally

3. Commit:
   ```bash
   git add .
   git commit -m "feat(T0.1): Add server status badge"
   ```

4. Push:
   ```bash
   git push origin feature/T0-server-indicator
   ```

5. Merge to main (triggers Vercel deploy):
   ```bash
   git checkout main
   git merge feature/T0-server-indicator
   git push origin main
   ```

6. Verify live on https://frostreaver-loot.vercel.app/

---

## Testing Checklist (Before Every Deploy)

- [ ] Code compiles (no TypeScript errors)
- [ ] Page loads locally (http://localhost:3000)
- [ ] Search works (type item name, results appear)
- [ ] Filters work (toggle expansion, select zone, change level)
- [ ] Dark mode works (toggle theme, reload, persists)
- [ ] Mobile view OK (DevTools: Cmd+Shift+M or F12 → mobile)
- [ ] No console errors (DevTools → Console tab)
- [ ] Feature works as spec'd in checklist

---

## Data Errors? Quick Fix

```bash
# Find and fix bad JSON
vim data/classic-group-named.json

# Validate syntax
npm run validate:item-details

# Test search still works
# - Start: npm run dev
# - Type in search box
# - Verify results appear

# If broken, revert:
git checkout data/classic-group-named.json

# Re-commit with correct data
```

---

## Deploy Failed?

1. Check Vercel dashboard: https://vercel.com/dashboard
2. Look for build errors in logs
3. Run locally:
   ```bash
   npm run build
   npx tsc --noEmit
   ```
4. Fix error, commit, push again
5. Vercel will retry auto-deploy

---

## Player Reports Bug?

1. **Confirm**: "Can you share a screenshot / tell me exact zone + mob?"
2. **Verify**: Check Allakhazam or eqprogression.com
3. **Assess**: Is it our data or player mistaken?
   - Our bug? → Fix, deploy, announce
   - Player mistaken? → Share correct link, educate
4. **Log**: Create GitHub issue if systematic issue

---

## Performance Slow?

1. Profile in Chrome DevTools:
   - F12 → Performance tab
   - Search for item
   - Look for long tasks (>100ms)
2. Check `search.ts` + `universal-search.ts` for slow loops
3. Verify `useMemo` is working (React DevTools Profiler)
4. If data-related: lazy-load Kunark/Velious on tab click
5. Document baseline in `/docs/PERFORMANCE.md`

---

## Mobile Layout Broken?

1. Real device test (not browser zoom):
   ```bash
   npm run dev
   # On phone: http://[your-ip]:3000
   ```
2. Check `globals.css` breakpoints:
   - `@media (max-width: 720px)` — mobile
   - `@media (max-width: 980px)` — tablet
3. Verify grid-template-columns responsive:
   ```css
   grid-template-columns: repeat(3, 1fr);  /* desktop */
   
   @media (max-width: 980px) {
     grid-template-columns: repeat(2, 1fr);  /* tablet */
   }
   
   @media (max-width: 720px) {
     grid-template-columns: 1fr;  /* mobile */
   }
   ```
4. Test Lighthouse score ≥90

---

## Feeling Lost?

**Read in this order**:
1. This file (you're reading it!) ✓
2. [FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md) — 15 min read
3. [LAUNCH_WEEK_CHECKLIST.md](LAUNCH_WEEK_CHECKLIST.md) — Today's tasks
4. [README.md](README.md) — Full reference guide

**Still stuck?** Ask questions in Discord #frostreaver-dev (to yourself, lol).

---

## Success Metrics (Measure Daily)

- [ ] Features shipped (T0.1 done, working on T0.2...)
- [ ] Zero critical bugs
- [ ] Site uptime 99%+ (check Vercel dashboard)
- [ ] Search <300ms (Chrome DevTools → measure)
- [ ] Mobile score ≥90 (Lighthouse)
- [ ] Player feedback positive (Discord reactions)

---

## Remember

- **Ship it**: Done is better than perfect. Launch with what you have.
- **Iterate fast**: Get feedback, fix bugs, deploy weekly.
- **Data first**: Players forgive missing features, not wrong data.
- **One thing at a time**: Focus on current tier, don't plan next month.
- **You've got this**: Single dev pace is totally doable. Pace yourself.

---

**Next step**: Open [LAUNCH_WEEK_CHECKLIST.md](LAUNCH_WEEK_CHECKLIST.md) and start this week's checklist!

**Status**: Ready to begin 4-week sprint to launch.
**Time to ship**: 4 weeks until May 27, 2026 12:00 PM PT launch.
**Focus**: Ship Tier 0 features with high quality, launch with confidence.
