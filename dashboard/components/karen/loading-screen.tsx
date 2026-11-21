"use client";

import { useEffect, useRef, useState } from "react";

import {
  getPrefetchAudioUrls,
  prefetchKarenAudioFiles,
  type PrefetchProgress,
} from "@/lib/karen/audio-cache";

type LoadingScreenProps = {
  /** Fired once prefetch finishes (success or soft-fail). */
  onComplete: () => void;
  label?: string;
};

/**
 * Boot gate before TalkingHead — warms the first 10 MP3s so lipsync isn't cold.
 */
export function LoadingScreen({
  onComplete,
  label = "Waking Karen up...",
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState("Warming audio bank");
  const cacheRef = useRef<Map<string, boolean>>(new Map());
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const urls = getPrefetchAudioUrls(10);
      await prefetchKarenAudioFiles(urls, (p: PrefetchProgress) => {
        if (cancelled) return;
        cacheRef.current.set(p.url, p.ok);
        const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
        setProgress(pct);
        setDetail(p.ok ? `Cached ${p.done}/${p.total}` : `Skipped missing clip ${p.done}/${p.total}`);
      });
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      setProgress(100);
      setDetail("Ready");
      // Brief beat so the bar reads as complete before the stage mounts.
      window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, 280);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return (
    <div
      className="relative z-10 flex karen-vh w-full flex-col items-center justify-center overflow-hidden bg-transparent text-white"
      role="status"
      aria-live="polite"
      aria-busy={progress < 100}
      aria-label={label}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/50" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,45,85,0.22),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 140px rgba(0,0,0,0.75)" }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6">
        <div className="h-28 w-28 animate-pulse rounded-full bg-rose-500/20 ring-2 ring-rose-400/35" />
        <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-rose-200/90">
          {label}
        </p>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff1a3c] to-[#ff6b81] transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-center text-[11px] tabular-nums text-zinc-500">
          {progress}% · {detail}
        </p>
      </div>
    </div>
  );
}

export default LoadingScreen;
