"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const PRIMARY = [
  { href: "/dashboard", label: "Home", match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/garden", label: "Garden", match: (p: string) => p.startsWith("/dashboard/garden") || p.startsWith("/dashboard/mood") || p.startsWith("/dashboard/oracle") },
  { href: "/dashboard/rituals", label: "Rituals", match: (p: string) => p.startsWith("/dashboard/rituals") },
  { href: "/dashboard/moments", label: "Moments", match: (p: string) => p.startsWith("/dashboard/moments") || p.startsWith("/dashboard/memories") || p.startsWith("/dashboard/timeline") },
  { href: "/karen", label: "Karen", match: (p: string) => p === "/karen" || p.startsWith("/karen/") },
  { href: "/dashboard/account", label: "You", match: (p: string) => p.startsWith("/dashboard/account") || p.startsWith("/dashboard/settings") },
] as const;

export function DashboardMinimalNav() {
  const pathname = usePathname();

  return (
    <nav className="buddie-home flex flex-wrap items-center justify-center gap-5 px-4 py-5 text-sm text-white/40">
      {PRIMARY.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-11 px-1 tracking-wide transition ${active ? "text-[#e8c4a0]" : "hover:text-white/75"}`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="min-h-11 px-1 transition hover:text-white/75"
      >
        Leave
      </button>
    </nav>
  );
}
