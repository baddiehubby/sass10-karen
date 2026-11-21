"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Bell, BellOff, Crosshair, Lock, Shield } from "lucide-react";
import dynamic from "next/dynamic";

import { saveKarenAccountabilityState } from "@/app/karen/actions";
import { EveningCheckInModal } from "@/components/karen/evening-checkin-modal";
import { SmackBackPanel } from "@/components/karen/smack-back-panel";
import { VipUpgradeModal } from "@/components/karen/vip-upgrade-modal";
import type { SmackBackResult } from "@/lib/karen/smack-back";
import {
  defaultAccountabilityState,
  hasTrackableGoal,
  localDayKey,
  readAccountabilityState,
  shouldActivateEveningCheckIn,
  writeAccountabilityState,
  type AccountabilityGoalId,
  type AccountabilityState,
} from "@/lib/karen/accountability";
import {
  accountabilitySyncFailure,
  accountabilitySyncNote,
} from "@/lib/karen/accountability-sync";
import {
  readKarenAlarmRage,
  saveKarenAlarmConfig,
} from "@/lib/karen/alarm-storage";
import {
  AFTERNOON_NUDGE_SPEECH,
  consumeAfternoonNudgePendingSpeech,
  showAfternoonHostileNotification,
  urlRequestsAfternoonNudge,
} from "@/lib/karen/afternoon-nudge";
import {
  MORNING_ROAST_LINE,
  MORNING_ROAST_SPEECH_RATE,
  consumeMorningRoastPendingSpeech,
  disableMorningRoast,
  enableMorningRoast,
  isMorningRoastEnabled,
  isMorningRoastHour,
  showMorningRoastNotification,
  urlRequestsMorningRoast,
} from "@/lib/karen/morning-roast";
import {
  adjustRespect,
  completeTaskForRespect,
  daysWithoutDisappointment,
  isColdShoulder,
  isRareRoastUnlocked,
  RARE_ROAST_AUDIO_ID,
  RARE_ROAST_LINE,
  readRespect,
  RESPECT_COLD_SHOULDER,
  RESPECT_MAX,
} from "@/lib/karen/state";
import {
  dispatchKarenExpression,
  dispatchKarenFacing,
  subscribeKarenRageShake,
} from "@/lib/karen/talkinghead-bus";
import {
  getRegisteredKarenTalkingHead,
  speakLocalRoast,
  unlockKarenAudio,
} from "@/lib/karen/voice";
import { KAREN_VIP_LOCKED_MODAL, isDevVipMode, resolveKarenPremium } from "@/lib/karen/vip";

const Karen3D = dynamic(() => import("@/components/Karen3D"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-zinc-950" />,
});

type KarenDashboardClientProps = {
  isPremium: boolean;
  isSignedIn: boolean;
  initialServerState?: AccountabilityState | null;
};

function mergeInitialState(
  server: AccountabilityState | null | undefined,
): AccountabilityState {
  const local = readAccountabilityState();
  if (!server) return local;
  // Prefer richer Goal Tracker text; always prefer local check-in completion.
  const serverText = `${server.commitment || ""}${server.mainGoal || ""}`.trim();
  const localText = `${local.commitment || ""}${local.mainGoal || ""}`.trim();
  const useLocalText = localText.length >= serverText.length;
  return writeAccountabilityState({
    day: localDayKey(),
    goals: local.goals,
    mainGoal: useLocalText ? local.mainGoal : server.mainGoal || "",
    wakeUpTime: local.wakeUpTime || server.wakeUpTime || "07:00",
    commitment: useLocalText ? local.commitment : server.commitment || "",
    checkInCompletedDay:
      local.checkInCompletedDay || server.checkInCompletedDay || null,
  });
}

/**
 * Premium Accountability Loop dashboard — local goals + 8 PM Karen check-in.
 */
