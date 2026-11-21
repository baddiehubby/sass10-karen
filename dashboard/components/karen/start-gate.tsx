"use client";

/**
 * Full-screen iOS AudioContext + mic unlock gate.
 * Warms smackback bytes while the user reads; decodes into audioCache on tap.
 */

import { useEffect, useState } from "react";

import { MIC_PERMISSION_COPY } from "@/lib/karen/mic";
import {
  getCombatPreloadUrls,
  preloadAudio,
  preloadFallbackBrutalAudio,
  unlockAudio,
  unlockKarenAudioAndMic,
  warmAudioFetches,
} from "@/lib/karen/voice";

type StartGateProps = {
  onUnlocked: (audioContext: AudioContext) => void | Promise<void>;
};

export async function unlockIosAudioAndMic(): Promise<AudioContext> {
  return unlockKarenAudioAndMic();
}

export function StartGate({ onUnlocked }: StartGateProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warmHint, setWarmHint] = useState("Warming smackbacks…");

  // While they read the warning — HTTP-fetch the top 20 WAVs (no decode yet).
  useEffect(() => {
    const ac = new AbortController();
    const urls = getCombatPreloadUrls(20);
    void warmAudioFetches(urls, ac.signal).then(() => {
      if (!ac.signal.aborted) setWarmHint("Smackbacks ready — tap to unlock");
    });
    return () => ac.abort();
  }, []);

  const enter = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ctx = await unlockAudio();
      // Explicit resume — suspended context = light show without sound.
      if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
        await ctx.resume().catch(() => undefined);
      }
      void unlockIosAudioAndMic();
      // Fallbacks first, then top 20 — typo "asdf" must never wait on network.
      setWarmHint("Decoding Karen…");
      await preloadFallbackBrutalAudio({ audioContext: ctx });
      await preloadAudio(getCombatPreloadUrls(20), { audioContext: ctx });
      await onUnlocked(ctx);
    } catch (err) {
      console.warn("[StartGate] unlock failed", err);
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? `${MIC_PERMISSION_COPY} Then tap again.`
          : "Could not unlock audio. Tap again.",
      );
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black px-5"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(255,45,85,0.35) 0%, transparent 55%), #000",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-gate-title"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#ff4d6d]">
        SASS10
      </p>
      <h1
        id="start-gate-title"
        className="mt-4 max-w-[14ch] text-center text-[clamp(2.2rem,8vw,3.75rem)] font-black uppercase leading-[0.95] tracking-tight text-white"
        style={{ textShadow: "0 0 36px rgba(255,45,85,0.55)" }}
      >
        Enter the Arena
      </h1>
      <p className="mt-4 max-w-sm text-center text-sm text-zinc-300">
        {MIC_PERMISSION_COPY}
      </p>

      <button
        type="button"
        disabled={busy}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          void unlockAudio();
        }}
        onClick={() => void enter()}
        className="mt-10 min-h-[4.25rem] w-full max-w-md rounded-full bg-gradient-to-r from-[#ff1a3c] via-[#ff2d55] to-[#ff4d6d] px-6 text-[clamp(1rem,3.6vw,1.25rem)] font-black uppercase tracking-[0.12em] text-white shadow-[0_0_48px_rgba(255,45,85,0.65)] transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Unlocking…" : "TAP TO ENTER THE ARENA"}
      </button>
      {busy ? (
        <p className="mt-3 max-w-sm text-center text-sm text-zinc-300">
          {MIC_PERMISSION_COPY}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 max-w-sm text-center text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : busy ? null : (
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          {warmHint}
        </p>
      )}
    </div>
  );
}
