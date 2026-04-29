# EQ-Random-Loot Documentation

Complete documentation for the Frostreaver Loot Reference application.

**Current Build**: v0.2.0 (April 29, 2026)  
**Launch Date**: May 27, 2026 12:00 PM PT (CONFIRMED)  
**Status**: Feature Complete - Documentation Phase  
**Build Session**: 60 agents (20 planning + 20 build + 20 consolidation)

---

## Quick Navigation

### Executive Summary
- **[MASTER_PLAN.md](MASTER_PLAN.md)** — Unified master plan consolidating all 11 agent outputs
  - Executive summary, 4-week timeline, launch confirmed (May 27)
  - Cross-references to all other docs
  - Risk register, decision log, success metrics
  - **Start here if you want the full picture in 10 minutes**

### Strategic Documents
- **[FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md)** — High-level product strategy (UPDATED for May 27 launch)
  - Vision, market context, success metrics
  - 4-tier roadmap: Tier 0 (launch blocking), Tier 1 (week 1-2), Tier 2 (month 1), Tier 3 (long-term)
  - Risk assessment, resource planning, technical constraints
  - **Read this first for understanding what to build and why**

- **[COMPETITIVE_POSITIONING.md](COMPETITIVE_POSITIONING.md)** — Market strategy, positioning, GTM
  - Positioning statement: "Loot lookup, zero clutter"
  - 5 target user segments with messaging
  - Defensible moat analysis
  - GTM playbook with dates (May 15 creator outreach, May 27 launch, June 3-16 engagement)

- **[FROSTREAVER_RULESET.md](FROSTREAVER_RULESET.md)** — Server mechanics & rules reference
  - Confirmed launch: May 27, 2026 12:00 PM PT
  - Launch content: Classic + Kunark + Velious at day 1
  - Complete ruleset table (Free Trade, No Truebox, Encounter Locking, Resource Hunter)
  - Loot bucket mechanics explained
  - Comparison with Mischief vs. Teek

### Tactical Execution Guides
- **[LAUNCH_WEEK_CHECKLIST.md](LAUNCH_WEEK_CHECKLIST.md)** — 4-week pre-launch sprint plan (UPDATED for May 27)
  - April 29 - May 26 (4 weeks, not 1 week)
  - Detailed checklist per day: T0.1-T0.5 (Tier 0 features)
  - Definition of Done, escalation matrix, QA checklists
  - **Follow this during pre-launch sprint (April 29 - May 26)**

- **[TIER1_SPRINT_PLAN.md](TIER1_SPRINT_PLAN.md)** — Week 1-2 post-launch sprint (UPDATED for June 3-16)
  - June 3-16 (Week 1-2 after launch, NOT May 6-19)
  - 4 major features: Zone population, Faction context, Quests page, Discord embeds
  - Daily standup format, resource estimates, success criteria
  - **Reference this during Week 1-2 post-launch (June 3-16)**

- **[QUICK_START.md](QUICK_START.md)** — Quick reference for developers (UPDATED for May 27)
  - TL;DR version of roadmap
  - This week/month navigation
  - Common commands, deployment flow

- **[CHANGELOG.md](CHANGELOG.md)** — Version history & release notes (NEW in v0.2.0)
  - v0.2.0 feature list (10 features A-J, 1,611 routes)
  - Migration guide from v0.1.x
  - Next steps for v0.3.0

- **[CONTRIBUTORS.md](CONTRIBUTORS.md)** — How to contribute & team credits (NEW)
  - Code of conduct & contribution guidelines
  - Bug reports, feature requests, data corrections
  - Commit message format & coding standards
  - Team credits for build session agents

### Design & Technical
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** — CSS design system reference
  - Token system (light + dark, all categories)
  - Component patterns (BucketCard, ItemDrawer, SearchBox)
  - Bucket color theme rules (`bucket.bucket % 6` mapping)
  - Expansion theme rules (`.expansion-tone-*` aliasing)
  - Constraints (inline theme script, EQ Inspect palette)
  - Safe extensions (new bucket colors, new expansions, new components)
  - Accessibility patterns & mobile breakpoints

