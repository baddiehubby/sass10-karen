"use client";

import { useState, useTransition } from "react";
import { Crown } from "lucide-react";

import { createKarenVipCheckout, getKarenVipPortalUrl } from "@/app/karen/actions";
import {
  IosInstallBanner,
  PWA_PAYWALL_INSTALL_COPY,
} from "@/components/karen/ios-install-banner";
import { IosWebSubscribeModal } from "@/components/karen/ios-web-subscribe-modal";
import { track } from "@/lib/karen/analytics";
import { isIOSDevice } from "@/lib/karen/ios";
import {
  KAREN_UNLOCK_CTA,
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
 * Glassmorphic paywall — Lemon Squeezy $19/mo Karen VIP subscription.
 * iOS users hit an Apple-tax web-subscribe gate first (Meta/TikTok ad traffic).
 */
export function VipUpgradeModal({ open, message, onClose }: VipUpgradeModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [iosGate, setIosGate] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function openLemonCheckout() {
    setError(null);
    startTransition(async () => {
      const result = await createKarenVipCheckout();
      if (!result.ok) {
        if (result.needsAuth) {
          window.location.href = `/login?callbackUrl=${encodeURIComponent("/karen/dashboard")}`;
          return;
        }
        setError(result.error);
        setIosGate(false);
        return;
      }
      track("Checkout_Opened", { platform: isIOSDevice() ? "ios_web" : "web" });
      window.location.href = result.url;
    });
  }

  function subscribe() {
    setError(null);
    // iOS Safari / in-app browsers: route through Apple-tax web gate first.
    if (isIOSDevice()) {
      setIosGate(true);
      return;
    }
    openLemonCheckout();
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
    <>
      <div
        className="pointer-events-auto fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="karen-vip-title"
      >
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-6 shadow-[0_0_80px_rgba(244,63,94,0.4)] backdrop-blur-3xl">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/40">
            <Crown className="h-5 w-5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-rose-300">
            Karen VIP · {KAREN_VIP_PRICE_LABEL}
          </p>
          <h2 id="karen-vip-title" className="mt-2 text-2xl font-bold text-white">
            {KAREN_VIP_MODAL_TITLE}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-rose-50/90">
            {message && message.trim() ? message : KAREN_VIP_UPGRADE_MESSAGE}
          </p>
          <ul className="mt-4 space-y-1.5 text-xs text-zinc-300">
            <li>· Daily verbal abuse / evening check-ins</li>
            <li>· Custom Morning Roast alarms</li>
            <li>· Full 3D Rage Engine</li>
            <li>· Cancel anytime via Lemon Squeezy</li>
          </ul>
          <p className="mt-3 text-sm font-semibold text-white">{KAREN_VIP_PRICE_LABEL}</p>

          {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={subscribe}
              className="rounded-xl bg-gradient-to-r from-[#ff2d55] via-rose-600 to-pink-600 px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_32px_rgba(255,45,85,0.55)] disabled:opacity-50"
            >
              {pending ? "Opening Lemon Squeezy…" : KAREN_UNLOCK_CTA}
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
              onClick={() => {
                setIosGate(false);
                onClose();
              }}
              className="py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Keep the free roast
            </button>
          </div>

          {/* PWA install tip — only when paywall is open, never on page load */}
          <IosInstallBanner
            active={open}
            embedded
            copy={PWA_PAYWALL_INSTALL_COPY}
          />
        </div>
      </div>

      <IosWebSubscribeModal
        open={iosGate}
        pending={pending}
        onContinue={openLemonCheckout}
        onClose={() => setIosGate(false)}
      />
    </>
  );
}
