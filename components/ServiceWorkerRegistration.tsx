"use client";
import { useEffect } from "react";

/**
 * Registers the service worker on first mount in production.
 * Render this component once near the root of the layout body —
 * it produces no DOM output.
 *
 * Integration (do NOT apply until PWA consolidation is scheduled):
 *
 *   // app/layout.tsx — import at top
 *   import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
 *
 *   // Inside <body>, after the providers / nav tree:
 *   <ServiceWorkerRegistration />
 *
 * The SW is intentionally skipped in development to avoid stale-cache
 * confusion during active development. Set NODE_ENV=production or run
 * `next build && next start` to exercise it locally.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
