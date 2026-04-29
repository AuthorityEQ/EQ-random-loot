// Frostreaver Kill-Switch Service Worker
//
// Deploy this as sw.js when you need to recover from a broken service worker.
// It unregisters itself, clears all caches, and forces every open tab to reload.
//
// Deployment procedure:
//   1. Copy (or rename) this file to public/sw.js in your production deploy.
//   2. Ship the deploy. Clients will download this SW and run it on next visit.
//   3. All caches are wiped and the SW unregisters itself.
//   4. On the next visit after that, the site behaves as if no SW ever existed.
//   5. Once all users have cycled through, you can re-deploy a fixed sw.js.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", async (event) => {
  event.waitUntil(
    (async () => {
      // Delete every cache entry
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      // Reload all controlled tabs so they get a fresh network-only load
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));

      // Unregister this SW so no SW is active going forward
      await self.registration.unregister();
    })()
  );
});
