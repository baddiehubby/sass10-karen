"use client";

/**
 * Karen Web Audio ↔ TalkingHead lip-sync pipeline.
 *
 * Strict path: fetch MP3/TTS bytes → decodeAudioData → TalkingHead.speakAudio.
 * TalkingHead owns createBufferSource().start() on the same AudioContext clock
 * as visemes — never HTMLAudioElement / speechSynthesis for the roast stage.
 */

import { apiUrl } from "@/lib/api-url";
import {
  resolveKarenSpeech,
  type DynamicInserts,
} from "@/lib/karen/audio-bank";
import {
  AudioBufferCache,
  FALLBACK_BRUTAL_WAVS,
  fetchAudioArrayBuffer,
  listFallbackBrutalUrls,
  listPreloadSmackbackUrls,
  normalizeKarenAudioUrl,
  SMACKBACK_PRELOAD_COUNT,
} from "@/lib/karen/audio-cache";
import {
  AvatarState,
  getAvatarState,
  setAvatarState,
} from "@/lib/karen/avatar-state";
import {
  applyExpressionToTalkingHead,
  applyExtremeAngerMorphs,
  applyFuriousStrikeMorphs,
  normalizeMood,
  parseMoodTag,
  stripMoodTags,
  type TalkingHeadLike,
} from "@/lib/karen/expression-bridge";
import { isKaren2DFallback } from "@/lib/karen/fallback-2d";
import { karenDevLog, karenDevWarn } from "@/lib/karen/dev-log";
import { pickPremiumRoastUrl } from "@/lib/karen/premium-voice-library";
import { isColdShoulder } from "@/lib/karen/state";
import { buildWordTimings } from "@/lib/karen/tts-word-timings";
import {
  dispatchKarenRageShake,
  dispatchKarenSpeaking,
} from "@/lib/karen/talkinghead-bus";

/** Safari RAM guard — room for top-10 fallbacks + combat warm. */
export const AUDIO_CACHE_MAX = 22;

/** Canonical lips-test WAV — decode → TalkingHead.speakAudio. */
export const TEST_LIPS_WAV = "/audio/smackbacks/sb_01.wav";
export const TEST_LIPS_LINE = "Is that all you've got?";

export type GenerateAudioBufferOptions = {
  mood?: string | null;
  signal?: AbortSignal;
  /** Prefer TalkingHead's AudioContext when available. */
  audioContext?: AudioContext | null;
};

/**
 * Global zero-latency combat cache — decoded WAVs ready before the mic is released.
 * Keyed by normalized public URL (`/audio/smackbacks/...`).
 * Filled on ENTER THE ROAST (top 20); playWavWithLipsync reads here first.
 */
export { AudioBufferCache };
/** Alias for existing call sites / AudioPreloader. */
export const audioCache = AudioBufferCache;

export type PreloadAudioProgress = {
  loaded: number;
  total: number;
  url: string;
};

/**
 * Fetch + decode URLs into {@link AudioBufferCache} in parallel.
 * Only the first {@link AUDIO_CACHE_MAX} entries are stored.
 * Pass the StartGate-unlocked AudioContext so decode shares the fight clock.
 */
