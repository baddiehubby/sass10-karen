"use client";

/**
 * Karen Web Audio ↔ TalkingHead lip-sync pipeline.
 *
 * Flow: text → /api/tts (ElevenLabs MP3) → ArrayBuffer
 *     → AudioContext.decodeAudioData → AudioBuffer
 *     → talkingHead.speakAudio({ audio, words, wtimes, wdurations })
 *
 * Mouth / face are driven by TalkingHead from the real audio + word timings.
 * No fake jaw oscillation — baseline expressions stay mood-only while speaking.
 *
 * Last-resort fallback (no API key / network): speechSynthesis + proxy buffer.
 */

import { apiUrl } from "@/lib/api-url";
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
  /** Prefer TalkingHead's AudioContext when available. */
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

type HeadWithAudio = TalkingHeadLike & {
  audioCtx?: AudioContext;
};

let sharedAudioCtx: AudioContext | null = null;
let speakGeneration = 0;
/** Live TalkingHead registered by Karen3D — lets speakWithKaren(text, mood) find the avatar. */
let registeredHead: TalkingHeadLike | null = null;
let audioUnlocked = false;

export function registerKarenTalkingHead(head: TalkingHeadLike | null): void {
  registeredHead = head;
}

export function getRegisteredKarenTalkingHead(): TalkingHeadLike | null {
  return registeredHead;
}

function getAudioCtor(): typeof AudioContext {
  if (typeof window === "undefined") {
    throw new Error("AudioContext requires a browser");
  }
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  );
}

export function getKarenAudioContext(preferred?: AudioContext | null): AudioContext {
  if (preferred && preferred.state !== "closed") return preferred;
  if (typeof window === "undefined") {
    throw new Error("generateAudioBuffer requires a browser AudioContext");
  }
  const Ctx = getAudioCtor();
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

function headAudioContext(head?: TalkingHeadLike | null): AudioContext | null {
  const ctx = (head as HeadWithAudio | null | undefined)?.audioCtx;
  return ctx && ctx.state !== "closed" ? ctx : null;
}

/**
 * CRITICAL: browsers suspend AudioContext until a user gesture.
 * Call from Sign In / Send / Hold-to-talk before any speakAudio.
 */
export async function unlockKarenAudio(
  head?: TalkingHeadLike | null,
): Promise<AudioContext> {
  const activeHead = head ?? registeredHead;
  const ctx = getKarenAudioContext(headAudioContext(activeHead));

  const resume = async (c: AudioContext) => {
    if (c.state === "suspended" || (c.state as string) === "interrupted") {
      await c.resume().catch(() => undefined);
    }
  };

  await resume(ctx);
  const headCtx = headAudioContext(activeHead);
  if (headCtx && headCtx !== ctx) await resume(headCtx);

  // iOS / Chromium: a zero-length play inside the gesture unlocks reliably.
  if (!audioUnlocked) {
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      audioUnlocked = true;
    } catch {
      /* ignore unlock races */
    }
  }

  return ctx;
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
    const prev = chunks[chunks.length - 1];
    if (prev && prev.length < 8 && t.length < 8) {
      chunks[chunks.length - 1] = `${prev} ${t}`.trim();
    } else {
      chunks.push(t);
    }
  }
  return chunks.length ? chunks : [clean];
}

type TtsFetchResult = {
  buffer: ArrayBuffer;
  /** Server returned a near-silent proxy WAV — layer speechSynthesis. */
  isProxy: boolean;
};

async function fetchTtsArrayBuffer(
  text: string,
  mood?: string | null,
  signal?: AbortSignal,
): Promise<TtsFetchResult> {
  const res = await fetch(apiUrl("/api/tts"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, mood: mood || undefined }),
    signal,
    credentials: "include",
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

  const ab = await res.arrayBuffer();
  if (!ab.byteLength) throw new Error("TTS returned empty body");
  const provider = res.headers.get("X-Karen-TTS");
  return {
    buffer: ab,
    // Only legacy proxy WAV needs speechSynthesis layering.
    isProxy: provider === "proxy",
  };
}

/**
 * Near-silent speech-shaped buffer so TalkingHead.speakAudio can drive visemes
 * while `speechSynthesis` (or nothing) provides the audible voice.
 */
