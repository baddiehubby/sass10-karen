"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Send, X } from "lucide-react";

import {
  getSmackBack,
  SMACK_BACK_COOLDOWN_MS,
  SMACK_BACK_PROCESS_MS,
  type SmackBackResult,
} from "@/lib/karen/smack-back";
import { playAnswerClick } from "@/lib/karen/sfx";

type SmackBackPanelProps = {
  disabled?: boolean;
  /** VIP: skip the 10s one-shot lockout. */
  unlimited?: boolean;
  /** overlay = floating over interrogation; inline = dashboard arena card. */
  layout?: "overlay" | "inline";
  cooldownUntil: number;
  onCooldown: (until: number) => void;
  onSmack: (result: SmackBackResult) => void | Promise<void>;
};

/**
 * Talk Back — glassmorphic smack input.
 * Free: one-shot + 10s lockout. VIP (`unlimited`): no cooldown.
 */
export function SmackBackPanel({
  disabled = false,
  unlimited = false,
  layout = "overlay",
  cooldownUntil,
  onCooldown,
  onSmack,
}: SmackBackPanelProps) {
  const [open, setOpen] = useState(layout === "inline");
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (unlimited || cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil, unlimited]);

  const cooling = !unlimited && cooldownUntil > now;
  const coolLeftSec = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const locked = disabled || processing || cooling;

  const submit = useCallback(async () => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || locked) return;

    playAnswerClick();
    setProcessing(true);
    await new Promise<void>((r) => window.setTimeout(r, SMACK_BACK_PROCESS_MS));

    const result = getSmackBack(clean);
    await onSmack(result);

    setText("");
    if (layout === "overlay") setOpen(false);
    setProcessing(false);
    if (!unlimited) {
      onCooldown(Date.now() + SMACK_BACK_COOLDOWN_MS);
    }
  }, [layout, locked, onCooldown, onSmack, text, unlimited]);

  const sheet = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="smack-sheet"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="w-full overflow-hidden rounded-2xl border border-white/20 bg-black/55 p-3 shadow-[0_0_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        >
          {processing ? (
            <p className="karen-hud py-4 text-center text-xs uppercase tracking-[0.22em] text-red-300">
              Karen is processing your disrespect…
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="karen-hud-quiet text-[10px] font-semibold uppercase tracking-[0.28em] text-rose-300/90">
                  {unlimited ? "Unlimited smack back" : "Talk back"}
                </p>
                {layout === "overlay" ? (
                  <button
                    type="button"
                    aria-label="Close talk back"
                    onClick={() => {
                      playAnswerClick();
                      setOpen(false);
                    }}
                    className="rounded-full border border-white/15 p-1 text-zinc-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-stretch gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  maxLength={180}
                  placeholder="Say it to my face..."
                  disabled={locked}
                  className="karen-hud min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-red-400/50 disabled:opacity-50"
                  autoFocus={layout === "overlay"}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  disabled={!text.trim() || locked}
                  onClick={() => void submit()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] px-3.5 text-xs font-black uppercase tracking-wide text-white disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </motion.button>
              </div>
            </>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (layout === "inline") {
    return <div className="w-full">{sheet}</div>;
  }

  return (
    <div className="pointer-events-auto absolute bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+6.5rem))] left-3 right-3 z-30 mx-auto flex max-w-lg flex-col items-end gap-2">
      {sheet}

      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        disabled={locked && !open}
        onClick={() => {
          if (cooling) return;
          playAnswerClick();
          setOpen((v) => !v);
        }}
        className={
          cooling
            ? "karen-hud-quiet inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500"
            : "karen-hud inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-100 shadow-[0_0_20px_rgba(255,45,85,0.25)]"
        }
        aria-label="Talk Back"
      >
        <Mic className="h-3.5 w-3.5" />
        {cooling
          ? `Lockout ${coolLeftSec}s`
          : unlimited
            ? "Talk Back · VIP"
            : "Talk Back"}
      </motion.button>
    </div>
  );
}
