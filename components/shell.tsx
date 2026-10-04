"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { AthleteRow } from "@/lib/db";
import { AthleteProvider, AthleteSwitch } from "./athlete";
import { AthleteGate } from "./athlete-gate";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/board", label: "Board" },
  { href: "/prs", label: "PRs" },
  { href: "/equipment", label: "Equipment" },
  { href: "/members", label: "Members" },
];

function on(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/calendar") return pathname.startsWith("/calendar") || pathname.startsWith("/workout");
  return pathname.startsWith(href);
}

export function Shell({ children, owned, members }: { children: React.ReactNode; owned: number; members: AthleteRow[] }) {
  return (
    <AthleteProvider members={members}>
      <Frame owned={owned}>{children}</Frame>
      <AthleteGate />
    </AthleteProvider>
  );
}

function Frame({ children, owned }: { children: React.ReactNode; owned: number }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return (
    <>
      <div className="shell">
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
        {owned === 0 && pathname !== "/equipment" ? (
          <Link href="/equipment" className="banner">
            Mark what you own in Equipment before generating workouts.
          </Link>
        ) : null}
        {children}
      </div>
      <nav className="bottom-nav" aria-label="Primary">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} data-on={on(pathname, link.href)}>
            <NavIcon name={link.label} />
            {link.label === "Equipment" ? "Gear" : link.label}
          </Link>
        ))}
      </nav>
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
  return (
    <svg {...common}>
      <path d="M4 8h16M7 8V6h10v2M6 8l1 12h10l1-12" />
    </svg>
  );
}
