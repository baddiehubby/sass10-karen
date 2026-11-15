/**
 * Karen session memory — promises, excuses, answers, probe bank, scorecard.
 *
 * Adapts interview-my-project Phase 4–5 (requeue weaks + scorecard readiness)
 * to an injectable store. No production DB wiring in Stage 1.
 */

import {
  createEmptyInterviewState,
  emptyScorecard,
  type KarenFactSource,
  type KarenInterviewState,
  type KarenIntensity,
  type KarenLifeFact,
  type KarenLifeFactKind,
  type KarenLadderRung,
  type KarenMood,
  type KarenProbeCategory,
  type KarenProbeQuestion,
  type KarenSessionRecord,
  type KarenTurnRecord,
  type KarenVerdict,
} from "@/lib/karen/interview/types";

const MAX_TURNS = 40;
const MAX_FACTS = 120;

export type KarenSessionStore = {
  get(userId: string): Promise<KarenInterviewState | null>;
  set(state: KarenInterviewState): Promise<void>;
};

/** Deterministic in-memory store for unit tests and local Stage 1 use. */
export function createMemoryKarenSessionStore(): KarenSessionStore & {
  clear(): void;
  snapshot(): Map<string, KarenInterviewState>;
} {
  const map = new Map<string, KarenInterviewState>();
  return {
    async get(userId) {
      const row = map.get(userId);
      return row ? cloneState(row) : null;
    },
    async set(state) {
      map.set(state.userId, cloneState(state));
    },
    clear() {
      map.clear();
    },
    snapshot() {
      return new Map([...map.entries()].map(([k, v]) => [k, cloneState(v)]));
    },
  };
}

function cloneState(state: KarenInterviewState): KarenInterviewState {
  return JSON.parse(JSON.stringify(state)) as KarenInterviewState;
}

export function normalizeFactKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function verdictRank(v: KarenVerdict): number {
  if (v === "solid") return 3;
  if (v === "shaky") return 2;
  return 1;
}

export function betterVerdict(a: KarenVerdict | null, b: KarenVerdict): KarenVerdict {
  if (!a) return b;
  return verdictRank(b) > verdictRank(a) ? b : a;
}

/**
 * readiness = rankScore-weighted % of bank whose bestScore is solid.
 * Matches reference scorecard math; empty bank → 0.
 */
export function computeReadiness(questions: KarenProbeQuestion[]): number {
  if (!questions.length) return 0;
  const weightTotal = questions.reduce((sum, q) => sum + Math.max(1, q.rankScore), 0);
  if (weightTotal <= 0) return 0;
  const solidWeight = questions
    .filter((q) => q.bestScore === "solid")
    .reduce((sum, q) => sum + Math.max(1, q.rankScore), 0);
  return Math.round((100 * solidWeight) / weightTotal);
}

export function formatTrend(previous: number | null, next: number): string {
  if (previous === null) return "first session";
  const delta = next - previous;
  if (delta === 0) return "±0 vs last session";
  return `${delta > 0 ? "+" : ""}${delta} vs last session`;
}

export async function loadOrCreateInterviewState(
  store: KarenSessionStore,
  userId: string,
  now = new Date(),
): Promise<KarenInterviewState> {
  const existing = await store.get(userId);
  if (existing) return existing;
  const fresh = createEmptyInterviewState(userId, now);
  await store.set(fresh);
  return fresh;
}

export async function saveInterviewState(
  store: KarenSessionStore,
  state: KarenInterviewState,
  now = new Date(),
): Promise<KarenInterviewState> {
  const next = { ...state, updatedAt: now.toISOString() };
  await store.set(next);
  return next;
}

export function setIntensity(state: KarenInterviewState, intensity: KarenIntensity): KarenInterviewState {
  return { ...state, intensity };
}

export function setLastMood(state: KarenInterviewState, mood: KarenMood): KarenInterviewState {
  return { ...state, lastMood: mood };
}

export function replaceQuestionBank(
  state: KarenInterviewState,
  questions: KarenProbeQuestion[],
): KarenInterviewState {
  return { ...state, questions: questions.map((q) => ({ ...q })) };
}

