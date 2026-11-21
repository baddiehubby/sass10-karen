"use client";

/**
 * Android one-click PWA install — captures `beforeinstallprompt`,
 * suppresses the mini-infobar, and shows "📲 INSTALL KAREN".
 * iOS has no beforeinstallprompt; see ios-install-banner + apple meta tags.
 */

import { useCallback, useEffect, useState } from "react";

import {
  isPwaInstalled,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-install";

const DISMISS_KEY = "karen.installPrompt.dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPwaInstalled()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* private mode */
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt || busy) return;
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setVisible(false);
        try {
          window.localStorage.setItem(DISMISS_KEY, "1");
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn("[InstallPrompt] prompt failed", err);
    } finally {
      setDeferredPrompt(null);
      setBusy(false);
    }
  }, [busy, deferredPrompt]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex justify-center px-4"
      data-karen-install-prompt=""
    >
      <div className="flex w-full max-w-sm items-center gap-2 rounded-2xl border border-[#ff2d55]/45 bg-black/90 p-2.5 shadow-[0_0_40px_rgba(255,45,85,0.35)] backdrop-blur-md">
        <button
          type="button"
          disabled={busy}
          onClick={() => void install()}
          className="flex-1 rounded-xl bg-gradient-to-r from-[#ff1a3c] via-[#ff2d55] to-[#ff4d6d] px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_24px_rgba(255,45,85,0.5)] disabled:opacity-60"
        >
          {busy ? "Installing…" : "📲 INSTALL KAREN"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded-xl px-3 py-3 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-300"
        >
          Later
        </button>
      </div>
    </div>
  );
}
