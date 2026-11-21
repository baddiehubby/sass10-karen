"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Mic } from "lucide-react";

import { ShareYourDamageButton } from "@/components/karen/proof-of-abuse-card";
import {
  CHECKIN_NO_AUDIO_SRC,
  CHECKIN_NO_LINE,
  CHECKIN_YES_AUDIO_SRC,
  CHECKIN_YES_LINE,
  defaultAccountabilityState,
  primaryCheckInQuestion,
  type AccountabilityGoals,
  type AccountabilityGoalId,
  type AccountabilityState,
} from "@/lib/karen/accountability";
import {
  checkInAbuseLine,
  checkInAbuseTitle,
} from "@/lib/karen/proof-of-abuse";
import { captureKarenAvatarDataUrl } from "@/lib/karen/share-loop";
import { applyExtremeAngerMorphs } from "@/lib/karen/expression-bridge";
import {
  checkInLineForStreak,
  checkInMoodForStreak,
  isPraiseUnlocked,
  readGoodStreak,
} from "@/lib/karen/good-streak";
import { isPleadSupported, listenForApology } from "@/lib/karen/plead";
import { playAnswerClick, playRoastStinger } from "@/lib/karen/sfx";
import {
  apologyAccepted,
  applyCheckInOutcome,
  applyForgiveness,
  FORGIVE_AUDIO_ID,
  FORGIVE_LINE,
  markRareRoastPlayed,
  RARE_ROAST_AUDIO_ID,
  RARE_ROAST_LINE,
  readRespect,
} from "@/lib/karen/state";
import {
  dispatchKarenExpression,
  dispatchKarenFacing,
  dispatchKarenRageShake,
} from "@/lib/karen/talkinghead-bus";
import {
  getRegisteredKarenTalkingHead,
  pauseKarenRuntimeAudioAndRender,
  playWavWithLipsync,
  speakLocalRoast,
  unlockKarenAudio,
} from "@/lib/karen/voice";

function checkInAudioId(didIt: boolean, line: string): string | null {
  if (!didIt || line === CHECKIN_NO_LINE) return "checkin:no";
  if (line === CHECKIN_YES_LINE) return "checkin:yes";
  return null;
}

function checkInWavSrc(didIt: boolean, line: string): string | null {
  if (!didIt || line === CHECKIN_NO_LINE) return CHECKIN_NO_AUDIO_SRC;
  if (line === CHECKIN_YES_LINE) return CHECKIN_YES_AUDIO_SRC;
  return null;
}