/**
 * After a verdict: bump timesAsked, set bestScore, mark asked.
 * Reference: update questions.json after every verdict.
 */
export function applyVerdictToQuestion(
  state: KarenInterviewState,
  questionId: string,
  verdict: KarenVerdict,
): KarenInterviewState {
  const questions = state.questions.map((q) => {
    if (q.id !== questionId) return q;
    return {
      ...q,
      status: "asked" as const,
      timesAsked: q.timesAsked + 1,
      bestScore: betterVerdict(q.bestScore, verdict),
    };
  });
  return { ...state, questions };
}

/**
 * Phase 4 debrief: every shaky/failed → requeued so they lead next session.
 */
export function requeueWeakQuestions(state: KarenInterviewState): KarenInterviewState {
  const questions = state.questions.map((q) => {
    if (q.bestScore === "shaky" || q.bestScore === "failed") {
      return { ...q, status: "requeued" as const };
    }
    return q;
  });
  return { ...state, questions };
}

/** Requeued weaks first, then by rankScore desc — reference ranking rule. */
export function orderedQuestionsForSession(state: KarenInterviewState): KarenProbeQuestion[] {
  const requeued = state.questions.filter((q) => q.status === "requeued");
  const rest = state.questions.filter((q) => q.status !== "requeued");
  const byRank = (a: KarenProbeQuestion, b: KarenProbeQuestion) => b.rankScore - a.rankScore;
  return [...requeued.sort(byRank), ...rest.sort(byRank)];
}

export function appendSession(
  state: KarenInterviewState,
  session: Omit<KarenSessionRecord, "date"> & { date?: string },
  now = new Date(),
): KarenInterviewState {
  const previousReadiness = state.scorecard.sessions.length ? state.scorecard.readiness : null;
  const readiness = computeReadiness(state.questions);
  const record: KarenSessionRecord = {
    date: session.date ?? now.toISOString(),
    mode: session.mode,
    asked: session.asked,
    completed: session.completed,
    solid: session.solid,
    shaky: session.shaky,
    failed: session.failed,
    weakAreas: [...session.weakAreas],
  };
  const scorecard = {
    ...(state.scorecard.schemaVersion ? state.scorecard : emptyScorecard()),
    sessions: [...state.scorecard.sessions, record],
    readiness,
    trend: formatTrend(previousReadiness, readiness),
  };
  return { ...state, scorecard };
}

export function recordTurn(
  state: KarenInterviewState,
  turn: Omit<KarenTurnRecord, "at"> & { at?: string },
  now = new Date(),
): KarenInterviewState {
  const row: KarenTurnRecord = {
    at: turn.at ?? now.toISOString(),
    role: turn.role,
    text: turn.text,
    questionId: turn.questionId,
    rung: turn.rung,
    verdict: turn.verdict,
    mood: turn.mood,
  };
  const recentTurns = [...state.recentTurns, row].slice(-MAX_TURNS);
  return {
    ...state,
    recentTurns,
    lastMood: turn.mood ?? state.lastMood,
    activeQuestionId: turn.questionId ?? state.activeQuestionId,
    activeRung: turn.rung ?? state.activeRung,
  };
}

export function setActiveProbe(
  state: KarenInterviewState,
  questionId: string | null,
  rung: KarenLadderRung | null,
): KarenInterviewState {
  return { ...state, activeQuestionId: questionId, activeRung: rung };
}

