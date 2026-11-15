"use client";

/**
 * Karen Web Audio ↔ TalkingHead lip-sync pipeline.
 *
 * Flow: text → /api/karen/tts (ArrayBuffer) → AudioContext.decodeAudioData
 *     → AudioBuffer → talkingHead.speakAudio({ audio, words, wtimes, wdurations })
 *
 * Sentence chunking starts playback on the first ready chunk so she speaks ASAP.
 */

import {
  applyExpressionToTalkingHead,
  normalizeMood,
  parseMoodTag,
  stripMoodTags,
  type TalkingHeadLike,
} from "@/lib/karen/expression-bridge";
import { buildWordTimings } from "@/lib/karen/tts-word-timings";
import { dispatchKarenSpeaking } from "@/lib/karen/talkinghead-bus";

export type GenerateAudioBufferOptions = {
  mood?: string | null;
  signal?: AbortSignal;
  /** Optional shared AudioContext (TalkingHead's ctx preferred when available). */
  audioContext?: AudioContext | null;
};

export type SpeakWithKarenOptions = {
  head?: TalkingHeadLike | null;
  mood?: string | null;
  signal?: AbortSignal;
  /** Prefer sentence chunking so lips move before the full reply is synthesized. */
  chunk?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
};

let sharedAudioCtx: AudioContext | null = null;
let speakGeneration = 0;
/** Live TalkingHead registered by Karen3D — lets speakWithKaren(text, mood) find the avatar. */
let registeredHead: TalkingHeadLike | null = null;

export function registerKarenTalkingHead(head: TalkingHeadLike | null): void {
  registeredHead = head;
}

export function getRegisteredKarenTalkingHead(): TalkingHeadLike | null {
  return registeredHead;
}

export function getKarenAudioContext(preferred?: AudioContext | null): AudioContext {
  if (preferred && preferred.state !== "closed") return preferred;
  if (typeof window === "undefined") {
    throw new Error("generateAudioBuffer requires a browser AudioContext");
  }
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

/** Split into speakable sentence chunks (keeps punctuation with the sentence). */
export function chunkSpeechText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts) return [clean];
  const chunks: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    // Only glue a tiny fragment onto a previous *tiny* fragment (avoid collapsing
    // "Get up. Now. Move!" into one blob).
    const prev = chunks[chunks.length - 1];
    if (prev && prev.length < 8 && t.length < 8) {
      chunks[chunks.length - 1] = `${prev} ${t}`.trim();
    } else {
      chunks.push(t);
    }
  }
  return chunks.length ? chunks : [clean];
}

async function fetchTtsArrayBuffer(
  text: string,
  mood?: string | null,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch("/api/karen/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg, audio/wav, audio/*" },
    body: JSON.stringify({ text, mood: mood || undefined }),
    signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string };
      detail = j.error || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `TTS HTTP ${res.status}`);
  }

  return res.arrayBuffer();
}

/**
 * Fetch TTS bytes and decode to an AudioBuffer for TalkingHead.speakAudio.
 * Uses `/api/karen/tts` (OpenAI / Google / local fallback).
 */
export async function generateAudioBuffer(
  text: string,
  opts: GenerateAudioBufferOptions = {},
): Promise<AudioBuffer> {
  const clean = stripMoodTags(text).replace(/\s+/g, " ").trim();
  if (!clean) {
    throw new Error("generateAudioBuffer: empty text");
  }

  const ab = await fetchTtsArrayBuffer(clean, opts.mood, opts.signal);
  const ctx = getKarenAudioContext(opts.audioContext);
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }

  // decodeAudioData detaches the buffer in some engines — copy first.
  return ctx.decodeAudioData(ab.slice(0));
}

function speakBrowserFallback(text: string, onStart?: () => void, onEnd?: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.pitch = 1.2;
  utter.rate = 1.1;
  utter.onstart = () => {
    dispatchKarenSpeaking(true);
    onStart?.();
  };
  utter.onend = () => {
    dispatchKarenSpeaking(false);
    onEnd?.();
  };
  utter.onerror = () => {
    dispatchKarenSpeaking(false);
    onEnd?.();
  };
  dispatchKarenSpeaking(true);
  onStart?.();
  window.speechSynthesis.speak(utter);
}

function feedSpeakAudio(
  head: TalkingHeadLike,
  audioBuffer: AudioBuffer,
  text: string,
): number {
  const durationMs = Math.max(200, audioBuffer.duration * 1000);
  const timings = buildWordTimings(text, durationMs);

  // TalkingHead expects an audio *object*, not a bare AudioBuffer.
  head.speakAudio?.(
    {
      audio: audioBuffer,
      words: timings.words,
      wtimes: timings.wtimes,
      wdurations: timings.wdurations,
    },
    { lipsyncLang: "en" },
  );

  return durationMs;
}

