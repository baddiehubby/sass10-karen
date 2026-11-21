"use client";

import { useEffect } from "react";

import { getKarenAudioContext, unlockAudio } from "@/lib/karen/voice";

/**
 * Mobile / iOS Safari audio unlock.
 *
 * Browsers keep AudioContext suspended until a real user gesture. This
 * useEffect listens for the first tap and calls `audioContext.resume()` —
 * the only reliable way Safari will allow sound. Also runs the silent-buffer
 * unlock via `unlockAudio()` so lipsync / combat share the same fight clock.
 *
 * ENTER THE ROAST calls unlockAudio() directly on pointerdown as well.
 */
export function KarenAudioUnlock() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let unlocked = false;

    const unlock = () => {
      if (unlocked) return;
      unlocked = true;

      // 1) Explicit resume on the shared context (iOS Safari requirement).
      try {
        const ctx = getKarenAudioContext();
        if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
          void ctx.resume().then(() => {
            console.info("[KarenAudioUnlock] audioContext.resume() →", ctx.state);
          });
        }
      } catch (err) {
        console.warn("[KarenAudioUnlock] resume failed", err);
      }

      // 2) Full unlock: resume + silent 1-sample buffer @ 22050 Hz.
      void unlockAudio()
        .then((ctx) => {
          if (ctx.state === "running") {
            window.removeEventListener("pointerdown", unlock, true);
            window.removeEventListener("touchstart", unlock, true);
            window.removeEventListener("click", unlock, true);
            window.removeEventListener("keydown", unlock, true);
            return;
          }
          unlocked = false;
        })
        .catch(() => {
          unlocked = false;
        });
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("touchstart", unlock, {
      capture: true,
      passive: true,
    });
    window.addEventListener("click", unlock, true);
    window.addEventListener("keydown", unlock, true);

    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
      window.removeEventListener("click", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);

  return null;
}
