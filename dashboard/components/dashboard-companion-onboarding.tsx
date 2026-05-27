"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getPublicAppBaseUrl } from "@/lib/site-url";

declare global {
  interface Window {
    __buddyExtensionInstalled?: boolean;
  }
}

type DashboardCompanionOnboardingProps = {
  licenseKey: string | null;
};

export function DashboardCompanionOnboarding({ licenseKey }: DashboardCompanionOnboardingProps) {
  // Check synchronously on first render — the bridge script runs at document_idle so the flag
  // is already set by the time React hydrates. No polling or artificial delay needed.
  const [extensionInstalled, setExtensionInstalled] = useState(
    () => typeof window !== "undefined" && window.__buddyExtensionInstalled === true,
  );
  const [pwaInstalled, setPwaInstalled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches,
  );
  const [iosHelp, setIosHelp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);

  const pwaUrl = `${getPublicAppBaseUrl()}/pwa?autoInstall=true`;
  const extensionDownloadUrl = "/api/download/buddy-extension";

  const detectExtension = useCallback(() => {
    if (typeof window !== "undefined" && window.__buddyExtensionInstalled === true) {
      setExtensionInstalled(true);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Re-check once after mount in case the content script set the flag after SSR hydration.
    detectExtension();
    const displayMode = window.matchMedia("(display-mode: standalone)");
    setPwaInstalled(displayMode.matches);
    const onDisplayModeChange = (event: MediaQueryListEvent) => setPwaInstalled(event.matches);
    displayMode.addEventListener("change", onDisplayModeChange);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "BUDDY_EXTENSION_SYNCED") {
        setExtensionInstalled(true);
      }
    };
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as Event & { prompt: () => Promise<void> });
    };
    const onInstalled = () => setPwaInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("message", onMessage);
    if (displayMode.matches && window.location.pathname.startsWith("/dashboard")) {
      window.location.replace("/pwa");
    }
    return () => {
      displayMode.removeEventListener("change", onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("message", onMessage);
    };
  }, [detectExtension]);

  const installPwa = async () => {
    const navInstall = (navigator as Navigator & { install?: () => Promise<void> }).install;
    if (typeof navInstall === "function") {
      try {
        await navInstall.call(navigator);
        setPwaInstalled(true);
        return;
      } catch {
        /* fallback */
      }
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      return;
    }
    setIosHelp(true);
  };

  return (
    <div className="mb-8 w-full space-y-4">
      {extensionInstalled ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100/90">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          Buddy is with you on this browser.
        </div>
      ) : (
        <article className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-violet-500/8 to-indigo-500/10 p-5 shadow-lg shadow-violet-950/20">
          <p className="text-center text-xs uppercase tracking-[0.22em] text-amber-200/70">Your Buddy is ready</p>
          <h2 className="mt-2 text-center text-lg font-light text-white/90">Take him with you everywhere</h2>
          <p className="mt-2 text-center text-sm font-light text-white/50">
            Install as an app, or add to Chrome with a direct download. No store redirect, no embed code.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={installPwa}
              className="inline-flex rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/15"
            >
              Install as app
            </button>
            <a
              href={extensionDownloadUrl}
              className="inline-flex rounded-full border border-white/20 bg-black/20 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/35 hover:bg-black/30"
            >
              Add to Chrome
            </a>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/70">
            <p className="font-medium text-white/85">Add Buddy to Chrome in 2 steps</p>
            <p className="mt-1">1) Open chrome://extensions and toggle Developer mode ON.</p>
            <p className="mt-1">2) Drag the downloaded .crx file onto that page.</p>
          </div>
          {iosHelp ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/70">
              <p className="font-medium text-white/85">iPhone/iPad install</p>
              <p className="mt-1">Tap Share in Safari → Add to Home Screen.</p>
            </div>
          ) : null}
        </article>
      )}

      {pwaInstalled ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/8 px-4 py-3 text-sm text-sky-100/90">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
          Buddy app is installed on this device.
        </div>
      ) : null}

      <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h3 className="text-center text-sm font-medium text-white/75">Take Buddy on your phone</h3>
        <p className="mt-1 text-center text-xs font-light text-white/40">
          Scan to open your pocket companion. Add to Home Screen for a full-screen orb — one tap away.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={pwaUrl} size={148} level="M" includeMargin />
          </div>
          <Link
            href="/pwa?autoInstall=true"
            className="text-xs text-violet-300/90 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-200"
          >
            Open install page
          </Link>
          {licenseKey ? (
            <p className="max-w-xs text-center font-mono text-[10px] text-white/25">
              Signed in on this device — your license syncs automatically.
            </p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
