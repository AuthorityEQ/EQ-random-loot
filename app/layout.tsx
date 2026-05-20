import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { AppNavLinks, AppSubNavLinks } from "@/components/AppNavLinks";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { BucketDisplayProvider } from "@/components/BucketDisplayProvider";
import { DiscordAuthControl } from "@/components/DiscordAuthControl";
import { EpicProgressProvider } from "@/components/EpicProgressProvider";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { InstallPromptBanner } from "@/components/InstallPromptBanner";
import { ItemPreviewProvider } from "@/components/ItemPreviewProvider";
import { SavedCraftingRecipesProvider } from "@/components/SavedCraftingRecipesProvider";
import { ItemPreviewToggle } from "@/components/ItemPreviewToggle";
import { ServerProvider } from "@/components/ServerProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loot Goblin - EverQuest Tools",
  description: "EverQuest loot, spell, and vendor planning tools.",
  openGraph: {
    title: "Loot Goblin - EverQuest Tools",
    description: "EverQuest loot, spell, and vendor planning tools.",
    siteName: "Loot Goblin",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loot Goblin - EverQuest Tools",
    description: "EverQuest loot, spell, and vendor planning tools.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="frostreaver-theme-init"
          strategy="beforeInteractive"
        >
          {`(() => {
  try {
    const saved = localStorage.getItem("frostreaver-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();`}
        </Script>
        <Script
          id="frostreaver-server-init"
          strategy="beforeInteractive"
        >
          {`(() => {
  try {
    const url = new URL(location.href);
    const param = url.searchParams.get("server");
    const valid = ["frostreaver","teek","mischief"];
    const saved = localStorage.getItem("frostreaver-server");
    const server = valid.includes(param) ? param : (valid.includes(saved) ? saved : "frostreaver");
    document.documentElement.dataset.server = server;
  } catch { document.documentElement.dataset.server = "frostreaver"; }
})();`}
        </Script>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2d6a4f" />
      </head>
      <body>
        <AuthSessionProvider>
          <ServerProvider>
            <FavoritesProvider>
              <BucketDisplayProvider>
                <EpicProgressProvider>
                  <SavedCraftingRecipesProvider>
                    <ItemPreviewProvider>
                      <nav className="app-nav" aria-label="Primary navigation">
                        <a
                          className="app-donate-link"
                          href="https://www.paypal.com/donate/?hosted_button_id=GRK8K9JWNVALW"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="app-donate-mark" aria-hidden="true">P</span>
                          Donate
                        </a>
                        <AppNavLinks />
                        <div className="app-nav-controls">
                          <DiscordAuthControl />
                          <ItemPreviewToggle />
                          <ThemeToggle />
                        </div>
                      </nav>
                      <AppSubNavLinks />
                      {children}
                    </ItemPreviewProvider>
                  </SavedCraftingRecipesProvider>
                </EpicProgressProvider>
              </BucketDisplayProvider>
            </FavoritesProvider>
          </ServerProvider>
        </AuthSessionProvider>
        <ServiceWorkerRegistration />
        <InstallPromptBanner />
        <Analytics />
      </body>
    </html>
  );
}
