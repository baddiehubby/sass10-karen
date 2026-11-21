/**
 * Accountability praise streak — localStorage only.
 * 7+ consecutive YES check-ins unlock PROUD Karen lines.
 */

import { localDayKey } from "@/lib/karen/accountability";

export const GOOD_STREAK_KEY = "karen.goodStreak";
export const GOOD_STREAK_LAST_DAY_KEY = "karen.goodStreak.lastDay";
export const GOOD_STREAK_THRESHOLD = 7;

export const PROUD_RESPONSES = [
  "I guess you're not a total failure.",
  "Fine. Consistency. Don't make me proud — I hate that.",
  "Seven days. I'll allow a microscopic nod of respect.",
  "You're still annoying. But you're annoyingly reliable now.",
  "Keep this up and I might stop rehearsing your eulogy.",
] as const;

export function readGoodStreak(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(window.localStorage.getItem(GOOD_STREAK_KEY) || "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function writeGoodStreak(n: number): number {
  const next = Math.max(0, Math.floor(n));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(GOOD_STREAK_KEY, String(next));
    } catch {
      /* private mode */
    }
  }
  return next;
}

export function isPraiseUnlocked(streak = readGoodStreak()): boolean {
  return streak >= GOOD_STREAK_THRESHOLD;
}

export function pickProudResponse(rand: () => number = Math.random): string {
  const idx = Math.floor(rand() * PROUD_RESPONSES.length) % PROUD_RESPONSES.length;
  return PROUD_RESPONSES[idx]!;
}

/**
 * Record an evening check-in outcome.
 * YES increments once per local day; NO resets to 0.
 */
export function recordCheckInStreak(didIt: boolean, day = localDayKey()): number {
  if (typeof window === "undefined") return didIt ? 1 : 0;

  try {
    const lastDay = window.localStorage.getItem(GOOD_STREAK_LAST_DAY_KEY);
    if (!didIt) {
      window.localStorage.setItem(GOOD_STREAK_LAST_DAY_KEY, day);
      return writeGoodStreak(0);
    }
    // Already counted today — return current streak.
    if (lastDay === day) return readGoodStreak();

    const prev = readGoodStreak();
    window.localStorage.setItem(GOOD_STREAK_LAST_DAY_KEY, day);
    return writeGoodStreak(prev + 1);
  } catch {
    return didIt ? 1 : 0;
  }
}

export function checkInMoodForStreak(
  didIt: boolean,
  streak = readGoodStreak(),
): "PROUD" | "SARCASTIC" | "FURIOUS" {
  if (!didIt) return "FURIOUS";
  if (streak >= GOOD_STREAK_THRESHOLD) return "PROUD";
  return "SARCASTIC";
}

export function checkInLineForStreak(
  didIt: boolean,
  streak = readGoodStreak(),
): string {
  if (!didIt) {
    return "I knew it. You're a coward. Tomorrow, you better not show your face here unless you actually do it.";
  }
  if (streak >= GOOD_STREAK_THRESHOLD) return pickProudResponse();
  return "Fine. You actually did it. Don't let it go to your head.";
}