export async function preloadAudio(
  urls: string[],
  opts: {
    audioContext?: AudioContext | null;
    onProgress?: (p: PreloadAudioProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<{ loaded: number; failed: number }> {
  const ctx = opts.audioContext ?? getKarenAudioContext();
  if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
    await ctx.resume().catch(() => undefined);
  }

  let loaded = 0;
  let failed = 0;
  const seen = new Set<string>();
  const capped: string[] = [];
  for (const raw of urls) {
    const url = normalizeKarenAudioUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    capped.push(url);
    if (capped.length >= AUDIO_CACHE_MAX) break;
  }
  const total = capped.length;
  const slots = Math.max(0, AUDIO_CACHE_MAX - AudioBufferCache.size);
  const targets = capped
    .filter((url) => !AudioBufferCache.has(url))
    .slice(0, slots);

  // Already-cached count toward progress.
  for (const url of capped) {
    if (AudioBufferCache.has(url)) {
      loaded += 1;
      opts.onProgress?.({ loaded, total, url });
    }
  }

  const decoded = await Promise.all(
    targets.map(async (url) => {
      if (opts.signal?.aborted) return null;
      try {
        const ab = await fetchAudioArrayBuffer(url);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        return { url, buffer };
      } catch (err) {
        failed += 1;
        console.warn("[preloadAudio] miss", url, err);
        loaded += 1;
        opts.onProgress?.({ loaded, total, url });
        return null;
      }
    }),
  );

  for (const entry of decoded) {
    if (!entry) continue;
    if (AudioBufferCache.size < AUDIO_CACHE_MAX) {
      AudioBufferCache.set(entry.url, entry.buffer);
    }
    loaded += 1;
    opts.onProgress?.({ loaded, total, url: entry.url });
  }

  return { loaded, failed };
}

/** Top smackback WAVs for ENTER THE ROAST / StartGate warm (priority combat first). */
export function getCombatPreloadUrls(count = SMACKBACK_PRELOAD_COUNT): string[] {
  return listPreloadSmackbackUrls(count);
}

/** Top 10 fallback/brutal/interrupt WAVs — typo "asdf" must never hit the network. */
export function getFallbackPreloadUrls(
  count = FALLBACK_BRUTAL_WAVS.length,
): string[] {
  return listFallbackBrutalUrls(count);
}

/**
 * Decode the top fallback/brutal set into {@link AudioBufferCache}.
 * Call on ENTER THE ROAST (same gesture as unlock).
 */
export async function preloadFallbackBrutalAudio(
  opts: {
    audioContext?: AudioContext | null;
    signal?: AbortSignal;
  } = {},
): Promise<{ loaded: number; failed: number }> {
  return preloadAudio(getFallbackPreloadUrls(), opts);
}

/**
 * Prefer a preferred URL if already decoded; otherwise any cached fallback.
 * Returns null only if the cache is empty (caller may network-fallback).
 */
export function pickCachedFallbackUrl(preferred?: string | null): string | null {
  const pref = preferred ? normalizeKarenAudioUrl(preferred) : "";
  if (pref && AudioBufferCache.has(pref)) return pref;
  for (const url of FALLBACK_BRUTAL_WAVS) {
    const n = normalizeKarenAudioUrl(url);
    if (AudioBufferCache.has(n)) return n;
  }
  for (const url of AudioBufferCache.keys()) {
    if (url.includes("/smackbacks/")) return url;
  }
  return pref || null;
}

/** HTTP-only warm (no decode) — safe before the iOS AudioContext unlock gesture. */
export async function warmAudioFetches(
  urls: string[] = getCombatPreloadUrls(),
  signal?: AbortSignal,
): Promise<void> {
  await Promise.all(
    urls.map(async (raw) => {
      if (signal?.aborted) return;
      try {
        await fetchAudioArrayBuffer(raw);
      } catch {
        /* miss ok — decode path will retry */
      }
    }),
  );
}

export function getCachedWavBuffer(url: string): AudioBuffer | null {
  return AudioBufferCache.get(normalizeKarenAudioUrl(url)) ?? null;
}

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
/** Combat smackbacks — HTMLAudioElement kept at volume 1.0 (mobile unlock required). */
let smackHtmlAudio: HTMLAudioElement | null = null;
let masterGain: GainNode | null = null;
/** Active BufferSource so Hold-to-Scream can cut SPEAKING mid-line. */
let activeBufferSource: AudioBufferSourceNode | null = null;

function stopActiveBufferSource(): void {
  const src = activeBufferSource;
  activeBufferSource = null;
  if (!src) return;
  try {
    src.onended = null;
    src.stop(0);
  } catch {
    /* already stopped */
  }
  try {
    src.disconnect();
  } catch {
    /* ignore */
  }
}

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

/** Copy PCM onto the destination AudioContext — Safari refuses foreign-context buffers. */
export function copyAudioBufferToContext(
  ctx: AudioContext,
  buffer: AudioBuffer,
): AudioBuffer {
  if (!buffer.numberOfChannels || !buffer.length) return buffer;
  try {
    const copy = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate,
    );
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      copy.copyToChannel(buffer.getChannelData(c), c);
    }
    return copy;
  } catch (err) {
    console.warn("[copyAudioBufferToContext] failed, using original buffer", err);
    return buffer;
  }
}

/**
 * iOS Safari unlock tick — 1-sample silent buffer at 22050 Hz, started at 0.
 * resume() alone is not enough on iOS; the document stays muted until a
 * BufferSource actually starts inside the user-gesture stack.
 */
function playSilentTick(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    try {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* ignore unlock races */
    }
  }
}

/**
 * Gesture unlock for Karen's fight clock.
 *
 * Browsers block sound until a user gesture creates/resumes AudioContext.
 * ENTER THE ROAST must call this on pointerdown (iOS) and click.
 *
 * Exact unlock recipe (shared clock — never a throwaway ctx):
 *
 *   const AudioContext = window.AudioContext || window.webkitAudioContext;
 *   const ctx = new AudioContext();
 *   if (ctx.state === 'suspended') {
 *     await ctx.resume();
 *   }
 *   // Play a silent buffer to fully unlock iOS Safari
 *   const buffer = ctx.createBuffer(1, 1, 22050);
 *   const source = ctx.createBufferSource();
 *   source.buffer = buffer;
 *   source.connect(ctx.destination);
 *   source.start(0);
 */
export async function unlockAudio(
  head?: TalkingHeadLike | null,
): Promise<AudioContext> {
  if (typeof window === "undefined") {
    throw new Error("unlockAudio requires a browser");
  }

  // const AudioContext = window.AudioContext || window.webkitAudioContext;
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("Web Audio API is not available");
  }

  // const ctx = new AudioContext(); — reuse one shared fight clock
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioContextCtor();
  }
  const ctx = sharedAudioCtx;
  const headCtx = headAudioContext(head ?? registeredHead);

  // CRITICAL (iOS): silent buffer SYNCHRONOUSLY inside the gesture — before await.
  playSilentTick(ctx);
  if (headCtx && headCtx !== ctx) playSilentTick(headCtx);

  // if (ctx.state === 'suspended') { await ctx.resume(); }
  if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
    await ctx.resume();
  }
  if (
    headCtx &&
    headCtx !== ctx &&
    (headCtx.state === "suspended" || (headCtx.state as string) === "interrupted")
  ) {
    await headCtx.resume().catch(() => undefined);
  }

  // Spec follow-up: silent 1-sample @ 22050 Hz again after resume.
  playSilentTick(ctx);
  if (headCtx && headCtx !== ctx) playSilentTick(headCtx);

  audioUnlocked = ctx.state === "running" || headCtx?.state === "running";
  console.info(
    "[unlockAudio] shared=",
    ctx.state,
    "head=",
    headCtx?.state ?? "none",
    "unlocked=",
    audioUnlocked,
  );

  return headCtx && headCtx.state !== "closed" ? headCtx : ctx;
}

/**
 * CRITICAL: browsers suspend AudioContext until a user gesture.
 * Call from Enter the Roast / Hold-to-Scream / Send before any speakAudio.
 * Always creates the shared global context AND resumes TalkingHead's ctx.
 */
