"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function DashboardMinimalNav() {
  return (
    <nav className="flex items-center justify-center gap-8 py-8 text-sm text-white/40">
      <Link href="/dashboard" className="transition hover:text-white/75">
        Home
      </Link>
      <Link href="/dashboard/settings" className="transition hover:text-white/75">
        Settings
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="transition hover:text-white/75"
      >
        Logout
      </button>
    </nav>
  );
}
