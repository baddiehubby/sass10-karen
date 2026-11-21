"use client";

/**
 * Full-screen wake dismissal challenge — no snooze.
 *
 * Dismiss by:
 *   1) Hold mic + yell "I'M AWAKE" (AnalyserNode volume detector), or
 *   2) Solve the math problem while Karen keeps screaming.
 *
 * Native Android: `@capacitor/local-notifications` opens this screen even when
 * the app was closed — see `lib/karen/native-alarm.ts`.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

import {
  escalateAlarmVolume,
  startKarenAlarmLoop,
  type AlarmLoopHandle,
} from "@/lib/karen/alarm-loop";
import {
  KAREN_ALARM_AWAKE_PHRASE,
  KAREN_ALARM_AUDIO,
  KAREN_ALARM_BASE_VOLUME,
  KAREN_ALARM_WAKE_LINE,
  isAwakeYellTranscript,
  makeWakeMathChallenge,
  type KarenAlarmRage,
} from "@/lib/karen/alarm-storage";
import { requestMicStream, useScreamMic, YELL_RMS_THRESHOLD } from "@/lib/karen/mic";
import { SCREAM_VOLUME_THRESHOLD } from "@/lib/karen/smack-back";
import {
  playWavWithLipsync,
  stopKarenSpeech,
  unlockKarenAudio,
} from "@/lib/karen/voice";

const Karen3D = dynamic(() => import("@/components/Karen3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="h-32 w-32 animate-pulse rounded-full bg-rose-500/25 ring-2 ring-rose-400/40" />
    </div>
  ),
});

/** Freq-domain UI volume (0–255) that counts as a real yell. */
const AWAKE_FREQ_YELL = Math.max(SCREAM_VOLUME_THRESHOLD, 52);

export type KarenAlarmDismissalProps = {
  open: boolean;
  rage: KarenAlarmRage;
  line?: string;
  onDismissed: () => void;
};

