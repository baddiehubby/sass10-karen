/**
 * Karen response engine — verdict + Say/Avoid/Fix coaching card.
 *
 * Adapts interview-my-project Phase 3 scoring (Solid / Shaky / Couldn't defend)
 * with neutral wording only. No personality, sarcasm, or insults in Stage 3.
 *
 * Verdicts use Stage 1 values (solid | shaky | failed) so applyVerdictToQuestion
 * + requeueWeakQuestions keep working unchanged.
 */

import { ingestLifeContext, type KarenLifeContext } from "@/lib/karen/interview/context-engine";
import {
  classifyAnswerClaim,
  type KarenAnswerClaimKind,
  type KarenAnswerSignals,
} from "@/lib/karen/interview/followup-engine";
import { applyVerdictToQuestion } from "@/lib/karen/interview/session-memory";
import type {
  KarenInterviewState,
  KarenLadderRung,
  KarenProbeQuestion,
  KarenVerdict,
} from "@/lib/karen/interview/types";

export type KarenVerdictLabel = "Solid" | "Shaky" | "Couldn't defend";

export type KarenCoachingCard = {
  say: string;
  avoid: string;
  /** Present only when the gap is fixable with concrete next work. */
  fix: string | null;
};

export type KarenVerdictResult = {
  verdict: KarenVerdict;
  label: KarenVerdictLabel;
  justification: string;
  coaching: KarenCoachingCard;
  claimKind: KarenAnswerClaimKind;
  rung: KarenLadderRung;
  /** True when Stage 1 should requeue this probe after debrief. */
  shouldRequeue: boolean;
  /** Facts cited — only ids/keys from recorded context. */
  citedFactIds: string[];
};

/** Clarification is not a verdict — do not mutate the question bank. */
export type KarenEvaluateOutcome =
  | {
      kind: "needs_clarification";
      prompt: string;
      signals: KarenAnswerSignals;
      rung: KarenLadderRung;
    }
  | {
      kind: "verdict";
      result: KarenVerdictResult;
    };

export function verdictLabel(verdict: KarenVerdict): KarenVerdictLabel {
  if (verdict === "solid") return "Solid";
  if (verdict === "shaky") return "Shaky";
  return "Couldn't defend";
}

export function evaluateAnswer(input: {
  question: KarenProbeQuestion;
  answer: string;
  rung?: KarenLadderRung;
  state?: KarenInterviewState;
  ctx?: KarenLifeContext;
  signals?: KarenAnswerSignals;
}): KarenEvaluateOutcome {
  const rung = input.rung ?? "surface";
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
          questions: [input.question],
          scorecard: { schemaVersion: 1, sessions: [], readiness: 0, trend: "first session" },
          facts: [],
          recentTurns: [],
          activeQuestionId: input.question.id,
          activeRung: rung,
          lastAnswerFingerprint: null,
          awaitingClarification: false,
          committedVerdictQuestionIds: [],
        }));

  const signals = input.signals ?? classifyAnswerClaim(input.answer, ctx);

  // Unclear answers must not receive a pretend verdict — ask for clarification.
  if (signals.needsClarification || signals.claimKind === "unclear") {
    return {
      kind: "needs_clarification",
      prompt: `I need a clearer answer before I can evaluate that. Specifically: ${input.question.question}`,
      signals,
      rung,
    };
  }

  const verdict = scoreVerdict(signals, rung);
  const citedFactIds = [...signals.matchedFacts, ...signals.matchedExcuses].map((f) => f.id);
  const coaching = buildCoachingCard({
    question: input.question,
    answer: input.answer,
    verdict,
    signals,
    ctx,
  });

  return {
    kind: "verdict",
    result: {
      verdict,
      label: verdictLabel(verdict),
      justification: buildJustification(input.question, signals, verdict),
      coaching,
      claimKind: signals.claimKind,
      rung,
      shouldRequeue: verdict === "shaky" || verdict === "failed",
      citedFactIds,
    },
  };
}

