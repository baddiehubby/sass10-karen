"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryNav = [
  { href: "/dashboard", label: "Home", match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/analytics", label: "Analytics", match: (p: string) => p.startsWith("/dashboard/analytics") },
  { href: "/dashboard/settings", label: "Settings", match: (p: string) => p.startsWith("/dashboard/settings") },
] as const;

const moreLinks = [
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/collab", label: "Collab" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/audit-log", label: "Audit Log" },
  { href: "/emotional-wellness", label: "Emotional Wellness" },
] as const;

function navClass(active: boolean) {
  return active
    ? "rounded-lg bg-indigo-600/20 px-3 py-2 text-sm font-medium text-indigo-100 ring-1 ring-indigo-500/40"
    : "rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white";
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreLinks.some((l) => pathname.startsWith(l.href));

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-8 lg:px-6">
        <aside className="hidden w-52 shrink-0 lg:block">
          <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Command center</p>
          <nav className="mt-4 space-y-1">
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item.match(pathname))}>
                {item.label}
              </Link>
            ))}
            <div className="relative pt-2">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={navClass(moreActive)}
              >
                More ▾
              </button>
              {moreOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-white/10 bg-slate-950/95 p-1 shadow-xl backdrop-blur">
                  {moreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <nav className="mb-6 flex flex-wrap gap-2 lg:hidden">
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item.match(pathname))}>
                {item.label}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>

      <Link
        href="/pricing"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-500 hover:to-violet-500"
      >
        Upgrade
      </Link>
    </div>
  );
}
