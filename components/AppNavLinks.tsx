"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Group Named" },
  { href: "/raids", label: "Raid Bosses" },
  { href: "/spells", label: "Spells" },
  { href: "/crafting", label: "Crafting" },
  { href: "/factions", label: "Factions" },
  { href: "/epics", label: "Epic Quests" },
  { href: "/favorites", label: "Favorites" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavLinks() {
  const pathname = usePathname();

  return (
    <div className="app-nav-links">
      {links.map((link) => (
        <Link className={isActive(pathname, link.href) ? "is-active" : undefined} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
