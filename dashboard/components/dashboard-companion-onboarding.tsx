"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  BROWSER_EXTENSION_ZIP_URL,
  CHROME_EXTENSION_DOWNLOAD_URL,
  DESKTOP_COMPANION_MAC_URL,
  DESKTOP_COMPANION_WIN_URL,
} from "@/lib/marketing-links";
import {
  installPwa,
  isExtensionInstalled,
  isIosSafari,
  isPwaInstalled,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-install";
import { getPublicAppBaseUrl } from "@/lib/site-url";
import { brandingFromHostname } from "@/lib/tenant-brand";

type DashboardCompanionOnboardingProps = {
  licenseKey: string | null;
};

export function DashboardCompanionOnboarding({ licenseKey }: DashboardCompanionOnboardingProps) {
  const brand = brandingFromHostname(typeof window !== "undefined" ? window.location.hostname : "");
  const [extensionInstalled, setExtensionInstalled] = useState(() => isExtensionInstalled());
  const [pwaInstalled, setPwaInstalled] = useState(() => isPwaInstalled());
  const [iosHelp, setIosHelp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const pwaUrl = `${getPublicAppBaseUrl()}/pwa?autoInstall=true`;

  const detectExtension = useCallback(() => {
    if (isExtensionInstalled()) {
      setExtensionInstalled(true);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    detectExtension();
    const displayMode = window.matchMedia("(display-mode: standalone)");
    setPwaInstalled(displayMode.matches || isPwaInstalled());
    const onDisplayModeChange = (event: MediaQueryListEvent) => setPwaInstalled(event.matches);

    const onMessage = (event: MessageEvent) => {
      // Extension sync is chrome-extension:// only — never trust arbitrary web origins.
      const origin = String(event.origin || "");
      if (!origin.startsWith("chrome-extension://") && !origin.startsWith("moz-extension://")) {
        return;
      }
      const data = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const type = (data as { type?: unknown }).type;
      if (type !== "BUDDY_EXTENSION_SYNCED") return;
      setExtensionInstalled(true);
    };
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPwaInstalled(true);

    displayMode.addEventListener("change", onDisplayModeChange);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("message", onMessage);

    return () => {
      displayMode.removeEventListener("change", onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("message", onMessage);
    };
  }, [detectExtension]);

  const handleInstall = async () => {
    const result = await installPwa({ deferredPrompt });
    if (result === "installed") {
      setPwaInstalled(true);
      return;
    }
    if (result === "ios-manual" || isIosSafari()) {
      setIosHelp(true);
    }
  };

  const companionReady = extensionInstalled || pwaInstalled;

  return (
    <div className="mb-8 w-full space-y-4">
      {companionReady ? (
        <div className="luxury-card flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100/90">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          {pwaInstalled && extensionInstalled
            ? `${brand.name} is with you everywhere - app and browser.`
            : pwaInstalled
              ? `${brand.name} is with you everywhere.`
              : `Your ${brand.shortName} is with you on all your conversations.`}
        </div>
      ) : (
        <article className="install-card-pulse luxury-glass luxury-card rounded-2xl border border-amber-400/25 p-5 shadow-lg shadow-violet-950/30">
          <p className="text-center text-xs uppercase tracking-[0.24em] text-amber-200/80">✨ Premium companion</p>
          <h2 className="mt-2 text-center text-lg font-light text-white/95">
            Take {brand.shortName} Everywhere - Instantly
          </h2>
          <p className="mt-2 text-center text-sm font-light text-white/55">
            Install as an app. Your {brand.shortName} appears on every AI chat - ChatGPT, Claude, Gemini - automatically.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="premium-btn-glow inline-flex rounded-full border border-amber-300/30 bg-gradient-to-r from-violet-600/80 to-indigo-600/80 px-6 py-2.5 text-sm font-medium text-white"
            >
              Install {brand.shortName} Now
            </button>
            <a
              href={CHROME_EXTENSION_DOWNLOAD_URL}
              className="premium-btn-glow inline-flex rounded-full border border-white/20 bg-black/25 px-5 py-2.5 text-sm font-medium text-white/90"
            >
              Download for Chrome
            </a>
            <a
              href={DESKTOP_COMPANION_WIN_URL}
              className="premium-btn-glow inline-flex rounded-full border border-violet-400/25 bg-violet-950/40 px-5 py-2.5 text-sm font-medium text-violet-100/90"
            >
              Desktop overlay (Windows)
            </a>
            <a
              href={DESKTOP_COMPANION_MAC_URL}
              className="premium-btn-glow inline-flex rounded-full border border-violet-400/25 bg-violet-950/40 px-5 py-2.5 text-sm font-medium text-violet-100/90"
            >
              Desktop overlay (Mac)
            </a>
          </div>
          <p className="mt-4 text-center text-xs tracking-wide text-white/50">
            Your {brand.shortName} will appear on ChatGPT, Claude, Gemini, and any AI chat - automatically.
          </p>
          <p className="mt-3 text-center text-xs leading-relaxed text-white/45">
            Prefer a browser companion? Use Download for Chrome above.
          </p>
          <details className="mx-auto mt-2 max-w-md text-left text-xs text-white/40">
            <summary className="cursor-pointer text-center text-white/50 hover:text-white/70">
              Advanced install
            </summary>
            <p className="mt-2 leading-relaxed">
              Or{" "}
              <a
                href={BROWSER_EXTENSION_ZIP_URL}
                className="text-[#e8c4a0]/90 underline underline-offset-2"
                download
              >
                download the package
              </a>
              , unzip, then load it as an unpacked extension in your browser&apos;s extension settings.
            </p>
          </details>
          {iosHelp ? (
            <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-xs text-white/75">
              <p className="font-medium text-white/90">Add to Home Screen</p>
              <p className="mt-1">Tap Share → Add to Home Screen.</p>
            </div>
          ) : null}
        </article>
      )}

      <article className="luxury-card rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h3 className="text-center text-sm font-medium text-white/75">Take {brand.shortName} on your phone</h3>
        <p className="mt-1 text-center text-xs font-light text-white/40">
          Scan to open your pocket companion — one tap to install.
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
              Signed in — your license syncs automatically across devices.
            </p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
