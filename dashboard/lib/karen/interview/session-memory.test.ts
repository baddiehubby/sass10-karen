import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendSession,
  applyVerdictToQuestion,
  computeReadiness,
  createMemoryKarenSessionStore,
  findRepeatedExcuse,
  loadOrCreateInterviewState,
  openPromises,
  orderedQuestionsForSession,
  recordLifeFact,
  recordTurn,
  replaceQuestionBank,
  requeueWeakQuestions,
  saveInterviewState,
  setIntensity,
  setLastMood,
  weakCategoriesFromBank,
} from "@/lib/karen/interview/session-memory";
import {
  createEmptyInterviewState,
  KAREN_DEFAULT_PERSONALITY,
  type KarenProbeQuestion,
} from "@/lib/karen/interview/types";

function sampleQuestion(partial: Partial<KarenProbeQuestion> & Pick<KarenProbeQuestion, "id">): KarenProbeQuestion {
  return {
    id: partial.id,
    category: partial.category ?? "commitment",
    entry: partial.entry ?? "when they mention goals",
    question: partial.question ?? "Did you keep the promise you made?",
    anchor: partial.anchor ?? "promise:gym",
    evidence: partial.evidence ?? "user promised gym",
    push: partial.push ?? "Busy doing what, exactly?",
    floor: partial.floor ?? "Name one concrete action you took yesterday.",
    rankScore: partial.rankScore ?? 12,
    status: partial.status ?? "queued",
    timesAsked: partial.timesAsked ?? 0,
    bestScore: partial.bestScore ?? null,
  };
}

