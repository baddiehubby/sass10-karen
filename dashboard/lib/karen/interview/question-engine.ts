/**
 * Karen question engine — ranked life-probe bank.
 *
 * Adapts interview-my-project Phase 2 (taxonomy, 3-axis rank, discard < 9,
 * requeued weaks lead, never pad). One question at a time via selectNextQuestion.
 */

import {
  ingestLifeContext,
  KAREN_PROBE_CATEGORIES,
  type KarenLifeContext,
} from "@/lib/karen/interview/context-engine";
import { normalizeFactKey } from "@/lib/karen/interview/session-memory";
import {
  KAREN_RANK_DISCARD_BELOW,
  type KarenInterviewState,
  type KarenLifeFact,
  type KarenProbeCategory,
  type KarenProbeQuestion,
  type KarenRankAxes,
} from "@/lib/karen/interview/types";

export type KarenInterviewMode = "default" | "quick" | "deep" | "focus";

export const KAREN_MODE_LIMITS: Record<KarenInterviewMode, number> = {
  quick: 5,
  default: 8,
  deep: 12,
  focus: 8,
};

export type BuildProbeBankOptions = {
  mode?: KarenInterviewMode;
  /** When set, only emit probes in this category (plus preserved requeues). */
  focusCategory?: KarenProbeCategory;
  now?: Date;
};

export type ProbeCandidate = {
  category: KarenProbeCategory;
  entry: string;
  question: string;
  anchor: string;
  evidence: string;
  push: string;
  floor: string;
  axes: KarenRankAxes;
};

export function sumRankAxes(axes: KarenRankAxes): number {
  return axes.loadBearing + axes.interviewerLikelihood + axes.nonObviousness;
}

export function passesRankThreshold(axes: KarenRankAxes, floor = KAREN_RANK_DISCARD_BELOW): boolean {
  return sumRankAxes(axes) >= floor;
}

export function clampAxis(n: number): 1 | 2 | 3 | 4 | 5 {
  const v = Math.max(1, Math.min(5, Math.round(n)));
  return v as 1 | 2 | 3 | 4 | 5;
}

export function normalizeQuestionText(question: string): string {
  return normalizeFactKey(question);
}

export function isDuplicateProbe(
  candidate: Pick<KarenProbeQuestion, "question" | "anchor" | "category">,
  existing: KarenProbeQuestion[],
): boolean {
  const qNorm = normalizeQuestionText(candidate.question);
  const aNorm = normalizeFactKey(candidate.anchor);
  return existing.some(
    (e) =>
      normalizeQuestionText(e.question) === qNorm ||
      (e.category === candidate.category && normalizeFactKey(e.anchor) === aNorm),
  );
}

/**
 * Score axes from confirmed context only — never inflate for empty evidence.
 */
export function scoreAxesForFact(
  category: KarenProbeCategory,
  fact: KarenLifeFact,
  ctx: KarenLifeContext,
): KarenRankAxes {
  const evidence = ctx.categoryEvidence[category];
  let loadBearing = 2;
  let interviewerLikelihood = 3;
  let nonObviousness = 2;

  if (fact.kind === "promise" || category === "commitment") {
    loadBearing = 5;
    interviewerLikelihood = 5;
    nonObviousness = fact.timesSeen > 1 ? 4 : 3;
  }
  if (fact.kind === "excuse" || category === "excuse_pattern") {
    loadBearing = 4;
    interviewerLikelihood = 5;
    nonObviousness = fact.timesSeen >= 2 ? 5 : 3;
  }
  if (fact.kind === "avoidance" || category === "avoidance") {
    loadBearing = 4;
    interviewerLikelihood = 4;
    nonObviousness = 4;
  }
  if (fact.kind === "goal" || category === "value_skepticism") {
    loadBearing = 4;
    interviewerLikelihood = 4;
    nonObviousness = 3;
  }
  if (fact.kind === "daily_progress" || category === "day_flow" || category === "habit_ceiling") {
    loadBearing = 3;
    interviewerLikelihood = 4;
    nonObviousness = 3;
  }
  if (category === "glossed_struggle") {
    nonObviousness = Math.max(nonObviousness, fact.timesSeen >= 2 ? 5 : 4);
  }
  if (category === "tradeoff" || category === "failure_mode") {
    loadBearing = Math.max(loadBearing, 4);
    interviewerLikelihood = Math.max(interviewerLikelihood, 4);
  }

  // Thin evidence cannot fake a high bar — pull scores down when category is weak.
  if (evidence <= 0) {
    loadBearing = 1;
    interviewerLikelihood = 1;
    nonObviousness = 1;
  } else if (evidence === 1) {
    loadBearing = clampAxis(loadBearing - 1);
  }

  return {
    loadBearing: clampAxis(loadBearing),
    interviewerLikelihood: clampAxis(interviewerLikelihood),
    nonObviousness: clampAxis(nonObviousness),
  };
}

