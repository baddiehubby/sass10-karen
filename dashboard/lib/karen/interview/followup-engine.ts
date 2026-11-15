/**
 * Karen follow-up engine — Surface → Push → Floor ladder.
 *
 * Adapts interview-my-project Phase 3 ladder rules:
 * one ladder max per question; follow-ups depend on the answer;
 * unclear answers request clarification instead of a fake evaluation.
 *
 * Neutral tone only in Stage 3 — no personality styling.
 */

import { ingestLifeContext, type KarenLifeContext } from "@/lib/karen/interview/context-engine";
import { normalizeFactKey } from "@/lib/karen/interview/session-memory";
import type {
  KarenInterviewState,
  KarenLadderRung,
  KarenLifeFact,
  KarenProbeQuestion,
} from "@/lib/karen/interview/types";

/** How the answer relates to evidence — never conflate these. */
export type KarenAnswerClaimKind =
  | "unclear"
  | "excuse"
  | "assertion"
  | "verified_fact"
  | "admission"
  | "concrete_defense";

export type KarenAnswerSignals = {
  claimKind: KarenAnswerClaimKind;
  /** Normalized answer text. */
  normalized: string;
  /** True when answer is too thin/ambiguous to score. */
  needsClarification: boolean;
  /** True when answer is vague, deflecting, or excuse-shaped (push candidate). */
  isShaky: boolean;
  /** True when answer hand-waves with no concrete detail (floor candidate). */
  isHandwave: boolean;
  /** Recorded facts whose keys/text overlap the answer — never invented. */
  matchedFacts: KarenLifeFact[];
  /** Excuses in context that match this answer. */
  matchedExcuses: KarenLifeFact[];
};

export type KarenLadderAdvance =
  | {
      action: "clarify";
      rung: KarenLadderRung;
      prompt: string;
      signals: KarenAnswerSignals;
      ladderUsed: boolean;
    }
  | {
      action: "ask_followup";
      rung: "push" | "floor";
      prompt: string;
      signals: KarenAnswerSignals;
      ladderUsed: boolean;
    }
  | {
      action: "ready_for_verdict";
      rung: KarenLadderRung;
      signals: KarenAnswerSignals;
      ladderUsed: boolean;
    };

const EXCUSE_PATTERNS =
  /\b(busy|no time|didn'?t have time|too tired|traffic|emergency|forgot|later|tomorrow|not feeling|wasn'?t feeling|had to|something came up|netflix|scrolling|distracted)\b/i;

/** Bare claims without checkable detail — assertions, not defenses. */
const BARE_ASSERTION =
  /\b(i (did it|got it done|worked on it(?: a bit)?|tried|handled it|crushed it)|yes i did(?: it)?|yeah i did(?: it)?)\b/i;

