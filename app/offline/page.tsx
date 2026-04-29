/**
 * Offline fallback page — served by the service worker when a navigation
 * request fails and no cached version of the requested page exists.
 *
 * This is a server component; it intentionally avoids client-side hooks so it
 * can be precached as a static HTML shell.
 */
export default function OfflinePage() {
  return (
    <main className="page">
      <div className="header">
        <p className="eyebrow">Connection unavailable</p>
        <h1>You&apos;re offline</h1>
        <p className="subhead">
          Cached pages — Group Named, Raids, and Favorites — still work. Navigate
          to one of them using the menu above, or reconnect and refresh.
        </p>
      </div>

      <div className="empty" style={{ marginTop: "24px" }}>
        <p>
          This page was not available in your offline cache. Once you&apos;re back
          online it will load normally.
        </p>
      </div>
    </main>
  );
}
