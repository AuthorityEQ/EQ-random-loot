import type { Metadata } from "next";
import Link from "next/link";
import { BucketDisplayProvider } from "@/components/BucketDisplayProvider";
import { BucketDisplayToggle } from "@/components/BucketDisplayToggle";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import { HomeResetButton } from "@/components/HomeResetButton";
import { ItemPreviewProvider } from "@/components/ItemPreviewProvider";
import { ItemPreviewToggle } from "@/components/ItemPreviewToggle";
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
      </head>
      <body>
        <FavoritesProvider>
          <BucketDisplayProvider>
            <ItemPreviewProvider>
              <nav className="app-nav" aria-label="Primary navigation">
                <div className="app-nav-links">
                  <Link href="/">Group Named</Link>
                  <Link href="/raids">Raid Bosses</Link>
                  <Link href="/favorites">Favorites</Link>
                </div>
                <div className="app-nav-controls">
                  <HomeResetButton />
                  <BucketDisplayToggle />
                  <ItemPreviewToggle />
                  <ThemeToggle />
                </div>
              </nav>
              {children}
            </ItemPreviewProvider>
          </BucketDisplayProvider>
        </FavoritesProvider>
      </body>
    </html>
  );
}
