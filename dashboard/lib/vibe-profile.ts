import type { BuddyMood, MoodCheckIn } from "@/lib/companion-mood";

export type VibeProfile = {
  id: string;
  title: string;
  line: string;
};

const SCORE: Record<BuddyMood, number> = {
  sad: 1,
  angry: 2,
  anxious: 2,
  lonely: 2,
  tired: 3,
  neutral: 5,
  curious: 6,
  calm: 7,
  hopeful: 8,
  loving: 8,
  happy: 8,
  playful: 8,
  excited: 9,
};

function hourOf(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours();
}

export function deriveVibeProfile(entries: MoodCheckIn[]): VibeProfile {
  if (entries.length < 5) {
    return {
      id: "still-forming",
      title: "Still Forming",
      line: "A vibe appears after a handful of check-ins. No rush.",
    };
  }

  const hours = entries.map((e) => hourOf(e.createdAt)).filter((h): h is number => h != null);
  const night = hours.filter((h) => h >= 21 || h < 5).length;
  const morning = hours.filter((h) => h >= 5 && h < 12).length;
  const late = hours.filter((h) => h >= 23 || h < 4).length;
  const social = entries.filter((e) => e.mood === "loving" || e.mood === "excited" || e.mood === "playful").length;
  const deep = entries.filter((e) => e.mood === "sad" || e.mood === "lonely" || e.note).length;
  const burst = entries.filter((e) => e.mood === "excited" || e.mood === "hopeful").length;
  const calmish = entries.filter((e) => e.mood === "calm" || e.mood === "curious" || e.mood === "neutral").length;
  const scores = entries.slice(0, 12).map((e) => SCORE[e.mood]);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;

  if (late / hours.length >= 0.45) {
    return { id: "late-night-dreamer", title: "Late-Night Dreamer", line: "Your hours lean toward the quiet end of the clock." };
  }
  if (night / hours.length >= 0.5) {
    return { id: "night-thinker", title: "Night Thinker", line: "You check in when the day has already gone dim." };
  }
  if (variance >= 7.5) {
    return { id: "quiet-storm", title: "Quiet Storm", line: "Your days don't all wear the same weather. That's allowed." };
  }
  if (social / entries.length >= 0.4) {
    return { id: "social-spark", title: "Social Spark", line: "Connection keeps showing up in your check-ins." };
  }
  if (deep / entries.length >= 0.4) {
    return { id: "deep-feeler", title: "Deep Feeler", line: "You give the inner weather a name. That's a kind of courage." };
  }
  if (burst / entries.length >= 0.35) {
    return { id: "burst-of-motivation", title: "Burst of Motivation", line: "Energy arrives in sparks. Ride them; don't inventory them." };
  }
  if (morning / hours.length >= 0.45) {
    return { id: "morning-glow", title: "Morning Glow", line: "You tend to meet the day while it's still assembling." };
  }
  if (calmish / entries.length >= 0.45) {
    return { id: "curious-energy", title: "Curious Energy", line: "Mostly looking, mostly listening. A good way to move." };
  }
  return { id: "steady-current", title: "Steady Current", line: "A rhythm is forming. Not a diagnosis — a snapshot." };
}
