"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { MIC_PERMISSION_COPY } from "@/lib/karen/mic";
import {
  getCombatPreloadUrls,
  getKarenAudioContext,
  preloadAudio,
  preloadFallbackBrutalAudio,
  unlockAudio,
  unlockKarenAudioAndMic,
} from "@/lib/karen/voice";

type WakeKarenGateProps = {
  onReady: () => void;
};

/**
 * Full-screen gesture unlock — browsers block AudioContext until a tap.
 * ENTER THE ROAST resumes AudioContext AND prompts for the mic in the same gesture.
 */
export function WakeKarenGate({ onReady }: WakeKarenGateProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function wake() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ctx = await unlockAudio();
      // Explicit resume — suspended context = light show without sound.
      if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
        await ctx.resume().catch(() => undefined);
      }
      const shared = getKarenAudioContext();
      if (
        shared.state === "suspended" ||
        (shared.state as string) === "interrupted"
      ) {
        await shared.resume().catch(() => undefined);
      }
      // Mic prompt in the same gesture, but never block the roast on Allow/Deny.
      void unlockKarenAudioAndMic();
      // Fallbacks first (typo/interrupt), then top 20 combat WAVs.
      void preloadFallbackBrutalAudio({ audioContext: ctx }).catch((err) => {
        console.warn("[WakeKarenGate] fallback preload", err);
      });
      void preloadAudio(getCombatPreloadUrls(20), { audioContext: ctx }).catch((err) => {
        console.warn("[WakeKarenGate] preload miss", err);
      });
      onReady();
    } catch (err) {
      console.warn("[WakeKarenGate] unlock failed", err);
      setError(err instanceof Error ? err.message : "Audio unlock failed");
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none relative z-30 karen-vh w-screen overflow-hidden bg-transparent text-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32%] bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-black/85 via-black/35 to-transparent"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-10 z-30 flex w-full flex-col items-center gap-3 px-6"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#d4af37]/90">
          Private channel
        </p>
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#f5e6a3] sm:text-4xl">
          Unlock VIP Audio
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-300">
          {MIC_PERMISSION_COPY}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col items-center gap-3 px-6 pb-[max(3rem,env(safe-area-inset-bottom))]"
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          disabled={busy}
          onPointerDown={(e) => {
            // iOS: unlock + resume AudioContext in the same gesture as ENTER THE ROAST.
            if (e.button !== 0) return;
            void unlockAudio().then(async (ctx) => {
              if (
                ctx.state === "suspended" ||
                (ctx.state as string) === "interrupted"
              ) {
                await ctx.resume().catch(() => undefined);
              }
            });
            void unlockKarenAudioAndMic();
            void wake();
          }}
          onClick={() => {
            void unlockAudio().then(async (ctx) => {
              if (
                ctx.state === "suspended" ||
                (ctx.state as string) === "interrupted"
              ) {
                await ctx.resume().catch(() => undefined);
              }
            });
            void unlockKarenAudioAndMic();
          }}
          className="pointer-events-auto mt-2 inline-flex items-center justify-center rounded-full border border-[#d4af37]/50 bg-gradient-to-r from-[#3a2e14] via-[#d4af37] to-[#3a2e14] px-10 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#1a1408] outline-none focus:ring-4 focus:ring-[#d4af37]/35 shadow-[0_0_32px_rgba(212,175,55,0.45)] disabled:opacity-60"
        >
          {busy ? "Unlocking…" : "Continue"}
        </motion.button>
        {busy ? (
          <p className="pointer-events-none text-xs text-zinc-300">{MIC_PERMISSION_COPY}</p>
        ) : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </motion.div>
    </div>
  );
}