describe("Karen session-memory — Stage 1", () => {
  it("creates an empty interview state for a new user", async () => {
    const store = createMemoryKarenSessionStore();
    const state = await loadOrCreateInterviewState(store, "user_a", new Date("2026-11-15T10:00:00.000Z"));
    assert.equal(state.userId, "user_a");
    assert.equal(state.schemaVersion, 1);
    assert.equal(state.questions.length, 0);
    assert.equal(state.scorecard.readiness, 0);
    assert.equal(state.scorecard.trend, "first session");
    assert.equal(state.intensity, 3);
    assert.equal(state.lastMood, "sarcastic");
  });

  it("remembers a previous commitment (promise) across save/load", async () => {
    const store = createMemoryKarenSessionStore();
    let state = await loadOrCreateInterviewState(store, "user_b");
    state = recordLifeFact(state, {
      kind: "promise",
      text: "I will go to the gym every weekday",
      key: "gym every weekday",
      at: "2026-11-14T08:00:00.000Z",
    });
    await saveInterviewState(store, state, new Date("2026-11-14T08:01:00.000Z"));

    const reloaded = await loadOrCreateInterviewState(store, "user_b");
    const open = openPromises(reloaded);
    assert.equal(open.length, 1);
    assert.match(open[0]!.text, /gym/i);
    assert.equal(open[0]!.timesSeen, 1);
  });

  it("closes a promise when a matching completion is recorded", async () => {
    let state = createEmptyInterviewState("user_c");
    state = recordLifeFact(state, { kind: "promise", text: "finish the report", key: "finish the report" });
    assert.equal(openPromises(state).length, 1);
    state = recordLifeFact(state, { kind: "completion", text: "finished the report", key: "finish the report" });
    assert.equal(openPromises(state).length, 0);
  });

  it("recognises a repeated excuse by key and timesSeen", () => {
    let state = createEmptyInterviewState("user_d");
    state = recordLifeFact(state, { kind: "excuse", text: "I was busy", key: "i was busy" });
    assert.equal(findRepeatedExcuse(state, "I was busy"), null);
    state = recordLifeFact(state, { kind: "excuse", text: "I was busy again", key: "i was busy" });
    const hit = findRepeatedExcuse(state, "I was busy");
    assert.ok(hit);
    assert.equal(hit!.timesSeen, 2);
    assert.equal(hit!.key, "i was busy");
  });

  it("applies verdicts, requeues weaks, and leads with requeued probes", () => {
    let state = createEmptyInterviewState("user_e");
    state = replaceQuestionBank(state, [
      sampleQuestion({ id: "q-solid", rankScore: 14, category: "commitment" }),
      sampleQuestion({ id: "q-fail", rankScore: 11, category: "excuse_pattern" }),
      sampleQuestion({ id: "q-shaky", rankScore: 13, category: "tradeoff" }),
    ]);

    state = applyVerdictToQuestion(state, "q-solid", "solid");
    state = applyVerdictToQuestion(state, "q-fail", "failed");
    state = applyVerdictToQuestion(state, "q-shaky", "shaky");
    state = requeueWeakQuestions(state);

    const fail = state.questions.find((q) => q.id === "q-fail")!;
    const shaky = state.questions.find((q) => q.id === "q-shaky")!;
    const solid = state.questions.find((q) => q.id === "q-solid")!;
    assert.equal(fail.status, "requeued");
    assert.equal(shaky.status, "requeued");
    assert.equal(solid.status, "asked");
    assert.equal(solid.bestScore, "solid");
    assert.equal(fail.timesAsked, 1);

    const ordered = orderedQuestionsForSession(state);
    assert.equal(ordered[0]!.status, "requeued");
    assert.ok(ordered[0]!.rankScore >= ordered[1]!.rankScore);
    assert.ok(ordered.some((q) => q.id === "q-solid" && q.status === "asked"));
  });

  it("computes readiness as rank-weighted solid percentage", () => {
    const questions = [
      sampleQuestion({ id: "a", rankScore: 10, bestScore: "solid" }),
      sampleQuestion({ id: "b", rankScore: 10, bestScore: "failed" }),
    ];
    assert.equal(computeReadiness(questions), 50);
    assert.equal(computeReadiness([]), 0);
  });

  it("appends a session scorecard with trend vs prior readiness", () => {
    let state = createEmptyInterviewState("user_f");
    state = replaceQuestionBank(state, [
      sampleQuestion({ id: "q1", rankScore: 10, bestScore: "solid", status: "asked", category: "commitment" }),
      sampleQuestion({
        id: "q2",
        rankScore: 10,
        bestScore: "failed",
        status: "asked",
        category: "excuse_pattern",
      }),
    ]);
    state = appendSession(state, {
      mode: "default",
      asked: 2,
      completed: true,
      solid: 1,
      shaky: 0,
      failed: 1,
      weakAreas: weakCategoriesFromBank(state.questions),
      date: "2026-11-15T12:00:00.000Z",
    });
    assert.equal(state.scorecard.readiness, 50);
    assert.equal(state.scorecard.trend, "first session");
    assert.equal(state.scorecard.sessions.length, 1);
    assert.deepEqual(state.scorecard.sessions[0]!.weakAreas, ["excuse_pattern"]);

    state = replaceQuestionBank(state, [
      sampleQuestion({ id: "q1", rankScore: 10, bestScore: "solid", status: "asked" }),
      sampleQuestion({ id: "q2", rankScore: 10, bestScore: "solid", status: "asked" }),
    ]);
    state = appendSession(state, {
      mode: "quick",
      asked: 2,
      completed: true,
      solid: 2,
      shaky: 0,
      failed: 0,
      weakAreas: [],
      date: "2026-11-16T12:00:00.000Z",
    });
    assert.equal(state.scorecard.readiness, 100);
    assert.equal(state.scorecard.trend, "+50 vs last session");
  });

  it("keeps conversational turns and mood across sessions in the store", async () => {
    const store = createMemoryKarenSessionStore();
    let state = await loadOrCreateInterviewState(store, "user_g");
    state = setIntensity(state, 5);
    state = setLastMood(state, "furious");
    state = recordTurn(state, {
      role: "user",
      text: "No, I did not work today",
      at: "2026-11-15T09:00:00.000Z",
    });
    state = recordTurn(state, {
      role: "karen",
      text: "Netflix promoted you again?",
      mood: "sarcastic",
      rung: "push",
      at: "2026-11-15T09:00:01.000Z",
    });
    state = recordLifeFact(state, {
      kind: "avoidance",
      text: "skipped work for Netflix",
      key: "skipped work netflix",
    });
    state = recordLifeFact(state, {
      kind: "goal",
      text: "ship the portfolio by Friday",
      key: "portfolio friday",
    });
    state = recordLifeFact(state, {
      kind: "daily_progress",
      text: "0 deep work hours",
      key: "2026-11-15 deep work",
    });
    await saveInterviewState(store, state);

    const later = await loadOrCreateInterviewState(store, "user_g");
    assert.equal(later.intensity, 5);
    assert.equal(later.lastMood, "sarcastic");
    assert.equal(later.recentTurns.length, 2);
    assert.equal(later.recentTurns[0]!.text, "No, I did not work today");
    assert.ok(later.facts.some((f) => f.kind === "goal"));
    assert.ok(later.facts.some((f) => f.kind === "daily_progress"));
    assert.ok(later.facts.some((f) => f.kind === "avoidance"));
  });

  it("keeps Buddy personality defaults out of Karen defaults", () => {
    assert.equal(KAREN_DEFAULT_PERSONALITY.mood, "sarcastic");
    assert.deepEqual(KAREN_DEFAULT_PERSONALITY.banned, [
      "slurs",
      "threats",
      "identity_attacks",
      "genuine_harassment",
    ]);
    assert.notEqual(KAREN_DEFAULT_PERSONALITY.mood, "warm");
  });

  it("keeps users isolated in the store", async () => {
    const store = createMemoryKarenSessionStore();
    let a = await loadOrCreateInterviewState(store, "alpha");
    a = recordLifeFact(a, { kind: "promise", text: "alpha only", key: "alpha only" });
    await saveInterviewState(store, a);

    const b = await loadOrCreateInterviewState(store, "beta");
    assert.equal(openPromises(b).length, 0);
    assert.equal(openPromises(await loadOrCreateInterviewState(store, "alpha")).length, 1);
  });
});
