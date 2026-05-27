"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { CinematicOrb, getTimeTheme, TIME_THEME_COLORS } from "@/components/cinematic-orb";

type PwaOrbViewProps = {
  companionName: string;
  licenseKey: string;
  scriptUrl: string;
  apiBase: string;
  mood: string;
};

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

export function PwaOrbView({ companionName, licenseKey, scriptUrl, apiBase, mood }: PwaOrbViewProps) {
  const theme = getTimeTheme();
  const colors = TIME_THEME_COLORS[theme];
  const searchParams = useSearchParams();
  const autoInstall = searchParams.get("autoInstall") === "true";
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installState, setInstallState] = useState<"idle" | "prompted" | "installed">("idle");

  const isIos = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional */
    });
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPrompt);
    };
    const onInstalled = () => setInstallState("installed");
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!autoInstall) return;
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ("install" in navigator && typeof (navigator as Navigator & { install?: () => Promise<void> }).install === "function") {
      (navigator as Navigator & { install?: () => Promise<void> })
        .install?.()
        .then(() => setInstallState("installed"))
        .catch(() => {
          /* browser rejected */
        });
      return;
    }
    if (deferredPrompt) {
      deferredPrompt
        .prompt()
        .then(() => deferredPrompt.userChoice)
        .then((choice) => {
          if (choice?.outcome === "accepted") setInstallState("installed");
          setInstallState((s) => (s === "installed" ? s : "prompted"));
        })
        .catch(() => {
          /* no-op */
        });
    }
  }, [autoInstall, deferredPrompt, isIos]);

  const handleInstallClick = async () => {
    if ("install" in navigator && typeof (navigator as Navigator & { install?: () => Promise<void> }).install === "function") {
      try {
        await (navigator as Navigator & { install?: () => Promise<void> }).install?.();
        setInstallState("installed");
        return;
      } catch {
        /* continue fallback */
      }
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setInstallState("installed");
      } else {
        setInstallState("prompted");
      }
      return;
    }
    setShowIosHelp(true);
  };

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
      <button
        type="button"
        onClick={handleInstallClick}
        className="mt-5 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs text-white/90 transition hover:bg-white/15"
      >
        {installState === "installed" ? "Buddy installed" : "Install Buddy"}
      </button>

      {showIosHelp ? (
        <div className="mt-4 max-w-xs rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-left text-xs text-white/70">
          <p className="font-medium text-white/85">iPhone / iPad install</p>
          <ol className="mt-2 space-y-1 list-decimal pl-4">
            <li>Tap the Share icon in Safari.</li>
            <li>Choose &quot;Add to Home Screen&quot;.</li>
            <li>Tap Add — Buddy opens like an app.</li>
          </ol>
        </div>
      ) : null}

      <Link
        href="/dashboard"
        className="mt-10 text-xs text-white/30 underline decoration-white/20 underline-offset-4 hover:text-white/55"
      >
        Open dashboard
      </Link>
    </main>
  );
}