export function recordLifeFact(
  state: KarenInterviewState,
  input: {
    kind: KarenLifeFactKind;
    text: string;
    key?: string;
    relatedQuestionId?: string;
    metadata?: Record<string, string>;
    at?: string;
    source?: KarenFactSource;
    relevance?: number;
  },
  now = new Date(),
): KarenInterviewState {
  const at = input.at ?? now.toISOString();
  const key = input.key ?? normalizeFactKey(input.text);
  if (!key) return state;
  const source = input.source ?? "user_utterance";
  const relevance = clampRelevance(input.relevance ?? (source === "user_utterance" ? 1 : 0.7));

  const existingIdx = state.facts.findIndex((f) => f.kind === input.kind && f.key === key);
  let facts: KarenLifeFact[];
  if (existingIdx >= 0) {
    facts = state.facts.map((f, i) =>
      i === existingIdx
        ? {
            ...f,
            text: input.text,
            timesSeen: f.timesSeen + 1,
            lastSeenAt: at,
            relatedQuestionId: input.relatedQuestionId ?? f.relatedQuestionId,
            metadata: input.metadata ? { ...f.metadata, ...input.metadata } : f.metadata,
            source: source ?? f.source,
            relevance: Math.max(f.relevance ?? 0, relevance),
          }
        : f,
    );
  } else {
    const row: KarenLifeFact = {
      id: `fact_${input.kind}_${key.slice(0, 24)}_${state.facts.length + 1}`,
      kind: input.kind,
      text: input.text,
      key,
      createdAt: at,
      timesSeen: 1,
      lastSeenAt: at,
      relatedQuestionId: input.relatedQuestionId,
      metadata: input.metadata,
      source,
      relevance,
    };
    facts = [row, ...state.facts].slice(0, MAX_FACTS);
  }
  return { ...state, facts: decayFactRelevance(facts, now) };
}

function clampRelevance(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Soft-decay relevance by age; never deletes historical facts. */
export function decayFactRelevance(facts: KarenLifeFact[], now = new Date()): KarenLifeFact[] {
  const nowMs = now.getTime();
  return facts.map((f) => {
    const ageMs = Math.max(0, nowMs - Date.parse(f.lastSeenAt || f.createdAt));
    const ageHours = ageMs / (1000 * 60 * 60);
    const decay = ageHours <= 0.01 ? 0 : Math.min(0.5, ageHours / 48);
    const base = f.relevance ?? (f.source === "user_utterance" ? 0.9 : 0.6);
    return { ...f, relevance: clampRelevance(base - decay) };
  });
}

/**
 * Latest relevant excuse for delivery — historical excuses remain in memory
 * but are not presented as "the" current excuse when fresher ones exist.
 */
export function selectLatestRelevantExcuse(
  facts: KarenLifeFact[],
  now = new Date(),
): KarenLifeFact | null {
  const excuses = decayFactRelevance(
    facts.filter((f) => f.kind === "excuse"),
    now,
  );
  if (!excuses.length) return null;
  const ranked = [...excuses].sort((a, b) => {
    const rel = (b.relevance ?? 0) - (a.relevance ?? 0);
    if (rel !== 0) return rel;
    return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
  });
  const top = ranked[0]!;
  // Prefer recent user utterances over stale seeds.
  if ((top.relevance ?? 0) < 0.35 && top.source === "seed") {
    const live = ranked.find((e) => e.source === "user_utterance" && (e.relevance ?? 0) >= 0.35);
    return live ?? top;
  }
  return top;
}

export function factsOfKind(state: KarenInterviewState, kind: KarenLifeFactKind): KarenLifeFact[] {
  return state.facts.filter((f) => f.kind === kind);
}

export function findRepeatedExcuse(
  state: KarenInterviewState,
  excuseText: string,
  minTimes = 2,
): KarenLifeFact | null {
  const key = normalizeFactKey(excuseText);
  const hit = state.facts.find((f) => f.kind === "excuse" && f.key === key && f.timesSeen >= minTimes);
  return hit ?? null;
}

export function openPromises(state: KarenInterviewState): KarenLifeFact[] {
  const completedKeys = new Set(factsOfKind(state, "completion").map((f) => f.key));
  return factsOfKind(state, "promise").filter((p) => !completedKeys.has(p.key));
}

export function weakCategoriesFromBank(questions: KarenProbeQuestion[]): KarenProbeCategory[] {
  const cats = new Set<KarenProbeCategory>();
  for (const q of questions) {
    if (q.bestScore === "shaky" || q.bestScore === "failed") cats.add(q.category);
  }
  return [...cats];
}
