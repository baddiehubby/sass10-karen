"use client";

/**
 * Hold-to-Scream — Web Speech API + getUserMedia (gesture-gated).
 *
 * CRITICAL:
 * - Call `startListening()` from `onPointerDown` (user-gesture stack).
 * - Keep `webkitSpeechRecognition` in a useRef so re-renders never destroy it.
 * - Soft silence/`onend` → auto-restart while still holding (never unmount UI).
 *
 * Mic Toggle Abuse (unhinged Karen):
 * - 30% press → "No. I'm talking." + interrupt WAV + 5s lock
 * - 20% release → mute WAV + turn back + 10s lock
 * - Hold ≥3s talking → random interrupts WAV + cut mic
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AvatarState,
  getAvatarState,
  isAvatarSpeaking,
  setAvatarState,
  subscribeAvatarState,
} from "@/lib/karen/avatar-state";
import { SCREAM_VOLUME_THRESHOLD } from "@/lib/karen/smack-back";

export { AvatarState } from "@/lib/karen/avatar-state";

/** Lazy — avoids mic↔voice circular init crashes under Fast Refresh. */
function cutKarenVoice(): void {
  void import("@/lib/karen/voice")
    .then((m) => m.pauseKarenAudio())
    .catch(() => undefined);
}

/** 30% — Karen denies the mic the moment you press. */
export const MIC_PRESS_TALKING_CHANCE = 0.3;
/** 20% — Karen mutes you the moment you release. */
export const MIC_RELEASE_MUTE_CHANCE = 0.2;
/** Force-listen lock after "No. I'm talking." */
export const MIC_TALKING_LOCK_MS = 5_000;
/** Petty mute lock after release abuse. */
export const MIC_RELEASE_MUTE_LOCK_MS = 10_000;
/** Hold/talk this long without Karen interrupting → cut mic + interrupt WAV. */
export const MIC_HOLD_INTERRUPT_MS = 3_000;
/** Dignity hit when the 3s talk-interrupt fires (matches FIGHT_DIGNITY_HIT). */
export const MIC_HOLD_INTERRUPT_DIGNITY = 10;

export const IM_TALKING_LINE = "No. I'm talking.";
export const IM_TALKING_AUDIO_ID = "smackback:im_talking";
/** Reuse the loud volume-interrupt WAV — already aggressive. */
export const IM_TALKING_SRC = "/audio/smackbacks/volume_interrupt.wav";

export const RELEASE_MUTE_LINE = "Mute. We're done with your little speech.";
export const RELEASE_MUTE_AUDIO_ID = "smackback:release_mute";
export const RELEASE_MUTE_SRC = "/audio/mute/mute.wav";

export const HOLD_INTERRUPT_LINE = "DON'T YOU DARE RAISE YOUR VOICE AT ME!";
export const HOLD_INTERRUPT_AUDIO_ID = "smackback:hold_interrupt";
export const HOLD_INTERRUPT_SRC = "/audio/smackbacks/volume_interrupt.wav";

export type MicAbuseRoll = {
  imTalking: boolean;
  releaseMute: boolean;
};

/** Pure RNG hooks — inject `rng` in tests. */
export function rollMicPressTalkingDenial(rng: () => number = Math.random): boolean {
  return rng() < MIC_PRESS_TALKING_CHANCE;
}

export function rollMicReleaseMute(rng: () => number = Math.random): boolean {
  return rng() < MIC_RELEASE_MUTE_CHANCE;
}

export function rollMicAbuse(rng: () => number = Math.random): MicAbuseRoll {
  return {
    imTalking: rollMicPressTalkingDenial(rng),
    releaseMute: rollMicReleaseMute(rng),
  };
}

export type ScreamMicError =
  | "unsupported"
  | "denied"
  | "no-speech"
  | "timeout"
  | "error";

/** Reveal typed combat lane if SpeechRecognition produces nothing. */
export const SPEECH_FALLBACK_TIMEOUT_MS = 4_000;

/**
 * Yell threshold on AnalyserNode RMS (0–1 from time-domain samples).
 * Frequency averages alone feel flaky — RMS catches a real scream.
 */
export const YELL_RMS_THRESHOLD = 0.32;

/** Need this many consecutive loud frames (~3 @ 60fps) before cutting the mic. */
const YELL_SUSTAIN_FRAMES = 3;

