// Frostreaver Loot Buckets — Service Worker
// To bust the cache, bump CACHE_NAME to a new version string.
const CACHE_NAME = "frostreaver-v1";

// Pages to precache on install so the shell is available offline immediately.
// Data is bundled into the Next.js page HTML at build time (static JSON imports),
// so there are no separate /data/*.json network requests to precache.
const PRECACHE_URLS = [
  "/",
  "/raids",
  "/favorites",
  "/offline",
];

// ── Install ──────────────────────────────────────────────────────────────────
// Precache shell pages and take control without waiting for tabs to close.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
// Delete every cache that doesn't match the current CACHE_NAME.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Route classifier — returns the caching strategy for a given request URL.
 *
 *   "network-only"  — API routes: always fresh, never cached
 *   "cache-first"   — Static assets (.js, .css, .woff2) + item icons: serve
 *                     from cache, fetch & update on miss
 *   "network-first" — HTML pages: try network first for latest content, fall
 *                     back to cache when offline
 */
function getStrategy(url) {
  const { pathname } = url;

  // API routes — network only, no caching
  if (pathname.startsWith("/api/")) {
    return "network-only";
  }

  // Item icons — cache-first, effectively infinite TTL
  if (pathname.startsWith("/item-icons/")) {
    return "cache-first";
  }

  // Static assets produced by the Next.js build — cache-first
  if (
    pathname.startsWith("/_next/static/") ||
    /\.(js|css|woff2?|ttf|otf|eot)(\?.*)?$/.test(pathname)
  ) {
    return "cache-first";
  }

  // Everything else (HTML navigation) — network-first
  return "network-first";
}

self.addEventListener("fetch", (event) => {
  // Only handle GET requests over http(s); ignore chrome-extension etc.
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!["http:", "https:"].includes(url.protocol)) return;

  const strategy = getStrategy(url);

  if (strategy === "network-only") {
    // Pass through to network, do not touch the cache
    return;
  }

  if (strategy === "cache-first") {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // strategy === "network-first"
  event.respondWith(networkFirst(event.request));
});

// ── Strategy implementations ──────────────────────────────────────────────────

/**
 * Cache-first: return the cached response if present; otherwise fetch from
 * network, store the result, and return it. Good for immutable/versioned
 * assets where the URL itself changes when content changes.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // No cached copy and network failed — nothing we can do
    return new Response("Network error", { status: 408 });
  }
}

/**
 * Network-first: try the network; on failure (offline, timeout) fall back to
 * the cache. If neither succeeds for a navigation request, serve /offline.
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For HTML navigation requests, fall back to the offline page
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline");
      if (offlinePage) return offlinePage;
    }

    return new Response("You are offline and this page is not cached.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
