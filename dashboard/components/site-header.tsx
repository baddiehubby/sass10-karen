"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const { status, data: session } = useSession();
  const isAuthed = status === "authenticated";
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-[0.2em] text-indigo-200">
          Buddy AI
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-slate-300 sm:gap-4">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <Link href="/integrations" className="hover:text-white">
            Integrations
          </Link>
          <Link href="/challenge" className="hover:text-white">
            Challenge
          </Link>
          <Link href="/state-of-ai-emotions" className="hidden hover:text-white sm:inline">
            Research
          </Link>
          <Link href="/docs" className="hover:text-white">
            Docs
          </Link>
          <Link href="/blog" className="hover:text-white">
            Blog
          </Link>
          <Link href="/about" className="hover:text-white">
            About
          </Link>
          <Link href="/demo" className="hover:text-white">
            Demo
          </Link>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
          <ThemeToggle />

          {isAuthed ? (
            <>
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              {isAdmin ? (
                <Link href="/dashboard/outreach" className="hover:text-amber-200">
                  Outreach
                </Link>
              ) : null}
              <Link href="/emotional-wellness" className="hover:text-white">
                Wellness
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500">
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