const ADMISSION_PATTERNS =
  /\b(i (didn'?t|did not|haven'?t|have not|skipped|failed|avoided)|i don'?t know|idk|no idea|i have no idea)\b/i;

const ASSERTION_PATTERNS =
  /\b(i (did|worked|tried|handled|got it done|crushed it|was productive)|yes|yep|yeah|of course|obviously)\b/i;

const UNCLEAR_ONLY =
  /^(ok|okay|sure|maybe|fine|idk|k|\.+|…|\?|huh|what|hmm|meh)?$/i;

function isConcreteDefense(text: string): boolean {
  if (BARE_ASSERTION.test(text) && !hasConcreteDetail(text)) return false;
  if (hasConcreteDetail(text)) return true;
  return /\b(i (finished|completed|went to|wrote|called|sent|shipped)\b.+)/i.test(text);
}

export function classifyAnswerClaim(
  answer: string,
  ctx: KarenLifeContext,
): KarenAnswerSignals {
  const trimmed = answer.replace(/\s+/g, " ").trim();
  const normalized = normalizeFactKey(trimmed);

  if (!trimmed || trimmed.length < 2 || UNCLEAR_ONLY.test(trimmed)) {
    return {
      claimKind: "unclear",
      normalized,
      needsClarification: true,
      isShaky: true,
      isHandwave: true,
      matchedFacts: [],
      matchedExcuses: [],
    };
  }

  // Completions only — never treat avoidances/answers as verification evidence.
  const matchedCompletions = findOverlappingFacts(trimmed, ctx.completions);
  const matchedFacts = findOverlappingFacts(trimmed, [
    ...ctx.openPromises,
    ...ctx.completions,
    ...ctx.goals,
    ...ctx.dailyProgress,
    ...ctx.recentAnswers,
  ]);
  const matchedExcuses = findOverlappingFacts(trimmed, ctx.excuses);

  const repeatsKnownExcuse =
    matchedExcuses.some((f) => f.timesSeen >= 1) || EXCUSE_PATTERNS.test(trimmed);
  const concrete = isConcreteDefense(trimmed);

  // verified_fact ONLY when a corresponding recorded completion already exists.
  if (concrete && matchedCompletions.length > 0) {
    return {
      claimKind: "verified_fact",
      normalized,
      needsClarification: false,
      isShaky: false,
      isHandwave: false,
      matchedFacts: matchedCompletions,
      matchedExcuses,
    };
  }

  if (ADMISSION_PATTERNS.test(trimmed) && !concrete) {
    return {
      claimKind: "admission",
      normalized,
      needsClarification: false,
      isShaky: false,
      isHandwave: false,
      matchedFacts,
      matchedExcuses,
    };
  }

  if (repeatsKnownExcuse || (EXCUSE_PATTERNS.test(trimmed) && !concrete)) {
    return {
      claimKind: "excuse",
      normalized,
      needsClarification: false,
      isShaky: true,
      isHandwave: !/\b(because|after|before|from \d|until|for \d)\b/i.test(trimmed),
      matchedFacts,
      matchedExcuses,
    };
  }

  // Concrete self-report without a prior recorded completion.
  if (concrete) {
    return {
      claimKind: "concrete_defense",
      normalized,
      needsClarification: false,
      isShaky: false,
      isHandwave: false,
      matchedFacts,
      matchedExcuses,
    };
  }

  if (BARE_ASSERTION.test(trimmed) || ASSERTION_PATTERNS.test(trimmed) || trimmed.length < 28) {
    return {
      claimKind: "assertion",
      normalized,
      needsClarification: false,
      isShaky: true,
      isHandwave: true,
      matchedFacts,
      matchedExcuses,
    };
  }

  // Longer answer without concrete anchors — shaky but scorable.
  return {
    claimKind: "assertion",
    normalized,
    needsClarification: false,
    isShaky: true,
    isHandwave: false,
    matchedFacts,
    matchedExcuses,
  };
}

function hasConcreteDetail(text: string): boolean {
  return (
    /\b\d+\s*(minutes?|hours?|km|miles|pages?|words?|emails?|sets?|reps?)\b/i.test(text) ||
    /\b(at \d{1,2}(:\d{2})?\s*(am|pm)?|from .+ to .+|between .+ and .+)\b/i.test(text)
  );
}

function findOverlappingFacts(answer: string, facts: KarenLifeFact[]): KarenLifeFact[] {
  const norm = normalizeFactKey(answer);
  if (!norm) return [];
  const tokens = new Set(norm.split(" ").filter((t) => t.length > 2));
  return facts.filter((f) => {
    const keyTokens = f.key.split(" ").filter((t) => t.length > 2);
    const textNorm = normalizeFactKey(f.text);
    if (norm.includes(f.key) || textNorm.includes(norm) || norm.includes(textNorm)) return true;
    const overlap = keyTokens.filter((t) => tokens.has(t)).length;
    return overlap >= Math.min(2, keyTokens.length) && overlap > 0;
  });
}

export function clarificationPrompt(question: KarenProbeQuestion): string {
  return `I need a clearer answer before I can evaluate that. Specifically: ${question.question}`;
}

export function followupPrompt(
  question: KarenProbeQuestion,
  rung: "push" | "floor",
  signals: KarenAnswerSignals,
): string {
  const base = rung === "push" ? question.push : question.floor;
  if (signals.claimKind === "excuse" && signals.matchedExcuses[0]) {
    const excuse = signals.matchedExcuses[0];
    const prefix =
      rung === "push"
        ? `You used “${excuse.text}”. ${base}`
        : `Set the excuse aside. ${base}`;
    return prefix;
  }
  if (signals.claimKind === "assertion") {
    return rung === "push"
      ? `That is an assertion, not evidence. ${base}`
      : `Make it concrete. ${base}`;
  }
  return base;
}

/**
 * Advance the Surface → Push → Floor ladder for one answer.
 * At most one ladder (push then floor) per question; then verdict.
 */
export function advanceLadder(input: {
  question: KarenProbeQuestion;
  answer: string;
  /** Current rung when the answer arrived (default surface). */
  currentRung?: KarenLadderRung | null;
  /** True if push or floor was already used for this question. */
  ladderUsed?: boolean;
  state?: KarenInterviewState;
  ctx?: KarenLifeContext;
}): KarenLadderAdvance {
  const currentRung: KarenLadderRung = input.currentRung ?? "surface";
  const ctx =
    input.ctx ??
    (input.state
      ? ingestLifeContext(input.state)
      : ingestLifeContext({
          schemaVersion: 1,
          userId: "anonymous",
          updatedAt: new Date(0).toISOString(),
          intensity: 3,
          lastMood: "sarcastic",
          questions: [],
          scorecard: { schemaVersion: 1, sessions: [], readiness: 0, trend: "first session" },
          facts: [],
          recentTurns: [],
          activeQuestionId: null,
          activeRung: null,
          lastAnswerFingerprint: null,
          awaitingClarification: false,
          committedVerdictQuestionIds: [],
        }));

  const signals = classifyAnswerClaim(input.answer, ctx);
  const ladderUsed = Boolean(input.ladderUsed);

  if (signals.needsClarification) {
    return {
      action: "clarify",
      rung: currentRung,
      prompt: clarificationPrompt(input.question),
      signals,
      ladderUsed,
    };
  }

  // Strong enough at surface/push → verdict without further ladder.
  if (
    signals.claimKind === "verified_fact" ||
    signals.claimKind === "concrete_defense" ||
    signals.claimKind === "admission"
  ) {
    return {
      action: "ready_for_verdict",
      rung: currentRung,
      signals,
      ladderUsed,
    };
  }

  // Floor answer always ends the ladder → verdict (one ladder max).
  if (currentRung === "floor") {
    return {
      action: "ready_for_verdict",
      rung: "floor",
      signals,
      ladderUsed: true,
    };
  }

  // Surface + shaky → push (opens the single allowed ladder).
  if (currentRung === "surface" && (signals.isShaky || signals.isHandwave)) {
    return {
      action: "ask_followup",
      rung: "push",
      prompt: followupPrompt(input.question, "push", signals),
      signals,
      ladderUsed: true,
    };
  }

  // Push + still hand-waving → floor (same ladder, second rung only).
  if (currentRung === "push" && signals.isHandwave) {
    return {
      action: "ask_followup",
      rung: "floor",
      prompt: followupPrompt(input.question, "floor", signals),
      signals,
      ladderUsed: true,
    };
  }

  // Otherwise score now (e.g. push answered with partial substance).
  return {
    action: "ready_for_verdict",
    rung: currentRung,
    signals,
    ladderUsed: ladderUsed || currentRung !== "surface",
  };
}

/**
 * Derive whether the ladder was already opened for this question from turns.
 */
export function ladderUsedForQuestion(
  state: KarenInterviewState,
  questionId: string,
): boolean {
  return state.recentTurns.some(
    (t) => t.role === "karen" && t.questionId === questionId && (t.rung === "push" || t.rung === "floor"),
  );
}

export function currentRungForQuestion(
  state: KarenInterviewState,
  questionId: string,
): KarenLadderRung {
  if (state.activeQuestionId === questionId && state.activeRung) {
    return state.activeRung;
  }
  const lastKaren = [...state.recentTurns]
    .reverse()
    .find((t) => t.role === "karen" && t.questionId === questionId && t.rung);
  return lastKaren?.rung ?? "surface";
}
