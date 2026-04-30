"use client";
import { useEffect, useRef, useState } from "react";

/** The browser's BeforeInstallPromptEvent is not in the standard lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "frostreaver-pwa-install-dismissed";
// Delay (ms) before the banner appears — reduces annoyance on first visit.
const SHOW_DELAY_MS = 30_000;

/**
 * Shows a non-intrusive install banner when the browser fires
 * `beforeinstallprompt` and the user has not previously dismissed it.
 * The banner waits 30 seconds after mount before appearing.
 *
 * Integration (do NOT apply until PWA consolidation is scheduled):
 *
 *   // app/layout.tsx — import at top
 *   import { InstallPromptBanner } from "@/components/InstallPromptBanner";
 *
 *   // Inside <body>, before closing tag:
 *   <InstallPromptBanner />
 */
export function InstallPromptBanner() {
  const [visible, setVisible] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if the user already dismissed permanently
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage unavailable — just continue
    }

    let showTimer: ReturnType<typeof setTimeout> | null = null;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;

      // Only show after the delay, and only if not already dismissed
      showTimer = setTimeout(() => {
        try {
          if (localStorage.getItem(DISMISS_KEY) !== "1") {
            setVisible(true);
          }
        } catch {
          setVisible(true);
        }
      }, SHOW_DELAY_MS);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      if (showTimer !== null) clearTimeout(showTimer);
    };
  }, []);

  function handleInstall() {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    deferredPrompt.current.userChoice.then(() => {
      deferredPrompt.current = null;
      setVisible(false);
    });
  }

  function handleDismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Silently ignore — banner just won't persist the dismiss
    }
  }

  if (!visible) return null;

  return (
    <div className="install-prompt-banner" role="banner" aria-live="polite">
      <p className="install-prompt-text">
        Install Frostreaver Loot Buckets for offline access
      </p>
      <div className="install-prompt-actions">
        <button
          aria-label="Install Frostreaver app"
          className="install-prompt-button install-prompt-button--install"
          onClick={handleInstall}
          type="button"
        >
          Install
        </button>
        <button
          className="install-prompt-button install-prompt-button--dismiss"
          onClick={handleDismiss}
          type="button"
          aria-label="Dismiss install prompt"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
