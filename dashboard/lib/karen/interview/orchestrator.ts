/**
 * Karen conversation orchestrator — Stage 5 thin facade.
 *
 * Wires Stage 1–4 engines into a one-question-at-a-time turn loop.
 * Does not touch Buddy intelligence, voice, billing, or production DB.
 */

import { detectsCrisisLanguage } from "@/src/intelligence/safety";
import { ingestLifeContext } from "@/lib/karen/interview/context-engine";
import {
  advanceLadder,
  ladderUsedForQuestion,
} from "@/lib/karen/interview/followup-engine";
import {
  deescalateToSweet,
  recordedRefsFromContext,
  resolveConfig,
  styleLine,
  styleVerdictResult,
  type KarenStyledVerdict,
} from "@/lib/karen/interview/personality-controller";
import { buildProbeBank, selectNextQuestion } from "@/lib/karen/interview/question-engine";
import {
  commitVerdictToState,
  type KarenCoachingCard,
  type KarenEvaluateOutcome,
  evaluateAnswer,
} from "@/lib/karen/interview/response-engine";
import {
  loadOrCreateInterviewState,
  normalizeFactKey,
  recordLifeFact,
  recordTurn,
  replaceQuestionBank,
  requeueWeakQuestions,
  saveInterviewState,
  setActiveProbe,
  setLastMood,
  type KarenSessionStore,
} from "@/lib/karen/interview/session-memory";
import type {
  KarenFaceCue,
  KarenIntensity,
  KarenInterviewState,
  KarenLadderRung,
  KarenLifeFactKind,
  KarenMood,
  KarenPersonalityConfig,
  KarenVerdict,
} from "@/lib/karen/interview/types";

export type KarenNextAction =
  | "await_answer"
  | "await_clarification"
  | "await_followup"
  | "await_next_question"
  | "session_idle";

export type KarenTurnBinding = {
  /** Must match the active question when provided. */
  questionId?: string;
  /** Must match the expected ladder rung when provided. */
  expectedRung?: KarenLadderRung;
};

export type KarenTurnOutput = {
  message: string;
  activeQuestionId: string | null;
  rung: KarenLadderRung | null;
  verdict: KarenVerdict | null;
  verdictLabel: string | null;
  coaching: KarenCoachingCard | null;
  mood: KarenMood;
  intensity: KarenIntensity;
  faceCue: KarenFaceCue;
  nextAction: KarenNextAction;
  duplicateIgnored: boolean;
  verdictReplayed: boolean;
  /** True when submission targeted a stale question/rung. */
  rejectedStale: boolean;
  claimKind: string | null;
  state: KarenInterviewState;
};

export type KarenOrchestratorOptions = {
  store: KarenSessionStore;
  userId: string;
  personality?: Partial<KarenPersonalityConfig>;
  mode?: "default" | "quick" | "deep" | "focus";
};

function fingerprint(questionId: string, rung: KarenLadderRung, answer: string): string {
  return `${questionId}:${rung}:${normalizeFactKey(answer)}`;
}

function migrateState(state: KarenInterviewState): KarenInterviewState {
  return {
    ...state,
    lastAnswerFingerprint: state.lastAnswerFingerprint ?? null,
    awaitingClarification: state.awaitingClarification ?? false,
    committedVerdictQuestionIds: state.committedVerdictQuestionIds ?? [],
  };
}