export function KarenDashboardClient({
  isPremium,
  isSignedIn,
  initialServerState,
}: KarenDashboardClientProps) {
  // Always start from the SSR-safe default: reading localStorage here made the first
  // client render differ from the server HTML (hydration error for anyone with saved
  // goals). The mount effect below merges local + server state.
  const [state, setState] = useState<AccountabilityState>(() => defaultAccountabilityState());
  const [setupDetail, setSetupDetail] = useState<string | null>(null);
  const [checkInActive, setCheckInActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [premium, setPremium] = useState(isPremium);
  const [morningOn, setMorningOn] = useState(false);
  const [morningDetail, setMorningDetail] = useState<string | null>(null);
  const [morningBusy, setMorningBusy] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [respect, setRespect] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [cold, setCold] = useState(false);
  const [rareUnlocked, setRareUnlocked] = useState(false);
  const [smackLine, setSmackLine] = useState<string | null>(null);
  const [smackCooldownUntil, setSmackCooldownUntil] = useState(0);
  const morningSpokeRef = useRef(false);
  const [sync, setSync] = useState<{ tone: "info" | "ok" | "warn"; text: string } | null>(
    null,
  );
  /** Monotonic ticket so an older, slower save can't overwrite a newer status. */
  const syncSeq = useRef(0);
  const screenShake = useAnimationControls();

  const refreshRetention = useCallback(() => {
    const nextRespect = readRespect();
    const nextStreak = daysWithoutDisappointment();
    const nextCold = isColdShoulder(nextRespect);
    setRespect(nextRespect);
    setStreakDays(nextStreak);
    setCold(nextCold);
    setRareUnlocked(isRareRoastUnlocked(nextStreak));
    dispatchKarenFacing(nextCold);
  }, []);

  const requirePremium = useCallback(() => {
    setVipModalOpen(true);
  }, []);

  const interruptWithMorningRoast = useCallback(async () => {
    if (morningSpokeRef.current) return;
    morningSpokeRef.current = true;
    await unlockKarenAudio();
    dispatchKarenExpression({ mood: "FURIOUS", isSpeaking: true, trait: "laziness" });
    await speakLocalRoast(MORNING_ROAST_LINE, {
      mood: "FURIOUS",
      trait: "laziness",
      rate: MORNING_ROAST_SPEECH_RATE,
      head: getRegisteredKarenTalkingHead(),
      audioId: "system:morning",
    });
  }, []);

  const interruptWithAfternoonNudge = useCallback(async () => {
    await unlockKarenAudio();
    dispatchKarenExpression({ mood: "ANGRY", isSpeaking: true, trait: "laziness" });
    await speakLocalRoast(AFTERNOON_NUDGE_SPEECH, {
      mood: "ANGRY",
      trait: "laziness",
      rate: 1.3,
      head: getRegisteredKarenTalkingHead(),
      audioId: "system:afternoon",
    });
  }, []);

  useEffect(() => {
    setState(mergeInitialState(initialServerState));
    // TEMPORARY LOCAL BYPASS — client forces VIP in development.
    setPremium(resolveKarenPremium(isPremium));
    setMorningOn(isMorningRoastEnabled());
    refreshRetention();
    setHydrated(true);
  }, [initialServerState, isPremium, refreshRetention]);

  // Opened via notification → immediate angry avatar speech.
  useEffect(() => {
    if (!hydrated || !premium) return;
    const params = new URLSearchParams(window.location.search);
    const fromAfternoon =
      urlRequestsAfternoonNudge(params) || consumeAfternoonNudgePendingSpeech();
    if (fromAfternoon) {
      window.history.replaceState({}, "", "/karen/dashboard");
      void interruptWithAfternoonNudge();
      return;
    }
    const fromMorning =
      urlRequestsMorningRoast(params) || consumeMorningRoastPendingSpeech();
    if (!fromMorning) return;
    window.history.replaceState({}, "", "/karen/dashboard");
    void interruptWithMorningRoast();
  }, [hydrated, premium, interruptWithMorningRoast, interruptWithAfternoonNudge]);

  useEffect(() => {
    if (!hydrated || !premium) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "KAREN_MORNING_ROAST_FIRE") {
        void interruptWithMorningRoast();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [hydrated, premium, interruptWithMorningRoast]);

  useEffect(() => subscribeKarenRageShake(() => {
    void screenShake.start({
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4, ease: "easeInOut" },
    });
  }), [screenShake]);

  // Evening interrogation — 8:00 PM local, poll every 10s.
  useEffect(() => {
    if (!hydrated || !premium) return;

    const tick = () => {
      const latest = readAccountabilityState();
      if (shouldActivateEveningCheckIn(latest)) {
        setCheckInActive(true);
      }
    };

    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, [
    hydrated,
    premium,
    state.commitment,
    state.mainGoal,
    state.goals,
    state.checkInCompletedDay,
  ]);

  // Client-side 7:00 AM tick (works while the dashboard tab is open).
  useEffect(() => {
    if (!hydrated || !premium || !morningOn) return;

    const tick = () => {
      if (!isMorningRoastEnabled()) return;
      if (!isMorningRoastHour()) return;
      void showMorningRoastNotification();
    };

    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [hydrated, premium, morningOn]);

  // Hostile 2:00 PM nudge — if goals are set and evening check-in isn't done.
  useEffect(() => {
    if (!hydrated || !premium) return;

    const tick = () => {
      const latest = readAccountabilityState();
      void showAfternoonHostileNotification({
        hasGoals: hasTrackableGoal(latest),
        checkInDoneToday: latest.checkInCompletedDay === localDayKey(),
      });
    };

    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [hydrated, premium, state.commitment, state.mainGoal, state.goals, state.checkInCompletedDay]);

  const toggleMorningRoast = useCallback(async () => {
    if (!premium) {
      requirePremium();
      return;
    }
    setMorningBusy(true);
    setMorningDetail(null);
    try {
      if (morningOn) {
        await disableMorningRoast();
        setMorningOn(false);
        setMorningDetail("Morning Roast disabled.");
      } else {
        await unlockKarenAudio();
        const result = await enableMorningRoast();
        setMorningOn(result.ok);
        setMorningDetail(result.detail);
      }
    } finally {
      setMorningBusy(false);
    }
  }, [morningOn, premium, requirePremium]);

  /**
   * Write to localStorage (instant, offline) then to Prisma (durable) and
   * report the REAL outcome — never claim "synced" unless the DB write succeeded.
   */
  const persist = useCallback(
    (next: AccountabilityState) => {
      const written = writeAccountabilityState(next);
      setState(written);
      if (!isSignedIn) {
        setSync({ tone: "info", text: accountabilitySyncNote("guest") });
        return written;
      }
      const ticket = ++syncSeq.current;
      setSync({ tone: "info", text: "Saving to your account…" });
      void saveKarenAccountabilityState(written)
        .catch(() => accountabilitySyncFailure("unknown"))
        .then((result) => {
          if (ticket !== syncSeq.current) return; // a newer save owns the status
          setSync({
            tone: result.ok ? "ok" : "warn",
            text: accountabilitySyncNote(result),
          });
        });
      return written;
    },
    [isSignedIn],
  );

  const saveGoalTracker = useCallback(() => {
    if (!premium) {
      requirePremium();
      return;
    }
    void unlockKarenAudio();
    const next = persist({
      ...state,
      day: localDayKey(),
      mainGoal: state.mainGoal.trim(),
      wakeUpTime: state.wakeUpTime,
      commitment: state.commitment.trim(),
    });
    // Mirror wake-up into the Karen alarm so morning rage stays in sync.
    if (/^\d{2}:\d{2}$/.test(next.wakeUpTime)) {
      try {
        saveKarenAlarmConfig({
          time: next.wakeUpTime,
          rage: readKarenAlarmRage(),
          enabled: true,
        });
      } catch {
        /* ignore */
      }
    }
    if (next.commitment.trim() && isColdShoulder()) {
      completeTaskForRespect();
      refreshRetention();
    }
    setSetupDetail(
      hasTrackableGoal(next)
        ? `Saved. Evening interrogation arms at 8:00 PM for “${next.commitment || next.mainGoal}”.`
        : "Need a Main Goal or Commitment — Karen needs something to mock.",
    );
  }, [persist, premium, refreshRetention, requirePremium, state]);

  const onCheckInComplete = useCallback(
    (_goal: AccountabilityGoalId, _didIt: boolean) => {
      persist({
        ...state,
        day: localDayKey(),
        checkInCompletedDay: localDayKey(),
      });
      refreshRetention();
      setCheckInActive(false);
    },
    [persist, refreshRetention, state],
  );

  const playRareRoast = useCallback(async () => {
    if (!rareUnlocked) return;
    await unlockKarenAudio();
    dispatchKarenFacing(false);
    dispatchKarenExpression({ mood: "SARCASTIC", isSpeaking: true });
    await speakLocalRoast(RARE_ROAST_LINE, {
      mood: "SARCASTIC",
      head: getRegisteredKarenTalkingHead(),
      audioId: RARE_ROAST_AUDIO_ID,
      ignoreColdShoulder: true,
    });
  }, [rareUnlocked]);

  const handleSmackBack = useCallback(async (result: SmackBackResult) => {
    await unlockKarenAudio();
    adjustRespect(result.respectDelta);
    setSmackLine(result.text);
    void screenShake.start({
      x: [0, -10, 12, -8, 6, -3, 0],
      y: [0, 4, -5, 3, -2, 0],
      transition: { duration: 0.55, ease: "easeOut" },
    });
    dispatchKarenFacing(false);
    dispatchKarenExpression({
      mood: "FURIOUS",
      text: result.text,
      lipSync: false,
      isSpeaking: true,
      trait: "chaos",
    });
    const { playWavWithLipsync } = await import("@/lib/karen/voice");
    try {
      await playWavWithLipsync(result.src, getRegisteredKarenTalkingHead(), {
        text: result.text,
        volume: 1,
      });
    } catch {
      await speakLocalRoast(result.text, {
        mood: "FURIOUS",
        trait: "chaos",
        head: getRegisteredKarenTalkingHead(),
        audioId: result.audioId,
        ignoreColdShoulder: true,
      });
    }
  }, [screenShake]);

  const trackerArmed = hasTrackableGoal(state);

  return (
    <motion.div
      animate={screenShake}
      className="relative karen-vh w-screen overflow-hidden bg-[#050305] text-white"
    >
      <VipUpgradeModal
        open={vipModalOpen}
        message={KAREN_VIP_LOCKED_MODAL}
        onClose={() => setVipModalOpen(false)}
      />

      <div className="absolute inset-0 z-0">
        <Karen3D mood="SARCASTIC" isSpeaking={false} className="absolute inset-0" />
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(255,45,85,0.18),transparent_50%)]"
          aria-hidden
        />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-lg flex-col overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-red-400">
              Karen · {premium ? "VIP" : "Locked"}
              {cold ? " · Cold shoulder" : ""}
              {premium && isDevVipMode() ? " · Dev bypass" : ""}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              VIP Dashboard
            </h1>
          </div>
          {premium ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-200">
              <Shield className="h-3 w-3" />
              Premium
            </span>
          ) : (
            <button
              type="button"
              onClick={requirePremium}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase text-zinc-300"
            >
              <Lock className="h-3 w-3" />
              Free
            </button>
          )}
        </header>

        {premium ? (
          <Link
            href="/karen?replay=1"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] px-4 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(255,45,85,0.45)]"
          >
            <Crosshair className="h-4 w-4" />
            Daily Interrogation
          </Link>
        ) : (
          <button
            type="button"
            onClick={requirePremium}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400"
          >
            <Lock className="h-4 w-4" />
            Daily Interrogation · Locked
          </button>
        )}

        <section className="relative mt-4 rounded-[1.5rem] border border-white/15 bg-black/55 p-5 backdrop-blur-2xl">
          {!premium ? (
            <div className="pointer-events-none absolute inset-0 z-[1] rounded-[1.5rem] bg-black/35 backdrop-blur-[2px]" />
          ) : null}
          <div className={!premium ? "relative z-0 opacity-50" : undefined}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                  Retention
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Respect Score</h2>
              </div>
              <p
                className={
                  respect <= RESPECT_COLD_SHOULDER
                    ? "text-2xl font-black text-red-400"
                    : respect >= 50
                      ? "text-2xl font-black text-emerald-300"
                      : "text-2xl font-black text-zinc-100"
                }
              >
                {respect}
                <span className="text-sm font-semibold text-zinc-500">/{RESPECT_MAX}</span>
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={
                  respect <= RESPECT_COLD_SHOULDER
                    ? "h-full rounded-full bg-red-500"
                    : "h-full rounded-full bg-gradient-to-r from-[#ff1a3c] to-amber-300"
                }
                style={{
                  width: `${Math.max(0, Math.min(100, ((respect - RESPECT_COLD_SHOULDER) / (RESPECT_MAX - RESPECT_COLD_SHOULDER)) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-4 text-sm text-zinc-300">
              Days Without Disappointment:{" "}
              <span className="font-black text-white">{streakDays}</span>
            </p>
            {cold ? (
              <p className="mt-2 text-xs text-red-300">
                She turned her back. Commit to a goal (or beg tonight) before she speaks again.
              </p>
            ) : null}
            {rareUnlocked ? (
              <button
                type="button"
                onClick={() => void playRareRoast()}
                className="mt-4 w-full rounded-2xl border border-violet-400/40 bg-violet-500/15 px-4 py-3 text-sm font-bold uppercase tracking-wide text-violet-100"
              >
                Play Rare Roast
              </button>
            ) : (
              <p className="mt-3 text-[11px] text-zinc-500">
                Hit a 3-day streak to unlock the Rare Roast.
              </p>
            )}
          </div>
          {!premium ? (
            <button
              type="button"
              onClick={requirePremium}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 rounded-[1.5rem]"
            >
              <Lock className="h-8 w-8 text-rose-200" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-rose-100">
                Respect · Locked
              </span>
            </button>
          ) : null}
        </section>

        <section className="relative mt-4 rounded-[1.5rem] border border-white/15 bg-black/55 p-5 backdrop-blur-2xl">
          {!premium ? (
            <div className="pointer-events-none absolute inset-0 z-[1] rounded-[1.5rem] bg-black/35 backdrop-blur-[2px]" />
          ) : null}
          <div className={!premium ? "relative z-0 opacity-50" : undefined}>
            <h2 className="text-lg font-semibold text-white">
              What are you failing at today?
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Goal Tracker — set it once. At 8:00 PM she asks if you actually did it.
            </p>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                  Main Goal
                </span>
                <input
                  type="text"
                  value={state.mainGoal}
                  maxLength={120}
                  placeholder="Ship the product / get lean / stop lying to myself"
                  disabled={!premium}
                  onChange={(e) =>
                    setState((s) => ({ ...s, mainGoal: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/30 disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                  Wake-up Time
                </span>
                <input
                  type="time"
                  value={state.wakeUpTime}
                  disabled={!premium}
                  onChange={(e) =>
                    setState((s) => ({ ...s, wakeUpTime: e.target.value || "07:00" }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-3 text-sm text-white outline-none focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/30 disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                  Commitment
                </span>
                <input
                  type="text"
                  value={state.commitment}
                  maxLength={160}
                  placeholder='e.g. "Go to the gym"'
                  disabled={!premium}
                  onChange={(e) =>
                    setState((s) => ({ ...s, commitment: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/30 disabled:opacity-50"
                />
              </label>
              <button
                type="button"
                disabled={!premium}
                onClick={saveGoalTracker}
                className="w-full rounded-2xl bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] px-4 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_24px_rgba(255,45,85,0.4)] disabled:opacity-50"
              >
                Save today&apos;s failure plan
              </button>
              {setupDetail ? (
                <p className="text-xs text-zinc-400">{setupDetail}</p>
              ) : null}
              {sync ? (
                <p
                  role="status"
                  aria-live="polite"
                  data-testid="goal-sync-status"
                  className={
                    sync.tone === "ok"
                      ? "text-xs font-semibold text-emerald-300"
                      : sync.tone === "warn"
                        ? "text-xs font-semibold text-amber-300"
                        : "text-xs text-zinc-400"
                  }
                >
                  {sync.text}
                  {!isSignedIn ? (
                    <>
                      {" "}
                      <Link
                        href="/login?callbackUrl=/karen/dashboard"
                        className="underline underline-offset-2 hover:text-white"
                      >
                        Sign in to sync across devices
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
          {!premium ? (
            <button
              type="button"
              onClick={requirePremium}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 rounded-[1.5rem]"
            >
              <Lock className="h-8 w-8 text-rose-200" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-rose-100">
                Goal Tracker · Locked
              </span>
            </button>
          ) : (
            <p className="mt-4 text-xs text-zinc-500">
              {!trackerArmed
                ? "Fill Main Goal or Commitment — or Karen has nothing to work with."
                : state.checkInCompletedDay === localDayKey()
                  ? "Tonight's check-in is done. Try not to undo it."
                  : "Armed. Evening interrogation fires at 8:00 PM."}
            </p>
          )}
        </section>

        <section className="relative mt-4 rounded-[1.5rem] border border-white/15 bg-black/55 p-5 backdrop-blur-2xl">
          {!premium ? (
            <div className="pointer-events-none absolute inset-0 z-[1] rounded-[1.5rem] bg-black/35 backdrop-blur-[2px]" />
          ) : null}
          <div className={!premium ? "relative z-0 opacity-50" : undefined}>
            <h2 className="text-lg font-semibold text-white">Unlimited Smack Back</h2>
            <p className="mt-1 text-sm text-zinc-400">
              VIP arena — argue without the 10s lockout. She stays FURIOUS.
            </p>
            {premium ? (
              <div className="mt-4 space-y-3">
                <SmackBackPanel
                  unlimited
                  layout="inline"
                  cooldownUntil={smackCooldownUntil}
                  onCooldown={setSmackCooldownUntil}
                  onSmack={handleSmackBack}
                />
                {smackLine ? (
                  <p className="karen-hud text-sm leading-snug text-rose-100">
                    &gt; {smackLine}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {!premium ? (
            <button
              type="button"
              onClick={requirePremium}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 rounded-[1.5rem]"
            >
              <Lock className="h-8 w-8 text-rose-200" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-rose-100">
                Smack Arena · Locked
              </span>
            </button>
          ) : null}
        </section>

        <section className="relative mt-4 rounded-[1.5rem] border border-white/15 bg-black/55 p-5 backdrop-blur-2xl">
          {!premium ? (
            <div className="pointer-events-none absolute inset-0 z-[1] rounded-[1.5rem] bg-black/35 backdrop-blur-[2px]" />
          ) : null}
          <div className={!premium ? "relative z-0 opacity-50" : undefined}>
            <h2 className="text-lg font-semibold text-white">Morning Roast</h2>
            <p className="mt-1 text-sm text-zinc-400">
              7:00 AM local notification — Capacitor survives app close.
            </p>
            <button
              type="button"
              disabled={morningBusy || !premium}
              onClick={() => void toggleMorningRoast()}
              className={
                morningOn
                  ? "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-amber-100 disabled:opacity-50"
                  : "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_28px_rgba(255,45,85,0.45)] disabled:opacity-50"
              }
            >
              {morningOn ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {morningBusy
                ? "Working…"
                : morningOn
                  ? "Disable Morning Roast"
                  : "Enable Morning Roast"}
            </button>
            {morningDetail ? (
              <p className="mt-2 text-xs text-zinc-400">{morningDetail}</p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                &ldquo;{MORNING_ROAST_LINE}&rdquo;
              </p>
            )}
          </div>
          {!premium ? (
            <button
              type="button"
              onClick={requirePremium}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 rounded-[1.5rem]"
            >
              <Lock className="h-8 w-8 text-rose-200" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-rose-100">
                Morning Roast · Locked
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                morningSpokeRef.current = false;
                void interruptWithMorningRoast();
              }}
              className="mt-3 w-full text-center text-[11px] uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-400"
            >
              Preview morning interruption
            </button>
          )}
        </section>

        {premium ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-zinc-400 backdrop-blur-md">
            <p>
              Check-in status:{" "}
              <span className="font-semibold text-zinc-200">
                {checkInActive
                  ? "Active"
                  : state.checkInCompletedDay === localDayKey()
                    ? "Complete"
                    : trackerArmed
                      ? "Armed"
                      : "Waiting for goals"}
              </span>
            </p>
            {trackerArmed ? (
              <p className="mt-1 text-zinc-500">
                Tonight she asks about:{" "}
                <span className="text-zinc-300">
                  {state.commitment.trim() || state.mainGoal.trim()}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {premium &&
        trackerArmed &&
        state.checkInCompletedDay !== localDayKey() ? (
          <button
            type="button"
            onClick={() => {
              void unlockKarenAudio();
              setCheckInActive(true);
            }}
            className="mt-3 text-center text-[11px] uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-400"
          >
            Preview evening check-in
          </button>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-8">
          <Link
            href="/karen"
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
          >
            Roast game
          </Link>
          <Link
            href="/karen/alarm"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Wake-up alarm
          </Link>
          {process.env.NODE_ENV === "development" ? (
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.clear();
                  window.sessionStorage.clear();
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100"
            >
              Reset Local State
            </button>
          ) : null}
        </div>
      </div>

      {premium ? (
        <EveningCheckInModal
          open={checkInActive}
          state={state}
          onComplete={onCheckInComplete}
          onDismiss={() => setCheckInActive(false)}
          onRetentionChange={refreshRetention}
        />
      ) : null}
    </motion.div>
  );
}
