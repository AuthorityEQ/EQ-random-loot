# EQ-Random-Loot: Frostreaver Loot Reference

Fast, accurate loot lookup for EverQuest's Frostreaver TLP server. Random loot discovery made simple.

**Positioning**: "Loot lookup, zero clutter."  
**Current Build**: v0.2.0 (April 29, 2026)  
**Status**: Feature Complete - Ready for Launch (May 27, 2026 12:00 PM PT)  
**Tech Stack**: Next.js 16, React 19, TypeScript, Custom CSS  
**Team Size**: Single developer (originally), 60 agents in build session

---

## Key Features

- **Group-Named Loot Buckets**: Classic, Kunark, Velious expansions with 1,600+ items
- **Multi-Server Support**: Frostreaver, Mischief, Teek (server selector included)
- **Deep-Link Routes**: Permalinks for every mob, zone, and item for sharing
- **Crafting Hub**: 200+ recipes with component sourcing
- **Faction Guide**: 25+ factions with ally/enemy relationships
- **Epic Quest Tracker**: 14-class progression walkthroughs with checkboxes
- **Offline Support**: PWA-enabled — install and use without internet
- **Dark/Light Themes**: Full accessibility support (WCAG 2.1 AA)
- **Mobile-First Design**: Responsive on all devices (no frameworks)

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/[yourname]/EQ-random-loot.git
cd EQ-random-loot
npm install

# Start dev server
npm run dev

