"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const PRIMARY = [
  { href: "/dashboard", label: "Buddy", world: "Buddy World" },
  { href: "/dashboard/mood", label: "Mood", world: "Mood Universe" },
  { href: "/dashboard/oracle", label: "Oracle", world: "Oracle Realm" },
] as const;

export function DashboardMinimalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center justify-center gap-6 px-4 py-6 text-sm text-white/40">
      {PRIMARY.map((item) => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-11 px-1 transition ${active ? "text-white" : "hover:text-white/75"}`}
            aria-current={active ? "page" : undefined}
            title={item.world}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/dashboard/settings"
        className={`min-h-11 px-1 transition ${
          pathname.startsWith("/dashboard/settings") ? "text-white/80" : "hover:text-white/75"
        }`}
      >
        Settings
      </Link>
      <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="min-h-11 px-1 transition hover:text-white/75">
        Logout
      </button>
    </nav>
  );
}
