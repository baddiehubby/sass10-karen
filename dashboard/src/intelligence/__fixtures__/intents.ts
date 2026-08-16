/**
 * Deterministic fixtures for intelligence engine tests.
 */

import type { IntelligenceInput, MemorySnippet } from "@/src/intelligence/types";

export const FIXTURE_MEMORIES: MemorySnippet[] = [
  { id: "m1", kind: "moment", text: "You mentioned a tough deadline last Tuesday." },
  { id: "m2", kind: "mood", text: "Feeling low after a long commute." },
  { id: "m3", kind: "note", text: "Wants to finish the study plan." },
];

export const INTENT_FIXTURES: Array<{ text: string; expectIntent: string }> = [
  { text: "hey buddy", expectIntent: "greeting" },
  { text: "goodbye", expectIntent: "farewell" },
  { text: "how are you", expectIntent: "emotional_checkin" },
  { text: "I feel so lonely tonight", expectIntent: "loneliness" },
  { text: "I'm really sad", expectIntent: "sadness" },
  { text: "I'm so frustrated with this", expectIntent: "frustration" },
  { text: "I'm so excited about tomorrow", expectIntent: "excitement" },
  { text: "I'm anxious about the meeting", expectIntent: "anxiety" },
  { text: "I'm bored", expectIntent: "boredom" },
  { text: "I finally got the job!", expectIntent: "celebration" },
  { text: "cheer me up please", expectIntent: "encouragement" },
  { text: "this morning I made coffee then left", expectIntent: "daily_routine" },
  { text: "my boss was harsh at work", expectIntent: "work" },
  { text: "I have an exam tomorrow", expectIntent: "study" },
  { text: "my partner and I argued", expectIntent: "relationships" },
  { text: "my mom called again", expectIntent: "family" },
  { text: "my best friend cancelled", expectIntent: "friendship" },
  { text: "I want to achieve my goals", expectIntent: "goals" },
  { text: "I can't start, no motivation", expectIntent: "motivation" },
  { text: "I've been reflecting on last year", expectIntent: "reflection" },
  { text: "thank you for listening", expectIntent: "gratitude" },
  { text: "", expectIntent: "silence" },
  { text: "yep", expectIntent: "short_answer" },
  { text: "what do you think?", expectIntent: "ask_opinion" },
  { text: "I don't know", expectIntent: "uncertainty" },
  { text: "I'm tired", expectIntent: "tired" },
  { text: "I'm fine", expectIntent: "im_fine" },
  { text: "remember when we talked about the deadline", expectIntent: "memory_reference" },
  { text: "[orb_touch]", expectIntent: "orb_touch" },
  { text: "why is the sky like that?", expectIntent: "follow_up" },
];

export function baseInput(overrides: Partial<IntelligenceInput> = {}): IntelligenceInput {
  return {
    userText: "hello",
    characterVoice: "warm",
    companionName: "Buddy",
    conversationDepth: 1,
    recentTurns: [],
    memoryContext: [],
    responseHistory: [],
    recentFamilies: [],
    seed: "fixture-seed-1",
    device: { online: true, reducedMotion: false, lowPower: false },
    ...overrides,
  };
}