# Visit http://localhost:3000 in your browser
```

No database setup needed — all data is static JSON files.

**See [docs/QUICK_START.md](docs/QUICK_START.md) for more details.**

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 16 + React 19 | App Router, Server Components by default |
| **Language** | TypeScript | Strict mode, 100% type-safe |
| **Styling** | Custom CSS | No frameworks (Tailwind, CSS-in-JS, etc.) |
| **Data** | Static JSON | Import with `import data from "@/data/*.json"` |
| **Hosting** | Vercel | Auto-deploy on git push to main |
| **Build** | npm scripts | node --experimental-strip-types for TS scripts |

**Dependencies** (Production, 4 total):
- next 16.2.4
- react 19.2.5
- react-dom 19.2.5
- postcss 8.5.12

No bloat — you can read every dependency in node_modules.

---

## Project Structure

```
EQ-random-loot/
├── app/                          # Next.js pages (App Router)
│   ├── page.tsx                  # Home (Group Named)
│   ├── /raids/page.tsx           # Raid Bosses
│   ├── /favorites/page.tsx       # Favorites Checklist
│   ├── /mob/[name]/page.tsx      # Mob Detail (new in v0.2)
│   ├── /zone/[name]/page.tsx     # Zone Detail (new in v0.2)
│   ├── /item/[id]/page.tsx       # Item Detail (new in v0.2)
│   ├── /crafting/page.tsx        # Crafting Hub (new in v0.2)
│   ├── /faction/page.tsx         # Faction Guide (new in v0.2)
│   ├── /epics/page.tsx           # Epic Quest Tracker (new in v0.2)
│   └── layout.tsx                # Root shell
│
├── components/                   # Reusable React components
│   ├── BucketCard.tsx            # Group summary card
│   ├── ItemDrawer.tsx            # Item inspection modal
│   ├── SearchBox.tsx             # Universal search
│   ├── ZoneView.tsx              # Zone display
│   ├── ServerProvider.tsx        # Server context (new)
│   ├── EpicProgressProvider.tsx  # Epic tracking (new)
│   └── *.css                     # Per-component styles
│
├── lib/                          # Utilities & data access
│   ├── search.ts                 # Bucket/item search
│   ├── universal-search.ts       # Cross-entity typeahead
│   ├── zones.ts, buckets.ts      # Data helpers
│   ├── servers.ts                # Server management (new)
│   ├── datasets.ts               # Multi-server data loader (new)
│   ├── crafting.ts, factions.ts, epics.ts # Feature helpers (new)
│   └── pwa.ts                    # PWA utilities (new)
│
├── data/                         # Static JSON data files
│   ├── classic-group-named.json  # Classic loot buckets
│   ├── kunark-group-named.json   # Kunark loot buckets
│   ├── velious-group-named.json  # Velious loot buckets
│   ├── item-details.json         # Item metadata
│   ├── classic-raid.json, kunark-raid.json, velious-raid.json
│   ├── excel-import-*.json       # Excel data imports (new)
│   └── *.json                    # Other data sources
│
├── docs/                         # Complete documentation (24+ docs)
│   ├── README.md                 # Documentation index
│   ├── QUICK_START.md            # Developer getting started
│   ├── MASTER_PLAN.md            # Build session outcomes
│   ├── IMPLEMENTATION_PLAN.md    # Feature A-J specs
│   ├── CHANGELOG.md              # Version history
│   ├── CONTRIBUTORS.md           # Team credits + guidelines
│   ├── DESIGN_SYSTEM.md          # CSS tokens + components
│   ├── FROSTREAVER_RULESET.md    # Server rules reference
│   ├── FROSTREAVER_ROADMAP.md    # Product strategy
│   └── [20+ more docs]           # QA, Deploy, Data, etc.
│
├── public/                       # Static assets
│   ├── item-icons/               # Scraped item images
│   ├── icons/                    # PWA icons
│   ├── manifest.webmanifest      # PWA manifest
│   └── sw.js                     # Service worker
│
├── scripts/                      # Build & data scripts
│   ├── enrich-items-from-zam.ts  # Allakhazam scraper
│   ├── import-item-icons.ts      # Icon downloader
│   ├── import-excel-master.ts    # Excel data ingest
│   └── [etc]                     # Data validation scripts
│
├── package.json                  # npm configuration
├── tsconfig.json                 # TypeScript config (strict)
├── next.config.ts                # Next.js config
└── globals.css                   # Design system (1,400+ lines)
```

---

## Quick Links

- **Live Site**: https://frostreaver-loot.vercel.app (launches May 27)
- **Documentation Hub**: [docs/README.md](docs/README.md) (all 24+ docs)
- **Discord Community**: [Invite link TBD]
- **Contributing**: [docs/CONTRIBUTORS.md](docs/CONTRIBUTORS.md)
- **Issue Tracker**: GitHub Issues
- **Data Problems**: Discord #data-issues

---

## How to Contribute

1. **Report a bug**: [See CONTRIBUTORS.md](docs/CONTRIBUTORS.md#report-a-bug)
2. **Suggest a feature**: Discord #feedback or GitHub Discussion
3. **Fix data errors**: Discord #data-issues with proof (eqprogression link, server screenshot)
4. **Submit code**: See [CONTRIBUTORS.md](docs/CONTRIBUTORS.md#add-code) for PR process
5. **Improve docs**: Submit a PR to `/docs` directory

**All contributions welcome!** See [CONTRIBUTORS.md](docs/CONTRIBUTORS.md) for detailed guidelines.

---

## Data Pipeline

The site ingests loot data from multiple trusted sources:

1. **Allakhazam** (Primary)
   - Mob/zone/item data via HTML scraping
   - User-Agent: `EQ-random-loot/0.2 (+enrichment; contact: eq2platsales@gmail.com)`
   - Cached to avoid repeat hits (robots.txt compliant)

2. **eqprogression.com** (Secondary)
   - Focus effects, quest sources, raid loot
   - 94 bosses raid table ingest

3. **Gronnz Master Database** (Manual)
   - Crafting recipes (Tailoring, Fletching, etc.)
   - Faction relationships
   - Epic quest walkthroughs
   - Excel import pipeline

4. **Community Feedback** (Live)
   - Discord #data-issues for player corrections
   - Cross-validation against live server

**See [docs/SCRAPE_STRATEGY.md](docs/SCRAPE_STRATEGY.md) for pipeline details.**

---

## Documentation

**Start here**: [docs/README.md](docs/README.md) for complete navigation.

**Most Important Docs:**
- [QUICK_START.md](docs/QUICK_START.md) — Get running locally (5 min)
- [MASTER_PLAN.md](docs/MASTER_PLAN.md) — Build session outcome, what shipped
- [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — Features A-J detailed specs
- [FROSTREAVER_ROADMAP.md](docs/FROSTREAVER_ROADMAP.md) — Product vision, post-launch roadmap
- [CONTRIBUTORS.md](docs/CONTRIBUTORS.md) — How to contribute + team credits
- [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — CSS tokens, component patterns
- [CHANGELOG.md](docs/CHANGELOG.md) — Version history (v0.1 → v0.2)

**Complete List**: All 24+ docs listed in [docs/README.md](docs/README.md#documentation-index)

---

## Release Status

**v0.2.0 Shipped (April 29, 2026)**

What's included:
- Server selector (A)
- Mob detail pages (B)
- Zone detail pages (C)
- Item detail pages (D)
- eqprogression scrape integration (E)
- Excel data ingest pipeline (F)
- Crafting hub (G)
- Faction guide (H)
- Epic quest tracker (I)
- PWA offline support (J)

**Ready to Launch**: May 27, 2026 12:00 PM PT

See [CHANGELOG.md](docs/CHANGELOG.md) for full release notes.

---

## License

[TBD] — Check LICENSE file or see [FROSTREAVER_RULESET.md](docs/FROSTREAVER_RULESET.md#legal) for legal notices.

---

## Contact & Support

- **Bug Reports**: [GitHub Issues](https://github.com/[yourname]/EQ-random-loot/issues)
- **Feature Requests**: Discord #feedback or [GitHub Discussions](https://github.com/[yourname]/EQ-random-loot/discussions)
- **Data Issues**: Discord #data-issues (fastest response)
- **Development Help**: Discord #frostreaver-dev

---

**Build Session**: April 29, 2026  
**Last Updated**: April 29, 2026  
**Maintained By**: Project Contributors  
**Community**: EverQuest Frostreaver TLP