- **[SCRAPE_STRATEGY.md](SCRAPE_STRATEGY.md)** — Data enrichment pipeline
  - 3 scrapers: Allakhazam zones, Allakhazam NPCs, EQ Progression
  - URL patterns, cache TTL, rate limiting per source
  - User-Agent string: `EQ-random-loot/0.2 (+enrichment; contact: eq2platsales@gmail.com)`
  - Cross-source validation & conflict resolution
  - Legal/ethical considerations (robots.txt compliance)
  - 4-phase implementation roadmap

### Data & Reference
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** — Feature A-J detailed specs
  - A: Server selector, B: Mob pages, C: Zone pages, D: Item pages
  - E: EQ Progression scrape, F: Excel ingest, G: Crafting pages
  - H: Faction guide, I: Epic quests, J: PWA
  - Ordering & dependencies, effort estimates

- **[PIPELINE.md](PIPELINE.md)** — Data pipeline execution order
  - Canonical step order (extract → correct → enrich → validate)
  - Cache management utilities
  - Troubleshooting guide

### Quality & Compliance
- **[API.md](API.md)** — Data structures and API reference
  - Type definitions for Bucket, Mob, Item, Recipe, Faction, Epic
  - Route signatures and helper functions
  - Examples for common queries

- **[A11Y_AUDIT.md](A11Y_AUDIT.md)** — Accessibility compliance report
  - WCAG 2.1 AA remediation checklist
  - Touch target sizing, focus indicators, color contrast
  - Screen reader testing results

- **[A11Y_FINAL_AUDIT.md](A11Y_FINAL_AUDIT.md)** — Pre-launch accessibility verification
  - Final compliance check before May 27 launch
  - Edge cases and device testing
  - Known limitations and workarounds

- **[PWA.md](PWA.md)** — Progressive Web App & offline support
  - Service worker strategy (cache-first)
  - Install prompt UX (beforeinstallprompt)
  - Offline browsing + data persistence
  - Cache versioning and kill-switch procedures

### Operations & Deployment
- **[DEPLOY.md](DEPLOY.md)** — Production deployment guide
  - CI/CD pipeline (Vercel auto-deploy)
  - Environment setup, secrets management
  - Rollback procedures and incident response

