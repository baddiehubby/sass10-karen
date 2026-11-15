import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ingestLifeContext } from "@/lib/karen/interview/context-engine";
import {
  advanceLadder,
  classifyAnswerClaim,
  currentRungForQuestion,
  ladderUsedForQuestion,
} from "@/lib/karen/interview/followup-engine";
import {
  recordLifeFact,
  recordTurn,
  setActiveProbe,
} from "@/lib/karen/interview/session-memory";
import {
  createEmptyInterviewState,
  type KarenProbeQuestion,
} from "@/lib/karen/interview/types";

function sampleQuestion(partial?: Partial<KarenProbeQuestion>): KarenProbeQuestion {
  return {
    id: partial?.id ?? "q-1",
    category: partial?.category ?? "commitment",
    entry: partial?.entry ?? "when they mention the promise",
    question: partial?.question ?? "Did you keep your gym promise?",
    anchor: partial?.anchor ?? "promise:gym weekday",
    evidence: partial?.evidence ?? "confirmed promise id=f1; text=gym every weekday; timesSeen=1",
    push: partial?.push ?? "Busy doing what, exactly?",
    floor: partial?.floor ?? "Name one concrete action you took yesterday toward the gym.",
    rankScore: partial?.rankScore ?? 12,
    status: partial?.status ?? "queued",
    timesAsked: partial?.timesAsked ?? 0,
    bestScore: partial?.bestScore ?? null,
  };
}

describe("Karen followup-engine — Stage 3", () => {
  it("distinguishes excuse, assertion, and verified recorded fact", () => {
    let state = createEmptyInterviewState("u1");
    state = recordLifeFact(state, {
      kind: "completion",
      text: "went to the gym for 45 minutes",
      key: "gym 45 minutes",
    });
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
    });
    const ctx = ingestLifeContext(state);

    const verified = classifyAnswerClaim("I went to the gym for 45 minutes", ctx);
    assert.equal(verified.claimKind, "verified_fact");
    assert.ok(verified.matchedFacts.some((f) => f.kind === "completion"));

    const excuse = classifyAnswerClaim("I was busy", ctx);
    assert.equal(excuse.claimKind, "excuse");
    assert.ok(excuse.matchedExcuses.length >= 1);

    const assertion = classifyAnswerClaim("Yes I did it", ctx);
    assert.equal(assertion.claimKind, "assertion");
    assert.equal(assertion.isShaky, true);
  });

  it("asks for clarification instead of advancing the ladder on unclear answers", () => {
    const q = sampleQuestion();
    const decision = advanceLadder({ question: q, answer: "…", currentRung: "surface" });
    assert.equal(decision.action, "clarify");
    if (decision.action === "clarify") {
      assert.match(decision.prompt, /clearer answer/i);
      assert.equal(decision.signals.claimKind, "unclear");
    }
  });

  it("opens Push when a surface answer is shaky/excuse-shaped", () => {
    let state = createEmptyInterviewState("u2");
    state = recordLifeFact(state, {
      kind: "promise",
      text: "gym every weekday",
      key: "gym weekday",
    });
    const q = sampleQuestion();
    const decision = advanceLadder({
      question: q,
      answer: "I was busy",
      currentRung: "surface",
      state,
    });
    assert.equal(decision.action, "ask_followup");
    if (decision.action === "ask_followup") {
      assert.equal(decision.rung, "push");
      assert.match(decision.prompt, /Busy doing what/i);
      assert.equal(decision.ladderUsed, true);
    }
  });

  it("escalates Push hand-wave to Floor, then stops (one ladder max)", () => {
    const q = sampleQuestion();
    const push = advanceLadder({
      question: q,
      answer: "Yeah I was busy",
      currentRung: "surface",
    });
    assert.equal(push.action, "ask_followup");
    assert.equal(push.action === "ask_followup" && push.rung, "push");

    const floor = advanceLadder({
      question: q,
      answer: "Still busy",
      currentRung: "push",
      ladderUsed: true,
    });
    assert.equal(floor.action, "ask_followup");
    if (floor.action === "ask_followup") {
      assert.equal(floor.rung, "floor");
    }

    const afterFloor = advanceLadder({
      question: q,
      answer: "Whatever",
      currentRung: "floor",
      ladderUsed: true,
    });
    assert.equal(afterFloor.action, "ready_for_verdict");
    assert.equal(afterFloor.rung, "floor");
  });

  it("skips the ladder when the answer is a concrete defense or admission", () => {
    const q = sampleQuestion();
    const solidish = advanceLadder({
      question: q,
      answer: "I spent 40 minutes on deadlifts at 6pm",
      currentRung: "surface",
    });
    assert.equal(solidish.action, "ready_for_verdict");
    assert.equal(solidish.signals.claimKind, "concrete_defense");

    const admission = advanceLadder({
      question: q,
      answer: "I didn't go. I skipped it.",
      currentRung: "surface",
    });
    assert.equal(admission.action, "ready_for_verdict");
    assert.equal(admission.signals.claimKind, "admission");
  });

  it("depends on recorded context when wording follow-ups for known excuses", () => {
    let state = createEmptyInterviewState("u3");
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
      // timesSeen becomes 2
    });
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
    });
    const decision = advanceLadder({
      question: sampleQuestion(),
      answer: "I was busy",
      currentRung: "surface",
      state,
    });
    assert.equal(decision.action, "ask_followup");
    if (decision.action === "ask_followup") {
      assert.match(decision.prompt, /I was busy/i);
    }
  });

  it("tracks ladder usage from session turns", () => {
    let state = createEmptyInterviewState("u4");
    const q = sampleQuestion({ id: "q-track" });
    state = setActiveProbe(state, q.id, "surface");
    assert.equal(ladderUsedForQuestion(state, q.id), false);
    state = recordTurn(state, {
      role: "karen",
      text: "Busy doing what?",
      questionId: q.id,
      rung: "push",
    });
    state = setActiveProbe(state, q.id, "push");
    assert.equal(ladderUsedForQuestion(state, q.id), true);
    assert.equal(currentRungForQuestion(state, q.id), "push");
  });

  it("never invents matched facts when none were recorded", () => {
    const ctx = ingestLifeContext(createEmptyInterviewState("u5"));
    const signals = classifyAnswerClaim("I crushed my workout this morning", ctx);
    assert.equal(signals.matchedFacts.length, 0);
    assert.notEqual(signals.claimKind, "verified_fact");
  });
});
