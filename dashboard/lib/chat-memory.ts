/**
 * Client-side structured chat memory — high-confidence candidates only.
 * User can list/delete; never invents facts.
 */

import { safeGetItem, safeSetItem } from "@/lib/client-storage";
import type { MemoryCandidate } from "@/src/intelligence/types";

const KEY = "buddie_structured_memories_v1";
const MAX = 40;

export function loadPersistedMemories(): MemoryCandidate[] {
  try {
    const raw = safeGetItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MemoryCandidate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) =>
        m &&
        typeof m.subject === "string" &&
        typeof m.fact === "string" &&
        typeof m.confidence === "number" &&
        m.confidence >= 0.82,
    );
  } catch {
    return [];
  }
}

export function persistMemoryCandidates(candidates: MemoryCandidate[]): MemoryCandidate[] {
  if (!candidates.length) return loadPersistedMemories();
  const existing = loadPersistedMemories();
  const next = [...existing];
  for (const c of candidates) {
    if (c.confidence < 0.82) continue;
    const dup = next.some(
      (e) =>
        e.subject.toLowerCase() === c.subject.toLowerCase() &&
        e.fact.toLowerCase().slice(0, 40) === c.fact.toLowerCase().slice(0, 40),
    );
    if (!dup) next.unshift(c);
  }
  const trimmed = next.slice(0, MAX);
  safeSetItem(KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function deletePersistedMemory(subjectAndFactPrefix: string): MemoryCandidate[] {
  const needle = subjectAndFactPrefix.toLowerCase().trim();
  const next = loadPersistedMemories().filter(
    (m) => !`${m.subject} ${m.fact}`.toLowerCase().includes(needle),
  );
  safeSetItem(KEY, JSON.stringify(next));
  return next;
}

export function clearPersistedMemories(): void {
  safeSetItem(KEY, "[]");
}
