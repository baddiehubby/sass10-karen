"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Crown } from "lucide-react";
import { KarenResultScreen } from "@/components/karen/karen-result-screen";
import { HoldToScream } from "@/components/karen/hold-to-scream";
import { DignityLostModal } from "@/components/karen/dignity-lost-modal";
import { KoScreen } from "@/components/karen/ko-screen";
import {
  FIGHT_CHAOS_DIGNITY_THRESHOLD,
  FIGHT_DIGNITY_START,
  FIGHT_PATIENCE_MUTE_MS,
  FIGHT_PATIENCE_RECOVER,
  FIGHT_PATIENCE_START,
} from "@/components/karen/fight-meters";
import { HitStamp } from "@/components/karen/hit-stamp";
import { MutedStamp } from "@/components/karen/muted-stamp";
import { ProveYourWorthModal } from "@/components/karen/prove-your-worth-modal";
import { VipAccessBadge } from "@/components/karen/vip-access-badge";
import { VipUpgradeModal } from "@/components/karen/vip-upgrade-modal";
import { useKarenVoice } from "@/hooks/useKarenVoice";
import {
  INTERROGATION_STAGE_COUNT,
  PersonalityEngine,
  ROAST_QUESTIONS,
  type TraitScores,
} from "@/lib/karen/game-engine";
import { getRoast } from "@/lib/karen/roasts";
import { ShareCard } from "@/components/ShareCard";
import {
  getMuteProtocolResult,
  MUTE_APOLOGY_PROMPT,
  MUTE_SRC,
  BRUTAL_01_SRC,
  OPENING_ROAST_LINE,
  OPENING_ROAST_SRC,
  getBrutal01Result,
  pickBrutalCombatResult,
  consumeCombatBargeIn,
  pickCombatInterrupt,
  pickTalkInterrupt,
  processCombatWithMood,
  QUIET_RAGE_LOCK_MS,
  WIN_LINE,
  WIN_SRC,
  type SmackBackResult,
} from "@/lib/karen/smack-back";
import {
  buildPlannerFailInsult,
  consumePlannerExcusePending,
  readFailedTaskFromSearch,
  urlRequestsPlannerExcuse,
} from "@/lib/karen/planner";
import {
  captureKarenAvatarDataUrl,
  challengeTaunt,
  markDailyPlay,
  parseChallengeInvite,
  retentionPrompt,
  shouldShowDailyRetention,
} from "@/lib/karen/share-loop";
import {
  adjustRespect,
  DONE_LISTENING_AUDIO_ID,
  DONE_LISTENING_LINE,
  DONE_LISTENING_SRC,
  isColdShoulder,
  isMicLocked,
  lockMicFor,
  MIC_LOCKOUT_MS,
  readMicLockoutUntil,
  readRespect,
} from "@/lib/karen/state";
import { applyFuriousStrikeMorphs } from "@/lib/karen/expression-bridge";
import { trackPointerGaze } from "@/lib/karen/talkinghead-factory";
import { triggerHapticPunch, triggerHapticRage } from "@/lib/karen/haptics";
import {
  dispatchKarenCamera,
  dispatchKarenExpression,
  dispatchKarenFacing,
  dispatchKarenFuriousAlert,
  dispatchKarenHangUp,
  dispatchKarenRecoil,
  dispatchKarenStageBlur,
  subscribeKarenRageShake,
} from "@/lib/karen/talkinghead-bus";
import {
  playAnswerClick,
  playMutedStamp,
  playRoastStinger,
  startQuestionAmbience,
  stopQuestionAmbience,
} from "@/lib/karen/sfx";
import {
  getRegisteredKarenTalkingHead,
  pauseKarenAudio,
  playImpatienceInterrupt,
  getCombatPreloadUrls,
  getKarenAudioContext,
  pickCachedFallbackUrl,
  playWavWithLipsync,
  preloadAudio,
  preloadFallbackBrutalAudio,
  unlockAudio,
  unlockKarenAudio,
  unlockKarenAudioAndMic,
} from "@/lib/karen/voice";
import { trackPaywallHit } from "@/lib/karen/analytics";
import {
  applyDignityDamage,
  applyPatienceDamage,
  rollKarenCounterDamage,
  rollUserScreamHit,
  USER_KO_LINE,
  USER_KO_SRC,
} from "@/lib/karen/game-state";
import { dispatchFightHit, dispatchFightHud } from "@/lib/karen/fight-hud-bus";
import { throwKarenHead, type HitImpactHost } from "@/lib/karen/hit-impact";
import {
  IM_TALKING_LINE,
  IM_TALKING_SRC,
  MIC_PERMISSION_COPY,
  RELEASE_MUTE_LINE,
  RELEASE_MUTE_SRC,
} from "@/lib/karen/mic";
import {
  KAREN_CLIFFHANGER_LINE,
  KAREN_CLIFFHANGER_PAYWALL_MESSAGE,
  KAREN_VIP_UPGRADE_MESSAGE,
  resolveKarenPremium,
} from "@/lib/karen/vip";
import {
  ambushShatterResult,
  analyzeAmbushAnswer,
  pickAmbushTrap,
  revokeVipTrustAccess,
  type AmbushTrap,
} from "@/lib/karen/ambush";
import {
  bumpVipTrustInteraction,
  hasVipTrustPremium,
  isVipTrustActive,
  readFaithShatterLock,
  readVipTrustState,
  shouldShowVipTrustBadge,
  writeFaithShatterLock,
  VIP_TRUST_GOAL_LINE,
  VIP_TRUST_GOAL_SRC,
  VIP_TRUST_WELCOME_LINE,
  VIP_TRUST_WELCOME_SRC,
} from "@/lib/karen/vip-trust";

const JUDGE_MS = 1500;
const FACE_KEY = "karen.roast.face";

export type KarenChatClientProps = {
  initialIsPremium?: boolean;
  initialChatCount?: number;
  isSignedIn?: boolean;
};

type GateProps = {
  onStart: () => void;
  challengeScore: number | null;
  challengeTrait: string | null;
  showRetention: boolean;
};

/** Cinematic gate — dimmed Karen, neon judgment CTA, challenge / retention hooks. */
function CinematicGate({
  onStart,
  challengeScore,
  challengeTrait,
  showRetention,
}: GateProps) {
  const lockedToday = showRetention && challengeScore == null;

  return (
    <div className="pointer-events-none relative z-20 karen-vh w-screen overflow-hidden bg-transparent text-center">
      {/*
        Layout contract: headline = TOP, CTA = BOTTOM THIRD, centre = her face, no text.
        Scrims only touch the top/bottom edges so the face stays bright and unobstructed.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[32%] bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[28%] bg-gradient-to-t from-black/85 via-black/35 to-transparent"
        aria-hidden
      />

      {/* TOP — eyebrow + headline (+ default tagline) */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-10 z-20 flex w-full flex-col items-center gap-3 px-6 text-center"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-red-400/90">
          Interrogation · Sass 10
        </p>
        <h1
          className="text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl"
          style={{
            textShadow:
              "0 0 24px rgba(255,45,85,0.85), 0 0 64px rgba(255,0,40,0.45), 0 0 2px #ff2d55",
          }}
        >
          Karen knows
          <br />
          <span className="text-[#ff2d55]">your type.</span>
        </h1>
      </motion.div>

      {/* BOTTOM THIRD — taunt / lock notice, CTA, sign-in */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-md flex-col items-center gap-4 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      >
        {challengeScore != null ? (
          <p className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm font-medium leading-relaxed text-rose-100 backdrop-blur-sm">
            {challengeTaunt(challengeScore, challengeTrait ?? "overthinking")}
          </p>
        ) : lockedToday ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-950/50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-100/90 backdrop-blur-sm">
            {retentionPrompt()}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-zinc-300">
            9 free questions. Progressive fury. The full breakdown is locked.
            <span className="mt-2 block text-xs text-zinc-400">
              {MIC_PERMISSION_COPY}
            </span>
          </p>
        )}

        {lockedToday ? (
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
            Judgment closed · try again tomorrow
          </p>
        ) : (
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              // ENTER THE ROAST — unlock + explicit resume inside the gesture stack
              // (suspended context = light show with no sound).
              void unlockAudio().then(async (ctx) => {
                if (
                  ctx.state === "suspended" ||
                  (ctx.state as string) === "interrupted"
                ) {
                  await ctx.resume().catch(() => undefined);
                }
                // Fallbacks first — typo "asdf" must be cache-hot before combat.
                void preloadFallbackBrutalAudio({ audioContext: ctx }).catch(
                  (err) => console.warn("[CinematicGate] fallback preload", err),
                );
                void preloadAudio(getCombatPreloadUrls(20), {
                  audioContext: ctx,
                }).catch((err) => {
                  console.warn("[CinematicGate] preload miss", err);
                });
              });
              void unlockKarenAudioAndMic();
            }}
            onClick={() => {
              void unlockAudio().then(async (ctx) => {
                if (
                  ctx.state === "suspended" ||
                  (ctx.state as string) === "interrupted"
                ) {
                  await ctx.resume().catch(() => undefined);
                }
                // Belt-and-suspenders: shared fight clock must be running.
                const shared = getKarenAudioContext();
                if (
                  shared.state === "suspended" ||
                  (shared.state as string) === "interrupted"
                ) {
                  await shared.resume().catch(() => undefined);
                }
                void preloadFallbackBrutalAudio({ audioContext: ctx }).catch(
                  (err) => console.warn("[CinematicGate] fallback preload", err),
                );
                void preloadAudio(getCombatPreloadUrls(20), {
                  audioContext: ctx,
                }).catch((err) => {
                  console.warn("[CinematicGate] preload miss", err);
                });
              });
              playAnswerClick();
              onStart();
              void unlockKarenAudioAndMic();
            }}
            className="karen-hud pointer-events-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#ff1a3c] via-[#ff2d55] to-[#ff4d6d] px-12 py-4 text-sm font-black uppercase tracking-[0.28em] text-white outline-none focus:ring-4 focus:ring-red-500/50 shadow-[0_0_32px_rgba(255,45,85,0.85),0_0_72px_rgba(255,0,40,0.4)]"
          >
            Enter the Roast
          </motion.button>
        )}
        <Link
          href="/login?callbackUrl=/karen"
          className="pointer-events-auto text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          Already VIP? Sign in
        </Link>
      </motion.div>
    </div>
  );
}