export async function unlockKarenAudio(
  head?: TalkingHeadLike | null,
): Promise<AudioContext> {
  const activeHead = head ?? registeredHead;
  const shared = await unlockAudio(activeHead);
  const headCtx = headAudioContext(activeHead);

  // Prime HTMLAudioElement inside the same gesture (mobile smackback path).
  try {
    const el = primeSmackHtmlVolume();
    el.muted = true;
    el.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    const p = el.play();
    if (p) {
      await p.catch(() => undefined);
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      el.removeAttribute("src");
      el.load();
    }
  } catch {
    /* ignore HTMLAudio unlock races */
  }

  // Warm speechSynthesis voices (last-resort TTS fallback).
  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  } catch {
    /* ignore */
  }

  audioUnlocked = shared.state === "running" || headCtx?.state === "running";
  console.info(
    "[unlockKarenAudio] shared=",
    shared.state,
    "head=",
    headCtx?.state ?? "none",
    "unlocked=",
    audioUnlocked,
  );

  return headCtx && headCtx.state !== "closed" ? headCtx : shared;
}

/**
 * Resume every live AudioContext (shared + TalkingHead).
 * iOS Safari only starts audio after a real user gesture — call from tap handlers.
 */
export async function resumeAllKarenAudioContexts(): Promise<AudioContext> {
  return unlockAudio();
}

/**
 * Gesture-stack unlock: AudioContext.resume() + getUserMedia permission.
 * ENTER THE ROAST / TAP TO ENTER must call this inside pointerdown/click.
 * Mic tracks are stopped immediately — Hold-to-Scream re-opens the stream on hold.
 *
 * getUserMedia is kicked off BEFORE awaiting resume() so iOS still treats
 * it as the same user gesture.
 */
export async function unlockKarenAudioAndMic(
  head?: TalkingHeadLike | null,
): Promise<AudioContext> {
  let gumPromise: Promise<MediaStream> | null = null;
  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
    gumPromise = navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
      video: false,
    });
  }

  const ctx = await unlockAudio(head);

  if (gumPromise) {
    try {
      const stream = await gumPromise;
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn("[unlockKarenAudioAndMic] mic permission not granted yet", err);
    }
  }

  return ctx;
}

/**
 * Strict lips path used by TEST AUDIO & LIPS and combat:
 * fetch WAV → decodeAudioData on TalkingHead's clock → speakAudio({ audio, words… }).
 */
export async function playDecodedWavToTalkingHead(
  url: string = TEST_LIPS_WAV,
  talkingHead?: TalkingHeadLike | null,
  opts: {
    text?: string;
    onStart?: () => void;
    onEnd?: () => void;
    volume?: number;
    gen?: number;
    /** Never fetch — typo/fallback must stay cache-hot. */
    cacheOnly?: boolean;
  } = {},
): Promise<void> {
  const head = talkingHead ?? registeredHead;
  const resolved = normalizeKarenAudioUrl(url);

  if (isKaren2DFallback()) {
    opts.onStart?.();
    try {
      await playSmackbackAtFullVolume(resolved);
    } finally {
      opts.onEnd?.();
    }
    return;
  }

  const ctx = await unlockKarenAudio(head);
  if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
    await ctx.resume().catch(() => undefined);
  }

  // Cache-first: ENTER THE ROAST preload → instant speakAudio (no network).
  // Typo/fallback path: if preferred miss, swap to any cached brutal WAV.
  const cacheOnly = Boolean(opts.cacheOnly);
  let playUrl = resolved;
  let audioBuffer = AudioBufferCache.get(resolved) ?? null;
  if (!audioBuffer) {
    const alt = pickCachedFallbackUrl(resolved);
    if (alt && alt !== resolved && AudioBufferCache.has(alt)) {
      playUrl = alt;
      audioBuffer = AudioBufferCache.get(alt) ?? null;
    }
  }
  if (audioBuffer) {
    audioBuffer = copyAudioBufferToContext(ctx, audioBuffer);
  } else if (cacheOnly) {
    throw new Error(`cache miss (cacheOnly) ${playUrl}`);
  } else {
    // Rare miss — fetch + decode; do not grow the Safari-capped cache.
    const arrayBuffer = await fetchAudioArrayBuffer(playUrl);
    if (!arrayBuffer.byteLength) {
      throw new Error(`empty WAV ${playUrl}`);
    }
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  if (!head || typeof head.speakAudio !== "function") {
    await playKarenAudioBuffer(audioBuffer, null, opts);
    return;
  }

  releaseKarenJawForLipsync(head);
  await playKarenAudioBuffer(audioBuffer, head, {
    text: opts.text ?? TEST_LIPS_LINE,
    onStart: opts.onStart,
    onEnd: opts.onEnd,
    volume: opts.volume ?? 1,
    gen: opts.gen,
  });
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
 * Near-silent speech-shaped oscillator buffer so TalkingHead.speakAudio can
 * drive jaw/visemes while `speechSynthesis` provides the audible roast voice.
 * Tuned for impatient rate ≈ 1.2.
 */
export function synthesizeLipSyncProxyBuffer(
  text: string,
  audioContext?: AudioContext | null,
): AudioBuffer {
  const ctx = getKarenAudioContext(audioContext);
  const wordCount = Math.max(1, text.trim().split(/\s+/).length);
  const durationSec = Math.min(14, Math.max(0.55, wordCount * 0.28));
  return createDummySilentBuffer(ctx, durationSec);
}

/**
 * Fake Buffer Trick: near-silent AudioBuffer (~ -40 dB pulsed tone).
 * Inaudible under browser TTS, but enough energy for TalkingHead jaw flap.
 */
export function createDummySilentBuffer(
  audioContext?: AudioContext | null,
  durationSec = 0.55,
): AudioBuffer {
  const ctx = getKarenAudioContext(audioContext);
  const sampleRate = ctx.sampleRate;
  const frames = Math.max(1, Math.floor(Math.max(0.12, durationSec) * sampleRate));
  const buffer = ctx.createBuffer(1, frames, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const syllable = 0.5 + 0.5 * Math.sin(t * Math.PI * 5.5);
    const amp = 0.01 * syllable;
    data[i] = amp * Math.sin(2 * Math.PI * 190 * t);
  }

  return buffer;
}

/** Alias — dummy silent-oscillator buffer for browser-TTS lip-sync hack. */
export function createDummyLipSyncBuffer(
  text: string,
  audioContext?: AudioContext | null,
): AudioBuffer {
  return synthesizeLipSyncProxyBuffer(text, audioContext);
}

function waitForVoices(timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onChange);
      window.clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
    const onChange = () => done();
    const timer = window.setTimeout(done, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", onChange);
  });
}