export function synthesizeLipSyncProxyBuffer(
  text: string,
  audioContext?: AudioContext | null,
): AudioBuffer {
  const ctx = getKarenAudioContext(audioContext);
  const wordCount = Math.max(1, text.trim().split(/\s+/).length);
  const durationSec = Math.min(18, Math.max(0.7, wordCount * 0.32));
  const sampleRate = ctx.sampleRate;
  const frames = Math.max(1, Math.floor(durationSec * sampleRate));
  const buffer = ctx.createBuffer(1, frames, sampleRate);
  const data = buffer.getChannelData(0);

  // Quiet pulsed envelope (~ -40 dB) — inaudible next to speechSynthesis, but
  // gives playAudio a real buffer so the anim clock advances with lips.
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const syllable = 0.5 + 0.5 * Math.sin(t * Math.PI * 4.2);
    const amp = 0.008 * syllable;
    data[i] = amp * Math.sin(2 * Math.PI * 180 * t);
  }

  return buffer;
}

function speakBrowserFallback(text: string, onStart?: () => void, onEnd?: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.pitch = 1.15;
  utter.rate = 1.08;
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
  window.speechSynthesis.speak(utter);
}

export type DecodedTts = {
  audioBuffer: AudioBuffer;
  isProxy: boolean;
};

/**
 * Fetch TTS bytes and decode to an AudioBuffer for TalkingHead.speakAudio.
 * Throws if the network/API path fails — callers may fall back to proxy buffer.
 */
export async function generateAudioBuffer(
  text: string,
  opts: GenerateAudioBufferOptions = {},
): Promise<AudioBuffer> {
  const decoded = await generateAudioBufferDetailed(text, opts);
  return decoded.audioBuffer;
}

export async function generateAudioBufferDetailed(
  text: string,
  opts: GenerateAudioBufferOptions = {},
): Promise<DecodedTts> {
  const clean = stripMoodTags(text).replace(/\s+/g, " ").trim();
  if (!clean) {
    throw new Error("generateAudioBuffer: empty text");
  }

  const { buffer, isProxy } = await fetchTtsArrayBuffer(clean, opts.mood, opts.signal);
  const ctx = getKarenAudioContext(opts.audioContext);
  if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
    await ctx.resume().catch(() => undefined);
  }

  // decodeAudioData detaches the buffer in some engines — copy first.
  const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
  return { audioBuffer, isProxy };
}

/**
 * Primary bridge: text (+ mood) → AudioBuffer via ElevenLabs `/api/tts`.
 * On failure builds a lip-sync proxy buffer (last resort).
 */
export async function getAudioBuffer(
  text: string,
  mood: string = "SARCASTIC",
  opts: GenerateAudioBufferOptions = {},
): Promise<AudioBuffer> {
  const clean = stripMoodTags(text).replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("getAudioBuffer: empty text");

  const ctx = getKarenAudioContext(opts.audioContext);
  await unlockKarenAudio(
    opts.audioContext ? ({ audioCtx: opts.audioContext } as TalkingHeadLike) : registeredHead,
  );

  try {
    const { audioBuffer } = await generateAudioBufferDetailed(clean, {
      ...opts,
      mood,
      audioContext: ctx,
    });
    return audioBuffer;
  } catch (err) {
    console.warn("[getAudioBuffer] ElevenLabs TTS unavailable — lip-sync proxy buffer", err);
    return synthesizeLipSyncProxyBuffer(clean, ctx);
  }
}

/**
 * Pass a decoded ElevenLabs AudioBuffer into TalkingHead.
 * Word timings + lipsyncLang let the real MP3 drive mouth / face — no fake jaw.
 */
