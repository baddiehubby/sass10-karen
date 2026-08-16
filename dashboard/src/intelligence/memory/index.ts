/**
 * Structured memory candidates — never invent; only persist high confidence.
 * Memories are fallible context, not absolute truth.
 */

import type { EntityFrame, MemoryCandidate, MemoryCategory, MemorySnippet } from "@/src/intelligence/types";

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

/**
 * Soft citation — never "you definitely…".
 * Only cite when mayCite is true and a persisted candidate exists.
 */
export function memoryHintLine(persisted: MemoryCandidate[], mayCite: boolean): string | null {
  if (!mayCite || !persisted.length) return null;
  const m = persisted[0]!;
  const fact = m.fact.length > 72 ? `${m.fact.slice(0, 69)}…` : m.fact;
  const softFact = fact.replace(/^User('s| mentioned)?\s*/i, "").replace(/^user\s+/i, "");
  return `I remember you mentioned ${m.subject} — ${softFact}`;
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
  const lower = t.toLowerCase();

  // Never store empty / pure punctuation / sarcasm-only hedges as facts
  if (!t || /^[.…!?]+$/.test(t) || t.length < 4) {
    return { persist: [], reject: [] };
  }

  if (entity.subject && entity.concern) {
    candidates.push(
      candidate({
        category: "relationship",
        subject: entity.subject,
        relationship: entity.relationship,
        topic: entity.secondaryTopic ?? topic,
        fact: `${entity.subject} may be going through difficulties; user is concerned`,
        confidence: entity.subject === "sister" && /husband|partner|wife/.test(lower) ? 0.9 : 0.78,
        relevance: 0.86,
        createdAt,
      }),
    );
  }

  const job = t.match(/\b(?:i (?:got|have|started) (?:a |the )?([\w\s]{2,24}) job)\b/i);
  if (job?.[1]) {
    candidates.push(
      candidate({
        category: "work",
        subject: "user",
        relationship: null,
        topic: "work",
        fact: `got a ${job[1].trim()} job`,
        confidence: 0.86,
        relevance: 0.84,
        createdAt,
      }),
    );
  }

  const name = t.match(/\bmy name is ([a-z]{2,20})\b/i);
  if (name?.[1]) {
    candidates.push(
      candidate({
        category: "self",
        subject: "user",
        relationship: null,
        topic: "self",
        fact: `name is ${name[1]}`,
        confidence: 0.92,
        relevance: 0.9,
        createdAt,
      }),
    );
  }

  const goal = t.match(/\b(?:my goal is|i want to|i'?m trying to)\s+(.{4,48})[.!?]?\s*$/i);
  if (goal?.[1] && !/maybe|might|not sure/i.test(goal[1])) {
    candidates.push(
      candidate({
        category: "goal",
        subject: "user",
        relationship: null,
        topic: "goals",
        fact: `working toward: ${goal[1].trim().replace(/\.$/, "")}`,
        confidence: 0.84,
        relevance: 0.8,
        createdAt,
      }),
    );
  }

  const pet = t.match(/\bmy (dog|cat|pet)\s+(?:is named |named )?([a-z]{2,16})\b/i);
  if (pet?.[1] && pet[2]) {
    candidates.push(
      candidate({
        category: "other",
        subject: pet[2],
        relationship: "pet",
        topic: "self",
        fact: `has a ${pet[1]} named ${pet[2]}`,
        confidence: 0.88,
        relevance: 0.75,
        createdAt,
      }),
    );
  }

  // Ambiguous soft inference — reject (do not persist)
  if (/maybe|might|not sure|i think|perhaps|could be|i guess/i.test(lower) && candidates.length) {
    for (const c of candidates) {
      c.confidence = Math.min(c.confidence, 0.55);
      c.relevance = Math.min(c.relevance, 0.5);
    }
  }

  // Sarcasm / joke markers — downrank
  if (/\bsarcasm\b|just kidding|jk\b|lol not really/i.test(lower)) {
    for (const c of candidates) c.confidence = Math.min(c.confidence, 0.4);
  }

  // Never store raw regex / empty; never invent sensitive attributes
  const cleaned = candidates.filter(
    (c) =>
      c.fact.length >= 8 &&
      c.subject.length >= 2 &&
      !/race|religion|sexual|disability|diagnosis/i.test(c.fact),
  );

  const persist = cleaned.filter((c) => c.confidence >= MEMORY_PERSIST_THRESHOLD);
  const reject = cleaned.filter((c) => c.confidence < MEMORY_PERSIST_THRESHOLD);
  return { persist, reject };
}

function candidate(
  partial: Omit<MemoryCandidate, "source"> & { source?: MemoryCandidate["source"] },
): MemoryCandidate {
  return {
    ...partial,
    source: "user_statement",
  };
}

export function memoryCategoryFromTopic(topic: string): MemoryCategory {
  const t = topic.trim().toLowerCase();
  if (t === "work") return "work";
  if (t === "study") return "study";
  if (t === "goals") return "goal";
  if (t === "family" || t === "relationships" || t === "friendship") return "relationship";
  if (t === "self") return "self";
  return "other";
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
