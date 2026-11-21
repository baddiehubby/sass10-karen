/**
 * Persistent Karen retention state — Respect score + streak surface.
 * localStorage only; drives cold-shoulder, rare roast, and dashboard counters.
 */

import { localDayKey } from "@/lib/karen/accountability";
import {
  GOOD_STREAK_KEY,
  GOOD_STREAK_LAST_DAY_KEY,
  readGoodStreak,
  recordCheckInStreak,
  writeGoodStreak,
} from "@/lib/karen/good-streak";

export const RESPECT_KEY = "karen.respect";
export const RARE_ROAST_UNLOCKED_KEY = "karen.rareRoast.unlocked";
export const RARE_ROAST_PLAYED_KEY = "karen.rareRoast.played";

/** Start at 0. Soft ceiling 100. Cold shoulder at ≤ -50. */
export const RESPECT_START = 0;
export const RESPECT_MAX = 100;
export const RESPECT_MIN = -100;
export const RESPECT_YES_DELTA = 10;
export const RESPECT_NO_DELTA = -15;
export const RESPECT_FORGIVE_DELTA = 5;
export const RESPECT_COLD_SHOULDER = -50;

/** Mic disabled after cold-shoulder refusal. */
export const MIC_LOCKOUT_KEY = "karen.micLockoutUntil";
export const MIC_LOCKOUT_MS = 60_000;

/** Special track when Respect ≤ -50 and user tries to scream again. */
export const DONE_LISTENING_LINE =
  "I'm done listening to your nonsense. Go do your laundry.";
export const DONE_LISTENING_AUDIO_ID = "smackback:done_listening";
export const DONE_LISTENING_SRC = "/audio/smackbacks/done_listening.wav";

/** Consecutive YES days → slightly-less-mean secret roast. */
export const RARE_ROAST_STREAK = 3;

export const RARE_ROAST_LINE =
  "Fine. Three days without disappointing me. Don't get comfortable — I'm still watching.";

export const RARE_ROAST_AUDIO_ID = "rare:roast";
export const RARE_ROAST_SRC = "/audio/bank/rare/rare_roast.mp3";

export const FORGIVE_LINE = "Pathetic. But I'll give you one more chance.";
export const FORGIVE_AUDIO_ID = "reaction:forgive";
export const FORGIVE_SRC = "/audio/bank/reactions/forgive.mp3";

export const COLD_SHOULDER_LINE =
  "Don't talk to me. Turn around and do the thing — then maybe I'll face you.";

export type KarenRetentionState = {
  respect: number;
  goodStreak: number;
  coldShoulder: boolean;
  rareRoastUnlocked: boolean;
  rareRoastPlayed: boolean;
};

function clampRespect(n: number): number {
  if (!Number.isFinite(n)) return RESPECT_START;
  return Math.max(RESPECT_MIN, Math.min(RESPECT_MAX, Math.round(n)));
}

export function readRespect(): number {
  if (typeof window === "undefined") return RESPECT_START;
  try {
    const raw = window.localStorage.getItem(RESPECT_KEY);
    if (raw == null) return RESPECT_START;
    return clampRespect(Number(raw));
  } catch {
    return RESPECT_START;
  }
}

export function writeRespect(n: number): number {
  const next = clampRespect(n);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RESPECT_KEY, String(next));
    } catch {
      /* private mode */
    }
  }
  return next;
}

export function adjustRespect(delta: number): number {
  return writeRespect(readRespect() + delta);
}

export function isColdShoulder(respect = readRespect()): boolean {
  return respect <= RESPECT_COLD_SHOULDER;
}

export function readMicLockoutUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(MIC_LOCKOUT_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function writeMicLockoutUntil(until: number): number {
  const next = Math.max(0, Math.round(until));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MIC_LOCKOUT_KEY, String(next));
    } catch {
      /* private mode */
    }
  }
  return next;
}

