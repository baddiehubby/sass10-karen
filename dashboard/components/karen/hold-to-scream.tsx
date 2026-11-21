"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Send, ChevronUp } from "lucide-react";

import { trackFightStarted } from "@/lib/karen/analytics";
import { AvatarState, setAvatarState } from "@/lib/karen/avatar-state";
import {
  MIC_HOLD_INTERRUPT_MS,
  MIC_RELEASE_MUTE_LOCK_MS,
  MIC_TALKING_LOCK_MS,
  requestMicStream,
  rollMicPressTalkingDenial,
  rollMicReleaseMute,
  useScreamMic,
} from "@/lib/karen/mic";
import {
  getVolumeInterrupt,
  isApologyTranscript,
  markCombatBargeIn,
  processUserScream as matchUserScream,
  SMACK_BACK_COOLDOWN_MS,
  SMACK_BACK_PROCESS_MS,
  type SmackBackResult,
} from "@/lib/karen/smack-back";
import { playAnswerClick } from "@/lib/karen/sfx";
import {
  IMPATIENCE_SILENCE_MS,
  pauseKarenAudio,
  unlockAudio,
  unlockKarenAudio,
  unlockKarenAudioAndMic,
} from "@/lib/karen/voice";

/** Finger must travel this many px upward to arm WhatsApp-style cancel. */
const CANCEL_DRAG_PX = 72;

export type HoldToScreamProps = {
  disabled?: boolean;
  unlimited?: boolean;
  cooldownUntil: number;
  onCooldown: (until: number) => void;
  onSmack: (result: SmackBackResult) => void | Promise<void>;
  /**
   * Optional mood-aware resolver (hidden karenRageLevel / repeats).
   * Defaults to keyword smack-back matching.
   */
  resolveSmack?: (transcript: string) => SmackBackResult;
  /** Hold starts — Karen goes ANGRY and stares. */
  onCombatStart?: () => void;
  /** Hold ends without a smack (cancel). */
  onCombatEnd?: () => void;
  /** Instant punch shake on SEND INSULT — before Karen replies. */
  onPunchShake?: () => void;
  /**
   * User landed a real scream / insult (not empty hesitation).
   * `true` → parent may roll Patience damage. `false` → Karen takes 0.
   */
  onArgue?: (screamHitEligible: boolean) => void;
  /** 3s silence while typing/holding — impatience interrupt. */
  onImpatience?: () => void | Promise<void>;
  /** 30% press denial — "No. I'm talking." + 5s lock. */
  onImTalkingDenial?: () => void | Promise<void>;
  /** 20% release abuse — mute WAV + turn back + 10s lock. */
  onReleaseMuteAbuse?: () => void | Promise<void>;
  /** Hold/talk ≥3s — random interrupt WAV + cut mic + Dignity hit. */
  onHoldInterrupt?: () => void | Promise<void>;
  /** When true, parent already provides the glass dock — only render the button. */
  embedded?: boolean;
  /** Profanity Mute Protocol — mic disabled until apology. */
  muteProtocol?: boolean;
  /** Called when user types a valid apology. */
  onApology?: () => void | Promise<void>;
  /**
   * Ambush trap — hide the mic, force a long personal typed answer.
   * Parent owns the prompt; this only changes the input chrome.
   */
  forceTextOnly?: boolean;
  /** Placeholder / helper when forceTextOnly. */
  ambushHint?: string | null;
  /** Called with the raw typed answer (Ambush path). */
  onAmbushSubmit?: (transcript: string) => void | Promise<void>;
};

/**
 * Persistent HOLD TO SCREAM mic — never conditionally unmounted.
 * SpeechRecognition lives in a useRef inside useScreamMic across re-renders.
 */
