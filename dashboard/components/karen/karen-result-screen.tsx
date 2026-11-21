"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Lock, RotateCcw, Swords } from "lucide-react";

import { createKarenVipCheckout } from "@/app/karen/actions";
import { ShareCard } from "@/components/ShareCard";
import { IosWebSubscribeModal } from "@/components/karen/ios-web-subscribe-modal";
import { ShareYourDamageButton } from "@/components/karen/proof-of-abuse-card";
import type { TraitScores } from "@/lib/karen/game-engine";
import { track } from "@/lib/karen/analytics";
import { isIOSDevice } from "@/lib/karen/ios";
import { buildPersonalityProfile } from "@/lib/karen/result-profile";
import {
  buildChallengeUrl,
  captureKarenAvatarDataUrl,
  hasPlayedToday,
  KAREN_SHARE_ORIGIN,
} from "@/lib/karen/share-loop";
import { defeatScoresFromRespect } from "@/lib/karen/share-defeat";
import {
  KAREN_UNLOCK_CTA,
  KAREN_VIP_ACCOUNTABILITY_CTA,
  KAREN_VIP_ACCOUNTABILITY_HEADLINE,
  KAREN_VIP_PRICE_LABEL,
  resolveKarenPremium,
} from "@/lib/karen/vip";

const NEON_RED = "#ff2d55";

type KarenResultScreenProps = {
  scores: TraitScores;
  onReplay: () => void;
  avatarDataUrl?: string | null;
  /** Server Prisma `user.isPremium`. */
  initialUnlocked?: boolean;
  /** Final Respect Score for the share card (can be negative). */
  respectScore?: number;
  /** Last roast line / verdict quote for the share card. */
  roastQuote?: string | null;
};

function NeonBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold uppercase tracking-[0.2em] text-zinc-300">
          {label}
        </span>
        <span className="tabular-nums font-black text-white">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, #ff1a3c, ${NEON_RED})`,
            boxShadow: `0 0 18px ${NEON_RED}`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function KarenResultScreen({
  scores,
  onReplay,
  avatarDataUrl,
  initialUnlocked = false,
  respectScore,
  roastQuote,
}: KarenResultScreenProps) {
  const profile = buildPersonalityProfile(scores);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(initialUnlocked);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [iosGate, setIosGate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [playedToday, setPlayedToday] = useState(false);
  const faceUrl = avatarDataUrl ?? captureKarenAvatarDataUrl();
  const challengeUrl = buildChallengeUrl(profile.challengeScore, profile.trait);
  const shareQuote = (roastQuote || profile.verdict).trim();
  const shareRespect =
    typeof respectScore === "number" && Number.isFinite(respectScore)
      ? Math.round(respectScore)
      : undefined;

  useEffect(() => {
    // TEMPORARY LOCAL BYPASS — unlock results in development.
    setIsPremium(resolveKarenPremium(initialUnlocked));
    setPlayedToday(hasPlayedToday());
  }, [initialUnlocked]);

  const openLemonCheckout = useCallback(() => {
    setCheckoutError(null);
    startTransition(async () => {
      const result = await createKarenVipCheckout();
      if (!result.ok) {
        if (result.needsAuth) {
          window.location.href = `/login?callbackUrl=${encodeURIComponent("/karen/result")}`;
          return;
        }
        setCheckoutError(result.error);
        setIosGate(false);
        return;
      }
      track("Checkout_Opened", { platform: isIOSDevice() ? "ios_web" : "web" });
      window.location.href = result.url;
    });
  }, []);

  const startVipCheckout = useCallback(() => {
    if (isIOSDevice()) {
      setIosGate(true);
      return;
    }
    openLemonCheckout();
  }, [openLemonCheckout]);

  const challengeFriend = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const text = `I got roasted as ${profile.title} (${profile.challengeScore}). Beat me if you can: ${challengeUrl}`;
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Karen Sass 10 Challenge",
          text,
          url: challengeUrl,
        });
        setStatus("Challenge sent.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setStatus("Challenge link copied.");
      } else {
        window.open(challengeUrl, "_blank");
      }
    } catch {
      setStatus("Copy this link: " + challengeUrl);
    } finally {
      setBusy(false);
    }
  }, [challengeUrl, profile.challengeScore, profile.title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-10 mx-auto flex h-full max-h-[100dvh] w-full max-w-lg flex-col overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,env(safe-area-inset-top))]"
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.4em] text-red-400">
        Damage report
      </p>
      <h1
        className="mt-3 text-center text-3xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-5xl"
        style={{
          textShadow: "0 0 28px rgba(255,45,85,0.75), 0 0 2px #ff2d55",
        }}
      >
        {profile.title}
      </h1>

      <div className="mt-6 space-y-4 rounded-[1.5rem] border border-red-500/30 bg-black/55 p-5 shadow-[0_0_40px_rgba(255,45,85,0.12)] backdrop-blur-2xl">
        <NeonBar label="Overthinking" value={profile.bars.overthinking} />
        <NeonBar label="Laziness" value={profile.bars.laziness} />
        <NeonBar label="Chaos" value={profile.bars.chaos} />
      </div>

      <p className="mt-5 text-center text-base font-medium leading-relaxed text-rose-100/95">
        {profile.verdict}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <ShareCard
          faceUrl={faceUrl}
          respectScore={shareRespect}
          scores={defeatScoresFromRespect(shareRespect)}
          onShared={setStatus}
          ctaLabel="Share on TikTok"
        />
        <ShareYourDamageButton
          kind="roast"
          title={profile.title}
          line={shareQuote}
          respectScore={shareRespect}
          faceUrl={faceUrl}
          onShared={setStatus}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void challengeFriend()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/50 bg-red-500/15 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-rose-100 hover:bg-red-500/25 disabled:opacity-50"
        >
          <Swords className="h-4 w-4" />
          Challenge a Friend
        </button>
        {isPremium || !playedToday ? (
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Take it again
          </button>
        ) : (
          <p className="text-center text-xs text-zinc-500">
            Free tier: one roast per day. Come back tomorrow — or go VIP.
          </p>
        )}
      </div>

      {!isPremium ? (
        <div className="relative mt-6 overflow-hidden rounded-[1.5rem] border border-red-500/35">
          <div
            className="pointer-events-none select-none space-y-3 p-5 blur-md filter"
            aria-hidden
          >
            <p className="text-sm font-semibold text-rose-100">
              {KAREN_VIP_ACCOUNTABILITY_HEADLINE}
            </p>
            <p className="text-xs leading-relaxed text-zinc-300">
              Daily check-ins · Morning Roast alarms · 3D Rage Engine evening abuse
            </p>
            <div className="h-10 rounded-xl bg-red-500/30" />
          </div>
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-xl">
            <Lock className="mb-2 h-5 w-5 text-rose-200" />
            <p className="text-center text-sm font-semibold text-white">
              {KAREN_VIP_ACCOUNTABILITY_HEADLINE}
            </p>
            <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-rose-100/90">
              {KAREN_VIP_ACCOUNTABILITY_CTA}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={startVipCheckout}
              className="mt-4 inline-flex w-full max-w-sm items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_28px_rgba(255,45,85,0.5)] disabled:opacity-50"
            >
              {pending ? "Opening Lemon Squeezy…" : KAREN_UNLOCK_CTA}
            </button>
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {KAREN_VIP_PRICE_LABEL} · cancel anytime
            </p>
            {checkoutError ? (
              <p className="mt-2 text-center text-xs text-red-300">{checkoutError}</p>
            ) : null}
            <Link
              href="/karen/dashboard"
              className="mt-3 text-[11px] text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
            >
              Peek at the VIP dashboard
            </Link>
          </div>
        </div>
      ) : (
        <Link
          href="/karen/dashboard"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-amber-100"
        >
          Open Accountability Loop
        </Link>
      )}

      {status ? (
        <p className="mt-3 text-center text-xs text-zinc-400">{status}</p>
      ) : (
        <p className="mt-3 text-center text-[10px] text-zinc-600">
          Watermark · {KAREN_SHARE_ORIGIN.replace("https://", "")}
        </p>
      )}

      <IosWebSubscribeModal
        open={iosGate}
        pending={pending}
        onContinue={openLemonCheckout}
        onClose={() => setIosGate(false)}
      />
    </motion.div>
  );
}
