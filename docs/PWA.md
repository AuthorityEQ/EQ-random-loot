# PWA — Progressive Web App

Feature J from IMPLEMENTATION_PLAN.md. The service worker foundation ships before launch; the install prompt and offline page are nice-to-haves that benefit from it.

---

## How the service worker works

`public/sw.js` uses a hand-written service worker with three caching strategies:

| URL pattern | Strategy | Rationale |
|---|---|---|
| `/_next/static/**`, `*.js`, `*.css`, `*.woff2` | Cache-first | Next.js build assets are content-hashed; a URL change == new file |
| `/item-icons/**` | Cache-first | Icons are stable; cache indefinitely |
| HTML navigation (everything else) | Network-first, fall back to cache | Users always get fresh content when online; offline still works |
| `/api/**` | Network only | API responses must never be served stale |

On **install** the SW precaches the four app shell pages:
- `/` (Group Named)
- `/raids`
- `/favorites`
- `/offline`

All loot data (JSON files under `data/`) is bundled into the Next.js HTML at build time via static `import` statements. There are no runtime `/data/*.json` HTTP requests, so no data JSON URLs appear in the precache list.

On **activate** the SW deletes any cache whose name does not match the current `CACHE_NAME` constant, cleaning up stale cache entries from previous versions.

`skipWaiting()` and `clients.claim()` are both called so an updated SW takes effect on next page load without requiring a tab close.

---

## Updating the cache version

When you need to force all clients to discard old caches (e.g. after a significant data or layout change):

1. Open `public/sw.js`.
2. Change the `CACHE_NAME` constant at the top:
   ```js
   // before
   const CACHE_NAME = "frostreaver-v1";
   // after
   const CACHE_NAME = "frostreaver-v2";
   ```
3. Deploy. On next visit each client will:
   - Download the new SW.
   - Run install (precaches with the new name).
   - Run activate (deletes `frostreaver-v1` and any other old caches).

There is no other config to change. The activate handler deletes every cache key that does not exactly match `CACHE_NAME`.

---

## Kill-switch deployment procedure

If a broken SW ships and needs to be removed immediately:

1. Copy `public/sw-killswitch.js` over `public/sw.js` in your production deploy (or rename it in your deployment pipeline).
2. Ship the deploy. On next visit each client will:
   - Download the kill-switch SW.
   - Call `skipWaiting()` immediately on install.
   - On activate: delete all caches, reload all open tabs, and unregister the SW.
3. After two deploy cycles (to ensure all clients have cycled through the kill-switch), restore a fixed `public/sw.js` with a new `CACHE_NAME`.

The kill-switch file is intentionally kept in `public/` at all times so the procedure requires only a file rename in CI/CD — no code changes needed during an incident.

---

## Icon dimensions to create

All icons should use the `--accent` brand color (`#2d6a4f` for light / `#7fc59b` for dark — use the light value for the icon background).

Place completed icons in `public/icons/`:

| File | Size | Notes |
|---|---|---|
| `icon-192.png` | 192 x 192 px | Standard Android home-screen icon |
| `icon-512.png` | 512 x 512 px | Splash screen / high-DPI displays |
| `icon-maskable.png` | 512 x 512 px | Safe area: place artwork inside the central 80% circle (409 x 409 px); outer ring will be cropped by the OS mask |

A simple design: accent green background with a white "F" lettermark or a simplified loot-bucket silhouette. The maskable icon safe-zone rule is the only hard constraint.

Remove `public/icons/.gitkeep` once the actual PNG files are committed.

---

## layout.tsx integration (pending — do not apply until scheduled)

Two changes need to land in `app/layout.tsx` before PWA is fully active:

```tsx
// 1. Inside <head>: add manifest link and theme-color meta
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2d6a4f" />

// 2. Inside <body>, after the provider tree:
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { InstallPromptBanner } from "@/components/InstallPromptBanner";

// Render both (they return null / a banner; no visual impact on server render):
<ServiceWorkerRegistration />
<InstallPromptBanner />
```

These are intentionally deferred so layout.tsx changes can be batched with other pending integrations.
