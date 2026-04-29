import type { Metadata } from "next";
import Link from "next/link";
import { EpicProgressProvider } from "@/components/EpicProgressProvider";
import { FavoritesProvider } from "@/components/FavoritesProvider";
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
  title: "Frostreaver Loot Buckets",
  description: "Classic Group Named random loot bucket analysis for EverQuest Frostreaver.",
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
            <EpicProgressProvider>
              <ItemPreviewProvider>
                <nav className="app-nav" aria-label="Primary navigation">
                  <div className="app-nav-links">
                    <Link href="/">Group Named</Link>
                    <Link href="/raids">Raid Bosses</Link>
                    <Link href="/favorites">Favorites</Link>
                    <Link href="/factions">Factions</Link>
                    <Link href="/epics">Epic Quests</Link>
                    <Link href="/crafting">Crafting</Link>
                  </div>
                  <div className="app-nav-controls">
                    <ServerStatusBadge />
                    <ServerToggle />
                    <ItemPreviewToggle />
                    <ThemeToggle />
                  </div>
                </nav>
                {children}
              </ItemPreviewProvider>
            </EpicProgressProvider>
          </FavoritesProvider>
        </ServerProvider>
        <ServiceWorkerRegistration />
        <InstallPromptBanner />
      </body>
    </html>
  );
}