const FALLBACK_HINT = "Mic broken? Type your insult, coward.";
const SOFT_TOAST = "Mic error. Hold again.";

/** Shown next to the native browser permission popup — we cannot move that popup. */
export const MIC_PERMISSION_COPY =
  "My microphone is locked. Tap below to give me permission to scream at you.";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function getAudioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

export function isScreamMicSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/**
 * Must be invoked from a user gesture (pointerdown / click).
 * Prompts the browser permission dialog and returns a live MediaStream.
 */
export async function requestMicStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia unavailable");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
    },
    video: false,
  });
}

export type UseScreamMicOptions = {
  /** Final transcript on release (skipped if volume interrupt already fired). */
  onResult: (transcript: string) => void;
  /** High volume mid-hold — Karen interrupts immediately. */
  onLoud?: (level: number) => void;
  /** Hold started / stopped — combat stare. */
  onListeningChange?: (listening: boolean) => void;
  /** Soft toast (e.g. "Mic error. Hold again.") — never unmount the button. */
  onToast?: (message: string) => void;
  lang?: string;
  volumeThreshold?: number;
};

export type UseScreamMicReturn = {
  supported: boolean;
  listening: boolean;
  /** Hard failure — prefer typed input, but keep the mic button mounted. */
  preferTextInput: boolean;
  error: ScreamMicError | null;
  fallbackHint: string | null;
  toast: string | null;
  flashError: boolean;
  volume: number;
  /** Live combat state machine (IDLE / LISTENING / SPEAKING / MUTED). */
  avatarState: AvatarState;
  /**
   * True while Karen is SPEAKING — Hold-to-Scream should soft-disable concurrent
   * screams, but still accept a press to barge-in (cut her voice → LISTENING).
   */
  speakingLocked: boolean;
  /** Cut SPEAKING audio instantly and enter LISTENING (mic barge-in). */
  interruptSpeaking: () => void;
  /** Mark counter-attack about to play (call before playKarenAudio). */
  beginSpeaking: () => void;
  startListening: (gestureStream?: Promise<MediaStream> | null) => void;
  stopListening: () => void;
  cancelListening: () => void;
  clearError: () => void;
  clearToast: () => void;
  /** Live interim/final transcript while holding (alarm awake-challenge, etc.). */
  getTranscript: () => string;
};

/**
 * Hold-to-scream: getUserMedia (gesture) → SpeechRecognition + AnalyserNode.
 * Recognition instance lives in a ref across React re-renders.
 */