/** Prefer shrill / impatient female English voices for Angry Karen. */
export function pickAngryFemaleVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  // Explicit female hits first (Windows often defaults to male David/Mark).
  const preferred = voices.find(
    (v) =>
      /female/i.test(v.name) ||
      /samantha/i.test(v.name) ||
      /google uk english female/i.test(v.name) ||
      /google us english female/i.test(v.name) ||
      /microsoft zira/i.test(v.name) ||
      /microsoft jenny/i.test(v.name) ||
      /microsoft aria/i.test(v.name) ||
      /karen/i.test(v.name) ||
      /victoria/i.test(v.name) ||
      /moira/i.test(v.name) ||
      /fiona/i.test(v.name),
  );
  if (preferred) return preferred;

  const en = voices.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : voices;
  const ranked = [
    /female/i,
    /samantha/i,
    /zira/i,
    /jenny/i,
    /google.*female/i,
  ];
  for (const re of ranked) {
    const hit = pool.find((v) => re.test(v.name));
    if (hit) return hit;
  }

  // Last resort: any English voice that is NOT an obvious male preset.
  const notMale = pool.find(
    (v) => !/david|mark|george|daniel|thomas|alex|fred|male/i.test(v.name),
  );
  return notMale || pool[0] || null;
}

export type SpeakLocalRoastOptions = {
  mood?: string | null;
  /** Dominant trait from the roast engine — laziness triggers max anger. */
  trait?: string | null;
  head?: TalkingHeadLike | null;
  /** speechSynthesis rate — morning roast uses 1.3 (urgent). Default 1.2. */
  rate?: number;
  /** Exact audio-bank entry id. */
  audioId?: string | null;
  questionId?: string | null;
  answerId?: string | null;
  /** Custom name / goal → forces fast speechSynthesis path. */
  dynamic?: DynamicInserts | null;
  /** Speak even during cold shoulder (forgiveness / rare unlock). */
  ignoreColdShoulder?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
};

export type PlayKarenAudioOptions = {
  /** Transcript for viseme word timings. */
  text?: string | null;
  onStart?: () => void;
  onEnd?: () => void;
  /** Reuse speakGeneration from an orchestrator (speakLocalRoast). */
  gen?: number;
  /** 0–1 playback gain (smackbacks force 1.0). */
  volume?: number;
  /** Never network-fetch — use AudioBufferCache only (typo / interrupt). */
  cacheOnly?: boolean;
};

export type PlayPreGeneratedAudioOptions = PlayKarenAudioOptions & {
  mood?: string | null;
  head?: TalkingHeadLike | null;
  ignoreColdShoulder?: boolean;
};

/**
 * Strict Web Audio lip-sync decoder.
 * Fetch WAV/MP3 → decodeAudioData on TalkingHead's AudioContext → speakAudio({ audio, words… }).
 *
 * Never use `<audio>` tags here — HTMLAudioElement and TalkingHead clocks diverge,
 * so the jaw stays shut while sound plays elsewhere.
 *
 * IMPORTANT: TalkingHead.speakAudio does NOT accept a bare AudioBuffer.
 * It requires `{ audio, words, wtimes, wdurations }` or the speech queue is empty.
 */
export async function playKarenAudio(
  url: string,
  talkingHead?: TalkingHeadLike | null,
  opts: PlayKarenAudioOptions = {},
): Promise<void> {
  const head = (talkingHead ?? registeredHead) as TalkingHeadLike | null;
  const resolved = normalizeKarenAudioUrl(url);

  // 2D WebGL fallback — standard Audio() keeps Hold-to-Scream alive without WebGL RAM.
  if (isKaren2DFallback()) {
    opts.onStart?.();
    try {
      await playSmackbackAtFullVolume(resolved);
    } finally {
      opts.onEnd?.();
    }
    return;
  }

  // 1) Resume AudioContext — MUST be TalkingHead's ctx so BufferSource + visemes share a clock
  await unlockKarenAudio(head);
  const audioCtx = headAudioContext(head) ?? getKarenAudioContext();
  const stateBefore = audioCtx.state as string;
  if (audioCtx.state === "suspended" || stateBefore === "interrupted") {
    await audioCtx.resume().catch(() => undefined);
  }
  karenDevLog("AudioContext Resumed", {
    before: stateBefore,
    now: audioCtx.state,
    sampleRate: audioCtx.sampleRate,
    sharedWithHead: Boolean(headAudioContext(head)),
  });
  if (audioCtx.state !== "running") {
    karenDevWarn(
      `AudioContext is "${audioCtx.state}" after resume — sound and lips will stay silent. Needs a user gesture.`,
    );
  }

  // 2) Zero-latency path — AudioBufferCache (ENTER THE ROAST top-20 preload)
  let audioBuffer = AudioBufferCache.get(resolved) ?? null;
  if (audioBuffer) {
    karenDevLog("WAV Cache Hit", {
      url: resolved,
      seconds: Number(audioBuffer.duration.toFixed(2)),
      cacheSize: AudioBufferCache.size,
    });
  } else {
    // Rare file — fetch + decode, but DO NOT store — Safari OOM guard.
    const arrayBuffer = await fetchAudioArrayBuffer(resolved);
    if (!arrayBuffer.byteLength) {
      throw new Error(`playKarenAudio: empty file ${resolved}`);
    }
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    karenDevLog("WAV Decoded (uncached)", {
      url: resolved,
      seconds: Number(audioBuffer.duration.toFixed(2)),
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      bytes: arrayBuffer.byteLength,
    });
  }

  // 3) Pass to TalkingHead for lip-sync (never bare AudioBuffer / never re-fetch)
  if (head && typeof head.speakAudio === "function") {
    releaseKarenJawForLipsync(head);
    await playKarenAudioBuffer(audioBuffer, head, {
      text: opts.text,
      onStart: opts.onStart,
      onEnd: opts.onEnd,
      gen: opts.gen,
      volume: opts.volume ?? 1,
    });
    return;
  }

  console.error("TalkingHead not ready for audio");
  await playKarenAudioBuffer(audioBuffer, null, opts);
}

