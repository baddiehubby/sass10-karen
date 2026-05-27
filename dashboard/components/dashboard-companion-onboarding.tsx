"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CHROME_WEB_STORE_URL } from "@/lib/marketing-links";
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

  const pwaUrl = `${getPublicAppBaseUrl()}/pwa`;

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

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "BUDDY_EXTENSION_SYNCED") {
        setExtensionInstalled(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [detectExtension]);

  return (
    <div className="mb-8 w-full space-y-4">
      {extensionInstalled ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100/90">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          Buddy is with you on this browser.
        </div>
      ) : (
        <article className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-violet-500/8 to-indigo-500/10 p-5 text-center shadow-lg shadow-violet-950/20">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-200/70">Your companion</p>
          <h2 className="mt-2 text-lg font-light text-white/90">
            Add Buddy to your browser — see him on every AI chat
          </h2>
          <p className="mt-2 text-sm font-light text-white/50">
            One tap after install. Buddy follows you on ChatGPT, Claude, and Gemini — like a pet that never
            leaves your side.
          </p>
          <a
            href={CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/15"
          >
            Install extension
          </a>
        </article>
      )}

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
            href="/pwa"
            className="text-xs text-violet-300/90 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-200"
          >
            Open mobile companion
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