export function useScreamMic({
  onResult,
  onLoud,
  onListeningChange,
  onToast,
  lang = "en-US",
  volumeThreshold = SCREAM_VOLUME_THRESHOLD,
}: UseScreamMicOptions): UseScreamMicReturn {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [preferTextInput, setPreferTextInput] = useState(false);
  const [error, setError] = useState<ScreamMicError | null>(null);
  const [fallbackHint, setFallbackHint] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flashError, setFlashError] = useState(false);
  const [volume, setVolume] = useState(0);
  const [avatarState, setAvatarStateUi] = useState<AvatarState>(() => getAvatarState());

  useEffect(() => subscribeAvatarState(setAvatarStateUi), []);

  const interruptSpeaking = useCallback(() => {
    if (!isAvatarSpeaking() && getAvatarState() !== AvatarState.SPEAKING) return;
    cutKarenVoice();
    setAvatarState(AvatarState.LISTENING);
  }, []);

  const beginSpeaking = useCallback(() => {
    setAvatarState(AvatarState.SPEAKING);
  }, []);

  const onResultRef = useRef(onResult);
  const onLoudRef = useRef(onLoud);
  const onListeningChangeRef = useRef(onListeningChange);
  const onToastRef = useRef(onToast);

  /** Survives re-renders — never put SpeechRecognition in useState. */
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const ctorRef = useRef<SpeechRecognitionCtor | null>(null);
  const transcriptRef = useRef("");
  const wantListenRef = useRef(false);
  const finalizingRef = useRef(false);
  const interruptedRef = useRef(false);
  const cancelledRef = useRef(false);
  const mediaRef = useRef<MediaStream | null>(null);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const startGenRef = useRef(0);
  const flashTimerRef = useRef(0);
  const fallbackTimerRef = useRef(0);
  const yellFramesRef = useRef(0);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    onLoudRef.current = onLoud;
  }, [onLoud]);
  useEffect(() => {
    onListeningChangeRef.current = onListeningChange;
  }, [onListeningChange]);
  useEffect(() => {
    onToastRef.current = onToast;
  }, [onToast]);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    ctorRef.current = Ctor;
    const ok = Ctor != null;
    setSupported(ok);
    if (!ok) {
      setPreferTextInput(true);
      setFallbackHint(FALLBACK_HINT);
      setError("unsupported");
    }
  }, []);

  const flashSoftError = useCallback((message: string) => {
    setFlashError(true);
    setToast(message);
    onToastRef.current?.(message);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashError(false);
      flashTimerRef.current = 0;
    }, 1400);
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = 0;
    }
  }, []);

  const revealTypedFallback = useCallback(
    (err: ScreamMicError, hint = FALLBACK_HINT) => {
      // Keep mic button mounted — only open the typed combat lane.
      setPreferTextInput(true);
      setError(err);
      setFallbackHint(hint);
    },
    [],
  );

  const preferTyped = useCallback(
    (err: ScreamMicError) => {
      revealTypedFallback(err);
      setListening(false);
      onListeningChangeRef.current?.(false);
    },
    [revealTypedFallback],
  );

  const stopAnalyser = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    mediaRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    mediaRef.current = null;
    const ctx = analyserCtxRef.current;
    analyserCtxRef.current = null;
    if (ctx) void ctx.close().catch(() => undefined);
    setVolume(0);
    yellFramesRef.current = 0;
  }, []);

  /**
   * Volume interrupt — Web Audio AnalyserNode RMS, not Speech-to-Text.
   * Yell hard → abort mic immediately → onLoud → interrupt WAV + shake.
   */
  const attachAnalyser = useCallback(
    async (stream: MediaStream) => {
      const Ctor = getAudioCtor();
      if (!Ctor) return;

      try {
        mediaRef.current = stream;
        const ctx = new Ctor();
        if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
        analyserCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);
        const timeData = new Uint8Array(analyser.fftSize);
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        yellFramesRef.current = 0;

        const cutForYell = (level: number) => {
          if (interruptedRef.current) return;
          interruptedRef.current = true;
          wantListenRef.current = false;
          clearFallbackTimer();
          try {
            recRef.current?.abort();
          } catch {
            /* ignore */
          }
          stopAnalyser();
          setListening(false);
          onListeningChangeRef.current?.(false);
          console.info("[useScreamMic] VOLUME INTERRUPT rms/level=", level.toFixed(3));
          onLoudRef.current?.(level);
        };

        const tick = () => {
          if (!wantListenRef.current || interruptedRef.current || finalizingRef.current) {
            return;
          }

          // Primary: time-domain RMS (yell energy).
          analyser.getByteTimeDomainData(timeData);
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i]! - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / timeData.length);

          // Secondary: frequency average for waveform UI (0–255 scale).
          analyser.getByteFrequencyData(freqData);
          let freqSum = 0;
          for (let i = 0; i < freqData.length; i++) freqSum += freqData[i]!;
          const freqAvg = freqSum / freqData.length;
          setVolume(freqAvg);

          const yelling =
            rms >= YELL_RMS_THRESHOLD || freqAvg >= volumeThreshold;

          if (yelling) {
            yellFramesRef.current += 1;
            if (yellFramesRef.current >= YELL_SUSTAIN_FRAMES) {
              cutForYell(Math.max(rms, freqAvg / 255));
              return;
            }
          } else {
            yellFramesRef.current = 0;
          }

          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.warn("[useScreamMic] analyser attach failed", err);
      }
    },
    [clearFallbackTimer, stopAnalyser, volumeThreshold],
  );

  const wireRecognitionHandlers = useCallback(
    (rec: SpeechRecognitionLike, gen: number) => {
      rec.onstart = () => {
        if (wantListenRef.current && gen === startGenRef.current) {
          setListening(true);
          onListeningChangeRef.current?.(true);
        }
      };

      rec.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i++) {
          const alt = ev.results[i]?.[0]?.transcript;
          if (alt) parts.push(alt);
        }
        transcriptRef.current = parts.join(" ").replace(/\s+/g, " ").trim();
        // Got speech — cancel the "mic broken" typed fallback timer.
        if (transcriptRef.current) clearFallbackTimer();
      };

      rec.onerror = (ev) => {
        const code = (ev.error || "").toLowerCase();
        if (gen !== startGenRef.current) return;

        if (code === "aborted") return;

        // Soft: silence / network blips while holding — stay alive, toast, auto-restart via onend.
        // Also open typed fallback so the fight never dies.
        if (
          (code === "no-speech" || code === "network" || code === "audio-capture") &&
          wantListenRef.current &&
          !finalizingRef.current
        ) {
          setError(code === "no-speech" ? "no-speech" : "error");
          revealTypedFallback(code === "no-speech" ? "no-speech" : "error");
          flashSoftError(SOFT_TOAST);
          return;
        }

        if (code === "not-allowed" || code === "service-not-allowed") {
          wantListenRef.current = false;
          clearFallbackTimer();
          stopAnalyser();
          preferTyped("denied");
          flashSoftError(SOFT_TOAST);
          return;
        }

        if (code === "no-speech" && finalizingRef.current) {
          setError("no-speech");
          revealTypedFallback("no-speech");
          return;
        }

        // Hard-ish but keep the button — flash + toast + typed fallback.
        wantListenRef.current = false;
        clearFallbackTimer();
        stopAnalyser();
        setListening(false);
        onListeningChangeRef.current?.(false);
        revealTypedFallback("error");
        flashSoftError(SOFT_TOAST);
      };

      rec.onend = () => {
        if (gen !== startGenRef.current) return;

        // Still holding → browser auto-stopped after silence. Restart same ref instance.
        if (
          wantListenRef.current &&
          !finalizingRef.current &&
          !interruptedRef.current &&
          !cancelledRef.current
        ) {
          try {
            rec.start();
            return;
          } catch (err) {
            console.warn("[useScreamMic] restart after onend failed", err);
            revealTypedFallback("error");
            flashSoftError(SOFT_TOAST);
            // Fall through to settle UI — button stays mounted.
          }
        }

        setListening(false);
        // Only notify combat-end when we are truly done (not mid-restart).
        if (finalizingRef.current || cancelledRef.current || interruptedRef.current) {
          onListeningChangeRef.current?.(false);
        }

        clearFallbackTimer();
        stopAnalyser();
        const text = transcriptRef.current.trim();
        const wasWanted = wantListenRef.current || finalizingRef.current;
        const wasInterrupted = interruptedRef.current;
        const wasCancelled = cancelledRef.current;
        wantListenRef.current = false;
        finalizingRef.current = false;
        cancelledRef.current = false;

        if (wasInterrupted || wasCancelled) return;
        if (wasWanted && text) {
          onResultRef.current(text);
        } else if (wasWanted && !text) {
          // Released / settled with nothing — open typed combat lane.
          revealTypedFallback("no-speech");
        }
      };
    },
    [clearFallbackTimer, flashSoftError, preferTyped, revealTypedFallback, stopAnalyser],
  );

  const teardownRecognition = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      rec.abort();
    } catch {
      /* ignore */
    }
    // Keep the slot — we recreate on next start; never store SR in React state.
    recRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    stopAnalyser();
    teardownRecognition();
  }, [stopAnalyser, teardownRecognition]);

  useEffect(
    () => () => {
      teardown();
      clearFallbackTimer();
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    },
    [clearFallbackTimer, teardown],
  );

  /**
   * USER GESTURE ENTRY — call from onPointerDown only.
   * SpeechRecognition lives in recRef across re-renders.
   */
  const startListening = useCallback(
    (gestureStream?: Promise<MediaStream> | null) => {
      const Ctor = ctorRef.current ?? getSpeechRecognitionCtor();
      if (!Ctor) {
        setSupported(false);
        preferTyped("unsupported");
        flashSoftError(SOFT_TOAST);
        return;
      }
      ctorRef.current = Ctor;

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        preferTyped("unsupported");
        flashSoftError(SOFT_TOAST);
        return;
      }

      const gen = ++startGenRef.current;
      stopAnalyser();
      teardownRecognition();

      transcriptRef.current = "";
      wantListenRef.current = true;
      finalizingRef.current = false;
      interruptedRef.current = false;
      cancelledRef.current = false;
      setError(null);
      setToast(null);
      // Soft errors can prefer text — but a new hold clears that unless unsupported permanently.
      if (error !== "unsupported") {
        setPreferTextInput(false);
        setFallbackHint(null);
      }
      setListening(true);
      setAvatarState(AvatarState.LISTENING);
      onListeningChangeRef.current?.(true);

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      wireRecognitionHandlers(rec, gen);
      recRef.current = rec;

      try {
        rec.start();
      } catch (err) {
        console.warn("[useScreamMic] SpeechRecognition.start failed", err);
        flashSoftError(SOFT_TOAST);
        revealTypedFallback("error");
        setListening(false);
        onListeningChangeRef.current?.(false);
        return;
      }

      // 4s with no usable transcript → auto-reveal typed insult lane.
      clearFallbackTimer();
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = 0;
        if (gen !== startGenRef.current) return;
        if (interruptedRef.current || cancelledRef.current) return;
        if (transcriptRef.current.trim()) return;
        console.warn(
          "[useScreamMic] SpeechRecognition timeout — revealing typed fallback",
        );
        revealTypedFallback("timeout");
        flashSoftError(SOFT_TOAST);
      }, SPEECH_FALLBACK_TIMEOUT_MS);

      // Analyser runs in parallel — volume interrupt does not wait on STT.
      const permissionPromise = gestureStream ?? requestMicStream();
      void (async () => {
        try {
          const stream = await permissionPromise;
          if (gen !== startGenRef.current || !wantListenRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          await attachAnalyser(stream);
        } catch (err) {
          console.warn("[useScreamMic] getUserMedia denied/failed", err);
          if (gen !== startGenRef.current) return;
          // No mic stream → typed fallback (STT alone is unreliable).
          preferTyped("denied");
          flashSoftError(SOFT_TOAST);
        }
      })();
    },
    [
      attachAnalyser,
      clearFallbackTimer,
      error,
      flashSoftError,
      lang,
      preferTyped,
      revealTypedFallback,
      stopAnalyser,
      teardownRecognition,
      wireRecognitionHandlers,
    ],
  );

  /** Call from onPointerUp — finalize transcript via recognition.onend. */
  const stopListening = useCallback(() => {
    const rec = recRef.current;
    finalizingRef.current = true;
    clearFallbackTimer();
    stopAnalyser();

    if (!rec) {
      setListening(false);
      onListeningChangeRef.current?.(false);
      const text = transcriptRef.current.trim();
      if ((wantListenRef.current || finalizingRef.current) && text) {
        // Counter-attack starts immediately — SPEAKING before audio play.
        setAvatarState(AvatarState.SPEAKING);
        onResultRef.current(text);
      } else if (!text) {
        setAvatarState(AvatarState.IDLE);
        revealTypedFallback("no-speech");
      }
      wantListenRef.current = false;
      finalizingRef.current = false;
      return;
    }

    try {
      rec.stop();
    } catch {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      setListening(false);
      onListeningChangeRef.current?.(false);
      const text = transcriptRef.current.trim();
      if (text) {
        setAvatarState(AvatarState.SPEAKING);
        onResultRef.current(text);
      } else {
        setAvatarState(AvatarState.IDLE);
      }
      wantListenRef.current = false;
      finalizingRef.current = false;
    }
  }, [clearFallbackTimer, revealTypedFallback, stopAnalyser]);

  /** WhatsApp-style slide-up cancel — abort, never call onResult. */
  const cancelListening = useCallback(() => {
    cancelledRef.current = true;
    wantListenRef.current = false;
    finalizingRef.current = false;
    startGenRef.current += 1;
    clearFallbackTimer();
    const rec = recRef.current;
    stopAnalyser();
    if (getAvatarState() === AvatarState.LISTENING) {
      setAvatarState(AvatarState.IDLE);
    }
    if (!rec) {
      setListening(false);
      onListeningChangeRef.current?.(false);
      return;
    }
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
    setListening(false);
    onListeningChangeRef.current?.(false);
    recRef.current = null;
  }, [clearFallbackTimer, stopAnalyser]);

  const clearError = useCallback(() => {
    setError(null);
    setFallbackHint(null);
    if (error !== "unsupported") setPreferTextInput(false);
  }, [error]);

  const clearToast = useCallback(() => setToast(null), []);

  const getTranscript = useCallback(() => transcriptRef.current, []);

  return {
    supported,
    listening,
    preferTextInput,
    error,
    fallbackHint,
    toast,
    flashError,
    volume,
    avatarState,
    speakingLocked: avatarState === AvatarState.SPEAKING,
    interruptSpeaking,
    beginSpeaking,
    startListening,
    stopListening,
    cancelListening,
    clearError,
    clearToast,
    getTranscript,
  };
}