export type PlayWavAudioOptions = PlayKarenAudioOptions & {
  head?: TalkingHeadLike | null;
};

/**
 * Free the mouth before speakAudio — combat fury was locking jawOpen via
 * setFixedValue, which overrides all viseme animation in TalkingHead.
 */
function releaseKarenJawForLipsync(head: TalkingHeadLike | null | undefined): void {
  if (!head) return;
  try {
    head.setFixedValue?.("jawOpen", null);
  } catch {
    /* ignore */
  }
  try {
    head.setFixedValue?.("mouthClose", null);
  } catch {
    /* ignore */
  }
}

/**
 * Kokoro WAV → Web Audio → TalkingHead lip-sync.
 * Prefers {@link AudioBufferCache} (ENTER THE ROAST top-20) — instant on hit;
 * network fetch only for rare files not in the cache.
 *
 * Note: TalkingHead.speakAudio does NOT accept a bare AudioBuffer — it needs
 * `{ audio: AudioBuffer, words, wtimes, wdurations }` or the queue is empty.
 */
export async function playWavWithLipsync(
  url: string,
  talkingHead?: TalkingHeadLike | null,
  opts: PlayWavAudioOptions = {},
): Promise<void> {
  await playDecodedWavToTalkingHead(url, talkingHead ?? opts.head ?? registeredHead, {
    text: opts.text ?? undefined,
    onStart: opts.onStart,
    onEnd: opts.onEnd,
    volume: opts.volume ?? 1,
    gen: opts.gen,
    cacheOnly: opts.cacheOnly,
  });
}

/**
 * Kokoro combat path — alias of playWavWithLipsync (kept for call sites).
 */
export async function playWavAudio(
  filePath: string,
  opts: PlayWavAudioOptions = {},
): Promise<void> {
  await playWavWithLipsync(filePath, opts.head ?? registeredHead, opts);
}

/**
 * Start decoded PCM and lips on the same AudioContext millisecond.
 * TalkingHead.speakAudio queues `createBufferSource()` + visemes on one clock;
 * without an avatar we start a BufferSource ourselves.
 */
export async function playKarenAudioBuffer(
  audioBuffer: AudioBuffer,
  talkingHead?: TalkingHeadLike | null,
  opts: PlayKarenAudioOptions = {},
): Promise<void> {
  const head = talkingHead ?? registeredHead;
  const gen = opts.gen ?? ++speakGeneration;
  const text = stripMoodTags(opts.text || "").replace(/\s+/g, " ").trim() || "…";

  if (gen !== speakGeneration) {
    opts.onEnd?.();
    return;
  }

  const ctx = getKarenAudioContext(headAudioContext(head));
  if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
    await ctx.resume().catch(() => undefined);
  }

  if (head && typeof head.speakAudio === "function") {
    // TalkingHead.playAudio: source.buffer = audioBuffer; source.start(currentTime + delay)
    // Viseme timestamps are scheduled on the same animClock — perfect sync.
    const localBuffer = copyAudioBufferToContext(ctx, audioBuffer);
    const durationMs = feedSpeakAudio(head, localBuffer, text);
    if (gen !== speakGeneration) {
      opts.onEnd?.();
      return;
    }
    setAvatarState(AvatarState.SPEAKING);
    dispatchKarenSpeaking(true);
    opts.onStart?.();
    await waitForAudioDuration(durationMs, gen);
    if (gen === speakGeneration) {
      dispatchKarenSpeaking(false);
      setAvatarState(AvatarState.IDLE);
    }
    opts.onEnd?.();
    return;
  }

  // No avatar — pure Web Audio API playback at full combat volume.
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeBufferSource) {
        try {
          activeBufferSource.disconnect();
        } catch {
          /* ignore */
        }
        activeBufferSource = null;
      }
      if (gen === speakGeneration) {
        dispatchKarenSpeaking(false);
        setAvatarState(AvatarState.IDLE);
      }
      opts.onEnd?.();
      resolve();
    };

    try {
      stopActiveBufferSource();
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const gain = ensureMasterGain(ctx);
      gain.gain.value = Math.min(1, Math.max(0, opts.volume ?? 1));
      source.connect(gain);
      activeBufferSource = source;
      source.onended = finish;
      setAvatarState(AvatarState.SPEAKING);
      dispatchKarenSpeaking(true);
      opts.onStart?.();
      // Never start(0) — if the context has been running, t=0 is in the past and Safari skips the buffer.
      source.start();
      // Safety if onended never fires.
      window.setTimeout(finish, Math.max(200, audioBuffer.duration * 1000) + 500);
    } catch (err) {
      console.warn("[playKarenAudio] BufferSource failed", err);
      finish();
    }
  });
}

