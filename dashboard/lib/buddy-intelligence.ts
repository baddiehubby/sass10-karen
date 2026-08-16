/**
 * Thin app facade over the $0 local intelligence engine.
 */

import { runSoulEngine } from "@/src/intelligence";
import type { CharacterVoice, ComposedReply, MemorySnippet } from "@/src/intelligence";
import type { BuddyMood } from "@/lib/companion-mood";

const MOOD_UTTERANCE: Record<BuddyMood, string> = {
  neutral: "I'm feeling meh",
  calm: "I'm feeling calm today",
  happy: "I'm happy right now",
  excited: "I'm so excited",
  sad: "I'm really sad",
  anxious: "I'm anxious",
  angry: "I'm so frustrated",
  tired: "I'm tired",
  lonely: "I feel lonely",
  hopeful: "I'm feeling hopeful",
  curious: "I'm curious about things",
  loving: "I'm feeling loving and warm",
  playful: "I'm in a playful mood",
};

export function buddyReplyToText(input: {
  text: string;
  voice?: CharacterVoice;
  name?: string;
  depth?: number;
  memory?: MemorySnippet[];
  history?: string[];
  families?: string[];
  seed?: string;
}): ComposedReply {
  return runSoulEngine({
    userText: input.text,
    characterVoice: input.voice ?? "warm",
    companionName: input.name ?? "Buddy",
    conversationDepth: input.depth ?? 1,
    memoryContext: input.memory ?? [],
    responseHistory: input.history ?? [],
    recentFamilies: input.families ?? [],
    seed: input.seed,
  });
}

/** Mood check-in line composed by local intelligence (not an LLM). */
export function intelligentCheckInReply(mood: BuddyMood, seed?: string): string {
  return buddyReplyToText({
    text: MOOD_UTTERANCE[mood] ?? "I'm checking in",
    seed: seed ?? `mood:${mood}`,
    depth: 1,
  }).text;
}