function quoteSnippet(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Generate contextual probe candidates from confirmed facts only.
 * Returns [] when context is thin — never pads with generic motivation.
 */
export function generateProbeCandidates(ctx: KarenLifeContext): ProbeCandidate[] {
  if (ctx.thinContext) return [];

  const out: ProbeCandidate[] = [];

  for (const promise of ctx.openPromises) {
    const snippet = quoteSnippet(promise.text);
    out.push(
      candidateFrom(
        ctx,
        "commitment",
        promise,
        `when they mention plans or work`,
        `You said you'd ${snippet}. Did you actually do it?`,
        `What specifically stopped you from doing: ${snippet}?`,
        `Name one concrete action you took toward: ${snippet}.`,
      ),
    );
    out.push(
      candidateFrom(
        ctx,
        "failure_mode",
        promise,
        `when they shrug off the miss`,
        `If you skip “${snippet}” again tomorrow, what actually breaks?`,
        `Who else feels that break — or is it only you?`,
        `Describe the first hour after you skip it. What fills the gap?`,
      ),
    );
    out.push(
      candidateFrom(
        ctx,
        "tradeoff",
        promise,
        `when they say they were busy`,
        `What did you choose instead of “${snippet}”?`,
        `Was that trade worth it by your own standard?`,
        `Rank yesterday: the promise vs what you actually did.`,
      ),
    );
  }

  for (const goal of ctx.goals) {
    const snippet = quoteSnippet(goal.text);
    out.push(
      candidateFrom(
        ctx,
        "value_skepticism",
        goal,
        `when they talk about ambition`,
        `You wanted “${snippet}”. Why does that still matter this week?`,
        `If you dropped it quietly, who would notice?`,
        `What measurable proof would show the goal is real, not décor?`,
      ),
    );
    out.push(
      candidateFrom(
        ctx,
        "habit_ceiling",
        goal,
        `when they claim consistency`,
        `At what daily load does “${snippet}” fall apart for you?`,
        `What is the smallest version you could still keep?`,
        `Walk me through yesterday's attempt in three steps.`,
      ),
    );
  }

  for (const excuse of ctx.excuses) {
    const snippet = quoteSnippet(excuse.text);
    const repeated = excuse.timesSeen >= 2;
    out.push(
      candidateFrom(
        ctx,
        "excuse_pattern",
        excuse,
        `when they reuse the same line`,
        repeated
          ? `You've used “${snippet}” ${excuse.timesSeen} times. What is the real reason underneath?`
          : `You said “${snippet}”. Busy doing what, specifically?`,
        `If I banned that excuse for a day, what would you say instead?`,
        `Give me the timeline: when did “${snippet}” start, and what did you do in those hours?`,
      ),
    );
    if (repeated) {
      out.push(
        candidateFrom(
          ctx,
          "glossed_struggle",
          excuse,
          `when they deflect`,
          `You keep saying “${snippet}”. What part of this are you avoiding naming?`,
          `Is the hard part the work, the start, or looking at the miss?`,
          `Finish this sentence without the excuse: “I didn't do it because…”`,
        ),
      );
    }
  }

  for (const avoidance of ctx.avoidances) {
    const snippet = quoteSnippet(avoidance.text);
    out.push(
      candidateFrom(
        ctx,
        "avoidance",
        avoidance,
        `when they change the subject`,
        `You avoided “${snippet}”. What were you protecting yourself from?`,
        `What would facing it for ten minutes have cost you?`,
        `Name the first tiny step you refused.`,
      ),
    );
  }

  for (const progress of ctx.dailyProgress) {
    const snippet = quoteSnippet(progress.text);
    out.push(
      candidateFrom(
        ctx,
        "day_flow",
        progress,
        `when they summarize the day`,
        `Your day logged “${snippet}”. Walk me through it hour by hour — where did the time go?`,
        `Which block was deliberate, and which was drift?`,
        `Point to the single hour that decided the day.`,
      ),
    );
  }

  // Deduplicate candidates before ranking filter.
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = `${c.category}:${normalizeFactKey(c.anchor)}:${normalizeQuestionText(c.question)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function candidateFrom(
  ctx: KarenLifeContext,
  category: KarenProbeCategory,
  fact: KarenLifeFact,
  entry: string,
  question: string,
  push: string,
  floor: string,
): ProbeCandidate {
  const axes = scoreAxesForFact(category, fact, ctx);
  return {
    category,
    entry,
    question,
    anchor: `${fact.kind}:${fact.key}`,
    evidence: `confirmed ${fact.kind} id=${fact.id}; text=${fact.text}; timesSeen=${fact.timesSeen}`,
    push,
    floor,
    axes,
  };
}

export function candidateToQuestion(
  candidate: ProbeCandidate,
  id: string,
  status: KarenProbeQuestion["status"] = "queued",
): KarenProbeQuestion {
  return {
    id,
    category: candidate.category,
    entry: candidate.entry,
    question: candidate.question,
    anchor: candidate.anchor,
    evidence: candidate.evidence,
    push: candidate.push,
    floor: candidate.floor,
    axes: candidate.axes,
    rankScore: sumRankAxes(candidate.axes),
    status,
    timesAsked: 0,
    bestScore: null,
  };
}

/**
 * Build a ranked bank: preserve requeued weaks first, add new probes that clear
 * the rank floor, drop generics/duplicates, never pad to mode count.
 *
 * Requeued weaks are never dropped to make room for fresh probes.
 */
export function buildProbeBank(
  state: KarenInterviewState,
  options: BuildProbeBankOptions = {},
): KarenProbeQuestion[] {
  const mode = options.mode ?? "default";
  const limit = KAREN_MODE_LIMITS[mode];
  const ctx = ingestLifeContext(state, options.now);

  const preservedRequeued = state.questions
    .filter((q) => q.status === "requeued")
    .map((q) => ({ ...q }))
    .sort((a, b) => b.rankScore - a.rankScore);

  const preservedAskedSolid = state.questions.filter(
    (q) => q.status === "asked" && q.bestScore === "solid",
  );

  const fresh: KarenProbeQuestion[] = [];
  if (!ctx.thinContext) {
    const candidates = generateProbeCandidates(ctx)
      .filter((c) => passesRankThreshold(c.axes))
      .filter((c) => ctx.categoryEvidence[c.category] > 0)
      .filter((c) => !options.focusCategory || c.category === options.focusCategory)
      .sort((a, b) => sumRankAxes(b.axes) - sumRankAxes(a.axes));

    let i = 0;
    for (const c of candidates) {
      if (isDuplicateProbe(c, [...preservedRequeued, ...state.questions, ...fresh])) continue;
      fresh.push(
        candidateToQuestion(c, `q-${state.userId}-${i}-${sumRankAxes(c.axes)}-${c.category}`),
      );
      i += 1;
    }
  }

  // Session ask queue: requeues always included; fresh fills remaining slots up to mode limit.
  const merged: KarenProbeQuestion[] = [...preservedRequeued];
  const freshSlots = Math.max(0, limit - preservedRequeued.length);
  for (const q of fresh) {
    if (merged.length - preservedRequeued.length >= freshSlots) break;
    if (isDuplicateProbe(q, merged)) continue;
    merged.push(q);
  }

  // Retain solid asked probes for readiness continuity (not part of the ask queue padding).
  for (const q of preservedAskedSolid) {
    if (merged.some((m) => m.id === q.id)) continue;
    if (isDuplicateProbe(q, merged)) continue;
    merged.push({ ...q });
  }

  return merged;
}

/**
 * One question at a time. If a probe is already active, return it.
 * Otherwise return the next ordered probe (requeued first).
 */
export function selectNextQuestion(state: KarenInterviewState): KarenProbeQuestion | null {
  if (state.activeQuestionId) {
    const active = state.questions.find((q) => q.id === state.activeQuestionId);
    if (active) return active;
  }

  const ordered = orderedBank(state.questions);
  const next = ordered.find((q) => q.status === "requeued" || q.status === "queued");
  return next ?? null;
}

export function orderedBank(questions: KarenProbeQuestion[]): KarenProbeQuestion[] {
  const requeued = questions.filter((q) => q.status === "requeued");
  const queued = questions.filter((q) => q.status === "queued");
  const rest = questions.filter((q) => q.status !== "requeued" && q.status !== "queued");
  const byRank = (a: KarenProbeQuestion, b: KarenProbeQuestion) => b.rankScore - a.rankScore;
  return [...requeued.sort(byRank), ...queued.sort(byRank), ...rest.sort(byRank)];
}

/** True when the bank contains only context-backed probes (no generic fillers). */
export function bankIsContextGrounded(questions: KarenProbeQuestion[], ctx: KarenLifeContext): boolean {
  if (ctx.thinContext) return questions.every((q) => q.status === "requeued");
  const generic = /how are you motivating|believe in yourself|stay positive|you got this/i;
  return questions.every((q) => !generic.test(q.question));
}

export function assertNineCategoryTaxonomy(): readonly KarenProbeCategory[] {
  if (KAREN_PROBE_CATEGORIES.length !== 9) {
    throw new Error(`Expected 9 life-probe categories, got ${KAREN_PROBE_CATEGORIES.length}`);
  }
  return KAREN_PROBE_CATEGORIES;
}