/** Lock Hold-to-Scream for `ms` from now (default 1 minute). */
export function lockMicFor(ms = MIC_LOCKOUT_MS): number {
  return writeMicLockoutUntil(Date.now() + ms);
}

export function isMicLocked(now = Date.now()): boolean {
  return readMicLockoutUntil() > now;
}

export function isRareRoastUnlocked(streak = readGoodStreak()): boolean {
  if (streak >= RARE_ROAST_STREAK) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RARE_ROAST_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRareRoastUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RARE_ROAST_UNLOCKED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasPlayedRareRoast(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RARE_ROAST_PLAYED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRareRoastPlayed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RARE_ROAST_PLAYED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** "Days Without Disappointment" — consecutive successful check-ins. */
export function daysWithoutDisappointment(): number {
  return readGoodStreak();
}

/**
 * Apply YES/NO check-in to Respect + streak.
 * YES +10; NO -15. Unlock rare roast at 3-day streak.
 */
export function applyCheckInOutcome(didIt: boolean): {
  respect: number;
  streak: number;
  coldShoulder: boolean;
  rareRoastJustUnlocked: boolean;
} {
  const prevStreak = readGoodStreak();
  const respect = adjustRespect(didIt ? RESPECT_YES_DELTA : RESPECT_NO_DELTA);
  const streak = recordCheckInStreak(didIt);
  let rareRoastJustUnlocked = false;
  if (didIt && streak >= RARE_ROAST_STREAK && prevStreak < RARE_ROAST_STREAK) {
    rareRoastJustUnlocked = true;
    markRareRoastUnlocked();
  } else if (didIt && streak >= RARE_ROAST_STREAK) {
    markRareRoastUnlocked();
  }
  return {
    respect,
    streak,
    coldShoulder: isColdShoulder(respect),
    rareRoastJustUnlocked,
  };
}

/** Successful beg → tiny Respect bump and exit cold shoulder if possible. */
export function applyForgiveness(): { respect: number; coldShoulder: boolean } {
  const respect = adjustRespect(RESPECT_FORGIVE_DELTA);
  return { respect, coldShoulder: isColdShoulder(respect) };
}

/**
 * Completing a real task (goal YES / goal toggle while cold) can restore face-time.
 * Bumps Respect enough to leave cold shoulder when still frozen.
 */
export function completeTaskForRespect(extra = RESPECT_YES_DELTA): {
  respect: number;
  coldShoulder: boolean;
} {
  let respect = readRespect();
  if (isColdShoulder(respect)) {
    // Lift just above the cold-shoulder line so she faces them again.
    respect = writeRespect(Math.max(RESPECT_COLD_SHOULDER + 1, respect + extra));
  } else {
    respect = adjustRespect(extra);
  }
  return { respect, coldShoulder: isColdShoulder(respect) };
}

export function readRetentionState(): KarenRetentionState {
  const respect = readRespect();
  const goodStreak = readGoodStreak();
  return {
    respect,
    goodStreak,
    coldShoulder: isColdShoulder(respect),
    rareRoastUnlocked: isRareRoastUnlocked(goodStreak),
    rareRoastPlayed: hasPlayedRareRoast(),
  };
}

/** Transcript must include apology hooks. */
export function apologyAccepted(transcript: string): boolean {
  const t = transcript.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return false;
  return /\bsorry\b/.test(t) || /\bi will\b/.test(t) || /\bi'll\b/.test(t);
}

/** @internal — test/reset helpers */
export function _resetRetentionForTests(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RESPECT_KEY);
    window.localStorage.removeItem(RARE_ROAST_UNLOCKED_KEY);
    window.localStorage.removeItem(RARE_ROAST_PLAYED_KEY);
    window.localStorage.removeItem(GOOD_STREAK_KEY);
    window.localStorage.removeItem(GOOD_STREAK_LAST_DAY_KEY);
  } catch {
    /* ignore */
  }
  writeGoodStreak(0);
  writeRespect(RESPECT_START);
}

export { localDayKey, readGoodStreak };
