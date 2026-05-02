"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Frostreaver" },
  { href: "/normal-tlp", label: "Normal TLP" },
  { href: "/other", label: "Other" },
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
        <Link
          className={isActive(pathname, link.href) ? "is-active" : undefined}
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
