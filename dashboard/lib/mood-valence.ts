/**
 * Autonomous mood math — valence (−1 heavy … +1 light) and arousal (0 calm … 1 energetic).
 * Heuristic only. Never presented as clinical diagnosis.
 */

import type { BuddyMood, MoodCheckIn, MoodState, MoodTrend } from "@/lib/companion-mood";

const VALENCE: Record<BuddyMood, number> = {
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

const AROUSAL: Record<BuddyMood, number> = {
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

/** Lightweight lexical hints from optional free-text notes. */
const HEAVY = /\b(heavy|down|hurt|lonely|anxious|worried|exhausted|overwhelmed|cry|sad)\b/i;
const LIGHT = /\b(good|great|happy|excited|grateful|win|better|love|peaceful|calm)\b/i;
const ENERGETIC = /\b(wired|buzz|hype|energy|can't sleep|cant sleep|amped)\b/i;
const CALMING = /\b(tired|slow|quiet|rest|sleep|soft|gentle)\b/i;

export type AffectReading = {
  valence: number;
  arousal: number;
  confidence: number;
  trend: MoodTrend;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function affectFromMood(mood: BuddyMood, intensity = 55): { valence: number; arousal: number } {
  const i = clamp(intensity / 100, 0.15, 1);
  return {
    valence: clamp(VALENCE[mood] * (0.55 + i * 0.45), -1, 1),
    arousal: clamp(AROUSAL[mood] * (0.6 + i * 0.4), 0, 1),
  };
}

export function blendNoteSignals(base: { valence: number; arousal: number }, note?: string) {
  if (!note?.trim()) return base;
  let { valence, arousal } = base;
  if (HEAVY.test(note)) valence -= 0.12;
  if (LIGHT.test(note)) valence += 0.12;
  if (ENERGETIC.test(note)) arousal += 0.1;
  if (CALMING.test(note)) arousal -= 0.1;
  return { valence: clamp(valence, -1, 1), arousal: clamp(arousal, 0, 1) };
}

export function deriveAffect(entries: MoodCheckIn[]): AffectReading {
  if (entries.length === 0) {
    return { valence: 0, arousal: 0.4, confidence: 0.2, trend: "steady" };
  }
  const window = entries.slice(0, 7);
  const points = window.map((e) => blendNoteSignals(affectFromMood(e.mood, e.intensity), e.note));
  const valence = points.reduce((s, p) => s + p.valence, 0) / points.length;
  const arousal = points.reduce((s, p) => s + p.arousal, 0) / points.length;
  const latest = blendNoteSignals(affectFromMood(entries[0].mood, entries[0].intensity), entries[0].note);
  const first = points.slice(0, Math.ceil(points.length / 2));
  const second = points.slice(Math.ceil(points.length / 2));
  const a = first.reduce((s, p) => s + p.valence, 0) / first.length;
  const b = second.length ? second.reduce((s, p) => s + p.valence, 0) / second.length : a;
  let trend: MoodTrend = "steady";
  if (a - b >= 0.18) trend = "improving";
  else if (b - a >= 0.18) trend = "heavy";
  return {
    valence: clamp(latest.valence * 0.55 + valence * 0.45, -1, 1),
    arousal: clamp(latest.arousal * 0.55 + arousal * 0.45, 0, 1),
    confidence: Math.min(0.9, 0.28 + window.length * 0.08),
    trend,
  };
}

/** Soft product language — never clinical. */
export function vibeInsight(affect: AffectReading, mood: BuddyMood): string {
  if (affect.trend === "improving") return "Buddy is picking up a lighter vibe across your recent check-ins.";
  if (affect.trend === "heavy") return "Based on what you shared, things have felt denser lately. Be gentle.";
  if (affect.valence > 0.45 && affect.arousal > 0.65) return "Your check-in feels bright and awake.";
  if (affect.valence > 0.35 && affect.arousal < 0.4) return "Buddy is picking up a calmer, warmer vibe.";
  if (affect.valence < -0.35 && affect.arousal > 0.6) return "Something feels intense. We can slow the moment down.";
  if (affect.valence < -0.35) return "Your check-in feels a little heavy. I'm here either way.";
  if (mood === "curious") return "There's a searching energy here — that counts as showing up.";
  return "Based on what you shared, the vibe is steady. We can talk, or just hang out.";
}

export function withAffect(state: MoodState, entries: MoodCheckIn[]): MoodState & AffectReading {
  const affect = deriveAffect(entries);
  return {
    ...state,
    valence: affect.valence,
    arousal: affect.arousal,
    confidence: Math.max(state.confidence, affect.confidence),
    trend: affect.trend,
  };
}
