/**
 * Viral result titles + display metrics for the roast finale.
 */

import { type TraitId, type TraitScores } from "@/lib/karen/game-engine";
import { getVerdict, type RoastMood } from "@/lib/karen/roasts";

export type DisplayBars = {
  overthinking: number;
  confidence: number;
  chaos: number;
  laziness: number;
};

export type PersonalityProfile = {
  trait: TraitId;
  title: string;
  verdict: string;
  bars: DisplayBars;
  /** Highest primary roast score (for challenge URLs). */
  challengeScore: number;
  mood: RoastMood;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Confidence = whatever dignity survived overthinking + laziness. */
export function confidenceFromScores(scores: TraitScores): number {
  return clamp(100 - scores.overthinking * 0.55 - scores.laziness * 0.35 - scores.chaos * 0.1);
}

export function barsFromScores(scores: TraitScores): DisplayBars {
  return {
    overthinking: clamp(scores.overthinking),
    chaos: clamp(scores.chaos),
    laziness: clamp(scores.laziness),
    confidence: confidenceFromScores(scores),
  };
}

export function buildPersonalityProfile(scores: TraitScores): PersonalityProfile {
  const verdict = getVerdict(scores);
  const bars = barsFromScores(scores);
  const challengeScore = Math.max(bars.overthinking, bars.chaos, bars.laziness);

  return {
    trait: verdict.trait,
    title: verdict.title,
    verdict: verdict.roast,
    bars,
    challengeScore,
    mood: verdict.mood,
  };
}