function ensureMasterGain(ctx: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

/** Ensure combat HTMLAudioElement exists at volume 1.0 (gesture-unlocked). */
export function primeSmackHtmlVolume(src?: string): HTMLAudioElement {
  if (typeof window === "undefined") {
    throw new Error("primeSmackHtmlVolume requires window");
  }
  if (!smackHtmlAudio) {
    smackHtmlAudio = new Audio();
    smackHtmlAudio.preload = "auto";
  }
  smackHtmlAudio.volume = 1.0;
  if (src) {
    smackHtmlAudio.src = normalizeKarenAudioUrl(src);
  }
  return smackHtmlAudio;
}

/**
 * Full-volume smackback via HTMLAudioElement (volume = 1.0).
 * Used as audible fallback when Web Audio decode fails.
 */
export async function playSmackbackAtFullVolume(src: string): Promise<void> {
  await unlockKarenAudio();
  const el = primeSmackHtmlVolume(src);
  el.pause();
  el.currentTime = 0;
  el.volume = 1.0;
  setAvatarState(AvatarState.SPEAKING);
  dispatchKarenSpeaking(true);
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      el.removeEventListener("ended", done);
      el.removeEventListener("error", onErr);
      dispatchKarenSpeaking(false);
      setAvatarState(AvatarState.IDLE);
      resolve();
    };
    const onErr = () => {
      el.removeEventListener("ended", done);
      el.removeEventListener("error", onErr);
      dispatchKarenSpeaking(false);
      setAvatarState(AvatarState.IDLE);
      reject(new Error("HTMLAudioElement playback failed"));
    };
    el.addEventListener("ended", done);
    el.addEventListener("error", onErr);
    void el.play().catch(onErr);
  });
}

function waitForAudioDuration(durationMs: number, gen: number): Promise<void> {
  return new Promise((resolve) => {
    if (gen !== speakGeneration) {
      resolve();
      return;
    }
    window.setTimeout(() => resolve(), Math.max(200, durationMs) + 100);
  });
}

/**
 * @deprecated Prefer playKarenAudio — kept as a thin alias for older callers.
 */
export async function playPreGeneratedAudio(
  fileName: string,
  opts: PlayPreGeneratedAudioOptions = {},
): Promise<{ usedMp3: boolean }> {
  const head = opts.head ?? registeredHead;

  if (!opts.ignoreColdShoulder && isColdShoulder()) {
    opts.onEnd?.();
    return { usedMp3: false };
  }

  try {
    const gen = opts.gen ?? ++speakGeneration;
    await playKarenAudio(fileName, head, {
      text: opts.text,
      onStart: opts.onStart,
      onEnd: opts.onEnd,
      gen,
    });
    return { usedMp3: true };
  } catch (err) {
    console.warn("[playPreGeneratedAudio] failed — TTS file fallback", fileName, err);
    const text = stripMoodTags(opts.text || "").replace(/\s+/g, " ").trim();
    if (!text) {
      opts.onEnd?.();
      return { usedMp3: false };
    }
    try {
      await speakViaTtsFile(text, opts.mood || "ANGRY", head, opts.gen ?? speakGeneration, opts);
      return { usedMp3: false };
    } catch (ttsErr) {
      console.warn("[playPreGeneratedAudio] TTS file fallback failed", ttsErr);
      opts.onEnd?.();
      return { usedMp3: false };
    }
  }
}

/**
 * Hybrid voice (Web Audio only):
 * 1) Bank / mood MP3 → playKarenAudio
 * 2) Missing file → /api/tts AudioBuffer → playKarenAudioBuffer
 * Never speechSynthesis (desyncs 3D lips).
 */
