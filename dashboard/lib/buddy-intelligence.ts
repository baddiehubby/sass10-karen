/**
 * Thin app facade over the $0 local intelligence engine.
 * All replies go through cost-aware routing (Soul Engine first; never avoidable remote spend).
 */

import {
  clearPersistedMemories,
  deletePersistedMemory,
  loadPersistedMemories,
  persistMemoryCandidates,
} from "@/lib/chat-memory";
import { resolveIntelligence } from "@/src/intelligence/cost";
import { isMemoryForgetRequest } from "@/src/intelligence/conversation-state";
import type {
  CharacterVoice,
  ComposedReply,
  ConversationMachineState,
  ConversationTurn,
  IntelligenceResult,
  MemorySnippet,
} from "@/src/intelligence";
import type { CostAwareResult } from "@/src/intelligence/cost";
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

export type BuddyReplyOptions = {
  text: string;
  voice?: CharacterVoice;
  name?: string;
  depth?: number;
  memory?: MemorySnippet[];
  history?: string[];
  families?: string[];
  recentTurns?: ConversationTurn[];
  previousMachine?: ConversationMachineState;
  seed?: string;
  /** When true, high-confidence candidates are written to client memory store. */
  persistMemories?: boolean;
  /** User/session scope for cache + abuse — never a shared global key. */
  userScope?: string;
  clientIp?: string | null;
};

export function buddyReplyToText(input: BuddyReplyOptions): ComposedReply {
  return buddyReplyFull(input);
}

/** Full result including machine + memory candidates + cost metadata (internal). */
export function buddyReplyFull(input: BuddyReplyOptions): CostAwareResult {
  const persisted = loadPersistedMemories();
  const result = resolveIntelligence({
    userText: input.text,
    characterVoice: input.voice ?? "warm",
    companionName: input.name ?? "Buddy",
    conversationDepth: input.depth ?? 1,
    memoryContext: input.memory ?? [],
    persistedMemories: persisted,
    responseHistory: input.history ?? [],
    recentFamilies: input.families ?? [],
    recentTurns: input.recentTurns,
    previousMachine: input.previousMachine,
    seed: input.seed,
    userScope: input.userScope ?? "session:local",
    clientIp: input.clientIp,
  });

  applyMemorySideEffects(input, result);
  return result;
}

function applyMemorySideEffects(input: BuddyReplyOptions, result: IntelligenceResult): void {
  if (input.persistMemories === false) return;
  if (isMemoryForgetRequest(input.text)) {
    const subject = result.routed.entity.subject;
    if (subject) deletePersistedMemory(subject);
    else clearPersistedMemories();
    return;
  }
  if (result.memoryToPersist.length) {
    persistMemoryCandidates(result.memoryToPersist);
  }
}

/** Mood check-in line composed by local intelligence (not an LLM). */
export function intelligentCheckInReply(mood: BuddyMood, seed?: string): string {
  return buddyReplyToText({
    text: MOOD_UTTERANCE[mood] ?? "I'm checking in",
    seed: seed ?? `mood:${mood}`,
    depth: 1,
    persistMemories: false,
    userScope: "session:mood-checkin",
  }).text;
}
