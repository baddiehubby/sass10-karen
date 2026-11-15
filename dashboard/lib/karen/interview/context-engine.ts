/**
 * Karen context engine — bounded life-context ingestion.
 *
 * Adapts interview-my-project Phase 1 (silent ingest → dossier) to session facts.
 * Never invents personal facts. Assumptions are not confirmed memories.
 */

import {
  decayFactRelevance,
  factsOfKind,
  openPromises,
  selectLatestRelevantExcuse,
} from "@/lib/karen/interview/session-memory";
import type {
  KarenInterviewState,
  KarenLifeFact,
  KarenProbeCategory,
} from "@/lib/karen/interview/types";

export const KAREN_PROBE_CATEGORIES: readonly KarenProbeCategory[] = [
  "commitment",
  "tradeoff",
  "failure_mode",
  "habit_ceiling",
  "day_flow",
  "avoidance",
  "glossed_struggle",
  "excuse_pattern",
  "value_skepticism",
] as const;

export type KarenLifeContext = {
  userId: string;
  generatedAt: string;
  /** Confirmed open promises only (not completed). */
  openPromises: KarenLifeFact[];
  completions: KarenLifeFact[];
  avoidances: KarenLifeFact[];
  excuses: KarenLifeFact[];
  /** Excuses already seen 2+ times — highest signal. */
  repeatedExcuses: KarenLifeFact[];
  /** Single most relevant recent excuse for delivery (historical retained in excuses). */
  latestRelevantExcuse: KarenLifeFact | null;
  goals: KarenLifeFact[];
  dailyProgress: KarenLifeFact[];
  /** Prior answers stored as facts — not inferred from chatter. */
  recentAnswers: KarenLifeFact[];
  /** Raw recent user lines for steering only — not confirmed facts. */
  recentUserUtterances: string[];
  /** How many confirmed facts support each category (0 = no evidence). */
  categoryEvidence: Record<KarenProbeCategory, number>;
  /** True when there are no confirmed life facts to probe. */
  thinContext: boolean;
  /** Invariant: this dossier never adds invented personal claims. */
  inventedNothing: true;
};

function emptyCategoryEvidence(): Record<KarenProbeCategory, number> {
  return {
    commitment: 0,
    tradeoff: 0,
    failure_mode: 0,
    habit_ceiling: 0,
    day_flow: 0,
    avoidance: 0,
    glossed_struggle: 0,
    excuse_pattern: 0,
    value_skepticism: 0,
  };
}

/**
 * Build a life-context dossier from existing session state only.
 * Does not write facts. Does not invent promises, goals, or excuses.
 */
export function ingestLifeContext(
  state: KarenInterviewState,
  now = new Date(),
): KarenLifeContext {
  const open = openPromises(state);
  const completions = factsOfKind(state, "completion");
  const avoidances = factsOfKind(state, "avoidance");
  const excuses = decayFactRelevance(factsOfKind(state, "excuse"), now);
  const repeatedExcuses = excuses.filter((f) => f.timesSeen >= 2);
  const latestRelevantExcuse = selectLatestRelevantExcuse(state.facts, now);
  const goals = factsOfKind(state, "goal");
  const dailyProgress = factsOfKind(state, "daily_progress");
  const recentAnswers = factsOfKind(state, "answer");

  const recentUserUtterances = state.recentTurns
    .filter((t) => t.role === "user")
    .slice(-8)
    .map((t) => t.text);

  const categoryEvidence = scoreCategoryEvidence({
    open,
    completions,
    avoidances,
    excuses,
    repeatedExcuses,
    goals,
    dailyProgress,
    recentAnswers,
  });

  const confirmedCount =
    open.length +
    completions.length +
    avoidances.length +
    excuses.length +
    goals.length +
    dailyProgress.length +
    recentAnswers.length;

  return {
    userId: state.userId,
    generatedAt: now.toISOString(),
    openPromises: open.map(cloneFact),
    completions: completions.map(cloneFact),
    avoidances: avoidances.map(cloneFact),
    excuses: excuses.map(cloneFact),
    repeatedExcuses: repeatedExcuses.map(cloneFact),
    latestRelevantExcuse: latestRelevantExcuse ? cloneFact(latestRelevantExcuse) : null,
    goals: goals.map(cloneFact),
    dailyProgress: dailyProgress.map(cloneFact),
    recentAnswers: recentAnswers.map(cloneFact),
    recentUserUtterances,
    categoryEvidence,
    thinContext: confirmedCount === 0,
    inventedNothing: true,
  };
}

function cloneFact(f: KarenLifeFact): KarenLifeFact {
  return {
    ...f,
    metadata: f.metadata ? { ...f.metadata } : undefined,
  };
}

function scoreCategoryEvidence(input: {
  open: KarenLifeFact[];
  completions: KarenLifeFact[];
  avoidances: KarenLifeFact[];
  excuses: KarenLifeFact[];
  repeatedExcuses: KarenLifeFact[];
  goals: KarenLifeFact[];
  dailyProgress: KarenLifeFact[];
  recentAnswers: KarenLifeFact[];
}): Record<KarenProbeCategory, number> {
  const e = emptyCategoryEvidence();
  e.commitment = input.open.length;
  e.tradeoff = Math.min(input.goals.length, input.open.length + input.avoidances.length);
  e.failure_mode = input.avoidances.length + input.open.length;
  e.habit_ceiling = input.dailyProgress.length + input.open.length;
  e.day_flow = input.dailyProgress.length + input.recentAnswers.length;
  e.avoidance = input.avoidances.length;
  e.glossed_struggle = input.repeatedExcuses.length + (input.recentAnswers.length > 0 ? 1 : 0);
  e.excuse_pattern = input.repeatedExcuses.length * 2 + input.excuses.length;
  e.value_skepticism = input.goals.length + input.open.length;
  // Completions reduce pressure on commitment probes but still evidence day_flow honesty.
  if (input.completions.length) {
    e.day_flow += 1;
    e.commitment = Math.max(0, e.commitment);
  }
  return e;
}

/** Categories with at least one unit of confirmed evidence. */
export function categoriesWithEvidence(ctx: KarenLifeContext): KarenProbeCategory[] {
  return KAREN_PROBE_CATEGORIES.filter((c) => ctx.categoryEvidence[c] > 0);
}

/**
 * Guard: refuse to treat free-text utterances as confirmed facts.
 * Context consumers must use dossier fact arrays, not invent from chatter.
 */
export function isConfirmedFactSource(kind: "fact" | "utterance"): kind is "fact" {
  return kind === "fact";
}
