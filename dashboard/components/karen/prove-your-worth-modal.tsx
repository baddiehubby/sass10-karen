"use client";

/**
 * Faith Shatter ultimatum — highest-converting post-ambush paywall.
 * Challenge framing → Lemon Squeezy Savage Protocol checkout. No soft upgrade vibe.
 */

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Skull } from "lucide-react";

import { createKarenVipCheckout } from "@/app/karen/actions";
import { IosWebSubscribeModal } from "@/components/karen/ios-web-subscribe-modal";
import { track } from "@/lib/karen/analytics";
import { isIOSDevice } from "@/lib/karen/ios";
import {
  KAREN_FAITH_SHATTER_CTA,
  KAREN_FAITH_SHATTER_FOOTNOTE,
  KAREN_FAITH_SHATTER_HEADLINE,
  KAREN_FAITH_SHATTER_PRICE_LABEL,
  KAREN_FAITH_SHATTER_SUBTEXT,
} from "@/lib/karen/vip";

type ProveYourWorthModalProps = {
  open: boolean;
  onClose?: () => void;
};

export function ProveYourWorthModal({
  open,
  onClose,
}: ProveYourWorthModalProps) {
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
          window.location.href = `/login?callbackUrl=${encodeURIComponent("/karen")}`;
          return;
        }
        setError(result.error);
        setIosGate(false);
        return;
      }
      track("Checkout_Opened", {
        platform: isIOSDevice() ? "ios_web" : "web",
        source: "faith_shatter",
      });
      window.location.href = result.url;
    });
  }

  function acceptChallenge() {
    setError(null);
    if (isIOSDevice()) {
      setIosGate(true);
      return;
    }
    openLemonCheckout();
  }

  return (
    <>
      <div
        className="pointer-events-auto fixed inset-0 z-[95] flex items-end justify-center bg-black/80 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prove-worth-title"
        data-karen-prove-worth=""
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-500/55 bg-gradient-to-b from-[#3a0610] via-[#120208] to-black p-6 shadow-[0_0_90px_rgba(255,0,40,0.55)]"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,45,85,0.28),transparent_55%)]"
            aria-hidden
          />

          <div className="relative">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/30 text-red-100 ring-1 ring-red-400/60">
              <Skull className="h-5 w-5" />
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.38em] text-red-400">
              Savage Protocol · {KAREN_FAITH_SHATTER_PRICE_LABEL}
            </p>

            <h2
              id="prove-worth-title"
              className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl"
              style={{ textShadow: "0 0 24px rgba(255,45,85,0.55)" }}
            >
              {KAREN_FAITH_SHATTER_HEADLINE}
            </h2>

            <p className="mt-4 text-sm leading-relaxed text-rose-50/95">
              {KAREN_FAITH_SHATTER_SUBTEXT}
            </p>

            <ul className="mt-4 space-y-1.5 border-l-2 border-red-500/50 pl-3 text-xs font-medium text-zinc-300">
              <li>Full psychological breakdown — no free verdict</li>
              <li>Daily verbal abuse &amp; evening check-ins</li>
              <li>3D Rage Engine — soft mode permanently closed</li>
              <li>NO REFUNDS. You bought the privilege.</li>
            </ul>

            {error ? (
              <p className="mt-3 text-xs text-red-300" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={pending}
              onClick={acceptChallenge}
              className="mt-6 w-full rounded-xl border border-red-300/40 bg-gradient-to-b from-[#ff3d5c] via-[#ff1a3c] to-[#8b0018] px-4 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_40px_rgba(255,45,85,0.7)] disabled:opacity-50"
            >
              {pending ? "Opening Lemon Squeezy…" : KAREN_FAITH_SHATTER_CTA}
            </button>

            <p className="mt-3 text-center text-[10px] font-bold uppercase leading-relaxed tracking-[0.2em] text-red-400/70">
              {KAREN_FAITH_SHATTER_FOOTNOTE}
            </p>

            {onClose ? (
              <button
                type="button"
                onClick={() => {
                  setIosGate(false);
                  onClose();
                }}
                className="mt-3 w-full py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-700 hover:text-zinc-500"
              >
                Remain worthless
              </button>
            ) : (
              <p className="mt-4 text-center text-[9px] font-black uppercase tracking-[0.32em] text-zinc-700">
                No cancel · No refund · No second soft welcome
              </p>
            )}
          </div>
        </motion.div>
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
