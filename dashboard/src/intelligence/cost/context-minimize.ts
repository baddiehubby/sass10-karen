/**
 * Context minimization — keep Soul Engine inputs small and local.
 * Never ship full history / raw dumps to a remote provider (none by default).
 */

import type { ConversationTurn, MemoryCandidate, MemorySnippet } from "@/src/intelligence/types";

export const CONTEXT_LIMITS = {
  MAX_RECENT_TURNS: 8,
  MAX_RESPONSE_HISTORY: 10,
  MAX_FAMILIES: 12,
  MAX_MEMORY_SNIPPETS: 3,
  MAX_PERSISTED_MEMORIES: 5,
  MAX_USER_TEXT_CHARS: 800,
  MAX_TURN_TEXT_CHARS: 280,
} as const;

export type MinimizedContext = {
  userText: string;
  recentTurns: ConversationTurn[];
  responseHistory: string[];
  recentFamilies: string[];
  memoryContext: MemorySnippet[];
  persistedMemories: MemoryCandidate[];
  /** Approximate chars kept after minimization (internal). */
  keptChars: number;
  droppedTurns: number;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Shrink conversation context for local composition.
 * Deterministic, $0, no model calls.
 */
export function minimizeIntelligenceContext(input: {
  userText: string;
  recentTurns?: ConversationTurn[];
  responseHistory?: string[];
  recentFamilies?: string[];
  memoryContext?: MemorySnippet[];
  persistedMemories?: MemoryCandidate[];
}): MinimizedContext {
  const userText = clip(input.userText ?? "", CONTEXT_LIMITS.MAX_USER_TEXT_CHARS);
  const turnsIn = input.recentTurns ?? [];
  const recentTurns = turnsIn.slice(-CONTEXT_LIMITS.MAX_RECENT_TURNS).map((t) => ({
    ...t,
    text: clip(t.text ?? "", CONTEXT_LIMITS.MAX_TURN_TEXT_CHARS),
  }));
  const responseHistory = (input.responseHistory ?? [])
    .slice(-CONTEXT_LIMITS.MAX_RESPONSE_HISTORY)
    .map((s) => clip(s, CONTEXT_LIMITS.MAX_TURN_TEXT_CHARS));
  const recentFamilies = (input.recentFamilies ?? []).slice(-CONTEXT_LIMITS.MAX_FAMILIES);
  const memoryContext = (input.memoryContext ?? []).slice(0, CONTEXT_LIMITS.MAX_MEMORY_SNIPPETS);
  const persistedMemories = (input.persistedMemories ?? [])
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, CONTEXT_LIMITS.MAX_PERSISTED_MEMORIES);

  const keptChars =
    userText.length +
    recentTurns.reduce((n, t) => n + t.text.length, 0) +
    responseHistory.reduce((n, s) => n + s.length, 0) +
    memoryContext.reduce((n, m) => n + (m.text?.length ?? 0), 0) +
    persistedMemories.reduce((n, m) => n + m.fact.length, 0);

  return {
    userText,
    recentTurns,
    responseHistory,
    recentFamilies,
    memoryContext,
    persistedMemories,
    keptChars,
    droppedTurns: Math.max(0, turnsIn.length - recentTurns.length),
  };
}
