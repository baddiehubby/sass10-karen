import { BUDDY_MOODS, type BuddyMood } from "@/lib/companion-mood";
import type { BuddyMood as PresenceMood } from "@/lib/mood-detection";
import { runSoulEngine } from "@/src/intelligence/soul-engine/run";
import type { BuddyEmotion, CharacterVoice, ComposedReply } from "@/src/intelligence/types";

const MAX_MEDIA_FIELD = 280;
const MAX_MEDIA_CONTEXT = 420;

export type CompanionReactionInput =
  | { source: "explicit_mood"; mood: BuddyMood }
  | { source: "media"; text?: string; title?: string };

export type CompanionReaction = {
  text: string;
  orbCue: ComposedReply["orbCue"];
  mood: BuddyMood;
  emotion: BuddyMood;
  confidence: number;
  confidenceBand: "high" | "low";
  basis: "user-stated-mood" | "shared-media-context";
  source: "explicit_mood" | "media";
  timestamp: string;
  disclaimer: string;
};

export function hasPaidCompanionReactionAccess(entitlement: {
  hasPaidAccess: boolean;
} | null | undefined): boolean {
  return entitlement?.hasPaidAccess === true;
}

export function presenceMoodFromReaction(mood: BuddyMood): PresenceMood {
  if (mood === "happy" || mood === "excited" || mood === "neutral") return mood;
  if (mood === "tired") return "sleepy";
  if (mood === "curious") return "thinking";
  if (mood === "sad" || mood === "anxious" || mood === "angry" || mood === "lonely") {
    return "concerned";
  }
  return "happy";
}

const MOOD_TEXT: Record<BuddyMood, string> = {
  neutral: "I'm feeling neutral",
  calm: "I'm feeling calm",
  happy: "I'm feeling happy",
  excited: "I'm feeling excited",
  sad: "I'm feeling sad",
  anxious: "I'm feeling anxious",
  angry: "I'm feeling frustrated",
  tired: "I'm feeling tired",
  lonely: "I'm feeling lonely",
  hopeful: "I'm feeling hopeful",
  curious: "I'm feeling curious",
  loving: "I'm feeling loving",
  playful: "I'm feeling playful",
};

function sanitizeEphemeral(value: string | undefined, max = MAX_MEDIA_FIELD): string {
  return (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function ephemeralMediaContext(input: { text?: string; title?: string }): string {
  const title = sanitizeEphemeral(input.title);
  const text = sanitizeEphemeral(input.text);
  return [title ? `Media title: ${title}` : "", text ? `Shared media text: ${text}` : ""]
    .filter(Boolean)
    .join(". ")
    .slice(0, MAX_MEDIA_CONTEXT);
}

function moodFromEmotion(emotion: BuddyEmotion): BuddyMood {
  const map: Record<BuddyEmotion, BuddyMood> = {
    neutral: "neutral",
    low: "sad",
    heavy: "sad",
    anxious: "anxious",
    frustrated: "angry",
    excited: "excited",
    warm: "loving",
    tired: "tired",
    bored: "neutral",
    grateful: "happy",
    lonely: "lonely",
    playful: "playful",
    exhausted: "tired",
    calm: "calm",
    curious: "curious",
  };
  return map[emotion] ?? "neutral";
}

/**
 * Ephemeral server composition. It calls the local Soul Engine directly:
 * no Oracle, remote inference, memory loading, persistence, or logging.
 */
export function buildCompanionReaction(
  input: CompanionReactionInput,
  options?: {
    companionName?: string;
    voice?: CharacterVoice;
    seed?: string;
    now?: Date;
  },
): CompanionReaction {
  const explicit = input.source === "explicit_mood";
  const userText = explicit ? MOOD_TEXT[input.mood] : ephemeralMediaContext(input);
  if (!userText) throw new Error("Shared media context is empty");

  const result = runSoulEngine({
    userText,
    companionName: options?.companionName ?? "Buddy",
    characterVoice: options?.voice ?? "warm",
    conversationDepth: 1,
    seed: options?.seed ?? `companion-reaction:${explicit ? input.mood : "media"}`,
    persistedMemories: [],
    memoryContext: [],
    recentTurns: [],
  });

  const mood = explicit ? input.mood : moodFromEmotion(result.emotion);
  return {
    text: result.text,
    orbCue: result.orbCue,
    mood,
    emotion: mood,
    confidence: explicit ? 0.98 : Math.min(0.4, Math.max(0.18, result.confidence * 0.45)),
    confidenceBand: explicit ? "high" : "low",
    basis: explicit ? "user-stated-mood" : "shared-media-context",
    source: input.source,
    timestamp: (options?.now ?? new Date()).toISOString(),
    disclaimer: explicit
      ? "Based on the mood you chose; this is companion support, not a clinical assessment."
      : "A light interpretation of media you voluntarily shared—not a reading of your feelings or a clinical assessment.",
  };
}

export function isCompanionMood(value: string): value is BuddyMood {
  return (BUDDY_MOODS as readonly string[]).includes(value);
}