export function HoldToScream({
  disabled = false,
  unlimited = false,
  cooldownUntil,
  onCooldown,
  onSmack,
  resolveSmack,
  onCombatStart,
  onCombatEnd,
  onPunchShake,
  onArgue,
  onImpatience,
  onImTalkingDenial,
  onReleaseMuteAbuse,
  onHoldInterrupt,
  embedded = false,
  muteProtocol = false,
  onApology,
  forceTextOnly = false,
  ambushHint = null,
  onAmbushSubmit,
}: HoldToScreamProps) {
  const [processing, setProcessing] = useState(false);
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [holding, setHolding] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const startYRef = useRef(0);
  const cancelArmedRef = useRef(false);
  const holdingRef = useRef(false);
  const toastTimerRef = useRef(0);
  const silenceTimerRef = useRef(0);
  const holdInterruptTimerRef = useRef(0);
  const holdInterruptedRef = useRef(false);
  const impatienceBusyRef = useRef(false);
  const onImpatienceRef = useRef(onImpatience);
  const onHoldInterruptRef = useRef(onHoldInterrupt);
  const typedLenRef = useRef(0);
  const cancelListenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    onImpatienceRef.current = onImpatience;
  }, [onImpatience]);

  useEffect(() => {
    onHoldInterruptRef.current = onHoldInterrupt;
  }, [onHoldInterrupt]);

  const clearHoldInterruptWatch = useCallback(() => {
    if (holdInterruptTimerRef.current) {
      window.clearTimeout(holdInterruptTimerRef.current);
      holdInterruptTimerRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (unlimited || cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil, unlimited]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (holdInterruptTimerRef.current) {
        window.clearTimeout(holdInterruptTimerRef.current);
      }
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    },
    [],
  );

  const clearSilenceWatch = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = 0;
    }
  }, []);

  const armSilenceWatch = useCallback(() => {
    if (muteProtocol || processing || impatienceBusyRef.current) return;
    clearSilenceWatch();
    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = 0;
      if (impatienceBusyRef.current || muteProtocol) return;
      // Only interrupt if the user was mid-fight (typing or holding).
      if (!holdingRef.current && typedLenRef.current === 0) return;
      impatienceBusyRef.current = true;
      holdingRef.current = false;
      setHolding(false);
      cancelListenRef.current?.();
      void (async () => {
        try {
          await onImpatienceRef.current?.();
        } finally {
          impatienceBusyRef.current = false;
        }
      })();
    }, IMPATIENCE_SILENCE_MS);
  }, [clearSilenceWatch, muteProtocol, processing]);

  const cooling = !unlimited && cooldownUntil > now;
  const coolLeftSec = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const locked = disabled || processing || cooling || muteProtocol;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = 0;
    }, 2200);
  }, []);

  const resetHoldUi = useCallback(() => {
    holdingRef.current = false;
    cancelArmedRef.current = false;
    clearHoldInterruptWatch();
    setHolding(false);
    setCancelArmed(false);
    setDragY(0);
  }, [clearHoldInterruptWatch]);

  const fireSmack = useCallback(
    async (result: SmackBackResult, delayMs = SMACK_BACK_PROCESS_MS) => {
      if (!result.volumeInterrupt) {
        if (disabled || processing || (!unlimited && cooldownUntil > Date.now())) {
          return;
        }
      }
      clearSilenceWatch();
      playAnswerClick();
      // Empty / um / hesitate-flagged fallback → 0 Patience.
      // Keyword hit / real scream / ruthless gibberish roast → roll a scream hit.
      const screamHitEligible =
        !result.userWon &&
        !result.muteProtocol &&
        !result.brokenRecord &&
        (Boolean(result.volumeInterrupt) ||
          Boolean(result.screamingRage) ||
          (result.matchedKeywords?.length ?? 0) > 0 ||
          !result.dominanceFallback);
      onArgue?.(screamHitEligible);
      // Instant response — unlock + smack ≤100ms (cache-hot WAVs).
      setProcessing(true);
      setAvatarState(AvatarState.SPEAKING);
      try {
        await unlockKarenAudio();
        const windup = Math.min(100, Math.max(0, delayMs));
        if (windup > 0) {
          await new Promise<void>((r) => window.setTimeout(r, windup));
        }
        await onSmack(result);
      } catch (err) {
        // Never leave the mic frozen — audio failures fail silently.
        console.warn("[hold-to-scream] smack failed", err);
        setAvatarState(AvatarState.IDLE);
      } finally {
        setTyped("");
        typedLenRef.current = 0;
        setProcessing(false);
        if (!unlimited) {
          onCooldown(Date.now() + SMACK_BACK_COOLDOWN_MS);
        }
      }
    },
    [
      clearSilenceWatch,
      cooldownUntil,
      disabled,
      onArgue,
      onCooldown,
      onSmack,
      processing,
      unlimited,
    ],
  );

  const processUserScream = useCallback(
    (transcript: string) => {
      // Resolve sync + fire immediately (≤100ms to audio when cache-hot).
      setAvatarState(AvatarState.SPEAKING);
      const result = resolveSmack
        ? resolveSmack(transcript)
        : matchUserScream(transcript);
      void fireSmack(result, 0);
    },
    [fireSmack, resolveSmack],
  );

  const mic = useScreamMic({
    onListeningChange: (listening) => {
      if (!listening && !holdingRef.current) {
        clearSilenceWatch();
        onCombatEnd?.();
      }
    },
    onLoud: () => {
      // AnalyserNode yell — cut mic, play interrupt WAV (shake on audio start).
      clearSilenceWatch();
      resetHoldUi();
      setAvatarState(AvatarState.SPEAKING);
      void fireSmack(getVolumeInterrupt(), 0);
    },
    onResult: processUserScream,
    onToast: showToast,
  });

  cancelListenRef.current = () => mic.cancelListening();

  // Holding mic with near-silence → re-arm impatience; loud input resets the clock.
  useEffect(() => {
    if (!holding || muteProtocol || processing) return;
    if (mic.volume >= 18) {
      armSilenceWatch();
    }
  }, [armSilenceWatch, holding, mic.volume, muteProtocol, processing]);

  // Typed lane: Ambush forces text-only; else mute / STT fallback.
  const showTypedInput =
    forceTextOnly ||
    muteProtocol ||
    mic.preferTextInput ||
    !mic.supported ||
    Boolean(mic.fallbackHint);
  const recording = holding || mic.listening;
  // Soft-disable while SPEAKING (dim + no concurrent scream) — press still barge-ins.
  const speakingLocked = mic.speakingLocked;
  // Gray only when locked / hung up / unsupported — never just because typed UI is open.
  const micDimmed = locked || muteProtocol || !mic.supported || speakingLocked;
  const liveToast = toast || mic.toast;

  const submitTyped = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      clearSilenceWatch();
      if (muteProtocol) {
        if (isApologyTranscript(text)) {
          playAnswerClick();
          setTyped("");
          typedLenRef.current = 0;
          void onApology?.();
          return;
        }
        setTyped("");
        typedLenRef.current = 0;
        return;
      }
      // Ambush — long personal answer goes to the Faith Shatter path.
      if (forceTextOnly && onAmbushSubmit) {
        playAnswerClick();
        onPunchShake?.();
        setTyped("");
        typedLenRef.current = 0;
        setProcessing(true);
        void (async () => {
          try {
            await onAmbushSubmit(text);
          } finally {
            setProcessing(false);
          }
        })();
        return;
      }
      // Instant manga punch + shake — masks any residual audio latency.
      onPunchShake?.();
      // Cut her mid-line so barge-in → INTERRUPT WAV path can fire.
      if (mic.speakingLocked || mic.avatarState === AvatarState.SPEAKING) {
        markCombatBargeIn();
        mic.interruptSpeaking();
        pauseKarenAudio();
      }
      processUserScream(text);
    },
    [
      clearSilenceWatch,
      forceTextOnly,
      mic,
      muteProtocol,
      onAmbushSubmit,
      onApology,
      onPunchShake,
      processUserScream,
    ],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    // FIRST, on every path: stop the browser's default press behaviour (text
    // selection / long-press callout / drag / scroll-start) while the user holds.
    // Paired with `touch-action: none` on the button, which blocks touch scrolling.
    e.preventDefault();

    // Unsupported / mute → focus typed path, but button stays in the DOM.
    if (muteProtocol || !mic.supported) {
      showToast(
        muteProtocol
          ? "Type an apology to unlock the mic."
          : "Type your insult, coward.",
      );
      return;
    }
    // Cooldown / processing lock — but SPEAKING is barge-in eligible (not `locked` alone).
    if (disabled || processing || cooling) return;

    // SPEAKING → instantly cut her AudioBufferSourceNode / HTMLAudio and listen.
    let bargedIn = false;
    if (mic.speakingLocked || mic.avatarState === AvatarState.SPEAKING) {
      bargedIn = true;
      markCombatBargeIn();
      mic.interruptSpeaking();
      pauseKarenAudio();
      setAvatarState(AvatarState.LISTENING);
    }

    // 30% — Karen denies the mic instantly: "No. I'm talking."
    // Skip denial when barge-in from SPEAKING — user already interrupted her.
    if (!bargedIn && rollMicPressTalkingDenial()) {
      playAnswerClick();
      trackFightStarted();
      onCooldown(Date.now() + MIC_TALKING_LOCK_MS);
      showToast("NO. I'M TALKING.");
      void onImTalkingDenial?.();
      return;
    }

    try {
      // Keeps pointermove/up flowing to the button when the finger drifts off it.
      // Can throw NotFoundError if the pointer was already released/cancelled
      // (fast tap, OS gesture) — that must NOT abort the handler and kill the mic.
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    startYRef.current = e.clientY;
    cancelArmedRef.current = false;
    holdInterruptedRef.current = false;
    holdingRef.current = true;
    setHolding(true);
    setCancelArmed(false);
    setDragY(0);
    pauseKarenAudio();
    setAvatarState(AvatarState.LISTENING);
    void unlockAudio();
    void unlockKarenAudioAndMic();
    playAnswerClick();
    trackFightStarted();
    onCombatStart?.();
    armSilenceWatch();

    // Hold/talk ≥3s without Karen interrupting → cut mic + interrupts WAV.
    clearHoldInterruptWatch();
    holdInterruptTimerRef.current = window.setTimeout(() => {
      holdInterruptTimerRef.current = 0;
      if (!holdingRef.current || holdInterruptedRef.current) return;
      holdInterruptedRef.current = true;
      clearSilenceWatch();
      resetHoldUi();
      cancelListenRef.current?.();
      showToast("INTERRUPTED");
      void onHoldInterruptRef.current?.();
    }, MIC_HOLD_INTERRUPT_MS);

    // Recognition instance is held in useRef inside useScreamMic.
    const gestureStream = requestMicStream();
    mic.startListening(gestureStream);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!holdingRef.current) return;
    const delta = startYRef.current - e.clientY;
    const armed = delta >= CANCEL_DRAG_PX;
    setDragY(Math.max(0, Math.min(delta, 140)));
    if (armed !== cancelArmedRef.current) {
      cancelArmedRef.current = armed;
      setCancelArmed(armed);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!holdingRef.current) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const cancel = cancelArmedRef.current;
    const alreadyInterrupted = holdInterruptedRef.current;
    clearSilenceWatch();
    clearHoldInterruptWatch();
    resetHoldUi();
    if (cancel || alreadyInterrupted) {
      mic.cancelListening();
      return;
    }

    // 20% — release abuse: mute WAV, turn her back, lock mic 10s.
    if (rollMicReleaseMute()) {
      mic.cancelListening();
      onCooldown(Date.now() + MIC_RELEASE_MUTE_LOCK_MS);
      showToast("MUTED. SHE TURNED AWAY.");
      void onReleaseMuteAbuse?.();
      return;
    }

    mic.stopListening();
  };

  const statusLabel = cooling
    ? `LOCKOUT ${coolLeftSec}s`
    : processing
      ? "ATTACKING…"
      : cancelArmed
        ? "RELEASE TO CANCEL"
        : recording
          ? "RECORDING…"
          : muteProtocol
            ? "MIC MUTED"
            : !mic.supported
              ? "TYPE INSTEAD"
              : "HOLD TO SCREAM";

  const shellClass = embedded
    ? "pointer-events-auto flex flex-col items-center"
    : "pointer-events-auto fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center";

  const shell = (
    <div className={shellClass} data-karen-mic="">
      {/* Soft toast — never unmounts the mic */}
      <AnimatePresence>
        {liveToast ? (
          <motion.div
            key={liveToast}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-2 rounded-full border border-red-400/50 bg-black/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-red-200 shadow-[0_0_24px_rgba(255,45,85,0.35)]"
            role="status"
          >
            {liveToast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Status chip only while recording / cancel — idle copy lives on the FAB itself */}
      <div className="mb-1 flex min-h-0 flex-col items-center justify-end gap-1">
        <AnimatePresence mode="wait">
          {cancelArmed ? (
            <motion.div
              key="cancel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-100 backdrop-blur-xl"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Slide to cancel
            </motion.div>
          ) : recording ? (
            <motion.div
              key="rec"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <motion.span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff2d55]"
                  animate={{ opacity: [1, 0.25, 1], scale: [1, 0.85, 1] }}
                  transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden
                />
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-red-300">
                  RECORDING…
                </p>
              </div>
              <LiveWaveform volume={mic.volume} />
            </motion.div>
          ) : cooling || muteProtocol || !mic.supported ? (
            <motion.p
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/80"
            >
              {statusLabel}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Floating circular mic — hidden during Ambush (text-only confession). */}
      <div
        className={`relative flex h-24 w-24 select-none items-center justify-center sm:h-28 sm:w-28 ${
          forceTextOnly ? "hidden" : ""
        }`}
        aria-hidden={forceTextOnly || undefined}
      >
        {/* Mute Protocol stamp — massive fighting-game overlay for TikTok clips */}
        <AnimatePresence>
          {muteProtocol ? (
            <motion.div
              key="muted-stamp"
              initial={{ opacity: 0, scale: 1.6, rotate: -18 }}
              animate={{ opacity: 1, scale: 1, rotate: -12 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="pointer-events-none absolute inset-[-18%] z-30 flex items-center justify-center"
              aria-hidden
              data-karen-muted-stamp=""
            >
              <span
                className="rounded-md border-[3px] border-red-500 bg-black/55 px-3 py-2 text-2xl font-black uppercase tracking-[0.18em] text-red-500 sm:text-3xl"
                style={{
                  textShadow:
                    "0 0 18px rgba(255,45,85,0.85), 0 2px 0 #000",
                  boxShadow: "0 0 28px rgba(255,20,40,0.55)",
                }}
              >
                MUTED
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {recording && !cancelArmed ? (
            <>
              <motion.span
                key="ring-a"
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#ff2d55]/80"
                initial={{ scale: 0.85, opacity: 0.9 }}
                animate={{ scale: 1.9, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.05, repeat: Infinity, ease: "easeOut" }}
                aria-hidden
              />
              <motion.span
                key="ring-b"
                className="pointer-events-none absolute inset-[-8%] rounded-full border border-red-500/40"
                initial={{ scale: 0.9, opacity: 0.7 }}
                animate={{ scale: 2.35, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.2,
                }}
                aria-hidden
              />
            </>
          ) : null}
        </AnimatePresence>

        {!cooling && !cancelArmed && !micDimmed ? (
          <span
            className="pointer-events-none absolute inset-[-18%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,45,85,0.45) 0%, rgba(255,20,40,0.12) 45%, transparent 70%)",
              filter: "blur(6px)",
            }}
            aria-hidden
          />
        ) : null}

        <motion.button
          type="button"
          // Keep pressable during SPEAKING so barge-in can cut her voice.
          disabled={Boolean(
            (disabled || processing || cooling) && mic.supported && !muteProtocol,
          )}
          onPointerDown={onPointerDown}
          aria-disabled={speakingLocked || undefined}
          data-avatar-state={mic.avatarState}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            y: recording ? -Math.min(dragY * 0.35, 40) : 0,
            // Native-feel hold: no scroll, no text highlight, no iOS long-press
            // callout / magnifier, no grey tap flash.
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            WebkitTapHighlightColor: "transparent",
            opacity: muteProtocol ? 0.35 : micDimmed ? 0.45 : 1,
            filter: muteProtocol
              ? "grayscale(1)"
              : micDimmed
                ? "grayscale(0.85)"
                : "none",
          }}
          whileTap={locked ? undefined : { scale: 0.92 }}
          animate={
            mic.flashError
              ? {
                  scale: [1, 1.06, 1],
                  backgroundColor: [
                    "rgba(127,29,29,0.95)",
                    "rgba(220,38,38,1)",
                    "rgba(127,29,29,0.95)",
                  ],
                  boxShadow: [
                    "0 0 0 rgba(255,0,0,0)",
                    "0 0 40px rgba(255,45,85,0.9)",
                    "0 0 0 rgba(255,0,0,0)",
                  ],
                }
              : cancelArmed
                ? {
                    scale: 0.94,
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    boxShadow: "0 0 24px rgba(0,0,0,0.5)",
                  }
                : recording
                  ? {
                      scale: 1.08,
                      boxShadow: [
                        "0 0 40px rgba(255,45,85,0.7), 0 0 80px rgba(255,0,40,0.35)",
                        "0 0 70px rgba(255,20,40,1), 0 0 120px rgba(255,0,40,0.55)",
                        "0 0 40px rgba(255,45,85,0.7), 0 0 80px rgba(255,0,40,0.35)",
                      ],
                    }
                  : {
                      scale: 1,
                      boxShadow: cooling
                        ? "0 0 0 rgba(0,0,0,0)"
                        : "0 0 48px rgba(255,45,85,0.65), 0 0 96px rgba(200,0,40,0.35)",
                    }
          }
          transition={
            mic.flashError
              ? { duration: 0.45, repeat: 2 }
              : recording && !cancelArmed
                ? { boxShadow: { duration: 0.75, repeat: Infinity, ease: "easeInOut" } }
                : { type: "spring", stiffness: 380, damping: 26 }
          }
          className={
            cooling || micDimmed
              ? "relative z-10 flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border border-white/15 bg-zinc-950 text-zinc-400 outline-none focus:ring-4 focus:ring-red-500/50 sm:h-24 sm:w-24"
              : cancelArmed
                ? "relative z-10 flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border border-white/25 bg-zinc-900 text-zinc-300 outline-none focus:ring-4 focus:ring-red-500/50 sm:h-24 sm:w-24"
                : "relative z-10 flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-red-300/70 bg-gradient-to-b from-[#ff4d6d] via-[#ff1a3c] to-[#9b0018] text-white outline-none focus:ring-4 focus:ring-red-500/50 disabled:opacity-45 sm:h-24 sm:w-24"
          }
          aria-label="Hold to scream"
          data-karen-mic-button=""
        >
          <Mic
            className={`h-7 w-7 sm:h-8 sm:w-8 ${recording && !cancelArmed ? "animate-pulse" : ""}`}
          />
          <span className="px-2 text-center text-[9px] font-black uppercase leading-tight tracking-[0.14em] sm:text-[10px]">
            {cooling ? `${coolLeftSec}s` : "HOLD TO SCREAM"}
          </span>
        </motion.button>
      </div>

      {/* Typed fallback — shown WITH the mic, never instead of it */}
      <AnimatePresence>
        {showTypedInput ? (
          <motion.div
            key="typed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={`mt-2 rounded-2xl border border-white/20 bg-black/80 p-3 backdrop-blur-[10px] ${
              forceTextOnly
                ? "w-[min(94vw,22rem)]"
                : "w-[min(92vw,18rem)]"
            }`}
          >
            {muteProtocol ? (
              <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
                MIC MUTED · SHE LEFT
              </p>
            ) : null}
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-rose-300">
              {muteProtocol
                ? "Type an apology to unlock the mic."
                : forceTextOnly
                  ? ambushHint || "She wants it in writing. No mic. No escape."
                  : mic.fallbackHint || "Mic broken? Type your insult, coward."}
            </p>
            <div className="flex flex-col gap-2.5">
              <textarea
                value={typed}
                onChange={(e) => {
                  const next = e.target.value;
                  setTyped(next);
                  typedLenRef.current = next.trim().length;
                  if (next.trim().length > 0) armSilenceWatch();
                  else clearSilenceWatch();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !forceTextOnly) {
                    e.preventDefault();
                    submitTyped(typed);
                  }
                }}
                rows={forceTextOnly ? 4 : 1}
                maxLength={forceTextOnly ? 480 : 180}
                placeholder={
                  muteProtocol
                    ? "Type an apology to unlock the mic."
                    : forceTextOnly
                      ? "Type the truth. Full sentences."
                      : "Mic broken? Type your insult, coward."
                }
                disabled={muteProtocol ? processing : processing && !mic.preferTextInput}
                className="min-w-0 w-full resize-none rounded-xl bg-black/40 px-3 py-3 text-sm text-white placeholder:text-zinc-500 outline-none transition-[box-shadow,border-color] duration-150 disabled:opacity-50"
                style={{
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: `rgba(255, 45, 85, ${Math.min(0.95, 0.18 + typed.length * 0.045)})`,
                  boxShadow: typed
                    ? `0 0 ${10 + typed.length * 1.4}px rgba(255,45,85,${Math.min(0.85, 0.2 + typed.length * 0.04)})`
                    : "none",
                }}
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.02 }}
                disabled={!typed.trim() || processing}
                onClick={() => submitTyped(typed)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-300/70 bg-gradient-to-b from-[#ff4d6d] via-[#ff1a3c] to-[#9b0018] px-4 py-3.5 text-sm font-black uppercase tracking-[0.22em] text-white shadow-[0_0_32px_rgba(255,45,85,0.65)] outline-none focus:ring-4 focus:ring-red-500/50 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {muteProtocol
                  ? "Apologize"
                  : forceTextOnly
                    ? "Send"
                    : "Send Insult"}
              </motion.button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  if (!embedded && portalReady) {
    return createPortal(shell, document.body);
  }
  return shell;
}

function LiveWaveform({ volume }: { volume: number }) {
  const bars = 7;
  const level = Math.min(1, volume / 70);
  return (
    <div className="flex h-6 items-end gap-1" aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const mid = Math.abs(i - (bars - 1) / 2);
        const boost = 0.35 + level * (1 - mid / bars) + (i % 2 === 0 ? 0.15 : 0);
        const h = Math.max(4, Math.round(boost * 22));
        return (
          <motion.span
            key={i}
            className="w-1 rounded-full bg-[#ff2d55]"
            animate={{ height: h }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
          />
        );
      })}
    </div>
  );
}

export default HoldToScream;
