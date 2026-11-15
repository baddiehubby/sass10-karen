"use client";

import { useState, useTransition } from "react";
import { Crown } from "lucide-react";
import { createKarenVipCheckout, getKarenVipPortalUrl } from "@/app/karen/actions";
import {
  KAREN_VIP_MODAL_TITLE,
  KAREN_VIP_PRICE_LABEL,
  KAREN_VIP_UPGRADE_MESSAGE,
} from "@/lib/karen/vip";

type VipUpgradeModalProps = {
  open: boolean;
  message?: string | null;
  onClose: () => void;
};

/**
 * Glassmorphic paywall — Lemon Squeezy checkout for Karen VIP ($19/mo).
 */
export function VipUpgradeModal({ open, message, onClose }: VipUpgradeModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function subscribe() {
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

  function manage() {
    setError(null);
    startTransition(async () => {
      const result = await getKarenVipPortalUrl();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="karen-vip-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-6 shadow-[0_0_80px_rgba(244,63,94,0.35)] backdrop-blur-md">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/40">
          <Crown className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-rose-300">
          Karen VIP · $19/mo
        </p>
        <h2 id="karen-vip-title" className="mt-2 text-2xl font-bold text-white">
          {KAREN_VIP_MODAL_TITLE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-rose-50/90">
          {message || KAREN_VIP_UPGRADE_MESSAGE}
        </p>
        <ul className="mt-4 space-y-1.5 text-xs text-zinc-300">
          <li>· Unlimited messages</li>
          <li>· Full Sass 10 / savage personality</li>
          <li>· Cancel anytime via Lemon Squeezy</li>
        </ul>
        <p className="mt-3 text-sm font-semibold text-white">{KAREN_VIP_PRICE_LABEL}</p>

        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={subscribe}
            className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_28px_rgba(244,63,94,0.45)] disabled:opacity-50"
          >
            {pending ? "Opening Lemon Squeezy…" : "Subscribe — $19/mo"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={manage}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 disabled:opacity-50"
          >
            Manage Subscription
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2 text-xs text-slate-400 hover:text-slate-200"
          >
            Keep the sweet demo
          </button>
        </div>
      </div>
    </div>
  );
}
