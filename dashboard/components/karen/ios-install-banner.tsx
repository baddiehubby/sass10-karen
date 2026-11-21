"use client";

/**
 * iOS home-screen install tip — Safari has no beforeinstallprompt.
 * Shown only at the Lemon Squeezy paywall (not on page load).
 */

import { useEffect, useState } from "react";

import { isIOSDevice } from "@/lib/karen/ios";

const STORAGE_KEY = "sass10.iosInstallBanner.dismissed";

export const PWA_PAYWALL_INSTALL_COPY =
  "Enjoying the fight? Add SASS10 to your home screen for the full-screen experience.";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)");
  if (mq?.matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

/** Minimal iOS Share glyph (box + up arrow). */
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

type IosInstallBannerProps = {
  /** When true, evaluate visibility (paywall open). Default false = never show on load. */
  active?: boolean;
  /** Inline tip inside a modal instead of a fixed bottom banner. */
  embedded?: boolean;
  copy?: string;
};

/**
 * Paywall-only PWA tip. Pass `active` when the Lemon VIP modal opens.
 * Does not block the screen — sits as a soft tip under the paywall CTAs.
 */
export function IosInstallBanner({
  active = false,
  embedded = false,
  copy = PWA_PAYWALL_INSTALL_COPY,
}: IosInstallBannerProps = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    try {
      if (!isIOSDevice()) return;
      if (isStandaloneDisplay()) return;
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
      setVisible(true);
    } catch {
      if (isIOSDevice() && !isStandaloneDisplay()) setVisible(true);
    }
  }, [active]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (embedded) {
    return (
      <div
        role="status"
        className="mt-4 rounded-2xl border border-white/10 bg-black/50 px-3.5 py-3 text-left"
        data-karen-pwa-paywall-tip=""
      >
        <p className="text-[13px] leading-snug text-white/90">
          {copy}{" "}
          <span className="inline-flex translate-y-[3px] items-center text-[#ff2d55]">
            <ShareIcon className="inline-block" />
            <span className="sr-only">Share</span>
          </span>{" "}
          → Add to Home Screen.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 text-[11px] font-medium uppercase tracking-wide text-white/45 transition hover:text-white/80"
          aria-label="Dismiss install tip"
        >
          Got it
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div
        className="mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-white/10 bg-black/90 px-3.5 py-3 text-left shadow-[0_-8px_40px_rgba(255,45,85,0.18)] backdrop-blur-md"
        style={{
          boxShadow:
            "0 -8px 40px rgba(255,45,85,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <p className="flex-1 text-[13px] leading-snug text-white/90">{copy}</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/45 transition hover:bg-white/10 hover:text-white/80"
          aria-label="Dismiss install tip"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