- **[DISCORD_INTEGRATION.md](DISCORD_INTEGRATION.md)** — Discord community setup
  - Channel structure (#frostreaver-dev, #feedback, #data-issues)
  - Bot setup and loot announcements
  - Community feedback loops

---

## How to Use This Suite

### If you're starting TODAY (April 29, ~4 weeks pre-launch)
1. Read [FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md) section "Tier 0: SHIP-BLOCKING" (10 min)
2. Open [QUICK_START.md](QUICK_START.md) for the TL;DR
3. Open [LAUNCH_WEEK_CHECKLIST.md](LAUNCH_WEEK_CHECKLIST.md)
4. Follow this week's (April 29 - May 5) tasks:
   - T0.1: Server & Launch Status Indicator (1 day)
   - T0.2: Verify Classic Group Named Data (3-5 days, start in parallel)
   - T0.4: Search Performance Under Load (2-3 days, start in parallel)

### If you're in WEEK 3 (May 13-19, Launch Prep)
1. Complete final launch readiness checklist
2. Monitor Daybreak for announcements about May 27 launch
3. Prepare incident response plan for launch day

### If you're in WEEK 1 POST-LAUNCH (June 3-9)
1. Quick-reference [FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md) Tier 1 section
2. Open [TIER1_SPRINT_PLAN.md](TIER1_SPRINT_PLAN.md)
3. Follow Week 1 & 2 daily tasks for T1.1-T1.4 features
4. Monitor Discord for critical bugs and player feedback

### If you're in MONTH 2+ (June 17+)
1. Review [FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md) Tier 2-3 sections
2. Refer to sprint plans (create new sprints as needed)
3. Monitor for player-reported issues in Discord

---

## Key Concepts

### Tier System
- **Tier 0**: Ship-blocking features for launch day. Must deploy by April 29.
- **Tier 1**: High-value engagement features for week 1-2. Deploy May 6-19.
- **Tier 2**: Mid-game support features for month 1. Deploy before Kunark unlock (expected ~week 8).
- **Tier 3**: Long-term ecosystem features. Deploy June 2026+.

### Effort Estimates
- **S** (Small): ≤1 day, trivial change
- **M** (Medium): 2-5 days, moderate scope
- **L** (Large): 1-2 weeks, major feature with data/UI work

### Risk Levels
- **LOW**: Isolated change, unlikely to break existing site
- **MEDIUM**: Affects core flow, needs testing, could impact user experience
- **HIGH**: Directly impacts data accuracy or critical path, requires audit/verification

### Data Sources
- **JSON we have**: Use existing /data/ files (classic-group-named.json, etc.)
- **Excel sheet to import**: Not mentioned in this codebase (to be added as needed)
- **Scrape Allakhazam**: Use scripts/enrich-items-from-zam.ts
- **Scrape eqprogression**: Manual research (no auto-scrape script yet)
- **Manual curation**: Hand-verify, document sources

---

## Git & Deployment

### Branch Strategy
Keep it simple for single-developer:
```
main (always deployable)
  ├─ feature/T0-server-indicator
  ├─ feature/T0-classic-verification
  ├─ feature/T0-mobile-audit
  ├─ feature/T0-search-perf
  └─ [etc, one feature per branch]
```

### Commit Message Format
```
feat(T0.1): Add server status indicator badge

- Add launch timestamp to layout.tsx
- Create LaunchStatusBadge component
- Display "LIVE" status in nav with countdown/elapsed time
- Support dark/light mode

Closes #1 (GitHub issue, if applicable)
```

### Deploy Process
1. Commit to feature branch
2. Push to origin
3. Create PR (review own code, QA locally)
4. Merge to main
5. Vercel auto-deploys (~2 min)
6. Verify on production: frostreaver-loot.vercel.app
7. Post update to Discord #frostreaver-dev

---

## Communication with Community

### Discord Channel Structure
- **#frostreaver-dev**: Your daily standup, tech updates
- **#feedback**: Player feature requests, bug reports
- **#data-issues**: Incorrect loot locations, zone spawn errors
- **#announcements**: Feature ship notifications

### Template: Feature Ship Announcement
```
🚀 NEW FEATURE: [Feature Name]

What's new:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

How to use:
[Brief instructions]

Known limitations:
- [If any]

Next up: [Teaser for next feature]

Feedback? Reply here or check #feedback
```

### Template: Bug Report Response
```
Thanks for reporting! We've logged this as [severity] priority.

Current status: [Under investigation / Fix in progress / Testing / Deployed]
ETA: [Date if known]
Workaround: [If available]
```

---

## Success Metrics

### Launch Week (Tier 0)
- [ ] Zero critical bugs
- [ ] Site uptime 99.5%+
- [ ] Search response <300ms
- [ ] Mobile Lighthouse score ≥90
- [ ] Classic data verified 95%+

### Week 1-2 (Tier 1)
- [ ] 4 major features shipped (T1.1-T1.4)
- [ ] Player NPS >8.0
- [ ] 40%+ user favorites adoption
- [ ] 10K+ daily page views
- [ ] 60%+ return visitor rate

### Month 1 (Tier 2 Prep)
- [ ] Kunark/Velious data verified
- [ ] Zero data-driven trust issues
- [ ] Epic quest tracker live
- [ ] Ready for expansion unlock

---

## Common Tasks

### Add a New Zone to Data
1. Research mob spawns on Allakhazam
2. Run: `npm run extract:item-names -- --zone=YourZone`
3. Manually verify each mob + loot
4. Add to classic-group-named.json (find expansion + zone object)
5. Run: `npm run validate:item-details`
6. Test search for zone name + items
7. Commit, deploy

### Fix Incorrect Loot Location
1. Verify with live server spawn / eqprogression.com
2. Update classic-group-named.json (find mob, update loot_pool)
3. Or use: `npm run apply:manual-corrections` (if correction file exists)
4. Validate JSON, test search
5. Commit, deploy with message: "fix: Correct [item] drop location in [zone]"

### Add New Expansion Coverage
1. Create new data file: `/data/[expansion]-group-named.json`
2. Mirror structure from classic-group-named.json
3. Populate buckets + zones
4. Create data audit checklist: `/docs/[EXPANSION]_AUDIT.md`
5. Add to page.tsx imports + datasets array
6. Test expansion filter toggle
7. Deploy

### Performance Optimization
1. Profile with React DevTools Profiler
2. Check for unnecessary re-renders (verify useMemo dependencies)
3. Consider lazy-loading data (if >1000 items slow search)
4. Update /docs/PERFORMANCE.md with baseline
5. Test on mobile (throttle to 4G in DevTools)
6. Commit with: "perf: Optimize [component] search response"

---

## Troubleshooting

### Search is slow (>300ms)
- [ ] Check search.ts + universal-search.ts for inefficient loops
- [ ] Verify useMemo is memoizing typeahead results
- [ ] Increase debounce delay in page.tsx (180ms → 250ms)
- [ ] Profile in Chrome DevTools → Performance tab
- [ ] If still slow: lazy-load Kunark/Velious data

### Mobile layout broken
- [ ] Test on real device (browser zoom ≠ real mobile)
- [ ] Check breakpoints in globals.css (@media max-width: 720px, 980px)
- [ ] Verify grid-template-columns use responsive values
- [ ] Ensure min-height fields don't overflow viewport
- [ ] Run Lighthouse → Mobile score ≥90

### JSON parse error
- [ ] Run: `npm run validate:item-details`
- [ ] Check for missing commas, trailing commas in arrays
- [ ] Use online JSON validator: jsonlint.com
- [ ] Don't forget: JSON doesn't support trailing commas

### Vercel deployment failed
- [ ] Check GitHub Actions logs
- [ ] Run locally: `npm run build`
- [ ] Look for TypeScript errors: `npx tsc --noEmit`
- [ ] Fix, commit, push → Vercel will retry auto-deploy

### Players reporting wrong loot
- [ ] Ask for specific mob name + zone
- [ ] Verify on eqprogression.com or live server
- [ ] If you confirm error: create GitHub issue, prioritize fix
- [ ] If player mistaken: link to reference (Allakhazam link)
- [ ] Update public-facing data issue tracker if persistent

---

## Important Constraints

### Design System
- **NO Tailwind**: Custom CSS only (globals.css is the source of truth)
- **Existing components**: Maximize reuse of BucketCard, ItemDrawer, ZoneView
- **Dark/light mode**: Verify every new feature in both modes
- **Mobile first**: Test on real devices, not just responsive design mode

### Data Integrity
- **Never assume item removed**: If uncertain, mark Unknown (per brainiac_rule_no_removals.md)
- **Spot-check vs. live**: Test 3-5 items per zone against live server
- **Community feedback loop**: Monitor Discord #data-issues for corrections
- **Audit trail**: Document sources for disputed data

### Performance
- **Search <300ms**: Non-negotiable for real-time typeahead
- **Page load <3s**: Target, acceptable up to 5s on slow 4G
- **Lighthouse ≥90**: Mobile score required for accessibility

### Deployment
- **Continuous deploy**: Every merged feature goes live immediately
- **No code review needed**: You're sole dev, self-QA
- **Rollback ready**: 1-line revert if critical bug found
- **Test in prod**: Verify on frostreaver-loot.vercel.app before announcing

---

## Calendar View

```
April 2026
==========
Mo Tu We Th Fr Sa Su
         1  2  3  4  5
 6  7  8  9 10 11 12 13
14 15 16 17 18 19 20 21
22 23 24 25 26 27 28 29 ← Today (April 29)
30

May 2026
========
Mo Tu We Th Fr Sa Su
         1  2  3  4  5  6  ← Week 1 Pre-Launch (Tier 0 build)
 7  8  9 10 11 12 13      ← Week 2 Pre-Launch (final verification)
14 15 16 17 18 19 20      ← Week 3 Pre-Launch (launch prep/standby)
21 22 23 24 25 26 27      ← Week 4 Pre-Launch → LAUNCH DAY May 27 12:00 PM PT
28 29 30 31

June 2026
=========
Mo Tu We Th Fr Sa Su
                  1  2  3
 4  5  6  7  8  9 10     ← Post-Launch Week 1-2 (Tier 1 features)
11 12 13 14 15 16 17     ← Post-Launch Week 1-2 continued
18 19 20 21 22 23 24     ← Post-Launch Week 3 (Kunark audit begins)
25 26 27 28 29 30        ← Post-Launch Week 4 (Tier 2 prep)
```

---

## Document Ownership & Updates

| Document | Owner | Review Cadence |
|----------|-------|---|
| FROSTREAVER_ROADMAP.md | You | Monthly |
| LAUNCH_WEEK_CHECKLIST.md | You | Daily (live) |
| TIER1_SPRINT_PLAN.md | You | Daily (May 6-19) |
| CLASSIC_DATA_AUDIT.md | You | Daily (launch week) |
| PERFORMANCE.md | You | Weekly |
| Other docs | You | As-needed |

---

## Quick Reference: File Structure

```
C:/Users/rontf/EQ-random-loot/
├── /app/                          # Next.js pages
│   ├── page.tsx                   # Home (Group Named)
│   ├── /raids/page.tsx            # Raid Bosses
│   ├── /favorites/page.tsx        # Favorites list
│   ├── /quests/page.tsx           # [T1.3 to create]
│   ├── /api/og/route.ts           # [T1.4 to create]
│   └── layout.tsx                 # Root layout + nav
│
├── /components/                   # React components
│   ├── BucketCard.tsx             # Group summary card
│   ├── ItemDrawer.tsx             # Item details panel
│   ├── ZoneView.tsx               # Zone page view
│   ├── SearchBox.tsx              # Universal search
│   ├── [etc]
│   └── ZoneFactionContext.tsx     # [T1.2 to create]
│
├── /data/                         # Static JSON data
│   ├── classic-group-named.json
│   ├── kunark-group-named.json
│   ├── velious-group-named.json
│   ├── item-details.json
│   ├── classic-raid.json
│   ├── [etc]
│   └── faction-context.json       # [T1.2 to create]
│
├── /docs/                         # This directory!
│   ├── README.md                  # [This file]
│   ├── FROSTREAVER_ROADMAP.md     # Strategic plan
│   ├── LAUNCH_WEEK_CHECKLIST.md   # Daily tasks
│   ├── TIER1_SPRINT_PLAN.md       # Week 1-2 sprint
│   ├── CLASSIC_DATA_AUDIT.md      # [Create during T0.2]
│   ├── PERFORMANCE.md             # [Create during T0.4]
│   └── [future docs]
│
├── /lib/                          # Utilities
│   ├── search.ts
│   ├── universal-search.ts
│   ├── zones.ts
│   └── [etc]
│
├── /scripts/                      # Build & data scripts
│   ├── extract-item-names.ts
│   ├── enrich-items-from-zam.ts
│   └── [etc]
│
├── globals.css                    # Design system (custom CSS)
└── package.json                   # Dependencies
```

---

## Final Checklist Before Reading Other Docs

- [ ] You've read this README.md ✓
- [ ] You understand the 4-tier roadmap (Tier 0 → 1 → 2 → 3)
- [ ] You know which document to follow based on current date:
  - [ ] April 29 → Use [LAUNCH_WEEK_CHECKLIST.md](LAUNCH_WEEK_CHECKLIST.md)
  - [ ] May 6-19 → Use [TIER1_SPRINT_PLAN.md](TIER1_SPRINT_PLAN.md)
  - [ ] May 20+ → Reference [FROSTREAVER_ROADMAP.md](FROSTREAVER_ROADMAP.md) Tier 2-3
- [ ] You've identified the current blockers (T0.1-T0.5)
- [ ] You know how to deploy (commit → Vercel auto-deploys)
- [ ] You know where to post updates (Discord #frostreaver-dev)

---

**Last Updated**: 2026-04-29  
**Next Review**: 2026-05-06 (End of launch week)  
**Maintained By**: You (AuthorityGames)

Good luck with the launch! Remember: **ship early, iterate fast, listen to players.**
