export const BUDDY_MOODS = [
  "neutral",
  "calm",
  "happy",
  "excited",
  "sad",
  "anxious",
  "angry",
  "tired",
  "lonely",
  "hopeful",
  "curious",
  "loving",
  "playful",
] as const;

export type BuddyMood = (typeof BUDDY_MOODS)[number];
export type MoodTrend = "improving" | "steady" | "heavy";
export type CompanionPersonality = "chill" | "playful" | "warm" | "mystical" | "focused";

export type MoodCheckIn = {
  id: string;
  mood: BuddyMood;
  intensity: number;
  note?: string;
  createdAt: string;
};

export type MoodState = {
  mood: BuddyMood;
  intensity: number;
  trend: MoodTrend;
  confidence: number;
  /** Heuristic −1..1 — never clinical. */
  valence?: number;
  /** Heuristic 0..1 — never clinical. */
  arousal?: number;
};

export const CHECKIN_CHOICES: Array<{ mood: BuddyMood; label: string; emoji: string }> = [
  { mood: "calm", label: "Calm", emoji: "😌" },
  { mood: "happy", label: "Good", emoji: "😊" },
  { mood: "excited", label: "Excited", emoji: "✨" },
  { mood: "loving", label: "Loved", emoji: "❤️" },
  { mood: "neutral", label: "Meh", emoji: "😐" },
  { mood: "sad", label: "Low", emoji: "😔" },
  { mood: "anxious", label: "Anxious", emoji: "😰" },
  { mood: "angry", label: "Frustrated", emoji: "😡" },
  { mood: "tired", label: "Tired", emoji: "🥱" },
];

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

export function isBuddyMood(value: string): value is BuddyMood {
  return (BUDDY_MOODS as readonly string[]).includes(value);
}

export function mapLegacyMood(mood: string): BuddyMood {
  const key = mood.trim().toLowerCase();
  if (isBuddyMood(key)) return key;
  if (key === "concerned" || key === "thinking") return "anxious";
  if (key === "sleepy") return "tired";
  if (key === "listening" || key === "—" || !key) return "neutral";
  return "neutral";
}

export function deriveMoodState(entries: MoodCheckIn[]): MoodState {
  if (entries.length === 0) {
    return { mood: "neutral", intensity: 40, trend: "steady", confidence: 0.2, valence: 0, arousal: 0.4 };
  }
  const latest = entries[0];
  const window = entries.slice(0, 7);
  const scores = window.map((e) => SCORE[e.mood]);
  const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
  const secondHalf = scores.slice(Math.ceil(scores.length / 2));
  const a = firstHalf.reduce((x, y) => x + y, 0) / firstHalf.length;
  const b = secondHalf.length ? secondHalf.reduce((x, y) => x + y, 0) / secondHalf.length : a;
  let trend: MoodTrend = "steady";
  if (a - b >= 1.2) trend = "improving";
  else if (b - a >= 1.2) trend = "heavy";

  // Dynamic import avoided — valence helpers live in mood-valence; soft inline map here for SSR safety.
  const valenceMap: Record<BuddyMood, number> = {
    sad: -0.85,
    lonely: -0.7,
    angry: -0.55,
    anxious: -0.5,
    tired: -0.25,
    neutral: 0,
    curious: 0.25,
    calm: 0.45,
    hopeful: 0.55,
    loving: 0.65,
    happy: 0.75,
    playful: 0.7,
    excited: 0.85,
  };
  const arousalMap: Record<BuddyMood, number> = {
    tired: 0.15,
    calm: 0.25,
    sad: 0.3,
    lonely: 0.35,
    loving: 0.4,
    hopeful: 0.45,
    neutral: 0.45,
    curious: 0.55,
    happy: 0.6,
    anxious: 0.75,
    playful: 0.8,
    angry: 0.85,
    excited: 0.95,
  };

  return {
    mood: latest.mood,
    intensity: Math.max(8, Math.min(100, latest.intensity)),
    trend,
    confidence: Math.min(0.92, 0.28 + window.length * 0.08),
    valence: valenceMap[latest.mood] ?? 0,
    arousal: arousalMap[latest.mood] ?? 0.45,
  };
}

export function insightLine(state: MoodState): string {
  if (state.trend === "improving") return "Buddy is picking up a lighter vibe across your recent check-ins.";
  if (state.trend === "heavy") return "Based on what you shared, a few days felt denser. Be gentle with yourself.";
  if (typeof state.valence === "number" && state.valence > 0.4 && (state.arousal ?? 0) < 0.4) {
    return "Buddy is picking up a calmer, warmer vibe.";
  }
  if (state.mood === "tired") return "Slow is allowed. Rest is part of the rhythm.";
  if (state.mood === "excited") return "Your check-in feels bright. Ride it — don't rush it.";
  if (state.mood === "calm") return "Quiet energy. That's a kind of strength too.";
  return "I'm here. We can talk, or just hang out.";
}

export function greetingLine(name: string, personality: CompanionPersonality, hour = new Date().getHours()): string {
  const who = name.trim() || "Buddy";
  if (hour < 12) {
    if (personality === "playful") return `Morning. ${who} noticed you.`;
    if (personality === "mystical") return `The day is still forming. ${who} is listening.`;
    return `Hey. You're back.`;
  }
  if (hour < 18) {
    if (personality === "focused") return `I'm with you. What's the next move?`;
    return `Hey. How are you feeling?`;
  }
  if (personality === "warm") return `Evening. Want to talk about it, or just hang out?`;
  return `You're here. That's enough for now.`;
}

export function wakeLine(mood: BuddyMood): string {
  if (mood === "anxious") return "Okay. We can slow this down together.";
  if (mood === "sad") return "Something feels a little heavy today.";
  if (mood === "excited") return "Okayyy, I see that energy.";
  if (mood === "happy") return "That glow looks good on you.";
  if (mood === "tired") return "Low battery is still a valid mood.";
  if (mood === "playful") return "I was hoping you'd tap.";
  return "Hey. You're back.";
}

export const PERSONALITY_CHOICES: Array<{ id: CompanionPersonality; label: string; hint: string }> = [
  { id: "chill", label: "Chill", hint: "Quiet company. No pressure." },
  { id: "playful", label: "Playful", hint: "Light, a little cheeky." },
  { id: "warm", label: "Warm", hint: "Soft, emotionally present." },
  { id: "mystical", label: "Mystical", hint: "Poetic, slightly cosmic." },
  { id: "focused", label: "Focused", hint: "Clear. Next-move energy." },
];
