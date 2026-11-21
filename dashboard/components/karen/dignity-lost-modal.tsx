"use client";

/**
 * Dignity → 0% — blur the fight and force the $19 rematch paywall.
 */

import { motion } from "framer-motion";
import { Skull } from "lucide-react";

import { KAREN_UNLOCK_CTA, KAREN_VIP_PRICE_LABEL } from "@/lib/karen/vip";

export const DIGNITY_LOST_MESSAGE =
  "You lost. Pay $19 to try and win tomorrow.";

type DignityLostModalProps = {
  open: boolean;
  pending?: boolean;
  onPay: () => void;
  onClose?: () => void;
};

export function DignityLostModal({
  open,
  pending = false,
  onPay,
  onClose,
}: DignityLostModalProps) {
  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[92] flex items-end justify-center bg-black/75 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dignity-lost-title"
      data-karen-dignity-lost=""
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 20 }}
        className="w-full max-w-md rounded-3xl border border-red-500/50 bg-gradient-to-b from-[#2a0610] to-black p-6 shadow-[0_0_80px_rgba(255,0,40,0.45)]"
      >
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/25 text-red-200 ring-1 ring-red-400/50">
          <Skull className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-red-400">
          Dignity: 0%
        </p>
        <h2
          id="dignity-lost-title"
          className="mt-2 text-2xl font-black uppercase tracking-tight text-white"
        >
          You lost.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-rose-100/95">
          {DIGNITY_LOST_MESSAGE}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={onPay}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_32px_rgba(255,45,85,0.55)] disabled:opacity-50"
        >
          {pending ? "Opening checkout…" : KAREN_UNLOCK_CTA}
        </button>
        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          {KAREN_VIP_PRICE_LABEL} · rematch tomorrow
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Stay destroyed
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}
