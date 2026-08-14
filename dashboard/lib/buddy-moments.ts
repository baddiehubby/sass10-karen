import type { MoodCheckIn, MoodTrend } from "@/lib/companion-mood";
import type { BuddyIdentity } from "@/lib/buddy-identity";
import { checkInStreak } from "@/lib/orb-evolution";

export type BuddyMoment = {
  id: string;
  line: string;
};

const COOLDOWN_MS = 40 * 60 * 60 * 1000;

function isNight(iso: string): boolean {
  const h = new Date(iso).getHours();
  return h >= 21 || h < 5;
}

export function pickBuddyMoment(
  entries: MoodCheckIn[],
  identity: BuddyIdentity,
  trend: MoodTrend,
  now = new Date(),
): BuddyMoment | null {
  if (identity.lastMomentAt) {
    const last = new Date(identity.lastMomentAt).getTime();
    if (Number.isFinite(last) && now.getTime() - last < COOLDOWN_MS) return null;
  }

  const seen = new Set(identity.seenMomentIds);
  const candidates: BuddyMoment[] = [];
  const nights = entries.filter((e) => isNight(e.createdAt)).slice(0, 3);
  const nightStreak = nights.length >= 3 && nights.every((e) => isNight(e.createdAt));

  if (nightStreak && !seen.has("three-nights")) {
    candidates.push({
      id: "three-nights",
      line: "Three nights in a row. The late hours know you.",
    });
  }
  if (trend === "improving" && entries.length >= 4 && !seen.has("lighter-week")) {
    candidates.push({
      id: "lighter-week",
      line: "You've seemed a little lighter this week.",
    });
  }
  if (entries[0]?.mood === "excited" && !seen.has("big-day")) {
    candidates.push({
      id: "big-day",
      line: "That was a big day. Keep a little of it.",
    });
  }
  const today = entries.filter((e) => new Date(e.createdAt).toDateString() === now.toDateString());
  if (today.length >= 2) {
    const moods = new Set(today.map((e) => e.mood));
    if (moods.size >= 2 && !seen.has("energy-shift")) {
      candidates.push({
        id: "energy-shift",
        line: "Your energy feels different than it did earlier.",
      });
    }
  }
  const streak = checkInStreak(entries, now);
  if (streak >= 7 && !seen.has("seven-days")) {
    candidates.push({
      id: "seven-days",
      line: "Seven days of showing up. That's a universe starting.",
    });
  }
  if (entries.length === 1 && !seen.has("first-light")) {
    candidates.push({
      id: "first-light",
      line: "First check-in. The orb has a memory now.",
    });
  }

  return candidates[0] ?? null;
}
