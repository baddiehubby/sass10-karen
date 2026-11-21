"use client";

/**
 * Decode the first 20 smackback WAVs before the fight starts.
 * Mostly a no-op if StartGate already filled `audioCache`.
 */

import { useEffect, useState } from "react";

import { SMACKBACK_PRELOAD_COUNT } from "@/lib/karen/audio-cache";
import {
  audioCache,
  getCombatPreloadUrls,
  preloadAudio,
} from "@/lib/karen/voice";

type AudioPreloaderProps = {
  audioContext: AudioContext;
  onReady: () => void;
  count?: number;
};

export function AudioPreloader({
  audioContext,
  onReady,
  count = SMACKBACK_PRELOAD_COUNT,
}: AudioPreloaderProps) {
  const [loaded, setLoaded] = useState(() =>
    Math.min(audioCache.size, count),
  );
  const [total, setTotal] = useState(count);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    const urls = getCombatPreloadUrls(count);

    void (async () => {
      // Already warm from StartGate → flash 20/20 and enter.
      if (urls.every((u) => audioCache.has(u))) {
        if (!cancelled) {
          setLoaded(urls.length);
          setTotal(urls.length);
          onReady();
        }
        return;
      }

      await preloadAudio(urls, {
        audioContext,
        signal: ac.signal,
        onProgress: (p) => {
          if (cancelled) return;
          setLoaded(p.loaded);
          setTotal(p.total);
        },
      });
      if (cancelled) return;
      onReady();
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [audioContext, count, onReady]);

  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black px-6"
      role="status"
      aria-live="polite"
      aria-label="Loading Karen audio"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff4d6d]">
        SASS10
      </p>
      <h2 className="mt-4 text-center text-2xl font-black uppercase tracking-tight text-white">
        Waking Karen up…
      </h2>
      <p className="mt-3 font-mono text-sm tabular-nums text-zinc-300">
        [{loaded}/{total}]
      </p>

      <div className="mt-8 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#ff1a3c] to-[#ff2d55] transition-[width] duration-200"
          style={{
            width: `${pct}%`,
            boxShadow: "0 0 18px rgba(255,45,85,0.65)",
          }}
        />
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        Zero-latency smackbacks
      </p>
    </div>
  );
}

/** Alias matching the launch brief. */
export { AudioPreloader as Preloader };
