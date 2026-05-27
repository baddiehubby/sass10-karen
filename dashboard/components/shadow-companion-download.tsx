"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CHROME_EXTENSION_DOWNLOAD_URL,
  DESKTOP_COMPANION_MAC_URL,
  DESKTOP_COMPANION_WIN_URL,
} from "@/lib/marketing-links";

type ShadowCompanionDownloadProps = {
  isAdmin?: boolean;
};

export function ShadowCompanionDownload({ isAdmin = false }: ShadowCompanionDownloadProps) {
  const platform = useMemo(() => {
    if (typeof navigator === "undefined") return "unknown";
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) return "mac";
    if (ua.includes("win")) return "win";
    return "unknown";
  }, []);

  const desktopHref =
    platform === "mac" ? DESKTOP_COMPANION_MAC_URL : DESKTOP_COMPANION_WIN_URL;

  return (
    <section className="mt-8 w-full rounded-2xl border border-violet-500/20 bg-violet-950/20 p-5 text-left">
      <p className="text-xs uppercase tracking-[0.22em] text-violet-300/70">Shadow Companion</p>
      <h2 className="mt-1 text-base font-medium text-white/90">Follow Buddy everywhere</h2>
      <p className="mt-2 text-xs font-light leading-relaxed text-white/50">
        Desktop overlay above every app, PWA background check-ins, mobile home screen, and the Chrome extension —
        mood stays on-device; only labels sync when you consent.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={desktopHref}
          className="inline-flex rounded-full border border-violet-400/35 bg-violet-600/25 px-4 py-2 text-xs font-medium text-violet-100"
        >
          Download Desktop Companion
        </a>
        {platform === "unknown" ? (
          <a
            href={DESKTOP_COMPANION_MAC_URL}
            className="inline-flex rounded-full border border-white/15 px-4 py-2 text-xs text-white/70"
          >
            Mac build
          </a>
        ) : null}
        <Link
          href="/dashboard/settings"
          className="inline-flex rounded-full border border-white/15 px-4 py-2 text-xs text-white/70"
        >
          Privacy &amp; consent
        </Link>
        <a
          href={CHROME_EXTENSION_DOWNLOAD_URL}
          className="inline-flex rounded-full border border-white/15 px-4 py-2 text-xs text-white/70"
        >
          Chrome extension
        </a>
        {isAdmin ? (
          <Link
            href="/debiopwr"
            className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100"
          >
            Debiopwr
          </Link>
        ) : null}
      </div>
    </section>
  );
}
