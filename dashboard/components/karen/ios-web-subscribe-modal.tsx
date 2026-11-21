"use client";

/**
 * iOS Apple-tax gate — steers Meta/TikTok iPhone traffic to Lemon web checkout
 * instead of App Store IAP (saves ~$5 vs Apple's 30% cut).
 */

import { motion } from "framer-motion";
import { ExternalLink, Smartphone } from "lucide-react";

import {
  IOS_APPLE_TAX_BODY,
  IOS_APPLE_TAX_CTA,
  IOS_APPLE_TAX_HEADLINE,
} from "@/lib/karen/ios";

type IosWebSubscribeModalProps = {
  open: boolean;
  pending?: boolean;
  onContinue: () => void;
  onClose: () => void;
};

export function IosWebSubscribeModal({
  open,
  pending = false,
  onContinue,
  onClose,
}: IosWebSubscribeModalProps) {
  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-web-subscribe-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md rounded-3xl border border-amber-400/30 bg-gradient-to-b from-[#1a0a10] to-black p-6 shadow-[0_0_60px_rgba(255,45,85,0.35)]"
      >
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40">
          <Smartphone className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-300/90">
          iPhone · Web checkout
        </p>
        <h2
          id="ios-web-subscribe-title"
          className="mt-2 text-2xl font-black uppercase tracking-tight text-white"
        >
          {IOS_APPLE_TAX_HEADLINE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-rose-50/95">
          {IOS_APPLE_TAX_BODY}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onContinue}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff4d6d] px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_28px_rgba(255,45,85,0.5)] disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            {pending ? "Opening secure checkout…" : IOS_APPLE_TAX_CTA}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Not now
          </button>
        </div>
      </motion.div>
    </div>
  );
}
