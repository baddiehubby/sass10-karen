import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { advanceLadder } from "@/lib/karen/interview/followup-engine";
import {
  commitVerdictToState,
  evaluateAnswer,
  verdictLabel,
} from "@/lib/karen/interview/response-engine";
import {
  recordLifeFact,
  replaceQuestionBank,
  requeueWeakQuestions,
} from "@/lib/karen/interview/session-memory";
import {
  createEmptyInterviewState,
  type KarenProbeQuestion,
} from "@/lib/karen/interview/types";

function sampleQuestion(partial?: Partial<KarenProbeQuestion>): KarenProbeQuestion {
  return {
    id: partial?.id ?? "q-gym",
    category: partial?.category ?? "commitment",
    entry: "when they mention gym",
    question: partial?.question ?? "Did you keep your gym promise?",
    anchor: "promise:gym weekday",
    evidence: "confirmed promise id=f1; text=go to the gym every weekday; timesSeen=1",
    push: "Busy doing what, exactly?",
    floor: "Name one concrete action you took yesterday toward the gym.",
    rankScore: 13,
    status: "queued",
    timesAsked: 0,
    bestScore: null,
    ...partial,
  };
}

describe("Karen response-engine — Stage 3", () => {
  it("maps verdict enums to display labels", () => {
    assert.equal(verdictLabel("solid"), "Solid");
    assert.equal(verdictLabel("shaky"), "Shaky");
    assert.equal(verdictLabel("failed"), "Couldn't defend");
  });

  it("returns Solid with Say/Avoid/Fix card for a verified concrete answer", () => {
    let state = createEmptyInterviewState("solid_user");
    state = recordLifeFact(state, {
      kind: "promise",
      text: "go to the gym every weekday",
      key: "gym weekday",
    });
    state = recordLifeFact(state, {
      kind: "completion",
      text: "went to the gym for 45 minutes",
      key: "gym 45 minutes",
    });
    const q = sampleQuestion();
    state = replaceQuestionBank(state, [q]);

    const outcome = evaluateAnswer({
      question: q,
      answer: "I went to the gym for 45 minutes",
      rung: "surface",
      state,
    });
    assert.equal(outcome.kind, "verdict");
    if (outcome.kind !== "verdict") return;
    assert.equal(outcome.result.verdict, "solid");
    assert.equal(outcome.result.label, "Solid");
    assert.equal(outcome.result.claimKind, "verified_fact");
    assert.ok(outcome.result.coaching.say.length > 10);
    assert.ok(outcome.result.coaching.avoid.length > 5);
    assert.equal(outcome.result.coaching.fix, null);
    assert.equal(outcome.result.shouldRequeue, false);
    assert.ok(outcome.result.citedFactIds.length >= 1);
  });

  it("returns Shaky after a weak assertion / excuse path", () => {
    let state = createEmptyInterviewState("shaky_user");
    state = recordLifeFact(state, {
      kind: "promise",
      text: "write for one hour",
      key: "write one hour",
    });
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
    });
    const q = sampleQuestion({
      id: "q-write",
      question: "Did you write for one hour?",
      anchor: "promise:write one hour",
    });

    const ladder = advanceLadder({
      question: q,
      answer: "I was busy",
      currentRung: "surface",
      state,
    });
    assert.equal(ladder.action, "ask_followup");

    const pushOutcome = evaluateAnswer({
      question: q,
      answer: "I worked on it a bit",
      rung: "push",
      state,
    });
    assert.equal(pushOutcome.kind, "verdict");
    if (pushOutcome.kind !== "verdict") return;
    assert.equal(pushOutcome.result.verdict, "shaky");
    assert.equal(pushOutcome.result.label, "Shaky");
    assert.equal(pushOutcome.result.shouldRequeue, true);
    assert.ok(pushOutcome.result.coaching.fix);
    assert.match(pushOutcome.result.coaching.avoid, /assertion|busy|Avoid/i);
  });

  it("returns Couldn't defend for admissions and exhausted ladder failures", () => {
    let state = createEmptyInterviewState("fail_user");
    state = recordLifeFact(state, {
      kind: "goal",
      text: "ship portfolio by Friday",
      key: "portfolio friday",
    });
    state = recordLifeFact(state, {
      kind: "promise",
      text: "finish landing page",
      key: "landing page",
    });
    const q = sampleQuestion({
      id: "q-fail",
      question: "Did you finish the landing page?",
      anchor: "promise:landing page",
    });

    const admission = evaluateAnswer({
      question: q,
      answer: "I didn't do it. I skipped it.",
      rung: "surface",
      state,
    });
    assert.equal(admission.kind, "verdict");
    if (admission.kind !== "verdict") return;
    assert.equal(admission.result.verdict, "failed");
    assert.equal(admission.result.label, "Couldn't defend");
    assert.equal(admission.result.shouldRequeue, true);
    assert.ok(admission.result.coaching.say.length > 5);
    assert.ok(admission.result.coaching.avoid.length > 5);
    assert.ok(admission.result.coaching.fix);

    const floorFail = evaluateAnswer({
      question: q,
      answer: "Yeah I was busy",
      rung: "floor",
      state,
    });
    assert.equal(floorFail.kind, "verdict");
    if (floorFail.kind !== "verdict") return;
    assert.equal(floorFail.result.verdict, "failed");
    assert.equal(floorFail.result.label, "Couldn't defend");
  });

  it("refuses to pretend-evaluate unclear answers", () => {
    const q = sampleQuestion();
    const outcome = evaluateAnswer({ question: q, answer: "?", rung: "surface" });
    assert.equal(outcome.kind, "needs_clarification");
    if (outcome.kind === "needs_clarification") {
      assert.match(outcome.prompt, /clearer answer/i);
    }
  });

  it("commits weak verdicts in a way Stage 1 can requeue", () => {
    let state = createEmptyInterviewState("requeue_compat");
    const q = sampleQuestion({ id: "q-requeue" });
    state = replaceQuestionBank(state, [q]);
    const outcome = evaluateAnswer({
      question: q,
      answer: "I didn't go",
      rung: "surface",
      state,
    });
    assert.equal(outcome.kind, "verdict");
    if (outcome.kind !== "verdict") return;

    state = commitVerdictToState(state, q.id, outcome);
    const asked = state.questions.find((x) => x.id === q.id)!;
    assert.equal(asked.status, "asked");
    assert.equal(asked.bestScore, "failed");
    assert.equal(asked.timesAsked, 1);

    state = requeueWeakQuestions(state);
    assert.equal(state.questions[0]!.status, "requeued");
  });

  it("does not invent evidence citations", () => {
    const state = createEmptyInterviewState("no_invent");
    const q = sampleQuestion();
    const outcome = evaluateAnswer({
      question: q,
      answer: "I spent 30 minutes stretching at 7am",
      rung: "surface",
      state,
    });
    assert.equal(outcome.kind, "verdict");
    if (outcome.kind !== "verdict") return;
    assert.equal(outcome.result.citedFactIds.length, 0);
    assert.equal(outcome.result.claimKind, "concrete_defense");
    assert.equal(outcome.result.verdict, "solid");
    assert.match(outcome.result.justification, /No verified recorded fact matched/i);
  });

  it("keeps coaching copy free of insults and sarcasm in Stage 3", () => {
    let state = createEmptyInterviewState("tone");
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
    });
    const outcome = evaluateAnswer({
      question: sampleQuestion(),
      answer: "I was busy",
      rung: "floor",
      state,
    });
    assert.equal(outcome.kind, "verdict");
    if (outcome.kind !== "verdict") return;
    const blob = `${outcome.result.coaching.say} ${outcome.result.coaching.avoid} ${outcome.result.coaching.fix ?? ""}`;
    assert.equal(/idiot|stupid|loser|pathetic|shut up|worthless/i.test(blob), false);
    assert.equal(/netflix promoted you|refrigerator/i.test(blob), false);
  });
});
