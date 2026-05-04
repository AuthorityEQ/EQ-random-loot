"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ExpansionTimeline } from "@/components/ExpansionTimeline";

type NavSection = "frostreaver" | "normal-tlp";

const links = [
  { href: "/", label: "Frostreaver", section: "frostreaver" },
  { href: "/normal-tlp", label: "Normal TLP", section: "normal-tlp" },
] as const satisfies Array<{ href: string; label: string; section: NavSection }>;

const showNormalTlpNavigation = false;

const frostreaverLinks = [
  { href: "/loot", label: "Group" },
  { href: "/raids", label: "Raid" },
  { href: "/spells", label: "Spells" },
  { href: "/epics", label: "Epics" },
  { href: "/crafting", label: "Crafting" },
  { href: "/factions", label: "Factions" },
  { href: "/characters", label: "My Characters" },
];

const normalTlpLinks = [
  { href: "/normal-loot", label: "Search" },
  { href: "/spells", label: "Spells" },
  { href: "/epics", label: "Epics" },
  { href: "/crafting", label: "Crafting" },
  { href: "/factions", label: "Factions" },
];

const navSectionStorageKey = "site-mode";
const navSectionEventName = "loot-goblin:active-nav-change";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getStoredSection(): NavSection {
  if (typeof window === "undefined") return "frostreaver";
  const stored = window.localStorage.getItem(navSectionStorageKey);
  if (showNormalTlpNavigation && stored === "normal-tlp") return "normal-tlp";
  return "frostreaver";
}

function saveSection(section: NavSection) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(navSectionStorageKey, section);
  window.dispatchEvent(new CustomEvent<NavSection>(navSectionEventName, { detail: section }));
}

function useActiveNavSection() {
  const [activeSection, setActiveSection] = useState<NavSection>("frostreaver");

  useEffect(() => {
    setActiveSection(getStoredSection());

    function handleSectionChange(event: Event) {
      const nextSection = event instanceof CustomEvent ? event.detail : null;
      if (nextSection === "frostreaver" || (showNormalTlpNavigation && nextSection === "normal-tlp")) {
        setActiveSection(nextSection);
      }
    }

    window.addEventListener(navSectionEventName, handleSectionChange);
    return () => window.removeEventListener(navSectionEventName, handleSectionChange);
  }, []);

  return activeSection;
}

export function AppNavLinks() {
  const activeSection = useActiveNavSection();

  return (
    <div className="app-nav-links">
      {links
        .filter((link) => showNormalTlpNavigation || link.section !== "normal-tlp")
        .map((link) => (
          <Link
            className={activeSection === link.section ? "is-active" : undefined}
            href={link.href}
            key={link.href}
            onClick={() => saveSection(link.section)}
          >
            {link.label}
          </Link>
        ))}
    </div>
  );
}

export function AppSubNavLinks() {
  const pathname = usePathname();
  const activeSection = useActiveNavSection();
  const showNormalTlpSubNav = showNormalTlpNavigation && activeSection === "normal-tlp";
  const subNavLinks = showNormalTlpSubNav ? normalTlpLinks : frostreaverLinks;
  const navLabel = showNormalTlpSubNav ? "Normal TLP navigation" : "Frostreaver navigation";

  return (
    <nav className="app-sub-nav" aria-label={navLabel}>
      <div className="app-sub-nav-links">
        {subNavLinks.map((link) => (
          <Link
            className={isActive(pathname, link.href) ? "is-active" : undefined}
            href={link.href}
            key={link.href}
            onClick={() => saveSection(activeSection)}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="app-sub-nav-countdown">
        <ExpansionTimeline compact />
      </div>
    </nav>
  );
}