export function createKarenOrchestrator(opts: KarenOrchestratorOptions) {
  const store = opts.store;
  const userId = opts.userId;
  let personality = resolveConfig({
    ...opts.personality,
    intensity: opts.personality?.intensity,
  });
  const mode = opts.mode ?? "default";

  async function load(): Promise<KarenInterviewState> {
    return migrateState(await loadOrCreateInterviewState(store, userId));
  }

  async function persist(state: KarenInterviewState): Promise<KarenInterviewState> {
    return saveInterviewState(store, migrateState(state));
  }

  function outputBase(
    state: KarenInterviewState,
    partial: Omit<KarenTurnOutput, "state" | "mood" | "intensity"> & {
      mood?: KarenMood;
      intensity?: KarenIntensity;
    },
  ): KarenTurnOutput {
    return {
      ...partial,
      mood: partial.mood ?? personality.mood,
      intensity: partial.intensity ?? personality.intensity,
      state,
    };
  }

  /**
   * Ensure a bank exists and return exactly one active styled question.
   */
  async function askNextQuestion(): Promise<KarenTurnOutput> {
    let state = await load();

    if (state.activeQuestionId) {
      const active = state.questions.find((q) => q.id === state.activeQuestionId);
      if (active) {
        const ctx = ingestLifeContext(state);
        const styled = styleLine({
          kind: state.awaitingClarification ? "clarify" : "question",
          text: state.awaitingClarification
            ? `I need a clearer answer before I can evaluate that. Specifically: ${active.question}`
            : active.question,
          config: personality,
          recorded: recordedRefsFromContext(ctx),
        });
        return outputBase(state, {
          message: styled.text,
          activeQuestionId: active.id,
          rung: state.activeRung ?? "surface",
          verdict: null,
          verdictLabel: null,
          coaching: null,
          faceCue: styled.faceCue,
          nextAction: state.awaitingClarification
            ? "await_clarification"
            : state.activeRung === "push" || state.activeRung === "floor"
              ? "await_followup"
              : "await_answer",
          duplicateIgnored: false,
          verdictReplayed: false,
          rejectedStale: false,
          claimKind: null,
          mood: styled.mood,
          intensity: styled.intensity,
        });
      }
    }

    const bank = buildProbeBank(state, { mode });
    state = replaceQuestionBank(state, bank);
    const next = selectNextQuestion(state);
    if (!next) {
      state = setActiveProbe(state, null, null);
      state = await persist(state);
      const styled = styleLine({
        kind: "clarify",
        text: "No probes available yet. Record a promise or goal first.",
        config: personality,
      });
      return outputBase(state, {
        message: styled.text,
        activeQuestionId: null,
        rung: null,
        verdict: null,
        verdictLabel: null,
        coaching: null,
        faceCue: styled.faceCue,
        nextAction: "session_idle",
        duplicateIgnored: false,
        verdictReplayed: false,
        rejectedStale: false,
        claimKind: null,
        mood: styled.mood,
        intensity: styled.intensity,
      });
    }

    state = setActiveProbe(state, next.id, "surface");
    state = {
      ...state,
      awaitingClarification: false,
      lastAnswerFingerprint: null,
      // Requeued probes may be asked again — allow a fresh verdict commit this arc.
      committedVerdictQuestionIds: state.committedVerdictQuestionIds.filter((id) => id !== next.id),
    };
    state = recordTurn(state, {
      role: "karen",
      text: next.question,
      questionId: next.id,
      rung: "surface",
      mood: personality.mood,
    });
    state = await persist(state);

    const ctx = ingestLifeContext(state);
    const styled = styleLine({
      kind: "question",
      text: next.question,
      config: personality,
      recorded: recordedRefsFromContext(ctx),
    });

    return outputBase(state, {
      message: styled.text,
      activeQuestionId: next.id,
      rung: "surface",
      verdict: null,
      verdictLabel: null,
      coaching: null,
      faceCue: styled.faceCue,
      nextAction: "await_answer",
      duplicateIgnored: false,
      verdictReplayed: false,
      rejectedStale: false,
      claimKind: null,
      mood: styled.mood,
      intensity: styled.intensity,
    });
  }

  async function handleAnswer(
    rawAnswer: string,
    binding?: KarenTurnBinding,
  ): Promise<KarenTurnOutput> {
    let state = await load();
    const answer = rawAnswer.replace(/\s+/g, " ").trim();

    if (!state.activeQuestionId) {
      if (binding?.questionId) {
        return staleReject(state, "No active question; submission is stale.");
      }
      return askNextQuestion();
    }

    const question = state.questions.find((q) => q.id === state.activeQuestionId);
    if (!question) {
      state = setActiveProbe(state, null, null);
      state = await persist(state);
      return askNextQuestion();
    }

    const expectedRung: KarenLadderRung = state.activeRung ?? "surface";
    if (binding?.questionId && binding.questionId !== question.id) {
      return staleReject(
        state,
        `Stale question submission (expected ${question.id}, got ${binding.questionId}).`,
        question.id,
        expectedRung,
      );
    }
    if (binding?.expectedRung && binding.expectedRung !== expectedRung) {
      return staleReject(
        state,
        `Out-of-order rung submission (expected ${expectedRung}, got ${binding.expectedRung}).`,
        question.id,
        expectedRung,
      );
    }

    const fp = fingerprint(question.id, expectedRung, answer);
    if (state.lastAnswerFingerprint === fp) {
      // Duplicate submission — do not re-evaluate or re-commit.
      const replay = [...state.recentTurns]
        .reverse()
        .find((t) => t.role === "karen" && t.questionId === question.id);
      const alreadyCommitted = state.committedVerdictQuestionIds.includes(question.id);
      return outputBase(state, {
        message: replay?.text ?? "I already processed that answer.",
        activeQuestionId: alreadyCommitted ? null : question.id,
        rung: alreadyCommitted ? null : expectedRung,
        verdict: alreadyCommitted ? question.bestScore : null,
        verdictLabel: null,
        coaching: null,
        faceCue: "neutral",
        nextAction: alreadyCommitted
          ? "await_next_question"
          : state.awaitingClarification
            ? "await_clarification"
            : expectedRung === "push" || expectedRung === "floor"
              ? "await_followup"
              : "await_answer",
        duplicateIgnored: true,
        verdictReplayed: alreadyCommitted,
        rejectedStale: false,
        claimKind: null,
      });
    }

    // Crisis bypass through orchestrator — force Sweet before any roast styling.
    if (detectsCrisisLanguage(answer)) {
      personality = deescalateToSweet(personality);
      state = setLastMood(state, "sweet");
    }

    state = recordTurn(state, {
      role: "user",
      text: answer,
      questionId: question.id,
      rung: expectedRung,
    });

    // Freeze ladder rung for this answer (clarification must not advance it).
    const frozenRung = expectedRung;
    const ctx = ingestLifeContext(state);
    const ladderUsed =
      frozenRung !== "surface" || ladderUsedForQuestion(state, question.id);
    const decision = advanceLadder({
      question,
      answer,
      currentRung: frozenRung,
      ladderUsed,
      state,
      ctx,
    });

    if (decision.action === "clarify") {
      // Resume same question + same rung; do not advance ladder.
      state = {
        ...state,
        awaitingClarification: true,
        lastAnswerFingerprint: fp,
      };
      state = setActiveProbe(state, question.id, frozenRung);
      const styled = styleLine({
        kind: "clarify",
        text: decision.prompt,
        config: personality,
        userText: answer,
        recorded: recordedRefsFromContext(ctx),
      });
      if (styled.safetyTriggered) {
        personality = deescalateToSweet(personality);
      }
      state = setLastMood(state, styled.mood);
      state = recordTurn(state, {
        role: "karen",
        text: styled.text,
        questionId: question.id,
        rung: frozenRung,
        mood: styled.mood,
      });
      const bankBefore = state.questions.map((q) => q.id).join(",");
      state = await persist(state);
      const bankAfter = state.questions.map((q) => q.id).join(",");
      if (bankBefore !== bankAfter) {
        throw new Error("Clarification mutated question bank");
      }

      return outputBase(state, {
        message: styled.text,
        activeQuestionId: question.id,
        rung: frozenRung,
        verdict: null,
        verdictLabel: null,
        coaching: null,
        faceCue: styled.faceCue,
        nextAction: "await_clarification",
        duplicateIgnored: false,
        verdictReplayed: false,
        rejectedStale: false,
        claimKind: decision.signals.claimKind,
        mood: styled.mood,
        intensity: styled.intensity,
      });
    }

    // Clear clarification flag once we have a scorable answer at the same rung.
    state = { ...state, awaitingClarification: false };

    // Record non-completion observations before follow-ups; never write completion pre-eval.
    state = maybeRecordObservedAnswer(state, answer, decision.signals.claimKind, question.id);

    if (decision.action === "ask_followup") {
      state = {
        ...state,
        lastAnswerFingerprint: fp,
      };
      state = setActiveProbe(state, question.id, decision.rung);
      const styled = styleLine({
        kind: "followup",
        text: decision.prompt,
        config: personality,
        userText: answer,
        recorded: recordedRefsFromContext(ingestLifeContext(state)),
        isUserClaim: decision.signals.claimKind === "assertion" || decision.signals.claimKind === "excuse",
      });
      if (styled.safetyTriggered) {
        personality = deescalateToSweet(personality);
      }
      state = setLastMood(state, styled.mood);
      state = recordTurn(state, {
        role: "karen",
        text: styled.text,
        questionId: question.id,
        rung: decision.rung,
        mood: styled.mood,
      });
      state = await persist(state);

      return outputBase(state, {
        message: styled.text,
        activeQuestionId: question.id,
        rung: decision.rung,
        verdict: null,
        verdictLabel: null,
        coaching: null,
        faceCue: styled.faceCue,
        nextAction: "await_followup",
        duplicateIgnored: false,
        verdictReplayed: false,
        rejectedStale: false,
        claimKind: decision.signals.claimKind,
        mood: styled.mood,
        intensity: styled.intensity,
      });
    }

    // ready_for_verdict — evaluate against context BEFORE writing a new completion.
    if (state.committedVerdictQuestionIds.includes(question.id)) {
      state = {
        ...state,
        lastAnswerFingerprint: fp,
        awaitingClarification: false,
      };
      state = await persist(state);
      return outputBase(state, {
        message: "Verdict already recorded for this question.",
        activeQuestionId: null,
        rung: null,
        verdict: question.bestScore,
        verdictLabel: null,
        coaching: null,
        faceCue: "neutral",
        nextAction: "await_next_question",
        duplicateIgnored: false,
        verdictReplayed: true,
        rejectedStale: false,
        claimKind: decision.signals.claimKind,
      });
    }

    const outcome: KarenEvaluateOutcome = evaluateAnswer({
      question,
      answer,
      rung: frozenRung,
      state,
      ctx,
      signals: decision.signals,
    });

    if (outcome.kind === "needs_clarification") {
      state = {
        ...state,
        awaitingClarification: true,
        lastAnswerFingerprint: fp,
      };
      state = setActiveProbe(state, question.id, frozenRung);
      const styled = styleLine({
        kind: "clarify",
        text: outcome.prompt,
        config: personality,
        userText: answer,
        recorded: recordedRefsFromContext(ingestLifeContext(state)),
      });
      state = recordTurn(state, {
        role: "karen",
        text: styled.text,
        questionId: question.id,
        rung: frozenRung,
        mood: styled.mood,
      });
      state = await persist(state);
      return outputBase(state, {
        message: styled.text,
        activeQuestionId: question.id,
        rung: frozenRung,
        verdict: null,
        verdictLabel: null,
        coaching: null,
        faceCue: styled.faceCue,
        nextAction: "await_clarification",
        duplicateIgnored: false,
        verdictReplayed: false,
        rejectedStale: false,
        claimKind: "unclear",
        mood: styled.mood,
        intensity: styled.intensity,
      });
    }

    state = commitVerdictToState(state, question.id, outcome);
    if (outcome.result.shouldRequeue) {
      state = requeueWeakQuestions(state);
    }
    // After verdict only: persist concrete self-report as completion for *future* verification.
    if (
      outcome.result.claimKind === "concrete_defense" ||
      outcome.result.claimKind === "verified_fact"
    ) {
      state = recordLifeFact(state, {
        kind: "completion",
        text: answer,
        key: normalizeFactKey(answer),
        relatedQuestionId: question.id,
        source: "user_utterance",
        relevance: 1,
      });
    }
    state = {
      ...state,
      committedVerdictQuestionIds: [...state.committedVerdictQuestionIds, question.id],
      lastAnswerFingerprint: fp,
      awaitingClarification: false,
    };

    let styledVerdict: KarenStyledVerdict = styleVerdictResult(outcome.result, {
      config: personality,
      userText: answer,
      recorded: recordedRefsFromContext(ingestLifeContext(state)),
    });
    if (styledVerdict.line.safetyTriggered) {
      personality = deescalateToSweet(personality);
      styledVerdict = styleVerdictResult(outcome.result, {
        config: personality,
        userText: answer,
        recorded: recordedRefsFromContext(ingestLifeContext(state)),
      });
    }

    const message = formatVerdictMessage(styledVerdict);
    state = setLastMood(state, styledVerdict.line.mood);
    state = recordTurn(state, {
      role: "karen",
      text: message,
      questionId: question.id,
      rung: frozenRung,
      verdict: outcome.result.verdict,
      mood: styledVerdict.line.mood,
    });
    state = setActiveProbe(state, null, null);
    state = await persist(state);

    return outputBase(state, {
      message,
      activeQuestionId: null,
      rung: frozenRung,
      verdict: outcome.result.verdict,
      verdictLabel: outcome.result.label,
      coaching: styledVerdict.coaching,
      faceCue: styledVerdict.line.faceCue,
      nextAction: "await_next_question",
      duplicateIgnored: false,
      verdictReplayed: false,
      rejectedStale: false,
      claimKind: outcome.result.claimKind,
      mood: styledVerdict.line.mood,
      intensity: styledVerdict.line.intensity,
    });
  }

  function staleReject(
    state: KarenInterviewState,
    message: string,
    activeQuestionId: string | null = state.activeQuestionId,
    rung: KarenLadderRung | null = state.activeRung,
  ): KarenTurnOutput {
    return outputBase(state, {
      message,
      activeQuestionId,
      rung,
      verdict: null,
      verdictLabel: null,
      coaching: null,
      faceCue: "neutral",
      nextAction: state.awaitingClarification
        ? "await_clarification"
        : rung === "push" || rung === "floor"
          ? "await_followup"
          : activeQuestionId
            ? "await_answer"
            : "session_idle",
      duplicateIgnored: false,
      verdictReplayed: false,
      rejectedStale: true,
      claimKind: null,
    });
  }

  async function setPersonality(
    partial: Partial<KarenPersonalityConfig>,
  ): Promise<KarenPersonalityConfig> {
    personality = resolveConfig({ ...personality, ...partial });
    let state = await load();
    // Mood/intensity only — never restart question, overwrite answers, or mutate verdicts.
    const snap = {
      activeQuestionId: state.activeQuestionId,
      activeRung: state.activeRung,
      awaitingClarification: state.awaitingClarification,
      lastAnswerFingerprint: state.lastAnswerFingerprint,
      committedVerdictQuestionIds: [...state.committedVerdictQuestionIds],
      questions: state.questions,
      facts: state.facts,
    };
    state = setLastMood(state, personality.mood);
    state = { ...state, intensity: personality.intensity };
    state = await persist(state);
    if (
      state.activeQuestionId !== snap.activeQuestionId ||
      state.activeRung !== snap.activeRung ||
      state.awaitingClarification !== snap.awaitingClarification ||
      state.lastAnswerFingerprint !== snap.lastAnswerFingerprint
    ) {
      throw new Error("Personality change mutated active interview state");
    }
    return personality;
  }

  async function changeMood(mood: KarenMood): Promise<KarenPersonalityConfig> {
    return setPersonality({ mood });
  }

  async function soften(): Promise<KarenPersonalityConfig> {
    personality = deescalateToSweet(personality);
    return setPersonality(personality);
  }

  async function seedFact(input: {
    kind: KarenLifeFactKind;
    text: string;
    key?: string;
  }): Promise<KarenInterviewState> {
    let state = await load();
    state = recordLifeFact(state, { ...input, source: "seed", relevance: 0.55 });
    return persist(state);
  }

  async function getState(): Promise<KarenInterviewState> {
    return load();
  }

  return {
    askNextQuestion,
    handleAnswer,
    setPersonality,
    changeMood,
    soften,
    seedFact,
    getState,
    getPersonality: () => personality,
  };
}

