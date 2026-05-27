"use client";

import { useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { CinematicOrb, getTimeTheme, TIME_THEME_COLORS } from "@/components/cinematic-orb";

type PwaOrbViewProps = {
  companionName: string;
  licenseKey: string;
  scriptUrl: string;
  apiBase: string;
  mood: string;
};

export function PwaOrbView({ companionName, licenseKey, scriptUrl, apiBase, mood }: PwaOrbViewProps) {
  const theme = getTimeTheme();
  const colors = TIME_THEME_COLORS[theme];

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      /* optional */
    });
  }, []);

  return (
    <main
      className="fixed inset-0 flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center text-white"
      style={{
        background: `#0a0a1a radial-gradient(ellipse 90% 70% at 50% 30%, ${colors.glow} 0%, transparent 65%)`,
      }}
    >
      <Script src={scriptUrl} data-hq-key={licenseKey} data-hq-api={apiBase} strategy="afterInteractive" />

      <p className="absolute top-[max(1rem,env(safe-area-inset-top))] text-xs uppercase tracking-[0.28em] text-white/35">
        {companionName}
      </p>

      <CinematicOrb theme={theme} height="min(52vh, 360px)" breathing />

      <p className="mt-8 max-w-xs text-sm font-light capitalize tracking-wide text-white/60">
        Your Buddy is <span className="text-violet-200/90">{mood}</span>
      </p>
      <p className="mt-2 max-w-xs text-xs font-light text-white/40">
        Add to Home Screen for one-tap companionship — like a pet in your pocket.
      </p>

      <Link
        href="/dashboard"
        className="mt-10 text-xs text-white/30 underline decoration-white/20 underline-offset-4 hover:text-white/55"
      >
        Open dashboard
      </Link>
    </main>
  );
}