function playBufferLocally(ctx: AudioContext, audioBuffer: AudioBuffer): number {
  const src = ctx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(ctx.destination);
  src.start(0);
  return Math.max(200, audioBuffer.duration * 1000);
}

async function speakOneShot(
  text: string,
  head: TalkingHeadLike | null,
  mood: string,
  gen: number,
  signal?: AbortSignal,
): Promise<number> {
  const audioBuffer = await generateAudioBuffer(text, { mood, signal });
  if (gen !== speakGeneration || signal?.aborted) return 0;

  if (head && typeof head.speakAudio === "function") {
    return feedSpeakAudio(head, audioBuffer, text);
  }
  return playBufferLocally(getKarenAudioContext(), audioBuffer);
}

/**
 * Chunked speak: synthesize sentence N+1 while N plays → lips move sooner.
 */
async function speakChunked(
  fullText: string,
  head: TalkingHeadLike | null,
  mood: string,
  gen: number,
  signal?: AbortSignal,
): Promise<number> {
  const chunks = chunkSpeechText(fullText);
  if (chunks.length <= 1) {
    return speakOneShot(fullText, head, mood, gen, signal);
  }

  let totalMs = 0;
  let nextPromise: Promise<AudioBuffer> | null = generateAudioBuffer(chunks[0]!, {
    mood,
    signal,
  });

  for (let i = 0; i < chunks.length; i++) {
    if (gen !== speakGeneration || signal?.aborted) break;

    const audioBuffer = await nextPromise!;
    if (gen !== speakGeneration || signal?.aborted) break;

    // Prefetch next chunk while this one plays / queues.
    const nextText = chunks[i + 1];
    nextPromise = nextText
      ? generateAudioBuffer(nextText, { mood, signal }).catch((err) => {
          console.warn("[voice] chunk TTS failed", err);
          throw err;
        })
      : null;

    const piece = chunks[i]!;
    const dur =
      head && typeof head.speakAudio === "function"
        ? feedSpeakAudio(head, audioBuffer, piece)
        : playBufferLocally(getKarenAudioContext(), audioBuffer);

    totalMs += dur + 80;
  }

  return totalMs;
}

/**
 * Apply mood expression, then drive TalkingHead lips with a decoded AudioBuffer.
 *
 * @example
 * await speakWithKaren("Get up. Now.", "ANGRY");
 * await speakWithKaren(reply, { mood: "SARCASTIC", head, chunk: true });
 */
export async function speakWithKaren(
  text: string,
  moodOrOpts: string | SpeakWithKarenOptions = "SARCASTIC",
  maybeHead?: TalkingHeadLike | null,
): Promise<void> {
  const opts: SpeakWithKarenOptions =
    typeof moodOrOpts === "string"
      ? { mood: moodOrOpts, head: maybeHead }
      : { ...moodOrOpts, head: moodOrOpts.head ?? maybeHead };

  const clean = stripMoodTags(text).replace(/\s+/g, " ").trim();
  if (!clean) {
    opts.onEnd?.();
    return;
  }

  const mood = normalizeMood(opts.mood || parseMoodTag(text) || "SARCASTIC");
  const head = opts.head ?? registeredHead;
  const gen = ++speakGeneration;
  const useChunks = opts.chunk !== false; // default ON for snappier lips

  // Face first so furrowed brows land before audio.
  applyExpressionToTalkingHead(head, mood, { isSpeaking: true });

  try {
    dispatchKarenSpeaking(true);
    opts.onStart?.();

    const durationMs = useChunks
      ? await speakChunked(clean, head, mood, gen, opts.signal)
      : await speakOneShot(clean, head, mood, gen, opts.signal);

    if (gen !== speakGeneration || opts.signal?.aborted) return;

    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), Math.max(durationMs, 200) + 280);
    });

    if (gen === speakGeneration) {
      applyExpressionToTalkingHead(head, mood, { isSpeaking: false });
      dispatchKarenSpeaking(false);
      opts.onEnd?.();
    }
  } catch (err) {
    if (opts.signal?.aborted) return;
    console.warn("[speakWithKaren] TTS decode pipeline failed — browser fallback", err);
    opts.onError?.(err);

    if (head && typeof head.speakAudio === "function") {
      const approxMs = Math.max(800, clean.split(/\s+/).length * 320);
      const timings = buildWordTimings(clean, approxMs);
      try {
        head.speakAudio(
          {
            words: timings.words,
            wtimes: timings.wtimes,
            wdurations: timings.wdurations,
          },
          { lipsyncLang: "en" },
        );
      } catch {
        /* viseme-only optional */
      }
    }
    speakBrowserFallback(clean, opts.onStart, opts.onEnd);
  }
}

/** Cancel in-flight speak + browser TTS. */
export function stopKarenSpeech(): void {
  speakGeneration += 1;
  dispatchKarenSpeaking(false);
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