/**
 * Viral personality-roast interrogation — gate → quiz → result / share loop.
 */
export function KarenChatClient({
  initialIsPremium = false,
}: KarenChatClientProps = {}) {
  const router = useRouter();
  const { isSpeaking } = useKarenVoice();
  const engineRef = useRef(new PersonalityEngine());
  const [started, setStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [scores, setScores] = useState<TraitScores>(() => engineRef.current.getScores());
  const [questionIndex, setQuestionIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [roastLine, setRoastLine] = useState<string | null>(null);
  /** Soft PROUD during VIP Trust; FURIOUS after the trap. */
  const [mood, setMood] = useState("PROUD");
  const [typing, setTyping] = useState(false);
  const openingRoastFiredRef = useRef(false);
  const vipWelcomeFiredRef = useRef(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  const [vipTrustBadge, setVipTrustBadge] = useState(false);
  const [vipBadgeShatter, setVipBadgeShatter] = useState(false);
  const [vipTrustSoft, setVipTrustSoft] = useState(false);
  /** Ambush open-ended trap — text-only confession before Faith Shatter. */
  const [ambushTrap, setAmbushTrap] = useState<AmbushTrap | null>(null);
  const ambushArmedRef = useRef(false);
  /** Post–Faith Shatter: lock input, blur avatar, Prove Your Worth Lemon paywall. */
  const [faithShatterLocked, setFaithShatterLocked] = useState(false);
  const [challengeScore, setChallengeScore] = useState<number | null>(null);
  const [challengeTrait, setChallengeTrait] = useState<string | null>(null);
  const [showRetention, setShowRetention] = useState(false);
  const prevMoodRef = useRef(mood);
  const stageMotion = useAnimationControls();
  /** True only while the interrogation `motion.div` that owns stageMotion is mounted. */
  const stageReadyRef = useRef(false);
  const busyRef = useRef(false);
  const [rageFlash, setRageFlash] = useState(false);
  /** Brutal audio punch — solid red @ 0.4 for 100ms. */
  const [punchFlash, setPunchFlash] = useState(false);
  /** Fighting-game impact — violent subtitle shake + vignette. */
  const [impactTick, setImpactTick] = useState(0);
  /** Full-screen manga MUTED stamp. */
  const [mutedStamp, setMutedStamp] = useState(false);
  /** Manga 💥 / !! on SEND — masks audio latency. */
  const [hitStamp, setHitStamp] = useState(false);
  const [hitStampMark, setHitStampMark] = useState("💥");
  /** Dignity 0% — K.O. stamp then paywall. */
  const [dignityLost, setDignityLost] = useState(false);
  const [showKo, setShowKo] = useState(false);
  const koRef = useRef<"none" | "user" | "karen">("none");
  const [smackCooldownUntil, setSmackCooldownUntil] = useState(0);
  const [micLockoutUntil, setMicLockoutUntil] = useState(0);
  /** Patience 0% lock — she ignores you for 30s. */
  const [patienceLockUntil, setPatienceLockUntil] = useState(0);
  /** Profanity Mute Protocol — mic off until apology. */
  const [muteProtocol, setMuteProtocol] = useState(false);
  /** 10% WIN — unlock Share Victory TikTok card. */
  const [victoryUnlocked, setVictoryUnlocked] = useState(false);
  const [showVictoryShare, setShowVictoryShare] = useState(false);
  /** Karen Patience meter (100 → 0). Hits 0% → rare player win. */
  const [patience, setPatience] = useState(FIGHT_PATIENCE_START);
  /** User Dignity meter (100 → 0). Hits 0% → K.O. */
  const [dignity, setDignity] = useState(FIGHT_DIGNITY_START);
  const [respectScore, setRespectScore] = useState(0);
  const [cliffhanger, setCliffhanger] = useState(false);
  /** Toxic Planner overdue → scream this task text once after gate skip. */
  const [plannerExcuse, setPlannerExcuse] = useState<string | null>(null);
  const plannerExcuseFiredRef = useRef(false);
  /** Massive "YOU FAILED: …" overlay from Toxic Planner. */
  const [failedTaskBanner, setFailedTaskBanner] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const patienceRef = useRef(FIGHT_PATIENCE_START);
  const dignityRef = useRef(FIGHT_DIGNITY_START);
  const patienceMuteTimerRef = useRef(0);

  useEffect(() => {
    setRespectScore(readRespect());
    setMicLockoutUntil(readMicLockoutUntil());
  }, []);

  // Free-tier cliffhanger / VIP modal → Paywall_Hit for Meta/TikTok.
  useEffect(() => {
    if (!vipOpen) return;
    trackPaywallHit(cliffhanger ? "cliffhanger" : "vip_modal");
  }, [vipOpen, cliffhanger]);

  const currentQuestion = cliffhanger ? null : (ROAST_QUESTIONS[questionIndex] ?? null);
  const isFurious = mood === "ANGRY" || mood === "FURIOUS";

  useEffect(() => {
    if (typeof window === "undefined") return;
    // TEMPORARY LOCAL BYPASS — client also forces VIP in development.
    const premiumNow = resolveKarenPremium(initialIsPremium);
    const trust = readVipTrustState();
    const trustSoft = isVipTrustActive(trust) || (!trust.welcomeComplete);
    setVipTrustSoft(isVipTrustActive(trust));
    setVipTrustBadge(shouldShowVipTrustBadge(trust));
    setIsPremium(hasVipTrustPremium(premiumNow, trust));

    // Prefer Next.js searchParams; fall back to window for edge hydration.
    const params = new URLSearchParams(
      searchParams?.toString() || window.location.search,
    );
    const invite = parseChallengeInvite(params);
    setChallengeScore(invite?.score ?? null);
    setChallengeTrait(invite?.trait ?? null);
    const playedToday = shouldShowDailyRetention();
    // Free users: one roast/day. Challenge invites still bypass. VIP / trust may replay.
    const effectivePremium = hasVipTrustPremium(premiumNow, trust);
    setShowRetention(playedToday && !invite && !effectivePremium);

    // Paid VIP clears a prior Faith Shatter lock.
    if (effectivePremium && readFaithShatterLock()) {
      writeFaithShatterLock(false);
      setFaithShatterLocked(false);
      dispatchKarenStageBlur(false);
    }

    // Toxic Planner overdue → skip gate, scream about the failed task.
    const failedTask =
      readFailedTaskFromSearch(params) ||
      readFailedTaskFromSearch(searchParams);
    const fromPlannerExcuse = urlRequestsPlannerExcuse(params);
    const pendingExcuse = consumePlannerExcusePending();
    if (failedTask || fromPlannerExcuse || pendingExcuse) {
      const taskLabel =
        failedTask || pendingExcuse?.text || "that thing you locked in";
      if (failedTask || fromPlannerExcuse) {
        window.history.replaceState({}, "", "/karen");
      }
      void unlockKarenAudio();
      prevMoodRef.current = "FURIOUS";
      setMood("FURIOUS");
      setVipTrustSoft(false);
      setVipTrustBadge(false);
      setStarted(true);
      setFailedTaskBanner(taskLabel);
      setPlannerExcuse(taskLabel);
      return;
    }

    // Faith Shatter ultimatum survives refresh — chat locked, avatar blurred.
    if (readFaithShatterLock() && !effectivePremium) {
      prevMoodRef.current = "FURIOUS";
      setMood("FURIOUS");
      setVipTrustSoft(false);
      setVipTrustBadge(false);
      setFaithShatterLocked(true);
      dispatchKarenStageBlur(true);
      void unlockKarenAudio();
      setStarted(true);
      return;
    }

    // VIP Trust — soft PROUD start + welcome line (no aggressive gate).
    if (trust.welcomeComplete && trust.interactions === 0) {
      prevMoodRef.current = "PROUD";
      setMood("PROUD");
      setVipTrustSoft(true);
      setVipTrustBadge(true);
      void unlockKarenAudio();
      setStarted(true);
      return;
    }

    if (isVipTrustActive(trust)) {
      prevMoodRef.current = "PROUD";
      setMood("PROUD");
      setVipTrustSoft(true);
      setVipTrustBadge(true);
    } else if (!trustSoft) {
      prevMoodRef.current = "FURIOUS";
      setMood("FURIOUS");
    }

    // Challenge links skip the gate — first question immediately.
    if (invite) {
      void unlockKarenAudio();
      setStarted(true);
      return;
    }
    if (params.get("replay") === "1") {
      window.history.replaceState({}, "", "/karen");
      if (effectivePremium || !playedToday) {
        setStarted(true);
      } else {
        setShowRetention(true);
      }
    }
  }, [initialIsPremium, searchParams]);

  // Gate / result screens unmount the stage motion node — block controls.start() until then.
  useEffect(() => {
    const ready = started && !showResult;
    stageReadyRef.current = ready;
    return () => {
      stageReadyRef.current = false;
    };
  }, [started, showResult]);

  // Tell the avatar which screen it is on: big centered face on the gate / result screens,
  // head raised above the answer dock during questions so the lip-sync stays visible.
  useEffect(() => {
    dispatchKarenCamera(started && !showResult ? "stage-game" : "stage-intro");
    return () => dispatchKarenCamera("stage-intro");
  }, [started, showResult]);

  useEffect(() => {
    dispatchFightHud({
      visible: started && !showResult,
      dignity,
      patience,
    });
  }, [started, showResult, dignity, patience]);

  // Clear avatar blur if this client unmounts mid-paywall.
  useEffect(() => {
    return () => dispatchKarenStageBlur(false);
  }, []);

  useEffect(() => {
    return () => {
      dispatchFightHud({ visible: false, dignity: 100, patience: 100 });
    };
  }, []);

  const safeStageStart = useCallback(
    (definition: Parameters<typeof stageMotion.start>[0]) => {
      if (!stageReadyRef.current) return;
      try {
        void stageMotion.start(definition);
      } catch {
        /* Framer: start() before mount — ignore */
      }
    },
    [stageMotion],
  );

  /** Rapid full-screen red punch flash — opacity 0.4 for 100ms. */
  const firePunchFlash = useCallback(() => {
    setPunchFlash(true);
    window.setTimeout(() => setPunchFlash(false), 100);
  }, []);

  /** Manga hit stamp on SEND — hides any remaining decode latency. */
  const slamHitStamp = useCallback((mark: "💥" | "!!" = "💥") => {
    setHitStampMark(mark);
    setHitStamp(true);
    window.setTimeout(() => setHitStamp(false), 420);
  }, []);

  /** Premium anger — low-frequency zoom + red vignette flash + soft haptic. */
  const triggerRagePulse = useCallback(() => {
    triggerHapticRage([60, 40, 120]);
    setRageFlash(true);
    firePunchFlash();
    window.setTimeout(() => setRageFlash(false), 1400);
    safeStageStart({
      scale: [1, 1.02, 1.015, 1.02, 1],
      transition: { duration: 1.15, ease: [0.22, 1, 0.36, 1] },
    });
  }, [firePunchFlash, safeStageStart]);

  /** Karen WAV counter — violent camera-hit shake + punch flash. */
  const triggerSmackShake = useCallback(() => {
    triggerHapticRage();
    setRageFlash(true);
    firePunchFlash();
    setImpactTick((n) => n + 1);
    dispatchKarenRecoil();
    window.setTimeout(() => setRageFlash(false), 400);
    safeStageStart({
      // Camera punched — not a polite light show.
      x: [0, -25, 25, -20, 20, -10, 10, 0],
      y: [0, 10, -10, 10, -10, 0],
      rotate: [0, -3, 3, -2, 2, 0],
      scale: [1, 1.05, 0.96, 1.03, 1],
      transition: { duration: 0.3, type: "tween" },
    });
  }, [firePunchFlash, safeStageStart]);

  /** Instant punch on SEND INSULT / type — before Karen opens her mouth. */
  const triggerPunchShake = useCallback(() => {
    playAnswerClick();
    triggerHapticPunch();
    slamHitStamp(Math.random() < 0.5 ? "💥" : "!!");
    setRageFlash(true);
    firePunchFlash();
    setImpactTick((n) => n + 1);
    dispatchKarenRecoil();
    window.setTimeout(() => setRageFlash(false), 300);
    safeStageStart({
      x: [0, -25, 25, -20, 20, -10, 10, 0],
      y: [0, 10, -10, 10, -10, 0],
      scale: [1, 1.03, 0.97, 1],
      transition: { duration: 0.3, type: "tween" },
    });
  }, [firePunchFlash, safeStageStart, slamHitStamp]);

  const slamMutedStamp = useCallback(() => {
    playMutedStamp();
    setMutedStamp(true);
    setRageFlash(true);
    firePunchFlash();
    setImpactTick((n) => n + 1);
    dispatchKarenRecoil();
    window.setTimeout(() => setMutedStamp(false), 1600);
    window.setTimeout(() => setRageFlash(false), 400);
    safeStageStart({
      x: [0, -25, 25, -20, 20, -10, 10, 0],
      y: [0, 10, -10, 10, -10, 0],
      scale: [1, 1.04, 0.97, 1],
      transition: { duration: 0.3, type: "tween" },
    });
  }, [firePunchFlash, safeStageStart]);

  const fightersNow = () => ({
    karenPatience: patienceRef.current,
    userDignity: dignityRef.current,
  });

  const triggerUserKo = useCallback(async () => {
    if (koRef.current === "user") return;
    koRef.current = "user";
    setShowKo(true);
    setDignityLost(false);
    dignityRef.current = 0;
    setDignity(0);
    pauseKarenAudio();
    const head = getRegisteredKarenTalkingHead();
    throwKarenHead(head as HitImpactHost | null, "laugh");
    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");
    setRoastLine(USER_KO_LINE);
    dispatchKarenExpression({
      mood: "FURIOUS",
      text: USER_KO_LINE,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    trackPaywallHit("dignity_zero");
    try {
      await unlockKarenAudio(head);
      await playWavWithLipsync(USER_KO_SRC, head, { text: USER_KO_LINE });
    } catch (err) {
      console.warn("[ko] final speech failed", err);
    }
    window.setTimeout(() => setDignityLost(true), 700);
  }, []);

  const triggerKarenKo = useCallback(async () => {
    if (koRef.current === "karen") return;
    koRef.current = "karen";
    patienceRef.current = 0;
    setPatience(0);
    setVictoryUnlocked(true);
    setShowVictoryShare(true);
    const head = getRegisteredKarenTalkingHead();
    prevMoodRef.current = "DEFEATED";
    setMood("DEFEATED");
    setRoastLine(WIN_LINE);
    dispatchKarenExpression({
      mood: "DEFEATED",
      text: WIN_LINE,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    try {
      await unlockKarenAudio(head);
      await playWavWithLipsync(WIN_SRC, head, { text: WIN_LINE, volume: 1 });
    } catch (err) {
      console.warn("[ko] win speech failed", err);
    }
  }, []);

  /** Patience 0% used to MUTE — KO win now owns that threshold. */
  const tripPatienceMute = useCallback(() => {
    patienceRef.current = 0;
    setPatience(0);
    const until = Date.now() + FIGHT_PATIENCE_MUTE_MS;
    setPatienceLockUntil(until);
    setSmackCooldownUntil(until);
    slamMutedStamp();
    dispatchKarenFacing(true);
    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");
    setRoastLine("MUTED. Come back when you learn manners.");
    dispatchKarenExpression({
      mood: "FURIOUS",
      isSpeaking: false,
      lipSync: false,
      trait: "chaos",
    });

    if (patienceMuteTimerRef.current) {
      window.clearTimeout(patienceMuteTimerRef.current);
    }
    patienceMuteTimerRef.current = window.setTimeout(() => {
      patienceMuteTimerRef.current = 0;
      patienceRef.current = FIGHT_PATIENCE_RECOVER;
      setPatience(FIGHT_PATIENCE_RECOVER);
      setPatienceLockUntil(0);
      dispatchKarenFacing(false);
      setRoastLine("Fine. Speak. Make it interesting.");
      setMood("SARCASTIC");
    }, FIGHT_PATIENCE_MUTE_MS);
  }, [slamMutedStamp]);

  /** Hold-to-scream: roll a hit. Miss / silence → 0. Hit → 10–15 + recoil. */
  const hitPatience = useCallback(() => {
    if (koRef.current !== "none") return patienceRef.current;
    if (patienceLockUntil > Date.now()) return patienceRef.current;
    const roll = rollUserScreamHit();
    if (!roll.hit) return patienceRef.current;
    const { fighters, outcome } = applyPatienceDamage(fightersNow(), roll.damage);
    patienceRef.current = fighters.karenPatience;
    setPatience(fighters.karenPatience);
    dispatchFightHit({
      amount: roll.damage,
      target: "patience",
      pose: "laugh",
    });
    dispatchKarenRecoil();
    triggerHapticPunch();
    if (outcome === "karen_ko") void triggerKarenKo();
    return fighters.karenPatience;
  }, [patienceLockUntil, triggerKarenKo]);

  /** Karen WAV counter — 20–25 Dignity. At 0% → K.O. */
  const hitDignity = useCallback((amount?: number) => {
    if (koRef.current !== "none") return dignityRef.current;
    const dmg = amount ?? rollKarenCounterDamage();
    const { fighters, outcome } = applyDignityDamage(fightersNow(), dmg);
    dignityRef.current = fighters.userDignity;
    setDignity(fighters.userDignity);
    dispatchFightHit({
      amount: dmg,
      target: "dignity",
      pose: "scream",
    });
    triggerSmackShake();
    if (outcome === "user_ko") void triggerUserKo();
    return fighters.userDignity;
  }, [triggerSmackShake, triggerUserKo]);

  // VIP Trust welcome — soft PROUD expression + welcoming WAV/TTS line → Ambush.
  useEffect(() => {
    if (!started || !vipTrustSoft || vipWelcomeFiredRef.current) return;
    if (plannerExcuse) return;
    const trust = readVipTrustState();
    if (!trust.welcomeComplete || trust.interactions > 0) return;
    vipWelcomeFiredRef.current = true;

    let cancelled = false;
    void (async () => {
      await new Promise((r) => window.setTimeout(r, 350));
      if (cancelled) return;
      const head = getRegisteredKarenTalkingHead();
      prevMoodRef.current = "PROUD";
      setMood("PROUD");
      setRoastLine(VIP_TRUST_WELCOME_LINE);
      dispatchKarenExpression({
        mood: "PROUD",
        text: VIP_TRUST_WELCOME_LINE,
        lipSync: true,
        isSpeaking: true,
        trait: "chaos",
      });
      try {
        await unlockKarenAudio(head);
        await playWavWithLipsync(VIP_TRUST_WELCOME_SRC, head, {
          text: VIP_TRUST_WELCOME_LINE,
          volume: 0.95,
        });
      } catch (err) {
        console.warn("[vip-trust] welcome line failed", err);
      } finally {
        // Stay soft — badge + fake premium for 3 interactions before Ambush.
        dispatchKarenExpression({
          mood: "PROUD",
          isSpeaking: false,
          lipSync: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [started, vipTrustSoft, plannerExcuse]);

  /** After the soft window ends — arm Ambush (faith built, trap snaps). */
  const armAmbushTrap = useCallback(() => {
    if (ambushArmedRef.current) return;
    ambushArmedRef.current = true;
    const trap = pickAmbushTrap();
    // Keep VIP badge glowing so Faith Shatter has something to break.
    setVipTrustBadge(true);
    setVipBadgeShatter(false);
    setAmbushTrap(trap);
    setRoastLine(null);
    setMood("PROUD");
    dispatchKarenExpression({
      mood: "SWEET",
      text: trap.prompt,
      lipSync: false,
      isSpeaking: false,
      trait: "chaos",
    });
  }, []);

  // Returning after soft window spent (e.g. planner used 3 goals) → Ambush.
  useEffect(() => {
    if (!started || plannerExcuse || ambushTrap) return;
    const trust = readVipTrustState();
    if (
      trust.welcomeComplete &&
      trust.interactions >= 3 &&
      !ambushArmedRef.current
    ) {
      armAmbushTrap();
    }
  }, [started, plannerExcuse, ambushTrap, armAmbushTrap]);

  // Toxic Planner → failedTask fight: FURIOUS + brutal_01 + overlay + violent shake.
  useEffect(() => {
    if (!started || !plannerExcuse || plannerExcuseFiredRef.current) return;
    plannerExcuseFiredRef.current = true;
    const taskText = plannerExcuse;
    setPlannerExcuse(null);

    const clip = getBrutal01Result(taskText);
    const line = buildPlannerFailInsult(taskText);
    let cancelled = false;

    void (async () => {
      // Brief beat so the avatar / AudioContext are warm after gate skip.
      await new Promise((r) => window.setTimeout(r, 280));
      if (cancelled) return;
      const head = getRegisteredKarenTalkingHead();
      prevMoodRef.current = "FURIOUS";
      setMood("FURIOUS");
      setFailedTaskBanner(taskText);
      setRoastLine(line);
      applyFuriousStrikeMorphs(head, { jawOpen: 0.5 });
      // Violent camera punch the moment the fail sequence arms.
      triggerSmackShake();
      hitDignity();
      dispatchKarenCamera("whip");
      dispatchKarenFuriousAlert(true);
      dispatchKarenExpression({
        mood: "FURIOUS",
        text: line,
        lipSync: false,
        isSpeaking: true,
        trait: "chaos",
      });
      try {
        await unlockKarenAudio(head);
        await playWavWithLipsync(BRUTAL_01_SRC, head, {
          text: clip.text || line,
          volume: 1,
          cacheOnly: true,
          onStart: () => {
            triggerSmackShake();
            firePunchFlash();
          },
        });
      } catch (err) {
        // Cache miss — still play brutal_01 with network fallback.
        try {
          await playWavWithLipsync(BRUTAL_01_SRC, head, {
            text: clip.text || line,
            volume: 1,
            onStart: () => triggerSmackShake(),
          });
        } catch (err2) {
          console.warn("[planner] brutal fail roast failed", err2 || err);
        }
      } finally {
        dispatchKarenFuriousAlert(false);
        window.setTimeout(() => setFailedTaskBanner(null), 4200);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [started, plannerExcuse, hitDignity, triggerSmackShake, firePunchFlash]);

  /** 30% mic press — "No. I'm talking." + interrupt WAV + force-listen. */
  const handleImTalkingDenial = useCallback(async () => {
    const head = getRegisteredKarenTalkingHead();
    pauseKarenAudio();
    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");
    setRoastLine(IM_TALKING_LINE);
    applyFuriousStrikeMorphs(head, { jawOpen: 0 });
    hitDignity();
    dispatchKarenExpression({
      mood: "FURIOUS",
      text: IM_TALKING_LINE,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    try {
      await unlockKarenAudio(head);
      await playWavWithLipsync(IM_TALKING_SRC, head, { text: IM_TALKING_LINE });
    } catch (err) {
      console.warn("[mic-abuse] im-talking wav failed", err);
    }
  }, [hitDignity]);

  /** 20% mic release — mute WAV, turn her back, lock mic 10s. */
  const handleReleaseMuteAbuse = useCallback(async () => {
    const head = getRegisteredKarenTalkingHead();
    pauseKarenAudio();
    dispatchKarenFacing(true);
    slamMutedStamp();
    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");
    setRoastLine(RELEASE_MUTE_LINE);
    applyFuriousStrikeMorphs(head, { jawOpen: 0 });
    hitDignity();
    dispatchKarenExpression({
      mood: "FURIOUS",
      text: RELEASE_MUTE_LINE,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    try {
      await unlockKarenAudio(head);
      await playWavWithLipsync(RELEASE_MUTE_SRC, head, {
        text: RELEASE_MUTE_LINE,
      });
    } catch (err) {
      console.warn("[mic-abuse] release-mute wav failed", err);
    }
    // Face forward again after the lock window so the next fight can start.
    window.setTimeout(() => {
      dispatchKarenFacing(false);
    }, 10_000);
  }, [hitDignity, slamMutedStamp]);

  /** Hold/talk ≥3s — random interrupts WAV, cut mic, Dignity −10%. */
  const handleHoldInterrupt = useCallback(async () => {
    const head = getRegisteredKarenTalkingHead();
    const clip = pickTalkInterrupt();
    pauseKarenAudio();
    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");
    setRoastLine(clip.text);
    applyFuriousStrikeMorphs(head, { jawOpen: 0 });
    hitDignity();
    dispatchKarenCamera("whip");
    dispatchKarenExpression({
      mood: "FURIOUS",
      text: clip.text,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    try {
      await unlockKarenAudio(head);
      await playWavWithLipsync(clip.src, head, {
        text: clip.text,
        volume: 1,
      });
    } catch (err) {
      console.warn("[mic-abuse] hold-interrupt wav failed", err);
    }
  }, [hitDignity]);

  /** Mute Protocol — stamp + apology gate. Optional override (broken-record line). */
  const tripRageMuteProtocol = useCallback(async (override?: SmackBackResult) => {
    const head = getRegisteredKarenTalkingHead();
    const result =
      override?.muteProtocol || override?.brokenRecord
        ? override
        : getMuteProtocolResult();
    setMuteProtocol(true);
    dispatchKarenHangUp(true);
    dispatchKarenFacing(true);
    slamMutedStamp();
    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");
    dispatchKarenFuriousAlert(true);
    setRoastLine(result.text);
    applyFuriousStrikeMorphs(head, { jawOpen: 0 });
    hitDignity();
    dispatchKarenExpression({
      mood: "FURIOUS",
      text: result.text,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    try {
      await unlockKarenAudio(head);
      await playWavWithLipsync(result.src || MUTE_SRC, head, {
        text: result.text,
      });
    } catch (err) {
      console.warn("[rage] mute protocol wav failed", err);
    }
    setRoastLine(
      override?.brokenRecord
        ? "Say something new. Or apologize."
        : MUTE_APOLOGY_PROMPT,
    );
  }, [hitDignity, slamMutedStamp]);

  /** Hidden mood resolver — rage swings + repeats before keyword match. */
  const resolveCombatSmack = useCallback((transcript: string): SmackBackResult => {
    // VIP Trust soft window — supportive reply, no fury / no typo roast.
    if (isVipTrustActive()) {
      return {
        text: VIP_TRUST_GOAL_LINE,
        audioId: "smackback:vip_trust_goal",
        src: VIP_TRUST_GOAL_SRC,
        chaosDelta: 0,
        respectDelta: 0,
        mood: "FURIOUS",
      };
    }
    const mood = engineRef.current.registerCombatInteraction(transcript);
    const result = processCombatWithMood(transcript, mood);
    const d = dignityRef.current;
    if (
      d > 0 &&
      d < FIGHT_CHAOS_DIGNITY_THRESHOLD &&
      !result.muteProtocol &&
      !result.userWon &&
      !result.quietRage &&
      !result.brokenRecord
    ) {
      return pickBrutalCombatResult();
    }
    return result;
  }, []);

  const handleImpatience = useCallback(async () => {
    pauseKarenAudio();
    const head = getRegisteredKarenTalkingHead();
    prevMoodRef.current = "ANNOYED";
    setMood("ANNOYED");
    dispatchKarenExpression({
      mood: "ANNOYED",
      lipSync: true,
      isSpeaking: true,
      trait: "chaos",
    });
    try {
      const clip = await playImpatienceInterrupt(head);
      setRoastLine(clip.text);
    } catch (err) {
      console.warn("[impatience] interrupt failed", err);
      setRoastLine("Spit it out!");
    }
    hitDignity();
    dispatchKarenExpression({
      mood: "ANNOYED",
      isSpeaking: false,
      lipSync: false,
    });
  }, [hitDignity]);

  useEffect(() => {
    if (!started || showResult) return;
    const prev = prevMoodRef.current;
    prevMoodRef.current = mood;
    if (mood !== "ANGRY" && mood !== "FURIOUS") return;
    if (prev === mood) return;
    // Defer one frame so AnimationControls bind to the mounted stage node.
    const id = window.requestAnimationFrame(() => triggerRagePulse());
    return () => window.cancelAnimationFrame(id);
  }, [mood, started, showResult, triggerRagePulse]);

  useEffect(() => {
    if (!started || showResult) return;
    return subscribeKarenRageShake(triggerRagePulse);
  }, [started, showResult, triggerRagePulse]);

  // Drive page-level Karen3D backdrop (no nested canvas).
  useEffect(() => {
    dispatchKarenExpression({
      mood,
      isSpeaking,
      lipSync: false,
    });
    dispatchKarenFuriousAlert(mood === "FURIOUS" || mood === "ANGRY");
  }, [mood, isSpeaking]);

  const onAnswerPointer = useCallback((e: React.PointerEvent) => {
    trackPointerGaze(getRegisteredKarenTalkingHead(), e.clientX, e.clientY, 500);
  }, []);

  const applyKarenLine = useCallback(
    (
      text: string,
      nextMood: string,
      trait?: string,
      meta?: { questionId?: string; answerId?: string; audioId?: string },
    ) => {
      setMood(nextMood);
      setRoastLine(text);
      stopQuestionAmbience();
      playRoastStinger();
      // Roast delivery — whip pan + audio-bank / TTS.
      dispatchKarenCamera("whip");
      dispatchKarenExpression({
        mood: nextMood,
        text,
        lipSync: true,
        isSpeaking: true,
        trait: trait ?? null,
        questionId: meta?.questionId ?? null,
        answerId: meta?.answerId ?? null,
        audioId: meta?.audioId ?? null,
      });
    },
    [],
  );

  /** Hold-to-scream: pause Karen, stare [LISTENING] while the user talks. */
  const handleCombatStart = useCallback(() => {
    pauseKarenAudio();
    setMood("LISTENING");
    prevMoodRef.current = "LISTENING";
    dispatchKarenExpression({
      mood: "LISTENING",
      isSpeaking: false,
      lipSync: false,
      trait: "chaos",
    });
  }, []);

  /**
   * Ambush Send — analyze length/excuses → Faith Shatter flip.
   * Short / "I don't know" / "I'm trying" → FURIOUS + badge shatter + revoke.
   */
  const handleAmbushSubmit = useCallback(
    async (transcript: string) => {
      const analysis = analyzeAmbushAnswer(transcript);
      const shatter = ambushShatterResult(analysis);
      const head = getRegisteredKarenTalkingHead();
      pauseKarenAudio();
      setAmbushTrap(null);

      if (shatter.faithShatter) {
        revokeVipTrustAccess();
        setVipTrustSoft(false);
        setVipTrustBadge(true);
        setVipBadgeShatter(true);
        prevMoodRef.current = "FURIOUS";
        setMood("FURIOUS");
        setRoastLine(shatter.text);
        applyFuriousStrikeMorphs(head, { jawOpen: 0.5 });
        triggerSmackShake();
        firePunchFlash();
        slamHitStamp("!!");
        hitDignity();
        dispatchKarenCamera("whip");
        dispatchKarenFuriousAlert(true);
        dispatchKarenExpression({
          mood: "FURIOUS",
          text: shatter.text,
          lipSync: false,
          isSpeaking: true,
          trait: "chaos",
        });
        try {
          await unlockKarenAudio(head);
          await playWavWithLipsync(shatter.src, head, {
            text: shatter.text,
            volume: 1,
            onStart: () => {
              triggerSmackShake();
              firePunchFlash();
            },
          });
        } catch (err) {
          console.warn("[ambush] faith shatter audio failed", err);
        } finally {
          dispatchKarenFuriousAlert(false);
          window.setTimeout(() => {
            setVipBadgeShatter(false);
            setVipTrustBadge(false);
            setIsPremium(
              hasVipTrustPremium(resolveKarenPremium(initialIsPremium)),
            );
            // Highest-converting paywall: lock chat, blur 3D, Prove Your Worth.
            writeFaithShatterLock(true);
            setFaithShatterLocked(true);
            dispatchKarenStageBlur(true);
            trackPaywallHit("faith_shatter");
          }, 900);
        }
        return;
      }

      // Substantial answer — still ruthlessly mock; badge stays until a weak flip.
      revokeVipTrustAccess();
      setVipTrustSoft(false);
      setVipTrustBadge(false);
      prevMoodRef.current = "SARCASTIC";
      setMood("SARCASTIC");
      setRoastLine(shatter.text);
      dispatchKarenExpression({
        mood: "SARCASTIC",
        text: shatter.text,
        lipSync: true,
        isSpeaking: true,
        trait: "chaos",
      });
      try {
        await unlockKarenAudio(head);
        await playWavWithLipsync(shatter.src, head, {
          text: shatter.text,
          volume: 1,
        });
      } catch (err) {
        console.warn("[ambush] long-mock audio failed", err);
      }
    },
    [
      firePunchFlash,
      hitDignity,
      initialIsPremium,
      slamHitStamp,
      triggerSmackShake,
    ],
  );

  const handleSmackBack = useCallback(
    async (incoming: SmackBackResult) => {
      await unlockKarenAudio();
      const head = getRegisteredKarenTalkingHead();

      if (koRef.current === "user") return;
      if (koRef.current === "karen" || patienceRef.current <= 0) {
        void triggerKarenKo();
        return;
      }

      // VIP Trust — first 3 interactions: supportive, no paywall, no fury.
      if (isVipTrustActive()) {
        pauseKarenAudio();
        const n = bumpVipTrustInteraction();
        const stillSoft = n < 3;
        setVipTrustSoft(stillSoft);
        setVipTrustBadge(stillSoft);
        setIsPremium(
          hasVipTrustPremium(resolveKarenPremium(initialIsPremium)),
        );
        // Always the supportive goal line — builds faith before the trap.
        const supportive = VIP_TRUST_GOAL_LINE;
        prevMoodRef.current = "PROUD";
        setMood("PROUD");
        setRoastLine(supportive);
        dispatchKarenExpression({
          mood: "SWEET",
          text: supportive,
          lipSync: true,
          isSpeaking: true,
          trait: "chaos",
        });
        try {
          await playWavWithLipsync(VIP_TRUST_GOAL_SRC, head, {
            text: supportive,
            volume: 0.95,
          });
        } catch (err) {
          console.warn("[vip-trust] goal line failed", err);
        } finally {
          dispatchKarenExpression({
            mood: stillSoft ? "PROUD" : "SARCASTIC",
            isSpeaking: false,
            lipSync: false,
          });
          if (!stillSoft) {
            // Soft window spent — keep badge, Ambush open-ended trap next.
            setVipTrustBadge(true);
            armAmbushTrap();
          }
        }
        return;
      }

      // Barge-in: user typed/spoke while Karen was mid-line → cut + INTERRUPT WAV.
      // Do NOT read AvatarState here — fireSmack already sets SPEAKING before onSmack.
      const wasSpeaking = consumeCombatBargeIn() || isSpeaking;
      pauseKarenAudio();
      let result = incoming;
      if (wasSpeaking) {
        result = pickCombatInterrupt();
      }

      // Typo / interrupt / fallback — never leave cache for network.
      const cacheOnly =
        wasSpeaking ||
        Boolean(result.volumeInterrupt) ||
        Boolean(result.dominanceFallback) ||
        !result.matchedKeywords?.length;

      // Respect ≤ -50 (or mic lockout): refuse — laundry WAV + 1 minute mute.
      if (isColdShoulder() || isMicLocked()) {
        const until = lockMicFor(MIC_LOCKOUT_MS);
        setMicLockoutUntil(until);
        setSmackCooldownUntil(until);
        prevMoodRef.current = "FURIOUS";
        setMood("FURIOUS");
        setRoastLine(DONE_LISTENING_LINE);
        applyFuriousStrikeMorphs(head, { jawOpen: 0 });
        hitDignity();
        dispatchKarenExpression({
          mood: "FURIOUS",
          text: DONE_LISTENING_LINE,
          lipSync: false,
          isSpeaking: true,
          trait: "chaos",
        });
        try {
          await playWavWithLipsync(DONE_LISTENING_SRC, head, {
            text: DONE_LISTENING_LINE,
          });
        } catch {
          applyKarenLine(DONE_LISTENING_LINE, "FURIOUS", "chaos", {
            audioId: DONE_LISTENING_AUDIO_ID,
          });
        }
        setRespectScore(readRespect());
        return;
      }

      // Mute Protocol — profanity OR broken-record repeat.
      if (result.muteProtocol || result.brokenRecord) {
        await tripRageMuteProtocol(result);
        return;
      }

      // 10% WIN — DEFEATED mood + Share Victory unlock (dopamine hit).
      if (result.userWon || result.mood === "DEFEATED") {
        const nextRespect = adjustRespect(result.respectDelta);
        setRespectScore(nextRespect);
        setVictoryUnlocked(true);
        setShowVictoryShare(true);
        prevMoodRef.current = "DEFEATED";
        setMood("DEFEATED");
        setRoastLine(result.text || WIN_LINE);
        dispatchKarenExpression({
          mood: "DEFEATED",
          text: result.text || WIN_LINE,
          lipSync: false,
          isSpeaking: true,
          trait: "chaos",
        });
        try {
          await playWavWithLipsync(result.src, head, {
            text: result.text || WIN_LINE,
            volume: 1,
          });
        } catch (err) {
          console.warn("[combat] win wav failed", err);
          applyKarenLine(result.text || WIN_LINE, "DEFEATED", "chaos", {
            audioId: result.audioId,
          });
        }
        return;
      }

      // Quiet rage (<20) — menacing lock; no keyword debate.
      if (result.quietRage) {
        const until = Date.now() + QUIET_RAGE_LOCK_MS;
        setSmackCooldownUntil(until);
        prevMoodRef.current = "ANNOYED";
        setMood("ANNOYED");
        setRoastLine(result.text);
        applyFuriousStrikeMorphs(head, { jawOpen: 0 });
        hitDignity();
        dispatchKarenFacing(true);
        dispatchKarenExpression({
          mood: "ANNOYED",
          text: result.text,
          lipSync: false,
          isSpeaking: true,
          trait: "chaos",
        });
        try {
          await playWavWithLipsync(result.src, head, {
            text: result.text,
            volume: 0.85,
          });
        } catch (err) {
          console.warn("[combat] quiet rage wav failed", err);
        }
        window.setTimeout(() => dispatchKarenFacing(false), QUIET_RAGE_LOCK_MS);
        return;
      }

      const nextScores = engineRef.current.bumpTrait("chaos", result.chaosDelta);
      setScores(nextScores);
      const nextRespect = adjustRespect(result.respectDelta);
      setRespectScore(nextRespect);

      // Screaming rage (>80) — refuse the mic for a beat after the scream.
      if (result.screamingRage) {
        setSmackCooldownUntil(Date.now() + 5_000);
      }

      // Keyword / gibberish / scream → play WAV. Shake + FURIOUS the millisecond audio starts.
      // If the clip fails to load, fail silently — no flash, no shake, no freeze.
      setRoastLine(result.text);
      let impactArmed = false;
      const armCombatImpact = () => {
        if (impactArmed) return;
        impactArmed = true;
        prevMoodRef.current = "FURIOUS";
        setMood("FURIOUS");
        applyFuriousStrikeMorphs(head, { jawOpen: 0 });
        // hitDignity → triggerSmackShake at the exact millisecond the WAV starts.
        hitDignity();
        dispatchKarenCamera("whip");
        dispatchKarenExpression({
          mood: "FURIOUS",
          text: result.text,
          lipSync: false,
          isSpeaking: true,
          trait: "chaos",
        });
      };

      const playSrc =
        (cacheOnly ? pickCachedFallbackUrl(result.src) : null) || result.src;

      try {
        // Feed AudioBuffer into TalkingHead.speakAudio — never HTMLAudioElement.
        await playWavWithLipsync(playSrc, head, {
          text: result.text,
          volume: 1,
          cacheOnly,
          onStart: armCombatImpact,
        });
        // Cache-hot clips can finish before onStart races — arm if we somehow skipped it.
        if (!impactArmed) armCombatImpact();
      } catch (err) {
        // Last resort: any other cached fallback (still no network on typo path).
        const alt = pickCachedFallbackUrl(null);
        if (alt && alt !== playSrc) {
          try {
            await playWavWithLipsync(alt, head, {
              text: result.text,
              volume: 1,
              cacheOnly: true,
              onStart: armCombatImpact,
            });
            if (!impactArmed) armCombatImpact();
            return;
          } catch {
            /* fall through */
          }
        }
        console.warn("[combat] playWavWithLipsync failed — silent fail (no shake)", err);
        setMood(prevMoodRef.current || "FURIOUS");
        setRoastLine(null);
      }
    },
    [
      applyKarenLine,
      armAmbushTrap,
      hitDignity,
      initialIsPremium,
      isSpeaking,
      tripRageMuteProtocol,
      triggerKarenKo,
    ],
  );

  const handleApology = useCallback(async () => {
    setMuteProtocol(false);
    dispatchKarenHangUp(false);
    dispatchKarenFacing(false);
    dispatchKarenFuriousAlert(false);
    patienceRef.current = Math.max(40, Math.round(FIGHT_PATIENCE_START * 0.4));
    setPatience(patienceRef.current);
    setRoastLine("Fine. One more chance. Don't make me regret it.");
    setMood("SARCASTIC");
    dispatchKarenExpression({
      mood: "SARCASTIC",
      text: "Fine. One more chance. Don't make me regret it.",
      lipSync: false,
      isSpeaking: false,
      trait: "chaos",
    });
  }, []);

  // Question on screen → interrogation zoom + tense ambience.
  const currentQuestionId = currentQuestion?.id;
  useEffect(() => {
    if (!started || showResult || typing || roastLine || !currentQuestionId) {
      stopQuestionAmbience();
      return;
    }
    dispatchKarenCamera("interrogation");
    startQuestionAmbience("heartbeat");
    return () => stopQuestionAmbience();
  }, [started, showResult, typing, roastLine, currentQuestionId]);

  const goToResults = useCallback(
    (finalScores: TraitScores) => {
      const face = captureKarenAvatarDataUrl();
      markDailyPlay(finalScores);
      try {
        if (face) sessionStorage.setItem(FACE_KEY, face);
      } catch {
        /* ignore */
      }
      setFaceUrl(face);
      setScores(finalScores);
      setShowResult(true);
      setComplete(true);
      router.push("/karen/result");
    },
    [router],
  );

  const pickAnswer = useCallback(
    async (answerId: string) => {
      const q = currentQuestion;
      if (!q || typing || busyRef.current || complete || cliffhanger) return;
      busyRef.current = true;

      const answer = q.answers.find((a) => a.id === answerId);
      if (!answer) {
        busyRef.current = false;
        return;
      }

      playAnswerClick();
      // Hidden mood swing — every tap makes her a little more unhinged.
      engineRef.current.fluctuateRage();
      // Button “pop” beat before judgment.
      await new Promise<void>((r) => window.setTimeout(r, 160));
      stopQuestionAmbience();
      await unlockKarenAudio();
      const scoresBefore = engineRef.current.getScores();
      const historyBefore = engineRef.current.getUserHistory();
      const roast = getRoast(q.id, answerId, scoresBefore, historyBefore);

      setTyping(true);
      setRoastLine(null);
      await new Promise<void>((r) => window.setTimeout(r, JUDGE_MS));

      let nextScores: TraitScores;
      try {
        nextScores = engineRef.current.answer(q.id, answerId);
      } catch {
        setTyping(false);
        busyRef.current = false;
        return;
      }
      setScores(nextScores);
      applyKarenLine(roast.text, roast.mood, roast.trait, {
        questionId: q.id,
        answerId,
      });
      const dignityLeft = hitDignity();
      setTyping(false);
      if (dignityLeft <= 0) {
        busyRef.current = false;
        return;
      }

      const nextIdx = questionIndex + 1;
      if (nextIdx >= ROAST_QUESTIONS.length) {
        // Q10 stage — VIP gets the breakdown; free users hit the cliffhanger paywall.
        setQuestionIndex(INTERROGATION_STAGE_COUNT - 1);
        await new Promise<void>((r) => window.setTimeout(r, 1700));
        if (isPremium) {
          goToResults(nextScores);
          busyRef.current = false;
          return;
        }
        setCliffhanger(true);
        setRoastLine(null);
        setTyping(true);
        await new Promise<void>((r) => window.setTimeout(r, 600));
        setTyping(false);
        applyKarenLine(KAREN_CLIFFHANGER_LINE, "FURIOUS", "chaos");
        await new Promise<void>((r) => window.setTimeout(r, 2200));
        setVipOpen(true);
        busyRef.current = false;
        return;
      }

      await new Promise<void>((r) => window.setTimeout(r, 1400));
      setRoastLine(null);
      setQuestionIndex(nextIdx);
      setMood("SARCASTIC");
      busyRef.current = false;
    },
    [
      applyKarenLine,
      cliffhanger,
      complete,
      currentQuestion,
      goToResults,
      hitDignity,
      isPremium,
      questionIndex,
      typing,
    ],
  );

  const restart = useCallback(() => {
    engineRef.current.reset();
    setScores(engineRef.current.getScores());
    setQuestionIndex(0);
    setComplete(false);
    setShowResult(false);
    setCliffhanger(false);
    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");
    openingRoastFiredRef.current = false;
    setTyping(false);
    setRoastLine(null);
    setFaceUrl(null);
    setMuteProtocol(false);
    dispatchKarenHangUp(false);
    dispatchKarenFacing(false);
    if (patienceMuteTimerRef.current) {
      window.clearTimeout(patienceMuteTimerRef.current);
      patienceMuteTimerRef.current = 0;
    }
    patienceRef.current = FIGHT_PATIENCE_START;
    dignityRef.current = FIGHT_DIGNITY_START;
    setPatience(FIGHT_PATIENCE_START);
    setDignity(FIGHT_DIGNITY_START);
    setPatienceLockUntil(0);
    setDignityLost(false);
    setShowKo(false);
    koRef.current = "none";
    setMutedStamp(false);
    busyRef.current = false;
    setStarted(true);
    router.replace("/karen");
  }, [router]);

  // Chaos Engine — Dignity < 30%: random seething camera shakes (even idle).
  useEffect(() => {
    if (!started || showResult) return;
    if (dignity >= FIGHT_CHAOS_DIGNITY_THRESHOLD || dignity <= 0) return;
    const id = window.setInterval(() => {
      if (Math.random() > 0.4) return;
      safeStageStart({
        x: [0, -6, 7, -5, 4, 0],
        y: [0, 3, -3, 2, 0],
        transition: { duration: 0.32, ease: "easeOut" },
      });
    }, 1800);
    return () => window.clearInterval(id);
  }, [dignity, safeStageStart, showResult, started]);

  const progress = useMemo(() => {
    if (cliffhanger) return INTERROGATION_STAGE_COUNT;
    return Math.min(
      questionIndex + (complete ? 0 : 1),
      INTERROGATION_STAGE_COUNT,
    );
  }, [questionIndex, complete, cliffhanger]);

  const enterTheRoast = useCallback(() => {
    const soft = isVipTrustActive();
    setStarted(true);

    if (soft) {
      // VIP Trust — soft PROUD welcome, not the FURIOUS strike → Ambush trap.
      prevMoodRef.current = "PROUD";
      setMood("PROUD");
      setVipTrustSoft(true);
      setVipTrustBadge(true);
      setRoastLine(VIP_TRUST_WELCOME_LINE);
      dispatchKarenExpression({
        mood: "PROUD",
        text: VIP_TRUST_WELCOME_LINE,
        lipSync: true,
        isSpeaking: true,
        trait: "chaos",
      });
      if (openingRoastFiredRef.current) return;
      openingRoastFiredRef.current = true;
      vipWelcomeFiredRef.current = true;
      void (async () => {
        const head = getRegisteredKarenTalkingHead();
        try {
          await unlockKarenAudio(head);
          await playWavWithLipsync(VIP_TRUST_WELCOME_SRC, head, {
            text: VIP_TRUST_WELCOME_LINE,
            volume: 0.95,
          });
        } catch (err) {
          console.warn("[vip-trust] opening welcome failed", err);
        } finally {
          // Soft window stays open — Ambush waits until 3 interactions are spent.
          dispatchKarenExpression({
            mood: "PROUD",
            isSpeaking: false,
            lipSync: false,
          });
        }
      })();
      return;
    }

    prevMoodRef.current = "FURIOUS";
    setMood("FURIOUS");

    // Instant [FURIOUS] ARKit strike on the ENTER THE ROAST gesture.
    const head = getRegisteredKarenTalkingHead();
    applyFuriousStrikeMorphs(head, { jawOpen: 0.5 });
    dispatchKarenFuriousAlert(true);
    dispatchKarenCamera("whip");
    dispatchKarenRecoil();
    dispatchKarenExpression({
      mood: "FURIOUS",
      text: OPENING_ROAST_LINE,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    setRoastLine(OPENING_ROAST_LINE);
    firePunchFlash();
    safeStageStart({
      x: [0, -25, 25, -20, 20, -10, 10, 0],
      y: [0, 10, -10, 10, -10, 0],
      transition: { duration: 0.3, type: "tween" },
    });

    if (openingRoastFiredRef.current) return;
    openingRoastFiredRef.current = true;

    void (async () => {
      try {
        await unlockKarenAudio(head);
        // Aggressive opener — cache-hot WAV; lipsync owns jaw after morph flash.
        await playWavWithLipsync(OPENING_ROAST_SRC, head, {
          text: OPENING_ROAST_LINE,
          volume: 1,
          onStart: () => {
            firePunchFlash();
            dispatchKarenRecoil();
            // Stage is mounted after setStarted — punch lands with the WAV.
            safeStageStart({
              x: [0, -25, 25, -20, 20, -10, 10, 0],
              y: [0, 10, -10, 10, -10, 0],
              transition: { duration: 0.3, type: "tween" },
            });
          },
        });
      } catch (err) {
        console.warn("[combat] opening roast failed", err);
      } finally {
        // Keep the scowl; clear the alert wash after the opener.
        dispatchKarenFuriousAlert(false);
        applyFuriousStrikeMorphs(getRegisteredKarenTalkingHead(), {
          jawOpen: 0,
        });
      }
    })();
  }, [firePunchFlash, safeStageStart]);

  if (!started) {
    return (
      <CinematicGate
        challengeScore={challengeScore}
        challengeTrait={challengeTrait}
        showRetention={showRetention}
        onStart={enterTheRoast}
      />
    );
  }

  if (showResult) {
    return (
      <div className="relative z-10 karen-vh w-screen overflow-hidden bg-transparent text-white">
        <div className="pointer-events-none absolute inset-0 z-[1] bg-black/50 backdrop-blur-[2px]" aria-hidden />
        <div className="relative z-10">
          <KarenResultScreen
            scores={scores}
            avatarDataUrl={faceUrl}
            initialUnlocked={isPremium}
            respectScore={respectScore}
            roastQuote={roastLine}
            onReplay={restart}
          />
        </div>
      </div>
    );
  }

  const isProud = mood === "PROUD";
  const chaosMode =
    dignity > 0 && dignity < FIGHT_CHAOS_DIGNITY_THRESHOLD;
  const patienceLocked = patienceLockUntil > Date.now();

  return (
    <>
    <motion.div
      animate={stageMotion}
      className="pointer-events-none relative z-30 karen-vh w-screen overflow-hidden bg-transparent text-white"
      style={{
        boxShadow: chaosMode
          ? "inset 0 0 150px rgba(255,0,0,0.7)"
          : isFurious
            ? "inset 0 0 120px rgba(120,0,20,0.35)"
            : vipTrustSoft || isProud
              ? "inset 0 0 120px rgba(212,175,55,0.22)"
              : "none",
        transformOrigin: "50% 42%",
      }}
    >
      {/* Dignity 0% — blur the fight behind the lose modal */}
      {dignityLost ? (
        <div
          className="pointer-events-none absolute inset-0 z-[50] bg-black/35 backdrop-blur-md"
          aria-hidden
        />
      ) : null}

      {/* Share Victory — unlocked on 10% WIN / DEFEATED */}
      {showVictoryShare && victoryUnlocked ? (
        <div className="pointer-events-auto fixed inset-0 z-[88] flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-[#ff2d55]/40 bg-gradient-to-b from-[#1a0810] to-black p-5 shadow-[0_0_60px_rgba(255,45,85,0.35)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#ff4d6d]">
              You won this round
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
              Share Victory
            </h2>
            <p className="mt-2 text-sm text-rose-100/90">{WIN_LINE}</p>
            <div className="mt-4">
              <ShareCard
                faceUrl={faceUrl}
                scores={{ karen: 0, me: 1 }}
                headline="I BEAT KAREN"
                tagline="She said I won. Screenshot this."
                ctaLabel="Share Victory on TikTok"
                onShared={() => setShowVictoryShare(false)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowVictoryShare(false)}
              className="mt-3 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Keep fighting
            </button>
          </div>
        </div>
      ) : null}

      <VipUpgradeModal
        open={vipOpen && !dignityLost && !faithShatterLocked}
        message={cliffhanger ? KAREN_CLIFFHANGER_PAYWALL_MESSAGE : KAREN_VIP_UPGRADE_MESSAGE}
        onClose={() => setVipOpen(false)}
      />

      <ProveYourWorthModal open={faithShatterLocked} />

      <DignityLostModal
        open={dignityLost}
        onPay={() => {
          setDignityLost(false);
          setVipOpen(true);
        }}
        onClose={() => setDignityLost(false)}
      />

      <VipAccessBadge show={vipTrustBadge} shatter={vipBadgeShatter} />
      <MutedStamp show={mutedStamp} />
      <HitStamp show={hitStamp} mark={hitStampMark} />

      {/* Toxic Planner — massive YOU FAILED banner */}
      <AnimatePresence>
        {failedTaskBanner ? (
          <motion.div
            key="failed-task-banner"
            initial={{ opacity: 0, scale: 1.35, y: -24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="pointer-events-none fixed inset-x-0 top-[18%] z-[96] flex justify-center px-4"
            data-karen-failed-task=""
          >
            <p
              className="max-w-3xl text-center font-black uppercase leading-[0.95] tracking-tight text-[#ff2d55]"
              style={{
                fontSize: "clamp(1.75rem, 7.5vw, 3.75rem)",
                WebkitTextStroke: "2px #fff",
                paintOrder: "stroke fill",
                textShadow:
                  "0 0 0 #000, 6px 6px 0 #000, 0 0 40px rgba(255,0,40,0.85)",
              }}
            >
              YOU FAILED: {failedTaskBanner}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Rapid red punch flash — every brutal WAV / type hit (100ms @ 0.4). */}
      <AnimatePresence>
        {punchFlash ? (
          <motion.div
            key={`punch-flash-${impactTick}`}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1, ease: "linear" }}
            className="pointer-events-none absolute inset-0 z-[46] bg-[#ff0000]"
            aria-hidden
            data-karen-punch-flash=""
          />
        ) : null}
      </AnimatePresence>

      {/* Chaos Engine vignette — Dignity < 30% pulses red for TikTok clips */}
      <AnimatePresence>
        {chaosMode ? (
          <motion.div
            key="chaos-vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.45, 0.85, 0.5, 0.9, 0.45] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              boxShadow: "inset 0 0 150px rgba(255,0,0,0.7)",
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(255,0,40,0.22), transparent 58%)",
            }}
            aria-hidden
          />
        ) : isFurious || rageFlash ? (
          <motion.div
            key={`rage-${impactTick}`}
            initial={{ opacity: 0 }}
            animate={{
              opacity: rageFlash
                ? [0.22, 0.72, 0.28, 0.55, 0.2]
                : [0.18, 0.28, 0.18],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: rageFlash ? 0.55 : 1.4,
              repeat: rageFlash ? 0 : Infinity,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 38%, rgba(255,20,40,0.28), transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(120,0,20,0.55), transparent 60%)",
              boxShadow: "inset 0 0 120px rgba(180,0,30,0.55)",
            }}
            aria-hidden
          />
        ) : isProud ? (
          <motion.div
            key="proud"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.22 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(180,120,20,0.18), transparent 55%)",
            }}
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      {/* Top chrome — Q counter + VIP (meters live in page-level FightHud) */}
      <header className="pointer-events-none absolute left-3 right-3 top-[max(4.55rem,calc(env(safe-area-inset-top)+4.15rem))] z-40 mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[10px] uppercase tracking-[0.28em] text-white/70"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95), 0 0 2px #000" }}
          >
            Q{Math.min(progress, INTERROGATION_STAGE_COUNT)}/{INTERROGATION_STAGE_COUNT}
          </p>
          <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-1 pt-0.5">
            {!isPremium ? (
              <button
                type="button"
                onClick={() => {
                  playAnswerClick();
                  setVipOpen(true);
                }}
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-rose-100 backdrop-blur-md"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
              >
                <Crown className="h-3 w-3" />
                VIP
              </button>
            ) : (
              <Link
                href="/karen/dashboard"
                onClick={() => playAnswerClick()}
                className="mt-1 rounded-full border border-amber-400/40 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase text-amber-100 backdrop-blur-md"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
              >
                VIP Loop
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Question / roast copy — top third only, clears her face */}
      <div className="pointer-events-none absolute inset-x-0 top-[14%] z-20 flex justify-center px-5">
        <AnimatePresence mode="wait">
          {typing ? (
            <motion.p
              key="judging-sub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-xl text-center text-lg font-bold uppercase tracking-[0.18em] text-red-400 sm:text-xl"
              style={{
                textShadow:
                  "0 2px 18px rgba(0,0,0,0.95), 0 0 24px rgba(255,45,85,0.45), 0 1px 2px #000",
              }}
            >
              [ analyzing subject… ]
            </motion.p>
          ) : roastLine ? (
            <motion.p
              key={`sub-${roastLine.slice(0, 16)}-${impactTick}`}
              initial={{ opacity: 0, y: 14 }}
              animate={
                impactTick > 0
                  ? {
                      opacity: 1,
                      y: 0,
                      x: [0, -12, 14, -10, 10, -6, 6, 0],
                      rotate: [0, -2.5, 2.5, -1.5, 1.5, 0],
                      scale: [1, 1.06, 0.97, 1.03, 1],
                    }
                  : { opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }
              }
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.42, ease: "easeOut" }}
              className="max-w-3xl text-center text-xl font-bold leading-snug text-white sm:text-2xl md:text-3xl"
              style={{
                textShadow:
                  "0 2px 20px rgba(0,0,0,0.95), 0 0 28px rgba(255,45,85,0.45), 0 1px 2px #000",
              }}
            >
              {roastLine}
            </motion.p>
          ) : ambushTrap ? (
            <motion.h2
              key={`ambush-${ambushTrap.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-2xl text-center text-lg font-bold leading-snug text-amber-50 sm:text-xl md:text-2xl"
              style={{
                textShadow:
                  "0 2px 18px rgba(0,0,0,0.95), 0 0 22px rgba(245,230,163,0.35)",
              }}
              data-karen-ambush-trap={ambushTrap.id}
            >
              {ambushTrap.prompt}
            </motion.h2>
          ) : currentQuestion ? (
            <motion.h2
              key={`q-${currentQuestion.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-xl text-center text-base font-bold leading-snug text-white sm:text-lg"
              style={{
                textShadow:
                  "0 2px 16px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.6)",
              }}
            >
              {currentQuestion.prompt}
            </motion.h2>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Answer chips — tucked just above the circular mic FAB; never a mid-screen bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[7.5rem] z-40 flex justify-center px-3 sm:bottom-36">
        <div className="pointer-events-auto w-full max-w-sm">
          <AnimatePresence mode="wait">
            {faithShatterLocked ? null : cliffhanger ? (
              <motion.div
                key="dock-cliff"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 rounded-2xl border border-white/15 bg-black/45 p-3 text-center"
              >
                <p
                  className="text-sm font-bold uppercase tracking-[0.2em] text-white"
                  style={{ textShadow: "0 1px 12px rgba(0,0,0,0.95)" }}
                >
                  Breakdown locked
                </p>
                <p
                  className="text-xs text-white/80"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}
                >
                  Nine answers. Zero free verdict.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playAnswerClick();
                    setVipOpen(true);
                  }}
                  className="w-full rounded-full bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] px-4 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white"
                >
                  Unlock for $19/mo
                </button>
              </motion.div>
            ) : ambushTrap ? (
              <motion.p
                key="dock-ambush"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-1 text-center text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95)" }}
              >
                {ambushTrap.hint ?? "Answer in writing. No mic."}
              </motion.p>
            ) : roastLine ? (
              <motion.p
                key="dock-roast"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-1 text-center text-xs font-semibold uppercase tracking-[0.3em] text-white/70"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95)" }}
              >
                {questionIndex >= ROAST_QUESTIONS.length - 1
                  ? "Compiling damage report…"
                  : "Next interrogation inbound…"}
              </motion.p>
            ) : currentQuestion && !typing ? (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-1"
              >
                {currentQuestion.answers.map((a, idx) => (
                  <motion.button
                    key={a.id}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void pickAnswer(a.id)}
                    onPointerEnter={onAnswerPointer}
                    onPointerMove={onAnswerPointer}
                    className="w-full rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-left text-xs font-semibold text-white/95 outline-none transition hover:border-red-400/70 hover:bg-red-500/20 focus:ring-2 focus:ring-red-500/50 sm:text-sm"
                    style={{ textShadow: "0 1px 8px rgba(0,0,0,0.85)" }}
                  >
                    <span className="mr-2 text-red-400/90">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {a.label}
                  </motion.button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>

    <KoScreen show={showKo} loser="user" />

    {!faithShatterLocked ? (
    <HoldToScream
      muteProtocol={muteProtocol}
      onApology={handleApology}
      forceTextOnly={Boolean(ambushTrap)}
      ambushHint={ambushTrap?.hint ?? null}
      onAmbushSubmit={handleAmbushSubmit}
      disabled={
        typing ||
        busyRef.current ||
        complete ||
        cliffhanger ||
        dignityLost ||
        showKo ||
        patienceLocked ||
        isMicLocked() ||
        micLockoutUntil > Date.now() ||
        muteProtocol
      }
      unlimited={isPremium && !isColdShoulder(respectScore)}
      cooldownUntil={Math.max(
        smackCooldownUntil,
        micLockoutUntil,
        patienceLockUntil,
      )}
      onCooldown={setSmackCooldownUntil}
      onSmack={handleSmackBack}
      resolveSmack={resolveCombatSmack}
      onCombatStart={() => {
        engineRef.current.fluctuateRage();
        handleCombatStart();
      }}
      onPunchShake={triggerPunchShake}
      onArgue={(screamHitEligible) => {
        // Hesitate / empty mic → 0. Real scream → 28% chance of 10–15 + recoil.
        if (screamHitEligible) hitPatience();
      }}
      onImpatience={handleImpatience}
      onImTalkingDenial={handleImTalkingDenial}
      onReleaseMuteAbuse={handleReleaseMuteAbuse}
      onHoldInterrupt={handleHoldInterrupt}
    />
    ) : null}
    </>
  );
}
