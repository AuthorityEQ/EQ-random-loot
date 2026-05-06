"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { fetchUserSettings, saveUserSettings } from "@/lib/user-settings-client";

type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("frostreaver-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const { status: authStatus, data: session } = useSession();
  const isSignedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  useEffect(() => {
    const nextTheme = getPreferredTheme();
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !isSignedIn) return;
    let cancelled = false;
    fetchUserSettings()
      .then((settings) => {
        const remoteTheme = settings?.preferences.theme;
        if (!cancelled && (remoteTheme === "light" || remoteTheme === "dark")) {
          setTheme(remoteTheme);
          document.documentElement.dataset.theme = remoteTheme;
          window.localStorage.setItem("frostreaver-theme", remoteTheme);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, ready]);

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("frostreaver-theme", nextTheme);
    if (isSignedIn) {
      window.setTimeout(() => {
        saveUserSettings({ preferences: { theme: nextTheme } }).catch(() => {});
      }, 400);
    }
  }

  return (
    <div className="theme-toggle" aria-label="Theme">
      <button
        aria-pressed={theme === "light"}
        className={theme === "light" ? "theme-toggle-button is-active" : "theme-toggle-button"}
        onClick={() => updateTheme("light")}
        type="button"
      >
        Light
      </button>
      <button
        aria-pressed={theme === "dark"}
        className={theme === "dark" ? "theme-toggle-button is-active" : "theme-toggle-button"}
        onClick={() => updateTheme("dark")}
        type="button"
      >
        Dark
      </button>
    </div>
  );
}
