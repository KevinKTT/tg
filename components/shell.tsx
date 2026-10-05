"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AthleteRow } from "@/lib/db";
import { AthleteProvider, AthleteSwitch } from "./athlete";
import { AthleteGate } from "./athlete-gate";
import { ClockBar, ClockProvider } from "./clock";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/board", label: "Board" },
  { href: "/prs", label: "PRs" },
  { href: "/equipment", label: "Equipment" },
  { href: "/members", label: "Members" },
];

const SETTINGS = [
  { href: "/equipment", label: "Gear", icon: "Equipment" },
  { href: "/members", label: "Members", icon: "Members" },
];

function on(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/calendar") return pathname.startsWith("/calendar") || pathname.startsWith("/workout");
  return pathname.startsWith(href);
}

export function Shell({ children, owned, members }: { children: React.ReactNode; owned: number; members: AthleteRow[] }) {
  return (
    <AthleteProvider members={members}>
      <ClockProvider>
        <Frame owned={owned}>{children}</Frame>
      </ClockProvider>
      <AthleteGate />
    </AthleteProvider>
  );
}

function Frame({ children, owned }: { children: React.ReactNode; owned: number }) {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const settingsOpen = menuPath === pathname;
  const settingsOn = SETTINGS.some((link) => pathname.startsWith(link.href));

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuPath(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  return (
    <>
      <div className="shell">
        <div className="top-stack">
          <header className="topbar">
            <Link href="/" className="logo" aria-label="the garage">
              tg
            </Link>
            <span className="word">the garage</span>
            <AthleteSwitch className="desktop-switch" />
            <nav className="top-nav" aria-label="Primary">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} data-on={on(pathname, link.href)}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <AthleteSwitch />
          </header>
          <ClockBar />
        </div>
        {owned === 0 && pathname !== "/equipment" ? (
          <Link href="/equipment" className="banner">
            Mark what you own in Equipment before generating workouts.
          </Link>
        ) : null}
        {children}
      </div>
      <nav className="bottom-nav" aria-label="Primary">
        {LINKS.slice(0, 4).map((link) => (
          <Link key={link.href} href={link.href} data-on={on(pathname, link.href)}>
            <NavIcon name={link.label} />
            {link.label}
          </Link>
        ))}
        <div className="nav-more">
          {settingsOpen ? (
            <div className="settings-menu" role="menu">
              {SETTINGS.map((link) => (
                <Link key={link.href} href={link.href} role="menuitem" data-on={on(pathname, link.href)}>
                  <NavIcon name={link.icon} />
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            data-on={settingsOn || settingsOpen}
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
            onClick={() => setMenuPath((current) => (current === pathname ? null : pathname))}
          >
            <NavIcon name="Settings" />
            Settings
          </button>
        </div>
      </nav>
      {settingsOpen ? (
        <button className="settings-backdrop" type="button" aria-label="Close settings" onClick={() => setMenuPath(null)} />
      ) : null}
    </>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (name === "Today") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }
  if (name === "Calendar") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }
  if (name === "Board") {
    return (
      <svg {...common}>
        <path d="M5 19V10M12 19V5M19 19v-7" />
      </svg>
    );
  }
  if (name === "PRs") {
    return (
      <svg {...common}>
        <path d="M7 17l4-8 3 5 3-7" />
      </svg>
    );
  }
  if (name === "Members") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5M16 11a3 3 0 100-6M15 15c2.8 0 5 2.2 5 5" />
      </svg>
    );
  }
  if (name === "Settings") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 8h16M7 8V6h10v2M6 8l1 12h10l1-12" />
    </svg>
  );
}