export async function speakLocalRoast(
  text: string,
  moodOrOpts: string | SpeakLocalRoastOptions = "ANGRY",
): Promise<void> {
  const opts: SpeakLocalRoastOptions =
    typeof moodOrOpts === "string" ? { mood: moodOrOpts } : moodOrOpts;

  const raw = stripMoodTags(text).replace(/\s+/g, " ").trim();
  if (!raw) {
    opts.onEnd?.();
    return;
  }

  if (!opts.ignoreColdShoulder && isColdShoulder()) {
    opts.onEnd?.();
    return;
  }

  const resolved = resolveKarenSpeech({
    text: raw,
    audioId: opts.audioId,
    questionId: opts.questionId,
    answerId: opts.answerId,
    dynamic: opts.dynamic,
  });
  const clean = resolved.text;
  if (!clean) {
    opts.onEnd?.();
    return;
  }

  console.log("SPEAKING:", clean);

  const mood = normalizeMood(opts.mood || parseMoodTag(text) || "ANGRY");
  const head = opts.head ?? registeredHead;
  const gen = ++speakGeneration;

  await unlockKarenAudio(head);

  const isSmack =
    Boolean(opts.audioId?.startsWith("smackback:")) ||
    (opts.trait || "").toLowerCase() === "chaos";
  const furious =
    mood === "ANGRY" ||
    mood === "FURIOUS" ||
    (opts.trait || "").toLowerCase() === "laziness" ||
    isSmack;
  if (furious) {
    // Brows/eyes only — never lock jawOpen (fixed jaw kills speakAudio visemes).
    if (isSmack || mood === "FURIOUS") {
      applyFuriousStrikeMorphs(head, { jawOpen: 0 });
    } else {
      applyExtremeAngerMorphs(head);
    }
    releaseKarenJawForLipsync(head);
    dispatchKarenRageShake();
  } else {
    applyExpressionToTalkingHead(head, mood, { isSpeaking: false });
    releaseKarenJawForLipsync(head);
  }

  const finish = () => {
    if (gen === speakGeneration) {
      applyExpressionToTalkingHead(head, mood, { isSpeaking: false });
    }
    opts.onEnd?.();
  };

  const tryUrl = async (url: string): Promise<boolean> => {
    try {
      if (isSmack) {
        // Prime HTMLAudioElement at full volume (mobile browsers respect this after unlock).
        primeSmackHtmlVolume(url);
      }
      await playKarenAudio(url, head, {
        text: clean,
        gen,
        volume: 1,
        onStart: opts.onStart,
        onEnd: finish,
      });
      return true;
    } catch (err) {
      console.warn("[speakLocalRoast] MP3 pipeline failed", url, err);
      if (isSmack) {
        try {
          await playSmackbackAtFullVolume(url);
          finish();
          return true;
        } catch (htmlErr) {
          console.warn("[speakLocalRoast] HTMLAudio smackback failed", htmlErr);
        }
      }
      return false;
    }
  };

  // Dynamic lines / unresolved bank → TTS file (still Web Audio lipsync).
  if (resolved.useTts || !resolved.src) {
    if (resolved.src && (await tryUrl(resolved.src))) return;
    if (!resolved.useTts) {
      const moodUrl = pickPremiumRoastUrl(mood);
      if (await tryUrl(moodUrl)) return;
    }
    if (gen !== speakGeneration) return;
    try {
      await speakViaTtsFile(clean, mood, head, gen, {
        onStart: opts.onStart,
        onEnd: finish,
      });
    } catch (err) {
      console.warn("[speakLocalRoast] TTS file failed — falling back to speechSynthesis", err);
      if (gen !== speakGeneration) return;
      speakBrowserFallback(clean, opts.onStart, finish, mood);
      startFakeSpeakWindow(head, Math.max(1200, clean.length * 55));
    }
    return;
  }

  if (await tryUrl(resolved.src)) return;

  const moodUrl = pickPremiumRoastUrl(mood);
  if (await tryUrl(moodUrl)) return;

  if (gen !== speakGeneration) return;
  try {
    await speakViaTtsFile(clean, mood, head, gen, {
      onStart: opts.onStart,
      onEnd: finish,
    });
  } catch (err) {
    console.warn("[speakLocalRoast] TTS file failed — falling back to speechSynthesis", err);
    if (gen !== speakGeneration) return;
    speakBrowserFallback(clean, opts.onStart, finish, mood);
    startFakeSpeakWindow(head, Math.max(1200, clean.length * 55));
  }
}

/** Mark Tripo/TalkingHead as "speaking" so fake lip-sync runs for browser TTS. */
function startFakeSpeakWindow(head: TalkingHeadLike | null, ms: number): void {
  if (!head || typeof window === "undefined") return;
  try {
    const host = head as TalkingHeadLike & { __speakUntil?: number };
    host.__speakUntil = performance.now() + ms;
    dispatchKarenSpeaking(true);
    window.setTimeout(() => dispatchKarenSpeaking(false), ms + 40);
  } catch {
    /* ignore */
  }
}

/** ElevenLabs /api/tts → AudioBuffer → playKarenAudioBuffer (speechSynthesis on throw). */
async function speakViaTtsFile(
  clean: string,
  mood: string,
  head: TalkingHeadLike | null,
  gen: number,
  opts: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  const ctx = getKarenAudioContext(headAudioContext(head));
  const { audioBuffer, isProxy } = await generateAudioBufferDetailed(clean, {
    mood,
    audioContext: ctx,
  });
  if (gen !== speakGeneration) {
    opts.onEnd?.();
    return;
  }
  if (isProxy) {
    // Proxy buffers are silence — audible path is browser TTS + fake head motion.
    console.warn("[speakViaTtsFile] TTS API unavailable — using speechSynthesis");
    speakBrowserFallback(clean, opts.onStart, opts.onEnd, mood);
    startFakeSpeakWindow(head, Math.max(1200, clean.length * 55));
    return;
  }
  await playKarenAudioBuffer(audioBuffer, head, {
    text: clean,
    gen,
    onStart: opts.onStart,
    onEnd: opts.onEnd,
  });
}

/**
 * Last-resort audible path — always force a female English voice.
 * Windows / Chrome otherwise default to a male system voice.
 */
function speakBrowserFallback(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  mood?: string | null,
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }

  const angry =
    (mood || "").toUpperCase() === "ANGRY" ||
    (mood || "").toUpperCase() === "FURIOUS";

  console.log("SPEAKING (speechSynthesis female):", text);
  window.speechSynthesis.cancel();

  void waitForVoices().then((voices) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";

    const femaleVoice = pickAngryFemaleVoice(voices);
    if (femaleVoice) {
      utter.voice = femaleVoice;
      utter.lang = femaleVoice.lang || "en-US";
      console.info("[voice] browser TTS female voice:", femaleVoice.name);
    } else {
      console.warn("[voice] no female speechSynthesis voice found — elevating pitch");
    }

    // Slightly higher + faster for an aggressive Karen read.
    utter.pitch = angry ? 1.2 : 1.1;
    utter.rate = angry ? 1.18 : 1.1;
    utter.volume = 1;

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
  });
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
 * Hand a decoded AudioBuffer to TalkingHead's mouth.
 * Internally: createBufferSource → analyzer → start(currentTime) + viseme queue.
 *
 * Bare `speakAudio(audioBuffer)` is a NO-OP — TalkingHead only reads `r.audio` + `r.words`.
 */
