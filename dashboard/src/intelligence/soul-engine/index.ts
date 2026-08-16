/**
 * Lightweight character / soul voice — local rules only.
 */

import type { BuddyEmotion, CharacterVoice } from "@/src/intelligence/types";

export type SoulProfile = {
  voice: CharacterVoice;
  warmth: number;
  play: number;
  mysticism: number;
  directness: number;
};

export function soulFromVoice(voice: CharacterVoice = "warm"): SoulProfile {
  switch (voice) {
    case "playful":
      return { voice, warmth: 0.6, play: 0.9, mysticism: 0.2, directness: 0.5 };
    case "mystical":
      return { voice, warmth: 0.55, play: 0.25, mysticism: 0.95, directness: 0.35 };
    case "focused":
      return { voice, warmth: 0.4, play: 0.15, mysticism: 0.1, directness: 0.9 };
    case "chill":
      return { voice, warmth: 0.5, play: 0.35, mysticism: 0.2, directness: 0.45 };
    case "warm":
    default:
      return { voice: "warm", warmth: 0.85, play: 0.35, mysticism: 0.3, directness: 0.5 };
  }
}

export function emotionFromSoul(emotion: BuddyEmotion, soul: SoulProfile): BuddyEmotion {
  if (emotion === "exhausted" || emotion === "tired" || emotion === "heavy" || emotion === "lonely") {
    return emotion;
  }
  if (soul.play > 0.7 && (emotion === "neutral" || emotion === "warm")) return "playful";
  if (soul.mysticism > 0.7 && emotion === "neutral") return "warm";
  return emotion;
}

export function voicePrefix(soul: SoulProfile, companionName: string): string {
  const name = companionName.trim() || "Buddy";
  if (soul.mysticism > 0.7) return `${name} is listening.`;
  if (soul.play > 0.7) return `${name} here.`;
  if (soul.directness > 0.8) return "Okay.";
  return "";
}
