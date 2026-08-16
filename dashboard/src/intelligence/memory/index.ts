/**
 * Structured memory candidates — never invent; only persist high confidence.
 */

import type { EntityFrame, MemoryCandidate, MemorySnippet } from "@/src/intelligence/types";

export const MEMORY_PERSIST_THRESHOLD = 0.82;

export function selectMemoryContext(
  snippets: MemorySnippet[] = [],
  userText: string,
  limit = 3,
): MemorySnippet[] {
  if (!snippets.length) return [];
  const tokens = tokenize(userText);
  const scored = snippets.map((s) => ({
    s,
    score: overlap(tokens, tokenize(s.text)) + (s.kind === "moment" ? 0.2 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((r) => r.score > 0).slice(0, limit).map((r) => r.s);
  if (top.length) return top;
  return snippets.slice(0, Math.min(limit, 1));
}

/** Only cite memories that actually exist in persisted set. */
export function memoryHintLine(
  persisted: MemoryCandidate[],
  mayCite: boolean,
): string | null {
  if (!mayCite || !persisted.length) return null;
  const m = persisted[0]!;
  const fact = m.fact.length > 64 ? `${m.fact.slice(0, 61)}…` : m.fact;
  return `That note about ${m.subject} is still with me — ${fact}`;
}

export function extractMemoryCandidates(input: {
  userText: string;
  entity: EntityFrame;
  topic: string;
  intent: string;
  createdAt?: string;
}): { persist: MemoryCandidate[]; reject: MemoryCandidate[] } {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const candidates: MemoryCandidate[] = [];
  const { entity, userText, topic } = input;
  const t = userText.trim();

  if (entity.subject && entity.concern) {
    candidates.push({
      subject: entity.subject,
      relationship: entity.relationship,
      topic: entity.secondaryTopic ?? topic,
      fact: `${entity.subject} is going through something; user is concerned / supporting`,
      confidence: entity.subject === "sister" && /husband|partner|wife/.test(t.toLowerCase()) ? 0.9 : 0.78,
      source: "user_statement",
      createdAt,
    });
  }

  // Explicit self-facts with clear subject
  const job = t.match(/\b(?:i (?:got|have|started) (?:a |the )?([\w\s]{2,24}) job)\b/i);
  if (job?.[1]) {
    candidates.push({
      subject: "user",
      relationship: null,
      topic: "work",
      fact: `User mentioned a job: ${job[1].trim()}`,
      confidence: 0.86,
      source: "user_statement",
      createdAt,
    });
  }

  const name = t.match(/\bmy name is ([a-z]{2,20})\b/i);
  if (name?.[1]) {
    candidates.push({
      subject: "user",
      relationship: null,
      topic: "self",
      fact: `User's name is ${name[1]}`,
      confidence: 0.92,
      source: "user_statement",
      createdAt,
    });
  }

  // Ambiguous soft inference — reject
  if (/maybe|might|not sure|i think|perhaps/i.test(t) && candidates.length) {
    for (const c of candidates) c.confidence = Math.min(c.confidence, 0.55);
  }

  // Never store raw regex / empty
  const cleaned = candidates.filter((c) => c.fact.length >= 8 && c.subject.length >= 2);

  const persist = cleaned.filter((c) => c.confidence >= MEMORY_PERSIST_THRESHOLD);
  const reject = cleaned.filter((c) => c.confidence < MEMORY_PERSIST_THRESHOLD);
  return { persist, reject };
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}
