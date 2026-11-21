/**
 * Loud Kokoro wake loop — HTMLAudioElement so we can crank `.volume` on failed dismissals.
 * Lipsync roasts ride the normal playWav path separately.
 */

import { normalizeKarenAudioUrl } from "@/lib/karen/audio-cache";
import { unlockKarenAudio } from "@/lib/karen/voice";

export type AlarmLoopHandle = {
  setVolume: (v: number) => void;
  getVolume: () => number;
  stop: () => void;
  element: HTMLAudioElement;
};

/**
 * Start a looping wake WAV at `volume` (0–1). Call from a user gesture when possible;
 * `unlockKarenAudio` is still invoked for Web Audio / lipsync follow-ups.
 */
export async function startKarenAlarmLoop(
  src: string,
  volume = 0.9,
): Promise<AlarmLoopHandle> {
  await unlockKarenAudio();
  const el = new Audio(normalizeKarenAudioUrl(src));
  el.loop = true;
  el.preload = "auto";
  el.volume = clamp01(volume);
  try {
    await el.play();
  } catch (err) {
    console.warn("[alarm-loop] autoplay blocked — waiting for gesture", err);
  }

  return {
    element: el,
    getVolume: () => el.volume,
    setVolume: (v: number) => {
      el.volume = clamp01(v);
    },
    stop: () => {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Bump loop gain; returns the new volume. */
export function escalateAlarmVolume(handle: AlarmLoopHandle, step = 0.12): number {
  const next = clamp01(handle.getVolume() + step);
  handle.setVolume(next);
  // Nudge play in case the browser paused us.
  void handle.element.play().catch(() => undefined);
  return next;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