export function KarenAlarmDismissal({
  open,
  rage,
  line = KAREN_ALARM_WAKE_LINE,
  onDismissed,
}: KarenAlarmDismissalProps) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(`Hold & yell “${KAREN_ALARM_AWAKE_PHRASE}”`);
  const [failCount, setFailCount] = useState(0);
  const [speakingRoast, setSpeakingRoast] = useState(false);
  const [math, setMath] = useState(() => makeWakeMathChallenge());
  const [mathInput, setMathInput] = useState("");
  const [mode, setMode] = useState<"yell" | "math">("yell");

  const loopRef = useRef<AlarmLoopHandle | null>(null);
  const peakVolRef = useRef(0);
  const yelledRef = useRef(false);
  const dismissedRef = useRef(false);
  const roastIdxRef = useRef(0);
  const holdingRef = useRef(false);
  /** Prevents double escalate from onResult + empty-release fallback. */
  const settleGenRef = useRef(0);

  const audioPack = KAREN_ALARM_AUDIO[rage];

  const tearDownLoop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
  }, []);

  const finishDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    tearDownLoop();
    stopKarenSpeech();
    setHolding(false);
    holdingRef.current = false;
    onDismissed();
  }, [onDismissed, tearDownLoop]);

  const tryCompleteAwake = useCallback(
    (transcript: string, peak: number, yelled: boolean) => {
      const phraseOk = isAwakeYellTranscript(transcript);
      const loudOk = yelled || peak >= AWAKE_FREQ_YELL;
      if (phraseOk && loudOk) {
        setHint("Fine. You're awake. Move.");
        finishDismiss();
        return true;
      }
      return false;
    },
    [finishDismiss],
  );

  const escalateFailure = useCallback(
    async (reason: "early-release" | "quiet" | "wrong-words") => {
      if (dismissedRef.current) return;

      const handle = loopRef.current;
      if (handle) {
        const next = escalateAlarmVolume(handle, rage === "apocalyptic" ? 0.16 : 0.12);
        setHint(
          reason === "wrong-words"
            ? `Say “${KAREN_ALARM_AWAKE_PHRASE}” — louder. (vol ${Math.round(next * 100)}%)`
            : `Let go early? Volume up. Yell “${KAREN_ALARM_AWAKE_PHRASE}”.`,
        );
      } else {
        setHint(`Yell “${KAREN_ALARM_AWAKE_PHRASE}” — hold the mic.`);
      }

      setFailCount((n) => n + 1);
      const roast = audioPack.roasts[roastIdxRef.current % audioPack.roasts.length]!;
      roastIdxRef.current += 1;

      // Pause the loop briefly so the roast cuts through, then resume louder.
      loopRef.current?.element.pause();
      setSpeakingRoast(true);
      try {
        await unlockKarenAudio();
        await playWavWithLipsync(roast.src, null, { text: roast.text, volume: 1 });
      } catch (err) {
        console.warn("[alarm-dismissal] roast failed", err);
      } finally {
        setSpeakingRoast(false);
        void loopRef.current?.element.play().catch(() => undefined);
      }
    },
    [audioPack.roasts, rage],
  );

  const settleHold = useCallback(
    (transcript: string) => {
      if (dismissedRef.current) return;
      const gen = settleGenRef.current;
      const peak = peakVolRef.current;
      const yelled = yelledRef.current;
      if (tryCompleteAwake(transcript, peak, yelled)) return;
      // Mark settled so the empty-release timer does not double-roast.
      settleGenRef.current = gen + 1;
      void escalateFailure(
        isAwakeYellTranscript(transcript)
          ? "quiet"
          : transcript.trim()
            ? "wrong-words"
            : "early-release",
      );
    },
    [escalateFailure, tryCompleteAwake],
  );

  const mic = useScreamMic({
    // No onLoud interrupt — we need the hold to continue until they yell the phrase.
    onResult: (transcript) => settleHold(transcript),
    onToast: (msg) => setHint(msg),
  });

  // Track peak frequency volume + mid-hold success (phrase + yell energy).
  useEffect(() => {
    if (!open || !holding) return;
    peakVolRef.current = Math.max(peakVolRef.current, mic.volume);
    if (mic.volume >= AWAKE_FREQ_YELL) yelledRef.current = true;

    const live = mic.getTranscript();
    if (
      yelledRef.current &&
      isAwakeYellTranscript(live) &&
      peakVolRef.current >= AWAKE_FREQ_YELL
    ) {
      mic.stopListening();
      finishDismiss();
    }
    // Intentionally depend on volume ticks + holding — not the whole mic object.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getTranscript/stopListening are stable enough per render
  }, [finishDismiss, holding, mic.volume, open]);

  // Start / stop the Kokoro wake loop with the modal.
  useEffect(() => {
    if (!open) {
      tearDownLoop();
      dismissedRef.current = false;
      return;
    }

    dismissedRef.current = false;
    peakVolRef.current = 0;
    yelledRef.current = false;
    roastIdxRef.current = 0;
    setFailCount(0);
    setMath(makeWakeMathChallenge());
    setMathInput("");
    setMode("yell");
    setHint(`Hold & yell “${KAREN_ALARM_AWAKE_PHRASE}”`);

    let cancelled = false;
    void (async () => {
      const handle = await startKarenAlarmLoop(
        audioPack.loop,
        KAREN_ALARM_BASE_VOLUME[rage],
      );
      if (cancelled) {
        handle.stop();
        return;
      }
      loopRef.current = handle;
    })();

    return () => {
      cancelled = true;
      tearDownLoop();
      stopKarenSpeech();
    };
  }, [audioPack.loop, open, rage, tearDownLoop]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    peakVolRef.current = 0;
    yelledRef.current = false;
    holdingRef.current = true;
    setHolding(true);
    setHint("Keep holding — yell it.");
    void unlockKarenAudio();
    // Soften the loop while they scream so the mic hears them.
    if (loopRef.current) {
      loopRef.current.setVolume(Math.max(0.35, loopRef.current.getVolume() * 0.55));
    }
    // Gesture-gated getUserMedia + SpeechRecognition (same stack as Hold-to-Scream).
    mic.startListening(requestMicStream());
  };

  const onPointerUp = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    const gen = settleGenRef.current;
    const live = mic.getTranscript();
    mic.stopListening();
    // onResult may settle with text; empty SR finalize does not call onResult —
    // so we escalate on a short timer if nothing handled the release.
    window.setTimeout(() => {
      if (dismissedRef.current) return;
      if (settleGenRef.current !== gen) return;
      settleHold(live);
    }, 180);
    // Restore loop level after ducking for the mic.
    if (loopRef.current) {
      const base = KAREN_ALARM_BASE_VOLUME[rage] + failCount * 0.12;
      loopRef.current.setVolume(Math.min(1, Math.max(loopRef.current.getVolume(), base)));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden bg-black text-white"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="karen-alarm-title"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <Karen3D
          mood={rage === "annoyed" ? "ANNOYED" : "FURIOUS"}
          isSpeaking={speakingRoast || holding}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-transparent to-black/90" />

      <div className="relative z-20 flex h-full flex-col items-center justify-between px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-md text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-rose-400">
            Karen&apos;s wake-up rage · {rage}
          </p>
          <h2
            id="karen-alarm-title"
            className="mt-3 text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-5xl"
          >
            Wake up!
          </h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-rose-100/90">{line}</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            {hint}
          </p>
          {failCount > 0 ? (
            <p className="mt-2 text-xs uppercase tracking-wider text-rose-300/80">
              Failed dismissals: {failCount} · she&apos;s getting louder
            </p>
          ) : null}
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-300">
            No snooze. Yell{" "}
            <span className="text-rose-300">{KAREN_ALARM_AWAKE_PHRASE}</span> or solve the math.
          </p>

          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => setMode("yell")}
              className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                mode === "yell"
                  ? "border-rose-400/70 bg-rose-600/30 text-white"
                  : "border-white/15 bg-black/40 text-zinc-400"
              }`}
            >
              Yell
            </button>
            <button
              type="button"
              onClick={() => setMode("math")}
              className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                mode === "math"
                  ? "border-amber-400/70 bg-amber-600/25 text-white"
                  : "border-white/15 bg-black/40 text-zinc-400"
              }`}
            >
              Math
            </button>
          </div>

          {mode === "yell" ? (
            <>
              <button
                type="button"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                className={`flex h-28 w-28 touch-none select-none flex-col items-center justify-center rounded-full border-2 transition-[transform,box-shadow,background] ${
                  holding
                    ? "scale-105 border-rose-300 bg-rose-600 shadow-[0_0_48px_rgba(255,45,85,0.75)]"
                    : "border-rose-400/70 bg-rose-950/90 shadow-[0_0_28px_rgba(255,45,85,0.35)]"
                }`}
                style={{ WebkitUserSelect: "none", userSelect: "none" }}
                aria-label={`Hold and yell ${KAREN_ALARM_AWAKE_PHRASE}`}
              >
                <Mic className={`h-9 w-9 ${holding ? "animate-pulse" : ""}`} />
                <span className="mt-1 px-2 text-center text-[9px] font-black uppercase tracking-[0.12em]">
                  {holding ? "YELL IT" : "HOLD"}
                </span>
              </button>

              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-rose-400 transition-[width] duration-75"
                  style={{
                    width: `${Math.min(100, (mic.volume / 255) * 100)}%`,
                    opacity: holding ? 1 : 0.35,
                  }}
                />
              </div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                Yell threshold · rms {YELL_RMS_THRESHOLD.toFixed(2)} / freq {AWAKE_FREQ_YELL}
              </p>
            </>
          ) : (
            <form
              className="w-full space-y-3 rounded-2xl border border-amber-400/30 bg-black/70 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (dismissedRef.current) return;
                const n = Number(mathInput.trim());
                if (Number.isFinite(n) && n === math.answer) {
                  setHint("Fine. You're awake. Move.");
                  finishDismiss();
                  return;
                }
                setMathInput("");
                setMath(makeWakeMathChallenge());
                void escalateFailure("wrong-words");
                setHint("Wrong. She gets louder. Try again.");
              }}
            >
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">
                Solve while she screams
              </p>
              <p className="text-center font-mono text-4xl font-black tabular-nums text-white">
                {math.prompt} = ?
              </p>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={mathInput}
                onChange={(e) => setMathInput(e.target.value.replace(/[^\d-]/g, ""))}
                placeholder="Answer"
                className="w-full rounded-xl border border-white/20 bg-black/60 px-3 py-3 text-center text-lg text-white outline-none focus:border-amber-400/60"
                autoFocus
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black"
              >
                Submit — no snooze
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
