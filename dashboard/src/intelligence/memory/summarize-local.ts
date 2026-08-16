/**
 * Local memory summarization — compress fallible memories without any model spend.
 * Never invents new facts; only compresses / ranks existing structured candidates.
 */

import type { MemoryCandidate } from "@/src/intelligence/types";
import { MEMORY_PERSIST_THRESHOLD } from "@/src/intelligence/memory";

export type LocalMemorySummary = {
  /** One-line rollup for composer context (not user-facing infra). */
  rollup: string;
  /** Highest-confidence memories retained for citation. */
  retained: MemoryCandidate[];
  compressedCount: number;
  /** Always false — summarization is heuristic, not inference. */
  usedExternalInference: false;
};

const MAX_RETAINED = 5;
const MAX_ROLLUP_CHARS = 180;

/**
 * Summarize persisted memories locally for context minimization.
 */
export function summarizeMemoriesLocally(
  memories: MemoryCandidate[],
  opts?: { topicHint?: string; limit?: number },
): LocalMemorySummary {
  const limit = opts?.limit ?? MAX_RETAINED;
  const topic = (opts?.topicHint ?? "").toLowerCase();

  const eligible = memories
    .filter((m) => m.confidence >= MEMORY_PERSIST_THRESHOLD * 0.9)
    .map((m) => ({
      m,
      score:
        m.confidence * 0.7 +
        m.relevance * 0.3 +
        (topic && (m.topic.toLowerCase().includes(topic) || m.subject.toLowerCase().includes(topic))
          ? 0.15
          : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const retained = eligible.slice(0, limit).map((x) => x.m);
  const compressedCount = Math.max(0, memories.length - retained.length);

  if (!retained.length) {
    return {
      rollup: "",
      retained: [],
      compressedCount: memories.length,
      usedExternalInference: false,
    };
  }

  const parts = retained.map((m) => {
    const fact = m.fact.length > 48 ? `${m.fact.slice(0, 45)}…` : m.fact;
    return `${m.subject}: ${fact}`;
  });
  let rollup = parts.join(" · ");
  if (rollup.length > MAX_ROLLUP_CHARS) {
    rollup = `${rollup.slice(0, MAX_ROLLUP_CHARS - 1)}…`;
  }

  return {
    rollup,
    retained,
    compressedCount,
    usedExternalInference: false,
  };
}
