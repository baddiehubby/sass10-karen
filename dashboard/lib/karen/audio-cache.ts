/**
 * Prefetch + in-memory ArrayBuffer / AudioBuffer cache for Karen audio.
 * Prevents audio/3D desync by having bytes ready before decode → speakAudio.
 */

import { listExpectedAudioPaths } from "@/lib/karen/audio-bank";
import { PREMIUM_ROAST_FILES } from "@/lib/karen/premium-voice-library";
import { SMACKBACK_CLIPS } from "@/lib/karen/smack-back";
import { KAREN_SFX } from "@/lib/karen/sfx";

export const KAREN_AUDIO_CACHE_NAME = "karen-audio-v1";
export const KAREN_PREFETCH_COUNT = 10;
/** Launch preloader — first N smackback WAVs decoded to AudioBuffer. */
export const SMACKBACK_PRELOAD_COUNT = 20;

/** Module-level byte cache (shared across components / voice pipeline). */
const arrayBufferCache = new Map<string, ArrayBuffer>();
/**
 * Global decoded-WAV cache — filled on ENTER THE ROAST (top 20),
 * read first by playWavWithLipsync for zero-latency comebacks.
 */
export const AudioBufferCache = new Map<string, AudioBuffer>();
/** @deprecated Prefer AudioBufferCache — kept as a private alias during migration. */
const audioBufferCache = AudioBufferCache;
/** Safari RAM guard — never keep unbounded raw MP3/WAV bytes in memory. */
const ARRAY_BUFFER_CACHE_MAX = 20;

/**
 * Top 10 fallback / brutal / interrupt WAVs — decoded first so typo "asdf"
 * and barge-in yells never wait on the network.
 */
export const FALLBACK_BRUTAL_WAVS = [
  "/audio/smackbacks/dominance_01.wav",
  "/audio/smackbacks/dominance_02.wav",
  "/audio/smackbacks/volume_interrupt.wav",
  "/audio/smackbacks/sb_08.wav",
  "/audio/smackbacks/sb_11.wav",
  "/audio/smackbacks/brutal_01.wav",
  "/audio/smackbacks/brutal_02.wav",
  "/audio/smackbacks/brutal_03.wav",
  "/audio/smackbacks/sb_01.wav",
  "/audio/smackbacks/sb_03.wav",
] as const;

/** Combat-hot WAVs that must land in the first preload slot (gibberish / interrupt). */
export const COMBAT_PRIORITY_WAVS = [
  ...FALLBACK_BRUTAL_WAVS,
  "/audio/smackbacks/sb_05.wav",
  "/audio/smackbacks/done_listening.wav",
] as const;

function putArrayBufferLimited(url: string, buffer: ArrayBuffer): void {
  if (!url || !buffer.byteLength) return;
  if (arrayBufferCache.size >= ARRAY_BUFFER_CACHE_MAX && !arrayBufferCache.has(url)) {
    // Drop oldest entry (Map insertion order).
    const oldest = arrayBufferCache.keys().next().value;
    if (oldest) arrayBufferCache.delete(oldest);
  }
  if (arrayBufferCache.size < ARRAY_BUFFER_CACHE_MAX || arrayBufferCache.has(url)) {
    arrayBufferCache.set(url, buffer.slice(0));
  }
}

export function normalizeKarenAudioUrl(fileName: string): string {
  const raw = fileName.trim();
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) {
    return raw;
  }
  if (raw.startsWith("audio/")) return `/${raw}`;
  return `/audio/${raw.replace(/^\/+/, "")}`;
}

/**
 * Priority list for the boot preloader — questions, SFX, then angry bank / mood clips.
 */
