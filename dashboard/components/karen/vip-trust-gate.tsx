"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { dispatchKarenExpression } from "@/lib/karen/talkinghead-bus";
import {
  getCombatPreloadUrls,
  getKarenAudioContext,
  preloadAudio,
  preloadFallbackBrutalAudio,
  unlockAudio,
  unlockKarenAudioAndMic,
} from "@/lib/karen/voice";
import { VIP_TRUST_WELCOME_LINE } from "@/lib/karen/vip-trust";

type VipTrustGateProps = {
  onEnter: () => void;
};

/**
 * Soft gold/black VIP Trust welcome — validates the user before the trap.
 * Not the aggressive ENTER THE ROAST gate.
 */
export function VipTrustGate({ onEnter }: VipTrustGateProps) {
  const [busy, setBusy] = useState(false);

  // Soft [PROUD]/[SWEET] face while the luxurious gate is up.
  useEffect(() => {
    dispatchKarenExpression({
      mood: "PROUD",
      text: VIP_TRUST_WELCOME_LINE,
      lipSync: false,
      isSpeaking: false,
      trait: "chaos",
    });
  }, []);

  async function enter() {
    if (busy) return;
    setBusy(true);
    try {
      const ctx = await unlockAudio();
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
      void unlockKarenAudioAndMic();
      void preloadFallbackBrutalAudio({ audioContext: ctx }).catch(() => undefined);
      void preloadAudio(getCombatPreloadUrls(20), { audioContext: ctx }).catch(
        () => undefined,
      );
      onEnter();
    } catch (err) {
      console.warn("[VipTrustGate] unlock failed", err);
      setBusy(false);
    }
  }

  return (
    <div
      className="pointer-events-none relative z-30 karen-vh w-screen overflow-hidden text-center"
      style={{
        background:
          "radial-gradient(ellipse 80% 55% at 50% 20%, rgba(212,175,55,0.18) 0%, transparent 55%), radial-gradient(ellipse at bottom, rgba(20,14,6,0.95) 0%, #050505 70%)",
      }}
      data-karen-vip-trust-gate=""
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212,175,55,0.35) 2px, rgba(212,175,55,0.35) 3px)",
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-12 z-30 flex w-full flex-col items-center gap-3 px-6"
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#d4af37]"
          style={{ textShadow: "0 0 18px rgba(212,175,55,0.55)" }}
        >
          Private invitation
        </p>
        <h1
          className="max-w-[14ch] text-[clamp(2.2rem,8vw,3.6rem)] font-black uppercase leading-[0.95] tracking-tight text-[#f5e6a3]"
          style={{
            textShadow:
              "0 0 28px rgba(212,175,55,0.45), 0 2px 0 rgba(0,0,0,0.8)",
          }}
        >
          You were
          <br />
          selected.
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#c4b896]/90">
          {VIP_TRUST_WELCOME_LINE}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col items-center gap-3 px-6 pb-[max(3rem,env(safe-area-inset-bottom))]"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#8a7a4a]">
          Soft lights. Real standards.
        </p>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          disabled={busy}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            void unlockAudio();
          }}
          onClick={() => void enter()}
          className="pointer-events-auto inline-flex items-center justify-center rounded-full border border-[#d4af37]/60 bg-gradient-to-r from-[#3a2e14] via-[#d4af37] to-[#3a2e14] px-10 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#1a1408] shadow-[0_0_40px_rgba(212,175,55,0.45)] outline-none focus:ring-4 focus:ring-[#d4af37]/35 disabled:opacity-60"
        >
          {busy ? "Opening the door…" : "Accept VIP Access"}
        </motion.button>
      </motion.div>
    </div>
  );
}
