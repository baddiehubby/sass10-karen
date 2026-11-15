"use client";

import { useState, useTransition } from "react";
import { Crown } from "lucide-react";
import { createKarenVipCheckout } from "@/app/karen/actions";
import {
  KAREN_VIP_MODAL_TITLE,
  KAREN_VIP_PRICE_LABEL,
} from "@/lib/karen/vip";

type KarenPaywallOverlayProps = {
  /** When true, blur the 3D stage and show the glass upgrade card. */
  active: boolean;
};

/**
 * Glassmorphic paywall over the avatar after the free 3-message demo.
 * Upgrade → Lemon Squeezy checkout server action.
 */
export function KarenPaywallOverlay({ active }: KarenPaywallOverlayProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!active) return null;

  function upgrade() {
    setError(null);
    startTransition(async () => {
      const result = await createKarenVipCheckout();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="karen-paywall-title"
    >
      {/* Fully blur the 3D canvas */}
      <div
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-3xl"
        aria-hidden
      />

      <div className="relative w-full max-w-sm rounded-3xl border border-white/25 bg-white/10 p-5 shadow-[0_0_60px_rgba(244,63,94,0.4)] backdrop-blur-2xl sm:p-6">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/40">
          <Crown className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-rose-300">
          Savage Karen · VIP
        </p>
        <h2
          id="karen-paywall-title"
          className="mt-2 text-xl font-bold leading-snug text-white sm:text-2xl"
        >
          {KAREN_VIP_MODAL_TITLE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-rose-50/90">
          Unlock Savage Karen for $19/month.
        </p>
        <p className="mt-3 text-xs text-zinc-300/90">
          Unlimited messages · Sarcasm 10 · Cancel anytime
        </p>
        <p className="mt-2 text-sm font-semibold text-rose-100">{KAREN_VIP_PRICE_LABEL}</p>

        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

        <button
          type="button"
          disabled={pending}
          onClick={upgrade}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#ff2d55] via-rose-600 to-pink-600 px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_32px_rgba(255,45,85,0.55)] disabled:opacity-50"
        >
          {pending ? "Opening Lemon Squeezy…" : "Unlock Savage Karen — $19/mo"}
        </button>
      </div>
    </div>
  );
}