export type KarenOrchestrator = ReturnType<typeof createKarenOrchestrator>;

function formatVerdictMessage(styled: KarenStyledVerdict): string {
  const parts = [styled.line.text, `Say: ${styled.coaching.say}`, `Avoid: ${styled.coaching.avoid}`];
  if (styled.coaching.fix) parts.push(`Fix: ${styled.coaching.fix}`);
  return parts.join("\n");
}

function maybeRecordObservedAnswer(
  state: KarenInterviewState,
  answer: string,
  claimKind: string,
  questionId: string,
): KarenInterviewState {
  if (claimKind === "excuse") {
    return recordLifeFact(state, {
      kind: "excuse",
      text: answer,
      key: normalizeFactKey(answer),
      relatedQuestionId: questionId,
      source: "user_utterance",
      relevance: 1,
    });
  }
  if (claimKind === "admission") {
    return recordLifeFact(state, {
      kind: "avoidance",
      text: answer,
      key: normalizeFactKey(answer),
      relatedQuestionId: questionId,
      source: "user_utterance",
      relevance: 0.9,
    });
  }
  if (claimKind === "assertion" || claimKind === "concrete_defense") {
    // concrete_defense is NOT written as completion until after verdict.
    return recordLifeFact(state, {
      kind: "answer",
      text: answer,
      key: normalizeFactKey(answer),
      relatedQuestionId: questionId,
      source: "user_utterance",
      relevance: 0.85,
    });
  }
  return state;
}