function feedSpeakAudio(
  head: TalkingHeadLike,
  audioBuffer: AudioBuffer,
  text: string,
): number {
  const durationMs = Math.max(200, audioBuffer.duration * 1000);
  const timings = buildWordTimings(text, durationMs);

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

async function speakOneShot(
  text: string,
  head: TalkingHeadLike | null,
  mood: string,
  gen: number,
  signal?: AbortSignal,
): Promise<{ durationMs: number; usedProxy: boolean }> {
  const ctx = getKarenAudioContext(headAudioContext(head));
  await unlockKarenAudio(head);

  let usedProxy = false;
  let audioBuffer: AudioBuffer;
  try {
    const decoded = await generateAudioBufferDetailed(text, {
      mood,
      signal,
      audioContext: ctx,
    });
    audioBuffer = decoded.audioBuffer;
    usedProxy = decoded.isProxy;
  } catch (err) {
    console.warn("[speakOneShot] TTS failed — proxy + speechSynthesis", err);
    audioBuffer = synthesizeLipSyncProxyBuffer(text, ctx);
    usedProxy = true;
  }

  if (gen !== speakGeneration || signal?.aborted) {
    return { durationMs: 0, usedProxy };
  }

  if (head && typeof head.speakAudio === "function") {
    const durationMs = feedSpeakAudio(head, audioBuffer, text);
    if (usedProxy) speakBrowserFallback(text);
    return { durationMs, usedProxy };
  }

  // No TalkingHead — play decoded TTS or browser voice.
  if (!usedProxy) {
    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.start(0);
    return { durationMs: Math.max(200, audioBuffer.duration * 1000), usedProxy };
  }
  speakBrowserFallback(text);
  return { durationMs: Math.max(200, audioBuffer.duration * 1000), usedProxy };
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
): Promise<{ durationMs: number; usedProxy: boolean }> {
  const chunks = chunkSpeechText(fullText);
  if (chunks.length <= 1) {
    return speakOneShot(fullText, head, mood, gen, signal);
  }

  await unlockKarenAudio(head);
  const ctx = getKarenAudioContext(headAudioContext(head));

  let totalMs = 0;
  let anyProxy = false;

  const loadChunk = async (piece: string): Promise<{ audioBuffer: AudioBuffer; isProxy: boolean }> => {
    try {
      return await generateAudioBufferDetailed(piece, { mood, signal, audioContext: ctx });
    } catch (err) {
      console.warn("[voice] chunk TTS failed", err);
      return { audioBuffer: synthesizeLipSyncProxyBuffer(piece, ctx), isProxy: true };
    }
  };

  let nextPromise: Promise<{ audioBuffer: AudioBuffer; isProxy: boolean }> | null = loadChunk(
    chunks[0]!,
  );

  for (let i = 0; i < chunks.length; i++) {
    if (gen !== speakGeneration || signal?.aborted) break;

    const { audioBuffer, isProxy } = await nextPromise!;
    if (gen !== speakGeneration || signal?.aborted) break;
    if (isProxy) anyProxy = true;

    const nextText = chunks[i + 1];
    nextPromise = nextText ? loadChunk(nextText) : null;

    const piece = chunks[i]!;
    if (head && typeof head.speakAudio === "function") {
      totalMs += feedSpeakAudio(head, audioBuffer, piece) + 80;
    } else if (!isProxy) {
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      src.start(0);
      totalMs += Math.max(200, audioBuffer.duration * 1000) + 80;
    } else {
      totalMs += Math.max(200, audioBuffer.duration * 1000) + 80;
    }
  }

  if (anyProxy) speakBrowserFallback(fullText);
  return { durationMs: totalMs, usedProxy: anyProxy };
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
  const useChunks = opts.chunk !== false;

  // Mood face only — TalkingHead speakAudio owns the mouth from real audio.
  applyExpressionToTalkingHead(head, mood, { isSpeaking: false });

  try {
    await unlockKarenAudio(head);
    dispatchKarenSpeaking(true);
    opts.onStart?.();

    const { durationMs, usedProxy } = useChunks
      ? await speakChunked(clean, head, mood, gen, opts.signal)
      : await speakOneShot(clean, head, mood, gen, opts.signal);

    if (gen !== speakGeneration || opts.signal?.aborted) return;

    // When speechSynthesis owns the voice, wait until it finishes.
    if (usedProxy && typeof window !== "undefined" && window.speechSynthesis) {
      await new Promise<void>((resolve) => {
        const started = Date.now();
        const poll = window.setInterval(() => {
          if (!window.speechSynthesis.speaking || Date.now() - started > durationMs + 4000) {
            window.clearInterval(poll);
            resolve();
          }
        }, 120);
      });
    } else {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), Math.max(durationMs, 200) + 280);
      });
    }

    if (gen === speakGeneration) {
      applyExpressionToTalkingHead(head, mood, { isSpeaking: false });
      dispatchKarenSpeaking(false);
      opts.onEnd?.();
    }
  } catch (err) {
    if (opts.signal?.aborted) return;
    console.warn("[speakWithKaren] ElevenLabs pipeline failed — last-resort browser voice", err);
    opts.onError?.(err);

    try {
      await unlockKarenAudio(head);
      if (head && typeof head.speakAudio === "function") {
        const proxy = synthesizeLipSyncProxyBuffer(clean, headAudioContext(head));
        feedSpeakAudio(head, proxy, clean);
      }
    } catch {
      /* viseme-only optional */
    }
    speakBrowserFallback(clean, opts.onStart, () => {
      applyExpressionToTalkingHead(head, mood, { isSpeaking: false });
      opts.onEnd?.();
    });
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