const Karen3D = dynamic(() => import("@/components/Karen3D"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

type EveningCheckInModalProps = {
  open: boolean;
  /** Full Goal Tracker state (preferred) or legacy goals-only. */
  state?: AccountabilityState;
  goals?: AccountabilityGoals;
  onComplete: (answered: AccountabilityGoalId, didIt: boolean) => void;
  onDismiss?: () => void;
  /** Dashboard can refresh Respect / streak counters. */
  onRetentionChange?: () => void;
};

/**
 * Full-screen 8 PM Goal Tracker interrogation — YES / NO + Kokoro WAV consequence.
 */
export function EveningCheckInModal({
  open,
  state,
  goals,
  onComplete,
  onDismiss,
  onRetentionChange,
}: EveningCheckInModalProps) {
  const tracker: AccountabilityState =
    state ??
    ({
      ...defaultAccountabilityState(),
      goals: goals ?? defaultAccountabilityState().goals,
    } satisfies AccountabilityState);
  const { id, question, goalLabel } = primaryCheckInQuestion(tracker);
  const [mood, setMood] = useState<"SARCASTIC" | "PROUD" | "FURIOUS">("SARCASTIC");
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lastDidIt, setLastDidIt] = useState<boolean | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [pleading, setPleading] = useState(false);
  const [pleadHint, setPleadHint] = useState<string | null>(null);
  const [forgiven, setForgiven] = useState(false);
  const [streakHint, setStreakHint] = useState(() => readGoodStreak());
  const [respectHint, setRespectHint] = useState(() => readRespect());
  const shake = useAnimationControls();

  const triggerRage = useCallback(() => {
    dispatchKarenRageShake();
    void shake.start({
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4, ease: "easeInOut" },
    });
    const head = getRegisteredKarenTalkingHead();
    applyExtremeAngerMorphs(head);
  }, [shake]);

  const finish = useCallback(
    (didIt: boolean) => {
      setAnswered(true);
      setBusy(false);
      // Modal closing — pause AudioContext + Three.js loop for battery.
      pauseKarenRuntimeAudioAndRender();
      onRetentionChange?.();
      window.setTimeout(() => onComplete(id, didIt), 700);
    },
    [id, onComplete, onRetentionChange],
  );

  const answer = useCallback(
    async (didIt: boolean) => {
      if (busy || answered) return;
      setBusy(true);
      playAnswerClick();
      await unlockKarenAudio();

      const outcome = applyCheckInOutcome(didIt);
      setRespectHint(outcome.respect);
      setStreakHint(outcome.streak);
      setLastDidIt(didIt);
      setFaceUrl(captureKarenAvatarDataUrl());
      onRetentionChange?.();

      const nextMood = checkInMoodForStreak(didIt, outcome.streak);
      let nextLine = checkInLineForStreak(didIt, outcome.streak);
      let audioId = checkInAudioId(didIt, nextLine);

      // 3-day streak → secret rare roast (slightly less mean, still sarcastic).
      if (didIt && outcome.rareRoastJustUnlocked) {
        nextLine = RARE_ROAST_LINE;
        audioId = RARE_ROAST_AUDIO_ID;
        markRareRoastPlayed();
      }

      setMood(nextMood);
      setLine(nextLine);

      const wav = checkInWavSrc(didIt, nextLine);
      const head = getRegisteredKarenTalkingHead();

      const playConsequence = async (mood: "PROUD" | "SARCASTIC" | "FURIOUS") => {
        if (wav) {
          try {
            await playWavWithLipsync(wav, head, { text: nextLine, volume: 1 });
            return;
          } catch (err) {
            console.warn("[evening-checkin] WAV failed — TTS fallback", err);
          }
        }
        await speakLocalRoast(nextLine, {
          mood,
          trait: didIt ? undefined : "laziness",
          head,
          audioId,
          ignoreColdShoulder: true,
        });
      };

      if (!didIt) {
        // NO → brutal WAV + screen shake + [FURIOUS]
        playRoastStinger();
        triggerRage();
        dispatchKarenExpression({
          mood: "FURIOUS",
          isSpeaking: true,
          trait: "laziness",
        });
        applyExtremeAngerMorphs(head);
        await playConsequence("FURIOUS");
        if (outcome.coldShoulder) {
          dispatchKarenFacing(true);
          setLine((prev) =>
            prev
              ? `${prev} She's turning her back. Respect ${outcome.respect}.`
              : `She's turning her back. Respect ${outcome.respect}.`,
          );
        }
        setFailed(true);
        setBusy(false);
        return;
      }

      // YES → slightly impressed WAV, then Proof of Abuse share (no auto-close).
      dispatchKarenFacing(false);
      dispatchKarenExpression({ mood: nextMood, isSpeaking: true });
      await playConsequence(nextMood);
      setAnswered(true);
      setBusy(false);
      setFaceUrl(captureKarenAvatarDataUrl());
    },
    [answered, busy, onRetentionChange, triggerRage],
  );

  const begForForgiveness = useCallback(async () => {
    if (pleading || forgiven || busy) return;
    setPleadHint(null);
    setPleading(true);
    await unlockKarenAudio();

    if (!isPleadSupported()) {
      setPleadHint("Mic apology needs Chrome/Safari speech recognition.");
      setPleading(false);
      return;
    }

    setPleadHint('Say it: "I\'m sorry Karen, I will do better."');
    const result = await listenForApology({ timeoutMs: 12_000 });
    if (!result.ok) {
      setPleadHint(
        result.reason === "denied"
          ? "Mic permission denied. Beg out loud next time."
          : "I heard nothing. Try again — say sorry.",
      );
      setPleading(false);
      return;
    }

    if (!apologyAccepted(result.transcript)) {
      setPleadHint(`Heard: "${result.transcript}" — that isn't an apology.`);
      setPleading(false);
      return;
    }

    const outcome = applyForgiveness();
    setRespectHint(outcome.respect);
    setForgiven(true);
    setLine(FORGIVE_LINE);
    setMood("SARCASTIC");
    dispatchKarenFacing(false);
    onRetentionChange?.();

    await speakLocalRoast(FORGIVE_LINE, {
      mood: "SARCASTIC",
      head: getRegisteredKarenTalkingHead(),
      audioId: FORGIVE_AUDIO_ID,
      ignoreColdShoulder: true,
    });

    setPleading(false);
    finish(false);
  }, [busy, finish, forgiven, onRetentionChange, pleading]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="checkin"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex flex-col bg-black text-white"
          role="dialog"
          aria-modal="true"
          aria-labelledby="karen-checkin-title"
        >
          <motion.div animate={shake} className="relative flex h-full min-h-[100dvh] w-full flex-col">
            <div className="absolute inset-0 z-0">
              <Karen3D mood={mood} isSpeaking={Boolean(line)} className="absolute inset-0" />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"
                aria-hidden
              />
              {mood === "FURIOUS" ? (
                <div
                  className="pointer-events-none absolute inset-0 border-[3px] border-red-500"
                  style={{
                    boxShadow: "inset 0 0 50px rgba(255,0,0,0.45)",
                  }}
                  aria-hidden
                />
              ) : null}
            </div>

            <div className="relative z-10 mt-auto flex flex-col items-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
              <div className="w-full max-w-lg rounded-[1.75rem] border border-white/20 bg-black/60 p-5 shadow-2xl backdrop-blur-2xl sm:p-6">
                <p className="text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-red-400">
                  Goal Tracker · 8:00 PM
                  {isPraiseUnlocked(streakHint) ? " · Praise unlocked" : ""}
                </p>
                <p className="mt-2 text-center text-[11px] text-zinc-500">
                  Respect {respectHint}
                  {streakHint > 0
                    ? ` · ${streakHint} day${streakHint === 1 ? "" : "s"} without disappointment`
                    : ""}
                </p>
                <h2
                  id="karen-checkin-title"
                  className="mt-3 text-center text-xl font-semibold leading-snug text-white sm:text-2xl"
                >
                  {question}
                </h2>

                {line ? (
                  <p className="mt-4 text-center text-base font-medium leading-relaxed text-rose-100">
                    {line}
                  </p>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void answer(true)}
                      className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-4 text-sm font-black uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void answer(false)}
                      className="rounded-2xl border border-red-500/50 bg-red-500/20 px-4 py-4 text-sm font-black uppercase tracking-wide text-rose-100 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      NO
                    </button>
                  </div>
                )}

                {lastDidIt != null && (answered || failed) && !busy ? (
                  <div className="mt-4 space-y-3">
                    <ShareYourDamageButton
                      kind="checkin"
                      title={checkInAbuseTitle(lastDidIt, respectHint)}
                      line={checkInAbuseLine(lastDidIt, goalLabel)}
                      respectScore={respectHint}
                      faceUrl={faceUrl}
                      metrics={[
                        { label: "Streak", value: streakHint },
                        { label: "Verdict", value: lastDidIt ? "YES" : "NO" },
                      ]}
                    />
                    {answered && !failed ? (
                      <button
                        type="button"
                        onClick={() => finish(true)}
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                      >
                        Done — close check-in
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {failed && !forgiven ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={pleading || busy}
                      onClick={() => void begForForgiveness()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3.5 text-sm font-black uppercase tracking-wide text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      <Mic className="h-4 w-4" />
                      {pleading ? "Listening…" : "Beg for Forgiveness"}
                    </button>
                    {pleadHint ? (
                      <p className="text-center text-[11px] text-zinc-400">{pleadHint}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={pleading}
                      onClick={() => finish(false)}
                      className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Leave in shame
                    </button>
                  </div>
                ) : null}

                {onDismiss && !answered && !failed ? (
                  <button
                    type="button"
                    onClick={() => {
                      pauseKarenRuntimeAudioAndRender();
                      onDismiss();
                    }}
                    className="mt-4 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Sneak out (Karen will remember)
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