export function getPrefetchAudioUrls(limit = KAREN_PREFETCH_COUNT): string[] {
  const bank = listExpectedAudioPaths();
  const priority = [
    ...bank.filter((p) => p.includes("/questions/")),
    KAREN_SFX.click,
    KAREN_SFX.heartbeat,
    KAREN_SFX.shatter,
    ...PREMIUM_ROAST_FILES.angry,
    ...bank.filter((p) => p.includes("/roasts/")),
    ...bank,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of priority) {
    const n = normalizeKarenAudioUrl(url);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

export function getCachedAudioArrayBuffer(fileName: string): ArrayBuffer | null {
  const url = normalizeKarenAudioUrl(fileName);
  const hit = arrayBufferCache.get(url);
  return hit ? hit.slice(0) : null;
}

export function getCachedAudioBuffer(src: string): AudioBuffer | null {
  return audioBufferCache.get(normalizeKarenAudioUrl(src)) ?? null;
}

export function hasCachedAudio(fileName: string): boolean {
  return arrayBufferCache.has(normalizeKarenAudioUrl(fileName));
}

export function putCachedAudioArrayBuffer(fileName: string, buffer: ArrayBuffer): void {
  const url = normalizeKarenAudioUrl(fileName);
  putArrayBufferLimited(url, buffer);
}

async function putBrowserCache(url: string, buffer: ArrayBuffer): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(KAREN_AUDIO_CACHE_NAME);
    await cache.put(
      url,
      new Response(buffer.slice(0), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=31536000",
        },
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

async function readBrowserCache(url: string): Promise<ArrayBuffer | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(KAREN_AUDIO_CACHE_NAME);
    const res = await cache.match(url);
    if (!res || !res.ok) return null;
    const ab = await res.arrayBuffer();
    return ab.byteLength ? ab : null;
  } catch {
    return null;
  }
}

/**
 * Fetch one MP3/WAV into memory (+ Cache API). Throws on HTTP/network failure.
 */
export async function fetchAudioArrayBuffer(fileName: string): Promise<ArrayBuffer> {
  const url = normalizeKarenAudioUrl(fileName);
  const mem = arrayBufferCache.get(url);
  if (mem?.byteLength) return mem.slice(0);

  const fromCache = await readBrowserCache(url);
  if (fromCache?.byteLength) {
    putArrayBufferLimited(url, fromCache);
    return fromCache.slice(0);
  }

  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`MP3 HTTP ${res.status} for ${url}`);
  }
  const ab = await res.arrayBuffer();
  if (!ab.byteLength) throw new Error(`empty MP3 ${url}`);
  // Only keep the first N in RAM; Cache API still warms disk for the rest.
  putArrayBufferLimited(url, ab);
  void putBrowserCache(url, ab);
  return ab.slice(0);
}

export type PrefetchProgress = {
  done: number;
  total: number;
  url: string;
  ok: boolean;
};

/**
 * Prefetch the first N MP3s. Failures are counted (progress still advances) — never throws.
 */
export async function prefetchKarenAudioFiles(
  urls: string[] = getPrefetchAudioUrls(),
  onProgress?: (p: PrefetchProgress) => void,
): Promise<{ loaded: number; failed: number }> {
  let loaded = 0;
  let failed = 0;
  const total = urls.length || 1;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    let ok = false;
    try {
      await fetchAudioArrayBuffer(url);
      loaded += 1;
      ok = true;
    } catch (err) {
      failed += 1;
      console.warn("[karen/audio-cache] prefetch miss (will TTS if needed)", url, err);
    }
    onProgress?.({ done: i + 1, total, url, ok });
  }

  if (!urls.length) {
    onProgress?.({ done: 1, total: 1, url: "", ok: true });
  }

  return { loaded, failed };
}

/** First N smackback public URLs for the launch Preloader (combat priority first). */
export function listPreloadSmackbackUrls(count = SMACKBACK_PRELOAD_COUNT): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const url = normalizeKarenAudioUrl(raw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };
  for (const url of FALLBACK_BRUTAL_WAVS) push(url);
  for (const url of COMBAT_PRIORITY_WAVS) push(url);
  for (const clip of SMACKBACK_CLIPS) {
    if (out.length >= count) break;
    push(clip.src);
  }
  return out.slice(0, count);
}

/** Exactly the top 10 typo/brutal/interrupt decode targets. */
export function listFallbackBrutalUrls(
  count = FALLBACK_BRUTAL_WAVS.length,
): string[] {
  return FALLBACK_BRUTAL_WAVS.slice(0, count).map((u) => normalizeKarenAudioUrl(u));
}

export type PreloadProgress = {
  loaded: number;
  total: number;
  url: string | null;
};

/**
 * Fetch + decode the first N smackback WAVs into AudioBuffer memory.
 * Uses the gesture-unlocked shared AudioContext.
 */
export async function preloadSmackbackBuffers(
  opts: {
    count?: number;
    /** Required — pass the StartGate-unlocked AudioContext (avoids voice↔cache cycles). */
    audioContext: AudioContext;
    onProgress?: (p: PreloadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<{ loaded: number; total: number; failed: number }> {
  const total = Math.min(
    opts.count ?? SMACKBACK_PRELOAD_COUNT,
    SMACKBACK_CLIPS.length,
  );
  const urls = listPreloadSmackbackUrls(total);
  const ctx = opts.audioContext;
  let loaded = 0;
  let failed = 0;

  for (const url of urls) {
    if (opts.signal?.aborted) break;
    opts.onProgress?.({ loaded, total, url });
    if (audioBufferCache.has(url)) {
      loaded += 1;
      opts.onProgress?.({ loaded, total, url });
      continue;
    }
    try {
      const raw = await fetchAudioArrayBuffer(url);
      const buf = await ctx.decodeAudioData(raw.slice(0));
      audioBufferCache.set(url, buf);
      loaded += 1;
    } catch (err) {
      failed += 1;
      console.warn("[audio-cache] smackback preload failed", url, err);
      loaded += 1;
    }
    opts.onProgress?.({ loaded, total, url });
  }

  return { loaded, total, failed };
}

export function clearAudioBufferCache(): void {
  audioBufferCache.clear();
}