function scoreVerdict(signals: KarenAnswerSignals, rung: KarenLadderRung): KarenVerdict {
  if (signals.claimKind === "verified_fact") return "solid";
  if (signals.claimKind === "concrete_defense") {
    return rung === "surface" ? "solid" : "solid";
  }
  if (signals.claimKind === "admission") return "failed";
  if (signals.claimKind === "excuse") {
    return rung === "floor" ? "failed" : "shaky";
  }
  if (signals.claimKind === "assertion") {
    if (rung === "floor") return "failed";
    if (rung === "push") return "shaky";
    return "shaky";
  }
  return "shaky";
}

function buildJustification(
  question: KarenProbeQuestion,
  signals: KarenAnswerSignals,
  verdict: KarenVerdict,
): string {
  const parts: string[] = [];
  parts.push(`Claim kind: ${signals.claimKind}.`);
  if (signals.matchedFacts.length) {
    parts.push(
      `Matched recorded facts: ${signals.matchedFacts.map((f) => `${f.kind}:${f.key}`).join(", ")}.`,
    );
  } else {
    parts.push("No verified recorded fact matched this answer.");
  }
  if (signals.matchedExcuses.length) {
    parts.push(
      `Matched recorded excuses: ${signals.matchedExcuses.map((f) => f.key).join(", ")}.`,
    );
  }
  if (verdict === "solid") {
    parts.push("Answer gave a checkable why or matched a recorded completion.");
  } else if (verdict === "shaky") {
    parts.push("Answer was directionally related but vague or excuse-shaped.");
  } else {
    parts.push(`Could not defend the probe: ${question.question}`);
  }
  return parts.join(" ");
}

function buildCoachingCard(input: {
  question: KarenProbeQuestion;
  answer: string;
  verdict: KarenVerdict;
  signals: KarenAnswerSignals;
  ctx: KarenLifeContext;
}): KarenCoachingCard {
  const { question, verdict, signals, ctx } = input;
  const relatedPromise = ctx.openPromises[0];
  const relatedGoal = ctx.goals[0];
  const relatedExcuse = signals.matchedExcuses[0] ?? ctx.repeatedExcuses[0];

  if (verdict === "solid") {
    return {
      say: relatedPromise
        ? `I kept “${relatedPromise.text}” by doing a specific action I can name and time-box.`
        : "I can name the decision, why I made it, and one limit or tradeoff.",
      avoid: "Do not inflate a solid answer into guarantees you cannot show on the record.",
      fix: null,
    };
  }

  if (verdict === "shaky") {
    return {
      say: relatedPromise
        ? `About “${relatedPromise.text}”: here is what I did, what I skipped, and why.`
        : `Direct answer to “${question.question}” with one concrete detail.`,
      avoid: relatedExcuse
        ? `Avoid recycling “${relatedExcuse.text}” without a timeline or action.`
        : "Avoid bare assertions with no time, action, or outcome.",
      fix: relatedPromise
        ? `Do one 25-minute block on “${relatedPromise.text}” and record it as a completion.`
        : "Add one measurable action to your record before the next session.",
    };
  }

  // failed / couldn't defend
  return {
    say: relatedGoal
      ? `I missed the mark on “${relatedGoal.text}”. Next time I will state the miss and the first recovery step.`
      : "I could not defend that. Here is the honest gap and the first fix.",
    avoid: relatedExcuse
      ? `Do not hide behind “${relatedExcuse.text}” when you have no supporting detail.`
      : "Do not pretend an unclear or empty answer is a defense.",
    fix: relatedPromise
      ? `Schedule the smallest next step for “${relatedPromise.text}” and log completion when done.`
      : question.evidence.startsWith("confirmed")
        ? "Return to the recorded item in your session facts and complete one checkable step."
        : null,
  };
}

/**
 * Apply a Stage 3 verdict onto Stage 1 session memory (status/bestScore/timesAsked).
 * Does not run requeue — caller should call requeueWeakQuestions at debrief.
 * Clarification outcomes are ignored (no pretend scoring).
 */
export function commitVerdictToState(
  state: KarenInterviewState,
  questionId: string,
  outcome: KarenEvaluateOutcome | KarenVerdictResult,
): KarenInterviewState {
  if ("kind" in outcome) {
    if (outcome.kind === "needs_clarification") return state;
    return applyVerdictToQuestion(state, questionId, outcome.result.verdict);
  }
  if (outcome.claimKind === "unclear") return state;
  return applyVerdictToQuestion(state, questionId, outcome.verdict);
}