function feedSpeakAudio(
  head: TalkingHeadLike,
  audioBuffer: AudioBuffer,
  text: string,
): number {
  const durationMs = Math.max(200, audioBuffer.duration * 1000);
  const line = text.replace(/\s+/g, " ").trim() || "yeah okay whatever";
  const timings = buildWordTimings(line, durationMs);

  const host = head as TalkingHeadLike & {
    stopSpeaking?: () => void;
    start?: () => void;
    resetLips?: () => void;
    isSpeaking?: boolean;
    armature?: unknown;
  };

  // Clear any stuck queue / fixed jaw so the new buffer can own the mouth.
  try {
    host.stopSpeaking?.();
  } catch {
    /* ignore */
  }
  try {
    host.start?.();
  } catch {
    /* ignore */
  }
  releaseKarenJawForLipsync(head);
  try {
    host.resetLips?.();
  } catch {
    /* ignore */
  }
  try {
    head.setBaselineValue?.("jawOpen", 0);
    head.setBaselineValue?.("mouthClose", 0);
  } catch {
    /* ignore */
  }

  if (!host.armature) {
    console.warn(
      "[feedSpeakAudio] TalkingHead.armature is missing — playAudio will no-op until avatar finishes loading",
    );
  }

  const payload = {
    audio: audioBuffer,
    words: timings.words,
    wtimes: timings.wtimes,
    wdurations: timings.wdurations,
  };

  console.info(
    "[feedSpeakAudio] feeding AudioBuffer into speakAudio",
    {
      words: timings.words.length,
      durMs: Math.round(durationMs),
      bufSec: Number(audioBuffer.duration.toFixed(2)),
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      hasArmature: Boolean(host.armature),
    },
  );

  if (typeof head.speakAudio !== "function") {
    console.error("TalkingHead not ready for audio — speakAudio missing");
    return durationMs;
  }

  // THE mouth wire — AudioBuffer + word timings, never a bare buffer / <audio> tag.
  head.speakAudio(payload, { lipsyncLang: "en" });
  host.isSpeaking = true;

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
    if (usedProxy) speakBrowserFallback(text, undefined, undefined, mood);
    return { durationMs, usedProxy };
  }

  // No TalkingHead — play decoded TTS or browser voice.
  if (!usedProxy) {
    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.start();
    return { durationMs: Math.max(200, audioBuffer.duration * 1000), usedProxy };
  }
  speakBrowserFallback(text, undefined, undefined, mood);
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
      src.start();
      totalMs += Math.max(200, audioBuffer.duration * 1000) + 80;
    } else {
      totalMs += Math.max(200, audioBuffer.duration * 1000) + 80;
    }
  }

  if (anyProxy) speakBrowserFallback(fullText, undefined, undefined, mood);
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
    speakBrowserFallback(
      clean,
      opts.onStart,
      () => {
        applyExpressionToTalkingHead(head, mood, { isSpeaking: false });
        opts.onEnd?.();
      },
      mood,
    );
  }
}

/**
 * Cut Karen's current line so the user can scream.
 * NEVER call TalkingHead.stop() here — that kills isRunning + the render loop
 * and freezes/crashes the avatar on iOS when the mic is pressed.
 */
export function pauseKarenAudio(): void {
  speakGeneration += 1;
  dispatchKarenSpeaking(false);
  stopActiveBufferSource();
  // Clear SPEAKING unless a caller immediately promotes to LISTENING (barge-in).
  if (getAvatarState() === AvatarState.SPEAKING) {
    setAvatarState(AvatarState.IDLE);
  }

  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  try {
    if (smackHtmlAudio && typeof smackHtmlAudio.pause === "function") {
      smackHtmlAudio.pause();
    }
  } catch {
    /* ignore */
  }

  const head = registeredHead as
    | (TalkingHeadLike & {
        stopSpeaking?: () => void;
        pauseSpeaking?: () => void;
        audioCtx?: AudioContext;
        stream?: { stop?: () => void; audio?: HTMLAudioElement | null } | null;
      })
    | null;

  try {
    const el = head?.stream?.audio;
    if (el && typeof el.pause === "function") {
      el.pause();
      el.volume = 1.0;
      try {
        el.currentTime = el.currentTime;
      } catch {
        /* ignore seek races */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    head?.stream?.stop?.();
  } catch {
    /* ignore */
  }

  // Stop speech ONLY — keep the animation cycle alive.
  try {
    if (typeof head?.stopSpeaking === "function") head.stopSpeaking();
    else if (typeof head?.pauseSpeaking === "function") head.pauseSpeaking();
  } catch {
    /* ignore */
  }

  // Do NOT suspend AudioContext here — mic barge-in + getUserMedia + WebGL
  // suspend/resume thrash is a leading Safari tab-killer.
}

/**
 * Full battery-save stop: speech + AudioContext + render loop.
 * Call when leaving /karen or closing a modal that owns the avatar.
 */
export function pauseKarenRuntimeAudioAndRender(): void {
  pauseKarenAudio();
  const head = registeredHead as
    | (TalkingHeadLike & { stop?: () => void; audioCtx?: AudioContext })
    | null;
  const suspendCtx = (c: AudioContext | null | undefined) => {
    if (c && c.state === "running") void c.suspend().catch(() => undefined);
  };
  suspendCtx(sharedAudioCtx);
  suspendCtx(head?.audioCtx ?? null);
  try {
    head?.stop?.();
  } catch {
    /* ignore */
  }
  void import("@/lib/karen/talkinghead-factory").then(({ pauseKarenRuntime }) => {
    pauseKarenRuntime(registeredHead as never);
  });
}

/** Cancel in-flight speak + browser TTS. */
export function stopKarenSpeech(): void {
  pauseKarenAudio();
}

/** Impatience interrupt — 3s silence while user hesitates → ANNOYED clip. */
export {
  IMPATIENCE_SILENCE_MS,
  pickImpatienceInterrupt,
  playImpatienceInterrupt,
  type ImpatienceClip,
} from "@/lib/karen/impatience";
