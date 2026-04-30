import type { Metadata } from "next";
import { AppNavLinks } from "@/components/AppNavLinks";
import { BucketDisplayProvider } from "@/components/BucketDisplayProvider";
import { BucketDisplayToggle } from "@/components/BucketDisplayToggle";
import { EpicProgressProvider } from "@/components/EpicProgressProvider";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { HomeResetButton } from "@/components/HomeResetButton";
import { InstallPromptBanner } from "@/components/InstallPromptBanner";
import { ItemPreviewProvider } from "@/components/ItemPreviewProvider";
import { ItemPreviewToggle } from "@/components/ItemPreviewToggle";
import { ServerProvider } from "@/components/ServerProvider";
import { ServerStatusBadge } from "@/components/ServerStatusBadge";
import { ServerToggle } from "@/components/ServerToggle";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const saved = localStorage.getItem("frostreaver-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const url = new URL(location.href);
    const param = url.searchParams.get("server");
    const valid = ["frostreaver","teek","mischief"];
    const saved = localStorage.getItem("frostreaver-server");
    const server = valid.includes(param) ? param : (valid.includes(saved) ? saved : "frostreaver");
    document.documentElement.dataset.server = server;
  } catch { document.documentElement.dataset.server = "frostreaver"; }
})();`,
          }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2d6a4f" />
      </head>
      <body>
        <ServerProvider>
          <FavoritesProvider>
            <BucketDisplayProvider>
              <EpicProgressProvider>
                <ItemPreviewProvider>
                  <nav className="app-nav" aria-label="Primary navigation">
                    <AppNavLinks />
                    <div className="app-nav-controls">
                      <HomeResetButton />
                      <ServerStatusBadge />
                      <ServerToggle />
                      <BucketDisplayToggle />
                      <ItemPreviewToggle />
                      <ThemeToggle />
                    </div>
                  </nav>
                  {children}
                </ItemPreviewProvider>
              </EpicProgressProvider>
            </BucketDisplayProvider>
          </FavoritesProvider>
        </ServerProvider>
        <ServiceWorkerRegistration />
        <InstallPromptBanner />
      </body>
    </html>
  );
}
